import { readFileSync } from "node:fs";
import { transform } from "sucrase";
import { beforeAll, describe, expect, it } from "vitest";
import type { AsmProgram, StageResult } from "../src/sim/types";
import {
  assembleWith,
  buildTests,
  loadStages,
  runTest,
  sameValue,
  type Reference,
} from "../src/workshop-tests";
import { STARTERS } from "../src/workshop-starter";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const j = <T>(s: string) => JSON.parse(s) as T;

const reference: Reference = {
  tokenize: (l) => j<StageResult<never>>(wasm.asmTokenize(l)),
  parse: (t) => j(wasm.asmParse(JSON.stringify(t))),
  layout: (l) => j(wasm.asmLayout(JSON.stringify(l))),
  encode: (b, s, p) =>
    j(wasm.asmEncode(JSON.stringify(b), JSON.stringify(s), JSON.stringify(p))),
  assemble: (src) => j<AsmProgram>(wasm.asmAssemble(src)),
};

/** The same pipeline the site uses: strip types, load as CommonJS. */
const load = (ts: string) =>
  loadStages(transform(ts, { transforms: ["typescript", "imports"] }).code);

describe("assembler workshop", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("a complete solution passes every test, in every stage", () => {
    const solution = readFileSync(
      new URL("./fixtures/assembler-solution.ts", import.meta.url),
      "utf8",
    );
    const stages = load(solution);
    const tests = buildTests(reference);
    const byStage = new Map<string, number>();
    for (const t of tests)
      byStage.set(t.stage, (byStage.get(t.stage) ?? 0) + 1);
    expect([...byStage.keys()]).toEqual([
      "tokenize",
      "parse",
      "layout",
      "encode",
      "program",
    ]);
    expect(tests.length).toBeGreaterThan(80);
    const failed = tests.map((t) => runTest(stages, t)).filter((r) => !r.ok);
    expect(failed).toEqual([]);
    // Chained, the stages assemble the same program as the reference.
    const src = "a: SET16 r1, 0x4000\nINC r1\nJMP a";
    expect(assembleWith(stages, src).code).toEqual(
      reference.assemble(src).code,
    );
  });

  it("the starter loads in both languages and fails clearly", () => {
    for (const lang of ["en", "mn"] as const) {
      const stages = load(STARTERS[lang]);
      const tests = buildTests(reference);
      const results = tests.map((t) => runTest(stages, t));
      expect(results.every((r) => !r.ok)).toBe(true);
      const first = results.find((r) => !r.ok)!;
      expect("error" in first.got && first.got.message).toContain("TODO");
    }
  });

  it("reports missing exports and compares JSON values", () => {
    expect(() => loadStages("module.exports.tokenize = () => []")).toThrow(
      /parse, layout, encode/,
    );
    expect(
      sameValue({ a: 1, b: [1, { c: null }] }, { b: [1, { c: null }], a: 1 }),
    ).toBe(true);
    expect(sameValue({ a: null }, {})).toBe(false);
    expect(sameValue([1, 2], [1, 2, 3])).toBe(false);
  });
});
