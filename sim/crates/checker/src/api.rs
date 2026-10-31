//! JSON-in, JSON-out functions for the browser. `s2t-wasm` wraps them 1:1,
//! so all logic stays here where it is tested natively.
//!
//! A *library* is
//! `{"levels": [<level.toml text>...], "unlocked": [<design>...], "fast": [<id>...]}`:
//! every level definition, the designs the learner has passed, and which
//! components currently run as fast models.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use s2t_gate::bits_to_number;
use s2t_netlist::{flatten_preview, Design, Endpoint, FlattenError, Level, Library, Value};
use s2t_switch::{Conduct, Sim};

use crate::gatecheck::prepare;
use crate::{ReportProblem, Table};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LibraryInput {
    levels: Vec<String>,
    #[serde(default)]
    unlocked: Vec<Design>,
    #[serde(default)]
    fast: BTreeSet<String>,
}

fn load_library(json: &str) -> Result<(Library, BTreeSet<String>), String> {
    let input: LibraryInput =
        serde_json::from_str(json).map_err(|e| format!("couldn't read library: {e}"))?;
    let mut lib = Library::new();
    for text in &input.levels {
        lib.add_level(Level::from_toml(text).map_err(|e| e.to_string())?);
    }
    for d in input.unlocked {
        lib.unlock(d);
    }
    Ok((lib, input.fast))
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
    pub inputs: Vec<(String, u64)>,
    pub outputs: Vec<(String, u64)>,
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
    let table = table
        .rows
        .into_iter()
        .map(|r| InfoRow {
            inputs: r.inputs,
            outputs: r.outputs,
        })
        .collect();
    Ok(LevelInfo { level, table })
}

// ---- check -----------------------------------------------------------------------

/// Runs a level's tests. See [`crate::check_with`].
pub fn check(library: &str, level: &str, design: &str) -> Result<crate::Report, String> {
    let (lib, fast) = load_library(library)?;
    let level = find_level(&lib, level)?;
    let design = parse_design(design)?;
    crate::check_with(&level, &design, &lib, &fast).map_err(|e| e.to_string())
}

// ---- live simulation -----------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EndpointValue {
    pub endpoint: Endpoint,
    /// `0`, `1`, `Z`, `X` for single bits; a number (decimal) for a fully
    /// known bus, otherwise its bits, most significant first.
    pub value: String,
    pub width: u32,
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
    /// Top-level transistors only (Layer 1).
    pub transistors: Vec<TransistorState>,
    /// Each short's top-level part ids (Layer 1).
    pub shorts: Vec<Vec<String>>,
    pub outputs: Vec<(String, String)>,
    pub settled: bool,
    /// Gate delays until the outputs settled (Layer 2 and up).
    pub depth: usize,
}

fn bus_text(bits: &[Value]) -> String {
    if bits.len() == 1 {
        return bits[0].to_string();
    }
    match bits_to_number(bits) {
        Some(n) => n.to_string(),
        None => bits.iter().rev().map(|b| b.to_string()).collect(),
    }
}

fn read_inputs(level: &Level, json: &str) -> Result<BTreeMap<String, u64>, String> {
    let inputs: BTreeMap<String, u64> =
        serde_json::from_str(json).map_err(|e| format!("couldn't read inputs: {e}"))?;
    for (name, v) in &inputs {
        let w = level.width(name);
        if w < 64 && v >> w != 0 {
            return Err(if w == 1 {
                "input values must be 0 or 1".to_string()
            } else {
                format!("{v} doesn't fit in input `{name}` ({w} bits)")
            });
        }
    }
    Ok(inputs)
}

/// Simulates a design (finished or not) with the given inputs,
/// `{"a": 1, "b": 0}`. Missing inputs are left floating.
pub fn simulate(library: &str, level: &str, design: &str, inputs: &str) -> Result<SimView, String> {
    let (lib, fast) = load_library(library)?;
    let level = find_level(&lib, level)?;
    let design = parse_design(design)?;
    let inputs = read_inputs(&level, inputs)?;
    let problems: Vec<ReportProblem> = s2t_netlist::validate(&level, &design, &lib)
        .iter()
        .map(ReportProblem::from)
        .collect();
    let view = SimView {
        blocked: true,
        problems,
        values: vec![],
        transistors: vec![],
        shorts: vec![],
        outputs: vec![],
        settled: false,
        depth: 0,
    };
    if level.layer > 1 {
        simulate_gates(&level, &design, &lib, &fast, &inputs, view)
    } else {
        simulate_switches(&level, &design, &lib, &inputs, view)
    }
}

fn simulate_gates(
    level: &Level,
    design: &Design,
    lib: &Library,
    fast: &BTreeSet<String>,
    inputs: &BTreeMap<String, u64>,
    mut view: SimView,
) -> Result<SimView, String> {
    let prepared = match prepare(level, design, lib, fast, true) {
        Ok(p) => p,
        Err(problems) => {
            for p in problems {
                if !view.problems.contains(&p) {
                    view.problems.push(p);
                }
            }
            return Ok(view);
        }
    };
    let mut sim = prepared.sim()?;
    for (name, v) in inputs {
        sim.set_input(name, *v)?;
    }
    let outcome = sim.settle();
    let read = |nets: &[usize]| -> Vec<Value> { nets.iter().map(|n| sim.value(*n)).collect() };
    view.blocked = false;
    view.settled = outcome.settled;
    view.depth = outcome.depth;
    view.values = prepared
        .circuit
        .endpoints
        .iter()
        .map(|(e, nets)| EndpointValue {
            endpoint: e.clone(),
            value: bus_text(&read(nets)),
            width: nets.len() as u32,
        })
        .collect();
    view.outputs = prepared
        .circuit
        .outputs
        .iter()
        .map(|(n, nets)| (n.clone(), bus_text(&read(nets))))
        .collect();
    Ok(view)
}

fn simulate_switches(
    level: &Level,
    design: &Design,
    lib: &Library,
    inputs: &BTreeMap<String, u64>,
    mut view: SimView,
) -> Result<SimView, String> {
    let circuit = match flatten_preview(level, design, lib) {
        Ok(c) => c,
        Err(FlattenError::Invalid { component, .. }) if component == level.id => {
            // Already listed in `view.problems`.
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
    for (name, bit) in inputs {
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
            width: 1,
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
