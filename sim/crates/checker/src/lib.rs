//! Runs a level's truth table against a design and explains every failure
//! in plain language, with the parts and ports the editor should highlight.

use std::collections::BTreeSet;

use serde::Serialize;

use s2t_netlist::{flatten, Circuit, Design, FlattenError, Level, Library, Problem};
use s2t_switch::{Sim, Value};

pub mod api;

// ---- truth tables ------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TableRow {
    /// Input values in the level's port order.
    pub inputs: Vec<(String, bool)>,
    /// Expected output values in the level's port order.
    pub outputs: Vec<(String, bool)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Table {
    pub rows: Vec<TableRow>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TableError {
    pub line: usize,
    pub message: String,
}

impl std::fmt::Display for TableError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "truth table line {}: {}", self.line, self.message)
    }
}

impl std::error::Error for TableError {}

fn names(items: &[String]) -> String {
    items
        .iter()
        .map(|s| format!("`{s}`"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Maps header columns to the level's port order, or explains the mismatch.
fn columns(
    header: &[String],
    ports: &[String],
    what: &str,
    line: usize,
) -> Result<Vec<usize>, TableError> {
    let same = header.len() == ports.len()
        && header.iter().collect::<BTreeSet<_>>() == ports.iter().collect::<BTreeSet<_>>();
    if !same {
        return Err(TableError {
            line,
            message: format!(
                "columns {} don't match the level's {what} {}",
                names(header),
                names(ports)
            ),
        });
    }
    // For each port (in level order), which column holds it.
    Ok(ports
        .iter()
        .map(|p| header.iter().position(|h| h == p).unwrap_or(0))
        .collect())
}

impl Table {
    /// Parses `a b | out` followed by rows like `0 1 | 1`. Blank lines and
    /// lines starting with `#` are ignored. Column order may differ from the
    /// level's port order.
    pub fn parse(text: &str, level: &Level) -> Result<Table, TableError> {
        let mut lines = text
            .lines()
            .enumerate()
            .map(|(i, l)| (i + 1, l.trim()))
            .filter(|(_, l)| !l.is_empty() && !l.starts_with('#'));
        let (hline, header) = lines.next().ok_or(TableError {
            line: 1,
            message: "the table is empty".into(),
        })?;
        let split = |line: usize, s: &str| -> Result<(Vec<String>, Vec<String>), TableError> {
            let mut halves = s.split('|');
            match (halves.next(), halves.next(), halves.next()) {
                (Some(l), Some(r), None) => Ok((
                    l.split_whitespace().map(String::from).collect(),
                    r.split_whitespace().map(String::from).collect(),
                )),
                _ => Err(TableError {
                    line,
                    message: format!(
                        "expected {} inputs, `|`, then {} output{}",
                        level.inputs.len(),
                        level.outputs.len(),
                        if level.outputs.len() == 1 { "" } else { "s" }
                    ),
                }),
            }
        };
        let (hin, hout) = split(hline, header)?;
        let in_cols = columns(&hin, &level.inputs, "inputs", hline)?;
        let out_cols = columns(&hout, &level.outputs, "outputs", hline)?;

        let mut rows = Vec::new();
        for (line, text) in lines {
            let (vin, vout) = split(line, text)?;
            if vin.len() != hin.len() || vout.len() != hout.len() {
                return Err(TableError {
                    line,
                    message: format!(
                        "expected {} inputs, `|`, then {} output{}",
                        hin.len(),
                        hout.len(),
                        if hout.len() == 1 { "" } else { "s" }
                    ),
                });
            }
            let bit = |s: &String| match s.as_str() {
                "0" => Ok(false),
                "1" => Ok(true),
                other => Err(TableError {
                    line,
                    message: format!("`{other}` isn't 0 or 1"),
                }),
            };
            let pick = |ports: &[String], cols: &[usize], vals: &[String]| {
                ports
                    .iter()
                    .zip(cols)
                    .map(|(p, &c)| Ok((p.clone(), bit(&vals[c])?)))
                    .collect::<Result<Vec<_>, TableError>>()
            };
            rows.push(TableRow {
                inputs: pick(&level.inputs, &in_cols, &vin)?,
                outputs: pick(&level.outputs, &out_cols, &vout)?,
            });
        }
        Ok(Table { rows })
    }

    /// True if every combination of inputs appears.
    pub fn is_exhaustive(&self) -> bool {
        let Some(first) = self.rows.first() else {
            return false;
        };
        let n = first.inputs.len();
        if n >= 20 {
            return false;
        }
        let seen: BTreeSet<Vec<bool>> = self
            .rows
            .iter()
            .map(|r| r.inputs.iter().map(|(_, b)| *b).collect())
            .collect();
        seen.len() == 1 << n
    }
}

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
    fn hint_key(self) -> &'static str {
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
    /// Transistors after flattening every component part.
    pub transistors: usize,
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
    let table = Table::parse(&level.truth_table, level)?;
    let problems = s2t_netlist::validate(level, design, library);
    let mut report = Report {
        component: level.id.clone(),
        passed: false,
        problems: problems.iter().map(ReportProblem::from).collect(),
        rows: vec![],
        diagnostics: vec![],
        transistors: 0,
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
        let _ = sim.set_input(name, Value::from_bit(*bit));
    }
    let outcome = sim.settle();
    let inputs: Vec<(String, String)> = row
        .inputs
        .iter()
        .map(|(k, b)| (k.clone(), u8::from(*b).to_string()))
        .collect();
    let mut result = RowResult {
        inputs: inputs.clone(),
        outputs: vec![],
        passed: true,
    };
    for (port, bit) in &row.outputs {
        let expected = Value::from_bit(*bit);
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
