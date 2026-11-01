//! The reference CPU: registers, flags and the data memory map.
use crate::{decode, AluOp, Instr, Shift, ShiftBy};

pub const RAM_WORDS: usize = 16 * 1024;
pub const SCREEN: u16 = 0x4000;
pub const SCREEN_WIDTH: usize = 128;
pub const SCREEN_HEIGHT: usize = 96;
/// 128 × 96 pixels, 16 per word.
pub const SCREEN_WORDS: usize = SCREEN_WIDTH * SCREEN_HEIGHT / 16;
pub const KEYBOARD: u16 = 0x6000;
/// Frames since the program started, 60 a second (read-only; wraps).
pub const TIMER: u16 = 0x6001;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Flags {
    pub z: bool,
    pub n: bool,
    pub c: bool,
}

/// The ALU agreed in docs/ISA.md (the `alu` level): b is inverted when
/// `invb`, then f picks ADD (with cin), AND, OR or XOR. C is the adder's
/// carry out for ADD and 0 otherwise.
pub fn alu(a: u16, b: u16, op: AluOp) -> (u16, Flags) {
    let b = if op.invb { !b } else { b };
    let (out, c) = match op.f & 3 {
        0 => {
            let s = a as u32 + b as u32 + op.cin as u32;
            (s as u16, s >> 16 & 1 == 1)
        }
        1 => (a & b, false),
        2 => (a | b, false),
        _ => (a ^ b, false),
    };
    (
        out,
        Flags {
            z: out == 0,
            n: out & 0x8000 != 0,
            c,
        },
    )
}

/// The barrel shifter: `n` (0..15) places, as SHL / SHR / SAR.
pub fn shift(v: u16, kind: Shift, n: u8) -> u16 {
    let n = n & 15;
    match kind {
        Shift::Left => v << n,
        Shift::Right => v >> n,
        Shift::Arith => ((v as i16) >> n) as u16,
    }
}

/// The data side of the computer, as the CPU sees it.
pub trait Bus {
    fn read(&mut self, addr: u16) -> u16;
    fn write(&mut self, addr: u16, value: u16);
}

/// RAM16K, the screen, the keyboard and the timer at the addresses in
/// docs/ISA.md.
/// Unused addresses read as 0 and ignore writes.
#[derive(Clone, Debug)]
pub struct Memory {
    pub ram: Vec<u16>,
    pub screen: Vec<u16>,
    /// The code of the key held now, 0 if none.
    pub keyboard: u16,
    /// The frame counter at TIMER, set by whoever runs the machine.
    pub timer: u16,
}

impl Default for Memory {
    fn default() -> Self {
        Memory {
            ram: vec![0; RAM_WORDS],
            screen: vec![0; SCREEN_WORDS],
            keyboard: 0,
            timer: 0,
        }
    }
}

impl Memory {
    /// Whether pixel (x, y) is on; the leftmost pixel of a word is bit 15.
    pub fn pixel(&self, x: usize, y: usize) -> bool {
        let word = self.screen.get(y * 8 + x / 16).copied().unwrap_or(0);
        word >> (15 - x % 16) & 1 == 1
    }

    fn screen_index(addr: u16) -> Option<usize> {
        let i = addr.wrapping_sub(SCREEN) as usize;
        (addr >= SCREEN && i < SCREEN_WORDS).then_some(i)
    }
}

impl Bus for Memory {
    fn read(&mut self, addr: u16) -> u16 {
        match addr >> 13 {
            0b000 | 0b001 => self.ram[addr as usize],
            0b010 => Memory::screen_index(addr).map_or(0, |i| self.screen[i]),
            0b011 if addr == KEYBOARD => self.keyboard,
            0b011 if addr == TIMER => self.timer,
            _ => 0,
        }
    }

    fn write(&mut self, addr: u16, value: u16) {
        match addr >> 13 {
            0b000 | 0b001 => self.ram[addr as usize] = value,
            0b010 => {
                if let Some(i) = Memory::screen_index(addr) {
                    self.screen[i] = value;
                }
            }
            _ => {}
        }
    }
}

/// The CPU's state. The gate-level CPU starts unknown (X); this model
/// starts at 0.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Cpu {
    pub regs: [u16; 8],
    pub pc: u16,
    pub flags: Flags,
}

impl Cpu {
    /// ADDI / SUBI: imm8 (zero-extended) is the ALU's b input.
    fn alu_imm(&mut self, rd: u8, imm: u8, op: AluOp) {
        let (out, flags) = alu(self.regs[rd as usize], imm as u16, op);
        self.regs[rd as usize] = out;
        self.flags = flags;
    }

    /// Runs the instruction at PC: one clock cycle. ROM words past the end
    /// of `rom` read as 0.
    pub fn step(&mut self, rom: &[u16], bus: &mut impl Bus) {
        let word = rom.get(self.pc as usize).copied().unwrap_or(0);
        let r = self.regs;
        let next = self.pc.wrapping_add(1);
        let mut pc = next;
        match decode(word) {
            Instr::Alu { rd, ra, rb, op } => {
                let (out, flags) = alu(r[ra as usize], r[rb as usize], op);
                self.regs[rd as usize] = out;
                self.flags = flags;
            }
            Instr::Cmp { ra, rb, op } => self.flags = alu(r[ra as usize], r[rb as usize], op).1,
            Instr::Set { rd, imm } => self.regs[rd as usize] = imm as u16,
            Instr::SetHigh { rd, imm } => {
                self.regs[rd as usize] = (imm as u16) << 8 | r[rd as usize] & 0xff
            }
            Instr::AddI { rd, imm } => self.alu_imm(rd, imm, AluOp::ADD),
            Instr::SubI { rd, imm } => self.alu_imm(rd, imm, AluOp::SUB),
            Instr::Shift { rd, ra, kind, by } => {
                let n = match by {
                    ShiftBy::Amount(n) => n,
                    ShiftBy::Reg(rb) => (r[rb as usize] & 15) as u8,
                };
                self.regs[rd as usize] = shift(r[ra as usize], kind, n);
            }
            Instr::Load { rd, ra, off } => {
                self.regs[rd as usize] = bus.read(r[ra as usize].wrapping_add(off as u16))
            }
            Instr::Store { rs, ra, off } => {
                bus.write(r[ra as usize].wrapping_add(off as u16), r[rs as usize])
            }
            Instr::Jump { cond, off } => {
                if cond.holds(self.flags) {
                    pc = self.pc.wrapping_add(off as u16);
                }
            }
            Instr::Call { off } => {
                self.regs[7] = next;
                pc = self.pc.wrapping_add(off as u16);
            }
            Instr::Jr { ra, link } => {
                pc = r[ra as usize];
                if link {
                    self.regs[7] = next;
                }
            }
        }
        self.pc = pc;
    }
}

/// Runs `rom` from reset for `steps` instructions with a fresh `Memory`.
/// Entry 0 is the start state; entry i + 1 is the CPU after instruction i,
/// with the word it stored, if any, as (address, value).
pub fn trace(rom: &[u16], steps: usize) -> Vec<(Cpu, Option<(u16, u16)>)> {
    struct Watch<'a>(&'a mut Memory, Option<(u16, u16)>);
    impl Bus for Watch<'_> {
        fn read(&mut self, addr: u16) -> u16 {
            self.0.read(addr)
        }
        fn write(&mut self, addr: u16, value: u16) {
            self.1 = Some((addr, value));
            self.0.write(addr, value);
        }
    }
    let mut cpu = Cpu::default();
    let mut mem = Memory::default();
    let mut out = vec![(cpu, None)];
    for _ in 0..steps {
        let mut bus = Watch(&mut mem, None);
        cpu.step(rom, &mut bus);
        out.push((cpu, bus.1));
    }
    out
}
