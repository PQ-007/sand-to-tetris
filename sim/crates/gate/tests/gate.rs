//! The gate-level engine on small circuits built from table cells.

#![allow(clippy::unwrap_used)] // test helpers

use s2t_gate::{GateSim, Model, TruthTable};
use s2t_netlist::builder::*;
use s2t_netlist::{flatten_gates, GateCircuit, Level, Library, Value};

use Value::{One, Zero, X, Z};

fn not_table() -> TruthTable {
    TruthTable::from_fn(1, 1, |i| u64::from(i == 0))
}

fn nand_table() -> TruthTable {
    TruthTable::from_fn(2, 1, |i| u64::from(i != 3))
}

fn lib() -> Library {
    let mut lib = Library::new();
    lib.add_level(level("not", 1, &["a"], &["out"]));
    lib.add_level(level("nand", 1, &["a", "b"], &["out"]));
    lib.unlock(design("not", &[], &[]));
    lib.unlock(design("nand", &[], &[]));
    lib
}

fn model(kind: &str) -> Option<Model> {
    match kind {
        "not" => Some(Model::Table(not_table())),
        "nand" => Some(Model::Table(nand_table())),
        _ => None,
    }
}

fn build(lvl: &Level, d: &s2t_netlist::Design) -> GateCircuit {
    let l = lib();
    flatten_gates(lvl, d, &l, &|k| k == "not" || k == "nand", false).unwrap()
}

/// a AND b from a NAND and a NOT.
fn and_circuit() -> GateCircuit {
    let lvl = level("and", 2, &["a", "b"], &["out"]);
    let d = design(
        "and",
        &[("x", "nand"), ("i", "not")],
        &[
            (port("a"), pin("x", "a")),
            (port("b"), pin("x", "b")),
            (pin("x", "out"), pin("i", "a")),
            (pin("i", "out"), port("out")),
        ],
    );
    build(&lvl, &d)
}

#[test]
fn truth_tables_from_functions() {
    let t = nand_table();
    assert_eq!(t.eval(&[One, One]), vec![Zero]);
    assert_eq!(t.eval(&[Zero, One]), vec![One]);
}

#[test]
fn unknown_inputs_give_unknown_outputs_only_when_they_matter() {
    let t = nand_table();
    // A 0 on one input decides a NAND whatever the other is.
    assert_eq!(t.eval(&[Zero, X]), vec![One]);
    assert_eq!(t.eval(&[One, X]), vec![X]);
    // Floating inputs count as unknown.
    assert_eq!(t.eval(&[One, Z]), vec![X]);
}

#[test]
fn and_from_nand_and_not() {
    let c = and_circuit();
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    for (a, b, out) in [(0, 0, 0), (0, 1, 0), (1, 0, 0), (1, 1, 1)] {
        sim.set_input("a", a).unwrap();
        sim.set_input("b", b).unwrap();
        let o = sim.settle();
        assert!(o.settled);
        assert_eq!(
            sim.output("out"),
            Some(vec![Value::from_bit(out == 1)]),
            "a={a} b={b}"
        );
    }
}

#[test]
fn settling_time_counts_gate_delays() {
    // Two gates in a row: the output is final after 2 unit delays.
    let c = and_circuit();
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    sim.set_input("a", 1).unwrap();
    sim.set_input("b", 1).unwrap();
    assert_eq!(sim.settle().depth, 2);
}

#[test]
fn buses_read_and_write_as_numbers() {
    let lvl = {
        let mut l = level("not4", 2, &["a"], &["out"]);
        l.widths.insert("a".into(), 4);
        l.widths.insert("out".into(), 4);
        l
    };
    let mut d = design(
        "not4",
        &[],
        &[(port("a"), pin("n", "a")), (pin("n", "out"), port("out"))],
    );
    d.parts.push(part_with("n", "not", None, Some(4), &[]));
    let c = build(&lvl, &d);
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    sim.set_input("a", 0b0101).unwrap();
    sim.settle();
    assert_eq!(sim.output_number("out"), Some(0b1010));
    // Bits come least significant first.
    assert_eq!(sim.output("out"), Some(vec![Zero, One, Zero, One]));
}

#[test]
fn unconnected_inputs_float_and_poison_outputs() {
    let lvl = level("and", 2, &["a", "b"], &["out"]);
    let d = design(
        "and",
        &[("x", "nand"), ("i", "not")],
        &[
            (port("a"), pin("x", "a")),
            (pin("x", "out"), pin("i", "a")),
            (pin("i", "out"), port("out")),
        ],
    );
    let c = build(&lvl, &d);
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    sim.set_input("a", 1).unwrap();
    sim.settle();
    assert_eq!(sim.output("out"), Some(vec![X]));
    // An output wired to nothing is floating.
    let empty = design("and", &[], &[]);
    let c = flatten_gates(&lvl, &empty, &lib(), &|_| true, true).unwrap();
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    sim.settle();
    assert_eq!(sim.output("out"), Some(vec![Z]));
}

#[test]
fn an_oscillating_loop_is_reported() {
    // A NOT feeding itself flips forever.
    let lvl = level("osc", 2, &[], &["out"]);
    let d = design(
        "osc",
        &[("i", "not")],
        &[
            (pin("i", "out"), pin("i", "a")),
            (pin("i", "out"), port("out")),
        ],
    );
    let c = build(&lvl, &d);
    let mut sim = GateSim::new(&c, |cell| model(&cell.kind)).unwrap();
    // Starting from X it stays X (no defined state)...
    assert!(sim.settle().settled);
    assert_eq!(sim.output("out"), Some(vec![X]));
    // ...but kicked into a real value, it oscillates and never settles.
    sim.force(c.outputs[0].1[0], Zero);
    let o = sim.settle();
    assert!(!o.settled);
}

#[test]
fn missing_models_are_named() {
    let c = and_circuit();
    let err = GateSim::new(&c, |cell| {
        if cell.kind == "not" {
            None
        } else {
            model(&cell.kind)
        }
    })
    .unwrap_err();
    assert_eq!(err, "no model for `not` (cell i)");
}

#[test]
fn native_models_plug_in() {
    fn and2(ins: &[Value]) -> Vec<Value> {
        vec![match ins {
            [One, One] => One,
            [Zero, _] | [_, Zero] => Zero,
            _ => X,
        }]
    }
    let lvl = level("t", 2, &["a", "b"], &["out"]);
    let mut l = lib();
    l.add_level(level("and", 2, &["a", "b"], &["out"]));
    l.unlock(design("and", &[], &[]));
    let d = design(
        "t",
        &[("g", "and")],
        &[
            (port("a"), pin("g", "a")),
            (port("b"), pin("g", "b")),
            (pin("g", "out"), port("out")),
        ],
    );
    let c = flatten_gates(&lvl, &d, &l, &|_| true, false).unwrap();
    let mut sim = GateSim::new(&c, |_| Some(Model::native(and2))).unwrap();
    sim.set_input("a", 1).unwrap();
    sim.set_input("b", 1).unwrap();
    sim.settle();
    assert_eq!(sim.output_number("out"), Some(1));
}
