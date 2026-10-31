//! JSON-in, JSON-out functions for the browser. `s2t-wasm` wraps them 1:1,
//! so all logic stays here where it is tested natively.
//!
//! A *library* is `{"levels": [<level.toml text>...], "unlocked": [<design>...]}`:
//! every level definition, plus the designs the learner has passed.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use s2t_netlist::{flatten_preview, Design, Endpoint, FlattenError, Level, Library};
use s2t_switch::{Conduct, Sim, Value};

use crate::{ReportProblem, Table};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LibraryInput {
    levels: Vec<String>,
    #[serde(default)]
    unlocked: Vec<Design>,
}

fn load_library(json: &str) -> Result<Library, String> {
    let input: LibraryInput =
        serde_json::from_str(json).map_err(|e| format!("couldn't read library: {e}"))?;
    let mut lib = Library::new();
    for text in &input.levels {
        lib.add_level(Level::from_toml(text).map_err(|e| e.to_string())?);
    }
    for d in input.unlocked {
        lib.unlock(d);
    }
    Ok(lib)
}

fn find_level(lib: &Library, id: &str) -> Result<Level, String> {
    lib.level(id)
        .cloned()
        .ok_or_else(|| format!("no level `{id}` in the library"))
}

fn parse_design(json: &str) -> Result<Design, String> {
    Design::from_json(json).map_err(|e| e.to_string())
}

// ---- level info -------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct InfoRow {
    pub inputs: Vec<(String, u8)>,
    pub outputs: Vec<(String, u8)>,
}

#[derive(Debug, Serialize)]
pub struct LevelInfo {
    pub level: Level,
    pub table: Vec<InfoRow>,
}

/// Parses a level definition, including its truth table.
pub fn level_info(toml: &str) -> Result<LevelInfo, String> {
    let level = Level::from_toml(toml).map_err(|e| e.to_string())?;
    let table = Table::parse(&level.truth_table, &level).map_err(|e| e.to_string())?;
    let bits = |v: &[(String, bool)]| v.iter().map(|(k, b)| (k.clone(), u8::from(*b))).collect();
    let table = table
        .rows
        .iter()
        .map(|r| InfoRow {
            inputs: bits(&r.inputs),
            outputs: bits(&r.outputs),
        })
        .collect();
    Ok(LevelInfo { level, table })
}

// ---- check -----------------------------------------------------------------------

/// Runs a level's tests. See [`crate::check`].
pub fn check(library: &str, level: &str, design: &str) -> Result<crate::Report, String> {
    let lib = load_library(library)?;
    let level = find_level(&lib, level)?;
    let design = parse_design(design)?;
    crate::check(&level, &design, &lib).map_err(|e| e.to_string())
}

// ---- live simulation -----------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EndpointValue {
    pub endpoint: Endpoint,
    pub value: String,
}

#[derive(Debug, Serialize)]
pub struct TransistorState {
    pub part: String,
    /// `"on"`, `"off"` or `"maybe"`.
    pub state: &'static str,
}

#[derive(Debug, Serialize)]
pub struct SimView {
    /// True if the design can't be simulated yet (see `problems`).
    pub blocked: bool,
    pub problems: Vec<ReportProblem>,
    /// Value at every port and top-level part pin.
    pub values: Vec<EndpointValue>,
    /// Top-level transistors only.
    pub transistors: Vec<TransistorState>,
    /// Each short's top-level part ids.
    pub shorts: Vec<Vec<String>>,
    pub outputs: Vec<(String, String)>,
    pub settled: bool,
}

/// Simulates a design (finished or not) with the given inputs,
/// `{"a": 1, "b": 0}`. Missing inputs are left floating.
pub fn simulate(library: &str, level: &str, design: &str, inputs: &str) -> Result<SimView, String> {
    let lib = load_library(library)?;
    let level = find_level(&lib, level)?;
    let design = parse_design(design)?;
    let inputs: BTreeMap<String, u8> =
        serde_json::from_str(inputs).map_err(|e| format!("couldn't read inputs: {e}"))?;
    if inputs.values().any(|v| *v > 1) {
        return Err("input values must be 0 or 1".into());
    }
    let problems: Vec<ReportProblem> = s2t_netlist::validate(&level, &design, &lib)
        .iter()
        .map(ReportProblem::from)
        .collect();
    let mut view = SimView {
        blocked: true,
        problems,
        values: vec![],
        transistors: vec![],
        shorts: vec![],
        outputs: vec![],
        settled: false,
    };
    let circuit = match flatten_preview(&level, &design, &lib) {
        Ok(c) => c,
        Err(FlattenError::Invalid {
            component,
            problems,
        }) if component == level.id => {
            // Already listed in `view.problems`.
            let _ = problems;
            return Ok(view);
        }
        Err(e) => {
            view.problems.push(ReportProblem {
                severity: "error",
                message: format!("a component inside this design is broken: {e}"),
                parts: vec![],
                ports: vec![],
            });
            return Ok(view);
        }
    };
    let mut sim = Sim::new(&circuit);
    for (name, bit) in &inputs {
        sim.set_input(name, Value::from_bit(*bit == 1))
            .map_err(|e| e.to_string())?;
    }
    let outcome = sim.settle();
    view.blocked = false;
    view.settled = outcome.settled;
    view.values = circuit
        .endpoints
        .iter()
        .map(|(e, net)| EndpointValue {
            endpoint: e.clone(),
            value: sim.value(*net).to_string(),
        })
        .collect();
    view.transistors = circuit
        .transistors
        .iter()
        .enumerate()
        .filter(|(_, t)| t.path.len() == 1)
        .map(|(i, t)| TransistorState {
            part: t.path[0].clone(),
            state: match sim.conduction(i) {
                Conduct::On => "on",
                Conduct::Off => "off",
                Conduct::Maybe => "maybe",
            },
        })
        .collect();
    view.shorts = outcome
        .shorts
        .iter()
        .map(|s| {
            let mut parts: Vec<String> = s
                .transistors
                .iter()
                .map(|&t| &circuit.transistors[t].path)
                .chain(s.rails.iter().map(|&r| &circuit.rails[r].path))
                .filter_map(|p| p.first().cloned())
                .collect();
            parts.sort();
            parts.dedup();
            parts
        })
        .collect();
    view.outputs = circuit
        .outputs
        .iter()
        .map(|(n, net)| (n.clone(), sim.value(*net).to_string()))
        .collect();
    Ok(view)
}
