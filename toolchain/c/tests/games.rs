// The C games in games/ (docs/programs/), compiled with s2t-c and run on
// the reference CPU. Rule tests replace a game's `main` (everything below
// "// ---- main ----") with a test that calls its functions and returns a
// number; the budget test plays each whole game with scripted keys.
use s2t_isa::{Cpu, Memory};

const GAMES: [(&str, &str); 7] = [
    ("wyrm", include_str!("../../../games/wyrm.c")),
    ("rally", include_str!("../../../games/rally.c")),
    ("shatter", include_str!("../../../games/shatter.c")),
    ("swarm", include_str!("../../../games/swarm.c")),
    ("debris", include_str!("../../../games/debris.c")),
    ("prowl", include_str!("../../../games/prowl.c")),
    ("corridors", include_str!("../../../games/corridors.c")),
];

fn game(name: &str) -> &'static str {
    GAMES
        .iter()
        .find(|(n, _)| *n == name)
        .map(|(_, s)| *s)
        .unwrap_or("")
}

/// The game without its main, plus `main`, run until it returns.
fn rule(name: &str, main: &str) -> i16 {
    let body = game(name).split("// ---- main ----").next().unwrap_or("");
    let src = format!("{body}\n{main}");
    let c = s2t_c::build(&src);
    assert!(c.errors.is_empty(), "{name}: {:?}", c.errors);
    let mut mem = Memory::default();
    mem.ram[..c.data.len()].copy_from_slice(&c.data);
    let mut cpu = Cpu::default();
    for _ in 0..20_000_000 {
        let pc = cpu.pc;
        cpu.step(&c.code, &mut mem);
        if cpu.pc == pc {
            return cpu.regs[0] as i16;
        }
    }
    panic!("{name}: the test didn't finish");
}

#[test]
fn every_game_plays_within_a_frame_at_fast_speed() {
    // Title, a key to start, then arrows, space and nothing in turn.
    let script = [
        (5, 65u16),
        (8, 0),
        (20, 32),
        (22, 0),
        (40, 129),
        (80, 130),
        (120, 128),
        (160, 131),
        (200, 32),
        (202, 129),
    ];
    for (name, src) in GAMES {
        let c = s2t_c::build(src);
        assert!(c.errors.is_empty(), "{name}: {:?}", c.errors);
        // Which ROM words belong to next_frame (where a game waits).
        let mut in_wait = vec![false; c.code.len()];
        let mut current = "";
        let mut by_line = Vec::new();
        for text in &c.asm {
            if let Some((label, _)) = text.split_once(':') {
                if !label.starts_with(' ') && !label.starts_with("__") {
                    current = label;
                }
            }
            by_line.push(current == "next_frame");
        }
        for (i, &l) in c.code_map.iter().enumerate() {
            in_wait[i] = by_line.get(l - 1).copied().unwrap_or(false);
        }
        let waiting = |cpu: &Cpu| in_wait.get(cpu.pc as usize).copied().unwrap_or(false);
        let mut mem = Memory::default();
        mem.ram[..c.data.len()].copy_from_slice(&c.data);
        let mut cpu = Cpu::default();
        let mut frames = 0;
        for frame in 0..300u16 {
            mem.timer = frame;
            if let Some((_, k)) = script.iter().rfind(|(f, _)| *f <= frame) {
                mem.keyboard = *k;
            }
            let mut left = 200_000;
            while left > 0 && waiting(&cpu) {
                cpu.step(&c.code, &mut mem);
                left -= 1;
            }
            while left > 0 && !waiting(&cpu) {
                cpu.step(&c.code, &mut mem);
                left -= 1;
            }
            if waiting(&cpu) {
                frames += 1;
            }
        }
        // A frame that doesn't finish in 200,000 instructions slows the
        // game; a few (a new maze, a new wave) are fine.
        assert!(
            frames > 200,
            "{name}: only {frames} of 300 frames finished in time"
        );
    }
}

#[test]
fn wyrm_moves_grows_and_crashes() {
    // Starts 3 long heading right; food straight ahead grows it by 2.
    let v = rule(
        "wyrm",
        "int main() { reset(); food_x = xs[head] + 2; food_y = ys[head]; step(); step(); step(); step();
           return len * 100 + score * 10 + xs[head] - 6; }",
    );
    assert_eq!(v, 5 * 100 + 10 + 4);
    let v = rule(
        "wyrm",
        "int main() { reset(); next_dir = 3; int n = 0; while (step()) n++; return n; }",
    );
    assert_eq!(v, 11, "up from row 11 to the top edge");
    let v = rule(
        "wyrm",
        "int main() { reset(); next_dir = 2; step(); return xs[head]; }",
    );
    assert_eq!(v, 7, "it can't turn straight back on itself");
    // A loop of four turns bites its own body once it's long enough.
    let v = rule(
        "wyrm",
        "int main() { reset(); grow = 10; for (int i = 0; i < 6; i++) step();
           next_dir = 1; step(); next_dir = 2; step(); next_dir = 3; return step(); }",
    );
    assert_eq!(v, 0);
}

#[test]
fn rally_bounces_and_scores() {
    // The ball sent at your paddle comes back the other way.
    let v = rule(
        "rally",
        "int main() { reset(); you_y = 40; bx = 10 * FP; by = 45 * FP; vx = -24; vy = 0;
           for (int i = 0; i < 20; i++) update(0); return vx > 0; }",
    );
    assert_eq!(v, 1);
    let v = rule(
        "rally",
        "int main() { reset(); you_y = 9; bx = 10 * FP; by = 80 * FP; vx = -24; vy = 0;
           int p = 0; for (int i = 0; i < 40 && !p; i++) p = update(0); return p; }",
    );
    assert_eq!(v, -1, "a miss is the computer's point");
    // Edges of the paddle send the ball off steeply.
    let v = rule(
        "rally",
        "int main() { reset(); by = 40 * FP; bounce(40, 1); int top = vy; by = 52 * FP; bounce(40, 1); return top < 0 && vy > 0; }",
    );
    assert_eq!(v, 1);
}

#[test]
fn shatter_breaks_bricks() {
    let v = rule(
        "shatter",
        "int main() { reset(); int before = left; bx = 30 * FP; by = 50 * FP; vx = 0; vy = -16; stuck = 0;
           for (int i = 0; i < 60; i++) update(0); return before - left; }",
    );
    assert!(v >= 1, "a brick broke ({v})");
    let v = rule("shatter", "int main() { level = 2; build(); return left; }");
    assert_eq!(v, 2 + 4 + 6 + 8 + 10 + 10, "the pyramid wall");
    let v = rule(
        "shatter",
        "int main() { reset(); bricks[0][0] = 2; hit(0); int a = bricks[0][0]; hit(0); return a * 10 + bricks[0][0]; }",
    );
    assert_eq!(v, 10, "top bricks take two hits");
}

#[test]
fn swarm_shoots_marches_and_bunkers_wear() {
    let v = rule(
        "swarm",
        "int main() { reset(); next_step = 1000; sx = 27; update(0, 1);
           for (int i = 0; i < 20; i++) update(0, 0); return count; }",
    );
    // From x = 31 (between two bunkers), up into column 1.
    assert_eq!(v, 39, "one drone shot down");
    let v = rule(
        "swarm",
        "int main() { reset(); int d = step_dir; for (int i = 0; i < 12; i++) march(); return d != step_dir && oy > TOP + 6; }",
    );
    assert_eq!(v, 1, "it turns at the edge and steps down");
    let v = rule(
        "swarm",
        "int main() { reset(); int a = hits_bunker(bunker_x(1) + 8, BUNKER_Y + 2); int b = hits_bunker(bunker_x(1) + 8, BUNKER_Y + 2); return a * 10 + b; }",
    );
    assert_eq!(v, 10, "a hit knocks the pixel out");
}

#[test]
fn debris_splits_rocks() {
    let v = rule(
        "debris",
        "int main() { reset(); int n = rocks_left(); for (int i = 0; i < ROCKS; i++) if (rocks[i].size == 3) { smash(i); break; }
           int mediums = 0; for (int i = 0; i < ROCKS; i++) mediums += rocks[i].size == 2; return (rocks_left() - n) * 10 + mediums; }",
    );
    assert_eq!(v, 10 + 2, "a big rock becomes two medium ones");
    let v = rule(
        "debris",
        "int main() { return wrap(-5, W) == W - 5 && wrap(W + 3, W) == 3; }",
    );
    assert_eq!(v, 1);
}

#[test]
fn prowl_dots_and_seekers() {
    let v = rule("prowl", "int main() { reset(); return dots_left; }");
    assert_eq!(v, 137);
    let v = rule(
        "prowl",
        "int main() { reset(); for (int i = 0; i < 12; i++) update(0); return score; }",
    );
    assert_eq!(v, 20, "two dots eaten heading left");
    // The seekers come out of the box one by one and never walk into walls.
    let v = rule(
        "prowl",
        "int main() { reset(); for (int f = 0; f < 600; f++) { update(0); lives = 3;
             for (int i = 0; i < SEEKERS; i++) if (!swait[i] && wall(sx[i] / CELL, sy[i] / CELL)) return -1; }
           return (swait[0] == 0) + (swait[1] == 0) + (swait[2] == 0); }",
    );
    assert!(v >= 2, "{v}");
}

#[test]
fn corridors_mazes_always_have_a_way_out() {
    // From the start, a walk through open cells reaches a cell beside the
    // door, for many mazes.
    let v = rule(
        "corridors",
        "int seen[N][N]; int qx[256], qy[256];
         int main() { for (int t = 0; t < 30; t++) { srand(t * 77 + 1); carve();
           int doors = 0; for (int y = 0; y < N; y++) for (int x = 0; x < N; x++) doors += map[y][x] == 2;
           if (doors != 1) return -1;
           memset(seen, 0, N * N); int h = 0, e = 0; qx[e] = 1; qy[e++] = 1; seen[1][1] = 1; int found = 0;
           while (h < e) { int x = qx[h], y = qy[h++];
             for (int d = 0; d < 4; d++) { int nx = x + (d == 0) - (d == 2), ny = y + (d == 1) - (d == 3);
               if (map[ny][nx] == 2) found = 1;
               if (!map[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = 1; qx[e] = nx; qy[e++] = ny; } } }
           if (!found) return -2; } return 1; }",
    );
    assert_eq!(v, 1);
}
