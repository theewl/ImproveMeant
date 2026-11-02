import { describe, expect, it } from "vitest";
import { restorePath } from "../../src/server/vercel";
import { RedisStore, type RedisLike } from "../../src/server/store";
import { UsageMeter } from "../../src/server/usage";
import { testConfig } from "../helpers";

class FakeRedis implements RedisLike {
  data = new Map<string, unknown>();
  ttl = new Map<string, number | undefined>();
  async get<T>(k: string) {
    const v = this.data.get(k);
    // Mimic @upstash/redis auto-deserialising JSON strings.
    return (typeof v === "string" ? JSON.parse(v) : (v ?? null)) as T;
  }
  async set(k: string, v: unknown, o?: { ex?: number }) {
    this.data.set(k, v);
    this.ttl.set(k, o?.ex);
    return "OK";
  }
}

describe("Vercel routing", () => {
  it("restores /api paths rewritten to /api?__path=…, keeping other query params", () => {
    expect(restorePath("/api?__path=status")).toBe("/api/status");
    expect(restorePath("/api?__path=stories&interests=science,health")).toBe("/api/stories?interests=science%2Chealth");
    expect(restorePath("/api?__path=stories%2Fwp-1%2Fbriefing&refresh=1")).toBe("/api/stories/wp-1/briefing?refresh=1");
    expect(restorePath("/api/stories?interests=x")).toBe("/api/stories?interests=x");
  });
});

describe("RedisStore", () => {
  it("round-trips JSON under a prefix with an expiry, and backs the usage limits", async () => {
    const redis = new FakeRedis();
    const store = new RedisStore(redis);
    await store.write("briefing-x", { a: 1 });
    expect(await store.read("briefing-x")).toEqual({ a: 1 });
    expect(redis.ttl.get("clearline:briefing-x")).toBeGreaterThan(0);
    expect(await store.read("missing")).toBeNull();

    // Two meters sharing one Redis (like two serverless instances) see the same usage.
    const cfg = testConfig({ USAGE_DAILY_REQUEST_LIMIT: "1" });
    const a = new UsageMeter(store, cfg);
    const b = new UsageMeter(store, cfg);
    await a.record({ kind: "feedback", provider: "claude", model: "m", inputTokens: 10, outputTokens: 10, costUsd: 0.001, ok: true });
    await expect(b.assertClaudeAllowed(0.01)).rejects.toMatchObject({ code: "usage_limit" });
  });
});
