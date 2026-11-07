# Hairline kernel and custom figures

- `kernel.js`: the engine from the `hairline-create` skill of
  [Hairline](https://github.com/lucasmarkes/hairline) (MIT, see `LICENSE`),
  unchanged except for the last line, which exports `HL` as an ES module.
- `layers.js`: the home page figure (the course as a stepped stack of
  layers, each on the one below: sand, transistors, gates, adders, memory, a
  CPU, code and a lit falling-block game on top; the pointer picks a layer
  and lifts what it holds up, the page's button spreads the stack apart and
  stacks it again), drawn for this course with that skill
- `computer.js`: inside Chapters 0 and 4 (a tower PC, built: on four feet
  with a vented top and a glass side, the board with its heatsinks, a CPU
  under a tower cooler, RAM, a graphics card, the power supply and a drive
  cage; power, reset and USB in front; the pointer picks a part and slides
  it out), drawn for this course with that skill
- `wafer.js` (Chapter 0: a wafer ruled into dies that rise under the
  pointer), `transistor.js` (Chapter 1: a MOSFET cut away; nearing the gate
  gathers electrons until the channel forms), `carry.js` (Chapter 2: eight
  adders; the carry ripples to the bit pointed at, hop by hop), `cpu.js`
  (Chapter 4: a processor with its die bare; registers, ALU, shifter,
  control unit and program counter lift off it when pointed at). Each passed
  the skill's validator and look check
  (`/hairline-create`), passed by its validator and look check. It is written
  in the skill's format (it reads a global `HL` and calls a global
  `hairline({...})`); `web/src/hairline.ts` provides both and hosts it the way
  the skill's bench page does.

To change a figure, edit it in the skill's format, run the skill's
`look.mjs` on it, and copy it back here. Prettier and ESLint skip this folder,
so the files stay exactly as the skill checked them.
