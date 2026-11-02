// Optional on-device audio storage (IndexedDB). Audio is NOT saved unless the
// learner ticks "Keep this recording on this device". Deleting history clears it.

const DB = "clearline-audio";
const STORE = "recordings";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    let result: T;
    r.onsuccess = () => {
      result = r.result;
    };
    r.onerror = () => reject(r.error);
    t.onabort = () => {
      db.close();
      reject(t.error ?? new Error("IndexedDB transaction aborted"));
    };
    t.oncomplete = () => {
      db.close();
      resolve(result);
    };
  });
}

export const audioStore = {
  save: (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).then(() => key),
  get: (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key) as IDBRequest<Blob | undefined>),
  remove: (key: string) => tx("readwrite", (s) => s.delete(key)).then(() => undefined),
  clear: () => tx("readwrite", (s) => s.clear()).then(() => undefined),
};
