import { describe, expect, it } from "vitest";
import { addReviewItem, buildReviewItem, deleteReview, recordReview } from "../../src/client/lib/state";
import { emptyData, loadData, saveData, STORAGE_KEY } from "../../src/client/lib/storage";
import type { Briefing } from "../../src/shared/types";

const liveBriefing: Briefing = {
  storyId: "wp-1",
  kind: "current",
  title: "A council vote",
  points: ["p"],
  mainIdea: "The council expanded tree planting.",
  uncertainty: null,
  keyTerm: { term: "mitigation", meaning: "m", inContext: null, exampleUse: "e" },
  followUpQuestion: "q",
  source: { url: "https://x", publisher: "Wikipedia", publishedAt: "2026-11-01", retrievedAt: "2026-11-01T00:00:00Z" },
  supportingExcerpts: [],
  coverage: "full",
  generatedBy: "claude",
  generatedAt: "2026-11-01T00:00:00Z",
  sourceVersion: "1001",
};

class MemStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe("review items", () => {
  it("frames current-news ideas as 'as reported on' and keeps the source version", () => {
    const r = buildReviewItem("idea", { briefing: liveBriefing, exerciseId: "mp-explain-story", skill: "main-point" }, "2026-11-01T12:00:00.000Z");
    expect(r.prompt).toMatch(/as reported on 2026-11-01/);
    expect(r.sourceVersion).toBe("1001");
    expect(r.dueAt).toBe("2026-11-02T12:00:00.000Z");
  });

  it("phrase items ask for application in a new sentence; skill items use the reviewed later variation", () => {
    const p = buildReviewItem("phrase", { briefing: liveBriefing, exerciseId: "mp-explain-story", skill: "main-point" }, "2026-11-01T00:00:00Z");
    expect(p.applyTask).toMatch(/new sentence/);
    const s = buildReviewItem("skill", { exerciseId: "con-propose-change", skill: "conclusion" }, "2026-11-01T00:00:00Z");
    expect(s.applyTask).toMatch(/review your work by Friday/);
    expect(s.exerciseId).toBe("con-propose-change");
  });

  it("avoids duplicates, records results, and deletes", () => {
    let d = emptyData();
    const item = buildReviewItem("idea", { briefing: liveBriefing, exerciseId: "mp-explain-story", skill: "main-point" }, "2026-11-01T00:00:00Z");
    d = addReviewItem(d, item).data;
    expect(addReviewItem(d, { ...item, id: "other" }).added).toBe(false);
    d = recordReview(d, item.id, "recalled", "2026-11-02T00:00:00Z");
    expect(d.reviews[0]!.step).toBe(1);
    d = deleteReview(d, item.id);
    expect(d.reviews).toHaveLength(0);
  });
});

describe("local persistence", () => {
  it("round-trips data and survives corrupt or foreign storage", () => {
    const s = new MemStorage() as unknown as Storage;
    const d = emptyData();
    d.prefs.interests = ["science"];
    expect(saveData(d, s)).toBe(true);
    expect(loadData(s).prefs.interests).toEqual(["science"]);
    s.setItem(STORAGE_KEY, "{not json");
    expect(loadData(s)).toEqual(emptyData());
    s.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadData(s)).toEqual(emptyData());
  });

  it("reports failure when storage refuses writes", () => {
    const full = { setItem: () => { throw new Error("QuotaExceeded"); } } as unknown as Storage;
    expect(saveData(emptyData(), full)).toBe(false);
  });
});

import { exportJson } from "../../src/client/lib/storage";

describe("data export", () => {
  it("includes everything except the access token", () => {
    const d = emptyData();
    d.prefs.accessToken = "secret-token";
    d.reframes.push({ id: "t", at: "2026-11-01", situation: "", thought: "x", beliefBefore: 50, traps: [], evidenceAgainst: "", friendAdvice: "", balanced: "y" });
    const out = JSON.parse(exportJson(d, new Date("2026-11-02T00:00:00Z")));
    expect(out.exportedAt).toBe("2026-11-02T00:00:00.000Z");
    expect(out.data.reframes).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain("secret-token");
  });
});
