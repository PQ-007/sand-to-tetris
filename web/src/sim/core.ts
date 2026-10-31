// Loads the Rust simulator core (compiled to WASM by `npm run build:wasm`).
import init, { coreVersion } from "./pkg/s2t_wasm.js";

let ready: Promise<void> | undefined;

/** Loads the WASM module once; later calls reuse the same promise. */
export function loadCore(): Promise<void> {
  ready ??= init().then(() => undefined);
  return ready;
}

export async function getCoreVersion(): Promise<string> {
  await loadCore();
  return coreVersion();
}
