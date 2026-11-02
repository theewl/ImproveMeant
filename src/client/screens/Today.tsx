import { useEffect, useRef, useState } from "react";
import type { StoryCard } from "../../shared/types";
import { dueQueue } from "../../shared/schedule";
import { localDayKey } from "../../shared/dates";
import { nextStep } from "../../shared/steps";
import { fillPromptText, getPrompt, takesThisWeek, todayPrompt, type Niche } from "../../shared/vlog";
import { formatSeconds } from "../../shared/observations";
import { api, topics, type LiveFeedState, type TopicHit } from "../lib/api";
import { useApp } from "../lib/store";
import { href, navigate } from "../lib/router";
import { ErrorNotice, SourceLine } from "../components/common";

/** Type a topic (Wikipedia search) or paste your own material to talk about. Live mode only. */
function AnyTopic({ live }: { live: boolean }) {
  const { update } = useApp();
  const [mode, setMode] = useState<"closed" | "search" | "paste">("closed");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TopicHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  if (!live) return null;
  const search = async () => {
    setBusy(true);
    setErr(null);
    try {
      setHits((await topics.search(q)).hits);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  };
  const pick = async (pageid: number) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await topics.add(pageid);
      navigate({ name: "learn", storyId: r.storyId });
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  const brief = async () => {
    setBusy(true);
    setErr(null);
    try {
      const b = await topics.briefOwn(title, text);
      update((d) => ({ ...d, ownBriefings: { ...d.ownBriefings, [b.storyId]: b } }));
      navigate({ name: "learn", storyId: b.storyId });
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };
  return (
    <div className="any-topic">
      {mode === "closed" && (
        <div className="row wrap">
          <button className="link" type="button" onClick={() => setMode("search")}>
            Type a topic
          </button>
          <button className="link" type="button" onClick={() => setMode("paste")}>
            Paste my own material
          </button>
        </div>
      )}
      {mode === "search" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim().length >= 2) void search();
          }}
        >
          <label className="sr-only" htmlFor="topic-q">
            Topic
          </label>
          <div className="row">
            <input id="topic-q" value={q} maxLength={100} placeholder="e.g. inflation, how vaccines work" onChange={(e) => setQ(e.target.value)} />
            <button className="primary small" type="submit" disabled={busy || q.trim().length < 2}>
              {busy ? "…" : "Find"}
            </button>
          </div>
          {hits && hits.length === 0 && <p className="hint">Nothing found. Try different words.</p>}
          {hits && hits.length > 0 && (
            <ul className="rows">
              {hits.map((h) => (
                <li key={h.pageid} className="row-item">
                  <button type="button" className="row-button" disabled={busy} onClick={() => void pick(h.pageid)}>
                    <span className="row-title">{h.title}</span>
                    {h.snippet && <span className="row-desc">{h.snippet}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button className="link" type="button" onClick={() => setMode("closed")}>
            Cancel
          </button>
        </form>
      )}
      {mode === "paste" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length >= 400) void brief();
          }}
        >
          <label className="label" htmlFor="own-title">
            What is it? (optional)
          </label>
          <input id="own-title" value={title} maxLength={120} placeholder="e.g. Q3 planning memo" onChange={(e) => setTitle(e.target.value)} />
          <label className="label" htmlFor="own-text">
            Paste the material
          </label>
          <textarea id="own-text" rows={6} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Notes, an article, anything you want to talk about." />
          <p className="hint">
            {text.trim().length < 400 ? `${Math.max(0, 400 - text.trim().length)} more characters needed. ` : ""}Sent once to the AI for a briefing, kept only on this device.
          </p>
          <div className="row wrap">
            <button className="primary small" type="submit" disabled={busy || text.trim().length < 400}>
              {busy ? "Writing the briefing…" : "Make a briefing"}
            </button>
            <button className="link" type="button" onClick={() => setMode("closed")}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {err != null && <ErrorNotice error={err} />}
    </div>
  );
}

export function Today() {
  const { data, status } = useApp();
  const [cards, setCards] = useState<StoryCard[] | null>(null);
  const [live, setLive] = useState<LiveFeedState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [offset, setOffset] = useState(0);
  const [seed, setSeed] = useState(0);
  const [rotating, setRotating] = useState(false);
  const interestsKey = data.prefs.interests.join(",");
  const requestId = useRef(0);

  /** First load: the plain list, then the AI's picks on top. A rotation (seed > 0) shows the server's rotated list as is. */
  const load = (nextSeed = 0) => {
    const id = ++requestId.current;
    setError(null);
    if (nextSeed === 0) setCards(null);
    else setRotating(true);
    api
      .stories(data.prefs.interests, nextSeed > 0 ? { refresh: true, seed: nextSeed } : {})
      .then((r) => {
        if (id !== requestId.current) return;
        setCards(r.cards);
        setLive(r.live);
        setRotating(false);
        if (nextSeed === 0 && r.curation === "available") {
          api
            .storyPicks(data.prefs.interests)
            .then((p) => {
              if (id !== requestId.current) return;
              if (p.cards.length) setCards((cur) => [...p.cards, ...(cur ?? []).filter((c) => c.kind !== "current")]);
            })
            .catch(() => undefined);
        }
      })
      .catch((e) => {
        if (id !== requestId.current) return;
        setRotating(false);
        setError(e);
      });
  };
  useEffect(() => load(), [interestsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const nowIso = new Date().toISOString();
  const today = localDayKey(nowIso);
  const cameraDone = data.sessions.filter((s) => s.mode === "camera" && s.completedAt);
  const takeToday = cameraDone.find((s) => s.camera?.promptId && localDayKey(s.completedAt!) === today);
  const warmedUp = cameraDone.some((s) => s.camera?.drillId === "cam-press-record" && localDayKey(s.completedAt!) === today);
  const doneIds = cameraDone.filter((s) => s.camera?.promptId).map((s) => s.camera!.promptId!);
  const prompt = todayPrompt((data.prefs.niches ?? []) as Niche[], doneIds, nowIso, offset);
  const viewer = data.prefs.viewerName?.trim();
  const target = data.prefs.weeklyTakes ?? 5;
  const week = takesThisWeek(cameraDone.filter((s) => s.camera?.promptId).map((s) => s.completedAt!), nowIso);
  const donePrompt = takeToday ? getPrompt(takeToday.camera!.promptId!) : undefined;
  const due = dueQueue(data.reviews, nowIso).queue.length;
  const step = nextStep(data, data.prefs.goal);
  const stories = (cards ?? []).slice(0, 3);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">{takeToday ? "Take done" : "Today"}</h2>
      <p className="week" aria-label={`${week} of ${target} takes this week`}>
        <span className="week-dots" aria-hidden="true">
          {Array.from({ length: target }, (_, i) => (
            <span key={i} className={i < week ? "dot on" : "dot"} />
          ))}
        </span>
        {week} of {target} takes this week
      </p>

      <article className="take-card">
        <p className="eyebrow">
          {takeToday ? "Done today" : "Today's take"} · about {formatSeconds((donePrompt ?? prompt).seconds)}
          {viewer ? ` · to ${viewer}` : ""}
        </p>
        <p className="take-prompt">{fillPromptText(donePrompt ?? prompt, viewer)}</p>
        {donePrompt && <p className="hint">Next up: {fillPromptText(prompt, viewer)}</p>}
        <div className="row wrap">
          <a className="button primary" href={href({ name: "take", promptId: prompt.id })}>
            {takeToday ? "One more take" : "Record"}
          </a>
          <button className="link" type="button" onClick={() => setOffset((o) => o + 1)}>
            Different prompt
          </button>
        </div>
      </article>

      <ul className="quick">
        {!warmedUp && (
          <li>
            <a className="pill-link" href={href({ name: "camera", drillId: "cam-press-record" })}>
              <span>
                <strong>Warm-up</strong> · 20 seconds, deleted unwatched
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        )}
        <li>
          <a className="pill-link" href={href({ name: "steps" })}>
            <span>
              <strong>Next step</strong> · {step.title}
            </span>
            <span aria-hidden="true">→</span>
          </a>
        </li>
        {due > 0 && (
          <li>
            <a className="pill-link" href={href({ name: "review" })}>
              <span>
                <strong>
                  {due} review{due === 1 ? "" : "s"}
                </strong>{" "}
                · about {due} min
              </span>
              <span aria-hidden="true">→</span>
            </a>
          </li>
        )}
      </ul>

      <section aria-labelledby="react-h" className="react">
        <h3 id="react-h" className="section-title">
          Something to react to
        </h3>
        {live?.status === "unavailable" && <p className="hint">Today's news couldn't load. Showing ideas worth knowing.</p>}
        {error != null && <ErrorNotice error={error} onRetry={() => load()} />}
        {!cards && error == null && <p className="hint">Finding today's stories…</p>}
        {stories.length > 0 && (
          <ul className="rows">
            {stories.map((c) => (
              <li key={c.id} className="row-item">
                <a className="row-title" href={href({ name: "learn", storyId: c.id })}>
                  {c.title}
                </a>
                <p className="row-desc">{c.whySelected && c.kind === "current" ? c.whySelected : c.description}</p>
                <SourceLine source={c.source} kind={c.kind} feed={c.feed} minutes={c.estimatedMinutes} />
              </li>
            ))}
          </ul>
        )}
        {cards && (
          <button
            className="link"
            type="button"
            disabled={rotating}
            onClick={() => {
              const s = seed + 1;
              setSeed(s);
              load(s);
            }}
          >
            {rotating ? "Finding others…" : "Show different stories"}
          </button>
        )}
        <p className="hint">Read a two-minute briefing, then say it to the camera in your own words.</p>
        <AnyTopic live={status?.mode === "live"} />
      </section>
    </main>
  );
}
