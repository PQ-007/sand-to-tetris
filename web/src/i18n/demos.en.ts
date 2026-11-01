// English text of the chapter demos (merged into en.ts).
import type { Messages } from "./en";

export const demosEn = {
  "kit.wide": "Diagram (scroll sideways on small screens)",

  // ---- switch timeline ----
  "sw.caption": "Switches through time",
  "sw.captionText":
    "Pick a switch to see its rough size and speed. Both scales are logarithmic: each step along an axis is 100 or 1,000 times bigger than the last.",
  "sw.choose": "Choose a switch",
  "sw.sizeAxis": "Size of one switch",
  "sw.timeAxis": "Time to flip once",
  "sw.compareWith": "Compare with ",
  "sw.plotLabel": "{name}: size {size}, switching time {time}",
  "sw.example": "Example: {example}. Size {size}, flips in {time}.",
  "sw.pickOther": "Pick a different switch to compare.",
  "sw.compare": "A {a} is {size} and {speed} than a {b}.",
  "sw.same": "about the same",
  "sw.times": "about {n} times",
  "sw.longer": "{ratio} longer",
  "sw.shorter": "{ratio} shorter",
  "sw.slower": "{ratio} slower",
  "sw.faster": "{ratio} faster",
  "sw.thousand": "a thousand",
  "sw.million": "a million",
  "sw.billion": "a billion",
  "sw.trillion": "a trillion",
  "sw.gear.era": "1640s–1940s",
  "sw.gear.name": "Gear",
  "sw.gear.example": "Pascaline, differential analyzer",
  "sw.gear.how":
    "A toothed wheel turns one step. Carrying a digit means one wheel nudging the next.",
  "sw.relay.era": "1930s–1940s",
  "sw.relay.name": "Relay",
  "sw.relay.example": "Harvard Mark I",
  "sw.relay.how":
    "An electromagnet pulls a metal arm, closing or opening a contact.",
  "sw.tube.era": "1940s–1950s",
  "sw.tube.name": "Vacuum tube",
  "sw.tube.example": "ENIAC",
  "sw.tube.how":
    "A voltage on a wire mesh (the grid) lets electrons flow across a vacuum, or blocks them.",
  "sw.transistor-1947.era": "1947",
  "sw.transistor-1947.name": "First transistor",
  "sw.transistor-1947.example": "Bell Labs point-contact transistor",
  "sw.transistor-1947.how":
    "Two gold contacts on germanium: current into one controls the current through the other.",
  "sw.transistor-1971.era": "1971",
  "sw.transistor-1971.name": "Transistor on a chip",
  "sw.transistor-1971.example": "Intel 4004",
  "sw.transistor-1971.how":
    "A MOSFET: voltage on the gate creates or removes a conducting channel in silicon.",
  "sw.transistor-today.era": "2020s",
  "sw.transistor-today.name": "Transistor today",
  "sw.transistor-today.example": "A phone or laptop processor",
  "sw.transistor-today.how":
    "The same MOSFET idea, shrunk until billions fit on a chip the size of a fingernail.",

  // ---- sand to wafer ----
  "wafer.caption": "From sand to wafer",
  "wafer.captionText":
    "Six steps turn quartz into a disc of nearly perfect crystal. Select a step.",
  "wafer.prev": "← Previous step",
  "wafer.next": "Next step →",
  "wafer.step": "Step {n}: {title}",
  "wafer.temperature": "Temperature: {t}",
  "wafer.purity": "Purity",
  "wafer.purityText": "≈ {pct}% silicon: about 1 stray atom in {ratio}",
  "wafer.source": "Source",
  "wafer.sand.title": "Quartz sand",
  "wafer.sand.what": "Silicon dioxide (SiO₂): silicon locked up with oxygen.",
  "wafer.sand.detail":
    "Ordinary beach sand is too impure; industry uses high-purity quartz. Silicon is everywhere in rocks, but always bonded to oxygen.",
  "wafer.furnace.title": "Arc furnace",
  "wafer.furnace.what": "Carbon pulls the oxygen off the silicon.",
  "wafer.furnace.detail":
    "Quartz and carbon are heated by an electric arc. The carbon grabs the oxygen (leaving as carbon monoxide), and liquid silicon collects at the bottom: metallurgical-grade silicon.",
  "wafer.furnace.temperature": "≈ 1900 °C or more",
  "wafer.trichlorosilane.title": "Make a liquid, then distil it",
  "wafer.trichlorosilane.what":
    "Silicon becomes trichlorosilane (SiHCl₃), which can be distilled.",
  "wafer.trichlorosilane.detail":
    "Reacting the silicon with hydrogen chloride turns it into a liquid. Liquids can be purified by distillation, like making very pure alcohol, which removes most remaining impurities.",
  "wafer.siemens.title": "Siemens process",
  "wafer.siemens.what": "Pure silicon is deposited back out as polysilicon.",
  "wafer.siemens.detail":
    "The purified trichlorosilane is decomposed onto hot silicon rods. Silicon builds up layer by layer into electronic-grade polysilicon: many small crystals, but extremely pure.",
  "wafer.siemens.temperature": "≈ 1100 °C (the rods)",
  "wafer.czochralski.title": "Grow one crystal",
  "wafer.czochralski.what":
    "A seed crystal is pulled slowly from melted silicon.",
  "wafer.czochralski.detail":
    "The polysilicon is melted in a quartz crucible, with a carefully measured trace of dopant if the wafer should be p-type or n-type. A tiny seed crystal touches the melt and is slowly pulled up while turning. Atoms line up with the seed, so the whole ingot becomes one single crystal.",
  "wafer.czochralski.temperature":
    "above 1400 °C (silicon melts at about 1414 °C)",
  "wafer.slice.title": "Slice and polish",
  "wafer.slice.what":
    "The ingot is sawn into thin discs and polished mirror-smooth.",
  "wafer.slice.detail":
    "Wire saws cut the ingot into wafers less than a millimetre thick. Grinding, etching and polishing leave a surface flat enough to print features far smaller than a bacterium.",

  // ---- p-n junction ----
  "pn.caption": "Inside a p-n junction",
  "pn.captionHtml":
    "p-type silicon (left) has spare <em>holes</em> (+); n-type (right) has spare <em>electrons</em> (−). Where they meet, they cancel out and leave a thin <em>depletion region</em> with no free carriers. Change the voltage across the junction.",
  "pn.slider": "Voltage across junction",
  "pn.voltage": "Voltage",
  "pn.width": "Depletion width",
  "pn.current": "Current",
  "pn.resting": "{n}× resting",
  "pn.label":
    "Junction at {v} volts. Depletion region {w} times its resting width. {state}",
  "pn.reverse":
    "Reverse bias: the depletion region widens. Almost no current flows. The junction blocks.",
  "pn.unbiased":
    "No voltage applied: the depletion region sits at its natural width, held there by the electric field of the charged atoms inside it. No current flows.",
  "pn.weak-forward":
    "Small forward bias: the depletion region shrinks, but the barrier is still high. Only a trickle flows.",
  "pn.conducting":
    "Forward bias past ≈ 0.6 V: the barrier collapses, and electrons and holes stream across. Current rises steeply.",
  "pn.pSide": "p-type (holes +)",
  "pn.nSide": "n-type (electrons −)",
  "pn.depletion": "depletion region",
  "pn.ivLabel":
    "Graph of current against voltage: flat near zero, then rising sharply above about 0.6 volts.",
  "pn.vAxis": "voltage →",
  "pn.iAxis": "current ↑ (to 10 mA)",

  // ---- MOSFET ----
  "mos.caption": "A MOSFET: a switch with no moving parts",
  "mos.captionHtml":
    "A thin layer of glass-like oxide separates the gate from the silicon. Voltage on the gate pulls carriers up to the surface, forming a <em>channel</em> that connects source to drain. Drag the gate voltage.",
  "mos.type": "Transistor type",
  "mos.nmos": "NMOS (n-channel)",
  "mos.pmos": "PMOS (p-channel)",
  "mos.gateSlider": "Gate voltage",
  "mos.gate": "Gate",
  "mos.switch": "Switch",
  "mos.current": "Current, source → drain",
  "mos.on": "ON (closed)",
  "mos.off": "OFF (open)",
  "mos.label": "{type} transistor, gate at {g} volts: switch {state}.",
  "mos.stateOn": "on, channel formed",
  "mos.stateOff": "off, no channel",
  "mos.body": "{body}-type silicon (the body)",
  "mos.source": "{wells}+ source",
  "mos.drain": "{wells}+ drain",
  "mos.gateV": "gate: {v} V",
  "mos.sourceV": "source: {v}",
  "mos.oxide": "oxide",
  "mos.drainLabel": "drain",
  "mos.gateLabel": "gate",
  "mos.nmosOn":
    "Gate is more than {vth} V above the source: electrons gather under the oxide and form an n-type channel. Current flows.",
  "mos.nmosOff":
    "Gate is below the threshold ({vth} V): no channel, so the switch is open. Only a tiny leakage current flows.",
  "mos.pmosOn":
    "Gate is at least {vth} V below the source ({vdd} V): holes gather under the oxide and form a p-type channel. Current flows. A PMOS turns on when its gate is LOW.",
  "mos.pmosOff":
    "Gate is too close to the source voltage ({vdd} V): no channel. A PMOS is off when its gate is HIGH, the opposite of an NMOS.",
  "mos.plotLabel":
    "Graph of current against gate voltage on a logarithmic scale, spanning more than a million-fold between off and on.",
  "mos.gAxis": "gate voltage →",
  "mos.grid": "each gridline: 1,000× more current",

  // ---- noise chain ----
  "noise.caption": "Analog drift vs digital restoration",
  "noise.captionHtml":
    "A bit travels through a chain of stages. Each stage adds a little random noise. An <em>analog</em> stage passes on whatever voltage it gets. A <em>digital</em> stage first snaps the voltage back toward 0 or 1, then passes it on.",
  "noise.bit": "Bit to send",
  "noise.stages": "Stages",
  "noise.noise": "Noise per stage",
  "noise.again": "Send again",
  "noise.analog": "Analog (dashed) arrives as",
  "noise.digital": "Digital (solid) arrives as",
  "noise.errors": "Errors in 1,000 sends",
  "noise.whyTitle": "Why digital wins: the S-curve",
  "noise.whyHtml":
    "The digital stage's <em>transfer curve</em> maps input voltage to output voltage. It is steep in the middle and flat at the ends, so a slightly-off 1 comes out as a cleaner 1. The <em>noise margin</em> is how much noise a valid output can pick up and still be read correctly by the next stage.",
  "noise.reads1": "reads as 1",
  "noise.unreliable": "unreliable zone",
  "noise.reads0": "reads as 0",
  "noise.stageN": "stage {n}",
  "noise.correct": "✓ correct",
  "noise.wrong": "✗ wrong",
  "noise.errorCounts": "analog {a}, digital {d}",
  "noise.label":
    "Sending {bit} through {n} stages. Analog chain ends at {a} volts; digital chain ends at {d} volts.",
  "noise.curveLabel":
    "Transfer curve of the digital stage. Inputs below {vil} volts read as 0, inputs above {vih} read as 1. Noise margin about {nm} volts.",
  "noise.inAxis": "input voltage →",
  "noise.sender": "sender",
  "noise.outAxis": "output ↑",
  "noise.margin": "noise margin",

  // ---- switch network ----
  "net.caption": "Switches that compute",
  "net.captionHtml":
    "Flip the two switches. In <em>series</em> (one after the other) current reaches the lamp only if both are closed. In <em>parallel</em> (side by side) either one is enough.",
  "net.series": "Series",
  "net.parallel": "Parallel",
  "net.switch": "Switch {name}: {state}",
  "net.closed1": "closed (1)",
  "net.open0": "open (0)",
  "net.closed": "closed",
  "net.open": "open",
  "net.picLabel": "{arr} circuit: lamp {state}",
  "net.lampOn": "lamp ON",
  "net.lampOff": "lamp off",
  "net.on": "on",
  "net.off": "off",
  "net.result": "A={a}, B={b} → lamp {state}",
  "net.on1": "on (1)",
  "net.off0": "off (0)",
  "net.table": "Truth table ({logic})",
  "net.lamp": "lamp",

  // ---- ripple adder ----
  "ripple.caption": "A carry that ripples",
  "ripple.captionHtml":
    'Each column is a full adder. A column whose two bits are equal knows its carry out straight away. Otherwise it must wait for the carry from the column to its right. <span class="muted">?</span> means "not known yet".',
  "ripple.step": "Step",
  "ripple.play": "Play",
  "ripple.reset": "Reset",
  "ripple.longCarry": "255 + 1 (long carry)",
  "ripple.noCarry": "255 + 0 (no carry, still waits)",
  "ripple.noWait": "12 + 12 (no waiting)",
  "ripple.carryOut": "carry out",
  "ripple.bit": "bit {n}",
  "ripple.carryIn": "carry in",
  "ripple.sum": "sum",
  "ripple.done": (v) =>
    `Done after ${v.n} step${Number(v.n) === 1 ? "" : "s"}: ${v.a} + ${v.b} = ${v.sum}${v.dropped ?? ""}.`,
  "ripple.dropped": " (the carry out is dropped: 8 bits can't hold {total})",
  "ripple.waiting":
    "Step {step} of {total}: still waiting for the carry to ripple.",

  // ---- latch ----
  "latch.caption": "A loop that remembers",
  "latch.captionText":
    "Two NOR gates, each one's output wired into the other. Set s or r to 1, then back to 0: the latch keeps its value. Each change goes round the loop one gate delay at a time.",
  "latch.s": "s (set) = {v}",
  "latch.r": "r (reset) = {v}",
  "latch.release": "Release both at once",
  "latch.power": "Power off and on",
  "latch.picLabel":
    "Two NOR gates. Top: inputs r = {r} and q̄ = {qn}, output q = {q}. Bottom: inputs s = {s} and q = {q}, output q̄ = {qn}.",
  "latch.delays": (v) =>
    `after ${v.n} gate delay${Number(v.n) === 1 ? "" : "s"}`,
  "latch.oscillates":
    "It never settles: from q = q̄ = 0, releasing both inputs makes both gates flip to 1, then both back to 0, forever. Real gates are never exactly equal, so one wins, but you can't predict which. That's why a latch must never get s = r = 1.",
  "latch.unknown":
    "Unknown (X): at power-on nothing has set or reset the latch yet. Set s or r to 1.",
  "latch.forbidden":
    "Forbidden: with s = r = 1 both outputs are 0, so q and q̄ aren't opposites any more.",
  "latch.holding":
    "Holding {q}: q feeds the bottom gate, which keeps q̄ at {qn}, which keeps q at {q}. Nothing outside is driving it; the loop remembers.",
  "latch.setting":
    "Setting: s = 1 forces q̄ to 0, and then the top gate makes q = 1.",
  "latch.resetting":
    "Resetting: r = 1 forces q to 0, and then the bottom gate makes q̄ = 1.",

  // ---- CPU ----
  "cpu.caption": "A CPU, one instruction at a time",
  "cpu.captionText":
    "This is the CPU we designed, running a small program. Each Step fetches the instruction at PC, decodes it and carries it out in one clock cycle.",
  "cpu.program": "Program",
  "cpu.sum": "Sum 10 + 9 + … + 1",
  "cpu.call": "Call and return",
  "cpu.screen": "Draw on the screen",
  "cpu.step": "Step",
  "cpu.run": "Run",
  "cpu.reset": "Reset",
  "cpu.listing": "Program ROM",
  "cpu.addr": "Address",
  "cpu.instr": "Instruction",
  "cpu.current": "the instruction at PC",
  "cpu.state": "Registers",
  "cpu.flags": "Flags",
  "cpu.new": "← changed",
  "cpu.screenLabel": "The screen's top-left corner (16 × 2 pixels):",
  "cpu.pixelRow": "row {y}: {bits}",
  "cpu.start": "Reset: PC is 0. Press Step to run the first instruction.",
  "cpu.did": "Step {n}: {asm}.",
  "cpu.group.alu":
    "The register file reads two registers, the ALU combines them, and the result goes back into a register. The flags are saved.",
  "cpu.group.cmp":
    "The ALU subtracts to compare the two registers; only the flags are kept.",
  "cpu.group.imm":
    "The number is inside the instruction itself. SET and SETH load it; ADDI and SUBI add or subtract it and save the flags.",
  "cpu.group.shift": "The barrel shifter slides a register's bits in one step.",
  "cpu.group.load":
    "The ALU adds the offset to a register to make an address, and the word at that address goes into a register.",
  "cpu.group.store":
    "The ALU makes the address, and a register's value is written to memory there.",
  "cpu.group.jump":
    "The control unit tests the condition on the saved flags. If it holds, PC becomes PC + offset instead of PC + 1.",
  "cpu.group.call":
    "CALL saves the return address in r7 and jumps; RET jumps back to the address in r7.",
  "cpu.chReg": "r{r}: {from} → {to}",
  "cpu.chFlags": "flags: Z={z} N={n} C={c}",
  "cpu.chMem": "memory at {addr} ← {value}",
  "cpu.chJump": "PC jumps to {to}",
  "cpu.nothing":
    "No register or memory changed; PC moves to the next instruction.",
  "cpu.halted":
    "The program has stopped: JMP 0 jumps to itself, forever. Press Reset to run it again.",
} satisfies Messages;
