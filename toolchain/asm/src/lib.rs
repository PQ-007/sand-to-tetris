//! The reference assembler for the language in `docs/ASSEMBLY.md`.
//!
//! It is built in the same four stages the learner's assembler is, so each
//! stage's output (serialized as JSON) is what the learner's stage is
//! tested against:
//!
//! 1. [`tokenize`] one line into [`Token`]s,
//! 2. [`parse`] the tokens into a [`Line`],
//! 3. [`layout`] every line (pass 1): sections, addresses, the symbol table,
//! 4. [`encode`] each line into words (pass 2).
//!
//! [`assemble`] runs all four over a whole source text and collects every
//! error with its line number.
#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

mod encode;
mod layout;
mod lex;
mod parse;

pub use encode::encode;
pub use layout::layout;
pub use lex::tokenize;
pub use parse::parse;

/// A mistake in the source: a code from `docs/ASSEMBLY.md`, the values to
/// build a message in any language, and an English message.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AsmError {
    /// 1-based source line; 0 when a stage runs on its own.
    pub line: usize,
    pub code: String,
    pub args: BTreeMap<String, String>,
    pub message: String,
}

impl AsmError {
    pub(crate) fn new(code: &str, message: String, args: &[(&str, String)]) -> AsmError {
        AsmError {
            line: 0,
            code: code.to_string(),
            args: args
                .iter()
                .map(|(k, v)| (k.to_string(), v.clone()))
                .collect(),
            message,
        }
    }
}

impl std::fmt::Display for AsmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.line > 0 {
            write!(f, "line {}: ", self.line)?;
        }
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for AsmError {}

/// Stage 1's output.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Token {
    /// `name:` at the start of a line.
    Label {
        name: String,
    },
    /// A mnemonic, register or name, as written.
    Ident {
        text: String,
    },
    /// `.word` → `word` (lower case, without the dot).
    Directive {
        name: String,
    },
    Number {
        value: i32,
    },
    Comma,
    LBracket,
    RBracket,
    Plus,
}

/// An operand, as stage 2 reads it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Operand {
    Reg {
        reg: u8,
    },
    Num {
        value: i32,
    },
    /// A label or constant, by name.
    Sym {
        name: String,
    },
    /// `[rA + offset]`; `[rA]` has offset 0.
    Mem {
        reg: u8,
        offset: Box<Operand>,
    },
}

/// What a line does, besides its label.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum Body {
    /// Mnemonic in upper case.
    #[serde(rename = "instr")]
    Instr {
        mnemonic: String,
        args: Vec<Operand>,
    },
    /// Directive name in lower case, without the dot.
    #[serde(rename = "dir")]
    Dir { name: String, args: Vec<Operand> },
}

/// Stage 2's output: one source line.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Line {
    pub label: Option<String>,
    pub body: Option<Body>,
}

/// A label or constant.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Symbol {
    /// "code" (a ROM address), "data" (a RAM address) or "const".
    pub kind: String,
    pub value: i32,
}

pub type Symbols = BTreeMap<String, Symbol>;

/// Where a line's words go.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Placed {
    /// "code" or "data".
    pub section: String,
    pub address: u16,
    pub size: u16,
}

/// Stage 3's output: every symbol, and where each line goes (null for a
/// line with no words: empty, a label alone, .equ, .code, .data).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Layout {
    pub symbols: Symbols,
    pub lines: Vec<Option<Placed>>,
}

/// A whole program: what the ROM and the loader need, plus a source map.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Program {
    /// ROM words from address 0.
    pub code: Vec<u16>,
    /// The data image: RAM words from address 0, copied in by the loader.
    pub data: Vec<u16>,
    pub symbols: Symbols,
    /// For each code word, its 1-based source line.
    pub source_map: Vec<usize>,
    /// Every error, in line order. With errors, code and data are partial.
    pub errors: Vec<AsmError>,
}

/// Assembles a whole source text, reporting every error it finds.
pub fn assemble(source: &str) -> Program {
    let mut errors = Vec::new();
    let lines: Vec<Line> = source
        .lines()
        .enumerate()
        .map(|(i, text)| match tokenize(text).and_then(|t| parse(&t)) {
            Ok(line) => line,
            Err(mut e) => {
                e.line = i + 1;
                errors.push(e);
                Line::default()
            }
        })
        .collect();
    let (lay, layout_errors) = layout::layout_all(&lines);
    errors.extend(layout_errors);
    let mut program = Program {
        symbols: lay.symbols.clone(),
        ..Program::default()
    };
    for (i, (line, placed)) in lines.iter().zip(&lay.lines).enumerate() {
        let (Some(body), Some(placed)) = (&line.body, placed) else {
            continue;
        };
        let words = match encode(body, &lay.symbols, placed) {
            Ok(w) => w,
            Err(mut e) => {
                e.line = i + 1;
                errors.push(e);
                vec![0; placed.size as usize]
            }
        };
        if placed.section == "code" {
            program.source_map.extend(words.iter().map(|_| i + 1));
            program.code.extend(words);
        } else {
            program.data.extend(words);
        }
    }
    errors.sort_by_key(|e| e.line);
    program.errors = errors;
    program
}

/// A short description of an operand for messages.
pub(crate) fn describe(op: &Operand) -> String {
    match op {
        Operand::Reg { reg } => format!("r{reg}"),
        Operand::Num { value } => value.to_string(),
        Operand::Sym { name } => name.clone(),
        Operand::Mem { reg, offset } => format!("[r{reg} + {}]", describe(offset)),
    }
}
