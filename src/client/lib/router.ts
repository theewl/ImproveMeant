import type { ScenarioId } from "../../shared/types";

const SCENARIO_IDS: ScenarioId[] = ["introduce", "explain-group", "propose-change", "persuade"];
import { useEffect, useState } from "react";

export type Route =
  | { name: "today" }
  | { name: "learn"; storyId: string }
  | { name: "talk"; fromStoryId?: string; scenario?: ScenarioId }
  | { name: "camera"; drillId?: string; fromStoryId?: string }
  | { name: "review" }
  | { name: "progress" }
  | { name: "settings" }
  | { name: "steps" }
  | { name: "phrases" }
  | { name: "onboarding" };

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  switch (parts[0]) {
    case "learn":
      return parts[1] ? { name: "learn", storyId: decode(parts[1]) } : { name: "today" };
    case "talk": {
      const p = parts[1] ? decode(parts[1]) : undefined;
      if (p?.startsWith("s:") && SCENARIO_IDS.includes(p.slice(2) as ScenarioId)) return { name: "talk", scenario: p.slice(2) as ScenarioId };
      return { name: "talk", fromStoryId: p };
    }
    case "camera":
      return parts[1] ? { name: "camera", drillId: decode(parts[1]), fromStoryId: parts[2] ? decode(parts[2]) : undefined } : { name: "camera" };
    case "confidence":
    case "steps":
      return { name: "steps" };
    case "review":
    case "progress":
    case "settings":
    case "phrases":
    case "onboarding":
      return { name: parts[0] };
    default:
      return { name: "today" };
  }
}

export function href(r: Route): string {
  switch (r.name) {
    case "learn":
      return `#/learn/${encodeURIComponent(r.storyId)}`;
    case "camera":
      return r.drillId ? `#/camera/${encodeURIComponent(r.drillId)}${r.fromStoryId ? `/${encodeURIComponent(r.fromStoryId)}` : ""}` : "#/camera";
    case "talk":
      return r.scenario ? `#/talk/s:${r.scenario}` : r.fromStoryId ? `#/talk/${encodeURIComponent(r.fromStoryId)}` : "#/talk";
    default:
      return `#/${r.name}`;
  }
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
