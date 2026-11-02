import { CAMERA_PRINCIPLES, CAMERA_SETUP, cameraProgress, nextCameraDrill } from "../../shared/camera";
import { formatSeconds } from "../../shared/observations";
import { useApp } from "../lib/store";
import { href } from "../lib/router";
import { formatDate } from "../components/common";

/** The talk-to-camera ladder: eleven short drills from "press record" to a two-minute unscripted take. */
export function Camera() {
  const { data } = useApp();
  const progress = cameraProgress(data.sessions);
  const next = nextCameraDrill(data.sessions);
  const done = progress.filter((p) => p.completed > 0).length;
  const takes = data.sessions.filter((s) => s.mode === "camera" && s.completedAt).length;
  const comforts = data.sessions.filter((s) => s.mode === "camera" && s.completedAt && s.camera?.comfortBefore != null && s.camera.comfortAfter != null);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">Camera</h2>
      <p className="hint">
        {takes === 0
          ? "Get comfortable talking to a camera: eleven short drills, one take at a time."
          : `${takes} take${takes === 1 ? "" : "s"} done · ${done} of ${progress.length} drills tried${comforts.length >= 3 ? ` · comfort ${avg(comforts.map((s) => s.camera!.comfortBefore!))} → ${avg(comforts.map((s) => s.camera!.comfortAfter!))} on average` : ""}`}
      </p>

      <article className="featured">
        <p className="eyebrow">
          Next up · drill {next.level} of {progress.length} · about {formatSeconds(next.seconds)}
        </p>
        <h3>{next.title}</h3>
        <p>{next.why}</p>
        <a className="button primary" href={href({ name: "camera", drillId: next.id })}>
          Start<span className="sr-only">: {next.title}</span>
        </a>
      </article>

      <section aria-labelledby="ladder-h">
        <h3 id="ladder-h" className="section-title">
          All drills
        </h3>
        <ol className="ladder">
          {progress.map(({ drill, completed, lastAt }) => (
            <li key={drill.id} className={completed > 0 ? "ladder-item done" : "ladder-item"}>
              <a href={href({ name: "camera", drillId: drill.id })}>
                <span className="ladder-level" aria-hidden="true">
                  {drill.level}
                </span>
                <span className="ladder-body">
                  <span className="row-title">{drill.title}</span>
                  <span className="row-desc">
                    {formatSeconds(drill.seconds)}
                    {completed > 0 ? ` · done ${completed}×${lastAt ? `, last ${formatDate(lastAt)}` : ""}` : ""}
                  </span>
                </span>
                <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <details className="more">
        <summary>Before you record: five checks</summary>
        <ul className="plain checks">
          {CAMERA_SETUP.map((c) => (
            <li key={c.id}>
              <strong>{c.text}.</strong> {c.why}
            </li>
          ))}
        </ul>
      </details>
      <details className="more">
        <summary>What makes talking to camera work</summary>
        <ul className="plain checks">
          {CAMERA_PRINCIPLES.map((p) => (
            <li key={p.title}>
              <strong>{p.title}.</strong> {p.text}
            </li>
          ))}
        </ul>
        <p className="hint">Drawn from YouTube's creator guidance on the first 15 seconds, talking-head framing and lighting guides, food and travel narration guides, and on-camera confidence practice. Sources in the project plan.</p>
      </details>
    </main>
  );
}

function avg(xs: number[]): string {
  return (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
}
