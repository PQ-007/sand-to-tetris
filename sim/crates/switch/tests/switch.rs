//! Behaviour of the switch-level engine on small CMOS circuits.

#![allow(clippy::unwrap_used)] // test helpers

use s2t_netlist::builder::*;
use s2t_netlist::{flatten, Circuit, Design, Library};
use s2t_switch::{Sim, Value};

fn lib() -> Library {
    let mut lib = Library::new();
    lib.add_level(level("not", 1, &["a"], &["out"]));
    lib.add_level(level("nand", 1, &["a", "b"], &["out"]));
    lib
}

fn circuit(d: &Design, inputs: &[&str]) -> Circuit {
    let l = lib();
    let lvl = level(&d.component, 1, inputs, &["out"]);
    flatten(&lvl, d, &l).unwrap()
}

fn nand_design() -> Design {
    design(
        "nand",
        &[
            ("pa", "pmos"),
            ("pb", "pmos"),
            ("na", "nmos"),
            ("nb", "nmos"),
            ("v", "vdd"),
            ("g", "gnd"),
        ],
        &[
            (port("a"), pin("pa", "gate")),
            (port("a"), pin("na", "gate")),
            (port("b"), pin("pb", "gate")),
            (port("b"), pin("nb", "gate")),
            (pin("v", "out"), pin("pa", "source")),
            (pin("v", "out"), pin("pb", "source")),
            (pin("pa", "drain"), port("out")),
            (pin("pb", "drain"), port("out")),
            (pin("na", "drain"), port("out")),
            (pin("na", "source"), pin("nb", "drain")),
            (pin("nb", "source"), pin("g", "out")),
        ],
    )
}

fn run(c: &Circuit, inputs: &[(&str, Value)]) -> (Value, s2t_switch::Outcome) {
    let mut sim = Sim::new(c);
    for (name, v) in inputs {
        sim.set_input(name, *v).unwrap();
    }
    let outcome = sim.settle();
    (sim.output("out").unwrap(), outcome)
}

use Value::{One, Zero, X, Z};

#[test]
fn inverter_inverts() {
    let c = circuit(&not_design(), &["a"]);
    assert_eq!(run(&c, &[("a", Zero)]).0, One);
    assert_eq!(run(&c, &[("a", One)]).0, Zero);
}

#[test]
fn unknown_or_floating_input_gives_unknown_output() {
    let c = circuit(&not_design(), &["a"]);
    assert_eq!(run(&c, &[("a", X)]).0, X);
    assert_eq!(run(&c, &[("a", Z)]).0, X);
}

#[test]
fn nand_truth_table() {
    let c = circuit(&nand_design(), &["a", "b"]);
    for (a, b, out) in [
        (Zero, Zero, One),
        (Zero, One, One),
        (One, Zero, One),
        (One, One, Zero),
    ] {
        assert_eq!(run(&c, &[("a", a), ("b", b)]).0, out, "a={a} b={b}");
    }
}

#[test]
fn reports_which_transistors_conduct() {
    let c = circuit(&not_design(), &["a"]);
    let mut sim = Sim::new(&c);
    sim.set_input("a", One).unwrap();
    sim.settle();
    let state = |id: &str| {
        let i = c.transistors.iter().position(|t| t.path == [id]).unwrap();
        sim.conduction(i)
    };
    assert_eq!(state("n1"), s2t_switch::Conduct::On);
    assert_eq!(state("p1"), s2t_switch::Conduct::Off);
}

#[test]
fn nand_with_known_zero_input_ignores_unknown_other_input() {
    // With a = 0, pa connects out to VDD and na cuts the path to GND,
    // whatever b is. The engine must not be over-pessimistic here.
    let c = circuit(&nand_design(), &["a", "b"]);
    assert_eq!(run(&c, &[("a", Zero), ("b", X)]).0, One);
}

#[test]
fn missing_pull_down_leaves_output_floating() {
    let mut d = not_design();
    d.parts.retain(|p| p.id != "n1" && p.id != "g");
    d.wires.retain(|w| {
        ![&w.from, &w.to].iter().any(
            |e| matches!(e, s2t_netlist::Endpoint::Pin { part, .. } if part == "n1" || part == "g"),
        )
    });
    let c = circuit(&d, &["a"]);
    let (out, outcome) = run(&c, &[("a", One)]);
    assert_eq!(out, Z);
    assert!(outcome.shorts.is_empty());
}

#[test]
fn wrong_transistor_type_shorts_vdd_to_gnd() {
    // Two NMOS: with a = 1 both conduct, joining VDD and GND.
    let mut d = not_design();
    d.parts.iter_mut().find(|p| p.id == "p1").unwrap().kind = "nmos".into();
    let c = circuit(&d, &["a"]);
    let (out, outcome) = run(&c, &[("a", One)]);
    assert_eq!(out, X);
    assert_eq!(outcome.shorts.len(), 1);
    let short = &outcome.shorts[0];
    let mut parts: Vec<String> = short
        .transistors
        .iter()
        .map(|&t| c.transistors[t].path.join("/"))
        .collect();
    parts.sort();
    assert_eq!(parts, ["n1", "p1"]);
    assert!(short.nets.contains(&c.outputs[0].1));
    // With a = 0 neither conducts: no short, output floats.
    let (out, outcome) = run(&c, &[("a", Zero)]);
    assert_eq!(out, Z);
    assert!(outcome.shorts.is_empty());
}

#[test]
fn input_wired_straight_to_a_rail_shorts_when_driven_the_other_way() {
    let d = design(
        "not",
        &[("v", "vdd")],
        &[(port("a"), pin("v", "out")), (port("a"), port("out"))],
    );
    let c = circuit(&d, &["a"]);
    let (out, outcome) = run(&c, &[("a", Zero)]);
    assert_eq!(out, X);
    assert_eq!(outcome.shorts.len(), 1);
    assert_eq!(outcome.shorts[0].inputs, ["a"]);
    assert_eq!(run(&c, &[("a", One)]).0, One);
}

#[test]
fn nested_components_simulate_like_the_flat_circuit() {
    let mut l = lib();
    l.unlock(not_design());
    let buf = level("buf", 1, &["a"], &["out"]);
    let d = design(
        "buf",
        &[("i1", "not"), ("i2", "not")],
        &[
            (port("a"), pin("i1", "a")),
            (pin("i1", "out"), pin("i2", "a")),
            (pin("i2", "out"), port("out")),
        ],
    );
    let c = flatten(&buf, &d, &l).unwrap();
    assert_eq!(run(&c, &[("a", One)]).0, One);
    assert_eq!(run(&c, &[("a", Zero)]).0, Zero);
}

#[test]
fn feedback_loop_without_a_defined_state_stays_unknown() {
    // Three inverters in a ring (a ring oscillator) has no stable value.
    let mut l = lib();
    l.unlock(not_design());
    let ring = level("ring", 1, &[], &["out"]);
    let d = design(
        "ring",
        &[("i1", "not"), ("i2", "not"), ("i3", "not")],
        &[
            (pin("i1", "out"), pin("i2", "a")),
            (pin("i2", "out"), pin("i3", "a")),
            (pin("i3", "out"), pin("i1", "a")),
            (pin("i3", "out"), port("out")),
        ],
    );
    let c = flatten(&ring, &d, &l).unwrap();
    let mut sim = Sim::new(&c);
    let outcome = sim.settle();
    assert!(outcome.settled);
    assert_eq!(sim.output("out"), Some(X));
}

#[test]
fn unknown_port_names_are_rejected() {
    let c = circuit(&not_design(), &["a"]);
    let mut sim = Sim::new(&c);
    assert_eq!(
        sim.set_input("q", One).unwrap_err().to_string(),
        "no input named `q` (inputs: `a`)"
    );
    assert_eq!(sim.output("q"), None);
}
