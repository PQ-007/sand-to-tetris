//! Level definitions (`hdl/levels/<layer>/<id>/level.toml`).
//!
//! A level fixes a component's signature (name, layer, ports), what it may
//! be built from, and how it is tested. The learner's design must match the
//! signature exactly: the editor draws the ports for them.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Level {
    pub id: String,
    pub name: String,
    pub layer: u8,
    /// Plain-language goal shown to the learner.
    pub goal: String,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    /// Levels that must be passed before this one opens.
    #[serde(default)]
    pub requires: Vec<String>,
    /// Side quests are not required to reach Tetris.
    #[serde(default)]
    pub optional: bool,
    /// Expected behaviour, as a table: `a b | out` then rows like `0 1 | 1`.
    pub truth_table: String,
    /// Width in bits of each multi-bit port (`{ a = 16 }`); others are 1.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub widths: BTreeMap<String, u32>,
    /// Authored hints keyed by failure kind: `floating`, `short`, `wrong`,
    /// `unknown`. Shown with the matching diagnostic.
    #[serde(default)]
    pub hints: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LevelParseError(pub String);

impl std::fmt::Display for LevelParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "couldn't read level: {}", self.0)
    }
}

impl std::error::Error for LevelParseError {}

impl Level {
    pub fn from_toml(text: &str) -> Result<Level, LevelParseError> {
        let level: Level = toml::from_str(text).map_err(|e| LevelParseError(e.to_string()))?;
        if level.layer == 0 {
            return Err(LevelParseError(format!(
                "level `{}`: layer must be 1 or more",
                level.id
            )));
        }
        let mut seen = std::collections::BTreeSet::new();
        for p in level.inputs.iter().chain(&level.outputs) {
            if !seen.insert(p) {
                return Err(LevelParseError(format!(
                    "level `{}`: port `{p}` is declared twice",
                    level.id
                )));
            }
        }
        for (port, w) in &level.widths {
            if !seen.contains(port) {
                return Err(LevelParseError(format!(
                    "level `{}`: `widths` names `{port}`, which isn't a port",
                    level.id
                )));
            }
            if !(1..=64).contains(w) {
                return Err(LevelParseError(format!(
                    "level `{}`: port `{port}` has width {w}; widths must be 1 to 64",
                    level.id
                )));
            }
        }
        Ok(level)
    }

    /// Width of a port in bits (1 unless listed in `widths`).
    pub fn width(&self, port: &str) -> u32 {
        self.widths.get(port).copied().unwrap_or(1)
    }

    /// Total number of input bits.
    pub fn input_bits(&self) -> u32 {
        self.inputs.iter().map(|p| self.width(p)).sum()
    }

    /// All port names, inputs first.
    pub fn ports(&self) -> impl Iterator<Item = &String> {
        self.inputs.iter().chain(&self.outputs)
    }

    pub fn is_input(&self, port: &str) -> bool {
        self.inputs.iter().any(|p| p == port)
    }

    pub fn is_output(&self, port: &str) -> bool {
        self.outputs.iter().any(|p| p == port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOT: &str = r#"
        id = "not"
        name = "NOT"
        layer = 1
        goal = "Output the opposite of the input."
        inputs = ["a"]
        outputs = ["out"]
        truth_table = """
        a | out
        0 | 1
        1 | 0
        """
        [hints]
        floating = "Connect out to both networks."
    "#;

    #[test]
    fn parses_a_level() {
        let l = Level::from_toml(NOT).unwrap();
        assert_eq!(l.id, "not");
        assert_eq!(l.ports().collect::<Vec<_>>(), ["a", "out"]);
        assert!(l.is_input("a") && l.is_output("out") && !l.is_input("out"));
        assert_eq!(l.hints["floating"], "Connect out to both networks.");
        assert!(!l.optional);
    }

    #[test]
    fn ports_can_be_buses() {
        let wide = NOT.replace("[hints]", "widths = { a = 16, out = 16 }\n[hints]");
        let l = Level::from_toml(&wide).unwrap();
        assert_eq!((l.width("a"), l.width("out"), l.input_bits()), (16, 16, 16));
        let bad = NOT.replace("[hints]", "widths = { q = 4 }\n[hints]");
        assert!(Level::from_toml(&bad)
            .unwrap_err()
            .0
            .contains("`q`, which isn't a port"));
        let zero = NOT.replace("[hints]", "widths = { a = 0 }\n[hints]");
        assert!(Level::from_toml(&zero)
            .unwrap_err()
            .0
            .contains("widths must be 1 to 64"));
    }

    #[test]
    fn rejects_duplicate_ports_and_layer_zero() {
        let dup = NOT.replace(r#"outputs = ["out"]"#, r#"outputs = ["a"]"#);
        assert!(Level::from_toml(&dup)
            .unwrap_err()
            .0
            .contains("port `a` is declared twice"));
        let zero = NOT.replace("layer = 1", "layer = 0");
        assert!(Level::from_toml(&zero)
            .unwrap_err()
            .0
            .contains("layer must be 1"));
    }
}
