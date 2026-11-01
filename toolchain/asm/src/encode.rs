//! Stage 4 (pass 2): one line into its words, using the symbol table.
use s2t_isa::{AluOp, Cond, Instr, Shift, ShiftBy};

use crate::{describe, AsmError, Body, Operand, Placed, Symbols};

/// The words of one placed line: instructions for `.code`, values for
/// `.word` and zeros for `.space`.
pub fn encode(body: &Body, symbols: &Symbols, placed: &Placed) -> Result<Vec<u16>, AsmError> {
    let e = Enc {
        symbols,
        address: placed.address as i32,
    };
    match body {
        Body::Dir { name, args } if name == "word" => args
            .iter()
            .map(|a| e.ranged(a, -32768, 65535, "word").map(|v| v as u16))
            .collect(),
        Body::Dir { .. } => Ok(vec![0; placed.size as usize]),
        Body::Instr { mnemonic, args } => {
            let instrs = e.instr(mnemonic, args, placed.size)?;
            instrs
                .iter()
                .map(|i| {
                    s2t_isa::encode(i).map_err(|err| range_error(err.field, err.value, err.range))
                })
                .collect()
        }
    }
}

pub(crate) fn count_error(mnemonic: &str, expected: &str, found: usize) -> AsmError {
    AsmError::new(
        "operand-count",
        format!("{mnemonic} takes {expected} operand(s), not {found}"),
        &[
            ("mnemonic", mnemonic.to_string()),
            ("expected", expected.to_string()),
            ("found", found.to_string()),
        ],
    )
}

pub(crate) fn range_error(what: &str, value: i32, range: &str) -> AsmError {
    AsmError::new(
        "out-of-range",
        format!("{what} = {value} doesn't fit: it must be {range}"),
        &[
            ("what", what.to_string()),
            ("value", value.to_string()),
            ("range", range.to_string()),
        ],
    )
}

struct Enc<'a> {
    symbols: &'a Symbols,
    address: i32,
}

const ALU_OPS: [(&str, AluOp); 8] = [
    ("ADD", AluOp::ADD),
    ("SUB", AluOp::SUB),
    ("AND", AluOp::AND),
    ("ANDN", AluOp::ANDN),
    ("OR", AluOp::OR),
    ("ORN", AluOp::ORN),
    ("XOR", AluOp::XOR),
    ("XORN", AluOp::XORN),
];

const JUMPS: [(&str, Cond); 12] = [
    ("JMP", Cond::Always),
    ("JZ", Cond::Zero),
    ("JEQ", Cond::Zero),
    ("JNZ", Cond::NotZero),
    ("JNE", Cond::NotZero),
    ("JN", Cond::Negative),
    ("JNN", Cond::NotNegative),
    ("JC", Cond::Carry),
    ("JHS", Cond::Carry),
    ("JNC", Cond::NoCarry),
    ("JLO", Cond::NoCarry),
    ("JHI", Cond::Higher),
];

impl Enc<'_> {
    fn count(&self, m: &str, args: &[Operand], n: usize) -> Result<(), AsmError> {
        if args.len() == n {
            Ok(())
        } else {
            Err(count_error(m, &n.to_string(), args.len()))
        }
    }

    fn reg(&self, op: &Operand) -> Result<u8, AsmError> {
        match op {
            Operand::Reg { reg } => Ok(*reg),
            other => Err(AsmError::new(
                "not-a-register",
                format!("expected a register (r0–r7), found {}", describe(other)),
                &[("found", describe(other))],
            )),
        }
    }

    fn value(&self, op: &Operand) -> Result<i32, AsmError> {
        match op {
            Operand::Num { value } => Ok(*value),
            Operand::Sym { name } => self.symbols.get(name).map(|s| s.value).ok_or_else(|| {
                AsmError::new(
                    "unknown-symbol",
                    format!("`{name}` isn't defined"),
                    &[("name", name.clone())],
                )
            }),
            other => Err(AsmError::new(
                "bad-operand",
                format!("expected a number, found {}", describe(other)),
                &[("expected", "number".into()), ("found", describe(other))],
            )),
        }
    }

    fn ranged(&self, op: &Operand, lo: i32, hi: i32, what: &str) -> Result<i32, AsmError> {
        let v = self.value(op)?;
        if (lo..=hi).contains(&v) {
            Ok(v)
        } else {
            Err(range_error(what, v, &format!("{lo}..{hi}")))
        }
    }

    fn byte(&self, op: &Operand) -> Result<u8, AsmError> {
        Ok(self.ranged(op, 0, 255, "n")? as u8)
    }

    fn mem(&self, op: &Operand) -> Result<(u8, u8), AsmError> {
        match op {
            Operand::Mem { reg, offset } => {
                Ok((*reg, self.ranged(offset, 0, 127, "offset")? as u8))
            }
            other => Err(AsmError::new(
                "bad-operand",
                format!(
                    "expected a memory reference like [r1 + 2], found {}",
                    describe(other)
                ),
                &[("expected", "memory".into()), ("found", describe(other))],
            )),
        }
    }

    /// A jump or call target: a code label (the offset is worked out), or
    /// a number, which is the offset itself.
    fn target(&self, m: &str, op: &Operand, lo: i32, hi: i32) -> Result<i16, AsmError> {
        if let Operand::Sym { name } = op {
            if let Some(sym) = self.symbols.get(name) {
                match sym.kind.as_str() {
                    "data" => {
                        return Err(AsmError::new(
                            "jump-to-data",
                            format!("`{name}` is a data address (RAM), not a place in the program"),
                            &[("name", name.clone())],
                        ))
                    }
                    "code" => {
                        let distance = sym.value - self.address;
                        if !(lo..=hi).contains(&distance) {
                            return Err(AsmError::new(
                                "jump-too-far",
                                format!("`{name}` is {distance} instructions away; {m} reaches {lo}..{hi}"),
                                &[
                                    ("target", name.clone()),
                                    ("distance", distance.to_string()),
                                    ("mnemonic", m.to_string()),
                                    ("range", format!("{lo}..{hi}")),
                                ],
                            ));
                        }
                        return Ok(distance as i16);
                    }
                    _ => {}
                }
            }
        }
        Ok(self.ranged(op, lo, hi, "offset")? as i16)
    }

    fn instr(&self, m: &str, a: &[Operand], size: u16) -> Result<Vec<Instr>, AsmError> {
        if let Some((_, op)) = ALU_OPS.iter().find(|(n, _)| *n == m) {
            self.count(m, a, 3)?;
            return Ok(vec![Instr::Alu {
                rd: self.reg(&a[0])?,
                ra: self.reg(&a[1])?,
                rb: self.reg(&a[2])?,
                op: *op,
            }]);
        }
        if let Some((_, cond)) = JUMPS.iter().find(|(n, _)| *n == m) {
            self.count(m, a, 1)?;
            return Ok(vec![Instr::Jump {
                cond: *cond,
                off: self.target(m, &a[0], -512, 511)?,
            }]);
        }
        let one = |i: Instr| Ok(vec![i]);
        match m {
            "ALU" => {
                self.count(m, a, 6)?;
                one(Instr::Alu {
                    rd: self.reg(&a[0])?,
                    ra: self.reg(&a[1])?,
                    rb: self.reg(&a[2])?,
                    op: self.raw_op(&a[3..])?,
                })
            }
            "MOV" => {
                self.count(m, a, 2)?;
                let ra = self.reg(&a[1])?;
                one(Instr::Alu {
                    rd: self.reg(&a[0])?,
                    ra,
                    rb: ra,
                    op: AluOp::OR,
                })
            }
            "CMP" if a.len() == 5 => one(Instr::Cmp {
                ra: self.reg(&a[0])?,
                rb: self.reg(&a[1])?,
                op: self.raw_op(&a[2..])?,
            }),
            "CMP" | "TEST" => {
                if a.len() != 2 {
                    let expected = if m == "CMP" { "2 or 5" } else { "2" };
                    return Err(count_error(m, expected, a.len()));
                }
                one(Instr::Cmp {
                    ra: self.reg(&a[0])?,
                    rb: self.reg(&a[1])?,
                    op: if m == "CMP" { AluOp::SUB } else { AluOp::AND },
                })
            }
            "SET" | "SETH" | "ADDI" | "SUBI" => {
                self.count(m, a, 2)?;
                let (rd, imm) = (self.reg(&a[0])?, self.byte(&a[1])?);
                one(match m {
                    "SET" => Instr::Set { rd, imm },
                    "SETH" => Instr::SetHigh { rd, imm },
                    "ADDI" => Instr::AddI { rd, imm },
                    _ => Instr::SubI { rd, imm },
                })
            }
            "INC" | "DEC" => {
                self.count(m, a, 1)?;
                let rd = self.reg(&a[0])?;
                one(if m == "INC" {
                    Instr::AddI { rd, imm: 1 }
                } else {
                    Instr::SubI { rd, imm: 1 }
                })
            }
            "SET16" => {
                self.count(m, a, 2)?;
                let rd = self.reg(&a[0])?;
                let v = self.ranged(&a[1], -32768, 65535, "n")? as u16;
                if size == 1 {
                    one(Instr::Set {
                        rd,
                        imm: (v & 0xff) as u8,
                    })
                } else {
                    Ok(vec![
                        Instr::Set {
                            rd,
                            imm: (v & 0xff) as u8,
                        },
                        Instr::SetHigh {
                            rd,
                            imm: (v >> 8) as u8,
                        },
                    ])
                }
            }
            "SHL" | "SHR" | "SAR" => {
                self.count(m, a, 3)?;
                let by = match &a[2] {
                    Operand::Reg { reg } => ShiftBy::Reg(*reg),
                    other => ShiftBy::Amount(self.ranged(other, 0, 15, "n")? as u8),
                };
                one(Instr::Shift {
                    rd: self.reg(&a[0])?,
                    ra: self.reg(&a[1])?,
                    kind: match m {
                        "SHL" => Shift::Left,
                        "SHR" => Shift::Right,
                        _ => Shift::Arith,
                    },
                    by,
                })
            }
            "LOAD" | "STORE" => {
                self.count(m, a, 2)?;
                let r = self.reg(&a[0])?;
                let (ra, off) = self.mem(&a[1])?;
                one(if m == "LOAD" {
                    Instr::Load { rd: r, ra, off }
                } else {
                    Instr::Store { rs: r, ra, off }
                })
            }
            "CALL" => {
                self.count(m, a, 1)?;
                one(Instr::Call {
                    off: self.target(m, &a[0], -2048, 2047)?,
                })
            }
            "JR" | "CALLR" => {
                self.count(m, a, 1)?;
                one(Instr::Jr {
                    ra: self.reg(&a[0])?,
                    link: m == "CALLR",
                })
            }
            "RET" | "NOP" | "HALT" => {
                self.count(m, a, 0)?;
                one(match m {
                    "RET" => Instr::Jr { ra: 7, link: false },
                    "NOP" => Instr::Jump {
                        cond: Cond::Always,
                        off: 1,
                    },
                    _ => Instr::Jump {
                        cond: Cond::Always,
                        off: 0,
                    },
                })
            }
            other => Err(AsmError::new(
                "unknown-mnemonic",
                format!("`{other}` isn't an instruction"),
                &[("mnemonic", other.to_string())],
            )),
        }
    }

    /// f, invb, cin as numbers (the ALU and five-operand CMP forms).
    fn raw_op(&self, a: &[Operand]) -> Result<AluOp, AsmError> {
        Ok(AluOp::new(
            self.ranged(&a[0], 0, 3, "f")? as u8,
            self.ranged(&a[1], 0, 1, "invb")? == 1,
            self.ranged(&a[2], 0, 1, "cin")? == 1,
        ))
    }
}
