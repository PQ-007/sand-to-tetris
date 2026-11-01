// Turns the learner's TypeScript into something that runs: types are
// stripped (sucrase, loaded only when needed), then it runs in a worker
// with a time limit.
import { asmAssemble, asmStages } from "./sim/core";
import type { AsmProgram } from "./sim/types";
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
