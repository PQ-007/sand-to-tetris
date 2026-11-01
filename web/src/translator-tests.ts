// The VM translator workshop's tests (docs/VM.md). Parse is compared with
// the reference's answer; everything else is tested by what it does: a
// small VM program is translated, assembled and run on the CPU, and its
// result, globals and screen must match the reference interpreter's. Each
// stage's tests use the learner's translation only for that stage's
// commands and the reference's for the rest, so one stage's bug never fails
// another (the calling convention in docs/VM.md makes them fit together).
// Pure: runs in the worker and in vitest; running the CPU is passed in.
import type { VmCommand, VmCtx, VmError, VmRunResult } from "./sim/types";
import { sameValue } from "./workshop-tests";
import {
  errorOf,
  translateCommands,
  translateWith,
  type TranslatorStages,
  type VmTranslation,
} from "./translator";

/** What the learner throws: a code from docs/VM.md, a message, the values,
 * and optionally the line. */
export class ThrownVmError extends Error {
  constructor(
    public code: string,
    message: string,
    public args: Record<string, string> = {},
    public line = 0,
  ) {
    super(message);
  }
}

export type TrStage =
  "parse" | "stack" | "arith" | "jumps" | "functions" | "muldiv" | "program";

export const TR_STAGES: TrStage[] = [
  "parse",
  "stack",
  "arith",
  "jumps",
  "functions",
  "muldiv",
  "program",
];

/** The commands each stage is about (bootstrap with functions, runtime
 * with muldiv). */
const OWN: Record<Exclude<TrStage, "parse" | "program">, string[]> = {
  stack: ["push", "set", "pop", "dup", "load", "store"],
  arith: [
    "add",
    "sub",
    "and",
    "or",
    "xor",
    "neg",
    "not",
    "shl",
    "shr",
    "sar",
    "eq",
    "ne",
    "lt",
    "gt",
    "le",
    "ge",
  ],
  jumps: ["label", "jump", "jumpif", "jumpifnot"],
  functions: ["func", "call", "return"],
  muldiv: ["mul", "div", "mod"],
};

/** What a run test compares. */
export interface RunState {
  halted: boolean;
  result: number;
  /** SP at the end: 0x3FFF (16383) when exactly main's result is left. */
  sp: number;
  globals: number[];
  /** The screen words that aren't 0: [index, value]. */
  screen: [number, number][];
}

export interface TrTestCase {
  stage: TrStage;
  name: string;
  /** parse: [line]. run: [source]. */
  args: unknown[];
  expected: { ok: unknown } | { error: string; line?: number };
  /** run tests: the reference's parse of every line. */
  commands?: (VmCommand | null)[];
  /** run tests: the reference's lines for every command not the stage's
   * own, by VM line; and its bootstrap and runtime. */
  ref?: Record<number, string[]>;
  refStart?: { bootstrap: string[]; runtime: string[] };
  /** program tests with mistakes: every error, as [line, code]. */
  errors?: [number, string][];
}

/** The worker's half of a test: the learner's answer or translation. */
export type TrOutcome =
  | {
      kind: "value";
      got: { ok: unknown } | { error: string; message: string; line?: number };
    }
  | { kind: "lines"; translation: VmTranslation };

export interface TrResult {
  stage: TrStage;
  name: string;
  ok: boolean;
  args: unknown[];
  expected: TrTestCase["expected"];
  got: { ok: unknown } | { error: string; message: string; line?: number };
  /** For a failed run: the assembly the learner's code made. */
  detail?: string;
}

// ---- inputs -------------------------------------------------------------------

const PARSE_LINES = [
  "push 5",
  "PUSH -1 ; comment",
  "push 0b1111_0000",
  "push 0x7FFF",
  "push 65535",
  "push local 3",
  "Push Arg 0",
  "set global 0x10",
  "pop",
  "add",
  "  return  ",
  "",
  "; only a comment",
  "jumpifnot done",
  "label loop_2",
  "func draw_row 2 3",
  "call draw_row 2",
  "push 12ab",
  "push 70000",
  "push -32769",
  "push global 4096",
  "push stack 1",
  "set 5",
  "set local",
  "frobnicate",
  "add 1",
  "push",
  "label 9lives",
  "label a__b",
  "func r3 0 0",
  "func f 100 27",
  "call f",
];

const main = (body: string, locals = 0) =>
  `func main 0 ${locals}\n${body}\nreturn`;

const STACK: [string, string][] = [
  ["push a number", main("push 1234")],
  ["push a negative number", main("push -2")],
  ["push a 16-bit number", main("push 0xBEEF")],
  ["push 0", main("push 0")],
  ["locals", main("push 5\nset local 1\npush local 1\npush local 0\nadd", 2)],
  [
    "globals",
    main("push 40\nset global 3\npush 2\nset global 0\npush global 3"),
  ],
  [
    "arguments",
    "func main 0 0\npush 10\npush 20\ncall f 2\nreturn\nfunc f 2 0\npush arg 0\npush arg 1\nsub\nreturn",
  ],
  [
    "arguments and locals together",
    "func main 0 0\npush 10\npush 20\npush 30\ncall f 3\nreturn\nfunc f 3 2\npush arg 2\nset local 1\npush arg 0\npush local 1\nsub\nreturn",
  ],
  [
    "set an argument",
    "func main 0 0\npush 1\npush 2\ncall f 2\nreturn\nfunc f 2 0\npush 7\nset arg 1\npush arg 1\npush arg 0\nsub\nreturn",
  ],
  ["pop", main("push 1\npush 2\npop")],
  ["dup", main("push 21\ndup\nadd")],
  [
    "store and load",
    main("push 0x4000\npush 0b1010\nstore\npush 0x4000\nload"),
  ],
  ["store into a global", main("push 2\npush 99\nstore\npush global 2")],
  ["load the keyboard", main("push 0x6000\nload")],
];

const ARITH_PAIRS: [string, number, number][] = [
  ["add", 30000, 30000],
  ["add", -5, 3],
  ["sub", 3, 5],
  ["sub", -32768, 1],
  ["and", 0b1100, 0b1010],
  ["or", 0b1100, 0b1010],
  ["xor", 0b1100, 0b1010],
  ["xor", -1, 0x00ff],
  ["shl", 3, 4],
  ["shl", 1, 15],
  ["shl", 1, 17],
  ["shr", -16, 2],
  ["sar", -16, 2],
  ["sar", 0x4000, 14],
];

const COMPARE_PAIRS: [number, number][] = [
  [3, 5],
  [5, 3],
  [4, 4],
  [-3, 2],
  [30000, -30000],
  [-30000, 30000],
];

const JUMPS: [string, string][] = [
  ["jump skips code", main("push 1\njump end\npop\npush 99\nlabel end")],
  [
    "jumpif jumps on 5",
    main("push 1\npush 5\njumpif yes\npush 100\nadd\nlabel yes"),
  ],
  [
    "jumpif jumps on -1",
    main("push 1\npush -1\njumpif yes\npush 100\nadd\nlabel yes"),
  ],
  [
    "jumpif doesn't jump on 0",
    main("push 1\npush 0\njumpif yes\npush 100\nadd\nlabel yes"),
  ],
  [
    "jumpifnot jumps on 0",
    main("push 1\npush 0\njumpifnot yes\npush 100\nadd\nlabel yes"),
  ],
  [
    "jumpifnot doesn't jump on 5",
    main("push 1\npush 5\njumpifnot yes\npush 100\nadd\nlabel yes"),
  ],
  [
    "a loop: 10 + 9 + ... + 1",
    main(
      "push 10\nset local 0\npush 0\nlabel loop\npush local 0\nadd\npush local 0\npush 1\nsub\ndup\nset local 0\njumpif loop",
      1,
    ),
  ],
  [
    "a jump backwards",
    main(
      "push 0\njump b\nlabel a\npush 5\nadd\njump c\nlabel b\npush 1\nadd\njump a\nlabel c",
    ),
  ],
  [
    "the same label in two functions",
    "func main 0 0\npush 3\ncall f 0\nadd\njump end\nlabel end\nreturn\nfunc f 0 0\npush 4\njump end\npush 9\nlabel end\nreturn",
  ],
];

const FUNCTIONS: [string, string][] = [
  ["main returns a number", main("push 7")],
  [
    "main's locals start at 0",
    main("push local 0\npush local 2\nor\npush 3\nadd", 3),
  ],
  [
    "a call with arguments",
    "func main 0 0\npush 10\npush 3\ncall f 2\nreturn\nfunc f 2 0\npush arg 0\npush arg 1\nsub\nreturn",
  ],
  [
    "a call in the middle of an expression",
    "func main 0 0\npush 100\npush 21\ncall double 1\nadd\nreturn\nfunc double 1 0\npush arg 0\npush arg 0\nadd\nreturn",
  ],
  [
    "a call with no arguments",
    "func main 0 0\npush 1\ncall five 0\nadd\nreturn\nfunc five 0 0\npush 5\nreturn",
  ],
  [
    "nested calls keep each frame",
    "func main 0 1\npush 2\nset local 0\npush 3\ncall f 1\npush local 0\nadd\nreturn\nfunc f 1 1\npush arg 0\nset local 0\npush local 0\ncall g 1\npush local 0\nadd\nreturn\nfunc g 1 2\npush arg 0\npush 10\nadd\nreturn",
  ],
  [
    "locals start at 0 in every call",
    "func main 0 0\ncall f 0\ncall f 0\nadd\nreturn\nfunc f 0 1\npush local 0\npush 1\nadd\ndup\nset local 0\nreturn",
  ],
  [
    "recursion: 1 + 2 + ... + 20",
    "func main 0 0\npush 20\ncall sum 1\nreturn\nfunc sum 1 0\npush arg 0\njumpif more\npush 0\nreturn\nlabel more\npush arg 0\npush arg 0\npush 1\nsub\ncall sum 1\nadd\nreturn",
  ],
  [
    "recursion: fibonacci of 12",
    "func main 0 0\npush 12\ncall fib 1\nreturn\nfunc fib 1 0\npush arg 0\npush 2\nlt\njumpifnot more\npush arg 0\nreturn\nlabel more\npush arg 0\npush 1\nsub\ncall fib 1\npush arg 0\npush 2\nsub\ncall fib 1\nadd\nreturn",
  ],
  [
    "functions named like instructions",
    "func main 0 0\ncall add 0\ncall HALT 0\nadd\nreturn\nfunc add 0 0\npush 1\nreturn\nfunc HALT 0 0\npush 2\nreturn",
  ],
  [
    "many arguments and locals",
    `func main 0 0\n${Array.from({ length: 6 }, (_, i) => `push ${i + 1}`).join("\n")}\ncall f 6\nreturn\nfunc f 6 5\npush arg 5\nset local 4\npush arg 0\npush local 4\nsub\nreturn`,
  ],
];

const MULDIV_PAIRS: [number, number][] = [
  [6, 7],
  [-6, 7],
  [-6, -7],
  [255, 257],
  [300, 300],
  [7, 2],
  [-7, 2],
  [7, -2],
  [-32768, -1],
  [-32768, 1],
  [100, 0],
  [-100, 0],
  [0, 5],
  [32767, 32767],
];

const PROGRAMS: [string, string][] = [
  ["sum with a loop", JUMPS[6]?.[1] ?? ""],
  [
    "factorial of 7",
    "func main 0 0\npush 7\ncall fact 1\nreturn\nfunc fact 1 0\npush arg 0\npush 2\nlt\njumpifnot more\npush 1\nreturn\nlabel more\npush arg 0\npush arg 0\npush 1\nsub\ncall fact 1\nmul\nreturn",
  ],
  [
    "stripes on the screen",
    "func main 0 1\n; the first 48 words of the screen: 6 rows\npush 0\nset local 0\nlabel loop\npush 0x4000\npush local 0\nadd\npush 0xF0F0\nstore\npush local 0\npush 1\nadd\ndup\nset local 0\npush 48\nlt\njumpif loop\npush 0\nreturn",
  ],
  [
    "digits of a number",
    "func main 0 1\n; the digits of 9045 in globals 0..3, from the last\npush 9045\nset local 0\npush 3\nset global 9\nlabel next\npush local 0\npush 10\nmod\npush global 9\ncall put 2\npop\npush local 0\npush 10\ndiv\ndup\nset local 0\npush global 9\npush 1\nsub\nset global 9\njumpif next\npush 0\nreturn\nfunc put 2 0\n; store arg 0 at global arg 1\npush arg 1\npush arg 0\nstore\npush 0\nreturn",
  ],
  ["unknown command", "func main 0 0\npush 1\nfrob\nreturn"],
  ["a jump to a missing label", "func main 0 0\njump nowhere"],
  ["no main", "func start 0 0\npush 0\nreturn"],
  [
    "a call with the wrong number of arguments",
    "func main 0 0\ncall f 0\nreturn\nfunc f 1 0\npush 0\nreturn",
  ],
  ["a command outside a function", "push 1\nfunc main 0 0\npush 0\nreturn"],
];

// ---- expected answers from the reference ----------------------------------------

export interface TrReference {
  parse(line: string): { ok: VmCommand | null } | { error: VmError };
  translate(cmd: VmCommand, ctx: VmCtx): string[];
  start(): { bootstrap: string[]; runtime: string[] };
  run(source: string, maxSteps: number): VmRunResult;
  /** Every error of a whole program (none if it's fine). */
  errors(source: string): VmError[];
}

/** Steps a test program may take on the CPU. */
export const MAX_CPU_STEPS = 400_000;

function lineCommands(ref: TrReference, source: string): (VmCommand | null)[] {
  const lines = source.split("\n");
  return lines.map((l) => {
    const r = ref.parse(l);
    return "ok" in r ? r.ok : null;
  });
}

function globalsOf(commands: (VmCommand | null)[]): number {
  let g = 0;
  for (const c of commands)
    if (c && (c.op === "push" || c.op === "set") && c.seg === "global")
      g = Math.max(g, c.n + 1);
  return g;
}

/** Up to 10 globals: the globals named, and the first words of RAM. */
function expectedState(
  ref: TrReference,
  source: string,
  commands: (VmCommand | null)[],
): RunState {
  const r = ref.run(source, 1_000_000);
  if ("errors" in r) throw new Error(`test program has errors: ${source}`);
  const g = Math.max(globalsOf(commands), 4);
  return {
    halted: r.halted,
    result: r.result,
    sp: 0x3fff,
    globals: r.ram.slice(0, g),
    screen: r.screen.flatMap((v, i) => (v ? [[i, v] as [number, number]] : [])),
  };
}

/** The reference's translation of every line, by line, for a stage test. */
function refLines(
  ref: TrReference,
  commands: (VmCommand | null)[],
): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  let ctx: VmCtx | null = null;
  commands.forEach((cmd, i) => {
    if (!cmd) return;
    if (cmd.op === "func")
      ctx = { func: cmd.name, args: cmd.args, locals: cmd.locals, line: 0 };
    if (!ctx) return;
    out[i + 1] = ref.translate(cmd, { ...ctx, line: i + 1 });
  });
  return out;
}

/** Every test, with its expected answer worked out by the reference. */
export function buildTranslatorTests(ref: TrReference): TrTestCase[] {
  const tests: TrTestCase[] = [];
  for (const line of PARSE_LINES) {
    const r = ref.parse(line);
    tests.push({
      stage: "parse",
      name: line,
      args: [line],
      expected: "ok" in r ? { ok: r.ok } : { error: r.error.code },
    });
  }
  const start = ref.start();
  const run = (stage: TrStage, name: string, source: string) => {
    const commands = lineCommands(ref, source);
    tests.push({
      stage,
      name,
      args: [source],
      expected: { ok: expectedState(ref, source, commands) },
      commands,
      ref: refLines(ref, commands),
      refStart: start,
    });
  };
  for (const [name, src] of STACK) run("stack", name, src);
  for (const [op, a, b] of ARITH_PAIRS)
    run("arith", `${a} ${op} ${b}`, main(`push ${a}\npush ${b}\n${op}`));
  for (const op of ["neg", "not"])
    for (const a of [5, -1, 0, -32768])
      run("arith", `${op} ${a}`, main(`push ${a}\n${op}`));
  for (const op of ["eq", "ne", "lt", "gt", "le", "ge"])
    for (const [a, b] of COMPARE_PAIRS)
      run("arith", `${a} ${op} ${b}`, main(`push ${a}\npush ${b}\n${op}`));
  for (const [name, src] of JUMPS) run("jumps", name, src);
  for (const [name, src] of FUNCTIONS) run("functions", name, src);
  for (const op of ["mul", "div", "mod"])
    for (const [a, b] of MULDIV_PAIRS)
      run("muldiv", `${a} ${op} ${b}`, main(`push ${a}\npush ${b}\n${op}`));
  for (const [name, source] of PROGRAMS) {
    const errors = ref.errors(source);
    const first = errors[0];
    if (first) {
      tests.push({
        stage: "program",
        name,
        args: [source],
        expected: { error: first.code, line: first.line },
        errors: errors.map((e) => [e.line, e.code]),
      });
    } else run("program", name, source);
  }
  return tests;
}

// ---- the worker's half: the learner's code ------------------------------------

/** Runs the learner's part of one test: their parse's answer, or the
 * translation (their stage's commands, the reference's for the rest). */
export function translateTest(
  stages: TranslatorStages,
  t: TrTestCase,
): TrOutcome {
  if (t.stage === "parse") {
    try {
      return {
        kind: "value",
        got: { ok: stages.parse(t.args[0] as string) ?? null },
      };
    } catch (e) {
      const err = errorOf(e, 0);
      return {
        kind: "value",
        got: {
          error: err.code,
          message: err.message,
          ...(err.line ? { line: err.line } : {}),
        },
      };
    }
  }
  if (t.stage === "program")
    return {
      kind: "lines",
      translation: translateWith(stages, t.args[0] as string),
    };
  const own = new Set(OWN[t.stage]);
  const ref = t.ref ?? {};
  const start = t.refStart ?? { bootstrap: [], runtime: [] };
  const mixed = {
    translate: (cmd: VmCommand, ctx: VmCtx) =>
      own.has(cmd.op) ? stages.translate(cmd, ctx) : (ref[ctx.line] ?? []),
    bootstrap: () =>
      t.stage === "functions" ? stages.bootstrap() : start.bootstrap,
    runtime: () => (t.stage === "muldiv" ? stages.runtime() : start.runtime),
  };
  return {
    kind: "lines",
    translation: translateCommands(mixed, t.commands ?? []),
  };
}

// ---- the main thread's half: run it and compare ---------------------------------

/** Assembles and runs assembly lines on the CPU (the caller has WASM). */
export type Exec = (
  lines: string[],
  sourceMap: number[],
  maxSteps: number,
  globals: number,
) => RunState | { error: string; message: string; line?: number };

/** Grades one test from the worker's outcome. */
export function gradeTest(t: TrTestCase, o: TrOutcome, exec: Exec): TrResult {
  let got: TrResult["got"];
  let detail: string | undefined;
  if (o.kind === "value") got = o.got;
  else {
    const first = o.translation.errors[0];
    if (first)
      got = { error: first.code, message: first.message, line: first.line };
    else {
      const want = "ok" in t.expected ? (t.expected.ok as RunState) : null;
      const r = exec(
        o.translation.lines,
        o.translation.sourceMap,
        MAX_CPU_STEPS,
        want?.globals.length ?? 0,
      );
      got = "error" in r ? r : { ok: r };
      detail = o.translation.lines.slice(0, 400).join("\n");
    }
  }
  let ok =
    "ok" in t.expected
      ? "ok" in got && sameValue(got.ok, t.expected.ok)
      : "error" in got &&
        got.error === t.expected.error &&
        (t.expected.line === undefined || got.line === t.expected.line);
  // A program with mistakes must get exactly its errors, not more.
  if (ok && t.errors && o.kind === "lines")
    ok = sameValue(
      o.translation.errors.map((e) => [e.line, e.code]),
      t.errors,
    );
  return {
    stage: t.stage,
    name: t.name,
    ok,
    args: t.args,
    expected: t.expected,
    got,
    ...(ok || !detail ? {} : { detail }),
  };
}

/** Loads the learner's transpiled module (CommonJS) and checks it exports
 * the stages. */
export function loadTranslator(js: string): TranslatorStages {
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", "VmError", js)(
    module,
    module.exports,
    ThrownVmError,
  );
  const missing = ["parse", "translate", "bootstrap", "runtime"].filter(
    (n) => typeof module.exports[n] !== "function",
  );
  if (missing.length)
    throw new ThrownVmError("missing", `export ${missing.join(", ")}`, {
      names: missing.join(", "),
    });
  return module.exports as unknown as TranslatorStages;
}
