import { describe, expect, it } from "vitest";
import { WikimediaProvider, classifyInterest, mainLinkTitle, stripHtml } from "../../src/server/content/wikimedia";
import { DeepgramProvider } from "../../src/server/transcription/deepgram";

// Fixture shaped like the documented Wikimedia featured-content response.
const FEED = {
  news: [
    {
      story: '<!--Nov 1--> The <a rel="mw:WikiLink" href="./European_Space_Agency">European Space Agency</a> launches the <b id="mwAA"><a rel="mw:WikiLink" href="./Example_telescope" title="Example telescope">Example telescope</a></b>.',
      links: [
        { title: "European_Space_Agency", titles: { normalized: "European Space Agency" }, pageid: 1 },
        {
          title: "Example_telescope",
          titles: { normalized: "Example telescope" },
          pageid: 42,
          description: "Space telescope",
          extract: "Short extract.",
          timestamp: "2026-10-31T20:00:00Z",
          revision: "555",
          content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Example_telescope" } },
        },
      ],
    },
    { story: "An earthquake <b><a href=\"./Quake\">kills</a></b> hundreds.", links: [{ title: "Quake", pageid: 7 }] },
  ],
};

function fakeFetch(routes: Record<string, unknown>, calls: { url: string; headers: Headers }[] = []): typeof fetch {
  return (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, headers: new Headers(init?.headers) });
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

describe("WikimediaProvider", () => {
  it("parses In-the-news items, picks the bold main article, skips tragedies, and sends a User-Agent", async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const p = new WikimediaProvider("TestAgent/1.0 (test@example.com)", fakeFetch({ "featured/2026/11/01": FEED }, calls));
    const items = await p.listCandidates("2026-11-01");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ storyId: "wp-42", title: "Example telescope", revision: "555", featuredOn: "2026-11-01", interest: "science" });
    expect(items[0]!.blurb).toBe("The European Space Agency launches the Example telescope.");
    expect(calls[0]!.headers.get("User-Agent")).toMatch(/TestAgent/);
  });

  it("fetches bounded article text with revision and attribution", async () => {
    const long = "Intro paragraph. ".repeat(2000) + "\nReferences\nlots of refs";
    const p = new WikimediaProvider("UA", fakeFetch({ "w/api.php": { query: { pages: [{ title: "Example telescope", extract: long, revisions: [{ revid: 556, timestamp: "2026-11-01T01:00:00Z" }] }] } } }));
    const doc = await p.fetchDocument(
      { storyId: "wp-42", feed: "news", title: "Example telescope", blurb: "", description: "", interest: null, pageTitle: "Example_telescope", url: "https://en.wikipedia.org/wiki/Example_telescope", revision: "555", featuredOn: "2026-11-01" },
      5000,
    );
    expect(doc.text.length).toBeLessThanOrEqual(5000);
    expect(doc.partial).toBe(true);
    expect(doc.revision).toBe("556");
    expect(doc.source.sourceUpdatedAt).toBe("2026-11-01T01:00:00Z");
    expect(doc.source.byline).toMatch(/CC BY-SA/);
    expect(doc.text).not.toMatch(/References/);
  });

  it("errors on HTTP failures (so the service can fall back to cache)", async () => {
    const p = new WikimediaProvider("UA", fakeFetch({}));
    await expect(p.listCandidates("2026-11-01")).rejects.toThrow(/HTTP 404/);
  });

  it("helpers", () => {
    expect(mainLinkTitle('<b><a href="./Foo_bar?x=1">x</a></b>')).toBe("Foo_bar");
    expect(stripHtml("<p>A &amp; B<!-- c --></p>")).toBe("A & B");
    expect(classifyInterest("Central bank raises interest rates amid inflation")).toBe("business");
    expect(classifyInterest("A quiet day")).toBeNull();
  });
});

describe("DeepgramProvider", () => {
  const body = {
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: "I propose we try async updates.",
              words: [
                { word: "i", start: 0.5, end: 0.7 },
                { word: "propose", start: 0.8, end: 1.2 },
                { word: "we", start: 3.6, end: 3.8 },
                { word: "try", start: 3.9, end: 4.1 },
                { word: "async", start: 4.2, end: 4.6 },
                { word: "updates", start: 4.7, end: 5.3 },
              ],
            },
          ],
        },
      ],
    },
  };

  it("sends audio with Token auth and opt-out, and derives delivery metrics from word timestamps", async () => {
    const calls: { url: string; headers: Headers }[] = [];
    const p = new DeepgramProvider("dg-key", "nova-3", 5000, fakeFetch({ "api.deepgram.com/v1/listen": body }, calls));
    const r = await p.transcribe(new Uint8Array(3000), "audio/webm", 6);
    expect(calls[0]!.headers.get("Authorization")).toBe("Token dg-key");
    expect(calls[0]!.url).toMatch(/mip_opt_out=true/);
    expect(calls[0]!.url).toMatch(/model=nova-3/);
    expect(r.transcript).toBe("I propose we try async updates.");
    expect(r.delivery.basis).toBe("transcription-word-timestamps");
    expect(r.delivery.longPauses).toBe(1);
    expect(r.delivery.wordsPerMinute).toBeCloseTo((6 / 4.8) * 60, 1);
    expect(r.delivery.limitations).toMatch(/pronunciation/);
  });

  it("reports empty transcripts and credential failures distinctly", async () => {
    const empty = new DeepgramProvider("k", "nova-3", 5000, fakeFetch({ listen: { results: { channels: [{ alternatives: [{ transcript: "", words: [] }] }] } } }));
    await expect(empty.transcribe(new Uint8Array(3000), "audio/webm", 3)).rejects.toMatchObject({ code: "empty_response" });
    const denied = new DeepgramProvider("k", "nova-3", 5000, (async () => new Response("no", { status: 401 })) as unknown as typeof fetch);
    await expect(denied.transcribe(new Uint8Array(3000), "audio/webm", 3)).rejects.toMatchObject({ code: "provider_error", retryable: false });
    const down = new DeepgramProvider("k", "nova-3", 5000, (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch);
    await expect(down.transcribe(new Uint8Array(3000), "audio/webm", 3)).rejects.toMatchObject({ code: "provider_error", retryable: true });
  });
});

describe("WikimediaProvider: trending, featured, search, lookup", () => {
  const FEED2 = {
    news: [],
    tfa: { title: "Photosynthesis", titles: { normalized: "Photosynthesis" }, pageid: 5, description: "Biological process", extract: "Photosynthesis is how plants make food. It matters.", revision: "9", timestamp: "2026-10-31T00:00:00Z", content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Photosynthesis" } } },
    mostread: {
      articles: [
        { title: "Some_Actor", normalizedtitle: "Some Actor", pageid: 1, description: "American actor", views: 900000 },
        { title: "Inflation", normalizedtitle: "Inflation", pageid: 2, description: "Rise in prices in an economy", extract: "Inflation is a general increase in prices.", views: 500000, revision: "77" },
        { title: "List_of_things", normalizedtitle: "List of things", pageid: 3, description: "List", views: 400000 },
        { title: "Deaths_in_2026", normalizedtitle: "Deaths in 2026", pageid: 4, description: "", views: 300000 },
        { title: "Obscure_village", normalizedtitle: "Obscure village", pageid: 6, description: "Village in nowhere", views: 1000 },
      ],
    },
  };
  it("adds the featured article and interest-matching most-read articles, skipping bios, lists and death pages", async () => {
    const p = new WikimediaProvider("UA", fakeFetch({ "featured/2026/11/02": FEED2 }));
    const items = await p.listCandidates("2026-11-02");
    expect(items.map((i) => [i.feed, i.title, i.interest])).toEqual([
      ["featured", "Photosynthesis", "science"],
      ["trending", "Inflation", "business"],
    ]);
  });
  it("searches topics and looks up a chosen page", async () => {
    const p = new WikimediaProvider(
      "UA",
      fakeFetch({
        "list=search": { query: { search: [{ title: "Inflation", pageid: 2, snippet: "<span>Inflation</span> is a rise in prices" }, { title: "List of inflations", pageid: 9 }] } },
        "pageids=2": { query: { pages: [{ pageid: 2, title: "Inflation", description: "Rise in prices", fullurl: "https://en.wikipedia.org/wiki/Inflation", revisions: [{ revid: 78, timestamp: "2026-11-01T00:00:00Z" }] }] } },
      }),
    );
    expect(await p.searchTopics("inflation")).toEqual([{ title: "Inflation", pageid: 2, snippet: "Inflation is a rise in prices" }]);
    const c = await p.lookup(2);
    expect(c).toMatchObject({ storyId: "wp-2", feed: "search", title: "Inflation", revision: "78", interest: "business" });
  });
});
