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
        "dmux4way",
        "dmux8way",
        "mux8way16",
        "ram8",
        "ram64",
        "ram512",
        "ram4k",
        "pc",
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
fn ram_must_use_every_address_bit() {
    // One RAM8 on the low 3 address bits: addresses 1 and 9 land on the
    // same word, so writing 1 overwrites what was stored at 9.
    let out = check_design(
        "layer3/ram64",
        r#"{"format":1,"component":"ram64","parts":[
            {"id":"s","kind":"split","width":6},{"id":"lo","kind":"join","width":3},
            {"id":"m","kind":"ram8"}],"wires":[
            {"from":{"port":"addr"},"to":{"part":"s","pin":"in"}},
            {"from":{"part":"s","pin":"0"},"to":{"part":"lo","pin":"0"}},
            {"from":{"part":"s","pin":"1"},"to":{"part":"lo","pin":"1"}},
            {"from":{"part":"s","pin":"2"},"to":{"part":"lo","pin":"2"}},
            {"from":{"part":"lo","pin":"out"},"to":{"part":"m","pin":"addr"}},
            {"from":{"port":"d"},"to":{"part":"m","pin":"d"}},
            {"from":{"port":"load"},"to":{"part":"m","pin":"load"}},
            {"from":{"port":"clk"},"to":{"part":"m","pin":"clk"}},
            {"from":{"part":"m","pin":"q"},"to":{"port":"q"}}]}"#,
    );
    assert!(out.starts_with("✗ ram64 (Layer 3): "), "{out}");
    assert!(out.contains("Step 12 (after steps 1–11): "), "{out}");
    assert!(out.contains("random steps fail"), "{out}");
}

#[test]
fn the_program_counter_obeys_reset_first() {
    // Reset's multiplexer before load's: count → clear → jump → register,
    // so a load beats a reset.
    let text = std::fs::read_to_string(format!("{}/layer3/pc/reference.json", levels()))
        .unwrap_or_default();
    let mut design: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
    let rewire = |from: (&str, &str), to: (&str, &str)| serde_json::json!({"from": {"part": from.0, "pin": from.1}, "to": {"part": to.0, "pin": to.1}});
    if let Some(wires) = design["wires"].as_array_mut() {
        wires.retain(|w| {
            let f = (&w["from"]["part"], &w["to"]["part"]);
            !matches!(
                (f.0.as_str(), f.1.as_str()),
                (Some("count"), Some("jump"))
                    | (Some("jump"), Some("clear"))
                    | (Some("clear"), Some("reg"))
            )
        });
        wires.push(rewire(("count", "out"), ("clear", "a")));
        wires.push(rewire(("clear", "out"), ("jump", "a")));
        wires.push(rewire(("jump", "out"), ("reg", "d")));
    }
    let reference = design.to_string();
    let out = check_design("layer3/pc", &reference);
    assert!(
        out.contains("Step 14 (after steps 1–13): d=0x0005 load=1 inc=0 reset=1 clk=1 → expected q=0x0000, got q=0x0005."),
        "{out}"
    );
    assert!(
        out.contains("hint: The priority is reset, then load, then inc."),
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

#[test]
fn assembles_a_file_into_a_listing_or_json() {
    let dir = std::env::temp_dir().join(format!("s2t-asm-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let good = dir.join("sum.s");
    std::fs::write(&good, "SET r0, 0\nloop: ADDI r0, 1\nJMP loop\n").unwrap();
    let out = run(&args(&["asm", good.to_str().unwrap()])).unwrap();
    assert!(out.contains("0000  4000  1: SET r0, 0"), "{out}");
    assert!(out.contains("0002  c3ff  3: JMP loop"), "{out}");
    let json = run(&args(&["asm", good.to_str().unwrap(), "--json"])).unwrap();
    assert!(json.contains("\"code\":[16384,"), "{json}");
    let bad = dir.join("bad.s");
    std::fs::write(&bad, "SET r1, 300\nFOO\n").unwrap();
    let err = run(&args(&["asm", bad.to_str().unwrap()])).unwrap_err();
    assert!(err.contains("line 1: n = 300 doesn't fit"), "{err}");
    assert!(err.contains("line 2: `FOO` isn't an instruction"), "{err}");
}

#[test]
fn translates_a_vm_file_into_assembly() {
    let dir = std::env::temp_dir().join(format!("s2t-vm-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let good = dir.join("add.vm");
    std::fs::write(&good, "func main 0 0\npush 2\npush 3\nadd\nreturn\n").unwrap();
    let out = run(&args(&["vm", good.to_str().unwrap()])).unwrap();
    assert!(out.contains("; 4: add\n"), "{out}");
    assert!(out.contains("ADD r0, r0, r1"), "{out}");
    assert!(out.starts_with("        SET16 r6, 0x4000"), "{out}");
    let json = run(&args(&["vm", good.to_str().unwrap(), "--json"])).unwrap();
    assert!(json.contains("\"sourceMap\":[0,"), "{json}");
    let bad = dir.join("bad.vm");
    std::fs::write(&bad, "push 1\nfunc main 0 0\nfrob\n").unwrap();
    let err = run(&args(&["vm", bad.to_str().unwrap()])).unwrap_err();
    assert!(
        err.contains("line 1: commands belong inside a function"),
        "{err}"
    );
    assert!(err.contains("line 3: unknown command frob"), "{err}");
}
