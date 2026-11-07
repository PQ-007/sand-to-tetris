// machine.h (docs/C.md), compiled with programs and run on the reference
// CPU.
use s2t_isa::{Cpu, Memory};

fn run(src: &str) -> (i16, Memory) {
    let src = format!("#include <machine.h>\n{src}");
    let c = s2t_c::build(&src);
    assert!(c.errors.is_empty(), "{:?}", c.errors);
    let mut mem = Memory::default();
    mem.ram[..c.data.len()].copy_from_slice(&c.data);
    let mut cpu = Cpu::default();
    for _ in 0..50_000_000 {
        let pc = cpu.pc;
        cpu.step(&c.code, &mut mem);
        if cpu.pc == pc {
            return (cpu.regs[0] as i16, mem);
        }
    }
    panic!("didn't halt");
}

fn lit(mem: &Memory) -> Vec<(usize, usize)> {
    let mut v = Vec::new();
    for y in 0..96 {
        for x in 0..128 {
            if mem.pixel(x, y) {
                v.push((x, y));
            }
        }
    }
    v
}

#[test]
fn every_library_function_compiles() {
    // Calling everything keeps it all in the program.
    let (_, _) = run("int main(void) {
        int r[2] = {0xF000, 0x8000};
        abs(-1); min(1, 2); max(1, 2); clamp(5, 0, 3); sin256(10); cos256(10); isqrt(99);
        memset(r, 0, 2); memcpy(r, r, 2); srand(3); rand(); rand_below(5);
        seed_random(1); random(); random_below(3); key(); ticks(); next_frame;
        use_buffer(); clear(); plot(1, 1, 1); xor_plot(2, 2); pixel(1, 1);
        fill_rect(0, 0, 3, 3, 1); draw_rect(0, 0, 9, 9); draw_line(0, 0, 9, 4, 1);
        draw_sprite(3, 3, r, 2); xor_sprite(3, 3, r, 2); clear_sprite(3, 3, r, 2);
        draw_char('A', 0, 0); draw_text(\"HI\", 1, 1); draw_int(-123, 2, 2);
        draw_char_at('B', 5, 5); draw_text_at(\"OK\", 9, 9); draw_int_at(42, 1, 1);
        show(); use_screen(); return 0; }");
}

#[test]
fn rectangles_lines_and_pixels() {
    let (_, mem) = run("int main() { fill_rect(-3, 2, 10, 2, 1); return 0; }");
    let want: Vec<(usize, usize)> = (2..4).flat_map(|y| (0..7).map(move |x| (x, y))).collect();
    assert_eq!(lit(&mem), want);
    let (_, mem) =
        run("int main() { fill_rect(10, 0, 40, 1, 1); fill_rect(20, 0, 5, 1, 0); return 0; }");
    let want: Vec<(usize, usize)> = (10..50)
        .filter(|x| !(20..25).contains(x))
        .map(|x| (x, 0))
        .collect();
    assert_eq!(lit(&mem), want);
    let (_, mem) =
        run("int main() { draw_line(0, 0, 6, 3, 1); return pixel(6, 3) + pixel(7, 3); }");
    assert_eq!(lit(&mem), bresenham(0, 0, 6, 3));
    let (_, mem) = run("int main() { draw_line(30, 40, 2, 90, 1); return 0; }");
    let mut want = bresenham(30, 40, 2, 90);
    want.sort_by_key(|&(x, y)| (y, x));
    assert_eq!(lit(&mem), want);
    let (v, mem) = run("int main() { plot(127, 95, 1); xor_plot(0, 0); xor_plot(5, 5); xor_plot(5, 5); plot(200, 3, 1); return pixel(127, 95) * 10 + pixel(-1, 0); }");
    assert_eq!(v, 10);
    assert_eq!(lit(&mem), [(0, 0), (127, 95)]);
}

#[test]
fn sprites_straddle_words_and_clip() {
    let (_, mem) = run("const int s[2] = {0xC003, 0x8001}; int main() { draw_sprite(12, 0, s, 2); draw_sprite(120, 10, s, 2); draw_sprite(-14, 20, s, 1); return 0; }");
    assert_eq!(
        lit(&mem),
        [
            (12, 0),
            (13, 0),
            (26, 0),
            (27, 0),
            (12, 1),
            (27, 1),
            (120, 10),
            (121, 10),
            (120, 11),
            (0, 20),
            (1, 20)
        ]
    );
}

#[test]
fn text_matches_the_c_shard_os_font() {
    // 'A' = 0x2BED: rows 010, 111, 101, 101, 101 (wait: bits 14..0).
    let (n, mem) = run("int main() { draw_char('A', 1, 1); return draw_int(-305, 0, 3); }");
    assert_eq!(n, 4);
    let g: u16 = 0x2BED;
    for r in 0..5 {
        for k in 0..3 {
            let on = (g >> (14 - r * 3 - k)) & 1 == 1;
            assert_eq!(mem.pixel(4 + k, 6 + r), on, "row {r} col {k}");
        }
        assert!(!mem.pixel(7, 6 + r));
    }
    // '-' then '3' starting at cell (0, 3).
    assert!(mem.pixel(1, 20), "the minus sign");
    let (_, a) = run("int main() { draw_char_at('7', 2, 3); return 0; }");
    let (_, b) = run("int main() { draw_char('7', 0, 0); return 0; }");
    let shifted: Vec<(usize, usize)> = lit(&b).into_iter().map(|(x, y)| (x + 2, y + 3)).collect();
    assert_eq!(lit(&a), shifted);
}

#[test]
fn random_numbers_are_the_os_xorshift() {
    let (v, _) = run("int main() { srand(1); rand(); rand(); return rand(); }");
    let mut s: u16 = 1;
    let mut last = 0;
    for _ in 0..3 {
        s ^= s << 7;
        s ^= s >> 9;
        s ^= s << 8;
        last = s & 0x7FFF;
    }
    assert_eq!(v as u16, last);
}

#[test]
fn math_helpers() {
    let (v, _) = run(
        "int main() { return isqrt(0) + isqrt(1) * 10 + isqrt(99) * 100 + isqrt(65535) - 255; }",
    );
    assert_eq!(v, 10 + 900);
    for a in [0, 10, 64, 100, 128, 200, 255, 256, -64] {
        let (v, _) = run(&format!("int main() {{ return sin256({a}); }}"));
        let want = (256.0 * (a as f64 * std::f64::consts::TAU / 256.0).sin()).round() as i16;
        assert!((v - want).abs() <= 1, "sin256({a}) = {v}, want {want}");
    }
}

#[test]
fn the_buffer_shows_all_at_once() {
    let (_, mem) = run("int main() { use_buffer(); clear(); fill_rect(0, 0, 128, 96, 1); int on = SCREEN[0]; show(); return on; }");
    assert_eq!(mem.screen[0], 0xFFFF);
    assert_eq!(mem.screen[767], 0xFFFF);
    let (v, _) = run("int main() { use_buffer(); fill_rect(0, 0, 4, 4, 1); return SCREEN[0]; }");
    assert_eq!(v, 0, "nothing on the screen before show()");
}

fn bresenham(mut x0: i32, mut y0: i32, x1: i32, y1: i32) -> Vec<(usize, usize)> {
    let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
    let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
    let mut e = dx + dy;
    let mut v = Vec::new();
    loop {
        v.push((x0 as usize, y0 as usize));
        if x0 == x1 && y0 == y1 {
            return v;
        }
        let e2 = 2 * e;
        if e2 >= dy {
            e += dy;
            x0 += sx;
        }
        if e2 <= dx {
            e += dx;
            y0 += sy;
        }
    }
}
