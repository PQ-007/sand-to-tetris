# Sand to Tetris: Plan

Approved 2026-10-31. Update this file when a decision changes.

## 1. What it is

A static website where a learner works through chapters, from sand and silicon up to Tetris. Each chapter explains a concept, gives one or more interactive demos, then has levels. In each level you build one component from parts you've already built. Passing a level adds that component to your toolbox as a sealed block, so the computer grows as a stack of your own components.

```
Tetris → OS → Compiler → VM → Assembler → Computer → CPU → RAM/Registers
       → ALU → Adders → Gates (NAND, NOT, NOR) → NMOS/PMOS → (physics of silicon)
```

We use this build-and-unlock pattern as an interaction model only. Levels, wording, visuals and puzzles are original, not a copy of nandgame.com.

## 2. Architecture

```
┌──────────────────────── Browser (static site, no backend) ─────────────────────┐
│ Chapters: Markdown + custom elements (<mosfet-demo>, <noise-chain>, ...)       │
│ Level map │ Drag-and-drop component editor (SVG) │ Live truth table │ Toggles  │
│                  │ small API: load, set inputs, step, read, check              │
│        ┌─────────▼────────── sim core: Rust → WASM ─────────┐                  │
│        │ netlist: load JSON → validate → flatten             │                  │
│        │ engines: switch-level │ gate-level │ fast models    │                  │
│        │ checker: run level tests → pass/fail + diagnostics  │                  │
│        └─────────────────────────────────────────────────────┘                  │
│ Progress + designs in IndexedDB, export/import as a file                        │
└────────────────────────────────────────────────────────────────────────────────┘
   The same Rust crates also run natively: `cargo test` and a CLI checker for CI
```

| Area | Choice | Why |
|---|---|---|
| Sim core | Rust → WASM | Fast and predictable (no garbage-collector pauses) for millions of simulation steps. The same code runs in CI and the browser, so they always agree. |
| Frontend | TypeScript + Vite, no framework, Web Components | Demos are custom tags that can be dropped straight into Markdown. |
| Content | Markdown + custom elements (not MDX) | MDX effectively needs React. This gives the same embedding with no framework. |
| Editor | Custom SVG schematic editor | Node-graph libraries draw boxes with curves, not circuits. We need snapping pins, right-angle wires and a live 0/1/Z/X overlay. |
| Design format | JSON netlist (parts, wires, positions), never hand-edited | The single source of truth for tests, saving and CI. A read-only text view is available. |
| Toolchain reference | Rust (via WASM) | Reuses the same pipeline. The learner writes their versions in TypeScript in the browser. |
| CI / hosting | GitHub Actions → GitHub Pages | Free and static. |

### Simulation engines
1. **Switch-level (Layer 1).** Each node holds one of four values: 0, 1, Z (floating, nothing drives it) or X (conflict). Transistors are switches: an NMOS conducts when its gate is 1, a PMOS when its gate is 0. Nodes connected through conducting switches are grouped, and each group takes the value of its strongest driver. If VDD and GND end up in one group, that's a short circuit and gets a clear message.
2. **Gate-level (Layers 2–3).** Event-driven with unit delay. Latches are feedback loops, and a loop has no "evaluate in order". Unit delay models how signals take time to go around the loop, and it catches oscillations.
3. **Fast models.** Native Rust versions of each component, with identical pins.

## 3. Component editor and levels

- **A level** has:
  - a goal in plain language;
  - the spec as a truth table;
  - fixed input and output pins (inputs on the left, outputs on the right);
  - a toolbox holding only parts you've unlocked;
  - hidden edge-case tests for bigger chips.
- **Building:** drag parts in and click pin to pin to wire. The simulation is always live: click inputs to flip them. Wires are colored *and* labeled 0/1/Z/X, so color is never the only cue.
- **Live truth table:** each row ticks ✓/✗ as you wire, and clicking a row sets those inputs. The **Check** button runs the full tests.
- **Passing a level** turns the component into a black box in the toolbox.
- **Look inside:** double-click a box to open it and see your own design running live. A breadcrumb (`Computer › CPU › ALU`) takes you back up.
- **Wide signals:** bus wires (16 bits in one thick wire), splitters/joiners, and a **Repeat ×N** block (build one bit slice, stamp out N copies).
- **Keyboard and screen readers:** every action works from the keyboard (place parts with arrow keys, connect from a pin menu), and there's a readable list view of the circuit.
- **Errors appear on the canvas:**
  - an unconnected pin pulses;
  - a wire with two drivers turns red;
  - a short circuit flashes its VDD-to-GND path;
  - a floating output shows Z with an explanation;
  - a width mismatch is shown on the wire.
- **Failure messages** tie the row to the cause and a hint. Clicking one sets those inputs and highlights the problem.
- **Editing an old component** re-checks everything built on it, and the level map flags anything that broke.
- **Extras:** a free-play sandbox, optional side-quest levels, and a part/transistor count shown on each solution.

## 4. Strict layering, enforced in code
- Every component has a fixed signature, a layer number and a dependency list, all in its level definition.
- The toolbox only shows parts you've unlocked. The Rust core *also* rejects any design that uses a higher-layer part, a locked part or a loop of chips depending on each other, even in an imported file.
- **Base parts per layer:** Layer 1 gets only NMOS, PMOS, VDD and GND. Layer 2 gets only the gates you built in Layer 1, and so on up.
- Our own toolchain code follows the same rule through Cargo crate dependencies (compiler → VM → assembler → ISA).

## 5. Abstraction swap
- Each unlocked component has a toggle: **Your design ⇄ Fast model**.
- A swap is allowed only after a **match check**: your design and the fast model must agree on the tests plus every input combination (for ≤16 input bits) or 10,000 random inputs/cycles. The result is shown.
- When a component is swapped, flattening stops at its box: thousands of gates become one native element.
- The level map shows each component's mode, with presets "As you built it" and "Playable speed", plus a meter for elements simulated and cycles per second.

## 6. Repo structure
```
sand-to-tetris/
  CLAUDE.md
  docs/        chapters (Markdown), glossary.yaml, sources.yaml, PLAN.md
  web/         Vite app: editor, level map, demos (custom elements), content pipeline
  sim/         Cargo workspace: netlist, switch, gate, models, checker, wasm, cli
  hdl/         level definitions, stubs, reference solutions (kept out of the web bundle)
  tests/       test tables per component and per layer, CPU test programs
  toolchain/   assembler, VM translator, compiler (M8+)
  .github/workflows/
```

## 7. Chapter 0
- **Sections:** what a computer is; pre-electronic timeline; analog vs digital; Boole, Turing, Shannon and von Neumann; switch generations; the 1947 transistor and why germanium lost; the silicon takeover through the Intel 4004; sand to wafer; doping; the p-n junction; MOSFET structure; bits as voltage and noise margin.
- **Demos:** switch timeline with size/scale comparison; p-n junction and MOSFET cross-section with a gate-voltage slider and current curve; sand-to-wafer flow diagram; noise-margin chain (analog drift vs digital restoration, with the inverter transfer curve); glossary with hover cards linked from the text.
- **Facts:** every date is checked with web sources and cited in `sources.yaml`. Contested items are shown as contested:
  - whether the Ishango/Lebombo bones record counting;
  - the Antikythera mechanism's date range;
  - Leibniz's stepped reckoner dates;
  - who invented the slide rule;
  - Lovelace as "first programmer";
  - von Neumann credit vs Eckert and Mauchly;
  - TI vs Bell Labs for the first silicon transistor in 1954;
  - Kilby's 1958 IC being germanium.
- **Every chapter ends** with a "What you built / What you learned" summary.

## 8. Milestones

| # | Milestone | Done when |
|---|---|---|
| **M0** ✓ | Scaffold: Cargo workspace, Vite app, CI, CLAUDE.md, one `test` command | CI runs and the empty site deploys |
| **M1** ✓ | Chapter 0: content pipeline, prose, 5 demos (p-n junction and MOSFET are separate), glossary, sources | Chapter 0 is readable and interactive online |
| **M2** ✓ | Switch-level core: netlist format, engine, checker, CLI, Layer 1 levels with reference solutions (NOT, NAND, NOR, optional AND) | `cargo test` passes NOT, NAND and NOR checks |
| **M3** ✓ | Layer 1 in the browser: WASM bridge, editor, toolbox, level map, live truth table, look-inside, keyboard mode, Chapter 1 | You can build a CMOS NAND by dragging, pass Check and unlock it |
| M4 ✓ | Layer 2: gate-level engine, buses, splitters, Repeat ×N, fast-model swap; mux, decoder, adders, 16-bit ALU | |
| M5 | Layer 3: latches → flip-flops → registers → RAM → PC, plus a waveform view | |

### M5 decisions (2026-11-01)
- **Everything is built from gates; no memory primitive.** SR latch (two cross-coupled NORs) → D latch → master–slave D flip-flop (two D latches, opposite enables) → Bit (flip-flop + MUX: keep or load) → Register (Bit ×16) → RAM8 → RAM64 → RAM512 → RAM4K → PC.
- **Sequential levels** (`sequential = true`): the table's rows are steps run in order on one circuit, so state carries over; `-` means "any value" (e.g. before anything is stored). Rising-edge steps change only `clk`, so d is steady at the edge (setup time).
- **Power-on is unknown (X)**, as in real hardware; tests store before they read.
- **RAM stops at 4K words for now**; the full memory size comes with the memory map, designed together in M6.
- **Live memory in the editor:** `simulate` takes the previous state and returns the new one, keyed by gate path (not net number), so stored bits survive unrelated edits. Clicking a test step replays the test up to it; "Tick clk" pulses the clock; "Reset memory" returns to power-on.
- **Big memories run as fast models.** Fully flattened, RAM64 is ~32,000 gates and RAM4K ~2 million. The editor says so when a circuit passes 5,000 gates and names the parts that could swap; `check-all` and the background status re-check run lower memory components as their models (each already matched that model).
- Order of work: core (sequential checking) ✓ → latch…register levels ✓ → stateful editor ✓ → RAM, PC, Layer 2 helpers, stateful fast models and sequential match check ✓ → waveform view ✓ (Test steps: click a column to replay; Live: the learner's own clicks and ticks) → Chapter 3.
| M6 | **ISA designed together with the user** → written spec in `docs/ISA.md` (word size and ALU already agreed) | |
| M7 | CPU, Computer, CPU test programs, fast CPU model | |
| M8 | Assembler | |
| M9 | VM + translator | |
| M10 | High-level language (designed together) + compiler | |
| M11 | Mini OS: screen, keyboard, timer, random numbers | |
| M12 | Tetris on the learner's own computer | |
| M13 | (optional) Chip layout editor → extracted transistor netlist | |

The first vertical slice is M0–M3.

## 9. Defaults (change by telling Claude)
1. **Chapter 0 prose:** written by Claude from the outline.
2. **Toolchain exercises:** the learner writes the assembler, VM translator and compiler in TypeScript in the browser, with tests and scaffolding.
3. **Spoilers:** reference solutions stay in the repo but out of the website bundle.
4. **Clock:** a visible `clk` wire the learner routes.
5. **Device support:** desktop-first editor. Chapters and demos also work on mobile.
6. **Math depth:** qualitative first, with optional "go deeper" boxes for equations.
7. **Hosting, license, language:** GitHub Pages, MIT for code, CC BY-SA for text, English only (structured so translations can be added later).
