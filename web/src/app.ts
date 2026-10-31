// App-wide state: the core, the levels and the learner's progress.
import { levelFiles } from "virtual:s2t-content";
import { activeFast, loadFast, saveFast, type FastSet } from "./fast";
import {
  needsRecheck,
  statuses,
  type LevelEntry,
  type Progress,
  type Status,
} from "./game";
import { openStore, type ProgressStore } from "./progress";
import { check, levelInfo, loadCore } from "./sim/core";
import type { Design } from "./sim/types";

export interface App {
  levels: LevelEntry[];
  progress: Progress;
  status: Record<string, Status>;
  store: ProgressStore;
  /** Components chosen to run as fast models (with design fingerprints). */
  fast: FastSet;
}

let app: Promise<App> | undefined;

export function getApp(): Promise<App> {
  app ??= (async () => {
    await loadCore();
    const levels = levelFiles.map((f) => ({
      info: levelInfo(f.toml),
      toml: f.toml,
    }));
    const store = await openStore();
    const progress = await store.load();
    return {
      levels,
      progress,
      store,
      fast: loadFast(),
      status: statuses(levels, progress, check),
    };
  })();
  return app;
}

export function recompute(a: App): void {
  a.status = statuses(a.levels, a.progress, check);
}

export async function saveDesign(
  a: App,
  id: string,
  design: Design,
  passed?: boolean,
): Promise<void> {
  const prev = a.progress[id];
  const recheck = needsRecheck(a.progress, id, passed);
  a.progress[id] = {
    design,
    passed: passed ?? prev?.passed ?? false,
    updated: Date.now(),
  };
  if (recheck) recompute(a);
  await a.store.save(id, a.progress[id]);
}

export async function replaceProgress(
  a: App,
  progress: Progress,
): Promise<void> {
  a.progress = progress;
  recompute(a);
  await a.store.replaceAll(progress);
}

export function levelEntry(a: App, id: string): LevelEntry | undefined {
  return a.levels.find((l) => l.info.level.id === id);
}

/** Components currently running as fast models (passed, design unchanged). */
export function fastIds(a: App): string[] {
  const designs: Record<string, Design> = {};
  for (const [id, p] of Object.entries(a.progress)) {
    if (a.status[id] === "passed") designs[id] = p.design;
  }
  return activeFast(a.fast, designs);
}

export function setFast(a: App, id: string, fingerprint: string | null): void {
  if (fingerprint) a.fast[id] = fingerprint;
  else delete a.fast[id];
  saveFast(a.fast);
}
