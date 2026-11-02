import { loadConfig, type Config } from "../src/server/config";
import type { MessageTransport, RawMessage } from "../src/server/coach/claude";
import type { ContentProvider, LiveCandidate, SourceDocument } from "../src/server/content/types";
import { createServices, type ServiceOverrides } from "../src/server/services";
import { createApp } from "../src/server/app";
import { MemoryStore } from "../src/server/store";

export function testConfig(env: Record<string, string> = {}): Config {
  return loadConfig({ LIVE_CONTENT: "off", ...env } as NodeJS.ProcessEnv);
}

export function textMessage(obj: unknown, extra: Partial<RawMessage> = {}): RawMessage {
  return {
    model: "claude-test",
    stop_reason: "end_turn",
    content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj) }],
    usage: { input_tokens: 1200, output_tokens: 300 },
    ...extra,
  };
}

/** Fake transport: returns queued responses (or a function result) and records calls. */
export function fakeTransport(responses: Array<RawMessage | Error | ((params: Record<string, unknown>) => RawMessage)>) {
  const calls: Record<string, unknown>[] = [];
  const t: MessageTransport & { calls: typeof calls } = {
    calls,
    async create(params) {
      calls.push(params);
      const r = responses.length > 1 ? responses.shift()! : responses[0]!;
      if (r instanceof Error) throw r;
      return typeof r === "function" ? r(params) : r;
    },
  };
  return t;
}

export const goodFeedback = {
  goalMet: false,
  offTopic: false,
  strength: { observation: "You named the bias directly.", quote: "only look at survivors" },
  priority: { observation: "Your main point arrives after the example.", quote: "planes that came back", suggestion: "Open with the lesson, then give the planes as your example." },
  explanation: "Listeners hold on to the first clear claim they hear.",
  fidelity: { status: "accurate", note: null },
  opinionNote: null,
  followUpNote: null,
  retryFocus: "Open with the main point.",
};

export const SOURCE_TEXT =
  "The city council voted on Tuesday to expand its tree-planting programme to every district. " +
  "Officials said the programme aims to reduce summer temperatures in neighbourhoods with little shade. " +
  "Critics argued the budget would be better spent on cooling centres. ".repeat(1) +
  "The plan includes 20,000 new street trees over five years, according to the council's published plan. ".repeat(20);

export function fakeContent(opts: { candidates?: LiveCandidate[]; doc?: Partial<SourceDocument>; failList?: boolean } = {}) {
  const calls = { list: 0, fetch: 0 };
  const candidate: LiveCandidate = {
    storyId: "wp-123",
    title: "Urban tree programme",
    blurb: "A city expands its tree-planting programme.",
    description: "Municipal programme",
    interest: "environment",
    pageTitle: "Urban_tree_programme",
    url: "https://en.wikipedia.org/wiki/Urban_tree_programme",
    revision: "1001",
    sourceUpdatedAt: "2026-11-01T10:00:00Z",
    featuredOn: "2026-11-01",
  };
  const provider: ContentProvider & { calls: typeof calls; failList: boolean; candidates: LiveCandidate[] } = {
    name: "fake",
    calls,
    failList: !!opts.failList,
    candidates: opts.candidates ?? [candidate],
    async listCandidates() {
      calls.list++;
      if (provider.failList) throw new Error("HTTP 503");
      return provider.candidates;
    },
    async fetchDocument(c) {
      calls.fetch++;
      return {
        storyId: c.storyId,
        title: c.title,
        text: SOURCE_TEXT,
        partial: false,
        revision: c.revision,
        license: "CC BY-SA 4.0",
        source: { url: c.url, publisher: "Wikipedia", publishedAt: c.featuredOn, retrievedAt: "2026-11-01T12:00:00Z", sourceUpdatedAt: c.sourceUpdatedAt },
        ...opts.doc,
      };
    },
  };
  return { provider, candidate };
}

export function buildTestApp(o: { env?: Record<string, string>; transport?: MessageTransport; content?: ContentProvider | null; now?: () => Date; transcription?: ServiceOverrides["transcription"] } = {}) {
  const cfg = testConfig({ ...(o.content ? { LIVE_CONTENT: "wikimedia" } : {}), ...o.env });
  const store = new MemoryStore();
  const logs: string[] = [];
  const deps = createServices(cfg, { store, transport: o.transport, contentProvider: o.content ?? null, transcription: o.transcription ?? null, now: o.now });
  const app = createApp({ ...deps, log: (l) => logs.push(l) });
  const call = (path: string, init?: RequestInit) => app.request(path, init);
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  return { app, deps, store, logs, call, post, cfg };
}

export function feedbackBody(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "attempt-0001",
    exerciseId: "mp-explain-story",
    mode: "learn",
    storyId: "eg-survivorship-bias",
    response: { text: "If you only look at survivors you miss the planes that came back and the ones that did not.", modality: "typed", transcriptEdited: false, assisted: false },
    ...over,
  };
}
