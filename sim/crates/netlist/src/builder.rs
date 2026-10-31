//! Small helpers for building designs and levels in code (tests, tools).

use crate::design::{Design, Endpoint, Part, Wire};
use crate::level::Level;
use crate::FORMAT_VERSION;

pub fn port(name: &str) -> Endpoint {
    Endpoint::Port {
        port: name.to_string(),
    }
}

pub fn pin(part: &str, pin: &str) -> Endpoint {
    Endpoint::Pin {
        part: part.to_string(),
        pin: pin.to_string(),
    }
}

/// A design from `(id, kind)` parts and `(from, to)` wires.
pub fn design(component: &str, parts: &[(&str, &str)], wires: &[(Endpoint, Endpoint)]) -> Design {
    Design {
        format: FORMAT_VERSION,
        component: component.to_string(),
        parts: parts
            .iter()
            .map(|(id, kind)| Part {
                id: id.to_string(),
                kind: kind.to_string(),
                pos: None,
                width: None,
                repeat: None,
                shared: vec![],
            })
            .collect(),
        wires: wires
            .iter()
            .map(|(from, to)| Wire {
                from: from.clone(),
                to: to.clone(),
                points: vec![],
            })
            .collect(),
        port_pos: Default::default(),
    }
}

/// A minimal level with an empty truth table.
pub fn level(id: &str, layer: u8, inputs: &[&str], outputs: &[&str]) -> Level {
    Level {
        id: id.to_string(),
        name: id.to_uppercase(),
        layer,
        goal: String::new(),
        inputs: inputs.iter().map(|s| s.to_string()).collect(),
        outputs: outputs.iter().map(|s| s.to_string()).collect(),
        requires: vec![],
        optional: false,
        truth_table: String::new(),
        widths: Default::default(),
        model: None,
        random_tests: None,
        hints: Default::default(),
    }
}

/// The CMOS inverter: PMOS from VDD to out, NMOS from out to GND.
pub fn not_design() -> Design {
    design(
        "not",
        &[("p1", "pmos"), ("n1", "nmos"), ("v", "vdd"), ("g", "gnd")],
        &[
            (port("a"), pin("p1", "gate")),
            (port("a"), pin("n1", "gate")),
            (pin("v", "out"), pin("p1", "source")),
            (pin("p1", "drain"), port("out")),
            (pin("n1", "drain"), port("out")),
            (pin("g", "out"), pin("n1", "source")),
        ],
    )
}

/// A design part with options (bus width, repeat, shared pins).
pub fn part_with(
    id: &str,
    kind: &str,
    width: Option<u32>,
    repeat: Option<u32>,
    shared: &[&str],
) -> Part {
    Part {
        id: id.to_string(),
        kind: kind.to_string(),
        pos: None,
        width,
        repeat,
        shared: shared.iter().map(|s| s.to_string()).collect(),
    }
}
