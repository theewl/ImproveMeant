import { useEffect } from "react";
import { dueQueue } from "../shared/schedule";
import { useApp } from "./lib/store";
import { href, navigate, useRoute, type Route } from "./lib/router";
import { Today } from "./screens/Today";
import { LearnSession } from "./screens/LearnSession";
import { TalkSession } from "./screens/TalkSession";
import { Review } from "./screens/Review";
import { Progress } from "./screens/Progress";
import { Settings } from "./screens/Settings";
import { Onboarding } from "./screens/Onboarding";

const GEAR = "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z";

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: { name: "today" }, label: "Today", icon: "M4 11l8-7 8 7v9h-5v-6H9v6H4z" },
  { route: { name: "talk" }, label: "Talk", icon: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" },
  { route: { name: "review" }, label: "Review", icon: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" },
  { route: { name: "progress" }, label: "Progress", icon: "M5 20V10M12 20V4M19 20v-7" },
];

export function App() {
  const route = useRoute();
  const { data, status, statusError, saveFailed } = useApp();
  const due = dueQueue(data.reviews, new Date().toISOString()).queue.length;
  const inSession = route.name === "learn";

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
      {status?.mode === "demo" && (route.name === "today" || route.name === "settings") && <p className="banner demo">Demo mode — feedback is an example, not about your answer.</p>}
      {statusError && <p className="banner error">Can't reach the app server: {statusError}</p>}
      {saveFailed && <p className="banner error">Your browser couldn't save progress (storage full or disabled).</p>}

      {route.name === "onboarding" && <Onboarding />}
      {route.name === "today" && <Today />}
      {route.name === "learn" && <LearnSession key={route.storyId} storyId={route.storyId} />}
      {route.name === "talk" && <TalkSession key={route.fromStoryId ?? "new"} fromStoryId={route.fromStoryId} />}
      {route.name === "review" && <Review />}
      {route.name === "progress" && <Progress />}
      {route.name === "settings" && <Settings />}

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => {
          const active = n.route.name === route.name;
          return (
            <a key={n.label} href={href(n.route)} aria-current={active ? "page" : undefined} className={active ? "on" : ""}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path d={n.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{n.label}</span>
              {n.route.name === "review" && due > 0 && (
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
