---
number: 2
title: Combinational logic
summary: Build with gates instead of transistors. Choose between signals, carry 16-bit numbers on buses, and add them.
---

In Chapter 1 every wire carried one bit, and you built from transistors. Now you'll build with the gates you made: AND, OR and XOR first, then circuits that **choose** between signals, carry whole **numbers** on bundles of wires, and **add** them. Every circuit in this chapter is *combinational*: its outputs depend only on its inputs right now, with no memory. Memory comes in Chapter 3.

## Building with gates

Once your NAND passed every row of its truth table, you proved something useful: whatever happens inside it, it behaves exactly like the table. From now on the simulator treats each of your Layer 1 gates as a single block that looks up its answer in that table, instead of simulating its four transistors. This is **[[abstraction]]**: using a thing by *what it does*, not *how it does it*. You can still double-click a gate to look inside and see your transistors at work.

The simulator also counts time. Each gate takes one step, a **[[gate delay]]**, to update its output after its inputs change. The editor shows how many steps a circuit takes to settle. Keep an eye on that number: it's how fast your computer will be able to run.

## AND, OR and XOR

- **AND** is a NAND followed by a NOT.
- **OR** is 1 unless both inputs are 0. Invert both inputs and feed them to a NAND: the NAND outputs 0 only when both inverted inputs are 1, which happens only when both original inputs are 0.
- **XOR** ("exclusive or") is 1 when the inputs *differ*: "a OR b, but NOT both".

**[Build AND →](#/play/and)** · **[OR →](#/play/or)** · **[XOR →](#/play/xor)**

## Choosing: multiplexers

A **[[multiplexer]]** (MUX) is a switch for data. It has two data inputs, a and b, and a **select** input, sel. When sel is 0 the output copies a; when sel is 1 it copies b. You build it from the rule "let a through only when sel is 0, let b through only when sel is 1, and combine the two".

A **[[demultiplexer]]** (DMUX) does the opposite: it sends one input to output a or output b, depending on sel.

Your CPU will be full of these. A multiplexer picks which register to read, or whether the next instruction comes from the next address or from a jump.

**[Build MUX →](#/play/mux)** · **[DMUX →](#/play/dmux)**

## Numbers on buses

To carry a number you need several wires, one per [[bit]] of its [[binary]] form. Thirteen is `1101` in binary (8 + 4 + 0 + 1), so it needs four wires. A bundle of wires carrying one number is a **[[bus]]**. In the editor a bus is one thick blue wire labelled with its number. The computer you'll build uses 16-bit buses, enough for numbers from 0 to 65,535.

Two tools work with buses:

- **[[Splitters and joiners|splitter-and-joiner]]**: a splitter separates a bus into its single-bit wires, numbered from bit 0 (the ones digit) upwards; a joiner gathers single bits back into a bus.
- **Repeat ×N**: select a component and set *Repeat* to 16, and it becomes 16 copies side by side. Copy *i* reads bit *i* of each bus input and drives bit *i* of each bus output. A 16-bit NOT is a single NOT repeated 16 times. If every copy needs the same signal (a 16-bit multiplexer's one select bit), tick **share** for that input.

You can't test a 16-bit circuit on every input: two 16-bit inputs make over four billion combinations. So these levels check a few chosen rows, then 2,000 random inputs against a built-in reference model, and tell you how many failed.

**[Build NOT16 →](#/play/not16)** · **[AND16 →](#/play/and16)** · **[OR16 →](#/play/or16)** · **[MUX16 →](#/play/mux16)** · **[OR8WAY →](#/play/or8way)** · **[4-way MUX16 →](#/play/mux4way16)**

## Adding

Adding binary numbers works like adding by hand, column by column, except every digit is 0 or 1. 1 + 1 = 2, which is `10` in binary: write 0, carry 1.

- A **[[half adder]]** adds two bits. It has two outputs: the **sum** (the ones digit) and the **[[carry]]** (the twos digit). Compare their truth tables with XOR and AND.
- A **[[full adder]]** adds three bits: two digits plus the carry coming in from the column to the right. That's one complete column of written addition. You can build it from two half adders and an OR.
- **ADD16** chains 16 full adders, each column's carry feeding the next. The first column gets a carry of 0 from your *Constant 0*.

**[Half adder →](#/play/halfadder)** · **[Full adder →](#/play/fulladder)** · **[ADD16 →](#/play/add16)** · **[INC16 →](#/play/inc16)**

## Why this adder is slow

An adder built as a chain like this is a **[[ripple-carry adder]]**. Its weakness is the chain itself. The top column can't finish until it knows its carry, which waits on the column below, which waits on the one below that, and so on. Try it:

<ripple-adder></ripple-adder>

Two things stand out:

1. **The worst case is slow.** For 255 + 1, a carry is born in the first column and has to travel through every other column.
2. **Even "no carry" has to ripple.** For 255 + 0 no carry ever happens, yet the adder still takes the full 8 steps. Each column can only *know* there's no carry by waiting for the column before it.

The simulator shows the same thing on your ADD16. Adding 2 + 1 settles after about a dozen gate delays, but 0xffff + 1 takes 64, against just 2 for a 16-bit AND. A circuit's speed is set by its slowest path. Faster adders exist: a *carry-lookahead* adder works out many carries at once, using more gates to save time. For this course, ripple-carry is plenty.

## Negative numbers

Your ADD16 drops any carry out of the top column, so 0xffff + 1 = 0. That isn't a bug; it's the key to negative numbers. If adding 1 to 0xffff gives 0, then 0xffff behaves exactly like −1.

This is **[[two's complement|twos-complement]]**, the way almost every computer stores negative numbers. To negate x, invert every bit and add 1. With 16 bits, the patterns 0x8000 to 0xffff stand for −32,768 to −1, and the top bit tells you the sign. The same adder handles positive and negative numbers with no changes, and *a − b* becomes *a + NOT b + 1*. You'll use exactly that when we design the ALU.

<details class="deeper">
<summary>Go deeper: why "invert and add 1" works</summary>

For a 16-bit number x, x + NOT x = 0xffff, because every column adds a 1 and a 0. So x + NOT x + 1 = 0x10000, and the 17th bit is dropped, leaving 0. A number that gives 0 when added to x is exactly −x, so NOT x + 1 = −x.

</details>

## The ALU

Everything in this chapter comes together in the **[[ALU|alu]]** (arithmetic logic unit), the part of the CPU that calculates. Its operations decide what your computer can compute, so we designed it together. It takes two 16-bit numbers, a and b, and a few control inputs:

1. **invb** flips every bit of b first. An XOR with 1 inverts a bit and an XOR with 0 leaves it alone, so this is your XOR repeated 16 times, with invb shared.
2. **f** (2 bits) chooses the result: 0 = ADD, 1 = AND, 2 = OR, 3 = XOR. The adder also takes a carry in, **cin**.
3. Three **[[flags]]** describe the result: **z** (it's zero), **n** (it's negative: its top bit is 1), and **c** (the adder carried out of the top column; always 0 for AND, OR and XOR).

Those few controls cover a lot:

| You want | f | invb | cin | Because |
|---|---|---|---|---|
| a + b | ADD | 0 | 0 | plain addition |
| a − b | ADD | 1 | 1 | a + NOT b + 1, two's complement |
| a + 1 | ADD | 0 | 1 | with b = 0 |
| a − 1 | ADD | 1 | 0 | with b = 0: adds 0xffff, which is −1 |
| a AND NOT b | AND | 1 | – | clears the bits that are set in b |
| NOT a | XOR | 1 | – | with b = 0: XOR with all ones |

The flags are how a program makes decisions. Subtract b from a and look at z: if it's 1, a and b were equal. Look at c: after a − b it's 1 exactly when a ≥ b (for unsigned numbers). In Chapter 4 your CPU will use these flags to choose whether to jump.

You'll need two helpers first: **XOR16**, and a 16-bit adder that brings out both ends of its carry chain. The ALU is the biggest circuit so far: built from your own gates it's about a thousand gates and over 80 gate delays deep, which is a good moment to try fast models (below).

**[XOR16 →](#/play/xor16)** · **[ADD16 with carry →](#/play/addc16)** · **[ALU →](#/play/alu)**

## Fast models: trusting what you've built

Your ADD16 is 305 gates. Your CPU will contain several adders and many more parts, and simulating every gate of every one adds up. So once a component has passed, you can switch it to a **[[fast model]]**: a built-in version that computes the same answer in one step.

The switch is never automatic. On the level map, each passed component has a **Runs as** button. Before swapping, the simulator compares your design with the fast model: on every possible input when there are 16 input bits or fewer (65,536 cases for NOT16), otherwise on 10,000 random inputs. If they disagree anywhere it checked, the swap is refused and you're shown an example. And if you later edit a component, it goes back to running as your design until you check it again.

<aside class="summary">

## What you built, and what you learned

**What you built:** AND, OR and XOR from your NAND and NOT; a multiplexer and a demultiplexer; 16-bit NOT, AND, OR and MUX; an 8-way OR; a 4-way 16-bit multiplexer; a half adder, a full adder, a 16-bit adder and an incrementer; and the ALU, with its zero, negative and carry flags.

**What you learned:**

- Once a component is proven correct, you can use it by what it does: that's abstraction.
- Multiplexers choose between signals; demultiplexers route one signal to one of several places.
- A bus is a bundle of wires carrying a number in binary; Repeat applies one component to every bit.
- A full adder is one column of written addition; chaining them makes a ripple-carry adder.
- A circuit's speed is set by its longest path, and a ripple-carry adder's carry may have to cross every column.
- With two's complement, the same adder handles negative numbers, and subtraction is a + NOT b + 1.
- A fast model can replace your design only after a match check shows they agree.

- The ALU computes with a few control inputs, and its flags (zero, negative, carry) let a program compare numbers.

**Next:** in Chapter 3 you'll give your circuits memory: latches, flip-flops, registers and RAM.

</aside>
