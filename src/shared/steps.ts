import type { CommunicationGoal, Experiment, LadderStep, PracticeSession, ReviewItem, ScenarioId } from "./types";
import { CAMERA_DRILLS } from "./camera";
import { SCENARIOS } from "./curriculum";
import { STARTER_STEPS, activeLadder } from "./confidence";
import { dueQueue } from "./schedule";
import { localDayKey } from "./dates";

// One method, one ladder. Every way of practising (explaining a story, talking to a
// camera, rehearsing a talk, a real-world brave step) is a step with an expected
// discomfort, and the app always suggests the easiest step you haven't done yet.

export type StepKind = "explain" | "camera" | "talk" | "real";

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  detail: string;
  /** Expected discomfort, 0–10. Camera and talk steps are reviewed defaults; real-world steps are the learner's own. */
  discomfort: number;
  minutes: number;
  /** What to open. */
  target: { kind: "learn" } | { kind: "camera"; drillId: string } | { kind: "talk"; scenario: ScenarioId } | { kind: "real"; ladderStepId?: string; title: string };
}

export interface StepData {
  sessions: PracticeSession[];
  experiments: Experiment[];
  ladder: LadderStep[];
}

const KIND_LABEL: Record<StepKind, string> = { explain: "Explain", camera: "Camera", talk: "Talk", real: "Real life" };
export const stepKindLabel = (k: StepKind) => KIND_LABEL[k];

const TALK_DISCOMFORT: Record<ScenarioId, number> = { introduce: 3, "explain-group": 4, "propose-change": 5, persuade: 6 };

/** Camera drills map levels 1–11 onto discomfort 1–7 so they interleave with talks and real-world steps. */
const cameraDiscomfort = (level: number) => Math.min(7, Math.max(1, Math.round(1 + (level - 1) * 0.6)));

export function allSteps(d: StepData): Step[] {
  const steps: Step[] = [
    { id: "explain", kind: "explain", title: "Explain today's story from memory", detail: "Read a short briefing, then say it in your own words.", discomfort: 1, minutes: 4, target: { kind: "learn" } },
    ...CAMERA_DRILLS.map<Step>((c) => ({ id: c.id, kind: "camera", title: c.title, detail: c.why, discomfort: cameraDiscomfort(c.level), minutes: Math.max(2, Math.ceil(c.seconds / 30)), target: { kind: "camera", drillId: c.id } })),
    ...SCENARIOS.map<Step>((s) => ({ id: `talk-${s.id}`, kind: "talk", title: s.title, detail: s.description, discomfort: TALK_DISCOMFORT[s.id], minutes: 6, target: { kind: "talk", scenario: s.id } })),
    ...activeLadder(d.ladder).map<Step>((l) => ({ id: l.id, kind: "real", title: l.title, detail: "A real conversation. Predict what you fear, do it, see what happens.", discomfort: l.expectedDiscomfort, minutes: 1, target: { kind: "real", ladderStepId: l.id, title: l.title } })),
  ];
  return steps.sort((a, b) => a.discomfort - b.discomfort || kindOrder(a.kind) - kindOrder(b.kind));
}

function kindOrder(k: StepKind): number {
  return { explain: 0, camera: 1, talk: 2, real: 3 }[k];
}

export interface StepRecord {
  count: number;
  lastAt?: string;
  /** Anxiety while doing it last time, 0–10, if the learner checked in. */
  lastAnxiety?: number;
}

export function stepRecord(step: Step, d: StepData): StepRecord {
  let done: { at: string; anxiety?: number }[] = [];
  switch (step.target.kind) {
    case "learn":
      done = d.sessions.filter((s) => s.mode === "learn" && s.completedAt).map((s) => ({ at: s.completedAt!, anxiety: anxietyFor(d, s.id) }));
      break;
    case "camera": {
      const id = step.target.drillId;
      done = d.sessions.filter((s) => s.mode === "camera" && s.camera?.drillId === id && !s.camera.promptId && s.completedAt).map((s) => ({ at: s.completedAt!, anxiety: anxietyFor(d, s.id) }));
      break;
    }
    case "talk": {
      const sc = step.target.scenario;
      done = d.sessions.filter((s) => s.mode === "talk" && s.talk?.scenarioId === sc && s.completedAt).map((s) => ({ at: s.completedAt!, anxiety: anxietyFor(d, s.id) }));
      break;
    }
    case "real": {
      const id = step.target.ladderStepId;
      done = d.experiments.filter((e) => e.kind === "real-world" && e.ladderStepId === id && e.completedAt).map((e) => ({ at: e.completedAt!, anxiety: e.anxietyAfter }));
      break;
    }
  }
  done.sort((a, b) => a.at.localeCompare(b.at));
  const last = done[done.length - 1];
  return { count: done.length, lastAt: last?.at, lastAnxiety: last?.anxiety };
}

function anxietyFor(d: StepData, sessionId: string): number | undefined {
  return d.experiments.find((e) => e.sessionId === sessionId && e.completedAt)?.anxietyAfter;
}

/** Which kinds fit the learner's goal. Everyone gets explain and real-life steps. */
export function kindsForGoal(goal: CommunicationGoal): StepKind[] {
  if (goal === "camera") return ["explain", "camera", "real", "talk"];
  return ["explain", "talk", "real", "camera"];
}

/**
 * The next step: the easiest step in the goal's main formats that hasn't been done
 * yet; once every step has been done once, the one done least, easiest first.
 * Real-world steps only count when the learner has added some.
 */
export function nextStep(d: StepData, goal: CommunicationGoal): Step {
  const steps = allSteps(d);
  const order = kindsForGoal(goal);
  const primary = order.slice(0, 3);
  const pool = steps.filter((s) => primary.includes(s.kind) && s.kind !== "explain");
  const withRecord = pool.map((s) => ({ s, r: stepRecord(s, d) }));
  const fresh = withRecord.find((x) => x.r.count === 0);
  if (fresh) return fresh.s;
  return [...withRecord].sort((a, b) => a.r.count - b.r.count || a.s.discomfort - b.s.discomfort)[0]?.s ?? steps[0]!;
}

/** Real-world steps the learner could add, excluding ones already on the ladder. */
export function realStepIdeas(ladder: LadderStep[], max = 3): { title: string; expectedDiscomfort: number }[] {
  const active = activeLadder(ladder);
  return STARTER_STEPS.filter((s) => !active.some((x) => x.title === s.title)).slice(0, max);
}

// ---------- Today's path ----------

export interface PathItem {
  id: "explain" | "step" | "review";
  title: string;
  detail: string;
  minutes: number;
  done: boolean;
  step?: Step;
}

export interface PathData extends StepData {
  reviews: ReviewItem[];
}

/** The day's three things: explain a story, take the next step (with that story where it fits), do the reviews that are due. */
export function todayPath(d: PathData, goal: CommunicationGoal, nowIso: string): PathItem[] {
  const today = localDayKey(nowIso);
  const doneToday = (mode: PracticeSession["mode"]) => d.sessions.some((s) => s.mode === mode && s.completedAt && localDayKey(s.completedAt) === today);
  const step = nextStep(d, goal);
  const stepDone =
    step.kind === "real"
      ? d.experiments.some((e) => e.kind === "real-world" && e.completedAt && localDayKey(e.completedAt) === today)
      : doneToday(step.kind === "camera" ? "camera" : "talk");
  const due = dueQueue(d.reviews, nowIso).queue.length;
  const reviewedToday = d.reviews.some((r) => r.history.some((h) => localDayKey(h.at) === today));
  const items: PathItem[] = [
    { id: "explain", title: "Read something, explain it from memory", detail: "Short briefing, your own words, one note from the coach.", minutes: 4, done: doneToday("learn") },
    { id: "step", title: `Next step: ${step.title}`, detail: `${stepKindLabel(step.kind)} · expected discomfort ${step.discomfort}/10`, minutes: step.minutes, done: stepDone, step },
  ];
  if (due > 0 || reviewedToday) items.push({ id: "review", title: due > 0 ? `${due} review${due === 1 ? "" : "s"} due` : "Reviews done", detail: "Recall what you learned, in a new context.", minutes: Math.max(1, due), done: due === 0 });
  return items;
}
