---
number: 6
title: The virtual machine
summary: "Put a simple machine of your own design between the language and the CPU: a stack machine with functions, and the translator that turns it into assembly."
---

Assembly is a big step up from numbers, but you still think like the CPU: which of eight registers holds what, which ones a subroutine may change, where in RAM to save the rest. A compiler for a real language (next chapter) would have to get all of that right at once. So we split the job in two. The compiler will write code for a **[[virtual machine|virtual-machine]]**: a machine that exists only as a definition, simple enough to compile to without worrying about registers. Then a separate, much smaller program, the **translator**, turns each of its commands into a few lines of assembly. In this chapter you'll learn the VM and then write that translator.

## A machine made of one stack

Our VM is a **[[stack machine|stack-machine]]**. It has no registers you can name. Instead every command takes its inputs from the top of a **[[stack]]**, the way you'd stack plates: you can only put a plate on top (**push**) or take the top one off (**pop**). `add` pops two numbers and pushes their sum.

That turns an expression into a list of its numbers and operators, in order. To compute (3 + 4) × 2:

```
push 3      ; stack: 3
push 4      ; stack: 3 4
add         ; stack: 7
push 2      ; stack: 7 2
mul         ; stack: 14
```

There's nothing to decide: no "which register is free?". That's exactly why a compiler likes this kind of machine. Step through it, then through a function call:

<stack-demo></stack-demo>

The whole VM is in `docs/VM.md`. We designed its main choices together; here they are:

| Question | We chose | Why |
|---|---|---|
| What kind of VM | a stack machine | expressions compile in order, and each command translates on its own |
| Where values live | numbered `local`, `arg` and `global` variables, plus `load` and `store` | few ideas; arrays, pointers, the screen and the keyboard are all just addresses |
| What "true" is | −1 (all 16 bits 1), false is 0 | `and`, `or` and `not` then work for both bits and conditions |
| Multiplying | `mul`, `div`, `mod` are commands | the translator adds a small routine for them, since the CPU can't multiply |

## Variables and memory

`push local 2` pushes the value of the current function's local variable 2, and `set local 2` pops the top into it. `arg` works the same for the function's arguments and `global` for variables every function shares. Everything else is memory: `load` pops an address and pushes the word stored there, and `store` writes a value to an address. Because the screen and keyboard are addresses (Chapter 4), the same two commands draw pixels and read keys:

```
push 0x4000     ; the screen's first word
push -1         ; 16 lit pixels
store
```

## Decisions: true is −1

`lt`, `eq` and the other comparisons push −1 for true and 0 for false. With all 16 bits set, `not` turns true into false and back, and `and` and `or` combine conditions, so one set of bit commands does both jobs. `jumpif L` pops a value and jumps to `label L` if it isn't 0; `jumpifnot` jumps if it is. That's all a loop or an if-then-else needs.

## Functions and frames

`call f 2` runs function `f` with the top two values as its arguments; when it finishes with `return`, both are gone and its result is in their place. To the caller, a call is just a command that turns some values into one, like `add`.

That works because every call gets its own **[[stack frame|stack-frame]]** on the same stack. When `f` starts, it saves two things for later, where to return to and the caller's frame, and makes room for its locals. A register, **FP**, points at the frame, so `local 0` is always at FP + 0 and the arguments sit just above the saved words. Another register, the **[[stack pointer|stack-pointer]]** (SP), always points at the top of the stack. When `f` returns, it puts its result where its first argument was, puts SP and FP back, and jumps to the return address.

Since each call has its own frame, a function can call itself: that's **[[recursion]]**. In the demo's factorial, `fact(3)` calls `fact(2)`, which calls `fact(1)`: three frames of the same function, each with its own `arg 0`, stacked one above another. Exactly where everything goes in a frame, and which register means what, is the **[[calling convention|calling-convention]]** in `docs/VM.md`. Every piece of the translation follows it, which is what lets your translation of one command run next to the built-in translator's translation of another.

## From stack to registers

The translator handles one command at a time. Most commands become three to eight instructions. `add`, for example:

```
LOAD  r1, [r6]        ; b = the top (r6 is SP)
ADDI  r6, 1           ; pop it
LOAD  r0, [r6]        ; a = the new top
ADD   r0, r0, r1
STORE r0, [r6]        ; the sum replaces a
```

`mul`, `div` and `mod` call two routines the translator adds to the program. Multiplying in binary is long multiplication with only 0s and 1s: for every 1 bit in one number, add the other number shifted into place. Dividing is long division: bring down one bit at a time and subtract wherever it fits.

You may notice the cost: every value goes to RAM and back, where hand-written assembly would keep it in a register. Real systems close that gap with more work in the compiler, such as **register allocation**. Ours stays simple, and our CPU's fast model is quick enough for games anyway.

The VM also has a definition you can run directly, the **[[interpreter]]** used in the demo, which carries out one command per step instead of translating. The reference translator's tests run hundreds of random programs both ways and check that they agree.

**[Write your own VM translator →](#/translator)** · **[Run VM programs on the Machine →](#/machine)**

## Where virtual machines come from

Stack machines started out as real hardware. The Burroughs B5000, described in 1961 and designed for programs written in ALGOL rather than assembly, did all its arithmetic on a stack, so its instructions didn't need to name registers or temporary locations at all[@burroughs-b5000]. A decade later, the Pascal compiler from Niklaus Wirth's group at ETH Zurich was spread as Pascal-P: a compiler that produced p-code for a virtual stack machine, plus an interpreter for it. Moving Pascal to a new computer meant writing only that interpreter. UCSD Pascal, released in 1977, built a whole portable system on the idea[@pascal-p-code]. The Java Virtual Machine runs programs the same way: each method call gets a frame with its local variables and an operand stack, and instructions such as `iadd` pop their operands and push the result[@jvm-operand-stack]. WebAssembly, which became a W3C Recommendation in December 2019 and runs in every major browser, also describes its computational model as a stack machine[@webassembly-stack].

<aside class="summary">

## What you built, and what you learned

**What you built:** a VM translator that turns stack-machine commands into assembly, with functions, recursion, and multiplication and division routines; and VM programs that run on your computer's screen and keyboard.

**What you learned:**

- A virtual machine is a machine defined in a document, not in hardware; a translator or an interpreter makes it real on a given CPU.
- A stack machine takes operands from the top of a stack and pushes results, so expressions compile to their values and operators in order.
- Every function call gets a stack frame (return address, the caller's frame pointer, locals), so functions can call each other and themselves.
- A calling convention fixes where everything goes, so separately translated pieces work together.

**Next:** in Chapter 7 we'll design a small programming language together and write the compiler that turns it into VM code.

</aside>
