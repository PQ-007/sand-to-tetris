//! Flattening: replace every component part by its (unlocked) design,
//! recursively, until only transistors and supply rails remain.

use std::collections::HashMap;

use crate::design::{Design, Endpoint};
use crate::level::Level;
use crate::validate::{validate, Library, Primitive, Problem};

pub type NetId = usize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mos {
    /// Conducts when its gate is 1.
    N,
    /// Conducts when its gate is 0.
    P,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transistor {
    pub kind: Mos,
    pub gate: NetId,
    pub source: NetId,
    pub drain: NetId,
    /// Part ids from the top design down, e.g. `["g1", "p2"]`.
    pub path: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rail {
    pub net: NetId,
    /// VDD (1) or GND (0).
    pub high: bool,
    pub path: Vec<String>,
}

/// A design flattened to transistors and rails over numbered nets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Circuit {
    pub net_count: usize,
    pub transistors: Vec<Transistor>,
    pub rails: Vec<Rail>,
    pub inputs: Vec<(String, NetId)>,
    pub outputs: Vec<(String, NetId)>,
    /// Net of every port and every top-level part pin, sorted.
    pub endpoints: Vec<(Endpoint, NetId)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FlattenError {
    /// A design (the top one or a component inside it) has errors.
    Invalid {
        component: String,
        problems: Vec<Problem>,
    },
    /// A component used as a part has no level or no unlocked design.
    Missing { component: String },
    /// Nesting deeper than any real design needs; guards against loops.
    TooDeep,
}

impl std::fmt::Display for FlattenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FlattenError::Invalid {
                component,
                problems,
            } => {
                write!(f, "the `{component}` design has problems:")?;
                for p in problems {
                    write!(f, "\n  - {p}")?;
                }
                Ok(())
            }
            FlattenError::Missing { component } => {
                write!(f, "no unlocked design for `{component}`")
            }
            FlattenError::TooDeep => write!(f, "components are nested too deeply"),
        }
    }
}

impl std::error::Error for FlattenError {}

const MAX_DEPTH: usize = 32;

/// A connection point: the path to a component instance (or to a part)
/// plus a port or pin name. A part's pin and the matching port inside that
/// part's own design have the *same* key, so they join automatically.
type Key = (Vec<String>, String);

#[derive(Default)]
struct Builder {
    keys: HashMap<Key, usize>,
    parent: Vec<usize>,
    transistors: Vec<(Mos, [usize; 3], Vec<String>)>,
    rails: Vec<(usize, bool, Vec<String>)>,
}

impl Builder {
    fn node(&mut self, key: Key) -> usize {
        let next = self.parent.len();
        let id = *self.keys.entry(key).or_insert(next);
        if id == next {
            self.parent.push(id);
        }
        id
    }

    fn find(&mut self, mut x: usize) -> usize {
        while self.parent[x] != x {
            self.parent[x] = self.parent[self.parent[x]];
            x = self.parent[x];
        }
        x
    }

    fn union(&mut self, a: usize, b: usize) {
        let (ra, rb) = (self.find(a), self.find(b));
        if ra != rb {
            self.parent[ra] = rb;
        }
    }

    fn key(prefix: &[String], end: &Endpoint) -> Key {
        match end {
            Endpoint::Port { port } => (prefix.to_vec(), port.clone()),
            Endpoint::Pin { part, pin } => {
                let mut p = prefix.to_vec();
                p.push(part.clone());
                (p, pin.clone())
            }
        }
    }

    fn instance(
        &mut self,
        prefix: &[String],
        design: &Design,
        library: &Library,
    ) -> Result<(), FlattenError> {
        if prefix.len() > MAX_DEPTH {
            return Err(FlattenError::TooDeep);
        }
        for w in &design.wires {
            let a = self.node(Self::key(prefix, &w.from));
            let b = self.node(Self::key(prefix, &w.to));
            self.union(a, b);
        }
        for part in &design.parts {
            let mut path = prefix.to_vec();
            path.push(part.id.clone());
            let pin = |b: &mut Builder, name: &str| b.node((path.clone(), name.to_string()));
            match Primitive::from_kind(&part.kind) {
                Some(Primitive::Nmos) | Some(Primitive::Pmos) => {
                    let kind = if part.kind == "nmos" { Mos::N } else { Mos::P };
                    let nodes = [pin(self, "gate"), pin(self, "source"), pin(self, "drain")];
                    self.transistors.push((kind, nodes, path.clone()));
                }
                Some(rail @ (Primitive::Vdd | Primitive::Gnd)) => {
                    let n = pin(self, "out");
                    self.rails.push((n, rail == Primitive::Vdd, path.clone()));
                }
                None => {
                    let (level, inner) = component(&part.kind, library)?;
                    for port in level.ports() {
                        pin(self, port);
                    }
                    self.instance(&path, inner, library)?;
                }
            }
        }
        Ok(())
    }
}

fn component<'a>(
    kind: &str,
    library: &'a Library,
) -> Result<(&'a Level, &'a Design), FlattenError> {
    let missing = || FlattenError::Missing {
        component: kind.to_string(),
    };
    let level = library.level(kind).ok_or_else(missing)?;
    let design = library.design(kind).ok_or_else(missing)?;
    let errors: Vec<Problem> = validate(level, design, library)
        .into_iter()
        .filter(Problem::is_error)
        .collect();
    if !errors.is_empty() {
        return Err(FlattenError::Invalid {
            component: kind.to_string(),
            problems: errors,
        });
    }
    Ok((level, design))
}

/// Validates `design` and flattens it, with every component part replaced
/// by its unlocked design from `library`.
pub fn flatten(level: &Level, design: &Design, library: &Library) -> Result<Circuit, FlattenError> {
    flatten_with(level, design, library, Problem::is_error)
}

/// Like [`flatten`], but for the editor's live view of a design that is
/// still being built: only problems that make simulation impossible stop
/// it (see [`Problem::blocks_preview`]); an unconnected output does not.
pub fn flatten_preview(
    level: &Level,
    design: &Design,
    library: &Library,
) -> Result<Circuit, FlattenError> {
    flatten_with(level, design, library, Problem::blocks_preview)
}

fn flatten_with(
    level: &Level,
    design: &Design,
    library: &Library,
    blocks: fn(&Problem) -> bool,
) -> Result<Circuit, FlattenError> {
    let errors: Vec<Problem> = validate(level, design, library)
        .into_iter()
        .filter(blocks)
        .collect();
    if !errors.is_empty() {
        return Err(FlattenError::Invalid {
            component: level.id.clone(),
            problems: errors,
        });
    }

    let mut b = Builder::default();
    let top_ports: Vec<(String, usize)> = level
        .ports()
        .map(|p| (p.clone(), b.node((vec![], p.clone()))))
        .collect();
    b.instance(&[], design, library)?;

    // Number the nets densely, in order of first appearance.
    let mut dense: HashMap<usize, NetId> = HashMap::new();
    let mut net = |b: &mut Builder, node: usize| {
        let root = b.find(node);
        let next = dense.len();
        *dense.entry(root).or_insert(next)
    };
    let mut inputs = Vec::new();
    let mut outputs = Vec::new();
    for (name, node) in &top_ports {
        let id = net(&mut b, *node);
        if level.is_input(name) {
            inputs.push((name.clone(), id));
        } else {
            outputs.push((name.clone(), id));
        }
    }
    let raw_t = std::mem::take(&mut b.transistors);
    let transistors = raw_t
        .into_iter()
        .map(|(kind, [g, s, d], path)| Transistor {
            kind,
            gate: net(&mut b, g),
            source: net(&mut b, s),
            drain: net(&mut b, d),
            path,
        })
        .collect();
    let raw_r = std::mem::take(&mut b.rails);
    let rails = raw_r
        .into_iter()
        .map(|(n, high, path)| Rail {
            net: net(&mut b, n),
            high,
            path,
        })
        .collect();
    // Every endpoint visible in the top design (its ports and its parts'
    // pins), so the editor can label each wire with its value.
    let mut visible: Vec<(Endpoint, usize)> = b
        .keys
        .iter()
        .filter_map(|((path, name), &node)| match path.as_slice() {
            [] => Some((Endpoint::Port { port: name.clone() }, node)),
            [part] if design.parts.iter().any(|p| &p.id == part) => Some((
                Endpoint::Pin {
                    part: part.clone(),
                    pin: name.clone(),
                },
                node,
            )),
            _ => None,
        })
        .collect();
    visible.sort();
    let endpoints = visible
        .into_iter()
        .map(|(e, node)| (e, net(&mut b, node)))
        .collect();
    // Count every node so unconnected pins still get their own net.
    for node in 0..b.parent.len() {
        net(&mut b, node);
    }

    Ok(Circuit {
        net_count: dense.len(),
        transistors,
        rails,
        inputs,
        outputs,
        endpoints,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testutil::*;

    #[test]
    fn flattens_a_cmos_inverter() {
        let c = flatten(&not_level(), &not_design(), &library()).unwrap();
        assert_eq!(c.transistors.len(), 2);
        assert_eq!(c.rails.len(), 2);
        let a = c.inputs[0].1;
        let out = c.outputs[0].1;
        let p = c.transistors.iter().find(|t| t.kind == Mos::P).unwrap();
        let n = c.transistors.iter().find(|t| t.kind == Mos::N).unwrap();
        // Both gates on `a`; both drains on `out`.
        assert_eq!((p.gate, n.gate), (a, a));
        assert_eq!((p.drain, n.drain), (out, out));
        let vdd = c.rails.iter().find(|r| r.high).unwrap().net;
        let gnd = c.rails.iter().find(|r| !r.high).unwrap().net;
        assert_eq!((p.source, n.source), (vdd, gnd));
        assert_eq!(c.net_count, 4); // a, out, vdd, gnd
        assert_eq!(p.path, ["p1"]);
    }

    #[test]
    fn flattens_nested_components_with_paths() {
        // buf = not(not(a)), using the unlocked `not`.
        let mut lib = library();
        lib.unlock(not_design());
        let buf = level("buf", 1, &["a"], &["out"]);
        lib.add_level(buf.clone());
        let d = design(
            "buf",
            &[("i1", "not"), ("i2", "not")],
            &[
                (port("a"), pin("i1", "a")),
                (pin("i1", "out"), pin("i2", "a")),
                (pin("i2", "out"), port("out")),
            ],
        );
        let c = flatten(&buf, &d, &lib).unwrap();
        assert_eq!(c.transistors.len(), 4);
        let paths: Vec<_> = c.transistors.iter().map(|t| t.path.join("/")).collect();
        assert_eq!(paths, ["i1/p1", "i1/n1", "i2/p1", "i2/n1"]);
        // i1's output drives i2's gates.
        let mid = c.transistors[0].drain;
        assert_eq!(c.transistors[2].gate, mid);
        assert_eq!(c.transistors[3].gate, mid);
        // Two VDD rails and two GND rails, each instance has its own.
        assert_eq!(c.rails.len(), 4);
    }

    #[test]
    fn refuses_invalid_designs() {
        let err = flatten(&not_level(), &design("not", &[], &[]), &library()).unwrap_err();
        assert_eq!(
            err.to_string(),
            "the `not` design has problems:\n  - output `out` isn't connected to anything"
        );
    }

    #[test]
    fn lists_the_net_of_every_visible_endpoint() {
        let c = flatten(&not_level(), &not_design(), &library()).unwrap();
        let net_of = |e: Endpoint| c.endpoints.iter().find(|(x, _)| *x == e).map(|(_, n)| *n);
        let out = c.outputs[0].1;
        assert_eq!(net_of(port("out")), Some(out));
        assert_eq!(net_of(pin("p1", "drain")), Some(out));
        assert_eq!(net_of(pin("n1", "drain")), Some(out));
        assert_eq!(net_of(pin("p1", "gate")), Some(c.inputs[0].1));
        // 2 ports + 3 + 3 transistor pins + 2 rail pins
        assert_eq!(c.endpoints.len(), 10);
    }

    #[test]
    fn nested_internals_are_not_visible_endpoints() {
        let mut lib = library();
        lib.unlock(not_design());
        let buf = level("buf", 1, &["a"], &["out"]);
        let d = design(
            "buf",
            &[("i1", "not")],
            &[(port("a"), pin("i1", "a")), (pin("i1", "out"), port("out"))],
        );
        let c = flatten(&buf, &d, &lib).unwrap();
        let shown: Vec<String> = c.endpoints.iter().map(|(e, _)| e.to_string()).collect();
        assert_eq!(shown, ["port `a`", "port `out`", "`i1.a`", "`i1.out`"]);
    }

    #[test]
    fn preview_simulates_unfinished_designs_but_strict_does_not() {
        let lib = library();
        // Only the pull-up so far; output not yet wired.
        let d = design(
            "not",
            &[("p1", "pmos"), ("v", "vdd")],
            &[
                (port("a"), pin("p1", "gate")),
                (pin("v", "out"), pin("p1", "source")),
            ],
        );
        assert!(flatten(&not_level(), &d, &lib).is_err());
        let c = flatten_preview(&not_level(), &d, &lib).unwrap();
        assert_eq!(c.transistors.len(), 1);
        // Unknown parts still block the preview.
        let bad = design("not", &[("q", "flux")], &[]);
        assert!(flatten_preview(&not_level(), &bad, &lib).is_err());
    }

    #[test]
    fn unconnected_pins_get_their_own_nets() {
        let lib = library();
        let mut d = not_design();
        d.wires
            .retain(|w| w.to != pin("n1", "source") && w.from != pin("n1", "source"));
        let c = flatten(&not_level(), &d, &lib).unwrap();
        let n = c.transistors.iter().find(|t| t.kind == Mos::N).unwrap();
        assert!(c.rails.iter().all(|r| r.net != n.source));
        assert_eq!(c.net_count, 5);
    }
}
