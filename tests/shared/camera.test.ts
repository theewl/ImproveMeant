import { describe, expect, it } from "vitest";
import { CAMERA_DRILLS, cameraProgress, fillerWords, genericWords, hookText, measureCameraTake, nextCameraDrill, viewerAddress, wordsPerMinute } from "../../src/shared/camera";
import { getExercise } from "../../src/shared/curriculum";
import type { PracticeSession } from "../../src/shared/types";

const take = (drillId: string, completed = true, extra: Partial<PracticeSession> = {}): PracticeSession => ({
  id: `s-${drillId}-${Math.random()}`,
  mode: "camera",
  startedAt: "2026-11-02T10:00:00Z",
  completedAt: completed ? "2026-11-02T10:02:00Z" : undefined,
  exerciseId: drillId,
  skill: "main-point",
  camera: { drillId, topic: "", notes: "" },
  attempts: [],
  followUps: [],
  usedLive: false,
  ...extra,
});

describe("camera drills", () => {
  it("defines eleven drills in level order with unique ids and reachable exercises", () => {
    expect(CAMERA_DRILLS).toHaveLength(11);
    expect(CAMERA_DRILLS.map((d) => d.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(new Set(CAMERA_DRILLS.map((d) => d.id)).size).toBe(11);
    for (const d of CAMERA_DRILLS) {
      expect(getExercise(d.id).id).toBe(d.id);
      expect(d.goodLooksLike).toHaveLength(3);
      if (d.needsTopic) expect(d.prompt).toContain("{topic}");
    }
  });

  it("suggests the first untried drill, then the least practised", () => {
    expect(nextCameraDrill([]).id).toBe("cam-press-record");
    expect(nextCameraDrill([take("cam-press-record")]).id).toBe("cam-one-person");
    // An unfinished take doesn't count.
    expect(nextCameraDrill([take("cam-press-record"), take("cam-one-person", false)]).id).toBe("cam-one-person");
    const all = CAMERA_DRILLS.map((d) => take(d.id));
    expect(nextCameraDrill([...all, take("cam-press-record")]).id).toBe("cam-one-person");
  });

  it("reports progress per drill with the latest completion", () => {
    const p = cameraProgress([take("cam-story"), take("cam-story", true, { completedAt: "2026-11-03T09:00:00Z" })]);
    const story = p.find((x) => x.drill.id === "cam-story")!;
    expect(story.completed).toBe(2);
    expect(story.lastAt).toBe("2026-11-03T09:00:00Z");
    expect(p.find((x) => x.drill.id === "cam-hook")!.completed).toBe(0);
  });
});

describe("camera measures", () => {
  it("counts fillers and general words as whole phrases", () => {
    const f = fillerWords("Um, so I like, you know, went to the market. It was like, um, busy. Unlike before.");
    expect(f.items.find((x) => x.phrase === "um")?.count).toBe(2);
    expect(f.items.find((x) => x.phrase === "like")?.count).toBe(2); // "unlike" not counted
    expect(f.items.find((x) => x.phrase === "you know")?.count).toBe(1);
    const g = genericWords("It was amazing, really amazing, and the soup was so good.");
    expect(g.items.find((x) => x.phrase === "amazing")?.count).toBe(2);
    expect(g.items.find((x) => x.phrase === "so good")?.count).toBe(1);
  });

  it("extracts the opening a viewer hears and counts direct address", () => {
    const text = Array.from({ length: 40 }, (_, i) => `w${i}`).join(" ");
    expect(hookText(text).split(" ")).toHaveLength(25);
    expect(hookText(text).endsWith("…")).toBe(true);
    expect(hookText("Short one.")).toBe("Short one.");
    expect(viewerAddress("If you've ever done this, you know. Your call.")).toBe(3);
  });

  it("computes pace only for takes long enough to mean something", () => {
    expect(wordsPerMinute("one two three four five six", 3)).toBeNull();
    expect(wordsPerMinute("word ".repeat(150), 60)).toBe(150);
    const m = measureCameraTake("word ".repeat(150) + "you um", 60, "browser-speech");
    expect(m.map((x) => x.label)).toEqual(["Pace", "Fillers", "Talking to the viewer"]);
    expect(m[1]!.basis).toMatch(/undercounts/);
  });
});
