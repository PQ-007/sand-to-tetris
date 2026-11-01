import { describe, expect, it } from "vitest";
import {
  bitsOf,
  formatValue,
  parseNumber,
  showValue,
} from "../src/editor/values";
import { widthFixes } from "../src/editor/fixes";
import type { Design } from "../src/sim/types";

describe("showing values", () => {
  it("writes numbers the same way everywhere: bits, small buses, hex", () => {
    expect(formatValue(1, 1)).toBe("1");
    expect(formatValue(5, 4)).toBe("5 (0101)");
    expect(formatValue(0x1234, 16)).toBe("0x1234");
    expect(formatValue(0, 16)).toBe("0x0000");
  });

  it("shows a simulated bus in hex, like the inputs and the table", () => {
    expect(showValue("4660", 16)).toBe("0x1234");
    expect(showValue("60875", 16)).toBe("0xedcb");
    expect(showValue("1", 1)).toBe("1");
    expect(showValue("Z", 1)).toBe("Z");
  });

  it("shows a bus that is all floating or all unknown as one letter", () => {
    expect(showValue("Z".repeat(16), 16)).toBe("Z");
    expect(showValue("X".repeat(16), 16)).toBe("X");
  });

  it("shows a partly known bus as bits in groups of four", () => {
    expect(showValue("0001ZZZZ00110100", 16)).toBe("0001 ZZZZ 0011 0100");
    expect(showValue("1Z0", 3)).toBe("1Z0");
    expect(showValue("X01ZZ", 5)).toBe("X 01ZZ");
  });

  it("lists bits from the most significant down", () => {
    expect(bitsOf(0x1234, 16).join("")).toBe("0001001000110100");
    expect(bitsOf(5, 4)).toEqual([0, 1, 0, 1]);
  });

  it("reads decimal, hex and binary numbers", () => {
    expect(parseNumber("13")).toBe(13);
    expect(parseNumber("0xd")).toBe(13);
    expect(parseNumber("0b1101")).toBe(13);
    expect(parseNumber("0b_1101")).toBe(13);
    expect(parseNumber("0x")).toBeUndefined();
    expect(parseNumber("12abc")).toBeUndefined();
  });
});

describe("fixes for wires of different widths", () => {
  const ports = {
    not: { inputs: ["a"], outputs: ["out"], name: "NOT" },
    mux: { inputs: ["a", "b", "sel"], outputs: ["out"], name: "MUX" },
  };
  const wire = (from: string, to: string) => {
    const end = (s: string) => {
      const [part, pin] = s.split(".");
      return pin ? { part: part!, pin } : { port: s };
    };
    return { from: end(from), to: end(to) };
  };
  const design = (
    parts: Design["parts"],
    wires: [string, string][],
  ): Design => ({
    format: 1,
    component: "x",
    parts,
    wires: wires.map(([a, b]) => wire(a, b)),
  });

  it("suggests repeating a gate wired to a 16-bit bus", () => {
    const d = design(
      [{ id: "not1", kind: "not" }],
      [
        ["a", "not1.a"],
        ["not1.out", "out"],
      ],
    );
    expect(widthFixes(d, { a: 16, out: 16 }, ports)).toEqual([
      { kind: "repeat", part: "not1", pin: "a", n: 16 },
    ]);
  });

  it("suggests sharing a 1-bit input across the copies", () => {
    const d = design(
      [{ id: "mux1", kind: "mux", repeat: 16 }],
      [
        ["a", "mux1.a"],
        ["sel", "mux1.sel"],
      ],
    );
    expect(widthFixes(d, { a: 16, sel: 1 }, ports)).toEqual([
      { kind: "share", part: "mux1", pin: "sel" },
    ]);
  });

  it("suggests nothing when the widths agree", () => {
    const d = design(
      [{ id: "mux1", kind: "mux", repeat: 16, shared: ["sel"] }],
      [
        ["a", "mux1.a"],
        ["sel", "mux1.sel"],
        ["mux1.out", "out"],
      ],
    );
    expect(widthFixes(d, { a: 16, out: 16 }, ports)).toEqual([]);
  });

  it("suggests one repeat per part, and none for splitters", () => {
    const d = design(
      [
        { id: "not1", kind: "not" },
        { id: "s", kind: "split", width: 4 },
      ],
      [
        ["a", "not1.a"],
        ["not1.out", "out"],
        ["b", "not1.a"],
        ["a", "s.in"],
      ],
    );
    // b (3 bits) would want a different repeat: the first one wins. A
    // splitter's width is its own option, not a repeat.
    expect(widthFixes(d, { a: 16, out: 16, b: 3 }, ports)).toEqual([
      { kind: "repeat", part: "not1", pin: "a", n: 16 },
    ]);
  });
});
