import { readFileSync } from "node:fs";
import { transform } from "sucrase";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  VmBuilt,
  VmCommand,
  VmError,
  VmRunResult,
} from "../src/sim/types";
import { translateWith } from "../src/translator";
import {
  buildTranslatorTests,
  gradeTest,
  loadTranslator,
  translateTest,
  TR_STAGES,
  type TrReference,
} from "../src/translator-tests";
import { TRANSLATOR_STARTERS } from "../src/translator-starter";
import { execOnCpu } from "../src/workshop-run";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const j = <T>(s: string) => JSON.parse(s) as T;

const reference: TrReference = {
  parse: (l) =>
    j<{ ok: VmCommand | null } | { error: VmError }>(wasm.vmParse(l)),
  translate: (c, ctx) =>
    j<string[]>(wasm.vmTranslate(JSON.stringify(c), JSON.stringify(ctx))),
  start: () => j(wasm.vmStart()),
  run: (src, max) => j<VmRunResult>(wasm.vmRun(src, max)),
  errors: (src) => j<VmBuilt>(wasm.vmBuild(src)).errors,
};

/** The same pipeline the site uses: strip types, load as CommonJS. */
const load = (ts: string) =>
  loadTranslator(transform(ts, { transforms: ["typescript", "imports"] }).code);

describe("VM translator workshop", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("a complete solution passes every test, in every stage", () => {
    const solution = readFileSync(
      new URL("./fixtures/translator-solution.ts", import.meta.url),
      "utf8",
    );
    const stages = load(solution);
    const tests = buildTranslatorTests(reference);
    expect([...new Set(tests.map((t) => t.stage))]).toEqual(TR_STAGES);
    expect(tests.length).toBeGreaterThan(100);
    const results = tests.map((t) =>
      gradeTest(t, translateTest(stages, t), execOnCpu),
    );
    const failed = results
      .filter((r) => !r.ok)
      .map((r) => ({ name: r.name, expected: r.expected, got: r.got }));
    expect(failed).toEqual([]);
    // Whole, it translates a program the reference's way, if not to the
    // same lines: same result on the CPU.
    const src = "func main 0 0\npush 6\npush 7\nmul\nreturn";
    expect(translateWith(stages, src).errors).toEqual([]);
  });

  it("every stage's tests use only that stage's code", () => {
    // A solution with broken comparisons (1 for true instead of -1) fails
    // arith and nothing else: in a jump, 1 still counts as true.
    const solution = readFileSync(
      new URL("./fixtures/translator-solution.ts", import.meta.url),
      "utf8",
    ).replace(
      '"SAR r2, r2, 15",\n    `${done}:`',
      '"SHR r2, r2, 15",\n    `${done}:`',
    );
    const stages = load(solution);
    const failedStages = new Set(
      buildTranslatorTests(reference)
        .map((t) => gradeTest(t, translateTest(stages, t), execOnCpu))
        .filter((r) => !r.ok)
        .map((r) => r.stage),
    );
    expect([...failedStages]).toEqual(["arith"]);
  });

  it("the starter loads in both languages and fails clearly", () => {
    for (const lang of ["en", "mn"] as const) {
      const stages = load(TRANSLATOR_STARTERS[lang]);
      const tests = buildTranslatorTests(reference);
      const results = tests.map((t) =>
        gradeTest(t, translateTest(stages, t), execOnCpu),
      );
      expect(results.filter((r) => r.ok)).toEqual([]);
      const first = results[0]!;
      expect("error" in first.got && first.got.message).toContain("TODO");
    }
  });

  it("reports missing exports", () => {
    expect(() => loadTranslator("module.exports.parse = () => null")).toThrow(
      /translate, bootstrap, runtime/,
    );
  });
});
