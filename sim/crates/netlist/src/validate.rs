//! Structural checks and the layering rule.
//!
//! Layering is enforced here, in the core, not only by hiding parts in the
//! editor's toolbox: an imported or hand-edited file gets the same errors.

use std::collections::{BTreeMap, BTreeSet};

use crate::design::{Design, Endpoint, Part};
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
    /// A part's options (width, repeat, shared pins) don't make sense.
    BadPart {
        part: String,
        reason: String,
    },
    /// A wire joins two ends of different widths.
    WidthMismatch {
        from: String,
        from_width: u32,
        to: String,
        to_width: u32,
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

    /// Errors that make even a live preview impossible. An unconnected
    /// output is normal while building, so it doesn't block the preview.
    pub fn blocks_preview(&self) -> bool {
        self.is_error() && !matches!(self, Problem::OutputUnconnected { .. })
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
            | Problem::BadPart { part, .. }
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

impl Problem {
    /// A stable code naming the kind of problem, so the website can show
    /// the message in the learner's language (with [`Problem::args`]).
    pub fn code(&self) -> &'static str {
        match self {
            Problem::ComponentMismatch { .. } => "component-mismatch",
            Problem::DuplicatePart { .. } => "duplicate-part",
            Problem::UnknownKind { .. } => "unknown-kind",
            Problem::PrimitiveNotAllowed { .. } => "primitive-not-allowed",
            Problem::LayerViolation { .. } => "layer-violation",
            Problem::NotUnlocked { .. } => "not-unlocked",
            Problem::SelfReference { .. } => "self-reference",
            Problem::DependencyCycle { .. } => "dependency-cycle",
            Problem::UnknownPort { .. } => "unknown-port",
            Problem::UnknownPart { .. } => "unknown-part",
            Problem::UnknownPin { .. } => "unknown-pin",
            Problem::OutputUnconnected { .. } => "output-unconnected",
            Problem::BadPart { .. } => "bad-part",
            Problem::WidthMismatch { .. } => "width-mismatch",
            Problem::InputUnused { .. } => "input-unused",
            Problem::PinUnconnected { .. } => "pin-unconnected",
        }
    }

    /// The values a message about this problem mentions, by name (lists are
    /// already joined the way the English message joins them).
    pub fn args(&self) -> std::collections::BTreeMap<String, String> {
        let pairs: Vec<(&str, String)> = match self {
            Problem::ComponentMismatch { design, level } => {
                vec![("design", design.clone()), ("level", level.clone())]
            }
            Problem::DuplicatePart { part }
            | Problem::SelfReference { part }
            | Problem::UnknownPart { part } => vec![("part", part.clone())],
            Problem::UnknownKind { part, kind } | Problem::NotUnlocked { part, kind } => {
                vec![("part", part.clone()), ("kind", kind.clone())]
            }
            Problem::PrimitiveNotAllowed { part, kind, layer } => vec![
                ("part", part.clone()),
                ("kind", kind.clone()),
                ("layer", layer.to_string()),
            ],
            Problem::LayerViolation {
                part,
                kind,
                kind_layer,
                layer,
            } => vec![
                ("part", part.clone()),
                ("kind", kind.clone()),
                ("kind_layer", kind_layer.to_string()),
                ("layer", layer.to_string()),
            ],
            Problem::DependencyCycle { path } => vec![("path", path.join(" → "))],
            Problem::UnknownPort { port, valid } => {
                vec![("port", port.clone()), ("valid", list(valid))]
            }
            Problem::UnknownPin {
                part,
                kind,
                pin,
                valid,
            } => vec![
                ("part", part.clone()),
                ("kind", kind.clone()),
                ("pin", pin.clone()),
                ("valid", list(valid)),
            ],
            Problem::OutputUnconnected { port } | Problem::InputUnused { port } => {
                vec![("port", port.clone())]
            }
            Problem::BadPart { part, reason } => {
                vec![("part", part.clone()), ("reason", reason.clone())]
            }
            Problem::WidthMismatch {
                from,
                from_width,
                to,
                to_width,
            } => vec![
                ("from", from.clone()),
                ("from_width", from_width.to_string()),
                ("to", to.clone()),
                ("to_width", to_width.to_string()),
            ],
            Problem::PinUnconnected { part, pin } => {
                vec![("part", part.clone()), ("pin", pin.clone())]
            }
        };
        pairs.into_iter().map(|(k, v)| (k.to_string(), v)).collect()
    }
}

fn bits(n: u32) -> &'static str {
    if n == 1 {
        "bit"
    } else {
        "bits"
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
            Problem::BadPart { part, reason } => write!(f, "part `{part}`: {reason}"),
            Problem::WidthMismatch {
                from,
                from_width,
                to,
                to_width,
            } => write!(
                f,
                "a wire joins {from} ({from_width} {}) to {to} ({to_width} {}); both ends must have the same width",
                bits(*from_width),
                bits(*to_width)
            ),
            Problem::InputUnused { port } => write!(f, "input `{port}` isn't used"),
            Problem::PinUnconnected { part, pin } => {
                write!(f, "`{part}.{pin}` isn't connected")
            }
        }
    }
}

/// Parts that only route bits (no logic): a splitter fans a bus out into
/// single bits named `0`..`N-1` (bit 0 is the least significant); a joiner
/// gathers them back. Available from Layer 2, where buses appear.
pub const WIRING: [&str; 2] = ["split", "join"];

/// Which way a pin carries values (for drivers in the gate-level view).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Dir {
    In,
    Out,
    /// Transistor channel ends and rails: no direction at switch level.
    Both,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PinInfo {
    pub name: String,
    pub width: u32,
    pub dir: Dir,
}

fn pin_info(name: impl Into<String>, width: u32, dir: Dir) -> PinInfo {
    PinInfo {
        name: name.into(),
        width,
        dir,
    }
}

/// Pins of a part kind, if the kind is known (ignores part options).
pub fn pins_of(kind: &str, library: &Library) -> Option<Vec<String>> {
    if let Some(p) = Primitive::from_kind(kind) {
        return Some(p.pins().iter().map(|s| s.to_string()).collect());
    }
    library.level(kind).map(|l| l.ports().cloned().collect())
}

/// Pins of a part, with widths and directions, taking its options into
/// account. `Err` explains a bad option; `Ok(None)` means an unknown kind.
pub fn part_pins(part: &Part, library: &Library) -> Result<Option<Vec<PinInfo>>, String> {
    let wiring = WIRING.contains(&part.kind.as_str());
    if part.width.is_some() && !wiring {
        return Err("only splitters and joiners have a width".into());
    }
    if part.repeat.is_some() && (wiring || Primitive::from_kind(&part.kind).is_some()) {
        return Err("only components can be repeated".into());
    }
    if !part.shared.is_empty() && part.repeat.is_none() {
        return Err("shared pins only make sense on a repeated component".into());
    }
    if let Some(p) = Primitive::from_kind(&part.kind) {
        let dir = |name: &str| {
            if name == "gate" {
                Dir::In
            } else if name == "out" {
                Dir::Out
            } else {
                Dir::Both
            }
        };
        return Ok(Some(
            p.pins().iter().map(|n| pin_info(*n, 1, dir(n))).collect(),
        ));
    }
    if wiring {
        let n = part.width.ok_or("a splitter or joiner needs a width")?;
        if !(2..=64).contains(&n) {
            return Err(format!("width {n} isn't allowed; use 2 to 64"));
        }
        let singles = (0..n).map(|i| i.to_string());
        return Ok(Some(if part.kind == "split" {
            std::iter::once(pin_info("in", n, Dir::In))
                .chain(singles.map(|s| pin_info(s, 1, Dir::Out)))
                .collect()
        } else {
            singles
                .map(|s| pin_info(s, 1, Dir::In))
                .chain(std::iter::once(pin_info("out", n, Dir::Out)))
                .collect()
        }));
    }
    let Some(level) = library.level(&part.kind) else {
        return Ok(None);
    };
    let r = part.repeat.unwrap_or(1);
    if !(1..=64).contains(&r) {
        return Err(format!("repeat {r} isn't allowed; use 1 to 64"));
    }
    for s in &part.shared {
        if !level.is_input(s) {
            return Err(format!(
                "`{s}` can't be shared: only inputs of `{}` can",
                level.id
            ));
        }
    }
    let width = |p: &String| {
        let w = level.width(p);
        if part.shared.contains(p) {
            w
        } else {
            w * r
        }
    };
    let mut pins: Vec<PinInfo> = level
        .inputs
        .iter()
        .map(|p| pin_info(p.clone(), width(p), Dir::In))
        .collect();
    pins.extend(
        level
            .outputs
            .iter()
            .map(|p| pin_info(p.clone(), width(p), Dir::Out)),
    );
    if pins.iter().any(|p| p.width > 64) {
        return Err("repeating makes a pin wider than 64 bits".into());
    }
    Ok(Some(pins))
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
    let mut parts: BTreeMap<&str, &Part> = BTreeMap::new();
    for part in &design.parts {
        parts.entry(&part.id).or_insert(part);
        if kinds.insert(&part.id, &part.kind).is_some() {
            problems.push(Problem::DuplicatePart {
                part: part.id.clone(),
            });
            continue;
        }
        let (id, kind) = (part.id.clone(), part.kind.clone());
        if let Err(reason) = part_pins(part, library) {
            problems.push(Problem::BadPart {
                part: id.clone(),
                reason,
            });
        }
        if WIRING.contains(&part.kind.as_str()) {
            if level.layer == Primitive::LAYER {
                problems.push(Problem::BadPart {
                    part: id,
                    reason: "splitters and joiners arrive in Layer 2, with buses".into(),
                });
            }
        } else if Primitive::from_kind(&part.kind).is_some() {
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
                Endpoint::Pin { part, pin } => match parts.get(part.as_str()) {
                    None => problems.push(Problem::UnknownPart { part: part.clone() }),
                    Some(p) => {
                        if let Ok(Some(valid)) = part_pins(p, library) {
                            if !valid.iter().any(|v| &v.name == pin) {
                                let mut names: Vec<String> =
                                    valid.into_iter().map(|v| v.name).collect();
                                if names.len() > 8 {
                                    names.truncate(8);
                                    names.push("…".into());
                                }
                                problems.push(Problem::UnknownPin {
                                    part: part.clone(),
                                    kind: p.kind.clone(),
                                    pin: pin.clone(),
                                    valid: names,
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
        let width_of = |e: &Endpoint| -> Option<u32> {
            match e {
                Endpoint::Port { port } => ports.contains(port).then(|| level.width(port)),
                Endpoint::Pin { part, pin } => parts
                    .get(part.as_str())
                    .and_then(|p| part_pins(p, library).ok().flatten())
                    .and_then(|pins| pins.into_iter().find(|x| &x.name == pin))
                    .map(|x| x.width),
            }
        };
        if let (Some(a), Some(b)) = (width_of(&wire.from), width_of(&wire.to)) {
            if a != b {
                problems.push(Problem::WidthMismatch {
                    from: wire.from.to_string(),
                    from_width: a,
                    to: wire.to.to_string(),
                    to_width: b,
                });
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
        if let Ok(Some(pins)) = part_pins(part, library) {
            for pin in pins {
                let end = Endpoint::Pin {
                    part: part.id.clone(),
                    pin: pin.name.clone(),
                };
                if !wired.contains(&end) {
                    problems.push(Problem::PinUnconnected {
                        part: part.id.clone(),
                        pin: pin.name,
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
                        && !WIRING.contains(&p.kind.as_str())
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
        if Primitive::from_kind(&part.kind).is_some()
            || WIRING.contains(&part.kind.as_str())
            || part.kind == root
        {
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
    fn problems_have_codes_and_values_for_translated_messages() {
        let p = Problem::OutputUnconnected { port: "out".into() };
        assert_eq!(p.code(), "output-unconnected");
        assert_eq!(p.args(), [("port".to_string(), "out".to_string())].into());
        let w = Problem::WidthMismatch {
            from: "port `a`".into(),
            from_width: 16,
            to: "`n.a`".into(),
            to_width: 1,
        };
        assert_eq!(w.code(), "width-mismatch");
        assert_eq!(w.args().get("from_width").map(String::as_str), Some("16"));
        let c = Problem::DependencyCycle {
            path: vec!["a".into(), "b".into(), "a".into()],
        };
        assert_eq!(c.args().get("path").map(String::as_str), Some("a → b → a"));
        let u = Problem::UnknownPort {
            port: "x".into(),
            valid: vec!["a".into(), "b".into()],
        };
        assert_eq!(u.args().get("valid").map(String::as_str), Some("`a`, `b`"));
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

    fn bus_library() -> (Library, Level) {
        let mut lib = library();
        lib.unlock(not_design());
        let mut not16 = level("not16", 2, &["a"], &["out"]);
        not16.widths.insert("a".into(), 16);
        not16.widths.insert("out".into(), 16);
        lib.add_level(not16.clone());
        (lib, not16)
    }

    #[test]
    fn repeated_component_gets_wide_pins() {
        let (lib, not16) = bus_library();
        let mut d = design(
            "not16",
            &[],
            &[(port("a"), pin("n", "a")), (pin("n", "out"), port("out"))],
        );
        d.parts.push(part_with("n", "not", None, Some(16), &[]));
        assert_eq!(validate(&not16, &d, &lib), vec![]);
        let pins = part_pins(&d.parts[0], &lib).unwrap().unwrap();
        assert_eq!((pins[0].width, pins[0].dir), (16, Dir::In));
    }

    #[test]
    fn width_mismatches_name_both_ends() {
        let (lib, not16) = bus_library();
        let d = design(
            "not16",
            &[("n", "not")],
            &[(port("a"), pin("n", "a")), (pin("n", "out"), port("out"))],
        );
        let msgs: Vec<String> = validate(&not16, &d, &lib)
            .iter()
            .map(|p| p.to_string())
            .collect();
        assert_eq!(
            msgs[0],
            "a wire joins port `a` (16 bits) to `n.a` (1 bit); both ends must have the same width"
        );
    }

    #[test]
    fn splitters_and_joiners_route_bits() {
        let (lib, not16) = bus_library();
        let mut d = design(
            "not16",
            &[],
            &[
                (port("a"), pin("s", "in")),
                (pin("s", "15"), pin("j", "0")),
                (pin("j", "out"), port("out")),
            ],
        );
        d.parts.push(part_with("s", "split", Some(16), None, &[]));
        d.parts.push(part_with("j", "join", Some(16), None, &[]));
        let errors: Vec<_> = validate(&not16, &d, &lib)
            .into_iter()
            .filter(Problem::is_error)
            .collect();
        assert_eq!(errors, vec![]);
        // Splitter pins are named by bit; asking for bit 16 fails.
        let bad = design("not16", &[], &[(pin("s", "16"), port("out"))]);
        let mut bad = bad;
        bad.parts.push(part_with("s", "split", Some(16), None, &[]));
        assert!(validate(&not16, &bad, &lib)
            .iter()
            .any(|p| p.to_string().starts_with("a wire goes to `s.16`")));
    }

    #[test]
    fn bad_part_options_are_explained() {
        let (lib, not16) = bus_library();
        let mut d = design("not16", &[], &[]);
        d.parts.push(part_with("s", "split", None, None, &[]));
        d.parts.push(part_with("t", "nmos", None, Some(2), &[]));
        d.parts.push(part_with("u", "not", None, Some(4), &["out"]));
        let msgs: Vec<String> = validate(&not16, &d, &lib)
            .iter()
            .filter(|p| matches!(p, Problem::BadPart { .. }))
            .map(|p| p.to_string())
            .collect();
        assert_eq!(
            msgs,
            [
                "part `s`: a splitter or joiner needs a width",
                "part `t`: only components can be repeated",
                "part `u`: `out` can't be shared: only inputs of `not` can",
            ]
        );
        // And wiring parts don't exist in Layer 1.
        let mut d1 = design("not", &[], &[]);
        d1.parts.push(part_with("s", "split", Some(2), None, &[]));
        assert!(validate(&not_level(), &d1, &lib)
            .iter()
            .any(|p| p.to_string().contains("arrive in Layer 2")));
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
