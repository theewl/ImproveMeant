import type { AudienceQuestion, Briefing, Exercise, Feedback } from "../../shared/types";
import { getScenario } from "../../shared/curriculum";
import { AppError } from "../errors";
import type { SourceDocument } from "../content/types";
import type { AudienceInput, CoachProvider, FeedbackInput } from "./types";

/**
 * Demo provider. It never pretends to evaluate the learner's response:
 * feedback is the exercise's reviewed example, explicitly labelled "illustrative",
 * and audience questions come from the reviewed sample bank.
 */
export class DemoCoach implements CoachProvider {
  readonly kind = "demo" as const;

  async briefing(_doc: SourceDocument): Promise<Briefing> {
    throw new AppError("not_configured", "Live briefings need Claude to be configured. Choose a curated story instead.", 501);
  }

  async feedback(input: FeedbackInput): Promise<Feedback> {
    return illustrativeFeedback(input.exercise);
  }

  async audienceQuestion(input: AudienceInput): Promise<AudienceQuestion> {
    const sc = getScenario(input.talk.scenarioId);
    const bank = sc.sampleQuestions[input.talk.questionStyle];
    const unused = bank.filter((q) => !input.previousQuestions.includes(q));
    const question = unused[0] ?? bank[0]!;
    return { kind: "sample", question, intent: "Sample question from the reviewed practice bank (not generated from your talk)." };
  }

  async variation(exercise: Exercise, _topic: string): Promise<{ prompt: string; kind: "reviewed" }> {
    return { prompt: exercise.laterVariation, kind: "reviewed" };
  }
}

export function illustrativeFeedback(exercise: Exercise): Feedback {
  return {
    kind: "illustrative",
    goalMet: null,
    strength: null,
    priority: null,
    explanation: exercise.exampleFeedback,
    fidelity: { status: "not_applicable", note: null },
    opinionNote: null,
    retryFocus: `Check your own response against the goal: ${exercise.successDefinition}`,
    followUpNote: null,
    offTopic: false,
    unverifiedQuotesRemoved: 0,
  };
}
