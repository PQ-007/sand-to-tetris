import { describe, expect, it } from "vitest";
import { bitWireFixes } from "../src/editor/fixes";
import type { ComponentPorts } from "../src/editor/geometry";
import type { Design, Endpoint, Part } from "../src/sim/types";

const ports: ComponentPorts = {
  zero: { inputs: [], outputs: ["out"], name: "Constant 0" },
  one: { inputs: [], outputs: ["out"], name: "Constant 1" },
  and: { inputs: ["a", "b"], outputs: ["out"], name: "AND" },
};

/** "s.3" → a part pin, "a" → a port. */
const end = (s: string): Endpoint => {
  const [part, pin] = s.split(".");
  return pin === undefined ? { port: s } : { part: part ?? "", pin };
};

function design(parts: Part[], wires: [string, string][]): Design {
  return {
    format: 1,
    component: "test",
    parts,
    wires: wires.map(([from, to]) => ({ from: end(from), to: end(to) })),
  };
}

const s16: Part = { id: "s", kind: "split", width: 16 };
const j16: Part = { id: "j", kind: "join", width: 16 };
const pairs = (d: { wires: { from: Endpoint; to: Endpoint }[] }) =>
  d.wires.map((w) =>
    [w.from, w.to]
      .map((e) => ("port" in e ? e.port : `${e.part}.${e.pin}`))
      .join(" → "),
  );

describe("wiring many bits at once", () => {
  it("continues a splitter-to-joiner wire bit by bit, keeping the shift", () => {
    const d = design([s16, j16], [["s.0", "j.3"]]);
    const [fix] = bitWireFixes(d, [], ports);
    expect(fix?.kind).toBe("bits");
    expect(fix && pairs(fix)).toEqual(
      Array.from({ length: 12 }, (_, k) => `s.${k + 1} → j.${k + 4}`),
    );
  });

  it("stops at a joiner bit that's already wired", () => {
    const d = design(
      [s16, j16],
      [
        ["s.9", "j.6"],
        ["s.0", "j.3"],
      ],
    );
    expect(pairs(bitWireFixes(d, [], ports)[0] ?? { wires: [] })).toEqual([
      "s.1 → j.4",
      "s.2 → j.5",
    ]);
  });

  it("goes downward when the wire was made at the top bit", () => {
    const d = design([s16, j16], [["s.15", "j.15"]]);
    const wires = pairs(bitWireFixes(d, [], ports)[0] ?? { wires: [] });
    expect(wires).toHaveLength(15);
    expect(wires[0]).toBe("s.14 → j.14");
    expect(wires[14]).toBe("s.0 → j.0");
  });

  it("keeps the direction the learner drew the wire in", () => {
    const d = design([s16, j16], [["j.0", "s.0"]]);
    expect(pairs(bitWireFixes(d, [], ports)[0] ?? { wires: [] })[0]).toBe(
      "j.1 → s.1",
    );
  });

  it("lets a split bit feed several joiners (a split output can fan out)", () => {
    const j2: Part = { id: "k", kind: "join", width: 16 };
    const d = design(
      [s16, j16, j2],
      [
        ["s.1", "j.1"],
        ["s.0", "k.0"],
      ],
    );
    expect(pairs(bitWireFixes(d, [], ports)[0] ?? { wires: [] })[0]).toBe(
      "s.1 → k.1",
    );
  });

  it("fills a joiner's free bits from a constant", () => {
    const d = design(
      [j16, { id: "c1", kind: "one" }, { id: "c0", kind: "zero" }],
      [
        ["c1.out", "j.0"],
        ["c0.out", "j.1"],
      ],
    );
    const [fix] = bitWireFixes(d, [], ports);
    expect(fix).toMatchObject({ kind: "fill", part: "j" });
    expect(fix && pairs(fix)).toEqual(
      Array.from({ length: 14 }, (_, k) => `c0.out → j.${k + 2}`),
    );
  });

  it("fills from a 1-bit input port too, but never from an output port", () => {
    const fromInput = design([j16], [["sel", "j.0"]]);
    expect(bitWireFixes(fromInput, ["sel"], ports)[0]?.wires).toHaveLength(15);
    const toOutput = design([j16], [["j.0", "out"]]);
    expect(bitWireFixes(toOutput, ["sel"], ports)).toEqual([]);
  });

  it("offers nothing for ordinary wires or a full joiner", () => {
    const gate = design(
      [{ id: "g", kind: "and" }],
      [
        ["a", "g.a"],
        ["g.out", "out"],
      ],
    );
    expect(bitWireFixes(gate, ["a"], ports)).toEqual([]);
    const j2: Part = { id: "j", kind: "join", width: 2 };
    const full = design(
      [j2, { id: "c", kind: "zero" }],
      [
        ["c.out", "j.1"],
        ["c.out", "j.0"],
      ],
    );
    expect(bitWireFixes(full, [], ports)).toEqual([]);
    expect(bitWireFixes(design([], []), [], ports)).toEqual([]);
  });
});
