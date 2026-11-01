//! The JavaScript-facing API of the simulator core: thin wrappers over
//! `s2t_checker::api`, exchanging JSON strings. Errors become JS exceptions
//! carrying the same plain-language message.

use serde::Serialize;
use wasm_bindgen::prelude::*;

use s2t_checker::api;

/// Identifies the loaded core, e.g. `"0.1.0 (format 1)"`. The site shows
/// it so a stale WASM build is easy to spot.
#[wasm_bindgen(js_name = coreVersion)]
pub fn core_version() -> String {
    format!(
        "{} (format {})",
        env!("CARGO_PKG_VERSION"),
        s2t_netlist::FORMAT_VERSION
    )
}

fn to_json<T: Serialize>(result: Result<T, String>) -> Result<String, String> {
    result.and_then(|v| serde_json::to_string(&v).map_err(|e| e.to_string()))
}

fn js(result: Result<String, String>) -> Result<String, JsError> {
    result.map_err(|e| JsError::new(&e))
}

/// Parses a level definition (TOML) → `LevelInfo` JSON.
#[wasm_bindgen(js_name = levelInfo)]
pub fn level_info(toml: &str) -> Result<String, JsError> {
    js(to_json(api::level_info(toml)))
}

/// Runs a level's tests → `Report` JSON.
#[wasm_bindgen]
pub fn check(library: &str, level: &str, design: &str) -> Result<String, JsError> {
    js(to_json(api::check(library, level, design)))
}

/// Live simulation of a (possibly unfinished) design → `SimView` JSON,
/// continuing from `state` (the previous view's `state`, or `{}`).
#[wasm_bindgen]
pub fn simulate(
    library: &str,
    level: &str,
    design: &str,
    inputs: &str,
    state: &str,
) -> Result<String, JsError> {
    js(to_json(api::simulate_from(
        library, level, design, inputs, state,
    )))
}

/// Runs a sequence of input steps on one circuit, continuing from `state`
/// → `StepsView` JSON (the view after the last step, and each step's
/// outputs).
#[wasm_bindgen(js_name = simulateSteps)]
pub fn simulate_steps(
    library: &str,
    level: &str,
    design: &str,
    steps: &str,
    state: &str,
) -> Result<String, JsError> {
    js(to_json(api::simulate_steps(
        library, level, design, steps, state,
    )))
}

/// Compares the learner's design of a component with its fast model →
/// `MatchReport` JSON. The swap is allowed only if `ok`.
#[wasm_bindgen(js_name = matchCheck)]
pub fn match_check(library: &str, component: &str) -> Result<String, JsError> {
    js(to_json(api::match_check(library, component)))
}

/// An instruction word as assembly, e.g. `SET r1, 5` (docs/ISA.md).
/// Every 16-bit word is an instruction, so this never fails.
#[wasm_bindgen]
pub fn disassemble(word: u16) -> String {
    s2t_isa::decode(word).to_string()
}

/// Runs a program on the reference CPU (s2t-isa) from reset, for the
/// chapter's CPU demo. `rom` is a JSON array of words → JSON
/// `{"states": [..], "writes": [..]}`: `states[0]` is the CPU after reset
/// (registers and flags start at 0), `states[i + 1]` after instruction i;
/// `writes[i]` is `[address, value]` if instruction i stored a word, else null.
#[wasm_bindgen(js_name = isaTrace)]
pub fn isa_trace(rom: &str, steps: usize) -> Result<String, JsError> {
    let rom: Vec<u16> = serde_json::from_str(rom).map_err(|e| JsError::new(&e.to_string()))?;
    let (states, writes): (Vec<_>, Vec<_>) = s2t_isa::trace(&rom, steps.min(10_000))
        .into_iter()
        .map(|(c, w)| {
            let state = serde_json::json!({
                "pc": c.pc, "regs": c.regs, "z": c.flags.z, "n": c.flags.n, "c": c.flags.c
            });
            (state, w.map(|(a, v)| [a, v]))
        })
        .unzip();
    // The first entry is the start state, which stored nothing.
    Ok(serde_json::json!({ "states": states, "writes": &writes[1..] }).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn traces_a_program() {
        // SET r1, 5; STORE r1, [r1 + 0]; JMP 0
        let out = isa_trace("[17413, 42112, 49152]", 3).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["states"][1]["regs"][1], 5);
        assert_eq!(v["writes"][1], serde_json::json!([5, 5]));
        assert_eq!(v["states"][3]["pc"], 2);
    }

    #[test]
    fn disassembles_any_word() {
        assert_eq!(disassemble(0x4405), "SET r1, 5");
        assert_eq!(disassemble(0xf700), "RET");
        assert_eq!(disassemble(0xc000), "JMP 0");
    }

    #[test]
    fn core_version_names_crate_and_format() {
        assert_eq!(core_version(), "0.1.0 (format 1)");
    }

    #[test]
    fn json_wrappers_pass_errors_through() {
        let lib = r#"{"levels":[]}"#;
        assert_eq!(
            to_json(api::check(lib, "x", "{}")),
            Err("no level `x` in the library".to_string())
        );
    }
}
