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

## Open

- **Shifts.** Shift-left is a + a. Shift-right needs its own wiring;
  deferred to the full ISA design (Tetris shifts pixel masks a lot).
- **Signed overflow flag (V).** Not included; revisit if signed comparisons
  need it.
- Everything else: registers, instruction formats, addressing, jumps and
  conditions, memory map and I/O (milestone M6).
