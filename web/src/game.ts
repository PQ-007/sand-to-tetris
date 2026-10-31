// Which levels are open, passed or broken, and what each level may use.
// Pure: the check function is passed in, so this is testable without WASM.
import { PRIMITIVES } from "./editor/model";
import type { Design, LevelInfo, LibraryInput, Report } from "./sim/types";

export interface LevelProgress {
  design: Design;
  /** The learner pressed Check and it passed (with the designs of the time). */
  passed: boolean;
  updated: number;
}

export type Progress = Record<string, LevelProgress>;

export type Status = "locked" | "open" | "passed" | "broken";

export interface LevelEntry {
  info: LevelInfo;
  toml: string;
}

/** Levels in play order: by layer, then so that requirements come first. */
export function orderLevels(levels: LevelEntry[]): LevelEntry[] {
  const byId = new Map(levels.map((l) => [l.info.level.id, l]));
  const out: LevelEntry[] = [];
  const seen = new Set<string>();
  const visit = (l: LevelEntry) => {
    if (seen.has(l.info.level.id)) return;
    seen.add(l.info.level.id);
    for (const r of l.info.level.requires) {
      const dep = byId.get(r);
      if (dep) visit(dep);
    }
    out.push(l);
  };
  [...levels]
    .sort(
      (a, b) =>
        a.info.level.layer - b.info.level.layer ||
        Number(a.info.level.optional) - Number(b.info.level.optional) ||
        a.info.level.id.localeCompare(b.info.level.id),
    )
    .forEach(visit);
  return out;
}

export function libraryFor(
  levels: LevelEntry[],
  working: Record<string, Design>,
  exclude?: string,
): LibraryInput {
  return {
    levels: levels.map((l) => l.toml),
    unlocked: Object.entries(working)
      .filter(([id]) => id !== exclude)
      .map(([, d]) => d),
  };
}

/**
 * Re-checks every passed level in play order. A level stays "passed" only
 * if it still passes using the *current* designs of the levels it uses;
 * otherwise it is "broken" and stops counting as unlocked, so anything
 * built on it shows as broken too.
 *
 * Passed memory components (registers, RAM: sequential with a model) run
 * as their fast models here, as in `s2t check-all`: each one's own check
 * already compared it with that model, and fully flattened a RAM is tens
 * of thousands of gates. This is bookkeeping only; what runs in the editor
 * stays the learner's choice (see fast.ts).
 */
export function statuses(
  levels: LevelEntry[],
  progress: Progress,
  check: (library: LibraryInput, level: string, design: Design) => Report,
): Record<string, Status> {
  const ordered = orderLevels(levels);
  const working: Record<string, Design> = {};
  const out: Record<string, Status> = {};
  for (const l of ordered) {
    const id = l.info.level.id;
    const p = progress[id];
    if (p?.passed) {
      const fast = Object.keys(working).filter((k) => {
        const l = levels.find((e) => e.info.level.id === k)?.info.level;
        return Boolean(l?.sequential && l.model);
      });
      const report = check(
        { ...libraryFor(levels, working, id), fast },
        id,
        p.design,
      );
      if (report.passed) {
        working[id] = p.design;
        out[id] = "passed";
      } else {
        out[id] = "broken";
      }
    }
  }
  for (const l of ordered) {
    const id = l.info.level.id;
    if (out[id]) continue;
    const open = l.info.level.requires.every((r) => out[r] === "passed");
    out[id] = open ? "open" : "locked";
  }
  return out;
}

/**
 * Whether saving a design can change any level's status: only if the level
 * was passed (others may be built on it) or has just been passed. Editing
 * a level you haven't passed can't affect anything else.
 */
export function needsRecheck(
  progress: Progress,
  id: string,
  passed: boolean | undefined,
): boolean {
  return passed !== undefined || Boolean(progress[id]?.passed);
}

/** The library a level is played with: every passed (not broken) design. */
export function playLibrary(
  levels: LevelEntry[],
  progress: Progress,
  status: Record<string, Status>,
  level: string,
  fast: string[] = [],
): LibraryInput {
  const working: Record<string, Design> = {};
  for (const [id, p] of Object.entries(progress)) {
    if (status[id] === "passed") working[id] = p.design;
  }
  return {
    ...libraryFor(levels, working, level),
    fast: fast.filter((f) => f !== level && working[f]),
  };
}

export interface ToolboxItem {
  kind: string;
  label: string;
  primitive: boolean;
}

const PRIMITIVE_LABEL: Record<string, string> = {
  pmos: "PMOS",
  nmos: "NMOS",
  vdd: "VDD (1)",
  gnd: "GND (0)",
};

/**
 * What the toolbox offers: transistors and rails in Layer 1, plus every
 * passed component from this layer or below (never the level itself).
 */
export function toolbox(
  levels: LevelEntry[],
  status: Record<string, Status>,
  level: string,
): ToolboxItem[] {
  const me = levels.find((l) => l.info.level.id === level)?.info.level;
  if (!me) return [];
  const items: ToolboxItem[] =
    me.layer === 1
      ? PRIMITIVES.map((k) => ({
          kind: k,
          label: PRIMITIVE_LABEL[k] ?? k,
          primitive: true,
        }))
      : [];
  if (me.layer >= 2) {
    // Buses arrive in Layer 2: wiring parts route bits, they add no logic.
    items.push({ kind: "split", label: "Splitter", primitive: false });
    items.push({ kind: "join", label: "Joiner", primitive: false });
  }
  for (const l of orderLevels(levels)) {
    const c = l.info.level;
    if (c.id !== level && c.layer <= me.layer && status[c.id] === "passed") {
      items.push({ kind: c.id, label: c.name, primitive: false });
    }
  }
  return items;
}
