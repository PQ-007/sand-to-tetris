// The CPU chapter's models agree with the instruction set in s2t-isa.
use s2t_isa::{encode, AluOp, Bus, Cond, Cpu, Flags, Instr, Memory, KEYBOARD, SCREEN};
use s2t_models::{clocked, control, model, ClockedModel};

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
}

/// A clocked model driven word by word.
struct Driven {
    m: &'static ClockedModel,
    mem: Vec<Option<u64>>,
}

impl Driven {
    fn new(id: &str) -> Driven {
        let m = clocked(id).expect("model");
        Driven {
            m,
            mem: vec![None; m.words],
        }
    }
    fn read(&self, ins: &[u64]) -> Vec<Option<u64>> {
        let ins: Vec<Option<u64>> = ins.iter().map(|&v| Some(v)).collect();
        (self.m.read)(&ins, &self.mem)
    }
    fn tick(&mut self, ins: &[u64]) {
        let ins: Vec<Option<u64>> = ins.iter().map(|&v| Some(v)).collect();
        (self.m.tick)(&ins, &mut self.mem);
    }
}

fn word(i: Instr) -> u64 {
    encode(&i).expect("valid") as u64
}

#[test]
fn shifter_shifts_both_ways() {
    let m = model("shifter").unwrap();
    assert_eq!(m.eval_words(&[0x8421, 4, 0, 0]), vec![0x4210]);
    assert_eq!(
        m.eval_words(&[0x8421, 4, 0, 1]),
        vec![0x4210],
        "arith ignored for left"
    );
    assert_eq!(m.eval_words(&[0x8421, 4, 1, 0]), vec![0x0842]);
    assert_eq!(m.eval_words(&[0x8421, 4, 1, 1]), vec![0xf842]);
    assert_eq!(m.eval_words(&[0x8421, 0, 1, 1]), vec![0x8421]);
    assert_eq!(m.eval_words(&[1, 15, 0, 0]), vec![0x8000]);
}

#[test]
fn decode_spells_out_each_instruction_group() {
    let f = Flags::default();
    let c = control(
        word(Instr::Alu {
            rd: 1,
            ra: 2,
            rb: 3,
            op: AluOp::SUB,
        }) as u16,
        f,
    );
    assert_eq!(
        (c.wa, c.we, c.ra, c.rb, c.alu, c.useimm),
        (1, true, 2, 3, AluOp::SUB, false)
    );
    assert_eq!(
        (c.rsel, c.setflags, c.write_m, c.jump),
        (0, true, false, false)
    );

    let c = control(
        word(Instr::Cmp {
            ra: 4,
            rb: 5,
            op: AluOp::SUB,
        }) as u16,
        f,
    );
    assert!(!c.we && c.setflags);

    let c = control(word(Instr::SetHigh { rd: 6, imm: 0x40 }) as u16, f);
    assert_eq!(
        (c.wa, c.ra, c.rsel, c.imm, c.setflags),
        (6, 6, 3, 0x40, false)
    );
    let c = control(word(Instr::SubI { rd: 6, imm: 9 }) as u16, f);
    assert_eq!(
        (c.alu, c.useimm, c.imm, c.rsel, c.setflags),
        (AluOp::SUB, true, 9, 0, true)
    );

    let c = control(
        word(Instr::Store {
            rs: 3,
            ra: 6,
            off: 5,
        }) as u16,
        f,
    );
    assert_eq!(
        (c.we, c.ra, c.rb, c.alu, c.useimm, c.imm, c.write_m),
        (false, 6, 3, AluOp::ADD, true, 5, true)
    );
    let c = control(
        word(Instr::Load {
            rd: 2,
            ra: 6,
            off: 1,
        }) as u16,
        f,
    );
    assert_eq!((c.wa, c.we, c.rsel, c.write_m), (2, true, 4, false));

    let jz = word(Instr::Jump {
        cond: Cond::Zero,
        off: -2,
    }) as u16;
    assert!(!control(jz, f).jump);
    let c = control(jz, Flags { z: true, ..f });
    assert_eq!((c.jump, c.jr, c.off, c.we), (true, false, 0xfffe, false));

    let c = control(word(Instr::Call { off: -5 }) as u16, f);
    assert_eq!(
        (c.wa, c.we, c.rsel, c.jump, c.jr, c.off),
        (7, true, 5, true, false, 0xfffb)
    );
    let c = control(word(Instr::Jr { ra: 7, link: false }) as u16, f);
    assert_eq!((c.we, c.ra, c.jump, c.jr), (false, 7, true, true));
    let c = control(word(Instr::Jr { ra: 2, link: true }) as u16, f);
    assert_eq!((c.wa, c.we, c.ra, c.rsel), (7, true, 2, 5));
}

#[test]
fn regfile_writes_one_register_and_reads_two() {
    let mut r = Driven::new("regfile");
    // d, we, wa, ra, rb, clk
    r.tick(&[11, 1, 3, 0, 0, 1]);
    r.tick(&[22, 1, 5, 0, 0, 1]);
    r.tick(&[99, 0, 3, 0, 0, 1]);
    assert_eq!(r.read(&[0, 0, 0, 3, 5, 0]), vec![Some(11), Some(22)]);
    assert_eq!(
        r.read(&[0, 0, 0, 1, 3, 0]),
        vec![None, Some(11)],
        "r1 never written"
    );
}

#[test]
fn memory_map_matches_the_spec() {
    let mut m = Driven::new("memory");
    // d, addr, load, key, timer, clk
    for (addr, v) in [
        (0x0000, 1),
        (0x3fff, 2),
        (SCREEN as u64, 3),
        (0x42ff, 4),
        (0x4300, 5),
        (KEYBOARD as u64, 6),
        (0x6001, 8),
        (0x9000, 7),
    ] {
        m.tick(&[v, addr, 1, 0, 0, 1]);
    }
    let q = |m: &Driven, addr: u64| m.read(&[0, addr, 0, 65, 1234, 0])[0];
    assert_eq!(q(&m, 0x0000), Some(1));
    assert_eq!(q(&m, 0x3fff), Some(2));
    assert_eq!(q(&m, 0x4000), Some(3));
    assert_eq!(q(&m, 0x42ff), Some(4));
    assert_eq!(q(&m, 0x4300), Some(0), "past the screen");
    assert_eq!(q(&m, 0x6000), Some(65), "the keyboard");
    assert_eq!(q(&m, 0x6001), Some(1234), "the timer");
    assert_eq!(q(&m, 0x6002), Some(0));
    assert_eq!(q(&m, 0x9000), Some(0));
    assert_eq!(q(&m, 0x0001), None, "never written");
}

/// Runs the `cpu` model with a ROM and an s2t-isa Memory around it.
fn run_cpu_model(cpu: &mut Driven, rom: &[u16], mem: &mut Memory, reset: u64) {
    let pc = cpu.mem[8].unwrap_or(0) as usize; // unknown only before the first reset
    let instr = rom.get(pc).copied().unwrap_or(0) as u64;
    let probe = cpu.read(&[instr, 0, reset, 0]);
    let addr = probe[1];
    let in_m = addr.map_or(0, |a| mem.read(a as u16) as u64);
    let out = cpu.read(&[instr, in_m, reset, 0]);
    if out[3] == Some(1) {
        mem.write(
            out[1].expect("addrM known") as u16,
            out[2].expect("outM known") as u16,
        );
    }
    cpu.tick(&[instr, in_m, reset, 1]);
}

#[test]
fn cpu_model_matches_the_isa_on_random_programs() {
    let mut rng = Rng(0x9e37_79b9_7f4a_7c15);
    for program in 0..20 {
        let mut rom: Vec<u16> = (0..4096).map(|_| rng.next() as u16).collect();
        // Start: every register and the flags known.
        let preamble: Vec<u16> = (0..8)
            .map(|r| {
                encode(&Instr::Set {
                    rd: r,
                    imm: r.wrapping_mul(37),
                })
                .unwrap()
            })
            .chain([encode(&Instr::Cmp {
                ra: 0,
                rb: 0,
                op: AluOp::SUB,
            })
            .unwrap()])
            .collect();
        rom[..preamble.len()].copy_from_slice(&preamble);
        let mut model = Driven::new("cpu");
        let mut model_mem = Memory::default();
        run_cpu_model(&mut model, &rom, &mut model_mem, 1); // reset: pc = 0
        let mut isa = Cpu::default();
        let mut isa_mem = Memory::default();
        for step in 0..3000 {
            run_cpu_model(&mut model, &rom, &mut model_mem, 0);
            isa.step(&rom, &mut isa_mem);
            if step < preamble.len() {
                isa.flags = Flags {
                    z: true,
                    n: false,
                    c: true,
                };
                continue;
            }
            let regs: Vec<Option<u64>> = isa.regs.iter().map(|&r| Some(r as u64)).collect();
            let flags = [isa.flags.z, isa.flags.n, isa.flags.c].map(|b| Some(b as u64));
            assert_eq!(model.mem[..8], regs[..], "program {program} step {step}");
            assert_eq!(
                model.mem[8],
                Some(isa.pc as u64),
                "program {program} step {step}"
            );
            assert_eq!(model.mem[9..12], flags[..], "program {program} step {step}");
        }
        assert_eq!(model_mem.ram, isa_mem.ram, "program {program}");
        assert_eq!(model_mem.screen, isa_mem.screen, "program {program}");
    }
}

#[test]
fn cpu_model_is_unknown_until_set_and_reset() {
    let mut cpu = Driven::new("cpu");
    let add = word(Instr::Alu {
        rd: 0,
        ra: 1,
        rb: 2,
        op: AluOp::ADD,
    });
    assert_eq!(cpu.read(&[add, 0, 0, 0]), vec![None, None, None, Some(0)]);
    cpu.tick(&[add, 0, 1, 1]); // reset
    assert_eq!(cpu.mem[8], Some(0));
    cpu.tick(&[word(Instr::Set { rd: 1, imm: 2 }), 0, 0, 1]);
    cpu.tick(&[word(Instr::Set { rd: 2, imm: 3 }), 0, 0, 1]);
    // pc, addrM (the ALU's output), outM (port B = r2), writeM
    assert_eq!(
        cpu.read(&[add, 0, 0, 0]),
        vec![Some(2), Some(5), Some(3), Some(0)]
    );
    // A conditional jump on unknown flags leaves the PC unknown.
    cpu.tick(&[
        word(Instr::Jump {
            cond: Cond::Zero,
            off: 4,
        }),
        0,
        0,
        1,
    ]);
    assert_eq!(cpu.mem[8], None);
}

#[test]
fn computer_runs_a_program_with_its_own_memory() {
    // Sum 10..1 into r0, store it at RAM[100] and on screen, then halt.
    let program = [
        Instr::Set { rd: 0, imm: 0 },
        Instr::Set { rd: 1, imm: 10 },
        Instr::Alu {
            rd: 0,
            ra: 0,
            rb: 1,
            op: AluOp::ADD,
        },
        Instr::SubI { rd: 1, imm: 1 },
        Instr::Jump {
            cond: Cond::NotZero,
            off: -2,
        },
        Instr::Set { rd: 2, imm: 100 },
        Instr::Store {
            rs: 0,
            ra: 2,
            off: 0,
        },
        Instr::Load {
            rd: 3,
            ra: 2,
            off: 0,
        },
        Instr::Set { rd: 4, imm: 0 },
        Instr::SetHigh { rd: 4, imm: 0x40 },
        Instr::Store {
            rs: 3,
            ra: 4,
            off: 1,
        },
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        },
    ];
    let rom: Vec<u64> = program.iter().map(|&i| word(i)).collect();
    let mut c = Driven::new("computer");
    let at = |c: &Driven| c.mem[8].expect("pc") as usize;
    c.tick(&[rom[0], 0, 0, 1, 1]); // reset
    for _ in 0..60 {
        let instr = rom[at(&c)];
        c.tick(&[instr, 0, 0, 0, 1]);
    }
    assert_eq!(at(&c), 11, "halted");
    assert_eq!(c.mem[0], Some(55));
    assert_eq!(c.mem[3], Some(55), "loaded back");
    assert_eq!(c.mem[12 + 100], Some(55), "RAM[100]");
    assert_eq!(c.mem[12 + 16384 + 1], Some(55), "screen word 1");
    // While halted the bus shows the halting jump: no write.
    assert_eq!(c.read(&[rom[11], 0, 0, 0, 0])[3], Some(0));
}
