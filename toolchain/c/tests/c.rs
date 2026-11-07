// The C compiler (docs/C.md), tested by running what it makes on the
// reference CPU (s2t-isa).
use s2t_isa::{Cpu, Memory};

struct Run {
    /// main's return value (r0 when the program halts).
    result: i16,
    mem: Memory,
    steps: usize,
}

fn compile(src: &str) -> s2t_c::Compiled {
    let c = s2t_c::build(src);
    assert!(c.errors.is_empty(), "{:?}\n{src}", c.errors);
    c
}

fn run_with(src: &str, max: usize, keys: &dyn Fn(usize) -> u16) -> Run {
    let c = compile(src);
    let mut mem = Memory::default();
    mem.ram[..c.data.len()].copy_from_slice(&c.data);
    let mut cpu = Cpu::default();
    let mut steps = 0;
    loop {
        mem.keyboard = keys(steps);
        mem.timer = (steps / 1000) as u16;
        let pc = cpu.pc;
        cpu.step(&c.code, &mut mem);
        steps += 1;
        if cpu.pc == pc {
            break;
        }
        assert!(steps < max, "didn't halt in {max} steps:\n{src}");
    }
    Run {
        result: cpu.regs[0] as i16,
        mem,
        steps,
    }
}

fn run(src: &str) -> Run {
    run_with(src, 20_000_000, &|_| 0)
}

fn value(src: &str) -> i16 {
    run(src).result
}

fn errors(src: &str) -> Vec<String> {
    s2t_c::build(src)
        .errors
        .into_iter()
        .map(|e| e.code)
        .collect()
}

#[test]
fn main_returns_a_value() {
    assert_eq!(value("int main(void) { return 42; }"), 42);
    assert_eq!(value("int main() { return -7; }"), -7);
}

#[test]
fn arithmetic_and_precedence() {
    assert_eq!(
        value("int main() { int a = 7, b = 3; return a * b + a / b - a % b; }"),
        21 + 2 - 1
    );
    assert_eq!(value("int main() { int a = -7, b = 2; return a / b; }"), -3);
    assert_eq!(value("int main() { int a = -7, b = 2; return a % b; }"), -1);
    assert_eq!(
        value("int main() { int a = 7, b = -2; return a / b * 10 + a % b; }"),
        -30 + 1
    );
    assert_eq!(
        value("int main() { int a = 1000, b = 0; return a / b; }"),
        0
    );
    assert_eq!(
        value("int main() { int a = 1000, b = 0; return a % b; }"),
        1000
    );
    assert_eq!(value("int main() { int x = 5; return -x + ~x; }"), -5 + !5);
    assert_eq!(value("int main() { int x = 1; return x << 4 | 3; }"), 19);
    assert_eq!(value("int main() { int x = -64; return x >> 3; }"), -8);
    assert_eq!(
        value("int main() { unsigned x = 0x8000; return x >> 15; }"),
        1
    );
    assert_eq!(
        value("int main() { int x = 300; return x * 300; }"),
        300i16.wrapping_mul(300)
    );
}

#[test]
fn constants_multiply_and_divide_without_the_runtime() {
    for (c, v) in [
        (3, 11),
        (5, -9),
        (7, 300),
        (10, -1234),
        (12, 99),
        (255, 3),
        (-4, 77),
        (-3, 5),
    ] {
        let src = format!("int main() {{ int x = {v}; return x * {c}; }}");
        assert_eq!(value(&src), (v as i16).wrapping_mul(c), "{v} * {c}");
    }
    for (c, v) in [
        (2, -7),
        (4, -9),
        (8, 1000),
        (16, -1),
        (1, 5),
        (-2, 9),
        (3, -10),
        (7, 100),
    ] {
        let src = format!("int main() {{ int x = {v}; return x / {c} * 1000 + x % {c}; }}");
        let want = (v as i16 / c).wrapping_mul(1000).wrapping_add(v as i16 % c);
        assert_eq!(value(&src), want, "{v} / {c}");
    }
    let asm = s2t_c::build("int main() { int x = 9; return x * 10 + x / 4; }").asm;
    assert!(
        !asm.iter()
            .any(|l| l.contains("__mul") || l.contains("__div")),
        "{asm:?}"
    );
}

#[test]
fn signed_and_unsigned_comparisons_are_exact() {
    let vals = [-32768i32, -32767, -1000, -1, 0, 1, 2, 1000, 32766, 32767];
    for a in vals {
        for b in vals {
            let src = format!(
                "int main() {{ int a = {a}, b = {b}; return (a < b) + 2 * (a <= b) + 4 * (a > b) + 8 * (a >= b) + 16 * (a == b) + 32 * (a != b); }}"
            );
            let want = (a < b) as i16
                + 2 * (a <= b) as i16
                + 4 * (a > b) as i16
                + 8 * (a >= b) as i16
                + 16 * (a == b) as i16
                + 32 * (a != b) as i16;
            assert_eq!(value(&src), want, "{a} vs {b}");
            let (ua, ub) = (a as u16, b as u16);
            let src = format!(
                "int main() {{ unsigned a = {ua}, b = {ub}; return (a < b) + 2 * (a <= b) + 4 * (a > b) + 8 * (a >= b); }}"
            );
            let want = (ua < ub) as i16
                + 2 * (ua <= ub) as i16
                + 4 * (ua > ub) as i16
                + 8 * (ua >= ub) as i16;
            assert_eq!(value(&src), want, "unsigned {ua} vs {ub}");
        }
    }
}

#[test]
fn control_flow() {
    let src = "int main() { int s = 0; for (int i = 1; i <= 10; i++) { if (i == 5) continue; if (i == 9) break; s += i; } return s; }";
    assert_eq!(value(src), 1 + 2 + 3 + 4 + 6 + 7 + 8);
    let src =
        "int main() { int n = 0; do { n++; } while (n < 5); while (n < 100) n *= 3; return n; }";
    assert_eq!(value(src), 135);
    let src = "int f(int x) { switch (x) { case 1: return 10; case 2: case 3: x += 100; default: x += 1000; } return x; }
               int main() { return f(1) + f(2) + f(9); }";
    assert_eq!(value(src), 10 + 1102 + 1009);
    let src = "int main() { int i = 0; again: i++; if (i < 7) goto again; return i; }";
    assert_eq!(value(src), 7);
    let src = "int main() { int a = 0, b = 5; if (a && b / a) return 1; if (a || b) return 2; return 3; }";
    assert_eq!(value(src), 2);
    assert_eq!(
        value("int main() { int a = 3; return a > 2 ? a < 5 ? 10 : 20 : 30; }"),
        10
    );
}

#[test]
fn functions_recursion_and_many_arguments() {
    let src = "int fib(int n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); } int main() { return fib(15); }";
    let r = run(src);
    assert_eq!(r.result, 610);
    // About 2,000 calls: the compiled code should stay well under 100 steps a call.
    assert!(r.steps < 150_000, "{} steps", r.steps);
    let src = "int f(int a, int b, int c, int d, int e, int g, int h) { return a - b + c * d - e + g * h; }
               int main() { return f(1, 2, 3, 4, 5, 6, f(1, 1, 1, 1, 1, 1, 1)); }";
    let f = |a: i16, b: i16, c: i16, d: i16, e: i16, g: i16, h: i16| a - b + c * d - e + g * h;
    assert_eq!(value(src), f(1, 2, 3, 4, 5, 6, f(1, 1, 1, 1, 1, 1, 1)));
    let src = "int twice(int (*f)(int), int x) { return f(f(x)); } int inc(int x) { return x + 1; }
               int sq(int x) { return x * x; } int (*pick(int i))(int) { return i ? sq : inc; }
               int main() { return twice(inc, 5) * 100 + twice(pick(1), 3); }";
    assert_eq!(value(src), 7 * 100 + 81);
}

#[test]
fn pointers_arrays_and_strings() {
    let src = "int a[10]; int main() { for (int i = 0; i < 10; i++) a[i] = i * i; int *p = a + 3; p++; return *p + p[2] + (p - a); }";
    assert_eq!(value(src), 16 + 36 + 4);
    let src = "int len(const char *s) { int n = 0; while (*s++) n++; return n; } int main() { return len(\"hello, world\"); }";
    assert_eq!(value(src), 12);
    let src = "int main() { char s[] = \"abc\"; int b[5] = {1, 2}; return sizeof(s) * 100 + b[0] + b[1] + b[4] + sizeof b; }";
    assert_eq!(value(src), 400 + 3 + 5);
    let src = "int m[3][4]; int main() { for (int i = 0; i < 3; i++) for (int j = 0; j < 4; j++) m[i][j] = i * 10 + j; return m[2][3] + m[1][0] + sizeof(m) + sizeof(m[0]); }";
    assert_eq!(value(src), 23 + 10 + 12 + 4);
    let src = "void swap(int *a, int *b) { int t = *a; *a = *b; *b = t; } int main() { int x = 1, y = 2; swap(&x, &y); return x * 10 + y; }";
    assert_eq!(value(src), 21);
}

#[test]
fn structs_unions_enums_and_typedefs() {
    let src = "typedef struct { int x, y; } Point; struct Rect { Point a, b; int tag; };
               enum Color { RED, GREEN = 5, BLUE };
               int area(struct Rect *r) { return (r->b.x - r->a.x) * (r->b.y - r->a.y); }
               int main() { struct Rect r = {{1, 2}, {4, 6}, BLUE}; struct Rect s; s = r; s.a.x = 0;
                 return area(&r) * 100 + area(&s) + r.tag * 1000 + sizeof(struct Rect); }";
    assert_eq!(value(src), 12 * 100 + 16 + 6000 + 5);
    let src = "union U { int a; unsigned b; int c[2]; }; int main() { union U u; u.a = -1; return (u.b == 65535) + sizeof(u) * 10; }";
    assert_eq!(value(src), 21);
    let src = "struct Node { int v; struct Node *next; }; struct Node n[4];
               int main() { for (int i = 0; i < 3; i++) { n[i].v = i + 1; n[i].next = &n[i + 1]; } n[3].v = 10;
                 int s = 0; for (struct Node *p = n; p; p = p->next) { s += p->v; if (p == &n[3]) break; } return s; }";
    assert_eq!(value(src), 16);
}

#[test]
fn globals_statics_and_initialisers() {
    let src = "int g = 5; int t[] = {1, 2, 3}; char *msg = \"hi\"; int *pt = &t[1];
               int counter(void) { static int n = 100; return n++; }
               int main() { counter(); counter(); return g + t[2] + msg[1] + *pt + counter(); }";
    assert_eq!(value(src), 5 + 3 + 105 + 2 + 102);
    let src = "int sq(int x) { return x * x; } int (*ops[])(int) = {sq, sq}; int main() { return ops[1](7); }";
    assert_eq!(value(src), 49);
}

#[test]
fn the_preprocessor() {
    let src = "#define N 4\n#define SQ(x) ((x) * (x))\n#define MAX(a, b) ((a) > (b) ? (a) : (b))\n\
               #if N > 3 && defined(N)\nint big = 1;\n#else\nint big = 0;\n#endif\n\
               #ifndef M\n#define M 7\n#endif\n\
               int main() { return SQ(N + 1) + MAX(M, 2) + big * 1000; }";
    assert_eq!(value(src), 25 + 7 + 1000);
    let src = "/* a comment\n over lines */ int main() { // and one\n return 'A' + '\\n'; }";
    assert_eq!(value(src), 75);
}

#[test]
fn deep_expressions_spill_registers() {
    // More nested values than registers.
    let src = "int f(int x) { return x + 1; }
               int main() { int a = 1, b = 2, c = 3, d = 4, e = 5;
                 return (a + (b * (c + (d - (e + (a * (b + (c - f(d + (e * (a + 1)))))))))) ); }";
    let (a, b, c, d, e) = (1i16, 2, 3, 4, 5);
    let want = a + b * (c + (d - (e + a * (b + (c - (d + e * (a + 1) + 1))))));
    assert_eq!(value(src), want);
    let src = "int t[8]; int main() { for (int i = 0; i < 8; i++) t[i] = i;
                 return t[t[t[t[t[t[1] + 1] + 1] + 1] + 1] + 1] * 100 + (t[1] + (t[2] * (t[3] + (t[4] * (t[5] + t[6] * t[7]))))); }";
    assert_eq!(value(src), 600 + (1 + 2 * (3 + 4 * (5 + 42))));
}

#[test]
fn far_jumps_and_calls_are_made_long() {
    // A loop body over 512 words, and a call over 2048 words away.
    let mut body = String::new();
    for i in 0..300 {
        body.push_str(&format!("s = s + {i} * x;\n"));
    }
    let src = format!(
        "int far(int);\nint main() {{ int s = 0; for (int x = 0; x < 3; x++) {{ {body} }} return far(s); }}\n\
         int pad(int x) {{ {body2} return x; }}\nint far(int v) {{ return v + 1; }}",
        body2 = "x = x * 3 + 1;\n".repeat(700)
    );
    let want: i32 = (0..300).map(|i| i * 3).sum::<i32>() + 1;
    let c = compile(&src);
    assert!(
        c.asm.iter().any(|l| l.contains("JR r7")),
        "a long jump was made"
    );
    assert_eq!(value(&src), want as i16);
}

#[test]
fn pixels_through_a_pointer() {
    let r = run("int main() { int *screen = (int *)0x4000; screen[0] = 0x8001; *(screen + 767) = 1; return 0; }");
    assert_eq!(r.mem.screen[0], 0x8001);
    assert_eq!(r.mem.screen[767], 1);
    assert!(r.mem.pixel(0, 0) && r.mem.pixel(15, 0) && r.mem.pixel(127, 95));
}

#[test]
fn keyboard_and_timer() {
    let src = "int main() { volatile int *key = (int *)0x6000; while (*key == 0) {} return *key; }";
    let r = run_with(src, 100_000, &|s| if s > 500 { 65 } else { 0 });
    assert_eq!(r.result, 65);
}

#[test]
fn mistakes_are_reported_with_codes() {
    assert_eq!(errors("int main() { return x; }"), ["unknown-name"]);
    assert_eq!(errors("int main() { float f; return 0; }"), ["unsupported"]);
    assert_eq!(errors("int main() { long x; return 0; }"), ["unsupported"]);
    assert_eq!(
        errors("int f(int a); int main() { return f(1, 2); }"),
        ["arg-count"]
    );
    assert_eq!(errors("int main() { 3 = 4; return 0; }"), ["not-lvalue"]);
    assert_eq!(errors("int main() { break; }"), ["break-outside"]);
    assert_eq!(errors("int f() { return 1; }"), ["no-main"]);
    assert_eq!(
        errors("#include <stdio.h>\nint main() { return 0; }"),
        ["bad-include"]
    );
    assert_eq!(errors("int main() { return 1 }"), ["expected"]);
    assert_eq!(
        errors("struct P { int x; }; int main() { struct P p; return p.y; }"),
        ["unknown-member"]
    );
    let e = s2t_c::build("int main() {\n  int a;\n  return b;\n}");
    assert_eq!(e.errors[0].line, 3);
}

#[test]
fn unused_functions_are_left_out() {
    let c = compile("int unused(int x) { return x * 7; } int main() { return 1; }");
    assert!(!c.asm.iter().any(|l| l.starts_with("unused:")));
}

/// Random expressions: run on the CPU vs C's rules worked out here (16-bit
/// ints, division rounding toward zero, ÷0 = 0, %0 = the dividend).
#[test]
fn random_expressions_match_c() {
    let mut seed = 0x2545u32;
    let mut rnd = |n: u32| {
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        seed % n
    };
    let vars = [7i16, -3, 300, -12000];
    for _ in 0..150 {
        let mut src = String::from("int main() { int a = 7, b = -3, c = 300, d = -12000; return ");
        let (text, want) = gen(&mut rnd, &vars, 4);
        src.push_str(&text);
        src.push_str("; }");
        assert_eq!(value(&src), want, "{text}");
    }
}

fn gen(rnd: &mut dyn FnMut(u32) -> u32, vars: &[i16; 4], depth: u32) -> (String, i16) {
    if depth == 0 || rnd(4) == 0 {
        return if rnd(2) == 0 {
            let i = rnd(4) as usize;
            (["a", "b", "c", "d"][i].to_string(), vars[i])
        } else {
            let v = rnd(600) as i16 - 300;
            (format!("({v})"), v)
        };
    }
    let (l, a) = gen(rnd, vars, depth - 1);
    let (r, b) = gen(rnd, vars, depth - 1);
    let ops = [
        "+", "-", "*", "/", "%", "&", "|", "^", "<", "<=", ">", ">=", "==", "!=", "&&", "||", "<<",
        ">>", "?",
    ];
    let op = ops[rnd(ops.len() as u32) as usize];
    let v = match op {
        "+" => a.wrapping_add(b),
        "-" => a.wrapping_sub(b),
        "*" => a.wrapping_mul(b),
        "/" => {
            if b == 0 {
                0
            } else {
                a.wrapping_div(b)
            }
        }
        "%" => {
            if b == 0 {
                a
            } else {
                a.wrapping_rem(b)
            }
        }
        "&" => a & b,
        "|" => a | b,
        "^" => a ^ b,
        "<" => (a < b) as i16,
        "<=" => (a <= b) as i16,
        ">" => (a > b) as i16,
        ">=" => (a >= b) as i16,
        "==" => (a == b) as i16,
        "!=" => (a != b) as i16,
        "&&" => (a != 0 && b != 0) as i16,
        "||" => (a != 0 || b != 0) as i16,
        "<<" => a.wrapping_shl((b & 15) as u32),
        ">>" => a >> (b & 15),
        _ => {
            let (c, cv) = gen(rnd, vars, depth - 1);
            return (format!("({c} ? {l} : {r})"), if cv != 0 { a } else { b });
        }
    };
    let text = match op {
        "<<" | ">>" => format!("({l} {op} ({r} & 15))"),
        _ => format!("({l} {op} {r})"),
    };
    (text, v)
}
