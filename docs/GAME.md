# Bitfall

The capstone of Sand to Tetris is **Bitfall**, an original falling-block
game in C Shard (`games/bitfall.shard`), running on the OS (`docs/OS.md`)
on the computer built in the course. Agreed with the user on 2026-11-01:

- a falling-block game, original rather than a recreation of an existing
  game (the user asked for classic Tetris; I can't build a recreation of a
  specific game, so the pieces and the name are our own);
- **full rows clear, and a row matching the target pattern scores a
  bonus**;
- **a 10 × 20 board of 4-pixel cells**;
- pieces **grown at random** and the name **Bitfall** (my picks, the user
  had no preference).

## Rules

- The board is 10 columns × 20 rows. Each row is stored as a **10-bit
  number**, the leftmost cell in bit 9.
- Each piece is **grown at random**: it starts as one cell and gains
  neighbours one at a time (up and down, left and right) until it has 3 to
  5 cells, all inside a 5 × 5 square. Every game sees different shapes.
- A piece appears at the top, centred. It falls one row every few frames;
  the delay is `max(6, 33 − 3 · level)` frames (a frame is 1/60 s).
- Left and right arrows move it, up or **C** rotates it clockwise (trying a shift of
  one or two cells if it doesn't fit), down moves it down one row, and space
  drops it to the bottom at once.
- When it can't fall further it **locks** into the board. Then every row
  that is **full** (1023, all ten bits) clears, and every row that equals
  the **target** clears too, scoring a bonus, after which a new target is
  drawn. Rows above a cleared row move down.
- The **target** is a random number from 1 to 1022, shown in binary at
  the side: build a row with exactly that pattern of filled cells.
- Score: 10 × level for a full row, 50 × level for a target row. Every 10
  cleared rows the level goes up by one.
- The game is over when a new piece doesn't fit at the top.

## Screen

The board sits in the middle (pixels 44–83 across, 8–87 down), cells
drawn 3 × 3 with a 1-pixel gap, inside a frame. The left side shows SCORE,
LINES and LEVEL; the right side shows the NEXT piece and the TARGET in
binary (10 text columns, exactly one per cell).

## How it's built

- The board and pieces are bits: a piece is up to five 5-bit row masks
  (leftmost cell in bit 4). A piece row placed at column x is
  `(mask << 5) >> x` in board bits, so **collision is one AND per row** and
  locking is one OR.
- Rotation maps cell (row y, column x) to (row x, column h − 1 − y), h being
  the piece's height, then moves the piece back to the top-left of its
  5 × 5 square.
- Keys are acted on when they change (one press, one move); down repeats
  while held. Falling is timed with `ticks()`, so the game runs at the same
  speed whatever the Machine's speed setting.
- The code above the line `// ---- main ----` is the game; `main` only
  starts it. The tests replace `main` to drive the game's functions
  directly.
