// The stack demo's model: small VM programs (docs/VM.md), and what each
// word on the stack is for, from the frames the interpreter reports. No DOM.
import type { VmFrame } from "../sim/types";

export type ProgramId = "expr" | "call" | "fact";

export const PROGRAMS: Record<ProgramId, string> = {
  expr: `func main 0 1
push 3
push 4
add
push 2
mul
set local 0
push local 0
return`,
  call: `func main 0 0
push 5
push 3
call area 2
return

func area 2 0
push arg 0
push arg 1
mul
return`,
  fact: `func main 0 0
push 3
call fact 1
return

func fact 1 0
push arg 0
push 2
lt
jumpifnot more
push 1
return
label more
push arg 0
push arg 0
push 1
sub
call fact 1
mul
return`,
};

export type Role =
  "operand" | "local" | "arg" | "saved-fp" | "return" | "result";

export interface StackRow {
  addr: number;
  value: number;
  role: Role;
  /** The function the word belongs to ("" for main's result). */
  func: string;
  /** For a local or an argument: its number. */
  index?: number;
  /** Which call it belongs to: 0 for main, 1 for what main called, … */
  depth?: number;
}

/** Every word from `sp` (words[0]) to the bottom, labelled with its role,
 * from the frames, innermost first (docs/VM.md "A function's frame"). */
export function labelStack(
  sp: number,
  words: readonly number[],
  frames: readonly VmFrame[],
): StackRow[] {
  return words.map((value, i) => {
    const addr = sp + i;
    for (const [fi, f] of frames.entries()) {
      const depth = frames.length - 1 - fi;
      const at = (row: Omit<StackRow, "addr" | "value" | "func" | "depth">) =>
        ({ addr, value, func: f.func, depth, ...row }) as StackRow;
      const off = addr - f.fp;
      const k = f.locals;
      const n = f.args;
      if (off < 0) return at({ role: "operand" });
      if (off < k) return at({ role: "local", index: off });
      if (off === k) return at({ role: "saved-fp" });
      if (off === k + 1) return at({ role: "return" });
      if (off < k + 2 + n)
        return at({ role: "arg", index: n - 1 - (off - k - 2) });
    }
    // Below every frame: main has returned, and this is its result.
    return { addr, value, role: "result", func: "" };
  });
}

/** A word as a signed number. */
export const signed = (v: number) => (v >= 0x8000 ? v - 0x10000 : v);
