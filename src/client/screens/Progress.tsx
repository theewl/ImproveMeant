import { useEffect, useState } from "react";
import type { Attempt, PracticeSession } from "../../shared/types";
import { SCENARIOS, SKILLS } from "../../shared/curriculum";
import { audioStore } from "../lib/audioStore";
import { upsertSession } from "../lib/state";
import { compareSafetyBehaviours, summarizeExperiments } from "../../shared/confidence";
import { phraseBank } from "./Phrases";
import { href } from "../lib/router";
import { localDayKey } from "../../shared/dates";
import { useApp } from "../lib/store";
import { AttemptTags } from "../components/Feedback";
import { formatDate } from "../components/common";
import { CAMERA_DRILLS, improvementSince, takeStats } from "../../shared/camera";
import { allSteps, stepRecord } from "../../shared/steps";
import { takesThisWeek } from "../../shared/vlog";
import { PlanCard } from "../components/PlanCard";

function getCameraDrillTitle(id?: string): string {
  return CAMERA_DRILLS.find((d) => d.id === id)?.title ?? "drill";
}

/** Four things: this week, change since the first take, a few counts, and the past. Everything else is folded away. */
export function Progress() {
  const { data } = useApp();
  const nowIso = new Date().toISOString();
  const takes = data.sessions.filter((s) => s.mode === "camera" && s.completedAt && s.camera?.promptId).sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  const target = data.prefs.weeklyTakes ?? 5;
  const week = takesThisWeek(takes.map((s) => s.completedAt!), nowIso);
  const spoken = (s: PracticeSession) => [...s.attempts].reverse().find((a) => a.text.trim());
  const first = takes.map(spoken).find(Boolean);
  const latest = [...takes].reverse().map(spoken).find(Boolean);
  const change = first && latest && first.id !== latest.id ? improvementSince(takeStats(first.text, first.durationSeconds), takeStats(latest.text, latest.durationSeconds)) : [];
  const steps = allSteps(data);
  const stepsTried = steps.filter((st) => stepRecord(st, data).count > 0).length;
  const fears = summarizeExperiments(data.experiments);
  const checkins = data.experiments.filter((e) => e.completedAt && e.anxietyAfter != null);
  const cmp = compareSafetyBehaviours(data.experiments);
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  const sessions = [...data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const due = data.reviews.filter((r) => r.status === "active").length;
  const phrases = phraseBank(data.sessions).length;

  return (
    <main className="screen" id="main">
      <h2 className="page-title">Progress</h2>
      <p className="week" aria-label={`${week} of ${target} takes this week`}>
        <span className="week-dots" aria-hidden="true">
          {Array.from({ length: target }, (_, i) => (
            <span key={i} className={i < week ? "dot on" : "dot"} />
          ))}
        </span>
        {week} of {target} takes this week
      </p>
      <ActivityDots />

      <section aria-labelledby="since-h" className="since">
        <p className="eyebrow" id="since-h">
          Since your first take
        </p>
        {change.length > 0 ? (
          <ul className="plain">
            {change.map((i) => (
              <li key={i.label} className={i.better === true ? "since-better" : i.better === false ? "since-worse" : ""}>
                {i.label}: {i.before} → {i.after}
                {i.better === true ? " ✓" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">{takes.length < 2 ? "Record two takes to see what's changing." : "Nothing has moved yet. Keep going."}</p>
        )}
      </section>

      <dl className="stats">
        <div>
          <dt>Takes</dt>
          <dd>{takes.length}</dd>
        </div>
        <div>
          <dt>Steps tried</dt>
          <dd>
            {stepsTried} of {steps.length}
          </dd>
        </div>
        {fears.tested > 0 && (
          <div>
            <dt>Fears that didn't happen</dt>
            <dd>
              {fears.fearNotHappened} of {fears.tested}
            </dd>
          </div>
        )}
        {cmp && (
          <div>
            <dt>Anxiety without a safety habit vs with</dt>
            <dd>
              {cmp.dropped.avgAnxiety} vs {cmp.kept.avgAnxiety}
            </dd>
          </div>
        )}
        {checkins.length >= 2 && (
          <div>
            <dt>Anxiety, before → during</dt>
            <dd>
              {avg(checkins.map((e) => e.anxietyBefore))} → {avg(checkins.map((e) => e.anxietyAfter!))}
            </dd>
          </div>
        )}
      </dl>

      <ul className="quick">
        {due > 0 && (
          <li>
            <a className="pill-link" href={href({ name: "review" })}>
              <span>
                <strong>Reviews</strong> · {due} saved
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        )}
        {phrases > 0 && (
          <li>
            <a className="pill-link" href={href({ name: "phrases" })}>
              <span>
                <strong>Phrase bank</strong> · {phrases} phrase{phrases === 1 ? "" : "s"}
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        )}
      </ul>

      {sessions.length > 0 && (
        <details className="more">
          <summary>Past takes and sessions</summary>
          {sessions.slice(0, 20).map((s) => (
            <SessionEntry key={s.id} s={s} />
          ))}
        </details>
      )}
      <details className="more">
        <summary>4-week plan</summary>
        <PlanCard />
      </details>
    </main>
  );
}

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
      <p className="hint">{active} of the last 28 days</p>
    </section>
  );
}

function SessionEntry({ s }: { s: PracticeSession }) {
  const scenarioTitle = s.talk ? (SCENARIOS.find((x) => x.id === s.talk?.scenarioId)?.title ?? "rehearsal") : "rehearsal";
  const title =
    s.mode === "learn"
      ? `Learn & Explain: ${s.storyTitle ?? "story"}`
      : s.mode === "camera"
        ? `Camera: ${getCameraDrillTitle(s.camera?.drillId)}${s.camera?.topic ? ` — ${s.camera.topic}` : ""}`
        : `Talk: ${scenarioTitle}${s.talk?.topic ? ` — ${s.talk.topic}` : ""}`;
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

