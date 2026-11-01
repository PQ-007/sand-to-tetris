import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  changes,
  group,
  haltStep,
  PROGRAMS,
  screenCorner,
  showWord,
} from "../src/demos/cpu";
import type { IsaTrace } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

// The demo's programs run on the real reference CPU (WASM).
const trace = (rom: readonly number[], steps = 40): IsaTrace =>
  JSON.parse(wasm.isaTrace(JSON.stringify(rom), steps)) as IsaTrace;

describe("CPU demo", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("lists its programs as the intended assembly", () => {
    const asm = (p: readonly number[]) => p.map((w) => wasm.disassemble(w));
    expect(asm(PROGRAMS.sum)).toEqual([
      "SET r0, 0",
      "SET r1, 10",
      "ADD r0, r0, r1",
      "SUBI r1, 1",
      "JNZ -2",
      "JMP 0",
    ]);
    expect(asm(PROGRAMS.call)).toEqual([
      "SET r1, 21",
      "CALL 3",
      "SET r2, 1",
      "JMP 0",
      "ADD r1, r1, r1",
      "RET",
    ]);
    expect(asm(PROGRAMS.screen)).toEqual([
      "SET r1, 0",
      "SETH r1, 64",
      "SET r2, 255",
      "SETH r2, 129",
      "STORE r2, [r1 + 0]",
      "LOAD r3, [r1 + 0]",
      "SHR r3, r3, 4",
      "STORE r3, [r1 + 8]",
      "JMP 0",
    ]);
  });

  it("finds what each instruction changed", () => {
    const t = trace(PROGRAMS.sum);
    expect(changes(t, 1)).toEqual([{ kind: "reg", reg: 1, from: 0, to: 10 }]);
    expect(changes(t, 2)).toEqual([{ kind: "reg", reg: 0, from: 0, to: 10 }]);
    // SUBI sets flags (10 - 1: carry, i.e. no borrow); JNZ jumps back.
    expect(changes(t, 3)).toContainEqual({
      kind: "flags",
      z: false,
      n: false,
      c: true,
    });
    expect(changes(t, 4)).toEqual([{ kind: "jump", to: 2 }]);
    const end = haltStep(t, PROGRAMS.sum);
    expect(t.states[end]?.regs[0]).toBe(55);
    expect(t.states[end]?.pc).toBe(5);
  });

  it("follows a call and its return", () => {
    const t = trace(PROGRAMS.call);
    expect(changes(t, 1)).toEqual([
      { kind: "reg", reg: 7, from: 0, to: 2 },
      { kind: "jump", to: 4 },
    ]);
    expect(changes(t, 3)).toEqual([{ kind: "jump", to: 2 }]);
    expect(t.states[haltStep(t, PROGRAMS.call)]?.regs[1]).toBe(42);
  });

  it("draws on the screen", () => {
    const t = trace(PROGRAMS.screen);
    expect(changes(t, 4)).toEqual([
      { kind: "mem", addr: 0x4000, value: 0x81ff },
    ]);
    const corner = screenCorner(t, haltStep(t, PROGRAMS.screen));
    expect(corner[0]?.map(Number).join("")).toBe("1000000111111111");
    expect(corner[1]?.map(Number).join("")).toBe("0000100000011111");
  });

  it("names instruction groups and shows words", () => {
    expect(PROGRAMS.call.map(group)).toEqual([
      "imm",
      "call",
      "imm",
      "jump",
      "alu",
      "call",
    ]);
    expect(showWord(42)).toBe("42");
    expect(showWord(0x4000)).toBe("16384 (0x4000)");
  });
});
