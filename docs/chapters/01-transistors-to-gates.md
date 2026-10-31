---
number: 1
title: Transistors to gates
summary: Wire NMOS and PMOS transistors into your first logic gates, NOT, NAND and NOR, and test them.
---

In Chapter 0 you saw that a [[MOSFET]] is a switch controlled by a voltage. In this chapter you'll wire those switches into **[[logic gates|logic-gate]]**, the small circuits every later layer is built from. You'll build three gates yourself, check them against their **[[truth tables|truth-table]]**, and each one you pass becomes a part you can use later.

## Switches can compute

Here is the idea that makes computers possible. In 1937 Claude Shannon showed that circuits of switches obey Boolean algebra[@shannon]:

- Two switches **in series** (one after the other): current gets through only if A **and** B are closed.
- Two switches **in parallel** (side by side): current gets through if A **or** B is closed.

Try it. Each switch is a bit (closed = 1, open = 0), and the lamp is the output:

<switch-network></switch-network>

So **[[series and parallel|series-and-parallel]]** switches compute AND and OR. A transistor is a switch that another *voltage* flips, so a transistor's output can drive the next transistor's gate. Chain them, and you can compute anything.

## Your two switches

You have two kinds of transistor (see Chapter 0 for how they work):

- **[[NMOS]]**: on (conducting) when its gate is **1**.
- **[[PMOS]]**: on when its gate is **0**.

In the editor, each transistor has three pins: the **gate** (the control) and two channel ends, **source** and **drain**. When the transistor is on, its source and drain are connected; when it's off, they aren't. The editor labels every transistor "on" or "off" as you work.

You also have the two supply rails: **VDD**, which is always 1, and **GND** (ground), which is always 0. Every output must end up connected to one of them.

<details class="deeper">
<summary>Go deeper: why PMOS goes near VDD and NMOS near GND</summary>

An NMOS turns on when its gate is at least a threshold voltage *above its source*. If its source sits at GND, a gate at VDD turns it fully on, so an NMOS is good at pulling a wire down to 0. Used to pass a 1, its source rises toward VDD as it conducts, and it switches itself off one threshold short of VDD, giving a weak 1. PMOS is the mirror image: good at passing 1, weak at passing 0. That's why CMOS gates put PMOS transistors between VDD and the output, and NMOS between the output and GND. The simulator in this course treats switches as ideal, but the levels follow this real-world rule.

</details>

## What the simulator shows you

Every wire in the editor carries one of four values, always written on the wire:

- **0** and **1**: the wire is firmly connected to GND or VDD.
- **Z**: the wire is **[[floating]]**: nothing connects it to either rail. Its voltage could be anything, so a real circuit would misbehave.
- **X**: the value is unknown or in conflict, usually because of a **[[short circuit]]**, where switches that are on connect VDD straight to GND.

A working gate never shows Z or X on its output, for any input.

## Your first gate: NOT

A NOT gate (an *inverter*) outputs the opposite of its input. Every CMOS gate has two halves:

- a **[[pull-up network]]** of PMOS transistors that connects the output to VDD (makes it 1);
- a **[[pull-down network]]** of NMOS transistors that connects the output to GND (makes it 0).

For NOT, each network is a single transistor, and both gates are wired to the input. When the input is 0, the PMOS is on and the NMOS is off, so the output is pulled to 1. When the input is 1, it's the other way round.

That is why CMOS uses *complementary* pairs: for every input, exactly one network is on. The output is always driven (never floating), VDD is never connected to GND (no short), and while nothing is switching almost no current flows. That's the low standby power Wanlass and Sah demonstrated in 1963[@cmos].

**[Build NOT →](#/play/not)**

## NAND

NAND ("not and") outputs 0 only when both inputs are 1. Think about the pull-down network first. It should connect the output to GND only when A **and** B are both 1, so its two NMOS transistors go **in series**.

The pull-up network must be on in exactly the other cases: when A is 0 **or** B is 0. So its two PMOS transistors go **in parallel**. The pull-up is always the mirror image of the pull-down: series becomes parallel, and parallel becomes series.

**[Build NAND →](#/play/nand)**

## NOR

NOR ("not or") outputs 1 only when both inputs are 0. Using the mirror rule, you can work it out: the output is pulled down if A **or** B is 1, so the NMOS go in parallel, and the PMOS go in series.

**[Build NOR →](#/play/nor)**

## Why NAND matters

Notice that a single CMOS stage always *inverts*: a 1 on an input can only turn an NMOS on and pull the output toward 0. That's why the natural gates are NOT, NAND and NOR, not AND and OR.

NAND has a remarkable property: it is a **[[universal gate]]**. You can build every other logic function from NANDs alone. For example, NOT is a NAND with both inputs tied together, and AND is a NAND followed by a NOT. NOR is universal too. From Chapter 2 on, you'll build everything (multiplexers, adders, a whole ALU) out of the gates from this chapter, and never touch a single transistor again.

## Two constants

From Chapter 2 on, you can't place bare VDD and GND rails any more: you build only with components. Some circuits still need a fixed 0 or 1 (an adder's first column has no carry coming in, for example). So you'll make two tiny components now: **Constant 0** and **Constant 1**. Each is just one supply rail wired to the output, but once built they become parts like any other.

**[Build Constant 0 →](#/play/zero)** · **[Build Constant 1 →](#/play/one)**

## How checking works

Each level shows its truth table. As you wire, the table updates live: each row says whether your circuit's output matches. Click a row to set those inputs on the canvas.

When you press **Check**, every row is tested. If something's wrong, you'll see which row fails and why. The message says whether the output was wrong, floating or shorted, and names the parts involved. Click the message to jump to that row with those parts marked. When every row passes, the gate unlocks and appears in your toolbox for the levels that follow.

If you later change a gate you've already passed, everything built on it is re-checked. If a change breaks something, the level map marks it "broken" so you know where to look.

<aside class="summary">

## What you built, and what you learned

**What you built:** a NOT gate (2 transistors), a NAND gate (4) and a NOR gate (4), each tested against its truth table, plus the constants 0 and 1.

**What you learned:**

- Switches in series compute AND; switches in parallel compute OR.
- An NMOS is on when its gate is 1, a PMOS when its gate is 0.
- A CMOS gate has a PMOS pull-up network and an NMOS pull-down network that are mirror images, so exactly one is on for any input: the output is never floating and never shorted.
- A single CMOS stage inverts, so NOT, NAND and NOR are the natural gates.
- NAND (and NOR) are universal: every other logic function can be built from them.

**Next:** in Chapter 2 you'll stop thinking about transistors and build with gates: AND, OR, XOR, multiplexers, adders, and 16-bit buses. Once you've built AND from your NAND and NOT, double-click a NAND part to look inside it and watch your own transistors at work.

</aside>
