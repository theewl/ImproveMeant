import type { AudienceQuestion, Briefing, Exercise, Feedback, Modality, TalkSetup } from "../../shared/types";
import type { SourceDocument } from "../content/types";

export interface FeedbackInput {
  exercise: Exercise;
  taskPrompt: string;
  briefing: Briefing | null;
  talk: TalkSetup | null;
  response: string;
  modality: Modality;
  transcriptEdited: boolean;
  assisted: boolean;
  previous: { text: string; retryFocus: string | null } | null;
  followUp: { question: string; answer: string } | null;
  target: "main" | "followup";
}

export interface CameraFrame {
  /** Seconds into the take. */
  at: number;
  /** JPEG, base64 without a data: prefix. */
  jpegBase64: string;
}

export interface CameraFeedbackInput {
  exercise: Exercise;
  drill: { id: string; title: string; focus: string; seconds: number; goodLooksLike: string[] };
  taskPrompt: string;
  topic: string;
  notes: string;
  /** The one idea the speaker intended, if they wrote one. */
  throughline: string;
  /** Hook pattern the speaker chose (question, claim, promise, mid-action, contrast), if any. */
  hookPattern: string;
  /** The three questions the speaker answered, in order. */
  questions: string[];
  response: string;
  durationSeconds: number | null;
  transcriptSource: "provider" | "browser-speech" | "typed-by-user";
  transcriptEdited: boolean;
  frames: CameraFrame[];
  previous: { text: string; retryFocus: string | null } | null;
}

export interface CurateInput {
  interests: string[];
  candidates: { title: string; description: string; feed: string }[];
}

export interface CuratedTopics {
  /** Exact candidate titles, best first, each with a one-line reason. */
  picks: { title: string; why: string }[];
  /** Timeless topics (article titles) worth looking up, not in the candidates. */
  suggestions: { title: string; why: string }[];
}

export interface AudienceInput {
  talk: TalkSetup;
  response: string;
  previousQuestions: string[];
}

/** Shared interface so live and demo modes use the same application flow. */
export interface CoachProvider {
  readonly kind: "claude" | "demo";
  readonly model?: string;
  briefing(doc: SourceDocument): Promise<Briefing>;
  feedback(input: FeedbackInput): Promise<Feedback>;
  cameraFeedback(input: CameraFeedbackInput): Promise<Feedback>;
  audienceQuestion(input: AudienceInput): Promise<AudienceQuestion>;
  variation(exercise: Exercise, topic: string): Promise<{ prompt: string; kind: "live" | "reviewed" }>;
  curateTopics(input: CurateInput): Promise<CuratedTopics>;
}
