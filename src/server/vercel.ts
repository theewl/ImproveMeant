// Vercel serverless entry. Bundled by scripts/build-vercel.mjs into
// .vercel/output/functions/api.func/index.mjs (Build Output API v3).
//
// Serverless instances don't share memory or disk, so server state (usage
// ledger, caches) lives in Upstash Redis. Without Redis, AI features are
// refused rather than run without enforceable spending limits.

import type { IncomingMessage, ServerResponse } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { Hono } from "hono";
import { Redis } from "@upstash/redis";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createServices } from "./services";
import { MemoryStore, RedisStore, type KeyValueStore } from "./store";
import { AppError } from "./errors";

const env = process.env;
const cfg = loadConfig(env);
const redisUrl = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
const redisToken = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
const store: KeyValueStore = redisUrl && redisToken ? new RedisStore(new Redis({ url: redisUrl, token: redisToken })) : new MemoryStore();

const deps = createServices(cfg, { store });
const paid = deps.coach.kind === "claude" || deps.transcription !== null;
const inner = createApp(deps);

// Opt-out for personal use: run without shared storage. Spending limits then only
// apply within each short-lived instance, so the owner tracks spend themselves
// (e.g. an Anthropic Console spend limit), and live-news briefings may be regenerated.
const skipSharedStorage = /^(1|true|yes)$/i.test(env.SKIP_SHARED_STORAGE ?? "");

let app: Hono = inner;
if (paid && store.kind !== "redis" && !skipSharedStorage) {
  app = new Hono();
  app.get("/api/status", (c) => inner.fetch(c.req.raw));
  app.get("/api/health", (c) => inner.fetch(c.req.raw));
  app.all("/api/*", (c) =>
    c.json(
      new AppError(
        "not_configured",
        "Storage isn't connected, so spending limits can't be enforced. Add Upstash Redis to this Vercel project, or set SKIP_SHARED_STORAGE=true to track spending yourself, then redeploy.",
        503,
      ).toJSON(),
      503,
    ),
  );
}

const listener = getRequestListener(app.fetch);

/** Vercel routes /api/* here as /api?__path=*; restore the original path for Hono. */
export function restorePath(url: string): string {
  const u = new URL(url, "http://x");
  const p = u.searchParams.get("__path");
  if (p === null) return url;
  u.searchParams.delete("__path");
  const qs = u.searchParams.toString();
  return `/api/${p.replace(/^\/+/, "")}${qs ? `?${qs}` : ""}`;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  req.url = restorePath(req.url ?? "/");
  return listener(req, res);
}
