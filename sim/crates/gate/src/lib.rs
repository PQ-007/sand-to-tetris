//! Gate-level simulation of a [`GateCircuit`].
//!
//! Every cell is a leaf component evaluated by a [`Model`]: its truth table
//! (Layer 1 gates, small components) or a native function (big components'
//! fast models). Simulation is event-driven with **unit delay**: in each
//! round every cell whose inputs changed computes new outputs, and all
//! changes land together at the start of the next round. The number of
//! rounds until nothing changes is the circuit's *depth*, the longest
//! chain of gates a signal passes through. Unit delay is also what makes
//! feedback (latches, Layer 3) work, and lets us notice circuits that
//! oscillate forever.

use std::collections::BTreeSet;
use std::sync::Arc;

use s2t_netlist::{Cell, GateCircuit, NetId, Value};

/// A combinational function as a lookup table.
///
/// Inputs are flattened in port order, each port least significant bit
/// first; that list, read as a binary number with the first bit as bit 0,
/// indexes `rows`. Each row holds the output bits the same way.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TruthTable {
    pub inputs: u32,
    pub outputs: u32,
    pub rows: Vec<u64>,
}

/// Unknown inputs beyond this are not enumerated; the outputs become X.
const MAX_UNKNOWN: usize = 12;

impl TruthTable {
    /// Builds a table by calling `f` for every input combination.
    pub fn from_fn(inputs: u32, outputs: u32, f: impl Fn(u64) -> u64) -> TruthTable {
        TruthTable {
            inputs,
            outputs,
            rows: (0..1u64 << inputs).map(f).collect(),
        }
    }

    /// Evaluates the table. If some inputs are X or Z, every possible value
    /// for them is tried: an output bit is known only if all agree.
    pub fn eval(&self, ins: &[Value]) -> Vec<Value> {
        let mut base = 0u64;
        let mut unknown = Vec::new();
        for (i, v) in ins.iter().enumerate() {
            match v {
                Value::One => base |= 1 << i,
                Value::Zero => {}
                Value::X | Value::Z => unknown.push(i),
            }
        }
        let n = self.outputs as usize;
        if unknown.len() > MAX_UNKNOWN {
            return vec![Value::X; n];
        }
        let row = |idx: u64| self.rows.get(idx as usize).copied().unwrap_or(0);
        let first = row(base);
        let mut agree = u64::MAX;
        for combo in 1u64..(1 << unknown.len()) {
            let mut idx = base;
            for (j, &pos) in unknown.iter().enumerate() {
                if combo >> j & 1 == 1 {
                    idx |= 1 << pos;
                }
            }
            agree &= !(row(idx) ^ first);
        }
        (0..n)
            .map(|b| {
                if agree >> b & 1 == 0 {
                    Value::X
                } else {
                    Value::from_bit(first >> b & 1 == 1)
                }
            })
            .collect()
    }
}

/// A native evaluation function over flattened input bits.
pub type NativeFn = Arc<dyn Fn(&[Value]) -> Vec<Value> + Send + Sync>;

/// How a cell computes its outputs.
#[derive(Clone)]
pub enum Model {
    Table(TruthTable),
    /// A native function over the flattened input bits (same order as a
    /// table). It must handle X/Z inputs itself.
    Native(NativeFn),
}

impl std::fmt::Debug for Model {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Model::Table(t) => write!(f, "Table({} in, {} out)", t.inputs, t.outputs),
            Model::Native(_) => write!(f, "Native"),
        }
    }
}

impl Model {
    pub fn native(f: impl Fn(&[Value]) -> Vec<Value> + Send + Sync + 'static) -> Model {
        Model::Native(Arc::new(f))
    }

    pub fn eval(&self, ins: &[Value]) -> Vec<Value> {
        match self {
            Model::Table(t) => t.eval(ins),
            Model::Native(f) => f(ins),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Outcome {
    /// False if values were still changing at the round limit (oscillation).
    pub settled: bool,
    /// Rounds in which something changed: the longest gate chain exercised.
    pub depth: usize,
}

#[derive(Debug)]
pub struct GateSim<'a> {
    circuit: &'a GateCircuit,
    models: Vec<Model>,
    /// Nets each cell reads, flattened.
    cell_inputs: Vec<Vec<NetId>>,
    cell_outputs: Vec<Vec<NetId>>,
    /// Cells reading each net.
    readers: Vec<Vec<usize>>,
    values: Vec<Value>,
}

impl<'a> GateSim<'a> {
    /// A simulator; `model_for` supplies each cell's model. Cell outputs
    /// start as X, undriven nets as Z, inputs as Z until set.
    pub fn new(
        circuit: &'a GateCircuit,
        model_for: impl Fn(&Cell) -> Option<Model>,
    ) -> Result<GateSim<'a>, String> {
        let mut models = Vec::with_capacity(circuit.cells.len());
        for cell in &circuit.cells {
            models.push(model_for(cell).ok_or_else(|| {
                format!(
                    "no model for `{}` (cell {})",
                    cell.kind,
                    cell.path.join("/")
                )
            })?);
        }
        let flat = |ports: &[(String, Vec<NetId>)]| -> Vec<NetId> {
            ports.iter().flat_map(|(_, n)| n.iter().copied()).collect()
        };
        let cell_inputs: Vec<Vec<NetId>> = circuit.cells.iter().map(|c| flat(&c.inputs)).collect();
        let cell_outputs: Vec<Vec<NetId>> =
            circuit.cells.iter().map(|c| flat(&c.outputs)).collect();
        let mut readers = vec![Vec::new(); circuit.net_count];
        for (i, nets) in cell_inputs.iter().enumerate() {
            for &n in nets {
                if let Some(r) = readers.get_mut(n) {
                    r.push(i);
                }
            }
        }
        let mut values = vec![Value::Z; circuit.net_count];
        for nets in &cell_outputs {
            for &n in nets {
                if let Some(v) = values.get_mut(n) {
                    *v = Value::X;
                }
            }
        }
        Ok(GateSim {
            circuit,
            models,
            cell_inputs,
            cell_outputs,
            readers,
            values,
        })
    }

    fn port(ports: &'a [(String, Vec<NetId>)], name: &str) -> Option<&'a Vec<NetId>> {
        ports.iter().find(|(n, _)| n == name).map(|(_, nets)| nets)
    }

    /// Sets an input port from a number (bit 0 = least significant).
    pub fn set_input(&mut self, name: &str, value: u64) -> Result<(), String> {
        let nets = Self::port(&self.circuit.inputs, name)
            .ok_or_else(|| format!("no input named `{name}`"))?
            .clone();
        for (i, n) in nets.iter().enumerate() {
            self.force(*n, Value::from_bit(value >> i & 1 == 1));
        }
        Ok(())
    }

    /// Sets a net's value directly (inputs, or an initial state).
    pub fn force(&mut self, net: NetId, value: Value) {
        if let Some(v) = self.values.get_mut(net) {
            *v = value;
        }
    }

    pub fn value(&self, net: NetId) -> Value {
        self.values.get(net).copied().unwrap_or(Value::X)
    }

    pub fn values(&self) -> &[Value] {
        &self.values
    }

    /// An output port's bits, least significant first.
    pub fn output(&self, name: &str) -> Option<Vec<Value>> {
        Self::port(&self.circuit.outputs, name)
            .map(|nets| nets.iter().map(|n| self.value(*n)).collect())
    }

    /// An output port as a number, if every bit is 0 or 1.
    pub fn output_number(&self, name: &str) -> Option<u64> {
        bits_to_number(&self.output(name)?)
    }

    /// Runs rounds until nothing changes (or the round limit is hit).
    pub fn settle(&mut self) -> Outcome {
        let limit = 2 * self.circuit.cells.len() + 16;
        let mut pending: BTreeSet<usize> = (0..self.circuit.cells.len()).collect();
        let mut depth = 0;
        while !pending.is_empty() {
            if depth >= limit {
                return Outcome {
                    settled: false,
                    depth,
                };
            }
            let mut changes: Vec<(NetId, Value)> = Vec::new();
            for &c in &pending {
                let ins: Vec<Value> = self.cell_inputs[c].iter().map(|n| self.value(*n)).collect();
                let outs = self.models[c].eval(&ins);
                for (net, v) in self.cell_outputs[c].iter().zip(outs) {
                    if self.value(*net) != v {
                        changes.push((*net, v));
                    }
                }
            }
            pending.clear();
            if changes.is_empty() {
                break;
            }
            depth += 1;
            for (net, v) in changes {
                if self.value(net) != v {
                    self.force(net, v);
                    if let Some(r) = self.readers.get(net) {
                        pending.extend(r.iter().copied());
                    }
                }
            }
        }
        Outcome {
            settled: true,
            depth,
        }
    }
}

/// Reads bits (least significant first) as a number; `None` if any bit is
/// X or Z.
pub fn bits_to_number(bits: &[Value]) -> Option<u64> {
    let mut n = 0u64;
    for (i, b) in bits.iter().enumerate() {
        match b {
            Value::One => n |= 1 << i,
            Value::Zero => {}
            _ => return None,
        }
    }
    Some(n)
}
