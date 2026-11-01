// Turns the learner's TypeScript into something that runs: types are
// stripped (sucrase, loaded only when needed), then it runs in a worker
// with a time limit.
import {
  buildCompilerTests,
  gradeCompilerTest,
  type CmOutcome,
  type CmResult,
  type CmTestCase,
} from "./compiler-tests";
import {
  asmAssemble,
  asmStages,
  langCompile,
  langStages,
  Machine,
  vmBuild,
  vmRun,
  vmStages,
} from "./sim/core";
import type { AsmProgram, LangCompiled } from "./sim/types";
import { fromAsmErrors, type VmTranslation } from "./translator";
import {
  buildTranslatorTests,
  gradeTest,
  type Exec,
  type TrOutcome,
  type TrResult,
  type TrTestCase,
} from "./translator-tests";
import { workshopStore } from "./workshop-store";
import { buildTests, type TestCase, type TestResult } from "./workshop-tests";
import type { WorkerRequest } from "./workshop-worker";

/** How long the learner's code may run before it's stopped. */
const TIME_LIMIT_MS = 5000;

export type AssembleFn = (source: string) => Promise<AsmProgram>;

export interface RunError {
  /** "syntax" (it doesn't compile), "timeout", "missing" (exports), "crash". */
  code: string;
  message: string;
}

/** TypeScript → CommonJS JavaScript, or where it doesn't parse. */
export async function transpile(
  ts: string,
): Promise<{ js: string } | { error: RunError }> {
  const { transform } = await import("sucrase");
  try {
    return {
      js: transform(ts, { transforms: ["typescript", "imports"] }).code,
    };
  } catch (e) {
    return { error: { code: "syntax", message: String((e as Error).message) } };
  }
}

function inWorker<T>(req: WorkerRequest): Promise<T | { error: RunError }> {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL("./workshop-worker.ts", import.meta.url),
      { type: "module" },
    );
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ error: { code: "timeout", message: "" } });
    }, TIME_LIMIT_MS);
    worker.onmessage = (e: MessageEvent<T | { error: RunError }>) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ error: { code: "crash", message: e.message } });
    };
    worker.postMessage(req);
  });
}

let tests: TestCase[] | undefined;

/** Every test, with answers from the reference assembler (needs the core). */
export function workshopTests(): TestCase[] {
  tests ??= buildTests({ ...asmStages, assemble: asmAssemble });
  return tests;
}

/** Runs every test on the learner's code. */
export async function runWorkshopTests(
  code: string,
): Promise<{ results: TestResult[] } | { error: RunError }> {
  const t = await transpile(code);
  if ("error" in t) return t;
  return inWorker({ kind: "test", js: t.js, tests: workshopTests() });
}

/** The learner's assembler as an AssembleFn (errors become program errors). */
export function learnerAssembler(code: string): AssembleFn {
  return async (source) => {
    const fail = (e: RunError): AsmProgram => ({
      code: [],
      data: [],
      symbols: {},
      sourceMap: [],
      errors: [{ line: 0, code: e.code, args: {}, message: e.message }],
    });
    const t = await transpile(code);
    if ("error" in t) return fail(t.error);
    const r = await inWorker<{ program: AsmProgram }>({
      kind: "assemble",
      js: t.js,
      source,
    });
    return "error" in r ? fail(r.error) : r.program;
  };
}

/** Built-in first; the learner's own once every test passes. */
export async function assemblerChoices(): Promise<
  { id: "builtin" | "yours"; assemble: AssembleFn }[]
> {
  const builtin = {
    id: "builtin" as const,
    assemble: async (s: string) => asmAssemble(s),
  };
  const mine = (await (await workshopStore()).load()).assembler;
  return mine?.passed
    ? [{ id: "yours", assemble: learnerAssembler(mine.code) }, builtin]
    : [builtin];
}

// ---- the VM translator workshop -------------------------------------------------

export type TranslateFn = (source: string) => Promise<VmTranslation>;

let trTests: TrTestCase[] | undefined;

/** Every translator test, with answers from the reference (needs the core). */
export function translatorTests(): TrTestCase[] {
  trTests ??= buildTranslatorTests({
    parse: vmStages.parse,
    translate: vmStages.translate,
    start: vmStages.start,
    run: vmRun,
    errors: (source) => vmBuild(source).errors,
  });
  return trTests;
}

/** Assembles lines with the reference assembler and runs them on the CPU. */
export const execOnCpu: Exec = (lines, sourceMap, maxSteps, globals) => {
  const p = asmAssemble(lines.join("\n"));
  const bad = p.errors[0];
  if (bad) {
    const e = fromAsmErrors([bad], sourceMap)[0];
    const text = lines[bad.line - 1]?.trim() ?? "";
    return {
      error: e?.code ?? "asm",
      message: `${bad.message}: ${text}`,
      line: e?.line ?? 0,
    };
  }
  const m = new Machine(Uint16Array.from(p.code), Uint16Array.from(p.data));
  try {
    m.run(maxSteps);
    const screen = Array.from(m.screen());
    return {
      halted: m.halted(),
      result: m.ram(0x3fff, 1)[0] ?? 0,
      sp: m.regs()[6] ?? 0,
      globals: Array.from(m.ram(0, globals)),
      screen: screen.flatMap((v, i) => (v ? [[i, v] as [number, number]] : [])),
    };
  } finally {
    m.free();
  }
};

/** Runs every translator test on the learner's code. */
export async function runTranslatorTests(
  code: string,
): Promise<{ results: TrResult[] } | { error: RunError }> {
  const t = await transpile(code);
  if ("error" in t) return t;
  const tests = translatorTests();
  const r = await inWorker<{ outcomes: TrOutcome[] }>({
    kind: "translator-test",
    js: t.js,
    tests,
  });
  if ("error" in r) return r;
  return {
    results: tests.map((test, i) => {
      const o = r.outcomes[i];
      return o
        ? gradeTest(test, o, execOnCpu)
        : gradeTest(
            test,
            { kind: "value", got: { error: "crash", message: "" } },
            execOnCpu,
          );
    }),
  };
}

/** The built-in translator: s2t-vm's translation, before assembling. */
export const builtinTranslate: TranslateFn = async (source) => {
  const b = vmBuild(source);
  // Errors with lines are the assembler's: the page assembles again with
  // its chosen assembler and reports them itself.
  return {
    lines: b.lines,
    sourceMap: b.sourceMap,
    errors: b.lines.length ? [] : b.errors,
  };
};

/** The learner's translator as a TranslateFn. */
export function learnerTranslator(code: string): TranslateFn {
  return async (source) => {
    const fail = (e: RunError): VmTranslation => ({
      lines: [],
      sourceMap: [],
      errors: [{ line: 0, code: e.code, args: {}, message: e.message }],
    });
    const t = await transpile(code);
    if ("error" in t) return fail(t.error);
    const r = await inWorker<{ translation: VmTranslation }>({
      kind: "translate",
      js: t.js,
      source,
    });
    return "error" in r ? fail(r.error) : r.translation;
  };
}

/** Built-in first; the learner's own once every test passes. */
export async function translatorChoices(): Promise<
  { id: "builtin" | "yours"; translate: TranslateFn }[]
> {
  const builtin = { id: "builtin" as const, translate: builtinTranslate };
  const mine = (await (await workshopStore()).load()).translator;
  return mine?.passed
    ? [{ id: "yours", translate: learnerTranslator(mine.code) }, builtin]
    : [builtin];
}

// ---- the C Shard compiler workshop ------------------------------------------------

export type CompileFn = (source: string) => Promise<LangCompiled>;

let cmTests: CmTestCase[] | undefined;

/** Every compiler test, with answers from the reference (needs the core). */
export function compilerTests(): CmTestCase[] {
  cmTests ??= buildCompilerTests({
    ...langStages,
    compile: langCompile,
    run: vmRun,
  });
  return cmTests;
}

/** Runs every compiler test on the learner's code. */
export async function runCompilerTests(
  code: string,
): Promise<{ results: CmResult[] } | { error: RunError }> {
  const t = await transpile(code);
  if ("error" in t) return t;
  const tests = compilerTests();
  const r = await inWorker<{ outcomes: CmOutcome[] }>({
    kind: "compiler-test",
    js: t.js,
    tests,
  });
  if ("error" in r) return r;
  return {
    results: tests.map((test, i) =>
      gradeCompilerTest(
        test,
        r.outcomes[i] ?? {
          kind: "value",
          got: { error: "crash", message: "" },
        },
        vmRun,
      ),
    ),
  };
}

/** The learner's compiler as a CompileFn. */
export function learnerCompiler(code: string): CompileFn {
  return async (source) => {
    const fail = (e: RunError): LangCompiled => ({
      vm: [],
      sourceMap: [],
      errors: [{ line: 0, code: e.code, args: {}, message: e.message }],
    });
    const t = await transpile(code);
    if ("error" in t) return fail(t.error);
    const r = await inWorker<{ compiled: LangCompiled }>({
      kind: "compile",
      js: t.js,
      source,
    });
    return "error" in r ? fail(r.error) : r.compiled;
  };
}

/** Built-in first; the learner's own once every test passes. */
export async function compilerChoices(): Promise<
  { id: "builtin" | "yours"; compile: CompileFn }[]
> {
  const builtin = {
    id: "builtin" as const,
    compile: async (s: string) => langCompile(s),
  };
  const mine = (await (await workshopStore()).load()).compiler;
  return mine?.passed
    ? [{ id: "yours", compile: learnerCompiler(mine.code) }, builtin]
    : [builtin];
}
