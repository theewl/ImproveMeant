import type { Briefing, Interest, StoryCard } from "../../shared/types";
import { ALL_INTERESTS, evergreenBriefing, evergreenCards } from "../../shared/evergreen";
import type { Config } from "../config";
import type { CoachProvider } from "../coach/types";
import type { Deduper } from "../dedupe";
import { AppError } from "../errors";
import type { KeyValueStore } from "../store";
import type { ContentProvider, LiveCandidate, SourceDocument, TopicHit } from "./types";
import { stableHash } from "../../shared/evergreen";
import { boundText } from "../../shared/text";

export interface LiveFeedState {
  status: "ok" | "stale" | "unavailable" | "disabled";
  fetchedAt?: string;
  message?: string;
}

interface CachedList {
  fetchedAt: string;
  date: string;
  candidates: LiveCandidate[];
  /** Story ids found to have too little text for a reliable briefing. */
  insufficient: string[];
}

export interface BriefingWithStatus extends Briefing {
  /** The source has been edited since this briefing was generated. */
  sourceChanged: boolean;
}

const FEED_LABEL: Record<LiveCandidate["feed"], string> = {
  news: "In the news today",
  trending: "Widely read today",
  featured: "Today's featured article",
  timeless: "A timeless topic for your interests",
  search: "A topic you chose",
  own: "Your material",
};

const interestLabel = (i: Interest) => ALL_INTERESTS.find((x) => x.id === i)?.label ?? i;

export class ContentService {
  constructor(
    private cfg: Config,
    private store: KeyValueStore,
    private coach: CoachProvider,
    private provider: ContentProvider | null,
    private dedupe: Deduper,
    private now: () => Date = () => new Date(),
  ) {}

  /** Live stories are offered only when we can both fetch source text and generate a grounded briefing. */
  liveEnabled(): boolean {
    return this.provider !== null && this.cfg.content.live !== "off" && this.coach.kind === "claude";
  }

  private listKey(date: string) {
    return `live-list-${date}`;
  }

  private async liveList(force = false): Promise<{ list: CachedList | null; state: LiveFeedState }> {
    if (!this.liveEnabled() || !this.provider) {
      return { list: null, state: { status: "disabled" } };
    }
    const nowD = this.now();
    const today = nowD.toISOString().slice(0, 10);
    const cached = await this.store.read<CachedList>(this.listKey(today));
    const fresh = cached && nowD.getTime() - new Date(cached.fetchedAt).getTime() < this.cfg.content.refreshHours * 3600_000;
    if (cached && fresh && !force) return { list: cached, state: { status: "ok", fetchedAt: cached.fetchedAt } };
    try {
      const candidates = await this.dedupe.run(`list:${today}:${force ? nowD.getTime() : (cached?.fetchedAt ?? "")}`, () => this.provider!.listCandidates(today));
      const list: CachedList = { fetchedAt: nowD.toISOString(), date: today, candidates: candidates.value, insufficient: cached?.insufficient ?? [] };
      await this.store.write(this.listKey(today), list);
      await this.store.write("live-list-latest", list);
      return { list, state: { status: "ok", fetchedAt: list.fetchedAt } };
    } catch (err) {
      const fallback = cached ?? (await this.store.read<CachedList>("live-list-latest"));
      const message = `Couldn't refresh today's news (${(err as Error).message}).`;
      if (fallback) return { list: fallback, state: { status: "stale", fetchedAt: fallback.fetchedAt, message: `${message} Showing stories fetched ${fallback.fetchedAt.slice(0, 16).replace("T", " ")} UTC.` } };
      return { list: null, state: { status: "unavailable", message } };
    }
  }

  /**
   * Once a day per interest set, ask the coach to pick the most interesting, explainable
   * items from everything in the feed, plus a few timeless topics. Picks are validated
   * against real candidates (exact titles) and suggestions are resolved through the
   * provider, so nothing made up can reach the learner. Falls back to the plain
   * interest match if curation fails.
   */
  private async curatedPicks(list: CachedList, interests: Interest[]): Promise<{ storyId: string; why: string }[] | null> {
    const usable = list.candidates.filter((c) => !list.insufficient.includes(c.storyId));
    if (usable.length === 0) return null;
    const key = `picks-${list.date}-${[...interests].sort().join("+") || "any"}`;
    const cached = await this.store.read<{ fetchedAt: string; picks: { storyId: string; why: string }[] }>(key);
    if (cached && cached.fetchedAt === list.fetchedAt) return cached.picks;
    const candidates = usable.slice(0, 40).map((c) => ({ title: c.title, description: c.description || c.blurb, feed: c.feed }));
    try {
      const { value: out } = await this.dedupe.run(`curate:${key}:${list.fetchedAt}`, () =>
        this.coach.curateTopics({ interests: interests.map((i) => interestLabel(i)), candidates }),
      );
      const byTitle = new Map(usable.map((c) => [c.title.toLowerCase(), c]));
      const picks: { storyId: string; why: string }[] = [];
      for (const p of out.picks) {
        const c = byTitle.get(p.title.trim().toLowerCase());
        if (c && !picks.some((x) => x.storyId === c.storyId)) picks.push({ storyId: c.storyId, why: p.why });
      }
      // Timeless suggestions: resolve each title through the provider, in parallel and bounded; keep only real articles.
      const extra: LiveCandidate[] = [];
      const resolved = await Promise.all(
        out.suggestions.slice(0, 3).map(async (sug) => {
          try {
            const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));
            const c = await Promise.race([
              (async () => {
                const hit = (await this.provider!.searchTopics(sug.title))[0];
                return hit ? await this.provider!.lookup(hit.pageid) : null;
              })(),
              timeout,
            ]);
            return c ? { c, why: sug.why } : null;
          } catch {
            return null;
          }
        }),
      );
      for (const r of resolved) {
        if (!r) continue;
        const { c, why } = r;
        if (!byTitle.has(c.title.toLowerCase()) && !picks.some((x) => x.storyId === c.storyId) && !extra.some((e) => e.storyId === c.storyId)) {
          extra.push({ ...c, feed: "timeless" });
          picks.push({ storyId: c.storyId, why });
        }
      }
      if (extra.length) {
        const custom = (await this.store.read<LiveCandidate[]>("custom-topics")) ?? [];
        await this.store.write("custom-topics", [...extra, ...custom.filter((x) => !extra.some((e) => e.storyId === x.storyId))].slice(0, 200));
      }
      await this.store.write(key, { fetchedAt: list.fetchedAt, picks });
      return picks;
    } catch {
      return null;
    }
  }

  /**
   * Fast path: today's live stories by plain interest match plus curated evergreen ideas.
   * The AI-curated ordering is a separate, slower call (`curatedStories`) so this never
   * waits on the model. `curation` tells the client whether to ask for it.
   */
  async listStories(interests: Interest[], opts: { refresh?: boolean; seed?: number; curated?: boolean } = {}): Promise<{ cards: StoryCard[]; live: LiveFeedState; curation: "available" | "none" }> {
    const picks: StoryCard[] = [];
    const { list, state } = await this.liveList(!!opts.refresh);
    let curation: "available" | "none" = "none";
    if (list) {
      const usable = list.candidates.filter((c) => !list.insufficient.includes(c.storyId));
      curation = usable.length > 0 ? "available" : "none";
      const curated = opts.curated ? await this.curatedPicks(list, interests) : null;
      const custom = (await this.store.read<LiveCandidate[]>("custom-topics")) ?? []; // after curation, which may add timeless topics
      let chosen: { c: LiveCandidate; why: string }[] = [];
      if (curated && curated.length) {
        for (const p of curated) {
          const c = usable.find((x) => x.storyId === p.storyId) ?? custom.find((x) => x.storyId === p.storyId);
          if (c) chosen.push({ c, why: p.why });
        }
      }
      if (chosen.length === 0) {
        const matched = usable.filter((c) => c.interest && interests.includes(c.interest));
        const perFeed: Record<string, number> = {};
        for (const c of [...matched, ...usable.filter((c) => !matched.includes(c))]) {
          if (chosen.length >= 4) break;
          if ((perFeed[c.feed] ?? 0) >= 2) continue;
          perFeed[c.feed] = (perFeed[c.feed] ?? 0) + 1;
          chosen.push({ c, why: `${FEED_LABEL[c.feed]}${c.interest && interests.includes(c.interest) ? ` · matches your interest in ${interestLabel(c.interest)}` : ""}.` });
        }
      }
      for (const { c, why } of chosen.slice(0, 6)) {
        const cachedBriefing = await this.store.read<Briefing>(this.briefingKey(c.storyId));
        picks.push({
          id: c.storyId,
          kind: "current",
          feed: c.feed,
          title: c.title,
          description: c.blurb,
          interest: c.interest ?? "culture",
          source: {
            url: c.url,
            publisher: "Wikipedia",
            publishedAt: c.featuredOn,
            retrievedAt: list.fetchedAt,
            sourceUpdatedAt: c.sourceUpdatedAt,
          },
          estimatedMinutes: 5,
          whySelected: why,
          briefingReady: !!cachedBriefing,
        });
      }
    }
    const evergreen = evergreenCards();
    const want = interests.length ? interests : ["business", "culture", "science"];
    const ordered: StoryCard[] = [];
    // Round-robin across chosen interests, then everything else; rotate daily (or by seed) for variety.
    const dayIndex = Math.floor(this.now().getTime() / 86400_000) + (opts.seed ?? 0);
    const byInterest = want.map((i) => rotate(evergreen.filter((c) => c.interest === i), dayIndex));
    for (let round = 0; ordered.length < 3 && round < 4; round++) {
      for (const group of byInterest) {
        const c = group[round];
        if (c && ordered.length < 3) ordered.push({ ...c, whySelected: `Curated idea matching your interest in ${interestLabel(c.interest)}.` });
      }
    }
    for (const c of rotate(evergreen, dayIndex)) {
      if (ordered.length >= 3) break;
      if (!ordered.some((o) => o.id === c.id)) ordered.push({ ...c, whySelected: "Curated idea worth knowing." });
    }
    return { cards: [...picks, ...ordered].slice(0, 9), live: state, curation };
  }

  /** The AI-curated live stories for these interests (cached per day). May take several seconds. */
  async curatedStories(interests: Interest[]): Promise<{ cards: StoryCard[] }> {
    const r = await this.listStories(interests, { curated: true });
    return { cards: r.cards.filter((c) => c.kind === "current") };
  }

  async searchTopics(query: string): Promise<TopicHit[]> {
    if (!this.liveEnabled() || !this.provider) throw new AppError("not_configured", "Topic search needs live content and Claude to be configured.", 501);
    try {
      return await this.provider.searchTopics(query);
    } catch (err) {
      throw new AppError("provider_error", `Couldn't search topics (${(err as Error).message}).`, 502, true);
    }
  }

  /** Register a searched article as a story so it can be briefed like any live story. */
  async addTopic(pageid: number): Promise<{ storyId: string; title: string }> {
    if (!this.liveEnabled() || !this.provider) throw new AppError("not_configured", "Topics need live content and Claude to be configured.", 501);
    let c: LiveCandidate | null;
    try {
      c = await this.provider.lookup(pageid);
    } catch (err) {
      throw new AppError("provider_error", `Couldn't fetch that topic (${(err as Error).message}).`, 502, true);
    }
    if (!c) throw new AppError("not_found", "That article wasn't found.", 404);
    const custom = (await this.store.read<LiveCandidate[]>("custom-topics")) ?? [];
    await this.store.write("custom-topics", [c, ...custom.filter((x) => x.storyId !== c.storyId)].slice(0, 200));
    return { storyId: c.storyId, title: c.title };
  }

  /** A briefing from material the learner pasted. Never cached on the server; bounded; dedupe by content hash. */
  async briefOwnMaterial(title: string, text: string): Promise<Briefing> {
    if (this.coach.kind !== "claude") throw new AppError("not_configured", "Briefings from your own material need Claude to be configured.", 501);
    const bounded = boundText(text.trim(), this.cfg.limits.maxSourceChars);
    if (bounded.text.length < 400) throw new AppError("insufficient_source", "Paste a bit more — at least a few paragraphs — so the briefing has something to work with.", 422);
    const hash = stableHash(bounded.text);
    const doc: SourceDocument = {
      storyId: `own-${hash}`,
      title: title.trim() || "Your material",
      text: bounded.text,
      partial: bounded.truncated,
      revision: hash,
      license: "user-provided",
      source: { url: "", publisher: "Your material", publishedAt: this.now().toISOString().slice(0, 10), retrievedAt: this.now().toISOString() },
    };
    const { value } = await this.dedupe.run(`own:${hash}`, () => this.coach.briefing(doc));
    return { ...value, feed: "own" };
  }

  private briefingKey(id: string) {
    return `briefing-${id.replace(/[^a-z0-9-]/gi, "")}`;
  }

  async getBriefing(storyId: string, opts: { refresh?: boolean } = {}): Promise<BriefingWithStatus> {
    const eg = evergreenBriefing(storyId);
    if (eg) return { ...eg, sourceChanged: false };
    if (!storyId.startsWith("wp-")) throw new AppError("not_found", "Story not found.", 404);

    const { list } = await this.liveList();
    const candidate = list?.candidates.find((c) => c.storyId === storyId) ?? (await this.findInRecentLists(storyId));
    const cached = await this.store.read<Briefing>(this.briefingKey(storyId));
    const changed = !!(cached && candidate && candidate.revision && cached.sourceVersion !== candidate.revision);
    if (cached && !(opts.refresh && changed)) return { ...cached, sourceChanged: changed };
    if (!candidate) throw new AppError("not_found", "This story is no longer in the news feed.", 404);
    if (!this.liveEnabled() || !this.provider) {
      throw new AppError("not_configured", "Live briefings need Claude to be configured. Choose a curated story instead.", 501);
    }

    const { value } = await this.dedupe.run(`briefing:${storyId}:${candidate.revision}`, async () => {
      let doc;
      try {
        doc = await this.provider!.fetchDocument(candidate, this.cfg.limits.maxSourceChars);
      } catch (err) {
        throw new AppError("provider_error", `Couldn't fetch the source article (${(err as Error).message}).`, 502, true);
      }
      if (doc.text.length < this.cfg.content.minSourceChars) {
        await this.markInsufficient(storyId);
        throw new AppError("insufficient_source", "This story doesn't have enough source text yet for a reliable briefing. Pick another story.", 422);
      }
      try {
        const b = await this.coach.briefing(doc);
        await this.store.write(this.briefingKey(storyId), b);
        return b;
      } catch (err) {
        if (err instanceof AppError && err.code === "insufficient_source") await this.markInsufficient(storyId);
        throw err;
      }
    });
    return { ...value, sourceChanged: false };
  }

  /** Current source version for a saved review item, so outdated items aren't taught as current fact. */
  /** A briefing that already exists (evergreen, or generated earlier). Never fetches or generates. */
  async cachedBriefing(storyId: string): Promise<Briefing | null> {
    const eg = evergreenBriefing(storyId);
    if (eg) return eg;
    if (!storyId.startsWith("wp-")) return null;
    return (await this.store.read<Briefing>(this.briefingKey(storyId))) ?? null;
  }

  async storyStatus(storyId: string): Promise<{ sourceVersion: string | null; sourceUpdatedAt?: string; known: boolean }> {
    const eg = evergreenBriefing(storyId);
    if (eg) return { sourceVersion: eg.sourceVersion, known: true };
    const { list } = await this.liveList();
    const c = list?.candidates.find((x) => x.storyId === storyId) ?? (await this.findInRecentLists(storyId));
    if (!c) return { sourceVersion: null, known: false };
    return { sourceVersion: c.revision || null, sourceUpdatedAt: c.sourceUpdatedAt, known: true };
  }

  private async findInRecentLists(storyId: string): Promise<LiveCandidate | undefined> {
    const custom = (await this.store.read<LiveCandidate[]>("custom-topics")) ?? [];
    const own = custom.find((c) => c.storyId === storyId);
    if (own) return own;
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.now().getTime() - i * 86400_000).toISOString().slice(0, 10);
      const l = await this.store.read<CachedList>(this.listKey(d));
      const c = l?.candidates.find((x) => x.storyId === storyId);
      if (c) return c;
    }
    return undefined;
  }

  private async markInsufficient(storyId: string) {
    const today = this.now().toISOString().slice(0, 10);
    const l = await this.store.read<CachedList>(this.listKey(today));
    if (l && !l.insufficient.includes(storyId)) {
      l.insufficient.push(storyId);
      await this.store.write(this.listKey(today), l);
    }
  }
}

function rotate<T>(xs: T[], n: number): T[] {
  if (xs.length === 0) return xs;
  const k = n % xs.length;
  return [...xs.slice(k), ...xs.slice(0, k)];
}
