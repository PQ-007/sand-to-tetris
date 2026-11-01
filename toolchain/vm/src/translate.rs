//! Stage 2 and 3: commands into assembly, using the registers and frame
//! layout in docs/VM.md ("Memory and registers").
use crate::{Command, Ctx, Seg, STACK_TOP};

/// An instruction line, indented under the labels.
fn i(text: &str) -> String {
    format!("        {text}")
}

/// Push r`reg`.
fn push(reg: u8) -> [String; 2] {
    [i("SUBI r6, 1"), i(&format!("STORE r{reg}, [r6]"))]
}

/// Pop into r`reg`.
fn pop(reg: u8) -> [String; 2] {
    [i(&format!("LOAD r{reg}, [r6]")), i("ADDI r6, 1")]
}

/// Pops b into r1 and leaves a in r0, its slot the new top.
fn two() -> Vec<String> {
    let mut out = pop(1).to_vec();
    out.push(i("LOAD r0, [r6]"));
    out
}

/// The frame offset (from FP) of a local or argument.
fn offset(seg: Seg, n: u16, ctx: &Ctx) -> u16 {
    match seg {
        Seg::Arg => ctx.locals + 2 + (ctx.args - 1 - n),
        _ => n,
    }
}

/// r2 = −1 if a < b (signed), else 0, for a in `a` and b in `b`: the sign
/// of a − b, corrected when it overflows (when a and b have different
/// signs and the difference's sign differs from a's).
fn less(a: u8, b: u8) -> Vec<String> {
    vec![
        i(&format!("SUB r2, r{a}, r{b}")),
        i(&format!("XOR r3, r{a}, r{b}")),
        i(&format!("XOR r4, r{a}, r2")),
        i("AND r3, r3, r4"),
        i("XOR r2, r2, r3"),
        i("SAR r2, r2, 15"),
    ]
}

/// The assembly for one command.
pub fn translate(cmd: &Command, ctx: &Ctx) -> Vec<String> {
    let label = |name: &str| format!("{}__{name}", ctx.func);
    let mut out: Vec<String> = Vec::new();
    let binary = |op: &str| {
        let mut v = two();
        v.push(i(&format!("{op} r0, r0, r1")));
        v.push(i("STORE r0, [r6]"));
        v
    };
    match cmd {
        Command::Push { seg, n } => {
            match seg {
                Seg::Const => out.push(i(&format!("SET16 r0, {n}"))),
                Seg::Global => {
                    out.push(i(&format!("SET16 r1, {n}")));
                    out.push(i("LOAD r0, [r1]"));
                }
                _ => out.push(i(&format!("LOAD r0, [r5 + {}]", offset(*seg, *n, ctx)))),
            }
            out.extend(push(0));
        }
        Command::Set { seg, n } => {
            out.extend(pop(0));
            match seg {
                Seg::Global => {
                    out.push(i(&format!("SET16 r1, {n}")));
                    out.push(i("STORE r0, [r1]"));
                }
                _ => out.push(i(&format!("STORE r0, [r5 + {}]", offset(*seg, *n, ctx)))),
            }
        }
        Command::Pop => out.push(i("ADDI r6, 1")),
        Command::Dup => {
            out.push(i("LOAD r0, [r6]"));
            out.extend(push(0));
        }
        Command::Load => {
            out.push(i("LOAD r0, [r6]"));
            out.push(i("LOAD r0, [r0]"));
            out.push(i("STORE r0, [r6]"));
        }
        Command::Store => {
            out.push(i("LOAD r1, [r6]"));
            out.push(i("LOAD r0, [r6 + 1]"));
            out.push(i("STORE r1, [r0]"));
            out.push(i("ADDI r6, 2"));
        }
        Command::Add => out = binary("ADD"),
        Command::Sub => out = binary("SUB"),
        Command::And => out = binary("AND"),
        Command::Or => out = binary("OR"),
        Command::Xor => out = binary("XOR"),
        Command::Shl => out = binary("SHL"),
        Command::Shr => out = binary("SHR"),
        Command::Sar => out = binary("SAR"),
        Command::Neg | Command::Not => {
            out.push(i("LOAD r0, [r6]"));
            out.push(i("SET r1, 0"));
            out.push(i(if *cmd == Command::Neg {
                "SUB r0, r1, r0"
            } else {
                "XORN r0, r0, r1"
            }));
            out.push(i("STORE r0, [r6]"));
        }
        Command::Mul | Command::Div | Command::Mod => {
            out = two();
            let routine = if *cmd == Command::Mul {
                "__mul"
            } else {
                "__div"
            };
            out.push(i(&format!("SET16 r2, {routine}")));
            out.push(i("CALLR r2"));
            out.push(i(if *cmd == Command::Mod {
                "STORE r1, [r6]"
            } else {
                "STORE r0, [r6]"
            }));
        }
        Command::Eq | Command::Ne => {
            // r2 = 0, then −1 unless the jump skips that.
            out = two();
            out.push(i("SET r2, 0"));
            out.push(i("CMP r0, r1"));
            out.push(i(if *cmd == Command::Eq { "JNZ 2" } else { "JZ 2" }));
            out.push(i("SUBI r2, 1"));
            out.push(i("STORE r2, [r6]"));
        }
        Command::Lt | Command::Gt | Command::Le | Command::Ge => {
            out = two();
            // a > b is b < a; a >= b is NOT (a < b); a <= b is NOT (b < a).
            let swap = matches!(cmd, Command::Gt | Command::Le);
            out.extend(if swap { less(1, 0) } else { less(0, 1) });
            if matches!(cmd, Command::Le | Command::Ge) {
                out.push(i("SET r3, 0"));
                out.push(i("XORN r2, r2, r3"));
            }
            out.push(i("STORE r2, [r6]"));
        }
        Command::Label { name } => out.push(format!("{}:", label(name))),
        Command::Jump { name } => out.push(i(&format!("JMP {}", label(name)))),
        Command::Jumpif { name } | Command::Jumpifnot { name } => {
            out.extend(pop(0));
            out.push(i("TEST r0, r0"));
            let jump = if matches!(cmd, Command::Jumpif { .. }) {
                "JNZ"
            } else {
                "JZ"
            };
            out.push(i(&format!("{jump} {}", label(name))));
        }
        Command::Func { name, locals, .. } => {
            out.push(format!("{name}:"));
            out.push(i("SUBI r6, 2"));
            out.push(i("STORE r7, [r6 + 1]"));
            out.push(i("STORE r5, [r6]"));
            if *locals > 0 {
                out.push(i(&format!("SUBI r6, {locals}")));
            }
            out.push(i("MOV r5, r6"));
            if *locals > 0 {
                out.push(i("SET r0, 0"));
                for n in 0..*locals {
                    out.push(i(&format!("STORE r0, [r5 + {n}]")));
                }
            }
        }
        Command::Call { name, .. } => {
            out.push(i(&format!("SET16 r0, {name}")));
            out.push(i("CALLR r0"));
        }
        Command::Return => {
            let k = ctx.locals;
            out.push(i("LOAD r0, [r6]"));
            out.push(i(&format!("LOAD r7, [r5 + {}]", k + 1)));
            out.push(i(&format!("LOAD r1, [r5 + {k}]")));
            out.push(i("MOV r6, r5"));
            out.push(i(&format!("ADDI r6, {}", k + 1 + ctx.args)));
            out.push(i("STORE r0, [r6]"));
            out.push(i("MOV r5, r1"));
            out.push(i("RET"));
        }
    }
    out
}

/// The start of every program: an empty stack, then call main and halt.
pub fn bootstrap() -> Vec<String> {
    vec![
        i(&format!("SET16 r6, 0x{STACK_TOP:04X}")),
        i("MOV r5, r6"),
        i("SET16 r0, main"),
        i("CALLR r0"),
        i("HALT"),
    ]
}

/// `__mul` (r0 = r0 × r1) and `__div` (r0 = r0 ÷ r1, r1 = r0 mod r1,
/// signed), added once to a program that uses mul, div or mod.
pub fn runtime() -> Vec<String> {
    let lines = [
        "; r0 = r0 * r1: add r0 for every 1 bit of r1, doubling r0 each time",
        "__mul:",
        "SET  r2, 0",
        "SET  r3, 1",
        "__mul_loop:",
        "TEST r1, r1",
        "JZ   __mul_done",
        "TEST r1, r3",
        "JZ   __mul_skip",
        "ADD  r2, r2, r0",
        "__mul_skip:",
        "SHL  r0, r0, 1",
        "SHR  r1, r1, 1",
        "JMP  __mul_loop",
        "__mul_done:",
        "MOV  r0, r2",
        "RET",
        "; r0 = r0 / r1 and r1 = r0 mod r1, signed, rounding toward 0",
        "__div:",
        "TEST r1, r1",
        "JNZ  __div_go",
        "MOV  r1, r0",
        "SET  r0, 0",
        "SUBI r0, 1",
        "RET",
        "; r4 bit 0: negate the quotient; bit 1: negate the remainder",
        "__div_go:",
        "SET  r4, 0",
        "TEST r0, r0",
        "JNN  __div_a",
        "SET  r2, 0",
        "SUB  r0, r2, r0",
        "SET  r4, 3",
        "__div_a:",
        "TEST r1, r1",
        "JNN  __div_b",
        "SET  r2, 0",
        "SUB  r1, r2, r1",
        "SET  r2, 1",
        "XOR  r4, r4, r2",
        "; the signs wait on the stack; r4 counts the 16 bits",
        "__div_b:",
        "SUBI r6, 1",
        "STORE r4, [r6]",
        "SET  r2, 0",
        "SET  r3, 0",
        "SET  r4, 16",
        "; long division: bring down the next bit; subtract when it fits",
        "__div_loop:",
        "SHL  r3, r3, 1",
        "TEST r0, r0",
        "JNN  2",
        "ADDI r3, 1",
        "SHL  r0, r0, 1",
        "SHL  r2, r2, 1",
        "CMP  r3, r1",
        "JNC  3",
        "SUB  r3, r3, r1",
        "ADDI r2, 1",
        "SUBI r4, 1",
        "JNZ  __div_loop",
        "LOAD r4, [r6]",
        "ADDI r6, 1",
        "SET  r0, 1",
        "TEST r4, r0",
        "JZ   3",
        "SET  r0, 0",
        "SUB  r2, r0, r2",
        "SET  r0, 2",
        "TEST r4, r0",
        "JZ   3",
        "SET  r0, 0",
        "SUB  r3, r0, r3",
        "MOV  r0, r2",
        "MOV  r1, r3",
        "RET",
    ];
    lines
        .iter()
        .map(|l| {
            if l.ends_with(':') || l.starts_with(';') {
                l.to_string()
            } else {
                i(l)
            }
        })
        .collect()
}
