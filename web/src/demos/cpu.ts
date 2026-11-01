// The chapter's CPU demo: small programs, and what each instruction
// changed. The CPU itself is s2t-isa's reference CPU, run through the
// WASM core (`isaTrace`); this file only compares states. No DOM.
import type { IsaState, IsaTrace } from "../sim/types";

/** Programs as instruction words (docs/ISA.md). The listing in the demo
 * comes from the core's disassembler; a test checks both. */
export const PROGRAMS = {
  // SET r0, 0 · SET r1, 10 · loop: ADD r0, r0, r1 · SUBI r1, 1 · JNZ loop · JMP 0
  sum: [0x4000, 0x440a, 0x0010, 0x4701, 0xcbfe, 0xc000],
  // SET r1, 21 · CALL double · SET r2, 1 · JMP 0 · double: ADD r1, r1, r1 · RET
  call: [0x4415, 0xe003, 0x4801, 0xc000, 0x0490, 0xf700],
  // r1 = 0x4000 (screen) · r2 = 0x81ff · STORE · LOAD · SHR 4 · STORE a row down · JMP 0
  screen: [
    0x4400, 0x4540, 0x48ff, 0x4981, 0xa880, 0x8c80, 0x6da4, 0xac88, 0xc000,
  ],
} as const;

export type ProgramId = keyof typeof PROGRAMS;

/** `JMP 0`: a jump to itself, how a program stops. */
export const HALT = 0xc000;

/** The instruction group (bits 15–13), for its explanation. */
export type Group =
  "alu" | "cmp" | "imm" | "shift" | "load" | "store" | "jump" | "call";

export function group(word: number): Group {
  const groups: Group[] = [
    "alu",
    "cmp",
    "imm",
    "shift",
    "load",
    "store",
    "jump",
    "call",
  ];
  return groups[(word >> 13) & 7] ?? "alu";
}

export type Change =
  | { kind: "reg"; reg: number; from: number; to: number }
  | { kind: "flags"; z: boolean; n: boolean; c: boolean }
  | { kind: "mem"; addr: number; value: number }
  | { kind: "jump"; to: number };

/** What instruction `i` of a trace changed. A write of the same value
 * still counts for memory (it happened), but not for registers. */
export function changes(t: IsaTrace, i: number): Change[] {
  const before = t.states[i];
  const after = t.states[i + 1];
  if (!before || !after) return [];
  const out: Change[] = [];
  after.regs.forEach((v, r) => {
    const from = before.regs[r] ?? 0;
    if (v !== from) out.push({ kind: "reg", reg: r, from, to: v });
  });
  if (flagsDiffer(before, after))
    out.push({ kind: "flags", z: after.z, n: after.n, c: after.c });
  const w = t.writes[i];
  if (w) out.push({ kind: "mem", addr: w[0], value: w[1] });
  if (after.pc !== ((before.pc + 1) & 0xffff))
    out.push({ kind: "jump", to: after.pc });
  return out;
}

function flagsDiffer(a: IsaState, b: IsaState): boolean {
  return a.z !== b.z || a.n !== b.n || a.c !== b.c;
}

/** Index of the first step whose instruction is the halt, or the trace
 * length if it never halts. */
export function haltStep(t: IsaTrace, rom: readonly number[]): number {
  const i = t.states.findIndex((s) => rom[s.pc] === HALT);
  return i < 0 ? t.states.length - 1 : i;
}

/** The screen's top-left 16 × 2 pixels after `writes` up to step `i`
 * (rows at 0x4000 and 0x4008; the leftmost pixel is bit 15). */
export function screenCorner(t: IsaTrace, i: number): boolean[][] {
  const words = [0, 0];
  t.writes.slice(0, i).forEach((w) => {
    if (w && (w[0] === 0x4000 || w[0] === 0x4008))
      words[w[0] === 0x4000 ? 0 : 1] = w[1];
  });
  return words.map((v) =>
    Array.from({ length: 16 }, (_, x) => ((v >> (15 - x)) & 1) === 1),
  );
}

/** A register value as text: decimal, with hex for big numbers. */
export function showWord(v: number): string {
  return v > 255 ? `${v} (0x${v.toString(16).padStart(4, "0")})` : String(v);
}
