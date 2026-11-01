---
number: 9
title: Bitfall
summary: "The last layer: an original falling-block game in C Shard, on your OS, on the computer you built from transistors."
---

Everything is in place: a CPU made of gates made of transistors, an assembler, a virtual machine, a language and an operating system. The last layer is a game. **Bitfall** is a falling-block puzzle we designed for this course: pieces drop into a well, and rows you complete disappear. It's written in C Shard, about 360 lines, in `games/bitfall.shard`, and it runs on the Machine page like any other program.

## The game we designed

You wanted classic Tetris. That's a specific game with its own pieces and name, so instead we kept your rules and made the pieces and the name our own:

| Question | We chose | Why |
|---|---|---|
| Clearing | full rows clear, and a row matching the **target** pattern clears for a bonus | the target makes every row a binary number worth reading |
| Board | 10 × 20 cells of 4 pixels | room at the sides for the score, the next piece and the target |
| Pieces | **grown at random**: 3 to 5 connected cells, different every time | no fixed set, so every game is new |
| Name | Bitfall | bits falling into rows of bits |

Arrows move and turn the piece, down nudges it, and space drops it at once. The full rules are in `docs/GAME.md`.

## The board is numbers

Each row of the board is stored as a 10-bit number, with the leftmost cell in bit 9. That one decision makes most of the game a few lines of bit arithmetic. A full row is 1023, ten 1 bits. The target is just a number from 1 to 1022, shown in binary at the side, and a row clears for a bonus when it's equal to it.

<bitrow-demo></bitrow-demo>

A piece is stored the same way, as up to five rows of 5 bits. Shifting a piece row into place at column x is `(row << 5) >> x`, and then:

- the piece **collides** with the board if any of its rows AND the board row underneath isn't 0. This is **[[collision detection|collision-detection]]** in one instruction per row;
- **locking** the piece is an OR of each of its rows into the board;
- **clearing** a row copies every row above it one place down.

## Pieces grown at random

A new piece starts as one cell in the middle of a 5 × 5 square. Then the game picks a random cell of the piece and a random direction, and adds the neighbour there if it's free, until the piece has its 3, 4 or 5 cells. The OS's random numbers decide everything, and the first key press seeded them from the timer, so no two games see the same pieces. Finally the piece is moved to the top-left of its square.

Turning a piece a quarter clockwise moves the cell at (row y, column x) to (row x, column h − 1 − y), where h is the piece's height. If the turned piece doesn't fit, the game also tries it one or two cells to either side before giving up, so a piece can turn next to a wall.

## The game loop

The game is one loop that runs until a piece can't appear at the top. This is the **[[game loop|game-loop]]**:

1. Read the key. If it changed since last time, act on it: move, turn, drop. Acting only on a change means one press moves the piece once, however long the key is held; holding down repeats on purpose.
2. Read the timer. If the piece is due to fall, move it down a row, or lock it if it can't move.
3. Draw only what changed: the piece's old cells off, its new cells on. After a lock, redraw the board and the side panel.

Falling is timed with `ticks()`, the frame counter you added to the memory map, so the game speeds up with the level and never with the simulation.

## All the way down

Press the right arrow while Bitfall runs, and follow it through everything you built:

| Layer | What happens |
|---|---|
| Keyboard | the Machine page puts 130 at address 0x6000 |
| C Shard | `key()` returns 130, and `try_move(1, 0)` checks the board with AND |
| OS | `fill_rect` turns the old cells off and the new cells on, a word at a time |
| VM | `push`, `load`, `and`, `jumpifnot`, `call`: the stack machine you translated |
| Assembly | `LOAD`, `AND`, `JZ`: what your assembler encoded into words |
| CPU | the control unit decodes each word; the ALU does the AND; the PC jumps |
| Memory | RAM holds the board's 20 rows; the screen's words light the pixels |
| Gates | every operation is NAND, NOR and NOT gates, and adders and multiplexers built from them |
| Transistors | every gate is NMOS and PMOS transistors switching on and off |
| Silicon | every transistor is doped silicon, a channel opened by a voltage on its gate |

The Machine page runs the CPU's fast model, the same behaviour your `cpu` and `computer` levels are checked against, so millions of instructions a second are no problem. In the editor, a fast model only replaces a design of yours after a match check proves the two agree.

**[Play Bitfall on the Machine →](#/machine)**

## Where falling blocks come from

The best-known falling-block puzzle is Tetris, which Alexey Pajitnov wrote in the mid-1980s at the Dorodnitsyn Computing Center of the Soviet Academy of Sciences, on an Elektronika 60, a Soviet copy of the PDP-11; it helped create the market for puzzle video games[@tetris-origin]. Bitfall belongs to the same genre, with pieces, rules and a name of its own.

<aside class="summary">

## What you built, and what you learned

**What you built:** Bitfall, a game in your own language, on your own OS, compiled by your own toolchain, on a computer you built from transistors: from sand to a game.

**What you learned:**

- Choosing how data is stored (rows as numbers) can turn a game's rules into a few bit operations: AND for collision, OR for locking, a comparison for clearing.
- Random shapes can be grown one neighbour at a time; rotation is a small coordinate formula.
- A game is a loop: read input, update the state on a timer, draw what changed.
- Every layer of a computer is a small idea built on the one below it, and you built every one.

**Next:** play, change the rules, or write a game of your own in C Shard. Every part of the machine underneath is yours.

</aside>
