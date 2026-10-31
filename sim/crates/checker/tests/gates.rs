//! Checking Layer 2+ designs on the gate-level engine.

#![allow(clippy::unwrap_used)] // test helpers

use std::collections::BTreeSet;

use s2t_checker::{check, check_with, Kind};
use s2t_netlist::builder::*;
use s2t_netlist::{Level, Library};

fn lvl(toml: &str) -> Level {
    Level::from_toml(toml).unwrap()
}

/// Layer 1 NOT and NAND with real truth tables (designs don't matter: at
/// Layer 2 they run as their tables).
fn lib() -> Library {
    let mut lib = Library::new();
    lib.add_level(lvl(
        "id='not'\nname='NOT'\nlayer=1\ngoal=''\ninputs=['a']\noutputs=['out']\ntruth_table='''\na | out\n0 | 1\n1 | 0\n'''",
    ));
    lib.add_level(lvl(
        "id='nand'\nname='NAND'\nlayer=1\ngoal=''\ninputs=['a','b']\noutputs=['out']\ntruth_table='''\na b | out\n0 0 | 1\n0 1 | 1\n1 0 | 1\n1 1 | 0\n'''",
    ));
    lib.unlock(design("not", &[], &[]));
    lib.unlock(design("nand", &[], &[]));
    lib.add_level(and_level());
    lib.add_level(not16_level());
    lib
}

fn and_level() -> Level {
    lvl("id='and'\nname='AND'\nlayer=2\ngoal=''\ninputs=['a','b']\noutputs=['out']\ntruth_table='''\na b | out\n0 0 | 0\n0 1 | 0\n1 0 | 0\n1 1 | 1\n'''\n[hints]\nwrong='AND is NAND then NOT.'")
}

fn not16_level() -> Level {
    lvl("id='not16'\nname='NOT16'\nlayer=2\ngoal=''\ninputs=['a']\noutputs=['out']\nmodel='not16'\nrandom_tests=500\nwidths={a=16,out=16}\ntruth_table='''\na | out\n0x0000 | 0xffff\n0x00ff | 0xff00\n'''")
}

fn and_design() -> s2t_netlist::Design {
    design(
        "and",
        &[("x", "nand"), ("i", "not")],
        &[
            (port("a"), pin("x", "a")),
            (port("b"), pin("x", "b")),
            (pin("x", "out"), pin("i", "a")),
            (pin("i", "out"), port("out")),
        ],
    )
}

#[test]
fn and_from_nand_and_not_passes_with_depth_2() {
    let r = check(&and_level(), &and_design(), &lib()).unwrap();
    assert!(r.passed, "{r:#?}");
    assert_eq!((r.cells, r.depth, r.transistors), (2, 2, 0));
}

#[test]
fn a_wrong_value_names_the_row_and_hint() {
    // Just a NAND: the opposite of AND everywhere.
    let d = design(
        "and",
        &[("x", "nand")],
        &[
            (port("a"), pin("x", "a")),
            (port("b"), pin("x", "b")),
            (pin("x", "out"), port("out")),
        ],
    );
    let r = check(&and_level(), &d, &lib()).unwrap();
    assert!(!r.passed);
    assert_eq!(r.diagnostics.len(), 4);
    assert_eq!(
        r.diagnostics[3].message,
        "Row 4: a=1 b=1 → expected out=1, got out=0."
    );
    assert_eq!(
        r.diagnostics[3].hint.as_deref(),
        Some("AND is NAND then NOT.")
    );
}

#[test]
fn bus_level_runs_rows_and_random_tests_against_the_model() {
    let mut d = design(
        "not16",
        &[],
        &[(port("a"), pin("n", "a")), (pin("n", "out"), port("out"))],
    );
    d.parts.push(part_with("n", "not", None, Some(16), &[]));
    let r = check(&not16_level(), &d, &lib()).unwrap();
    assert!(r.passed, "{:#?}", r.diagnostics);
    assert_eq!(r.cells, 16);
    let random = r.random.unwrap();
    assert_eq!((random.run, random.failed), (500, 0));
}

#[test]
fn random_tests_catch_what_rows_miss() {
    // Bits 8..15 inverted correctly, but bits 0..7 wired straight through:
    // the two listed rows happen to... not pass either, but random tests
    // report how many inputs fail, with a few details.
    let mut d = design(
        "not16",
        &[],
        &[(port("a"), pin("s", "in")), (pin("j", "out"), port("out"))],
    );
    d.parts.push(part_with("s", "split", Some(16), None, &[]));
    d.parts.push(part_with("j", "join", Some(16), None, &[]));
    for i in 0..16 {
        if i < 8 {
            d.wires.push(s2t_netlist::Wire {
                from: pin("s", &i.to_string()),
                to: pin("j", &i.to_string()),
                points: vec![],
            });
        } else {
            let id = format!("n{i}");
            d.parts.push(part_with(&id, "not", None, None, &[]));
            d.wires.push(s2t_netlist::Wire {
                from: pin("s", &i.to_string()),
                to: pin(&id, "a"),
                points: vec![],
            });
            d.wires.push(s2t_netlist::Wire {
                from: pin(&id, "out"),
                to: pin("j", &i.to_string()),
                points: vec![],
            });
        }
    }
    let r = check(&not16_level(), &d, &lib()).unwrap();
    assert!(!r.passed);
    let random = r.random.unwrap();
    assert!(random.failed > 490, "{random:?}");
    let detail = r
        .diagnostics
        .iter()
        .find(|x| x.message.starts_with("Random test"))
        .unwrap();
    assert!(
        detail.message.contains("expected out=0x"),
        "{}",
        detail.message
    );
    // Rows + at most 5 random details.
    assert!(r.diagnostics.len() <= 2 + 5);
}

#[test]
fn floating_bus_bits_are_named() {
    let mut d = design(
        "not16",
        &[],
        &[(port("a"), pin("s", "in")), (pin("j", "out"), port("out"))],
    );
    d.parts.push(part_with("s", "split", Some(16), None, &[]));
    d.parts.push(part_with("j", "join", Some(16), None, &[]));
    for i in 2..16 {
        let id = format!("n{i}");
        d.parts.push(part_with(&id, "not", None, None, &[]));
        d.wires.push(s2t_netlist::Wire {
            from: pin("s", &i.to_string()),
            to: pin(&id, "a"),
            points: vec![],
        });
        d.wires.push(s2t_netlist::Wire {
            from: pin(&id, "out"),
            to: pin("j", &i.to_string()),
            points: vec![],
        });
    }
    let r = check(&not16_level(), &d, &lib()).unwrap();
    let f = r
        .diagnostics
        .iter()
        .find(|x| x.kind == Kind::Floating)
        .unwrap();
    assert!(
        f.message
            .ends_with("bits 0, 1 of `out` are floating. Nothing drives them."),
        "{}",
        f.message
    );
    assert_eq!(f.actual, "11111111111111ZZ");
}

#[test]
fn two_outputs_on_one_wire_is_a_problem_with_parts() {
    let d = design(
        "and",
        &[("x", "nand"), ("y", "nand")],
        &[
            (port("a"), pin("x", "a")),
            (port("b"), pin("x", "b")),
            (port("a"), pin("y", "a")),
            (port("b"), pin("y", "b")),
            (pin("x", "out"), port("out")),
            (pin("y", "out"), port("out")),
        ],
    );
    let r = check(&and_level(), &d, &lib()).unwrap();
    assert!(!r.passed && r.rows.is_empty());
    let p = r
        .problems
        .iter()
        .find(|p| p.message.contains("fighting"))
        .unwrap();
    assert_eq!(p.parts, ["x", "y"]);
}

#[test]
fn a_fast_component_runs_as_its_model() {
    // A Layer 2 level using `and`: with `and` fast it's 1 cell, otherwise 2.
    let mut l = lib();
    l.unlock(and_design());
    let top = lvl("id='buf'\nname='BUF'\nlayer=2\ngoal=''\ninputs=['a']\noutputs=['out']\ntruth_table='''\na | out\n0 | 0\n1 | 1\n'''");
    let d = design(
        "buf",
        &[("g", "and")],
        &[
            (port("a"), pin("g", "a")),
            (port("a"), pin("g", "b")),
            (pin("g", "out"), port("out")),
        ],
    );
    let slow = check(&top, &d, &l).unwrap();
    let fast = check_with(&top, &d, &l, &BTreeSet::from(["and".to_string()])).unwrap();
    assert!(slow.passed && fast.passed);
    assert_eq!((slow.cells, fast.cells), (2, 1));
}
