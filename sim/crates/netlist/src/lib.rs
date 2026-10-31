//! Netlist format for Sand to Tetris designs.
//!
//! M0 only fixes the format version. M2 adds loading, validation and the
//! layering rules (see `docs/PLAN.md`, section 4).

/// Version of the JSON design format. Bump when saved designs would no
/// longer load, and add a migration so learners never lose work.
pub const FORMAT_VERSION: u32 = 1;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_version_starts_at_one() {
        assert_eq!(FORMAT_VERSION, 1);
    }
}
