//! Runs a C program for some frames and prints its screen as text:
//! `cargo run -p s2t-c --example play -- games/wyrm.c 120 30:130 60:0`
//! (frames, then frame:key pairs; each frame is at most 200,000
//! instructions, the Machine page's Fast speed). With PROFILE set, it also
//! prints where the instructions went, by function.
use std::collections::BTreeMap;

use s2t_isa::{Cpu, Memory};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(path) = args.first() else {
        eprintln!("usage: play <file.c> [frames] [frame:key ...]");
        return;
    };
    let src = std::fs::read_to_string(path).unwrap_or_default();
    let c = s2t_c::build(&src);
    if !c.errors.is_empty() {
        for e in &c.errors {
            eprintln!("{e}");
        }
        return;
    }
    let frames: usize = args.get(1).and_then(|f| f.parse().ok()).unwrap_or(60);
    let keys: Vec<(usize, u16)> = args[2.min(args.len())..]
        .iter()
        .filter_map(|a| {
            let (f, k) = a.split_once(':')?;
            Some((f.parse().ok()?, k.parse().ok()?))
        })
        .collect();
    let funcs = functions(&c);
    let waiting = |cpu: &Cpu| {
        funcs
            .get(cpu.pc as usize)
            .is_some_and(|f| f == "next_frame")
    };
    let profile = std::env::var("PROFILE").is_ok();
    let mut counts: BTreeMap<&str, u64> = BTreeMap::new();
    let mut mem = Memory::default();
    mem.ram[..c.data.len()].copy_from_slice(&c.data);
    let mut cpu = Cpu::default();
    let mut costs = Vec::new();
    for frame in 0..frames {
        mem.timer = frame as u16;
        if let Some((_, k)) = keys.iter().rfind(|(f, _)| *f <= frame) {
            mem.keyboard = *k;
        }
        // Out of last frame's wait, then until the next one.
        let mut left = 200_000;
        while left > 0 && waiting(&cpu) {
            cpu.step(&c.code, &mut mem);
            left -= 1;
        }
        let start = left;
        while left > 0 {
            if profile {
                let f = funcs.get(cpu.pc as usize).map_or("?", String::as_str);
                *counts.entry(f).or_default() += 1;
            }
            cpu.step(&c.code, &mut mem);
            left -= 1;
            if waiting(&cpu) {
                costs.push(start - left);
                break;
            }
        }
    }
    if std::env::var("COSTS").is_ok() {
        println!("{costs:?}");
    }
    costs.sort_unstable();
    let median = costs.get(costs.len() / 2).copied().unwrap_or(0);
    let busiest = costs.last().copied().unwrap_or(0);
    println!(
        "{} ROM words, {} data words; a frame takes ~{median} instructions (busiest {busiest})",
        c.code.len(),
        c.data.len()
    );
    if profile {
        let mut v: Vec<_> = counts.into_iter().collect();
        v.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
        for (f, n) in v.iter().take(15) {
            println!("{n:>10} {f}");
        }
    }
    for y in (0..96).step_by(2) {
        let row: String = (0..128)
            .map(|x| match (mem.pixel(x, y), mem.pixel(x, y + 1)) {
                (true, true) => '█',
                (true, false) => '▀',
                (false, true) => '▄',
                _ => ' ',
            })
            .collect();
        println!("|{row}|");
    }
}

/// For each ROM word, the function (or runtime routine) it belongs to.
fn functions(c: &s2t_c::Compiled) -> Vec<String> {
    const INNER: [&str; 6] = ["__t", "__f", "__j", "__ds", "__du", "__mul_"];
    let mut by_line = Vec::with_capacity(c.asm.len());
    let mut current = String::from("?");
    for text in &c.asm {
        if let Some((name, _)) = text.trim().split_once(':') {
            if !name.contains(' ') && !INNER.iter().any(|p| name.starts_with(p)) {
                current = name.to_string();
            }
        }
        by_line.push(current.clone());
    }
    c.code_map
        .iter()
        .map(|&l| by_line.get(l.wrapping_sub(1)).cloned().unwrap_or_default())
        .collect()
}
