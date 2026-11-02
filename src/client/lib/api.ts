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

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 90_000): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError") throw new ApiRequestError("cancelled", "Cancelled.", true, 0);
    if (name === "TimeoutError") throw new ApiRequestError("provider_timeout", "The request took too long.", true, 0);
    throw new ApiRequestError("network", "Couldn't reach the app server. Is it running?", true, 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const e = body as Partial<ApiError> | null;
    throw new ApiRequestError(e?.code ?? "provider_error", e?.error ?? `Request failed (${res.status}).`, e?.retryable ?? res.status >= 500, res.status);
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
  stories: (interests: Interest[]) => request<{ cards: StoryCard[]; live: LiveFeedState }>(`/api/stories?interests=${interests.join(",")}`),
  briefing: (id: string, refresh = false) => request<Briefing & { sourceChanged: boolean }>(`/api/stories/${encodeURIComponent(id)}/briefing${refresh ? "?refresh=1" : ""}`),
  storyStatus: (id: string) => request<{ sourceVersion: string | null; sourceUpdatedAt?: string; known: boolean }>(`/api/stories/${encodeURIComponent(id)}/status`),
  feedback: (body: FeedbackBody) => request<{ feedback: Feedback; deduplicated: boolean }>("/api/feedback", json(body)),
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

export interface FeedbackBody {
  idempotencyKey: string;
  exerciseId: string;
  mode: "learn" | "talk";
  target?: "main" | "followup";
  storyId?: string;
  talk?: TalkSetup;
  response: { text: string; modality: "spoken" | "typed"; transcriptEdited: boolean; assisted: boolean };
  previous?: { text: string; retryFocus: string | null } | null;
  followUp?: { question: string; answer: string } | null;
}
