import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EXAMPLES } from "../src/machine-programs";
import { keyCode } from "../src/machine";
import { BUILTIN_OS, withOs } from "../src/os";
import { en } from "../src/i18n/en";
import { mn } from "../src/i18n/mn";
import type { AsmProgram, LangCompiled, VmBuilt } from "../src/sim/types";
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

  const build = (id: string) => {
    const b = JSON.parse(
      wasm.vmBuild(EXAMPLES.find((e) => e.id === id)!.source),
    ) as VmBuilt;
    expect(b.errors, id).toEqual([]);
    return b.program;
  };

  /** A C Shard example with the OS in front (as the page does), compiled,
   * translated and assembled. */
  const shard = (id: string) => {
    const src = withOs(BUILTIN_OS, EXAMPLES.find((e) => e.id === id)!.source);
    const c = JSON.parse(wasm.langCompile(src.source)) as LangCompiled;
    expect(c.errors, id).toEqual([]);
    const b = JSON.parse(wasm.vmBuild(c.vm.join("\n"))) as VmBuilt;
    expect(b.errors, id).toEqual([]);
    return b.program;
  };

  it("every example builds", () => {
    for (const ex of EXAMPLES)
      if (ex.lang === "asm")
        expect(assemble(ex.source).errors, ex.id).toEqual([]);
      else if (ex.lang === "vm") build(ex.id);
      else shard(ex.id);
  });

  it("Bitfall shows its title, starts on a key and draws the board", () => {
    const m = machine(shard("bitfall"));
    const at = (x: number, y: number) =>
      ((m.screen()[y * 8 + (x >> 4)]! >> (15 - (x % 16))) & 1) === 1;
    m.run(3_000_000);
    expect(at(20, 20)).toBe(true); // the title box
    m.setKey(32);
    m.run(100_000);
    m.setKey(0);
    m.run(5_000_000);
    expect(at(42, 6) && at(84, 88)).toBe(true); // the board's frame
    expect(m.halted()).toBe(false); // the game loop keeps running
  });

  it("the OS example writes text, waits for a key, rolls a dice", () => {
    const m = machine(shard("shard-hello"));
    m.run(3_000_000);
    const word = (x: number, y: number) =>
      ((m.screen()[y * 8 + (x >> 4)]! >> (15 - (x % 16))) & 1) === 1;
    expect(word(0, 0) && word(127, 95)).toBe(true); // the frame
    expect(word(29, 18) || word(28, 18) || word(30, 18)).toBe(true); // "H"
    m.setKey(65);
    m.run(200_000);
    m.setKey(0);
    m.run(3_000_000);
    expect(m.halted()).toBe(true);
  });

  it("C Shard examples: sum, boxes, dot", () => {
    const m = machine(shard("shard-sum"));
    m.run(100_000);
    expect(m.halted()).toBe(true);
    expect(m.ram(0x3fff, 1)[0]).toBe(55);
    const b = machine(shard("shard-box"));
    b.run(5_000_000);
    expect(b.halted()).toBe(true);
    const at = (mm: typeof b, x: number, y: number) =>
      ((mm.screen()[y * 8 + (x >> 4)]! >> (15 - (x % 16))) & 1) === 1;
    expect(at(b, 8, 4)).toBe(true);
    expect(at(b, 119, 91)).toBe(true);
    expect(at(b, 60, 50)).toBe(false);
    const d = machine(shard("shard-dot"));
    d.run(2_000_000);
    expect(at(d, 64, 48)).toBe(true);
    d.setKey(130);
    d.run(2_000_000);
    d.setKey(0);
    d.run(2_000_000);
    expect(at(d, 64, 48)).toBe(false);
    expect(at(d, 65, 48)).toBe(true);
  });

  it("VM examples: sum, factorial, stripes", () => {
    for (const [id, result] of [
      ["vm-sum", 55],
      ["vm-fact", 5040],
      ["vm-stripes", 0],
    ] as const) {
      const m = machine(build(id));
      m.run(200_000);
      expect(m.halted(), id).toBe(true);
      expect(m.ram(0x3fff, 1)[0], id).toBe(result);
    }
    const m = machine(build("vm-stripes"));
    m.run(200_000);
    expect(m.screen()[0]).toBe(0x8080);
    expect(m.screen()[8]).toBe(0x4040);
    expect(m.screen()[8 * 9]).toBe(0x4040);
  });

  it("the VM dot moves with the arrow keys", () => {
    const m = machine(build("vm-dot"));
    const at = (x: number, y: number) =>
      ((m.screen()[y * 8 + (x >> 4)]! >> (15 - (x % 16))) & 1) === 1;
    m.run(5000);
    expect(at(64, 48)).toBe(true);
    m.setKey(129); // up
    m.run(5000);
    m.setKey(0);
    m.run(5000);
    expect(at(64, 48)).toBe(false);
    expect(at(64, 47)).toBe(true);
    m.setKey(128); // left, twice
    m.run(5000);
    m.setKey(0);
    m.run(5000);
    m.setKey(128);
    m.run(5000);
    m.setKey(0);
    m.run(5000);
    expect(at(62, 47)).toBe(true);
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

  it("every example has a name in both languages", () => {
    for (const ex of EXAMPLES) {
      expect(en, ex.id).toHaveProperty([`machine.ex.${ex.id}`]);
      expect(mn, ex.id).toHaveProperty([`machine.ex.${ex.id}`]);
    }
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
