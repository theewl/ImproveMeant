import type { ApiError, AppStatus, AudienceQuestion, Briefing, Feedback, Interest, StoryCard, TalkSetup, DeliveryMetrics } from "../../shared/types";

export class ApiRequestError extends Error {
  constructor(
    public code: ApiError["code"] | "network" | "cancelled",
    message: string,
    public retryable: boolean,
    public status: number,
  ) {
    super(message);
  }
}

let accessToken: string | undefined;
export function setAccessToken(t: string | undefined) {
  accessToken = t || undefined;
}

/** Works on browsers without AbortSignal.timeout (older iOS Safari). */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void; timedOut: () => boolean } {
  const ctl = new AbortController();
  let fired = false;
  const t = setTimeout(() => {
    fired = true;
    ctl.abort();
  }, ms);
  return { signal: ctl.signal, clear: () => clearTimeout(t), timedOut: () => fired };
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 90_000): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const own = init.signal ? null : timeoutSignal(timeoutMs);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal: init.signal ?? own!.signal });
  } catch (err) {
    const name = (err as Error).name;
    if (own?.timedOut()) throw new ApiRequestError("provider_timeout", "The request took too long. Check your connection and try again.", true, 0);
    if (name === "AbortError") throw new ApiRequestError("cancelled", "Cancelled.", true, 0);
    throw new ApiRequestError("network", `Couldn't reach the app server (${name || "network error"}). Check your connection.`, true, 0);
  } finally {
    own?.clear();
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = body as Partial<ApiError> | null;
    const msg = e?.error ?? (res.status === 504 ? "The server took too long to answer." : res.status === 413 ? "That upload is too large for the server. Type what you said instead." : `Request failed.`);
    throw new ApiRequestError(e?.code ?? "provider_error", `${msg} (HTTP ${res.status})`, e?.retryable ?? res.status >= 500, res.status);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface LiveFeedState {
  status: "ok" | "stale" | "unavailable" | "disabled";
  fetchedAt?: string;
  message?: string;
}

export const api = {
  status: () => request<AppStatus>("/api/status"),
  stories: (interests: Interest[], opts: { refresh?: boolean; seed?: number } = {}) =>
    request<{ cards: StoryCard[]; live: LiveFeedState; curation: "available" | "none" }>(`/api/stories?interests=${interests.join(",")}${opts.refresh ? "&refresh=1" : ""}${opts.seed ? `&seed=${opts.seed}` : ""}`),
  storyPicks: (interests: Interest[]) => request<{ cards: StoryCard[] }>(`/api/stories/picks?interests=${interests.join(",")}`, {}, 60_000),
  briefing: (id: string, refresh = false) => request<Briefing & { sourceChanged: boolean }>(`/api/stories/${encodeURIComponent(id)}/briefing${refresh ? "?refresh=1" : ""}`),
  storyStatus: (id: string) => request<{ sourceVersion: string | null; sourceUpdatedAt?: string; known: boolean }>(`/api/stories/${encodeURIComponent(id)}/status`),
  feedback: (body: FeedbackBody) => request<{ feedback: Feedback; deduplicated: boolean }>("/api/feedback", json(body)),
  cameraFeedback: (body: CameraFeedbackBody) => request<{ feedback: Feedback; deduplicated: boolean }>("/api/camera-feedback", json(body), 120_000),
  audienceQuestion: (body: { idempotencyKey: string; talk: TalkSetup; response: string; previousQuestions: string[] }) =>
    request<AudienceQuestion>("/api/audience-question", json(body)),
  variation: (body: { idempotencyKey: string; exerciseId: string; topic: string }) => request<{ prompt: string; kind: "live" | "reviewed" }>("/api/variation", json(body)),
  transcribe: (audio: Blob, seconds: number, idempotencyKey: string, signal?: AbortSignal) =>
    request<{ transcript: string; delivery: DeliveryMetrics; provider: string }>(
      `/api/transcribe?seconds=${seconds.toFixed(1)}`,
      { method: "POST", headers: { "Content-Type": audio.type || "audio/webm", "Idempotency-Key": idempotencyKey }, body: audio, signal },
      120_000,
    ),
};

export interface TopicHit {
  title: string;
  pageid: number;
  snippet: string;
}

export const topics = {
  search: (q: string) => request<{ hits: TopicHit[] }>(`/api/topics/search?q=${encodeURIComponent(q)}`),
  add: (pageid: number) => request<{ storyId: string; title: string }>("/api/topics", json({ pageid })),
  briefOwn: (title: string, text: string) => request<Briefing>("/api/briefings/own", json({ title, text }), 120_000),
};

export interface CameraFeedbackBody {
  idempotencyKey: string;
  drillId: string;
  topic: string;
  notes: string;
  throughline?: string;
  hookPattern?: string;
  response: { text: string; transcriptSource: "provider" | "browser-speech" | "typed-by-user"; transcriptEdited: boolean; durationSeconds: number | null };
  frames: { at: number; jpegBase64: string }[];
  previous?: { text: string; retryFocus: string | null } | null;
}

export interface FeedbackBody {
  idempotencyKey: string;
  exerciseId: string;
  mode: "learn" | "talk";
  target?: "main" | "followup";
  storyId?: string;
  ownBriefing?: { title: string; mainIdea: string; points: string[]; uncertainty: string | null };
  talk?: TalkSetup;
  response: { text: string; modality: "spoken" | "typed"; transcriptEdited: boolean; assisted: boolean };
  previous?: { text: string; retryFocus: string | null } | null;
  followUp?: { question: string; answer: string } | null;
}
