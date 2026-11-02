import type { Experiment, GuidedPlan, LadderStep, PracticeSession, Reframe, ReviewItem, ScenarioId, SkillId } from "./types";
import { activeLadder } from "./confidence";
import { localDayKey } from "./dates";

// A 4-week guided plan. Each week focuses on one communication skill and mixes
// explaining, rehearsing, a real-world brave step, and one supporting task.
// Completion is computed from what the learner actually did (deterministic).

export const PLAN_WEEKS = 4;
const DAY = 86_400_000;

export interface PlanWeek {
  week: number;
  skill: SkillId;
  theme: string;
  learnExerciseId: string;
  talkScenario: ScenarioId;
  extra: "ladder" | "reframe" | "review" | "lookback";
}

export const PLAN: PlanWeek[] = [
  { week: 1, skill: "main-point", theme: "Lead with your point", learnExerciseId: "mp-explain-story", talkScenario: "introduce", extra: "ladder" },
  { week: 2, skill: "organize", theme: "Organize your thoughts", learnExerciseId: "org-two-reasons", talkScenario: "explain-group", extra: "reframe" },
  { week: 3, skill: "conclusion", theme: "Land the ending", learnExerciseId: "con-takeaway", talkScenario: "propose-change", extra: "review" },
  { week: 4, skill: "example", theme: "Make it concrete and persuasive", learnExerciseId: "ex-concrete-case", talkScenario: "persuade", extra: "lookback" },
];

export type PlanTaskId = "learn" | "talk" | "brave" | "extra";

export interface PlanTask {
  id: PlanTaskId;
  label: string;
  done: boolean;
}

export interface PlanData {
  plan?: GuidedPlan;
  sessions: PracticeSession[];
  experiments: Experiment[];
  ladder: LadderStep[];
  reframes: Reframe[];
  reviews: ReviewItem[];
}

/** 1-based current week, or PLAN_WEEKS + 1 when the plan is over. */
export function currentWeek(plan: GuidedPlan, nowIso: string): number {
  const days = Math.floor((new Date(nowIso).getTime() - new Date(plan.startedAt).getTime()) / DAY);
  return Math.max(1, Math.min(PLAN_WEEKS + 1, Math.floor(days / 7) + 1));
}

export function weekWindow(plan: GuidedPlan, week: number): { from: string; to: string } {
  const start = new Date(plan.startedAt).getTime();
  return { from: new Date(start + (week - 1) * 7 * DAY).toISOString(), to: new Date(start + week * 7 * DAY).toISOString() };
}

const within = (iso: string | undefined, w: { from: string; to: string }) => !!iso && iso >= w.from && iso < w.to;

export function weekTasks(d: PlanData, week: number): PlanTask[] {
  const plan = d.plan;
  const spec = PLAN[week - 1];
  if (!plan || !spec) return [];
  const w = weekWindow(plan, week);
  const learnDone = d.sessions.some((s) => s.mode === "learn" && within(s.completedAt, w));
  const talkDone = d.sessions.some((s) => s.mode === "talk" && s.talk?.scenarioId === spec.talkScenario && within(s.completedAt, w));
  const braveDone = d.experiments.some((e) => e.kind === "real-world" && within(e.completedAt, w));
  let extraDone = false;
  let extraLabel = "";
  switch (spec.extra) {
    case "ladder":
      extraLabel = "Build your brave steps ladder (3+ steps)";
      extraDone = activeLadder(d.ladder).length >= 3;
      break;
    case "reframe":
      extraLabel = "Untangle one anxious thought";
      extraDone = d.reframes.some((r) => within(r.at, w));
      break;
    case "review":
      extraLabel = "Do your reviews on two different days";
      extraDone = new Set(d.reviews.flatMap((r) => r.history.filter((h) => h.result !== "skipped" && within(h.at, w)).map((h) => localDayKey(h.at)))).size >= 2;
      break;
    case "lookback":
      extraLabel = "Look back on your four weeks";
      extraDone = plan.reflections.some((r) => r.week === 4);
      break;
  }
  return [
    { id: "learn", label: "Explain a story from memory", done: learnDone },
    { id: "talk", label: `Rehearse: ${scenarioLabel(spec.talkScenario)}`, done: talkDone },
    { id: "brave", label: "Take one real-world brave step", done: braveDone },
    { id: "extra", label: extraLabel, done: extraDone },
  ];
}

function scenarioLabel(id: ScenarioId): string {
  return { introduce: "introduce yourself", "explain-group": "explain an idea to a group", persuade: "a short persuasive talk", "propose-change": "propose a change" }[id];
}

export interface WeekSummary {
  learnSessions: number;
  talkSessions: number;
  spokenSessions: number;
  braveSteps: number;
  fearsNotHappened: number;
  reviewsDone: number;
}

export function weekSummary(d: PlanData, week: number): WeekSummary | null {
  if (!d.plan) return null;
  const w = weekWindow(d.plan, week);
  const done = d.sessions.filter((s) => within(s.completedAt, w));
  const exps = d.experiments.filter((e) => e.kind === "real-world" && within(e.completedAt, w));
  return {
    learnSessions: done.filter((s) => s.mode === "learn").length,
    talkSessions: done.filter((s) => s.mode === "talk").length,
    spokenSessions: done.filter((s) => s.attempts[0]?.modality === "spoken").length,
    braveSteps: exps.length,
    fearsNotHappened: exps.filter((e) => e.outcome === "didnt-happen").length,
    reviewsDone: d.reviews.reduce((n, r) => n + r.history.filter((h) => h.result !== "skipped" && within(h.at, w)).length, 0),
  };
}

/** True when nothing at all was logged in a week (used to offer a gentler look-back / restart). */
export function weekWasEmpty(d: PlanData, week: number): boolean {
  const s = weekSummary(d, week);
  return !!s && s.learnSessions + s.talkSessions + s.braveSteps + s.reviewsDone === 0;
}

/** The earliest finished week (before the current one) that has no look-back yet. */
export function pendingLookback(d: PlanData, nowIso: string): number | null {
  if (!d.plan) return null;
  const cw = currentWeek(d.plan, nowIso);
  for (let wk = 1; wk < Math.min(cw, PLAN_WEEKS); wk++) {
    if (!d.plan.reflections.some((r) => r.week === wk)) return wk;
  }
  return null;
}
