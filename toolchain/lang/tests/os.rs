// The OS (os/os.shard, docs/OS.md), compiled with s2t-lang and run on the
// VM interpreter with a scripted clock and keyboard. Pictures are checked
// pixel by pixel against plain Rust versions of the same rules.
use s2t_vm::{run_scripted, Outcome, Script};

const OS: &str = include_str!("../../../os/os.shard");

fn run_with(program: &str, script: &Script) -> Outcome {
    let src = format!("{OS}\n{program}");
    let c = s2t_lang::compile(&src);
    assert!(c.errors.is_empty(), "{program}\n{:?}", c.errors);
    let o = run_scripted(&c.vm.join("\n"), 20_000_000, script).unwrap_or_else(|e| panic!("{e:?}"));
    assert!(o.halted, "didn't finish:\n{program}");
    o
}

fn run(program: &str) -> Outcome {
    run_with(program, &Script::default())
}

fn pixel(o: &Outcome, x: usize, y: usize) -> bool {
    o.memory.pixel(x, y)
}

/// Every lit pixel, as (x, y).
fn lit(o: &Outcome) -> Vec<(usize, usize)> {
    let mut out = Vec::new();
    for y in 0..96 {
        for x in 0..128 {
            if pixel(o, x, y) {
                out.push((x, y));
            }
        }
    }
    out
}

#[test]
fn plot_sets_and_clears_one_pixel_and_ignores_the_outside() {
    let o = run("fn main() { plot(0, 0, true); plot(127, 95, true); plot(17, 3, true); plot(17, 3, false); plot(5, 5, true); plot(-1, 0, true); plot(128, 0, true); plot(0, 96, true); }");
    assert_eq!(lit(&o), vec![(0, 0), (5, 5), (127, 95)]);
}

struct Rng(u64);
impl Rng {
    fn below(&mut self, n: i32) -> i32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        ((self.0 >> 16) % n as u64) as i32
    }
}

#[test]
fn fill_rect_matches_pixel_by_pixel_on_random_rectangles() {
    let mut r = Rng(42);
    let mut calls = String::new();
    let mut want = vec![vec![false; 128]; 96];
    for _ in 0..40 {
        let (x, y) = (r.below(150) - 10, r.below(110) - 10);
        let (w, h) = (r.below(40), r.below(30));
        let on = r.below(3) != 0;
        calls += &format!("fill_rect({x}, {y}, {w}, {h}, {on});\n");
        for yy in y.max(0)..(y + h).min(96) {
            for xx in x.max(0)..(x + w).min(128) {
                want[yy as usize][xx as usize] = on;
            }
        }
    }
    let o = run(&format!("fn main() {{\n{calls}}}"));
    for (y, row) in want.iter().enumerate() {
        for (x, on) in row.iter().enumerate() {
            assert_eq!(pixel(&o, x, y), *on, "({x}, {y})\n{calls}");
        }
    }
}

#[test]
fn draw_rect_is_an_outline_and_clear_empties_the_screen() {
    let o = run("fn main() { draw_rect(10, 20, 5, 4); }");
    let mut want = Vec::new();
    for y in 20..24 {
        for x in 10..15 {
            if y == 20 || y == 23 || x == 10 || x == 14 {
                want.push((x, y));
            }
        }
    }
    assert_eq!(lit(&o), want);
    let o = run("fn main() { fill_rect(0, 0, 128, 96, true); clear(); }");
    assert!(lit(&o).is_empty());
}

/// The font's glyph for c as 5 rows of 3 pixels, from the source table.
fn glyph(c: char) -> Vec<Vec<bool>> {
    let table = OS
        .split("const OS_FONT: [int; 64] = [")
        .nth(1)
        .and_then(|s| s.split("];").next())
        .unwrap_or_default();
    let words: Vec<u16> = table
        .lines()
        .flat_map(|l| l.split("//").next().unwrap_or_default().split(','))
        .filter_map(|w| u16::from_str_radix(w.trim().trim_start_matches("0x"), 16).ok())
        .collect();
    assert_eq!(words.len(), 64);
    let w = words[c as usize - 32];
    (0..5)
        .map(|r| (0..3).map(|k| (w >> (14 - r * 3 - k)) & 1 == 1).collect())
        .collect()
}

/// What draw_char draws: the glyph in its cell, the cell's spacing off
/// (the loops go one past the glyph, so they index).
#[allow(clippy::needless_range_loop)]
fn assert_char(o: &Outcome, c: char, col: usize, row: usize) {
    let g = glyph(c);
    for r in 0..6 {
        for k in 0..4 {
            let want = r < 5 && k < 3 && g[r][k];
            assert_eq!(
                pixel(o, col * 4 + k, row * 6 + r),
                want,
                "{c:?} at ({col}, {row}), pixel ({k}, {r})"
            );
        }
    }
}

#[test]
fn the_font_has_a_glyph_for_every_character_it_claims() {
    assert!(glyph('A').concat().iter().any(|b| *b));
    assert!(glyph(' ').concat().iter().all(|b| !*b));
    // Digits and letters all differ.
    let shapes: std::collections::BTreeSet<Vec<Vec<bool>>> =
        ('0'..='9').chain('A'..='Z').map(glyph).collect();
    assert_eq!(shapes.len(), 36);
}

#[test]
fn draw_char_and_draw_text_use_cells_of_4_by_6() {
    let o = run("fn main() { fill_rect(0, 0, 128, 12, true); draw_text(\"HI?\", 3, 1, 0); draw_char('z', 31, 15); draw_char(200, 0, 1); }");
    assert_char(&o, 'H', 1, 0);
    assert_char(&o, 'I', 2, 0);
    assert_char(&o, '?', 3, 0);
    assert_char(&o, 'Z', 31, 15);
    assert_char(&o, '?', 0, 1);
    assert!(pixel(&o, 0, 0), "cell 0 untouched");
}

#[test]
fn draw_int_writes_decimal_and_returns_its_width() {
    for (v, text) in [
        (0, "0"),
        (7, "7"),
        (1234, "1234"),
        (-56, "-56"),
        (32767, "32767"),
        (-32768, "-32768"),
    ] {
        let o = run(&format!(
            "fn main() -> int {{ return draw_int({v}, 2, 3); }}"
        ));
        assert_eq!(o.result as usize, text.len(), "{v}");
        for (i, c) in text.chars().enumerate() {
            assert_char(&o, c, 2 + i, 3);
        }
    }
}

#[test]
fn time_and_keys() {
    let script = Script {
        steps_per_frame: 500,
        keys: vec![(30, 130), (33, 0)],
    };
    // wait(20) then wait_key: the key comes at frame 30 and goes at 33.
    let o = run_with(
        "fn main() -> int { wait(20); var t = ticks(); var k = wait_key(); return k * 100 + (ticks() - t); }",
        &script,
    );
    let k = o.result / 100;
    let waited = o.result % 100;
    assert_eq!(k, 130);
    assert!((12..=14).contains(&waited), "waited {waited} frames");
    let o = run_with(
        "fn main() -> int { return key(); }",
        &Script {
            steps_per_frame: 0,
            keys: vec![(0, 65)],
        },
    );
    assert_eq!(o.result, 65);
}

/// The xorshift generator as docs/OS.md defines it.
fn xorshift(s: u16) -> u16 {
    let s = s ^ (s << 7);
    let s = s ^ (s >> 9);
    s ^ (s << 8)
}

#[test]
fn xorshift_visits_every_nonzero_value() {
    let mut s = 1u16;
    for i in 1..=65535u32 {
        s = xorshift(s);
        assert!(s != 0);
        if s == 1 {
            assert_eq!(i, 65535, "period");
            return;
        }
    }
    panic!("no cycle back to 1");
}

#[test]
fn random_numbers_follow_the_generator() {
    let o = run("var out: [int; 4];\nfn main() -> int { seed_random(1234); for i in 0..4 { out[i] = random(); } return random_below(10); }");
    let mut s = 1234u16;
    let want: Vec<u16> = (0..4)
        .map(|_| {
            s = xorshift(s);
            s & 0x7fff
        })
        .collect();
    // out is the first global after the OS's own: find it by the program's
    // only array of 4.
    let ram = &o.memory.ram[..200];
    assert!(
        ram.windows(4).any(|w| w == want.as_slice()),
        "{want:?} in {ram:?}"
    );
    assert_eq!(o.result, (xorshift(s) & 0x7fff) % 10);
    let o = run("fn main() -> int { seed_random(0); var lo = 99; var hi = -1; for i in 0..500 { var v = random_below(7); lo = min(lo, v); hi = max(hi, v); } return lo * 10 + hi; }");
    assert_eq!(o.result, 6, "0..6, all reached");
}

#[test]
fn helpers() {
    let o = run("fn main() -> int { return abs(-5) * 100 + min(3, -2) * 10 + max(4, 9); }");
    assert_eq!(o.result as i16, 500 - 20 + 9);
}
