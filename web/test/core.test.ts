import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coreVersion, initSync } from "../src/sim/pkg/s2t_wasm.js";

// Loads the real WASM build (from `npm run build:wasm`) to prove the
// Rust → WASM → TypeScript bridge works, not just the Rust side.
describe("simulator core (WASM)", () => {
  it("loads and reports its version and netlist format", () => {
    const wasm = readFileSync(
      new URL("../src/sim/pkg/s2t_wasm_bg.wasm", import.meta.url),
    );
    initSync({ module: wasm });
    expect(coreVersion()).toMatch(/^\d+\.\d+\.\d+ \(format 1\)$/);
  });
});
