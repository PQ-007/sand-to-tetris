//! Stage 3 (pass 1): sections, addresses and the symbol table.
use std::collections::BTreeMap;

use crate::{AsmError, Body, Layout, Line, Operand, Placed, Symbol, Symbols};

/// Lays out every line, or returns every error found.
pub fn layout(lines: &[Line]) -> Result<Layout, Vec<AsmError>> {
    let (lay, errors) = layout_all(lines);
    if errors.is_empty() {
        Ok(lay)
    } else {
        Err(errors)
    }
}

/// The layout as far as it goes, with the errors on the way; the driver
/// keeps encoding the lines that were placed.
pub(crate) fn layout_all(lines: &[Line]) -> (Layout, Vec<AsmError>) {
    let mut st = State::default();
    let mut placed = Vec::with_capacity(lines.len());
    for (i, line) in lines.iter().enumerate() {
        let n = i + 1;
        if let Some(label) = &line.label {
            let value = if st.in_data { st.data } else { st.code };
            let kind = if st.in_data { "data" } else { "code" };
            st.define(label, kind, value as i32, n);
        }
        placed.push(match &line.body {
            None => None,
            Some(Body::Instr { mnemonic, args }) => {
                if st.in_data {
                    st.error(
                        n,
                        AsmError::new(
                            "code-in-data",
                            "instructions belong in .code, not .data".into(),
                            &[("mnemonic", mnemonic.clone())],
                        ),
                    );
                    None
                } else {
                    let size = if mnemonic == "SET16" {
                        set16_size(args, &st.symbols)
                    } else {
                        1
                    };
                    let p = Placed {
                        section: "code".into(),
                        address: st.code,
                        size,
                    };
                    st.code = st.code.wrapping_add(size);
                    Some(p)
                }
            }
            Some(Body::Dir { name, args }) => st.directive(name, args, n),
        });
    }
    (
        Layout {
            symbols: st.symbols,
            lines: placed,
        },
        st.errors,
    )
}

/// SET16 takes one word when its value is already known in pass 1 and fits
/// in a byte (a number, or a constant defined above); otherwise two.
fn set16_size(args: &[Operand], symbols: &Symbols) -> u16 {
    let known = match args.get(1) {
        Some(Operand::Num { value }) => Some(*value),
        Some(Operand::Sym { name }) => symbols
            .get(name)
            .filter(|s| s.kind == "const")
            .map(|s| s.value),
        _ => None,
    };
    match known {
        Some(v) if (0..=255).contains(&v) => 1,
        _ => 2,
    }
}

#[derive(Default)]
struct State {
    symbols: Symbols,
    /// Line each symbol was defined on (for duplicate errors).
    defined_on: BTreeMap<String, usize>,
    in_data: bool,
    code: u16,
    data: u16,
    errors: Vec<AsmError>,
}

impl State {
    fn error(&mut self, line: usize, mut e: AsmError) {
        e.line = line;
        self.errors.push(e);
    }

    fn define(&mut self, name: &str, kind: &str, value: i32, line: usize) {
        if let Some(&first) = self.defined_on.get(name) {
            self.error(
                line,
                AsmError::new(
                    "duplicate-symbol",
                    format!("`{name}` is already defined on line {first}"),
                    &[("name", name.to_string()), ("first", first.to_string())],
                ),
            );
            return;
        }
        self.defined_on.insert(name.to_string(), line);
        self.symbols.insert(
            name.to_string(),
            Symbol {
                kind: kind.to_string(),
                value,
            },
        );
    }

    /// A value known now: a number or a symbol defined above.
    fn known(&self, op: &Operand) -> Result<i32, AsmError> {
        match op {
            Operand::Num { value } => Ok(*value),
            Operand::Sym { name } => self.symbols.get(name).map(|s| s.value).ok_or_else(|| {
                AsmError::new(
                    "unknown-symbol",
                    format!("`{name}` isn't defined (above this line)"),
                    &[("name", name.clone())],
                )
            }),
            other => Err(AsmError::new(
                "bad-operand",
                format!("expected a number, found {}", crate::describe(other)),
                &[
                    ("expected", "number".into()),
                    ("found", crate::describe(other)),
                ],
            )),
        }
    }

    fn directive(&mut self, name: &str, args: &[Operand], n: usize) -> Option<Placed> {
        match name {
            "code" => {
                self.in_data = false;
                None
            }
            "data" => {
                self.in_data = true;
                None
            }
            "equ" => {
                let (Some(Operand::Sym { name: c }), Some(v)) = (args.first(), args.get(1)) else {
                    return None;
                };
                match self.known(v) {
                    Ok(value) => self.define(c, "const", value, n),
                    Err(e) => self.error(n, e),
                }
                None
            }
            "word" | "space" if !self.in_data => {
                self.error(
                    n,
                    AsmError::new(
                        "data-in-code",
                        format!("`.{name}` puts data in the program: it belongs after .data"),
                        &[("name", name.to_string())],
                    ),
                );
                None
            }
            "word" => self.place_data(args.len() as u16),
            "space" => {
                if args.len() != 1 {
                    self.error(n, crate::encode::count_error(".space", "1", args.len()));
                    return None;
                }
                match self.known(&args[0]) {
                    Ok(v) if (0..=16384).contains(&v) => self.place_data(v as u16),
                    Ok(v) => {
                        self.error(n, crate::encode::range_error("n", v, "0..16384"));
                        None
                    }
                    Err(e) => {
                        self.error(n, e);
                        None
                    }
                }
            }
            other => {
                self.error(
                    n,
                    AsmError::new(
                        "unknown-directive",
                        format!(
                            "`.{other}` isn't a directive: use .equ, .code, .data, .word or .space"
                        ),
                        &[("name", other.to_string())],
                    ),
                );
                None
            }
        }
    }

    fn place_data(&mut self, size: u16) -> Option<Placed> {
        let p = Placed {
            section: "data".into(),
            address: self.data,
            size,
        };
        self.data = self.data.wrapping_add(size);
        Some(p)
    }
}
