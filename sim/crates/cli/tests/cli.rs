//! End-to-end: the real level files in hdl/levels.

use std::path::PathBuf;

use s2t_cli::run;

fn levels() -> String {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../hdl/levels")
        .to_string_lossy()
        .into_owned()
}

fn args(a: &[&str]) -> Vec<String> {
    a.iter().map(|s| s.to_string()).collect()
}

#[test]
fn every_reference_solution_passes_its_level() {
    let out = run(&args(&["check-all", &levels()]));
    assert!(out.is_ok(), "{}", out.unwrap_or_else(|e| e));
    let text = out.unwrap_or_default();
    for id in [
        "not",
        "nand",
        "nor",
        "zero",
        "one",
        "and",
        "or",
        "xor",
        "mux",
        "dmux",
        "not16",
        "and16",
        "or16",
        "mux16",
        "or8way",
        "mux4way16",
        "halfadder",
        "fulladder",
        "add16",
        "inc16",
        "xor16",
        "addc16",
        "alu",
        "srlatch",
        "dlatch",
        "dff",
        "bit",
        "register",
    ] {
        assert!(text.contains(&format!("✓ {id} ")), "{text}");
    }
}

/// Checks a design (as JSON) against a real level; the CLI's output text.
fn check_design(level: &str, json: &str) -> String {
    let file = std::env::temp_dir().join(format!(
        "s2t-{}-{}-{:?}.json",
        level.replace('/', "-"),
        std::process::id(),
        std::thread::current().id()
    ));
    std::fs::write(&file, json).unwrap_or_default();
    let dir = format!("{}/{level}", levels());
    let out = run(&args(&["check", &dir, &file.to_string_lossy()])).unwrap_or_else(|e| e);
    let _ = std::fs::remove_file(&file);
    out
}

#[test]
fn sequential_levels_count_steps() {
    let dir = format!("{}/layer3/dff", levels());
    let out = run(&args(&["check", &dir])).unwrap_or_else(|e| e);
    assert_eq!(
        out,
        "✓ dff (Layer 3): all 12 steps pass, 15 gates, 6 gate delays deep"
    );
}

#[test]
fn a_d_latch_is_not_a_flip_flop() {
    // One D latch enabled by clk: transparent while clk is 1.
    let out = check_design(
        "layer3/dff",
        r#"{"format":1,"component":"dff","parts":[{"id":"l","kind":"dlatch"}],"wires":[
            {"from":{"port":"d"},"to":{"part":"l","pin":"d"}},
            {"from":{"port":"clk"},"to":{"part":"l","pin":"en"}},
            {"from":{"part":"l","pin":"q"},"to":{"port":"q"}}]}"#,
    );
    assert!(out.starts_with("✗ dff (Layer 3): "), "{out}");
    assert!(out.contains("steps fail"), "{out}");
    assert!(
        out.contains("Step 3 (after steps 1–2): d=0 clk=1 → expected q=1, got q=0."),
        "{out}"
    );
    assert!(
        out.contains("hint: If q changes while clk stays 1"),
        "{out}"
    );
}

#[test]
fn a_bit_must_keep_its_value_without_load() {
    // A flip-flop straight from d: it loads on every edge.
    let out = check_design(
        "layer3/bit",
        r#"{"format":1,"component":"bit","parts":[{"id":"f","kind":"dff"}],"wires":[
            {"from":{"port":"d"},"to":{"part":"f","pin":"d"}},
            {"from":{"port":"clk"},"to":{"part":"f","pin":"clk"}},
            {"from":{"part":"f","pin":"q"},"to":{"port":"q"}}]}"#,
    );
    assert!(
        out.contains("Step 4 (after steps 1–3): d=0 load=0 clk=1 → expected q=1, got q=0."),
        "{out}"
    );
}

#[test]
fn check_one_level_reports_rows_and_transistors() {
    let dir = format!("{}/layer1/nand", levels());
    let out = run(&args(&["check", &dir])).unwrap_or_else(|e| e);
    assert_eq!(out, "✓ nand (Layer 1): all 4 rows pass, 4 transistors");
}

#[test]
fn layer_2_reports_gates_and_depth() {
    let dir = format!("{}/layer2/and", levels());
    let out = run(&args(&["check", &dir])).unwrap_or_else(|e| e);
    // NAND then NOT: 2 gates, 2 gate delays.
    assert_eq!(
        out,
        "✓ and (Layer 2): all 4 rows pass, 2 gates, 2 gate delays deep"
    );
}

#[test]
fn ripple_carry_is_deep() {
    // ADD16 from full adders: the carry ripples through every column.
    let dir = format!("{}/layer2/add16", levels());
    let out = run(&args(&["check", &dir])).unwrap_or_else(|e| e);
    assert!(
        out.starts_with("✓ add16 (Layer 2): all 5 rows + 2000 random tests pass"),
        "{out}"
    );
    let depth: usize = out
        .rsplit(", ")
        .next()
        .and_then(|t| t.split(' ').next())
        .and_then(|n| n.parse().ok())
        .unwrap_or(0);
    assert!(depth > 30, "{out}");
}

#[test]
fn a_broken_design_fails_with_explanations() {
    // The NOT reference used for NOR: wrong component.
    let dir = format!("{}/layer1/nor", levels());
    let design = format!("{}/layer1/not/reference.json", levels());
    let err = run(&args(&["check", &dir, &design])).unwrap_err();
    assert!(
        err.starts_with("✗ nor (Layer 1): the design has errors"),
        "{err}"
    );
    assert!(
        err.contains("error: this design is for `not`, but the level is `nor`"),
        "{err}"
    );
}

#[test]
fn json_output_for_tools() {
    let dir = format!("{}/layer1/not", levels());
    let out = run(&args(&["check", &dir, "--json"])).unwrap_or_else(|e| e);
    assert!(out.contains(r#""passed": true"#), "{out}");
}

#[test]
fn helpful_usage_errors() {
    assert!(run(&args(&[])).unwrap_err().contains("usage:"));
    assert!(run(&args(&["frobnicate"]))
        .unwrap_err()
        .contains("unknown command `frobnicate`"));
    let err = run(&args(&["check", "/no/such/level"])).unwrap_err();
    assert!(err.contains("/no/such/level/level.toml"), "{err}");
}
