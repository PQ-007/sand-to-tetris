//! The JSON API the browser uses (wrapped 1:1 by s2t-wasm).

#![allow(clippy::unwrap_used)] // test helpers

use s2t_checker::api::{check, level_info, simulate, simulate_from};

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
    } else if ["srlatch", "dlatch", "dff", "bit", "register"].contains(&id) {
        3
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

fn latch_library() -> String {
    let levels: Vec<String> = ["nor", "srlatch"]
        .iter()
        .map(|id| read(&format!("{}/level.toml", dir(id))))
        .collect();
    let nor: serde_json::Value = serde_json::from_str(&read("layer1/nor/reference.json")).unwrap();
    serde_json::json!({ "levels": levels, "unlocked": [nor] }).to_string()
}

fn q(view: &s2t_checker::api::SimView) -> String {
    view.outputs
        .iter()
        .find(|(n, _)| n == "q")
        .map(|(_, v)| v.clone())
        .unwrap_or_default()
}

#[test]
fn live_simulation_remembers_between_calls() {
    let lib = latch_library();
    let latch = read("layer3/srlatch/reference.json");
    // Set: q becomes 1, and the state lists every gate output it stored.
    let set = simulate_from(&lib, "srlatch", &latch, r#"{"s":1,"r":0}"#, "{}").unwrap();
    assert_eq!(q(&set), "1");
    // q comes from the bottom NOR; the top one holds its opposite.
    assert_eq!(set.state.get("bottom.out").map(String::as_str), Some("1"));
    assert_eq!(set.state.get("top.out").map(String::as_str), Some("0"));
    // Hold, passing the state back: still 1.
    let state = serde_json::to_string(&set.state).unwrap();
    let hold = simulate_from(&lib, "srlatch", &latch, r#"{"s":0,"r":0}"#, &state).unwrap();
    assert_eq!(q(&hold), "1");
    // Without the state it's a fresh circuit: unknown.
    let fresh = simulate(&lib, "srlatch", &latch, r#"{"s":0,"r":0}"#).unwrap();
    assert_eq!(q(&fresh), "X");
    assert!(fresh.state.is_empty());
}

#[test]
fn state_survives_an_unrelated_edit() {
    let lib = latch_library();
    let latch = read("layer3/srlatch/reference.json");
    let set = simulate_from(&lib, "srlatch", &latch, r#"{"s":1,"r":0}"#, "{}").unwrap();
    let state = serde_json::to_string(&set.state).unwrap();
    // Add a spare, unwired NOR: the latch's gates keep their paths.
    let mut edited: serde_json::Value = serde_json::from_str(&latch).unwrap();
    edited["parts"]
        .as_array_mut()
        .unwrap()
        .push(serde_json::json!({"id": "spare", "kind": "nor"}));
    let hold = simulate_from(
        &lib,
        "srlatch",
        &edited.to_string(),
        r#"{"s":0,"r":0}"#,
        &state,
    )
    .unwrap();
    assert_eq!(q(&hold), "1");
}

#[test]
fn bad_state_is_an_error_not_a_crash() {
    let lib = latch_library();
    let latch = read("layer3/srlatch/reference.json");
    let err = simulate_from(&lib, "srlatch", &latch, r#"{"s":0,"r":0}"#, "[1,2]").unwrap_err();
    assert!(err.contains("state"), "{err}");
}

#[test]
fn a_fast_memory_part_remembers_in_live_simulation() {
    // Register2 = one Register part running as its fast model.
    let reg = read("layer3/register/level.toml");
    let reg2 = reg
        .replace("id = \"register\"", "id = \"register2\"")
        .replace("requires = [\"bit\"]", "requires = [\"register\"]");
    let reference: serde_json::Value =
        serde_json::from_str(&read("layer3/register/reference.json")).unwrap();
    let lib = serde_json::json!({
        "levels": [reg, reg2],
        "unlocked": [reference],
        "fast": ["register"],
    })
    .to_string();
    let design = r#"{"format":1,"component":"register2","parts":[{"id":"r","kind":"register"}],"wires":[
        {"from":{"port":"d"},"to":{"part":"r","pin":"d"}},
        {"from":{"port":"load"},"to":{"part":"r","pin":"load"}},
        {"from":{"port":"clk"},"to":{"part":"r","pin":"clk"}},
        {"from":{"part":"r","pin":"q"},"to":{"port":"q"}}]}"#;
    let low = simulate_from(
        &lib,
        "register2",
        design,
        r#"{"d":42,"load":1,"clk":0}"#,
        "{}",
    )
    .unwrap();
    assert!(!low.blocked, "{:#?}", low.problems);
    let s1 = serde_json::to_string(&low.state).unwrap();
    let high = simulate_from(
        &lib,
        "register2",
        design,
        r#"{"d":42,"load":1,"clk":1}"#,
        &s1,
    )
    .unwrap();
    assert_eq!(q(&high), "42");
    assert_eq!(high.state.get("r#mem").map(String::as_str), Some("1,0:2a"));
    // Change d with no edge: the stored 42 stays.
    let s2 = serde_json::to_string(&high.state).unwrap();
    let hold = simulate_from(
        &lib,
        "register2",
        design,
        r#"{"d":7,"load":1,"clk":1}"#,
        &s2,
    )
    .unwrap();
    assert_eq!(q(&hold), "42");
}

#[test]
fn a_sequence_of_steps_runs_in_one_call() {
    use s2t_checker::api::simulate_steps;
    let lib = latch_library();
    let latch = read("layer3/srlatch/reference.json");
    let steps = r#"[{"s":0,"r":0},{"s":1,"r":0},{"s":0,"r":0},{"s":0,"r":1}]"#;
    let run = simulate_steps(&lib, "srlatch", &latch, steps, "{}").unwrap();
    let q_of = |outs: &Vec<(String, String)>| outs[0].1.clone();
    let qs: Vec<String> = run.outputs.iter().map(q_of).collect();
    assert_eq!(qs, ["X", "1", "1", "0"]);
    // The view is the circuit after the last step, ready to draw.
    assert_eq!(q(&run.view), "0");
    // Continuing from its state: still 0 on hold.
    let state = serde_json::to_string(&run.view.state).unwrap();
    let more = simulate_steps(&lib, "srlatch", &latch, r#"[{"s":0,"r":0}]"#, &state).unwrap();
    assert_eq!(q(&more.view), "0");
    assert!(simulate_steps(&lib, "srlatch", &latch, "[]", "{}").is_err());
}
