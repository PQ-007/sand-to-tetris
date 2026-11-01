import { readFileSync } from "node:fs";
import { transform } from "sucrase";
import { beforeAll, describe, expect, it } from "vitest";
import { compileWith } from "../src/compiler";
import {
  buildCompilerTests,
  CM_STAGES,
  compileTest,
  gradeCompilerTest,
  loadCompiler,
  type CmReference,
} from "../src/compiler-tests";
import { COMPILER_STARTERS } from "../src/compiler-starter";
import type { LangCompiled, VmRunResult } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const j = <T>(s: string) => JSON.parse(s) as T;

const reference: CmReference = {
  tokenize: (s) => j(wasm.langTokenize(s)),
  parse: (t) => j(wasm.langParse(JSON.stringify(t))),
  check: (p) => j(wasm.langCheck(JSON.stringify(p))),
  generate: (p, i) =>
    j(wasm.langGenerate(JSON.stringify(p), JSON.stringify(i))),
  compile: (s) => j<LangCompiled>(wasm.langCompile(s)),
  run: (vm, max) => j<VmRunResult>(wasm.vmRun(vm, max)),
};

/** The same pipeline the site uses: strip types, load as CommonJS. */
const load = (ts: string) =>
  loadCompiler(transform(ts, { transforms: ["typescript", "imports"] }).code);

const solution = () =>
  readFileSync(
    new URL("./fixtures/compiler-solution.ts", import.meta.url),
    "utf8",
  );

describe("C Shard compiler workshop", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("a complete solution passes every test, in every stage", () => {
    const stages = load(solution());
    const tests = buildCompilerTests(reference);
    expect([...new Set(tests.map((t) => t.stage))]).toEqual(CM_STAGES);
    expect(tests.length).toBeGreaterThan(90);
    const failed = tests
      .map((t) => gradeCompilerTest(t, compileTest(stages, t), reference.run))
      .filter((r) => !r.ok)
      .map((r) => ({ name: r.name, expected: r.expected, got: r.got }));
    expect(failed).toEqual([]);
    // Whole, its program runs like the reference's.
    const src = "fn main() -> int { return 6 * 7; }";
    expect(compileWith(stages, src).errors).toEqual([]);
  });

  it("a broken generate fails only generate and whole programs", () => {
    const broken = solution().replace('"-": "sub"', '"-": "add"');
    const stages = load(broken);
    const failedStages = new Set(
      buildCompilerTests(reference)
        .map((t) => gradeCompilerTest(t, compileTest(stages, t), reference.run))
        .filter((r) => !r.ok)
        .map((r) => r.stage),
    );
    expect([...failedStages].sort()).toEqual(["generate", "program"]);
  });

  it("the starter loads in both languages and fails clearly", () => {
    for (const lang of ["en", "mn"] as const) {
      const stages = load(COMPILER_STARTERS[lang]);
      const results = buildCompilerTests(reference).map((t) =>
        gradeCompilerTest(t, compileTest(stages, t), reference.run),
      );
      expect(results.filter((r) => r.ok).map((r) => r.name)).toEqual([]);
      const first = results[0]!;
      expect("error" in first.got && first.got.message).toContain("TODO");
    }
  });

  it("reports missing exports", () => {
    expect(() => loadCompiler("module.exports.tokenize = () => []")).toThrow(
      /parse, check, generate/,
    );
  });
});
