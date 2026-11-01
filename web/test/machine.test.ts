import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EXAMPLES } from "../src/machine-programs";
import { keyCode } from "../src/machine";
import type { AsmProgram } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const assemble = (src: string) =>
  JSON.parse(wasm.asmAssemble(src)) as AsmProgram;

const machine = (p: AsmProgram) =>
  new wasm.Machine(Uint16Array.from(p.code), Uint16Array.from(p.data));

describe("Machine page examples", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("every example assembles", () => {
    for (const ex of EXAMPLES)
      expect(assemble(ex.source).errors, ex.id).toEqual([]);
  });

  it("sum stores 55 and halts", () => {
    const m = machine(assemble(EXAMPLES.find((e) => e.id === "sum")!.source));
    m.run(1000);
    expect(m.halted()).toBe(true);
    expect(m.ram(0, 1)[0]).toBe(55);
  });

  it("pattern fills the screen with a checkerboard", () => {
    const p = assemble(EXAMPLES.find((e) => e.id === "pattern")!.source);
    const m = machine(p);
    m.run(100_000);
    expect(m.halted()).toBe(true);
    const s = m.screen();
    expect(s[0]).toBe(0b1111000011110000);
    expect(s[8 * 4]).toBe(0b0000111100001111); // row 4: the other pattern
    expect(s[767]).toBe(0b0000111100001111); // row 95: (95 / 4) AND 1 = 1
  });

  it("dot moves right with the arrow key", () => {
    const m = machine(assemble(EXAMPLES.find((e) => e.id === "dot")!.source));
    m.run(500); // draws the dot, waits for a key
    const at = (x: number, y: number) =>
      ((m.screen()[y * 8 + (x >> 4)]! >> (15 - (x % 16))) & 1) === 1;
    expect(at(64, 48)).toBe(true);
    m.setKey(130); // right
    m.run(500); // moves, then waits for release
    m.setKey(0);
    m.run(500);
    expect(at(64, 48)).toBe(false);
    expect(at(65, 48)).toBe(true);
  });

  it("maps keys to the provisional keyboard codes", () => {
    expect(keyCode("a")).toBe(97);
    expect(keyCode("A")).toBe(65);
    expect(keyCode(" ")).toBe(32);
    expect(keyCode("Enter")).toBe(13);
    expect(keyCode("ArrowLeft")).toBe(128);
    expect(keyCode("ArrowDown")).toBe(131);
    expect(keyCode("Tab")).toBe(null); // Tab keeps moving focus
    expect(keyCode("é")).toBe(null);
  });
});
