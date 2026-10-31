//! Runs a level's truth table against a design and explains every failure
//! in plain language, with the parts and ports the editor should highlight.

use std::collections::BTreeSet;

use serde::Serialize;

use s2t_netlist::{flatten, Circuit, Design, FlattenError, Level, Library, Problem};
use s2t_switch::{Sim, Value};

pub mod api;

mod gatecheck;
mod table;

pub use gatecheck::{format_value, leaf_model};
pub use table::{parse_number, Table, TableError, TableRow};

// ---- reports -------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// A definite value, but the wrong one.
    Wrong,
    /// Nothing drives the output.
    Floating,
    /// VDD and GND are connected.
    Short,
    /// The output couldn't be determined.
    Unknown,
}

impl Kind {
    pub(crate) fn hint_key(self) -> &'static str {
        match self {
            Kind::Wrong => "wrong",
            Kind::Floating => "floating",
            Kind::Short => "short",
            Kind::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    /// 1-based row of the truth table.
    pub row: usize,
    pub inputs: Vec<(String, String)>,
    pub port: String,
    pub expected: String,
    pub actual: String,
    pub kind: Kind,
    pub message: String,
    pub hint: Option<String>,
    /// Top-level part ids to highlight.
    pub parts: Vec<String>,
    /// Ports to highlight.
    pub ports: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RowResult {
    pub inputs: Vec<(String, String)>,
    /// `(port, expected, actual)`.
    pub outputs: Vec<(String, String, String)>,
    pub passed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ReportProblem {
    /// `"error"` or `"warning"`.
    pub severity: &'static str,
    pub message: String,
    pub parts: Vec<String>,
    pub ports: Vec<String>,
}

impl From<&Problem> for ReportProblem {
    fn from(p: &Problem) -> ReportProblem {
        ReportProblem {
            severity: if p.is_error() { "error" } else { "warning" },
            message: p.to_string(),
            parts: p.parts(),
            ports: p.ports(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Report {
    pub component: String,
    pub passed: bool,
    /// Structural errors and warnings (errors stop the simulation).
    pub problems: Vec<ReportProblem>,
    pub rows: Vec<RowResult>,
    pub diagnostics: Vec<Diagnostic>,
    /// Transistors after flattening every component part (Layer 1).
    pub transistors: usize,
    /// Leaf cells after flattening (Layer 2 and up).
    pub cells: usize,
    /// Longest chain of gate delays seen while testing (Layer 2 and up).
    pub depth: usize,
    /// Random tests against the level's model, if it has one.
    pub random: Option<RandomSummary>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RandomSummary {
    pub run: usize,
    pub failed: usize,
}

fn describe(inputs: &[(String, String)], sep: &str) -> String {
    inputs
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join(sep)
}

fn top_parts<'a>(paths: impl Iterator<Item = &'a Vec<String>>) -> Vec<String> {
    paths
        .filter_map(|p| p.first().cloned())
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}

/// Checks `design` against `level`'s truth table. Errors only for problems
/// in the level definition itself (a bad table), never for learner mistakes:
/// those are reported inside the `Report`.
pub fn check(level: &Level, design: &Design, library: &Library) -> Result<Report, TableError> {
    check_with(level, design, library, &BTreeSet::new())
}

/// Like [`check`], with some components running as fast models (only
/// matters from Layer 2 up). Layer 1 levels run on the switch-level engine;
/// higher layers on the gate-level engine.
pub fn check_with(
    level: &Level,
    design: &Design,
    library: &Library,
    fast: &BTreeSet<String>,
) -> Result<Report, TableError> {
    let table = Table::parse(&level.truth_table, level)?;
    if level.layer > 1 {
        return Ok(gatecheck::check_gates(level, design, library, fast, &table));
    }
    let problems = s2t_netlist::validate(level, design, library);
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
        return Ok(report);
    }
    let circuit = match flatten(level, design, library) {
        Ok(c) => c,
        Err(e) => {
            report.problems.push(ReportProblem {
                severity: "error",
                message: match &e {
                    FlattenError::Invalid { component, .. } if component != &level.id => {
                        format!("a component inside this design is broken: {e}")
                    }
                    _ => e.to_string(),
                },
                parts: vec![],
                ports: vec![],
            });
            return Ok(report);
        }
    };
    report.transistors = circuit.transistors.len();

    for (i, row) in table.rows.iter().enumerate() {
        run_row(level, &circuit, i + 1, row, &mut report);
    }
    report.passed = report.rows.iter().all(|r| r.passed);
    Ok(report)
}

fn run_row(level: &Level, circuit: &Circuit, n: usize, row: &TableRow, report: &mut Report) {
    let mut sim = Sim::new(circuit);
    for (name, bit) in &row.inputs {
        // Ports come from the level and the circuit was built from it.
        let _ = sim.set_input(name, Value::from_bit(*bit == 1));
    }
    let outcome = sim.settle();
    let inputs: Vec<(String, String)> = row
        .inputs
        .iter()
        .map(|(k, b)| (k.clone(), b.to_string()))
        .collect();
    let mut result = RowResult {
        inputs: inputs.clone(),
        outputs: vec![],
        passed: true,
    };
    for (port, bit) in &row.outputs {
        let expected = Value::from_bit(*bit == 1);
        let actual = sim.output(port).unwrap_or(Value::X);
        result
            .outputs
            .push((port.clone(), expected.to_string(), actual.to_string()));
        if actual == expected {
            continue;
        }
        result.passed = false;
        let net = circuit
            .outputs
            .iter()
            .find(|(p, _)| p == port)
            .map(|(_, net)| *net);
        let short = outcome
            .shorts
            .iter()
            .find(|s| net.is_some_and(|n| s.nets.contains(&n)));
        let head = format!("Row {n}: {}", describe(&inputs, " "));
        let (kind, message, parts) = match (actual, short) {
            (Value::X, Some(s)) => {
                let parts = top_parts(
                    s.transistors
                        .iter()
                        .map(|&t| &circuit.transistors[t].path)
                        .chain(s.rails.iter().map(|&r| &circuit.rails[r].path)),
                );
                let via = parts
                    .iter()
                    .map(|p| format!("`{p}`"))
                    .collect::<Vec<_>>()
                    .join(", ");
                let mut through = String::new();
                if !via.is_empty() {
                    through = format!(" through {via}");
                }
                if !s.inputs.is_empty() {
                    let ins = s
                        .inputs
                        .iter()
                        .map(|i| format!("input `{i}`"))
                        .collect::<Vec<_>>()
                        .join(", ");
                    through = if through.is_empty() {
                        format!(" through {ins}")
                    } else {
                        format!("{through} and {ins}")
                    };
                }
                (
                    Kind::Short,
                    format!(
                        "{head} → short circuit: VDD and GND are connected{through}. \
                         Expected {port}={expected}, got X."
                    ),
                    parts,
                )
            }
            (Value::Z, _) => (
                Kind::Floating,
                format!(
                    "{head} → expected {port}={expected}, got Z: `{port}` is floating. \
                     Nothing connects it to VDD or GND when {}.",
                    describe(&inputs, ", ")
                ),
                vec![],
            ),
            (Value::X, None) => (
                Kind::Unknown,
                format!(
                    "{head} → expected {port}={expected}, got X: the value of `{port}` \
                     can't be determined. Look for a transistor gate that isn't connected, \
                     or a loop.{}",
                    if outcome.settled {
                        ""
                    } else {
                        " The circuit never settled."
                    }
                ),
                vec![],
            ),
            _ => (
                Kind::Wrong,
                format!("{head} → expected {port}={expected}, got {port}={actual}."),
                vec![],
            ),
        };
        report.diagnostics.push(Diagnostic {
            row: n,
            inputs: inputs.clone(),
            port: port.clone(),
            expected: expected.to_string(),
            actual: actual.to_string(),
            kind,
            message,
            hint: level.hints.get(kind.hint_key()).cloned(),
            parts,
            ports: vec![port.clone()],
        });
    }
    report.rows.push(result);
}
