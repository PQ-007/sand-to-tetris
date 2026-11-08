import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  exprText,
  tokenLabel,
  treeLayout,
  treeLines,
} from "../src/demos/compile";
import type { LangProgram, LangToken } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const tree = (src: string) => {
  const t = JSON.parse(wasm.langTokenize(src)) as { ok: LangToken[] };
  return (
    JSON.parse(wasm.langParse(JSON.stringify(t.ok))) as {
      ok: LangProgram;
    }
  ).ok;
};

describe("compiler demo", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("shows operators above their operands, in the parser's grouping", () => {
    const lines = treeLines(
      tree("fn main() -> int { var x = 2 + 3 * 4; return x; }"),
    );
    expect(lines.map((l) => "  ".repeat(l.depth) + l.text)).toEqual([
      "fn main() -> int",
      "  var x =",
      "    +",
      "      2",
      "      *",
      "        3",
      "        4",
      "  return",
      "    x",
    ]);
  });

  it("lays the tree out: children a row below, parents centred, no overlaps", () => {
    const src =
      "var squares: [int; 5];\nfn main() { for i in 0..5 { squares[i] = i * i; } }";
    const { nodes, edges, width, height } = treeLayout(treeLines(tree(src)));
    for (const [p, c] of edges) {
      expect(nodes[c]!.y).toBeGreaterThan(nodes[p]!.y);
      expect(nodes[c]!.depth).toBe(nodes[p]!.depth + 1);
    }
    // A parent sits over the middle of its children.
    const kids = (i: number) =>
      edges.filter(([p]) => p === i).map(([, c]) => nodes[c]!);
    nodes.forEach((n, i) => {
      const k = kids(i);
      if (k.length)
        expect(n.x).toBeCloseTo(
          Math.max((k[0]!.x + k[k.length - 1]!.x) / 2, n.w / 2 + 2),
        );
    });
    // Boxes in one row never overlap, and all fit the drawing.
    for (const a of nodes)
      for (const b of nodes)
        if (a !== b && a.depth === b.depth)
          expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((a.w + b.w) / 2);
    for (const n of nodes) {
      expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
      expect(n.x + n.w / 2).toBeLessThanOrEqual(width);
      expect(n.y).toBeLessThan(height);
    }
  });

  it("outlines every kind of statement and declaration", () => {
    const lines = treeLines(
      tree(
        'const T = "HI";\nvar b: [int; 4];\nfn f(a: [int]) { if a[0] < 1 and not ok() { mem[1] = -2; } else { g(); } while true { break; } for i in 0..3 { } }',
      ),
    ).map((l) => l.text);
    expect(lines).toContain('const T = "HI"');
    expect(lines).toContain("var b: [int; 4]");
    expect(lines).toContain("fn f(a: [int])");
    expect(lines).toContain("condition");
    expect(lines).toContain("mem[1] =");
    expect(lines).toContain("for i in 0..3");
    expect(lines).toContain("break");
  });

  it("writes expressions with their grouping visible", () => {
    const p = tree("fn main() { x = 1 - 2 - 3 << 1; }");
    const s = p.items[0]!.kind === "fn" ? p.items[0]!.body[0]! : null;
    expect(s?.kind === "assign" && exprText(s.value)).toBe(
      "(((1 - 2) - 3) << 1)",
    );
    expect(tokenLabel({ kind: "str", text: "A", line: 1 })).toEqual({
      text: '"A"',
      kind: "str",
    });
  });
});
