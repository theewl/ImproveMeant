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
  audienceQuestion(input: AudienceInput): Promise<AudienceQuestion>;
  variation(exercise: Exercise, topic: string): Promise<{ prompt: string; kind: "live" | "reviewed" }>;
}
