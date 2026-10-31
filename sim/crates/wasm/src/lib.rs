//! The JavaScript-facing API of the simulator core.
//!
//! Keep this surface small (load, set inputs, step, read, check). Logic
//! belongs in the other crates so it is tested natively and shared with CI.

use wasm_bindgen::prelude::*;

/// Identifies the loaded core, e.g. `"0.1.0 (format 1)"`. The site shows
/// it so a stale WASM build is easy to spot.
#[wasm_bindgen(js_name = coreVersion)]
pub fn core_version() -> String {
    format!(
        "{} (format {})",
        env!("CARGO_PKG_VERSION"),
        s2t_netlist::FORMAT_VERSION
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_version_names_crate_and_format() {
        assert_eq!(core_version(), "0.1.0 (format 1)");
    }
}
