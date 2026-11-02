import { describe, expect, it } from "vitest";
import { STARTER_STEPS, THINKING_TRAPS, activeLadder, suggestNextStep, summarizeExperiments } from "../../src/shared/confidence";
import { mentionsCrisis } from "../../src/shared/safety";
import type { Experiment, LadderStep } from "../../src/shared/types";

const step = (id: string, d: number, archived = false): LadderStep => ({ id, createdAt: "2026-11-01T00:00:00Z", title: id, expectedDiscomfort: d, archived });
const exp = (over: Partial<Experiment>): Experiment => ({
  id: Math.random().toString(36),
  createdAt: "2026-11-01T00:00:00Z",
  kind: "real-world",
  situation: "s",
  prediction: "p",
  predictionLikelihood: 70,
  anxietyBefore: 7,
  ...over,
});

describe("brave steps ladder", () => {
  it("orders by expected discomfort and skips archived steps", () => {
    expect(activeLadder([step("hard", 80), step("easy", 20), step("gone", 10, true)]).map((s) => s.id)).toEqual(["easy", "hard"]);
  });
  it("suggests the easiest step not yet done at a manageable level", () => {
    const steps = [step("a", 20), step("b", 50)];
    expect(suggestNextStep(steps, [])?.id).toBe("a");
    expect(suggestNextStep(steps, [exp({ ladderStepId: "a", completedAt: "x", anxietyAfter: 7 })])?.id).toBe("a");
    expect(suggestNextStep(steps, [exp({ ladderStepId: "a", completedAt: "x", anxietyAfter: 3 })])?.id).toBe("b");
    expect(suggestNextStep([], [])).toBeNull();
  });
});

describe("experiment summary", () => {
  it("counts outcomes and averages self-reported anxiety for completed experiments only", () => {
    const s = summarizeExperiments([
      exp({ completedAt: "x", outcome: "didnt-happen", anxietyBefore: 8, anxietyAfter: 4 }),
      exp({ completedAt: "x", outcome: "partly", anxietyBefore: 6, anxietyAfter: 5 }),
      exp({}),
    ]);
    expect(s).toMatchObject({ completed: 2, pending: 1, fearNotHappened: 1, fearPartly: 1, fearHappened: 0, avgBefore: 7, avgAfter: 4.5 });
    expect(summarizeExperiments([]).avgBefore).toBeNull();
  });
});

describe("content", () => {
  it("has complete thinking-trap and starter-step content", () => {
    expect(THINKING_TRAPS.length).toBeGreaterThanOrEqual(6);
    for (const t of THINKING_TRAPS) expect(t.name && t.plain && t.question).toBeTruthy();
    expect(STARTER_STEPS.every((s) => s.expectedDiscomfort > 0 && s.expectedDiscomfort <= 10)).toBe(true);
  });
});

describe("crisis language detection", () => {
  it("flags clear crisis statements", () => {
    for (const t of ["I want to kill myself", "sometimes I feel suicidal", "I've been self-harming", "everyone would be better off without me", "I just want to die"]) {
      expect(mentionsCrisis(t), t).toBe(true);
    }
  });
  it("does not flag ordinary speaking-anxiety language", () => {
    for (const t of ["I'll die of embarrassment if I go blank", "this presentation is killing me", "I hurt my case by rambling", "the demo might crash"]) {
      expect(mentionsCrisis(t), t).toBe(false);
    }
  });
});

import { compareSafetyBehaviours, impactGuidance, IMPACT_QUESTIONS, IMPACT_SCALE } from "../../src/shared/confidence";

describe("safety-behaviour comparison", () => {
  it("needs both groups, then compares self-reported anxiety and outcomes", () => {
    const a = exp({ completedAt: "x", anxietyAfter: 3, outcome: "didnt-happen", safetyBehaviourToDrop: "Avoiding eye contact" });
    const b = exp({ completedAt: "x", anxietyAfter: 6, outcome: "happened" });
    expect(compareSafetyBehaviours([a])).toBeNull();
    expect(compareSafetyBehaviours([a, b, exp({})])).toEqual({
      dropped: { count: 1, avgAnxiety: 3, fearHappened: 0 },
      kept: { count: 1, avgAnxiety: 6, fearHappened: 1 },
    });
  });
});

describe("self-check guidance (non-diagnostic)", () => {
  it("suggests professional support when anything is rated 'A lot' or more", () => {
    expect(IMPACT_SCALE[3]).toBe("A lot");
    expect(impactGuidance(IMPACT_QUESTIONS.map(() => 1))).toBe("self-help");
    expect(impactGuidance([0, 0, 3, 0])).toBe("seek-support");
    expect(impactGuidance([4, 4, 4, 4])).toBe("seek-support");
  });
});
