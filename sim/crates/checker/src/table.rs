//! Truth tables: `a b | out` then rows like `0 1 | 1`. Multi-bit columns
//! take numbers in decimal, hex (`0x1f`) or binary (`0b0101`).

use std::collections::BTreeSet;

use s2t_netlist::Level;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TableRow {
    /// Input values in the level's port order.
    pub inputs: Vec<(String, u64)>,
    /// Expected output values in the level's port order.
    pub outputs: Vec<(String, u64)>,
    /// Outputs written `-` ("don't care", sequential levels only): their
    /// value in `outputs` is a placeholder and isn't checked.
    pub skip: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Table {
    pub rows: Vec<TableRow>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TableError {
    pub line: usize,
    pub message: String,
}

impl std::fmt::Display for TableError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "truth table line {}: {}", self.line, self.message)
    }
}

impl std::error::Error for TableError {}

fn names(items: &[String]) -> String {
    items
        .iter()
        .map(|s| format!("`{s}`"))
        .collect::<Vec<_>>()
        .join(", ")
}

/// Parses `13`, `0xd`, or `0b1101`. Underscores are allowed as separators.
pub fn parse_number(text: &str) -> Option<u64> {
    let t = text.replace('_', "");
    if let Some(h) = t.strip_prefix("0x") {
        u64::from_str_radix(h, 16).ok()
    } else if let Some(b) = t.strip_prefix("0b") {
        u64::from_str_radix(b, 2).ok()
    } else {
        t.parse().ok()
    }
}

/// Maps header columns to the level's port order, or explains the mismatch.
fn columns(
    header: &[String],
    ports: &[String],
    what: &str,
    line: usize,
) -> Result<Vec<usize>, TableError> {
    let same = header.len() == ports.len()
        && header.iter().collect::<BTreeSet<_>>() == ports.iter().collect::<BTreeSet<_>>();
    if !same {
        return Err(TableError {
            line,
            message: format!(
                "columns {} don't match the level's {what} {}",
                names(header),
                names(ports)
            ),
        });
    }
    Ok(ports
        .iter()
        .map(|p| header.iter().position(|h| h == p).unwrap_or(0))
        .collect())
}

impl Table {
    /// Parses a truth table for `level`. Blank lines and lines starting
    /// with `#` are ignored; column order may differ from port order.
    pub fn parse(text: &str, level: &Level) -> Result<Table, TableError> {
        let mut lines = text
            .lines()
            .enumerate()
            .map(|(i, l)| (i + 1, l.trim()))
            .filter(|(_, l)| !l.is_empty() && !l.starts_with('#'));
        let (hline, header) = lines.next().ok_or(TableError {
            line: 1,
            message: "the table is empty".into(),
        })?;
        let shape = |ins: usize, outs: usize| {
            format!(
                "expected {ins} input{}, `|`, then {outs} output{}",
                if ins == 1 { "" } else { "s" },
                if outs == 1 { "" } else { "s" }
            )
        };
        let split = |line: usize, s: &str| -> Result<(Vec<String>, Vec<String>), TableError> {
            let mut halves = s.split('|');
            match (halves.next(), halves.next(), halves.next()) {
                (Some(l), Some(r), None) => Ok((
                    l.split_whitespace().map(String::from).collect(),
                    r.split_whitespace().map(String::from).collect(),
                )),
                _ => Err(TableError {
                    line,
                    message: shape(level.inputs.len(), level.outputs.len()),
                }),
            }
        };
        let (hin, hout) = split(hline, header)?;
        let in_cols = columns(&hin, &level.inputs, "inputs", hline)?;
        let out_cols = columns(&hout, &level.outputs, "outputs", hline)?;

        let mut rows = Vec::new();
        for (line, text) in lines {
            let (vin, vout) = split(line, text)?;
            if vin.len() != hin.len() || vout.len() != hout.len() {
                return Err(TableError {
                    line,
                    message: shape(hin.len(), hout.len()),
                });
            }
            let mut skip = Vec::new();
            let mut pick = |ports: &[String], cols: &[usize], vals: &[String], outputs: bool| {
                ports
                    .iter()
                    .zip(cols)
                    .map(|(p, &c)| {
                        let raw = &vals[c];
                        if raw == "-" {
                            if !outputs {
                                return Err(TableError {
                                    line,
                                    message: format!("input `{p}` needs a value, not `-`"),
                                });
                            }
                            if !level.sequential {
                                return Err(TableError {
                                    line,
                                    message:
                                        "`-` (don't care) is only allowed in sequential levels"
                                            .into(),
                                });
                            }
                            skip.push(p.clone());
                            return Ok((p.clone(), 0));
                        }
                        let width = level.width(p);
                        let v = parse_number(raw).ok_or_else(|| TableError {
                            line,
                            message: if width == 1 {
                                format!("`{raw}` isn't 0 or 1")
                            } else {
                                format!("`{raw}` isn't a number")
                            },
                        })?;
                        if width < 64 && v >> width != 0 {
                            return Err(TableError {
                                line,
                                message: if width == 1 {
                                    format!("`{raw}` isn't 0 or 1")
                                } else {
                                    format!("`{raw}` doesn't fit in `{p}` ({width} bits)")
                                },
                            });
                        }
                        Ok((p.clone(), v))
                    })
                    .collect::<Result<Vec<_>, TableError>>()
            };
            let inputs = pick(&level.inputs, &in_cols, &vin, false)?;
            let outputs = pick(&level.outputs, &out_cols, &vout, true)?;
            rows.push(TableRow {
                inputs,
                outputs,
                skip,
            });
        }
        Ok(Table { rows })
    }

    /// True if every combination of input bits appears (only possible for
    /// up to 20 input bits).
    pub fn is_exhaustive(&self, level: &Level) -> bool {
        let bits = level.input_bits();
        if bits > 20 || self.rows.is_empty() {
            return false;
        }
        let seen: BTreeSet<u64> = self.rows.iter().map(|r| pack(level, &r.inputs)).collect();
        seen.len() as u64 == 1u64 << bits
    }
}

/// Packs input values into one number, in port order (first port in the
/// lowest bits): the index used by gate-level truth tables.
pub fn pack(level: &Level, values: &[(String, u64)]) -> u64 {
    let mut out = 0u64;
    let mut shift = 0u32;
    for (p, v) in values {
        out |= v << shift;
        shift += level.width(p);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use s2t_netlist::builder::level;

    #[test]
    fn numbers_in_three_bases() {
        assert_eq!(parse_number("13"), Some(13));
        assert_eq!(parse_number("0xff"), Some(255));
        assert_eq!(parse_number("0b1_0001"), Some(17));
        assert_eq!(parse_number("x"), None);
    }

    #[test]
    fn bus_values_must_fit() {
        let mut l = level("add4", 2, &["a", "b"], &["out"]);
        for p in ["a", "b", "out"] {
            l.widths.insert(p.into(), 4);
        }
        let t = Table::parse("a b | out\n0x3 0b0100 | 7\n", &l).unwrap();
        assert_eq!(t.rows[0].inputs, [("a".into(), 3), ("b".into(), 4)]);
        let err = Table::parse("a b | out\n16 0 | 0\n", &l).unwrap_err();
        assert_eq!(
            err.to_string(),
            "truth table line 2: `16` doesn't fit in `a` (4 bits)"
        );
        assert!(!t.is_exhaustive(&l));
    }

    #[test]
    fn tables_with_no_inputs() {
        let l = level("one", 1, &[], &["out"]);
        let t = Table::parse("| out\n| 1\n", &l).unwrap();
        assert_eq!(t.rows[0].outputs, [("out".into(), 1)]);
        assert!(t.is_exhaustive(&l));
    }
}
