# The virtual machine

The VM sits between the high-level language (M10) and assembly
(`docs/ASSEMBLY.md`). The compiler writes VM commands; the translator turns
each one into a few lines of assembly. Agreed with the user on 2026-11-01:

- a **stack machine** (vs a register VM or no VM): commands take their
  operands from one stack and push their result, so an expression compiles
  to its operands and operators in order;
- values live in **numbered locals, arguments and globals**, plus `load`
  and `store` through an address (vs named variables), so arrays, pointers,
  the screen and the keyboard are all just addresses;
- **true is −1** (all 16 bits 1) and false is 0, so `and`, `or` and `not`
  work for both bits and conditions; a jump treats any nonzero value as true;
- **`mul`, `div` and `mod` are VM commands**: the translator adds small
  routines to the program that does the work (the CPU has no multiplier).

The reference translator and VM interpreter are the crate `s2t-vm`
(`toolchain/vm`). Its tests check every rule below, and it produces the
expected results the learner's translator is tested against.

## Lines

One command per line; `;` starts a comment; blank lines are fine. Command
words (`push`, `local`, ...) are not case-sensitive; **names** (functions
and labels) are: letters, digits and `_`, not starting with a digit, not
containing `__` (two underscores belong to the translator) and not a
register name `r0`–`r7`. **Numbers** are decimal (`42`, `-5`), hex (`0x2A`)
or binary (`0b1010`), with `_` allowed between digits, in −32768..65535;
a negative number is stored as its 16-bit two's complement.

## Commands

The stack is written bottom to top; `a b → a+b` means: b is on top, both
are popped, and their sum is pushed.

| Command | Stack | Effect |
|---|---|---|
| `push n` | → n | a number |
| `push local i` · `push arg i` · `push global i` | → v | a variable's value |
| `set local i` · `set arg i` · `set global i` | v → | pop into a variable |
| `pop` | v → | throw the top away |
| `dup` | v → v v | copy the top |
| `load` | addr → MEM[addr] | read memory |
| `store` | addr v → | MEM[addr] ← v |
| `add` `sub` | a b → a+b, a−b | wrapping at 16 bits |
| `and` `or` `xor` | a b → a op b | bit by bit |
| `neg` `not` | a → −a, NOT a | |
| `shl` `shr` `sar` | a n → a shifted by n AND 15 | as the CPU: `sar` copies bit 15 in |
| `mul` | a b → a×b | the low 16 bits |
| `div` `mod` | a b → a÷b, a mod b | signed, rounding toward 0 (−7 ÷ 2 = −3, −7 mod 2 = −1); b = 0 gives −1 and a; −32768 ÷ −1 = −32768, mod 0 |
| `eq` `ne` `lt` `gt` `le` `ge` | a b → −1 or 0 | signed and exact for every pair (no overflow trap) |
| `label L` | | names this place in the function |
| `jump L` | | go to `L` |
| `jumpif L` · `jumpifnot L` | v → | go to `L` if v ≠ 0 · if v = 0 |
| `func f n k` | | starts function `f` with n arguments and k locals |
| `call f n` | args → result | calls `f` (n must match its `func`) |
| `return` | v → | returns v to the caller |

Indexes: `local i` needs i < k, `arg i` needs i < n, and n + k ≤ 126;
`global i` is 0..4095.

### Programs

A program is a list of functions. Every command except `func` belongs to
the function above it; labels are local to their function. Execution starts
by calling `main`, which takes no arguments; when it returns, the program
halts with main's result on the stack. A function's last command must be
`return` or `jump`, so code never runs on into the next function. Every
function returns exactly one value; a function with nothing to return
returns 0.

Locals start at 0. Arguments are numbered in the order pushed: for
`push 10`, `push 20`, `call f 2`, `arg 0` is 10 and `arg 1` is 20.

## Memory and registers (the calling convention)

The translator and the interpreter use the same layout, so the learner's
translation of one command can run next to the reference's translation of
another.

| Register | Holds |
|---|---|
| r6 | **SP**: the address of the top of the stack. The stack grows down: a push is `SUBI r6, 1` then `STORE`, so the top is `[r6]` and the one below it `[r6 + 1]`. |
| r5 | **FP**: the current function's frame (below) |
| r7 | the return address (CALL and CALLR write it) |
| r0–r4 | scratch: any command may change them; none keeps a value from one command to the next |

| Addresses | What |
|---|---|
| 0 .. G−1 | globals: `global i` is RAM[i] (G = 1 + the highest index used) |
| G .. | free (the OS will put its heap here) |
| .. 0x3FFF | the stack, starting empty at SP = 0x4000 |

**A function's frame.** The caller pushes the arguments, then the callee
saves the return address and the caller's FP and makes room for its k
locals; FP then points at local 0:

| Address | Holds |
|---|---|
| FP + n + k + 1 | arg 0 |
| ... | ... |
| FP + k + 2 | arg n−1 |
| FP + k + 1 | the return address |
| FP + k | the caller's FP |
| FP + k − 1 | local k−1 |
| ... | ... |
| FP + 0 | local 0 |
| below FP | the function's own stack (SP) |

All of these are LOAD/STORE offsets from FP (0..127), which is why
n + k ≤ 126. `return` pops the result, puts it where arg 0 was (or, with
no arguments, where the return address was), sets SP to it and FP back to
the caller's, and jumps to the return address: for the caller, the
arguments have turned into the result.

**Names in the assembly.** Function `f` is the label `f`; label `L` in
function `f` is `f__L`; anything the translator makes up itself starts with
`__` (`__mul`, `__div`, labels inside one command's translation). A VM name
can't contain `__`, so these never collide.

**Start.** The program begins with the bootstrap: SP = 0x4000, FP = SP,
call `main`, then `HALT`. `call` uses `SET16` and `CALLR`, and the
bootstrap too, so functions can be anywhere in the ROM. `jump`, `jumpif`
and `jumpifnot` assemble to the CPU's jumps, which reach ±511 words; the
assembler reports a function too long for that.

**Globals.** The translation ends with a `.data` section of G words of 0
(`.space G`), so the loader puts the globals at RAM 0..G−1, starting at 0.

**mul, div, mod.** These become calls to routines `__mul` and `__div`,
added at the end of the program once (only if used): operands in r0 and r1;
`__mul` returns the product in r0, `__div` the quotient in r0 and the
remainder in r1. They use only r0–r4 (and `__div` one word below SP) and
return with `RET`. `function-too-long` is the assembler's jump-too-far,
reported on the VM line of the jump.

## Errors

Errors name the line and have a code (the message can be in any language):

`bad-number`, `bad-name`, `unknown-command`, `operand-count`,
`bad-segment` (not `local`, `arg` or `global`), `set-constant` (`set` needs
a variable), `out-of-range`, `outside-function`, `duplicate-function`,
`duplicate-label`, `unknown-function`, `unknown-label`, `no-variable`
(`local i` or `arg i` that the function doesn't have), `arg-count` (a
`call` that doesn't match the `func`), `too-many-variables` (n + k > 126),
`no-main`, `main-args`, `no-return` (a function's last command isn't
`return` or `jump`), `function-too-long` (a jump inside a function that the
CPU's jumps can't reach), `asm` (the assembler rejected the translation:
a translator bug).

## How it's built: three stages

The reference translator and the learner's are built the same way:

1. **parse** one line into a command (JSON, below), or nothing for a blank
   line;
2. **translate** one command into assembly lines, given its function (name,
   n, k) and the line number (for labels inside the translation);
3. **bootstrap** and **runtime**: the start of the program, and the
   `__mul` / `__div` routines.

The checks that look at the whole program (functions, labels, calls,
`main`) and the glue that runs the stages are shared code, not an exercise.

Command JSON: `{"op": "push", "seg": "const", "n": 5}` (seg `const`,
`local`, `arg` or `global`; a constant's n is 0..65535), `{"op": "set",
"seg": "local", "n": 0}`, `{"op": "add"}` (and every command without
operands), `{"op": "jump", "name": "loop"}` (and `label`, `jumpif`,
`jumpifnot`), `{"op": "func", "name": "f", "args": 2, "locals": 1}`,
`{"op": "call", "name": "f", "args": 2}`.
