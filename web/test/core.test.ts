import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadLevels } from "../content/load";
import type { LevelInfo, Report, SimView } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

// Loads the real WASM build (from `npm run build:wasm`) and real level
// files, so the TypeScript types and the Rust JSON can't drift apart.
const levels = loadLevels(
  new URL("../../hdl/levels", import.meta.url).pathname,
);
const library = JSON.stringify({
  levels: levels.map((l) => l.toml),
  unlocked: [],
});

const inverter = {
  format: 1,
  component: "not",
  parts: [
    { id: "p1", kind: "pmos" },
    { id: "n1", kind: "nmos" },
    { id: "v", kind: "vdd" },
    { id: "g", kind: "gnd" },
  ],
  wires: [
    { from: { port: "a" }, to: { part: "p1", pin: "gate" } },
    { from: { port: "a" }, to: { part: "n1", pin: "gate" } },
    { from: { part: "v", pin: "out" }, to: { part: "p1", pin: "source" } },
    { from: { part: "p1", pin: "drain" }, to: { port: "out" } },
    { from: { part: "n1", pin: "drain" }, to: { port: "out" } },
    { from: { part: "g", pin: "out" }, to: { part: "n1", pin: "source" } },
  ],
};

describe("simulator core (WASM)", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("reports its version and netlist format", () => {
    expect(wasm.coreVersion()).toMatch(/^\d+\.\d+\.\d+ \(format 1\)$/);
  });

  it("parses every level, with its truth table", () => {
    for (const l of levels) {
      const info = JSON.parse(wasm.levelInfo(l.toml)) as LevelInfo;
      expect(info.level.id).toBe(l.id);
      const bits = info.level.inputs.reduce(
        (n, p) => n + (info.level.widths?.[p] ?? 1),
        0,
      );
      // Small levels list every input; wide ones have a model for the rest.
      if (info.level.model) expect(info.table.length).toBeGreaterThan(0);
      else expect(info.table.length).toBe(2 ** bits);
    }
  });

  it("checks and simulates a design", () => {
    const report = JSON.parse(
      wasm.check(library, "not", JSON.stringify(inverter)),
    ) as Report;
    expect(report.passed).toBe(true);
    const view = JSON.parse(
      wasm.simulate(library, "not", JSON.stringify(inverter), '{"a":0}'),
    ) as SimView;
    expect(view.outputs).toEqual([["out", "1"]]);
    expect(view.transistors).toContainEqual({ part: "p1", state: "on" });
    expect(view.values).toContainEqual({
      endpoint: { part: "n1", pin: "drain" },
      value: "1",
      width: 1,
    });
  });

  it("throws plain-language errors", () => {
    expect(() => wasm.check(library, "zzz", "{}")).toThrow(
      "no level `zzz` in the library",
    );
  });
});
