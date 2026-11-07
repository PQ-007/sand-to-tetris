// Which levels are open, passed or broken, and what each level may use.
// Pure: the check function is passed in, so this is testable without WASM.
import { PRIMITIVES } from "./editor/model";
import type { Design, LevelInfo, LibraryInput, Report } from "./sim/types";
import { ROADMAP_INDEX } from "./roadmap";

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

/**
 * Levels in play order: the course roadmap (by layer, then stage by
 * stage; side quests stay where the roadmap puts them), with requirements
 * always first; levels the roadmap doesn't list come after it, side
 * quests last, by name.
 */
export function orderLevels(levels: LevelEntry[]): LevelEntry[] {
  const byId = new Map(levels.map((l) => [l.info.level.id, l]));
  const out: LevelEntry[] = [];
  const seen = new Set<string>();
  const place = (l: LevelEntry) =>
    ROADMAP_INDEX.get(l.info.level.id) ?? Infinity;
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
        place(a) - place(b) ||
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
      const fast = memoryParts(levels, Object.keys(working));
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
 * The memory components (sequential, with a model: registers, RAM, the
 * CPU, the memory map) among `ids`. Checks run these as their models: each
 * one's own check compared it with that model on random clock cycles, and
 * fully flattened they are far too big (a RAM16K is millions of gates).
 */
export function memoryParts(levels: LevelEntry[], ids: string[]): string[] {
  return ids.filter((k) => {
    const l = levels.find((e) => e.info.level.id === k)?.info.level;
    return Boolean(l?.sequential && l.model);
  });
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

/**
 * The parts a level is built from: its `requires` from Layer 2 up (check-all
 * makes each reference use exactly those). Layer 1 is built from
 * transistors; there `requires` only sets the order levels open.
 */
export function builtFrom(level: { layer: number; requires: string[] }) {
  return level.layer === 1 ? [] : level.requires;
}

/**
 * The levels built from `id`: what the part is for. check-all makes sure
 * every required level is used by a required level, up to the computer.
 */
export function usedIn(
  levels: { id: string; layer: number; requires: string[] }[],
  id: string,
): string[] {
  return levels.filter((l) => builtFrom(l).includes(id)).map((l) => l.id);
}

/** The next level to play after `id` in `order`, skipping side quests. */
export function nextLevel(
  order: { id: string; optional: boolean }[],
  id: string,
): string | undefined {
  const at = order.findIndex((l) => l.id === id);
  return order.slice(at + 1).find((l) => !l.optional)?.id;
}

export interface ToolboxItem {
  kind: string;
  label: string;
  primitive: boolean;
  /** One of the parts this level is meant to be built from (shown first;
   * the rest wait behind "More parts"). */
  suggested: boolean;
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
          suggested: true,
        }))
      : [];
  if (me.layer >= 2) {
    // Buses arrive in Layer 2: wiring parts route bits, they add no logic.
    // They're suggested where the level has a bus to take apart.
    const bus = Object.values(me.widths ?? {}).some((w) => w > 1);
    for (const [kind, label] of [
      ["split", "Splitter"],
      ["join", "Joiner"],
    ] as const)
      items.push({ kind, label, primitive: false, suggested: bus });
  }
  for (const l of orderLevels(levels)) {
    const c = l.info.level;
    if (c.id !== level && c.layer <= me.layer && status[c.id] === "passed") {
      items.push({
        kind: c.id,
        label: c.name,
        primitive: false,
        suggested: builtFrom(me).includes(c.id),
      });
    }
  }
  return items;
}
