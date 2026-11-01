---
number: 4
title: The CPU
summary: Design an instruction set together, then build the control unit and the datapath that run it, one instruction per clock cycle, and wire the CPU to its memory.
---

You now have every part a computer needs: an ALU that calculates, registers and RAM that remember, and a program counter that knows where it is. What's missing is the thing that makes them work together: the **[[processor]]**, or CPU. It does one job over and over, billions of times a second in a real machine: read the next instruction, work out what it means, and carry it out. That loop is the **[[fetch–decode–execute cycle|instruction-cycle]]**. In this chapter you'll build it.

## Instructions are numbers

A program is a list of **[[instructions|instruction]]**, and an instruction is just a number. In our computer each one is a 16-bit word: some bits say *what* to do (add, store, jump), others say *with what* (which registers, which constant). A program stored as plain words is **[[machine code|machine-code]]**. People write it in **[[assembly language|assembly-language]]** instead, one short line per instruction:

```
        SET  r0, 0        ; sum = 0
        SET  r1, 10       ; i = 10
loop:   ADD  r0, r0, r1   ; sum = sum + i
        SUBI r1, 1        ; i = i - 1
        JNZ  loop         ; again unless i is 0
done:   JMP  done         ; stop: r0 = 55
```

The full list of instructions, exactly how each is written in bits and what it does, is the **[[instruction set|instruction-set]]**. It's a contract: the hardware promises to do what it says, and every program from here to Tetris is written in it. That's why we designed ours together, one decision at a time. It's written out in full in `docs/ISA.md`.

## The decisions we made

| Question | We chose | Why |
|---|---|---|
| Registers | 8 general-purpose registers, r0 to r7 | room for a game's working values without constant trips to memory |
| Memory | a separate program ROM | fetching the next instruction and reading data can happen at once |
| Instruction size | every instruction is one 16-bit word | fetching is trivial; a 16-bit constant takes two instructions (SET, then SETH) |
| Decisions | jumps test saved flags Z, N, C | uses the flags your ALU already makes |
| Calls | CALL saves the return address in r7 | one clock cycle, almost no extra hardware |
| Shifts | a barrel shifter, 0 to 15 places at once | games slide bit patterns sideways all the time |
| Devices | memory-mapped screen and keyboard | drawing is just storing; no special instructions |

Keeping the program apart from the data is often called a **[[Harvard architecture|harvard-architecture]]**, after the Harvard Mark I, which read its instructions from punched paper tape while its numbers sat in separate counters, though where the name really comes from is disputed[@harvard-architecture]. It is the opposite of the **[[stored-program|stored-program]]** design from Chapter 0, where program and data share one memory[@von-neumann-edvac]. The separation is still common: Microchip's AVR microcontrollers fetch the next instruction while the current one runs, so most instructions take a single clock cycle[@avr-harvard].

Many registers, simple instructions all the same size, and memory touched only by LOAD and STORE: together these are the **[[RISC|risc]]** style. It grew out of John Cocke's IBM 801 project from about 1975 and was argued for in a 1980 paper by David Patterson and David Ditzel[@risc]. Saving the return address in a register is what ARM processors do too: their "branch with link" puts it in r14, their **[[link register|link-register]]**[@arm-link-register].

## Instruction formats

Every instruction starts with a 3-bit group number (bits 15–13). The rest depends on the group:

| Group | Bits 15–13 | Then | Example |
|---|---|---|---|
| ALU | 000 | rd, ra, rb, and the ALU's f, invb, cin | `ADD r3, r1, r2` |
| CMP | 001 | ra, rb, ALU control (only the flags are kept) | `CMP r1, r2` |
| IMM | 010 | rd, a 2-bit kind, an 8-bit number | `SET r1, 5`, `SUBI r1, 1` |
| SHIFT | 011 | rd, ra, direction, amount | `SHR r3, r3, 4` |
| LOAD | 100 | rd, ra, a 7-bit offset | `LOAD r6, [r0 + 2]` |
| STORE | 101 | rs, ra, a 7-bit offset | `STORE r3, [r0 + 2]` |
| JUMP | 110 | a 3-bit condition, a 10-bit offset | `JNZ loop` |
| CALL / JR | 111 | an offset, or a register to jump to | `CALL draw`, `RET` |

Look at the ALU group: its four lowest bits go *straight* to your ALU's f, invb and cin pins. That's no accident: we designed the ALU and the instruction set to fit each other. Every 16-bit word means some instruction, so the CPU can never be handed something it can't run.

## Running a program

Here is our CPU running the programs above, one instruction per press of Step. Watch which registers change and when the program counter jumps instead of counting up. A **[[subroutine]]** call is just a jump that remembers where it came from.

<cpu-demo></cpu-demo>

## The control unit

The **[[control unit|control-unit]]** reads an instruction and the saved flags and sets every signal that steers the rest of the CPU: which registers to read (ra, rb), which one to write (wa) and whether to write at all (we), what the ALU does, whether its second input is a register or a constant from the instruction, what gets written (the ALU's result, the shifter's, a constant, a word from memory, or the return address), and whether the PC jumps.

It is ordinary combinational logic, built from gates you already have. The handiest trick is a DMUX8WAY with its input tied to 1 and the group number on sel: it gives you one wire per instruction group, which is 1 only for this instruction's group. Almost every signal is then a few ANDs and ORs of those wires and instruction bits.

**[Build the control unit →](#/play/decode)**

## The datapath

The rest of the CPU is the **[[datapath]]**: the parts that hold and move the data.

- The **[[register file|register-file]]** holds r0 to r7. It reads two registers at once (for `ADD r3, r1, r2` the ALU needs r1 and r2 together) and writes one on the clock edge. It's eight Registers, a DMUX8WAY and two MUX8WAY16s.
- The **[[barrel shifter|barrel-shifter]]** shifts a word by any amount from 0 to 15 in one step. It has four stages that shift by 1, 2, 4 and 8, each either on or off: shifting by 5 is stages 1 and 3. Each stage is one MUX16, and the shifting itself is only wiring.
- Your ALU, a MUX16 that picks its second input, a MUX8WAY16 that picks the result to write, three Bits for the flags, an adder for jump targets (PC + offset), and your program counter.

**[Build the register file →](#/play/regfile)** · **[Build the barrel shifter →](#/play/shifter)** · **[Build the CPU →](#/play/cpu)**

<details class="deeper">
<summary>Go deeper: how fast could it run?</summary>

Built entirely from your own gates, the reference CPU is about 4,300 gates, and the slowest path through it is 110 gate delays: an instruction's bits go through the control unit, the register file, the ALU's ripple-carry adder and the result multiplexer before they settle. Every instruction gets one clock cycle, so the clock can't tick faster than that slowest path allows, even for instructions that would finish much sooner. Real processors get around this by splitting each instruction into stages and working on several instructions at once (a *pipeline*), at the cost of a much more complicated control unit.

</details>

## Memory and the computer

The CPU talks to memory through four pins: addrM (an address, from the ALU), outM (a value to store), writeM (store now) and inM (the word read back). Behind those pins sits the **memory map**, which decides what each address means:

| Addresses | What's there |
|---|---|
| 0x0000–0x3FFF | RAM16K: 16,384 words, built from four RAM4Ks |
| 0x4000–0x42FF | the screen: 128 × 96 pixels, 1 bit each, 16 to a word |
| 0x6000 | the keyboard: the code of the key held down |
| everything else | reads 0, ignores writes |

On the screen, row y is the 8 words starting at 0x4000 + 8y, and the leftmost pixel of a word is its top bit. A word written in binary looks just like its 16 pixels. This is **[[memory-mapped I/O|memory-mapped-io]]**: drawing on the screen is an ordinary STORE, and reading a key is an ordinary LOAD. The program ROM sits outside the computer. The tests and, later, the site feed the CPU the instruction at pc, just as a real ROM chip would.

**[Build RAM16K →](#/play/ram16k)** · **[Build the memory map →](#/play/memory)** · **[Build the computer →](#/play/computer)**

## Fast models for the CPU

Tetris will need hundreds of thousands of instructions every second, far more than a simulation of every gate can manage. So the CPU and the memory map get fast models, like the RAMs in Chapter 3. Once your CPU passes, it can be compared with the fast model on 10,000 random clock cycles; if they agree on every cycle, you can switch it on the level map and your computer runs at full speed. The checks already use the fast models for memory parts, because a RAM16K built from gates is millions of gates.

<aside class="summary">

## What you built, and what you learned

**What you built:** a barrel shifter, RAM16K, a register file, the control unit, the whole CPU, the memory map with its screen and keyboard, and the computer that joins them. It runs every instruction of the instruction set we designed, one per clock cycle.

**What you learned:**

- A program is a list of instructions, and an instruction is a number. The instruction set is the contract between hardware and software.
- A CPU repeats fetch, decode, execute. The control unit turns an instruction into control signals; the datapath (registers, ALU, shifter) does the work.
- Designs trade simplicity against speed and size: a separate program ROM and one-word instructions let every instruction finish in one cycle.
- Conditional jumps use the flags saved by earlier instructions; CALL and RET use a link register.
- With memory-mapped I/O, devices are just addresses: the screen is memory, and drawing is storing.

**Next:** in Chapter 5 you'll write an assembler, the program that turns assembly language into the machine code your computer runs.

</aside>
