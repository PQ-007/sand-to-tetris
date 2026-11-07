# C on the machine

C Shard (`docs/LANGUAGE.md`) shows that you can design a language of your
own. **C** shows what the machine can do with an ordinary language and a
compiler that works for speed. Agreed with the user on 2026-11-07: a real C
subset compiled **straight to assembly** (not through the VM), with a small
library, `machine.h`, for the screen, keyboard, timer and random numbers.
The games in the Programs section are written in it.

The reference compiler is the crate `s2t-c` (`toolchain/c`). It depends on
the assembler only (c → asm → isa); its tests run programs on the reference
CPU.

## The machine as C sees it

Everything is one 16-bit word. `char`, `short`, `int` and pointers are all
one word, and `sizeof` counts words: `sizeof(int) == sizeof(char) == 1`.
(C allows this: a "byte" here is 16 bits, as on some signal processors.)

| Type | Range |
|---|---|
| `int`, `short`, `char`, `signed …` | −32,768 .. 32,767 |
| `unsigned`, `unsigned char`, … | 0 .. 65,535 |
| pointers | a word address, 0 .. 65,535 |

There is no floating point (`float`, `double`) and no `long`: the compiler
says so. Games use **fixed-point** numbers instead: an `int` holding 256
times the value, so 1.5 is 384.

## What's in

- **Types:** `void`, `char`, `short`, `int`, `signed`, `unsigned`, pointers,
  arrays (also of arrays), `struct`, `union`, `enum`, `typedef`, function
  pointers. `const`, `volatile`, `register`, `auto`, `extern` are accepted;
  `const` and `volatile` change nothing here (the compiler never keeps a
  variable in a register between statements).
- **Declarations:** globals (zeroed unless initialised), `static` globals
  and `static` locals (both stored with the globals), locals anywhere in a
  block, declarations in `for (int i = 0; ...)`. Initialisers: constant
  expressions for globals and statics, `{...}` for arrays and structs
  (nested, with fewer elements = zeros), string literals for `char` arrays,
  `int a[] = {...}` takes its size from the list. Locals take any
  expression; local arrays and structs take `{...}` too.
- **Statements:** blocks, `if`/`else`, `while`, `do … while`, `for`,
  `switch` (with `case`, `default` and fall-through), `break`, `continue`,
  `return`, `goto` and labels, expression statements, `;`.
- **Expressions:** every C operator: `+ - * / %`, `<< >>` (`>>` on a signed
  value copies the sign bit in; on an unsigned one, zeros), `& | ^ ~`,
  comparisons, `&& || !` (short-circuit), `?:`, `=` and the compound
  assignments, `++`/`--` both ways, `,`, `&` and `*`, `[]`, `.` and `->`,
  calls (also through a function pointer), casts, `sizeof`. Pointer
  arithmetic counts elements; struct assignment copies the struct.
- **Literals:** decimal, `0x`, `0b`, octal `0…`, `'c'` with the usual
  escapes, `"strings"` (zero-terminated `char` arrays, one character per
  word).
- **Preprocessor:** `#define` (also with parameters), `#undef`, `#ifdef`,
  `#ifndef`, `#if`/`#elif` with `defined(…)`, `#else`, `#endif`, and
  `#include <machine.h>` (the only header). Comments `//` and `/* */`.

Not in: `float`/`double`, `long`, bit-fields, variadic functions (`...`),
`#` and `##` in macros, other headers. Each says so when used.

## How it runs

- **Registers:** r0–r4 hold intermediate values, **r5 is always 0** (so a
  global in the first 128 words loads in one instruction: `LOAD r0, [r5 +
  g]`), **r6 is the stack pointer**, r7 the return address (and a scratch
  register for long jumps).
- **Memory:** globals from RAM address 1 (0 is NULL; scalars first, so they're the
  ones in reach of that one-instruction load), the stack grows down from
  0x4000. A function's frame holds its saved return address, locals and
  spilled values at `[r6 + n]`; arguments sit just above it.
- **Calls:** the caller makes room below the stack pointer and stores the
  arguments there, then `CALL` (or `SET16` + `CALLR` when the function is
  more than 2,048 words away); the result comes back in r0. A jump that
  doesn't reach (±512 words) becomes `SET16 r7, target` + `JR r7`.
- **Multiplication and division** have no instruction: `*` by a constant
  becomes shifts and adds; otherwise the compiler calls small runtime
  routines (`__mul`, `__div`, …) written in assembly. Division rounds toward
  zero; dividing by zero gives 0 (and `%` gives the dividend), with no
  trap.
- **Signed comparisons** are exact: the ISA has no overflow flag, so the
  compiler flips both sign bits and compares as unsigned.
- Only functions reachable from `main` (or whose address is taken) are
  compiled, so the library costs nothing you don't call.
- When `main` returns, the program halts.

## machine.h

`#include <machine.h>` gives the library (written in C, compiled with the
program). Names mirror the C Shard OS (`docs/OS.md`).

| Function | Does |
|---|---|
| `SCREEN`, `KEYBOARD`, `TIMER` | the device addresses as pointers (`int *`) |
| `WIDTH`, `HEIGHT` | 128 and 96 |
| `KEY_LEFT` `KEY_UP` `KEY_RIGHT` `KEY_DOWN` `KEY_ENTER` `KEY_ESCAPE` `KEY_SPACE` | key codes |
| `void clear(void)` | every pixel off |
| `void plot(int x, int y, int on)` | one pixel, clipped to the screen |
| `void xor_plot(int x, int y)` | flips one pixel |
| `int pixel(int x, int y)` | is it on? (0 outside) |
| `void fill_rect(int x, int y, int w, int h, int on)` | a filled rectangle, clipped |
| `void draw_rect(int x, int y, int w, int h)` | its outline |
| `void draw_line(int x0, int y0, int x1, int y1, int on)` | a straight line (Bresenham) |
| `void draw_sprite(int x, int y, const int *rows, int h)` | up to 16 × h pixels, each row a word (bit 15 leftmost), ORed in |
| `void xor_sprite(int x, int y, const int *rows, int h)` | the same, flipping pixels |
| `void draw_char(int c, int col, int row)` | a character in text cell (col, row), 4 × 6 pixels |
| `void draw_text(const char *s, int col, int row)` | a zero-terminated string |
| `int draw_int(int v, int col, int row)` | v in decimal; returns the cells used |
| `void draw_char_at(int c, int x, int y)` · `void draw_text_at(const char *s, int x, int y)` | the same at any pixel |
| `void use_buffer(void)` · `void show(void)` | draw into a RAM copy of the screen, then show it all at once (no flicker) |
| `void draw_into(int *words)` · `void use_screen(void)` | draw into a 768-word image of your own (a background drawn once); back to the screen |
| `int key(void)` | the key held now, 0 if none |
| `int wait_key(void)` | waits for a press and release; seeds the random numbers |
| `int ticks(void)` | frames since the start (60 a second) |
| `void wait(int frames)` · `void next_frame(void)` | wait; wait for the next frame |
| `void srand(int s)` · `int rand(void)` · `int rand_below(int n)` | xorshift random numbers, 0..32767 (`seed_random`, `random`, `random_below` also work) |
| `int abs(int)`, `int min(int, int)`, `int max(int, int)`, `int clamp(int v, int lo, int hi)` | |
| `int sin256(int a)` · `int cos256(int a)` | 256 × sin/cos of angle a in 256ths of a turn |
| `int isqrt(unsigned v)` | integer square root |
| `void *memset(void *p, int v, unsigned n)` · `void *memcpy(void *d, const void *s, unsigned n)` | n words |

## Errors

Each error has a line, a code and an English message; the site translates
them by code (`c.<code>`):

`bad-char`, `bad-number`, `bad-string`, `unterminated-comment`,
`bad-directive`, `bad-include`, `unterminated-if`, `macro-args`,
`expected`, `unsupported` (float, long, …), `unknown-name`,
`unknown-type`, `unknown-member`, `duplicate`, `not-lvalue`,
`type-mismatch`, `not-callable`, `arg-count`, `not-constant`,
`bad-initializer`, `void-value`, `break-outside`, `continue-outside`,
`case-outside`, `duplicate-case`, `unknown-label`, `no-main`,
`too-big` (program or data beyond the machine's memory).
