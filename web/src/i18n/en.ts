// English interface text. Keys are grouped by page; values are plain text
// with {placeholders}, or functions where the wording depends on a number.
// Every key must also exist in mn.ts (the type checker enforces it).

import { demosEn } from "./demos.en";
import { toolsEn } from "./tools.en";

export type Vars = Record<string, string | number>;
export type Message = string | ((v: Vars) => string);
export type Messages = Record<string, Message>;

const s = (n: string | number | undefined) => (Number(n) === 1 ? "" : "s");

export const en = {
  // ---- site ----
  "site.name": "Sand to Tetris",
  "site.skip": "Skip to content",
  "nav.label": "Site",
  "nav.learn": "Learn",
  "nav.build": "Build",
  "nav.glossary": "Glossary",
  "nav.programs": "Programs",
  "nav.language": "Language",
  "theme.toDark": "Dark theme",
  "theme.toLight": "Light theme",
  "hud.levels": "Levels",
  "hud.levelsLabel": "Levels passed: {passed} of {total}. Open the level map.",
  "core.loading": "Loading simulator…",
  "core.ok": "Simulator {version}",
  "core.okTitle": "Simulator core {version} loaded",
  "core.failed": "Simulator core failed to load: {error}",
  "page.error": "Something went wrong loading this page",
  "page.loading": "Loading…",
  "title.glossary": "Glossary",
  "title.programs": "Programs",
  "programs.lead":
    "Games and programs written for the computer you built, to play, read and change.",
  "programs.intro":
    "Bitfall is in C Shard, the language we designed together, on your OS. The rest are in C, a language people use every day, compiled straight to assembly: the most this machine can do. Every one runs on the Machine page, and its source is yours to change.",
  "programs.play": "Play on the Machine",
  "programs.try": "Try it on the Machine",
  "programs.listLabel": "Programs",
  "programs.lang.c": "C",
  "programs.lang.shard": "C Shard",
  "title.levels": "Levels",
  "title.level": "Level",
  "title.notFound": "Not found",

  // ---- course outline (chapter titles and summaries) ----
  "outline.0.title": "From sand to switch",
  "outline.0.summary":
    "What a computer is, how people computed before electronics, and how silicon becomes a transistor.",
  "outline.1.title": "Transistors to gates",
  "outline.1.summary":
    "Wire NMOS and PMOS transistors into NOT, NAND and NOR gates.",
  "outline.2.title": "Combinational logic",
  "outline.2.summary": "Multiplexers, decoders, adders and a 16-bit ALU.",
  "outline.3.title": "Memory",
  "outline.3.summary":
    "Latches, flip-flops, registers, RAM and a program counter.",
  "outline.4.title": "The CPU",
  "outline.4.summary":
    "An instruction set we design together, a datapath and a control unit.",
  "outline.5.title": "The assembler",
  "outline.5.summary":
    "Write programs with names instead of numbers, and the program that turns them into binary.",
  "outline.6.title": "The virtual machine",
  "outline.6.summary":
    "A stack machine of our own, and the translator that turns it into assembly.",
  "outline.7.title": "The compiler",
  "outline.7.summary":
    "C Shard, a language we design together, and its compiler.",
  "outline.8.title": "The operating system",
  "outline.8.summary":
    "Screen, text, keyboard, timer and random numbers, in C Shard.",

  // ---- home ----
  "home.eyebrow": "A course in {n} chapters",
  "home.title": "From sand to Tetris",
  "home.tagline":
    "There is no magic, just abstraction layers built on top of one another.",
  "figure.computer":
    "Line drawing of a tower PC, built: behind its glass side, a board with a CPU under a tower cooler, four RAM sticks, a graphics card with two fans and a power supply. The pointer picks a part and slides it out; the button takes the whole build apart.",
  "figure.patch":
    "Line drawing of a patch panel: the cable under the pointer lifts, and its neighbours lean away. Building here is wiring.",
  "figure.laptop":
    "Line drawing of a thin laptop: the pointer's height sets how far the lid opens.",
  "figure.loupe":
    "Line drawing of a stand loupe over a ruled sheet: the pointer moves it, and the lines pass enlarged under the glass.",
  "figure.query":
    "Line drawing of a question mark built as a solid: the hook turns toward the pointer.",
  "figure.wafer":
    "Line drawing of a silicon wafer ruled into dies: under the pointer the dies rise out of it, the nearest most.",
  "figure.transistor":
    "Line drawing of a transistor, cut away: bring the pointer to the gate and electrons gather under it until the channel joins source to drain.",
  "figure.carry":
    "Line drawing of eight one-bit adders in a row: point at a bit and the carry ripples to it from bit 0, one adder after another.",
  "figure.cpu":
    "Line drawing of a processor with its die bare: point at a block (the registers, the ALU, the shifter, the control unit, the program counter) and it lifts off the die.",
  "figure.plug":
    "Line drawing of a wall socket and a plug on the floor: the pointer draws the plug toward the socket. A constant is a wire tied to a supply.",
  "figure.cabinet":
    "Line drawing of a rack of twelve blades: the pointer's height pulls the nearest ones out on their rails, the way an address picks one bank of memory.",
  "figure.slow":
    "Line drawing of crates riding a belt through a gate, one at a time; hovering slows the clock without stopping it.",
  "figure.riffle":
    "Line drawing of a tray of eight cards, each with its number punched on its tab: the card under the pointer stands up, like an instruction word read from the program.",
  "figure.exploded":
    "Line drawing of an app pulled apart into layers, like the layers of this course. Move the pointer across it to open them.",
  "figure.lockers":
    "Line drawing of twelve lockers: the one under the pointer opens, the way one memory cell answers its address.",
  "figure.terminal":
    "Line drawing of a terminal window: the pointer scrolls back through its lines, like reading a listing.",
  "figure.stack":
    "Line drawing of a call stack of five frames: the frames above lift to open the one under the pointer.",
  "figure.settle":
    "Line drawing of crooked tiles that settle into a tree as the pointer nears, the way a parser turns text into a syntax tree.",
  "figure.keyboard":
    "Line drawing of a keyboard: the key under the pointer sinks, and its neighbours follow it down.",
  "figure.phosphor":
    "Line drawing of a seven by seven dot screen playing a loop; the pointer paints a trail that fades.",
  "home.start": "Start reading",
  "home.takeApart": "Take it apart",
  "home.putTogether": "Put it back together",
  "home.workbench": "Open the workbench",
  "home.programs": "Play the programs",
  "home.howItWorks": "How it works",
  "home.read": "Read",
  "home.readText":
    "Each chapter explains one layer in plain language, with interactive demos.",
  "home.build": "Build",
  "home.buildText":
    "Wire the component yourself in the editor, from parts you already made.",
  "home.unlock": "Unlock",
  "home.unlockText":
    "Pass the tests and it joins your toolbox as a sealed block for the next layer.",
  "home.chapters": "Chapters",
  "home.chapterN": "Chapter {n}",

  // ---- chapter page ----
  "chapter.n": "Chapter {n}",
  "chapter.course": "Course",
  "chapter.chaptersLabel": "Chapters",
  "chapter.soonSr": "(coming soon)",
  "chapter.onThisPage": "On this page",
  "chapter.inThisChapter": "In this chapter",
  "chapter.backToTop": "↑ Back to top",
  "chapter.sources": "Sources",
  "chapter.pagerLabel": "Previous and next chapter",
  "chapter.previous": "← Previous",
  "chapter.next": "Next →",
  "chapter.notWritten": "Chapter {n} isn't written yet.",
  "chapter.notTranslated":
    "This chapter isn't translated yet; showing the English.",

  // ---- glossary ----
  "glossary.lead":
    "Every technical term used in the chapters, in plain language.",
  "glossary.filterLabel": "Filter terms",
  "glossary.filter": "Filter {n} terms…",
  "glossary.matches": "{shown} of {total} terms match “{q}”.",
  "glossary.seeAlso": "See also:",
  "notFound.text": "There's no page at this address.",
  "notFound.back": "Back to the chapters",

  // ---- level map ----
  "levels.title": "Build your computer",
  "levels.lead":
    "Each level is one component. Pass it, and it joins your toolbox for the levels after it.",
  "levels.layer": "Layer {n}: {name}",
  "status.passed": "✓ Passed",
  "status.open": "Open",
  "status.locked": "Locked",
  "status.broken": "⚠ Broken",
  "levels.sideQuest": "side quest",
  "levels.opensAfter": "Opens after {names}.",
  "levels.and": " and ",
  "levels.brokenText":
    "Something it uses changed and it no longer passes. Open it to see why.",
  "levels.viewLabel": "View",
  "levels.viewTree": "Tech tree",
  "levels.viewRoadmap": "Roadmap",
  "levels.roadmapLabel": "The course, step by step",
  "levels.step": "Step {n}",
  "levels.builtFrom": "Built from",
  "levels.builtFromBase": "Transistors, VDD and GND",
  "levels.usedIn": "Used in",
  "levels.usedInMore": "and {n} more",
  "levels.usedInTop":
    "Nothing: this is the finished computer. Bitfall runs on it.",
  "levels.usedInNone": "Nothing later needs it: an optional warm-up.",
  "levels.justBuilt": "from the step before",
  "levels.nextUp": "Next up",
  "levels.continue": "Continue: step {n}, {name} →",
  "levels.stageDone": "{done}/{n} done",
  "stage.gates": "Gates from switches",
  "stage.gates.intro":
    "Two transistors, one pulling up and one pulling down, make NOT. Wire the pairs differently and the same idea gives NAND and NOR.",
  "stage.const": "Fixed signals",
  "stage.const.intro":
    "A wire tied to VDD or GND is a constant 1 or 0. Later parts use them for inputs that never change.",
  "stage.logic": "Logic from NAND",
  "stage.logic.intro":
    "From here on you build with gates, not transistors. NAND and NOT are enough for AND and OR, and those two give XOR.",
  "stage.wide": "Sixteen bits at once",
  "stage.wide.intro":
    "The computer works on 16-bit words. Repeat ×16 stamps out the gate you just built, one copy per bit.",
  "stage.choose": "Choosing a signal",
  "stage.choose.intro":
    "A MUX lets one wire decide which of two signals gets through. Each MUX in this stage is built from the one before it.",
  "stage.route": "Sending a signal",
  "stage.route.intro":
    "A DMUX is a MUX turned around: one input, sent to the output that sel picks. RAM uses it to pick which word to write.",
  "stage.add": "Adding",
  "stage.add.intro":
    "Add two bits, then three, then chain sixteen adders into a word adder. Each adder is made from the one you just built.",
  "stage.alu": "The ALU",
  "stage.alu.intro":
    "Put it together: OR8WAY spots a zero, the shifter moves bits, and the ALU does all of the CPU's calculating.",
  "stage.bit": "Remembering one bit",
  "stage.bit.intro":
    "Feed a gate's output back into its input and it remembers. Each step fixes a weakness of the one before, until it changes only on the clock edge.",
  "stage.registers": "Registers",
  "stage.registers.intro":
    "Sixteen Bits side by side make a register. Eight registers make the CPU's register file, and a register that counts is the program counter.",
  "stage.ram": "RAM",
  "stage.ram.intro":
    "Registers with an address make RAM8. Each bigger RAM is made from copies of the one before it.",
  "stage.control": "Control",
  "stage.control.intro":
    "The control unit reads an instruction and sets every signal that steers the CPU.",
  "stage.cpu": "The processor",
  "stage.cpu.intro":
    "Wire the control unit, register file, ALU, shifter and program counter into a CPU that runs one instruction per clock.",
  "stage.machine": "The computer",
  "stage.machine.intro":
    "Give RAM, the screen and the keyboard their addresses, then connect that memory to the CPU.",
  "levels.treeLabel":
    "Levels as a tech tree: each level sits below the levels it needs",
  "levels.treeHelp":
    "Each level sits below the parts it needs. Select one to see what it needs and unlocks; arrow keys move between levels.",
  "levels.needs": "Needs",
  "levels.unlocks": "Unlocks",
  "levels.needsNothing": "Nothing: start here.",
  "levels.unlocksNothing": "Nothing yet: this is the top of the tree so far.",
  "levels.play": "Open level →",
  "levels.fastBadge": "⚡ fast",
  "levels.progress": "Your progress",
  "levels.saved": "Saved in this browser automatically.",
  "levels.notSaved":
    "This browser isn't letting the site save data, so export your progress before closing the tab.",
  "levels.exportHint":
    "Export a file to back it up or move it to another browser.",
  "levels.export": "Export",
  "levels.import": "Import",
  "levels.imported": "Imported.",
  "levels.confirmImport":
    "Replace your current progress with the imported file?",
  "levels.runsAs": "Runs as: {mode}",
  "levels.fastModel": "fast model",
  "levels.yourDesign": "your design",
  "levels.nowYours": "Now running as your own design.",
  "levels.comparing": "Comparing your design with the fast model…",
  "levels.cantSwap": "Can't swap: {error}",
  "levels.scopeAll": "all {n} possible inputs",
  "levels.scopeRandom": "{n} random inputs",
  "levels.scopeCycles": "{n} random clock cycles",
  "levels.notSwapped":
    "✗ Not swapped: your design differs from the model on {failed} of {scope}.",
  "levels.example":
    " For example {inputs}: model gives {expected}, yours gives {actual}.",
  "levels.matched": "✓ Matched on {scope}. Now running as the fast model.",
  "progress.badJson": "That file isn't valid JSON.",
  "progress.notOurs": "That file isn't a Sand to Tetris progress file.",
  "progress.damaged": 'The entry for "{id}" is damaged.',

  // ---- level page ----
  "play.loading": "Loading the simulator…",
  "play.noLevel": "No such level",
  "play.backToMap": "Back to the level map",
  "play.locked": "{name} is locked",
  "play.passFirst": "Pass these first: {names}.",
  "play.crumbs": "Breadcrumb",
  "play.layerN": "Layer {n}",
  "play.nextLevel": "Next level →",
  "play.levelMap": "Level map",
  "play.toolbox": "Toolbox",
  "play.parts": "Parts",
  "play.cantRun": "Can't run yet:",
  "play.clear": "Clear",
  "play.clearTitle": "Remove every part and wire (Undo brings them back)",
  "play.clearConfirm": (v: Vars) =>
    `Remove all ${v.parts} ${v.parts === 1 ? "part" : "parts"} and ${v.wires} ${v.wires === 1 ? "wire" : "wires"}? Undo (Ctrl+Z) brings them back until you leave the page.`,
  "play.cleared": "Canvas cleared. Undo (Ctrl+Z) brings it back.",
  "play.hintFirst": "Show a hint",
  "play.hintNext": "Show the next hint ({n} of {total})",
  "play.hintLabel": "Hint {n}:",
  "play.moreParts": "More parts ({n})",
  "play.fewerParts": "Fewer parts",
  "play.stepOf": "Step {n} of {total}",
  "play.addTool": "Add {name} (or drag it onto the canvas)",
  "play.undo": "Undo",
  "play.redo": "Redo",
  "play.undoTitle": "Undo (Ctrl+Z)",
  "play.redoTitle": "Redo (Ctrl+Shift+Z)",
  "play.workbench": "Workbench",
  "play.narrow":
    "The editor works best on a larger screen. On a phone, drag the canvas to pan; the menu key or a right-click shows each part's actions.",
  "play.sideLabel": "Goal, inputs and tests",
  "play.goal": "Goal",
  "play.notSaving":
    "Your browser isn't letting this site save data, so progress lasts only until you close this tab. Use Export on the level map to keep it.",
  "play.inputs": "Inputs",
  "play.busHelp":
    "Type a number for each bus input: decimal, 0x… hex or 0b… binary. Press Enter to apply.",
  "play.busLabel": "{name} ({w} bits) ",
  "play.bitsOf": "Bits of {name}",
  "play.bitTitle": "{name} bit {i} is {v}. Click to flip it.",
  "play.bitsHelp":
    "Or click a bit to flip it. The most significant bit is on the left, bit 0 on the right.",
  "play.outputs": "Outputs",
  "play.notANumber":
    "“{text}” isn't a number from 0 to {max}. You can type decimal, 0x… hex or 0b… binary.",
  "play.step": "Step",
  "play.want": "{name} (want)",
  "play.yours": "{name} (yours)",
  "play.result": "Result",
  "play.any": "any",
  "play.match": "✓ match",
  "play.differs": "✗ differs",
  "play.check": "Check",
  "play.checking": "Checking…",
  "play.testSteps": "Test steps",
  "play.truthTable": "Truth table",
  "play.stepsHelp":
    "Steps run top to bottom, and the circuit remembers between them. “any” means any value is fine. Click a step to replay the test up to it.",
  "play.tableHelp":
    "Updates live as you wire. Click a row to set those inputs.",
  "play.howPartsRun": "How parts run",
  "play.howPartsRunHelp":
    "Change which parts run as fast models on the level map.",
  "play.runsTable": "its truth table (your transistors passed every row)",
  "play.runsFast": "fast model (matched your design)",
  "play.runsYours": "your design",
  "play.runsItem": "{name}: {how}",
  "play.noComponents": "No components yet.",
  "play.tick": "Tick clk ⎍",
  "play.tickTitle": "Raise clk to 1, then back to 0",
  "play.ticked":
    "Tick: clk rose to 1 (the moment flip-flops store) and fell back to 0.",
  "play.resetMemory": "Reset memory",
  "play.resetMemoryTitle":
    "Forget everything stored, like switching off and on",
  "play.memoryCleared":
    "Memory cleared: every stored bit is unknown (X) again, as at power-on.",
  "play.zoom": "Zoom",
  "play.zoomOut": "Zoom out",
  "play.zoomIn": "Zoom in",
  "play.zoomOutTitle": "Zoom out (−)",
  "play.zoomInTitle": "Zoom in (+)",
  "play.zoomReset": "Reset to 100% (0)",
  "play.zoomLevel": "Zoom level; reset to 100%",
  "play.fit": "Fit",
  "play.fitTitle": "Fit the circuit in view",
  "play.shortcuts": "Shortcuts",
  "keys.add": "Add a part",
  "keys.addHow": "Drag it from the toolbox, or click it",
  "keys.wire": "Wire two pins",
  "keys.wireHow": "Drag from one pin to the other, or click both",
  "keys.move": "Move a part, input or output",
  "keys.moveHow": "Drag it · Tab to it, then arrow keys",
  "keys.flip": "Flip an input",
  "keys.flipHow": "Click it · Enter",
  "keys.more": "More actions (connect, delete…)",
  "keys.moreHow": "Right-click · menu key or Shift+F10",
  "keys.inside": "Look inside a component",
  "keys.insideHow": "Double-click it · Enter",
  "keys.delete": "Delete",
  "keys.deleteHow": "Delete or Backspace",
  "keys.undo": "Undo / redo",
  "keys.undoHow": "Ctrl+Z / Ctrl+Shift+Z",
  "keys.pan": "Pan",
  "keys.panHow": "Drag empty canvas · scroll",
  "keys.zoom": "Zoom",
  "keys.zoomHow": "Ctrl+scroll · + and − · 0 resets",
  "keys.cancel": "Cancel a wire",
  "keys.cancelHow": "Escape",
  "play.changed": "Changed since the last check. Press Check again.",
  "play.emptyHint":
    "Drag a part here from the toolbox, or right-click the canvas to add one. Then drag from pin to pin to wire it.",
  "play.added": "Added {id}.",
  "play.addedFree":
    "Added {id}. Tab to it on the canvas to move it with the arrow keys.",
  "play.duplicated": "Added {id}, a copy of {from}.",
  "play.disconnectedAll": "Disconnected every wire from {name}.",
  "play.disconnectedOne": "Disconnected a wire from {name}.",
  "play.connected": "Connected {from} to {to}.",
  "play.deleted": "Deleted {id}.",
  "play.deletedWire": "Deleted the wire.",
  "play.movedBack": "Moved {name} back to the edge.",
  "play.settled": (v) =>
    `Settled after ${v.depth} gate delay${s(v.depth)}${v.fast ? " (each fast model counts as one step, so real hardware would take longer)" : ""}.`,
  "play.oscillates":
    "Still changing: this circuit oscillates and never settles.",
  "play.slow": (v) =>
    `This circuit simulates ${v.cells} gates, so each change takes a moment. Switch ${v.names} to ${Number(v.count) > 1 ? "their fast models" : "its fast model"} on the `,
  "play.slowLink": "level map",
  "play.slowEnd": " to make it instant.",
  "play.optionsFor": "Options for {id}",
  "play.busWidth": "Bus width ",
  "play.bits": "{n} bits",
  "play.repeat": "Repeat × ",
  "play.repeatHelp":
    "Each copy gets its own slice of every bus pin, except shared inputs, which all copies read.",
  "play.share": " share {pin}",
  "play.fixTry": "Try: ",
  "play.fixRepeat": "Repeat {part} ×{n}",
  "play.fixRepeatWhy":
    " The bus carries {w} bits, and one copy of the part takes {b}.",
  "play.fixShare": "Share {pin} in {part}",
  "play.fixShareWhy": " Every copy should read the same {b}-bit `{pin}`.",
  "play.fixBits": "Wire the next {n} bits the same way",
  "play.fixBitsWhy": " Next: {first}{rest}.",
  "play.fixFill": "Connect {source} to the {n} free bits of {part}",
  "play.fixFillWhy": " Unused bits of a joiner usually get a constant 0.",
  "play.wiredMany": "Added {n} wires.",
  "play.simError": "Simulation error: {error}",
  "play.showingStep1": "Showing step 1, from power-on.",
  "play.showingStep": "Showing step {n}, after replaying steps 1–{m}.",
  "play.showingRow": "Showing row {n}. Highlighted parts are marked with “!”.",
  "play.waveform": "Waveform",
  "play.waveTest": "Test steps",
  "play.waveLive": "Live",
  "play.waveClear": "Clear",
  "play.waveLiveEmpty":
    "Flip inputs or tick the clock: each change appears here.",
  "play.waveEmpty": "Nothing to show yet.",
  "play.error": "Error: ",
  "play.note": "Note: ",
  "play.shortNow":
    "Short circuit right now: VDD and GND are connected through {parts}.",
  "play.couldntCheck": "Couldn't check: {error}",
  "play.passed": "✓ Passed!",
  "play.passedRows": (v) =>
    v.random
      ? `All ${v.rows} ${v.seq ? "steps" : "rows"} and ${v.random} random ${v.seq ? "steps" : "tests"} match`
      : `All ${v.rows} ${v.seq ? "steps" : "rows"} match`,
  "play.usingTransistors": "using {n} transistors",
  "play.usingGates": (v) =>
    `using ${v.cells} gates, ${v.depth} gate delay${s(v.depth)} deep`,
  "play.nowInToolbox": "{name} is now in your toolbox.",
  "play.failedRows": (v) =>
    `✗ ${v.failed} of ${v.rows} ${v.seq ? "steps" : "rows"} don't match yet.`,
  "play.failedRandom": (v) =>
    ` ${v.failed} of ${v.run} random ${v.seq ? "steps" : "tests"} fail too.`,
  "play.designErrors": "✗ The design has errors (see below).",
  "play.hint": "Hint: ",
  "play.inside": "Inside: {path}",
  "play.upOne": "Up one level",
  "play.close": "Close",
  "play.insideNote":
    "Your {name} design, running with the values it gets inside {parent}. Read-only here: edit it on its own level page.",
  "play.editIt": "Edit {name}",

  // ---- canvas ----
  "canvas.label": "Circuit canvas",
  "canvas.wired": "Wired: {list}. ",
  "canvas.notWired": "Not wired. ",
  "canvas.partShort": ", part of a short circuit",
  "canvas.partKeys":
    "Arrow keys move it, Delete removes it, the menu key shows more actions.",
  "canvas.split": "Split {w}",
  "canvas.join": "Join {w}",
  "canvas.shared": "{pin} (shared)",
  "canvas.pinTitle": "{pin}{bits} = {value}. Drag to another pin to wire it.",
  "canvas.pinBits": " ({n} bits)",
  "canvas.input": "Input",
  "canvas.output": "Output",
  "canvas.portLabelIn": (v) =>
    `Input ${v.name} = ${v.value}. ${v.wired}${v.bus ? "Enter edits its value; " : "Enter flips it; "}arrow keys move it, the menu key shows more actions.`,
  "canvas.portLabelOut":
    "Output {name} = {value}. {wired}arrow keys move it, the menu key shows more actions.",
  "canvas.outTitle": "Output {name}: drag to move",
  "canvas.inTitleBus": "Input {name}: click to type a number, drag to move",
  "canvas.inTitle": "Input {name}: click to flip between 0 and 1, drag to move",
  "model.sameEnd": "A wire needs two different ends.",
  "model.alreadyConnected": "Those two are already connected.",
  "canvas.pendingWire": "Now click the pin to connect it to (Escape cancels).",
  "state.on": "on",
  "state.off": "off",
  "state.maybe": "maybe",
  "endpoint.input": "input {name}",
  "endpoint.output": "output {name}",
  "endpoint.bit": "bit {n}",

  // ---- right-click menu ----
  "menu.lookInside": "Look inside",
  "menu.options": "Options…",
  "menu.connect": "Connect…",
  "menu.disconnect": "Disconnect…",
  "menu.duplicate": "Duplicate",
  "menu.delete": "Delete",
  "menu.deleteWire": "Delete wire",
  "menu.setValue": "Set value…",
  "menu.flip": "Flip 0 ↔ 1",
  "menu.reset": "Move back to the edge",
  "menu.canvas": "Canvas",
  "menu.addHere": "Add {name} here",
  "menu.undo": "Undo",
  "menu.redo": "Redo",
  "menu.clear": "Clear canvas",
  "menu.wire": "Wire",
  "menu.wireTitle": "Wire {from} — {to}",
  "menu.input": "Input {name}",
  "menu.output": "Output {name}",
  "menu.whichPin": "Connect which pin of {id}?",
  "menu.connectTo": "Connect {from} to…",
  "menu.disconnectFrom": "Disconnect a wire from {name}",
  "menu.allWires": "All wires",
  "menu.wireCount": (v) => `${v.n} wire${s(v.n)}`,

  // ---- waveform ----
  "wave.label":
    "Waveform of {names} over {n} steps. The same values are listed in the table.",
  "wave.replay": "Replay up to step {n}",

  // ---- toolbox names for primitives and wiring parts ----
  "tool.split": "Splitter",
  "tool.join": "Joiner",
  // ---- checker messages (English comes from the core's own text; these
  // are its equivalents, used as the template for other languages) ----
  "problem.component-mismatch":
    "this design is for `{design}`, but the level is `{level}`",
  "problem.duplicate-part":
    "two parts share the id `{part}`; ids must be unique",
  "problem.unknown-kind":
    "part `{part}` is a `{kind}`, which isn't a known part or component",
  "problem.primitive-not-allowed":
    "part `{part}` is a bare `{kind}`, but this is a Layer {layer} level. Transistors and supply rails are only used directly in Layer 1; from Layer 2 on, build with the components you made",
  "problem.layer-violation":
    "part `{part}` is a `{kind}`, a Layer {kind_layer} component, but this is a Layer {layer} level. A Layer {layer} component can only use parts from Layer {layer} and below",
  "problem.not-unlocked":
    "part `{part}` is a `{kind}`, which you haven't unlocked yet: pass the `{kind}` level first",
  "problem.self-reference":
    "part `{part}` is this same component; a component can't contain itself",
  "problem.dependency-cycle":
    "components depend on each other in a loop: {path}",
  "problem.unknown-port":
    "a wire goes to port `{port}`, which this component doesn't have (ports: {valid})",
  "problem.unknown-part": "a wire goes to part `{part}`, which doesn't exist",
  "problem.unknown-pin":
    "a wire goes to `{part}.{pin}`, but a `{kind}` has no pin `{pin}` (pins: {valid})",
  "problem.output-unconnected": "output `{port}` isn't connected to anything",
  "problem.bad-part": "part `{part}`: {reason}",
  "problem.width-mismatch":
    "a wire joins {from} ({from_width} bits) to {to} ({to_width} bits); both ends must have the same width",
  "problem.input-unused": "input `{port}` isn't used",
  "problem.pin-unconnected": "`{part}.{pin}` isn't connected",
  "problem.inner-broken": "a component inside this design is broken: {detail}",
  "problem.engine": "{detail}",
  "problem.two-drivers":
    "{listeners} gets two signals at once, from {drivers}: two outputs fighting over one wire. Each wire needs exactly one source",
  "problem.too-big":
    "this circuit is over {limit} gates once every part is expanded: too big to simulate. Switch big parts (memories, the CPU) to their fast models on the level map",
  "reason.widthOnlyWiring": "only splitters and joiners have a width",
  "reason.repeatOnlyComponents": "only components can be repeated",
  "reason.sharedNeedsRepeat":
    "shared pins only make sense on a repeated component",
  "reason.needsWidth": "a splitter or joiner needs a width",
  "reason.badWidth": "width {n} isn't allowed; use 2 to 64",
  "reason.badRepeat": "repeat {n} isn't allowed; use 1 to 64",
  "reason.tooWide": "repeating makes a pin wider than 64 bits",
  "reason.wiringLayer2": "splitters and joiners arrive in Layer 2, with buses",
  "diag.row": "Row {n}",
  "diag.step1": "Step 1",
  "diag.step2": "Step 2 (after step 1)",
  "diag.stepN": "Step {n} (after steps 1–{m})",
  "diag.randomTest": "Random test {n}",
  "diag.randomStep1": "Random step 1",
  "diag.randomStep2": "Random step 2 (after random step 1)",
  "diag.randomStepN": "Random step {n} (after random steps 1–{m})",
  "diag.wrong":
    "{label}: {inputs} → expected {port}={expected}, got {port}={actual}.",
  "diag.floating":
    "{label}: {inputs} → expected {port}={expected}, got {actual}: `{port}` is floating. Nothing drives it.",
  "diag.unknown":
    "{label}: {inputs} → expected {port}={expected}, got {actual}: the value of `{port}` can't be determined. Look for an input that isn't connected, or a loop.",
  "diag.short":
    "{label}: {inputs} → short circuit: VDD and GND are connected. Expected {port}={expected}, got X.",
  ...demosEn,
  ...toolsEn,
} satisfies Messages;
