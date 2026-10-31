//! The match check that must pass before a component may run as its fast
//! model: exhaustive up to 16 input bits, otherwise 10,000 random inputs.

#![allow(clippy::unwrap_used)] // test helpers

use s2t_checker::api::match_check;

fn read(rel: &str) -> String {
    std::fs::read_to_string(format!(
        "{}/../../../hdl/levels/{rel}",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

fn dir(id: &str) -> String {
    let layer = if ["not", "nand", "nor", "zero", "one"].contains(&id) {
        1
    } else {
        2
    };
    format!("layer{layer}/{id}")
}

const ALL: [&str; 9] = [
    "not",
    "nand",
    "nor",
    "zero",
    "and",
    "halfadder",
    "xor",
    "or",
    "fulladder",
];

fn library(unlocked: &[&str], replace: Option<(&str, String)>) -> String {
    let mut ids: Vec<&str> = ALL.to_vec();
    ids.extend(["not16", "add16"]);
    let levels: Vec<String> = ids
        .iter()
        .map(|id| read(&format!("{}/level.toml", dir(id))))
        .collect();
    let designs: Vec<serde_json::Value> = unlocked
        .iter()
        .map(|id| {
            let text = match &replace {
                Some((r, d)) if r == id => d.clone(),
                _ => read(&format!("{}/reference.json", dir(id))),
            };
            serde_json::from_str(&text).unwrap()
        })
        .collect();
    serde_json::json!({ "levels": levels, "unlocked": designs }).to_string()
}

#[test]
fn small_components_are_compared_on_every_input() {
    let r = match_check(&library(&["not", "nand", "and"], None), "and").unwrap();
    assert!(r.ok && r.exhaustive);
    assert_eq!(r.compared, 4);
}

#[test]
fn sixteen_input_bits_is_still_exhaustive() {
    let r = match_check(&library(&["not", "not16"], None), "not16").unwrap();
    assert!(r.ok && r.exhaustive);
    assert_eq!(r.compared, 65536);
}

#[test]
fn wide_components_get_10000_random_inputs() {
    let lib = library(
        &ALL.iter().chain(&["add16"]).copied().collect::<Vec<_>>(),
        None,
    );
    let r = match_check(&lib, "add16").unwrap();
    assert!(r.ok, "{r:?}");
    assert!(!r.exhaustive);
    assert_eq!(r.compared, 10_000);
}

#[test]
fn a_mismatch_blocks_the_swap_and_shows_examples() {
    // An "and" that is really just a NAND.
    let fake = r#"{"format":1,"component":"and","parts":[{"id":"x","kind":"nand"}],"wires":[
        {"from":{"port":"a"},"to":{"part":"x","pin":"a"}},{"from":{"port":"b"},"to":{"part":"x","pin":"b"}},
        {"from":{"part":"x","pin":"out"},"to":{"port":"out"}}]}"#;
    let r = match_check(
        &library(&["not", "nand", "and"], Some(("and", fake.into()))),
        "and",
    )
    .unwrap();
    assert!(!r.ok);
    assert_eq!(r.mismatches.len(), 4);
    let m = &r.mismatches[0];
    assert_eq!(
        m.inputs,
        [
            ("a".to_string(), "0".to_string()),
            ("b".to_string(), "0".to_string())
        ]
    );
    assert_eq!(
        (m.expected[0].1.as_str(), m.actual[0].1.as_str()),
        ("0", "1")
    );
}

#[test]
fn layer_1_gates_and_locked_components_are_refused() {
    let lib = library(&["not", "nand"], None);
    assert!(match_check(&lib, "nand")
        .unwrap_err()
        .contains("Layer 1 gates always run as their truth tables"));
    assert!(match_check(&lib, "and")
        .unwrap_err()
        .contains("isn't unlocked"));
}
