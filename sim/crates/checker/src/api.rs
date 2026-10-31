//! JSON-in, JSON-out functions for the browser. `s2t-wasm` wraps them 1:1,
//! so all logic stays here where it is tested natively.
//!
//! A *library* is
//! `{"levels": [<level.toml text>...], "unlocked": [<design>...], "fast": [<id>...]}`:
//! every level definition, the designs the learner has passed, and which
//! components currently run as fast models.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use s2t_gate::{bits_to_number, GateSim};
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
    /// Outputs written `-` (any value is fine) in a sequential level.
    pub skip: Vec<String>,
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
            skip: r.skip,
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

#[derive(Debug, Clone, Serialize)]
pub struct EndpointValue {
    pub endpoint: Endpoint,
    /// `0`, `1`, `Z`, `X` for single bits; a number (decimal) for a fully
    /// known bus, otherwise its bits, most significant first.
    pub value: String,
    pub width: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct TransistorState {
    pub part: String,
    /// `"on"`, `"off"` or `"maybe"`.
    pub state: &'static str,
}

#[derive(Debug, Clone, Serialize)]
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
    /// Leaf cells simulated (Layer 2 and up): how big the circuit runs.
    pub cells: usize,
    /// What every gate output holds after this run (known bits only), keyed
    /// by the gate's path, e.g. `ff/master/latch/top.out`. Pass it to the
    /// next [`simulate_from`] so latches and flip-flops remember. Keyed by
    /// path rather than net number, it survives unrelated edits.
    pub state: BTreeMap<String, String>,
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
/// `{"a": 1, "b": 0}`, from power-on (every stored bit unknown). Missing
/// inputs are left floating.
pub fn simulate(library: &str, level: &str, design: &str, inputs: &str) -> Result<SimView, String> {
    simulate_from(library, level, design, inputs, "{}")
}

/// Like [`simulate`], continuing from `state` (a previous run's
/// [`SimView::state`] as JSON), so the circuit remembers what it stored.
pub fn simulate_from(
    library: &str,
    level: &str,
    design: &str,
    inputs: &str,
    state: &str,
) -> Result<SimView, String> {
    let steps = format!("[{inputs}]");
    simulate_steps(library, level, design, &steps, state).map(|run| run.view)
}

#[derive(Debug, Serialize)]
pub struct StepsView {
    /// The circuit after the last step (with its `state`), ready to draw.
    pub view: SimView,
    /// Output values after each step, in step order.
    pub outputs: Vec<Vec<(String, String)>>,
}

/// Runs a sequence of input steps (`[{"a":1}, {"a":0}]`) on one circuit,
/// continuing from `state`: one flatten for the whole sequence, so a test
/// sequence or a clock tick on a big memory stays quick.
pub fn simulate_steps(
    library: &str,
    level: &str,
    design: &str,
    steps: &str,
    state: &str,
) -> Result<StepsView, String> {
    let state: BTreeMap<String, String> =
        serde_json::from_str(state).map_err(|e| format!("couldn't read the circuit state: {e}"))?;
    let (lib, fast) = load_library(library)?;
    let level = find_level(&lib, level)?;
    let design = parse_design(design)?;
    let raw: Vec<serde_json::Value> =
        serde_json::from_str(steps).map_err(|e| format!("couldn't read the steps: {e}"))?;
    if raw.is_empty() {
        return Err("there are no steps to run".into());
    }
    let steps = raw
        .iter()
        .map(|s| read_inputs(&level, &s.to_string()))
        .collect::<Result<Vec<_>, _>>()?;
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
        cells: 0,
        state: BTreeMap::new(),
    };
    if level.layer > 1 {
        simulate_gates(&level, &design, &lib, &fast, &steps, &state, view)
    } else {
        // Switch-level circuits have no memory: each step stands alone.
        let mut outputs = Vec::new();
        let mut last = None;
        for inputs in &steps {
            let v = simulate_switches(&level, &design, &lib, inputs, view.clone())?;
            outputs.push(v.outputs.clone());
            last = Some(v);
        }
        Ok(StepsView {
            view: last.unwrap_or(view),
            outputs,
        })
    }
}

fn simulate_gates(
    level: &Level,
    design: &Design,
    lib: &Library,
    fast: &BTreeSet<String>,
    steps: &[BTreeMap<String, u64>],
    state: &BTreeMap<String, String>,
    mut view: SimView,
) -> Result<StepsView, String> {
    let prepared = match prepare(level, design, lib, fast, true) {
        Ok(p) => p,
        Err(problems) => {
            for p in problems {
                if !view.problems.contains(&p) {
                    view.problems.push(p);
                }
            }
            return Ok(StepsView {
                view,
                outputs: vec![],
            });
        }
    };
    let mut sim = prepared.sim()?;
    // Restore what each gate held (and each fast memory part's contents),
    // then apply the new inputs.
    for (i, cell) in prepared.circuit.cells.iter().enumerate() {
        if let Some(saved) = state.get(&memory_key(cell)) {
            sim.set_memory(i, saved)?;
        }
        for (port, nets) in &cell.outputs {
            for (i, net) in nets.iter().enumerate() {
                match state
                    .get(&state_key(cell, port, i, nets.len()))
                    .map(String::as_str)
                {
                    Some("0") => sim.force(*net, Value::Zero),
                    Some("1") => sim.force(*net, Value::One),
                    _ => {}
                }
            }
        }
    }
    let output_values = |sim: &GateSim| -> Vec<(String, String)> {
        prepared
            .circuit
            .outputs
            .iter()
            .map(|(n, nets)| {
                let bits: Vec<Value> = nets.iter().map(|x| sim.value(*x)).collect();
                (n.clone(), bus_text(&bits))
            })
            .collect()
    };
    let mut outputs = Vec::with_capacity(steps.len());
    let mut outcome: Option<s2t_gate::Outcome> = None;
    for inputs in steps {
        for (name, v) in inputs {
            sim.set_input(name, *v)?;
        }
        let o = sim.settle();
        // Depth and settling describe the whole run: the slowest step.
        outcome = Some(match outcome {
            Some(prev) => s2t_gate::Outcome {
                settled: o.settled && prev.settled,
                depth: o.depth.max(prev.depth),
            },
            None => o,
        });
        outputs.push(output_values(&sim));
    }
    let outcome = outcome.unwrap_or(s2t_gate::Outcome {
        settled: true,
        depth: 0,
    });
    for (i, cell) in prepared.circuit.cells.iter().enumerate() {
        if let Some(mem) = sim.memory(i) {
            view.state.insert(memory_key(cell), mem);
        }
        for (port, nets) in &cell.outputs {
            for (i, net) in nets.iter().enumerate() {
                let bit = match sim.value(*net) {
                    Value::Zero => "0",
                    Value::One => "1",
                    _ => continue,
                };
                view.state
                    .insert(state_key(cell, port, i, nets.len()), bit.into());
            }
        }
    }
    let read = |nets: &[usize]| -> Vec<Value> { nets.iter().map(|n| sim.value(*n)).collect() };
    view.blocked = false;
    view.cells = prepared.circuit.cells.len();
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
    view.outputs = output_values(&sim);
    Ok(StepsView { view, outputs })
}

/// `ram/r3#mem`: where a fast memory part's contents are kept in the state.
fn memory_key(cell: &s2t_netlist::Cell) -> String {
    format!("{}#mem", cell.path.join("/"))
}

/// `ff/master/latch/top.out`, with `[i]` for a bit of a wide output.
fn state_key(cell: &s2t_netlist::Cell, port: &str, bit: usize, width: usize) -> String {
    let path = cell.path.join("/");
    if width > 1 {
        format!("{path}.{port}[{bit}]")
    } else {
        format!("{path}.{port}")
    }
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

// ---- abstraction swap ------------------------------------------------------------

/// Checks the learner's unlocked design of `component` against its fast
/// model; the swap is allowed only if this passes.
pub fn match_check(library: &str, component: &str) -> Result<crate::MatchReport, String> {
    let (lib, _) = load_library(library)?;
    let level = find_level(&lib, component)?;
    let design = lib.design(component).cloned().ok_or_else(|| {
        format!("`{component}` isn't unlocked yet, so there's no design to compare")
    })?;
    crate::matching::match_check(&level, &design, &lib)
}
