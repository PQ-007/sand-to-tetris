//! The reference VM translator and interpreter for `docs/VM.md`.
//!
//! The translator is built in the same stages the learner's is, so each
//! stage's output (serialized as JSON) is what the learner's stage is tested
//! against:
//!
//! 1. [`parse`] one line into a [`Command`],
//! 2. [`translate`] one command into assembly lines, given its [`Ctx`],
//! 3. [`bootstrap`] and [`runtime`]: the program's start, and `__mul` /
//!    `__div`.
//!
//! [`build`] checks a whole program, translates it and assembles the result
//! with `s2t-asm`. [`Vm`] runs the commands directly: the VM's meaning as
//! code, which the tests compare every translation with.
#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

mod interp;
mod parse;
mod program;
mod translate;

pub use interp::{run, Frame, Outcome, Vm};
pub use parse::parse;
pub use program::{build, check, Built};
pub use translate::{bootstrap, runtime, translate};

/// Where the stack starts: empty, so the first push goes to 0x3FFF.
pub const STACK_TOP: u16 = 0x4000;
/// The highest `global` index.
pub const MAX_GLOBAL: u16 = 4095;
/// The most arguments + locals a function can have (LOAD/STORE reach
/// FP + 127, and the frame needs 2 words besides).
pub const MAX_VARIABLES: u16 = 126;

/// A mistake in the source: a code from `docs/VM.md`, the values to build a
/// message in any language, and an English message.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct VmError {
    /// 1-based source line; 0 for the whole program (`no-main`) or when a
    /// stage runs on its own.
    pub line: usize,
    pub code: String,
    pub args: BTreeMap<String, String>,
    pub message: String,
}

impl VmError {
    pub(crate) fn new(code: &str, message: String, args: &[(&str, String)]) -> VmError {
        VmError {
            line: 0,
            code: code.to_string(),
            args: args
                .iter()
                .map(|(k, v)| (k.to_string(), v.clone()))
                .collect(),
            message,
        }
    }

    pub(crate) fn at(mut self, line: usize) -> VmError {
        self.line = line;
        self
    }
}

impl std::fmt::Display for VmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.line > 0 {
            write!(f, "line {}: ", self.line)?;
        }
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for VmError {}

/// Where `push` and `set` find a value.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Seg {
    /// `push n`: the number itself (never for `set`).
    Const,
    Local,
    Arg,
    Global,
}

/// One VM command: stage 1's output.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
pub enum Command {
    /// `n` is the constant (0..65535) or the variable's index.
    Push {
        seg: Seg,
        n: u16,
    },
    Set {
        seg: Seg,
        n: u16,
    },
    Pop,
    Dup,
    Load,
    Store,
    Add,
    Sub,
    And,
    Or,
    Xor,
    Neg,
    Not,
    Shl,
    Shr,
    Sar,
    Mul,
    Div,
    Mod,
    Eq,
    Ne,
    Lt,
    Gt,
    Le,
    Ge,
    Label {
        name: String,
    },
    Jump {
        name: String,
    },
    Jumpif {
        name: String,
    },
    Jumpifnot {
        name: String,
    },
    Func {
        name: String,
        args: u16,
        locals: u16,
    },
    Call {
        name: String,
        args: u16,
    },
    Return,
}

/// What `translate` needs besides the command: the function it's in, and
/// its line (for labels inside the translation).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ctx {
    pub func: String,
    pub args: u16,
    pub locals: u16,
    pub line: usize,
}
