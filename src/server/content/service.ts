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

  private async liveList(): Promise<{ list: CachedList | null; state: LiveFeedState }> {
    if (!this.liveEnabled() || !this.provider) {
      return { list: null, state: { status: "disabled" } };
    }
    const nowD = this.now();
    const today = nowD.toISOString().slice(0, 10);
    const cached = await this.store.read<CachedList>(this.listKey(today));
    const fresh = cached && nowD.getTime() - new Date(cached.fetchedAt).getTime() < this.cfg.content.refreshHours * 3600_000;
    if (cached && fresh) return { list: cached, state: { status: "ok", fetchedAt: cached.fetchedAt } };
    try {
      const candidates = await this.dedupe.run(`list:${today}:${cached?.fetchedAt ?? ""}`, () => this.provider!.listCandidates(today));
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

  async listStories(interests: Interest[]): Promise<{ cards: StoryCard[]; live: LiveFeedState }> {
    const picks: StoryCard[] = [];
    const { list, state } = await this.liveList();
    if (list) {
      const usable = list.candidates.filter((c) => !list.insufficient.includes(c.storyId));
      const matched = usable.filter((c) => c.interest && interests.includes(c.interest));
      // Up to 4 live stories: interest matches first, at most 2 per feed, so news, trending and featured all get a look-in.
      const chosen: LiveCandidate[] = [];
      const perFeed: Record<string, number> = {};
      for (const c of [...matched, ...usable.filter((c) => !matched.includes(c))]) {
        if (chosen.length >= 4) break;
        if ((perFeed[c.feed] ?? 0) >= 2) continue;
        perFeed[c.feed] = (perFeed[c.feed] ?? 0) + 1;
        chosen.push(c);
      }
      for (const c of chosen) {
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
            publisher: "Wikipedia — \"In the news\"",
            publishedAt: c.featuredOn,
            retrievedAt: list.fetchedAt,
            sourceUpdatedAt: c.sourceUpdatedAt,
          },
          estimatedMinutes: 5,
          whySelected: `${FEED_LABEL[c.feed]}${c.interest && interests.includes(c.interest) ? ` · matches your interest in ${interestLabel(c.interest)}` : ""}.`,
          briefingReady: !!cachedBriefing,
        });
      }
    }
    const evergreen = evergreenCards();
    const want = interests.length ? interests : ["business", "culture", "science"];
    const ordered: StoryCard[] = [];
    // Round-robin across chosen interests, then everything else; rotate daily for variety.
    const dayIndex = Math.floor(this.now().getTime() / 86400_000);
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
    return { cards: [...picks, ...ordered].slice(0, 7), live: state };
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
