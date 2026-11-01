import { describe, expect, it } from "vitest";
import {
  layoutTree,
  NODE_H,
  NODE_W,
  neighbours,
  type TreeInput,
} from "../src/techtree";

const LEVELS: TreeInput[] = [
  { id: "not", layer: 1, requires: [] },
  { id: "nand", layer: 1, requires: ["not"] },
  { id: "one", layer: 1, requires: ["not"] },
  { id: "and", layer: 2, requires: ["nand", "not"] },
  { id: "or", layer: 2, requires: ["nand", "not"] },
  { id: "xor", layer: 2, requires: ["and", "or"] },
  { id: "inc", layer: 2, requires: ["xor", "one"] },
  { id: "bit", layer: 3, requires: ["and"] },
  { id: "pc", layer: 3, requires: ["bit", "inc", "missing"] },
];

describe("tech tree layout", () => {
  const tree = layoutTree(LEVELS);
  const at = (id: string) => tree.nodes.find((n) => n.id === id)!;

  it("places every level once, below everything it needs", () => {
    expect(tree.nodes.map((n) => n.id).sort()).toEqual(
      LEVELS.map((l) => l.id).sort(),
    );
    for (const l of LEVELS)
      for (const r of l.requires)
        if (r !== "missing") expect(at(l.id).y).toBeGreaterThan(at(r).y);
  });

  it("keeps each layer in its own band, in order", () => {
    expect(tree.bands.map((b) => b.layer)).toEqual([1, 2, 3]);
    for (const n of tree.nodes) {
      const band = tree.bands.find((b) => b.layer === n.layer)!;
      expect(n.y).toBeGreaterThanOrEqual(band.y);
      expect(n.y + NODE_H).toBeLessThanOrEqual(band.y + band.height);
    }
    for (let i = 1; i < tree.bands.length; i++) {
      const prev = tree.bands[i - 1]!;
      expect(tree.bands[i]!.y).toBeGreaterThan(prev.y + prev.height);
    }
  });

  it("rows don't overlap and fit the width", () => {
    for (const a of tree.nodes)
      for (const b of tree.nodes)
        if (a !== b && a.y === b.y)
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(NODE_W);
    for (const n of tree.nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x + NODE_W).toBeLessThanOrEqual(tree.width);
      expect(n.y + NODE_H).toBeLessThanOrEqual(tree.height);
    }
  });

  it("puts a level under the levels it needs (fewer crossings)", () => {
    // and and or both need nand; xor is under both, centered between them.
    const mid = (id: string) => at(id).x + NODE_W / 2;
    expect(mid("xor")).toBeGreaterThanOrEqual(Math.min(mid("and"), mid("or")));
    expect(mid("xor")).toBeLessThanOrEqual(Math.max(mid("and"), mid("or")));
  });

  it("draws one edge per known requirement, bottom to top", () => {
    const known = LEVELS.flatMap((l) =>
      l.requires.filter((r) => r !== "missing").map((r) => `${r}>${l.id}`),
    );
    expect(tree.edges.map((e) => `${e.from}>${e.to}`).sort()).toEqual(
      known.sort(),
    );
    const e = tree.edges.find((x) => x.from === "bit" && x.to === "pc")!;
    expect(
      e.path.startsWith(
        `M${at("bit").x + NODE_W / 2},${at("bit").y + NODE_H} `,
      ),
    ).toBe(true);
    expect(e.path.endsWith(`${at("pc").x + NODE_W / 2},${at("pc").y}`)).toBe(
      true,
    );
  });

  it("knows what a level needs and what it unlocks", () => {
    expect(neighbours(LEVELS, "and")).toEqual({
      needs: ["nand", "not"],
      unlocks: ["xor", "bit"],
    });
    expect(neighbours(LEVELS, "pc").needs).toEqual(["bit", "inc"]);
  });
});
