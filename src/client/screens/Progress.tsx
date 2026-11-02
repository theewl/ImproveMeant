import { useEffect, useState } from "react";
import type { Attempt, PracticeSession } from "../../shared/types";
import { SCENARIOS, SKILLS, SKILL_ORDER } from "../../shared/curriculum";
import { audioStore } from "../lib/audioStore";
import { summarize, upsertSession } from "../lib/state";
import { summarizeExperiments } from "../../shared/confidence";
import { phraseBank } from "./Phrases";
import { href } from "../lib/router";
import { localDayKey } from "../../shared/dates";
import { useApp } from "../lib/store";
import { AttemptTags } from "../components/Feedback";
import { formatDate } from "../components/common";

export function Progress() {
  const { data } = useApp();
  const sum = summarize(data);
  const sessions = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <main className="screen" id="main">
      <h2>Progress</h2>
      <ActivityDots />

      <section aria-labelledby="counts-h">
        <h3 id="counts-h">Practice</h3>
        <dl className="stats">
          <div>
            <dt>Spoken sessions</dt>
            <dd>{sum.spokenSessions}</dd>
          </div>
          <div>
            <dt>Written sessions</dt>
            <dd>{sum.writtenSessions}</dd>
          </div>
          <div>
            <dt>Retries</dt>
            <dd>{sum.retries}</dd>
          </div>
          <div>
            <dt>Brave steps taken</dt>
            <dd>{summarizeExperiments(data.experiments.filter((e) => e.kind === "real-world")).completed}</dd>
          </div>
        </dl>
        {sum.unfinished > 0 && <p className="hint">{sum.unfinished} unfinished session(s) aren't counted.</p>}
      </section>

      <section aria-labelledby="skills-h">
        <h3 id="skills-h">Skills practiced</h3>
        <table className="skills-table">
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Sessions</th>
              <th scope="col">Goal met (AI-coached attempts)</th>
            </tr>
          </thead>
          <tbody>
            {SKILL_ORDER.map((k) => (
              <tr key={k}>
                <th scope="row">{SKILLS[k].name}</th>
                <td>{sum.skills[k].sessions}</td>
                <td>{sum.skills[k].liveFeedbackCount ? `${sum.skills[k].goalMetLive} of ${sum.skills[k].liveFeedbackCount}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">“Goal met” counts AI judgements on individual attempts, including retries of the same prompt. It isn't a measure of mastery.</p>
        {sum.feedbackRated > 0 && (
          <p>
            You rated {sum.feedbackUseful} of {sum.feedbackRated} pieces of feedback useful.
          </p>
        )}
      </section>

      <section aria-labelledby="rev-h">
        <h3 id="rev-h">Reviews</h3>
        <p>
          Recalled {sum.reviewCounts.recalled} · Partly {sum.reviewCounts.partly} · Missed {sum.reviewCounts.missed} · Skipped {sum.reviewCounts.skipped}
        </p>
        <p className="hint">Self-assessed after revealing the answer.</p>
      </section>

      <a className="pill-link" href={href({ name: "review" })}>
        <span>
          <strong>Your reviews</strong> · {data.reviews.filter((r) => r.status === "active").length} saved
        </span>
        <span aria-hidden="true">→</span>
      </a>
      <a className="pill-link" href={href({ name: "phrases" })}>
        <span>
          <strong>Phrase bank</strong> · {phraseBank(data.sessions).length} phrase{phraseBank(data.sessions).length === 1 ? "" : "s"}
        </span>
        <span aria-hidden="true">→</span>
      </a>

      <ConfidenceSummary />

      <section aria-labelledby="real-h">
        <h3 id="real-h">Try it for real</h3>
        <p className="hint">The point of practice is the next real conversation. Plan one small brave step, predict what you fear, and see what happens.</p>
        <a className="button secondary" href={href({ name: "confidence" })}>
          Plan a brave step
        </a>
      </section>

      <section aria-labelledby="hist-h">
        <h3 id="hist-h">History</h3>
        {sessions.length === 0 ? <p className="hint">Your sessions will appear here.</p> : sessions.map((s) => <SessionEntry key={s.id} s={s} />)}
      </section>
    </main>
  );
}

/** Last four weeks as dots: a day is filled if anything was practiced. No streaks, no counts of misses. */
function ActivityDots() {
  const { data } = useApp();
  const days = new Set<string>();
  for (const s of data.sessions) if (s.completedAt) days.add(localDayKey(s.completedAt));
  for (const e of data.experiments) if (e.completedAt) days.add(localDayKey(e.completedAt));
  for (const r of data.reviews) for (const h of r.history) if (h.result !== "skipped") days.add(localDayKey(h.at));
  for (const r of data.reframes) days.add(localDayKey(r.at));
  const today = new Date();
  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (27 - i));
    return { key: localDayKey(d), on: days.has(localDayKey(d)), label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) };
  });
  const active = cells.filter((c) => c.on).length;
  return (
    <section aria-labelledby="dots-h" className="dots-section">
      <h3 id="dots-h" className="sr-only">
        Last four weeks
      </h3>
      <ul className="dots" aria-label={`Days with practice in the last four weeks: ${active} of 28`}>
        {cells.map((c) => (
          <li key={c.key} className={c.on ? "dot-day on" : "dot-day"} title={c.label}>
            <span className="sr-only">
              {c.label}: {c.on ? "practiced" : "no practice"}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint">
        {active} day{active === 1 ? "" : "s"} with practice in the last four weeks. Gaps are normal; what matters is coming back.
      </p>
    </section>
  );
}

function ConfidenceSummary() {
  const { data } = useApp();
  const c = summarizeExperiments(data.experiments);
  const views = data.sessions.flatMap((s) => s.attempts.map((a) => a.selfView).filter((v): v is NonNullable<typeof v> => !!v));
  const better = views.filter((v) => v.observed > v.predicted).length;
  if (c.completed === 0 && data.reframes.length === 0 && views.length === 0) return null;
  return (
    <section aria-labelledby="conf-h">
      <h3 id="conf-h">Confidence</h3>
      <dl className="stats">
        <div>
          <dt>Brave steps done</dt>
          <dd>{c.completed}</dd>
        </div>
        <div>
          <dt>Fears that didn't happen</dt>
          <dd>
            {c.fearNotHappened}
            {c.completed ? <span className="of"> of {c.completed}</span> : null}
          </dd>
        </div>
        <div>
          <dt>Thoughts untangled</dt>
          <dd>{data.reframes.length}</dd>
        </div>
        {c.avgBefore != null && c.avgAfter != null && (
          <div>
            <dt>Anxiety before → during</dt>
            <dd className="small-dd">
              {c.avgBefore} → {c.avgAfter}
            </dd>
          </div>
        )}
      </dl>
      {views.length > 0 && (
        <p>
          Listened back as an observer {views.length} time{views.length === 1 ? "" : "s"} — came across better than expected in {better}.
        </p>
      )}
      <p className="hint">Self-reported ratings, kept separate from coaching feedback. Averages across different situations, so treat them as a rough guide.</p>
    </section>
  );
}

function SessionEntry({ s }: { s: PracticeSession }) {
  const scenarioTitle = s.talk ? (SCENARIOS.find((x) => x.id === s.talk?.scenarioId)?.title ?? "rehearsal") : "rehearsal";
  const title = s.mode === "learn" ? `Learn & Explain: ${s.storyTitle ?? "story"}` : `Talk: ${scenarioTitle}${s.talk?.topic ? ` — ${s.talk.topic}` : ""}`;
  return (
    <details className="card history">
      <summary>
        <span>{title}</span>
        <span className="hint block">
          {formatDate(s.startedAt)} · {SKILLS[s.skill]?.short ?? s.skill} · {s.completedAt ? "completed" : "not finished"} · {s.usedLive ? "AI feedback" : "demo feedback"}
        </span>
      </summary>
      {s.attempts.map((a) => (
        <AttemptEntry key={a.id} a={a} session={s} />
      ))}
    </details>
  );
}

function AttemptEntry({ a, session }: { a: Attempt; session: PracticeSession }) {
  const { update } = useApp();
  const [url, setUrl] = useState<string | null>(null);
  const followUp = session.followUps.find((f) => f.answer?.id === a.id);
  useEffect(() => {
    let u: string | null = null;
    if (a.savedAudioKey) {
      audioStore
        .get(a.savedAudioKey)
        .then((b) => {
          if (b) {
            u = URL.createObjectURL(b);
            setUrl(u);
          }
        })
        .catch(() => undefined);
    }
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [a.savedAudioKey]);

  return (
    <div className="attempt">
      {followUp && <p className="hint">Answer to: “{followUp.question.question}”</p>}
      <AttemptTags a={a} />
      <p className="attempt-text">{a.text}</p>
      {a.originalTranscript && (
        <details>
          <summary>Original transcript (before your edits)</summary>
          <p className="attempt-text">{a.originalTranscript}</p>
        </details>
      )}
      {a.feedback && (
        <p className="hint">
          {a.feedback.kind === "illustrative" ? "Illustrative demo feedback (did not evaluate this answer)." : a.feedback.goalMet ? "Coach: goal met." : "Coach: goal not yet met."}
          {a.feedback.priority ? ` Focus: ${a.feedback.priority.observation}` : ""}
        </p>
      )}
      {url && (
        <div className="row">
          <audio controls src={url} aria-label="Saved recording" />
          <button
            className="link danger"
            type="button"
            onClick={async () => {
              if (!a.savedAudioKey) return;
              await audioStore.remove(a.savedAudioKey).catch(() => undefined);
              setUrl(null);
              update((d) =>
                upsertSession(d, { ...session, attempts: session.attempts.map((x) => (x.id === a.id ? { ...x, savedAudioKey: undefined } : x)) }),
              );
            }}
          >
            Delete recording
          </button>
        </div>
      )}
    </div>
  );
}
