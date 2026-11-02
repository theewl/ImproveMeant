import type { Briefing, PracticeSession, RealWorldAttempt, ReviewItem, ReviewResult, SkillId } from "../../shared/types";
import { applyReview, canAddItem, firstDueDate } from "../../shared/schedule";
import { getExercise, SKILLS } from "../../shared/curriculum";
import type { AppData } from "./storage";
import { uid } from "./storage";

// Pure state transitions over AppData (easy to test; no React).

export function upsertSession(d: AppData, s: PracticeSession): AppData {
  const i = d.sessions.findIndex((x) => x.id === s.id);
  const sessions = i >= 0 ? d.sessions.map((x) => (x.id === s.id ? s : x)) : [...d.sessions, s];
  return { ...d, sessions };
}

export type SaveChoice = "idea" | "phrase" | "skill";

export function buildReviewItem(choice: SaveChoice, ctx: { briefing?: Briefing | null; exerciseId: string; skill: SkillId; topic?: string }, nowIso: string): ReviewItem {
  const base = {
    id: uid("r-"),
    createdAt: nowIso,
    step: 0,
    dueAt: firstDueDate(nowIso),
    history: [],
    status: "active" as const,
  };
  const b = ctx.briefing;
  if (choice === "idea" && b) {
    return {
      ...base,
      kind: "idea",
      prompt: b.kind === "current" ? `What was the main idea of "${b.title}" (as reported on ${b.source.publishedAt})?` : `What's the main idea of "${b.title}"?`,
      answer: b.mainIdea,
      storyId: b.storyId,
      storyKind: b.kind,
      sourceVersion: b.sourceVersion,
      source: b.source,
    };
  }
  if (choice === "phrase" && b) {
    return {
      ...base,
      kind: "phrase",
      prompt: `What does "${b.keyTerm.term}" mean?`,
      answer: `${b.keyTerm.meaning} Example: ${b.keyTerm.exampleUse}`,
      applyTask: `Use "${b.keyTerm.term}" in a new sentence about your own work or life.`,
      storyId: b.storyId,
      storyKind: b.kind,
      sourceVersion: b.sourceVersion,
      source: b.source,
    };
  }
  const ex = getExercise(ctx.exerciseId);
  return {
    ...base,
    kind: "skill",
    skill: ctx.skill,
    exerciseId: ex.id,
    prompt: `Skill: ${SKILLS[ctx.skill].name}. What does success look like?`,
    answer: ex.successDefinition,
    applyTask: ex.laterVariation,
  };
}

export function addReviewItem(d: AppData, item: ReviewItem): { data: AppData; added: boolean } {
  if (!canAddItem(d.reviews)) return { data: d, added: false };
  // Avoid duplicates of the same kind for the same story/skill.
  const dup = d.reviews.find(
    (r) => r.status === "active" && r.kind === item.kind && ((item.storyId && r.storyId === item.storyId) || (item.kind === "skill" && r.skill === item.skill)),
  );
  if (dup) return { data: d, added: false };
  return { data: { ...d, reviews: [...d.reviews, item] }, added: true };
}

export function recordReview(d: AppData, id: string, result: ReviewResult, nowIso: string, response?: string): AppData {
  return { ...d, reviews: d.reviews.map((r) => (r.id === id ? applyReview(r, result, nowIso, response) : r)) };
}

export function dismissReview(d: AppData, id: string): AppData {
  return { ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, status: "dismissed" as const } : r)) };
}

export function deleteReview(d: AppData, id: string): AppData {
  return { ...d, reviews: d.reviews.filter((r) => r.id !== id) };
}

export function markSourceChanged(d: AppData, id: string): AppData {
  return { ...d, reviews: d.reviews.map((r) => (r.id === id ? { ...r, sourceChanged: true } : r)) };
}

export function addRealWorld(d: AppData, a: Omit<RealWorldAttempt, "id">): AppData {
  return { ...d, realWorld: [...d.realWorld, { ...a, id: uid("w-") }] };
}

export interface ProgressSummary {
  spokenSessions: number;
  writtenSessions: number;
  unfinished: number;
  skills: Record<SkillId, { sessions: number; goalMetLive: number; liveFeedbackCount: number }>;
  retries: number;
  feedbackRated: number;
  feedbackUseful: number;
  reviewCounts: Record<ReviewResult, number>;
  realWorld: number;
}

/** A session counts as spoken if its main (first) attempt was spoken. Typed and spoken are tracked separately. */
export function summarize(d: AppData): ProgressSummary {
  const skills = {
    "main-point": { sessions: 0, goalMetLive: 0, liveFeedbackCount: 0 },
    organize: { sessions: 0, goalMetLive: 0, liveFeedbackCount: 0 },
    example: { sessions: 0, goalMetLive: 0, liveFeedbackCount: 0 },
    conclusion: { sessions: 0, goalMetLive: 0, liveFeedbackCount: 0 },
  } satisfies ProgressSummary["skills"];
  let spoken = 0,
    written = 0,
    unfinished = 0,
    retries = 0,
    feedbackRated = 0,
    feedbackUseful = 0;
  for (const s of d.sessions) {
    if (!s.completedAt) {
      unfinished++;
      continue;
    }
    const first = s.attempts[0];
    if (!first) continue;
    if (first.modality === "spoken") spoken++;
    else written++;
    skills[s.skill].sessions++;
    for (const a of s.attempts) {
      if (a.isRetry) retries++;
      if (a.feedbackRating) {
        feedbackRated++;
        if (a.feedbackRating === "useful") feedbackUseful++;
      }
      if (a.feedback?.kind === "live") {
        skills[s.skill].liveFeedbackCount++;
        if (a.feedback.goalMet) skills[s.skill].goalMetLive++;
      }
    }
  }
  const reviewCounts: Record<ReviewResult, number> = { recalled: 0, partly: 0, missed: 0, skipped: 0 };
  for (const r of d.reviews) for (const h of r.history) reviewCounts[h.result]++;
  return { spokenSessions: spoken, writtenSessions: written, unfinished, skills, retries, feedbackRated, feedbackUseful, reviewCounts, realWorld: d.realWorld.length };
}
