---
number: 7
title: The compiler
summary: "Design a programming language together, C Shard, and build the compiler that turns it into VM code: tokens, a syntax tree, types, code."
---

With the VM, programs stopped thinking about registers, but they still think in single stack commands: four lines to add two variables. People want to write `score = score + lines * 10;` and let a program work out the commands. That's a **[[high-level language|high-level-language]]**, and the program that turns it into lower-level code is a **[[compiler]]**. You designed the language: it's called C Shard. In this chapter you'll learn it, see how a compiler reads it, and then write that compiler yourself.

## C Shard

```
// The sum 1 + 2 + ... + n.
fn sum(n: int) -> int {
    var total = 0;
    for i in 1..n + 1 {
        total = total + i;
    }
    return total;
}

fn main() -> int {
    return sum(10);
}
```

It looks like C and the languages that followed it, because we chose that: blocks in braces, `;` after statements, and spaces and line breaks don't matter. The full definition is `docs/LANGUAGE.md`. These are the choices we made together:

| Question | We chose | Why |
|---|---|---|
| Syntax | braces, C-family | familiar, and the easiest kind to read by program |
| Types | `int`, `bool` and arrays, checked before code is made | `if 5 { }` or adding a bool to a number is caught, with its line |
| Arrays | a fixed size, known when compiling | no memory manager needed; enough for a Tetris board |
| Screen and keys | `mem[addr]` reads and writes any address | the OS in the next chapter can be written in C Shard itself |
| Logic | `and`, `or`, `not` for conditions; `& \| ^ ~` for bits | the two can't be mixed up, and `and`/`or` stop early |
| Loops | `if`/`else`, `while`, `for i in 0..10`, `break`, `continue` | most game loops are a `for` over rows or columns |
| Text | `'A'` is a number; `"GAME OVER"` is a constant array | enough to put words on the screen |

Two details matter for games. `and` and `or` stop early: in `x < 10 and board[x] == 0`, the array is read only when x is small enough, which is called **[[short-circuit evaluation|short-circuit-evaluation]]**. And the bit operators sit above the comparisons, so `x & 1 == 0` means what it looks like: `(x & 1) == 0`.

## Reading a program: tokens and a tree

A compiler works in stages, like the assembler. The first, **tokenize**, cuts the text into **[[tokens|token]]**: `while`, `x`, `<=`, `10`, `{`. Spaces and comments disappear, and each token remembers its line, so later errors can point at it.

The second, **parse**, builds a **[[syntax tree|syntax-tree]]** from the tokens. The tree shows how the pieces belong together. In `2 + 3 * 4`, the `*` sits under the `+`, because multiplication happens first:

<compile-demo></compile-demo>

Which operator goes deeper is decided by **[[precedence]]**. Our parser handles it with **[[recursive descent|recursive-descent]]**: one small function per precedence level, each calling the next-tighter one for its operands. The function for `+` calls the one for `*`, so it gets `3 * 4` back as a single piece before it can build its `+`. The parser's structure follows the grammar directly, which is why so many real compilers are written this way.

## Checking: names and types

A tree can be well formed and still not make sense: `x = true;` when x is a number, a call to a function that doesn't exist, `break` outside a loop. The third stage, the **[[type checker|type-checker]]**, walks the tree and catches these with the line they're on, before any code is made. On the way it works out the constants (`ROWS * 10` becomes 200) and decides where everything lives: each global gets its words of RAM, from address 0 up, and each local variable its number in the function's frame.

## Generating VM code

The last stage walks the tree once more and writes VM commands. For an expression it's a walk that does both operands first, then the operator: for `2 + 3 * 4` that's `push 2`, `push 3`, `push 4`, `mul`, `add`. That's exactly what the stack machine wants. This fit is the reason stack machines are such a common target for compilers.

Statements become labels and jumps:

```
while x < 10 {          label L1
    x = x + 1;          push local 0
}                       push 10
                        lt
                        jumpifnot L2
                        push local 0
                        push 1
                        add
                        set local 0
                        jump L1
                        label L2
```

`and` and `or` jump over their right side when the left side already decides. A function becomes `func`, its parameters VM arguments and its variables VM locals. A global's starting value is stored by a small function `_init` that runs before `main`.

**[Write your own compiler →](#/compiler)** · **[Run C Shard on the Machine →](#/machine)**

## Where compilers come from

Grace Hopper's A-0 system, written for the UNIVAC I in 1951 and 1952, is often called the first compiler, though it worked more like a loader that joined ready-made pieces of code than like a compiler as we know it today[@hopper-a0]. The FORTRAN compiler, built at IBM by a team led by John Backus and delivered for the IBM 704 in April 1957, made code good enough that programmers who wrote assembly accepted a high-level language in its place[@fortran-1957]. C, the language our syntax comes from, grew at Bell Labs between 1969 and 1973 out of B, a language whose only data type was the machine word; giving variables types was one of the first changes[@c-language].

<aside class="summary">

## What you built, and what you learned

**What you built:** a compiler for C Shard, a language you designed, in four stages, each with its own tests; and programs in it that draw on the screen and read the keyboard of your own computer.

**What you learned:**

- A compiler reads text in stages: tokens, then a syntax tree, then checks, then code.
- Precedence decides how the tree is shaped; recursive descent turns the grammar into one function per level.
- A type checker catches mistakes before the program runs and works out where every variable lives.
- Visiting a tree's operands before its operator gives stack-machine code directly.

**Next:** in Chapter 8 you'll write the operating system in C Shard: drawing, text, the keyboard, timing and random numbers.

</aside>
