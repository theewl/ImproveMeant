import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface KeyValueStore {
  read<T>(name: string): T | null;
  write(name: string, value: unknown): void;
}

function checkKey(name: string): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(name)) throw new Error("Invalid store key");
}

/** Minimal JSON file store with atomic writes. Adequate for a single-process private MVP. */
export class FileStore implements KeyValueStore {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  private path(name: string): string {
    checkKey(name);
    return join(this.dir, name + ".json");
  }

  read<T>(name: string): T | null {
    const p = this.path(name);
    if (!existsSync(p)) return null;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as T;
    } catch {
      return null;
    }
  }

  write(name: string, value: unknown): void {
    const p = this.path(name);
    const tmp = `${p}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(value, null, 2));
    renameSync(tmp, p);
  }
}

/** In-memory store for tests. */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  read<T>(name: string): T | null {
    checkKey(name);
    const v = this.data.get(name);
    return v ? (JSON.parse(v) as T) : null;
  }
  write(name: string, value: unknown): void {
    checkKey(name);
    this.data.set(name, JSON.stringify(value));
  }
}
