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

export function simulate(
  library: LibraryInput,
  level: string,
  design: Design,
  inputs: Record<string, number>,
): SimView {
  return JSON.parse(
    wasm.simulate(
      JSON.stringify(library),
      level,
      JSON.stringify(design),
      JSON.stringify(inputs),
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
