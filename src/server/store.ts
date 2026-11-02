import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Small async key/value store for server-side state (usage ledger, shared caches).
 * File-backed locally; Redis-backed on serverless hosts where local files don't persist.
 */
export interface KeyValueStore {
  readonly kind: "file" | "memory" | "redis";
  read<T>(name: string): Promise<T | null>;
  write(name: string, value: unknown): Promise<void>;
}

function checkKey(name: string): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) throw new Error("Invalid store key");
}

/** JSON file store with atomic writes. Adequate for a single-process server. */
export class FileStore implements KeyValueStore {
  readonly kind = "file" as const;
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(name: string): string {
    checkKey(name);
    return join(this.dir, name + ".json");
  }

  async read<T>(name: string): Promise<T | null> {
    const p = this.path(name);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
      return null;
    }
  }

  async write(name: string, value: unknown): Promise<void> {
    const p = this.path(name);
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, p);
  }
}

/** In-memory store for tests. */
export class MemoryStore implements KeyValueStore {
  readonly kind = "memory" as const;
  private data = new Map<string, string>();
  async read<T>(name: string): Promise<T | null> {
    checkKey(name);
    const v = this.data.get(name);
    return v ? (JSON.parse(v) as T) : null;
  }
  async write(name: string, value: unknown): Promise<void> {
    checkKey(name);
    this.data.set(name, JSON.stringify(value));
  }
}

/** Minimal Redis surface we use (satisfied by @upstash/redis). */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
}

/** Redis-backed store (Upstash REST) for serverless deployments. */
export class RedisStore implements KeyValueStore {
  readonly kind = "redis" as const;
  constructor(
    private redis: RedisLike,
    private prefix = "clearline:",
    /** Keys expire after this many seconds so caches and old ledgers don't accumulate. */
    private ttlSeconds = 120 * 24 * 3600,
  ) {}
  async read<T>(name: string): Promise<T | null> {
    checkKey(name);
    const v = await this.redis.get<unknown>(this.prefix + name);
    if (v == null) return null;
    // @upstash/redis auto-parses JSON; tolerate raw strings too.
    return (typeof v === "string" ? JSON.parse(v) : v) as T;
  }
  async write(name: string, value: unknown): Promise<void> {
    checkKey(name);
    await this.redis.set(this.prefix + name, JSON.stringify(value), { ex: this.ttlSeconds });
  }
}
