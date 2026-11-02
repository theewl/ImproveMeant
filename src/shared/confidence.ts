import type { Experiment, LadderStep, ThinkingTrap } from "./types";

// CBT-informed self-help content for speaking/social anxiety. Original wording,
// based on widely described techniques (cognitive restructuring, behavioral
// experiments, graded exposure, dropping safety behaviors, outward attention).
// This is self-help, not therapy, and makes no treatment claims.

export const THINKING_TRAPS: { id: ThinkingTrap; name: string; plain: string; question: string }[] = [
  {
    id: "mind-reading",
    name: "Mind reading",
    plain: "Assuming you know what others think of you — usually something negative.",
    question: "What did people actually say or do? Could there be other explanations?",
  },
  {
    id: "fortune-telling",
    name: "Fortune telling",
    plain: "Predicting it will go badly as if it's certain.",
    question: "How often has it actually gone as badly as you predicted?",
  },
  {
    id: "catastrophizing",
    name: "Catastrophizing",
    plain: "Treating a stumble as a disaster you couldn't cope with.",
    question: "If it did happen, how bad would it really be a week later? How would you cope?",
  },
  {
    id: "spotlight",
    name: "Spotlight effect",
    plain: "Feeling that everyone is watching and noticing every flaw.",
    question: "How much do you notice small slips when other people speak?",
  },
  {
    id: "all-or-nothing",
    name: "All-or-nothing",
    plain: "If it isn't perfect, it's a failure.",
    question: "What would 'good enough' look like here?",
  },
  {
    id: "discounting-positives",
    name: "Discounting the positives",
    plain: "Brushing off what went well as luck or politeness.",
    question: "What went okay? Would you dismiss that if a friend did it?",
  },
  {
    id: "shoulds",
    name: "Shoulds",
    plain: "Rigid rules like 'I should never pause' or 'I must sound confident'.",
    question: "Is that rule realistic? What would a kinder rule be?",
  },
  {
    id: "emotional-reasoning",
    name: "Emotional reasoning",
    plain: "Feeling anxious, so concluding it must have gone badly.",
    question: "What actually happened, separate from how it felt?",
  },
  {
    id: "labeling",
    name: "Labeling",
    plain: "Turning one moment into a verdict on yourself: 'I'm awkward'.",
    question: "Is one moment really the whole picture of you?",
  },
];

/** Common safety behaviors in speaking situations. Dropping one is often part of a behavioral experiment. */
export const SAFETY_BEHAVIOURS = [
  "Scripting every word",
  "Avoiding eye contact",
  "Rushing to get it over with",
  "Apologising before I start",
  "Staying quiet unless asked",
  "Over-preparing for hours",
  "Holding notes the whole time",
];

/** One-tap starter steps for the brave-steps ladder, roughly easiest first. */
export const STARTER_STEPS: { title: string; expectedDiscomfort: number }[] = [
  { title: "Say good morning to someone I don't usually talk to", expectedDiscomfort: 1 },
  { title: "Ask a colleague how their week is going", expectedDiscomfort: 2 },
  { title: "Say one comment in a small meeting", expectedDiscomfort: 3 },
  { title: "Ask a question in a meeting", expectedDiscomfort: 4 },
  { title: "Explain an idea to a colleague, one-on-one", expectedDiscomfort: 3 },
  { title: "Give a 1-minute update to my team", expectedDiscomfort: 5 },
  { title: "Disagree politely in a meeting", expectedDiscomfort: 6 },
  { title: "Present for 5 minutes to a group", expectedDiscomfort: 8 },
];

export const OUTWARD_FOCUS_TIP =
  "While you speak, put your attention on the listener and your message — not on how you look or sound.";

export function activeLadder(steps: LadderStep[]): LadderStep[] {
  return steps.filter((s) => !s.archived).sort((a, b) => a.expectedDiscomfort - b.expectedDiscomfort || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Suggest the next rung: the easiest step not yet tested. A step counts as tested once
 * any experiment on it is completed; anxiety does not have to have dropped (what matters
 * is testing the prediction, not waiting for the feeling to fade).
 */
export function suggestNextStep(steps: LadderStep[], experiments: Experiment[]): LadderStep | null {
  for (const s of activeLadder(steps)) {
    const tested = experiments.some((e) => e.ladderStepId === s.id && e.completedAt);
    if (!tested) return s;
  }
  return null;
}

export interface ExperimentSummary {
  completed: number;
  /** Completed experiments that had a prediction and recorded an outcome. */
  tested: number;
  pending: number;
  fearNotHappened: number;
  fearPartly: number;
  fearHappened: number;
  /** Mean self-reported anxiety before/after for completed experiments (0–10), or null. */
  avgBefore: number | null;
  avgAfter: number | null;
}

export function summarizeExperiments(exps: Experiment[]): ExperimentSummary {
  const done = exps.filter((e) => e.completedAt);
  const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    completed: done.length,
    tested: done.filter((e) => e.outcome).length,
    pending: exps.length - done.length,
    fearNotHappened: done.filter((e) => e.outcome === "didnt-happen").length,
    fearPartly: done.filter((e) => e.outcome === "partly").length,
    fearHappened: done.filter((e) => e.outcome === "happened").length,
    avgBefore: mean(done.map((e) => e.anxietyBefore)),
    avgAfter: mean(done.filter((e) => e.anxietyAfter != null).map((e) => e.anxietyAfter!)),
  };
}

export interface SafetyComparison {
  dropped: { count: number; avgAnxiety: number | null; fearHappened: number };
  kept: { count: number; avgAnxiety: number | null; fearHappened: number };
}

/** Compare completed experiments where a safety behavior was dropped vs not. Self-reported; small numbers. */
export function compareSafetyBehaviours(exps: Experiment[]): SafetyComparison | null {
  const done = exps.filter((e) => e.completedAt && e.anxietyAfter != null);
  const group = (xs: Experiment[]) => ({
    count: xs.length,
    avgAnxiety: xs.length ? Math.round((xs.reduce((n, e) => n + e.anxietyAfter!, 0) / xs.length) * 10) / 10 : null,
    fearHappened: xs.filter((e) => e.outcome === "happened").length,
  });
  const dropped = group(done.filter((e) => e.safetyBehaviourToDrop));
  const kept = group(done.filter((e) => !e.safetyBehaviourToDrop));
  return dropped.count > 0 && kept.count > 0 ? { dropped, kept } : null;
}

export const IMPACT_QUESTIONS = [
  "How much do you avoid speaking up, presenting or social situations because of anxiety?",
  "How much does this anxiety get in the way of your work or studies?",
  "How much does it get in the way of friendships or social life?",
  "How distressing is it for you?",
];
export const IMPACT_SCALE = ["Not at all", "A little", "Somewhat", "A lot", "Extremely"];

/** Non-diagnostic guidance: any answer of "A lot" or more suggests talking to a professional. */
export function impactGuidance(answers: number[]): "seek-support" | "self-help" {
  return answers.some((a) => a >= 3) ? "seek-support" : "self-help";
}
