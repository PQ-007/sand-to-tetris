// The OS workshop's tests (docs/OS.md). The learner's OS is C Shard: each
// test puts it in front of a small program, compiles that with the built-in
// compiler, runs it on the VM interpreter with a scripted timer and keyboard,
// and compares main's result and the screen with the same program on the
// built-in OS. The text functions use the learner's own plot and fill_rect,
// so the stages build on each other: write them in order. Pure: running the
// toolchain is passed in.
import { programLines, withOs } from "./os";
import type { LangCompiled, VmRunResult } from "./sim/types";
import { sameValue } from "./workshop-tests";

export type OsStage = "helpers" | "screen" | "text" | "time" | "random";

export const OS_STAGES: OsStage[] = [
  "helpers",
  "screen",
  "text",
  "time",
  "random",
];

export interface OsScript {
  stepsPerFrame: number;
  keys: [number, number][];
}

/** What a run compares. */
export interface OsRun {
  halted: boolean;
  result: number;
  /** The screen words that aren't 0: [index, value]. */
  screen: [number, number][];
}

export interface OsTestCase {
  stage: OsStage;
  name: string;
  /** [program]. */
  args: [string];
  script: OsScript;
  expected: { ok: OsRun };
}

export interface OsResult {
  stage: OsStage;
  name: string;
  ok: boolean;
  args: unknown[];
  expected: OsTestCase["expected"];
  got: { ok: unknown } | { error: string; message: string; line?: number };
}

export interface OsToolchain {
  compile(source: string): LangCompiled;
  run(vm: string, maxSteps: number, script: OsScript): VmRunResult;
}

/** Commands one test may run. */
export const MAX_OS_STEPS = 4_000_000;

const NO_TIME: OsScript = { stepsPerFrame: 0, keys: [] };
const clock = (keys: [number, number][] = []): OsScript => ({
  stepsPerFrame: 400,
  keys,
});

const main = (body: string) => `fn main() -> int {\n${body}\n}`;

const TESTS: [OsStage, string, string, OsScript][] = [
  ["helpers", "abs", main("return abs(-5) * 100 + abs(7);"), NO_TIME],
  [
    "helpers",
    "min and max",
    main("return min(3, -2) * 100 + max(4, 9) * 10 + max(-1, -7);"),
    NO_TIME,
  ],
  [
    "screen",
    "plot on, off, and outside the screen",
    main(
      "plot(0, 0, true); plot(127, 95, true); plot(17, 3, true); plot(17, 3, false);\nplot(40, 50, true); plot(-1, 5, true); plot(128, 5, true); plot(5, 96, true); plot(5, -1, true);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "screen",
    "clear",
    main(
      "for i in 0..768 { mem[0x4000 + i] = i * 7 + 1; }\nclear();\nplot(3, 4, true);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "screen",
    "fill_rect inside one word",
    main("fill_rect(2, 1, 5, 3, true);\nreturn 1;"),
    NO_TIME,
  ],
  [
    "screen",
    "fill_rect across words",
    main("fill_rect(10, 7, 40, 2, true);\nreturn 1;"),
    NO_TIME,
  ],
  [
    "screen",
    "fill_rect the whole width, and clipped at the edges",
    main(
      "fill_rect(0, 0, 128, 1, true);\nfill_rect(-5, 90, 20, 20, true);\nfill_rect(120, -3, 30, 6, true);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "screen",
    "fill_rect off",
    main(
      "fill_rect(0, 10, 64, 10, true);\nfill_rect(5, 12, 30, 4, false);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "screen",
    "fill_rect with no width or height",
    main(
      "fill_rect(20, 20, 0, 10, true);\nfill_rect(20, 20, 10, 0, true);\nfill_rect(30, 30, -4, 5, true);\nplot(1, 1, true);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "screen",
    "draw_rect",
    main("draw_rect(10, 20, 30, 15);\ndraw_rect(100, 80, 1, 1);\nreturn 1;"),
    NO_TIME,
  ],
  ["text", "draw_char 'A'", main("draw_char('A', 0, 0);\nreturn 1;"), NO_TIME],
  [
    "text",
    "lowercase is drawn as capitals",
    main("draw_char('q', 5, 2);\nreturn 1;"),
    NO_TIME,
  ],
  [
    "text",
    "an unknown character is '?'",
    main("draw_char(200, 31, 15);\ndraw_char(7, 0, 15);\nreturn 1;"),
    NO_TIME,
  ],
  [
    "text",
    "a character clears its cell",
    main(
      "fill_rect(0, 0, 128, 12, true);\ndraw_char(' ', 2, 0);\ndraw_char('8', 3, 1);\nreturn 1;",
    ),
    NO_TIME,
  ],
  [
    "text",
    "draw_text",
    main('draw_text("HELLO, WORLD!", 13, 3, 4);\nreturn 1;'),
    NO_TIME,
  ],
  [
    "text",
    "draw_int",
    main(
      "var w = draw_int(0, 0, 0);\nw = w * 10 + draw_int(1234, 0, 1);\nw = w * 10 + draw_int(-56, 0, 2);\nw = w * 10 + draw_int(32767, 0, 3);\nreturn w;",
    ),
    NO_TIME,
  ],
  [
    "text",
    "draw_int -32768",
    main("return draw_int(-32768, 10, 10);"),
    NO_TIME,
  ],
  [
    "time",
    "key",
    main("return key() * 10 + 7;"),
    { stepsPerFrame: 0, keys: [[0, 66]] },
  ],
  [
    "time",
    "ticks counts frames",
    main("while ticks() < 10 { }\nreturn ticks();"),
    clock(),
  ],
  [
    "time",
    "wait",
    main("var t = ticks();\nwait(20);\nreturn ticks() - t;"),
    clock(),
  ],
  [
    "time",
    "wait_key waits for a press and a release",
    main("var k = wait_key();\nreturn k * 100 + ticks();"),
    clock([
      [5, 130],
      [8, 0],
    ]),
  ],
  [
    "random",
    "random after seed_random",
    main(
      "seed_random(1234);\nfor i in 0..8 { mem[0x4000 + i] = random(); }\nreturn random();",
    ),
    NO_TIME,
  ],
  [
    "random",
    "seed 0 counts as 1",
    main(
      "seed_random(0);\nvar a = random();\nseed_random(1);\nif a == random() { return a; }\nreturn -1;",
    ),
    NO_TIME,
  ],
  [
    "random",
    "the sequence starts from seed 1",
    main("return random();"),
    NO_TIME,
  ],
  [
    "random",
    "random_below stays in range",
    main(
      "var lo = 99;\nvar hi = -1;\nfor i in 0..300 { var v = random_below(10); lo = min(lo, v); hi = max(hi, v); }\nreturn lo * 100 + hi + random_below(0) + random_below(-3);",
    ),
    NO_TIME,
  ],
  [
    "random",
    "the first key press seeds the generator",
    main("wait_key();\nreturn random();"),
    clock([
      [7, 65],
      [9, 0],
    ]),
  ],
];

/** The interpreter's answer as an OsRun (null if the VM code had errors). */
function osRun(r: VmRunResult): OsRun | null {
  if ("errors" in r) return null;
  return {
    halted: r.halted,
    result: r.result,
    screen: r.screen.flatMap((v, i) => (v ? [[i, v] as [number, number]] : [])),
  };
}

/** Runs a program on an OS: its result, or the first mistake (on the
 * program's line, or "os" with the OS's line). */
export function runOnOs(
  tc: OsToolchain,
  os: string,
  program: string,
  script: OsScript,
): OsResult["got"] {
  const full = withOs(os, program);
  const c = programLines(tc.compile(full.source), full.offset);
  const first = c.errors[0];
  if (first)
    return {
      error: c.osErrors[0] ? "os" : first.code,
      message: c.osErrors[0]
        ? `line ${first.line}: ${first.message}`
        : first.message,
      line: first.line,
    };
  const run = osRun(tc.run(c.vm.join("\n"), MAX_OS_STEPS, script));
  return run
    ? { ok: run }
    : { error: "bad-vm", message: "the compiled code didn't run" };
}

/** Every test, with its expected answer from the built-in OS. */
export function buildOsTests(tc: OsToolchain, builtin: string): OsTestCase[] {
  return TESTS.map(([stage, name, program, script]) => {
    const r = runOnOs(tc, builtin, program, script);
    if (!("ok" in r)) throw new Error(`OS test doesn't run: ${name}`);
    return {
      stage,
      name,
      args: [program],
      script,
      expected: { ok: r.ok as OsRun },
    };
  });
}

/** Runs one test on the learner's OS. */
export function runOsTest(
  tc: OsToolchain,
  os: string,
  t: OsTestCase,
): OsResult {
  const got = runOnOs(tc, os, t.args[0], t.script);
  return {
    stage: t.stage,
    name: t.name,
    ok: "ok" in got && sameValue(got.ok, t.expected.ok),
    args: t.args,
    expected: t.expected,
    got,
  };
}
