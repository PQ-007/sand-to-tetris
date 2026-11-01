// The C Shard compiler workshop's tests (docs/LANGUAGE.md). tokenize, parse
// and check are compared with the reference's answers; each is fed the
// reference's output of the stage before, so one stage's bug never fails
// the next. generate (and whole programs) are tested by what the code does:
// the VM code runs on the reference interpreter, and its result, globals
// and screen must match the reference compiler's. Pure: runs in the worker
// and in vitest; running the VM is passed in.
import { compileWith, type CompilerStages } from "./compiler";
import type {
  LangCompiled,
  LangError,
  LangInfo,
  LangProgram,
  LangToken,
  VmRunResult,
} from "./sim/types";
import { errorOf } from "./translator";
import { sameValue } from "./workshop-tests";

/** What the learner throws: a code from docs/LANGUAGE.md, a message, the
 * values, and the line. */
export class CompileError extends Error {
  constructor(
    public code: string,
    message: string,
    public args: Record<string, string> = {},
    public line = 0,
  ) {
    super(message);
  }
}

export type CmStage = "tokenize" | "parse" | "check" | "generate" | "program";

export const CM_STAGES: CmStage[] = [
  "tokenize",
  "parse",
  "check",
  "generate",
  "program",
];

/** What a run compares. */
export interface ShardRun {
  halted: boolean;
  result: number;
  /** The first words of RAM: the globals. */
  globals: number[];
  /** The screen words that aren't 0: [index, value]. */
  screen: [number, number][];
}

export interface CmTestCase {
  stage: CmStage;
  name: string;
  /** tokenize: [source]; parse: [tokens]; check: [program];
   * generate: [program, info]; program: [source]. */
  args: unknown[];
  expected: { ok: unknown } | { error: string; line?: number };
  /** generate / program: how many globals words to compare. */
  globals?: number;
}

export type CmOutcome =
  | {
      kind: "value";
      got: { ok: unknown } | { error: string; message: string; line?: number };
    }
  | { kind: "vm"; compiled: LangCompiled };

export interface CmResult {
  stage: CmStage;
  name: string;
  ok: boolean;
  args: unknown[];
  expected: CmTestCase["expected"];
  got: { ok: unknown } | { error: string; message: string; line?: number };
  /** For a failed run: the VM code the learner's compiler made. */
  detail?: string;
}

// ---- inputs ---------------------------------------------------------------------

const TOKENIZE = [
  "var x = 1;",
  "fn main() -> int { return 0x2A + 0b101; }",
  "while x <= 10 { x = x >> 1; } // a comment",
  "var a = 'A';\nvar s = \"HI\\n\";\n\nfor i in 0..9 { }",
  "mem[0x4000] = ~5 & 3 | 2 ^ 1 << 4;",
  "if a != b and not c or d >= e { }",
  "const N: int = 1_000;",
  "var q = '\\'';",
  "",
  "x = 12ab;",
  "x = 70000;",
  "x = 'AB';",
  'x = "open',
  "x = #;",
  "y = !x;",
  "\n\n@",
];

const PARSE = [
  "var x: int = 1;",
  "var board: [int; 20];",
  "var flag: bool;",
  'const S = "HI";',
  "const T: [int; 3] = [1, 2, 3];",
  "fn f(a: int, b: [bool]) -> bool { return a > 0 and b[0]; }",
  "fn main() { x = 1 + 2 * 3 - 4; }",
  "fn main() { y = a | b ^ c & d << 1 + 2 * -e; }",
  "fn main() { z = not a == b or c < d and ~e != 0; }",
  "fn main() { if a { x = 1; } else if b { x = 2; } else { x = 3; } }",
  "fn main() { while x < 3 { x = x + 1; } }",
  "fn main() { for i in 0..n { break; continue; } }",
  "fn main() { return; }",
  "fn main() -> int { return (1 + 2) * 3; }",
  "fn main() { f(1, g(2)); mem[a] = b[i]; }",
  "fn main() { var ok: bool = true; var n = -5; }",
  "fn main() {\n  var x = 1\n}",
  "fn main() { x = ; }",
  "x = 1;",
  "fn main( { }",
  "var a: [str; 3];",
  "fn main() { if 1 < 2 < 3 { } }",
  "fn main() {",
];

const CHECK_OK = [
  "fn main() { }",
  'const ROWS = 4;\nconst TITLE = "HI";\nvar board: [int; ROWS * 2];\nvar score = 5;\nvar over: bool;\nconst SHAPES: [int; 2] = [3, 0];\nfn main() { }',
  "fn sum(a: [int], n: int) -> int {\n  var t = 0;\n  for i in 0..n { var x = a[i]; t = t + x; }\n  return t;\n}\nfn main() -> int { return 0; }",
  "fn f(x: int) -> bool { if x > 0 { return true; } else { return false; } }\nfn main() { var b = f(1); var r: [int] = T; }\nconst T = [1, 2];",
];

const CHECK_ERRORS: [string, string][] = [
  ["type-mismatch", "fn main() {\n var x = 1;\n x = true;\n}"],
  ["condition not bool", "fn main() {\n if 5 { }\n}"],
  ["int + bool", "fn main() -> int {\n return 1 + true;\n}"],
  ["nothing used as a value", "fn f() { }\nfn main() {\n var x = f() + 1;\n}"],
  ["return without a value", "fn f() -> int {\n return;\n}\nfn main() { }"],
  [
    "wrong array type",
    "var a: [bool; 2];\nfn f(x: [int]) { }\nfn main() {\n f(a);\n}",
  ],
  ["unknown name", "fn main() {\n x = 1;\n}"],
  ["unknown function", "fn main() {\n g();\n}"],
  ["duplicate global", "var a = 1;\nfn a() { }\nfn main() { }"],
  ["local with a global's name", "var a = 1;\nfn main() {\n var a = 2;\n}"],
  ["out of scope", "fn main() {\n if true { var t = 1; }\n var u = t;\n}"],
  ["reserved name", "var _x = 1;\nfn main() { }"],
  ["not a function", "var x = 1;\nfn main() {\n x(2);\n}"],
  ["not a value", "fn f() { }\nfn main() {\n var y = f;\n}"],
  ["arg count", "fn f(a: int) { }\nfn main() {\n f(1, 2);\n}"],
  ["assign to a constant", "const N = 3;\nfn main() {\n N = 4;\n}"],
  ["assign to a whole array", "var a: [int; 2];\nfn main() {\n a = 4;\n}"],
  ["index a number", "var x = 1;\nfn main() {\n var y = x[0];\n}"],
  ["not constant", "var x = 1;\nvar y = x + 1;\nfn main() { }"],
  ["array size 0", "var a: [int; 0];\nfn main() { }"],
  ["array length", "var a: [int; 2] = [1, 2, 3];\nfn main() { }"],
  ["missing type", "var a;\nfn main() { }"],
  ["break outside a loop", "fn main() {\n break;\n}"],
  [
    "missing return",
    "fn f(x: int) -> int {\n if x > 0 { return 1; }\n}\nfn main() { }",
  ],
  ["call not statement", "fn main() {\n 1 + 2;\n}"],
  ["array value in a function", "fn main() {\n var a = [1, 2];\n}"],
  ["no main", "fn start() { }"],
  ["main signature", "fn main(x: int) { }"],
  [
    "too many globals",
    "var big: [int; 4000];\nvar more: [int; 200];\nfn main() { }",
  ],
];

const main = (body: string) => `fn main() -> int {\n${body}\n}`;

const GENERATE: [string, string][] = [
  ["return a number", main("return 42;")],
  ["precedence", main("return 2 + 3 * 4 - (10 - 4 - 3);")],
  ["negative division", main("return -7 / 2 * 10 + -7 % 2;")],
  ["bits", main("return (1 << 4 | 1) ^ (0x8000 >> 12) & ~0;")],
  ["unary minus and not", main("return -(-5) + ~2;")],
  ["chars", main("return 'A' + 1;")],
  [
    "comparisons",
    "fn bit(c: bool, k: int) -> int { if c { return 1 << k; } return 0; }\n" +
      main(
        "var a = -3; var b = 2;\nreturn bit(a == b, 0) | bit(a != b, 1) | bit(a < b, 2) | bit(a <= b, 3) | bit(a > b, 4) | bit(a >= b, 5) | bit(30000 > -30000, 6);",
      ),
  ],
  [
    "and/or stop early",
    "var ran = 0;\nfn hit(k: int, v: bool) -> bool { ran = ran | (1 << k); return v; }\n" +
      main(
        "if false and hit(0, true) { ran = ran | 16; }\nif true and hit(1, false) { ran = ran | 32; }\nif true or hit(2, true) { ran = ran | 64; }\nif false or hit(3, true) { ran = ran | 128; }\nif not false { ran = ran | 256; }\nreturn ran;",
      ),
  ],
  [
    "if, else if, else",
    "fn sign(v: int) -> int { if v < 0 { return -1; } else if v == 0 { return 0; } else { return 1; } }\n" +
      main("return sign(-5) * 100 + sign(0) * 10 + sign(9);"),
  ],
  [
    "while with break and continue",
    main(
      "var n = 0; var t = 0;\nwhile true { n = n + 1; if n == 3 { continue; } if n > 6 { break; } t = t + n; }\nreturn t;",
    ),
  ],
  [
    "for computes its end once",
    "var n = 3;\n" +
      main(
        "var c = 0;\nfor i in 0..n { n = 10; c = c + i; }\nfor j in 5..2 { c = 99; }\nreturn c;",
      ),
  ],
  [
    "nested loops",
    main(
      "var t = 0;\nfor y in 0..4 { for x in 0..5 { if x == y { continue; } t = t + 1; } }\nreturn t;",
    ),
  ],
  [
    "globals, arrays and constants",
    'const ROWS: int = 4;\nconst SHAPES: [int; 3] = [10, 20, 30];\nconst WORD = "HI";\nvar board: [int; ROWS * 2];\nvar score = 5;\nvar flag: bool;\n' +
      "fn sum(a: [int], n: int) -> int { var t = 0; for i in 0..n { t = t + a[i]; } return t; }\n" +
      main(
        "board[7] = SHAPES[2];\nboard[0] = WORD[1];\nif not flag { score = score + 1; }\nreturn sum(board, ROWS * 2) + sum(SHAPES, 3) + score;",
      ),
  ],
  [
    "starting values of globals",
    "var a = 7;\nvar b: [int; 3] = [1, 2, 3];\nconst T = [4, 5];\nvar yes = true;\n" +
      main("b[1] = mem[0] + T[0];\nif yes { return b[1]; }\nreturn 0;"),
  ],
  [
    "a one-element array",
    "var a: [int; 1];\nfn f(x: [int]) -> int { return x[0]; }\n" +
      main("a[0] = 9;\nreturn f(a);"),
  ],
  [
    "a reference variable",
    "var a: [int; 2] = [1, 2];\nvar b: [int; 2] = [30, 40];\n" +
      main("var r = a; var s: [int] = b;\nr = s;\nreturn r[1] + a[0];"),
  ],
  [
    "mem and the screen",
    main(
      "mem[0x4000] = -1;\nmem[0x4001] = mem[0x4000] >> 8;\nreturn mem[0x6000];",
    ),
  ],
  [
    "recursion",
    "fn fib(n: int) -> int { if n < 2 { return n; } return fib(n - 1) + fib(n - 2); }\n" +
      main("return fib(12);"),
  ],
  [
    "functions without a result",
    "var log: [int; 3];\nvar n = 0;\nfn note(v: int) { log[n] = v; n = n + 1; return; }\nfn twice(v: int) { note(v); note(v * 2); }\n" +
      main("twice(4);\nnote(7);\nreturn log[0] + log[1] * 10 + log[2] * 100;"),
  ],
  ["main without a result", "var x = 3;\nfn main() { x = 4; }"],
  [
    "parameters and locals together",
    "fn f(a: int, b: int, c: int) -> int { var d = a - c; var e = b * d; return e - a; }\n" +
      main("return f(10, 3, 4);"),
  ],
];

const PROGRAMS: [string, string][] = [
  [
    "squares",
    "const N = 12;\nvar sq: [int; N];\n" +
      main(
        "var t = 0;\nfor i in 0..N { sq[i] = i * i - i / 3; t = t ^ sq[i] << 1; }\nreturn t % 1000;",
      ),
  ],
  [
    "a box on the screen",
    "fn pixel(x: int, y: int) {\n  var a = 0x4000 + y * 8 + x / 16;\n  mem[a] = mem[a] | (0x8000 >> (x % 16));\n}\n" +
      "fn main() {\n  for i in 10..30 { pixel(i, 5); pixel(i, 20); }\n  for j in 5..21 { pixel(10, j); pixel(29, j); }\n}",
  ],
  [
    "digits of a number",
    "var digits: [int; 5];\nfn split(n: int) -> int {\n  var count = 0;\n  while n > 0 { digits[count] = n % 10; n = n / 10; count = count + 1; }\n  return count;\n}\n" +
      main("return split(9045) * 1000 + digits[0] * 100 + digits[3];"),
  ],
  ["a syntax mistake", "fn main() {\n  var x = 1\n  x = 2;\n}"],
  ["a type mistake", "fn main() -> int {\n  return 1 + (2 < 3);\n}"],
  ["a bad character", "fn main() {\n  x = 1 @ 2;\n}"],
];

// ---- expected answers from the reference -----------------------------------------

export interface CmReference {
  tokenize(source: string): { ok: LangToken[] } | { error: LangError };
  parse(tokens: LangToken[]): { ok: LangProgram } | { error: LangError };
  check(program: LangProgram): { ok: LangInfo } | { error: LangError };
  generate(program: LangProgram, info: LangInfo): string[];
  compile(source: string): LangCompiled;
  run(vm: string, maxSteps: number): VmRunResult;
}

/** Commands a test program may run on the VM. */
export const MAX_VM_STEPS = 2_000_000;

/** RunState from the interpreter's answer, keeping `globals` words. */
export function shardRun(r: VmRunResult, globals: number): ShardRun | null {
  if ("errors" in r) return null;
  return {
    halted: r.halted,
    result: r.result,
    globals: r.ram.slice(0, globals),
    screen: r.screen.flatMap((v, i) => (v ? [[i, v] as [number, number]] : [])),
  };
}

const expect = <T>(r: { ok: T } | { error: LangError }) =>
  "ok" in r ? { ok: r.ok } : { error: r.error.code, line: r.error.line };

/** Every test, with its expected answer worked out by the reference. */
export function buildCompilerTests(ref: CmReference): CmTestCase[] {
  const tests: CmTestCase[] = [];
  const tokens = (src: string) => {
    const t = ref.tokenize(src);
    if (!("ok" in t)) throw new Error(`test source doesn't tokenize: ${src}`);
    return t.ok;
  };
  const tree = (src: string) => {
    const p = ref.parse(tokens(src));
    if (!("ok" in p)) throw new Error(`test source doesn't parse: ${src}`);
    return p.ok;
  };
  for (const src of TOKENIZE)
    tests.push({
      stage: "tokenize",
      name: src,
      args: [src],
      expected: expect(ref.tokenize(src)),
    });
  for (const src of PARSE) {
    const t = tokens(src);
    tests.push({
      stage: "parse",
      name: src,
      args: [t],
      expected: expect(ref.parse(t)),
    });
  }
  for (const src of CHECK_OK) {
    const p = tree(src);
    tests.push({
      stage: "check",
      name: src,
      args: [p],
      expected: expect(ref.check(p)),
    });
  }
  for (const [name, src] of CHECK_ERRORS) {
    const p = tree(src);
    tests.push({
      stage: "check",
      name: `${name}: ${src}`,
      args: [p],
      expected: expect(ref.check(p)),
    });
  }
  /** The reference's run of a program, and how many globals to compare. */
  const reference = (src: string) => {
    const c = ref.compile(src);
    if (c.errors.length) throw new Error(`test program has errors: ${src}`);
    const p = tree(src);
    const info = ref.check(p);
    if (!("ok" in info)) throw new Error(`test program has errors: ${src}`);
    const words = Object.values(info.ok.globals).reduce(
      (n, g) => n + g.size,
      0,
    );
    const globals = Math.min(64, words);
    const run = shardRun(ref.run(c.vm.join("\n"), MAX_VM_STEPS), globals);
    if (!run) throw new Error(`test program doesn't run: ${src}`);
    return { p, info: info.ok, run, globals };
  };
  for (const [name, src] of GENERATE) {
    const r = reference(src);
    tests.push({
      stage: "generate",
      name,
      args: [r.p, r.info],
      expected: { ok: r.run },
      globals: r.globals,
    });
  }
  for (const [name, src] of PROGRAMS) {
    const c = ref.compile(src);
    const first = c.errors[0];
    if (first) {
      tests.push({
        stage: "program",
        name,
        args: [src],
        expected: { error: first.code, line: first.line },
      });
      continue;
    }
    const r = reference(src);
    tests.push({
      stage: "program",
      name,
      args: [src],
      expected: { ok: r.run },
      globals: r.globals,
    });
  }
  return tests;
}

// ---- the worker's half -----------------------------------------------------------

/** Runs the learner's part of one test. */
export function compileTest(stages: CompilerStages, t: CmTestCase): CmOutcome {
  if (t.stage === "program")
    return { kind: "vm", compiled: compileWith(stages, t.args[0] as string) };
  try {
    if (t.stage === "generate") {
      const vm = stages.generate(
        t.args[0] as LangProgram,
        t.args[1] as LangInfo,
      );
      if (!Array.isArray(vm))
        throw new CompileError("not-lines", "generate must return VM lines");
      return {
        kind: "vm",
        compiled: { vm: vm.map(String), sourceMap: [], errors: [] },
      };
    }
    const fn = stages[t.stage] as (...a: unknown[]) => unknown;
    return { kind: "value", got: { ok: fn(...t.args) } };
  } catch (e) {
    const err = errorOf(e, 0);
    const got = {
      error: err.code,
      message: err.message,
      ...(err.line ? { line: err.line } : {}),
    };
    return t.stage === "generate"
      ? { kind: "vm", compiled: { vm: [], sourceMap: [], errors: [err] } }
      : { kind: "value", got };
  }
}

// ---- the main thread's half -----------------------------------------------------

/** Runs VM code on the reference interpreter (the caller has WASM). */
export type RunVm = (vm: string, maxSteps: number) => VmRunResult;

export function gradeCompilerTest(
  t: CmTestCase,
  o: CmOutcome,
  run: RunVm,
): CmResult {
  let got: CmResult["got"];
  let detail: string | undefined;
  if (o.kind === "value") got = o.got;
  else {
    const first = o.compiled.errors[0];
    if (first)
      got = { error: first.code, message: first.message, line: first.line };
    else {
      const vm = o.compiled.vm.join("\n");
      detail = o.compiled.vm.slice(0, 400).join("\n");
      const r = run(vm, MAX_VM_STEPS);
      const state = shardRun(r, t.globals ?? 0);
      got = state
        ? { ok: state }
        : {
            error: "bad-vm",
            message:
              "errors" in r
                ? r.errors
                    .slice(0, 3)
                    .map((e) => `VM line ${e.line}: ${e.message}`)
                    .join("; ")
                : "",
          };
    }
  }
  const ok =
    "ok" in t.expected
      ? "ok" in got && sameValue(got.ok, t.expected.ok)
      : "error" in got &&
        got.error === t.expected.error &&
        (t.expected.line === undefined || (got.line ?? 0) === t.expected.line);
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
 * the four stages. */
export function loadCompiler(js: string): CompilerStages {
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", "CompileError", js)(
    module,
    module.exports,
    CompileError,
  );
  const missing = ["tokenize", "parse", "check", "generate"].filter(
    (n) => typeof module.exports[n] !== "function",
  );
  if (missing.length)
    throw new CompileError("missing", `export ${missing.join(", ")}`, {
      names: missing.join(", "),
    });
  return module.exports as unknown as CompilerStages;
}
