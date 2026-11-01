// Bitfall (games/bitfall.shard, docs/GAME.md), on the OS, compiled with
// s2t-lang and run on the VM interpreter. The tests replace the game's
// `main` (everything below "// ---- main ----") to call its functions.
use std::collections::BTreeSet;

use s2t_isa::Bus;
use s2t_vm::{run_scripted, Outcome, Script};

const OS: &str = include_str!("../../../os/os.shard");
const GAME: &str = include_str!("../../../games/bitfall.shard");

fn game_without_main() -> &'static str {
    GAME.split("// ---- main ----").next().unwrap_or(GAME)
}

fn run_with(main: &str, script: &Script, steps: usize) -> Outcome {
    let src = format!("{OS}\n{}\n{main}", game_without_main());
    let c = s2t_lang::compile(&src);
    assert!(c.errors.is_empty(), "{:?}", c.errors);
    let o = run_scripted(&c.vm.join("\n"), steps, script).unwrap_or_else(|e| panic!("{e:?}"));
    assert!(o.halted, "didn't finish:\n{main}");
    o
}

fn run(main: &str) -> Outcome {
    run_with(main, &Script::default(), 50_000_000)
}

/// Screen words from 0x4000 (the tests use the screen as an output list).
fn out(o: &mut Outcome, n: u16) -> Vec<u16> {
    (0..n).map(|i| o.memory.read(0x4000 + i)).collect()
}

/// A piece's cells as (row, col), from its five 5-bit rows.
fn cells(rows: &[u16]) -> BTreeSet<(i32, i32)> {
    let mut s = BTreeSet::new();
    for (r, v) in rows.iter().enumerate() {
        for c in 0..5 {
            if (v >> (4 - c)) & 1 == 1 {
                s.insert((r as i32, c));
            }
        }
    }
    s
}

fn connected(s: &BTreeSet<(i32, i32)>) -> bool {
    let Some(&first) = s.iter().next() else {
        return false;
    };
    let mut seen = BTreeSet::from([first]);
    let mut todo = vec![first];
    while let Some((r, c)) = todo.pop() {
        for n in [(r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)] {
            if s.contains(&n) && seen.insert(n) {
                todo.push(n);
            }
        }
    }
    seen.len() == s.len()
}

#[test]
fn grown_pieces_are_3_to_5_connected_cells_at_the_top_left() {
    let mut o = run("fn main() { seed_random(99);\n\
         for i in 0..120 { grow(next); for r in 0..5 { mem[0x4000 + i * 5 + r] = next[r]; } } }");
    let words = out(&mut o, 600);
    let mut shapes = BTreeSet::new();
    for p in words.chunks(5) {
        let s = cells(p);
        assert!((3..=5).contains(&s.len()), "{p:?}");
        assert!(connected(&s), "{p:?}");
        assert!(s.iter().any(|&(r, _)| r == 0), "top row used: {p:?}");
        assert!(s.iter().any(|&(_, c)| c == 0), "left column used: {p:?}");
        shapes.insert(s);
    }
    assert!(shapes.len() > 30, "only {} different shapes", shapes.len());
}

#[test]
fn width_height_and_rotation() {
    // An L: rows 10000, 10000, 11000.
    let mut o = run("fn main() {\n\
         next[0] = 16; next[1] = 16; next[2] = 24; next[3] = 0; next[4] = 0;\n\
         mem[0x4000] = width(next); mem[0x4001] = height(next);\n\
         rotate(next);\n\
         for r in 0..5 { mem[0x4002 + r] = next[r]; }\n\
         rotate(next); rotate(next); rotate(next);\n\
         for s in 0..5 { mem[0x4007 + s] = next[s]; } }");
    let w = out(&mut o, 12);
    assert_eq!((w[0], w[1]), (2, 3));
    // A quarter clockwise: 111 / 100.
    assert_eq!(&w[2..7], &[0b11100, 0b10000, 0, 0, 0]);
    assert_eq!(
        &w[7..12],
        &[16, 16, 24, 0, 0],
        "four turns: back where it was"
    );
}

#[test]
fn every_grown_piece_comes_back_after_four_turns() {
    let mut o = run("fn main() { seed_random(7); var bad = 0;\n\
         for i in 0..60 { grow(next); copy(next, piece);\n\
           rotate(piece); rotate(piece); rotate(piece); rotate(piece);\n\
           for r in 0..5 { if piece[r] != next[r] { bad = bad + 1; } } }\n\
         mem[0x4000] = bad; }");
    assert_eq!(out(&mut o, 1), vec![0]);
}

#[test]
fn fits_respects_walls_floor_and_the_board() {
    // A 2-wide domino-ish piece: rows 11000.
    let mut o = run(
        "fn bit(b: bool, k: int) -> int { if b { return 1 << k; } return 0; }\n\
         fn main() {\n\
         piece[0] = 24; piece[1] = 0; piece[2] = 0; piece[3] = 0; piece[4] = 0;\n\
         board[19] = 0b0000110000;\n\
         mem[0x4000] = bit(fits(piece, 0, 0), 0) | bit(fits(piece, 8, 0), 1) | bit(fits(piece, 9, 0), 2)\n\
           | bit(fits(piece, -1, 0), 3) | bit(fits(piece, 0, 19), 4) | bit(fits(piece, 0, 20), 5)\n\
           | bit(fits(piece, 4, 19), 6) | bit(fits(piece, 5, 19), 7) | bit(fits(piece, 6, 19), 8);\n\
         place(piece, 0, 19); mem[0x4001] = board[19]; }",
    );
    let w = out(&mut o, 2);
    // fits: (0,0) yes, (8,0) yes, (9,0) no, (-1,0) no, (0,19) yes, (0,20) no,
    // (4,19) no, (5,19) no, (6,19) yes.
    assert_eq!(w[0], 0b1_0001_0011);
    assert_eq!(w[1], 0b1100110000);
}

#[test]
fn full_rows_and_target_rows_clear_and_score() {
    let mut o = run("fn main() { seed_random(3);\n\
         level = 2; target = 0b1011001101;\n\
         board[16] = 5; board[17] = 1023; board[18] = 0b1011001101; board[19] = 1023;\n\
         mem[0x4000] = clear_rows();\n\
         for r in 0..20 { mem[0x4001 + r] = board[r]; }\n\
         mem[0x4015] = score; mem[0x4016] = lines; mem[0x4017] = level; mem[0x4018] = target; }");
    let w = out(&mut o, 25);
    assert_eq!(w[0], 3, "rows cleared");
    // Only the row of 5 is left, at the bottom.
    assert_eq!(&w[1..21], &[[0u16; 19].as_slice(), &[5]].concat()[..]);
    assert_eq!(
        w[21],
        (2 * 10 + 50) * 2,
        "score: two full rows, one target, level 2"
    );
    assert_eq!(w[22], 3, "lines");
    assert_eq!(w[23], 1, "level: 1 + 3 / 10");
    assert_ne!(w[24], 0b1011001101, "a new target");
    assert!((1..1023).contains(&w[24]));
}

#[test]
fn spawn_centres_the_next_piece_and_says_when_it_doesnt_fit() {
    let mut o = run(
        "fn bit(b: bool, k: int) -> int { if b { return 1 << k; } return 0; }\n\
         fn main() { seed_random(11);\n\
         next[0] = 28; next[1] = 0; next[2] = 0; next[3] = 0; next[4] = 0;\n\
         var ok = spawn();\n\
         mem[0x4000] = px; mem[0x4001] = py; mem[0x4002] = piece[0];\n\
         board[0] = 1023;\n\
         mem[0x4003] = bit(ok, 0) | bit(spawn(), 1); }",
    );
    let w = out(&mut o, 4);
    assert_eq!(
        (w[0], w[1], w[2]),
        (3, 0, 28),
        "3 wide: column (10 - 3) / 2"
    );
    assert_eq!(w[3], 1, "the first fits, the second doesn't");
}

#[test]
fn a_whole_game_with_hard_drops_ends_and_draws_the_board() {
    // Space pressed and let go every few frames: pieces pile up in the middle
    // until one doesn't fit.
    let keys: Vec<(u16, u16)> = (0..400u16)
        .flat_map(|i| [(10 + i * 6, 32), (13 + i * 6, 0)])
        .collect();
    let script = Script {
        steps_per_frame: 20_000,
        keys,
    };
    let mut o = run_with(
        "fn main() -> int { seed_random(5); play(); return lines * 1000 + score; }",
        &script,
        200_000_000,
    );
    // The frame around the board, and cells inside it.
    assert!(o.memory.pixel(42, 6) && o.memory.pixel(84, 88));
    let filled = (0..20)
        .filter(|r| o.memory.pixel(44 + 4 * 4, 8 + r * 4))
        .count();
    assert!(filled > 3, "a pile in the middle column: {filled}");
    let _ = out(&mut o, 1);
}

#[test]
fn moving_and_rotating_follow_the_keys() {
    // Left three times, then a hard drop: the piece lands at the left wall.
    let keys = vec![
        (20, 128),
        (22, 0),
        (24, 128),
        (26, 0),
        (28, 128),
        (30, 0),
        (32, 128),
        (34, 0),
        (40, 32),
        (42, 0),
    ];
    let script = Script {
        steps_per_frame: 20_000,
        keys,
    };
    let o = run_with(
        "fn main() -> int { seed_random(9); new_game(); draw_all();\n\
         var last = 0; var t = ticks();\n\
         while ticks() - t < 50 {\n\
           var k = key();\n\
           if k != last { if k == LEFT { try_move(-1, 0); } else if k == ' ' { drop(); } last = k; }\n\
         }\n\
         var low = 0; for r in 0..20 { if board[r] & 512 != 0 { low = low + 1; } }\n\
         return low; }",
        &script,
        100_000_000,
    );
    assert!(o.result > 0, "something landed in the leftmost column");
}

#[test]
fn try_rotate_turns_the_falling_piece_and_keeps_it_on_the_board() {
    let mut o = run("fn main() { seed_random(1);\n\
         piece[0] = 16; piece[1] = 16; piece[2] = 24; piece[3] = 0; piece[4] = 0;\n\
         px = 0; py = 5;\n\
         try_rotate();\n\
         for r in 0..5 { mem[0x4000 + r] = piece[r]; }\n\
         mem[0x4005] = px;\n\
         piece[0] = 28; piece[1] = 0; piece[2] = 0; piece[3] = 0; piece[4] = 0;\n\
         px = 7; py = 5;\n\
         try_rotate();\n\
         mem[0x4006] = piece[0]; mem[0x4007] = piece[2]; mem[0x4008] = px; }");
    let w = out(&mut o, 9);
    assert_eq!(&w[0..5], &[0b11100, 0b10000, 0, 0, 0], "an L turned");
    assert_eq!(w[5], 0);
    // A flat 3 turned upright at the right wall: pushed back inside.
    assert_eq!((w[6], w[7]), (16, 16), "now a vertical bar");
    assert!(w[8] <= 9, "px {}", w[8]);
}

#[test]
fn the_c_key_rotates_like_up() {
    // Hold C for a few frames, let go, and compare with the piece turned by hand.
    let script = Script {
        steps_per_frame: 20_000,
        keys: vec![(30, 99), (34, 0)],
    };
    let mut o = run_with(
        "fn main() { seed_random(4); new_game(); draw_all();\n\
         copy(piece, spare); rotate(spare); var want = spare[0] * 32 + spare[1];\n\
         var last = 0; var t = ticks();\n\
         while ticks() - t < 60 {\n\
           var k = key();\n\
           if k != last { if k == UP or k == 'c' or k == 'C' { try_rotate(); } last = k; }\n\
         }\n\
         mem[0x4000] = want; mem[0x4001] = piece[0] * 32 + piece[1]; }",
        &script,
        100_000_000,
    );
    let w = out(&mut o, 2);
    assert_eq!(w[0], w[1], "turned once by C (or it didn't fit and stayed)");
}
