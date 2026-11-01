// Text for the toolchain pages: the Machine and the assembler workshop
// (merged into en.ts).
import type { Messages } from "./en";

export const toolsEn = {
  "nav.machine": "Machine",
  "title.machine": "Machine",
  "title.assembler": "Your assembler",

  // ---- Machine page ----
  "machine.title": "Machine",
  "machine.lead":
    "Write a program in assembly, assemble it and run it: the screen, keyboard, registers and RAM of the computer you designed.",
  "machine.example": "Example",
  "machine.pick": "Choose an example…",
  "machine.ex.sum": "Sum 10 + 9 + … + 1",
  "machine.ex.pattern": "Checkerboard (uses .data)",
  "machine.ex.dot": "Move a dot with the arrow keys",
  "machine.ex.count": "Count forever",
  "machine.assembler": "Assembler",
  "machine.asm.builtin": "Built-in",
  "machine.asm.yours": "Yours",
  "machine.codeLabel": "Program",
  "machine.source": "Assembly source",
  "machine.run": "Assemble and run",
  "machine.pause": "Pause",
  "machine.step": "Step",
  "machine.reset": "Reset",
  "machine.speed": "Speed",
  "machine.speed.slow": "Slow (60 / s)",
  "machine.speed.medium": "Medium",
  "machine.speed.fast": "Fast",
  "machine.screenLabel":
    "The screen, 128 by 96 pixels. Focus it to send keys to the program.",
  "machine.keysHelp":
    "Click the screen, then type or use the arrow keys; the program reads the key at 0x6000.",
  "machine.keyHeld": "Key held: {code}.",
  "machine.ramFrom": "RAM from address",
  "machine.flags": "Flags",
  "machine.ready": "Ready. Press Assemble and run.",
  "machine.assembling": "Assembling…",
  "machine.hasErrors": "{n} error(s): fix them and try again.",
  "machine.running": "Running: {steps} instructions so far.",
  "machine.paused": "Paused after {steps} instructions.",
  "machine.halted": "Halted after {steps} instructions.",
  "machine.errorLine": "Line {line}: {message}",

  // ---- assembler workshop ----
  "workshop.title": "Your assembler",
  "workshop.lead":
    "Write the assembler yourself, in TypeScript: four stages, each with its own tests. When every test passes, the Machine page can run programs through it.",
  "workshop.how":
    "Run the tests as you go ({n} in all). Each stage is tested on correct input from the stage before, so build them in order. Tab indents; press Escape, then Tab, to leave the editor. The language is explained in",
  "workshop.chapter": "Chapter 5.",
  "workshop.codeLabel": "Your code",
  "workshop.source": "Your assembler (TypeScript)",
  "workshop.run": "Run the tests",
  "workshop.starter": "Start over",
  "workshop.confirmStarter":
    "Replace your code with the starting template? Your current code will be lost.",
  "workshop.saved": "Saved",
  "workshop.notRun": "Press Run the tests to see how your assembler is doing.",
  "workshop.passedBefore":
    "This code passed every test. The Machine page can use it.",
  "workshop.running": "Running the tests…",
  "workshop.stage.tokenize": "1 · Tokenize",
  "workshop.stage.parse": "2 · Parse",
  "workshop.stage.layout": "3 · Layout (pass 1)",
  "workshop.stage.encode": "4 · Encode (pass 2)",
  "workshop.stage.program": "Whole programs",
  "workshop.emptyLine": "(an empty line)",
  "workshop.input": "Input",
  "workshop.expected": "Expected",
  "workshop.got": "Yours",
  "workshop.throws": "throws AsmError with code {code}",
  "workshop.threw": "threw {code}: {message}",
  "workshop.more": "…and {n} more.",
  "workshop.allPassed":
    "✓ Your assembler passes all {n} tests. The Machine page now offers it.",
  "workshop.toMachine": "Try it on the Machine →",
  "workshop.err.syntax": "Your code doesn't compile",
  "workshop.err.timeout":
    "Your code ran for more than 5 seconds and was stopped (an endless loop?)",
  "workshop.err.missing":
    "Your code must export tokenize, parse, layout and encode",
  "workshop.err.crash": "Your code crashed",

  // ---- assembler errors (codes from docs/ASSEMBLY.md) ----
  "asm.what.instruction": "an instruction or a directive",
  "asm.what.comma": "a comma",
  "asm.what.end": "the end of the line",
  "asm.what.register": "a register (r0–r7)",
  "asm.what.offset": "a number or a name",
  "asm.what.rbracket": "`]`",
  "asm.what.operand": "an operand",
  "asm.expect.number": "a number",
  "asm.expect.memory": "a memory reference like [r1 + 2]",
  "asm.bad-char": "`{char}` can't appear here",
  "asm.bad-number": "`{text}` isn't a number: write 42, -5, 0x2A, 0b101 or 'A'",
  "asm.bad-name":
    "`{found}` isn't a name: names are letters, digits and _, not starting with a digit",
  "asm.expected": "expected {what}, found `{found}`",
  "asm.unknown-mnemonic": "`{mnemonic}` isn't an instruction",
  "asm.unknown-directive":
    "`.{name}` isn't a directive: use .equ, .code, .data, .word or .space",
  "asm.operand-count": "{mnemonic} takes {expected} operand(s), not {found}",
  "asm.not-a-register": "expected a register (r0–r7), found {found}",
  "asm.bad-operand": "expected {expected}, found {found}",
  "asm.out-of-range": "{what} = {value} doesn't fit: it must be {range}",
  "asm.unknown-symbol": "`{name}` isn't defined",
  "asm.duplicate-symbol": "`{name}` is already defined on line {first}",
  "asm.data-in-code":
    "`.{name}` puts data in the program: it belongs after .data",
  "asm.code-in-data": "instructions belong in .code, not .data",
  "asm.jump-to-data":
    "`{name}` is a data address (RAM), not a place in the program",
  "asm.jump-too-far":
    "`{target}` is {distance} instructions away; {mnemonic} reaches {range}",
} satisfies Messages;
