import { describe, expect, it } from "vitest";
import { localDayKey } from "../../src/shared/dates";
import { dueQueue } from "../../src/shared/schedule";
import { pickLearnExercise, pickLearnExerciseForSkill, PROGRESSION_THRESHOLD } from "../../src/shared/curriculum";

describe("local day key", () => {
  it("uses the device's local calendar day, not UTC", () => {
    const d = new Date(2026, 10, 2, 23, 30); // local 23:30 on 2 Nov
    expect(localDayKey(d)).toBe("2026-11-02");
    expect(localDayKey(d.toISOString())).toBe("2026-11-02");
  });

  it("counts reviews done today by local day", () => {
    const late = new Date(2026, 10, 2, 23, 0).toISOString(); // local 23:00 today
    const item = { id: "r", kind: "idea" as const, createdAt: late, prompt: "p", answer: "a", step: 0, dueAt: late, history: [{ at: late, result: "recalled" as const }], status: "active" as const };
    expect(dueQueue([item], new Date(2026, 10, 2, 23, 30).toISOString()).doneToday).toBe(1);
    expect(dueQueue([item], new Date(2026, 10, 3, 0, 30).toISOString()).doneToday).toBe(0);
  });
});

describe("exercise progression", () => {
  it("moves to the harder version of a skill after the goal is met enough times", () => {
    expect(pickLearnExerciseForSkill("main-point", 0).difficulty).toBe("starter");
    expect(pickLearnExerciseForSkill("main-point", PROGRESSION_THRESHOLD - 1).difficulty).toBe("starter");
    expect(pickLearnExerciseForSkill("main-point", PROGRESSION_THRESHOLD).id).toBe("mp-one-sentence");
    expect(pickLearnExerciseForSkill("organize", 99).id).toBe("org-stretch-objection");
  });
  it("rotates skills outside a plan and respects progression", () => {
    expect(pickLearnExercise(0).skill).toBe("main-point");
    expect(new Set([2, 3, 4, 5].map((n) => pickLearnExercise(n).skill)).size).toBe(4);
    expect(pickLearnExercise(0, { "main-point": 4 }).id).toBe("mp-one-sentence");
  });
});
