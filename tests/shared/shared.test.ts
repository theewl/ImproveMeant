import { describe, expect, it } from "vitest";
import { applyReview, dueQueue, DAILY_REVIEW_CAP, INTERVAL_LADDER_DAYS, canAddItem, MAX_ACTIVE_ITEMS } from "../../src/shared/schedule";
import { quoteAppearsIn, wordCount, sentenceCount, boundText, firstSentence } from "../../src/shared/text";
import { measureAttempt, deliveryFromWordTimings } from "../../src/shared/observations";
import { EXERCISES, SCENARIOS, SKILL_ORDER, getExercise, pickLearnExercise } from "../../src/shared/curriculum";
import { evergreenBriefing, evergreenCards } from "../../src/shared/evergreen";
import type { ReviewItem } from "../../src/shared/types";

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "r1",
  kind: "idea",
  createdAt: "2026-11-01T10:00:00.000Z",
  prompt: "p",
  answer: "a",
  step: 0,
  dueAt: "2026-11-02T10:00:00.000Z",
  history: [],
  status: "active",
  ...over,
});

describe("review schedule", () => {
  const now = "2026-11-02T12:00:00.000Z";
  it("moves up the ladder on recall, holds on partial, resets on miss, postpones on skip", () => {
    const up = applyReview(item(), "recalled", now);
    expect(up.step).toBe(1);
    expect(up.dueAt).toBe("2026-11-05T12:00:00.000Z");
    expect(applyReview(item({ step: 2 }), "partly", now).step).toBe(2);
    const miss = applyReview(item({ step: 3 }), "missed", now);
    expect(miss.step).toBe(0);
    expect(miss.dueAt).toBe("2026-11-03T12:00:00.000Z");
    const skip = applyReview(item({ step: 2 }), "skipped", now);
    expect(skip.step).toBe(2);
    expect(skip.lastReviewedAt).toBeUndefined();
    expect(applyReview(item({ step: INTERVAL_LADDER_DAYS.length - 1 }), "recalled", now).step).toBe(INTERVAL_LADDER_DAYS.length - 1);
  });

  it("caps the daily queue so a backlog never overwhelms", () => {
    const many = Array.from({ length: 12 }, (_, i) => item({ id: `r${i}`, dueAt: `2026-11-0${(i % 2) + 1}T09:00:00.000Z` }));
    const q = dueQueue(many, now);
    expect(q.queue).toHaveLength(DAILY_REVIEW_CAP);
    expect(q.waiting).toBe(12 - DAILY_REVIEW_CAP);
    expect(q.queue[0]!.dueAt <= q.queue[4]!.dueAt).toBe(true);
    const reviewed = many.map((m, i) => (i < 3 ? applyReview(m, "recalled", now) : m));
    expect(dueQueue(reviewed, now).queue).toHaveLength(DAILY_REVIEW_CAP - 3);
  });

  it("ignores dismissed and future items and limits active items", () => {
    expect(dueQueue([item({ status: "dismissed" }), item({ dueAt: "2026-12-01T00:00:00Z" })], now).queue).toHaveLength(0);
    expect(canAddItem(Array.from({ length: MAX_ACTIVE_ITEMS }, (_, i) => item({ id: String(i) })))).toBe(false);
  });
});

describe("text utilities", () => {
  it("verifies quotes despite punctuation, case and curly quotes", () => {
    const text = "Honestly, I think we should “start with the pilot” — then expand.";
    expect(quoteAppearsIn('we should "start with the pilot"', text)).toBe(true);
    expect(quoteAppearsIn("START WITH THE PILOT", text)).toBe(true);
    expect(quoteAppearsIn("I think ... then expand", text)).toBe(true);
    expect(quoteAppearsIn("start with the budget", text)).toBe(false);
    expect(quoteAppearsIn("", text)).toBe(false);
  });
  it("counts words and sentences", () => {
    expect(wordCount("It's a well-known idea, isn't it?")).toBe(6);
    expect(sentenceCount("One. Two! Three?")).toBe(3);
    expect(firstSentence("First one. Second.")).toBe("First one.");
    expect(boundText("a b c d e f", 5)).toMatchObject({ truncated: true });
  });
});

describe("measured observations", () => {
  it("labels typed vs spoken bases and only shows pace from provider timestamps", () => {
    const typed = measureAttempt({ text: "One two three. Four.", modality: "typed", transcriptEdited: false });
    expect(typed.map((m) => m.label)).toEqual(["Length", "Opening sentence"]);
    expect(typed[0]!.basis).toMatch(/typed/);
    const spoken = measureAttempt({
      text: "edited words here now",
      modality: "spoken",
      transcriptEdited: true,
      durationSeconds: 30,
      delivery: deliveryFromWordTimings([{ start: 0, end: 1 }, { start: 4, end: 5 }], 30),
    });
    expect(spoken.find((m) => m.label === "Speaking pace")!.basis).toMatch(/original \(unedited\)/);
    expect(spoken.find((m) => m.label === "Gaps over 2 seconds")!.value).toBe("1");
    const manual = measureAttempt({ text: "a b c", modality: "spoken", transcriptEdited: true, durationSeconds: 10, delivery: { basis: "recording-length-only", recordingSeconds: 10, limitations: "" } });
    expect(manual.some((m) => m.label === "Speaking pace")).toBe(false);
  });
});

describe("curriculum and library integrity", () => {
  it("every exercise is complete", () => {
    for (const e of EXERCISES) {
      expect(SKILL_ORDER).toContain(e.skill);
      for (const f of [e.title, e.prompt, e.successDefinition, e.exampleFeedback, e.laterVariation]) expect(f.length).toBeGreaterThan(10);
    }
    for (const s of SKILL_ORDER) expect(EXERCISES.filter((e) => e.skill === s).length).toBeGreaterThanOrEqual(3);
  });
  it("scenarios reference real exercises and have question banks", () => {
    expect(SCENARIOS.map((s) => s.id).sort()).toEqual(["explain-group", "introduce", "persuade", "propose-change"]);
    for (const s of SCENARIOS) {
      expect(getExercise(s.exerciseId).skill).toBe(s.primarySkill);
      expect(s.sampleQuestions.supportive.length).toBeGreaterThan(0);
      expect(s.sampleQuestions.challenging.length).toBeGreaterThan(0);
    }
  });
  it("learn exercise rotation starts with the main point", () => {
    expect(pickLearnExercise(0).skill).toBe("main-point");
    expect(new Set([2, 3, 4, 5].map((n) => pickLearnExercise(n).skill)).size).toBe(4);
  });
  it("every evergreen item has source metadata and a complete briefing", () => {
    for (const c of evergreenCards()) {
      expect(c.source.url).toMatch(/^https:\/\//);
      expect(c.source.publisher && c.source.publishedAt && c.source.retrievedAt).toBeTruthy();
      const b = evergreenBriefing(c.id)!;
      expect(b.points.length).toBeGreaterThanOrEqual(2);
      expect(b.mainIdea && b.keyTerm.term && b.followUpQuestion).toBeTruthy();
      expect(b.generatedBy).toBe("curated");
    }
  });
});
