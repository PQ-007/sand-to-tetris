// Builds the simulator core to WebAssembly and generates JS bindings into
// web/src/sim/pkg (git-ignored). Run via `npm run build:wasm`.
import { execSync } from "node:child_process";
import { WASM_BINDGEN_VERSION, WASM_TARGET } from "./wasm-config.mjs";

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

let version = "";
try {
  version = execSync("wasm-bindgen --version", { encoding: "utf8" }).trim();
} catch {
  console.error(
    "error: `wasm-bindgen` not found. Run `npm run setup` once to install it.",
  );
  process.exit(1);
}
if (!version.includes(WASM_BINDGEN_VERSION)) {
  console.error(
    `error: found ${version}, but the crate uses wasm-bindgen ${WASM_BINDGEN_VERSION}.\n` +
      "The two must match exactly. Run `npm run setup` to install the right one.",
  );
  process.exit(1);
}

run(`cargo build --release --target ${WASM_TARGET} -p s2t-wasm`);
run(
  `wasm-bindgen --target web --out-dir web/src/sim/pkg ` +
    `target/${WASM_TARGET}/release/s2t_wasm.wasm`,
);
