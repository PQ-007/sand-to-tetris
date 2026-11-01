// The assembler workshop's tests (docs/ASSEMBLY.md). Each of the learner's
// four stages is tested on its own, fed the reference assembler's output for
// the stage before, so one stage's bug never fails the next. Expected answers
// come from the reference (s2t-asm via WASM), so they can't drift from it.
// Pure: runs in the worker and in vitest.
import type {
  AsmBody,
  AsmLayout,
  AsmLine,
  AsmPlaced,
  AsmProgram,
  AsmSymbol,
  AsmToken,
  StageResult,
} from "./sim/types";

/** What the learner throws: a code from docs/ASSEMBLY.md, an English (or
 * any) message, the values, and for layout errors the 1-based line. */
export class AsmError extends Error {
  constructor(
    public code: string,
    message: string,
    public args: Record<string, string> = {},
    public line = 0,
  ) {
    super(message);
  }
}

export interface Stages {
  tokenize(line: string): AsmToken[];
  parse(tokens: AsmToken[]): AsmLine;
  layout(lines: AsmLine[]): AsmLayout;
  encode(
    body: AsmBody,
    symbols: Record<string, AsmSymbol>,
    placed: AsmPlaced,
  ): number[];
}

export type StageName = keyof Stages | "program";

export interface TestCase {
  stage: StageName;
  /** Shown to the learner: the line or program it's about. */
  name: string;
  /** Arguments for the stage function (for "program": [source]). */
  args: unknown[];
  /** The value, or the error code a correct stage throws. */
  expected: { ok: unknown } | { error: string; line?: number };
}

export interface TestResult {
  stage: StageName;
  name: string;
  ok: boolean;
  args: unknown[];
  expected: TestCase["expected"];
  /** What the learner's code returned, or the error it threw. */
  got: { ok: unknown } | { error: string; message: string; line?: number };
}

// ---- inputs ---------------------------------------------------------------------

const TOKENIZE_LINES = [
  "HALT",
  "",
  "   ; only a comment",
  "loop: ADD r1, r2, r3",
  "  LOAD r2, [r1 + 0x10]   ; with a comment",
  ".word -5, 0b1111_0000, 'A'",
  ".EQU Width 0X2a",
  "store R3, [r6]",
  "SET r1, 12ab",
  "SET r1, 0x",
  "SET r1, #5",
  "SET r1, 'AB'",
];

const PARSE_LINES = [
  "HALT",
  "",
  "only:",
  "loop: store r3, [r6]",
  "LOAD r2, [r1 + 16]",
  "LOAD r2, [r1 + OFFSET]",
  "set16 R1, 0x4000",
  "JMP loop",
  ".equ WIDTH 8",
  ".word 1, two, -3",
  ".data",
  "ADD r1 r2",
  "ADD r1,, r2",
  "LOAD r1, [r2 + 3",
  "LOAD r1, [5]",
  ".equ 5 5",
];

const SUM = `        SET  r0, 0
        SET  r1, 10
loop:   ADD  r0, r0, r1
        SUBI r1, 1
        JNZ  loop
done:   JMP  done`;

const DATA = `.equ ROWS 3
.equ SMALL 7
.data
shapes: .word 0x0F00, 0x4444, ROWS
board:  .space 2
end:    .word board
.code
start:  SET16 r1, shapes
        SET16 r2, SMALL
        SET16 r3, 0x4000
        LOAD  r4, [r1 + 1]
        CALL  sub
        HALT
sub:    RET`;

/** Every instruction form, for encode. */
const EVERY = `.equ K 9
.data
t:      .word 1
.code
top:    ADD r1, r2, r3
        SUB r1, r2, r3
        AND r1, r2, r3
        ANDN r1, r2, r3
        OR r1, r2, r3
        ORN r1, r2, r3
        XOR r1, r2, r3
        XORN r1, r2, r3
        ALU r0, r1, r2, 0, 0, 1
        MOV r4, r5
        CMP r1, r2
        CMP r1, r2, 1, 1, 0
        TEST r3, r3
        SET r1, 255
        SETH r1, 0x40
        ADDI r2, K
        SUBI r2, 1
        INC r6
        DEC r6
        SHL r1, r2, 3
        SHR r1, r2, 15
        SAR r1, r2, r3
        LOAD r1, [r2 + 127]
        STORE r1, [r2]
        SET16 r1, t
        JMP top
        JZ top
        JEQ 5
        JNZ -1
        JNE top
        JN top
        JNN top
        JC top
        JHS top
        JNC top
        JLO top
        JHI top
        CALL top
        CALLR r2
        JR r3
        RET
        NOP
        HALT`;

const LAYOUT_PROGRAMS: [string, string][] = [
  ["sum", SUM],
  ["data", DATA],
  ["every instruction", EVERY],
  ["duplicate label", "a: NOP\na: NOP"],
  ["instruction in .data", ".data\nNOP"],
  ["unknown directive", ".bss 4"],
  ["word in .code", ".word 1"],
];

const ENCODE_ERRORS: [string, string][] = [
  ["byte too big", "SET r1, 300"],
  ["too few operands", "ADD r1, r2"],
  ["not a register", "ADD r1, r2, 5"],
  ["not memory", "LOAD r1, r2"],
  ["shift too far", "SHL r1, r2, 16"],
  ["unknown name", "JMP nowhere"],
  ["unknown instruction", "FOO r1"],
  ["jump to data", ".data\nt: .word 1\n.code\nJMP t"],
  ["jump too far", `JMP far\n${"NOP\n".repeat(600)}far: HALT`],
];

const PROGRAMS: [string, string][] = [
  ["sum", SUM],
  ["data", DATA],
  ["every instruction", EVERY],
  ["errors on several lines", "NOP\nSET r1, 300\nFOO\nHALT"],
  ["a bad line, then a duplicate", "a: NOP\nSET r1, #\na: HALT"],
];

// ---- expected answers from the reference -------------------------------------------

export interface Reference {
  tokenize(line: string): StageResult<AsmToken[]>;
  parse(tokens: AsmToken[]): StageResult<AsmLine>;
  layout(lines: AsmLine[]): StageResult<AsmLayout>;
  encode(
    body: AsmBody,
    symbols: Record<string, AsmSymbol>,
    placed: AsmPlaced,
  ): StageResult<number[]>;
  assemble(source: string): AsmProgram;
}

const expect = <T>(r: StageResult<T>): TestCase["expected"] =>
  "ok" in r ? { ok: r.ok } : { error: r.error.code };

/** Reference lines of a program (stage 2 input for layout). */
function refLines(ref: Reference, source: string): AsmLine[] {
  return source.split("\n").map((text) => {
    const tokens = ref.tokenize(text);
    if (!("ok" in tokens)) return { label: null, body: null };
    const line = ref.parse(tokens.ok);
    return "ok" in line ? line.ok : { label: null, body: null };
  });
}

/** Every test, with its expected answer worked out by the reference. */
export function buildTests(ref: Reference): TestCase[] {
  const tests: TestCase[] = [];
  for (const line of TOKENIZE_LINES)
    tests.push({
      stage: "tokenize",
      name: line,
      args: [line],
      expected: expect(ref.tokenize(line)),
    });
  for (const line of PARSE_LINES) {
    const tokens = ref.tokenize(line);
    if (!("ok" in tokens)) continue;
    tests.push({
      stage: "parse",
      name: line,
      args: [tokens.ok],
      expected: expect(ref.parse(tokens.ok)),
    });
  }
  for (const [name, source] of LAYOUT_PROGRAMS) {
    const lines = refLines(ref, source);
    const r = ref.layout(lines);
    tests.push({
      stage: "layout",
      name,
      args: [lines],
      expected:
        "ok" in r ? { ok: r.ok } : { error: r.error.code, line: r.error.line },
    });
  }
  const encodeFrom = (label: string, source: string, onlyErrors: boolean) => {
    const lines = refLines(ref, source);
    const lay = ref.layout(lines);
    if (!("ok" in lay)) return;
    lines.forEach((line, i) => {
      const placed = lay.ok.lines[i];
      if (!line.body || !placed) return;
      const r = ref.encode(line.body, lay.ok.symbols, placed);
      if (onlyErrors && "ok" in r) return;
      tests.push({
        stage: "encode",
        name: `${label}: ${source.split("\n")[i]?.trim() ?? ""}`,
        args: [line.body, lay.ok.symbols, placed],
        expected: expect(r),
      });
    });
  };
  encodeFrom("sum", SUM, false);
  encodeFrom("data", DATA, false);
  encodeFrom("every instruction", EVERY, false);
  for (const [label, source] of ENCODE_ERRORS) encodeFrom(label, source, true);
  for (const [name, source] of PROGRAMS) {
    const p = ref.assemble(source);
    const first = p.errors[0];
    tests.push({
      stage: "program",
      name,
      args: [source],
      expected: first
        ? { error: first.code, line: first.line }
        : { ok: { code: p.code, data: p.data } },
    });
  }
  return tests;
}

// ---- running the learner's code -----------------------------------------------------

/** Equal as JSON values: same keys (order doesn't matter), same values. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
      return false;
    return a.every((x, i) => sameValue(x, b[i]));
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a).filter(
      (k) => (a as Record<string, unknown>)[k] !== undefined,
    );
    const kb = Object.keys(b).filter(
      (k) => (b as Record<string, unknown>)[k] !== undefined,
    );
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      sameValue(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return a === b;
}

function thrown(e: unknown): { error: string; message: string; line?: number } {
  if (e instanceof AsmError || (e && typeof e === "object" && "code" in e)) {
    const err = e as AsmError;
    return {
      error: String(err.code),
      message: String(err.message ?? ""),
      ...(err.line ? { line: err.line } : {}),
    };
  }
  return { error: "crash", message: String(e) };
}

/** Runs one test against the learner's stages. */
export function runTest(stages: Stages, t: TestCase): TestResult {
  let got: TestResult["got"];
  try {
    const value =
      t.stage === "program"
        ? programResult(assembleWith(stages, t.args[0] as string))
        : (stages[t.stage] as (...a: unknown[]) => unknown)(...t.args);
    got =
      t.stage === "program" &&
      value &&
      typeof value === "object" &&
      "error" in value
        ? (value as TestResult["got"])
        : { ok: value };
  } catch (e) {
    got = thrown(e);
  }
  const ok =
    "ok" in t.expected
      ? "ok" in got && sameValue(got.ok, t.expected.ok)
      : "error" in got &&
        got.error === t.expected.error &&
        (t.expected.line === undefined || got.line === t.expected.line);
  return {
    stage: t.stage,
    name: t.name,
    ok,
    args: t.args,
    expected: t.expected,
    got,
  };
}

/** A whole program's result in the shape the tests compare. */
function programResult(
  p: AsmProgram,
):
  | { code: number[]; data: number[] }
  | { error: string; message: string; line?: number } {
  const first = p.errors[0];
  return first
    ? { error: first.code, message: first.message, line: first.line }
    : { code: p.code, data: p.data };
}

/** The four stages chained into an assembler, as s2t-asm's `assemble`
 * does: every line tokenized and parsed (errors kept with their line),
 * then layout, then each placed line encoded. */
export function assembleWith(stages: Stages, source: string): AsmProgram {
  const errors: AsmProgram["errors"] = [];
  const fail = (e: unknown, line: number) => {
    const t = thrown(e);
    errors.push({
      line: t.line ?? line,
      code: t.error,
      args: {},
      message: t.message,
    });
  };
  const lines: AsmLine[] = source.split("\n").map((text, i) => {
    try {
      return stages.parse(stages.tokenize(text));
    } catch (e) {
      fail(e, i + 1);
      return { label: null, body: null };
    }
  });
  const program: AsmProgram = {
    code: [],
    data: [],
    symbols: {},
    sourceMap: [],
    errors,
  };
  let lay: AsmLayout;
  try {
    lay = stages.layout(lines);
  } catch (e) {
    fail(e, 0);
    errors.sort((a, b) => a.line - b.line);
    return program;
  }
  program.symbols = lay.symbols;
  lines.forEach((line, i) => {
    const placed = lay.lines[i];
    if (!line.body || !placed) return;
    let words: number[];
    try {
      words = stages.encode(line.body, lay.symbols, placed);
    } catch (e) {
      fail(e, i + 1);
      words = new Array<number>(placed.size).fill(0);
    }
    if (placed.section === "code") {
      program.code.push(...words);
      program.sourceMap.push(...words.map(() => i + 1));
    } else program.data.push(...words);
  });
  errors.sort((a, b) => a.line - b.line);
  return program;
}

/** Loads the learner's transpiled module (CommonJS) and checks it exports
 * the four stages. */
export function loadStages(js: string): Stages {
  const module = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", "AsmError", js)(
    module,
    module.exports,
    AsmError,
  );
  const missing = ["tokenize", "parse", "layout", "encode"].filter(
    (n) => typeof module.exports[n] !== "function",
  );
  if (missing.length)
    throw new AsmError("missing", `export ${missing.join(", ")}`, {
      names: missing.join(", "),
    });
  return module.exports as unknown as Stages;
}
