import { describe, expect, it } from "vitest";
import { activeFast, fingerprint } from "../src/fast";
import type { Design } from "../src/sim/types";

const d = (wires: number, x = 0): Design => ({
  format: 1,
  component: "and",
  parts: [{ id: "g", kind: "nand", pos: [x, 0] }],
  wires: Array.from({ length: wires }, () => ({
    from: { port: "a" },
    to: { part: "g", pin: "a" },
  })),
});

describe("fast models", () => {
  it("fingerprints logic, not layout", () => {
    expect(fingerprint(d(1, 0))).toBe(fingerprint(d(1, 500)));
    expect(fingerprint(d(1))).not.toBe(fingerprint(d(2)));
  });

  it("a fast choice lapses when the design changes", () => {
    const set = { and: fingerprint(d(1)) };
    expect(activeFast(set, { and: d(1) })).toEqual(["and"]);
    expect(activeFast(set, { and: d(2) })).toEqual([]);
    expect(activeFast(set, {})).toEqual([]);
  });
});
