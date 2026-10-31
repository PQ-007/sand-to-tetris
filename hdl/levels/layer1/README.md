# Layer 1 levels: transistors to gates

Each folder is one level:

- `level.toml`: the goal, the component's ports, its truth table and hints.
- `reference.json`: a known-good design. It is used by `cargo test`, by
  `s2t check`, and as the "fast model" check later. **Reference solutions
  must never be bundled into the website.**

Check a level's reference (or your own design):

    cargo run -p s2t-cli -- check hdl/levels/layer1/nand
    cargo run -p s2t-cli -- check hdl/levels/layer1/nand my-nand.json
