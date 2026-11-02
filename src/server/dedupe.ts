// Duplicate-request protection.
// - Concurrent requests with the same key share one in-flight promise.
// - Successful results are remembered for a while, so a double-submit or
//   network retry returns the same answer without a second paid call.
// - Failures are not cached, so the user can retry deliberately.

export class Deduper {
  private inflight = new Map<string, Promise<unknown>>();
  private done = new Map<string, { at: number; value: unknown }>();

  constructor(
    private ttlMs = 60 * 60 * 1000,
    private maxEntries = 500,
  ) {}

  async run<T>(key: string, fn: () => Promise<T>): Promise<{ value: T; deduplicated: boolean }> {
    const cached = this.done.get(key);
    if (cached && Date.now() - cached.at < this.ttlMs) return { value: cached.value as T, deduplicated: true };
    const pending = this.inflight.get(key);
    if (pending) return { value: (await pending) as T, deduplicated: true };
    const p = fn();
    this.inflight.set(key, p);
    try {
      const value = await p;
      this.done.set(key, { at: Date.now(), value });
      if (this.done.size > this.maxEntries) {
        const oldest = this.done.keys().next().value;
        if (oldest !== undefined) this.done.delete(oldest);
      }
      return { value, deduplicated: false };
    } finally {
      this.inflight.delete(key);
    }
  }
}
