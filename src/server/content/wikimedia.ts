import type { Interest } from "../../shared/types";
import { boundText } from "../../shared/text";
import type { ContentProvider, LiveCandidate, SourceDocument, TopicHit } from "./types";

// Live content: Wikipedia's "In the news" via the Wikimedia featured-content feed,
// with article text from the MediaWiki Action API (plain-text extracts).
//
// Why this provider: no API key, a published reuse license (CC BY-SA 4.0) that
// permits processing and adaptation with attribution and share-alike, and stable
// revision ids for correction tracking. Wikimedia asks API clients to send a
// descriptive User-Agent with contact information (CONTENT_USER_AGENT).
// Shapes based on public docs: https://api.wikimedia.org/wiki/Feed_API/Reference/Featured_content
// and https://www.mediawiki.org/wiki/Extension:TextExtracts — not live-verified from the dev container.

export const WIKI_LICENSE = "CC BY-SA 4.0 (Wikipedia contributors)";

type Fetch = typeof fetch;

interface FeedLink {
  type?: string;
  title?: string;
  titles?: { normalized?: string; display?: string };
  pageid?: number;
  description?: string;
  extract?: string;
  timestamp?: string;
  revision?: string;
  content_urls?: { desktop?: { page?: string } };
}

interface FeedResponse {
  news?: { story?: string; links?: FeedLink[] }[];
  mostread?: { articles?: (FeedLink & { views?: number; normalizedtitle?: string })[] };
  tfa?: FeedLink & { normalizedtitle?: string };
}

/** Titles that are never good explain-it topics (lists, meta pages, death lists, bare dates). */
const SKIP_TITLE = /^(List of|Lists of|Deaths in|Main Page|Wikipedia:|Special:|Portal:|\d{4}( in | )|[A-Z][a-z]+ \d{1,2}$|\d{1,2} [A-Z][a-z]+$)/;
/** Descriptions typical of celebrity/film/sports bios, which are popular but rarely worth explaining at work. */
const SKIP_DESC = /\b(actor|actress|singer|rapper|footballer|cricketer|basketball player|wrestler|model|television series|film|album|song|video game|boxer|influencer|youtuber|porn)\b/i;

const SENSITIVE = /\b(killed|kills|dies|died|death|dead|massacre|shooting|bombing|attack|attacks|murder|suicide|crash)\b/i;

const INTEREST_KEYWORDS: [Interest, RegExp][] = [
  ["technology", /\b(software|artificial intelligence|\bai\b|computer|internet|smartphone|chip|semiconductor|robot|satellite|rocket|spacecraft|launch|cyber|app)\b/i],
  ["science", /\b(scien|discover|species|fossil|telescope|astronom|physic|chemist|biolog|genom|nobel prize in (physics|chemistry)|space|planet|asteroid)\w*/i],
  ["health", /\b(health|disease|outbreak|vaccine|virus|medical|medicine|hospital|epidemic|pandemic|drug|nobel prize in physiology)\w*/i],
  ["environment", /\b(climate|earthquake|hurricane|typhoon|cyclone|flood|wildfire|volcan|eruption|drought|emission|biodiversity|storm|heatwave)\w*/i],
  ["business", /\b(company|companies|econom|bank|merger|acquisition|market|trade|tariff|inflation|ceo|stock|gdp|currency|industry)\w*/i],
  ["culture", /\b(film|music|album|award|prize|festival|literature|novel|museum|art|sport|championship|cup|olympic|world cup|election)\w*/i],
];

export function classifyInterest(text: string): Interest | null {
  for (const [interest, re] of INTEREST_KEYWORDS) if (re.test(text)) return interest;
  return null;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** The bold link in an ITN blurb is the main article; fall back to the first link. */
export function mainLinkTitle(storyHtml: string): string | null {
  const m = storyHtml.match(/<b[^>]*>\s*<a[^>]*href="\.\/([^"#?]+)[^"]*"/i);
  return m ? decodeURIComponent(m[1]!) : null;
}

export class WikimediaProvider implements ContentProvider {
  readonly name = "wikimedia";

  constructor(
    private userAgent: string,
    private fetchImpl: Fetch = fetch,
    private timeoutMs = 12_000,
  ) {}

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url, {
      headers: { "User-Agent": this.userAgent, "Api-User-Agent": this.userAgent, Accept: "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) throw new Error(`Content provider returned HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  private candidateFromLink(link: FeedLink & { normalizedtitle?: string }, feed: LiveCandidate["feed"], blurb: string, dateIso: string): LiveCandidate | null {
    if (!link?.title) return null;
    const pageTitle = link.title;
    const title = link.titles?.normalized ?? link.normalizedtitle ?? pageTitle.replaceAll("_", " ");
    if (SKIP_TITLE.test(title)) return null;
    const text = `${title} ${blurb} ${link.description ?? ""} ${link.extract ?? ""}`;
    if (SENSITIVE.test(text)) return null;
    return {
      storyId: `wp-${link.pageid ?? encodeURIComponent(pageTitle).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      feed,
      title,
      blurb: blurb || (link.extract ? link.extract.split(/(?<=[.!?])\s/)[0]!.slice(0, 200) : link.description ?? ""),
      description: link.description ?? "",
      interest: classifyInterest(text),
      pageTitle,
      url: link.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
      revision: link.revision ?? "",
      sourceUpdatedAt: link.timestamp,
      featuredOn: dateIso.slice(0, 10),
    };
  }

  async listCandidates(dateIso: string): Promise<LiveCandidate[]> {
    const [y, m, d] = dateIso.slice(0, 10).split("-");
    const feed = await this.getJson<FeedResponse>(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${y}/${m}/${d}`);
    const out: LiveCandidate[] = [];
    const seen = new Set<string>();
    const push = (c: LiveCandidate | null) => {
      if (c && !seen.has(c.storyId)) {
        seen.add(c.storyId);
        out.push(c);
      }
    };
    for (const item of feed.news ?? []) {
      const storyHtml = item.story ?? "";
      const blurb = stripHtml(storyHtml);
      if (!blurb || SENSITIVE.test(blurb)) continue; // editorial choice: skip tragedies for a practice app
      const links = item.links ?? [];
      const boldTitle = mainLinkTitle(storyHtml);
      const link =
        links.find((l) => boldTitle && (l.title === boldTitle || l.titles?.normalized === boldTitle.replaceAll("_", " "))) ?? links[0];
      if (!link) continue;
      push(this.candidateFromLink(link, "news", blurb, dateIso));
    }
    // Today's featured article: well-written, long, usually evergreen.
    if (feed.tfa) push(this.candidateFromLink(feed.tfa, "featured", "", dateIso));
    // Most-read articles (yesterday's views): what people are looking up. Keep only
    // items that fit an interest category and aren't celebrity/entertainment bios.
    for (const a of (feed.mostread?.articles ?? []).slice(0, 40)) {
      if (SKIP_DESC.test(a.description ?? "")) continue;
      const c = this.candidateFromLink(a, "trending", "", dateIso);
      if (c && c.interest) push(c);
    }
    return out;
  }

  async searchTopics(query: string): Promise<TopicHit[]> {
    const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", list: "search", srsearch: query, srlimit: "6", srnamespace: "0" });
    const data = await this.getJson<{ query?: { search?: { title: string; pageid: number; snippet?: string }[] } }>(`https://en.wikipedia.org/w/api.php?${params}`);
    return (data.query?.search ?? [])
      .filter((h) => !SKIP_TITLE.test(h.title))
      .map((h) => ({ title: h.title, pageid: h.pageid, snippet: stripHtml(h.snippet ?? "").slice(0, 160) }));
  }

  async lookup(pageid: number): Promise<LiveCandidate | null> {
    const params = new URLSearchParams({ action: "query", format: "json", formatversion: "2", pageids: String(pageid), prop: "description|revisions|info", rvprop: "ids|timestamp", inprop: "url" });
    const data = await this.getJson<{ query?: { pages?: { pageid?: number; title?: string; missing?: boolean; description?: string; fullurl?: string; revisions?: { revid?: number; timestamp?: string }[] }[] } }>(
      `https://en.wikipedia.org/w/api.php?${params}`,
    );
    const page = data.query?.pages?.[0];
    if (!page || page.missing || !page.title) return null;
    const rev = page.revisions?.[0];
    return this.candidateFromLink(
      {
        title: page.title.replaceAll(" ", "_"),
        titles: { normalized: page.title },
        pageid: page.pageid,
        description: page.description,
        revision: rev?.revid ? String(rev.revid) : "",
        timestamp: rev?.timestamp,
        content_urls: { desktop: { page: page.fullurl } },
      },
      "search",
      "",
      new Date().toISOString(),
    );
  }

  async fetchDocument(c: LiveCandidate, maxChars: number): Promise<SourceDocument> {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "extracts|revisions",
      explaintext: "1",
      exsectionformat: "plain",
      rvprop: "ids|timestamp",
      titles: c.pageTitle.replaceAll("_", " "),
      redirects: "1",
    });
    const data = await this.getJson<{
      query?: { pages?: { title?: string; extract?: string; missing?: boolean; revisions?: { revid?: number; timestamp?: string }[] }[] };
    }>(`https://en.wikipedia.org/w/api.php?${params}`);
    const page = data.query?.pages?.[0];
    if (!page || page.missing || !page.extract) throw new Error("Article text unavailable");
    const cleaned = page.extract
      .split(/\n(?:See also|References|External links|Notes|Further reading)\n/)[0]!
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    const { text, truncated } = boundText(cleaned, maxChars);
    const rev = page.revisions?.[0];
    return {
      storyId: c.storyId,
      title: page.title ?? c.title,
      text,
      partial: truncated,
      revision: rev?.revid ? String(rev.revid) : c.revision,
      license: WIKI_LICENSE,
      source: {
        url: c.url,
        publisher: "Wikipedia — \"In the news\"",
        publishedAt: c.featuredOn,
        retrievedAt: new Date().toISOString(),
        sourceUpdatedAt: rev?.timestamp ?? c.sourceUpdatedAt,
        byline: "Wikipedia contributors (CC BY-SA 4.0)",
      },
    };
  }
}
