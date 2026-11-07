# Hairline kernel and custom figures

- `kernel.js`: the engine from the `hairline-create` skill of
  [Hairline](https://github.com/lucasmarkes/hairline) (MIT, see `LICENSE`),
  unchanged except for the last line, which exports `HL` as an ES module.
- `computer.js`: the home page figure (a desktop computer that comes apart
  in layers: case, board with CPU and RAM, cover, monitor, keyboard; the
  pointer picks a part, the page's button takes it apart and puts it back),
  drawn for this course with that skill
- `wafer.js` (Chapter 0: a wafer ruled into dies that rise under the
  pointer), `transistor.js` (Chapter 1: a MOSFET cut away; nearing the gate
  gathers electrons until the channel forms), `carry.js` (Chapter 2: eight
  adders; the carry ripples to the bit pointed at, hop by hop). Each passed
  the skill's validator and look check
  (`/hairline-create`), passed by its validator and look check. It is written
  in the skill's format (it reads a global `HL` and calls a global
  `hairline({...})`); `web/src/hairline.ts` provides both and hosts it the way
  the skill's bench page does.

To change a figure, edit it in the skill's format, run the skill's
`look.mjs` on it, and copy it back here. Prettier and ESLint skip this folder,
so the files stay exactly as the skill checked them.
