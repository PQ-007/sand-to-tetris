import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { BUILTIN_OS, programLines, withOs } from "../src/os";
import {
  buildOsTests,
  OS_STAGES,
  runOsTest,
  type OsToolchain,
} from "../src/os-tests";
import { OS_STARTERS } from "../src/os-starter";
import type { LangCompiled, VmRunResult } from "../src/sim/types";
import * as wasm from "../src/sim/pkg/s2t_wasm.js";

const tc: OsToolchain = {
  compile: (s) => JSON.parse(wasm.langCompile(s)) as LangCompiled,
  run: (vm, max, script) =>
    JSON.parse(
      wasm.vmRunScripted(vm, max, JSON.stringify(script)),
    ) as VmRunResult,
};

describe("OS workshop", () => {
  beforeAll(() => {
    wasm.initSync({
      module: readFileSync(
        new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
      ),
    });
  });

  it("the built-in OS passes every test, in every stage", () => {
    const tests = buildOsTests(tc, BUILTIN_OS);
    expect([...new Set(tests.map((t) => t.stage))]).toEqual(OS_STAGES);
    expect(tests.length).toBeGreaterThan(20);
    const failed = tests
      .map((t) => runOsTest(tc, BUILTIN_OS, t))
      .filter((r) => !r.ok);
    expect(failed).toEqual([]);
  });

  it("the starter compiles in both languages and fails every test", () => {
    const tests = buildOsTests(tc, BUILTIN_OS);
    for (const lang of ["en", "mn"] as const) {
      const results = tests.map((t) => runOsTest(tc, OS_STARTERS[lang], t));
      expect(results.filter((r) => r.ok).map((r) => r.name)).toEqual([]);
      // Failing by result, not by a compile error in the starter.
      expect(results.every((r) => "ok" in r.got || r.got.error !== "os")).toBe(
        true,
      );
    }
  });

  it("a broken fill_rect fails screen and text, not the others", () => {
    const broken = BUILTIN_OS.replace(
      "var mask = (-1 << (16 - n)) >> bit;",
      "var mask = (-1 << (15 - n)) >> bit;",
    );
    expect(broken).not.toEqual(BUILTIN_OS);
    const stages = new Set(
      buildOsTests(tc, BUILTIN_OS)
        .map((t) => runOsTest(tc, broken, t))
        .filter((r) => !r.ok)
        .map((r) => r.stage),
    );
    expect([...stages].sort()).toEqual(["screen", "text"]);
  });

  it("maps lines back to the program, and marks mistakes in the OS", () => {
    const full = withOs("fn helper() { }\n", "fn main() {\n  x = 1;\n}");
    expect(full.offset).toBe(1);
    const c = programLines(
      JSON.parse(wasm.langCompile(full.source)) as LangCompiled,
      full.offset,
    );
    expect(c.errors.map((e) => [e.line, e.code])).toEqual([
      [2, "unknown-name"],
    ]);
    expect(c.osErrors).toEqual([false]);
    const bad = withOs("fn helper() { y = 2; }", "fn main() { }");
    const d = programLines(
      JSON.parse(wasm.langCompile(bad.source)) as LangCompiled,
      bad.offset,
    );
    expect(d.osErrors).toEqual([true]);
  });
});
