# Sand to Tetris

Build a computer from the ground up, in your browser: from the physics of
silicon, through transistors, gates, memory and a CPU, up to a compiler, a
tiny operating system and a game of Tetris running on the machine you built.

Each chapter explains a concept, lets you play with it, then has you build
components in a drag-and-drop editor. Every component you finish becomes a
building block for the next level.

Status: early development. See [`docs/PLAN.md`](docs/PLAN.md) for the plan.

## Develop

Needs Node 22+ and Rust via rustup (the version is pinned in
`rust-toolchain.toml` and installs automatically).

```bash
npm install
npm run setup      # once: WASM target + wasm-bindgen CLI
npm run dev        # local site at http://localhost:5173
npm test           # all tests
```

## License

Code: MIT ([LICENSE](LICENSE)). Written content in `docs/`: CC BY-SA 4.0
([docs/LICENSE.md](docs/LICENSE.md)).
