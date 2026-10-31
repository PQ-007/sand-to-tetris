//! Checking and simulating Layer 2+ designs on the gate-level engine.
//!
//! Leaves: every Layer 1 gate runs as its truth table (an exhaustive table
//! the learner's transistor design already passed), and every component in
//! `fast` runs as its native model or table. Everything else is expanded
//! into the learner's own designs.

use std::collections::{BTreeSet, HashMap};

use s2t_gate::{bits_to_number, GateSim, Model, TruthTable};
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

/// The model a component runs as when it's a leaf: its native model if it
/// has one, else its truth table if that lists every input.
pub fn leaf_model(level: &Level) -> Option<Model> {
    if let Some(m) = level.model.as_deref().and_then(s2t_models::model) {
        return Some(Model::native(move |ins| m.eval_bits(ins)));
    }
    table_model(level)
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
struct Rng(u64);

impl Rng {
    fn new(seed: &str) -> Rng {
        let mut h = 0xcbf2_9ce4_8422_2325u64;
        for b in seed.bytes() {
            h = (h ^ u64::from(b)).wrapping_mul(0x0100_0000_01b3);
        }
        Rng(h | 1)
    }

    fn next(&mut self) -> u64 {
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
    prepared: &Prepared,
    label: &str,
    row_no: usize,
    row: &TableRow,
) -> Result<(RowResult, Vec<Diagnostic>, usize), String> {
    let mut sim = prepared.sim()?;
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
        let expected = format_value(*want, width);
        let actual = format_bits(&bits, width);
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
    for (i, row) in table.rows.iter().enumerate() {
        match run_vector(level, &prepared, &format!("Row {}", i + 1), i + 1, row) {
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
    if let Some(model) = level.model.as_deref().and_then(s2t_models::model) {
        let n = level.random_tests.unwrap_or(2000) as usize;
        let mut rng = Rng::new(&level.id);
        let mut failed = 0usize;
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
            let row = TableRow { inputs, outputs };
            let row_no = table.rows.len() + k + 1;
            match run_vector(
                level,
                &prepared,
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
