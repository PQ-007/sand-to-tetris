# Instruction set: decisions so far

The ISA (instruction set architecture) is designed together with the
learner, one decision at a time (CLAUDE.md Rule 5). This file records what
has been agreed and what is still open. Change it only after discussing it.

## Agreed

### Word size: 16 bits
Registers, buses and memory words are 16 bits. Numbers are unsigned
0..65,535 or two's complement −32,768..32,767; the adder doesn't care which.

### ALU (agreed 2026-10-31): "hybrid" design, flags Z, N, C

Inputs: `a[16]`, `b[16]`, `f[2]`, `invb`, `cin`. Outputs: `out[16]`, `z`, `n`, `c`.

1. If `invb` = 1, every bit of `b` is inverted first (b' = b XOR invb).
2. `f` chooses the result: 0 = ADD (a + b' + cin), 1 = AND, 2 = OR, 3 = XOR.
3. Flags: `z` = out is 0; `n` = bit 15 of out; `c` = the adder's carry out
   when f = ADD, otherwise 0.

| Operation | f | invb | cin | Notes |
|---|---|---|---|---|
| a + b | 0 | 0 | 0 | |
| a − b | 0 | 1 | 1 | a + NOT b + 1. c = 1 means a ≥ b (unsigned) |
| a + 1 | 0 | 0 | 1 | b = 0 |
| a − 1 | 0 | 1 | 0 | b = 0 (adds 0xffff) |
| a AND b | 1 | 0 | – | |
| a AND NOT b | 1 | 1 | – | "bit clear": useful for masks |
| a OR b | 2 | 0 | – | |
| a XOR b | 3 | 0 | – | |
| NOT a | 3 | 1 | – | b = 0 |
| copy a | 2 | 0 | – | b = 0 |

Why this design (the options offered were "pick a result", "control bits
only" and this hybrid): subtraction comes free from two's complement
(a + NOT b + 1) through the same adder, and the four control fields
(f, invb, cin) map neatly onto bits of an instruction.

Level: `hdl/levels/layer2/alu`; native model `alu` in `s2t-models`.

### Machine shape (agreed 2026-11-01)

The four options offered for each question, and why the chosen one won:

- **8 general-purpose registers, r0–r7** (vs 4 registers or a single
  accumulator). Room for a game's working variables without constant memory
  traffic; a register is named by a 3-bit field. The register file is built
  from parts that already exist: 8 Registers, a DMUX8WAY to pick which one
  loads, and two MUX8WAY16 so two registers can be read at once.
- **Separate program ROM ("Harvard")** (vs one shared memory). Fetching the
  next instruction and reading/writing data happen in the same clock, so
  every instruction takes exactly one cycle and the CPU needs no control
  state machine. The site loads programs into the ROM; a program can't
  rewrite itself.
- **Every instruction is one 16-bit word** (vs 32-bit instructions, or an
  optional second word). A 16-bit constant takes two instructions (low byte,
  then high byte); constants 0–255 take one.
- **Memory-mapped I/O** (vs IN/OUT instructions). The screen is a block of
  data addresses and the keyboard one address, so drawing is storing and
  reading a key is loading.

### Rounds 2 and 3 (agreed 2026-11-01)

- **Conditional jumps test saved flags** (vs compare-and-branch, or
  skip-next-instruction). Instructions that use the ALU for arithmetic save
  Z, N, C in a 3-bit flags register; a jump names one of 8 conditions.
- **CALL saves the return address in r7** (a link register, vs a hardware
  stack). RET is "jump to r7". A subroutine that calls another saves r7 in
  RAM first; the VM (M9) does that.
- **Barrel shifter**: shift by 0–15 in one instruction (vs by 1 only, or no
  shift hardware). Built from 4 stages of MUX16 (shift by 1, 2, 4, 8).
- **Screen 128 × 96, black and white**, 1 bit per pixel: 768 words.
- **All 8 registers hold values** (vs r0 always reading 0). Compare-only
  gets its own opcode (CMP).
- **16K words of data RAM** (one more level: RAM16K from four RAM4Ks).

## The specification

The crate `s2t-isa` (`sim/crates/isa`) is this specification as code:
`decode`, `encode`, a disassembler and a reference CPU with the memory map.
Its tests (`sim/crates/isa/tests/spec.rs`) check every rule below; the
fast CPU model (M7), the assembler (M8) and later the VM and compiler build
on it. If this document and the crate disagree, that's a bug in one of them.

### State

| Part | Size | Notes |
|---|---|---|
| r0–r7 | 8 × 16 bits | general purpose; CALL writes r7 |
| PC | 16 bits | address of the current instruction in program ROM |
| flags Z, N, C | 3 bits | written only by ALU, CMP, ADDI, SUBI |
| program ROM | up to 65,536 × 16 bits | loaded by the site, read-only |
| data memory | 65,536 addresses × 16 bits | RAM, screen and keyboard, see the memory map |

Every instruction takes **one clock cycle**. During the cycle the CPU reads
the instruction at PC and the registers, flags and memory as they were
before the clock edge; at the rising edge it writes at most one register,
the flags, at most one memory word, and the new PC. Unless an instruction
says otherwise, the new PC is PC + 1 (wrapping at 16 bits).

**Reset** sets PC to 0. Registers, flags and RAM are unknown (X) at power-on
in the gate-level simulation, as in Chapter 3; programs must set them
before reading them. (The fast model starts them at 0.)

### Instruction formats

Bit 15 is the most significant. `rd`, `ra`, `rb`, `rs` are 3-bit register
numbers. Every 16-bit word is a valid instruction: bits marked `-` are
ignored (the assembler writes 0 there).

| Group | 15–13 | 12–10 | 9–7 | 6–4 | 3–0 |
|---|---|---|---|---|---|
| ALU | `000` | rd | ra | rb | f₁ f₀ invb cin |
| CMP | `001` | `---` | ra | rb | f₁ f₀ invb cin |
| IMM | `010` | rd | k₁ k₀ + imm8 (bits 9–0: `kk iiiiiiii`) | | |
| SHIFT | `011` | rd | ra | reg right arith | amount (or `-` + rb) |
| LOAD | `100` | rd | ra | off7 (bits 6–0) | |
| STORE | `101` | rs | ra | off7 (bits 6–0) | |
| JUMP | `110` | cond | off10 (bits 9–0, signed) | | |
| CALL / JR | `111` | bit 12 = 0: off12 (bits 11–0, signed) · bit 12 = 1: link (11), ra (10–8), `-` (7–0) | | | |

### What each instruction does

`R[x]` is register x; `ALU(a, b, f, invb, cin)` is the ALU above.

| Group | Effect | Flags |
|---|---|---|
| ALU | R[rd] ← ALU(R[ra], R[rb], f, invb, cin) | Z N C ← ALU |
| CMP | ALU(R[ra], R[rb], f, invb, cin); result discarded | Z N C ← ALU |
| IMM k=0 `SET` | R[rd] ← imm8 (high byte 0) | unchanged |
| IMM k=1 `SETH` | R[rd] ← imm8 × 256 + (R[rd] AND 0x00FF) | unchanged |
| IMM k=2 `ADDI` | R[rd] ← ALU(R[rd], imm8, ADD) = R[rd] + imm8 | Z N C ← ALU |
| IMM k=3 `SUBI` | R[rd] ← ALU(R[rd], imm8, SUB) = R[rd] − imm8 | Z N C ← ALU |
| SHIFT | n = amount if reg = 0, else R[rb] AND 15 (rb = bits 2–0). right = 0: R[rd] ← R[ra] << n (zeros in). right = 1, arith = 0: R[rd] ← R[ra] >> n (zeros in). right = 1, arith = 1: R[rd] ← R[ra] >> n, copies of bit 15 in. (arith is ignored for left shifts.) | unchanged |
| LOAD | R[rd] ← MEM[R[ra] + off7] (off7 = 0..127, sum wraps at 16 bits) | unchanged |
| STORE | MEM[R[ra] + off7] ← R[rs] | unchanged |
| JUMP | if cond holds: PC ← PC + off10 (−512..511), else PC + 1 | unchanged |
| CALL | r7 ← PC + 1; PC ← PC + off12 (−2048..2047) | unchanged |
| JR | t ← R[ra] (read before any write); if link = 1: r7 ← PC + 1; PC ← t | unchanged |

Jump offsets count from the jump itself, so `JMP 0` loops on the spot: that
is how a program halts. In hardware, ADDI and SUBI feed imm8 (zero-extended)
to the ALU's b input, and LOAD and STORE compute their address with the ALU
(f = ADD); the flags are saved only for the instructions listed.

### Jump conditions

| cond | Name | Jumps when | After `CMP a, b` (SUB) means |
|---|---|---|---|
| 000 | JMP | always | |
| 001 | JZ (JEQ) | Z | a = b |
| 010 | JNZ (JNE) | not Z | a ≠ b |
| 011 | JN | N | bit 15 of a − b is 1 |
| 100 | JNN | not N | bit 15 of a − b is 0 |
| 101 | JC (JHS) | C | a ≥ b (unsigned) |
| 110 | JNC (JLO) | not C | a < b (unsigned) |
| 111 | JHI | C and not Z | a > b (unsigned) |

There is no overflow flag, so JN/JNN are a true signed comparison only when
a − b doesn't overflow (both values within ±16,383 is always safe).

### Assembly names (the assembler in M8 accepts these)

| Name | Encoding |
|---|---|
| `ADD rd, ra, rb` | ALU f=0 invb=0 cin=0 |
| `SUB rd, ra, rb` | ALU f=0 invb=1 cin=1 |
| `AND rd, ra, rb` · `ANDN` (a AND NOT b) | ALU f=1, invb=0 / 1 |
| `OR rd, ra, rb` · `ORN` | ALU f=2, invb=0 / 1 |
| `XOR rd, ra, rb` · `XORN` | ALU f=3, invb=0 / 1 |
| `MOV rd, ra` | OR rd, ra, ra |
| `CMP ra, rb` · `TEST ra, rb` | CMP with SUB / AND |
| `SET rd, n` · `SETH rd, n` · `ADDI rd, n` · `SUBI rd, n` | IMM k=0..3, n = 0..255 |
| `SHL rd, ra, n` · `SHR` · `SAR` | SHIFT reg=0, n = 0..15 (SAR: right + arith) |
| `SHL rd, ra, rb` · `SHR` · `SAR` | SHIFT reg=1, by R[rb] AND 15 |
| `LOAD rd, [ra + n]` · `STORE rs, [ra + n]` | n = 0..127 |
| `JMP label` · `JZ` … `JHI label` | JUMP, label within −512..511 |
| `CALL label` · `CALLR ra` · `JR ra` · `RET` | CALL / JR link=1 / JR link=0 / JR r7 |

NOT needs a zero: `SET r6, 0` then `XORN rd, ra, r6`. A 16-bit constant is
`SET rd, low` then `SETH rd, high`.

### Memory map (data addresses)

Address bits 15–13 choose the device:

| Bits 15–13 | Addresses | Device |
|---|---|---|
| 000, 001 | 0x0000–0x3FFF | RAM16K (16,384 words) |
| 010 | 0x4000–0x42FF | screen, 768 words (0x4300–0x5FFF unused) |
| 011 | 0x6000 | keyboard: code of the key held, 0 if none (read-only) |
| 011 | 0x6001 | timer: frames since the program started, 60 a second, wrapping at 16 bits (read-only; agreed 2026-11-01) |
| 011 | 0x6002–0x7FFF | unused (reserved for more devices) |
| 1xx | 0x8000–0xFFFF | unused |

Unused addresses read as 0 and ignore writes. **Screen:** 128 × 96 pixels,
1 = pixel on. Row y (0–95) is the 8 words at 0x4000 + 8y. Pixel x (0–127) is
in word x ÷ 16 of the row, and the **most significant bit is the leftmost
pixel** (bit 15 − (x mod 16)), so a word written in binary looks like its
16 pixels, left to right, and `SHR` moves a pattern right on screen.

**Keyboard codes** (agreed 2026-11-01, keeping M8's provisional set):
printable keys give their ASCII code (32–126, letters as typed), Enter 13,
Backspace 8, Escape 27, and the arrows left 128, up 129, right 130, down
131. Tab is never captured, so keyboard users can't get stuck in the screen.

**Timer** (agreed 2026-11-01): whoever runs the computer feeds the frame
count in, like the keyboard, so a game runs at the same speed however fast
the simulation is. Random numbers are made in software by the OS (M11), not
by a device.

### Example: sum 10 + 9 + … + 1

```
        SET  r0, 0        ; 010 000 00 00000000   sum
        SET  r1, 10       ; 010 001 00 00001010   i
loop:   ADD  r0, r0, r1   ; 000 000 000 001 0000
        SUBI r1, 1        ; 010 001 11 00000001   i = i - 1, sets Z
        JNZ  loop         ; 110 010 1111111110    offset -2
done:   JMP  done         ; 110 000 0000000000    halt: r0 = 55
```

## Open

- **Signed overflow flag (V).** Not included; revisit if signed comparisons
  need it.
- Key codes, timer and random-number devices: with the OS (M11).
