// One-time setup for a fresh machine: Rust WASM target + wasm-bindgen CLI.
import { execSync } from "node:child_process";
import { WASM_BINDGEN_VERSION, WASM_TARGET } from "./wasm-config.mjs";

const run = (cmd) => {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

run(`rustup target add ${WASM_TARGET}`);
let installed = "";
try {
  installed = execSync("wasm-bindgen --version", { encoding: "utf8" });
} catch {
  // not installed yet
}
if (installed.includes(WASM_BINDGEN_VERSION)) {
  console.log(`wasm-bindgen ${WASM_BINDGEN_VERSION} already installed`);
} else {
  run(
    `cargo install wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION} --locked`,
  );
}
