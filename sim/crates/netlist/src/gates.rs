//! Gate-level flattening (Layer 2 and up): expand a design, bit by bit,
//! into *cells*: instances of leaf components that the gate engine
//! evaluates directly. Which components are leaves is the caller's choice:
//! Layer 1 gates always are (their exhaustive truth tables have been
//! checked), and a component switched to its fast model is too.
//!
//! Buses become one net per bit; splitters, joiners and repeats only
//! decide which bits connect, so they leave no cells behind.

use std::collections::HashMap;

use crate::design::{Design, Endpoint};
use crate::flatten::NetId;
use crate::level::Level;
use crate::validate::{part_pins, validate, Library, Problem, WIRING};

/// One leaf-component instance.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Cell {
    /// The component id (a level id).
    pub kind: String,
    /// Part ids from the top design down; repeated copies end in `#r`.
    pub path: Vec<String>,
    /// Per input port, its bits (least significant first).
    pub inputs: Vec<(String, Vec<NetId>)>,
    pub outputs: Vec<(String, Vec<NetId>)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GateCircuit {
    pub net_count: usize,
    pub cells: Vec<Cell>,
    pub inputs: Vec<(String, Vec<NetId>)>,
    pub outputs: Vec<(String, Vec<NetId>)>,
    /// Bits of every port and top-level part pin, sorted by endpoint.
    pub endpoints: Vec<(Endpoint, Vec<NetId>)>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum GateError {
    Invalid {
        component: String,
        problems: Vec<Problem>,
    },
    Missing {
        component: String,
    },
    TooDeep,
    /// Two outputs (or an input and an output) drive the same wire.
    MultipleDrivers {
        drivers: Vec<String>,
        parts: Vec<String>,
    },
}

impl std::fmt::Display for GateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            GateError::Invalid {
                component,
                problems,
            } => {
                write!(f, "the `{component}` design has problems:")?;
                for p in problems {
                    write!(f, "\n  - {p}")?;
                }
                Ok(())
            }
            GateError::Missing { component } => write!(f, "no unlocked design for `{component}`"),
            GateError::TooDeep => write!(f, "components are nested too deeply"),
            GateError::MultipleDrivers { drivers, .. } => write!(
                f,
                "one wire is driven by {}: two outputs fighting over one wire. \
                 Each wire needs exactly one source",
                drivers.join(" and ")
            ),
        }
    }
}

impl std::error::Error for GateError {}

const MAX_DEPTH: usize = 32;

type Key = (Vec<String>, String, u32);

/// Bits of each port, as builder nodes.
type PortNodes = Vec<(String, Vec<usize>)>;

/// A cell before net numbering: kind, path, input and output nodes.
type RawCell = (String, Vec<String>, PortNodes, PortNodes);

#[derive(Default)]
struct Builder {
    keys: HashMap<Key, usize>,
    parent: Vec<usize>,
    cells: Vec<RawCell>,
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

    fn join_keys(&mut self, a: Key, b: Key) {
        let (x, y) = (self.node(a), self.node(b));
        self.union(x, y);
    }
}

fn child(prefix: &[String], id: &str) -> Vec<String> {
    let mut p = prefix.to_vec();
    p.push(id.to_string());
    p
}

fn endpoint_key(prefix: &[String], e: &Endpoint) -> (Vec<String>, String) {
    match e {
        Endpoint::Port { port } => (prefix.to_vec(), port.clone()),
        Endpoint::Pin { part, pin } => (child(prefix, part), pin.clone()),
    }
}

/// Width of an endpoint inside `design` (already validated).
fn endpoint_width(level: &Level, design: &Design, library: &Library, e: &Endpoint) -> u32 {
    match e {
        Endpoint::Port { port } => level.width(port),
        Endpoint::Pin { part, pin } => design
            .parts
            .iter()
            .find(|p| &p.id == part)
            .and_then(|p| part_pins(p, library).ok().flatten())
            .and_then(|pins| pins.into_iter().find(|x| &x.name == pin))
            .map(|x| x.width)
            .unwrap_or(1),
    }
}

struct Ctx<'a> {
    library: &'a Library,
    is_leaf: &'a dyn Fn(&str) -> bool,
}

fn component<'a>(kind: &str, library: &'a Library) -> Result<(&'a Level, &'a Design), GateError> {
    let missing = || GateError::Missing {
        component: kind.to_string(),
    };
    let level = library.level(kind).ok_or_else(missing)?;
    let design = library.design(kind).ok_or_else(missing)?;
    let errors: Vec<Problem> = validate(level, design, library)
        .into_iter()
        .filter(Problem::is_error)
        .collect();
    if !errors.is_empty() {
        return Err(GateError::Invalid {
            component: kind.to_string(),
            problems: errors,
        });
    }
    Ok((level, design))
}

impl Builder {
    fn instance(
        &mut self,
        ctx: &Ctx,
        prefix: &[String],
        level: &Level,
        design: &Design,
    ) -> Result<(), GateError> {
        if prefix.len() > MAX_DEPTH {
            return Err(GateError::TooDeep);
        }
        for w in &design.wires {
            let width = endpoint_width(level, design, ctx.library, &w.from);
            let (pa, na) = endpoint_key(prefix, &w.from);
            let (pb, nb) = endpoint_key(prefix, &w.to);
            for bit in 0..width {
                self.join_keys((pa.clone(), na.clone(), bit), (pb.clone(), nb.clone(), bit));
            }
        }
        for part in &design.parts {
            let here = child(prefix, &part.id);
            if WIRING.contains(&part.kind.as_str()) {
                let n = part.width.unwrap_or(1);
                for i in 0..n {
                    let (bus, single) = if part.kind == "split" {
                        ("in", i.to_string())
                    } else {
                        ("out", i.to_string())
                    };
                    self.join_keys((here.clone(), bus.into(), i), (here.clone(), single, 0));
                }
                continue;
            }
            let (kind_level, inner) = if (ctx.is_leaf)(&part.kind) {
                let l = ctx.library.level(&part.kind).ok_or(GateError::Missing {
                    component: part.kind.clone(),
                })?;
                (l, None)
            } else {
                let (l, d) = component(&part.kind, ctx.library)?;
                (l, Some(d))
            };
            let copies = part.repeat.unwrap_or(1);
            for r in 0..copies {
                let inst = if copies == 1 {
                    here.clone()
                } else {
                    child(&here, &format!("#{r}"))
                };
                // Connect this copy's ports to its slice of the part's pins.
                if copies > 1 {
                    for port in kind_level.ports() {
                        let w = kind_level.width(port);
                        let shared = part.shared.contains(port);
                        for b in 0..w {
                            let outer = if shared { b } else { r * w + b };
                            self.join_keys(
                                (inst.clone(), port.clone(), b),
                                (here.clone(), port.clone(), outer),
                            );
                        }
                    }
                }
                match inner {
                    Some(d) => self.instance(ctx, &inst, kind_level, d)?,
                    None => {
                        let bits =
                            |b: &mut Builder, ports: &[String]| -> Vec<(String, Vec<usize>)> {
                                ports
                                    .iter()
                                    .map(|p| {
                                        let nodes = (0..kind_level.width(p))
                                            .map(|i| b.node((inst.clone(), p.clone(), i)))
                                            .collect();
                                        (p.clone(), nodes)
                                    })
                                    .collect()
                            };
                        let ins = bits(self, &kind_level.inputs);
                        let outs = bits(self, &kind_level.outputs);
                        self.cells
                            .push((part.kind.clone(), inst.clone(), ins, outs));
                    }
                }
            }
        }
        Ok(())
    }
}

/// Flattens `design` into leaf cells. `is_leaf(kind)` decides which
/// components stay whole; the rest are expanded into their unlocked
/// designs. With `preview`, only problems that make simulation impossible
/// stop it (as in [`crate::flatten_preview`]).
pub fn flatten_gates(
    level: &Level,
    design: &Design,
    library: &Library,
    is_leaf: &dyn Fn(&str) -> bool,
    preview: bool,
) -> Result<GateCircuit, GateError> {
    let blocks: fn(&Problem) -> bool = if preview {
        Problem::blocks_preview
    } else {
        Problem::is_error
    };
    let errors: Vec<Problem> = validate(level, design, library)
        .into_iter()
        .filter(blocks)
        .collect();
    if !errors.is_empty() {
        return Err(GateError::Invalid {
            component: level.id.clone(),
            problems: errors,
        });
    }
    let ctx = Ctx { library, is_leaf };
    let mut b = Builder::default();
    let port_nodes = |b: &mut Builder, ports: &[String]| -> Vec<(String, Vec<usize>)> {
        ports
            .iter()
            .map(|p| {
                (
                    p.clone(),
                    (0..level.width(p))
                        .map(|i| b.node((vec![], p.clone(), i)))
                        .collect(),
                )
            })
            .collect()
    };
    let top_in = port_nodes(&mut b, &level.inputs);
    let top_out = port_nodes(&mut b, &level.outputs);
    // Make sure every top-level pin has nodes, even if unwired.
    let mut visible: Vec<(Endpoint, Vec<usize>)> = Vec::new();
    for part in &design.parts {
        if let Ok(Some(pins)) = part_pins(part, library) {
            for p in pins {
                let nodes = (0..p.width)
                    .map(|i| b.node((vec![part.id.clone()], p.name.clone(), i)))
                    .collect();
                visible.push((
                    Endpoint::Pin {
                        part: part.id.clone(),
                        pin: p.name,
                    },
                    nodes,
                ));
            }
        }
    }
    b.instance(&ctx, &[], level, design)?;

    let mut dense: HashMap<usize, NetId> = HashMap::new();
    let mut net = |b: &mut Builder, node: usize| {
        let root = b.find(node);
        let next = dense.len();
        *dense.entry(root).or_insert(next)
    };
    let mut map = |b: &mut Builder, list: Vec<(String, Vec<usize>)>| -> Vec<(String, Vec<NetId>)> {
        list.into_iter()
            .map(|(n, nodes)| (n, nodes.into_iter().map(|x| net(b, x)).collect()))
            .collect()
    };
    let inputs = map(&mut b, top_in);
    let outputs = map(&mut b, top_out);
    let raw = std::mem::take(&mut b.cells);
    let cells: Vec<Cell> = raw
        .into_iter()
        .map(|(kind, path, ins, outs)| Cell {
            kind,
            path,
            inputs: map(&mut b, ins),
            outputs: map(&mut b, outs),
        })
        .collect();
    let mut endpoints: Vec<(Endpoint, Vec<NetId>)> = visible
        .into_iter()
        .filter(|(_, nodes)| !nodes.is_empty())
        .map(|(e, nodes)| (e, nodes.into_iter().map(|x| net(&mut b, x)).collect()))
        .collect();
    endpoints.extend(
        inputs
            .iter()
            .map(|(p, n)| (Endpoint::Port { port: p.clone() }, n.clone())),
    );
    endpoints.extend(
        outputs
            .iter()
            .map(|(p, n)| (Endpoint::Port { port: p.clone() }, n.clone())),
    );
    endpoints.sort();
    for node in 0..b.parent.len() {
        net(&mut b, node);
    }

    // Each net must have at most one driver.
    let mut drivers: HashMap<NetId, Vec<(String, Option<String>)>> = HashMap::new();
    for (p, nets) in &inputs {
        for (i, n) in nets.iter().enumerate() {
            let name = if nets.len() > 1 {
                format!("input `{p}` bit {i}")
            } else {
                format!("input `{p}`")
            };
            drivers.entry(*n).or_default().push((name, None));
        }
    }
    for c in &cells {
        for (p, nets) in &c.outputs {
            for (i, n) in nets.iter().enumerate() {
                let who = c.path.join("/");
                let name = if nets.len() > 1 {
                    format!("`{who}.{p}` bit {i}")
                } else {
                    format!("`{who}.{p}`")
                };
                drivers
                    .entry(*n)
                    .or_default()
                    .push((name, c.path.first().cloned()));
            }
        }
    }
    let mut clash: Vec<&Vec<(String, Option<String>)>> =
        drivers.values().filter(|d| d.len() > 1).collect();
    clash.sort();
    if let Some(d) = clash.first() {
        let mut parts: Vec<String> = d.iter().filter_map(|(_, p)| p.clone()).collect();
        parts.sort();
        parts.dedup();
        return Err(GateError::MultipleDrivers {
            drivers: d.iter().map(|(n, _)| n.clone()).collect(),
            parts,
        });
    }

    Ok(GateCircuit {
        net_count: dense.len(),
        cells,
        inputs,
        outputs,
        endpoints,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::builder::*;

    /// Layer 1 `not` and `nand` (leaves), Layer 2 `and` built from them.
    fn lib() -> Library {
        let mut lib = Library::new();
        lib.add_level(level("not", 1, &["a"], &["out"]));
        lib.add_level(level("nand", 1, &["a", "b"], &["out"]));
        lib.unlock(not_design());
        lib.unlock(design("nand", &[], &[]));
        lib.add_level(level("and", 2, &["a", "b"], &["out"]));
        lib.unlock(design(
            "and",
            &[("x", "nand"), ("i", "not")],
            &[
                (port("a"), pin("x", "a")),
                (port("b"), pin("x", "b")),
                (pin("x", "out"), pin("i", "a")),
                (pin("i", "out"), port("out")),
            ],
        ));
        lib
    }

    fn wide(id: &str, ins: &[(&str, u32)], outs: &[(&str, u32)]) -> Level {
        let mut l = level(
            id,
            2,
            &ins.iter().map(|(n, _)| *n).collect::<Vec<_>>(),
            &outs.iter().map(|(n, _)| *n).collect::<Vec<_>>(),
        );
        for (n, w) in ins.iter().chain(outs) {
            if *w > 1 {
                l.widths.insert(n.to_string(), *w);
            }
        }
        l
    }

    fn leaf_layer1(lib: &Library) -> impl Fn(&str) -> bool + '_ {
        |k: &str| lib.level(k).is_some_and(|l| l.layer == 1)
    }

    #[test]
    fn repeat_makes_one_cell_per_bit() {
        let lib = lib();
        let lvl = wide("not4", &[("a", 4)], &[("out", 4)]);
        let mut d = design(
            "not4",
            &[],
            &[(port("a"), pin("n", "a")), (pin("n", "out"), port("out"))],
        );
        d.parts.push(part_with("n", "not", None, Some(4), &[]));
        let c = flatten_gates(&lvl, &d, &lib, &leaf_layer1(&lib), false).unwrap();
        assert_eq!(c.cells.len(), 4);
        assert_eq!(c.cells[2].path, ["n", "#2"]);
        // Copy 2 reads bit 2 of `a` and drives bit 2 of `out`.
        assert_eq!(c.cells[2].inputs[0].1, vec![c.inputs[0].1[2]]);
        assert_eq!(c.cells[2].outputs[0].1, vec![c.outputs[0].1[2]]);
    }

    #[test]
    fn shared_pins_reach_every_copy() {
        let lib = lib();
        let lvl = wide("and4", &[("a", 4), ("en", 1)], &[("out", 4)]);
        let mut d = design(
            "and4",
            &[],
            &[
                (port("a"), pin("g", "a")),
                (port("en"), pin("g", "b")),
                (pin("g", "out"), port("out")),
            ],
        );
        d.parts.push(part_with("g", "and", None, Some(4), &["b"]));
        let c = flatten_gates(&lvl, &d, &lib, &leaf_layer1(&lib), false).unwrap();
        // `and` isn't a leaf: each copy expands to a nand and a not.
        assert_eq!(c.cells.len(), 8);
        let en = c.inputs[1].1[0];
        let nands: Vec<_> = c.cells.iter().filter(|x| x.kind == "nand").collect();
        assert!(nands.iter().all(|x| x.inputs[1].1 == vec![en]));
        assert_eq!(nands[3].path, ["g", "#3", "x"]);
    }

    #[test]
    fn a_component_marked_as_leaf_stays_whole() {
        let lib = lib();
        let lvl = wide("and1", &[("a", 1), ("b", 1)], &[("out", 1)]);
        let d = design(
            "and1",
            &[("g", "and")],
            &[
                (port("a"), pin("g", "a")),
                (port("b"), pin("g", "b")),
                (pin("g", "out"), port("out")),
            ],
        );
        let c = flatten_gates(
            &lvl,
            &d,
            &lib,
            &|k| k == "and" || k == "nand" || k == "not",
            false,
        )
        .unwrap();
        assert_eq!(c.cells.len(), 1);
        assert_eq!(c.cells[0].kind, "and");
    }

    #[test]
    fn splitters_and_joiners_reorder_bits() {
        let lib = lib();
        let lvl = wide("rev2", &[("a", 2)], &[("out", 2)]);
        let mut d = design(
            "rev2",
            &[],
            &[
                (port("a"), pin("s", "in")),
                (pin("s", "0"), pin("j", "1")),
                (pin("s", "1"), pin("j", "0")),
                (pin("j", "out"), port("out")),
            ],
        );
        d.parts.push(part_with("s", "split", Some(2), None, &[]));
        d.parts.push(part_with("j", "join", Some(2), None, &[]));
        let c = flatten_gates(&lvl, &d, &lib, &leaf_layer1(&lib), false).unwrap();
        assert!(c.cells.is_empty());
        assert_eq!(c.outputs[0].1, vec![c.inputs[0].1[1], c.inputs[0].1[0]]);
        let split_in = c
            .endpoints
            .iter()
            .find(|(e, _)| *e == pin("s", "in"))
            .unwrap();
        assert_eq!(split_in.1, c.inputs[0].1);
    }

    #[test]
    fn two_outputs_on_one_wire_is_an_error() {
        let lib = lib();
        let lvl = wide("bad", &[("a", 1)], &[("out", 1)]);
        let d = design(
            "bad",
            &[("n1", "not"), ("n2", "not")],
            &[
                (port("a"), pin("n1", "a")),
                (port("a"), pin("n2", "a")),
                (pin("n1", "out"), port("out")),
                (pin("n2", "out"), port("out")),
            ],
        );
        let err = flatten_gates(&lvl, &d, &lib, &leaf_layer1(&lib), false).unwrap_err();
        assert_eq!(
            err.to_string(),
            "one wire is driven by `n1.out` and `n2.out`: two outputs fighting over one wire. \
             Each wire needs exactly one source"
        );
        assert!(
            matches!(err, GateError::MultipleDrivers { ref parts, .. } if parts == &["n1", "n2"])
        );
    }
}
