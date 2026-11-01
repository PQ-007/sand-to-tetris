---
number: 5
title: The assembler
summary: Write programs with names instead of numbers, then build the program that translates them, in four stages and two passes.
---

In Chapter 4 a program was a list of numbers: `0x4405, 0x0ca0, 0xcbfe`. Your CPU is happy with that, and nobody else is. People write **[[assembly language|assembly-language]]** instead, with names for instructions, registers and places in the program, and a program called an **[[assembler]]** translates it into **[[machine code|machine-code]]**. In this chapter you'll learn the language your computer's programs are written in, and then you'll write the assembler yourself.

## From names to numbers

An assembler is not magic, and it doesn't run on the CPU it's assembling for. It's an ordinary program that reads text and writes numbers. For one line, it splits the text into pieces, finds out which instruction it is, and packs the parts into the bit fields of `docs/ISA.md`: the group number in bits 15–13, then registers, then a constant or an offset. Try it:

<asm-demo></asm-demo>

Every 16-bit word is some instruction, so the disassembler (the reverse translator) can always read a word back. The assembler and the disassembler agree on all 65,536 words; that's one of the tests of the reference assembler.

## The language

A line has up to three parts, all optional: a **[[label]]**, an instruction, and a comment after `;`.

```
loop:   ADD  r0, r0, r1    ; total = total + counter
```

- **Names** for labels and constants are letters, digits and `_`, and case matters. Instruction names and registers (`r0`–`r7`) can be written in any case.
- **Numbers** can be decimal (`42`, `-5`), hex (`0x4000`), binary (`0b1111_0000`, with `_` between digits if you like), or a character (`'A'` is 65).
- **Memory** is written `[r1 + 2]`, or `[r1]` for an offset of 0.
- **Jumps** name a label, and the assembler works out how far away it is. A number is the distance itself: `JMP 0` jumps to itself.

### Shortcuts and directives

A **[[pseudo-instruction]]** is a name the assembler understands but the CPU doesn't have. It becomes one or more real instructions:

| You write | The assembler makes |
|---|---|
| `SET16 r1, 0x4000` | `SET r1, 0` and `SETH r1, 0x40` (just `SET` for a value from 0 to 255) |
| `INC r1` · `DEC r1` | `ADDI r1, 1` · `SUBI r1, 1` |
| `HALT` | `JMP 0`: jump to itself forever |
| `NOP` | `JMP 1`: the next instruction, changing nothing |

A **[[directive]]** starts with a dot and talks to the assembler instead of becoming an instruction. `.equ SCREEN 0x4000` names a number. `.data` switches to the data section, where `.word 1, 2, 3` puts numbers and `.space 8` puts 8 zeros; `.code` switches back. Our computer keeps its program in a ROM that LOAD can't read, so data goes into RAM. Before the program starts, the **[[loader]]** copies the data section into RAM from address 0, and a data label is that RAM address:

```
.data
shapes: .word 0x0F00, 0x4444     ; RAM[0] and RAM[1]
.code
        SET16 r1, shapes         ; r1 = 0
        LOAD  r2, [r1 + 1]       ; r2 = 0x4444
```

## How an assembler works

The reference assembler and yours are built the same way, in four stages. Each stage takes what the one before made.

### 1. Tokenize

Cut a line into tokens: `loop:` is a label, `ADD` and `r1` are names, `0x10` is a number, and `,` `[` `]` `+` are punctuation. Spaces and the comment disappear. Here you notice a bad character, or a number like `12ab`.

### 2. Parse

Read the tokens as a line: an optional label, then an instruction or directive, then operands separated by commas. `r0`–`r7` become registers, other names stay names for later. Here you notice a missing comma or `]`.

### 3. Layout: the first pass

Here is the puzzle. In `JNZ loop`, the assembler must know where `loop` is, but a jump forward can name a label that only appears further down. So the assembler reads the whole program twice. The first pass gives every line its address and collects every name into a **[[symbol table|symbol-table]]**. Each instruction is one word, except SET16, whose size depends on its value, so the first pass decides that too. An assembler that works like this is a **[[two-pass assembler|two-pass-assembler]]**.

### 4. Encode: the second pass

Now every name has a value, so each line can be turned into its words: look up the labels, compute jump distances, check that every number fits its field, and pack the bits.

A good assembler doesn't stop at the first mistake: it reports every line with a problem, says what's wrong, and points at the line.

**[Write your own assembler →](#/assembler)** · **[Open the Machine →](#/machine)**

## Where assemblers come from

Writing programs as numbers lasted only a few years. In 1947 Kathleen Booth described a "contracted notation" for the ARC2 computer at Birkbeck that wrote instructions with short symbols instead of binary; it is often called the first assembly language, though that name came later and is debated[@booth-contracted-notation]. In May 1949 David Wheeler wrote the "initial orders" for the EDSAC at Cambridge: a few dozen words that read a program punched on paper tape with letter mnemonics and put it into memory. It is often called the first assembler, again a claim about firsts that is debated, and a second version that September also adjusted addresses as it loaded[@edsac-initial-orders]. Every assembler since does the same job: names in, numbers out.

## Running your programs

On the **Machine** page you can write a program, assemble it and run it: on the screen, the keyboard, the registers and RAM of the computer you designed. It starts with the built-in assembler; once your own passes every test in the workshop, you can choose it instead, and your programs go through code you wrote, all the way down to the bits. The programs run on the fast model of the CPU, so they're quick enough for games.

<aside class="summary">

## What you built, and what you learned

**What you built:** an assembler, in four stages with their own tests, that turns our assembly language into machine code and a data image, and programs that run on your computer's screen and keyboard.

**What you learned:**

- Assembly language gives instructions, registers and addresses names; an assembler is an ordinary program that translates it into machine code.
- Pseudo-instructions and directives make programs shorter to write without changing the CPU.
- Labels can be used before they're defined, so the assembler makes two passes: the first builds the symbol table, the second encodes.
- Data the program needs goes in its own section, which the loader copies into RAM before the program starts.

**Next:** in Chapter 6 you'll build a virtual machine on top of the assembler, a stack machine whose programs no longer have to think in registers.

</aside>
