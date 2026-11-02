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

const NAV: { route: Route; label: string }[] = [
  { route: { name: "today" }, label: "Today" },
  { route: { name: "talk" }, label: "Talk" },
  { route: { name: "review" }, label: "Review" },
  { route: { name: "progress" }, label: "Progress" },
  { route: { name: "settings" }, label: "Settings" },
];

export function App() {
  const route = useRoute();
  const { data, status, statusError, saveFailed } = useApp();
  const due = dueQueue(data.reviews, new Date().toISOString()).queue.length;

  useEffect(() => {
    if (!data.prefs.onboarded && route.name === "today") navigate({ name: "onboarding" });
  }, [data.prefs.onboarded, route.name]);

  return (
    <div className="app">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <h1>
          <a href={href({ name: "today" })}>
            Clearline <span className="working">working name</span>
          </a>
        </h1>
        {status?.mode === "demo" && (
          <span className="badge demo" title="AI coaching isn't configured on this server">
            Demo mode
          </span>
        )}
      </header>
      {status?.mode === "demo" && (
        <p className="banner demo">Demo mode: curated stories and illustrative example feedback. Nothing here evaluates your actual answers.</p>
      )}
      {statusError && <p className="banner error">Can't reach the app server: {statusError}</p>}
      {saveFailed && <p className="banner error">Your browser refused to save progress (storage full or disabled). Recent work may not persist.</p>}

      {route.name === "onboarding" && <Onboarding />}
      {route.name === "today" && <Today />}
      {route.name === "learn" && <LearnSession key={route.storyId} storyId={route.storyId} />}
      {route.name === "talk" && <TalkSession key={route.fromStoryId ?? "new"} fromStoryId={route.fromStoryId} />}
      {route.name === "review" && <Review />}
      {route.name === "progress" && <Progress />}
      {route.name === "settings" && <Settings />}

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => {
          const active = n.route.name === route.name || (n.route.name === "today" && route.name === "learn");
          return (
            <a key={n.label} href={href(n.route)} aria-current={active ? "page" : undefined} className={active ? "on" : ""}>
              {n.label}
              {n.route.name === "review" && due > 0 && <span className="count" aria-label={`${due} due`}>{due}</span>}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
