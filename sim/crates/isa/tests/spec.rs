// The instruction set as specified in docs/ISA.md, one test per rule.
// Binary literals are grouped by instruction field (op | rd | ...), as in docs/ISA.md.
#![allow(clippy::unusual_byte_groupings)]
use s2t_isa::{
    alu, decode, encode, AluOp, Cond, Cpu, Flags, Instr, Memory, Shift, ShiftBy, KEYBOARD, SCREEN,
    SCREEN_WORDS,
};

fn run(program: &[Instr], steps: usize) -> (Cpu, Memory) {
    let rom: Vec<u16> = program
        .iter()
        .map(|i| encode(i).expect("valid test instruction"))
        .collect();
    let mut cpu = Cpu::default();
    let mut mem = Memory::default();
    for _ in 0..steps {
        cpu.step(&rom, &mut mem);
    }
    (cpu, mem)
}

fn set16(rd: u8, v: u16) -> [Instr; 2] {
    [
        Instr::Set {
            rd,
            imm: (v & 0xff) as u8,
        },
        Instr::SetHigh {
            rd,
            imm: (v >> 8) as u8,
        },
    ]
}

#[test]
fn the_example_program_encodes_as_documented() {
    let words = [
        (Instr::Set { rd: 0, imm: 0 }, 0b010_000_00_00000000),
        (Instr::Set { rd: 1, imm: 10 }, 0b010_001_00_00001010),
        (
            Instr::Alu {
                rd: 0,
                ra: 0,
                rb: 1,
                op: AluOp::ADD,
            },
            0b000_000_000_001_0000,
        ),
        (Instr::SubI { rd: 1, imm: 1 }, 0b010_001_11_00000001),
        (
            Instr::Jump {
                cond: Cond::NotZero,
                off: -2,
            },
            0b110_010_1111111110,
        ),
        (
            Instr::Jump {
                cond: Cond::Always,
                off: 0,
            },
            0b110_000_0000000000,
        ),
    ];
    for (instr, word) in words {
        assert_eq!(encode(&instr).unwrap(), word, "{instr}");
        assert_eq!(decode(word), instr, "{word:016b}");
    }
}

#[test]
fn every_word_decodes_and_reencodes_with_ignored_bits_cleared() {
    for w in 0..=u16::MAX {
        let i = decode(w);
        let back = encode(&i).unwrap();
        assert_eq!(decode(back), i, "{w:016b} → {i} → {back:016b}");
        // Only bits the spec marks as ignored may differ.
        let ignored = match w >> 13 {
            0b001 => 0b111 << 10, // CMP: rd field
            // SHIFT: bit 3 when shifting by a register, arith (bit 4) for left shifts
            0b011 => {
                (if w & (1 << 6) != 0 { 1 << 3 } else { 0 })
                    | (if w & (1 << 5) == 0 { 1 << 4 } else { 0 })
            }
            0b111 if w & (1 << 12) != 0 => 0xff, // JR: bits 7-0
            _ => 0,
        };
        assert_eq!(back & !ignored, w & !ignored, "{w:016b}");
        assert_eq!(back & ignored, 0, "{w:016b}");
    }
}

#[test]
fn encode_rejects_values_that_do_not_fit() {
    assert!(encode(&Instr::Set { rd: 8, imm: 0 }).is_err());
    assert!(encode(&Instr::Load {
        rd: 0,
        ra: 0,
        off: 128
    })
    .is_err());
    assert!(encode(&Instr::Jump {
        cond: Cond::Always,
        off: 512
    })
    .is_err());
    assert!(encode(&Instr::Jump {
        cond: Cond::Always,
        off: -513
    })
    .is_err());
    assert!(encode(&Instr::Call { off: 2048 }).is_err());
    assert!(encode(&Instr::Shift {
        rd: 0,
        ra: 0,
        kind: Shift::Left,
        by: ShiftBy::Amount(16)
    })
    .is_err());
    let e = encode(&Instr::Jump {
        cond: Cond::Always,
        off: 600,
    })
    .unwrap_err();
    assert!(e.to_string().contains("-512..511"), "{e}");
}

#[test]
fn instructions_print_as_assembly() {
    let cases = [
        (
            Instr::Alu {
                rd: 1,
                ra: 2,
                rb: 3,
                op: AluOp::SUB,
            },
            "SUB r1, r2, r3",
        ),
        (
            Instr::Alu {
                rd: 1,
                ra: 2,
                rb: 2,
                op: AluOp::OR,
            },
            "OR r1, r2, r2",
        ),
        (
            Instr::Cmp {
                ra: 4,
                rb: 5,
                op: AluOp::SUB,
            },
            "CMP r4, r5",
        ),
        (
            Instr::Cmp {
                ra: 4,
                rb: 5,
                op: AluOp::AND,
            },
            "TEST r4, r5",
        ),
        (Instr::SetHigh { rd: 2, imm: 0x40 }, "SETH r2, 64"),
        (
            Instr::Shift {
                rd: 1,
                ra: 1,
                kind: Shift::Arith,
                by: ShiftBy::Reg(2),
            },
            "SAR r1, r1, r2",
        ),
        (
            Instr::Load {
                rd: 3,
                ra: 6,
                off: 2,
            },
            "LOAD r3, [r6 + 2]",
        ),
        (
            Instr::Store {
                rs: 3,
                ra: 6,
                off: 0,
            },
            "STORE r3, [r6 + 0]",
        ),
        (
            Instr::Jump {
                cond: Cond::Higher,
                off: -3,
            },
            "JHI -3",
        ),
        (Instr::Jr { ra: 7, link: false }, "RET"),
        (Instr::Jr { ra: 2, link: true }, "CALLR r2"),
        // Unnamed ALU combinations print their control bits.
        (
            Instr::Alu {
                rd: 0,
                ra: 1,
                rb: 2,
                op: AluOp {
                    f: 0,
                    invb: false,
                    cin: true,
                },
            },
            "ALU r0, r1, r2, 0, 0, 1",
        ),
    ];
    for (i, text) in cases {
        assert_eq!(i.to_string(), text);
    }
}

#[test]
fn the_alu_matches_the_alu_level_model() {
    let model = s2t_models::model("alu").expect("alu model");
    let mut x: u64 = 0x2545_f491_4f6c_dd1d;
    for _ in 0..20_000 {
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        let (a, b) = (x as u16, (x >> 16) as u16);
        let (f, invb, cin) = ((x >> 32) as u8 & 3, x >> 34 & 1 == 1, x >> 35 & 1 == 1);
        let (out, flags) = alu(a, b, AluOp { f, invb, cin });
        let want = model.eval_words(&[a as u64, b as u64, f as u64, invb as u64, cin as u64]);
        assert_eq!(
            vec![out as u64, flags.z as u64, flags.n as u64, flags.c as u64],
            want,
            "a={a:#x} b={b:#x} f={f} invb={invb} cin={cin}"
        );
    }
}

#[test]
fn sum_of_ten_halts_with_55() {
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
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        },
    ];
    let (cpu, _) = run(&program, 100);
    assert_eq!(cpu.regs[0], 55);
    assert_eq!(cpu.pc, 5, "JMP 0 loops on the spot");
}

#[test]
fn set_and_seth_build_a_16_bit_constant_without_touching_flags() {
    let mut p = vec![
        Instr::Set { rd: 0, imm: 0 },
        Instr::Cmp {
            ra: 0,
            rb: 0,
            op: AluOp::SUB,
        }, // Z=1 C=1
    ];
    p.extend(set16(1, 0x4321));
    let (cpu, _) = run(&p, p.len());
    assert_eq!(cpu.regs[1], 0x4321);
    assert_eq!(
        cpu.flags,
        Flags {
            z: true,
            n: false,
            c: true
        }
    );
}

#[test]
fn addi_and_subi_use_the_alu_and_set_flags() {
    let p = [Instr::Set { rd: 0, imm: 5 }, Instr::SubI { rd: 0, imm: 7 }];
    let (cpu, _) = run(&p, 2);
    assert_eq!(cpu.regs[0], 0xfffe);
    assert_eq!(
        cpu.flags,
        Flags {
            z: false,
            n: true,
            c: false
        },
        "5 < 7"
    );
    let p = [
        Instr::Set { rd: 0, imm: 0xff },
        Instr::SetHigh { rd: 0, imm: 0xff },
        Instr::AddI { rd: 0, imm: 1 },
    ];
    let (cpu, _) = run(&p, 3);
    assert_eq!(cpu.regs[0], 0);
    assert_eq!(
        cpu.flags,
        Flags {
            z: true,
            n: false,
            c: true
        }
    );
}

#[test]
fn cmp_sets_flags_and_writes_nothing() {
    let p = [
        Instr::Set { rd: 0, imm: 3 },
        Instr::Set { rd: 1, imm: 3 },
        Instr::Cmp {
            ra: 0,
            rb: 1,
            op: AluOp::SUB,
        },
    ];
    let (cpu, _) = run(&p, 3);
    assert_eq!(cpu.regs[..2], [3, 3]);
    assert!(cpu.flags.z && cpu.flags.c);
}

#[test]
fn shifts_by_amount_and_by_register() {
    let mut p = set16(1, 0x8421).to_vec();
    p.push(Instr::Set { rd: 2, imm: 0x14 }); // 20 AND 15 = 4
    let sh = |rd, kind, by| Instr::Shift {
        rd,
        ra: 1,
        kind,
        by,
    };
    p.extend([
        sh(3, Shift::Left, ShiftBy::Amount(4)),
        sh(4, Shift::Right, ShiftBy::Amount(4)),
        sh(5, Shift::Arith, ShiftBy::Amount(4)),
        sh(6, Shift::Right, ShiftBy::Reg(2)),
        sh(0, Shift::Left, ShiftBy::Amount(0)),
    ]);
    let (cpu, _) = run(&p, p.len());
    assert_eq!(cpu.regs[3], 0x4210);
    assert_eq!(cpu.regs[4], 0x0842);
    assert_eq!(cpu.regs[5], 0xf842, "arithmetic shift copies bit 15");
    assert_eq!(cpu.regs[6], 0x0842, "by register uses the low 4 bits");
    assert_eq!(cpu.regs[0], 0x8421);
}

#[test]
fn load_and_store_add_the_offset_and_wrap() {
    let mut p = set16(6, 0x0100).to_vec();
    p.extend(set16(1, 0xbeef));
    p.push(Instr::Store {
        rs: 1,
        ra: 6,
        off: 5,
    });
    p.push(Instr::Load {
        rd: 2,
        ra: 6,
        off: 5,
    });
    p.extend(set16(5, 0xffff));
    p.push(Instr::Store {
        rs: 1,
        ra: 5,
        off: 3,
    }); // 0xffff + 3 wraps to 2
    let (cpu, mem) = run(&p, p.len());
    assert_eq!(mem.ram[0x105], 0xbeef);
    assert_eq!(cpu.regs[2], 0xbeef);
    assert_eq!(mem.ram[2], 0xbeef);
}

#[test]
fn the_memory_map_routes_screen_keyboard_and_unused_addresses() {
    let mut mem = Memory::default();
    use s2t_isa::Bus;
    mem.write(0x3fff, 7);
    assert_eq!(mem.ram[0x3fff], 7);
    mem.write(SCREEN, 0x8000); // leftmost pixel of row 0
    mem.write(SCREEN + 8 * 95 + 7, 1); // rightmost pixel of the last row
    assert_eq!(mem.screen[0], 0x8000);
    assert_eq!(mem.screen[SCREEN_WORDS - 1], 1);
    assert!(mem.pixel(0, 0) && mem.pixel(127, 95) && !mem.pixel(1, 0));
    mem.keyboard = 65;
    assert_eq!(mem.read(KEYBOARD), 65);
    mem.write(KEYBOARD, 9);
    assert_eq!(mem.read(KEYBOARD), 65, "keyboard is read-only");
    for unused in [0x4300, 0x5fff, 0x6001, 0x8000, 0xffff] {
        mem.write(unused, 1);
        assert_eq!(mem.read(unused), 0, "{unused:#x}");
    }
}

#[test]
fn every_condition_after_cmp() {
    // (a, b, cond, jumps?)
    let cases = [
        (3, 3, Cond::Zero, true),
        (3, 4, Cond::Zero, false),
        (3, 4, Cond::NotZero, true),
        (3, 4, Cond::Negative, true),
        (4, 3, Cond::NotNegative, true),
        (4, 3, Cond::Carry, true),
        (3, 3, Cond::Carry, true),
        (3, 4, Cond::NoCarry, true),
        (3, 3, Cond::Higher, false),
        (4, 3, Cond::Higher, true),
        (0, 0, Cond::Always, true),
    ];
    for (a, b, cond, jumps) in cases {
        let p = [
            Instr::Set { rd: 0, imm: a },
            Instr::Set { rd: 1, imm: b },
            Instr::Cmp {
                ra: 0,
                rb: 1,
                op: AluOp::SUB,
            },
            Instr::Jump { cond, off: 3 },
        ];
        let (cpu, _) = run(&p, 4);
        assert_eq!(cpu.pc, if jumps { 6 } else { 4 }, "{a} vs {b}: {cond:?}");
    }
}

#[test]
fn call_and_ret_through_r7() {
    let p = [
        Instr::Call { off: 3 },        // 0: r7 = 1
        Instr::AddI { rd: 0, imm: 1 }, // 1: after return
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        }, // 2: halt
        Instr::Set { rd: 0, imm: 41 }, // 3: subroutine
        Instr::Jr { ra: 7, link: false }, // 4: RET
    ];
    let (cpu, _) = run(&p, 10);
    assert_eq!(cpu.regs[0], 42);
    assert_eq!(cpu.regs[7], 1);
    assert_eq!(cpu.pc, 2);
}

#[test]
fn callr_reads_the_target_before_writing_r7() {
    let p = [
        Instr::Set { rd: 7, imm: 3 },
        Instr::Jr { ra: 7, link: true }, // jump to 3, r7 = 2
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        },
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        },
    ];
    let (cpu, _) = run(&p, 3);
    assert_eq!((cpu.pc, cpu.regs[7]), (3, 2));
}

#[test]
fn jumps_wrap_and_unloaded_rom_reads_as_zero() {
    let (cpu, _) = run(
        &[Instr::Jump {
            cond: Cond::Always,
            off: -1,
        }],
        1,
    );
    assert_eq!(cpu.pc, 0xffff);
    let mut cpu = Cpu {
        pc: 10,
        ..Cpu::default()
    };
    cpu.step(&[], &mut Memory::default()); // word 0 = ADD r0, r0, r0
    assert_eq!(cpu.pc, 11);
}

#[test]
fn trace_records_states_and_stores() {
    let rom: Vec<u16> = [
        Instr::Set { rd: 1, imm: 5 },
        Instr::Store {
            rs: 1,
            ra: 1,
            off: 0,
        },
        Instr::Jump {
            cond: Cond::Always,
            off: 0,
        },
    ]
    .iter()
    .map(|i| encode(i).unwrap())
    .collect();
    let t = s2t_isa::trace(&rom, 3);
    assert_eq!(t.len(), 4);
    assert_eq!((t[0].0.pc, t[0].1), (0, None));
    assert_eq!(t[1].0.regs[1], 5);
    assert_eq!(t[2].1, Some((5, 5)));
    assert_eq!(t[3].0.pc, 2);
}
