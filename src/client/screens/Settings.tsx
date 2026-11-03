import { useState } from "react";
import { useApp } from "../lib/store";
import { api, ApiRequestError } from "../lib/api";
import { exportJson } from "../lib/storage";
import { localDayKey } from "../../shared/dates";
import { PreferencesForm } from "./Onboarding";
import { CrisisList } from "../components/Crisis";
import { isAppleWebKit } from "../lib/useSpeechCapture";

export function Settings() {
  const { data, update, deleteAll, status, refreshStatus } = useApp();
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState(data.prefs.accessToken ?? "");
  const [deleted, setDeleted] = useState(false);
  const [check, setCheck] = useState<string | null>(null);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">Settings</h2>

      <section aria-labelledby="pref-h">
        <h3 id="pref-h" className="section-title">
          You
        </h3>
        <PreferencesForm submitLabel="Save" onDone={() => setSaved(true)} />
        {saved && (
          <p className="notice ok" role="status">
            Saved.
          </p>
        )}
        <label className="option">
          <input type="checkbox" checked={!!data.prefs.quietMode} onChange={(e) => update((d) => ({ ...d, prefs: { ...d.prefs, quietMode: e.target.checked } }))} />
          Quiet mode: hide timers and numbers while I practice
        </label>
        {isAppleWebKit() && status?.transcription !== "deepgram" && (
          <label className="option">
            <input type="checkbox" checked={!!data.prefs.liveTranscriptNoSound} onChange={(e) => update((d) => ({ ...d, prefs: { ...d.prefs, liveTranscriptNoSound: e.target.checked } }))} />
            Live transcript instead of sound (iPhone can't do both)
          </label>
        )}
      </section>

      <section aria-labelledby="mode-h">
        <h3 id="mode-h" className="section-title">
          Connection
        </h3>
        <p className="hint">
          {status
            ? `AI coaching ${status.coaching === "claude" ? "on" : "off (demo)"} · transcription ${status.transcription === "deepgram" ? "on" : "off"}${status.mode === "live" ? ` · about $${status.usageToday.estimatedCostUsd.toFixed(2)} used today` : ""}`
            : "Can't reach the server."}
        </p>
        <div className="row wrap">
          <button
            className="secondary small"
            type="button"
            onClick={async () => {
              setCheck("Checking…");
              try {
                const r = await api.stories(data.prefs.interests);
                setCheck(`Connected. ${r.cards.length} stories available${status?.accessTokenRequired ? " · access token accepted" : ""}.`);
              } catch (e) {
                const err = e as ApiRequestError;
                setCheck(`Not working: ${err.message}${err.code ? ` [${err.code}]` : ""}`);
              }
            }}
          >
            Check connection
          </button>
          {check && (
            <p className="hint" role="status">
              {check}
            </p>
          )}
        </div>
        {status?.accessTokenRequired && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update((d) => ({ ...d, prefs: { ...d.prefs, accessToken: token.trim() || undefined } }));
              setTimeout(refreshStatus, 50);
            }}
          >
            <label className="label" htmlFor="token">
              Access token {data.prefs.accessToken ? `(saved, ${data.prefs.accessToken.length} characters)` : "(none saved)"}
            </label>
            <input id="token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
            <button className="secondary" type="submit">
              Save token
            </button>
          </form>
        )}
      </section>

      <section aria-labelledby="privacy-h">
        <h3 id="privacy-h" className="section-title">
          Your data
        </h3>
        <p className="hint">Everything stays in this browser. Video never leaves your phone. Only your words, and three stills if you allow them, go to the AI.</p>
        <details className="more">
          <summary>The details</summary>
          <ul className="plain">
            <li>Preferences, transcripts, feedback and reviews are stored only in this browser. Not synced or backed up.</li>
            <li>Check-ins and confidence notes are never sent to the AI.</li>
            <li>Recordings are kept only if you tick “Keep this recording”.</li>
            <li>With AI coaching on, your words (not audio) go to Anthropic. With transcription on, audio goes to Deepgram, which is asked not to keep it.</li>
            <li>The server keeps usage counts and shared story briefings, with no personal data.</li>
          </ul>
          <label className="choice">
            <input type="checkbox" checked={data.transcriptionConsent} onChange={(e) => update((d) => ({ ...d, transcriptionConsent: e.target.checked }))} />
            I've read how transcription works
          </label>
        </details>
        <details className="more">
          <summary>Need support now?</summary>
          <p className="hint">This app isn't a crisis service.</p>
          <CrisisList />
        </details>
        <div className="row wrap">
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
        </div>
        {deleted && (
          <p className="notice ok" role="status">
            History deleted.
          </p>
        )}
      </section>
    </main>
  );
}
