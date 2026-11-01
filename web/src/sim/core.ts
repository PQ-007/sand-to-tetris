// Loads the Rust simulator core (compiled to WASM by `npm run build:wasm`)
// and wraps its JSON API with types.
import init, * as wasm from "./pkg/s2t_wasm.js";
import type {
  Design,
  LevelInfo,
  LibraryInput,
  MatchReport,
  Report,
  SimView,
  StepsView,
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
