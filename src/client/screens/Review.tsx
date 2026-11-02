import { useEffect, useId, useState } from "react";
import type { ReviewItem, ReviewResult } from "../../shared/types";
import { dueQueue, DAILY_REVIEW_CAP } from "../../shared/schedule";
import { getExercise } from "../../shared/curriculum";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { deleteReview, dismissReview, markSourceChanged, recordReview } from "../lib/state";
import { href } from "../lib/router";
import { uid } from "../lib/storage";
import { formatDate } from "../components/common";

export function Review() {
  const { data, update } = useApp();
  const now = new Date().toISOString();
  const { queue, waiting, doneToday } = dueQueue(data.reviews, now);
  const item = queue[0];
  const nextDue = data.reviews
    .filter((r) => r.status === "active")
    .map((r) => r.dueAt)
    .sort()[0];

  return (
    <main className="screen" id="main">
      <h2>Review</h2>
      {!item ? (
        <section className="done">
          {doneToday > 0 ? <p>Reviews done for today. Nice work.</p> : <p>Nothing to review right now.</p>}
          {waiting > 0 && <p className="hint">{waiting} more will wait until tomorrow — we cap reviews at {DAILY_REVIEW_CAP} a day so they don't pile up.</p>}
          {nextDue && <p className="hint">Next review: {formatDate(nextDue)}.</p>}
          {data.reviews.length === 0 && <p className="hint">Finish a session and save an idea, phrase or skill to see it here.</p>}
          <a className="button primary" href={href({ name: "today" })}>
            Back to today
          </a>
        </section>
      ) : (
        <>
          <p className="hint" aria-live="polite">
            {queue.length} left today{waiting > 0 ? ` · ${waiting} waiting for later days` : ""}
          </p>
          <ReviewCard
            key={item.id}
            item={item}
            onResult={(result, response) => update((d) => recordReview(d, item.id, result, new Date().toISOString(), response))}
            onDismiss={() => update((d) => dismissReview(d, item.id))}
            onDelete={() => update((d) => deleteReview(d, item.id))}
            onSourceChanged={() => update((d) => markSourceChanged(d, item.id))}
          />
        </>
      )}
    </main>
  );
}

function ReviewCard({
  item,
  onResult,
  onDismiss,
  onDelete,
  onSourceChanged,
}: {
  item: ReviewItem;
  onResult: (r: ReviewResult, response?: string) => void;
  onDismiss: () => void;
  onDelete: () => void;
  onSourceChanged: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [apply, setApply] = useState("");
  const [applyTask, setApplyTask] = useState(item.applyTask);
  const [adapting, setAdapting] = useState(false);
  const [topic, setTopic] = useState("");
  const recallId = useId();
  const applyId = useId();

  useEffect(() => {
    if (!item.storyId || item.storyKind !== "current" || item.sourceChanged) return;
    api
      .storyStatus(item.storyId)
      .then((st) => {
        if (st.known && st.sourceVersion && item.sourceVersion && st.sourceVersion !== item.sourceVersion) onSourceChanged();
      })
      .catch(() => undefined); // offline: keep the "as reported on" framing
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const kindLabel = item.kind === "idea" ? "Idea" : item.kind === "phrase" ? "Phrase" : "Skill";

  return (
    <section className="card review" aria-labelledby={`rv-${item.id}`}>
      <p className="tags">
        <span className="tag">{kindLabel}</span>
        {item.storyKind === "current" && <span className="tag current">From the news, {item.source ? formatDate(item.source.publishedAt) : ""}</span>}
      </p>
      {item.sourceChanged && (
        <p className="notice warn" role="status">
          The source article has been edited since you saved this, so the facts may have changed. Consider dismissing this item, or check the{" "}
          <a href={item.source?.url} target="_blank" rel="noopener noreferrer">
            current source
          </a>
          .
        </p>
      )}
      <h3 id={`rv-${item.id}`}>{item.prompt}</h3>
      {!revealed ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setRevealed(true);
          }}
        >
          <label className="label" htmlFor={recallId}>
            Recall it first, in your own words (typing is optional)
          </label>
          <textarea id={recallId} rows={3} value={attempt} onChange={(e) => setAttempt(e.target.value)} />
          <button className="primary" type="submit">
            Reveal the answer
          </button>
        </form>
      ) : (
        <>
          <div className="callout">
            <h4>Saved answer</h4>
            <p>{item.answer}</p>
          </div>
          {applyTask && (
            <div className="stack">
              <label className="label" htmlFor={applyId}>
                Apply it somewhere new: {applyTask}
              </label>
              <textarea id={applyId} rows={3} value={apply} onChange={(e) => setApply(e.target.value)} />
              {item.kind === "skill" && item.skill && (
                <details>
                  <summary>Adapt this to a topic I care about</summary>
                  <div className="row">
                    <input aria-label="Topic" placeholder="e.g. my team's planning meeting" value={topic} maxLength={200} onChange={(e) => setTopic(e.target.value)} />
                    <button
                      type="button"
                      className="secondary"
                      disabled={adapting || topic.trim().length < 2}
                      onClick={async () => {
                        setAdapting(true);
                        try {
                          const exId = exerciseForSkill(item);
                          const r = await api.variation({ idempotencyKey: uid("v-"), exerciseId: exId, topic });
                          setApplyTask(r.prompt);
                        } catch {
                          /* keep the reviewed variation */
                        } finally {
                          setAdapting(false);
                        }
                      }}
                    >
                      {adapting ? "Adapting…" : "Adapt"}
                    </button>
                  </div>
                </details>
              )}
            </div>
          )}
          <p className="label">How did your recall compare? Your own words count.</p>
          <div className="row wrap">
            <button className="primary" type="button" onClick={() => onResult("recalled", joinResponse(attempt, apply))}>
              Got it
            </button>
            <button className="secondary" type="button" onClick={() => onResult("partly", joinResponse(attempt, apply))}>
              Partly
            </button>
            <button className="secondary" type="button" onClick={() => onResult("missed", joinResponse(attempt, apply))}>
              Missed it
            </button>
          </div>
        </>
      )}
      <div className="row wrap subtle-actions">
        <button className="link" type="button" onClick={() => onResult("skipped")}>
          Skip until tomorrow
        </button>
        <button className="link" type="button" onClick={onDismiss}>
          Stop reviewing this
        </button>
        <button
          className="link danger"
          type="button"
          onClick={() => {
            if (window.confirm("Delete this review item permanently?")) onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </section>
  );
}

function joinResponse(recall: string, apply: string): string | undefined {
  const parts = [recall.trim() && `Recall: ${recall.trim()}`, apply.trim() && `Applied: ${apply.trim()}`].filter(Boolean);
  return parts.length ? parts.join("\n") : undefined;
}

function exerciseForSkill(item: ReviewItem): string {
  const map = { "main-point": "mp-explain-story", organize: "org-two-reasons", example: "ex-concrete-case", conclusion: "con-takeaway" } as const;
  return getExercise(item.exerciseId ?? map[item.skill ?? "main-point"]).id;
}
