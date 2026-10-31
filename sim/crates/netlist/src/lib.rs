//! Netlist format for Sand to Tetris designs: the JSON design format, level
//! definitions, validation (including the layering rule) and flattening.

pub mod builder;
pub mod design;
pub mod flatten;
pub mod gates;
pub mod level;
pub mod validate;
pub mod value;

pub use design::{Design, Endpoint, Part, Wire};
pub use flatten::{flatten, flatten_preview, Circuit, FlattenError, Mos, NetId, Rail, Transistor};
pub use gates::{flatten_gates, Cell, GateCircuit, GateError};
pub use level::Level;
pub use validate::{part_pins, validate, Dir, Library, PinInfo, Primitive, Problem, WIRING};
pub use value::Value;

/// Version of the JSON design format. Bump when saved designs would no
/// longer load, and add a migration so learners never lose work.
pub const FORMAT_VERSION: u32 = 1;

#[cfg(test)]
pub(crate) mod testutil {
    pub use crate::builder::*;
    use crate::{Level, Library};

    pub fn not_level() -> Level {
        level("not", 1, &["a"], &["out"])
    }

    /// Every test library knows the `not` level (but hasn't unlocked it).
    pub fn library() -> Library {
        let mut lib = Library::new();
        lib.add_level(not_level());
        lib
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_version_starts_at_one() {
        assert_eq!(FORMAT_VERSION, 1);
    }
}
