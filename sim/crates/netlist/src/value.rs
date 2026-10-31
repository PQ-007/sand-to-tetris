//! The four values a wire can carry, shared by both simulation engines.

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
