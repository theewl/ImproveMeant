import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
// Server configuration from environment variables.
// Secrets are read here and passed explicitly to providers; they are never
// sent to the client or written to logs.

export type Effort = "low" | "medium" | "high";

export interface Config {
  host: string;
  port: number;
  dataDir: string;
  accessToken: string | null;
  claude: {
    apiKey: string | null;
    model: string;
    effortCoaching: Effort;
    effortLight: Effort;
    refusalFallback: "default" | "off";
    timeoutMs: number;
    maxRetries: number;
    priceInputPerMTok: number;
    priceOutputPerMTok: number;
    priceCacheReadPerMTok: number;
  };
  limits: {
    dailyRequests: number;
    dailyCostUsd: number;
    monthlyCostUsd: number;
    dailyTranscriptionMinutes: number;
    maxResponseChars: number;
    maxSourceChars: number;
  };
  content: {
    live: "wikimedia" | "off";
    userAgent: string;
    refreshHours: number;
    minSourceChars: number;
  };
  transcription: {
    deepgramApiKey: string | null;
    model: string;
    pricePerMinuteUsd: number;
    timeoutMs: number;
  };
}

function num(env: NodeJS.ProcessEnv, key: string, def: number): number {
  const v = env[key];
  if (v == null || v === "") return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid number for ${key}`);
  return n;
}

function effort(env: NodeJS.ProcessEnv, key: string, def: Effort): Effort {
  const v = env[key];
  if (!v) return def;
  if (v === "low" || v === "medium" || v === "high") return v;
  throw new Error(`${key} must be low, medium or high`);
}

function secret(env: NodeJS.ProcessEnv, key: string): string | null {
  const v = env[key]?.trim();
  if (!v || v.startsWith("your-") || v === "placeholder") return null;
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    host: env.HOST || "127.0.0.1",
    port: num(env, "PORT", 8787),
    dataDir: env.DATA_DIR || "./data",
    accessToken: secret(env, "APP_ACCESS_TOKEN"),
    claude: {
      apiKey: secret(env, "ANTHROPIC_API_KEY"),
      model: env.CLAUDE_MODEL || "claude-opus-5-5",
      effortCoaching: effort(env, "CLAUDE_EFFORT_COACHING", "medium"),
      effortLight: effort(env, "CLAUDE_EFFORT_LIGHT", "low"),
      refusalFallback: env.CLAUDE_REFUSAL_FALLBACK === "off" ? "off" : "default",
      timeoutMs: num(env, "CLAUDE_TIMEOUT_MS", 60_000),
      maxRetries: Math.min(3, num(env, "CLAUDE_MAX_RETRIES", 1)),
      // Pricing assumptions (USD per million tokens). Defaults match published
      // claude-opus-5-5 list prices as of 2026-11; verify before relying on them.
      priceInputPerMTok: num(env, "CLAUDE_PRICE_INPUT_PER_MTOK", 4),
      priceOutputPerMTok: num(env, "CLAUDE_PRICE_OUTPUT_PER_MTOK", 20),
      priceCacheReadPerMTok: num(env, "CLAUDE_PRICE_CACHE_READ_PER_MTOK", 0.2),
    },
    limits: {
      dailyRequests: num(env, "USAGE_DAILY_REQUEST_LIMIT", 60),
      dailyCostUsd: num(env, "USAGE_DAILY_COST_LIMIT_USD", 1.5),
      monthlyCostUsd: num(env, "USAGE_MONTHLY_COST_LIMIT_USD", 20),
      dailyTranscriptionMinutes: num(env, "USAGE_DAILY_TRANSCRIPTION_MINUTES", 30),
      maxResponseChars: num(env, "MAX_RESPONSE_CHARS", 6000),
      maxSourceChars: num(env, "MAX_SOURCE_CHARS", 14000),
    },
    content: {
      live: env.LIVE_CONTENT === "off" ? "off" : "wikimedia",
      userAgent: env.CONTENT_USER_AGENT || "ClearlineMVP/0.1 (private prototype; set CONTENT_USER_AGENT with contact info)",
      refreshHours: num(env, "CONTENT_REFRESH_HOURS", 6),
      minSourceChars: num(env, "CONTENT_MIN_SOURCE_CHARS", 1800),
    },
    transcription: {
      deepgramApiKey: secret(env, "DEEPGRAM_API_KEY"),
      model: env.DEEPGRAM_MODEL || "nova-3",
      pricePerMinuteUsd: num(env, "TRANSCRIPTION_PRICE_PER_MINUTE_USD", 0.0077),
      timeoutMs: num(env, "TRANSCRIPTION_TIMEOUT_MS", 60_000),
    },
  };
}

export function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** Tiny .env loader (no dependency). Existing environment variables win. */
export function loadDotEnv() {
  const p = resolve(".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k!] !== undefined) continue;
    process.env[k!] = raw!.replace(/^["']|["']$/g, "");
  }
}
