import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import type { FsrsState, ReviewItem, ReviewResult } from "./types";

// Review scheduling with FSRS (the open-source scheduler used by Anki), via
// ts-fsrs. Deterministic: no fuzz, no same-day learning steps (this is a
// once-a-day app). Self-assessed results map to FSRS ratings:
//   recalled → Good, partly → Hard, missed → Again; skipped postpones a day.

export const DESIRED_RETENTION = 0.9;
/** At most this many reviews are offered per day, so a backlog never becomes overwhelming. */
export const DAILY_REVIEW_CAP = 5;
/** Active items beyond this are not added; the learner is asked to dismiss something first. */
export const MAX_ACTIVE_ITEMS = 60;

const DAY_MS = 24 * 60 * 60 * 1000;
const scheduler = fsrs(generatorParameters({ request_retention: DESIRED_RETENTION, enable_fuzz: false, enable_short_term: false, maximum_interval: 365 }));

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

export function isDue(item: ReviewItem, nowIso: string): boolean {
  return item.status === "active" && new Date(item.dueAt).getTime() <= new Date(nowIso).getTime();
}

/** New items are first asked about the next day, so recall is spaced from learning. */
export function firstDueDate(createdAt: string): string {
  return addDays(createdAt, 1);
}

function toCard(item: ReviewItem): Card {
  if (!item.fsrs) return createEmptyCard(new Date(item.createdAt));
  const f = item.fsrs;
  return { ...f, due: new Date(f.due), last_review: f.last_review ? new Date(f.last_review) : undefined, state: f.state as Card["state"] };
}

function fromCard(c: Card): FsrsState {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review?.toISOString(),
  };
}

const RATING: Record<Exclude<ReviewResult, "skipped">, Grade> = {
  recalled: Rating.Good,
  partly: Rating.Hard,
  missed: Rating.Again,
};

/** Apply a review result and return the updated item. */
export function applyReview(item: ReviewItem, result: ReviewResult, nowIso: string, response?: string): ReviewItem {
  const history = [...item.history, { at: nowIso, result, ...(response ? { response: response.slice(0, 2000) } : {}) }];
  if (result === "skipped") {
    return { ...item, dueAt: addDays(nowIso, 1), history };
  }
  const { card } = scheduler.next(toCard(item), new Date(nowIso), RATING[result]);
  // Never schedule for later the same day in a once-a-day app.
  const due = Math.max(card.due.getTime(), new Date(nowIso).getTime() + DAY_MS);
  return {
    ...item,
    fsrs: fromCard({ ...card, due: new Date(due) }),
    step: result === "recalled" ? item.step + 1 : result === "missed" ? 0 : item.step,
    dueAt: new Date(due).toISOString(),
    lastReviewedAt: nowIso,
    history,
  };
}

/**
 * Today's queue: due, active items, oldest due first, capped.
 * Items reviewed (not skipped) earlier today count against the cap.
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
