//! The checker: truth tables in, pass/fail and explanations out.

#![allow(clippy::unwrap_used)] // test helpers

use s2t_checker::{check, Kind, Table};
use s2t_netlist::builder::*;
use s2t_netlist::{Design, Level, Library};

fn nand_level() -> Level {
    Level::from_toml(
        r#"
        id = "nand"
        name = "NAND"
        layer = 1
        goal = "Output 0 only when both inputs are 1."
        inputs = ["a", "b"]
        outputs = ["out"]
        truth_table = """
        a b | out
        0 0 | 1
        0 1 | 1
        1 0 | 1
        1 1 | 0
        """
        [hints]
        floating = "Every input combination must connect out to VDD or to GND."
        short = "Make sure the pull-up (PMOS) and pull-down (NMOS) networks are never on at the same time."
        "#,
    )
    .unwrap()
}

fn lib() -> Library {
    let mut l = Library::new();
    l.add_level(nand_level());
    l
}

/// Correct CMOS NAND: parallel PMOS pull-up, series NMOS pull-down.
fn nand(pull_down_parallel: bool) -> Design {
    let mut wires = vec![
        (port("a"), pin("pa", "gate")),
        (port("a"), pin("na", "gate")),
        (port("b"), pin("pb", "gate")),
        (port("b"), pin("nb", "gate")),
        (pin("v", "out"), pin("pa", "source")),
        (pin("v", "out"), pin("pb", "source")),
        (pin("pa", "drain"), port("out")),
        (pin("pb", "drain"), port("out")),
        (pin("na", "drain"), port("out")),
        (pin("nb", "source"), pin("g", "out")),
    ];
    if pull_down_parallel {
        // Mistake: NMOS in parallel (that's the NOR pull-down).
        wires.push((pin("nb", "drain"), port("out")));
        wires.push((pin("na", "source"), pin("g", "out")));
    } else {
        wires.push((pin("na", "source"), pin("nb", "drain")));
    }
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
        &wires,
    )
}

#[test]
fn a_correct_nand_passes_every_row() {
    let r = check(&nand_level(), &nand(false), &lib()).unwrap();
    assert!(r.passed, "{r:#?}");
    assert_eq!(r.rows.len(), 4);
    assert!(r.rows.iter().all(|row| row.passed));
    assert_eq!(r.transistors, 4);
    assert!(r.diagnostics.is_empty());
}

#[test]
fn parallel_pull_down_shorts_and_names_the_transistors() {
    let r = check(&nand_level(), &nand(true), &lib()).unwrap();
    assert!(!r.passed);
    // a=0,b=1 and a=1,b=0: one PMOS and one NMOS both on → short.
    let d = &r.diagnostics[0];
    assert_eq!(d.row, 2);
    assert_eq!(d.kind, Kind::Short);
    assert_eq!(
        d.message,
        "Row 2: a=0 b=1 → short circuit: VDD and GND are connected through `g`, `nb`, `pa`, `v`. Expected out=1, got X."
    );
    assert_eq!(d.parts, ["g", "nb", "pa", "v"]);
    assert_eq!(
        d.hint.as_deref(),
        Some("Make sure the pull-up (PMOS) and pull-down (NMOS) networks are never on at the same time.")
    );
}

#[test]
fn missing_pull_down_reports_floating_output() {
    let mut d = nand(false);
    d.parts.retain(|p| p.id != "na");
    d.wires.retain(|w| {
        ![&w.from, &w.to]
            .iter()
            .any(|e| matches!(e, s2t_netlist::Endpoint::Pin { part, .. } if part == "na"))
    });
    let r = check(&nand_level(), &d, &lib()).unwrap();
    let diag = r.diagnostics.iter().find(|d| d.row == 4).unwrap();
    assert_eq!(diag.kind, Kind::Floating);
    assert_eq!(diag.actual, "Z");
    assert_eq!(
        diag.message,
        "Row 4: a=1 b=1 → expected out=0, got Z: `out` is floating. Nothing connects it to VDD or GND when a=1, b=1."
    );
    assert_eq!(diag.ports, ["out"]);
    assert_eq!(
        diag.hint.as_deref(),
        Some("Every input combination must connect out to VDD or to GND.")
    );
}

#[test]
fn wrong_value_is_explained_plainly() {
    // An inverter of `a` (ignoring `b`) is right for 3 rows, wrong for one.
    let d = design(
        "nand",
        &[("p", "pmos"), ("n", "nmos"), ("v", "vdd"), ("g", "gnd")],
        &[
            (port("a"), pin("p", "gate")),
            (port("a"), pin("n", "gate")),
            (pin("v", "out"), pin("p", "source")),
            (pin("p", "drain"), port("out")),
            (pin("n", "drain"), port("out")),
            (pin("g", "out"), pin("n", "source")),
        ],
    );
    let r = check(&nand_level(), &d, &lib()).unwrap();
    assert!(!r.passed);
    assert_eq!(r.diagnostics.len(), 1);
    let wrong = &r.diagnostics[0];
    assert_eq!(wrong.kind, Kind::Wrong);
    assert_eq!(wrong.message, "Row 3: a=1 b=0 → expected out=1, got out=0.");
    assert_eq!(
        wrong.inputs,
        [
            ("a".to_string(), "1".to_string()),
            ("b".to_string(), "0".to_string())
        ]
    );
    // The unused input is still mentioned, as a warning.
    assert_eq!(r.problems[0].message, "input `b` isn't used");
}

#[test]
fn validation_errors_stop_before_simulation() {
    let r = check(&nand_level(), &design("nand", &[], &[]), &lib()).unwrap();
    assert!(!r.passed);
    assert!(r.rows.is_empty());
    assert_eq!(
        r.problems[0].message,
        "output `out` isn't connected to anything"
    );
    assert_eq!(r.problems[0].severity, "error");
    // Unused inputs are only warnings.
    assert_eq!(r.problems[1].severity, "warning");
}

#[test]
fn reports_serialize_to_json_for_the_browser() {
    let r = check(&nand_level(), &nand(false), &lib()).unwrap();
    let json = serde_json::to_string(&r).unwrap();
    assert!(json.contains(r#""passed":true"#), "{json}");
}

#[test]
fn table_parsing_errors_name_the_line() {
    let lvl = nand_level();
    let err = Table::parse("a b | out\n0 0 | 1\n0 2 | 1\n", &lvl).unwrap_err();
    assert_eq!(err.to_string(), "truth table line 3: `2` isn't 0 or 1");
    let err = Table::parse("a c | out\n", &lvl).unwrap_err();
    assert_eq!(
        err.to_string(),
        "truth table line 1: columns `a`, `c` don't match the level's inputs `a`, `b`"
    );
    let err = Table::parse("a b | out\n0 0 1\n", &lvl).unwrap_err();
    assert_eq!(
        err.to_string(),
        "truth table line 2: expected 2 inputs, `|`, then 1 output"
    );
}

#[test]
fn tables_know_whether_they_cover_every_input_combination() {
    let lvl = nand_level();
    let full = Table::parse(&lvl.truth_table, &lvl).unwrap();
    assert!(full.is_exhaustive());
    let partial = Table::parse("a b | out\n0 0 | 1\n", &lvl).unwrap();
    assert!(!partial.is_exhaustive());
    // Column order may differ from the level's port order.
    let swapped = Table::parse("b a | out\n0 1 | 1\n", &lvl).unwrap();
    assert_eq!(
        swapped.rows[0].inputs,
        [("a".to_string(), true), ("b".to_string(), false)]
    );
}
