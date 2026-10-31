//! The JSON format of a learner's design (what the editor saves).
//!
//! A design is a list of parts plus wires. Each wire joins two endpoints:
//! one of the component's own ports (`{"port": "a"}`) or a pin of a part
//! (`{"part": "p1", "pin": "gate"}`). Everything wired together, directly
//! or through other wires, is one *net*. Layout fields (`pos`, `points`)
//! are for the editor; the simulator ignores them.

use serde::{Deserialize, Serialize};

use crate::FORMAT_VERSION;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Design {
    pub format: u32,
    /// Which component (level id) this design implements.
    pub component: String,
    #[serde(default)]
    pub parts: Vec<Part>,
    #[serde(default)]
    pub wires: Vec<Wire>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Part {
    pub id: String,
    /// A primitive (`nmos`, `pmos`, `vdd`, `gnd`) or a component id.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pos: Option<[f64; 2]>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Wire {
    pub from: Endpoint,
    pub to: Endpoint,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<[f64; 2]>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Endpoint {
    Port { port: String },
    Pin { part: String, pin: String },
}

impl std::fmt::Display for Endpoint {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Endpoint::Port { port } => write!(f, "port `{port}`"),
            Endpoint::Pin { part, pin } => write!(f, "`{part}.{pin}`"),
        }
    }
}

/// Error reading a design file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DesignParseError(pub String);

impl std::fmt::Display for DesignParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "couldn't read design: {}", self.0)
    }
}

impl std::error::Error for DesignParseError {}

impl Design {
    pub fn from_json(text: &str) -> Result<Design, DesignParseError> {
        let design: Design =
            serde_json::from_str(text).map_err(|e| DesignParseError(e.to_string()))?;
        if design.format != FORMAT_VERSION {
            return Err(DesignParseError(format!(
                "format version {} isn't supported (expected {FORMAT_VERSION})",
                design.format
            )));
        }
        Ok(design)
    }

    pub fn to_json(&self) -> String {
        // Serializing plain data structs cannot fail.
        serde_json::to_string_pretty(self).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ports_and_pins_and_ignores_nothing_unknown() {
        let d = Design::from_json(
            r#"{"format":1,"component":"not",
                "parts":[{"id":"n1","kind":"nmos","pos":[10,20]}],
                "wires":[{"from":{"port":"a"},"to":{"part":"n1","pin":"gate"}}]}"#,
        )
        .unwrap();
        assert_eq!(d.parts[0].pos, Some([10.0, 20.0]));
        assert_eq!(d.wires[0].from, Endpoint::Port { port: "a".into() });
        assert_eq!(
            d.wires[0].to,
            Endpoint::Pin {
                part: "n1".into(),
                pin: "gate".into()
            }
        );
        // Round-trips.
        assert_eq!(Design::from_json(&d.to_json()).unwrap(), d);
    }

    #[test]
    fn rejects_unknown_fields_and_wrong_versions() {
        let err = Design::from_json(r#"{"format":1,"component":"x","colour":"red"}"#).unwrap_err();
        assert!(err.0.contains("unknown field `colour`"), "{err}");
        let err = Design::from_json(r#"{"format":9,"component":"x"}"#).unwrap_err();
        assert!(err.0.contains("format version 9"), "{err}");
    }
}
