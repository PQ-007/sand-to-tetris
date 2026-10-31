# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sand to Tetris: a static, browser-only educational site. Learners go from the physics of silicon to a playable Tetris running on a computer they build themselves. The approved plan (architecture, milestones, defaults) is in `docs/PLAN.md`. Read it before starting a milestone, and keep it up to date when a decision changes.

Learners build components in a drag-and-drop editor, one level per component. A passed component unlocks and becomes a black box in the toolbox for later levels, so the computer grows as a stack of the learner's own parts. There is no text HDL for learners. Designs are JSON netlists, and nobody edits them by hand.

## Status

- M0 (scaffold): done.
- M1 (Chapter 0): done. Content pipeline, Chapter 0 prose, five demos, glossary, cited sources.
- M2 (switch-level core): done. Netlist format + validation + layering, switch-level engine, checker, `s2t check`, Layer 1 levels NOT/NAND/NOR (+ optional AND) with references.
- Next: M3 (Layer 1 in the browser: WASM bridge, drag-and-drop editor, level map, Chapter 1). Keep this section up to date when a milestone lands.

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
cargo run -p s2t-cli -- check hdl/levels/layer1/nand              # check a level's reference
cargo run -p s2t-cli -- check hdl/levels/layer1/nand my.json      # check any design (add --json for the report)
cargo run -p s2t-cli -- check-all hdl/levels                      # every reference + exhaustive tables
```

- The Cargo workspace root is the repo root (`Cargo.toml`), with members under `sim/crates/`. Toolchain crates join later.
- `wasm-bindgen` (crate, pinned with `=` in `Cargo.toml`) and `wasm-bindgen-cli` (`scripts/wasm-config.mjs`, `.github/workflows/ci.yml`) must be the **same version**. Bump all three together.
- The WASM build output `web/src/sim/pkg/` is generated and git-ignored. Run `npm run build:wasm` before vitest or tsc if it's missing.
- Prettier ignores `*.md` on purpose (prose and tables are hand-formatted). It does format `docs/*.yaml`.
- To stop a background `vite preview`, use `pkill -f "vite/bin"` or kill by port: `pkill -f "vite preview"` also matches (and kills) the shell running it.
- CI (`.github/workflows/ci.yml`) runs test, lint and build on every push and PR, and deploys `web/dist` to GitHub Pages on pushes to `main`.

## Architecture (big picture)

- `sim/crates/`: Rust crates, the single source of truth for simulation and checking. They are compiled natively (tests, CLI, CI) and to WASM (browser), so the browser and CI can never disagree. Dependency direction: `cli`/`wasm` → `checker` → `switch` → `netlist`.
  - `s2t-netlist`: design JSON (`Design`: parts + wires between `{"port":..}` / `{"part":..,"pin":..}` endpoints; `pos`/`points` are editor-only), level TOML (`Level`), `validate()` (typed `Problem`s with message + parts/ports to highlight; **this is where layering is enforced**: primitives only in Layer 1, no higher-layer parts, only unlocked components, no self-reference or dependency loops), `flatten()` (component parts replaced recursively by their unlocked designs → `Circuit` of transistors and rails over numbered nets; each transistor keeps its part path for highlighting), and `builder` helpers for tests.
  - `s2t-switch`: switch-level engine. Values 0/1/Z/X; NMOS on with gate 1, PMOS with gate 0; nets joined by conducting switches take their drivers' value; 0+1 in one group = short (reported with parts); no driver = Z (no charge storage); X/Z gates solved both ways, disagreement = X; iterate from all-X to a fixpoint.
  - `s2t-checker`: parses truth tables (`a b | out`), runs every row, returns a serde-serializable `Report` with `Diagnostic`s (row, inputs, expected/actual, kind wrong/floating/short/unknown, message, authored hint, parts/ports). Learner mistakes go in the report; only a broken level definition is an `Err`.
  - Planned: **gate-level** engine (Layers 2–3: event-driven, unit delay, so feedback latches work) and **fast models** (behavioral, identical pins).
  - `s2t-wasm`: a deliberately small JS API (load, set inputs, step, read, check). Keep it small.
- `web/`: TypeScript + Vite, no framework. The schematic editor (M3) will be custom SVG; progress and designs will live in IndexedDB.
  - A demo = a pure, tested model in `web/src/demos/*.ts` (physics, data, math; no DOM) + a thin Web Component in `web/src/components/*.ts` extending `Demo` from `kit.ts` (shadow DOM, shared styles, `svg()`, `chips()`, `slider()`, `wide()`). Register the tag in `known-tags.ts` and import it in `components/demos.ts`; a test checks the registry matches `customElements.define` calls.
  - Colours are CSS tokens on `:root` in `web/src/style.css` (light + dark); shadow DOM inherits them. Demos must give every state a text label, an `aria-label` on each diagram, and respect `prefers-reduced-motion`.
- `docs/`: `chapters/NN-slug.md` (one per layer, YAML frontmatter `number`/`title`/`summary`), `glossary.yaml`, `sources.yaml`.
  - Chapter syntax: `[[term]]` or `[[shown text|glossary-id]]` links the glossary (hover card + link); `[@source-id]` adds a numbered citation (contested sources show `?` and a visible "Contested" note in the auto-generated Sources list). `<aside class="summary">` holds the required end-of-chapter summary; `<details class="deeper">` holds optional math.
  - Demos are custom tags on their own line (`<mosfet-demo></mosfet-demo>`); only tags in `web/src/components/known-tags.ts` are allowed.
  - `web/content/` (build-time only, never bundled) renders it all and exposes `virtual:s2t-content`. **Any broken glossary link, unknown citation, unregistered tag or missing summary fails the build and `npm test`**, with `file:line`.
  - Hash routing (`#/chapter/0`, `#/chapter/0/s/<anchor>`, `#/glossary/<id>`) because GitHub Pages has no rewrites; in-page anchors must go through `/s/`, never a bare `#id`.
- `hdl/levels/layerN/<id>/`: `level.toml` (id = folder name, layer = folder's N, goal, inputs, outputs, `optional`, `truth_table`, `[hints]` keyed wrong/floating/short/unknown) and `reference.json`. `cargo test` runs `check-all` over this tree (every reference must pass; truth tables must be exhaustive). Reference solutions **must never be bundled into the website**; a web test fails if anything in `web/src` or `web/content` imports from `hdl/`.
- `tests/`: per-component and per-layer test tables, and CPU test programs.
- `toolchain/`: reference assembler / VM translator / compiler, in Rust (M8+). Learners write their own versions in TypeScript in the browser.

## Rules

1. **Strict layering, enforced in code.** A component may use only components from its own or lower layers that are unlocked, and the dependency graph must have no cycles. The Rust netlist validator rejects violations even in imported files. Hiding parts in the toolbox is a convenience, not the enforcement. Base parts: Layer 1 = NMOS, PMOS, VDD, GND only. Each higher layer starts from the components built below it. Our own toolchain crates follow the same direction (compiler → VM → assembler → ISA), enforced by Cargo dependencies.
2. **Tests first.** Before implementing a component, engine feature or toolchain stage, write its tests (truth table, test script, CPU program). Failure messages must name the row, inputs, expected vs actual, and point to the cause (e.g. "`out` is floating when a=1, b=0").
3. **Abstraction swap.** A fast model is allowed for a component only after the learner's design passes its tests *and* a match check against the model (exhaustive for ≤16 input bits, otherwise 10k random inputs/cycles). The swap must stay visible and toggleable in the UI.
4. **Facts are cited.** Every historical date or claim in chapter content needs an entry in `docs/sources.yaml` from a reliable source. Mark contested items `uncertain:` and present them as contested. Never guess. Record how it was checked in `checked:`. Illustrative numbers use `estimate: true` with a `note`. britannica.com and computerhistory.org were not reachable from the cloud container in M1 (search results only); say so if that still holds.
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
