---
number: 0
title: From sand to switch
summary: What a computer is, how people computed before electronics, and how a grain of sand becomes the switch that every computer is built from.
---

This course ends with you playing Tetris on a computer you built yourself, layer by layer. Before you build anything, this chapter answers two questions. What exactly is a computer? And why are computers made of silicon switches?

You won't wire anything yet. Instead you'll meet the ideas and the history behind every later chapter, and you'll play with the physics of the switch you'll use from Chapter 1 onward.

## What is a computer?

A [[computer]] is a machine that does four things:

1. **[[Input]]**: it takes in information (key presses, a photo, a temperature reading).
2. **[[Memory]]**: it holds that information, and its results, for later.
3. **Processing**: it changes the information by following instructions: adding, comparing, choosing.
4. **[[Output]]**: it gives back results (pixels, sound, a number).

A pocket calculator does all four, but it can only ever do the jobs it was built for. What makes the machines in your phone and laptop special is that they are [[general-purpose]]. The same hardware can edit a video, play chess or run Tetris, depending only on the [[program]] it is given. A program is just a list of instructions, an [[algorithm]] written down precisely enough that a machine can follow it without understanding it.

One more idea makes modern computers what they are. The program is stored in the same memory as the data. To the machine, instructions are just more numbers. Loading a new program is as easy as loading a new file, and a program can even produce another program (that is what a compiler does, and you will write one in Chapter 6). This is the **[[stored-program|stored-program]]** idea, and you'll see where it came from later in this chapter.

## Computing before electricity

People were building tools to help them count and calculate long before electricity. Each tool kept a piece of the job (remembering, calculating, following a plan) outside the human head.

**Tally marks.** The Lebombo bone, a baboon bone from southern Africa about 43,000 years old, carries 29 notches[@lebombo-bone]. The Ishango bone from central Africa, roughly 20,000 years old, has groups of notches that some researchers read as counting or even simple arithmetic[@ishango-bone]. Both readings are contested. The marks might be a calendar, a tally, or something else entirely. But they show how old the idea of storing a count outside your head is.

**The abacus.** Counting boards and abacuses let people do arithmetic by moving pebbles or beads. Where the abacus began is unknown: Mesopotamia is often suggested, but the evidence is thin, and dates in different sources disagree[@abacus]. What matters for us is that an abacus is *memory with a fixed layout*: each column stands for a place value.

**The Antikythera mechanism.** Sponge divers recovered corroded bronze gears from an ancient Greek shipwreck off the island of Antikythera. Reconstructed, they form a hand-cranked machine that modelled the motions of the Sun, Moon and planets and predicted eclipses[@antikythera]. It must be older than the wreck (about 60 BCE). Most estimates put it in the 2nd century BCE, but the exact date is debated. It is an **[[analog]]** computer: gear ratios stand for astronomical cycles.

**Logarithms and the slide rule.** In 1614 John Napier published [[logarithms|logarithm]], which turn multiplication into addition[@napier-logarithms]. In 1620 Edmund Gunter drew a logarithmic scale on a ruler. Within about a decade, sliding two such scales against each other gave the [[slide rule]][@slide-rule]. Who exactly invented it, and when, is shared between William Oughtred and others, and sources give different dates.

**Gear calculators.** Starting in 1642, Blaise Pascal built the Pascaline, a gear-driven adding machine. Turning one wheel past 9 nudges the next wheel on by one, which is a mechanical *carry*[@pascaline]. In 1672 Gottfried Leibniz began designing his stepped reckoner, which could also multiply and divide[@leibniz-stepped-reckoner]. You'll build your own carry in Chapter 2, out of logic gates instead of gear teeth.

**Programs on cards.** Around 1804, Joseph-Marie Jacquard built a loom attachment controlled by chains of [[punched cards|punched-card]]. Each hole decided whether a thread was lifted, so changing the cards changed the woven pattern without changing the loom[@jacquard]. That is the first big step toward a *program*: the instructions became separate from the machine.

**Babbage and Lovelace.** In 1822 Charles Babbage showed a small model of his Difference Engine, a machine to calculate mathematical tables without human error. He never finished the full machine; working engines were built from his plans much later by the Science Museum in London[@babbage-difference-engine]. In the 1830s he designed something far bolder: the Analytical Engine. It had a *store* (memory) and a *mill* (processor), and it was to be programmed with punched cards borrowed from Jacquard's loom[@babbage-analytical-engine]. It was never built, but it was a [[general-purpose]] computer on paper.

In 1843 Ada Lovelace published long notes on the Analytical Engine. Her Note G sets out, step by step, how the engine could compute a sequence called the Bernoulli numbers, and she argued that such a machine could work with symbols of any kind, not only numbers[@lovelace-notes]. She is often called the first programmer. Historians debate that title: Babbage had written earlier example programs, and it is unclear how much of Note G each of them wrote. Her insight that a computing machine could handle more than arithmetic is not in dispute.

**Machines that read cards with electricity.** The 1880 United States census took years to tabulate by hand. For the 1890 census, Herman Hollerith's machines read punched cards electrically: wherever there was a hole, a pin passed through and dipped into a cup of mercury, closing a circuit that advanced a counter[@hollerith]. This is the first appearance in our story of a *switch*, controlled by information, driving a computation.

**A room-sized analog computer.** By 1931 Vannevar Bush's differential analyzer at MIT was solving differential equations, the mathematics of anything that changes smoothly, using shafts, gears and spinning wheel-and-disc integrators[@differential-analyzer]. Setting up a new problem meant physically reconnecting the shafts.

## Analog and digital

Two very different ways of computing appear in that history.

An **[[analog]]** machine represents a number with something that can vary smoothly: an angle, a length, a [[voltage]]. The slide rule, the Antikythera mechanism and the differential analyzer all work this way. Analog machines can be fast and elegant. Their weakness is that every imperfection becomes an error. A slightly worn gear, a warm shaft or a bit of electrical [[noise]] changes the answer, and the errors pile up step after step.

A **[[digital]]** machine represents information with a small set of distinct values, usually just two, written 0 and 1. A single 0-or-1 value is a **[[bit]]**. The abacus is digital: a bead is either up or down, never "a bit up". The great advantage is that small errors can be *corrected*. If a value should be 0 or 1 and you see 0.97, you know it was meant to be 1. You can snap it back and pass a clean 1 along.

That snapping back, called *restoration*, is why every computer in this course is digital. At the end of this chapter you'll see it happen in an interactive demo.

## The theory: logic, machines and switches

Four ideas from the mathematics and engineering of the 1800s and 1900s explain why a computer can be built from nothing but switches.

**Boole: logic is algebra.** In 1847 and 1854 George Boole showed that reasoning with true and false can be written as algebra[@boole]. In [[Boolean algebra|boolean-algebra]], every value is 1 (true) or 0 (false), and you combine values with AND, OR and NOT. Any statement like "the alarm rings if the door is open AND the system is armed" becomes an equation.

**Turing: what can be computed at all.** In 1936 Alan Turing imagined a machine that reads and writes symbols on a tape, following a short table of rules[@turing]. He argued that this [[Turing machine|turing-machine]] can carry out any step-by-step procedure, and he described a *universal* machine that can imitate any other, if it is given the other's rules as data. That is a program stored as data, on paper, a decade before anyone built one.

**Shannon: logic is switches.** In his 1937 master's thesis, Claude Shannon showed that circuits of [[switches|switch]] obey Boolean algebra[@shannon]. Two switches in series form an AND: current flows only if both are closed. Two switches in parallel form an OR. So any logical function can be built from switches, and switch circuits can be simplified with algebra. Chapter 1 builds exactly this: switches into [[logic gates|logic-gate]].

**von Neumann: keep the program in memory.** In June 1945 John von Neumann wrote a report describing a computer that keeps its program in the same memory as its data[@von-neumann-edvac]. Almost every computer since has worked this way, including the one you'll build in Chapter 4. Only his name was on the report, but the ideas grew out of discussions with J. Presper Eckert, John Mauchly and others who were building the ENIAC computer, and how to share the credit is still debated.

## Switches through history

If a computer is just switches controlling switches, then a better switch means a better computer. A better switch is smaller (more of them fit), faster (more steps per second), more reliable, and uses less power. Here are the switches people have used:

- **Gears** (Pascaline to the differential analyzer): reliable but slow, and they wear out.
- **[[Relays|relay]]**: an electromagnet pulls a metal contact open or closed. The Harvard Mark I, working in 1944, used relays, switches and rotating shafts[@harvard-mark-i]. Relays click audibly and switch at most a few hundred times a second[@switch-scales].
- **[[Vacuum tubes|vacuum-tube]]**: a voltage on a wire grid inside a glass tube controls a stream of electrons through a vacuum. There are no moving parts, so they switch thousands of times faster than relays[@switch-scales]. ENIAC, completed in 1945, used 17,468 of them[@eniac]. Tubes are big and hot, burn out like light bulbs, and use a lot of power.
- **[[Transistors|transistor]]**: a switch made from a solid crystal. A transistor has no moving parts, no vacuum and no hot filament. Today's are so small that billions fit on a fingernail-sized chip.

<switch-timeline></switch-timeline>

The sizes and speeds in this demo are rough orders of magnitude for comparison, not measurements[@switch-scales]. Even so, the pattern is real: each generation of switch is smaller and much faster than the one before.

## 1947: the transistor, and why germanium came first

On 16 December 1947, at Bell Labs, John Bardeen and Walter Brattain pressed two gold contacts onto a slab of **[[germanium]]**. A small signal on one contact controlled a much bigger current through the other, amplifying the signal up to 100 times. They showed it to Bell Labs management on 23 December, in William Shockley's group, and Bell Labs announced the "transistor" to the world on 30 June 1948[@point-contact-transistor].

Germanium and silicon are both **[[semiconductors|semiconductor]]**: materials whose ability to conduct sits between a metal and an insulator, and can be controlled. Germanium came first for a practical reason: in the 1940s it was easier to purify to the extreme level transistors need[@germanium-vs-silicon].

Germanium lost, for three reasons:

1. **It leaks when warm.** To conduct, an electron needs a certain energy to break free, called the **[[band gap]]**. Germanium's gap (about 0.66 eV) is much smaller than silicon's (about 1.1 eV), so ordinary heat frees far more electrons in germanium. A germanium switch that should be off lets a [[leakage current]] through, and that leak grows quickly as the device warms up[@germanium-vs-silicon].
2. **It has no useful oxide.** Silicon grows a tough, stable skin of **[[silicon dioxide]]**, an excellent insulator. Germanium's oxide dissolves in water and is unstable[@germanium-oxide]. As you'll see below, the modern transistor is built around that insulating oxide layer.
3. **Supply.** Silicon is the second most common element in Earth's crust; germanium is scarce, and is mostly recovered as a by-product of zinc mining[@silicon-abundance]. Once silicon could be purified well enough, it was the obvious long-term choice.

## Silicon takes over

Once silicon could be purified and grown into perfect crystals, the pieces of the modern chip arrived one after another.

| When | What happened |
|---|---|
| 1954 | Morris Tanenbaum at Bell Labs made the first silicon transistor in January. Texas Instruments, with Gordon Teal, built and sold the first commercial ones and announced them in May[@silicon-transistor-1954]. |
| 1958–59 | Jack Kilby at Texas Instruments demonstrated the first **[[integrated circuit]]**, made of germanium, in September 1958. In 1959 Robert Noyce at Fairchild conceived a silicon integrated circuit built with Jean Hoerni's planar process, the approach the whole industry adopted[@integrated-circuit]. |
| 1959–60 | Mohamed (John) Atalla and Dawon Kahng at Bell Labs built the first working **[[MOSFET]]**, the transistor in almost every chip today. It depends on silicon's stable oxide[@mosfet]. |
| 1963 | Frank Wanlass and Chih-Tang Sah at Fairchild showed that pairing two kinds of MOSFET, **[[CMOS]]**, makes logic that uses almost no power while idle[@cmos]. |
| 1965 | Gordon Moore observed that the number of components on a chip was doubling every year; in 1975 he revised it to every two years. This became known as **[[Moore's law\|moores-law]]**[@moores-law]. |
| 1971 | The Intel 4004 put a whole [[processor]] on one chip, the first commercial **[[microprocessor]]**: about 2,300 transistors running at about 740 kHz[@intel-4004]. |

Two notes on credit. The "first silicon transistor" is often credited to Texas Instruments, but Bell Labs' January 1954 device came first; it just wasn't publicized. The integrated circuit is usually credited to both Kilby and Noyce, who worked independently. Kilby received the 2000 Nobel Prize in Physics; Noyce had died in 1990[@integrated-circuit].

A popular myth says Moore predicted doubling "every 18 months". He didn't: his figures were one year (1965) and two years (1975)[@moores-law].

## From sand to wafer

Every chip starts as sand, or more precisely, as quartz, which is **[[silicon dioxide]]**. Silicon is everywhere in rock, but always bonded to oxygen, and a chip needs it almost perfectly pure and perfectly ordered. Getting there takes six steps:

<wafer-flow></wafer-flow>

1. **Arc furnace.** Quartz and carbon are heated in an electric arc furnace to about 1900 °C or more. Carbon pulls the oxygen away, leaving metallurgical-grade silicon, about 98–99% pure[@mg-silicon]. That's pure enough for steel-making, but not for chips.
2. **Turn it into a liquid and distil it.** The silicon reacts with hydrogen chloride to form trichlorosilane, a liquid that can be purified by distillation, like making very pure alcohol.
3. **Siemens process.** The purified trichlorosilane is decomposed onto hot silicon rods (about 1100 °C), building up electronic-grade **[[polysilicon]]** that is purer than 99.99999%[@siemens-process].
4. **Grow one crystal.** In the **[[Czochralski process|czochralski-process]]**, the polysilicon is melted in a quartz crucible above 1400 °C. A small seed crystal touches the melt and is slowly pulled upward while turning, and the atoms line up with the seed. The result is a **[[single crystal]]**: one unbroken, regular arrangement of atoms in an ingot you can hold. Jan Czochralski discovered the method in 1916, and Bell Labs adapted it in 1948 to grow germanium crystals for transistors[@czochralski].
5. **Slice.** The ingot is sawn into thin discs.
6. **Polish.** The discs are polished mirror-smooth. Each is a **[[wafer]]**, and many chips will be built on it at once.

## Doping: making silicon conduct on purpose

Pure silicon is a poor conductor. Each silicon atom shares its four outer [[electrons|electron]] with four neighbours, so every electron is busy holding the crystal together and almost none are free to carry a [[current]].

**[[Doping]]** changes that by adding a tiny, controlled amount of another element, a **[[dopant]]**:

- Add a little **phosphorus**, which has five outer electrons. Four bond with silicon neighbours; the fifth is spare and free to move. Silicon with extra free electrons is **[[n-type]]** (n for negative).
- Add a little **boron**, which has only three. One bond is left with a gap, a missing electron called a **[[hole]]**. A neighbouring electron can hop into the hole, which moves the hole the other way, so holes travel through the crystal like positive charges. Silicon with extra holes is **[[p-type]]** (p for positive).

"A little" means very little: typically one dopant atom per many thousands or millions of silicon atoms. That is why the purification steps above matter so much. Unwanted impurities would act as dopants nobody asked for.

## The p-n junction

Put p-type and n-type silicon side by side, and something useful happens at the boundary, the **[[p-n junction]]**.

Near the boundary, free electrons from the n side wander over and fill holes on the p side. Each time they meet, both disappear as free carriers. This leaves a thin zone with no free carriers at all, the **[[depletion region]]**. Nothing in that zone can carry current, so it acts like an insulating wall. The wall doesn't grow forever: the charged atoms left behind create an electric field that pushes back.

Now apply a voltage across the junction:

- **[[Forward bias]]** (positive to the p side): the wall shrinks. Past about 0.6 volts for silicon, it effectively collapses, and current flows freely.
- **[[Reverse bias]]** (positive to the n side): the wall grows wider. Almost no current flows.

A device that conducts one way but not the other is a **[[diode]]**. Try it:

<pn-junction></pn-junction>

<details class="deeper">
<summary>Go deeper: the diode equation</summary>

The current through an ideal junction is I = I<sub>s</sub>(e<sup>V/V<sub>T</sub></sup> − 1). Here I<sub>s</sub> is a tiny "saturation" current, and V<sub>T</sub> ≈ 26 mV is the thermal voltage at room temperature. The exponential is why the curve looks flat and then shoots up: every extra 60 mV of forward bias multiplies the current by about ten. The demo uses this equation with typical values. A real diode departs from it at very high currents and under strong reverse bias.

</details>

## The MOSFET: a switch made of silicon

Junctions are the building blocks of the transistor you'll use for the rest of the course, the **[[MOSFET]]** (metal-oxide-semiconductor field-effect transistor). Here is how one is made:

- Start with p-type silicon, called the *body*.
- Dope two small islands heavily n-type. These are the **[[source and drain|source-and-drain]]**, the two ends of the switch.
- Between them, grow a very thin layer of [[silicon dioxide]] (the oxide), and lay a conductor on top. That conductor is the **[[gate|gate-terminal]]**.

With the gate at 0 V, there are two back-to-back p-n junctions between source and drain, so no current flows. The switch is **off**.

Raise the gate voltage, and its electric field reaches through the oxide (no current crosses the insulator). It pushes holes away from the surface and pulls electrons toward it. Past a certain gate voltage, the **[[threshold voltage]]**, enough electrons gather under the oxide to form a thin n-type **[[channel]]** that connects source to drain. Now current flows. The switch is **on**.

That is an **[[NMOS]]** transistor: on when the gate is high. Build the mirror image (an n-type body, p-type source and drain, and a channel made of holes) and you get a **[[PMOS]]** transistor, which is on when the gate is **low**. Switch between them in the demo:

<mosfet-demo></mosfet-demo>

Notice two things in the demo. First, nothing moves except electric charge, so a MOSFET can switch billions of times a second. Second, look at the current graph: its vertical scale is logarithmic. Between off and on, the current changes by more than a million times. A switch with that much contrast between on and off is exactly what digital logic needs.

Why have two kinds? In Chapter 1 you'll pair an NMOS and a PMOS so that whatever the input, one of them is off. Then no current path runs from the supply to ground while the circuit sits still. That is **[[CMOS]]**, and it's why your phone doesn't melt in your pocket[@cmos].

<details class="deeper">
<summary>Go deeper: how much current?</summary>

Above threshold, a MOSFET in saturation passes roughly I ≈ ½k(V<sub>GS</sub> − V<sub>th</sub>)<sup>2</sup>, where k depends on the transistor's size and materials. Below threshold, the current doesn't drop to exactly zero. It falls exponentially, about ten times for every 90 mV or so at room temperature. That is the "subthreshold leakage" on the left of the graph. The demo blends these two regions with a standard smooth formula (the EKV model) and uses a 3 V supply and a 0.7 V threshold. Those values are chosen to make the shape clear, not to match a particular chip.

</details>

## Bits as voltages: noise margins

A wire on a chip carries a [[voltage]]. To turn it into a [[bit]], we agree on ranges, called **[[logic levels|logic-level]]**: anything near 0 V means 0, anything near the supply voltage means 1. The zone in between is unreliable, and good circuits never leave a signal there.

Real wires pick up **[[noise]]**: a little random wobble from heat, from neighbouring wires, from the power supply. The question is what happens when a signal passes through many circuits, one after another, each adding its own wobble.

- If each stage just copies its input (an *analog* chain), the wobbles add up. After enough stages, a 1 can drift into the unreliable zone, or all the way down to look like a 0.
- If each stage is a digital circuit, its **[[transfer curve]]** (output against input) has a steep S-shape. An input of 0.9 V comes out as almost exactly 1 V. Each stage *restores* the signal before passing it on, so the noise never gets the chance to add up.

How much noise a valid signal can take and still be read correctly by the next stage is the **[[noise margin]]**. Try sending a bit down a chain, and push the noise up until the analog chain starts making mistakes:

<noise-chain></noise-chain>

This is the payoff of the whole chapter. Because transistors make switches with a huge contrast between on and off, we can build stages with a steep S-curve. Because of the S-curve, signals are restored at every step. And because signals are restored, you can chain together billions of transistors and still get exactly the right answer, every time.

<aside class="summary">

## What you built, and what you learned

**What you built:** nothing yet, on purpose. You explored the switch you'll build with: you biased a p-n junction, opened and closed a MOSFET's channel, and sent bits through noisy chains.

**What you learned:**

- A computer takes input, keeps it in memory, processes it by following a program, and produces output. Modern computers are general-purpose and keep their program in memory.
- People computed for thousands of years with tallies, beads, gears and cards. The key ideas of programs, memory and processors came long before electronics.
- Digital beats analog for building big machines because digital signals can be restored at every step.
- Boole turned logic into algebra, and Shannon showed that switches can compute that algebra. So a computer can be built from nothing but switches.
- Switches went from gears to relays to vacuum tubes to transistors. Silicon beat germanium because it leaks less when warm, grows a stable oxide, and is abundant.
- Sand becomes a wafer through reduction, chemical purification, crystal growth and slicing. Doping makes n-type and p-type silicon, and a p-n junction conducts in one direction only.
- A MOSFET is a voltage-controlled switch. NMOS turns on with a high gate, PMOS with a low gate.

**Next:** in Chapter 1 you'll wire NMOS and PMOS transistors into your first logic gates, NOT, NAND and NOR, and test them.

</aside>
