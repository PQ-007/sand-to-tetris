# Assembly language

The assembler turns assembly text into the words of the program ROM, plus
a data image the loader copies into RAM before the program starts. The
instructions and their encodings are in `docs/ISA.md`; this file adds
everything around them. Agreed with the user on 2026-11-01: constants and
a few pseudo-instructions, a `.data` section loaded into RAM, and the
learner's own assembler written in TypeScript in four tested stages.

The reference assembler is the crate `s2t-asm` (`toolchain/asm`). Its tests
check every rule below, and it produces the expected results the learner's
assembler is tested against.

## Lines

One statement per line, in this order, every part optional:

```
label:   MNEMONIC operand, operand, ...   ; comment
```

- A **comment** runs from `;` to the end of the line.
- A **label** is a name followed by `:`. It names the address of the next
  instruction (in `.code`) or the next data word (in `.data`).
- **Names** (labels and constants) are letters, digits and `_`, not starting
  with a digit, and are case-sensitive. **Mnemonics, directives and
  registers** (`r0`–`r7`) are not: `add`, `ADD` and `Add` are the same.
- **Numbers**: decimal `42`, `-5`; hex `0x2A`; binary `0b101010`; a character
  `'A'` (its ASCII code, 65). `_` may separate digits: `0b1111_0000`.

An operand is a register, a number, a name (a label or a constant), or a
memory reference `[rA + n]` / `[rA]` (n is a number or a name, 0–127).

## Instructions

Every instruction in `docs/ISA.md` ("Assembly names"), with these operands:

| Mnemonics | Operands |
|---|---|
| `ADD SUB AND ANDN OR ORN XOR XORN` | `rd, ra, rb` |
| `ALU` (any ALU control) | `rd, ra, rb, f, invb, cin` |
| `MOV` | `rd, ra` (assembles as `OR rd, ra, ra`) |
| `CMP` `TEST` | `ra, rb` (CMP with five operands: `ra, rb, f, invb, cin`) |
| `SET SETH ADDI SUBI` | `rd, n` with n = 0–255 |
| `SHL SHR SAR` | `rd, ra, n` (n = 0–15) or `rd, ra, rb` |
| `LOAD` | `rd, [ra + n]` |
| `STORE` | `rs, [ra + n]` |
| `JMP JZ JEQ JNZ JNE JN JNN JC JHS JNC JLO JHI` | a target |
| `CALL` | a target |
| `JR` `CALLR` | `ra` |
| `RET` | none |

A **target** is a code label (the assembler computes the offset from the
jump itself) or a number, which is the offset: `JMP 0` jumps to itself.
Jumps reach −512..511 instructions, CALL −2048..2047.

### Pseudo-instructions

| Write | Becomes |
|---|---|
| `SET16 rd, n` | `SET rd, low byte` then `SETH rd, high byte`; just `SET rd, n` when n is a number (or a constant defined above) from 0 to 255. n = −32768..65535; a label always takes two words. |
| `INC rd` · `DEC rd` | `ADDI rd, 1` · `SUBI rd, 1` |
| `NOP` | `JMP 1` (the only instruction that changes nothing) |
| `HALT` | `JMP 0` (jumps to itself forever) |

## Directives

| Directive | Meaning |
|---|---|
| `.equ NAME value` | a constant; value is a number or an earlier constant |
| `.code` | what follows goes into the program ROM (the default) |
| `.data` | what follows goes into the data image (RAM) |
| `.word v, v, ...` | data words (numbers, constants or labels; −32768..65535) |
| `.space n` | n words of 0 |

`.word` and `.space` belong in `.data`, instructions in `.code`. A data label
is a RAM address, so `SET16 r1, table` then `LOAD r2, [r1 + 0]` reads it.
A code label is a ROM address: it can be a jump target, or loaded with
`SET16` for `JR` / `CALLR`. Jumping to a data label is an error.

## Output and the loader

The result is the code words (ROM addresses 0, 1, 2, ...) and the data
image (RAM addresses 0, 1, 2, ...). Before the program starts, the loader
copies the data image into RAM from address 0; the rest of RAM and all
registers start at 0 on the Machine page (in the gate-level computer they
start unknown, as in Chapter 3).

## How it's built: two passes, four stages

The reference assembler and the learner's are built the same way, so each
stage can be tested on its own:

1. **tokenize** one line into tokens.
2. **parse** the tokens into a line: an optional label and an optional
   instruction or directive with its operands.
3. **layout** (pass 1): walk every line, give each its section and address,
   and collect the symbol table (labels and constants). An instruction's
   size is known here: 1 word, or 2 for a `SET16` that needs both halves.
4. **encode** (pass 2): turn each line into its words, using the symbols.

Errors name the line and say what's wrong; an assembler reports every error
it finds, not just the first.

### Error codes

`bad-char`, `bad-number`, `bad-name`, `expected` (something else was
expected, e.g. a `]`), `unknown-mnemonic`, `unknown-directive`,
`operand-count`, `not-a-register`, `bad-operand`, `out-of-range`,
`unknown-symbol`, `duplicate-symbol`, `data-in-code`, `code-in-data`,
`jump-to-data`, `jump-too-far`.

## Keyboard codes (provisional)

The Machine page's keyboard puts these at 0x6000 while a key is held (0 when
none); revisit with the OS in M11:

- printable characters: their ASCII code (32–126), letters as typed;
- Enter 13, Backspace 8, Escape 27 (Tab is not captured: it keeps moving
  keyboard focus, so nobody gets trapped in the screen);
- arrows: left 128, up 129, right 130, down 131.
