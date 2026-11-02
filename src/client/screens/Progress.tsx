import { useEffect, useState } from "react";
import type { Attempt, PracticeSession } from "../../shared/types";
import { MISSIONS, SKILLS, SKILL_ORDER, getScenario } from "../../shared/curriculum";
import { audioStore } from "../lib/audioStore";
import { addRealWorld, summarize, upsertSession } from "../lib/state";
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
            <dt>Real-world attempts</dt>
            <dd>{sum.realWorld}</dd>
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
      </section>

      <section aria-labelledby="rev-h">
        <h3 id="rev-h">Reviews</h3>
        <p>
          Recalled {sum.reviewCounts.recalled} · Partly {sum.reviewCounts.partly} · Missed {sum.reviewCounts.missed} · Skipped {sum.reviewCounts.skipped}
        </p>
        <p className="hint">Self-assessed after revealing the answer.</p>
      </section>

      <Missions />

      <section aria-labelledby="hist-h">
        <h3 id="hist-h">History</h3>
        {sessions.length === 0 ? <p className="hint">Your sessions will appear here.</p> : sessions.map((s) => <SessionEntry key={s.id} s={s} />)}
      </section>
    </main>
  );
}

function SessionEntry({ s }: { s: PracticeSession }) {
  const title = s.mode === "learn" ? `Learn & Explain: ${s.storyTitle ?? "story"}` : `Talk: ${s.talk ? getScenario(s.talk.scenarioId).title : "rehearsal"}${s.talk?.topic ? ` — ${s.talk.topic}` : ""}`;
  return (
    <details className="card history">
      <summary>
        <span>{title}</span>
        <span className="hint block">
          {formatDate(s.startedAt)} · {SKILLS[s.skill].short} · {s.completedAt ? "completed" : "not finished"} · {s.usedLive ? "AI feedback" : "demo feedback"}
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

function Missions() {
  const { data, update } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [comfort, setComfort] = useState<number | undefined>();
  return (
    <section aria-labelledby="mis-h">
      <h3 id="mis-h">Try it for real (optional)</h3>
      <ul className="missions">
        {MISSIONS.map((m) => {
          const count = data.realWorld.filter((r) => r.missionId === m.id).length;
          return (
            <li key={m.id} className="card">
              <strong>{m.title}</strong>
              <p className="hint">{m.description}</p>
              {count > 0 && <p className="hint">Logged {count} time(s).</p>}
              {open === m.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    update((d) => addRealWorld(d, { at: new Date().toISOString(), missionId: m.id, note: note.slice(0, 1000), comfort }));
                    setOpen(null);
                    setNote("");
                    setComfort(undefined);
                  }}
                >
                  <label className="label" htmlFor={`note-${m.id}`}>
                    What happened? (optional)
                  </label>
                  <textarea id={`note-${m.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  <fieldset className="choices inline">
                    <legend className="label">How comfortable did you feel? (self-reported, optional)</legend>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="choice">
                        <input type="radio" name={`c-${m.id}`} checked={comfort === n} onChange={() => setComfort(n)} />
                        {n}
                      </label>
                    ))}
                  </fieldset>
                  <div className="row">
                    <button className="primary" type="submit">
                      Log it
                    </button>
                    <button className="link" type="button" onClick={() => setOpen(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button className="secondary" type="button" onClick={() => setOpen(m.id)}>
                  I did this
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {data.realWorld.some((r) => r.comfort) && (
        <p className="hint">
          Self-reported comfort (1–5), most recent first:{" "}
          {[...data.realWorld]
            .reverse()
            .filter((r) => r.comfort)
            .slice(0, 8)
            .map((r) => r.comfort)
            .join(", ")}
          . This is how you felt, kept separate from coaching observations.
        </p>
      )}
    </section>
  );
}
