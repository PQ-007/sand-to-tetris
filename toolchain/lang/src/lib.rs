//! The reference compiler for C Shard (`docs/LANGUAGE.md`).
//!
//! It is built in the same four stages the learner's compiler is, so each
//! stage's output (serialized as JSON) is what the learner's stage is tested
//! against:
//!
//! 1. [`tokenize`] the source into [`Token`]s,
//! 2. [`parse`] the tokens into a [`Program`] (the syntax tree),
//! 3. [`check`] names and types into an [`Info`] (where everything lives),
//! 4. [`generate`] VM code (`docs/VM.md`) from the tree and the info.
//!
//! [`compile`] runs all four; [`build`] also translates and assembles.
#![forbid(unsafe_code)]

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

mod check;
mod gen;
mod lex;
mod parse;

pub use check::check;
pub use gen::generate;
pub use lex::tokenize;
pub use parse::parse;

/// The most words of globals (VM `global` 0..4095).
pub const MAX_GLOBALS: u32 = 4096;

/// A mistake in the source: a code from `docs/LANGUAGE.md`, the values to
/// build a message in any language, and an English message.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct LangError {
    /// 1-based source line; 0 for the whole program (`no-main`).
    pub line: usize,
    pub code: String,
    pub args: BTreeMap<String, String>,
    pub message: String,
}

impl LangError {
    pub(crate) fn new(
        line: usize,
        code: &str,
        message: String,
        args: &[(&str, String)],
    ) -> LangError {
        LangError {
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

impl std::fmt::Display for LangError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if self.line > 0 {
            write!(f, "line {}: ", self.line)?;
        }
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for LangError {}

/// Stage 1's output.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Token {
    /// A number or a character.
    Num {
        value: u16,
        line: usize,
    },
    Str {
        text: String,
        line: usize,
    },
    Name {
        text: String,
        line: usize,
    },
    Kw {
        text: String,
        line: usize,
    },
    Sym {
        text: String,
        line: usize,
    },
}

impl Token {
    pub fn line(&self) -> usize {
        match self {
            Token::Num { line, .. }
            | Token::Str { line, .. }
            | Token::Name { line, .. }
            | Token::Kw { line, .. }
            | Token::Sym { line, .. } => *line,
        }
    }
}

/// A type as written.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Type {
    Int,
    Bool,
    /// `[T; size]`, or `[T]` (a reference) when size is null.
    Array {
        elem: Box<Type>,
        size: Option<Box<Expr>>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Param {
    pub name: String,
    #[serde(rename = "type")]
    pub ty: Type,
}

/// A top-level declaration.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Item {
    Fn {
        name: String,
        params: Vec<Param>,
        result: Option<Type>,
        body: Vec<Stmt>,
        line: usize,
    },
    Var {
        name: String,
        #[serde(rename = "type")]
        ty: Option<Type>,
        value: Option<Expr>,
        line: usize,
    },
    Const {
        name: String,
        #[serde(rename = "type")]
        ty: Option<Type>,
        value: Expr,
        line: usize,
    },
}

/// Stage 2's output.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Program {
    pub items: Vec<Item>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Stmt {
    Var {
        name: String,
        #[serde(rename = "type")]
        ty: Option<Type>,
        value: Expr,
        line: usize,
    },
    /// `target = value;` (target: a name, an index or mem).
    Assign {
        target: Expr,
        value: Expr,
        line: usize,
    },
    /// `else if` is an else holding one if.
    If {
        cond: Expr,
        then: Vec<Stmt>,
        #[serde(rename = "else")]
        otherwise: Option<Vec<Stmt>>,
        line: usize,
    },
    While {
        cond: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    For {
        var: String,
        from: Expr,
        to: Expr,
        body: Vec<Stmt>,
        line: usize,
    },
    Break {
        line: usize,
    },
    Continue {
        line: usize,
    },
    Return {
        value: Option<Expr>,
        line: usize,
    },
    /// An expression statement (only a call passes the checks).
    Expr {
        expr: Expr,
        line: usize,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Expr {
    /// A number or a character.
    Num {
        value: u16,
        line: usize,
    },
    Bool {
        value: bool,
        line: usize,
    },
    Str {
        text: String,
        line: usize,
    },
    /// `[a, b, c]`
    Array {
        items: Vec<Expr>,
        line: usize,
    },
    Name {
        name: String,
        line: usize,
    },
    /// `name[index]`
    Index {
        name: String,
        index: Box<Expr>,
        line: usize,
    },
    /// `mem[addr]`
    Mem {
        addr: Box<Expr>,
        line: usize,
    },
    Call {
        name: String,
        args: Vec<Expr>,
        line: usize,
    },
    /// `-`, `~` or `not`.
    Unary {
        op: String,
        operand: Box<Expr>,
        line: usize,
    },
    Binary {
        op: String,
        left: Box<Expr>,
        right: Box<Expr>,
        line: usize,
    },
}

impl Expr {
    pub fn line(&self) -> usize {
        match self {
            Expr::Num { line, .. }
            | Expr::Bool { line, .. }
            | Expr::Str { line, .. }
            | Expr::Array { line, .. }
            | Expr::Name { line, .. }
            | Expr::Index { line, .. }
            | Expr::Mem { line, .. }
            | Expr::Call { line, .. }
            | Expr::Unary { line, .. }
            | Expr::Binary { line, .. } => *line,
        }
    }
}

/// Where a global variable or constant array lives.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct GlobalInfo {
    /// Its first VM global (= its RAM address).
    pub index: u16,
    /// Words: 1, or the array's length.
    pub size: u16,
    /// An array (its value is its address) rather than an int or bool.
    pub array: bool,
    /// Its starting words (empty: all 0).
    pub init: Vec<u16>,
}

/// What `generate` needs to know about a function.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FuncInfo {
    /// Parameter names, in order (VM `arg` 0, 1, ...).
    pub params: Vec<String>,
    /// Whether it returns a value.
    pub result: bool,
    /// Every local (and `for` variable) by name → VM `local` number. A
    /// `for` variable i's hidden end value is the local after i.
    pub locals: BTreeMap<String, u16>,
    /// How many VM locals in all.
    pub count: u16,
}

/// Stage 3's output: where every name lives.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Info {
    pub globals: BTreeMap<String, GlobalInfo>,
    /// Scalar constants and their values.
    pub consts: BTreeMap<String, u16>,
    pub functions: BTreeMap<String, FuncInfo>,
}

/// A compiled program: VM code, or the errors.
#[derive(Clone, Debug, Default, Serialize)]
pub struct Compiled {
    pub vm: Vec<String>,
    pub errors: Vec<LangError>,
}

/// All four stages over a source text.
pub fn compile(source: &str) -> Compiled {
    let fail = |errors: Vec<LangError>| Compiled {
        vm: Vec::new(),
        errors,
    };
    let tokens = match tokenize(source) {
        Ok(t) => t,
        Err(e) => return fail(vec![e]),
    };
    let program = match parse(&tokens) {
        Ok(p) => p,
        Err(e) => return fail(vec![e]),
    };
    match check(&program) {
        Ok(info) => Compiled {
            vm: generate(&program, &info),
            errors: Vec::new(),
        },
        Err(errors) => fail(errors),
    }
}
