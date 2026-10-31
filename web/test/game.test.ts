import { describe, expect, it } from "vitest";
import {
  orderLevels,
  playLibrary,
  statuses,
  toolbox,
  type LevelEntry,
  type Progress,
} from "../src/game";
import type { Design, LevelInfo, Report } from "../src/sim/types";

function entry(
  id: string,
  layer = 1,
  requires: string[] = [],
  optional = false,
): LevelEntry {
  const level = {
    id,
    name: id.toUpperCase(),
    layer,
    goal: "",
    inputs: ["a"],
    outputs: ["out"],
    requires,
    optional,
    sequential: false,
    truth_table: "",
    hints: {},
  };
  return { info: { level, table: [] } as LevelInfo, toml: `id = "${id}"` };
}

const design = (component: string, uses: string[] = []): Design => ({
  format: 1,
  component,
  parts: uses.map((kind, i) => ({ id: `x${i}`, kind })),
  wires: [],
});

const LEVELS = [
  entry("and", 1, ["nand", "not"], true),
  entry("nor", 1, ["not"]),
  entry("nand", 1, ["not"]),
  entry("not"),
];

/** Fake checker: a design passes unless marked broken, and only if every
 * component it uses is in the library's unlocked designs. */
function fakeCheck(broken: Set<string>) {
  return (lib: { unlocked: Design[] }, level: string, d: Design): Report => {
    const unlocked = new Set(lib.unlocked.map((u) => u.component));
    const ok = !broken.has(level) && d.parts.every((p) => unlocked.has(p.kind));
    return {
      component: level,
      passed: ok,
      problems: [],
      rows: [],
      diagnostics: [],
      transistors: 0,
      cells: 0,
      depth: 0,
      random: null,
    };
  };
}

const passed = (d: Design): Progress[string] => ({
  design: d,
  passed: true,
  updated: 0,
});

describe("level order and status", () => {
  it("orders by layer, requirements first, side quests last", () => {
    expect(orderLevels(LEVELS).map((l) => l.info.level.id)).toEqual([
      "not",
      "nand",
      "nor",
      "and",
    ]);
  });

  it("opens levels whose requirements are passed", () => {
    expect(statuses(LEVELS, {}, fakeCheck(new Set()))).toEqual({
      not: "open",
      nor: "locked",
      nand: "locked",
      and: "locked",
    });
    const progress: Progress = { not: passed(design("not")) };
    expect(statuses(LEVELS, progress, fakeCheck(new Set()))).toMatchObject({
      not: "passed",
      nand: "open",
      nor: "open",
      and: "locked",
    });
  });

  it("a broken dependency breaks what's built on it", () => {
    const progress: Progress = {
      not: passed(design("not")),
      nand: passed(design("nand")),
      and: passed(design("and", ["nand", "not"])),
    };
    expect(statuses(LEVELS, progress, fakeCheck(new Set())).and).toBe("passed");
    const s = statuses(LEVELS, progress, fakeCheck(new Set(["nand"])));
    expect(s.nand).toBe("broken");
    expect(s.and).toBe("broken");
    expect(s.not).toBe("passed");
  });
});

describe("what a level may use", () => {
  const progress: Progress = {
    not: passed(design("not")),
    nand: passed(design("nand")),
  };
  const s = statuses(LEVELS, progress, fakeCheck(new Set()));

  it("layer 1 toolbox: transistors, rails and passed components, never itself", () => {
    expect(toolbox(LEVELS, s, "and").map((t) => t.kind)).toEqual([
      "pmos",
      "nmos",
      "vdd",
      "gnd",
      "not",
      "nand",
    ]);
    expect(toolbox(LEVELS, s, "nand").map((t) => t.kind)).toEqual([
      "pmos",
      "nmos",
      "vdd",
      "gnd",
      "not",
    ]);
  });

  it("higher layers get no bare transistors, and no higher-layer parts", () => {
    const levels = [...LEVELS, entry("mux", 2, ["nand"]), entry("alu", 3)];
    const st = { ...s, alu: "passed" as const };
    expect(toolbox(levels, st, "mux").map((t) => t.kind)).toEqual([
      "split",
      "join",
      "not",
      "nand",
    ]);
  });

  it("the play library holds passed designs except the level itself", () => {
    const lib = playLibrary(LEVELS, progress, s, "nand");
    expect(lib.unlocked.map((d) => d.component)).toEqual(["not"]);
    expect(lib.levels).toHaveLength(4);
  });
});
