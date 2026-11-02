import { describe, expect, it } from "vitest";
import { PLAN, currentWeek, pendingLookback, weekSummary, weekTasks, type PlanData } from "../../src/shared/plan";
import { phraseBank } from "../../src/client/screens/Phrases";
import type { PracticeSession } from "../../src/shared/types";

const start = "2026-11-02T09:00:00.000Z";
const day = (n: number) => new Date(new Date(start).getTime() + n * 86_400_000).toISOString();
const session = (over: Partial<PracticeSession>): PracticeSession => ({
  id: Math.random().toString(36),
  mode: "learn",
  startedAt: day(1),
  completedAt: day(1),
  exerciseId: "mp-explain-story",
  skill: "main-point",
  attempts: [{ id: "a", createdAt: day(1), modality: "spoken", text: "x y z", transcriptEdited: false, assisted: false, isRetry: false }],
  followUps: [],
  usedLive: false,
  ...over,
});
const base = (over: Partial<PlanData> = {}): PlanData => ({ plan: { startedAt: start, reflections: [] }, sessions: [], experiments: [], ladder: [], reframes: [], reviews: [], ...over });

describe("guided plan", () => {
  it("has four weeks covering all four skills", () => {
    expect(PLAN.map((w) => w.skill)).toEqual(["main-point", "organize", "conclusion", "example"]);
  });

  it("computes the current week and caps after week 4", () => {
    const plan = { startedAt: start, reflections: [] };
    expect(currentWeek(plan, day(0))).toBe(1);
    expect(currentWeek(plan, day(6.9))).toBe(1);
    expect(currentWeek(plan, day(7))).toBe(2);
    expect(currentWeek(plan, day(27))).toBe(4);
    expect(currentWeek(plan, day(40))).toBe(5);
  });

  it("marks week tasks done only from activity inside that week", () => {
    const d = base({
      sessions: [
        session({}),
        session({ mode: "talk", talk: { scenarioId: "introduce" } as PracticeSession["talk"] }),
        session({ mode: "talk", completedAt: day(8), talk: { scenarioId: "explain-group" } as PracticeSession["talk"] }),
      ],
      experiments: [{ id: "e", createdAt: day(2), kind: "real-world", situation: "s", prediction: "p", predictionLikelihood: 50, anxietyBefore: 5, completedAt: day(2), outcome: "didnt-happen", anxietyAfter: 3 }],
      ladder: [1, 2, 3].map((i) => ({ id: `l${i}`, createdAt: day(0), title: `s${i}`, expectedDiscomfort: i })),
    });
    expect(weekTasks(d, 1).map((t) => [t.id, t.done])).toEqual([
      ["learn", true],
      ["talk", true],
      ["brave", true],
      ["extra", true],
    ]);
    const w2 = weekTasks(d, 2);
    expect(w2.find((t) => t.id === "talk")!.done).toBe(true);
    expect(w2.find((t) => t.id === "learn")!.done).toBe(false);
    expect(weekSummary(d, 1)).toMatchObject({ learnSessions: 1, talkSessions: 1, spokenSessions: 2, braveSteps: 1, fearsNotHappened: 1 });
  });

  it("asks for a look-back on finished weeks without one", () => {
    expect(pendingLookback(base(), day(3))).toBeNull();
    expect(pendingLookback(base(), day(9))).toBe(1);
    expect(pendingLookback(base({ plan: { startedAt: start, reflections: [{ week: 1, at: day(8), text: "x" }] } }), day(9))).toBeNull();
  });
});

describe("phrase bank", () => {
  it("collects distinct phrases from sessions, newest first", () => {
    const term = (t: string) => ({ term: t, meaning: "m", inContext: null, exampleUse: "e" });
    const bank = phraseBank([
      { keyTerm: term("proxy"), startedAt: day(1), storyTitle: "A" },
      { keyTerm: term("Proxy"), startedAt: day(3), storyTitle: "B" },
      { keyTerm: term("base rate"), startedAt: day(2) },
      { startedAt: day(4) },
    ]);
    expect(bank.map((b) => b.term.term)).toEqual(["base rate", "proxy"]);
    expect(bank[1]!.storyTitle).toBe("A");
  });
});
