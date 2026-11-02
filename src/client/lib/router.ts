import { useEffect, useState } from "react";

export type Route =
  | { name: "today" }
  | { name: "learn"; storyId: string }
  | { name: "talk"; fromStoryId?: string }
  | { name: "review" }
  | { name: "progress" }
  | { name: "settings" }
  | { name: "onboarding" };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  switch (parts[0]) {
    case "learn":
      return parts[1] ? { name: "learn", storyId: decodeURIComponent(parts[1]) } : { name: "today" };
    case "talk":
      return { name: "talk", fromStoryId: parts[1] ? decodeURIComponent(parts[1]) : undefined };
    case "review":
    case "progress":
    case "settings":
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
    case "talk":
      return r.fromStoryId ? `#/talk/${encodeURIComponent(r.fromStoryId)}` : "#/talk";
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
