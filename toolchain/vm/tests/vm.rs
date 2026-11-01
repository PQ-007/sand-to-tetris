// The VM as specified in docs/VM.md, one test per rule. Translated programs
// are assembled with s2t-asm and run on s2t-isa's CPU, and compared with the
// interpreter, which is the VM's meaning as code.
use s2t_isa::{Bus, Cpu, Memory};
use s2t_vm::{build, parse, run, Command, Seg, Vm};

/// Runs a translated program on the reference CPU until it halts (an
/// instruction that leaves PC unchanged). Returns (r0..r7, memory, steps).
fn on_cpu(source: &str, max: usize) -> ([u16; 8], Memory, usize) {
    let b = build(source);
    assert!(b.errors.is_empty(), "{source}\n{:?}", b.errors);
    let mut mem = Memory::default();
    for (i, w) in b.program.data.iter().enumerate() {
        mem.write(i as u16, *w);
    }
    let mut cpu = Cpu::default();
    for step in 0..max {
        let pc = cpu.pc;
        cpu.step(&b.program.code, &mut mem);
        if cpu.pc == pc {
            return (cpu.regs, mem, step);
        }
    }
    panic!("didn't halt in {max} steps:\n{source}");
}

/// main's result, run both ways; they must agree, and the stack must end
/// with just the result on it.
fn result(source: &str) -> u16 {
    let (regs, mut mem, _) = on_cpu(source, 2_000_000);
    assert_eq!(regs[6], 0x3fff, "SP after main returns\n{source}");
    let on_cpu = mem.read(0x3fff);
    let vm = run(source, 2_000_000).expect("checks");
    assert!(vm.halted, "the interpreter didn't halt\n{source}");
    assert_eq!(vm.result, on_cpu, "interpreter vs CPU\n{source}");
    on_cpu
}

fn main_of(body: &str) -> String {
    format!("func main 0 0\n{body}\nreturn")
}

fn first_error(source: &str) -> (usize, String) {
    let b = build(source);
    let e = b
        .errors
        .first()
        .unwrap_or_else(|| panic!("no error for {source:?}"));
    (e.line, e.code.clone())
}

// ---- parse ------------------------------------------------------------------

#[test]
fn parses_every_kind_of_command() {
    assert_eq!(parse("  ; just a comment").unwrap(), None);
    assert_eq!(parse("").unwrap(), None);
    assert_eq!(
        parse("push 5").unwrap(),
        Some(Command::Push {
            seg: Seg::Const,
            n: 5
        })
    );
    assert_eq!(
        parse("PUSH -1 ; comment").unwrap(),
        Some(Command::Push {
            seg: Seg::Const,
            n: 0xffff
        })
    );
    assert_eq!(
        parse("push 0b1111_0000").unwrap(),
        Some(Command::Push {
            seg: Seg::Const,
            n: 0xf0
        })
    );
    assert_eq!(
        parse("push Local 3").unwrap(),
        Some(Command::Push {
            seg: Seg::Local,
            n: 3
        })
    );
    assert_eq!(
        parse("set global 0x10").unwrap(),
        Some(Command::Set {
            seg: Seg::Global,
            n: 16
        })
    );
    assert_eq!(parse("add").unwrap(), Some(Command::Add));
    assert_eq!(
        parse("jumpifnot done").unwrap(),
        Some(Command::Jumpifnot {
            name: "done".into()
        })
    );
    assert_eq!(
        parse("func draw_row 2 3").unwrap(),
        Some(Command::Func {
            name: "draw_row".into(),
            args: 2,
            locals: 3
        })
    );
    assert_eq!(
        parse("call draw_row 2").unwrap(),
        Some(Command::Call {
            name: "draw_row".into(),
            args: 2
        })
    );
}

#[test]
fn commands_are_json_the_learner_can_read() {
    let j = |line: &str| serde_json::to_string(&parse(line).unwrap().unwrap()).unwrap();
    assert_eq!(j("push 5"), r#"{"op":"push","seg":"const","n":5}"#);
    assert_eq!(j("set arg 1"), r#"{"op":"set","seg":"arg","n":1}"#);
    assert_eq!(j("return"), r#"{"op":"return"}"#);
    assert_eq!(j("label top"), r#"{"op":"label","name":"top"}"#);
    assert_eq!(
        j("func f 1 2"),
        r#"{"op":"func","name":"f","args":1,"locals":2}"#
    );
    assert_eq!(j("call f 1"), r#"{"op":"call","name":"f","args":1}"#);
}

#[test]
fn parse_errors_name_the_problem() {
    let code = |line: &str| parse(line).unwrap_err().code;
    assert_eq!(code("push 12ab"), "bad-number");
    assert_eq!(code("push 70000"), "out-of-range");
    assert_eq!(code("push -32769"), "out-of-range");
    assert_eq!(code("push global 4096"), "out-of-range");
    assert_eq!(code("push stack 1"), "bad-segment");
    assert_eq!(code("set 5"), "set-constant");
    assert_eq!(code("set const 5"), "bad-segment");
    assert_eq!(code("frobnicate"), "unknown-command");
    assert_eq!(code("add 1"), "operand-count");
    assert_eq!(code("push"), "operand-count");
    assert_eq!(code("push local"), "operand-count");
    assert_eq!(code("jump"), "operand-count");
    assert_eq!(code("label 9lives"), "bad-name");
    assert_eq!(code("label a__b"), "bad-name");
    assert_eq!(code("func r3 0 0"), "bad-name");
    assert_eq!(code("func R7 0 0"), "bad-name");
    assert_eq!(code("func f x 0"), "bad-number");
    assert_eq!(code("func f 100 27"), "too-many-variables");
    assert!(parse("func f 100 26").is_ok());
}

// ---- whole-program checks ------------------------------------------------------

#[test]
fn program_errors_name_the_line() {
    assert_eq!(
        first_error("push 1\nfunc main 0 0\nreturn"),
        (1, "outside-function".into())
    );
    assert_eq!(
        first_error("func main 0 0\npush 0\nreturn\nfunc main 0 0\npush 0\nreturn"),
        (4, "duplicate-function".into())
    );
    assert_eq!(
        first_error("func main 0 0\nlabel a\nlabel a\npush 0\nreturn"),
        (3, "duplicate-label".into())
    );
    assert_eq!(
        first_error("func main 0 0\njump nowhere"),
        (2, "unknown-label".into())
    );
    assert_eq!(
        first_error("func main 0 0\ncall f 0\nreturn"),
        (2, "unknown-function".into())
    );
    assert_eq!(
        first_error("func main 0 0\npush 1\ncall f 1\nreturn\nfunc f 2 0\npush 0\nreturn"),
        (3, "arg-count".into())
    );
    assert_eq!(
        first_error("func f 0 0\npush 0\nreturn"),
        (0, "no-main".into())
    );
    assert_eq!(
        first_error("func main 1 0\npush 0\nreturn"),
        (1, "main-args".into())
    );
    assert_eq!(
        first_error("func main 0 0\npush 0"),
        (1, "no-return".into())
    );
    assert_eq!(
        first_error("func main 0 0\nfunc f 0 0\npush 0\nreturn"),
        (1, "no-return".into())
    );
    assert_eq!(
        first_error("func main 0 1\npush local 1\nreturn"),
        (2, "no-variable".into())
    );
    assert_eq!(
        first_error("func main 0 0\npush 0\nreturn\nfunc f 1 0\nset arg 1\npush 0\nreturn"),
        (5, "no-variable".into())
    );
}

#[test]
fn every_error_is_reported() {
    let b = build("func main 0 0\npush 12ab\nfrob\njump nowhere\nreturn");
    let codes: Vec<(usize, &str)> = b.errors.iter().map(|e| (e.line, e.code.as_str())).collect();
    assert_eq!(
        codes,
        vec![
            (2, "bad-number"),
            (3, "unknown-command"),
            (4, "unknown-label")
        ]
    );
}

#[test]
fn labels_are_local_to_their_function() {
    let src = "func main 0 0\npush 3\ncall f 1\njump end\nlabel end\nreturn\n\
               func f 1 0\npush arg 0\njump end\nlabel end\nreturn";
    assert_eq!(result(src), 3);
    assert_eq!(
        first_error("func main 0 0\npush 0\nreturn\nfunc f 0 0\nlabel x\npush 0\nreturn\nfunc g 0 0\njump x"),
        (9, "unknown-label".into())
    );
}

#[test]
fn a_function_too_long_for_a_jump_is_reported_on_its_line() {
    let body = "push 1\npop\n".repeat(130);
    let src = format!("func main 0 0\nlabel top\n{body}jump top\npush 0\nreturn");
    let (line, code) = first_error(&src);
    assert_eq!(code, "function-too-long");
    assert_eq!(line, 263);
}

// ---- what each command does ----------------------------------------------------

const EDGES: [i16; 12] = [0, 1, -1, 2, -2, 7, -7, 100, 255, 256, i16::MAX, i16::MIN];

fn binary(op: &str, a: i16, b: i16) -> u16 {
    result(&main_of(&format!("push {a}\npush {b}\n{op}")))
}

#[test]
fn arithmetic_wraps_at_16_bits() {
    for a in EDGES {
        for b in EDGES {
            assert_eq!(binary("add", a, b), a.wrapping_add(b) as u16, "{a} + {b}");
            assert_eq!(binary("sub", a, b), a.wrapping_sub(b) as u16, "{a} - {b}");
            assert_eq!(binary("and", a, b), (a & b) as u16);
            assert_eq!(binary("or", a, b), (a | b) as u16);
            assert_eq!(binary("xor", a, b), (a ^ b) as u16);
        }
        assert_eq!(
            result(&main_of(&format!("push {a}\nneg"))),
            a.wrapping_neg() as u16
        );
        assert_eq!(result(&main_of(&format!("push {a}\nnot"))), !a as u16);
    }
}

#[test]
fn shifts_use_the_low_4_bits_like_the_cpu() {
    for a in EDGES {
        for n in [0, 1, 4, 15, 16, 17] {
            let s = n & 15;
            assert_eq!(binary("shl", a, n), (a as u16) << s, "{a} shl {n}");
            assert_eq!(binary("shr", a, n), (a as u16) >> s, "{a} shr {n}");
            assert_eq!(binary("sar", a, n), (a >> s) as u16, "{a} sar {n}");
        }
    }
}

#[test]
fn comparisons_are_signed_and_exact_for_every_pair() {
    let t = |c: bool| if c { 0xffff } else { 0 };
    for a in EDGES {
        for b in EDGES {
            assert_eq!(binary("eq", a, b), t(a == b), "{a} eq {b}");
            assert_eq!(binary("ne", a, b), t(a != b), "{a} ne {b}");
            assert_eq!(binary("lt", a, b), t(a < b), "{a} lt {b}");
            assert_eq!(binary("gt", a, b), t(a > b), "{a} gt {b}");
            assert_eq!(binary("le", a, b), t(a <= b), "{a} le {b}");
            assert_eq!(binary("ge", a, b), t(a >= b), "{a} ge {b}");
        }
    }
}

/// div and mod as docs/VM.md defines them.
fn div_mod(a: i16, b: i16) -> (u16, u16) {
    if b == 0 {
        (0xffff, a as u16)
    } else {
        (a.wrapping_div(b) as u16, a.wrapping_rem(b) as u16)
    }
}

#[test]
fn mul_div_and_mod() {
    for a in EDGES {
        for b in EDGES {
            assert_eq!(binary("mul", a, b), a.wrapping_mul(b) as u16, "{a} * {b}");
            let (q, r) = div_mod(a, b);
            assert_eq!(binary("div", a, b), q, "{a} / {b}");
            assert_eq!(binary("mod", a, b), r, "{a} % {b}");
        }
    }
}

#[test]
fn mul_div_and_mod_on_random_values() {
    let mut rng = Rng(7);
    let mut body = String::new();
    let mut expect = 0u16;
    for _ in 0..150 {
        let (a, b) = (rng.next() as i16, (rng.next() >> rng.below(16)) as i16);
        let (q, r) = div_mod(a, b);
        body += &format!("push {a}\npush {b}\nmul\npush {a}\npush {b}\ndiv\nadd\npush {a}\npush {b}\nmod\nadd\nadd\n");
        expect = expect.wrapping_add((a.wrapping_mul(b) as u16).wrapping_add(q).wrapping_add(r));
    }
    let src = format!("func main 0 0\npush 0\n{body}return");
    assert_eq!(result(&src), expect);
}

#[test]
fn locals_args_and_globals() {
    let src = "func main 0 2\n\
               push 5\nset local 1\n\
               push 40\nset global 3\n\
               push local 1\npush local 0\npush 2\ncall f 3\n\
               push global 3\nadd\n\
               return\n\
               func f 3 1\n\
               push arg 0\npush arg 2\nsub\nset local 0\n\
               push arg 1\npush local 0\nadd\n\
               set arg 1\npush arg 1\n\
               return";
    // f(5, 0, 2): local0 = 5 - 2 = 3; arg1 = 0 + 3; returns 3; + global 3 = 43.
    assert_eq!(result(src), 43);
    let vm = run(src, 10_000).unwrap();
    assert_eq!(vm.memory.ram[3], 40, "global 3 is RAM[3]");
}

#[test]
fn locals_start_at_zero_and_the_stack_starts_empty() {
    assert_eq!(
        result("func main 0 3\npush local 0\npush local 2\nor\nreturn"),
        0
    );
    let (regs, _, _) = on_cpu("func main 0 0\npush 9\nreturn", 1000);
    assert_eq!(regs[6], 0x3fff);
}

#[test]
fn load_and_store_reach_any_address() {
    let src = main_of("push 0x4000\npush 0b1010\nstore\npush 0x4000\nload\npush 0x6000\nload\nadd");
    assert_eq!(result(&src), 0b1010);
    let vm = run(&src, 1000).unwrap();
    assert_eq!(vm.memory.screen[0], 0b1010, "0x4000 is the screen");
}

#[test]
fn pop_and_dup() {
    assert_eq!(result(&main_of("push 4\ndup\nmul\npush 99\npop")), 16);
}

#[test]
fn jumps_test_for_nonzero() {
    let src = "func main 0 1\n\
               push 10\nset local 0\npush 0\n\
               label loop\n\
               push local 0\nadd\n\
               push local 0\npush 1\nsub\ndup\nset local 0\n\
               jumpif loop\n\
               push 7\njumpifnot never\n\
               push 0\njumpifnot skip\npush 1000\nadd\n\
               label skip\nreturn\n\
               label never\npush 0\nreturn";
    assert_eq!(result(src), 55);
}

#[test]
fn recursion_works() {
    let fact = "func main 0 0\npush 7\ncall fact 1\nreturn\n\
                func fact 1 0\n\
                push arg 0\npush 2\nlt\njumpifnot more\npush 1\nreturn\n\
                label more\npush arg 0\npush arg 0\npush 1\nsub\ncall fact 1\nmul\nreturn";
    assert_eq!(result(fact), 5040);
    let fib = "func main 0 0\npush 15\ncall fib 1\nreturn\n\
               func fib 1 0\n\
               push arg 0\npush 2\nlt\njumpifnot more\npush arg 0\nreturn\n\
               label more\npush arg 0\npush 1\nsub\ncall fib 1\n\
               push arg 0\npush 2\nsub\ncall fib 1\nadd\nreturn";
    assert_eq!(result(fib), 610);
}

#[test]
fn function_names_can_be_assembly_words() {
    let src = "func main 0 0\ncall add 0\ncall HALT 0\nadd\ncall loop 0\nadd\nreturn\n\
               func add 0 0\npush 1\nreturn\n\
               func HALT 0 0\npush 2\nreturn\n\
               func loop 0 0\nlabel loop\npush 3\nreturn";
    assert_eq!(result(src), 6);
}

#[test]
fn globals_get_a_data_section_of_zeros() {
    let b = build("func main 0 0\npush global 9\nreturn");
    assert_eq!(b.program.data, vec![0; 10]);
    assert!(build(&main_of("push 1")).program.data.is_empty());
}

#[test]
fn the_runtime_is_added_only_when_needed() {
    let plain = build(&main_of("push 1"));
    assert!(!plain
        .lines
        .iter()
        .any(|l| l.contains("__mul") || l.contains("__div")));
    let with = build(&main_of("push 6\npush 7\nmul"));
    assert!(with.lines.iter().any(|l| l.starts_with("__mul:")));
}

#[test]
fn every_asm_line_maps_back_to_its_vm_line() {
    let b = build("func main 0 0\n\npush 1\npush 2\nadd\nreturn");
    assert_eq!(b.lines.len(), b.source_map.len());
    let add: Vec<&String> = b
        .lines
        .iter()
        .zip(&b.source_map)
        .filter(|(_, l)| **l == 5)
        .map(|(a, _)| a)
        .collect();
    assert!(add.iter().any(|l| l.contains("ADD")), "{add:?}");
    assert_eq!(b.source_map[0], 0, "the bootstrap belongs to no VM line");
}

// ---- random programs: interpreter vs CPU --------------------------------------------

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u16 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 16) as u16
    }
    fn below(&mut self, n: u16) -> u16 {
        self.next() % n
    }
}

const OPS: [&str; 18] = [
    "add", "sub", "and", "or", "xor", "shl", "shr", "sar", "mul", "div", "mod", "eq", "ne", "lt",
    "gt", "le", "ge", "add",
];

/// A random expression that pushes exactly one value.
fn expr(rng: &mut Rng, depth: u16, args: u16, locals: u16, out: &mut Vec<String>) {
    if depth == 0 || rng.below(3) == 0 {
        match rng.below(5) {
            0 if args > 0 => out.push(format!("push arg {}", rng.below(args))),
            1 if locals > 0 => out.push(format!("push local {}", rng.below(locals))),
            2 => out.push(format!("push global {}", rng.below(4))),
            _ => out.push(format!("push {}", rng.next() as i16 >> rng.below(16))),
        }
        return;
    }
    match rng.below(6) {
        0 => {
            expr(rng, depth - 1, args, locals, out);
            out.push(["neg", "not", "dup\nadd"][rng.below(3) as usize].into());
        }
        1 => {
            // A small screen address, written and read back.
            let addr = 0x4000 + rng.below(16);
            out.push(format!("push {addr}"));
            expr(rng, depth - 1, args, locals, out);
            out.push(format!("store\npush {addr}\nload"));
        }
        _ => {
            expr(rng, depth - 1, args, locals, out);
            expr(rng, depth - 1, args, locals, out);
            out.push(OPS[rng.below(OPS.len() as u16) as usize].into());
        }
    }
}

/// A random function body: assignments, an if/else, and calls to
/// functions with a higher number (so there's no endless recursion).
fn body(rng: &mut Rng, me: usize, funcs: &[(u16, u16)], out: &mut Vec<String>) {
    let (args, locals) = funcs[me];
    for i in 0..3 + rng.below(4) {
        if me + 1 < funcs.len() && rng.below(3) == 0 {
            let callee = me + 1 + rng.below((funcs.len() - me - 1) as u16) as usize;
            for _ in 0..funcs[callee].0 {
                expr(rng, 2, args, locals, out);
            }
            out.push(format!("call f{callee} {}", funcs[callee].0));
        } else {
            expr(rng, 3, args, locals, out);
        }
        match rng.below(4) {
            0 if locals > 0 => out.push(format!("set local {}", rng.below(locals))),
            1 if args > 0 => out.push(format!("set arg {}", rng.below(args))),
            2 => out.push(format!("set global {}", rng.below(4))),
            _ => {
                out.push(format!("jumpifnot else{i}"));
                expr(rng, 2, args, locals, out);
                out.push(format!(
                    "set global {}\njump end{i}\nlabel else{i}",
                    rng.below(4)
                ));
                expr(rng, 2, args, locals, out);
                out.push(format!("set global {}\nlabel end{i}", rng.below(4)));
            }
        }
    }
    expr(rng, 3, args, locals, out);
    out.push("return".into());
}

#[test]
fn random_programs_agree_with_the_interpreter() {
    let mut rng = Rng(0x5eed);
    for _ in 0..300 {
        let n = 1 + rng.below(4) as usize;
        let funcs: Vec<(u16, u16)> = (0..n)
            .map(|i| (if i == 0 { 0 } else { rng.below(4) }, rng.below(4)))
            .collect();
        let mut lines = Vec::new();
        for (i, (a, l)) in funcs.iter().enumerate() {
            let name = if i == 0 {
                "main".to_string()
            } else {
                format!("f{i}")
            };
            lines.push(format!("func {name} {a} {l}"));
            body(&mut rng, i, &funcs, &mut lines);
        }
        let src = lines.join("\n");
        let (regs, mut mem, _) = on_cpu(&src, 2_000_000);
        let vm = run(&src, 2_000_000).unwrap();
        assert!(vm.halted);
        assert_eq!(regs[6], 0x3fff, "{src}");
        assert_eq!(vm.result, mem.read(0x3fff), "result\n{src}");
        assert_eq!(&vm.memory.ram[..4], &mem.ram[..4], "globals\n{src}");
        assert_eq!(vm.memory.screen[..16], mem.screen[..16], "screen\n{src}");
    }
}

// ---- the interpreter, step by step ----------------------------------------------

#[test]
fn the_interpreter_steps_one_command_at_a_time() {
    let mut vm = Vm::new("func main 0 0\npush 2\npush 3\nadd\nreturn").unwrap();
    assert_eq!(vm.line(), 1);
    vm.step();
    assert_eq!(vm.line(), 2);
    vm.step();
    vm.step();
    assert_eq!(vm.stack(), vec![3, 2], "top first");
    vm.step();
    assert_eq!(vm.stack(), vec![5]);
    vm.step();
    assert!(vm.halted());
    assert_eq!(vm.stack(), vec![5]);
}
