// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../../src/client/App";
import { AppProvider } from "../../src/client/lib/store";
import { emptyData, loadData, STORAGE_KEY, type AppData } from "../../src/client/lib/storage";
import { buildTestApp, fakeTransport, goodFeedback, textMessage } from "../helpers";
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
    expect(screen.getByText(/no need to replay it/)).toBeInTheDocument();

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

  it("lets the learner rate live feedback and counts it in Progress", async () => {
    routeFetchTo(buildTestApp({ transport: fakeTransport([textMessage(goodFeedback)]) }).app);
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "If you only look at survivors you miss the planes that came back and the ones that did not.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByText("What worked");
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByRole("button", { name: "Yes" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Skip" }));
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await screen.findByText("Session complete");
    expect(stored().sessions[0]!.attempts[0]!.feedbackRating).toBe("useful");
    cleanup();
    start("#/progress", stored());
    expect(await screen.findByText(/rated 1 of 1 pieces of feedback useful/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Your reviews/ })).toBeInTheDocument();
  });

  it("sends the edited answer, not a stale one, when resubmitting after an error", async () => {
    const t = fakeTransport([textMessage("not json"), textMessage(goodFeedback)]);
    routeFetchTo(buildTestApp({ transport: t }).app);
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    const box = screen.getByRole("textbox", { name: "Your explanation" });
    await user.type(box, "First version of my answer here.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("alert");
    await user.clear(box);
    await user.type(box, "Second, edited version of my answer here.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByText("What worked");
    const sent = (t.calls[1]!.messages as { content: string }[])[0]!.content;
    expect(sent).toContain("Second, edited version");
    expect(sent).not.toContain("First version");
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
    await screen.findByRole("heading", { name: "What are you practicing?" });
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
    start("#/settings", onboarded({ reviews: [due], realWorld: [{ id: "w", at: "2026-10-01T00:00:00Z", missionId: "ask-meeting", note: "x" }], ladder: [{ id: "l", createdAt: "2026-10-01T00:00:00Z", title: "x", expectedDiscomfort: 40 }] }));
    await user.click(await screen.findByRole("button", { name: "Delete all history" }));
    await screen.findByText("History deleted.");
    const d = stored();
    expect(d.reviews).toHaveLength(0);
    expect(d.sessions).toHaveLength(0);
    expect(d.realWorld).toHaveLength(0);
    expect(d.ladder).toHaveLength(0);
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

describe("Confidence tools", () => {
  it("builds a ladder, plans a brave step, checks in afterwards, and shows prediction vs outcome", async () => {
    const user = userEvent.setup();
    start("#/confidence", onboarded());
    await screen.findByRole("heading", { name: "Why speaking feels so hard" });
    expect(screen.getByText(/not therapy or a diagnosis/)).toBeInTheDocument();
    await user.click(screen.getByLabelText("I avoid eye contact"));
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(stored().myHabits).toEqual(["Avoiding eye contact"]);

    await screen.findByRole("heading", { name: "Pick a brave step" });
    await user.click(await screen.findByRole("button", { name: "+ Ask a question in a meeting" }));
    await user.click(screen.getByRole("button", { name: "+ Say good morning to someone I don't usually talk to" }));
    await user.click(screen.getAllByRole("button", { name: "Plan" })[0]!); // ladder is shown hardest first
    await screen.findByRole("heading", { name: "What will you do?" });
    expect(screen.getByRole("textbox", { name: "What will you do?" })).toHaveValue("Ask a question in a meeting");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByRole("textbox", { name: "What are you worried will happen?" }), "My voice will shake and people will notice");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Avoiding eye contact")).toBeChecked(); // pre-filled from the intro
    await user.type(screen.getByLabelText("If"), "I lose my thread");
    await user.type(screen.getByLabelText("then I will"), "pause and restate my point");
    await user.click(screen.getByRole("button", { name: "Save my plan" }));

    expect(await screen.findByText("Your current step")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "What happened?" }));
    await user.click(screen.getByLabelText("No, it didn't"));
    await user.type(screen.getByRole("textbox", { name: "One thing that went okay" }), "I asked it clearly");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/What you feared didn't happen/);
    expect(screen.getByText(/Real life:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Say good morning to someone I don't usually talk to" })).toBeInTheDocument(); // next rung offered

    const d = stored();
    expect(d.ladder).toHaveLength(2);
    expect(d.experiments).toHaveLength(1);
    expect(d.experiments[0]).toMatchObject({
      situation: "Ask a question in a meeting",
      outcome: "didnt-happen",
      safetyBehaviourToDrop: "Avoiding eye contact",
      wentOkay: "I asked it clearly",
      ifThen: { obstacle: "I lose my thread", action: "pause and restate my point" },
    });
    expect(d.experiments[0]!.ladderStepId).toBe(d.ladder.find((l) => l.title.startsWith("Ask"))!.id);
  });

  it("walks through untangling a thought and saves it", async () => {
    const user = userEvent.setup();
    start("#/confidence", onboarded({ confidenceIntroSeen: true }));
    await user.click(await screen.findByRole("button", { name: /A thought keeps bugging you/ }));
    await user.type(screen.getByRole("textbox", { name: "What's the anxious thought?" }), "Everyone will think I'm incompetent");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /Mind reading/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/What did people actually say or do/)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "What doesn't fit the thought?" }), "My last update went fine");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByRole("textbox", { name: "Write a more balanced thought" }), "Some people may not notice at all");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Now the real test/);
    expect(stored().reframes[0]).toMatchObject({ thought: "Everyone will think I'm incompetent", traps: ["mind-reading"], balanced: "Some people may not notice at all" });
  });

  it("shows crisis resources when crisis language is typed", async () => {
    const user = userEvent.setup();
    start("#/confidence", onboarded({ confidenceIntroSeen: true }));
    await user.click(await screen.findByRole("button", { name: /A thought keeps bugging you/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "What's the anxious thought?" }), "I want to kill myself");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/988/);
  });

  it("records an optional anxiety check-in around a talk rehearsal", async () => {
    const user = userEvent.setup();
    start("#/talk/eg-goodhart", onboarded());
    await screen.findByRole("heading", { name: "Set up your talk" });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Topic" })).not.toHaveValue(""));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByText("Feeling nervous? Quick check-in"));
    const details = screen.getByText("Feeling nervous? Quick check-in").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    fireEvent.change(screen.getByLabelText(/How anxious do you feel/), { target: { value: "8" } });
    await user.type(screen.getByRole("textbox", { name: /What are you worried will happen/ }), "I'll lose my thread");
    await user.click(screen.getByRole("button", { name: "I'm ready to present" }));
    await user.type(await screen.findByRole("textbox", { name: "Your talk" }), "When a measure becomes a target, people game it.");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(await screen.findByRole("button", { name: "Skip the question" }));
    await user.click(await screen.findByRole("button", { name: "Finish" }));
    await user.click(screen.getByRole("button", { name: "Finish session" }));
    await screen.findByText(/Before, you felt 8\/10/);
    await user.click(screen.getByLabelText("No"));
    await user.click(screen.getByRole("button", { name: "Save check-in" }));
    await screen.findByText("Saved to Confidence.");
    expect(stored().experiments[0]).toMatchObject({ kind: "rehearsal", anxietyBefore: 8, prediction: "I'll lose my thread", outcome: "didnt-happen" });
  });
});

describe("Guided plan and phrase bank", () => {
  it("starts a 4-week plan on Today with this week's tasks linked", async () => {
    const user = userEvent.setup();
    start("#/today", onboarded());
    await user.click(await screen.findByRole("button", { name: /Start a 4-week plan/ }));
    expect(await screen.findByText(/Week 1 of 4/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lead with your point" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rehearse: introduce yourself" })).toHaveAttribute("href", "#/talk/s:introduce");
    expect(stored().plan?.startedAt).toBeTruthy();
  });

  it("opens the plan's talk scenario directly", async () => {
    start("#/talk/s:introduce", onboarded());
    await screen.findByRole("heading", { name: "Set up your talk" });
    expect(screen.getByText("Introduce yourself")).toBeInTheDocument();
  });

  it("collects the session phrase into the phrase bank and adds it to reviews", async () => {
    const user = userEvent.setup();
    start("#/learn/eg-goodhart", onboarded());
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Rewarding a number makes people game it.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "Your feedback" });
    cleanup();
    start("#/phrases", stored());
    expect(await screen.findByText("proxy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Practice in reviews" }));
    expect(await screen.findByText("✓ In your reviews")).toBeInTheDocument();
    expect(stored().reviews.some((r) => r.kind === "phrase" && r.prompt.includes('"proxy"'))).toBe(true);
  });
});

describe("Self-check, quiet mode and safety-habit comparison", () => {
  it("gives non-diagnostic guidance pointing to professional support when it's getting in the way a lot", async () => {
    const user = userEvent.setup();
    start("#/confidence", onboarded({ confidenceIntroSeen: true }));
    await user.click(await screen.findByRole("button", { name: /Is it getting in the way/ }));
    expect(screen.getByText(/not a diagnosis/)).toBeInTheDocument();
    for (let i = 0; i < 4; i++) {
      const visible = document.querySelector("fieldset.impact-q:not([hidden])") as HTMLElement;
      await user.click(within(visible).getByLabelText(i === 1 ? "A lot" : "A little"));
      await user.click(screen.getByRole("button", { name: i < 3 ? "Next" : "See guidance" }));
    }
    expect(await screen.findByText(/worth raising with a doctor or a licensed therapist/)).toBeInTheDocument();
    expect(stored().impactChecks[0]!.answers).toEqual([1, 3, 1, 1]);
  });

  it("hides measurement numbers in quiet mode", async () => {
    const user = userEvent.setup();
    const d = onboarded();
    d.prefs.quietMode = true;
    start("#/learn/eg-goodhart", d);
    await user.click(await screen.findByRole("button", { name: /hide the briefing/ }));
    await user.type(screen.getByRole("textbox", { name: "Your explanation" }), "Rewarding a number makes people game it.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    expect(await screen.findByText(/Quiet mode is on/)).toBeInTheDocument();
    expect(document.querySelector("dl.measured")).toHaveAttribute("hidden");
  });

  it("compares experiments with and without a dropped safety habit", async () => {
    const base = { createdAt: "2026-10-01T00:00:00Z", kind: "real-world" as const, situation: "s", prediction: "p", predictionLikelihood: 60, anxietyBefore: 7, completedAt: "2026-10-01T01:00:00Z" };
    start(
      "#/confidence",
      onboarded({
        confidenceIntroSeen: true,
        experiments: [
          { ...base, id: "a", anxietyAfter: 3, outcome: "didnt-happen", safetyBehaviourToDrop: "Scripting every word" },
          { ...base, id: "b", anxietyAfter: 6, outcome: "partly" },
        ],
      }),
    );
    expect(await screen.findByText(/Without a safety habit, your anxiety during was 3\/10 on average \(1\); with your usual habits, 6\/10/)).toBeInTheDocument();
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

describe("Camera drills (demo mode, no camera in jsdom)", () => {
  it("lists the ladder, falls back to typing when there is no camera, and records comfort", async () => {
    const user = userEvent.setup();
    start("#/camera", onboarded({ prefs: { ...emptyData().prefs, onboarded: true, interests: ["business"], goal: "camera" } }));
    await screen.findByRole("heading", { name: "Camera" });
    expect(screen.getByRole("heading", { name: "Just press record" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Hook in ten seconds/ })).toHaveAttribute("href", "#/camera/cam-hook");

    await user.click(screen.getByRole("link", { name: /^Start/ }));
    await screen.findByRole("heading", { name: "Just press record" });
    // Press record needs no topic. jsdom has no camera, so the typed fallback appears.
    await user.click(screen.getByRole("button", { name: "Open the camera" }));
    await screen.findByRole("heading", { name: "Camera not available" });
    await user.type(screen.getByRole("textbox", { name: /No camera here/ }), "I am Eric, in my kitchen, and I had toast.");
    await user.click(screen.getByRole("button", { name: "Get feedback" }));
    await screen.findByRole("heading", { name: "Your feedback" });
    expect(screen.getByText("Example feedback")).toBeInTheDocument();
    expect(screen.getByText(/Your first ten seconds/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Finish" }));
    await screen.findByRole("heading", { name: "Take done" });
    fireEvent.change(screen.getByLabelText(/And now: how comfortable/), { target: { value: "7" } });
    expect(screen.getByRole("link", { name: "Next drill" })).toHaveAttribute("href", "#/camera/cam-one-person");

    const saved = stored().sessions.find((s) => s.mode === "camera")!;
    expect(saved.completedAt).toBeTruthy();
    expect(saved.camera?.drillId).toBe("cam-press-record");
    expect(saved.camera?.comfortAfter).toBe(7);
    expect(saved.attempts[0]?.feedback?.kind).toBe("illustrative");
  });

  it("puts today's camera drill first on Today when the goal is the camera", async () => {
    start("#/today", onboarded({ prefs: { ...emptyData().prefs, onboarded: true, interests: ["business"], goal: "camera" } }));
    const pill = await screen.findByRole("link", { name: /Today's camera drill/ });
    expect(pill).toHaveAttribute("href", "#/camera/cam-press-record");
    expect(screen.getByRole("link", { name: "Camera" })).toBeInTheDocument();
  });
});
