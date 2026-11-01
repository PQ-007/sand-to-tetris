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
- **Keyboard and screen readers:** every action works from the keyboard on the canvas itself: parts and ports are focusable and move with the arrow keys, the actions menu (menu key or Shift+F10) connects, disconnects, duplicates and deletes, and each part's label lists its wires. (An earlier separate keyboard panel was folded into this.)
- **The level map is a tech tree:** each level sits below the levels it needs, one band per layer; selecting a level shows what it needs and unlocks. A list view stays available.
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
- The level map shows each component's mode (Runs as: your design / fast model). Checks always run passed memory components (registers, RAM, CPU, memory map) as their models, since each was compared with its model when it passed; the live editor runs what the learner chose. Not built yet: presets ("As you built it", "Playable speed") and a cycles-per-second meter.

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
| M5 ✓ | Layer 3: latches → flip-flops → registers → RAM → PC, plus a waveform view | Every memory level passes from its reference; RAM runs fast via clocked models; Chapter 3 is live |

### M5 decisions (2026-11-01)
- **Everything is built from gates; no memory primitive.** SR latch (two cross-coupled NORs) → D latch → master–slave D flip-flop (two D latches, opposite enables) → Bit (flip-flop + MUX: keep or load) → Register (Bit ×16) → RAM8 → RAM64 → RAM512 → RAM4K → PC.
- **Sequential levels** (`sequential = true`): the table's rows are steps run in order on one circuit, so state carries over; `-` means "any value" (e.g. before anything is stored). Rising-edge steps change only `clk`, so d is steady at the edge (setup time).
- **Power-on is unknown (X)**, as in real hardware; tests store before they read.
- **RAM stops at 4K words for now**; the full memory size comes with the memory map, designed together in M6.
- **Live memory in the editor:** `simulate` takes the previous state and returns the new one, keyed by gate path (not net number), so stored bits survive unrelated edits. Clicking a test step replays the test up to it; "Tick clk" pulses the clock; "Reset memory" returns to power-on.
- **Big memories run as fast models.** Fully flattened, RAM64 is ~32,000 gates and RAM4K ~2 million. The editor says so when a circuit passes 5,000 gates and names the parts that could swap; `check-all` and the background status re-check run lower memory components as their models (each already matched that model).
- Order of work: core (sequential checking) ✓ → latch…register levels ✓ → stateful editor ✓ → RAM, PC, Layer 2 helpers, stateful fast models and sequential match check ✓ → waveform view ✓ (Test steps: click a column to replay; Live: the learner's own clicks and ticks) → Chapter 3 ✓.
| M6 ✓ | **ISA designed together with the user** → written spec in `docs/ISA.md` (word size and ALU already agreed) | The spec is agreed and `s2t-isa` runs it, with a test per rule |

### M6 decisions (2026-11-01)
Agreed with the user in three rounds; the reasons are in `docs/ISA.md`.
- 8 general-purpose registers r0–r7 (all real; CMP has its own opcode); r7 holds CALL's return address.
- Separate program ROM (Harvard); every instruction is one 16-bit word and takes one clock, so the CPU needs no control state machine.
- 16-bit constants in two halves (SET low byte, SETH high byte).
- Conditional jumps test saved flags Z N C (8 conditions); jumps and calls are PC-relative; JR / CALLR / RET jump through a register.
- A barrel shifter (SHL / SHR / SAR by 0–15), to be built from 4 stages of MUX16.
- Memory-mapped I/O: RAM16K at 0x0000, a 128 × 96 black-and-white screen (768 words) at 0x4000 with the leftmost pixel in bit 15, keyboard at 0x6000; timer and random numbers reserved at 0x6001+ for M11.
- New levels this implies for M7: RAM16K, the barrel shifter, the register file (8 Registers, DMUX8WAY, two MUX8WAY16), then the CPU and the Computer.
| M7 ✓ | CPU, Computer, CPU test programs, fast CPU model | Every new level passes from its reference; CPU and Computer run program traces; Chapter 4 is live |

### M7 decisions (2026-11-01)
- **Levels:** shifter (Layer 2); ram16k, regfile (Layer 3); new Layer 4: decode (the control unit), cpu, memory (the memory map), computer. The cpu and decode levels prescribe the datapath pin for pin (addrM = the ALU's output, outM = register port B, rsel codes, ...), so a fast model can match any correct design exactly.
- **The program ROM is outside the computer:** tests (and later the site) feed `instr` from ROM[pc], like a ROM chip. No ROM primitive, so Layer 1's base parts stay transistors only.
- **Reset only zeroes the PC;** the instruction on `instr` still runs during the reset cycle.
- **CPU and Computer tests are program traces** printed by the models (two steps per instruction, assembly on a `#` line), so they can't drift from the spec.
- **Check runs passed memory components as models,** like the status re-check (a learner-built RAM16K is ~8 million gates); the live editor still runs the learner's choice. Flattening stops past 100,000 gates with a translated "too big" problem that points at the fast-model switch.
- **Chapter 4** with a `<cpu-demo>` that runs `s2t-isa` through WASM (`isaTrace`), and cited history (Harvard Mark I and the contested "Harvard architecture" name, IBM 801 and Berkeley RISC, ARM's link register, AVR's separate buses).
| M8 ✓ | Assembler | The reference assembler passes its spec tests; the learner's TypeScript assembler is graded stage by stage; programs run on the Machine page; Chapter 5 is live |

### M8 decisions (2026-11-01)
Agreed with the user: constants and a few pseudo-instructions; a .data section copied into RAM by a loader; the learner's assembler in TypeScript, in four tested stages; a Machine page now.
- The language is `docs/ASSEMBLY.md`. SET16 is one word only when its value is known in pass 1 and fits a byte; NOP is `JMP 1` (the only instruction that changes nothing); a jump's number operand is the offset (so disassembly reassembles).
- The reference (`toolchain/asm`) and the learner's assembler share the same four stages and JSON shapes, so the reference grades each stage on its own, fed correct input from the stage before.
- The learner's code runs in a worker (5 s limit) after sucrase strips its types; a full solution in the tests proves the workshop solvable.
- The Machine page runs programs on the reference CPU (`s2t-isa` in WASM): fast enough for games. Keyboard codes are provisional (ASCII, Enter 13, Backspace 8, Escape 27, arrows 128–131; Tab is never captured); revisit with the OS in M11.
| M9 ✓ | VM + translator | The reference translator matches the interpreter on edge cases and random programs; the learner's TypeScript translator is graded by running programs; VM programs run on the Machine page; Chapter 6 is live |

### M9 decisions (2026-11-01)
Agreed with the user: a stack machine; numbered locals, args and globals plus load/store; true = −1; mul/div/mod as VM commands backed by runtime routines. The rest (my choices, in `docs/VM.md`):
- Commands: push/set (with `push n` for constants), pop, dup, load, store, add sub and or xor neg not shl shr sar, mul div mod (signed, rounding toward 0; ÷0 gives −1 and a), eq ne lt gt le ge (signed, exact even when a − b overflows), label/jump/jumpif/jumpifnot, func f n k, call f n, return. Every function returns one value; main takes no arguments; a function must end with return or jump.
- Calling convention: SP r6 (the stack grows down from 0x4000), FP r5, r7 the return address, r0–r4 scratch; the callee saves r7 and FP and cleans up its arguments; global i = RAM[i] (a `.data` of zeros). Calls go through SET16 + CALLR so functions can sit anywhere; jumps inside a function reach ±511 words (`function-too-long` otherwise).
- Names: function f → label `f`, label L in f → `f__L`; VM names may not contain `__`, which the translator keeps for itself.
- The reference is `toolchain/vm` (`s2t-vm`): parse, checks, translate, bootstrap/runtime, build (assembling with `s2t-asm`), and an interpreter with the same memory layout, which the tests compare every translation with.
- The learner's translator has three parts (parse, translate per command, bootstrap + runtime); the whole-program checks and the loop are shared code (`web/src/translator.ts`, kept identical to `s2t-vm` by a test). Tests run small programs on the CPU and compare result, SP, globals and screen with the interpreter; each stage's tests use the learner's code only for that stage's commands, so the stages are independent.
- Machine page: a language choice (Assembly / VM); VM code shows its errors on VM lines, the assembly it became, and the stack.
| M10 ✓ | High-level language (designed together) + compiler | The reference compiler passes its spec tests; the learner's TypeScript compiler is graded stage by stage; C Shard runs on the Machine page; Chapter 7 is live |

### M10 decisions (2026-11-01)
Agreed with the user in two rounds: braces (C-family) syntax; int, bool and arrays, type-checked; fixed-size arrays known when compiling; `mem[addr]` built in so the OS can be written in the language; `and`/`or`/`not` for bool (short-circuit) and `& | ^ ~` for bits with ordinary precedence; if/else, while, `for i in a..b`, break, continue; `'A'` chars and `"text"` as constant arrays. The user named it **C Shard** (my pick: the `.shard` extension). The rest (in `docs/LANGUAGE.md`):
- `>>` shifts zeros in (0x8000 is negative as an int; an arithmetic shift would smear the pixel mask); bit operators bind tighter than comparisons; comparisons don't chain.
- Arrays live only in globals and constants; functions take `[T]` (a reference: the array's address); locals must be initialised; a name can't be reused inside a function or shadow a global.
- Globals are VM globals from 0 in declaration order; starting values are stored by a generated `_init` that `main` calls first; constant scalars are inlined.
- The reference is `toolchain/lang` (`s2t-lang`: tokenize, parse, check → `Info`, generate, plus a source map). Its tests include 600 random expressions run as code vs folded as constants.
- The workshop compares tokenize/parse/check JSON exactly (each fed the reference's previous stage) and grades generate by running the VM code.
| M11 ✓ | Mini OS: screen, keyboard, timer, random numbers | The OS passes its tests on the VM; the learner's OS (in C Shard) is graded against it; C Shard programs get it automatically on the Machine page; Chapter 8 is live |

### M11 decisions (2026-11-01)
Agreed with the user: a frame-counter timer at 0x6001 (60 a second, fed from outside like the keyboard); random numbers in software (16-bit xorshift in the OS); M8's keyboard codes kept; the OS put in front of every C Shard program (no `use os;`). The rest (`docs/OS.md`):
- Hardware: the `memory` and `computer` levels gain a `timer` input (key or timer picked by address bit 0; learners who built them before rewire one input), s2t-isa's `Memory.timer`, the models, the Machine page feeds it from running time (paused time doesn't count).
- The OS is `os/os.shard`: clear, plot, fill_rect (a word at a time), draw_rect, a 3 × 5 font drawn for the project in 4 × 6 cells (32 × 16 text), draw_char/draw_text/draw_int, key, wait_key (the first press seeds the generator from the timer), ticks, wait, seed_random/random/random_below (shifts 7, 9, 8; full period checked), abs/min/max. It takes those names and anything starting with `OS_`/`os_`.
- C Shard clarification: a string literal may appear inside a function (a hidden constant array), as the approved option's `draw_text("HELLO", ...)` showed.
- The OS workshop is C Shard, graded on the VM interpreter with a scripted timer and keyboard (`s2t_vm::run_scripted`, WASM `vmRunScripted`) against the built-in OS; text uses the learner's own screen functions, so its stages build in order.
| M12 ✓ | The game on the learner's own computer | Bitfall passes its tests on the VM and plays on the Machine page; Chapter 9 closes the course |

### M12 decisions (2026-11-01)
The user asked for classic Tetris. I can't build a recreation of a specific existing game, so we kept the user's choices (full rows clear plus a binary-target bonus; a 10 × 20 board of 4-pixel cells) and made the pieces and name our own (the user had no preference): pieces grown at random from 3 to 5 cells, and the name Bitfall. Rules and layout: `docs/GAME.md`. The site title "Sand to Tetris" is unchanged; renaming it is the user's call.
- The board is 20 ten-bit rows and a piece five 5-bit rows: collision is AND, locking OR, clearing a comparison; rotation maps (y, x) to (x, h − 1 − y) with wall kicks of up to two cells.
- Making the OS a prelude exposed a clash: the OS's locals (e.g. `px` in fill_rect) blocked programs' globals of the same name. C Shard now lets a local or parameter hide a global, constant or function (`docs/LANGUAGE.md`); declaring a name twice in one function is still an error.
| M13 | (optional) Chip layout editor → extracted transistor netlist | |

The first vertical slice is M0–M3.

## 9. Defaults (change by telling Claude)
1. **Chapter 0 prose:** written by Claude from the outline.
2. **Toolchain exercises:** the learner writes the assembler, VM translator and compiler in TypeScript in the browser, with tests and scaffolding.
3. **Spoilers:** reference solutions stay in the repo but out of the website bundle.
4. **Clock:** a visible `clk` wire the learner routes.
5. **Device support:** desktop-first editor. Chapters and demos also work on mobile.
6. **Math depth:** qualitative first, with optional "go deeper" boxes for equations.
7. **Hosting, license, language:** GitHub Pages, MIT for code, CC BY-SA for text. **English and Mongolian** (added 2026-11, the user's request): everything learners see is translated (interface, chapters, glossary, source notes, demos, level names/goals/hints, checker messages), using a Mongolian term only where one is already established and the English term otherwise, not coined words (the user's rule, `docs/mn/TERMS.md`). English is the original; a new chapter, level or message must get its Mongolian text in the same change (the build and tests fail otherwise). Source titles and quotes stay in their original language.
