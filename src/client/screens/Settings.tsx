import { useState } from "react";
import { useApp } from "../lib/store";
import { exportJson } from "../lib/storage";
import { localDayKey } from "../../shared/dates";
import { PreferencesForm } from "./Onboarding";
import { CrisisList } from "./Confidence";

export function Settings() {
  const { data, update, deleteAll, status, refreshStatus } = useApp();
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState(data.prefs.accessToken ?? "");
  const [deleted, setDeleted] = useState(false);

  return (
    <main className="screen" id="main">
      <h2>Settings</h2>

      <section aria-labelledby="pref-h">
        <h3 id="pref-h">Preferences</h3>
        <PreferencesForm submitLabel="Save preferences" onDone={() => setSaved(true)} />
        {saved && (
          <p className="notice ok" role="status">
            Saved.
          </p>
        )}
      </section>

      <section aria-labelledby="quiet-h">
        <h3 id="quiet-h">Quiet mode</h3>
        <label className="option">
          <input type="checkbox" checked={!!data.prefs.quietMode} onChange={(e) => update((d) => ({ ...d, prefs: { ...d.prefs, quietMode: e.target.checked } }))} />
          Hide the timer and measurement numbers while I practise
        </label>
        <p className="hint">Helpful if watching numbers makes you more self-conscious. Feedback on what you said still appears.</p>
      </section>

      <section aria-labelledby="mode-h">
        <h3 id="mode-h">How this app is running</h3>
        {status ? (
          <ul>
            <li>Coaching: {status.coaching === "claude" ? `Claude (${status.model})` : "Demo mode — illustrative feedback only"}</li>
            <li>Content: {status.content === "wikipedia+evergreen" ? "Wikipedia “In the news” + curated library" : "Curated library"}</li>
            <li>Transcription: {status.transcription === "deepgram" ? "Deepgram" : "Not configured — type what you said"}</li>
            {status.mode === "live" && (
              <li>
                AI usage today: {status.usageToday.requests} requests, about ${status.usageToday.estimatedCostUsd.toFixed(2)} (limit ${status.limits.dailyCostUsd.toFixed(2)}/day)
              </li>
            )}
          </ul>
        ) : (
          <p className="hint">Server status unavailable.</p>
        )}
        {status?.accessTokenRequired && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update((d) => ({ ...d, prefs: { ...d.prefs, accessToken: token.trim() || undefined } }));
              setTimeout(refreshStatus, 50);
            }}
          >
            <label className="label" htmlFor="token">
              Access token for this server
            </label>
            <input id="token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="secondary" type="submit">
              Save token
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="privacy-h">
        <h3 id="privacy-h">Your data</h3>
        <ul className="plain">
          <li>Preferences, answers, transcripts, feedback and review dates are stored only in this browser (local storage). They aren't synced or backed up.</li>
          <li>Confidence notes (brave steps, check-ins, thoughts) stay in this browser and are never sent to the AI service.</li>
          <li>Recordings are not saved unless you tick “Keep this recording”. Saved recordings stay in this browser.</li>
          <li>When AI coaching is on, your answer text (not audio) is sent to Anthropic's API to generate feedback.</li>
          <li>When transcription is on and you choose to transcribe, the audio is sent to Deepgram. The server asks Deepgram not to retain it.</li>
          <li>The app's server keeps usage counts and costs (no answer text) and shared story briefings (no personal data).</li>
        </ul>
        <label className="choice">
          <input type="checkbox" checked={data.transcriptionConsent} onChange={(e) => update((d) => ({ ...d, transcriptionConsent: e.target.checked }))} />
          I've read how transcription works (unticking shows the explanation again)
        </label>
        <details className="more">
          <summary>Get help now</summary>
          <p className="hint">This app isn't a crisis service. If you're struggling, please reach out:</p>
          <CrisisList />
        </details>
        <button
          className="secondary"
          type="button"
          onClick={() => {
            const blob = new Blob([exportJson(data)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `clearline-export-${localDayKey()}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Download my data
        </button>
        <p className="hint">A JSON file of everything stored in this browser (recordings aren't included).</p>
        <div className="danger-zone">
          <h4>Delete history</h4>
          <p className="hint">
            Deletes all sessions, transcripts, feedback, reviews, confidence notes, real-world logs and saved recordings from this browser. It can't delete copies already processed by
            Anthropic or Deepgram under their own retention policies.
          </p>
          <button
            className="danger"
            type="button"
            onClick={async () => {
              if (!window.confirm("Delete all your practice history from this browser? This can't be undone.")) return;
              await deleteAll();
              setDeleted(true);
            }}
          >
            Delete all history
          </button>
          {deleted && (
            <p className="notice ok" role="status">
              History deleted.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
