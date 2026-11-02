import type { Attempt, Feedback } from "../../shared/types";
import { measureAttempt } from "../../shared/observations";
import { useApp } from "../lib/store";
import { href } from "../lib/router";

/** Only the flags that change how to read an attempt. Spoken/typed is implied elsewhere. */
export function AttemptTags({ a }: { a: Attempt }) {
  const flags: string[] = [];
  if (a.isRetry) flags.push("Retry");
  if (a.assisted) flags.push("Assisted — briefing reopened");
  if (a.transcriptEdited) flags.push(a.transcriptSource === "typed-by-user" ? "Transcript typed by you" : "Transcript edited");
  else if (a.transcriptSource === "browser-speech") flags.push("Browser transcript");
  if (flags.length === 0) return null;
  return (
    <p className="flags">
      {flags.map((f) => (
        <span key={f} className="flag">
          {f}
        </span>
      ))}
    </p>
  );
}

export function FeedbackPanel({
  feedback: f,
  attempt,
  onRate,
}: {
  feedback: Feedback;
  attempt: Attempt;
  onRate?: (r: "useful" | "not-useful", reason?: Attempt["feedbackRatingReason"]) => void;
}) {
  const { data } = useApp();
  const quiet = !!data.prefs.quietMode;
  const measured = measureAttempt(attempt);
  const accuracyIssue = f.fidelity.status === "minor_gaps" || f.fidelity.status === "factual_error";
  const live = f.kind === "live";

  return (
    <section className="feedback" aria-label="Feedback">
      {!live && (
        <p className="demo-note">
          <strong>Example feedback</strong> — demo mode didn't read your answer. Check it against the goal below.
        </p>
      )}

      {live && !f.offTopic && f.goalMet === true && <p className="verdict met">✓ You met this goal</p>}
      {live && !f.offTopic && f.goalMet === false && <p className="verdict notyet">Almost — one thing to try</p>}
      {f.offTopic && <p className="verdict notyet">That didn't answer the task yet</p>}

      {f.strength && (
        <div className="fb-block">
          <h3>What worked</h3>
          <p>{f.strength.observation}</p>
          {f.strength.quote && <blockquote>“{f.strength.quote}”</blockquote>}
        </div>
      )}

      {f.priority && (
        <div className="fb-block try">
          <h3>Try this next</h3>
          <p>{f.priority.observation}</p>
          {f.priority.quote && <blockquote>“{f.priority.quote}”</blockquote>}
          <p className="suggestion">{f.priority.suggestion}</p>
          {live && (
            <a className="link inline" href={href({ name: "confidence" })}>
              Try this in a real conversation → plan a brave step
            </a>
          )}
        </div>
      )}

      {!live && (
        <div className="fb-block">
          <h3>Example</h3>
          <p>{f.explanation}</p>
          {f.retryFocus && <p className="goal-line">Goal: {f.retryFocus.replace(/^Check your own response against the goal: /, "")}</p>}
        </div>
      )}

      {accuracyIssue && (
        <div className="fb-block">
          <h3>Accuracy</h3>
          <p>
            {f.fidelity.status === "factual_error" ? "Differs from the briefing" : "Mostly matches the briefing"}
            {f.fidelity.note ? `: ${f.fidelity.note}` : "."}
          </p>
        </div>
      )}
      {f.opinionNote && (
        <div className="fb-block">
          <h3>Your view</h3>
          <p>{f.opinionNote}</p>
        </div>
      )}
      {f.followUpNote && (
        <div className="fb-block">
          <h3>Your answer to the question</h3>
          <p>{f.followUpNote}</p>
        </div>
      )}

      <AttemptTags a={attempt} />

      {live && onRate && (
        <div className="rate" role="group" aria-label="Was this feedback useful?">
          <span className="hint">Was this useful?</span>
          <button type="button" className={attempt.feedbackRating === "useful" ? "chip on" : "chip"} aria-pressed={attempt.feedbackRating === "useful"} onClick={() => onRate("useful")}>
            Yes
          </button>
          <button type="button" className={attempt.feedbackRating === "not-useful" ? "chip on" : "chip"} aria-pressed={attempt.feedbackRating === "not-useful"} onClick={() => onRate("not-useful")}>
            Not really
          </button>
        </div>
      )}
      {live && onRate && attempt.feedbackRating === "not-useful" && (
        <div className="rate" role="group" aria-label="What was wrong with it?">
          <span className="hint">Why?</span>
          {(
            [
              ["not-specific", "Too generic"],
              ["missed-point", "Missed my point"],
              ["too-harsh", "Too harsh"],
              ["wrong", "Wrong"],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" className={attempt.feedbackRatingReason === v ? "chip on" : "chip"} aria-pressed={attempt.feedbackRatingReason === v} onClick={() => onRate("not-useful", v)}>
              {l}
            </button>
          ))}
        </div>
      )}

      <details className="more">
        <summary>More detail</summary>
        {live && (
          <>
            <p>{f.explanation}</p>
            {f.retryFocus && <p className="goal-line">For a retry: {f.retryFocus}</p>}
            {f.fidelity.status === "accurate" && <p className="hint">Accuracy: matches the briefing.</p>}
          </>
        )}
        {quiet && <p className="hint">Quiet mode is on, so measurements are hidden.</p>}
        <dl className="measured" hidden={quiet}>
          {measured.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>
                {m.value}
                <span className="basis">{m.basis}</span>
              </dd>
            </div>
          ))}
        </dl>
        {!quiet && attempt.delivery?.limitations && <p className="hint">{attempt.delivery.limitations}</p>}
        {f.unverifiedQuotesRemoved > 0 && <p className="hint">{f.unverifiedQuotesRemoved} quote(s) the coach attributed to you weren't in your answer and were removed.</p>}
        {live && <p className="hint">AI feedback{f.model ? ` (${f.model})` : ""} on your words only — it can't hear tone or pace, and it can be wrong.</p>}
      </details>
    </section>
  );
}

export function CompareAttempts({ first, second }: { first: Attempt; second: Attempt }) {
  const { data } = useApp();
  const m1 = measureAttempt(first);
  const m2 = measureAttempt(second);
  const labels = Array.from(new Set([...m1, ...m2].map((m) => m.label)));
  return (
    <section className="compare-wrap" aria-labelledby="compare-h">
      <h3 id="compare-h">Compare attempts</h3>
      <div className="compare">
        {[first, second].map((a, i) => (
          <div key={a.id} className="compare-col">
            <p className="eyebrow">{i === 0 ? "Before" : "After"}</p>
            <p className="attempt-text">{a.text}</p>
            {a.feedback?.kind === "live" && <p className="hint">{a.feedback.goalMet ? "Goal met" : "Goal not yet met"}</p>}
          </div>
        ))}
      </div>
      <details className="more" hidden={!!data.prefs.quietMode}>
        <summary>Measured differences</summary>
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {labels.map((l) => (
              <tr key={l}>
                <th scope="row">{l}</th>
                <td>{m1.find((m) => m.label === l)?.value ?? "—"}</td>
                <td>{m2.find((m) => m.label === l)?.value ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">Doing better on a retry of the same prompt is a good sign, not mastery. Reviews test it later in a new context.</p>
      </details>
    </section>
  );
}

/** End-of-session close: discourage replaying it afterwards and anchor on what went okay. */
export function WrapUp({ attempts }: { attempts: Attempt[] }) {
  const strength = [...attempts].reverse().find((a) => a.feedback?.kind === "live" && a.feedback.strength)?.feedback?.strength?.observation;
  return (
    <div className="wrapup">
      <p>
        <strong>That's done — no need to replay it.</strong> If your mind goes back to the awkward bits, come back to this instead:
      </p>
      <p className="wrapup-good">{strength ?? "You showed up and practiced out loud. That's the part that counts."}</p>
    </div>
  );
}
