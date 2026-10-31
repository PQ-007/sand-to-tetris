//! Checking and simulating Layer 2+ designs on the gate-level engine.
//!
//! Leaves: every Layer 1 gate runs as its truth table (an exhaustive table
//! the learner's transistor design already passed), and every component in
//! `fast` runs as its native model or table. Everything else is expanded
//! into the learner's own designs.

use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;

use s2t_gate::{bits_to_number, Clocked, GateSim, Model, TruthTable};
use s2t_netlist::{flatten_gates, Design, GateCircuit, GateError, Level, Library, Problem, Value};

use crate::table::{pack, Table, TableRow};
use crate::{Diagnostic, Kind, Report, ReportProblem, RowResult};

/// Formats a value for messages: `1` for a bit, `5 (0101)` for small buses,
/// `0x1235` for wide ones.
pub fn format_value(v: u64, width: u32) -> String {
    match width {
        1 => v.to_string(),
        2..=8 => format!("{v} ({v:0w$b})", w = width as usize),
        _ => format!("0x{v:0w$x}", w = width.div_ceil(4) as usize),
    }
}

/// Formats bits (least significant first) that may include X or Z.
fn format_bits(bits: &[Value], width: u32) -> String {
    match bits_to_number(bits) {
        Some(n) => format_value(n, width),
        None => bits.iter().rev().map(|b| b.to_string()).collect(),
    }
}

fn table_model(level: &Level) -> Option<Model> {
    // A sequential level's table is a sequence of steps, not a function.
    if level.sequential {
        return None;
    }
    let table = Table::parse(&level.truth_table, level).ok()?;
    if !table.is_exhaustive(level) {
        return None;
    }
    let mut rows = vec![0u64; 1usize << level.input_bits()];
    for r in &table.rows {
        let idx = pack(level, &r.inputs) as usize;
        if let Some(slot) = rows.get_mut(idx) {
            *slot = pack(level, &r.outputs);
        }
    }
    let outputs = level.outputs.iter().map(|p| level.width(p)).sum();
    Some(Model::Table(TruthTable {
        inputs: level.input_bits(),
        outputs,
        rows,
    }))
}

/// A clocked native model (register, RAM, PC) for the gate engine.
pub(crate) fn clocked_model(m: &'static s2t_models::ClockedModel) -> Clocked {
    Clocked {
        clk_bit: m.clk_bit(),
        words: m.words,
        tick: Arc::new(move |ins, mem| m.tick_bits(ins, mem)),
        read: Arc::new(move |ins, mem| m.read_bits(ins, mem)),
    }
}

/// The model a component runs as when it's a leaf: its native model (with
/// memory, for registers and RAM) if it has one, else its truth table if
/// that lists every input.
pub fn leaf_model(level: &Level) -> Option<Model> {
    if let Some(m) = level.model.as_deref().and_then(s2t_models::model) {
        return Some(Model::native(move |ins| m.eval_bits(ins)));
    }
    if let Some(m) = level.model.as_deref().and_then(s2t_models::clocked) {
        return Some(Model::Clocked(clocked_model(m)));
    }
    table_model(level)
}

/// Input values as flattened bits, in port order.
pub(crate) fn bits_of(level: &Level, values: &[(String, u64)]) -> Vec<Value> {
    let mut bits = Vec::new();
    for (p, v) in values {
        for i in 0..level.width(p) {
            bits.push(Value::from_bit(v >> i & 1 == 1));
        }
    }
    bits
}

/// Splits flattened bits into one word per port (`None` if any bit of it
/// is unknown).
pub(crate) fn words_of(level: &Level, ports: &[String], bits: &[Value]) -> Vec<Option<u64>> {
    let mut out = Vec::new();
    let mut i = 0usize;
    for p in ports {
        let w = level.width(p) as usize;
        out.push(bits.get(i..i + w).and_then(bits_to_number));
        i += w;
    }
    out
}

/// Random clock cycles for a level with memory: each cycle is two steps,
/// fresh random inputs with the clock low, then the same inputs with the
/// clock high, so only the clock changes at the rising edge (setup time).
/// Addresses come from a small pool so reads often find written words;
/// `reset` is rare so a counter gets to count.
pub(crate) fn random_steps(
    level: &Level,
    clk: usize,
    rng: &mut Rng,
    cycles: usize,
) -> Vec<Vec<(String, u64)>> {
    let mask = |w: u32| if w >= 64 { u64::MAX } else { (1 << w) - 1 };
    let pool: Vec<u64> = (0..8).map(|_| rng.next()).collect();
    let mut steps = Vec::with_capacity(2 * cycles);
    for _ in 0..cycles {
        let low: Vec<(String, u64)> = level
            .inputs
            .iter()
            .enumerate()
            .map(|(i, p)| {
                let m = mask(level.width(p));
                let v = if i == clk {
                    0
                } else if p == "addr" {
                    pool[(rng.next() % 8) as usize] & m
                } else if p == "reset" {
                    u64::from(rng.next() % 8 == 0)
                } else {
                    rng.next() & m
                };
                (p.clone(), v)
            })
            .collect();
        let mut high = low.clone();
        if let Some(c) = high.get_mut(clk) {
            c.1 = 1;
        }
        steps.push(low);
        steps.push(high);
    }
    steps
}

/// Leaf models: every Layer 1 level plus each `fast` component.
fn leaves(library: &Library, fast: &BTreeSet<String>) -> HashMap<String, Model> {
    library
        .levels()
        .filter(|l| l.layer == 1 || fast.contains(&l.id))
        .filter_map(|l| {
            let model = if l.layer == 1 {
                table_model(l)
            } else {
                leaf_model(l)
            };
            model.map(|m| (l.id.clone(), m))
        })
        .collect()
}

pub(crate) struct Prepared {
    pub circuit: GateCircuit,
    pub models: HashMap<String, Model>,
}

impl Prepared {
    pub fn sim(&self) -> Result<GateSim<'_>, String> {
        GateSim::new(&self.circuit, |cell| self.models.get(&cell.kind).cloned())
    }
}

/// Flattens for the gate engine; structural problems come back as report
/// problems.
pub(crate) fn prepare(
    level: &Level,
    design: &Design,
    library: &Library,
    fast: &BTreeSet<String>,
    preview: bool,
) -> Result<Prepared, Vec<ReportProblem>> {
    let models = leaves(library, fast);
    let is_leaf = |k: &str| models.contains_key(k);
    match flatten_gates(level, design, library, &is_leaf, preview) {
        Ok(circuit) => Ok(Prepared { circuit, models }),
        Err(GateError::Invalid {
            component,
            problems,
        }) if component == level.id => Err(problems.iter().map(ReportProblem::from).collect()),
        Err(e) => {
            let parts = match &e {
                GateError::MultipleDrivers { parts, .. } => parts.clone(),
                _ => vec![],
            };
            let message = match &e {
                GateError::Invalid { .. } | GateError::Missing { .. } => {
                    format!("a component inside this design is broken: {e}")
                }
                _ => e.to_string(),
            };
            Err(vec![ReportProblem {
                severity: "error",
                message,
                parts,
                ports: vec![],
            }])
        }
    }
}

/// A small deterministic random generator (xorshift64*), seeded per level
/// so failures are reproducible.
pub(crate) struct Rng(u64);

impl Rng {
    pub(crate) fn new(seed: &str) -> Rng {
        let mut h = 0xcbf2_9ce4_8422_2325u64;
        for b in seed.bytes() {
            h = (h ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3);
        }
        Rng(h | 1)
    }

    pub(crate) fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_f491_4f6c_dd1d)
    }
}

fn describe(level: &Level, values: &[(String, u64)], sep: &str) -> String {
    values
        .iter()
        .map(|(k, v)| format!("{k}={}", format_value(*v, level.width(k))))
        .collect::<Vec<_>>()
        .join(sep)
}

/// Runs one input vector; returns the row result and its diagnostics.
fn run_vector(
    level: &Level,
    sim: &mut GateSim,
    label: &str,
    row_no: usize,
    row: &TableRow,
) -> Result<(RowResult, Vec<Diagnostic>, usize), String> {
    for (name, v) in &row.inputs {
        sim.set_input(name, *v)?;
    }
    let outcome = sim.settle();
    let inputs: Vec<(String, String)> = row
        .inputs
        .iter()
        .map(|(k, v)| (k.clone(), format_value(*v, level.width(k))))
        .collect();
    let mut result = RowResult {
        inputs: inputs.clone(),
        outputs: vec![],
        passed: true,
    };
    let mut diags = Vec::new();
    let head = format!("{label}: {}", describe(level, &row.inputs, " "));
    for (port, want) in &row.outputs {
        let width = level.width(port);
        let bits = sim.output(port).unwrap_or_default();
        let actual = format_bits(&bits, width);
        if row.skip.contains(port) {
            result
                .outputs
                .push((port.clone(), "-".into(), actual.clone()));
            continue;
        }
        let expected = format_value(*want, width);
        result
            .outputs
            .push((port.clone(), expected.clone(), actual.clone()));
        if bits_to_number(&bits) == Some(*want) {
            continue;
        }
        result.passed = false;
        let floating: Vec<usize> = (0..bits.len()).filter(|&i| bits[i] == Value::Z).collect();
        let (kind, message) = if !floating.is_empty() {
            let what = if width == 1 {
                format!("`{port}` is floating. Nothing drives it")
            } else if floating.len() == bits.len() {
                format!("all of `{port}` is floating. Nothing drives it")
            } else {
                let list: Vec<String> = floating.iter().map(|b| b.to_string()).collect();
                format!(
                    "bit{} {} of `{port}` {} floating. Nothing drives {}",
                    if floating.len() > 1 { "s" } else { "" },
                    list.join(", "),
                    if floating.len() > 1 { "are" } else { "is" },
                    if floating.len() > 1 { "them" } else { "it" }
                )
            };
            (
                Kind::Floating,
                format!("{head} → expected {port}={expected}, got {actual}: {what}."),
            )
        } else if bits.contains(&Value::X) {
            let why = if outcome.settled {
                "Look for an input that isn't connected, or a loop."
            } else {
                "The circuit kept changing and never settled: a loop that oscillates."
            };
            (Kind::Unknown, format!("{head} → expected {port}={expected}, got {actual}: the value of `{port}` can't be determined. {why}"))
        } else {
            (
                Kind::Wrong,
                format!("{head} → expected {port}={expected}, got {port}={actual}."),
            )
        };
        diags.push(Diagnostic {
            row: row_no,
            inputs: inputs.clone(),
            port: port.clone(),
            expected: expected.clone(),
            actual: actual.clone(),
            kind,
            message,
            hint: level.hints.get(kind.hint_key()).cloned(),
            parts: vec![],
            ports: vec![port.clone()],
        });
    }
    Ok((result, diags, outcome.depth))
}

/// "Random step 3 (after random steps 1–2)".
fn random_step_label(k: usize) -> String {
    match k {
        0 => "Random step 1".into(),
        1 => "Random step 2 (after random step 1)".into(),
        _ => format!("Random step {} (after random steps 1–{})", k + 1, k),
    }
}

/// "Step 3 (after steps 1–2)": a step's result depends on the ones before.
fn step_label(i: usize) -> String {
    match i {
        0 => "Step 1".into(),
        1 => "Step 2 (after step 1)".into(),
        _ => format!("Step {} (after steps 1–{})", i + 1, i),
    }
}

/// Random failures reported in detail (the rest are only counted).
const MAX_RANDOM_DETAILS: usize = 5;

pub(crate) fn check_gates(
    level: &Level,
    design: &Design,
    library: &Library,
    fast: &BTreeSet<String>,
    table: &Table,
) -> Report {
    let problems: Vec<Problem> = s2t_netlist::validate(level, design, library);
    let mut report = Report {
        component: level.id.clone(),
        passed: false,
        problems: problems.iter().map(ReportProblem::from).collect(),
        rows: vec![],
        diagnostics: vec![],
        transistors: 0,
        cells: 0,
        depth: 0,
        random: None,
    };
    if problems.iter().any(Problem::is_error) {
        return report;
    }
    let prepared = match prepare(level, design, library, fast, false) {
        Ok(p) => p,
        Err(mut problems) => {
            report.problems.append(&mut problems);
            return report;
        }
    };
    report.cells = prepared.circuit.cells.len();
    let fail = |report: &mut Report, e: String| {
        report.problems.push(ReportProblem {
            severity: "error",
            message: e,
            parts: vec![],
            ports: vec![],
        });
    };
    // A sequential level runs every step on one circuit, so its memory
    // carries over; a combinational row starts from scratch (all unknown),
    // so it can't pass by luck from the state the previous row left behind.
    let mut steps = if level.sequential {
        match prepared.sim() {
            Ok(s) => Some(s),
            Err(e) => {
                fail(&mut report, e);
                return report;
            }
        }
    } else {
        None
    };
    for (i, row) in table.rows.iter().enumerate() {
        let result = match steps.as_mut() {
            Some(sim) => run_vector(level, sim, &step_label(i), i + 1, row),
            None => prepared.sim().and_then(|mut sim| {
                run_vector(level, &mut sim, &format!("Row {}", i + 1), i + 1, row)
            }),
        };
        match result {
            Ok((r, mut d, depth)) => {
                report.rows.push(r);
                report.diagnostics.append(&mut d);
                report.depth = report.depth.max(depth);
            }
            Err(e) => {
                fail(&mut report, e);
                return report;
            }
        }
    }
    let mut random_ok = true;
    let clocked = level
        .model
        .as_deref()
        .and_then(s2t_models::clocked)
        .filter(|_| level.sequential);
    if let Some(m) = clocked {
        // Random clock cycles from power-on, against the model's own memory.
        let mut rng = Rng::new(&level.id);
        let steps = random_steps(
            level,
            m.clk,
            &mut rng,
            level.random_tests.unwrap_or(500) as usize,
        );
        let model = clocked_model(m);
        let mut mem = model.power_on();
        let mut sim = match prepared.sim() {
            Ok(s) => s,
            Err(e) => {
                fail(&mut report, e);
                return report;
            }
        };
        let mut failed = 0usize;
        for (k, inputs) in steps.iter().enumerate() {
            let want = words_of(
                level,
                &level.outputs,
                &model.eval(&bits_of(level, inputs), &mut mem),
            );
            let row = TableRow {
                inputs: inputs.clone(),
                outputs: level
                    .outputs
                    .iter()
                    .zip(&want)
                    .map(|(p, w)| (p.clone(), w.unwrap_or(0)))
                    .collect(),
                // Unknown in the model too (nothing stored yet): any value.
                skip: level
                    .outputs
                    .iter()
                    .zip(&want)
                    .filter(|(_, w)| w.is_none())
                    .map(|(p, _)| p.clone())
                    .collect(),
            };
            match run_vector(
                level,
                &mut sim,
                &random_step_label(k),
                table.rows.len() + k + 1,
                &row,
            ) {
                Ok((r, mut d, depth)) => {
                    report.depth = report.depth.max(depth);
                    if !r.passed {
                        failed += 1;
                        if failed <= MAX_RANDOM_DETAILS {
                            report.diagnostics.append(&mut d);
                        }
                    }
                }
                Err(e) => {
                    fail(&mut report, e);
                    return report;
                }
            }
        }
        random_ok = failed == 0;
        report.random = Some(crate::RandomSummary {
            run: steps.len(),
            failed,
        });
    } else if let Some(model) = level.model.as_deref().and_then(s2t_models::model) {
        let n = level.random_tests.unwrap_or(2000) as usize;
        let mut rng = Rng::new(&level.id);
        let mut failed = 0usize;
        // Random tests reuse one simulator: for combinational circuits the
        // result doesn't depend on the previous state, and it's much faster.
        let mut sim = match prepared.sim() {
            Ok(s) => s,
            Err(e) => {
                fail(&mut report, e);
                return report;
            }
        };
        for k in 0..n {
            let inputs: Vec<(String, u64)> = level
                .inputs
                .iter()
                .map(|p| {
                    let w = level.width(p);
                    let mask = if w >= 64 { u64::MAX } else { (1 << w) - 1 };
                    (p.clone(), rng.next() & mask)
                })
                .collect();
            let words: Vec<u64> = inputs.iter().map(|(_, v)| *v).collect();
            let outputs = level
                .outputs
                .iter()
                .cloned()
                .zip(model.eval_words(&words))
                .collect();
            let row = TableRow {
                inputs,
                outputs,
                skip: vec![],
            };
            let row_no = table.rows.len() + k + 1;
            match run_vector(
                level,
                &mut sim,
                &format!("Random test {}", k + 1),
                row_no,
                &row,
            ) {
                Ok((r, mut d, depth)) => {
                    report.depth = report.depth.max(depth);
                    if !r.passed {
                        failed += 1;
                        if failed <= MAX_RANDOM_DETAILS {
                            report.diagnostics.append(&mut d);
                        }
                    }
                }
                Err(e) => {
                    fail(&mut report, e);
                    return report;
                }
            }
        }
        random_ok = failed == 0;
        report.random = Some(crate::RandomSummary { run: n, failed });
    }
    report.passed = random_ok && report.rows.iter().all(|r| r.passed);
    report
}
