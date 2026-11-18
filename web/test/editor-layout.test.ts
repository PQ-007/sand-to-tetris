import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadLevels } from "../content/load";
import { GRID, shapeOfPart, type ComponentPorts } from "../src/editor/geometry";
import { tidy } from "../src/editor/layout";
import type { Design, LevelInfo } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

// Tidy up runs on every reference design: it must keep the circuit, put
// every part on the grid with no two overlapping, and read left to right.
const levels = loadLevels(
  new URL("../../hdl/levels", import.meta.url).pathname,
);
let infos: LevelInfo[] = [];
let ports: ComponentPorts = {};

beforeAll(() => {
  wasm.initSync({
    module: readFileSync(
      new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
    ),
  });
  infos = levels.map((l) => JSON.parse(wasm.levelInfo(l.toml)) as LevelInfo);
  ports = Object.fromEntries(
    infos.map((i) => [
      i.level.id,
      {
        inputs: i.level.inputs,
        outputs: i.level.outputs,
        name: i.level.name,
        widths: i.level.widths,
      },
    ]),
  );
});

function reference(id: string, layer: number): Design {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../hdl/levels/layer${layer}/${id}/reference.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Design;
}

const boxOf = (d: Design, id: string) => {
  const p = d.parts.find((x) => x.id === id);
  if (!p?.pos) throw new Error(`no position for ${id}`);
  const s = shapeOfPart(p, ports);
  return {
    x0: p.pos[0] - s.width / 2,
    x1: p.pos[0] + s.width / 2,
    y0: p.pos[1] - s.height / 2,
    y1: p.pos[1] + s.height / 2,
  };
};

describe("tidy up", () => {
  it("keeps every reference circuit, on the grid, with no parts overlapping", () => {
    for (const info of infos) {
      const { id, layer, inputs, outputs } = info.level;
      const before = reference(id, layer);
      const after = tidy(before, inputs, outputs, (p) => shapeOfPart(p, ports));
      expect(after.wires).toEqual(before.wires);
      expect(after.parts.map(({ id, kind }) => [id, kind])).toEqual(
        before.parts.map(({ id, kind }) => [id, kind]),
      );
      for (const p of after.parts)
        for (const v of p.pos ?? [NaN, NaN])
          expect(v % GRID, `${id}/${p.id} on the grid`).toBe(0);
      const ids = after.parts.map((p) => p.id);
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const a = boxOf(after, ids[i] ?? "");
          const b = boxOf(after, ids[j] ?? "");
          const overlap =
            a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
          expect(overlap, `${id}: ${ids[i]} overlaps ${ids[j]}`).toBe(false);
        }
      // Every port gets a spot: inputs left of every part, outputs right.
      const left = Math.min(...after.parts.map((p) => boxOf(after, p.id).x0));
      const right = Math.max(...after.parts.map((p) => boxOf(after, p.id).x1));
      for (const n of inputs)
        expect(after.port_pos?.[n]?.[0]).toBeLessThan(left);
      for (const n of outputs)
        expect(after.port_pos?.[n]?.[0], `${id} ${n}`).toBeGreaterThan(right);
    }
  });

  it("puts a part after the parts that feed it", () => {
    // AND = NAND then NOT.
    const and = tidy(reference("and", 2), ["a", "b"], ["out"], (p) =>
      shapeOfPart(p, ports),
    );
    const at = (k: string) =>
      and.parts.find((p) => p.kind === k)?.pos?.[0] ?? 0;
    expect(at("nand")).toBeLessThan(at("not"));
  });

  it("stacks a transistor circuit from VDD down to GND", () => {
    const not = tidy(reference("not", 1), ["a"], ["out"], (p) =>
      shapeOfPart(p, ports),
    );
    const y = (k: string) => not.parts.find((p) => p.kind === k)?.pos?.[1] ?? 0;
    expect(y("vdd")).toBeLessThan(y("pmos"));
    expect(y("pmos")).toBeLessThan(y("nmos"));
    expect(y("nmos")).toBeLessThan(y("gnd"));
    // NAND: the two NMOS in series sit on different rows.
    const nand = tidy(reference("nand", 1), ["a", "b"], ["out"], (p) =>
      shapeOfPart(p, ports),
    );
    const nmos = nand.parts
      .filter((p) => p.kind === "nmos")
      .map((p) => p.pos?.[1]);
    expect(new Set(nmos).size).toBe(2);
  });

  it("lays out a loop (a latch) without giving up", () => {
    const latch = tidy(reference("srlatch", 3), ["s", "r"], ["q"], (p) =>
      shapeOfPart(p, ports),
    );
    expect(latch.parts.every((p) => p.pos)).toBe(true);
  });

  it("leaves an empty design alone", () => {
    const empty: Design = { format: 1, component: "x", parts: [], wires: [] };
    expect(tidy(empty, ["a"], ["out"], (p) => shapeOfPart(p, ports))).toBe(
      empty,
    );
  });
});
