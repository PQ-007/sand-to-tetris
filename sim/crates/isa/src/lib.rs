//! The instruction set from `docs/ISA.md`, as code. `decode` turns any
//! 16-bit word into an [`Instr`] (every word is valid; ignored bits are
//! dropped), `encode` turns it back and checks that every field fits, and
//! [`Cpu::step`] runs one instruction. The toolchain (assembler, VM,
//! compiler) and the CPU's fast model build on this crate, so they all agree
//! with the spec.
#![forbid(unsafe_code)]

use std::fmt;

mod machine;
pub use machine::{
    alu, shift, trace, Bus, Cpu, Flags, Memory, KEYBOARD, RAM_WORDS, SCREEN, SCREEN_HEIGHT,
    SCREEN_WIDTH, SCREEN_WORDS,
};

/// The ALU's control inputs, straight from bits 3–0 of an ALU or CMP word.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AluOp {
    /// 0 = ADD, 1 = AND, 2 = OR, 3 = XOR
    pub f: u8,
    pub invb: bool,
    pub cin: bool,
}

impl AluOp {
    pub const ADD: AluOp = AluOp::new(0, false, false);
    pub const SUB: AluOp = AluOp::new(0, true, true);
    pub const AND: AluOp = AluOp::new(1, false, false);
    pub const ANDN: AluOp = AluOp::new(1, true, false);
    pub const OR: AluOp = AluOp::new(2, false, false);
    pub const ORN: AluOp = AluOp::new(2, true, false);
    pub const XOR: AluOp = AluOp::new(3, false, false);
    pub const XORN: AluOp = AluOp::new(3, true, false);

    pub const fn new(f: u8, invb: bool, cin: bool) -> AluOp {
        AluOp { f, invb, cin }
    }

    /// The assembly name, if this combination has one.
    pub fn name(self) -> Option<&'static str> {
        const NAMED: [(AluOp, &str); 8] = [
            (AluOp::ADD, "ADD"),
            (AluOp::SUB, "SUB"),
            (AluOp::AND, "AND"),
            (AluOp::ANDN, "ANDN"),
            (AluOp::OR, "OR"),
            (AluOp::ORN, "ORN"),
            (AluOp::XOR, "XOR"),
            (AluOp::XORN, "XORN"),
        ];
        NAMED.iter().find(|(op, _)| *op == self).map(|(_, n)| *n)
    }

    fn bits(self) -> u16 {
        (self.f as u16 & 3) << 2 | (self.invb as u16) << 1 | self.cin as u16
    }

    fn from_bits(w: u16) -> AluOp {
        AluOp::new((w >> 2 & 3) as u8, w >> 1 & 1 == 1, w & 1 == 1)
    }
}

/// The 8 jump conditions, in encoding order (cond = 0..7).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cond {
    Always,
    Zero,
    NotZero,
    Negative,
    NotNegative,
    Carry,
    NoCarry,
    /// C and not Z: after `CMP a, b`, a > b (unsigned).
    Higher,
}

impl Cond {
    const ALL: [Cond; 8] = [
        Cond::Always,
        Cond::Zero,
        Cond::NotZero,
        Cond::Negative,
        Cond::NotNegative,
        Cond::Carry,
        Cond::NoCarry,
        Cond::Higher,
    ];

    pub fn holds(self, f: Flags) -> bool {
        match self {
            Cond::Always => true,
            Cond::Zero => f.z,
            Cond::NotZero => !f.z,
            Cond::Negative => f.n,
            Cond::NotNegative => !f.n,
            Cond::Carry => f.c,
            Cond::NoCarry => !f.c,
            Cond::Higher => f.c && !f.z,
        }
    }

    pub fn mnemonic(self) -> &'static str {
        ["JMP", "JZ", "JNZ", "JN", "JNN", "JC", "JNC", "JHI"][self as usize]
    }
}

/// Which way a SHIFT moves bits.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Shift {
    /// Toward bit 15, zeros in (SHL).
    Left,
    /// Toward bit 0, zeros in (SHR).
    Right,
    /// Toward bit 0, copies of bit 15 in (SAR).
    Arith,
}

/// How far a SHIFT moves bits.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ShiftBy {
    /// A constant 0..15.
    Amount(u8),
    /// The low 4 bits of a register.
    Reg(u8),
}

/// One instruction. Register numbers are 0..7.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Instr {
    Alu {
        rd: u8,
        ra: u8,
        rb: u8,
        op: AluOp,
    },
    Cmp {
        ra: u8,
        rb: u8,
        op: AluOp,
    },
    Set {
        rd: u8,
        imm: u8,
    },
    SetHigh {
        rd: u8,
        imm: u8,
    },
    AddI {
        rd: u8,
        imm: u8,
    },
    SubI {
        rd: u8,
        imm: u8,
    },
    Shift {
        rd: u8,
        ra: u8,
        kind: Shift,
        by: ShiftBy,
    },
    /// rd ← MEM[ra + off], off 0..127
    Load {
        rd: u8,
        ra: u8,
        off: u8,
    },
    /// MEM[ra + off] ← rs, off 0..127
    Store {
        rs: u8,
        ra: u8,
        off: u8,
    },
    /// off counts from the jump itself: −512..511
    Jump {
        cond: Cond,
        off: i16,
    },
    /// r7 ← PC + 1; PC ← PC + off (−2048..2047)
    Call {
        off: i16,
    },
    /// PC ← ra; with link, r7 ← PC + 1 as well (CALLR). `RET` is JR r7.
    Jr {
        ra: u8,
        link: bool,
    },
}

/// A field that doesn't fit its bits, e.g. register 8 or a jump too far.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EncodeError {
    pub field: &'static str,
    pub value: i32,
    pub range: &'static str,
}

impl fmt::Display for EncodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} = {} doesn't fit: it must be {}",
            self.field, self.value, self.range
        )
    }
}

impl std::error::Error for EncodeError {}

fn reg(field: &'static str, r: u8) -> Result<u16, EncodeError> {
    unsigned(field, r as u16, 7, "0..7")
}

fn unsigned(
    field: &'static str,
    v: u16,
    max: u16,
    range: &'static str,
) -> Result<u16, EncodeError> {
    if v > max {
        return Err(EncodeError {
            field,
            value: v as i32,
            range,
        });
    }
    Ok(v)
}

fn signed(field: &'static str, v: i16, bits: u32, range: &'static str) -> Result<u16, EncodeError> {
    let lo = -(1i32 << (bits - 1));
    let hi = (1i32 << (bits - 1)) - 1;
    if (v as i32) < lo || (v as i32) > hi {
        return Err(EncodeError {
            field,
            value: v as i32,
            range,
        });
    }
    Ok(v as u16 & ((1u16 << bits) - 1))
}

/// Sign-extends the low `bits` bits of `w`.
fn sext(w: u16, bits: u32) -> i16 {
    let shift = 16 - bits;
    ((w << shift) as i16) >> shift
}

/// The 16-bit word for `i`, or which field doesn't fit.
pub fn encode(i: &Instr) -> Result<u16, EncodeError> {
    Ok(match *i {
        Instr::Alu { rd, ra, rb, op } => {
            reg("rd", rd)? << 10 | reg("ra", ra)? << 7 | reg("rb", rb)? << 4 | alu_bits(op)?
        }
        Instr::Cmp { ra, rb, op } => {
            0b001 << 13 | reg("ra", ra)? << 7 | reg("rb", rb)? << 4 | alu_bits(op)?
        }
        Instr::Set { rd, imm } => imm_word(rd, 0, imm)?,
        Instr::SetHigh { rd, imm } => imm_word(rd, 1, imm)?,
        Instr::AddI { rd, imm } => imm_word(rd, 2, imm)?,
        Instr::SubI { rd, imm } => imm_word(rd, 3, imm)?,
        Instr::Shift { rd, ra, kind, by } => {
            let dir = match kind {
                Shift::Left => 0b00,
                Shift::Right => 0b10,
                Shift::Arith => 0b11,
            };
            let (r, low) = match by {
                ShiftBy::Amount(n) => (0, unsigned("shift amount", n as u16, 15, "0..15")?),
                ShiftBy::Reg(rb) => (1, reg("rb", rb)?),
            };
            0b011 << 13 | reg("rd", rd)? << 10 | reg("ra", ra)? << 7 | r << 6 | dir << 4 | low
        }
        Instr::Load { rd, ra, off } => mem_word(0b100, rd, ra, off)?,
        Instr::Store { rs, ra, off } => mem_word(0b101, rs, ra, off)?,
        Instr::Jump { cond, off } => {
            0b110 << 13 | (cond as u16) << 10 | signed("jump offset", off, 10, "-512..511")?
        }
        Instr::Call { off } => 0b111 << 13 | signed("call offset", off, 12, "-2048..2047")?,
        Instr::Jr { ra, link } => 0b111 << 13 | 1 << 12 | (link as u16) << 11 | reg("ra", ra)? << 8,
    })
}

fn alu_bits(op: AluOp) -> Result<u16, EncodeError> {
    unsigned("f", op.f as u16, 3, "0..3")?;
    Ok(op.bits())
}

fn imm_word(rd: u8, k: u16, imm: u8) -> Result<u16, EncodeError> {
    Ok(0b010 << 13 | reg("rd", rd)? << 10 | k << 8 | imm as u16)
}

fn mem_word(op: u16, r: u8, ra: u8, off: u8) -> Result<u16, EncodeError> {
    let off = unsigned("offset", off as u16, 127, "0..127")?;
    Ok(op << 13 | reg("register", r)? << 10 | reg("ra", ra)? << 7 | off)
}

/// The instruction a word means. Every word means something.
pub fn decode(w: u16) -> Instr {
    let r = |shift: u32| (w >> shift & 7) as u8;
    let (rd, ra, rb) = (r(10), r(7), r(4));
    let imm = (w & 0xff) as u8;
    match w >> 13 {
        0b000 => Instr::Alu {
            rd,
            ra,
            rb,
            op: AluOp::from_bits(w),
        },
        0b001 => Instr::Cmp {
            ra,
            rb,
            op: AluOp::from_bits(w),
        },
        0b010 => match w >> 8 & 3 {
            0 => Instr::Set { rd, imm },
            1 => Instr::SetHigh { rd, imm },
            2 => Instr::AddI { rd, imm },
            _ => Instr::SubI { rd, imm },
        },
        0b011 => {
            let kind = match (w >> 5 & 1, w >> 4 & 1) {
                (0, _) => Shift::Left,
                (_, 0) => Shift::Right,
                _ => Shift::Arith,
            };
            let by = if w >> 6 & 1 == 1 {
                ShiftBy::Reg(r(0))
            } else {
                ShiftBy::Amount((w & 15) as u8)
            };
            Instr::Shift { rd, ra, kind, by }
        }
        0b100 => Instr::Load {
            rd,
            ra,
            off: (w & 0x7f) as u8,
        },
        0b101 => Instr::Store {
            rs: rd,
            ra,
            off: (w & 0x7f) as u8,
        },
        0b110 => Instr::Jump {
            cond: Cond::ALL[(w >> 10 & 7) as usize],
            off: sext(w, 10),
        },
        _ if w >> 12 & 1 == 0 => Instr::Call { off: sext(w, 12) },
        _ => Instr::Jr {
            ra: r(8),
            link: w >> 11 & 1 == 1,
        },
    }
}

impl fmt::Display for Instr {
    /// The instruction in assembly. Jump and call targets print as the
    /// offset; the assembler and disassembler turn them into labels.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let raw = |op: AluOp| format!("f={} invb={} cin={}", op.f, op.invb as u8, op.cin as u8);
        match *self {
            Instr::Alu { rd, ra, rb, op } => match op.name() {
                Some(name) => write!(f, "{name} r{rd}, r{ra}, r{rb}"),
                None => write!(f, "ALU r{rd}, r{ra}, r{rb}, {}", raw(op)),
            },
            Instr::Cmp { ra, rb, op } => match op {
                AluOp::SUB => write!(f, "CMP r{ra}, r{rb}"),
                AluOp::AND => write!(f, "TEST r{ra}, r{rb}"),
                _ => write!(f, "CMP r{ra}, r{rb}, {}", raw(op)),
            },
            Instr::Set { rd, imm } => write!(f, "SET r{rd}, {imm}"),
            Instr::SetHigh { rd, imm } => write!(f, "SETH r{rd}, {imm}"),
            Instr::AddI { rd, imm } => write!(f, "ADDI r{rd}, {imm}"),
            Instr::SubI { rd, imm } => write!(f, "SUBI r{rd}, {imm}"),
            Instr::Shift { rd, ra, kind, by } => {
                let name = match kind {
                    Shift::Left => "SHL",
                    Shift::Right => "SHR",
                    Shift::Arith => "SAR",
                };
                match by {
                    ShiftBy::Amount(n) => write!(f, "{name} r{rd}, r{ra}, {n}"),
                    ShiftBy::Reg(rb) => write!(f, "{name} r{rd}, r{ra}, r{rb}"),
                }
            }
            Instr::Load { rd, ra, off } => write!(f, "LOAD r{rd}, [r{ra} + {off}]"),
            Instr::Store { rs, ra, off } => write!(f, "STORE r{rs}, [r{ra} + {off}]"),
            Instr::Jump { cond, off } => write!(f, "{} {off}", cond.mnemonic()),
            Instr::Call { off } => write!(f, "CALL {off}"),
            Instr::Jr { ra: 7, link: false } => write!(f, "RET"),
            Instr::Jr { ra, link: false } => write!(f, "JR r{ra}"),
            Instr::Jr { ra, link: true } => write!(f, "CALLR r{ra}"),
        }
    }
}
