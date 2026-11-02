import { describe, expect, it } from "vitest";
import { buildTestApp, fakeContent, fakeTransport, feedbackBody, goodFeedback, SOURCE_TEXT, textMessage } from "../helpers";
import type { TranscriptionProvider } from "../../src/server/transcription/deepgram";
import { AppError } from "../../src/server/errors";

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
    const t = fakeTransport([textMessage(briefingOut)]);
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
    expect(t.calls).toHaveLength(1);
    expect(provider.calls.fetch).toBe(1);
    const again = await (await call("/api/stories?interests=environment")).json();
    expect(again.cards[0].briefingReady).toBe(true);
  });

  it("refuses to brief from too-short source text and stops offering the story", async () => {
    const { provider } = fakeContent({ doc: { text: "A short headline-length snippet." } });
    const t = fakeTransport([textMessage(briefingOut)]);
    const { call } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    const r = await call("/api/stories/wp-123/briefing");
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe("insufficient_source");
    expect(t.calls).toHaveLength(0);
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
    const t = fakeTransport([textMessage(briefingOut), textMessage(goodFeedback)]);
    const { call, post } = buildTestApp({ transport: t, content: provider, now });
    await call("/api/stories");
    await call("/api/stories/wp-123/briefing");
    await post("/api/feedback", feedbackBody({ storyId: "wp-123" }));
    const user = (t.calls[1]!.messages as { content: string }[])[0]!.content;
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
    expect(deps.usage.summary().today.transcriptionMinutes).toBeCloseTo(0.5);
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
