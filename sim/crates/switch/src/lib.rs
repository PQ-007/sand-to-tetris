//! Switch-level simulation of a flattened circuit.
//!
//! Each transistor is a switch: an NMOS conducts when its gate is 1, a PMOS
//! when its gate is 0. Nets joined by conducting switches form a group, and
//! a group takes the value of what drives it (supply rails and inputs):
//!
//! - one driver value → that value;
//! - both 0 and 1 → `X`, and the group is reported as a **short**;
//! - no drivers → `Z` (floating).
//!
//! A gate that is `X` or `Z` makes its transistor *maybe* conducting. We
//! solve twice, with those switches off and on; any net whose value differs
//! becomes `X`. This is pessimistic on purpose: the simulator never claims
//! a value it can't be sure of. Starting from all-`X`, we repeat until
//! nothing changes.
//!
//! There is no charge storage: a floating node is `Z`, not its old value.
//! Layer 1 circuits must actively drive every output, so `Z` is an error
//! the learner should see.

use s2t_netlist::{Circuit, Mos, NetId};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Value {
    Zero,
    One,
    /// Floating: nothing drives the net.
    Z,
    /// Unknown or conflicting.
    X,
}

impl Value {
    pub fn from_bit(bit: bool) -> Value {
        if bit {
            Value::One
        } else {
            Value::Zero
        }
    }
}

impl std::fmt::Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Value::Zero => "0",
            Value::One => "1",
            Value::Z => "Z",
            Value::X => "X",
        })
    }
}

/// VDD and GND connected through conducting transistors (or inputs).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Short {
    /// Every net in the shorted group.
    pub nets: Vec<NetId>,
    /// Indices into `circuit.transistors` of the conducting switches in it.
    pub transistors: Vec<usize>,
    /// Indices into `circuit.rails` of the rails in it.
    pub rails: Vec<usize>,
    /// Names of inputs driving it.
    pub inputs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Outcome {
    /// False if values were still changing when the iteration limit hit.
    pub settled: bool,
    pub iterations: usize,
    pub shorts: Vec<Short>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnknownInput {
    pub name: String,
    pub valid: Vec<String>,
}

impl std::fmt::Display for UnknownInput {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let valid: Vec<String> = self.valid.iter().map(|v| format!("`{v}`")).collect();
        write!(
            f,
            "no input named `{}` (inputs: {})",
            self.name,
            valid.join(", ")
        )
    }
}

impl std::error::Error for UnknownInput {}

/// Whether a transistor is conducting, given its gate value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Conduct {
    Off,
    On,
    /// The gate is X or Z.
    Maybe,
}

pub struct Sim<'a> {
    circuit: &'a Circuit,
    inputs: Vec<Value>,
    values: Vec<Value>,
}

/// Union-find over nets.
struct Groups {
    parent: Vec<usize>,
}

impl Groups {
    fn new(n: usize) -> Groups {
        Groups {
            parent: (0..n).collect(),
        }
    }

    fn find(&mut self, mut x: usize) -> usize {
        while self.parent[x] != x {
            self.parent[x] = self.parent[self.parent[x]];
            x = self.parent[x];
        }
        x
    }

    fn union(&mut self, a: usize, b: usize) {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra != rb {
            self.parent[ra] = rb;
        }
    }
}

#[derive(Default, Clone, Copy)]
struct Drive {
    zero: bool,
    one: bool,
    unknown: bool,
}

impl Drive {
    fn add(&mut self, v: Value) {
        match v {
            Value::Zero => self.zero = true,
            Value::One => self.one = true,
            Value::X => self.unknown = true,
            Value::Z => {}
        }
    }

    fn value(self) -> Value {
        match (self.zero, self.one, self.unknown) {
            (_, _, true) | (true, true, _) => Value::X,
            (true, false, false) => Value::Zero,
            (false, true, false) => Value::One,
            (false, false, false) => Value::Z,
        }
    }
}

impl<'a> Sim<'a> {
    /// A simulator with every input undriven (`Z`).
    pub fn new(circuit: &'a Circuit) -> Sim<'a> {
        Sim {
            circuit,
            inputs: vec![Value::Z; circuit.inputs.len()],
            values: vec![Value::X; circuit.net_count],
        }
    }

    pub fn set_input(&mut self, name: &str, value: Value) -> Result<(), UnknownInput> {
        match self.circuit.inputs.iter().position(|(n, _)| n == name) {
            Some(i) => {
                self.inputs[i] = value;
                Ok(())
            }
            None => Err(UnknownInput {
                name: name.to_string(),
                valid: self.circuit.inputs.iter().map(|(n, _)| n.clone()).collect(),
            }),
        }
    }

    pub fn value(&self, net: NetId) -> Value {
        self.values.get(net).copied().unwrap_or(Value::X)
    }

    pub fn output(&self, name: &str) -> Option<Value> {
        self.circuit
            .outputs
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, net)| self.value(*net))
    }

    /// Whether transistor `i` (index into `circuit.transistors`) conducts.
    pub fn conduction(&self, i: usize) -> Conduct {
        match self.circuit.transistors.get(i) {
            Some(t) => self.conduct(t.kind, self.value(t.gate)),
            None => Conduct::Maybe,
        }
    }

    /// Current value of every net (for the editor's live overlay).
    pub fn values(&self) -> &[Value] {
        &self.values
    }

    fn conduct(&self, kind: Mos, gate: Value) -> Conduct {
        match (kind, gate) {
            (Mos::N, Value::One) | (Mos::P, Value::Zero) => Conduct::On,
            (Mos::N, Value::Zero) | (Mos::P, Value::One) => Conduct::Off,
            _ => Conduct::Maybe,
        }
    }

    /// Groups nets through conducting switches (`maybe` ones too if
    /// `include_maybe`), and returns each net's value plus the groups.
    fn solve(&self, include_maybe: bool) -> (Vec<Value>, Groups, Vec<Drive>) {
        let c = self.circuit;
        let mut groups = Groups::new(c.net_count);
        for t in &c.transistors {
            let state = self.conduct(t.kind, self.value(t.gate));
            if state == Conduct::On || (include_maybe && state == Conduct::Maybe) {
                groups.union(t.source, t.drain);
            }
        }
        let mut drive = vec![Drive::default(); c.net_count];
        for r in &c.rails {
            let root = groups.find(r.net);
            drive[root].add(Value::from_bit(r.high));
        }
        for (i, (_, net)) in c.inputs.iter().enumerate() {
            let root = groups.find(*net);
            drive[root].add(self.inputs[i]);
        }
        let values = (0..c.net_count)
            .map(|n| {
                let root = groups.find(n);
                drive[root].value()
            })
            .collect();
        (values, groups, drive)
    }

    /// Repeats until no net changes. Returns any shorts in the final state.
    pub fn settle(&mut self) -> Outcome {
        // Starting from all-X, values settle within a few rounds for the
        // circuits learners build; the limit only guards against runaway
        // loops, which then report `settled: false`.
        let limit = 4 * self.circuit.transistors.len() + 16;
        self.values = vec![Value::X; self.circuit.net_count];
        let mut iterations = 0;
        let mut settled = false;
        while iterations < limit {
            iterations += 1;
            let (low, _, _) = self.solve(false);
            let (high, _, _) = self.solve(true);
            let next: Vec<Value> = low
                .iter()
                .zip(&high)
                .map(|(a, b)| if a == b { *a } else { Value::X })
                .collect();
            if next == self.values {
                settled = true;
                break;
            }
            self.values = next;
        }
        Outcome {
            settled,
            iterations,
            shorts: self.shorts(),
        }
    }

    /// Groups that are definitely conducting and driven both ways.
    fn shorts(&self) -> Vec<Short> {
        let c = self.circuit;
        let (_, mut groups, drive) = self.solve(false);
        let mut found: Vec<(usize, Short)> = Vec::new();
        for n in 0..c.net_count {
            let root = groups.find(n);
            let d = drive[root];
            if !(d.zero && d.one) {
                continue;
            }
            let idx = match found.iter().position(|(r, _)| *r == root) {
                Some(i) => i,
                None => {
                    found.push((
                        root,
                        Short {
                            nets: vec![],
                            transistors: vec![],
                            rails: vec![],
                            inputs: vec![],
                        },
                    ));
                    found.len() - 1
                }
            };
            found[idx].1.nets.push(n);
        }
        for (root, short) in &mut found {
            for (i, t) in c.transistors.iter().enumerate() {
                if self.conduct(t.kind, self.value(t.gate)) == Conduct::On
                    && groups.find(t.source) == *root
                {
                    short.transistors.push(i);
                }
            }
            for (i, r) in c.rails.iter().enumerate() {
                if groups.find(r.net) == *root {
                    short.rails.push(i);
                }
            }
            for (i, (name, net)) in c.inputs.iter().enumerate() {
                if groups.find(*net) == *root && self.inputs[i] != Value::Z {
                    short.inputs.push(name.clone());
                }
            }
        }
        found.into_iter().map(|(_, s)| s).collect()
    }
}
