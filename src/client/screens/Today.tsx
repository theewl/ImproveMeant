import { useEffect, useState } from "react";
import type { StoryCard } from "../../shared/types";
import { dueQueue } from "../../shared/schedule";
import { localDayKey } from "../../shared/dates";
import { ALL_INTERESTS } from "../../shared/evergreen";
import { api, topics, type LiveFeedState, type TopicHit } from "../lib/api";
import { useApp } from "../lib/store";
import { href, navigate } from "../lib/router";
import { ErrorNotice, Loading, SourceLine } from "../components/common";
import { PlanCard } from "../components/PlanCard";

/** Type a topic (Wikipedia search) or paste your own material to explain. Live mode only. */
function AnyTopic({ live }: { live: boolean }) {
  const { update } = useApp();
  const [mode, setMode] = useState<"closed" | "search" | "paste">("closed");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TopicHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");

  if (!live) {
    return <p className="hint">With AI coaching on, you can also type any topic or paste your own material to explain.</p>;
  }
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
    <section className="any-topic" aria-labelledby="any-h">
      <h3 id="any-h" className="section-title">
        Explain something else
      </h3>
      {mode === "closed" && (
        <div className="row wrap">
          <button className="secondary small" type="button" onClick={() => setMode("search")}>
            Type a topic
          </button>
          <button className="secondary small" type="button" onClick={() => setMode("paste")}>
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
          <p className="hint">Articles come from Wikipedia; a briefing is written from the article text (about 5¢ of AI each).</p>
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
          <textarea id="own-text" rows={6} maxLength={60000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Notes, an email, a document section — anything you need to explain." />
          <p className="hint">
            {text.trim().length < 400 ? `${Math.max(0, 400 - text.trim().length)} more characters needed. ` : ""}Sent once to the AI to write a briefing; the briefing is kept only on this device. Don't paste anything confidential you wouldn't send to an AI service.
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
    </section>
  );
}

export function Today() {
  const { data, status } = useApp();
  const [cards, setCards] = useState<StoryCard[] | null>(null);
  const [live, setLive] = useState<LiveFeedState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const interestsKey = data.prefs.interests.join(",");

  const [seed, setSeed] = useState(0);
  const load = (refresh = false, nextSeed = seed) => {
    setError(null);
    setCards(null);
    api
      .stories(data.prefs.interests, { refresh, seed: nextSeed })
      .then((r) => {
        setCards(r.cards);
        setLive(r.live);
      })
      .catch(setError);
  };
  useEffect(() => load(), [interestsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = localDayKey();
  const { queue } = dueQueue(data.reviews, new Date().toISOString());
  const doneToday = data.sessions.filter((s) => s.completedAt && localDayKey(s.completedAt) === today).length;
  const max = data.prefs.sessionMinutes === 3 ? 3 : 4;
  const planActive = !!data.plan;
  const shown = cards?.slice(0, max) ?? [];
  const featured = planActive ? undefined : shown[0];
  const rest = planActive ? shown : shown.slice(1);
  const interestNames = data.prefs.interests.map((i) => ALL_INTERESTS.find((x) => x.id === i)?.label ?? i);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">{doneToday > 0 ? "Nice work today" : "Today"}</h2>
      <p className="hint">
        {doneToday > 0
          ? `${doneToday} session${doneToday === 1 ? "" : "s"} done. Another is optional.`
          : interestNames.length
            ? `Picked for you: ${interestNames.join(", ")}`
            : "A mix of ideas worth knowing"}
      </p>

      <PlanCard learnStoryId={(featured ?? rest[0])?.id} />

      {queue.length > 0 && (
        <a className="pill-link" href={href({ name: "review" })}>
          <span>
            <strong>
              {queue.length} review{queue.length === 1 ? "" : "s"}
            </strong>{" "}
            ready · about {queue.length} min
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}

      {live?.status === "stale" && <p className="notice warn">{live.message}</p>}
      {live?.status === "unavailable" && <p className="notice warn">Today's news couldn't load. Showing curated ideas.</p>}
      {error != null && <ErrorNotice error={error} onRetry={() => load()} />}
      {!cards && error == null && <Loading label="Finding today's stories…" />}

      {featured && (
        <article className="featured">
          <SourceLine source={featured.source} kind={featured.kind} feed={featured.feed} minutes={featured.estimatedMinutes} />
          <h3>{featured.title}</h3>
          <p>{featured.description}</p>
          <a className="button primary" href={href({ name: "learn", storyId: featured.id })}>
            Start<span className="sr-only">: {featured.title}</span>
          </a>
        </article>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="more-h">
          <h3 id="more-h" className="section-title">
            {planActive ? "Pick a story to explain" : "Or pick another"}
          </h3>
          <ul className="rows">
            {rest.map((c) => (
              <li key={c.id} className="row-item">
                <a className="row-title" href={href({ name: "learn", storyId: c.id })}>
                  {c.title}
                </a>
                <p className="row-desc">{c.whySelected && c.kind === "current" ? c.whySelected : c.description}</p>
                <SourceLine source={c.source} kind={c.kind} feed={c.feed} minutes={c.estimatedMinutes} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {cards && (
        <button
          className="link"
          type="button"
          onClick={() => {
            const s = seed + 1;
            setSeed(s);
            load(true, s);
          }}
        >
          Show different stories
        </button>
      )}

      <AnyTopic live={status?.mode === "live"} />

      <a className="pill-link subtle" href={href({ name: "talk" })}>
        <span>
          <strong>Rehearse a talk</strong> for a meeting or presentation
        </span>
        <span aria-hidden="true">→</span>
      </a>
    </main>
  );
}
