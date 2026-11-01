---
number: 3
title: Memory
summary: Give your circuits a past. Build a latch from two gates, a flip-flop that changes only when the clock ticks, then registers, RAM and a program counter.
---

Every circuit you built in Chapter 2 forgets. Its outputs depend only on its inputs right now: take the inputs away and the answer is gone. A computer has to remember things: the numbers it's working on, the program it's running, and where in that program it is. In this chapter you'll build that memory from your own gates, one bit first, then sixteen, then thousands. Circuits that remember are called **[[sequential circuits|sequential-circuit]]**.

## A loop that remembers

Here is the whole trick. Take two NOR gates and wire each one's output back into an input of the other. That is **[[feedback]]**: the circuit's output feeds its own input, so what it does next depends on what it's doing now.

Call the outputs q and q̄ ("q bar", always the opposite of q). The top gate makes q from r and q̄; the bottom gate makes q̄ from s and q.

- Set **s** (set) to 1. A NOR outputs 0 whenever any input is 1, so q̄ becomes 0. Now the top gate sees two 0s and outputs q = 1.
- Set s back to 0. Nothing changes: q = 1 keeps q̄ at 0, and q̄ = 0 keeps q at 1. The circuit **holds** its value with nothing outside driving it.
- Set **r** (reset) to 1 and the same happens the other way: q becomes 0 and stays 0.

This circuit is an SR **[[latch]]**. Try it:

<latch-demo></latch-demo>

Two things to notice in the demo. When you set or reset, the change takes two [[gate delays|gate-delay]] to go round the loop. And if s and r are both 1, q and q̄ are both 0, which breaks the promise that they're opposites. Release both at the same instant and the gates chase each other forever. That's why a latch must never get s = r = 1.

The idea is older than transistors. In June 1918 William Eccles and F. W. Jordan applied for a patent on two cross-coupled [[vacuum tubes|vacuum-tube]] that stay in either of two states after the signal that set them is gone: the first flip-flop circuit. It later went into the Colossus and ENIAC computers[@eccles-jordan].

**[Build the SR latch →](#/play/srlatch)**

## One data input: the D latch

Separate set and reset inputs are awkward. Usually you want to say "store *this* bit". A **D latch** has a data input d and an enable input en:

- while en is 1, q follows d;
- when en goes to 0, q keeps whatever d was at that moment.

Build it on your SR latch: set it when d is 1 *and* en is 1, reset it when d is 0 *and* en is 1. When en is 0, neither happens, so the latch holds. As a bonus, s and r can never both be 1.

**[Build the D latch →](#/play/dlatch)**

## Clocks and flip-flops

A D latch is *transparent* while it's enabled: every wobble on d passes straight through. Now picture a whole computer of them, where one latch's output feeds the next one's input. A value could race through several latches during one enable pulse, and the result would depend on exactly how fast each gate is. We need memory that changes at one instant only.

The answer is a **[[clock]]**: one signal, shared by the whole computer, that goes 0, 1, 0, 1 over and over. Memory is allowed to change only at a **[[clock edge|clock-edge]]**, the instant the clock rises from 0 to 1. Between edges everything holds still, and the logic in between has time to work out the next values.

A **[[flip-flop]]** does this with two D latches in a row:

- the first (the *master*) is open while the clock is 0, so it follows d;
- the second (the *slave*) is open while the clock is 1, so it copies the master.

At no moment are both open. When the clock rises, the master closes on the value d had just before the edge, and the slave passes that value to q. Afterwards d can do what it likes: the master is closed until the clock falls, and by then the slave is closed. One NOT gate gives the two latches opposite enables.

There's one rule for using a flip-flop: d must be steady for a moment *before* the edge. This is its **[[setup time|setup-time]]**. Change d at the same instant as the clock and you can't be sure which value gets stored. The test steps in this chapter always change the clock on its own, with d already settled.

**[Build the D flip-flop →](#/play/dff)**

## Unknown at power-on

When you open a memory level, the outputs read **X**. That isn't a bug: when real memory powers up, each latch falls one way or the other, and nobody knows which. The simulator is honest about it. Until something is stored, the value is unknown. In the test steps, a `-` in the expected column (shown as "any") means any value is fine at that step.

## Registers

A flip-flop stores something on *every* rising edge. Usually you want to choose when. A **Bit** adds a load input: on each edge, if load is 1 it stores d, otherwise it stores its own output again, so it keeps its value. A [[multiplexer]] makes that choice: its inputs are q (keep) and d (load), and load selects between them.

Put sixteen Bits side by side, all sharing load and clock, and you have a 16-bit **[[register]]**: it holds one number. Your CPU will keep its working values in registers.

**[Build Bit →](#/play/bit)** · **[Register →](#/play/register)**

## Seeing time: the waveform

Memory is about time, and a truth table doesn't show time. On every memory level, the editor shows a **[[waveform]]** under the canvas: one row per signal, time running left to right. Single bits are drawn as square waves, numbers as labelled segments, and unknown values as hatched X blocks.

The *Test steps* view shows the level's whole test, and clicking a column replays the test up to that moment. The *Live* view records what you do: flip d, press **Tick clk**, and watch q change only at the rising edge.

## RAM: memory with addresses

A register holds one number. To hold many, you need a way to say *which* one: an **[[address]]**, like a house number. **[[RAM|ram]]** (random-access memory) is a set of registers where you can read or write any address as quickly as any other.

RAM8 holds eight 16-bit registers, so its address is 3 bits (0 to 7). It needs two jobs done:

- **Writing:** load must reach only the register at the address. A [[demultiplexer]] does exactly that. An 8-way demultiplexer sends its input to one of eight outputs, chosen by a 3-bit number.
- **Reading:** q must show the register at the address. An 8-way multiplexer picks one of eight 16-bit numbers.

Every register gets the same d and the same clock. You'll build the 4-way and 8-way demultiplexers and the 8-way multiplexer first; they belong with the combinational circuits of Chapter 2.

**[4-way DMUX →](#/play/dmux4way)** · **[8-way DMUX →](#/play/dmux8way)** · **[8-way MUX16 →](#/play/mux8way16)** · **[RAM8 →](#/play/ram8)**

Bigger memories repeat the same idea. RAM64 is eight RAM8s. Its 6-bit address splits in two: the top 3 bits choose which RAM8, and the bottom 3 bits are the address inside it. RAM512 is eight RAM64s, and RAM4K is eight RAM512s, with 12 address bits for 4,096 words. Each step is the same circuit with a wider address.

**[RAM64 →](#/play/ram64)** · **[RAM512 →](#/play/ram512)** · **[RAM4K →](#/play/ram4k)**

<details class="deeper">
<summary>Go deeper: how many gates is your memory?</summary>

Counted by the simulator, built entirely from your own gates: a flip-flop is 15 gates, a Bit 23, and a Register 368. RAM8 adds the address logic to eight registers, about 3,900 gates. Each bigger RAM is eight of the one below plus about 900 gates of addressing, so RAM64 is about 32,000 gates and RAM4K about 2 million. That's why the editor suggests fast models for big memories: simulating every gate of a RAM4K on every clock tick would take far too long.

</details>

## Real memory

Real computers haven't always built memory from latches. From the mid-1950s to the 1970s most of them used **[[magnetic-core memory|magnetic-core-memory]]**: tiny magnetic rings threaded on a grid of wires, each ring storing a bit in the direction it was magnetized, and keeping it even with the power off[@core-memory]. Several inventors filed patents on the idea between 1947 and 1951. MIT's Whirlwind computer first showed it working in August 1953, with a grid of 32 × 32 = 1,024 cores. Who deserves the credit is still argued about[@core-memory].

Memory on chips comes in two kinds:

- **[[SRAM|sram]]** (static RAM) stores each bit in a latch, usually six transistors. It holds its value as long as there's power. Like the RAM you build here, it's fast but takes a lot of space per bit.
- **[[DRAM|dram]]** (dynamic RAM) stores each bit as a charge on a tiny **[[capacitor]]**, guarded by a single transistor. It's much smaller per bit, but the charge leaks away, so every bit has to be read and rewritten (*refreshed*) thousands of times a second.

Robert Dennard at IBM conceived the one-transistor DRAM cell, and his patent was granted in 1968. IBM at first shipped static memory instead, which it saw as less risky[@dennard-dram]. In October 1970 Intel introduced the 1103, the first DRAM chip you could buy: 1,024 bits, three transistors per bit. It soon replaced core memory in many computers[@intel-1103]. The main memory in the computer you're reading this on is DRAM, a descendant of Dennard's cell.

## The program counter

One register in your CPU is special. The **[[program counter|program-counter]]** (PC) holds the address of the next instruction. On each clock tick it does one of four things, in this order of priority:

1. **reset**: go back to 0 (start the program from the beginning);
2. **load**: jump to the address on d;
3. **inc**: count up by one, to the next instruction;
4. otherwise, stay where it is.

Build it from a register that loads on every edge, with a chain of three 16-bit multiplexers choosing what it loads: q or q + 1 (from your INC16), then d, then 0. In a chain of multiplexers the last one decides, so reset goes last, right before the register.

**[Build the PC →](#/play/pc)**

## Fast models for memory

Your fast models from Chapter 2 compute an answer from their inputs. A memory's fast model also has to *remember*: a fast RAM8 keeps its own eight words between clock ticks. The match check is different too. There's no list of every input to try, because the output depends on the past. So the simulator runs your design and the model side by side through 10,000 random clock cycles from power-on, and compares their outputs whenever the model knows its value. Switch your RAM8 to its fast model before you build RAM64 and the circuit drops from about 32,000 gates to under a thousand. When you press **Check**, memory parts you've already passed run as their fast models anyway (each one was compared with its model when it passed); the switch decides what runs live in the editor.

<aside class="summary">

## What you built, and what you learned

**What you built:** an SR latch from two NOR gates; a D latch; a D flip-flop from two latches; a Bit and a 16-bit Register; 4-way and 8-way demultiplexers and an 8-way 16-bit multiplexer; RAM8, RAM64, RAM512 and RAM4K; and the program counter.

**What you learned:**

- Feedback lets a circuit remember: two gates feeding each other hold one bit.
- A latch is transparent while enabled; a flip-flop changes only at a clock edge, which lets a whole computer move in lockstep.
- A flip-flop's input must be steady just before the edge (setup time).
- Memory starts unknown at power-on, and stays unknown until something is stored.
- A register is flip-flops plus a load choice; RAM is registers plus an address, with a demultiplexer to write and a multiplexer to read.
- Bigger RAM repeats the same pattern with a wider address.
- Real memory has been magnetic cores, SRAM (latches) and DRAM (charge on a capacitor, refreshed constantly).
- The program counter holds the next instruction's address: reset, then load, then count.

**Next:** in Chapter 4 we'll design your computer's instructions together, then build a CPU from your ALU, registers and program counter.

</aside>
