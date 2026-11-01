// Saves the learner's designs and passes in the browser (IndexedDB).
// Falls back to memory when storage is unavailable (private windows,
// blocked site data), and says so, rather than failing.
import { t } from "./i18n";
import type { LevelProgress, Progress } from "./game";

export interface ProgressStore {
  /** False when progress only lives in memory for this visit. */
  persistent: boolean;
  load(): Promise<Progress>;
  save(id: string, p: LevelProgress): Promise<void>;
  replaceAll(all: Progress): Promise<void>;
}

export function memoryStore(initial: Progress = {}): ProgressStore {
  let data: Progress = structuredClone(initial);
  return {
    persistent: false,
    load: async () => structuredClone(data),
    save: async (id, p) => {
      data[id] = structuredClone(p);
    },
    replaceAll: async (all) => {
      data = structuredClone(all);
    },
  };
}

const DB = "sand-to-tetris";
const STORE = "progress";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function openStore(): Promise<ProgressStore> {
  try {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    const db = await request(open);
    const tx = (mode: IDBTransactionMode) =>
      db.transaction(STORE, mode).objectStore(STORE);
    return {
      persistent: true,
      async load() {
        const store = tx("readonly");
        const [keys, values] = await Promise.all([
          request(store.getAllKeys()),
          request(store.getAll() as IDBRequest<LevelProgress[]>),
        ]);
        const out: Progress = {};
        keys.forEach((k, i) => {
          const v = values[i];
          if (typeof k === "string" && v) out[k] = v;
        });
        return out;
      },
      async save(id, p) {
        await request(tx("readwrite").put(p, id));
      },
      async replaceAll(all) {
        const store = tx("readwrite");
        await request(store.clear());
        for (const [id, p] of Object.entries(all))
          await request(store.put(p, id));
      },
    };
  } catch {
    return memoryStore();
  }
}

/** Checks that an imported file looks like saved progress. */
export function parseProgressFile(text: string): Progress | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return t("progress.badJson");
  }
  const file = data as { app?: unknown; progress?: unknown };
  if (
    file?.app !== "sand-to-tetris" ||
    typeof file.progress !== "object" ||
    !file.progress
  ) {
    return t("progress.notOurs");
  }
  for (const [id, p] of Object.entries(
    file.progress as Record<string, LevelProgress>,
  )) {
    if (
      !p ||
      typeof p.passed !== "boolean" ||
      p.design?.format !== 1 ||
      p.design.component !== id
    ) {
      return t("progress.damaged", { id });
    }
  }
  return file.progress as Progress;
}

export function progressFile(progress: Progress): string {
  return JSON.stringify(
    { app: "sand-to-tetris", version: 1, progress },
    null,
    2,
  );
}
