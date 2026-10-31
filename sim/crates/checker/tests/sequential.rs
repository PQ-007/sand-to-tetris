//! Sequential levels: the table runs top to bottom on one simulator, so
//! state carries from step to step.

#![allow(clippy::unwrap_used)] // test helpers

use s2t_checker::{check, Kind};
use s2t_netlist::builder::*;
use s2t_netlist::{Level, Library};

fn lvl(toml: &str) -> Level {
    Level::from_toml(toml).unwrap()
}

fn lib() -> Library {
    let mut lib = Library::new();
    lib.add_level(lvl(
        "id='nor'\nname='NOR'\nlayer=1\ngoal=''\ninputs=['a','b']\noutputs=['out']\ntruth_table='''\na b | out\n0 0 | 1\n0 1 | 0\n1 0 | 0\n1 1 | 0\n'''",
    ));
    lib.unlock(design("nor", &[], &[]));
    lib
}

/// Set, hold, reset, hold: the hold steps only pass if the latch remembers.
fn sr_level() -> Level {
    lvl("id='srlatch'\nname='SR latch'\nlayer=2\ngoal=''\nsequential=true\ninputs=['s','r']\noutputs=['q']\ntruth_table='''\ns r | q\n0 0 | -\n1 0 | 1\n0 0 | 1\n0 1 | 0\n0 0 | 0\n'''\n[hints]\nwrong='A latch feeds its output back into itself.'")
}

/// Two NORs, each output feeding the other's input.
fn sr_latch() -> s2t_netlist::Design {
    design(
        "srlatch",
        &[("top", "nor"), ("bottom", "nor")],
        &[
            (port("r"), pin("top", "a")),
            (pin("bottom", "out"), pin("top", "b")),
            (port("s"), pin("bottom", "a")),
            (pin("top", "out"), pin("bottom", "b")),
            (pin("top", "out"), port("q")),
        ],
    )
}

#[test]
fn a_cross_coupled_nor_latch_remembers() {
    let r = check(&sr_level(), &sr_latch(), &lib()).unwrap();
    assert!(r.passed, "{r:#?}");
    // Step 1 is "don't care": the latch starts unknown.
    assert_eq!(r.rows[0].outputs, [("q".into(), "-".into(), "X".into())]);
    assert_eq!(r.rows[2].outputs, [("q".into(), "1".into(), "1".into())]);
}

#[test]
fn a_circuit_without_memory_fails_on_a_hold_step() {
    // q = NOR(r, NOT s) has no feedback: on "hold" (s=0, r=0) it always
    // gives 0, so it fails step 3, which should still hold the 1 from step 2.
    let d = design(
        "srlatch",
        &[("ns", "nor"), ("q", "nor")],
        &[
            (port("s"), pin("ns", "a")),
            (port("s"), pin("ns", "b")),
            (port("r"), pin("q", "a")),
            (pin("ns", "out"), pin("q", "b")),
            (pin("q", "out"), port("q")),
        ],
    );
    let r = check(&sr_level(), &d, &lib()).unwrap();
    assert!(!r.passed);
    assert_eq!(r.diagnostics.len(), 1);
    let diag = &r.diagnostics[0];
    assert_eq!((diag.row, diag.kind), (3, Kind::Wrong));
    assert_eq!(
        diag.message,
        "Step 3 (after steps 1–2): s=0 r=0 → expected q=1, got q=0."
    );
    assert_eq!(
        diag.hint.as_deref(),
        Some("A latch feeds its output back into itself.")
    );
}

#[test]
fn sequential_is_only_for_the_gate_engine() {
    let e = Level::from_toml(
        "id='x'\nname='X'\nlayer=1\ngoal=''\nsequential=true\ninputs=['a']\noutputs=['out']\ntruth_table='''\na | out\n0 | 1\n'''",
    )
    .unwrap_err();
    assert!(e.0.contains("sequential"), "{e}");
}

#[test]
fn dont_care_is_only_for_sequential_levels() {
    let comb = lvl(
        "id='buf'\nname='B'\nlayer=2\ngoal=''\ninputs=['a']\noutputs=['out']\ntruth_table='''\na | out\n0 | -\n'''",
    );
    let e = check(&comb, &design("buf", &[], &[]), &lib()).unwrap_err();
    assert!(e.to_string().contains("`-`"), "{e}");
}
