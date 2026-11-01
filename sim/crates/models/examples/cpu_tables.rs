//! Prints the test tables of the `cpu` and `computer` levels: each is a
//! program traced through the level's model, two steps (clk 0, clk 1) per
//! instruction, with `-` wherever the value isn't known yet.
//!
//!     cargo run -p s2t-models --example cpu_tables -- cpu
//!     cargo run -p s2t-models --example cpu_tables -- computer
//!     cargo run -p s2t-models --example cpu_tables -- decode
use s2t_isa::{encode, AluOp, Bus, Cond, Instr, Memory, Shift as Dir, ShiftBy};
use s2t_models::clocked;

fn cell(v: Option<u64>, hex: bool) -> String {
    match v {
        None => "-".into(),
        Some(v) if hex => format!("{v:#06x}"),
        Some(v) => v.to_string(),
    }
}

fn row(ins: &[u64], outs: &[Option<u64>], comment: &str) {
    let ins: Vec<String> = ins
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            if i == 0 {
                format!("{v:#06x}")
            } else {
                v.to_string()
            }
        })
        .collect();
    let outs: Vec<String> = outs.iter().map(|&v| cell(v, false)).collect();
    if !comment.is_empty() {
        println!("# {comment}");
    }
    println!("{} | {}", ins.join(" "), outs.join(" "));
}

fn words(program: &[Instr]) -> Vec<u16> {
    program
        .iter()
        .map(|i| encode(i).expect("valid program"))
        .collect()
}

fn cpu() {
    use Instr::*;
    let program = [
        Set { rd: 1, imm: 5 },
        Set { rd: 2, imm: 7 },
        Alu {
            rd: 3,
            ra: 1,
            rb: 2,
            op: AluOp::ADD,
        },
        Alu {
            rd: 4,
            ra: 1,
            rb: 2,
            op: AluOp::SUB,
        },
        SetHigh { rd: 4, imm: 0x12 },
        Alu {
            rd: 5,
            ra: 4,
            rb: 2,
            op: AluOp::AND,
        },
        Shift {
            rd: 5,
            ra: 1,
            kind: Dir::Left,
            by: ShiftBy::Amount(3),
        },
        Shift {
            rd: 6,
            ra: 4,
            kind: Dir::Arith,
            by: ShiftBy::Reg(1),
        },
        Set { rd: 0, imm: 100 },
        Store {
            rs: 3,
            ra: 0,
            off: 2,
        },
        Load {
            rd: 6,
            ra: 0,
            off: 2,
        },
        Cmp {
            ra: 6,
            rb: 3,
            op: AluOp::SUB,
        },
        Jump {
            cond: Cond::Zero,
            off: 2,
        },
        Set { rd: 6, imm: 0 },
        Call { off: 3 },
        AddI { rd: 1, imm: 1 },
        Jump {
            cond: Cond::Always,
            off: 0,
        },
        SubI { rd: 2, imm: 1 },
        Jr { ra: 7, link: false },
    ];
    let rom = words(&program);
    let m = clocked("cpu").expect("cpu model");
    let mut state = vec![None; m.words];
    let mut mem = Memory::default();
    println!("instr inM reset clk | pc addrM outM writeM");
    let mut first = true;
    for _ in 0..24 {
        let reset = u64::from(first);
        let pc = state[8].unwrap_or(0) as usize;
        let instr = rom.get(pc).copied().unwrap_or(0) as u64;
        let read = |inm: u64, clk: u64, st: &[Option<u64>]| {
            (m.read)(&[Some(instr), Some(inm), Some(reset), Some(clk)], st)
        };
        let addr = read(0, 0, &state)[1];
        let in_m = addr.map_or(0, |a| mem.read(a as u16) as u64);
        let text = if first {
            "reset".to_string()
        } else {
            s2t_isa::decode(instr as u16).to_string()
        };
        let low = read(in_m, 0, &state);
        row(&[instr, in_m, reset, 0], &low, &text);
        if low[3] == Some(1) {
            if let (Some(a), Some(v)) = (low[1], low[2]) {
                mem.write(a as u16, v as u16);
            }
        }
        (m.tick)(&[Some(instr), Some(in_m), Some(reset), Some(1)], &mut state);
        row(&[instr, in_m, reset, 1], &read(in_m, 1, &state), "");
        first = false;
    }
}

fn computer() {
    use Instr::*;
    let program = [
        Set { rd: 0, imm: 0 },
        Set { rd: 1, imm: 4 },
        Alu {
            rd: 0,
            ra: 0,
            rb: 1,
            op: AluOp::ADD,
        }, // loop: sum 4 + 3 + 2 + 1
        SubI { rd: 1, imm: 1 },
        Jump {
            cond: Cond::NotZero,
            off: -2,
        },
        Set { rd: 2, imm: 100 },
        Store {
            rs: 0,
            ra: 2,
            off: 0,
        }, // RAM[100] = 10
        Load {
            rd: 3,
            ra: 2,
            off: 0,
        },
        Set { rd: 4, imm: 0 },
        SetHigh { rd: 4, imm: 0x40 },
        Store {
            rs: 3,
            ra: 4,
            off: 1,
        }, // screen word 1 = 10
        Load {
            rd: 5,
            ra: 4,
            off: 1,
        },
        Store {
            rs: 5,
            ra: 2,
            off: 1,
        }, // shows 10 on outM: read back from the screen
        Set { rd: 6, imm: 0 },
        SetHigh { rd: 6, imm: 0x60 },
        Load {
            rd: 6,
            ra: 6,
            off: 0,
        }, // the keyboard
        Store {
            rs: 6,
            ra: 2,
            off: 2,
        }, // shows the key on outM
        SetHigh { rd: 4, imm: 0x43 },
        Load {
            rd: 5,
            ra: 4,
            off: 0,
        }, // 0x4300: past the screen, reads 0
        Store {
            rs: 5,
            ra: 2,
            off: 3,
        },
        Jump {
            cond: Cond::Always,
            off: 0,
        },
    ];
    let rom = words(&program);
    let m = clocked("computer").expect("computer model");
    let mut state = vec![None; m.words];
    let key = 65;
    println!("instr key reset clk | pc addrM outM writeM");
    let mut first = true;
    for _ in 0..34 {
        let reset = u64::from(first);
        let pc = state[8].unwrap_or(0) as usize;
        let instr = rom.get(pc).copied().unwrap_or(0) as u64;
        let ins = |clk| [Some(instr), Some(key), Some(reset), Some(clk)];
        let text = if first {
            "reset".to_string()
        } else {
            s2t_isa::decode(instr as u16).to_string()
        };
        row(&[instr, key, reset, 0], &(m.read)(&ins(0), &state), &text);
        (m.tick)(&ins(1), &mut state);
        row(&[instr, key, reset, 1], &(m.read)(&ins(1), &state), "");
        first = false;
    }
}

/// One row per instruction group, plus each jump condition both ways.
fn decode() {
    use Instr::*;
    let m = s2t_models::model("decode").expect("decode model");
    println!("instr z n c | wa we ra rb f invb cin useimm imm rsel setflags writeM jump jr off");
    let rows: Vec<(Instr, [u64; 3])> = vec![
        (
            Alu {
                rd: 1,
                ra: 2,
                rb: 3,
                op: AluOp::SUB,
            },
            [0, 0, 0],
        ),
        (
            Alu {
                rd: 7,
                ra: 6,
                rb: 5,
                op: AluOp::XORN,
            },
            [0, 0, 0],
        ),
        (
            Cmp {
                ra: 4,
                rb: 5,
                op: AluOp::SUB,
            },
            [0, 0, 0],
        ),
        (Set { rd: 3, imm: 200 }, [0, 0, 0]),
        (SetHigh { rd: 6, imm: 0x40 }, [0, 0, 0]),
        (AddI { rd: 2, imm: 1 }, [0, 0, 0]),
        (SubI { rd: 2, imm: 129 }, [0, 0, 0]),
        (
            Shift {
                rd: 1,
                ra: 2,
                kind: Dir::Left,
                by: ShiftBy::Amount(3),
            },
            [0, 0, 0],
        ),
        (
            Shift {
                rd: 1,
                ra: 2,
                kind: Dir::Arith,
                by: ShiftBy::Reg(5),
            },
            [0, 0, 0],
        ),
        (
            Load {
                rd: 4,
                ra: 6,
                off: 127,
            },
            [0, 0, 0],
        ),
        (
            Store {
                rs: 3,
                ra: 6,
                off: 5,
            },
            [0, 0, 0],
        ),
        (
            Jump {
                cond: Cond::Always,
                off: -2,
            },
            [0, 0, 0],
        ),
        (
            Jump {
                cond: Cond::Zero,
                off: 100,
            },
            [0, 0, 0],
        ),
        (
            Jump {
                cond: Cond::Zero,
                off: 100,
            },
            [1, 0, 0],
        ),
        (
            Jump {
                cond: Cond::NotZero,
                off: 100,
            },
            [1, 0, 0],
        ),
        (
            Jump {
                cond: Cond::Negative,
                off: -300,
            },
            [0, 1, 0],
        ),
        (
            Jump {
                cond: Cond::NotNegative,
                off: -300,
            },
            [0, 1, 0],
        ),
        (
            Jump {
                cond: Cond::Carry,
                off: 7,
            },
            [0, 0, 1],
        ),
        (
            Jump {
                cond: Cond::NoCarry,
                off: 7,
            },
            [0, 0, 1],
        ),
        (
            Jump {
                cond: Cond::Higher,
                off: 7,
            },
            [1, 0, 1],
        ),
        (
            Jump {
                cond: Cond::Higher,
                off: 7,
            },
            [0, 0, 1],
        ),
        (Call { off: -1000 }, [0, 0, 0]),
        (Jr { ra: 7, link: false }, [0, 0, 0]),
        (Jr { ra: 2, link: true }, [0, 0, 0]),
    ];
    for (i, f) in rows {
        let w = encode(&i).expect("valid") as u64;
        let out = m.eval_words(&[w, f[0], f[1], f[2]]);
        println!("# {i}");
        let outs: Vec<String> = out.iter().map(|v| v.to_string()).collect();
        println!("{w:#06x} {} {} {} | {}", f[0], f[1], f[2], outs.join(" "));
    }
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("cpu") => cpu(),
        Some("computer") => computer(),
        Some("decode") => decode(),
        _ => eprintln!("usage: cpu_tables cpu|computer|decode"),
    }
}
