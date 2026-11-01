---
number: 8
title: The operating system
summary: "Write the OS in C Shard: pixels and rectangles a word at a time, a font made of numbers, the keyboard, a timer, and random numbers."
---

Your C Shard programs can already draw by writing to `mem[0x4000 + ...]`, but every program would have to work out pixel addresses and bit masks again. An **[[operating system|operating-system]]** is the code every program shares. Big systems also run many programs at once and keep files. Ours does neither: it's a library of C Shard functions for the screen, text, the keyboard, time and random numbers, put in front of every program. You'll write it yourself, in the language you designed.

## The choices we made

| Question | We chose | Why |
|---|---|---|
| Keeping time | a frame counter at address 0x6001, 60 counts a second | a game runs at the same speed however fast the simulation is |
| Random numbers | a generator written in the OS, in software | no new hardware, and you see how "random" numbers are really made |
| Keyboard codes | ASCII, plus Enter 13, Backspace 8, Escape 27 and the arrows 128–131 | they fit in a byte, and every example already uses them |
| Using the OS | it's put in front of every C Shard program | the language doesn't change; the OS's names are simply taken |

The timer is new hardware: the memory map now sends address 0x6001 to a `timer` input, next to the keyboard at 0x6000. If you built the memory map or the computer before, open those levels again and wire the new input. The full list of functions is `docs/OS.md`.

## Pixels are bits

The screen is 768 words, 8 to a row, and each pixel is one bit. To light pixel (x, y), `plot` finds its word at `0x4000 + 8y + x / 16` and makes a **[[bit mask|bit-mask]]** with a single 1 in the right place: `0x8000 >> (x % 16)`, because the leftmost pixel is the highest bit. OR with the mask turns the pixel on; AND with its inverse turns it off. Every other pixel in the word stays as it was.

A filled rectangle could call `plot` for every pixel, but a game redraws a lot of them. `fill_rect` works a word at a time: for each row, it covers the pixels up to the next word boundary with one mask of several 1s, so a whole word costs one read and one write instead of sixteen. In C Shard, n ones starting `bit` pixels from the left of a word are `(-1 << (16 - n)) >> bit`.

## A font made of numbers

To write text, the OS needs a picture of every letter. Ours is a **[[bitmap font|bitmap-font]]** of 3 × 5 pixels per character, drawn for this project. Fifteen pixels fit in one word, so the whole font, from space to `_`, is 64 numbers. Characters sit in cells of 4 × 6 pixels, which leaves a gap between letters and lines, so the screen holds 32 columns and 16 rows of text.

<font-demo></font-demo>

`draw_char` looks up the character's word and plots a pixel for every 1 bit. `draw_text` draws characters side by side, and `draw_int` turns a number into its digits by dividing by 10 again and again. It works with negative numbers, so that −32768, which has no positive twin in 16 bits, prints correctly.

## Keys and time

`key()` reads the keyboard word at 0x6000. `wait_key()` waits for a key to go down and then up again, so one press counts once however long it's held. `ticks()` reads the frame counter at 0x6001, and `wait(n)` loops until n more frames have passed. Because the counter comes from outside the CPU, a falling Tetris piece moves at the same speed on the slow and fast settings.

## Random numbers from a formula

A computer that does exactly what it's told can't roll a dice. What it can do is compute a sequence that looks random: **[[pseudo-random|pseudo-random]]** numbers. Ours uses a xorshift generator: the number is combined with shifted copies of itself, `s ^ (s << 7)`, then `s ^ (s >> 9)`, then `s ^ (s << 8)`. With these three shifts, the sequence passes through all 65,535 nonzero 16-bit values before it repeats; a test in the repository checks every step.

The same starting value, the **[[seed|random-seed]]**, always gives the same sequence. To make each game different, the OS reseeds from the timer the first time a key is pressed. Then how long the player waits before pressing decides the game, and nobody can wait the same number of sixtieths of a second twice on purpose.

**[Write your own OS →](#/os)** · **[Try it on the Machine →](#/machine)**

## Where it comes from

Early computers ran one job and then waited for an operator to load the next one. In 1956 Robert Patrick of General Motors Research and Owen Mock of North American Aviation wrote GM-NAA I/O for the IBM 704. It's described as the first operating system for that machine, and its main job was to start the next program automatically when the current one finished[@gm-naa-io]. Xorshift generators were described by George Marsaglia in 2003 as "simple, extremely fast" random number generators[@marsaglia-xorshift]; the three shifts our OS uses are a small 16-bit member of that family.

<aside class="summary">

## What you built, and what you learned

**What you built:** an operating system in C Shard, with pixels, rectangles, a font, text and numbers, the keyboard, a timer and random numbers; and a timer device in your computer's memory map.

**What you learned:**

- Drawing is storing bits: an address finds the word, and a mask picks the pixels in it.
- Working a word at a time is up to 16 times faster than a pixel at a time.
- A font is data: each character is a small picture stored as a number.
- Time comes from outside the CPU, so programs run at the same speed on any machine.
- Random numbers in a computer come from a formula; the seed decides the sequence.

**Next:** in Chapter 9 you'll write Tetris in C Shard, on your OS, on the computer you built from transistors.

</aside>
