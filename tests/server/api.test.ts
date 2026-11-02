import { describe, expect, it } from "vitest";
import { buildTestApp, fakeContent, fakeTransport, feedbackBody, goodFeedback, SOURCE_TEXT, textMessage } from "../helpers";
import type { TranscriptionProvider } from "../../src/server/transcription/deepgram";
import { AppError } from "../../src/server/errors";
import type { LiveCandidate } from "../../src/server/content/types";

const briefingOut = {
  sufficient: true,
  insufficientReason: null,
  title: "A city expands street trees",
  points: ["The council voted to expand tree planting to every district.", "Critics prefer cooling centres."],
  mainIdea: "The city is planting trees in every district to cool shaded-poor neighbourhoods, though critics question the cost.",
  uncertainty: "Critics argued the budget would be better spent on cooling centres.",
  keyTerm: { term: "cooling centre", meaning: "A public place people can go to escape heat.", inContext: "better spent on cooling centres", exampleUse: "We set up a cooling centre in the lobby." },
  followUpQuestion: "Would you spend the money on trees or cooling centres?",
  supportingExcerpts: ["voted on Tuesday to expand its tree-planting programme to every district", "this quote is invented"],
};

describe("demo mode (no credentials)", () => {
  it("reports demo status without exposing secrets", async () => {
    const { call } = buildTestApp();
    const s = await (await call("/api/status")).json();
    expect(s.mode).toBe("demo");
    expect(s.coaching).toBe("demo");
    expect(s.transcription).toBe("none");
    expect(JSON.stringify(s)).not.toMatch(/sk-|api[_-]?key/i);
  });

  it("lists curated stories with full source metadata", async () => {
    const { call } = buildTestApp();
    const r = await (await call("/api/stories?interests=science,business")).json();
    expect(r.live.status).toBe("disabled");
    expect(r.cards.length).toBeGreaterThanOrEqual(3);
    for (const c of r.cards) {
      expect(c.title).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.source.publisher).toBeTruthy();
      expect(c.source.publishedAt).toBeTruthy();
      expect(c.source.url).toMatch(/^https:\/\//);
      expect(["current", "evergreen"]).toContain(c.kind);
      expect(c.estimatedMinutes).toBeGreaterThan(0);
      expect(c.whySelected).toBeTruthy();
    }
    expect(r.cards.slice(0, 2).every((c: { interest: string }) => ["science", "business"].includes(c.interest))).toBe(true);
  });

  it("returns illustrative feedback clearly marked as not an evaluation", async () => {
    const { post } = buildTestApp();
    const r = await post("/api/feedback", feedbackBody());
    expect(r.status).toBe(200);
    const { feedback } = await r.json();
    expect(feedback.kind).toBe("illustrative");
    expect(feedback.goalMet).toBeNull();
    expect(feedback.strength).toBeNull();
  });

  it("serves a sample audience question from the reviewed bank", async () => {
    const { post } = buildTestApp();
    const r = await post("/api/audience-question", {
      idempotencyKey: "q-00000001",
      talk: { scenarioId: "propose-change", audience: "team", audienceKnowledge: "some-familiarity", outcome: "agree", topic: "async updates", notes: "", targetSeconds: 60, questionStyle: "challenging" },
      response: "I propose we switch to async updates for two weeks.",
      previousQuestions: [],
    });
    const q = await r.json();
    expect(q.kind).toBe("sample");
    expect(q.question).toMatch(/\?$/);
  });

  it("refuses live briefings and transcription with a clear not_configured error", async () => {
    const { call } = buildTestApp();
    const r = await call("/api/transcribe?seconds=3", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Uint8Array(2000) });
    expect(r.status).toBe(501);
    expect((await r.json()).code).toBe("not_configured");
    expect((await call("/api/stories/wp-1/briefing")).status).toBe(404);
  });
});

describe("request validation", () => {
  it("rejects empty and over-long responses before any paid call", async () => {
    const t = fakeTransport([textMessage(goodFeedback)]);
    const { post } = buildTestApp({ transport: t });
    const empty = await post("/api/feedback", feedbackBody({ response: { text: "  um ", modality: "typed", transcriptEdited: false, assisted: false } }));
    expect(empty.status).toBe(422);
    expect((await empty.json()).code).toBe("empty_response");
    const long = await post("/api/feedback", feedbackBody({ response: { text: "word ".repeat(2000), modality: "typed", transcriptEdited: false, assisted: false } }));
    expect(long.status).toBe(413);
    expect(t.calls).toHaveLength(0);
  });

  it("rejects unknown exercises and malformed bodies", async () => {
    const { post, app } = buildTestApp();
    expect((await post("/api/feedback", feedbackBody({ exerciseId: "nope" }))).status).toBe(400);
    expect((await app.request("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })).status).toBe(400);
  });
});

describe("duplicate protection", () => {
  it("makes one paid call for repeated and concurrent submissions of the same attempt", async () => {
    const t = fakeTransport([textMessage(goodFeedback)]);
    const { post } = buildTestApp({ transport: t });
    const [a, b] = await Promise.all([post("/api/feedback", feedbackBody()), post("/api/feedback", feedbackBody())]);
    const c = await post("/api/feedback", feedbackBody());
    expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
    expect(t.calls).toHaveLength(1);
    expect((await c.json()).deduplicated).toBe(true);
  });

  it("does not cache failures, so a deliberate retry calls again", async () => {
    const t = fakeTransport([textMessage("garbage"), textMessage(goodFeedback)]);
    const { post } = buildTestApp({ transport: t });
    expect((await post("/api/feedback", feedbackBody())).status).toBe(502);
    expect((await post("/api/feedback", feedbackBody())).status).toBe(200);
    expect(t.calls).toHaveLength(2);
  });

  it("returns 429 once the daily request limit is reached", async () => {
    const t = fakeTransport([textMessage(goodFeedback)]);
    const { post } = buildTestApp({ transport: t, env: { USAGE_DAILY_REQUEST_LIMIT: "1" } });
    await post("/api/feedback", feedbackBody());
    const r = await post("/api/feedback", feedbackBody({ idempotencyKey: "attempt-0002" }));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("usage_limit");
  });
});

describe("access control", () => {
  it("requires the access token on API routes when configured", async () => {
    const { call, post } = buildTestApp({ env: { APP_ACCESS_TOKEN: "s3cret-token" } });
    expect((await call("/api/status")).status).toBe(200);
    expect((await call("/api/stories")).status).toBe(401);
    expect((await post("/api/feedback", feedbackBody())).status).toBe(401);
    expect((await call("/api/stories", { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    expect((await call("/api/stories", { headers: { Authorization: "Bearer s3cret-token" } })).status).toBe(200);
  });
});

describe("remote access without a token", () => {
  it("blocks tunnelled or remote requests to paid endpoints when no token is set", async () => {
    const { call, post } = buildTestApp({ transport: fakeTransport([textMessage(goodFeedback)]) });
    expect((await call("/api/stories")).status).toBe(200);
    const viaTunnel = await call("http://abc.trycloudflare.com/api/stories");
    expect(viaTunnel.status).toBe(403);
    expect((await viaTunnel.json()).error).toMatch(/APP_ACCESS_TOKEN/);
    expect((await post("/api/feedback", feedbackBody(), { "X-Forwarded-For": "203.0.113.5" })).status).toBe(403);
    expect((await call("http://abc.trycloudflare.com/api/status")).status).toBe(200);
  });

  it("allows remote use in demo mode (nothing paid) and with a valid token", async () => {
    expect((await buildTestApp().call("http://192.168.1.20:8787/api/stories")).status).toBe(200);
    const { call } = buildTestApp({ transport: fakeTransport([textMessage(goodFeedback)]), env: { APP_ACCESS_TOKEN: "s3cret-token" } });
    expect((await call("http://abc.trycloudflare.com/api/stories", { headers: { Authorization: "Bearer s3cret-token" } })).status).toBe(200);
  });
});

describe("logging", () => {
  it("logs method, path and status only — never response text", async () => {
    const { post, logs } = buildTestApp();
    await post("/api/feedback", feedbackBody());
    expect(logs.join("\n")).toMatch(/POST \/api\/feedback 200/);
    expect(logs.join("\n")).not.toMatch(/survivors/);
  });
});

describe("live content pipeline", () => {
  const now = () => new Date("2026-11-01T12:00:00Z");

  it("lists live stories with source metadata, generates a grounded briefing once, and caches it", async () => {
    const { provider } = fakeContent();
    const t = fakeTransport([textMessage("not json (curation falls back)"), textMessage(briefingOut)]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    const list = await (await call("/api/stories?interests=environment")).json();
    const live = list.cards.find((c: { kind: string }) => c.kind === "current");
    expect(live.source.publisher).toMatch(/Wikipedia/);
    expect(live.source.retrievedAt).toBeTruthy();
    expect(live.whySelected).toMatch(/Environment/);
    expect(live.briefingReady).toBe(false);

    const b = await (await call("/api/stories/wp-123/briefing")).json();
    expect(b.kind).toBe("current");
    expect(b.source.url).toBe("https://en.wikipedia.org/wiki/Urban_tree_programme");
    expect(b.source.publishedAt).toBe("2026-11-01");
    expect(b.sourceVersion).toBe("1001");
    // Invented excerpt dropped, verified one kept.
    expect(b.supportingExcerpts).toEqual(["voted on Tuesday to expand its tree-planting programme to every district"]);
    expect(b.keyTerm.inContext).toBe("better spent on cooling centres");

    await call("/api/stories/wp-123/briefing");
    expect(t.calls).toHaveLength(2); // one curation attempt + one briefing
    expect(provider.calls.fetch).toBe(1);
    const again = await (await call("/api/stories?interests=environment")).json();
    expect(again.cards[0].briefingReady).toBe(true);
  });

  it("refuses to brief from too-short source text and stops offering the story", async () => {
    const { provider } = fakeContent({ doc: { text: "A short headline-length snippet." } });
    const t = fakeTransport([textMessage("not json (curation falls back)"), textMessage(briefingOut)]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    const before = t.calls.length;
    const r = await call("/api/stories/wp-123/briefing");
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe("insufficient_source");
    expect(t.calls).toHaveLength(before); // no briefing call was made
    const list = await (await call("/api/stories")).json();
    expect(list.cards.some((c: { id: string }) => c.id === "wp-123")).toBe(false);
  });

  it("honours a model judgement that the source is insufficient", async () => {
    const { provider } = fakeContent();
    const t = fakeTransport([textMessage({ ...briefingOut, sufficient: false, insufficientReason: "Mostly a list of names." })]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    const r = await call("/api/stories/wp-123/briefing");
    expect(r.status).toBe(422);
    expect((await r.json()).error).toMatch(/Mostly a list of names/);
  });

  it("rejects a briefing whose excerpts can't be found in the source", async () => {
    const { provider } = fakeContent();
    const t = fakeTransport([textMessage({ ...briefingOut, supportingExcerpts: ["completely invented sentence"] })]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    const r = await call("/api/stories/wp-123/briefing");
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe("malformed_output");
  });

  it("shows stale stories honestly when a refresh fails", async () => {
    const { provider } = fakeContent();
    let t0 = new Date("2026-11-01T06:00:00Z");
    const { call } = buildTestApp({ transport: fakeTransport([textMessage(briefingOut)]), content: provider, now: () => t0 });
    await call("/api/stories");
    provider.failList = true;
    t0 = new Date("2026-11-01T18:00:00Z"); // past refresh window
    const r = await (await call("/api/stories")).json();
    expect(r.live.status).toBe("stale");
    expect(r.live.message).toMatch(/Couldn't refresh/);
    expect(r.cards.some((c: { id: string }) => c.id === "wp-123")).toBe(true);
  });

  it("reports unavailable (not fabricated news) when there is no cache and the feed fails", async () => {
    const { provider } = fakeContent({ failList: true });
    const { call } = buildTestApp({ transport: fakeTransport([textMessage(briefingOut)]), content: provider, now });
    const r = await (await call("/api/stories")).json();
    expect(r.live.status).toBe("unavailable");
    expect(r.cards.every((c: { kind: string }) => c.kind === "evergreen")).toBe(true);
  });

  it("flags a cached briefing when the source has been edited since", async () => {
    const { provider, candidate } = fakeContent();
    let t0 = new Date("2026-11-01T06:00:00Z");
    const { call } = buildTestApp({ transport: fakeTransport([textMessage(briefingOut)]), content: provider, now: () => t0 });
    await call("/api/stories");
    await call("/api/stories/wp-123/briefing");
    provider.candidates = [{ ...candidate, revision: "1002" }];
    t0 = new Date("2026-11-01T18:00:00Z");
    const b = await (await call("/api/stories/wp-123/briefing")).json();
    expect(b.sourceChanged).toBe(true);
    const st = await (await call("/api/stories/wp-123/status")).json();
    expect(st.sourceVersion).toBe("1002");
  });

  it("does not offer live stories in demo mode, even with a content provider", async () => {
    const { provider } = fakeContent();
    const { call } = buildTestApp({ content: provider, now });
    const r = await (await call("/api/stories")).json();
    expect(r.live.status).toBe("disabled");
    expect(provider.calls.list).toBe(0);
  });

  it("sends only the server-side briefing (not client text) as feedback context", async () => {
    const { provider } = fakeContent();
    const t = fakeTransport([textMessage("not json (curation falls back)"), textMessage(briefingOut), textMessage(goodFeedback)]);
    const { call, post } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    await call("/api/stories/wp-123/briefing");
    await post("/api/feedback", feedbackBody({ storyId: "wp-123" }));
    const user = (t.calls[2]!.messages as { content: string }[])[0]!.content;
    expect(user).toContain(briefingOut.mainIdea);
    expect(user).not.toContain(SOURCE_TEXT.slice(0, 200)); // compact context: briefing only, not full article
  });
});

describe("transcription endpoint", () => {
  const ok: TranscriptionProvider = {
    name: "fake",
    async transcribe(_a, _t, seconds) {
      return { transcript: "hello world from the test", provider: "fake", delivery: { basis: "transcription-word-timestamps", recordingSeconds: seconds, wordsPerMinute: 120, longPauses: 0, speakingSeconds: 2.5, limitations: "x" } };
    },
  };

  it("transcribes audio, records usage, and de-duplicates by key", async () => {
    let n = 0;
    const counting: TranscriptionProvider = { name: "c", transcribe: async (a, t, s) => (n++, ok.transcribe(a, t, s)) };
    const { call, deps } = buildTestApp({ transcription: counting });
    const req = () => call("/api/transcribe?seconds=30", { method: "POST", headers: { "Content-Type": "audio/webm;codecs=opus", "Idempotency-Key": "tx-12345678" }, body: new Uint8Array(5000) });
    const r = await req();
    expect(r.status).toBe(200);
    expect((await r.json()).transcript).toBe("hello world from the test");
    await req();
    expect(n).toBe(1);
    expect((await deps.usage.summary()).today.transcriptionMinutes).toBeCloseTo(0.5);
  });

  it("rejects empty recordings, bad types and missing keys", async () => {
    const { call } = buildTestApp({ transcription: ok });
    const h = { "Content-Type": "audio/webm", "Idempotency-Key": "tx-12345678" };
    expect((await call("/api/transcribe?seconds=3", { method: "POST", headers: h, body: new Uint8Array(10) })).status).toBe(422);
    expect((await call("/api/transcribe?seconds=3", { method: "POST", headers: { ...h, "Content-Type": "text/plain" }, body: new Uint8Array(5000) })).status).toBe(415);
    expect((await call("/api/transcribe?seconds=3", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: new Uint8Array(5000) })).status).toBe(400);
  });

  it("surfaces provider failures as errors", async () => {
    const failing: TranscriptionProvider = {
      name: "f",
      async transcribe() {
        throw new AppError("provider_error", "Transcription failed (HTTP 500).", 502, true);
      },
    };
    const { call } = buildTestApp({ transcription: failing });
    const r = await call("/api/transcribe?seconds=3", { method: "POST", headers: { "Content-Type": "audio/webm", "Idempotency-Key": "tx-12345678" }, body: new Uint8Array(5000) });
    expect(r.status).toBe(502);
    expect((await r.json()).retryable).toBe(true);
  });

  it("enforces the daily transcription minutes limit", async () => {
    const { call } = buildTestApp({ transcription: ok, env: { USAGE_DAILY_TRANSCRIPTION_MINUTES: "1" } });
    const r = await call("/api/transcribe?seconds=120", { method: "POST", headers: { "Content-Type": "audio/webm", "Idempotency-Key": "tx-12345678" }, body: new Uint8Array(5000) });
    expect(r.status).toBe(429);
  });
});

describe("topics and own material", () => {
  const now = () => new Date("2026-11-01T12:00:00Z");
  const briefing = {
    sufficient: true,
    insufficientReason: null,
    title: "Q3 plan",
    points: ["Hiring two engineers.", "Launch moves to March."],
    mainIdea: "The Q3 plan hires two engineers and moves the launch to March.",
    uncertainty: null,
    keyTerm: { term: "runway", meaning: "How long the money lasts.", inContext: null, exampleUse: "We have eight months of runway." },
    followUpQuestion: "Why March?",
    supportingExcerpts: ["hire two engineers"],
  };
  const OWN = "We plan to hire two engineers in Q3 and move the launch to March. ".repeat(12);

  it("searches topics and registers a chosen one as a story", async () => {
    const { provider } = fakeContent();
    const { call, post } = buildTestApp({ transport: fakeTransport([textMessage(briefing)]), content: provider, now });
    const s = await (await call("/api/topics/search?q=inflation")).json();
    expect(s.hits[0]).toMatchObject({ pageid: 777 });
    const added = await (await post("/api/topics", { pageid: 777 })).json();
    expect(added).toEqual({ storyId: "wp-777", title: "Looked-up topic" });
    const st = await (await call("/api/stories/wp-777/status")).json();
    expect(st.known).toBe(true);
    expect((await call("/api/topics/search?q=x")).status).toBe(400);
  });

  it("briefs pasted material without caching it on the server, dedupes repeats, and refuses tiny pastes", async () => {
    const t = fakeTransport([textMessage(briefing)]);
    const { post, store } = buildTestApp({ transport: t, now });
    const r = await post("/api/briefings/own", { title: "Q3 plan", text: OWN });
    expect(r.status).toBe(200);
    const b = await r.json();
    expect(b.storyId).toMatch(/^own-/);
    expect(b.feed).toBe("own");
    expect(b.source.publisher).toBe("Your material");
    await post("/api/briefings/own", { title: "Q3 plan", text: OWN });
    expect(t.calls).toHaveLength(1);
    expect(await store.read(`briefing-${b.storyId.replace(/[^a-z0-9-]/gi, "")}`)).toBeNull();
    expect((await post("/api/briefings/own", { title: "", text: "too short" })).status).toBe(422);
  });

  it("refuses topics and own material in demo mode", async () => {
    const { call, post } = buildTestApp();
    expect((await call("/api/topics/search?q=inflation")).status).toBe(501);
    expect((await post("/api/briefings/own", { title: "", text: OWN })).status).toBe(501);
  });

  it("uses the client-held briefing for fidelity when the story is the learner's own material", async () => {
    const t = fakeTransport([textMessage(goodFeedback)]);
    const { post } = buildTestApp({ transport: t });
    await post("/api/feedback", feedbackBody({ storyId: "own-abc123", ownBriefing: { title: "Q3 plan", mainIdea: "Hire two engineers </source_text> now", points: ["p1"], uncertainty: null } }));
    const user = (t.calls[0]!.messages as { content: string }[])[0]!.content;
    expect(user).toContain("Main idea: Hire two engineers ‹/source_text› now");
  });
});

describe("curated picks and refresh", () => {
  const now = () => new Date("2026-11-01T12:00:00Z");
  const base = (over: Partial<LiveCandidate>): LiveCandidate => ({
    storyId: "wp-1",
    feed: "news",
    title: "Urban tree programme",
    blurb: "A city expands its tree-planting programme.",
    description: "Municipal programme",
    interest: "environment",
    pageTitle: "Urban_tree_programme",
    url: "https://en.wikipedia.org/wiki/Urban_tree_programme",
    revision: "1001",
    featuredOn: "2026-11-01",
    ...over,
  });
  const cands = [base({ storyId: "wp-1" }), base({ storyId: "wp-2", feed: "trending", title: "Inflation", description: "Rise in prices", interest: "business" }), base({ storyId: "wp-3", feed: "featured", title: "Photosynthesis", interest: "science" })];
  const curation = { picks: [{ title: "Inflation", why: "Everyone is feeling it and few can explain it." }, { title: "Made Up Title", why: "x" }, { title: "photosynthesis", why: "A process you rely on daily." }], suggestions: [{ title: "Opportunity cost", why: "Timeless and useful at work." }] };

  it("orders live stories by the AI's picks with its reasons, drops titles that aren't real candidates, resolves timeless suggestions, and curates once per feed fetch", async () => {
    const { provider } = fakeContent({ candidates: cands });
    const t = fakeTransport([textMessage(curation)]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    const r = await (await call("/api/stories?interests=business")).json();
    const live = r.cards.filter((c: { kind: string }) => c.kind === "current");
    expect(live.map((c: { id: string }) => c.id)).toEqual(["wp-2", "wp-3", "wp-777"]);
    expect(live[0].whySelected).toBe("Everyone is feeling it and few can explain it.");
    expect(live[2]).toMatchObject({ feed: "timeless", title: "Looked-up topic", whySelected: "Timeless and useful at work." });
    const user = (t.calls[0]!.messages as { content: string }[])[0]!.content;
    expect(user).toContain("Interests: Business & work");
    expect(user).toContain("- Inflation · Rise in prices · trending");
    await call("/api/stories?interests=business");
    expect(t.calls).toHaveLength(1);
    // A timeless pick can be opened like any live story.
    expect((await call("/api/stories/wp-777/status")).status).toBe(200);
  });

  it("falls back to the plain interest match when curation output is unusable", async () => {
    const { provider } = fakeContent({ candidates: cands });
    const { call } = buildTestApp({ transport: fakeTransport([textMessage("not json")]), content: provider, now });
    const r = await (await call("/api/stories?interests=science")).json();
    const live = r.cards.filter((c: { kind: string }) => c.kind === "current");
    expect(live.length).toBeGreaterThan(0);
    expect(live[0].id).toBe("wp-3"); // interest match first
  });

  it("refresh=1 refetches the feed and re-curates; seed rotates curated ideas", async () => {
    const { provider } = fakeContent({ candidates: cands });
    const t = fakeTransport([textMessage(curation), textMessage(curation)]);
    let clock = new Date("2026-11-01T12:00:00Z");
    const { call } = buildTestApp({ transport: t, content: provider, now: () => clock });
    await call("/api/stories?interests=business");
    expect(provider.calls.list).toBe(1);
    clock = new Date("2026-11-01T12:05:00Z");
    const a = await (await call("/api/stories?interests=business&refresh=1&seed=1")).json();
    expect(provider.calls.list).toBe(2);
    expect(t.calls).toHaveLength(2);
    const b = await (await call("/api/stories?interests=business&seed=2")).json();
    const ever = (x: { cards: { kind: string; id: string }[] }) => x.cards.filter((c) => c.kind === "evergreen").map((c) => c.id);
    expect(ever(a)).not.toEqual(ever(b));
  });

  it("does not curate in demo mode", async () => {
    const { provider } = fakeContent({ candidates: cands });
    const { call } = buildTestApp({ content: provider, now });
    const r = await (await call("/api/stories?interests=business")).json();
    expect(r.live.status).toBe("disabled");
  });
});
