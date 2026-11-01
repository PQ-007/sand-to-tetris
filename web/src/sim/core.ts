// Loads the Rust simulator core (compiled to WASM by `npm run build:wasm`)
// and wraps its JSON API with types.
import init, * as wasm from "./pkg/s2t_wasm.js";
import type {
  AsmLayout,
  AsmLine,
  AsmPlaced,
  AsmProgram,
  AsmSymbol,
  AsmToken,
  AsmBody,
  StageResult,
  Design,
  IsaTrace,
  LevelInfo,
  LibraryInput,
  MatchReport,
  Report,
  SimView,
  StepsView,
  LangCompiled,
  LangError,
  LangInfo,
  LangProgram,
  LangToken,
  VmBuilt,
  VmCommand,
  VmCtx,
  VmError,
  VmRunResult,
} from "./types";

let ready: Promise<void> | undefined;

/** Loads the WASM module once; later calls reuse the same promise. */
export function loadCore(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export async function getCoreVersion(): Promise<string> {
  await loadCore();
  return wasm.coreVersion();
}

// The functions below need loadCore() to have finished.

/** An instruction word as assembly, e.g. "SET r1, 5" (docs/ISA.md). */
export function disassemble(word: number): string {
  return wasm.disassemble(word & 0xffff);
}

/** Assembles a whole program with the reference assembler. */
export function asmAssemble(source: string): AsmProgram {
  return JSON.parse(wasm.asmAssemble(source)) as AsmProgram;
}

/** The reference assembler's four stages, for grading the learner's. */
export const asmStages = {
  tokenize: (line: string) =>
    JSON.parse(wasm.asmTokenize(line)) as StageResult<AsmToken[]>,
  parse: (tokens: AsmToken[]) =>
    JSON.parse(wasm.asmParse(JSON.stringify(tokens))) as StageResult<AsmLine>,
  layout: (lines: AsmLine[]) =>
    JSON.parse(wasm.asmLayout(JSON.stringify(lines))) as StageResult<AsmLayout>,
  encode: (
    body: AsmBody,
    symbols: Record<string, AsmSymbol>,
    placed: AsmPlaced,
  ) =>
    JSON.parse(
      wasm.asmEncode(
        JSON.stringify(body),
        JSON.stringify(symbols),
        JSON.stringify(placed),
      ),
    ) as StageResult<number[]>,
};

/** Translates a VM program with the reference translator and assembles it. */
export function vmBuild(source: string): VmBuilt {
  return JSON.parse(wasm.vmBuild(source)) as VmBuilt;
}

/** The reference VM translator's stages, for grading the learner's. */
export const vmStages = {
  parse: (line: string) =>
    JSON.parse(wasm.vmParse(line)) as
      { ok: VmCommand | null } | { error: VmError },
  translate: (cmd: VmCommand, ctx: VmCtx) =>
    JSON.parse(
      wasm.vmTranslate(JSON.stringify(cmd), JSON.stringify(ctx)),
    ) as string[],
  start: () =>
    JSON.parse(wasm.vmStart()) as { bootstrap: string[]; runtime: string[] },
  check: (commands: (VmCommand | null)[]) =>
    JSON.parse(wasm.vmCheck(JSON.stringify(commands))) as VmError[],
};

/** Runs a VM program on the reference interpreter. */
export function vmRun(source: string, maxSteps: number): VmRunResult {
  return JSON.parse(wasm.vmRun(source, maxSteps)) as VmRunResult;
}

/** A VM program on the interpreter, one command per step (the stack demo).
 * Its constructor throws the program's errors as JSON. */
export const VmRunner = wasm.VmRunner;
export type VmRunner = wasm.VmRunner;

/** Compiles C Shard with the reference compiler (to VM code). */
export function langCompile(source: string): LangCompiled {
  return JSON.parse(wasm.langCompile(source)) as LangCompiled;
}

type Staged<T> = { ok: T } | { error: LangError };

/** The reference compiler's stages, for grading the learner's. */
export const langStages = {
  tokenize: (source: string) =>
    JSON.parse(wasm.langTokenize(source)) as Staged<LangToken[]>,
  parse: (tokens: LangToken[]) =>
    JSON.parse(wasm.langParse(JSON.stringify(tokens))) as Staged<LangProgram>,
  check: (program: LangProgram) =>
    JSON.parse(wasm.langCheck(JSON.stringify(program))) as
      { ok: LangInfo } | { error: LangError; errors: LangError[] },
  generate: (program: LangProgram, info: LangInfo) =>
    JSON.parse(
      wasm.langGenerate(JSON.stringify(program), JSON.stringify(info)),
    ) as string[],
};

/** A program running on the reference CPU (needs loadCore() first). */
export const Machine = wasm.Machine;
export type Machine = wasm.Machine;

/** Runs `rom` on the reference CPU from reset, for `steps` instructions. */
export function isaTrace(rom: number[], steps: number): IsaTrace {
  return JSON.parse(wasm.isaTrace(JSON.stringify(rom), steps)) as IsaTrace;
}

export function levelInfo(toml: string): LevelInfo {
  return JSON.parse(wasm.levelInfo(toml)) as LevelInfo;
}

export function check(
  library: LibraryInput,
  level: string,
  design: Design,
): Report {
  return JSON.parse(
    wasm.check(JSON.stringify(library), level, JSON.stringify(design)),
  ) as Report;
}

/**
 * Runs input steps in order on one circuit (built once), continuing from
 * `state`: the view after the last step, and each step's outputs.
 */
export function simulateSteps(
  library: LibraryInput,
  level: string,
  design: Design,
  steps: Record<string, number>[],
  state: Record<string, string> = {},
): StepsView {
  return JSON.parse(
    wasm.simulateSteps(
      JSON.stringify(library),
      level,
      JSON.stringify(design),
      JSON.stringify(steps),
      JSON.stringify(state),
    ),
  ) as StepsView;
}

/**
 * Simulates a design. Pass the previous view's `state` to continue from
 * it, so latches and flip-flops remember; omit it to start from power-on.
 */
export function simulate(
  library: LibraryInput,
  level: string,
  design: Design,
  inputs: Record<string, number>,
  state: Record<string, string> = {},
): SimView {
  return JSON.parse(
    wasm.simulate(
      JSON.stringify(library),
      level,
      JSON.stringify(design),
      JSON.stringify(inputs),
      JSON.stringify(state),
    ),
  ) as SimView;
}

export function matchCheck(
  library: LibraryInput,
  component: string,
): MatchReport {
  return JSON.parse(
    wasm.matchCheck(JSON.stringify(library), component),
  ) as MatchReport;
}
