// The assembly language as specified in docs/ASSEMBLY.md, one test per rule.
use s2t_asm::{assemble, encode, layout, parse, tokenize, Body, Line, Operand, Token};
use s2t_isa::{decode, encode as encode_word, Cpu, Memory};

fn words(src: &str) -> Vec<u16> {
    let p = assemble(src);
    assert!(p.errors.is_empty(), "{:?}", p.errors);
    p.code
}

fn first_error(src: &str) -> (usize, String) {
    let p = assemble(src);
    let e = p
        .errors
        .first()
        .unwrap_or_else(|| panic!("no error for {src:?}"));
    (e.line, e.code.to_string())
}

#[test]
fn tokenizes_a_line() {
    use Token::*;
    assert_eq!(
        tokenize("loop:  LOAD r2, [r1 + 0x10] ; comment").unwrap(),
        vec![
            Label {
                name: "loop".into()
            },
            Ident {
                text: "LOAD".into()
            },
            Ident { text: "r2".into() },
            Comma,
            LBracket,
            Ident { text: "r1".into() },
            Plus,
            Number { value: 16 },
            RBracket,
        ]
    );
    assert_eq!(
        tokenize(".word -5, 0b1111_0000, 'A'").unwrap(),
        vec![
            Directive {
                name: "word".into()
            },
            Number { value: -5 },
            Comma,
            Number { value: 0xf0 },
            Comma,
            Number { value: 65 },
        ]
    );
    assert!(tokenize("   ; only a comment").unwrap().is_empty());
}

#[test]
fn tokenizer_errors_name_the_problem() {
    assert_eq!(tokenize("SET r1, 12ab").unwrap_err().code, "bad-number");
    assert_eq!(tokenize("SET r1, 0x").unwrap_err().code, "bad-number");
    assert_eq!(tokenize("SET r1, #5").unwrap_err().code, "bad-char");
    assert_eq!(tokenize("SET r1, 'AB'").unwrap_err().code, "bad-char");
}

#[test]
fn parses_labels_instructions_and_directives() {
    let line = parse(&tokenize("loop: store r3, [r6]").unwrap()).unwrap();
    assert_eq!(
        line,
        Line {
            label: Some("loop".into()),
            body: Some(Body::Instr {
                mnemonic: "STORE".into(),
                args: vec![
                    Operand::Reg { reg: 3 },
                    Operand::Mem {
                        reg: 6,
                        offset: Box::new(Operand::Num { value: 0 })
                    },
                ],
            }),
        }
    );
    let line = parse(&tokenize(".EQU WIDTH 8").unwrap()).unwrap();
    assert_eq!(
        line.body,
        Some(Body::Dir {
            name: "equ".into(),
            args: vec![
                Operand::Sym {
                    name: "WIDTH".into()
                },
                Operand::Num { value: 8 }
            ],
        })
    );
    assert_eq!(
        parse(&[]).unwrap(),
        Line {
            label: None,
            body: None
        }
    );
}

#[test]
fn parse_errors() {
    let p = |s: &str| parse(&tokenize(s).unwrap()).unwrap_err().code;
    assert_eq!(p("LOAD r1, [r2 + 3"), "expected");
    assert_eq!(p("LOAD r1, [5]"), "expected");
    assert_eq!(p("ADD r1,, r2"), "expected");
    assert_eq!(p("ADD r1 r2"), "expected");
}

#[test]
fn assembles_the_sum_program() {
    let src = "
        SET  r0, 0        ; sum
        SET  r1, 10
loop:   ADD  r0, r0, r1
        SUBI r1, 1
        JNZ  loop
done:   JMP  done
";
    assert_eq!(
        words(src),
        vec![0x4000, 0x440a, 0x0010, 0x4701, 0xcbfe, 0xc000]
    );
}

#[test]
fn every_word_survives_disassembly_and_reassembly() {
    for w in 0..=u16::MAX {
        let text = decode(w).to_string();
        let back = words(&text);
        let canonical = encode_word(&decode(w)).unwrap();
        assert_eq!(back, vec![canonical], "{w:#06x} → {text}");
    }
}

#[test]
fn mnemonics_and_registers_ignore_case_names_do_not() {
    assert_eq!(words("add R1, r2, R3"), words("ADD r1, r2, r3"));
    assert_eq!(first_error("x: NOP\nJMP X").1, "unknown-symbol");
}

#[test]
fn pseudo_instructions() {
    assert_eq!(words("SET16 r1, 0x4000"), words("SET r1, 0\nSETH r1, 0x40"));
    assert_eq!(words("SET16 r1, 200"), words("SET r1, 200"));
    assert_eq!(words("SET16 r1, -1"), words("SET r1, 255\nSETH r1, 255"));
    assert_eq!(words(".equ SMALL 7\nSET16 r1, SMALL"), words("SET r1, 7"));
    // A label always takes both halves (its value isn't known in pass 1).
    assert_eq!(words("SET16 r1, end\nend: HALT").len(), 3);
    assert_eq!(words("INC r2\nDEC r3"), words("ADDI r2, 1\nSUBI r3, 1"));
    assert_eq!(words("NOP\nHALT"), words("JMP 1\nJMP 0"));
    assert_eq!(words("MOV r1, r2"), words("OR r1, r2, r2"));
    assert_eq!(words("RET"), words("JR r7"));
}

#[test]
fn labels_are_addresses_and_jumps_are_relative() {
    let src = "
start:  SET16 r1, 0x4000   ; two words
        CALL  sub          ; at 2, sub is at 5: offset 3
        JMP   start        ; at 3: offset -3
        HALT
sub:    RET
";
    let code = words(src);
    assert_eq!(
        code[2],
        encode_word(&s2t_isa::Instr::Call { off: 3 }).unwrap()
    );
    assert_eq!(code[3], words("JMP -3")[0]);
    let p = assemble(src);
    assert_eq!(p.symbols["sub"].value, 5);
    assert_eq!(p.source_map, vec![2, 2, 3, 4, 5, 6]);
}

#[test]
fn data_goes_to_ram_from_address_0() {
    let src = "
.equ ROWS 3
.data
shapes: .word 0x0F00, 0x4444, ROWS
board:  .space 2
end:    .word board
.code
        SET16 r1, shapes
        LOAD  r2, [r1 + 1]
        HALT
";
    let p = assemble(src);
    assert!(p.errors.is_empty(), "{:?}", p.errors);
    assert_eq!(p.data, vec![0x0f00, 0x4444, 3, 0, 0, 3]);
    assert_eq!(p.symbols["board"].value, 3);
    assert_eq!(p.symbols["board"].kind, "data");
    assert_eq!(p.code.len(), 4, "shapes is a label: SET16 takes two words");
    // The program runs: the loader copies the data image into RAM.
    let mut mem = Memory::default();
    mem.ram[..p.data.len()].copy_from_slice(&p.data);
    let mut cpu = Cpu::default();
    for _ in 0..10 {
        cpu.step(&p.code, &mut mem);
    }
    assert_eq!(cpu.regs[2], 0x4444);
}

#[test]
fn errors_name_the_line_and_keep_going() {
    let src = "SET r1, 300\nFOO r1\nADD r1, r2\nLOAD r1, [r2 + 200]";
    let p = assemble(src);
    let got: Vec<(usize, &str)> = p.errors.iter().map(|e| (e.line, e.code.as_str())).collect();
    assert_eq!(
        got,
        vec![
            (1, "out-of-range"),
            (2, "unknown-mnemonic"),
            (3, "operand-count"),
            (4, "out-of-range")
        ]
    );
    assert!(
        p.errors[0].message.contains("0..255"),
        "{}",
        p.errors[0].message
    );
    assert!(
        p.errors[0].message.contains("300"),
        "{}",
        p.errors[0].message
    );
}

#[test]
fn every_error_code_has_a_case() {
    let cases = [
        ("SET r1, #", "bad-char"),
        ("SET r1, 0b2", "bad-number"),
        ("LOAD r1, [r2 + 1", "expected"),
        ("FOO", "unknown-mnemonic"),
        (".bss", "unknown-directive"),
        ("ADD r1", "operand-count"),
        ("ADD r1, r2, 5", "not-a-register"),
        ("LOAD r1, r2", "bad-operand"),
        ("SHL r1, r2, 16", "out-of-range"),
        ("JMP nowhere", "unknown-symbol"),
        ("a: NOP\na: NOP", "duplicate-symbol"),
        (".word 1", "data-in-code"),
        (".data\nNOP", "code-in-data"),
        (".data\nt: .word 1\n.code\nJMP t", "jump-to-data"),
        (".equ 5 5", "bad-name"),
    ];
    for (src, code) in cases {
        assert_eq!(first_error(src).1, code, "{src:?}");
    }
    let far = format!("JMP far\n{}far: HALT", "NOP\n".repeat(600));
    assert_eq!(first_error(&far).1, "jump-too-far");
}

#[test]
fn layout_places_lines_and_sizes_set16() {
    let lines: Vec<Line> = "a: SET16 r1, 5\nSET16 r1, 0x4000\n.data\nt: .word 1, 2\n.code\nb: HALT"
        .lines()
        .map(|l| parse(&tokenize(l).unwrap()).unwrap())
        .collect();
    let lay = layout(&lines).unwrap();
    let placed: Vec<Option<(String, u16, u16)>> = lay
        .lines
        .iter()
        .map(|p| p.as_ref().map(|p| (p.section.clone(), p.address, p.size)))
        .collect();
    assert_eq!(
        placed,
        vec![
            Some(("code".into(), 0, 1)),
            Some(("code".into(), 1, 2)),
            None,
            Some(("data".into(), 0, 2)),
            None,
            Some(("code".into(), 3, 1)),
        ]
    );
    assert_eq!(lay.symbols["b"].value, 3);
    // encode one line on its own
    let set16 = lines[1].body.as_ref().unwrap();
    assert_eq!(
        encode(set16, &lay.symbols, lay.lines[1].as_ref().unwrap()).unwrap(),
        words("SET r1, 0\nSETH r1, 0x40")
    );
}
