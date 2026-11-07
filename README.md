# Sand to Tetris

*There is no magic, just abstraction layers built on top of one another.*

Build a computer from the ground up, in your browser: from the physics of
silicon, through transistors, gates, memory and a CPU, up to an assembler, a
virtual machine, a compiler, a small operating system and games running on the
machine you built.

Each chapter explains an idea in plain language, lets you play with it in
small interactive demos, then has you build it. Every component you finish
becomes a building block for the next one, so the computer grows out of your
own parts.

## What's inside

- **9 chapters** (0–8), from sand to an operating system, with a glossary and
  cited sources.
- **43 levels in 4 layers.** You wire NMOS and PMOS transistors into NOT, NAND
  and NOR gates, then build adders, an ALU, latches, registers, RAM, a CPU and
  the whole computer, in a drag-and-drop editor with live 0/1/Z/X values. A
  roadmap and a tech tree show what each part is built from and used in.
- **Your own toolchain**, written in TypeScript in the browser and graded
  stage by stage: an assembler, a VM translator, a compiler for C Shard (a
  small language designed for the course) and the OS.
- **The Machine**: write assembly, VM code, C Shard or C, and run it on the
  CPU you designed, with a large screen, the keyboard, registers, the stack
  and RAM in view.
- **Programs**: Bitfall, the course's falling-block game in C Shard, and seven
  games in C compiled straight to assembly: Wyrm, Rally, Shatter, Swarm,
  Debris, Prowl and Corridors (a first-person maze). Each has a page on how
  it works. They are original games in classic genres, not copies.
- **Three languages**: English and Mongolian throughout; Japanese for the
  interface, demos, tools and levels, with the chapters still to come.

## How it works

The simulator, checker and toolchain are Rust (`sim/crates/`, `toolchain/`),
compiled natively for the tests and the command line, and to WebAssembly for
the site, so the browser and CI always agree. The site is TypeScript and Vite,
with no framework (`web/`). Levels are TOML files with truth tables and
reference solutions (`hdl/levels/`); the references are tested but never
shipped to the site. Layering is enforced in code: a component may only use
parts from its own or lower layers that you have already built.

The specifications live in `docs/`: the plan ([PLAN.md](docs/PLAN.md)), the
instruction set ([ISA.md](docs/ISA.md)), assembly
([ASSEMBLY.md](docs/ASSEMBLY.md)), the VM ([VM.md](docs/VM.md)), C Shard
([LANGUAGE.md](docs/LANGUAGE.md)), the OS ([OS.md](docs/OS.md)), Bitfall
([GAME.md](docs/GAME.md)) and C on the machine ([C.md](docs/C.md)). Chapters
are in `docs/chapters/`, program pages in `docs/programs/`, translations in
`docs/mn/` and `docs/ja/`.

## Develop

Needs Node 22+ and Rust via rustup (the version is pinned in
`rust-toolchain.toml` and installs automatically).

```bash
npm install
npm run setup      # once: WASM target + wasm-bindgen CLI
npm run dev        # local site at http://localhost:5173
npm test           # Rust tests, the WASM build, then the web tests
npm run lint       # rustfmt, clippy, eslint, prettier, tsc
npm run build      # static site in web/dist (BASE_PATH=/repo-name/ for GitHub Pages)
```

The command-line tool `s2t` checks designs and runs the toolchain:

```bash
cargo run -p s2t-cli -- check-all hdl/levels               # every level's reference
cargo run -p s2t-cli -- check hdl/levels/layer1/nand my.json  # check your own design
cargo run -p s2t-cli -- asm program.s                      # assemble
cargo run -p s2t-cli -- compile program.shard              # C Shard to VM code
cargo run -p s2t-cli -- cc games/wyrm.c                    # C to assembly
cargo run --release -p s2t-c --example play -- games/wyrm.c 300 5:65 8:0 40:129
                                                           # play frames, print the screen
```

CI runs the tests, lint and build on every push, and deploys the site to
GitHub Pages from `main`.

## License

Code: MIT ([LICENSE](LICENSE)). Written content in `docs/`: CC BY-SA 4.0
([docs/LICENSE.md](docs/LICENSE.md)).

Line figures: [Hairline](https://hairline.lucasmarkes.com) by Lucas Marques
(`@lucasmarkes/hairline`, MIT), and figures drawn for this course with its
`hairline-create` skill (`web/src/vendor/hairline/`).
