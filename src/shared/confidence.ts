import type { Experiment, LadderStep, ThinkingTrap } from "./types";

// CBT-informed self-help content for speaking/social anxiety. Original wording,
// based on widely described techniques (cognitive restructuring, behavioural
// experiments, graded exposure, dropping safety behaviours, outward attention).
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
    id: "catastrophising",
    name: "Catastrophising",
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
    id: "labelling",
    name: "Labelling",
    plain: "Turning one moment into a verdict on yourself: 'I'm awkward'.",
    question: "Is one moment really the whole picture of you?",
  },
];

/** Common safety behaviours in speaking situations. Dropping one is often part of a behavioural experiment. */
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
  { title: "Say one comment in a small meeting", expectedDiscomfort: 30 },
  { title: "Ask a question in a meeting", expectedDiscomfort: 40 },
  { title: "Explain an idea to a colleague, one-on-one", expectedDiscomfort: 35 },
  { title: "Give a 1-minute update to my team", expectedDiscomfort: 55 },
  { title: "Disagree politely in a meeting", expectedDiscomfort: 65 },
  { title: "Present for 5 minutes to a group", expectedDiscomfort: 80 },
];

export const OUTWARD_FOCUS_TIP =
  "While you speak, put your attention on the listener and your message — not on how you look or sound.";

export function activeLadder(steps: LadderStep[]): LadderStep[] {
  return steps.filter((s) => !s.archived).sort((a, b) => a.expectedDiscomfort - b.expectedDiscomfort || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Suggest the next rung: the easiest step not yet completed with anxiety-after
 * at or below 4/10. Ordinary software, deterministic.
 */
export function suggestNextStep(steps: LadderStep[], experiments: Experiment[]): LadderStep | null {
  for (const s of activeLadder(steps)) {
    const done = experiments.some((e) => e.ladderStepId === s.id && e.completedAt && (e.anxietyAfter ?? 10) <= 4);
    if (!done) return s;
  }
  return null;
}

export interface ExperimentSummary {
  completed: number;
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
    pending: exps.length - done.length,
    fearNotHappened: done.filter((e) => e.outcome === "didnt-happen").length,
    fearPartly: done.filter((e) => e.outcome === "partly").length,
    fearHappened: done.filter((e) => e.outcome === "happened").length,
    avgBefore: mean(done.map((e) => e.anxietyBefore)),
    avgAfter: mean(done.filter((e) => e.anxietyAfter != null).map((e) => e.anxietyAfter!)),
  };
}
