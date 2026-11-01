# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sand to Tetris: a static, browser-only educational site. Learners go from the physics of silicon to a playable Tetris running on a computer they build themselves. The approved plan (architecture, milestones, defaults) is in `docs/PLAN.md`. Read it before starting a milestone, and keep it up to date when a decision changes.

Learners build components in a drag-and-drop editor, one level per component. A passed component unlocks and becomes a black box in the toolbox for later levels, so the computer grows as a stack of the learner's own parts. There is no text HDL for learners. Designs are JSON netlists, and nobody edits them by hand.

## Status

- M0 (scaffold): done.
- M1 (Chapter 0): done. Content pipeline, Chapter 0 prose, five demos, glossary, cited sources.
- M2 (switch-level core): done. Netlist format + validation + layering, switch-level engine, checker, `s2t check`, Layer 1 levels NOT/NAND/NOR (+ optional AND) with references.
- M3 (Layer 1 in the browser): done. WASM API, drag-and-drop editor with live 0/1/Z/X, level map, unlocking, IndexedDB progress + export/import, look-inside, keyboard panel, Chapter 1. **The first vertical slice (M0-M3) is complete.**
- M4 (Layer 2): done. Gate-level engine, buses (widths, split/join, repeat + shared), native models + random tests, match check + fast-model swap UI, 18 Layer 2 levels ending in the ALU, Layer 1 constants, Chapter 2 with a ripple-carry demo.
- ISA decisions so far live in `docs/ISA.md` (16-bit words; hybrid ALU with flags Z N C; shifts deferred). Update it only after discussing with the user.
- M5 (Layer 3, memory): done. Sequential levels in the core; SR latch → D latch → D flip-flop → Bit → Register → RAM8 → RAM64 → RAM512 → RAM4K and PC with references (+ Layer 2 DMUX4WAY, DMUX8WAY, MUX8WAY16); clocked fast models with a sequential match check; live memory in the editor; the waveform view; Chapter 3 with a latch demo and cited history (Eccles–Jordan, core memory, Dennard's DRAM cell, Intel 1103).
- Next: M6, the ISA, designed together with the user (Rule 5): propose options and trade-offs, don't decide alone. Decisions are in `docs/PLAN.md` ("M5 decisions"). Keep this section up to date when a milestone lands.

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
- To stop a background preview server, run a pkill pattern like `"[v]ite preview"` from a script file or a short command: pkill -f matches against full command lines, so if the shell command itself contains the plain words it kills its own shell.
- Commit messages: write them to a file and use `git commit -F`; backticks inside a double-quoted `-m` run as shell commands.
- Browser checks: Playwright scripts in the scratchpad drive the built site (`npm run build` with `BASE_PATH=/sand-to-tetris/`, then serve `web/dist` with Vite's preview command and `--base /sand-to-tetris/`). Click pins by coordinates (`page.mouse`), not `locator.click()`: the visible pin dot ignores pointer events and an invisible hit circle sits on top.
- CI (`.github/workflows/ci.yml`) runs test, lint and build on every push and PR, and deploys `web/dist` to GitHub Pages on pushes to `main`.

## Architecture (big picture)

- `sim/crates/`: Rust crates, the single source of truth for simulation and checking. They are compiled natively (tests, CLI, CI) and to WASM (browser), so the browser and CI can never disagree. Dependency direction: `cli`/`wasm` → `checker` → `switch` → `netlist`.
  - `s2t-netlist`: design JSON (`Design`: parts + wires between `{"port":..}` / `{"part":..,"pin":..}` endpoints; parts may have `width` (split/join, bit pins named `0`..`N-1`, bit 0 = LSB), `repeat` and `shared` (components); `pos`/`points` and the design's `port_pos` (moved input/output ports) are editor-only), level TOML (`Level`), `validate()` (typed `Problem`s with message + parts/ports to highlight; **this is where layering is enforced**: primitives only in Layer 1, no higher-layer parts, only unlocked components, no self-reference or dependency loops), `flatten()` (component parts replaced recursively by their unlocked designs → `Circuit` of transistors and rails over numbered nets; each transistor keeps its part path for highlighting), and `builder` helpers for tests.
  - `s2t-switch`: switch-level engine. Values 0/1/Z/X; NMOS on with gate 1, PMOS with gate 0; nets joined by conducting switches take their drivers' value; 0+1 in one group = short (reported with parts); no driver = Z (no charge storage); X/Z gates solved both ways, disagreement = X; iterate from all-X to a fixpoint.
  - `s2t-checker`: parses truth tables (`a b | out`), runs every row, returns a serde-serializable `Report` with `Diagnostic`s (row, inputs, expected/actual, kind wrong/floating/short/unknown, message, authored hint, parts/ports). Learner mistakes go in the report; only a broken level definition is an `Err`.
  - `s2t-gate`: gate-level engine for Layer 2+. Cells are leaf components evaluated as a `TruthTable` (X inputs: try every completion, X only where results differ) or a native `Model`. Event-driven, unit delay: rounds to settle = `depth` (gate delays); non-settling loops are reported. Feedback works, ready for Layer 3 latches.
  - Clocked models (`s2t-models::clocked`: register, ram8…ram4k, pc) have memory words updated on a rising clock edge; in the gate engine they're `Model::Clocked`, each cell with its own `Memory` (saved as `1,0:2a` = last clk, then `index:hex` words; `#mem` keys in the live state). The engine's `settle` is event-driven: only cells whose inputs changed are evaluated.
  - A sequential level with a model also runs random clock cycles (clk low with fresh inputs, then only clk rises; addresses from a small pool), and its match check is 10,000 such cycles. `check`/`check-all` (CLI) and the web's status re-check run lower *memory* components as their models (each was checked against that model); the editor runs them fast only when the learner swapped them.
  - `s2t-models`: native models (`not16`, `and16`, `or16`, `xor16`, `mux16`, `mux4way16`, `or8way`, `add16`, `addc16`, `inc16`, `alu`): reference behaviour for wide levels (seeded random tests) and the fast models for the swap. A level names one with `model = "…"`; `check-all` requires the model's port widths to match.
  - Sequential levels (`sequential = true` in level.toml): the checker runs the table's rows as steps on one simulator so state carries over, labels failures "Step 3 (after steps 1–2)", and accepts `-` (don't care) in expected outputs; such tables are never used as leaf truth tables and needn't be exhaustive. Layer 1 can't be sequential.
  - Gate-level flatten (`s2t-netlist::flatten_gates`) expands bit by bit until leaf cells; the caller picks leaves: Layer 1 gates always (their exhaustive tables were passed), plus components in the library's `fast` set. Two outputs on one wire is an error there (legal only at switch level).
  - Match check (`s2t-checker::api::match_check`, WASM `matchCheck`): learner's design vs leaf model, exhaustive up to 16 input bits, else 10,000 random inputs; Layer 1 and locked components are refused.
  - `s2t-checker::api`: the browser API, JSON in/out, tested natively: `level_info(toml)`, `check(library, level, design)`, `simulate(library, level, design, inputs)` / `simulate_from(…, state)` returning a `SimView`, and `simulate_steps(…, steps, state)` (one flatten for a whole step sequence: the step table, a replay, a Tick) (value at every visible endpoint, transistor on/off/maybe, shorts, outputs, and `state`: every gate output's known bit keyed by gate path like `ff/master/latch/top.out`, fed back into the next call so memory persists and survives unrelated edits; the play page does this only for sequential levels). A *library* is `{"levels": [toml...], "unlocked": [designs...]}`. Live preview uses `flatten_preview` (an unconnected output doesn't block it; unknown/locked parts do).
  - `s2t-wasm`: 1:1 wrappers over `api` returning JSON strings (errors become JS exceptions). Keep it that thin.
- `web/`: TypeScript + Vite, no framework.
  - Game: `src/sim/core.ts` (typed WASM wrapper; types in `sim/types.ts` mirror the Rust JSON, and `test/core.test.ts` drives the real .wasm to keep them in sync), `src/game.ts` (pure: level order, open/locked/passed/broken statuses with re-checking in dependency order, toolbox and library for a level), `src/app.ts` (loads core + levels + progress), `src/progress.ts` (IndexedDB, memory fallback, export/import), `src/levels.ts` (map), `src/play.ts` (level page), `src/editor/` (`model.ts` pure edits + undo, `geometry.ts` pin/port layout and routing, `canvas.ts` the SVG editor, `actions.ts` what the right-click menu offers per target (pure, tested), `menu.ts` the accessible popup menu, `waveform.ts` (pure: segments, bus labels) + `waveform-view.ts` (SVG timing diagram: square waves, labelled bus segments, hatched X) for sequential levels' Test steps / Live tabs; the play page maps menu ids to edits). Routes `#/levels`, `#/play/<id>`.
  - Levels reach the site via the content plugin's `levelFiles` (raw `level.toml`, parsed by WASM `levelInfo`). Never `reference.json`.
  - Fast-model choices: `src/fast.ts`, per browser in localStorage, each with a fingerprint of the design that passed the match check (editing the design turns fast mode off). Toggle lives on the level map (`levels.ts`); `play.ts` shows "How parts run". The level page is a full-window workspace (canvas pane + right panel with goal, inputs, truth table and a sticky Check); the canvas fills its pane (`fillContainer`, ResizeObserver), grows with the circuit (`canvasSize`) and scrolls; zoom (25–200%, buttons/Ctrl+wheel/+−0/Fit) is the learner's choice, never automatic. Drag on empty canvas pans. There is no separate keyboard panel: parts and ports are focusable, their `aria-label` lists their wires (`connectionSummary`), and the actions menu (menu key / Shift+F10) has Connect… (pin, then target) and Disconnect… (one wire or all), so wiring has a keyboard path on the canvas itself (rule 6).
  - Layout: each route sets `body[data-page]` (CSS picks the layout from it). Chapter pages are three columns: course nav, article (max 48rem), and a sticky "On this page" ToC on the right with scroll-spy (`trackSections` in `pages.ts`); below 1280px the course nav hides, below 900px the ToC moves above the article, collapsed.
  - Browser tests of later layers can import a progress file built from reference designs in the scratchpad (never commit it or ship it).
  - A demo = a pure, tested model in `web/src/demos/*.ts` (physics, data, math; no DOM) + a thin Web Component in `web/src/components/*.ts` extending `Demo` from `kit.ts` (shadow DOM, shared styles, `svg()`, `chips()`, `slider()`, `wide()`). Register the tag in `known-tags.ts` and import it in `components/demos.ts`; a test checks the registry matches `customElements.define` calls.
  - Colours are CSS tokens on `:root` in `web/src/style.css` (light + dark); shadow DOM inherits them. Demos must give every state a text label, an `aria-label` on each diagram, and respect `prefers-reduced-motion`.
- `docs/`: `chapters/NN-slug.md` (one per layer, YAML frontmatter `number`/`title`/`summary`), `glossary.yaml`, `sources.yaml`.
  - Chapter syntax: `[[term]]` or `[[shown text|glossary-id]]` links the glossary (hover card + link; inside a table cell write `[[shown\|id]]`, or the table splits the cell); `[@source-id]` adds a numbered citation (contested sources show `?` and a visible "Contested" note in the auto-generated Sources list). `<aside class="summary">` holds the required end-of-chapter summary; `<details class="deeper">` holds optional math.
  - Demos are custom tags on their own line (`<mosfet-demo></mosfet-demo>`); only tags in `web/src/components/known-tags.ts` are allowed.
  - `web/content/` (build-time only, never bundled) renders it all and exposes `virtual:s2t-content`. **Any broken or unrendered glossary link, unknown citation, unregistered tag or missing summary fails the build and `npm test`**, with `file:line`.
  - Hash routing (`#/chapter/0`, `#/chapter/0/s/<anchor>`, `#/glossary/<id>`) because GitHub Pages has no rewrites; in-page anchors must go through `/s/`, never a bare `#id`.
- **Languages: English + Mongolian.** Everything learners see exists in both; English is the original, and new text needs its Mongolian in the same change. Terms: `docs/mn/TERMS.md`: a Mongolian word only where one is already in use; otherwise keep the English term in Latin letters (latch, flip-flop, carry, bus…), never a coined word.
  - UI strings: `web/src/i18n/` (`en.ts`, `mn.ts` typed against the English keys so a missing key is a type error; demo text in `demos.en.ts`/`demos.mn.ts`). `t(key, vars)` fills `{name}` placeholders (a test checks both languages use the same ones); a message may be a function for plurals. `setLang` saves to localStorage (`s2t-lang`), sets `<html lang>` and fires `s2t-lang`; pages re-render on it. Avoid case suffixes after interpolated names in Mongolian (use "`a`: …" phrasing): the suffix depends on the word.
  - Content: `docs/mn/chapters/` (same file names; the build checks the same headings count, demo tags, citations), `docs/mn/glossary.yaml` (same ids; `see` comes from English), `docs/mn/sources.yaml` (claim/uncertain/checked/note translated; titles stay original), `hdl/levels/mn.yaml` (name, goal, hints per level; a test requires every level). `web/src/text.ts` picks the language (`site()`, `levelName`, `levelGoal`, `levelHint`).
  - Checker messages: Rust `Problem`/`ReportProblem` carry a `code` + `args` beside the English `message`; `web/src/messages.ts` (`problemText`, `diagnosticText`) builds the Mongolian text from them. A new problem kind needs a code and a `problem.<code>` key.
- `hdl/levels/layerN/<id>/`: `level.toml` (id = folder name, layer = folder's N, goal, inputs, outputs, `requires`, `optional`, `widths = { a = 16 }`, `model`, `random_tests`, `truth_table` with decimal/0x/0b values, `[hints]` keyed wrong/floating/short/unknown) and `reference.json`. Layer 1 runs on the switch engine, Layer 2+ on the gate engine. `cargo test` runs `check-all` over this tree (every reference must pass; truth tables must be exhaustive). Reference solutions **must never be bundled into the website**; a web test fails if anything in `web/src` or `web/content` imports from `hdl/`.
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
