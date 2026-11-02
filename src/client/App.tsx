import { useEffect } from "react";
import { dueQueue } from "../shared/schedule";
import { useApp } from "./lib/store";
import { href, navigate, useRoute, type Route } from "./lib/router";
import { LearnSession } from "./screens/LearnSession";
import { TalkSession } from "./screens/TalkSession";
import { Review } from "./screens/Review";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Onboarding } from "./screens/Onboarding";
import { Confidence } from "./screens/Confidence";
import { Phrases } from "./screens/Phrases";
import { CameraSession } from "./screens/CameraSession";
import { isCameraDrill } from "../shared/camera";
import { getPrompt, PROMPT_DRILL } from "../shared/vlog";

const PROMPT_DRILL_FOR = (id: string) => PROMPT_DRILL[getPrompt(id)!.kind];
import { Today } from "./screens/Today";

const GEAR = "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: { name: "today" }, label: "Today", icon: "M4 11l8-7 8 7v9h-5v-6H9v6H4z" },
  { route: { name: "steps" }, label: "Steps", icon: "M4 20h5v-5h5v-5h5V5" },
  { route: { name: "progress" }, label: "Progress", icon: "M5 20V10M12 20V4M19 20v-7" },
];

export function App() {
  const route = useRoute();
  const { data, status, statusError, saveFailed } = useApp();
  const due = dueQueue(data.reviews, new Date().toISOString()).queue.length;
  const inSession = route.name === "learn" || (route.name === "camera" && !!route.drillId) || (route.name === "take" && !!getPrompt(route.promptId));

  useEffect(() => {
    if (!data.prefs.onboarded && route.name === "today") navigate({ name: "onboarding" });
  }, [data.prefs.onboarded, route.name]);

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <h1 className="sr-only">Clearline</h1>
        {!inSession && (
          <>
            <a className="brand" href={href({ name: "today" })}>
              Clearline
            </a>
            <a className="icon-btn" href={href({ name: "settings" })} aria-label="Settings" aria-current={route.name === "settings" ? "page" : undefined}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d={GEAR} fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
          </>
        )}
      </header>
      {((status?.mode === "demo" && (route.name === "today" || route.name === "settings")) || statusError || saveFailed) && (
        <aside aria-label="App status">
          {status?.mode === "demo" && (route.name === "today" || route.name === "settings") && <p className="banner demo">Demo mode — feedback is an example, not about your answer.</p>}
          {statusError && <p className="banner error">Can't reach the app server: {statusError}</p>}
          {saveFailed && <p className="banner error">Your browser couldn't save progress (storage full or disabled).</p>}
        </aside>
      )}

      {route.name === "onboarding" && <Onboarding />}
      {route.name === "today" && <Today />}
      {route.name === "learn" && <LearnSession key={route.storyId} storyId={route.storyId} />}
      {route.name === "talk" && <TalkSession key={route.fromStoryId ?? route.scenario ?? "new"} fromStoryId={route.fromStoryId} scenario={route.scenario} />}
      {route.name === "review" && <Review />}
      {route.name === "progress" && <Progress />}
      {route.name === "settings" && <Settings />}
      {route.name === "take" && (getPrompt(route.promptId) ? <CameraSession key={route.promptId} drillId={PROMPT_DRILL_FOR(route.promptId)} prompt={getPrompt(route.promptId)} /> : <Today />)}
      {route.name === "steps" && <Confidence />}
      {route.name === "camera" && !route.drillId && <Confidence />}
      {route.name === "phrases" && <Phrases />}
      {route.name === "camera" && route.drillId && (isCameraDrill(route.drillId) ? <CameraSession key={route.drillId + (route.fromStoryId ?? "")} drillId={route.drillId} fromStoryId={route.fromStoryId} /> : <Confidence />)}

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => {
          const active =
            n.route.name === route.name ||
            (n.route.name === "today" && (route.name === "review" || route.name === "learn")) ||
            (n.route.name === "today" && route.name === "take") ||
            (n.route.name === "steps" && (route.name === "camera" || route.name === "talk")) ||
            (n.route.name === "progress" && route.name === "phrases");
          return (
            <a key={n.label} href={href(n.route)} aria-current={active ? "page" : undefined} className={active ? "on" : ""}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{n.label}</span>
              {n.route.name === "today" && due > 0 && (
                <span className="count" aria-label={`${due} due`}>
                  {due}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
