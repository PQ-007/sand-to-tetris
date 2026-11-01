// C Shard as specified in docs/LANGUAGE.md, one test per rule. Programs are
// compiled to VM code and run on s2t-vm's interpreter (and some all the way
// down on the reference CPU).
use s2t_isa::{Bus, Cpu, Memory};
use s2t_lang::{compile, parse, tokenize, Expr, Token};

fn vm_of(src: &str) -> String {
    let c = compile(src);
    assert!(c.errors.is_empty(), "{src}\n{:?}", c.errors);
    c.vm.join("\n")
}

/// main's result, run on the VM interpreter.
fn run(src: &str) -> i16 {
    let vm = vm_of(src);
    let o = s2t_vm::run(&vm, 5_000_000).unwrap_or_else(|e| panic!("{vm}\n{e:?}"));
    assert!(o.halted, "didn't halt:\n{src}");
    o.result as i16
}

/// main's result and the memory, run on the reference CPU.
fn on_cpu(src: &str) -> (i16, Memory) {
    let b = s2t_vm::build(&vm_of(src));
    assert!(b.errors.is_empty(), "{:?}", b.errors);
    let mut mem = Memory::default();
    for (i, w) in b.program.data.iter().enumerate() {
        mem.write(i as u16, *w);
    }
    let mut cpu = Cpu::default();
    for _ in 0..5_000_000 {
        let pc = cpu.pc;
        cpu.step(&b.program.code, &mut mem);
        if cpu.pc == pc {
            let r = mem.read(0x3fff) as i16;
            return (r, mem);
        }
    }
    panic!("didn't halt on the CPU:\n{src}");
}

fn ret(expr: &str) -> i16 {
    run(&format!("fn main() -> int {{ return {expr}; }}"))
}

fn first_error(src: &str) -> (usize, String) {
    let c = compile(src);
    let e = c
        .errors
        .first()
        .unwrap_or_else(|| panic!("no error for:\n{src}"));
    (e.line, e.code.clone())
}

// ---- tokens and the tree ---------------------------------------------------------

#[test]
fn tokenizes_with_lines() {
    let t = tokenize("var x = 'A'; // note\nwhile x <= 0x10 { x = x - 1; }\n\"hi\\n\"").unwrap();
    let j = serde_json::to_string(&t[..4]).unwrap();
    assert_eq!(
        j,
        r#"[{"kind":"kw","text":"var","line":1},{"kind":"name","text":"x","line":1},{"kind":"sym","text":"=","line":1},{"kind":"num","value":65,"line":1}]"#
    );
    assert!(t.contains(&Token::Sym {
        text: "<=".into(),
        line: 2
    }));
    assert!(t.contains(&Token::Num { value: 16, line: 2 }));
    assert_eq!(
        t.last(),
        Some(&Token::Str {
            text: "hi\n".into(),
            line: 3
        })
    );
    let t = tokenize("for i in 0..10 { a[i] = mem[i] >> 2; } fn f() -> int").unwrap();
    let syms: Vec<String> = t
        .iter()
        .filter_map(|t| match t {
            Token::Sym { text, .. } => Some(text.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(
        syms,
        ["..", "{", "[", "]", "=", "[", "]", ">>", ";", "}", "(", ")", "->"]
    );
}

#[test]
fn token_errors_name_the_problem() {
    let code = |s: &str| tokenize(s).unwrap_err().code;
    assert_eq!(code("x = 12ab;"), "bad-number");
    assert_eq!(code("x = 70000;"), "bad-number");
    assert_eq!(code("x = 'AB';"), "bad-char-literal");
    assert_eq!(code("x = '\\q';"), "bad-char-literal");
    assert_eq!(code("x = \"open"), "bad-string");
    assert_eq!(code("x = #;"), "bad-char");
    assert_eq!(code("if x != 1 { y = !x; }"), "bad-char");
    assert_eq!(tokenize("\n\n  @").unwrap_err().line, 3);
}

#[test]
fn parses_precedence_into_a_tree() {
    let p =
        parse(&tokenize("fn main() -> int { return 1 + 2 * 3 & 7 == 7 or not true; }").unwrap())
            .unwrap();
    let j = serde_json::to_value(&p).unwrap();
    let ret = &j["items"][0]["body"][0]["value"];
    assert_eq!(ret["op"], "or");
    assert_eq!(ret["left"]["op"], "==");
    assert_eq!(ret["left"]["left"]["op"], "&");
    assert_eq!(ret["left"]["left"]["left"]["op"], "+");
    assert_eq!(ret["left"]["left"]["left"]["right"]["op"], "*");
    assert_eq!(ret["right"]["op"], "not");
    assert_eq!(j["items"][0]["kind"], "fn");
    assert_eq!(j["items"][0]["result"]["kind"], "int");
    let p =
        parse(&tokenize("var b: [int; 4]; fn f(a: [bool]) { if x { } else if y { } }").unwrap())
            .unwrap();
    let j = serde_json::to_value(&p).unwrap();
    assert_eq!(j["items"][0]["type"]["kind"], "array");
    assert_eq!(j["items"][0]["type"]["size"]["value"], 4);
    assert_eq!(
        j["items"][1]["params"][0]["type"]["size"],
        serde_json::Value::Null
    );
    assert_eq!(j["items"][1]["body"][0]["else"][0]["kind"], "if");
    match &p.items[1] {
        s2t_lang::Item::Fn { body, .. } => match &body[0] {
            s2t_lang::Stmt::If { cond, .. } => assert!(matches!(cond, Expr::Name { .. })),
            other => panic!("{other:?}"),
        },
        other => panic!("{other:?}"),
    }
}

#[test]
fn syntax_errors_say_what_was_expected() {
    let e = |s: &str| {
        let e = parse(&tokenize(s).unwrap()).unwrap_err();
        (
            e.line,
            e.code,
            e.args.get("what").cloned().unwrap_or_default(),
        )
    };
    assert_eq!(
        e("fn main() {\n  var x = 1\n}"),
        (3, "expected".into(), "`;`".into())
    );
    assert_eq!(
        e("fn main() { x = ; }"),
        (1, "expected".into(), "expression".into())
    );
    assert_eq!(e("x = 1;"), (1, "expected".into(), "declaration".into()));
    assert_eq!(e("fn main( { }"), (1, "expected".into(), "name".into()));
    assert_eq!(e("var a: [str; 3];"), (1, "expected".into(), "type".into()));
    assert_eq!(e("fn main() { if 1 < 2 < 3 { } }").1, "chained-comparison");
    assert_eq!(e("fn main() {").2, "`}`");
}

// ---- what programs do -------------------------------------------------------------

#[test]
fn arithmetic_has_the_usual_precedence() {
    assert_eq!(ret("2 + 3 * 4"), 14);
    assert_eq!(ret("(2 + 3) * 4"), 20);
    assert_eq!(ret("10 - 4 - 3"), 3);
    assert_eq!(ret("-7 / 2"), -3);
    assert_eq!(ret("-7 % 2"), -1);
    assert_eq!(ret("7 / 0"), -1);
    assert_eq!(ret("-32768"), -32768);
    assert_eq!(ret("32767 + 1"), -32768);
    assert_eq!(ret("1 << 4 | 1"), 17);
    assert_eq!(ret("0x8000 >> 15"), 1);
    assert_eq!(ret("~0"), -1);
    assert_eq!(ret("6 & 3 ^ 1"), 3);
    assert_eq!(ret("-(-5)"), 5);
    assert_eq!(ret("'A' + 1"), 66);
}

#[test]
fn conditions_and_bit_operators_stay_apart() {
    let b = |cond: &str| {
        run(&format!(
            "fn main() -> int {{ if {cond} {{ return 1; }} return 0; }}"
        ))
    };
    assert_eq!(b("3 < 5 and not (2 == 3)"), 1);
    assert_eq!(b("5 & 1 == 1"), 1, "& binds tighter than ==");
    assert_eq!(b("true == false or -3 <= -3"), 1);
    assert_eq!(b("30000 > -30000"), 1);
    assert_eq!(b("not true"), 0);
}

#[test]
fn and_and_or_stop_early() {
    let src = "var calls = 0;\n\
               fn touch(v: bool) -> bool { calls = calls + 1; return v; }\n\
               fn main() -> int {\n\
                   if false and touch(true) { }\n\
                   if true or touch(true) { }\n\
                   if true and touch(false) { }\n\
                   if false or touch(true) { }\n\
                   return calls;\n\
               }";
    assert_eq!(run(src), 2);
    // Which calls ran, and what each gave: bit k = call k ran; then results.
    let src = "var ran = 0;\n\
               fn hit(k: int, v: bool) -> bool { ran = ran | (1 << k); return v; }\n\
               fn bit(b: bool, k: int) -> int { if b { return 1 << k; } return 0; }\n\
               fn main() -> int {\n\
                   var r = bit(false and hit(0, true), 4) | bit(true and hit(1, false), 5);\n\
                   r = r | bit(true or hit(2, false), 6) | bit(false or hit(3, true), 7);\n\
                   return r | ran;\n\
               }";
    // Calls 1 and 3 run (bits 1, 3); results: false, false, true, true.
    assert_eq!(run(src), 0b1100_1010);
}

#[test]
fn every_comparison_on_signed_pairs() {
    let pairs = [
        (3, 5),
        (5, 3),
        (4, 4),
        (-3, 2),
        (30000, -30000),
        (-32768, 32767),
    ];
    for (a, b) in pairs {
        let src = format!(
            "fn bit(c: bool, k: int) -> int {{ if c {{ return 1 << k; }} return 0; }}\n\
             fn main() -> int {{ var a = {a}; var b = {b};\n\
             return bit(a == b, 0) | bit(a != b, 1) | bit(a < b, 2) | bit(a <= b, 3) | bit(a > b, 4) | bit(a >= b, 5); }}"
        );
        let want = [a == b, a != b, a < b, a <= b, a > b, a >= b]
            .iter()
            .enumerate()
            .fold(0, |acc, (k, c)| acc | ((*c as i16) << k));
        assert_eq!(run(&src), want, "{a} vs {b}");
    }
}

#[test]
fn loops_break_and_continue() {
    let src = "fn main() -> int {\n\
                   var total = 0;\n\
                   for i in 0..10 {\n\
                       if i == 3 { continue; }\n\
                       if i == 7 { break; }\n\
                       total = total + i;\n\
                   }\n\
                   var n = 5;\n\
                   while true { n = n - 1; if n == 0 { break; } total = total + 100; }\n\
                   return total;\n\
               }";
    // 0+1+2+4+5+6 = 18, plus 4 × 100.
    assert_eq!(run(src), 418);
    // The end is computed once; an empty range never runs.
    let src = "var n = 3;\n\
               fn main() -> int { var c = 0; for i in 0..n { n = 10; c = c + 1; } for j in 5..2 { c = 99; } return c; }";
    assert_eq!(run(src), 3);
}

#[test]
fn globals_arrays_and_constants() {
    let src = "const ROWS: int = 4;\n\
               const SHAPES: [int; 3] = [10, 20, 30];\n\
               const WORD = \"HI\";\n\
               var board: [int; ROWS * 2];\n\
               var score = 5;\n\
               var flag: bool;\n\
               fn sum(a: [int], n: int) -> int { var t = 0; for i in 0..n { t = t + a[i]; } return t; }\n\
               fn main() -> int {\n\
                   board[7] = SHAPES[2];\n\
                   board[0] = WORD[1];\n\
                   if not flag { score = score + 1; }\n\
                   return sum(board, ROWS * 2) + sum(SHAPES, 3) + score;\n\
               }";
    // board: 'I' (73) + 30; SHAPES: 60; score 6.
    assert_eq!(run(src), 73 + 30 + 60 + 6);
    // A one-element array is still an array.
    assert_eq!(run("var a: [int; 1];\nfn f(x: [int]) -> int { return x[0]; }\nfn main() -> int { a[0] = 9; return f(a); }"), 9);
}

#[test]
fn globals_are_ram_from_address_0() {
    let src = "var a = 7;\nvar b: [int; 3] = [1, 2, 3];\nconst T = [4, 5];\nfn main() { b[1] = mem[0] + T[0]; }";
    let (_, mut mem) = on_cpu(src);
    let ram: Vec<u16> = (0..6).map(|i| mem.read(i)).collect();
    assert_eq!(ram, [7, 1, 11, 3, 4, 5]);
}

#[test]
fn mem_reads_and_writes_any_address() {
    let src = "fn main() -> int { mem[0x4000] = -1; mem[0x4001] = mem[0x4000] >> 8; return mem[0x6000]; }";
    let (r, mem) = on_cpu(src);
    assert_eq!(r, 0);
    assert_eq!(&mem.screen[..2], &[0xffff, 0x00ff]);
}

#[test]
fn functions_calls_and_recursion() {
    let src = "fn fib(n: int) -> int { if n < 2 { return n; } return fib(n - 1) + fib(n - 2); }\n\
               fn main() -> int { return fib(15); }";
    assert_eq!(run(src), 610);
    let src = "var log: [int; 3];\nvar n = 0;\n\
               fn note(v: int) { log[n] = v; n = n + 1; }\n\
               fn sign(v: int) -> int { if v < 0 { return -1; } else if v == 0 { return 0; } else { return 1; } }\n\
               fn main() -> int { note(sign(-5)); note(sign(0)); note(sign(9)); return log[0] * 100 + log[1] * 10 + log[2]; }";
    assert_eq!(run(src), -100 + 1);
}

#[test]
fn main_without_a_result_returns_0() {
    assert_eq!(run("var x = 3; fn main() { x = 4; }"), 0);
}

#[test]
fn a_reference_variable_can_point_at_either_array() {
    let src = "var a: [int; 2] = [1, 2];\nvar b: [int; 2] = [30, 40];\n\
               fn main() -> int { var r = a; var s: [int] = b; r = s; return r[1]; }";
    assert_eq!(run(src), 40);
}

#[test]
fn compiled_programs_run_the_same_on_the_cpu() {
    let src = "const N = 12;\nvar sq: [int; N];\n\
               fn main() -> int { var t = 0; for i in 0..N { sq[i] = i * i - i / 3; t = t ^ sq[i] << 1; } return t % 1000; }";
    assert_eq!(on_cpu(src).0, run(src));
}

// ---- names and types --------------------------------------------------------------

#[test]
fn type_errors_name_the_line() {
    let e = first_error;
    assert_eq!(
        e("fn main() {\n var x = 1;\n x = true;\n}"),
        (3, "type-mismatch".into())
    );
    assert_eq!(e("fn main() {\n if 5 { }\n}"), (2, "type-mismatch".into()));
    assert_eq!(
        e("fn main() -> int {\n return 1 + true;\n}"),
        (2, "type-mismatch".into())
    );
    assert_eq!(
        e("fn main() {\n var b = 1 and true;\n}"),
        (2, "type-mismatch".into())
    );
    assert_eq!(
        e("fn main() {\n var b = 1 == true;\n}"),
        (2, "type-mismatch".into())
    );
    assert_eq!(
        e("fn f() { }\nfn main() {\n var x = f() + 1;\n}"),
        (3, "type-mismatch".into())
    );
    assert_eq!(
        e("fn f() -> int {\n return;\n}\nfn main() { }"),
        (2, "type-mismatch".into())
    );
    assert_eq!(e("fn main() {\n return 3;\n}"), (2, "type-mismatch".into()));
    assert_eq!(
        e("var a: [bool; 2];\nfn f(x: [int]) { }\nfn main() {\n f(a);\n}"),
        (4, "type-mismatch".into())
    );
}

#[test]
fn name_errors() {
    let e = first_error;
    assert_eq!(e("fn main() {\n x = 1;\n}"), (2, "unknown-name".into()));
    assert_eq!(e("fn main() {\n var y = z;\n}"), (2, "unknown-name".into()));
    assert_eq!(e("fn main() {\n g();\n}"), (2, "unknown-name".into()));
    assert_eq!(
        e("var a = 1;\nfn a() { }\nfn main() { }"),
        (2, "duplicate-name".into())
    );
    assert_eq!(
        e("fn main() {\n var a = 1;\n for a in 0..2 { }\n}"),
        (3, "duplicate-name".into())
    );
    assert_eq!(
        e("fn main() {\n var x = 1;\n var x = 2;\n}"),
        (3, "duplicate-name".into())
    );
    assert_eq!(
        e("fn main() {\n if true { var t = 1; }\n var u = t;\n}"),
        (3, "unknown-name".into())
    );
    assert_eq!(e("var _x = 1;\nfn main() { }"), (1, "reserved-name".into()));
    assert_eq!(
        e("var x = 1;\nfn main() {\n x(2);\n}"),
        (3, "not-a-function".into())
    );
    assert_eq!(
        e("fn f() { }\nfn main() {\n var y = f;\n}"),
        (3, "not-a-value".into())
    );
    assert_eq!(
        e("fn f(a: int) { }\nfn main() {\n f(1, 2);\n}"),
        (3, "arg-count".into())
    );
}

#[test]
fn statement_and_declaration_errors() {
    let e = first_error;
    assert_eq!(
        e("const N = 3;\nfn main() {\n N = 4;\n}"),
        (3, "not-assignable".into())
    );
    assert_eq!(
        e("const T = [1, 2];\nfn main() {\n T[0] = 4;\n}"),
        (3, "not-assignable".into())
    );
    assert_eq!(
        e("var a: [int; 2];\nfn main() {\n a = 4;\n}"),
        (3, "not-assignable".into())
    );
    assert_eq!(
        e("fn main() {\n 1 + 2 = 3;\n}"),
        (2, "not-assignable".into())
    );
    assert_eq!(
        e("var x = 1;\nfn main() {\n var y = x[0];\n}"),
        (3, "not-an-array".into())
    );
    assert_eq!(
        e("var x = 1;\nvar y = x + 1;\nfn main() { }"),
        (2, "not-constant".into())
    );
    assert_eq!(
        e("const A = B;\nconst B = A;\nfn main() { }").1,
        "not-constant"
    );
    assert_eq!(
        e("var a: [int; 0];\nfn main() { }"),
        (1, "bad-array-size".into())
    );
    assert_eq!(
        e("var a: [int; 2] = [1, 2, 3];\nfn main() { }"),
        (1, "array-length".into())
    );
    assert_eq!(e("var a;\nfn main() { }"), (1, "missing-type".into()));
    assert_eq!(
        e("fn main() {\n break;\n}"),
        (2, "break-outside-loop".into())
    );
    assert_eq!(
        e("fn f(x: int) -> int {\n if x > 0 { return 1; }\n}\nfn main() { }"),
        (1, "missing-return".into())
    );
    assert_eq!(
        e("fn main() {\n 1 + 2;\n}"),
        (2, "call-not-statement".into())
    );
    assert_eq!(
        e("fn main() {\n var a = [1, 2];\n}"),
        (2, "not-a-value".into())
    );
    assert_eq!(e("fn start() { }"), (0, "no-main".into()));
    assert_eq!(e("fn main(x: int) { }"), (1, "main-signature".into()));
    assert_eq!(
        e("fn main() -> bool { return true; }"),
        (1, "main-signature".into())
    );
    assert_eq!(
        e("var big: [int; 4000];\nvar more: [int; 200];\nfn main() { }").1,
        "too-many-globals"
    );
    let many: String = (0..127).map(|i| format!("var v{i} = {i};\n")).collect();
    assert_eq!(
        e(&format!("fn main() {{\n{many}}}")),
        (1, "too-many-variables".into())
    );
}

#[test]
fn every_check_error_is_reported() {
    let c = compile("fn main() {\n x = 1;\n if 3 { }\n break;\n}");
    let codes: Vec<(usize, &str)> = c.errors.iter().map(|e| (e.line, e.code.as_str())).collect();
    assert_eq!(
        codes,
        [
            (2, "unknown-name"),
            (3, "type-mismatch"),
            (4, "break-outside-loop")
        ]
    );
}

// ---- random expressions: run as code vs worked out as constants -------------------

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0 >> 16
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
}

fn int_expr(r: &mut Rng, depth: u32) -> String {
    if depth == 0 || r.below(4) == 0 {
        return match r.below(3) {
            0 => format!("{}", r.next() as u16),
            1 => format!("{}", r.below(20)),
            _ => format!("'{}'", (b'A' + r.below(26) as u8) as char),
        };
    }
    let ops = ["+", "-", "*", "/", "%", "&", "|", "^", "<<", ">>"];
    match r.below(6) {
        0 => format!("-({})", int_expr(r, depth - 1)),
        1 => format!("~{}", int_expr(r, depth - 1)),
        _ => format!(
            "({} {} {})",
            int_expr(r, depth - 1),
            ops[r.below(ops.len() as u64) as usize],
            int_expr(r, depth - 1)
        ),
    }
}

fn bool_expr(r: &mut Rng, depth: u32) -> String {
    let cmps = ["==", "!=", "<", "<=", ">", ">="];
    if depth == 0 || r.below(3) == 0 {
        return format!(
            "{} {} {}",
            int_expr(r, 2),
            cmps[r.below(6) as usize],
            int_expr(r, 2)
        );
    }
    match r.below(3) {
        0 => format!("not ({})", bool_expr(r, depth - 1)),
        1 => format!(
            "({}) and ({})",
            bool_expr(r, depth - 1),
            bool_expr(r, depth - 1)
        ),
        _ => format!(
            "({}) or ({})",
            bool_expr(r, depth - 1),
            bool_expr(r, depth - 1)
        ),
    }
}

fn folded(src: &str) -> u16 {
    let tokens = tokenize(src).unwrap_or_else(|e| panic!("{src}: {e}"));
    let p = parse(&tokens).unwrap_or_else(|e| panic!("{src}: {e}"));
    let info = s2t_lang::check(&p).unwrap_or_else(|e| panic!("{src}: {e:?}"));
    info.consts["X"]
}

#[test]
fn random_expressions_run_as_they_fold() {
    let mut r = Rng(0xc0ffee);
    for _ in 0..300 {
        let e = int_expr(&mut r, 4);
        let got = run(&format!("fn main() -> int {{ return {e}; }}"));
        assert_eq!(
            got as u16,
            folded(&format!("const X = {e};\nfn main() {{ }}")),
            "{e}"
        );
        let b = bool_expr(&mut r, 3);
        let got = run(&format!(
            "fn main() -> int {{ if {b} {{ return -1; }} return 0; }}"
        ));
        assert_eq!(
            got as u16,
            folded(&format!("const X = {b};\nfn main() {{ }}")),
            "{b}"
        );
    }
}

#[test]
fn every_vm_line_maps_to_its_source_line() {
    let c = compile("var a = 2;\nfn main() -> int {\n  var x = 1;\n  while x < 5 {\n    x = x + a;\n  }\n  return x;\n}");
    assert_eq!(c.vm.len(), c.source_map.len());
    let lines = |src_line: usize| -> Vec<&str> {
        c.vm.iter()
            .zip(&c.source_map)
            .filter(|(_, l)| **l == src_line)
            .map(|(v, _)| v.as_str())
            .collect()
    };
    assert_eq!(lines(3), ["push 1", "set local 0"]);
    assert!(lines(5).contains(&"add"));
    assert!(
        lines(4).contains(&"lt") && lines(4).contains(&"jump L1"),
        "{:?}",
        lines(4)
    );
    assert_eq!(
        lines(0),
        [
            "func _init 0 0",
            "push 2",
            "set global 0",
            "push 0",
            "return"
        ]
    );
}

#[test]
fn a_string_in_a_function_is_a_hidden_constant_array() {
    let src = "var log: [int; 2];\n\
               fn first(s: [int]) -> int { return s[0]; }\n\
               fn main() -> int { var t = \"OK\"; log[0] = first(\"HI\"); log[1] = first(\"HI\"); return t[1] + first(\"HI\"); }";
    assert_eq!(run(src), 'K' as i16 + 'H' as i16);
    let p = parse(&tokenize(src).unwrap_or_default()).unwrap_or_default();
    let info = s2t_lang::check(&p).unwrap_or_default();
    // After the declared globals, once per text, in order of first use.
    assert_eq!(info.globals["\"OK\""].index, 2);
    assert_eq!(info.globals["\"HI\""].index, 4);
    assert_eq!(info.globals["\"HI\""].init, vec![72, 73]);
    assert_eq!(info.globals.len(), 3);
}

#[test]
fn a_local_hides_a_global_constant_or_function_of_the_same_name() {
    let src = "var n = 100;\nconst K = 7;\nfn f() -> int { return 1; }\n\
               fn g(n: int) -> int { var K = n * 2; var f = K + 1; return f; }\n\
               fn main() -> int { return g(5) * 1000 + n + K + f(); }";
    assert_eq!(run(src), 11 * 1000 + 100 + 7 + 1);
}
