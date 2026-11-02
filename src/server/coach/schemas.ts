import { z } from "zod";

// Schemas for model outputs. These are sent to the API as structured-output
// JSON schemas AND re-validated locally; length bounds are enforced locally
// by clamping (the API's schema subset does not enforce string lengths).

export const BriefingOutput = z.object({
  sufficient: z.boolean().describe("False if the source text doesn't support a reliable briefing."),
  insufficientReason: z.string().nullable(),
  title: z.string().describe("Neutral, plain-language title, max ~90 characters."),
  points: z.array(z.string()).describe("2 to 4 short points, each one or two sentences, grounded in the source."),
  mainIdea: z.string().describe("One sentence stating the central idea a learner should be able to explain."),
  uncertainty: z
    .string()
    .nullable()
    .describe("What is uncertain, disputed or still developing according to the source; null if nothing notable."),
  keyTerm: z.object({
    term: z.string().describe("One useful word, phrase or concept from the source worth reusing in conversation. Plain, not showy."),
    meaning: z.string(),
    inContext: z.string().nullable().describe("A short verbatim excerpt (<= 25 words) from the source containing the term, or null."),
    exampleUse: z.string().describe("An original everyday sentence using the term in a work context."),
  }),
  followUpQuestion: z.string().describe("One thoughtful question a colleague might ask after hearing the explanation."),
  supportingExcerpts: z
    .array(z.string())
    .describe("1 to 3 short verbatim excerpts (<= 30 words each) copied exactly from the source that support the points."),
});
export type BriefingOutput = z.infer<typeof BriefingOutput>;

export const FeedbackOutput = z.object({
  goalMet: z.boolean().describe("Did the response meet the exercise's definition of success?"),
  offTopic: z.boolean().describe("True if the response is empty of substance or unrelated to the task."),
  strength: z
    .object({
      observation: z.string().describe("One specific, grounded strength tied to the exercise objective."),
      quote: z.string().describe("Exact words copied from the learner's response that show the strength."),
    })
    .nullable(),
  priority: z
    .object({
      observation: z.string().describe("The single most useful improvement for this exercise's objective."),
      quote: z.string().describe("Exact words copied from the learner's response the improvement refers to; empty string if it concerns something missing."),
      suggestion: z.string().describe("A concrete, short suggestion that keeps the learner's meaning and voice."),
    })
    .nullable()
    .describe("Null when the goal is met and there's nothing important to change. Do not invent a weakness."),
  explanation: z.string().describe("One or two sentences on why this matters for the listener."),
  fidelity: z.object({
    status: z.enum(["accurate", "minor_gaps", "factual_error", "not_applicable"]),
    note: z.string().nullable().describe("If not accurate: what differs from the supplied source. Opinions are not factual errors."),
  }),
  opinionNote: z
    .string()
    .nullable()
    .describe("If the learner expresses an opinion: comment only on its clarity and reasoning, never on whether you agree."),
  followUpNote: z.string().nullable().describe("If a follow-up answer was supplied: one sentence on whether it answered the question directly."),
  retryFocus: z.string().nullable().describe("One sentence telling the learner what to try in a retry, or null if no retry is needed."),
});
export type FeedbackOutput = z.infer<typeof FeedbackOutput>;

export const AudienceQuestionOutput = z.object({
  question: z.string().describe("One question this simulated audience member would realistically ask. One or two sentences."),
  intent: z.string().describe("Very short note on what the asker wants to know."),
});
export type AudienceQuestionOutput = z.infer<typeof AudienceQuestionOutput>;

export const VariationOutput = z.object({
  prompt: z.string().describe("The adapted exercise prompt, practising the same skill in the new context. One or two sentences."),
});
export type VariationOutput = z.infer<typeof VariationOutput>;

export function clamp(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}
