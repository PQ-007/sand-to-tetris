// Saves the learner's toolchain code (their assembler, later more) in the
// browser, next to their circuit progress. Falls back to memory, like
// progress.ts, when storage is unavailable.

export interface WorkshopEntry {
  code: string;
  /** Every test passed with exactly this code. */
  passed: boolean;
  updated: number;
}

export type Workshop = Record<string, WorkshopEntry>;

export interface WorkshopStore {
  load(): Promise<Workshop>;
  save(id: string, entry: WorkshopEntry): Promise<void>;
  replaceAll(all: Workshop): Promise<void>;
}

export function memoryWorkshop(initial: Workshop = {}): WorkshopStore {
  let data: Workshop = structuredClone(initial);
  return {
    load: async () => structuredClone(data),
    save: async (id, e) => {
      data[id] = structuredClone(e);
    },
    replaceAll: async (all) => {
      data = structuredClone(all);
    },
  };
}

const DB = "sand-to-tetris-workshop";
const STORE = "code";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function open(): Promise<WorkshopStore> {
  try {
    const o = indexedDB.open(DB, 1);
    o.onupgradeneeded = () => o.result.createObjectStore(STORE);
    const db = await request(o);
    const tx = (mode: IDBTransactionMode) =>
      db.transaction(STORE, mode).objectStore(STORE);
    return {
      async load() {
        const store = tx("readonly");
        const [keys, values] = await Promise.all([
          request(store.getAllKeys()),
          request(store.getAll() as IDBRequest<WorkshopEntry[]>),
        ]);
        const out: Workshop = {};
        keys.forEach((k, i) => {
          const v = values[i];
          if (typeof k === "string" && v) out[k] = v;
        });
        return out;
      },
      async save(id, e) {
        await request(tx("readwrite").put(e, id));
      },
      async replaceAll(all) {
        const store = tx("readwrite");
        await request(store.clear());
        for (const [id, e] of Object.entries(all))
          await request(store.put(e, id));
      },
    };
  } catch {
    return memoryWorkshop();
  }
}

let store: Promise<WorkshopStore> | undefined;

/** The one workshop store for this page (opened once). */
export function workshopStore(): Promise<WorkshopStore> {
  store ??= open();
  return store;
}

/** Checks an imported file's workshop part. */
export function isWorkshop(x: unknown): x is Workshop {
  if (!x || typeof x !== "object") return false;
  return Object.values(x).every(
    (e) =>
      e &&
      typeof e === "object" &&
      typeof (e as WorkshopEntry).code === "string" &&
      typeof (e as WorkshopEntry).passed === "boolean",
  );
}
