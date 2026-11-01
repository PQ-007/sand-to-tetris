//! Clocked cells (fast models of registers and RAM) and event-driven
//! settling.

#![allow(clippy::unwrap_used)] // test helpers

use std::sync::Arc;

use s2t_gate::{Clocked, GateSim, Model, TruthTable};
use s2t_netlist::builder::*;
use s2t_netlist::{flatten_gates, GateCircuit, Library, Value};

use Value::{One, Zero, X};

/// A 1-bit register model: inputs d, load, clk; output q.
fn bit_model() -> Model {
    Model::Clocked(Clocked {
        clk_bit: 2,
        words: 1,
        tick: Arc::new(
            |ins: &[Value], mem: &mut [Option<u64>]| match (ins[0], ins[1]) {
                (_, Zero) => {}
                (One, One) => mem[0] = Some(1),
                (Zero, One) => mem[0] = Some(0),
                _ => mem[0] = None,
            },
        ),
        read: Arc::new(|_: &[Value], mem: &[Option<u64>]| {
            vec![mem[0].map_or(X, |v| Value::from_bit(v == 1))]
        }),
    })
}

fn not_model() -> Model {
    Model::Table(TruthTable::from_fn(1, 1, |i| u64::from(i == 0)))
}

/// One fast `bit` cell wired straight to the ports, plus a NOT on `a` → `na`.
fn circuit() -> GateCircuit {
    let mut lib = Library::new();
    lib.add_level(level("bit", 3, &["d", "load", "clk"], &["q"]));
    lib.add_level(level("not", 1, &["a"], &["out"]));
    lib.unlock(design("bit", &[], &[]));
    lib.unlock(design("not", &[], &[]));
    let top = level("top", 3, &["d", "load", "clk", "a"], &["q", "na"]);
    let d = design(
        "top",
        &[("b", "bit"), ("n", "not")],
        &[
            (port("d"), pin("b", "d")),
            (port("load"), pin("b", "load")),
            (port("clk"), pin("b", "clk")),
            (pin("b", "q"), port("q")),
            (port("a"), pin("n", "a")),
            (pin("n", "out"), port("na")),
        ],
    );
    flatten_gates(&top, &d, &lib, &|k| k == "bit" || k == "not", false).unwrap()
}

fn sim(c: &GateCircuit) -> GateSim<'_> {
    GateSim::new(c, |cell| match cell.kind.as_str() {
        "bit" => Some(bit_model()),
        "not" => Some(not_model()),
        _ => None,
    })
    .unwrap()
}

fn step(s: &mut GateSim, d: u64, load: u64, clk: u64) -> Value {
    s.set_input("d", d).unwrap();
    s.set_input("load", load).unwrap();
    s.set_input("clk", clk).unwrap();
    s.set_input("a", 0).unwrap();
    s.settle();
    s.output("q").unwrap()[0]
}

#[test]
fn a_clocked_cell_stores_only_on_a_rising_edge() {
    let c = circuit();
    let mut s = sim(&c);
    assert_eq!(step(&mut s, 1, 1, 0), X); // unknown until the first edge
    assert_eq!(step(&mut s, 1, 1, 1), One); // rising edge: store
    assert_eq!(step(&mut s, 0, 1, 1), One); // clk stays high: hold
    assert_eq!(step(&mut s, 0, 1, 0), One); // falling edge: hold
    assert_eq!(step(&mut s, 0, 0, 1), One); // edge without load: keep
    assert_eq!(step(&mut s, 0, 1, 0), One);
    assert_eq!(step(&mut s, 0, 1, 1), Zero); // edge with load: store 0
}

#[test]
fn memory_saves_and_restores() {
    let c = circuit();
    let mut s = sim(&c);
    step(&mut s, 1, 1, 0);
    step(&mut s, 1, 1, 1);
    let cell = c.cells.iter().position(|x| x.kind == "bit").unwrap();
    let saved = s.memory(cell).unwrap();
    assert_eq!(saved, "1,0:1");
    // A fresh simulator restored from it holds the 1, and remembers clk was
    // high, so it sees no new edge.
    let mut t = sim(&c);
    t.set_memory(cell, &saved).unwrap();
    assert_eq!(step(&mut t, 0, 1, 1), One);
    assert!(t.set_memory(cell, "nonsense").is_err());
    let not_cell = c.cells.iter().position(|x| x.kind == "not").unwrap();
    assert_eq!(s.memory(not_cell), None);
}

#[test]
fn settling_again_without_changes_does_nothing() {
    let c = circuit();
    let mut s = sim(&c);
    step(&mut s, 0, 0, 0);
    let again = s.settle();
    assert!(again.settled);
    assert_eq!(again.depth, 0);
    // Changing `a` only re-evaluates the NOT: one round.
    s.set_input("a", 1).unwrap();
    assert_eq!(s.settle().depth, 1);
    assert_eq!(s.output("na").unwrap(), vec![Zero]);
}
