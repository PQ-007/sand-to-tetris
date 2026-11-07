//! The reference C compiler (`docs/C.md`): a C subset compiled straight to
//! assembly for the course's CPU, then assembled with `s2t-asm`.
//!
//! [`compile`] gives the assembly and a map back to C lines; [`build`] also
//! assembles it. Jumps and calls start short; the ones the assembler says
//! don't reach are made long and the program is assembled again.
#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

pub mod ast;
mod gen;
mod lex;
mod parse;

pub use lex::MACHINE_H;

/// A mistake in the source: a code from `docs/C.md`, the values to build a
/// message in any language, and an English message.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CError {
    /// 1-based line in the program; 0 for the whole program or the library.
    pub line: usize,
    pub code: String,
    pub args: BTreeMap<String, String>,
    pub message: String,
}

impl CError {
    pub(crate) fn new(line: usize, code: &str, message: String, args: &[(&str, String)]) -> CError {
        CError {
            line,
            code: code.to_string(),
            args: args
                .iter()
                .map(|(k, v)| (k.to_string(), v.clone()))
                .collect(),
            message,
        }
    }
}

impl std::fmt::Display for CError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.line > 0 {
            write!(f, "line {}: ", self.line)?;
        }
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for CError {}

/// A compiled program.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Compiled {
    /// The assembly, one line per entry.
    pub asm: Vec<String>,
    /// For each assembly line, the C line it came from (0: the startup
    /// code, the library or the runtime).
    pub source_map: Vec<usize>,
    /// ROM words.
    pub code: Vec<u16>,
    /// The data image, copied into RAM from address 0.
    pub data: Vec<u16>,
    /// For each ROM word, its 1-based assembly line.
    pub code_map: Vec<usize>,
    pub errors: Vec<CError>,
}

/// Compiles and assembles a C program.
pub fn build(source: &str) -> Compiled {
    let toks = match lex::tokenize(source) {
        Ok(t) => t,
        Err(e) => return failed(vec![e]),
    };
    let (prog, mut errors) = parse::parse(toks);
    if errors.is_empty() && !prog.funcs.iter().any(|f| f.name == "main") {
        errors.push(CError::new(
            0,
            "no-main",
            "the program needs a function main".into(),
            &[],
        ));
    }
    if !errors.is_empty() {
        errors.sort_by_key(|e| e.line);
        return failed(errors);
    }
    let out = gen::generate(&prog);
    if out.data_end + gen::STACK_ROOM > gen::STACK_TOP {
        return failed(vec![CError::new(
            0,
            "too-big",
            format!(
                "the globals take {} words; with room for the stack, RAM holds {}",
                out.data_end,
                gen::STACK_TOP - gen::STACK_ROOM
            ),
            &[
                ("words", out.data_end.to_string()),
                ("max", (gen::STACK_TOP - gen::STACK_ROOM).to_string()),
            ],
        )]);
    }
    let mut items = out.items;
    loop {
        let (asm, source_map, owner) = render(&items);
        let program = s2t_asm::assemble(&asm.join("\n"));
        let far: Vec<usize> = program
            .errors
            .iter()
            .filter(|e| e.code == "jump-too-far")
            .filter_map(|e| owner.get(e.line.wrapping_sub(1)).copied())
            .collect();
        let grew = far.iter().fold(false, |grew, &i| match &mut items[i] {
            gen::Item::Jump { long, .. } | gen::Item::Call { long, .. } if !*long => {
                *long = true;
                true
            }
            _ => grew,
        });
        if grew {
            continue;
        }
        let mut errors: Vec<CError> = program
            .errors
            .iter()
            .map(|e| {
                CError::new(
                    0,
                    "internal",
                    format!("the compiler made assembly that doesn't assemble: {e}"),
                    &[("message", e.to_string())],
                )
            })
            .collect();
        if program.code.len() > 0x10000 {
            errors.push(CError::new(
                0,
                "too-big",
                "the program is bigger than the 65,536-word ROM".into(),
                &[],
            ));
        }
        return Compiled {
            asm,
            source_map,
            code: program.code,
            data: program.data,
            code_map: program.source_map,
            errors,
        };
    }
}

fn failed(errors: Vec<CError>) -> Compiled {
    Compiled {
        errors,
        ..Compiled::default()
    }
}

/// Assembly text, its C lines, and which item each line came from.
fn render(items: &[gen::Item]) -> (Vec<String>, Vec<usize>, Vec<usize>) {
    let mut asm = Vec::new();
    let mut map = Vec::new();
    let mut owner = Vec::new();
    let mut push = |s: String, line: usize, i: usize| {
        asm.push(s);
        map.push(line);
        owner.push(i);
    };
    for (i, item) in items.iter().enumerate() {
        match item {
            gen::Item::Line(s, l) => push(s.clone(), *l, i),
            gen::Item::Label(s) => push(format!("{s}:"), 0, i),
            gen::Item::Jump {
                cond,
                target,
                line,
                long,
            } => {
                if !long {
                    push(format!("        {} {target}", cond.name_pub()), *line, i);
                } else {
                    // Too far for a jump: through r7, skipping on the
                    // opposite condition.
                    let skip = format!("__j{i}");
                    if *cond != gen::J::Always {
                        push(
                            format!("        {} {skip}", cond.not_pub().name_pub()),
                            *line,
                            i,
                        );
                    }
                    push(format!("        SET16 r7, {target}"), *line, i);
                    push("        JR r7".into(), *line, i);
                    if *cond != gen::J::Always {
                        push(format!("{skip}:"), *line, i);
                    }
                }
            }
            gen::Item::Call { target, line, long } => {
                if *long {
                    push(format!("        SET16 r7, {target}"), *line, i);
                    push("        CALLR r7".into(), *line, i);
                } else {
                    push(format!("        CALL {target}"), *line, i);
                }
            }
        }
    }
    (asm, map, owner)
}
