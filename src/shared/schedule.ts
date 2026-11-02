import type { ReviewItem, ReviewResult } from "./types";

// Simple deterministic review schedule (a Leitner-style ladder).
// Ordinary software, no AI. Intervals in days.
export const INTERVAL_LADDER_DAYS = [1, 3, 7, 16, 35] as const;

/** At most this many reviews are offered per day, so a backlog never becomes overwhelming. */
export const DAILY_REVIEW_CAP = 5;
/** Active items beyond this are not added; the learner is asked to dismiss something first. */
export const MAX_ACTIVE_ITEMS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/** Start of the local day is not knowable on the server; we use "due by end of now + 0". */
export function isDue(item: ReviewItem, nowIso: string): boolean {
  return item.status === "active" && new Date(item.dueAt).getTime() <= new Date(nowIso).getTime();
}

export function firstDueDate(createdAt: string): string {
  return addDays(createdAt, INTERVAL_LADDER_DAYS[0]);
}

/**
 * Apply a review result and return the updated item.
 * - recalled: move up one step
 * - partly:   stay on the same step (see it again after that step's interval)
 * - missed:   back to step 0 (see it tomorrow)
 * - skipped:  postpone one day without changing the step
 */
export function applyReview(item: ReviewItem, result: ReviewResult, nowIso: string, response?: string): ReviewItem {
  const maxStep = INTERVAL_LADDER_DAYS.length - 1;
  let step = item.step;
  let days: number;
  switch (result) {
    case "recalled":
      step = Math.min(item.step + 1, maxStep);
      days = INTERVAL_LADDER_DAYS[step]!;
      break;
    case "partly":
      days = INTERVAL_LADDER_DAYS[step]!;
      break;
    case "missed":
      step = 0;
      days = INTERVAL_LADDER_DAYS[0];
      break;
    case "skipped":
      days = 1;
      break;
  }
  return {
    ...item,
    step,
    dueAt: addDays(nowIso, days),
    lastReviewedAt: result === "skipped" ? item.lastReviewedAt : nowIso,
    history: [...item.history, { at: nowIso, result, ...(response ? { response: response.slice(0, 2000) } : {}) }],
  };
}

/**
 * Today's queue: due, active items, oldest due first, capped.
 * Items reviewed (not skipped) earlier today don't count against the cap twice.
 */
export function dueQueue(items: ReviewItem[], nowIso: string, cap = DAILY_REVIEW_CAP): { queue: ReviewItem[]; waiting: number; doneToday: number } {
  const today = nowIso.slice(0, 10);
  const doneToday = items.filter((i) => i.history.some((h) => h.at.slice(0, 10) === today && h.result !== "skipped")).length;
  const due = items
    .filter((i) => isDue(i, nowIso))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.createdAt.localeCompare(b.createdAt));
  const remainingCap = Math.max(0, cap - doneToday);
  return { queue: due.slice(0, remainingCap), waiting: Math.max(0, due.length - remainingCap), doneToday };
}

export function canAddItem(items: ReviewItem[]): boolean {
  return items.filter((i) => i.status === "active").length < MAX_ACTIVE_ITEMS;
}
