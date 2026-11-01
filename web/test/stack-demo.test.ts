import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { labelStack, PROGRAMS, signed } from "../src/demos/stack";
import type { VmFrame } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

/** Runs a demo program on the interpreter, labelling the stack each step. */
function steps(id: keyof typeof PROGRAMS) {
  const r = new wasm.VmRunner(PROGRAMS[id]);
  const out = [];
  for (let i = 0; i < 200 && !r.halted(); i++) {
    r.step();
    const frames = JSON.parse(r.frames()) as VmFrame[];
    out.push({
      line: r.line(),
      rows: labelStack(r.sp(), Array.from(r.stack()), frames),
    });
  }
  r.free();
  return out;
}

describe("stack demo", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("every program runs to its result", () => {
    const last = (id: keyof typeof PROGRAMS) => steps(id).at(-1)!.rows;
    expect(last("expr")).toEqual([
      { addr: 0x3fff, value: 14, role: "result", func: "" },
    ]);
    expect(last("call")[0]?.value).toBe(15);
    expect(last("fact")[0]?.value).toBe(6);
  });

  it("labels a frame: operands, locals, saved FP, return address, args", () => {
    // In area(5, 3), after push arg 0 and push arg 1.
    const s = steps("call");
    const at = s.find(
      (x) =>
        x.rows.filter((r) => r.role === "operand" && r.func === "area")
          .length === 2,
    )!;
    expect(
      at.rows.map((r) => [r.role, r.func, r.index, signed(r.value)]),
    ).toEqual([
      ["operand", "area", undefined, 3],
      ["operand", "area", undefined, 5],
      ["saved-fp", "area", undefined, 0x3ffe],
      ["return", "area", undefined, at.rows[3]!.value],
      ["arg", "area", 1, 3],
      ["arg", "area", 0, 5],
      ["saved-fp", "main", undefined, 0x4000],
      ["return", "main", undefined, 0xffff - 0x10000],
    ]);
    // main's local in the expression program.
    const e = steps("expr");
    expect(e.at(-3)!.rows.find((r) => r.role === "local")).toEqual({
      addr: 0x3ffd,
      value: 14,
      role: "local",
      func: "main",
      index: 0,
      depth: 0,
    });
  });

  it("recursion stacks one frame per call, each its own depth", () => {
    const deep = steps("fact").find((x) => x.rows.some((r) => r.depth === 3))!;
    expect(
      deep.rows.filter((r) => r.role === "arg").map((r) => [r.depth, r.value]),
    ).toEqual([
      [3, 1],
      [2, 2],
      [1, 3],
    ]);
    const deepest = Math.max(
      ...steps("fact").map(
        (x) => x.rows.filter((r) => r.role === "saved-fp").length,
      ),
    );
    expect(deepest).toBe(4); // main, fact(3), fact(2), fact(1)
  });
});
