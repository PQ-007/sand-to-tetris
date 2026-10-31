# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sand to Tetris: a static, browser-only educational site. Learners go from the physics of silicon to a playable Tetris running on a computer they build themselves. The approved plan (architecture, milestones, defaults) is in `docs/PLAN.md`. Read it before starting a milestone, and keep it up to date when a decision changes.

Learners build components in a drag-and-drop editor, one level per component. A passed component unlocks and becomes a black box in the toolbox for later levels, so the computer grows as a stack of the learner's own parts. There is no text HDL for learners. Designs are JSON netlists, and nobody edits them by hand.

## Status

M0 (scaffold) is done: Cargo workspace, Vite shell page that loads the WASM core, CI, and the commands below. Next is M1 (Chapter 0). Keep this section up to date when a milestone lands.

## Commands

```bash
npm install                 # once, at repo root (npm workspaces: web/)
npm run setup               # once per machine: wasm32 target + wasm-bindgen-cli (version pinned in scripts/wasm-config.mjs)
npm test                    # cargo test, then WASM build, then vitest (which loads the real .wasm)
npm run dev                 # WASM build + Vite dev server
npm run build               # WASM build + static site into web/dist (set BASE_PATH=/repo-name/ for GitHub Pages)
npm run lint                # cargo fmt --check, clippy -D warnings, eslint, prettier --check, tsc
npm run format              # cargo fmt + prettier --write

cargo test -p <crate> <test_name>                  # one Rust test, e.g. cargo test -p s2t-cli version
npx vitest run --root web <path> -t "<name>"       # one frontend test
cargo run -p s2t-cli -- version                    # CLI; `check <level-dir>` arrives in M2
```

- The Cargo workspace root is the repo root (`Cargo.toml`), with members under `sim/crates/`. Toolchain crates join later.
- `wasm-bindgen` (crate, pinned with `=` in `Cargo.toml`) and `wasm-bindgen-cli` (`scripts/wasm-config.mjs`, `.github/workflows/ci.yml`) must be the **same version**. Bump all three together.
- The WASM build output `web/src/sim/pkg/` is generated and git-ignored. Run `npm run build:wasm` before vitest or tsc if it's missing.
- Prettier ignores `*.md` on purpose (prose and tables are hand-formatted).
- CI (`.github/workflows/ci.yml`) runs test, lint and build on every push and PR, and deploys `web/dist` to GitHub Pages on pushes to `main`.

## Architecture (big picture)

- `sim/crates/`: Rust crates (`s2t-netlist`, `s2t-wasm`, `s2t-cli`; engines and checker arrive in M2+). They are the single source of truth for simulation and checking. They are compiled natively (tests, CLI, CI) and to WASM (browser), so the browser and CI can never disagree.
  - netlist: loads JSON, validates it, enforces layering, flattens the hierarchy.
  - engines: **switch-level** (Layer 1: values 0/1/Z/X; transistors are switches; nodes are grouped by conducting paths; a VDD–GND connection is reported as a short), **gate-level** (Layers 2–3: event-driven, unit delay, so feedback latches work and oscillation is detected), **fast models** (native behavioral components with identical pins).
  - checker: runs a level's tests and returns structured diagnostics. Each diagnostic has a failing row, the expected and actual values, the offending net or part ids so the UI can highlight them, and an authored hint.
  - wasm: a deliberately small JS API (load, set inputs, step, read, check). Keep it small.
- `web/`: TypeScript + Vite, no framework. Interactive demos are Web Components, used as custom tags directly in chapter Markdown (not MDX). The schematic editor is custom SVG. Progress and designs live in IndexedDB.
- `docs/`: one chapter per layer, plus `glossary.yaml` (terms are auto-linked from the text) and `sources.yaml` (citation per historical claim, with `uncertain:` flags that render visibly).
- `hdl/levels/`: one definition per component: goal text, pin signature, layer, dependencies, truth table / test script, hidden tests, hints. Reference solutions live here too but **must never be bundled into the website**.
- `tests/`: per-component and per-layer test tables, and CPU test programs.
- `toolchain/`: reference assembler / VM translator / compiler, in Rust (M8+). Learners write their own versions in TypeScript in the browser.

## Rules

1. **Strict layering, enforced in code.** A component may use only components from its own or lower layers that are unlocked, and the dependency graph must have no cycles. The Rust netlist validator rejects violations even in imported files. Hiding parts in the toolbox is a convenience, not the enforcement. Base parts: Layer 1 = NMOS, PMOS, VDD, GND only. Each higher layer starts from the components built below it. Our own toolchain crates follow the same direction (compiler → VM → assembler → ISA), enforced by Cargo dependencies.
2. **Tests first.** Before implementing a component, engine feature or toolchain stage, write its tests (truth table, test script, CPU program). Failure messages must name the row, inputs, expected vs actual, and point to the cause (e.g. "`out` is floating when a=1, b=0").
3. **Abstraction swap.** A fast model is allowed for a component only after the learner's design passes its tests *and* a match check against the model (exhaustive for ≤16 input bits, otherwise 10k random inputs/cycles). The swap must stay visible and toggleable in the UI.
4. **Facts are cited.** Every historical date or claim in chapter content needs an entry in `docs/sources.yaml` from a reliable source. Mark contested items `uncertain:` and present them as contested. Never guess.
5. **The ISA and the high-level language are designed together with the user.** Propose options and trade-offs; do not decide them alone.
6. **Accessibility:** circuit state is shown with labels (0/1/Z/X), never color alone. Every editor action has a keyboard path. Respect `prefers-reduced-motion`.
7. **Original content.** The build-and-unlock interaction model is fine. Do not copy levels, text or visuals from nandgame.com, Nand to Tetris or similar.

## Working style

- The user is learning while building. When you make a non-obvious design choice, explain it in a sentence or two, e.g. why ripple-carry is slow, or why CMOS uses complementary pairs.
- Work milestone by milestone (see `docs/PLAN.md`). After each one: run `npm test`, summarize what was built, and explain how to try it.
- Make small, well-described commits.

## Code style

- Rust: `cargo fmt` and `clippy -D warnings` (toolchain pinned in `rust-toolchain.toml`). `unwrap`/`expect` warn outside tests (`clippy.toml`); never use them on paths learner input can reach. Return typed errors that become diagnostics. `unsafe` is forbidden workspace-wide.
- TypeScript: `strict`, ES modules, prettier defaults. Every Web Component is self-contained and gets its configuration from attributes.
- Chapter prose: a plain-language explanation first, then the precise term, linked to the glossary. Each chapter ends with a "What you built / What you learned" summary.
