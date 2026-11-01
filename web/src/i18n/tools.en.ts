// Text for the toolchain pages: the Machine and the assembler workshop
// (merged into en.ts).
import type { Messages } from "./en";

export const toolsEn = {
  "nav.machine": "Machine",
  "title.machine": "Machine",
  "title.assembler": "Your assembler",
  "title.translator": "Your VM translator",
  "title.compiler": "Your compiler",

  // ---- Machine page ----
  "machine.title": "Machine",
  "machine.lead":
    "Write a program in assembly or VM code, build it and run it: the screen, keyboard, registers and RAM of the computer you designed.",
  "machine.example": "Example",
  "machine.pick": "Choose an example…",
  "machine.ex.sum": "Sum 10 + 9 + … + 1",
  "machine.ex.pattern": "Checkerboard (uses .data)",
  "machine.ex.dot": "Move a dot with the arrow keys",
  "machine.ex.count": "Count forever",
  "machine.ex.vm-sum": "Sum 10 + 9 + … + 1 with a loop",
  "machine.ex.vm-fact": "Factorial with recursion",
  "machine.ex.vm-stripes": "Stripes on the screen",
  "machine.ex.vm-dot": "Move a dot with the arrow keys",
  "machine.ex.shard-sum": "Sum with a for loop",
  "machine.ex.shard-box": "Draw boxes on the screen",
  "machine.ex.shard-dot": "Move a dot with the arrow keys",
  "machine.lang.shard": "C Shard",
  "machine.sourceShard": "C Shard source",
  "machine.compiler": "Compiler",
  "machine.cm.builtin": "Built-in",
  "machine.cm.yours": "Yours",
  "machine.compiling": "Compiling…",
  "machine.vmCode": "The VM code it became ({n} lines)",
  "machine.language": "Language",
  "machine.lang.asm": "Assembly",
  "machine.lang.vm": "VM",
  "machine.translator": "VM translator",
  "machine.tr.builtin": "Built-in",
  "machine.tr.yours": "Yours",
  "machine.sourceVm": "VM source",
  "machine.translating": "Translating…",
  "machine.translation": "The assembly it became ({n} lines)",
  "machine.stack": "Stack, top first",
  "machine.stackEmpty": "Empty.",
  "machine.assembler": "Assembler",
  "machine.asm.builtin": "Built-in",
  "machine.asm.yours": "Yours",
  "machine.codeLabel": "Program",
  "machine.source": "Assembly source",
  "machine.run": "Build and run",
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
  "machine.ready": "Ready. Press Build and run.",
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
  "workshop.yourAsm": "The assembly your code made",
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
  "workshop.throws": "throws an error with code {code}",
  "workshop.threw": "threw {code}: {message}",
  "workshop.more": "…and {n} more.",
  "workshop.allPassed":
    "✓ Your assembler passes all {n} tests. The Machine page now offers it.",
  "workshop.toMachine": "Try it on the Machine →",
  "workshop.err.syntax": "Your code doesn't compile",
  "workshop.err.timeout":
    "Your code ran for more than 5 seconds and was stopped (an endless loop?)",
  "workshop.err.missing":
    "Your code doesn't export every function the tests call (see below)",
  "workshop.err.crash": "Your code crashed",

  // ---- VM translator workshop ----
  "translator.title": "Your VM translator",
  "translator.lead":
    "Write the VM translator yourself, in TypeScript: read a line, then turn each kind of command into assembly. When every test passes, the Machine page can run VM programs through it.",
  "translator.how":
    "Run the tests as you go ({n} in all). A stage's commands are translated with your code and the rest with the built-in translator, then run on the CPU, so you can build the stages in any order. Tab indents; press Escape, then Tab, to leave the editor. The VM is explained in",
  "translator.chapter": "Chapter 6.",
  "translator.source": "Your VM translator (TypeScript)",
  "translator.notRun":
    "Press Run the tests to see how your translator is doing.",
  "translator.allPassed":
    "✓ Your translator passes all {n} tests. The Machine page now offers it.",
  "translator.stage.parse": "1 · Parse",
  "translator.stage.stack": "2 · push, set and memory",
  "translator.stage.arith": "3 · Arithmetic and comparisons",
  "translator.stage.jumps": "4 · Labels and jumps",
  "translator.stage.functions": "5 · Functions",
  "translator.stage.muldiv": "6 · mul, div, mod",
  "translator.stage.program": "Whole programs",

  // ---- compiler workshop ----
  "compiler.title": "Your compiler",
  "compiler.lead":
    "Write the C Shard compiler yourself, in TypeScript: tokens, a syntax tree, names and types, then VM code. When every test passes, the Machine page can compile programs with it.",
  "compiler.how":
    "Run the tests as you go ({n} in all). Each stage is tested on correct input from the stage before, so build them in order; the VM code you generate is run and compared by what it does. Tab indents; press Escape, then Tab, to leave the editor. The language is explained in",
  "compiler.chapter": "Chapter 7.",
  "compiler.source": "Your compiler (TypeScript)",
  "compiler.notRun": "Press Run the tests to see how your compiler is doing.",
  "compiler.allPassed":
    "✓ Your compiler passes all {n} tests. The Machine page now offers it.",
  "compiler.stage.tokenize": "1 · Tokenize",
  "compiler.stage.parse": "2 · Parse",
  "compiler.stage.check": "3 · Check names and types",
  "compiler.stage.generate": "4 · Generate VM code",
  "compiler.stage.program": "Whole programs",

  // ---- C Shard errors (codes from docs/LANGUAGE.md) ----
  "lang.what.name": "a name",
  "lang.what.type": "a type (int, bool, [int; N] or [int])",
  "lang.what.expression": "a value or an expression",
  "lang.what.declaration": "fn, var or const",
  "lang.what.statement": "a statement",
  "lang.bad-char": "`{char}` can't appear here",
  "lang.bad-number": "`{text}` isn't a number from 0 to 65535",
  "lang.bad-char-literal":
    "`{text}` isn't a character: write 'A', '\\'', '\\\\' or '\\n'",
  "lang.bad-string": "a string must end on its line, with printable characters",
  "lang.expected": "expected {what}, found `{found}`",
  "lang.chained-comparison": "comparisons don't chain: write a < b and b < c",
  "lang.unknown-name": "`{name}` isn't declared",
  "lang.duplicate-name": "`{name}` is already declared",
  "lang.reserved-name":
    "`{name}`: names starting with _ belong to the compiler",
  "lang.type-mismatch": "expected {expected}, found {found}",
  "lang.not-a-function": "`{name}` isn't a function",
  "lang.not-a-value":
    "this isn't a value here: an array value belongs to a global or constant, and a function needs (...)",
  "lang.arg-count": "`{name}` takes {expected} argument(s), not {got}",
  "lang.missing-type": "`{name}` needs a type or a starting value",
  "lang.not-assignable":
    "only a variable, an element of a variable array, or mem[...] can be assigned",
  "lang.not-an-array": "`{name}` isn't an array",
  "lang.not-constant":
    "this must be a constant: numbers, true/false, constants and operators on them",
  "lang.bad-array-size": "an array's size must be a constant from 1 to {max}",
  "lang.array-length":
    "the value has {found} elements, the type says {expected}",
  "lang.break-outside-loop": "break and continue belong inside a loop",
  "lang.missing-return": "`{name}` must end with return (on every path)",
  "lang.call-not-statement":
    "this does nothing: only a call can be a statement on its own",
  "lang.no-main": "a program needs a function main: fn main() { ... }",
  "lang.main-signature": "main takes no parameters and returns int or nothing",
  "lang.too-many-variables":
    "`{name}` has too many parameters and locals: at most {max}",
  "lang.too-many-globals": "the globals take {words} words; at most {max} fit",

  // ---- VM errors (codes from docs/VM.md) ----
  "vm.bad-number": "`{text}` isn't a number: write 42, -5, 0x2A or 0b101",
  "vm.out-of-range": "{value} doesn't fit: it must be {min}..{max}",
  "vm.bad-segment": "`{text}` isn't local, arg or global",
  "vm.set-constant":
    "set needs a variable (local, arg or global), not a number",
  "vm.unknown-command": "`{text}` isn't a VM command",
  "vm.operand-count": "wrong number of operands for {command}",
  "vm.bad-name":
    "`{text}` can't be a name: letters, digits and _, not starting with a digit, without __, and not r0–r7",
  "vm.too-many-variables":
    "a function can have at most {max} arguments and locals together",
  "vm.outside-function": "commands belong inside a function: start with func",
  "vm.duplicate-function": "function `{name}` is defined twice",
  "vm.duplicate-label": "label `{name}` is defined twice in {func}",
  "vm.unknown-function": "there's no function `{name}`",
  "vm.unknown-label": "there's no label `{name}` in {func}",
  "vm.no-variable":
    "{func} has {count} {seg} variable(s), so there's no {seg} {n}",
  "vm.arg-count": "`{name}` takes {expected} argument(s), not {got}",
  "vm.no-main": "a program needs a function main (func main 0 k)",
  "vm.main-args": "main takes no arguments",
  "vm.no-return": "`{name}` must end with return or jump",
  "vm.function-too-long":
    "this jump can't reach its label: the function is too long (split it)",
  "vm.asm": "the assembler rejected the translation: {message}",

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
