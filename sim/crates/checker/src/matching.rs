//! The match check behind the abstraction swap: before a component may run
//! as its fast model, the learner's design must agree with the model on
//! every input (up to 16 input bits) or on 10,000 random inputs.

use std::collections::BTreeSet;

use serde::Serialize;

use s2t_gate::bits_to_number;
use s2t_netlist::{Design, Level, Library};

use crate::gatecheck::{
    bits_of, clocked_model, format_value, leaf_model, prepare, random_steps, words_of, Rng,
};

/// Inputs up to this many bits are compared exhaustively.
pub const EXHAUSTIVE_BITS: u32 = 16;
pub const RANDOM_VECTORS: usize = 10_000;
const MAX_EXAMPLES: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Mismatch {
    pub inputs: Vec<(String, String)>,
    pub expected: Vec<(String, String)>,
    pub actual: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MatchReport {
    pub component: String,
    pub ok: bool,
    /// True if every input combination was compared.
    pub exhaustive: bool,
    pub compared: usize,
    pub failed: usize,
    /// The first few mismatches.
    pub mismatches: Vec<Mismatch>,
}

fn show(level: &Level, port: &str, v: Option<u64>) -> String {
    v.map_or_else(|| "X".to_string(), |n| format_value(n, level.width(port)))
}

/// Compares `design` (the learner's) with the level's fast model.
pub fn match_check(
    level: &Level,
    design: &Design,
    library: &Library,
) -> Result<MatchReport, String> {
    if level.layer == 1 {
        return Err(
            "Layer 1 gates always run as their truth tables above Layer 1: \
                    passing every row already proved your transistors match."
                .into(),
        );
    }
    let model = leaf_model(level).ok_or_else(|| format!("`{}` has no fast model", level.id))?;
    let prepared =
        prepare(level, design, library, &BTreeSet::new(), false).map_err(|problems| {
            let first = problems
                .first()
                .map(|p| p.message.clone())
                .unwrap_or_default();
            format!(
                "your `{}` design doesn't pass validation: {first}",
                level.id
            )
        })?;
    let mut sim = prepared.sim()?;
    if level.sequential {
        return match_clocked(level, &mut sim);
    }
    let bits = level.input_bits();
    let exhaustive = bits <= EXHAUSTIVE_BITS;
    let mut rng = Rng::new(&format!("match:{}", level.id));
    let count = if exhaustive {
        1usize << bits
    } else {
        RANDOM_VECTORS
    };
    let mut report = MatchReport {
        component: level.id.clone(),
        ok: true,
        exhaustive,
        compared: count,
        failed: 0,
        mismatches: vec![],
    };
    for k in 0..count {
        // Unpack an input vector: from the counter, or random.
        let mut packed = if exhaustive { k as u64 } else { rng.next() };
        let mut inputs = Vec::new();
        for p in &level.inputs {
            let w = level.width(p);
            let mask = if w >= 64 { u64::MAX } else { (1 << w) - 1 };
            inputs.push((p.clone(), packed & mask));
            packed = if w >= 64 { rng.next() } else { packed >> w };
            if !exhaustive && packed == 0 {
                packed = rng.next();
            }
        }
        for (p, v) in &inputs {
            sim.set_input(p, *v)?;
        }
        sim.settle();
        let want = words_of(level, &level.outputs, &model.eval(&bits_of(level, &inputs)));
        let got: Vec<Option<u64>> = level
            .outputs
            .iter()
            .map(|p| sim.output(p).as_deref().and_then(bits_to_number))
            .collect();
        if want != got {
            report.ok = false;
            report.failed += 1;
            if report.mismatches.len() < MAX_EXAMPLES {
                let pair = |vals: &[Option<u64>]| {
                    level
                        .outputs
                        .iter()
                        .zip(vals)
                        .map(|(p, v)| (p.clone(), show(level, p, *v)))
                        .collect()
                };
                report.mismatches.push(Mismatch {
                    inputs: inputs
                        .iter()
                        .map(|(p, v)| (p.clone(), format_value(*v, level.width(p))))
                        .collect(),
                    expected: pair(&want),
                    actual: pair(&got),
                });
            }
        }
    }
    Ok(report)
}

/// The match check for a component with memory: 10,000 random clock cycles
/// from power-on, comparing outputs wherever the model knows its value.
fn match_clocked(level: &Level, sim: &mut s2t_gate::GateSim) -> Result<MatchReport, String> {
    let m = level
        .model
        .as_deref()
        .and_then(s2t_models::clocked)
        .ok_or_else(|| format!("`{}` has no fast model", level.id))?;
    let model = clocked_model(m);
    let mut mem = model.power_on();
    let mut rng = Rng::new(&format!("match:{}", level.id));
    let steps = random_steps(level, m.clk, &mut rng, RANDOM_VECTORS);
    let mut report = MatchReport {
        component: level.id.clone(),
        ok: true,
        exhaustive: false,
        compared: RANDOM_VECTORS,
        failed: 0,
        mismatches: vec![],
    };
    // Each cycle is two steps (clock low, clock high); a cycle fails if
    // either step's outputs differ wherever the model knows them.
    for cycle in steps.chunks(2) {
        let mut cycle_failed = false;
        for inputs in cycle {
            for (p, v) in inputs {
                sim.set_input(p, *v)?;
            }
            sim.settle();
            let want = words_of(
                level,
                &level.outputs,
                &model.eval(&bits_of(level, inputs), &mut mem),
            );
            let got: Vec<Option<u64>> = level
                .outputs
                .iter()
                .map(|p| sim.output(p).as_deref().and_then(bits_to_number))
                .collect();
            if !want.iter().zip(&got).any(|(w, g)| w.is_some() && w != g) {
                continue;
            }
            cycle_failed = true;
            if report.mismatches.len() < MAX_EXAMPLES {
                let pair = |vals: &[Option<u64>]| {
                    level
                        .outputs
                        .iter()
                        .zip(vals)
                        .map(|(p, v)| (p.clone(), show(level, p, *v)))
                        .collect()
                };
                report.mismatches.push(Mismatch {
                    inputs: inputs
                        .iter()
                        .map(|(p, v)| (p.clone(), format_value(*v, level.width(p))))
                        .collect(),
                    expected: pair(&want),
                    actual: pair(&got),
                });
            }
        }
        if cycle_failed {
            report.ok = false;
            report.failed += 1;
        }
    }
    Ok(report)
}
