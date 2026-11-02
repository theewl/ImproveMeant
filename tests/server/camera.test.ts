import { describe, expect, it } from "vitest";
import { buildTestApp, fakeTransport, textMessage } from "../helpers";

const JPEG = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z";
const TAKE = "If you've ever burned rice twice in one night, this is for you. The pan hissed, the smoke alarm went, and I still ate it. Here's what I'd do differently.";

const cameraOut = {
  goalMet: true,
  offTopic: false,
  strength: { observation: "You opened on the viewer's problem, not on yourself.", quote: "this is for you" },
  priority: { observation: "The payoff is promised but not delivered.", quote: "Here's what I'd do differently", suggestion: "Say the one thing you'd change, then stop." },
  hook: { observation: "A viewer who has burned rice would stay.", quote: "If you've ever burned rice twice in one night", rewrite: null },
  camera: {
    observations: [
      { aspect: "eye-line", observation: "Eyes are on the screen, slightly below the lens.", fix: "Look at the lens when you land a line." },
      { aspect: "lighting", observation: "Window behind you; face in shadow.", fix: "Turn to face the window." },
    ],
  },
  throughline: "Burn it twice and you'll still eat it.",
  explanation: "On a phone, the first line decides whether the thumb keeps scrolling.",
  retryFocus: "End on the one change.",
};

function body(over: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "take-00001",
    drillId: "cam-hook",
    topic: "cooking rice",
    notes: "burned rice, alarm, what I'd change",
    throughline: "burned rice twice, still edible",
    hookPattern: "question",
    response: { text: TAKE, transcriptSource: "browser-speech", transcriptEdited: false, durationSeconds: 24 },
    frames: [
      { at: 2, jpegBase64: JPEG },
      { at: 12, jpegBase64: JPEG },
      { at: 23, jpegBase64: JPEG },
    ],
    ...over,
  };
}

describe("POST /api/camera-feedback (live)", () => {
  it("sends the stills as image blocks before the text, verifies quotes, and keeps camera notes", async () => {
    const t = fakeTransport([textMessage(cameraOut)]);
    const { post, deps } = buildTestApp({ env: { ANTHROPIC_API_KEY: "sk-test" }, transport: t });
    const r = await post("/api/camera-feedback", body());
    expect(r.status).toBe(200);
    const { feedback } = await r.json();
    expect(feedback.kind).toBe("live");
    expect(feedback.hook.quote).toBe("If you've ever burned rice twice in one night");
    expect(feedback.camera.framesReviewed).toBe(3);
    expect(feedback.camera.observations).toHaveLength(2);
    expect(feedback.fidelity.status).toBe("not_applicable");
    expect(feedback.unverifiedQuotesRemoved).toBe(0);

    const params = t.calls[0]!;
    const content = (params.messages as { content: unknown }[])[0]!.content as { type: string; source?: { media_type: string; data: string }; text?: string }[];
    expect(content.map((b) => b.type)).toEqual(["image", "image", "image", "text"]);
    expect(content[0]!.source!.media_type).toBe("image/jpeg");
    expect(content[0]!.source!.data).toBe(JPEG);
    expect(content[3]!.text).toContain("Still frames attached: 2s, 12s, 23s");
    expect(content[3]!.text).toContain("Drill: Hook in ten seconds");
    expect(content[3]!.text).toContain("cooking rice");
    expect(content[3]!.text).toContain("walk away with: burned rice twice, still edible");
    expect(content[3]!.text).toContain("Hook pattern the speaker chose: question");
    expect(feedback.throughline).toBe("Burn it twice and you'll still eat it.");
    expect(String(params.system)).toContain("Never comment on appearance");
    const usage = await deps.usage.summary();
    expect(usage.today.requests).toBe(1);
  });

  it("drops camera notes and quotes it can't verify when no stills were sent", async () => {
    const t = fakeTransport([textMessage({ ...cameraOut, strength: { observation: "x", quote: "words that were never said" } })]);
    const { post } = buildTestApp({ env: { ANTHROPIC_API_KEY: "sk-test" }, transport: t });
    const { feedback } = await (await post("/api/camera-feedback", body({ frames: [] }))).json();
    expect(feedback.camera).toBeNull();
    expect(feedback.strength.quote).toBeNull();
    expect(feedback.unverifiedQuotesRemoved).toBe(1);
    const user = (t.calls[0]!.messages as { content: string }[])[0]!.content;
    expect(typeof user).toBe("string");
    expect(user).toContain("No still frames were supplied");
  });

  it("passes the previous take through on a retry", async () => {
    const t = fakeTransport([textMessage(cameraOut)]);
    const { post } = buildTestApp({ env: { ANTHROPIC_API_KEY: "sk-test" }, transport: t });
    await post("/api/camera-feedback", body({ frames: [], previous: { text: "First try, rambling.", retryFocus: "Hook first." } }));
    const user = (t.calls[0]!.messages as { content: string }[])[0]!.content;
    expect(user).toContain("This is a retry");
    expect(user).toContain("Hook first.");
  });

  it("validates the request: drill, frames, and empty takes", async () => {
    const { post } = buildTestApp({ env: { ANTHROPIC_API_KEY: "sk-test" }, transport: fakeTransport([textMessage(cameraOut)]) });
    expect((await post("/api/camera-feedback", body({ drillId: "mp-explain-story" }))).status).toBe(400);
    expect((await post("/api/camera-feedback", body({ frames: [{ at: 1, jpegBase64: "iVBORw0KGgo=" }] }))).status).toBe(400); // PNG
    expect((await post("/api/camera-feedback", body({ frames: Array(4).fill({ at: 1, jpegBase64: JPEG }) }))).status).toBe(400);
    const empty = await post("/api/camera-feedback", body({ frames: [], response: { text: "um", transcriptSource: "typed-by-user", transcriptEdited: false, durationSeconds: 3 } }));
    expect(empty.status).toBe(422);
  });

  it("never stores stills and keeps them out of the dedupe key", async () => {
    const t = fakeTransport([textMessage(cameraOut)]);
    const { post, store } = buildTestApp({ env: { ANTHROPIC_API_KEY: "sk-test" }, transport: t });
    await post("/api/camera-feedback", body());
    const second = await (await post("/api/camera-feedback", body({ frames: [{ at: 2, jpegBase64: JPEG + "/9j/" }, { at: 12, jpegBase64: JPEG }, { at: 23, jpegBase64: JPEG }] }))).json();
    expect(second.deduplicated).toBe(true);
    expect(t.calls).toHaveLength(1);
    const dump = JSON.stringify([...((store as unknown as { data: Map<string, string> }).data.values())]);
    expect(dump).not.toContain(JPEG.slice(0, 40));
  });
});

describe("POST /api/camera-feedback (demo)", () => {
  it("returns clearly illustrative feedback with no camera notes", async () => {
    const { post } = buildTestApp();
    const r = await post("/api/camera-feedback", body());
    expect(r.status).toBe(200);
    const { feedback } = await r.json();
    expect(feedback.kind).toBe("illustrative");
    expect(feedback.camera).toBeNull();
    expect(feedback.hook).toBeNull();
    expect(feedback.explanation).toContain("Your hook is in sentence three");
  });
});
