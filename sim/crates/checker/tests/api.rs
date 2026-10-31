//! The JSON API the browser uses (wrapped 1:1 by s2t-wasm).

#![allow(clippy::unwrap_used)] // test helpers

use s2t_checker::api::{check, level_info, simulate};

fn read(rel: &str) -> String {
    std::fs::read_to_string(format!(
        "{}/../../../hdl/levels/{rel}",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

/// Where a level lives: `layer1/not`, `layer2/and`, ...
fn dir(id: &str) -> String {
    let layer = if ["not", "nand", "nor", "zero", "one"].contains(&id) {
        1
    } else {
        2
    };
    format!("layer{layer}/{id}")
}

fn library(unlocked: &[&str]) -> String {
    let levels: Vec<String> = ["not", "nand", "nor", "and"]
        .iter()
        .map(|id| read(&format!("{}/level.toml", dir(id))))
        .collect();
    let designs: Vec<serde_json::Value> = unlocked
        .iter()
        .map(|id| serde_json::from_str(&read(&format!("{}/reference.json", dir(id)))).unwrap())
        .collect();
    serde_json::json!({ "levels": levels, "unlocked": designs }).to_string()
}

#[test]
fn level_info_includes_the_parsed_table() {
    let info = level_info(&read("layer1/nand/level.toml")).unwrap();
    assert_eq!(info.level.id, "nand");
    assert_eq!(info.level.requires, ["not"]);
    assert_eq!(info.table.len(), 4);
    assert_eq!(info.table[3].inputs, [("a".into(), 1), ("b".into(), 1)]);
    assert_eq!(info.table[3].outputs, [("out".into(), 0)]);
    let err = level_info("id = 3").unwrap_err();
    assert!(err.starts_with("couldn't read level"), "{err}");
}

#[test]
fn simulate_labels_every_visible_pin_and_transistor() {
    let view = simulate(
        &library(&[]),
        "not",
        &read("layer1/not/reference.json"),
        r#"{"a": 1}"#,
    )
    .unwrap();
    assert!(!view.blocked);
    let value = |name: &str| {
        view.values
            .iter()
            .find(|v| v.endpoint.to_string() == name)
            .map(|v| v.value.clone())
            .unwrap()
    };
    assert_eq!(value("port `out`"), "0");
    assert_eq!(value("`p1.drain`"), "0");
    assert_eq!(value("`p1.gate`"), "1");
    assert_eq!(value("`v.out`"), "1");
    let state = |id: &str| {
        view.transistors
            .iter()
            .find(|t| t.part == id)
            .unwrap()
            .state
    };
    assert_eq!(state("n1"), "on");
    assert_eq!(state("p1"), "off");
    assert_eq!(view.outputs, [("out".to_string(), "0".to_string())]);
}

#[test]
fn simulate_shows_unfinished_designs_and_shorts() {
    // Two NMOS (one where the PMOS should be): a = 1 shorts VDD to GND.
    let design =
        read("layer1/not/reference.json").replace(r#""kind": "pmos""#, r#""kind": "nmos""#);
    let view = simulate(&library(&[]), "not", &design, r#"{"a": 1}"#).unwrap();
    assert_eq!(view.shorts, [vec!["g", "n1", "p1", "v"]]);
    // Nothing wired to the output yet: still simulates.
    let unfinished =
        r#"{"format":1,"component":"not","parts":[{"id":"v","kind":"vdd"}],"wires":[]}"#;
    let view = simulate(&library(&[]), "not", unfinished, r#"{"a": 0}"#).unwrap();
    assert!(!view.blocked);
    assert_eq!(view.outputs, [("out".to_string(), "Z".to_string())]);
    assert_eq!(
        view.problems[0].message,
        "output `out` isn't connected to anything"
    );
}

#[test]
fn simulate_is_blocked_by_unusable_parts() {
    let locked = r#"{"format":1,"component":"and","parts":[{"id":"x","kind":"nand"}],"wires":[]}"#;
    let view = simulate(&library(&[]), "and", locked, "{}").unwrap();
    assert!(view.blocked);
    assert!(
        view.problems[0].message.contains("haven't unlocked"),
        "{:?}",
        view.problems
    );
}

#[test]
fn check_runs_the_level() {
    let report = check(
        &library(&["nand", "not"]),
        "and",
        &read("layer2/and/reference.json"),
    )
    .unwrap();
    assert!(report.passed);
    assert_eq!((report.cells, report.depth), (2, 2));
}

#[test]
fn bad_input_gives_a_readable_error() {
    assert!(check(&library(&[]), "zzz", "{}")
        .unwrap_err()
        .contains("no level `zzz`"));
    assert!(check("not json", "not", "{}")
        .unwrap_err()
        .starts_with("couldn't read library"));
    assert!(simulate(
        &library(&[]),
        "not",
        &read("layer1/not/reference.json"),
        r#"{"a": 7}"#
    )
    .unwrap_err()
    .contains("input values must be 0 or 1"));
}

#[test]
fn simulate_layer_2_reports_bus_values_and_depth() {
    let not16 = "id='not16'\nname='NOT16'\nlayer=2\ngoal=''\ninputs=['a']\noutputs=['out']\nwidths={a=16,out=16}\ntruth_table='''\na | out\n0 | 0xffff\n'''";
    let mut levels: Vec<String> = ["not", "nand"]
        .iter()
        .map(|id| read(&format!("layer1/{id}/level.toml")))
        .collect();
    levels.push(not16.to_string());
    let not: serde_json::Value = serde_json::from_str(&read("layer1/not/reference.json")).unwrap();
    let lib = serde_json::json!({ "levels": levels, "unlocked": [not] }).to_string();
    let d = r#"{"format":1,"component":"not16","parts":[{"id":"n","kind":"not","repeat":16}],
        "wires":[{"from":{"port":"a"},"to":{"part":"n","pin":"a"}},{"from":{"part":"n","pin":"out"},"to":{"port":"out"}}]}"#;
    let view = simulate(&lib, "not16", d, r#"{"a": 1}"#).unwrap();
    assert!(!view.blocked, "{:?}", view.problems);
    assert_eq!(view.outputs, [("out".to_string(), "65534".to_string())]);
    assert_eq!(view.depth, 1);
    let a = view
        .values
        .iter()
        .find(|v| v.endpoint.to_string() == "port `a`")
        .unwrap();
    assert_eq!((a.value.as_str(), a.width), ("1", 16));
    assert!(simulate(&lib, "not16", d, r#"{"a": 70000}"#)
        .unwrap_err()
        .contains("doesn't fit in input `a` (16 bits)"));
}
