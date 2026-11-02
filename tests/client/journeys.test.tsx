// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/client/App";
import { AppProvider } from "../../src/client/lib/store";
import { emptyData, loadData, STORAGE_KEY, type AppData } from "../../src/client/lib/storage";
import { buildTestApp, fakeTransport, textMessage } from "../helpers";
import type { ReviewItem } from "../../src/shared/types";

// The browser client talks to the real Hono app in-process (demo providers unless overridden).
function routeFetchTo(app: { request: (input: Request) => Response | Promise<Response> }) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const { signal: _signal, ...rest } = init;
    return app.request(new Request(`http://localhost${url}`, rest as RequestInit));
  });
}

function onboarded(extra: Partial<AppData> = {}): AppData {
  const d = emptyData();
  return { ...d, prefs: { ...d.prefs, onboarded: true, interests: ["business"] }, ...extra };
}

function start(path: string, data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.location.hash = path;
  return render(
    <AppProvider>
      <App />
    </AppProvider>,
  );
}

const stored = () => loadData();

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as never;
  routeFetchTo(buildTestApp().app);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Learn & Explain journey (demo mode, typed)", () => {
  it("runs understand → recall (assisted) → feedback → retry → compare → finish, and persists", async () => {
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await screen.findByRole("heading", { name: "Goodhart's law: when measures become targets" });
    expect(screen.getByText(/Written for this app/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Source/ })).toHaveAttribute("href", expect.stringContaining("wikipedia.org"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");

    await user.click(screen.getByRole("button", { name: /hide the briefing/ }));
    await screen.findByRole("heading", { name: "Explain it from memory" });
    expect(screen.queryByText(/Example: if a support team/)).not.toBeVisible();

    // Reopen the briefing → attempt is assisted.
    const peek = document.querySelector("details.peek") as HTMLDetailsElement;
    peek.open = true;
    fireEvent(peek, new Event("toggle"));
    await screen.findByText(/this attempt is marked assisted/);

    // jsdom has no MediaRecorder, so the typed alternative is the default.
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "When people are rewarded for a number they game the number.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "Your feedback" });
    expect(screen.getByText("Example feedback")).toBeInTheDocument();
    expect(screen.getByText(/Assisted — briefing reopened/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Try again" });
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Chasing a metric breaks the metric: people move the number, not the goal.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "Compare attempts" });

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByLabelText(/The word “proxy”/));
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await screen.findByText("Session complete");

    const d = stored();
    expect(d.sessions).toHaveLength(1);
    const s = d.sessions[0]!;
    expect(s.completedAt).toBeTruthy();
    expect(s.attempts).toHaveLength(2);
    expect(s.attempts[0]).toMatchObject({ assisted: true, isRetry: false, modality: "typed" });
    expect(s.attempts[1]).toMatchObject({ assisted: false, isRetry: true });
    expect(s.attempts[0]!.feedback?.kind).toBe("illustrative");
    expect(d.reviews).toHaveLength(1);
    expect(d.reviews[0]).toMatchObject({ kind: "phrase", storyId: "eg-goodhart", step: 0 });
  });

  it("offers the typed alternative when recording isn't supported", async () => {
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    await user.click(screen.getByRole("tab", { name: "Speak" }));
    expect(screen.getByText(/Recording isn't supported/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Type your answer instead" }));
    expect(screen.getByRole("textbox", { name: "Your explanation" })).toBeInTheDocument();
  });

  it("shows the live-provider error instead of silently substituting demo feedback", async () => {
    routeFetchTo(buildTestApp({ transport: fakeTransport([textMessage("not json")]) }).app);
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "When people are rewarded for a number they game it.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/expected format/);
    expect(screen.queryByText("Example feedback")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("Rehearse a Talk journey (demo mode, typed)", () => {
  it("sets up from a story, presents, answers a simulated question, gets feedback and finishes", async () => {
    const user = userEvent.setup();
    start("#/talk/eg-goodhart", onboarded());
    await screen.findByRole("heading", { name: "Set up your talk" });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Topic" })).toHaveValue("Goodhart's law: when measures become targets"));
    await user.click(screen.getByLabelText("1 min"));
    await user.click(screen.getByText("More options"));
    await user.click(screen.getByLabelText("Challenging"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Prepare (optional)" });
    await user.click(screen.getByRole("button", { name: "I'm ready to present" }));
    await screen.findByText(/aim for 1:00/);
    expect(screen.getByText("simulated")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Your talk" }), "Here's the idea: when a measure becomes a target, people game it.");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText(/Simulated audience member/);
    expect(screen.getByText(/sample question from the practice bank/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "The strongest argument against is that some targets work well.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "Your feedback" });
    await user.click(screen.getByRole("button", { name: "Finish" }));
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await screen.findByText("Rehearsal complete");
    const s = stored().sessions[0]!;
    expect(s.mode).toBe("talk");
    expect(s.talk).toMatchObject({ scenarioId: "explain-group", targetSeconds: 60, questionStyle: "challenging" });
    expect(s.followUps).toHaveLength(1);
    expect(stored().reviews[0]).toMatchObject({ kind: "skill", skill: "organize" });
  });
});

describe("Rehearse a Talk from the Talk tab", () => {
  it("starts with a simple scenario picker, then a short setup form", async () => {
    const user = userEvent.setup();
    start("#/talk", onboarded());
    await screen.findByRole("heading", { name: "What are you practising?" });
    expect(screen.getByText(/simulated audience/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Propose a change in a meeting/ }));
    await screen.findByRole("heading", { name: "Set up your talk" });
    expect(screen.getByRole("textbox", { name: "The change you'll propose" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "The change you'll propose" }), "Async status updates");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Prepare (optional)" });
  });
});

describe("Review and history", () => {
  const due: ReviewItem = {
    id: "r-1",
    kind: "idea",
    createdAt: "2026-10-01T00:00:00Z",
    prompt: "What's the main idea of \"Goodhart's law\"?",
    answer: "Rewarding a number makes people move the number.",
    storyId: "eg-goodhart",
    storyKind: "evergreen",
    step: 0,
    dueAt: "2026-10-02T00:00:00Z",
    history: [],
    status: "active",
  };

  it("asks for recall before revealing, then schedules by self-assessment", async () => {
    const user = userEvent.setup();
    start("#/review", onboarded({ reviews: [due] }));
    await screen.findByText(/main idea of "Goodhart's law"/);
    expect(screen.queryByText(due.answer)).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Recall it first/ }), "people game metrics");
    await user.click(screen.getByRole("button", { name: "Reveal the answer" }));
    expect(screen.getByText(due.answer)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Got it" }));
    await screen.findByText(/Reviews done for today/);
    const r = stored().reviews[0]!;
    expect(r.step).toBe(1);
    expect(r.history[0]).toMatchObject({ result: "recalled", response: "Recall: people game metrics" });
  });

  it("lets the learner dismiss or delete an item", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    start("#/review", onboarded({ reviews: [due, { ...due, id: "r-2" }] }));
    await screen.findAllByText(/main idea/);
    await user.click(screen.getByRole("button", { name: "Stop reviewing this" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await screen.findByText(/Nothing to review right now|Reviews done/);
    const d = stored();
    expect(d.reviews).toHaveLength(1);
    expect(d.reviews[0]!.status).toBe("dismissed");
  });

  it("deletes all history from Settings", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    start("#/settings", onboarded({ reviews: [due], realWorld: [{ id: "w", at: "2026-10-01T00:00:00Z", missionId: "ask-meeting", note: "x" }] }));
    await user.click(await screen.findByRole("button", { name: "Delete all history" }));
    await screen.findByText("History deleted.");
    const d = stored();
    expect(d.reviews).toHaveLength(0);
    expect(d.sessions).toHaveLength(0);
    expect(d.realWorld).toHaveLength(0);
  });

  it("shows progress after a reload with spoken and written sessions counted separately", async () => {
    const mk = (modality: "spoken" | "typed", id: string) => ({
      id,
      mode: "learn" as const,
      startedAt: "2026-10-01T00:00:00Z",
      completedAt: "2026-10-01T00:05:00Z",
      exerciseId: "mp-explain-story",
      skill: "main-point" as const,
      attempts: [{ id: id + "a", createdAt: "2026-10-01T00:01:00Z", modality, text: "hello there world", transcriptEdited: false, assisted: false, isRetry: false }],
      followUps: [],
      usedLive: false,
    });
    start("#/progress", onboarded({ sessions: [mk("spoken", "s1"), mk("typed", "s2"), mk("typed", "s3")] }));
    const stats = await screen.findByText("Spoken sessions");
    const dl = stats.closest("dl")!;
    expect(within(dl).getByText("Spoken sessions").nextSibling).toHaveTextContent("1");
    expect(within(dl).getByText("Written sessions").nextSibling).toHaveTextContent("2");
  });
});

describe("onboarding", () => {
  it("is short, limits interests to three, and is skippable", async () => {
    const user = userEvent.setup();
    start("#/today", emptyData());
    await screen.findByRole("heading", { name: "Welcome" });
    for (const n of ["Technology", "Science", "Health"]) await user.click(screen.getByRole("button", { name: n }));
    expect(screen.getByRole("button", { name: "Culture & communication" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Skip for now" }));
    await act(async () => {});
    expect(stored().prefs.onboarded).toBe(true);
  });
});
