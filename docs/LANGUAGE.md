# C Shard: the language

C Shard is the high-level language of Sand to Tetris. The compiler turns it
into VM code (`docs/VM.md`); the OS (M11) and Tetris (M12) are written in it.
Agreed with the user on 2026-11-01 (name: "C shard", the user's choice):

- **braces, C-family syntax**: blocks in `{ }`, statements end with `;`, and
  spaces and line breaks never matter;
- **types int, bool and arrays, checked** before any code is generated;
- **fixed-size arrays**, their size known when compiling (no heap);
- **`mem[addr]` is built in**, so the OS can be written in C Shard itself;
- **`and`, `or`, `not` for bool** (and/or stop early), **`& | ^ ~` for
  bits**, with ordinary precedence;
- **if/else, while, `for i in a..b`, break, continue**;
- **`'A'` is a char (an int) and `"text"` a constant array of chars**.

The reference compiler is the crate `s2t-lang` (`toolchain/lang`). Its
tests check every rule below by running compiled programs.

## A first look

```
// Sum 1 + 2 + ... + n, and keep the best result in a global.
var best: int = 0;

fn sum(n: int) -> int {
    var total = 0;
    for i in 1..n + 1 {
        total = total + i;
    }
    return total;
}

fn main() -> int {
    best = sum(10);
    return best;
}
```

## Lexical rules

- Spaces, tabs and line breaks separate tokens and are otherwise ignored.
  `//` starts a comment that runs to the end of the line.
- **Names**: letters, digits and `_`, not starting with a digit or with `_`
  (names starting with `_` belong to the compiler). Case matters.
- **Keywords**: `fn var const if else while for in break continue return
  and or not true false int bool mem`.
- **Numbers**: decimal `42`, hex `0x2A`, binary `0b101010`, with `_`
  allowed between digits; 0..65535. A minus sign is an operator: `-5` is
  `-(5)`, and `-32768` works because arithmetic wraps at 16 bits.
- **Characters**: `'A'` is the number 65. Any printable ASCII character
  except `'` and `\` stands for itself; `'\''`, `'\\'` and `'\n'` (10) are
  escapes.
- **Strings**: `"GAME OVER"`: printable ASCII; `\"`, `\\` and `\n` are
  escapes. A string is a constant array of its characters (no length word,
  no terminator). It can start a constant, or appear inside a function
  (`draw_text("SCORE", 5, 0, 0)`), where it is a hidden constant array
  (clarified 2026-11-01, with the OS: the option the user approved showed
  `draw_text("HELLO", 5, 40, 44)`).
- **Symbols**: `( ) { } [ ] , ; : -> .. = + - * / % & | ^ ~ << >> == != <
  <= > >=`.

## Types

| Type | Values |
|---|---|
| `int` | −32768..32767, wrapping at 16 bits |
| `bool` | `true` (−1 in the VM) or `false` (0) |
| `[T; N]` | a fixed array of N values of type T (int or bool); only for globals and constants |
| `[T]` | a reference to an array of T: a parameter or local that can hold any `[T; N]` (no bounds are checked) |

There are no automatic conversions: an int is never a bool, or the other way.

## Declarations

A program is a list of functions, global variables and constants, in any
order; every name is visible everywhere in the program.

```
const ROWS: int = 20;                  // a constant: no memory, just a value
const SHAPES: [int; 4] = [0x0F00, 0x4444, 0x0660, 0x4E00];
const TITLE = "GAME OVER";             // [int; 9]
var board: [int; ROWS * 10];           // 200 words of zeros
var score: int = 0;
var over = false;                      // the type comes from the value

fn add(a: int, b: int) -> int { return a + b; }
fn clear() { ... }                     // no result
```

- `const NAME: T = value;` and `var NAME: T = value;`: the type may be left
  out when there is a value, which then gives it. A global `var` without a
  value starts at 0 (or false); its type is then required.
- The values of constants and globals, and array sizes, must be **constant
  expressions**: numbers, chars, `true`/`false`, other constants, and
  operators on them (`ROWS * 10`). An array value is `[a, b, ...]` or a
  string, and its length must match N.
- `fn name(p: T, ...) -> R { ... }`: parameters are `int`, `bool` or `[T]`;
  the result R is `int` or `bool`, or left out for none. A function with a
  result must end every path with `return value;` (its last statement is
  a return, or an if/else whose branches both end that way).
- `fn main()` (no parameters; with or without `-> int`) is where the
  program starts. Its result is what the Machine page shows.

## Statements

| Statement | Meaning |
|---|---|
| `var x = expr;` · `var x: T = expr;` | a new local, in scope to the end of its block; it must have a value; no array locals except `[T]` references |
| `x = expr;` · `a[i] = expr;` · `mem[addr] = expr;` | assignment; the types must match |
| `if cond { } else if cond { } else { }` | cond is a bool |
| `while cond { }` | |
| `for i in a..b { }` | i is a new int local counting a, a+1, …, b−1 (b is computed once; if b ≤ a the body never runs) |
| `break;` · `continue;` | leave, or go to the next round of, the innermost loop |
| `return;` · `return expr;` | |
| `f(args);` | a call whose result (if any) is dropped; no other expression can be a statement |

A name can't be declared twice in one function. A local or parameter may
have the name of a global, constant or function: inside its scope the name
means the local (changed 2026-11-01 with the OS: the OS's locals must not
clash with a program's globals).

## Expressions

From loosest to tightest:

| Level | Operators | Types |
|---|---|---|
| 1 | `or` | bool, bool → bool; the right side runs only if the left is false |
| 2 | `and` | bool, bool → bool; the right side runs only if the left is true |
| 3 | `not` (prefix) | bool → bool |
| 4 | `== !=` | two ints or two bools → bool |
| 4 | `< <= > >=` | two ints (signed) → bool; comparisons don't chain (`a < b < c` is an error) |
| 5 | `\|` | int, int → int |
| 6 | `^` | int, int → int |
| 7 | `&` | int, int → int |
| 8 | `<< >>` | int, int → int; `>>` shifts zeros in; the amount is taken AND 15 |
| 9 | `+ -` | int, int → int |
| 10 | `* / %` | int, int → int; `/` and `%` are signed and round toward 0 (docs/VM.md) |
| 11 | `-` `~` (prefix) | int → int |
| 12 | `f(args)` `a[i]` `mem[i]` | a call; an element of a global array or `[T]` (i is an int); the memory word at address i (an int) |

Bit operators sit above comparisons, so `x & 1 == 0` means `(x & 1) == 0`.

## Compiling to the VM

- A global gets VM globals from 0 up in the order declared: one for an
  int or bool, N for an array. An array's value (what a `[T]` holds) is the
  RAM address of its first element, which is its first global's number.
  At most 4096 words of globals.
- Constant scalars are not stored: their value is put where they're used.
  Constant arrays are stored like globals. A string inside a function gets
  globals after all the declared ones, once per distinct text, in order of
  first use; its `Info.globals` key is the text in double quotes.
- Starting values of globals and the contents of constant arrays are
  stored by a function `_init` that `main` calls first (the VM's `.data`
  starts as zeros, so zeros aren't stored).
- Parameters are VM `arg`s; locals (and each `for`'s hidden end value)
  are VM `local`s, numbered in order of appearance; at most 126 together.
- `true` is −1 and `false` 0; `and` and `or` jump over their right side.
- A function without a result returns 0, and a call used as a statement is
  followed by `pop`.
- Labels inside a function are `L1`, `L2`, … in order.

## Errors

Errors name the line and have a code (the message can be in any language):

- tokens: `bad-char`, `bad-number`, `bad-char-literal`, `bad-string`;
- syntax: `expected` (with what was expected and what was found);
- names and types: `unknown-name`, `duplicate-name`, `reserved-name`,
  `type-mismatch` (expected, found), `not-a-function`, `not-a-value`,
  `arg-count`, `missing-type`, `not-assignable`, `not-an-array`, `not-constant`,
  `bad-array-size`, `array-length`, `chained-comparison`,
  `break-outside-loop`, `missing-return`, `call-not-statement`, `no-main`,
  `main-signature`, `too-many-variables`, `too-many-globals`.

## How it's built: four stages

1. **tokenize** the whole source into tokens (each with its line);
2. **parse** the tokens into a syntax tree (JSON, below);
3. **check** names and types, and work out constants;
4. **generate** VM code from the checked tree.

Tokens: `{"kind": "num", "value": 65, "line": 3}` (numbers and chars),
`{"kind": "str", "text": "GAME OVER", "line": 1}`, `{"kind": "name", "text":
"board", "line": 2}`, `{"kind": "kw", "text": "while", "line": 5}`,
`{"kind": "sym", "text": "<=", "line": 5}`.

The syntax tree's JSON is defined by the crate's types (`s2t_lang::ast`) and
shown in the compiler workshop's starter.
