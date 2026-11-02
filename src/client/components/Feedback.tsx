import type { Attempt, Feedback } from "../../shared/types";
import { measureAttempt } from "../../shared/observations";

const FIDELITY_LABEL = {
  accurate: "Matches the briefing",
  minor_gaps: "Mostly matches the briefing, with small gaps",
  factual_error: "Differs from the briefing",
  not_applicable: "",
} as const;

export function AttemptTags({ a }: { a: Attempt }) {
  return (
    <p className="tags">
      <span className="tag">{a.modality === "spoken" ? "Spoken" : "Typed"}</span>
      {a.isRetry && <span className="tag">Retry</span>}
      {a.assisted && <span className="tag warn">Assisted — briefing reopened</span>}
      {a.transcriptEdited && <span className="tag">{a.transcriptSource === "typed-by-user" ? "Transcript typed by you" : "Transcript edited"}</span>}
    </p>
  );
}

export function FeedbackPanel({ feedback: f, attempt }: { feedback: Feedback; attempt: Attempt }) {
  const measured = measureAttempt(attempt);
  return (
    <section className="card feedback" aria-labelledby={`fb-${attempt.id}`}>
      <h3 id={`fb-${attempt.id}`}>{f.kind === "live" ? "Coach feedback" : "Example feedback"}</h3>
      {f.kind === "illustrative" ? (
        <p className="notice demo">
          <strong>Demo mode:</strong> this is an illustrative example of the kind of feedback this exercise gives. It did <em>not</em> evaluate your answer. Compare your answer with
          the goal below yourself.
        </p>
      ) : (
        <p className="hint">AI feedback{f.model ? ` (${f.model})` : ""} on your text only — it can't hear tone, pace or delivery. It can be wrong; you decide what to use.</p>
      )}
      <AttemptTags a={attempt} />

      {f.kind === "live" && f.goalMet === true && !f.offTopic && <p className="goal met">You met this goal.</p>}
      {f.kind === "live" && f.goalMet === false && !f.offTopic && <p className="goal notyet">Not quite yet — one change below.</p>}
      {f.offTopic && <p className="goal notyet">This didn't look like an answer to the task yet.</p>}

      {f.strength && (
        <div className="fb-item">
          <h4>What worked</h4>
          <p>{f.strength.observation}</p>
          {f.strength.quote && <blockquote>“{f.strength.quote}”</blockquote>}
        </div>
      )}
      {f.priority && (
        <div className="fb-item">
          <h4>Try this next</h4>
          <p>{f.priority.observation}</p>
          {f.priority.quote && <blockquote>“{f.priority.quote}”</blockquote>}
          <p className="suggestion">{f.priority.suggestion}</p>
        </div>
      )}
      <div className="fb-item">
        <h4>{f.kind === "live" ? "Why it matters" : "Example"}</h4>
        <p>{f.explanation}</p>
      </div>
      {f.fidelity.status !== "not_applicable" && (
        <div className="fb-item">
          <h4>Accuracy vs. the source</h4>
          <p>
            {FIDELITY_LABEL[f.fidelity.status]}
            {f.fidelity.note ? `: ${f.fidelity.note}` : "."}
          </p>
        </div>
      )}
      {f.opinionNote && (
        <div className="fb-item">
          <h4>Your view</h4>
          <p>{f.opinionNote}</p>
        </div>
      )}
      {f.followUpNote && (
        <div className="fb-item">
          <h4>Your answer to the question</h4>
          <p>{f.followUpNote}</p>
        </div>
      )}
      {f.retryFocus && (
        <div className="fb-item">
          <h4>{f.kind === "live" ? "If you retry" : "The goal"}</h4>
          <p>{f.kind === "live" ? f.retryFocus : f.retryFocus.replace(/^Check your own response against the goal: /, "")}</p>
        </div>
      )}
      {f.unverifiedQuotesRemoved > 0 && <p className="hint">{f.unverifiedQuotesRemoved} quote(s) the coach attributed to you couldn't be found in your answer and were removed.</p>}

      <details className="measured">
        <summary>What was measured</summary>
        <dl>
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
        {attempt.delivery?.limitations && <p className="hint">{attempt.delivery.limitations}</p>}
      </details>
    </section>
  );
}

export function CompareAttempts({ first, second }: { first: Attempt; second: Attempt }) {
  const m1 = measureAttempt(first);
  const m2 = measureAttempt(second);
  const labels = Array.from(new Set([...m1, ...m2].map((m) => m.label)));
  return (
    <section className="card" aria-labelledby="compare-h">
      <h3 id="compare-h">Compare attempts</h3>
      <p className="hint">Improving on a retry of the same prompt is a good sign, but it isn't the same as mastering the skill. Reviews later test it in a new context.</p>
      <div className="compare">
        {[first, second].map((a, i) => (
          <div key={a.id} className="compare-col">
            <h4>{i === 0 ? "First attempt" : "Retry"}</h4>
            <AttemptTags a={a} />
            <p className="attempt-text">{a.text}</p>
            {a.feedback?.kind === "live" && (
              <p className="hint">
                {a.feedback.goalMet ? "Goal met." : "Goal not yet met."} {a.feedback.priority ? `Focus: ${a.feedback.priority.observation}` : ""}
              </p>
            )}
          </div>
        ))}
      </div>
      <table className="compare-table">
        <caption className="sr-only">Measured differences between attempts</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col">First</th>
            <th scope="col">Retry</th>
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
    </section>
  );
}
