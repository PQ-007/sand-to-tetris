import { describe, expect, it } from "vitest";
import { labelPoint, route, shapeOf } from "../src/editor/geometry";
import { hidesPinNames, symbolOf, symbolPaths } from "../src/editor/symbols";

const two = { inputs: ["a", "b"], outputs: ["out"] };

describe("schematic symbols", () => {
  it("draws gates with their distinctive shapes", () => {
    expect(symbolOf("nand")).toEqual({
      kind: "gate",
      gate: "and",
      invert: true,
    });
    expect(symbolOf("nor")).toMatchObject({ gate: "or", invert: true });
    expect(symbolOf("xor")).toMatchObject({ gate: "xor", invert: false });
    expect(symbolOf("not")).toMatchObject({ gate: "not", invert: true });
    expect(symbolOf("and16")).toMatchObject({ gate: "and", bits: 16 });
    expect(symbolOf("or8way")).toMatchObject({ gate: "or", bits: 8 });
  });

  it("draws selectors as trapezoids and the rest as boxes", () => {
    expect(symbolOf("mux4way16").kind).toBe("mux");
    expect(symbolOf("dmux8way").kind).toBe("dmux");
    expect(symbolOf("one")).toEqual({ kind: "const", value: 1 });
    expect(symbolOf("alu").kind).toBe("box");
    expect(symbolOf("register").kind).toBe("box");
  });

  it("only plain boxes and selectors keep their pin names", () => {
    expect(hidesPinNames(symbolOf("and"))).toBe(true);
    expect(hidesPinNames(symbolOf("mux"))).toBe(false);
    expect(hidesPinNames(symbolOf("alu"))).toBe(false);
  });

  it("runs a lead from every pin to the body", () => {
    const shape = shapeOf("nand", two);
    const p = symbolPaths(symbolOf("nand"), shape);
    for (const pin of shape.pins)
      expect(p?.lines).toContain(`${pin.at[0]},${pin.at[1]}`);
    // The output lead starts after the bubble.
    expect(p?.bubble).toEqual([24, 0]);
    expect(p?.lines).toContain("M28,0 L40,0");
    expect(symbolPaths(symbolOf("alu"), shape)).toBeUndefined();
  });

  it("labels a bus gate with its width", () => {
    const p = symbolPaths(symbolOf("and16"), shapeOf("and16", two));
    expect(p?.text?.value).toBe("16");
  });

  it("puts a selector's sel pin at the bottom", () => {
    const s = shapeOf("mux", { inputs: ["a", "b", "sel"], outputs: ["out"] });
    expect(s.pins.map((p) => [p.pin, p.side])).toEqual([
      ["a", "left"],
      ["b", "left"],
      ["sel", "bottom"],
      ["out", "right"],
    ]);
    const sel = s.pins.find((p) => p.pin === "sel");
    expect(sel?.at).toEqual([0, s.height / 2]);
    expect(sel?.vertical).toBe(true);
    const d = shapeOf("dmux", { inputs: ["in", "sel"], outputs: ["a", "b"] });
    expect(d.pins.find((p) => p.pin === "in")?.at).toEqual([-40, 0]);
    expect(d.pins.find((p) => p.pin === "sel")?.side).toBe("bottom");
  });

  it("gives constants a small shape with one output", () => {
    const s = shapeOf("zero", { inputs: [], outputs: ["out"] });
    expect(s.width).toBe(40);
    expect(s.pins).toEqual([{ pin: "out", at: [20, 0], side: "right" }]);
  });
});

describe("routing into a bottom pin", () => {
  it("from below: across, then up", () => {
    expect(route([0, 100], [50, 60], false, true)).toEqual([
      [0, 100],
      [50, 100],
      [50, 60],
    ]);
  });

  it("from above: around underneath, never through the part", () => {
    expect(route([0, 0], [100, 60], false, true)).toEqual([
      [0, 0],
      [50, 0],
      [50, 80],
      [100, 80],
      [100, 60],
    ]);
  });

  it("is the same wire whichever end it starts from", () => {
    expect(route([100, 60], [0, 0], true, false)).toEqual(
      route([0, 0], [100, 60], false, true).reverse(),
    );
  });

  it("labels an L on its longer leg", () => {
    expect(
      labelPoint([
        [0, 100],
        [50, 100],
        [50, 60],
      ]),
    ).toEqual([25, 100]);
  });
});
