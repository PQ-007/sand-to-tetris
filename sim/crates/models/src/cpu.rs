//! Models for the CPU chapter: the barrel shifter, the control unit
//! (`decode`), the register file, RAM16K, the CPU itself, the memory map and
//! the whole computer. The instruction set is `s2t-isa`'s; this file adds
//! the datapath the levels spell out (which signal comes from where), so the
//! models match the learner's circuits pin for pin.

use s2t_isa::{alu, shift, AluOp, Flags, Shift, KEYBOARD, RAM_WORDS, SCREEN, SCREEN_WORDS};

use crate::{ClockedModel, NativeModel};

type Words = [Option<u64>];

fn opt(x: &Words, i: usize) -> Option<u64> {
    x.get(i).copied().flatten()
}

// ---- barrel shifter -----------------------------------------------------------------

/// shifter: in[16], n[4], right, arith → out. arith only matters when right.
fn shifter(x: &[u64]) -> Vec<u64> {
    let kind = match (x[2] & 1, x[3] & 1) {
        (0, _) => Shift::Left,
        (_, 0) => Shift::Right,
        _ => Shift::Arith,
    };
    vec![shift(x[0] as u16, kind, x[1] as u8) as u64]
}

// ---- control unit -------------------------------------------------------------------

/// Everything the control unit (`decode`) tells the datapath, for one
/// instruction and the saved flags. Each field is an output port of the
/// `decode` level, in this order.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Control {
    /// Register to write: rd, or 7 for CALL / CALLR.
    pub wa: u16,
    pub we: bool,
    /// Register read on port A: rd for IMM, bits 10–8 for JR, else ra.
    pub ra: u16,
    /// Register read on port B: rs for STORE, bits 2–0 for SHIFT, else rb.
    pub rb: u16,
    pub alu: AluOp,
    /// ALU b input is `imm` instead of port B.
    pub useimm: bool,
    /// imm8 for IMM, off7 otherwise (zero-extended).
    pub imm: u16,
    /// Result to write: 0 ALU, 1 shifter, 2 SET value, 3 SETH value, 4 memory, 5 PC + 1.
    pub rsel: u16,
    pub setflags: bool,
    pub write_m: bool,
    /// Load the PC (a taken jump, CALL or JR).
    pub jump: bool,
    /// The jump target is register A (JR / CALLR / RET), not PC + off.
    pub jr: bool,
    /// Sign-extended jump offset: off10 for JUMP, off12 otherwise.
    pub off: u16,
}

pub fn control(instr: u16, flags: Flags) -> Control {
    let op = instr >> 13;
    let field = |shift: u16| instr >> shift & 7;
    let (is_imm, k) = (op == 2, instr >> 8 & 3);
    let is_call = op == 7 && instr >> 12 & 1 == 0;
    let is_jr = op == 7 && instr >> 12 & 1 == 1;
    let links = is_call || is_jr && instr >> 11 & 1 == 1;
    let sext = |bits: u32| (((instr << (16 - bits)) as i16) >> (16 - bits)) as u16;
    let alu = match op {
        0 | 1 => AluOp::new((instr >> 2 & 3) as u8, instr >> 1 & 1 == 1, instr & 1 == 1),
        2 if k == 3 => AluOp::SUB,
        _ => AluOp::ADD,
    };
    let taken = op == 6 && condition(field(10), flags);
    Control {
        wa: if links { 7 } else { field(10) },
        we: matches!(op, 0 | 2 | 3 | 4) || links,
        ra: if is_imm {
            field(10)
        } else if is_jr {
            field(8)
        } else {
            field(7)
        },
        rb: match op {
            5 => field(10),
            3 => field(0),
            _ => field(4),
        },
        alu,
        useimm: matches!(op, 2 | 4 | 5),
        imm: if is_imm { instr & 0xff } else { instr & 0x7f },
        rsel: match op {
            2 if k < 2 => 2 + k,
            3 => 1,
            4 => 4,
            7 if links => 5,
            _ => 0,
        },
        setflags: op <= 1 || is_imm && k >= 2,
        write_m: op == 5,
        jump: taken || op == 7,
        jr: is_jr,
        off: if op == 6 { sext(10) } else { sext(12) },
    }
}

/// Whether jump condition `cond` (0..7, as in docs/ISA.md) holds.
fn condition(cond: u16, f: Flags) -> bool {
    match cond {
        0 => true,
        1 => f.z,
        2 => !f.z,
        3 => f.n,
        4 => !f.n,
        5 => f.c,
        6 => !f.c,
        _ => f.c && !f.z,
    }
}

/// decode: instr[16], z, n, c → the `Control` fields as ports.
fn decode(x: &[u64]) -> Vec<u64> {
    let flags = Flags {
        z: x[1] & 1 == 1,
        n: x[2] & 1 == 1,
        c: x[3] & 1 == 1,
    };
    let c = control(x[0] as u16, flags);
    let b = |v: bool| v as u64;
    vec![
        c.wa as u64,
        b(c.we),
        c.ra as u64,
        c.rb as u64,
        c.alu.f as u64,
        b(c.alu.invb),
        b(c.alu.cin),
        b(c.useimm),
        c.imm as u64,
        c.rsel as u64,
        b(c.setflags),
        b(c.write_m),
        b(c.jump),
        b(c.jr),
        c.off as u64,
    ]
}

pub(crate) static MODELS: &[NativeModel] = &[
    NativeModel {
        id: "shifter",
        inputs: &[16, 4, 1, 1],
        outputs: &[16],
        f: shifter,
    },
    NativeModel {
        id: "decode",
        inputs: &[16, 1, 1, 1],
        outputs: &[3, 1, 3, 3, 2, 1, 1, 1, 16, 3, 1, 1, 1, 1, 16],
        f: decode,
    },
];

// ---- register file ------------------------------------------------------------------

/// regfile: d, we, wa, ra, rb, clk → qa, qb. Eight 16-bit registers.
fn regfile_tick(x: &Words, mem: &mut Words) {
    let (d, we, wa) = (opt(x, 0), opt(x, 1), opt(x, 2));
    match (we, wa) {
        (Some(0), _) => {}
        (Some(_), Some(a)) => mem[a as usize & 7] = d,
        (None, Some(a)) => {
            if mem[a as usize & 7] != d {
                mem[a as usize & 7] = None;
            }
        }
        (_, None) => mem.iter_mut().for_each(|w| *w = None),
    }
}

fn regfile_read(x: &Words, mem: &Words) -> Vec<Option<u64>> {
    let reg = |i| opt(x, i).and_then(|r| mem[r as usize & 7]);
    vec![reg(3), reg(4)]
}

// ---- the CPU ------------------------------------------------------------------------

/// CPU memory words: r0–r7, then PC, then the flags z, n, c.
const PC: usize = 8;
const FLAGS: usize = 9;
const CPU_WORDS: usize = 12;

/// What the CPU shows on its pins during a cycle, and what it will store on
/// the next rising edge. `None` = unknown.
struct Cycle {
    addr_m: Option<u64>,
    out_m: Option<u64>,
    write_m: Option<bool>,
    /// (register, value) written on the edge; register None = could be any.
    reg_write: Option<(Option<usize>, Option<u64>)>,
    flags: Option<[Option<u64>; 3]>,
    next_pc: Option<u64>,
}

fn flags_of(cpu: &Words) -> Option<Flags> {
    Some(Flags {
        z: cpu[FLAGS]? == 1,
        n: cpu[FLAGS + 1]? == 1,
        c: cpu[FLAGS + 2]? == 1,
    })
}

/// One cycle of the CPU in `cpu` (CPU_WORDS words), with these pins.
/// Unknowns spread cautiously: a value is known only when every input that
/// feeds it is known, so the model never claims more than a circuit could.
fn cycle(cpu: &Words, instr: Option<u64>, in_m: Option<u64>, reset: Option<u64>) -> Cycle {
    let pc = cpu[PC];
    let next_pc_if = |jump_to: Option<u64>| match reset {
        Some(1) => Some(0),
        Some(_) => jump_to,
        None => None,
    };
    let Some(instr) = instr.map(|i| i as u16) else {
        return Cycle {
            addr_m: None,
            out_m: None,
            write_m: None,
            reg_write: Some((None, None)),
            flags: Some([None; 3]),
            next_pc: next_pc_if(None),
        };
    };
    // The control unit only needs the flags for a conditional jump.
    let known_flags = flags_of(cpu);
    let c = control(instr, known_flags.unwrap_or_default());
    let qa = cpu[c.ra as usize];
    let qb = cpu[c.rb as usize];
    let b = if c.useimm { Some(c.imm as u64) } else { qb };
    let alu_out = qa.zip(b).map(|(a, b)| alu(a as u16, b as u16, c.alu));
    let value = match c.rsel {
        0 => alu_out.map(|(v, _)| v as u64),
        1 => {
            let n = if instr >> 6 & 1 == 1 {
                qb.map(|v| v as u8 & 15)
            } else {
                Some(instr as u8 & 15)
            };
            let kind = match (instr >> 5 & 1, instr >> 4 & 1) {
                (0, _) => Shift::Left,
                (_, 0) => Shift::Right,
                _ => Shift::Arith,
            };
            qa.zip(n).map(|(a, n)| shift(a as u16, kind, n) as u64)
        }
        2 => Some(instr as u64 & 0xff),
        3 => qa.map(|a| (instr as u64 & 0xff) << 8 | a & 0xff),
        4 => in_m,
        _ => pc.map(|p| (p + 1) & 0xffff),
    };
    let next = pc.map(|p| (p + 1) & 0xffff);
    let target = if instr >> 13 == 6 && known_flags.is_none() {
        // A jump that tests unknown flags could go either way.
        None
    } else if !c.jump {
        next
    } else if c.jr {
        qa
    } else {
        pc.map(|p| (p + c.off as u64) & 0xffff)
    };
    Cycle {
        addr_m: alu_out.map(|(v, _)| v as u64),
        out_m: qb,
        write_m: Some(c.write_m),
        reg_write: c.we.then_some((Some(c.wa as usize), value)),
        flags: c.setflags.then_some(match alu_out {
            Some((_, f)) => [Some(f.z as u64), Some(f.n as u64), Some(f.c as u64)],
            None => [None; 3],
        }),
        next_pc: next_pc_if(target),
    }
}

/// Applies a cycle's writes at the rising edge.
fn commit(cpu: &mut Words, cy: &Cycle) {
    match cy.reg_write {
        Some((Some(r), v)) => cpu[r] = v,
        Some((None, _)) => cpu[..8].iter_mut().for_each(|w| *w = None),
        None => {}
    }
    if let Some(f) = cy.flags {
        cpu[FLAGS..FLAGS + 3].copy_from_slice(&f);
    }
    cpu[PC] = cy.next_pc;
}

/// cpu: instr, inM, reset, clk → pc, addrM, outM, writeM.
fn cpu_tick(x: &Words, mem: &mut Words) {
    let cy = cycle(mem, opt(x, 0), opt(x, 1), opt(x, 2));
    commit(mem, &cy);
}

fn cpu_read(x: &Words, mem: &Words) -> Vec<Option<u64>> {
    let cy = cycle(mem, opt(x, 0), opt(x, 1), opt(x, 2));
    vec![mem[PC], cy.addr_m, cy.out_m, cy.write_m.map(u64::from)]
}

// ---- the memory map -----------------------------------------------------------------

/// Memory words: RAM16K, then the 768 screen words.
const MEMORY_WORDS: usize = RAM_WORDS + SCREEN_WORDS;

/// Where an address lives: a word of `mem`, the keyboard, or nowhere.
enum Place {
    Word(usize),
    Keyboard,
    Nowhere,
}

fn place(addr: u64) -> Place {
    let a = addr as usize;
    if a < RAM_WORDS {
        Place::Word(a)
    } else if (SCREEN as usize..SCREEN as usize + SCREEN_WORDS).contains(&a) {
        Place::Word(RAM_WORDS + a - SCREEN as usize)
    } else if a == KEYBOARD as usize {
        Place::Keyboard
    } else {
        Place::Nowhere
    }
}

fn memory_write(mem: &mut Words, d: Option<u64>, addr: Option<u64>, load: Option<u64>) {
    match (load, addr.map(place)) {
        (Some(0), _) | (_, Some(Place::Keyboard | Place::Nowhere)) => {}
        (Some(_), Some(Place::Word(i))) => mem[i] = d,
        (None, Some(Place::Word(i))) => {
            if mem[i] != d {
                mem[i] = None;
            }
        }
        (_, None) => mem.iter_mut().for_each(|w| *w = None),
    }
}

fn memory_read(mem: &Words, addr: Option<u64>, key: Option<u64>) -> Option<u64> {
    match place(addr?) {
        Place::Word(i) => mem[i],
        Place::Keyboard => key,
        Place::Nowhere => Some(0),
    }
}

/// memory: d, addr, load, key, clk → q.
fn memory_tick(x: &Words, mem: &mut Words) {
    memory_write(mem, opt(x, 0), opt(x, 1), opt(x, 2));
}

fn memory_read_port(x: &Words, mem: &Words) -> Vec<Option<u64>> {
    vec![memory_read(mem, opt(x, 1), opt(x, 3))]
}

// ---- the computer -------------------------------------------------------------------

/// computer: instr, key, reset, clk → pc, addrM, outM, writeM. Memory: the
/// CPU's words, then the memory map's. The program ROM is outside: whoever
/// runs the computer feeds `instr` from the ROM at `pc`.
fn computer_cycle(x: &Words, mem: &Words) -> Cycle {
    let (cpu, data) = mem.split_at(CPU_WORDS);
    let instr = opt(x, 0);
    // inM depends on addrM, which never depends on inM.
    let addr = cycle(cpu, instr, None, opt(x, 2)).addr_m;
    let in_m = memory_read(data, addr, opt(x, 1));
    cycle(cpu, instr, in_m, opt(x, 2))
}

fn computer_tick(x: &Words, mem: &mut Words) {
    let cy = computer_cycle(x, mem);
    let (cpu, data) = mem.split_at_mut(CPU_WORDS);
    let load = cy.write_m.map(u64::from);
    memory_write(data, cy.out_m, cy.addr_m, load);
    commit(cpu, &cy);
}

fn computer_read(x: &Words, mem: &Words) -> Vec<Option<u64>> {
    let cy = computer_cycle(x, mem);
    vec![mem[PC], cy.addr_m, cy.out_m, cy.write_m.map(u64::from)]
}

pub(crate) static CLOCKED: &[ClockedModel] = &[
    ClockedModel {
        id: "ram16k",
        inputs: &[16, 14, 1, 1],
        outputs: &[16],
        clk: 3,
        words: RAM_WORDS,
        tick: crate::ram_tick,
        read: crate::ram_read,
    },
    ClockedModel {
        id: "regfile",
        inputs: &[16, 1, 3, 3, 3, 1],
        outputs: &[16, 16],
        clk: 5,
        words: 8,
        tick: regfile_tick,
        read: regfile_read,
    },
    ClockedModel {
        id: "cpu",
        inputs: &[16, 16, 1, 1],
        outputs: &[16, 16, 16, 1],
        clk: 3,
        words: CPU_WORDS,
        tick: cpu_tick,
        read: cpu_read,
    },
    ClockedModel {
        id: "memory",
        inputs: &[16, 16, 1, 16, 1],
        outputs: &[16],
        clk: 4,
        words: MEMORY_WORDS,
        tick: memory_tick,
        read: memory_read_port,
    },
    ClockedModel {
        id: "computer",
        inputs: &[16, 16, 1, 1],
        outputs: &[16, 16, 16, 1],
        clk: 3,
        words: CPU_WORDS + MEMORY_WORDS,
        tick: computer_tick,
        read: computer_read,
    },
];
