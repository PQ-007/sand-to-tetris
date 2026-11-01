# The OS

The operating system of Sand to Tetris is a library of C Shard functions
(`os/os.shard`) for the screen, text, the keyboard, time and random numbers.
There are no processes or files: one program runs, and the OS is the code
it calls. Agreed with the user on 2026-11-01:

- **a frame counter at 0x6001** (vs a cycle counter, or none): 60 counts a
  second, fed in from outside like the keyboard, so a game runs at the same
  speed whatever the simulation's speed (`docs/ISA.md`);
- **random numbers in software** (vs a hardware device): a 16-bit xorshift
  generator, seeded from the timer on the first key press;
- **the keyboard codes from M8 stay** (`docs/ISA.md` "Keyboard codes");
- **the OS is put in front of every C Shard program** (vs an explicit
  `use os;`): the language doesn't change, and the OS's names are taken.

The rest is my design: what follows.

## Names the OS takes

The functions below, and every name starting with `OS_` or `os_`
(`OS_SCREEN`, `OS_KEYBOARD`, `OS_TIMER`, `OS_FONT`, `os_seed`, `os_seeded`,
`os_digits`). A program that declares one of them gets `duplicate-name`.

## Functions

| Function | Does |
|---|---|
| `clear()` | every pixel off |
| `plot(x: int, y: int, on: bool)` | one pixel; outside the 128 × 96 screen nothing happens |
| `fill_rect(x: int, y: int, w: int, h: int, on: bool)` | a filled w × h rectangle from (x, y), clipped to the screen |
| `draw_rect(x: int, y: int, w: int, h: int)` | the outline of a rectangle (on) |
| `draw_char(c: int, col: int, row: int)` | a character in text cell (col, row) |
| `draw_text(s: [int], n: int, col: int, row: int)` | n characters of s from cell (col, row) rightwards |
| `draw_int(v: int, col: int, row: int) -> int` | v in decimal (with `-` if negative); returns the cells it took |
| `key() -> int` | the code of the key held now, 0 if none |
| `wait_key() -> int` | waits for a key to be pressed and let go; returns its code |
| `ticks() -> int` | frames since the program started (60 a second) |
| `wait(frames: int)` | waits that many frames |
| `seed_random(s: int)` | starts the random sequence from s (0 counts as 1) |
| `random() -> int` | the next random number, 0..32767 |
| `random_below(n: int) -> int` | a random number from 0 to n − 1 (0 if n ≤ 0) |
| `abs(x)`, `min(a, b)`, `max(a, b)` | on ints |

## Text

Text uses a 3 × 5 pixel font in cells of 4 × 6 pixels (a pixel of space to
the right and below), so the screen holds 32 columns × 16 rows. Cell
(col, row) starts at pixel (4·col, 6·row). `draw_char` clears its cell
first. The font has the characters from space (32) to `_` (95): digits,
capital letters and punctuation; lowercase letters are drawn as capitals,
and any other code as `?`.

`OS_FONT` holds one word per character: 5 rows of 3 bits, the top row in
bits 14–12, the leftmost pixel of each row in its highest bit. The glyphs
were drawn for this project.

## Random numbers

`random()` updates `os_seed` with the 16-bit xorshift steps

```
s = s ^ (s << 7);  s = s ^ (s >> 9);  s = s ^ (s << 8);
```

(`>>` shifting in zeros) and returns `s & 0x7FFF`. From any nonzero seed
these shifts visit all 65,535 nonzero 16-bit values before repeating (a
test checks it). The seed starts at 1; the first `wait_key` replaces it
with `seed ^ ticks()`, so how long a player waits before pressing a key
decides the game.

## Using it

On the Machine page every C Shard program is compiled with the OS in front
of it (the learner's own OS once it passes its tests, otherwise the
built-in one). Errors and the current line are reported on the program's
own lines.

```
fn main() {
    clear();
    draw_text("PRESS A KEY", 11, 10, 7);
    var k = wait_key();
    draw_int(random_below(100), 14, 9);
}
```
