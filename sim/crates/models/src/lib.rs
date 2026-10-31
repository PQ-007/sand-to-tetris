//! Native models of components: fast, behavioural versions with the same
//! ports as the learner's designs. They serve two purposes:
//!
//! 1. **Reference behaviour** for levels too big to list every input
//!    (a 16-bit adder has 2³² input combinations), checked with random
//!    inputs.
//! 2. **Fast models** for the abstraction swap: once a learner's design
//!    matches the model, the simulator may use the model instead.
//!
//! A model receives the input bits flattened in port order (each port least
//! significant bit first) and returns output bits the same way. Any unknown
//! (X/Z) input makes every output X: simpler than gate-level precision, and
//! fine for a model that only runs after a design is known to be correct.

use s2t_netlist::Value;

/// A model: input widths, output widths, and a function on whole words.
pub struct NativeModel {
    pub id: &'static str,
    pub inputs: &'static [u32],
    pub outputs: &'static [u32],
    pub f: fn(&[u64]) -> Vec<u64>,
}

const fn mask(w: u32) -> u64 {
    if w >= 64 {
        u64::MAX
    } else {
        (1 << w) - 1
    }
}

impl NativeModel {
    /// Evaluates on bits, as the gate engine does.
    pub fn eval_bits(&self, ins: &[Value]) -> Vec<Value> {
        let total: u32 = self.outputs.iter().sum();
        let Some(words) = words(ins, self.inputs) else {
            return vec![Value::X; total as usize];
        };
        let outs = (self.f)(&words);
        let mut bits = Vec::with_capacity(total as usize);
        for (w, &width) in outs.iter().zip(self.outputs) {
            for i in 0..width {
                bits.push(Value::from_bit(w >> i & 1 == 1));
            }
        }
        bits
    }

    /// Evaluates on whole words (masked to their widths).
    pub fn eval_words(&self, ins: &[u64]) -> Vec<u64> {
        let masked: Vec<u64> = ins
            .iter()
            .zip(self.inputs)
            .map(|(v, w)| v & mask(*w))
            .collect();
        (self.f)(&masked)
            .into_iter()
            .zip(self.outputs)
            .map(|(v, w)| v & mask(*w))
            .collect()
    }
}

/// Splits flattened bits into words; `None` if any bit is X or Z.
pub fn words(bits: &[Value], widths: &[u32]) -> Option<Vec<u64>> {
    let mut out = Vec::with_capacity(widths.len());
    let mut i = 0usize;
    for &w in widths {
        let mut word = 0u64;
        for b in 0..w {
            match bits.get(i)? {
                Value::One => word |= 1 << b,
                Value::Zero => {}
                _ => return None,
            }
            i += 1;
        }
        out.push(word);
    }
    Some(out)
}

const W16: u64 = 0xffff;

fn arg(x: &[u64], i: usize) -> u64 {
    x.get(i).copied().unwrap_or(0)
}

static MODELS: &[NativeModel] = &[
    NativeModel {
        id: "not16",
        inputs: &[16],
        outputs: &[16],
        f: |x| vec![!arg(x, 0) & W16],
    },
    NativeModel {
        id: "and16",
        inputs: &[16, 16],
        outputs: &[16],
        f: |x| vec![arg(x, 0) & arg(x, 1)],
    },
    NativeModel {
        id: "or16",
        inputs: &[16, 16],
        outputs: &[16],
        f: |x| vec![arg(x, 0) | arg(x, 1)],
    },
    NativeModel {
        id: "mux16",
        inputs: &[16, 16, 1],
        outputs: &[16],
        f: |x| vec![if arg(x, 2) == 1 { arg(x, 1) } else { arg(x, 0) }],
    },
    NativeModel {
        id: "mux4way16",
        inputs: &[16, 16, 16, 16, 2],
        outputs: &[16],
        f: |x| vec![arg(x, arg(x, 4) as usize)],
    },
    NativeModel {
        id: "add16",
        inputs: &[16, 16],
        outputs: &[16],
        f: |x| vec![(arg(x, 0) + arg(x, 1)) & W16],
    },
    NativeModel {
        id: "inc16",
        inputs: &[16],
        outputs: &[16],
        f: |x| vec![(arg(x, 0) + 1) & W16],
    },
];

/// The native model with this id, if there is one.
pub fn model(id: &str) -> Option<&'static NativeModel> {
    MODELS.iter().find(|m| m.id == id)
}

/// Every model id (for tests and tooling).
pub fn ids() -> impl Iterator<Item = &'static str> {
    MODELS.iter().map(|m| m.id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use Value::{One, Zero, X};

    fn bits(n: u64, w: u32) -> Vec<Value> {
        (0..w).map(|i| Value::from_bit(n >> i & 1 == 1)).collect()
    }

    #[test]
    fn adder_wraps_at_16_bits() {
        let m = model("add16").unwrap();
        assert_eq!(m.eval_words(&[0xffff, 1]), vec![0]);
        assert_eq!(m.eval_words(&[1234, 4321]), vec![5555]);
        let mut ins = bits(3, 16);
        ins.extend(bits(4, 16));
        assert_eq!(m.eval_bits(&ins), bits(7, 16));
    }

    #[test]
    fn mux_selects_by_number() {
        let m = model("mux4way16").unwrap();
        assert_eq!(m.eval_words(&[10, 20, 30, 40, 2]), vec![30]);
        assert_eq!(model("mux16").unwrap().eval_words(&[5, 9, 1]), vec![9]);
    }

    #[test]
    fn unknown_inputs_make_outputs_unknown() {
        let m = model("not16").unwrap();
        let mut ins = bits(0, 16);
        ins[3] = X;
        assert_eq!(m.eval_bits(&ins), vec![X; 16]);
        assert_eq!(m.eval_bits(&bits(0, 16))[0], One);
        assert_eq!(m.eval_bits(&bits(0xffff, 16))[15], Zero);
    }

    #[test]
    fn ids_are_unique() {
        let mut all: Vec<_> = ids().collect();
        let n = all.len();
        all.sort();
        all.dedup();
        assert_eq!(all.len(), n);
        assert!(model("nope").is_none());
    }
}
