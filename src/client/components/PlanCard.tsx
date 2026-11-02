import { useState } from "react";
import { PLAN, PLAN_WEEKS, currentWeek, pendingLookback, weekSummary, weekTasks, weekWasEmpty, type PlanTask } from "../../shared/plan";
import { useApp } from "../lib/store";
import { href, type Route } from "../lib/router";

/** The guided 4-week plan (on Progress). */
export function PlanCard({ learnStoryId }: { learnStoryId?: string }) {
  const { data, update } = useApp();
  const now = new Date().toISOString();

  if (!data.plan) {
    return (
      <button type="button" className="pill-link as-button subtle" onClick={() => update((d) => ({ ...d, plan: { startedAt: new Date().toISOString(), reflections: [] } }))}>
        <span>
          <strong>Start a 4-week plan</strong> — one skill a week, a few short sessions
        </span>
        <span aria-hidden="true">→</span>
      </button>
    );
  }

  const week = currentWeek(data.plan, now);
  const lookback = pendingLookback(data, now);
  const restart = () => update((d) => ({ ...d, plan: { startedAt: new Date().toISOString(), reflections: [] } }));
  const end = () => update((d) => ({ ...d, plan: undefined }));

  if (week > PLAN_WEEKS) {
    const totals = PLAN.map((w) => weekSummary(data, w.week)!);
    const sum = (k: keyof (typeof totals)[number]) => totals.reduce((n, t) => n + t[k], 0);
    return (
      <article className="plan">
        <p className="eyebrow">Your plan</p>
        <h3>Four weeks done</h3>
        <p>
          {sum("learnSessions") + sum("talkSessions")} practice sessions · {sum("braveSteps")} brave steps · {sum("fearsNotHappened")} fears that didn't happen.
        </p>
        {!data.plan.reflections.some((r) => r.week === 4) && <Lookback week={4} />}
        <p className="hint">A second round uses the next level of each skill where you've met the goal.</p>
        <div className="row wrap">
          <button className="secondary" type="button" onClick={restart}>
            Start round two
          </button>
          <button className="link" type="button" onClick={end}>
            Close
          </button>
        </div>
      </article>
    );
  }

  const spec = PLAN[week - 1]!;
  const tasks = weekTasks(data, week);
  const doneCount = tasks.filter((t) => t.done).length;
  const target = (t: PlanTask): Route | null => {
    switch (t.id) {
      case "learn":
        return learnStoryId ? { name: "learn", storyId: learnStoryId } : { name: "today" };
      case "talk":
        return { name: "talk", scenario: spec.talkScenario };
      case "brave":
        return { name: "steps" };
      case "extra":
        return spec.extra === "review" ? { name: "review" } : spec.extra === "lookback" ? null : { name: "steps" };
    }
  };

  return (
    <article className="plan" aria-labelledby="plan-h">
      <p className="eyebrow">
        Your plan · Week {week} of {PLAN_WEEKS}
      </p>
      <h3 id="plan-h">{spec.theme}</h3>
      <div className="progress" role="progressbar" aria-label="This week's plan" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={doneCount}>
        <div className="progress-fill" style={{ width: `${(doneCount / tasks.length) * 100}%` }} />
      </div>
      <ul className="tasks">
        {tasks.map((t) => {
          const r = target(t);
          return (
            <li key={t.id} className={t.done ? "task-item done" : "task-item"}>
              <span className="tick" aria-hidden="true">
                {t.done ? "✓" : ""}
              </span>
              {t.done || !r ? (
                <span>
                  {t.label}
                  <span className="sr-only">{t.done ? " (done)" : ""}</span>
                </span>
              ) : (
                <a href={href(r)}>{t.label}</a>
              )}
            </li>
          );
        })}
      </ul>
      {week === PLAN_WEEKS && !data.plan.reflections.some((r) => r.week === 4) && <Lookback key="lb-4" week={4} />}
      {lookback != null && lookback !== 4 && <Lookback key={`lb-${lookback}`} week={lookback} />}
      <button className="link small" type="button" onClick={end}>
        End plan
      </button>
    </article>
  );
}

function Lookback({ week }: { week: number }) {
  const { data, update } = useApp();
  const [open, setOpen] = useState(false);
  const [well, setWell] = useState("");
  const [inWay, setInWay] = useState("");
  const [next, setNext] = useState("");
  const s = weekSummary(data, week);
  if (!s) return null;
  const empty = weekWasEmpty(data, week);
  const skipWeek = () =>
    update((d) => (d.plan ? { ...d, plan: { ...d.plan, reflections: [...d.plan.reflections, { week, at: new Date().toISOString(), text: "(no practice this week)" }] } } : d));
  const restartWeek = () =>
    update((d) => (d.plan ? { ...d, plan: { ...d.plan, startedAt: new Date(new Date(d.plan.startedAt).getTime() + 7 * 86_400_000).toISOString() } } : d));
  if (empty && !open) {
    return (
      <div className="lookback">
        <p className="hint">Nothing logged in week {week}. That's okay — life happens. Carry on, or give that week another go.</p>
        <div className="row wrap">
          <button className="secondary small" type="button" onClick={restartWeek}>
            Redo week {week}
          </button>
          <button className="link small" type="button" onClick={skipWeek}>
            Carry on
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="lookback">
      {!open ? (
        <button className="secondary" type="button" onClick={() => setOpen(true)}>
          Look back on week {week}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const text = [well.trim() && `Went well: ${well.trim()}`, inWay.trim() && `Got in the way: ${inWay.trim()}`, next.trim() && `Next week: ${next.trim()}`]
              .filter(Boolean)
              .join("\n")
              .slice(0, 900);
            update((d) => (d.plan ? { ...d, plan: { ...d.plan, reflections: [...d.plan.reflections, { week, at: new Date().toISOString(), text }] } } : d));
          }}
        >
          <p className="eyebrow">Week {week} look-back</p>
          <p>
            {s.learnSessions + s.talkSessions} sessions ({s.spokenSessions} spoken) · {s.braveSteps} brave step{s.braveSteps === 1 ? "" : "s"}
            {s.braveSteps ? ` · ${s.fearsNotHappened} fear${s.fearsNotHappened === 1 ? "" : "s"} didn't happen` : ""} · {s.reviewsDone} review{s.reviewsDone === 1 ? "" : "s"}
          </p>
          <label className="label" htmlFor={`lb-well-${week}`}>
            One thing that went well
          </label>
          <textarea id={`lb-well-${week}`} rows={2} maxLength={300} value={well} onChange={(e) => setWell(e.target.value)} />
          <label className="label" htmlFor={`lb-way-${week}`}>
            One thing that got in the way
          </label>
          <textarea id={`lb-way-${week}`} rows={2} maxLength={300} value={inWay} onChange={(e) => setInWay(e.target.value)} />
          <label className="label" htmlFor={`lb-next-${week}`}>
            One small thing to try next week
          </label>
          <textarea id={`lb-next-${week}`} rows={2} maxLength={300} value={next} onChange={(e) => setNext(e.target.value)} />
          <button className="primary" type="submit">
            Save look-back
          </button>
        </form>
      )}
    </div>
  );
}
