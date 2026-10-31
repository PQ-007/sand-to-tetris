//! Structural checks and the layering rule.
//!
//! Layering is enforced here, in the core, not only by hiding parts in the
//! editor's toolbox: an imported or hand-edited file gets the same errors.

use std::collections::{BTreeMap, BTreeSet};

use crate::design::{Design, Endpoint};
use crate::level::Level;

/// The built-in parts of Layer 1. Every higher layer is built only from
/// components the learner made in the layers below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Primitive {
    Nmos,
    Pmos,
    Vdd,
    Gnd,
}

impl Primitive {
    pub fn from_kind(kind: &str) -> Option<Primitive> {
        match kind {
            "nmos" => Some(Primitive::Nmos),
            "pmos" => Some(Primitive::Pmos),
            "vdd" => Some(Primitive::Vdd),
            "gnd" => Some(Primitive::Gnd),
            _ => None,
        }
    }

    pub fn pins(self) -> &'static [&'static str] {
        match self {
            Primitive::Nmos | Primitive::Pmos => &["gate", "source", "drain"],
            Primitive::Vdd | Primitive::Gnd => &["out"],
        }
    }

    /// The only layer whose levels may use this primitive directly.
    pub const LAYER: u8 = 1;
}

/// Every level definition, plus the designs the learner has unlocked
/// (passed). Only unlocked components may be used as parts.
#[derive(Debug, Clone, Default)]
pub struct Library {
    levels: BTreeMap<String, Level>,
    designs: BTreeMap<String, Design>,
}

impl Library {
    pub fn new() -> Library {
        Library::default()
    }

    pub fn add_level(&mut self, level: Level) {
        self.levels.insert(level.id.clone(), level);
    }

    /// Marks a component as unlocked, using this design for it.
    pub fn unlock(&mut self, design: Design) {
        self.designs.insert(design.component.clone(), design);
    }

    pub fn level(&self, id: &str) -> Option<&Level> {
        self.levels.get(id)
    }

    pub fn design(&self, id: &str) -> Option<&Design> {
        self.designs.get(id)
    }

    pub fn is_unlocked(&self, id: &str) -> bool {
        self.designs.contains_key(id)
    }

    pub fn levels(&self) -> impl Iterator<Item = &Level> {
        self.levels.values()
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Problem {
    // ---- errors ----
    ComponentMismatch {
        design: String,
        level: String,
    },
    DuplicatePart {
        part: String,
    },
    UnknownKind {
        part: String,
        kind: String,
    },
    PrimitiveNotAllowed {
        part: String,
        kind: String,
        layer: u8,
    },
    LayerViolation {
        part: String,
        kind: String,
        kind_layer: u8,
        layer: u8,
    },
    NotUnlocked {
        part: String,
        kind: String,
    },
    SelfReference {
        part: String,
    },
    DependencyCycle {
        path: Vec<String>,
    },
    UnknownPort {
        port: String,
        valid: Vec<String>,
    },
    UnknownPart {
        part: String,
    },
    UnknownPin {
        part: String,
        kind: String,
        pin: String,
        valid: Vec<String>,
    },
    OutputUnconnected {
        port: String,
    },
    // ---- warnings ----
    InputUnused {
        port: String,
    },
    PinUnconnected {
        part: String,
        pin: String,
    },
}

impl Problem {
    pub fn is_error(&self) -> bool {
        !matches!(
            self,
            Problem::InputUnused { .. } | Problem::PinUnconnected { .. }
        )
    }

    /// Part ids the editor should highlight.
    pub fn parts(&self) -> Vec<String> {
        match self {
            Problem::DuplicatePart { part }
            | Problem::UnknownKind { part, .. }
            | Problem::PrimitiveNotAllowed { part, .. }
            | Problem::LayerViolation { part, .. }
            | Problem::NotUnlocked { part, .. }
            | Problem::SelfReference { part }
            | Problem::UnknownPin { part, .. }
            | Problem::PinUnconnected { part, .. } => vec![part.clone()],
            _ => vec![],
        }
    }

    /// Ports the editor should highlight.
    pub fn ports(&self) -> Vec<String> {
        match self {
            Problem::UnknownPort { port, .. }
            | Problem::OutputUnconnected { port }
            | Problem::InputUnused { port } => vec![port.clone()],
            _ => vec![],
        }
    }
}

fn list(items: &[String]) -> String {
    items
        .iter()
        .map(|s| format!("`{s}`"))
        .collect::<Vec<_>>()
        .join(", ")
}

impl std::fmt::Display for Problem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Problem::ComponentMismatch { design, level } => write!(
                f,
                "this design is for `{design}`, but the level is `{level}`"
            ),
            Problem::DuplicatePart { part } => {
                write!(f, "two parts share the id `{part}`; ids must be unique")
            }
            Problem::UnknownKind { part, kind } => write!(
                f,
                "part `{part}` is a `{kind}`, which isn't a known part or component"
            ),
            Problem::PrimitiveNotAllowed { part, kind, layer } => write!(
                f,
                "part `{part}` is a bare `{kind}`, but this is a Layer {layer} level. \
                 Transistors and supply rails are only used directly in Layer 1; \
                 from Layer 2 on, build with the components you made"
            ),
            Problem::LayerViolation {
                part,
                kind,
                kind_layer,
                layer,
            } => write!(
                f,
                "part `{part}` is a `{kind}`, a Layer {kind_layer} component, but this is a \
                 Layer {layer} level. A Layer {layer} component can only use parts from \
                 Layer {layer} and below"
            ),
            Problem::NotUnlocked { part, kind } => write!(
                f,
                "part `{part}` is a `{kind}`, which you haven't unlocked yet: pass the \
                 `{kind}` level first"
            ),
            Problem::SelfReference { part } => {
                write!(
                    f,
                    "part `{part}` is this same component; a component can't contain itself"
                )
            }
            Problem::DependencyCycle { path } => write!(
                f,
                "components depend on each other in a loop: {}",
                path.join(" → ")
            ),
            Problem::UnknownPort { port, valid } => write!(
                f,
                "a wire goes to port `{port}`, which this component doesn't have (ports: {})",
                list(valid)
            ),
            Problem::UnknownPart { part } => {
                write!(f, "a wire goes to part `{part}`, which doesn't exist")
            }
            Problem::UnknownPin {
                part,
                kind,
                pin,
                valid,
            } => write!(
                f,
                "a wire goes to `{part}.{pin}`, but a `{kind}` has no pin `{pin}` (pins: {})",
                list(valid)
            ),
            Problem::OutputUnconnected { port } => {
                write!(f, "output `{port}` isn't connected to anything")
            }
            Problem::InputUnused { port } => write!(f, "input `{port}` isn't used"),
            Problem::PinUnconnected { part, pin } => {
                write!(f, "`{part}.{pin}` isn't connected")
            }
        }
    }
}

/// Pins of a part kind, if the kind is known.
pub fn pins_of(kind: &str, library: &Library) -> Option<Vec<String>> {
    if let Some(p) = Primitive::from_kind(kind) {
        return Some(p.pins().iter().map(|s| s.to_string()).collect());
    }
    library.level(kind).map(|l| l.ports().cloned().collect())
}

/// Checks a design against its level and the library. Returns every
/// problem found (errors and warnings), in a stable order.
pub fn validate(level: &Level, design: &Design, library: &Library) -> Vec<Problem> {
    let mut problems = Vec::new();

    if design.component != level.id {
        problems.push(Problem::ComponentMismatch {
            design: design.component.clone(),
            level: level.id.clone(),
        });
    }

    // Parts: ids and kinds, including the layering rule.
    let mut kinds: BTreeMap<&str, &str> = BTreeMap::new();
    for part in &design.parts {
        if kinds.insert(&part.id, &part.kind).is_some() {
            problems.push(Problem::DuplicatePart {
                part: part.id.clone(),
            });
            continue;
        }
        let (id, kind) = (part.id.clone(), part.kind.clone());
        if Primitive::from_kind(&part.kind).is_some() {
            if level.layer != Primitive::LAYER {
                problems.push(Problem::PrimitiveNotAllowed {
                    part: id,
                    kind,
                    layer: level.layer,
                });
            }
        } else if part.kind == level.id {
            problems.push(Problem::SelfReference { part: id });
        } else if let Some(other) = library.level(&part.kind) {
            if other.layer > level.layer {
                problems.push(Problem::LayerViolation {
                    part: id,
                    kind,
                    kind_layer: other.layer,
                    layer: level.layer,
                });
            } else if !library.is_unlocked(&part.kind) {
                problems.push(Problem::NotUnlocked { part: id, kind });
            }
        } else {
            problems.push(Problem::UnknownKind { part: id, kind });
        }
    }

    // Wires: every endpoint must exist.
    let ports: Vec<String> = level.ports().cloned().collect();
    let mut wired: BTreeSet<Endpoint> = BTreeSet::new();
    for wire in &design.wires {
        for end in [&wire.from, &wire.to] {
            match end {
                Endpoint::Port { port } => {
                    if !ports.contains(port) {
                        problems.push(Problem::UnknownPort {
                            port: port.clone(),
                            valid: ports.clone(),
                        });
                    }
                }
                Endpoint::Pin { part, pin } => match kinds.get(part.as_str()) {
                    None => problems.push(Problem::UnknownPart { part: part.clone() }),
                    Some(kind) => {
                        if let Some(valid) = pins_of(kind, library) {
                            if !valid.contains(pin) {
                                problems.push(Problem::UnknownPin {
                                    part: part.clone(),
                                    kind: kind.to_string(),
                                    pin: pin.clone(),
                                    valid,
                                });
                            }
                        }
                    }
                },
            }
            if wire.from != wire.to {
                wired.insert(end.clone());
            }
        }
    }

    // Connectivity.
    for port in &level.outputs {
        if !wired.contains(&Endpoint::Port { port: port.clone() }) {
            problems.push(Problem::OutputUnconnected { port: port.clone() });
        }
    }
    for port in &level.inputs {
        if !wired.contains(&Endpoint::Port { port: port.clone() }) {
            problems.push(Problem::InputUnused { port: port.clone() });
        }
    }
    for part in &design.parts {
        if let Some(pins) = pins_of(&part.kind, library) {
            for pin in pins {
                let end = Endpoint::Pin {
                    part: part.id.clone(),
                    pin: pin.clone(),
                };
                if !wired.contains(&end) {
                    problems.push(Problem::PinUnconnected {
                        part: part.id.clone(),
                        pin,
                    });
                }
            }
        }
    }

    // Dependency loops through other unlocked designs.
    if let Some(path) = find_cycle(&level.id, design, library) {
        problems.push(Problem::DependencyCycle { path });
    }

    problems
}

/// Depth-first search from this design's component parts through the
/// library's designs, looking for a path back to `root`.
fn find_cycle(root: &str, design: &Design, library: &Library) -> Option<Vec<String>> {
    fn visit(
        kind: &str,
        root: &str,
        library: &Library,
        path: &mut Vec<String>,
        seen: &mut BTreeSet<String>,
    ) -> bool {
        path.push(kind.to_string());
        if kind == root {
            return true;
        }
        if seen.insert(kind.to_string()) {
            if let Some(d) = library.design(kind) {
                for p in &d.parts {
                    if Primitive::from_kind(&p.kind).is_none()
                        && visit(&p.kind, root, library, path, seen)
                    {
                        return true;
                    }
                }
            }
        }
        path.pop();
        false
    }

    let mut seen = BTreeSet::new();
    for part in &design.parts {
        // Direct self-reference is reported separately.
        if Primitive::from_kind(&part.kind).is_some() || part.kind == root {
            continue;
        }
        let mut path = vec![root.to_string()];
        if visit(&part.kind, root, library, &mut path, &mut seen) {
            return Some(path);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testutil::*;

    #[test]
    fn a_correct_layer_1_design_has_no_problems() {
        let lib = library();
        assert_eq!(validate(&not_level(), &not_design(), &lib), vec![]);
    }

    #[test]
    fn reports_unknown_ports_parts_and_pins() {
        let lib = library();
        let d = design(
            "not",
            &[("n1", "nmos")],
            &[
                (port("q"), pin("n1", "gate")),
                (pin("zz", "out"), port("out")),
                (pin("n1", "base"), port("a")),
            ],
        );
        let msgs: Vec<String> = validate(&not_level(), &d, &lib)
            .iter()
            .filter(|p| p.is_error())
            .map(|p| p.to_string())
            .collect();
        assert_eq!(
            msgs,
            [
                "a wire goes to port `q`, which this component doesn't have (ports: `a`, `out`)",
                "a wire goes to part `zz`, which doesn't exist",
                "a wire goes to `n1.base`, but a `nmos` has no pin `base` (pins: `gate`, `source`, `drain`)",
            ]
        );
    }

    #[test]
    fn unconnected_output_is_an_error_unused_input_a_warning() {
        let lib = library();
        let d = design("not", &[], &[]);
        let problems = validate(&not_level(), &d, &lib);
        assert_eq!(
            problems,
            vec![
                Problem::OutputUnconnected { port: "out".into() },
                Problem::InputUnused { port: "a".into() },
            ]
        );
        assert!(problems[0].is_error() && !problems[1].is_error());
        assert_eq!(problems[0].ports(), ["out"]);
    }

    #[test]
    fn warns_about_unconnected_transistor_pins() {
        let lib = library();
        let mut d = not_design();
        d.wires
            .retain(|w| w.to != pin("n1", "source") && w.from != pin("n1", "source"));
        let problems = validate(&not_level(), &d, &lib);
        // The GND rail now leads nowhere either.
        assert_eq!(
            problems,
            vec![
                Problem::PinUnconnected {
                    part: "n1".into(),
                    pin: "source".into()
                },
                Problem::PinUnconnected {
                    part: "g".into(),
                    pin: "out".into()
                },
            ]
        );
        assert_eq!(problems[0].to_string(), "`n1.source` isn't connected");
    }

    #[test]
    fn layer_rule_higher_layer_component_is_rejected() {
        let mut lib = library();
        lib.add_level(level("mux", 2, &["a"], &["out"]));
        lib.unlock(design("mux", &[], &[]));
        let d = design("not", &[("m", "mux")], &[]);
        let errs: Vec<_> = validate(&not_level(), &d, &lib)
            .into_iter()
            .filter(Problem::is_error)
            .collect();
        assert_eq!(
            errs[0].to_string(),
            "part `m` is a `mux`, a Layer 2 component, but this is a Layer 1 level. \
             A Layer 1 component can only use parts from Layer 1 and below"
        );
        assert_eq!(errs[0].parts(), ["m"]);
    }

    #[test]
    fn layer_rule_transistors_only_in_layer_1() {
        let lib = library();
        let lvl = level("mux", 2, &["a"], &["out"]);
        let d = design("mux", &[("t", "nmos")], &[]);
        assert!(
            validate(&lvl, &d, &lib).contains(&Problem::PrimitiveNotAllowed {
                part: "t".into(),
                kind: "nmos".into(),
                layer: 2
            })
        );
    }

    #[test]
    fn locked_components_cannot_be_used() {
        let lib = library(); // `not` is defined but not unlocked
        let lvl = level("and", 1, &["a", "b"], &["out"]);
        let d = design("and", &[("i", "not")], &[]);
        let p = validate(&lvl, &d, &lib);
        assert!(p.contains(&Problem::NotUnlocked {
            part: "i".into(),
            kind: "not".into()
        }));
    }

    #[test]
    fn rejects_self_reference_and_dependency_loops() {
        let mut lib = library();
        lib.add_level(level("x", 1, &["a"], &["out"]));
        lib.add_level(level("y", 1, &["a"], &["out"]));
        // y is unlocked and (somehow) uses x; now x tries to use y.
        lib.unlock(design("y", &[("inner", "x")], &[]));
        let d = design("x", &[("me", "x"), ("other", "y")], &[]);
        let p = validate(lib.level("x").unwrap(), &d, &lib);
        assert!(p.contains(&Problem::SelfReference { part: "me".into() }));
        assert!(p.contains(&Problem::DependencyCycle {
            path: vec!["x".into(), "y".into(), "x".into()]
        }));
        assert_eq!(
            p.iter()
                .find(|q| matches!(q, Problem::DependencyCycle { .. }))
                .unwrap()
                .to_string(),
            "components depend on each other in a loop: x → y → x"
        );
    }

    #[test]
    fn detects_duplicate_ids_and_wrong_component() {
        let lib = library();
        let d = design("nand", &[("n1", "nmos"), ("n1", "pmos")], &[]);
        let p = validate(&not_level(), &d, &lib);
        assert!(p.contains(&Problem::ComponentMismatch {
            design: "nand".into(),
            level: "not".into()
        }));
        assert!(p.contains(&Problem::DuplicatePart { part: "n1".into() }));
    }
}
