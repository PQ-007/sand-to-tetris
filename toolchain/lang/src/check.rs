//! Stage 3: names and types (docs/LANGUAGE.md "Types", "Declarations"),
//! constants worked out, and where every global and local lives.
use std::collections::{BTreeMap, BTreeSet};

use crate::{Expr, FuncInfo, GlobalInfo, Info, Item, LangError, Program, Stmt, Type, MAX_GLOBALS};

/// A checked type.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum T {
    Int,
    Bool,
    /// `[elem; n]`: a global or constant array.
    Arr(Box<T>, u16),
    /// `[elem]`: a reference to an array.
    Ref(Box<T>),
    /// What a function without a result gives.
    Nothing,
}

impl std::fmt::Display for T {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            T::Int => write!(f, "int"),
            T::Bool => write!(f, "bool"),
            T::Arr(e, n) => write!(f, "[{e}; {n}]"),
            T::Ref(e) => write!(f, "[{e}]"),
            T::Nothing => write!(f, "nothing"),
        }
    }
}

/// Whether a value of type `from` can go where `to` is expected.
fn fits(from: &T, to: &T) -> bool {
    match (from, to) {
        (T::Arr(a, _) | T::Ref(a), T::Ref(b)) => a == b,
        _ => from == to,
    }
}

/// A constant's value.
#[derive(Clone, Debug, PartialEq, Eq)]
enum CVal {
    Int(u16),
    Bool(bool),
    Arr(T, Vec<u16>),
}

impl CVal {
    fn ty(&self) -> T {
        match self {
            CVal::Int(_) => T::Int,
            CVal::Bool(_) => T::Bool,
            CVal::Arr(e, v) => T::Arr(Box::new(e.clone()), v.len() as u16),
        }
    }

    fn words(&self) -> Vec<u16> {
        match self {
            CVal::Int(v) => vec![*v],
            CVal::Bool(b) => vec![if *b { 0xffff } else { 0 }],
            CVal::Arr(_, v) => v.clone(),
        }
    }
}

fn mismatch(line: usize, expected: &T, found: &T) -> LangError {
    LangError::new(
        line,
        "type-mismatch",
        format!("expected {expected}, found {found}"),
        &[
            ("expected", expected.to_string()),
            ("found", found.to_string()),
        ],
    )
}

fn not_constant(line: usize) -> LangError {
    LangError::new(
        line,
        "not-constant",
        "this must be a constant: numbers, true/false, constants and operators on them".into(),
        &[],
    )
}

/// What a global name is.
#[derive(Clone, Debug)]
enum Global {
    Var {
        ty: T,
    },
    Const(CVal),
    /// A constant array, stored like a global.
    ConstArr {
        ty: T,
    },
    Fn {
        params: Vec<T>,
        result: T,
    },
}

struct Checker<'a> {
    items: BTreeMap<&'a str, &'a Item>,
    consts: BTreeMap<String, CVal>,
    /// Constants being worked out (to catch one defined by itself).
    busy: BTreeSet<String>,
    errors: Vec<LangError>,
    /// String literals used inside functions, in order of first use: each
    /// becomes a hidden constant array.
    strings: Vec<String>,
}

/// Where every name lives, or every mistake (sorted by line).
pub fn check(program: &Program) -> Result<Info, Vec<LangError>> {
    let mut c = Checker {
        items: BTreeMap::new(),
        consts: BTreeMap::new(),
        busy: BTreeSet::new(),
        errors: Vec::new(),
        strings: Vec::new(),
    };
    for item in &program.items {
        let (name, line) = match item {
            Item::Fn { name, line, .. }
            | Item::Var { name, line, .. }
            | Item::Const { name, line, .. } => (name.as_str(), *line),
        };
        if reserved(name) {
            c.errors.push(reserved_error(line, name));
        } else if c.items.contains_key(name) {
            c.errors.push(duplicate(line, name));
        } else {
            c.items.insert(name, item);
        }
    }
    let mut info = Info::default();
    let mut globals: BTreeMap<String, Global> = BTreeMap::new();
    let mut next: u32 = 0;
    // Globals and constants, in the order written.
    for item in &program.items {
        match item {
            Item::Const { name, ty, line, .. } => {
                if c.items.get(name.as_str()) != Some(&item) {
                    continue;
                }
                let Some(v) = c.constant(name) else { continue };
                if let Some(ty) = ty {
                    if let Some(want) = c.ty(ty, false) {
                        c.same(&v.ty(), &want, *line);
                    }
                }
                match v {
                    CVal::Arr(..) => {
                        let ty = v.ty();
                        let index = next as u16;
                        next += v.words().len() as u32;
                        info.globals.insert(
                            name.clone(),
                            GlobalInfo {
                                index,
                                size: v.words().len() as u16,
                                array: true,
                                init: v.words(),
                            },
                        );
                        globals.insert(name.clone(), Global::ConstArr { ty });
                    }
                    _ => {
                        info.consts.insert(name.clone(), v.words()[0]);
                        globals.insert(name.clone(), Global::Const(v));
                    }
                }
            }
            Item::Var {
                name,
                ty,
                value,
                line,
            } => {
                if c.items.get(name.as_str()) != Some(&item) {
                    continue;
                }
                let declared = ty.as_ref().and_then(|t| c.ty(t, false));
                let start = match value {
                    Some(v) => c.eval(v),
                    None => None,
                };
                let ty = match (declared, &start, value) {
                    (Some(d), Some(v), _) => {
                        c.same(&v.ty(), &d, *line);
                        d
                    }
                    (Some(d), None, None) => d,
                    (None, Some(v), _) => v.ty(),
                    (None, None, None) => {
                        c.errors.push(LangError::new(
                            *line,
                            "missing-type",
                            format!("{name} needs a type or a starting value"),
                            &[("name", name.clone())],
                        ));
                        continue;
                    }
                    _ => continue,
                };
                if matches!(ty, T::Ref(_)) {
                    c.errors.push(LangError::new(
                        *line,
                        "type-mismatch",
                        format!("a global can't be {ty}: give the array a size"),
                        &[("expected", "[int; N]".into()), ("found", ty.to_string())],
                    ));
                    continue;
                }
                let size = match &ty {
                    T::Arr(_, n) => *n,
                    _ => 1,
                };
                let index = next as u16;
                next += size as u32;
                let init = start
                    .map(|v| v.words())
                    .filter(|w| w.iter().any(|x| *x != 0));
                info.globals.insert(
                    name.clone(),
                    GlobalInfo {
                        index,
                        size,
                        array: matches!(ty, T::Arr(..)),
                        init: init.unwrap_or_default(),
                    },
                );
                globals.insert(name.clone(), Global::Var { ty });
            }
            Item::Fn { .. } => {}
        }
    }
    let globals_end_check = |next: u32, c: &mut Checker| {
        if next <= MAX_GLOBALS {
            return;
        }
        c.errors.push(LangError::new(
            program.items.last().map_or(0, item_line),
            "too-many-globals",
            format!("the globals take {next} words; at most {MAX_GLOBALS} fit"),
            &[
                ("words", next.to_string()),
                ("max", MAX_GLOBALS.to_string()),
            ],
        ));
    };
    // Function signatures.
    for item in &program.items {
        let Item::Fn {
            name,
            params,
            result,
            line,
            ..
        } = item
        else {
            continue;
        };
        if c.items.get(name.as_str()) != Some(&item) {
            continue;
        }
        let params: Vec<T> = params
            .iter()
            .map(|p| c.ty(&p.ty, true).unwrap_or(T::Int))
            .collect();
        let result = match result {
            None => T::Nothing,
            Some(r) => match c.ty(r, false) {
                Some(t @ (T::Int | T::Bool)) => t,
                Some(t) => {
                    c.errors.push(mismatch(*line, &T::Int, &t));
                    T::Int
                }
                None => T::Int,
            },
        };
        globals.insert(name.clone(), Global::Fn { params, result });
    }
    match c.items.get("main") {
        Some(Item::Fn {
            params,
            result,
            line,
            ..
        }) => {
            if !params.is_empty() || !matches!(result, None | Some(Type::Int)) {
                c.errors.push(LangError::new(
                    *line,
                    "main-signature",
                    "main takes no parameters and returns int or nothing: fn main() or fn main() -> int".into(),
                    &[],
                ));
            }
        }
        _ => c.errors.push(LangError::new(
            0,
            "no-main",
            "a program needs a function main: fn main() { ... }".into(),
            &[],
        )),
    }
    // Function bodies.
    for item in &program.items {
        let Item::Fn {
            name,
            params,
            body,
            line,
            ..
        } = item
        else {
            continue;
        };
        let Some(Global::Fn {
            params: ptys,
            result,
        }) = globals.get(name)
        else {
            continue;
        };
        let mut f = Func {
            g: &globals,
            c: &mut c,
            scopes: vec![BTreeMap::new()],
            declared: BTreeSet::new(),
            locals: BTreeMap::new(),
            count: 0,
            loops: 0,
            result: result.clone(),
        };
        for (p, t) in params.iter().zip(ptys) {
            if f.declare(&p.name, *line) {
                f.scopes[0].insert(p.name.clone(), (t.clone(), Where::Arg));
            }
        }
        f.block(body);
        if *result != T::Nothing && !returns(body) {
            f.c.errors.push(LangError::new(
                *line,
                "missing-return",
                format!("{name} must end with return (on every path)"),
                &[("name", name.clone())],
            ));
        }
        let total = params.len() as u32 + f.count as u32;
        if total > s2t_vm::MAX_VARIABLES as u32 {
            f.c.errors.push(LangError::new(
                *line,
                "too-many-variables",
                format!(
                    "{name} has {total} parameters and locals; at most {} fit",
                    s2t_vm::MAX_VARIABLES
                ),
                &[
                    ("name", name.clone()),
                    ("max", s2t_vm::MAX_VARIABLES.to_string()),
                ],
            ));
        }
        let (locals, count) = (f.locals, f.count);
        info.functions.insert(
            name.clone(),
            FuncInfo {
                params: params.iter().map(|p| p.name.clone()).collect(),
                result: *result != T::Nothing,
                locals,
                count,
            },
        );
    }
    // Strings used in functions, after every declared global.
    for text in std::mem::take(&mut c.strings) {
        let words: Vec<u16> = text.bytes().map(u16::from).collect();
        info.globals.insert(
            string_key(&text),
            GlobalInfo {
                index: next as u16,
                size: words.len() as u16,
                array: true,
                init: words.clone(),
            },
        );
        next += words.len() as u32;
    }
    globals_end_check(next, &mut c);
    if c.errors.is_empty() {
        Ok(info)
    } else {
        let mut errors = c.errors;
        errors.sort_by_key(|e| e.line);
        Err(errors)
    }
}

/// The `Info::globals` key of a string literal used in a function: the text
/// in double quotes, which no name can be.
pub fn string_key(text: &str) -> String {
    format!("\"{text}\"")
}

fn item_line(item: &Item) -> usize {
    match item {
        Item::Fn { line, .. } | Item::Var { line, .. } | Item::Const { line, .. } => *line,
    }
}

fn reserved(name: &str) -> bool {
    name.starts_with('_')
}

fn reserved_error(line: usize, name: &str) -> LangError {
    LangError::new(
        line,
        "reserved-name",
        format!("{name}: names starting with _ belong to the compiler"),
        &[("name", name.to_string())],
    )
}

fn duplicate(line: usize, name: &str) -> LangError {
    LangError::new(
        line,
        "duplicate-name",
        format!("{name} is already declared"),
        &[("name", name.to_string())],
    )
}

/// Whether every path through `body` ends with a return.
fn returns(body: &[Stmt]) -> bool {
    match body.last() {
        Some(Stmt::Return { .. }) => true,
        Some(Stmt::If {
            then,
            otherwise: Some(e),
            ..
        }) => returns(then) && returns(e),
        _ => false,
    }
}

impl Checker<'_> {
    fn same(&mut self, found: &T, expected: &T, line: usize) {
        let ok = match (found, expected) {
            (T::Arr(a, n), T::Arr(b, m)) if a == b && n != m => {
                self.errors.push(LangError::new(
                    line,
                    "array-length",
                    format!("the value has {n} elements, the type says {m}"),
                    &[("found", n.to_string()), ("expected", m.to_string())],
                ));
                return;
            }
            _ => fits(found, expected),
        };
        if !ok {
            self.errors.push(mismatch(line, expected, found));
        }
    }

    /// A type as written; `param`: a parameter (`[T]` allowed, `[T; N]` not).
    fn ty(&mut self, t: &Type, param: bool) -> Option<T> {
        Some(match t {
            Type::Int => T::Int,
            Type::Bool => T::Bool,
            Type::Array { elem, size } => {
                let e = Box::new(self.ty(elem, false)?);
                match size {
                    None => T::Ref(e),
                    Some(n) => {
                        let line = n.line();
                        let n = match self.eval(n)? {
                            CVal::Int(v)
                                if (1..=MAX_GLOBALS as i32).contains(&(v as i16 as i32)) =>
                            {
                                v
                            }
                            _ => {
                                self.errors.push(LangError::new(
                                    line,
                                    "bad-array-size",
                                    format!("an array's size must be a constant from 1 to {MAX_GLOBALS}"),
                                    &[("max", MAX_GLOBALS.to_string())],
                                ));
                                return None;
                            }
                        };
                        if param {
                            let found = T::Arr(e.clone(), n);
                            self.errors.push(mismatch(line, &T::Ref(e), &found));
                            return None;
                        }
                        T::Arr(e, n)
                    }
                }
            }
        })
    }

    /// The value of constant `name`, worked out once.
    fn constant(&mut self, name: &str) -> Option<CVal> {
        if let Some(v) = self.consts.get(name) {
            return Some(v.clone());
        }
        let Some(Item::Const { value, line, .. }) = self.items.get(name).copied() else {
            return None;
        };
        if !self.busy.insert(name.to_string()) {
            self.errors.push(not_constant(*line));
            return None;
        }
        let v = self.eval(value);
        self.busy.remove(name);
        if let Some(v) = &v {
            self.consts.insert(name.to_string(), v.clone());
        }
        v
    }

    /// A constant expression's value (None after reporting why not).
    fn eval(&mut self, e: &Expr) -> Option<CVal> {
        let line = e.line();
        let int = |c: &mut Self, e: &Expr| -> Option<u16> {
            match c.eval(e)? {
                CVal::Int(v) => Some(v),
                other => {
                    c.errors.push(mismatch(e.line(), &T::Int, &other.ty()));
                    None
                }
            }
        };
        let boolean = |c: &mut Self, e: &Expr| -> Option<bool> {
            match c.eval(e)? {
                CVal::Bool(v) => Some(v),
                other => {
                    c.errors.push(mismatch(e.line(), &T::Bool, &other.ty()));
                    None
                }
            }
        };
        Some(match e {
            Expr::Num { value, .. } => CVal::Int(*value),
            Expr::Bool { value, .. } => CVal::Bool(*value),
            Expr::Str { text, .. } => CVal::Arr(T::Int, text.bytes().map(u16::from).collect()),
            Expr::Array { items, .. } => {
                let mut elem: Option<T> = None;
                let mut words = Vec::new();
                for it in items {
                    let v = self.eval(it)?;
                    let t = v.ty();
                    if !matches!(t, T::Int | T::Bool) {
                        self.errors.push(mismatch(it.line(), &T::Int, &t));
                        return None;
                    }
                    match &elem {
                        Some(want) if *want != t => {
                            self.errors.push(mismatch(it.line(), want, &t));
                            return None;
                        }
                        _ => elem = Some(t),
                    }
                    words.extend(v.words());
                }
                if words.is_empty() {
                    self.errors.push(LangError::new(
                        line,
                        "bad-array-size",
                        format!("an array's size must be a constant from 1 to {MAX_GLOBALS}"),
                        &[("max", MAX_GLOBALS.to_string())],
                    ));
                    return None;
                }
                CVal::Arr(elem.unwrap_or(T::Int), words)
            }
            Expr::Name { name, .. } => match self.items.get(name.as_str()) {
                Some(Item::Const { .. }) => self.constant(name)?,
                Some(_) => {
                    self.errors.push(not_constant(line));
                    return None;
                }
                None => {
                    self.errors.push(unknown(line, name));
                    return None;
                }
            },
            Expr::Unary { op, operand, .. } => match op.as_str() {
                "not" => CVal::Bool(!boolean(self, operand)?),
                "-" => CVal::Int(int(self, operand)?.wrapping_neg()),
                _ => CVal::Int(!int(self, operand)?),
            },
            Expr::Binary {
                op, left, right, ..
            } => match op.as_str() {
                "and" | "or" => {
                    let (a, b) = (boolean(self, left)?, boolean(self, right)?);
                    CVal::Bool(if op == "and" { a && b } else { a || b })
                }
                "==" | "!=" => {
                    let (a, b) = (self.eval(left)?, self.eval(right)?);
                    if a.ty() != b.ty() || matches!(a, CVal::Arr(..)) {
                        self.errors.push(mismatch(line, &a.ty(), &b.ty()));
                        return None;
                    }
                    CVal::Bool((a == b) == (op == "=="))
                }
                _ => {
                    let (a, b) = (int(self, left)?, int(self, right)?);
                    let (sa, sb) = (a as i16, b as i16);
                    match op.as_str() {
                        "<" => CVal::Bool(sa < sb),
                        "<=" => CVal::Bool(sa <= sb),
                        ">" => CVal::Bool(sa > sb),
                        ">=" => CVal::Bool(sa >= sb),
                        "+" => CVal::Int(a.wrapping_add(b)),
                        "-" => CVal::Int(a.wrapping_sub(b)),
                        "*" => CVal::Int(a.wrapping_mul(b)),
                        "/" if b == 0 => CVal::Int(0xffff),
                        "/" => CVal::Int(sa.wrapping_div(sb) as u16),
                        "%" if b == 0 => CVal::Int(a),
                        "%" => CVal::Int(sa.wrapping_rem(sb) as u16),
                        "&" => CVal::Int(a & b),
                        "|" => CVal::Int(a | b),
                        "^" => CVal::Int(a ^ b),
                        "<<" => CVal::Int(a << (b & 15)),
                        _ => CVal::Int(a >> (b & 15)),
                    }
                }
            },
            Expr::Index { .. } | Expr::Mem { .. } | Expr::Call { .. } => {
                self.errors.push(not_constant(line));
                return None;
            }
        })
    }
}

fn unknown(line: usize, name: &str) -> LangError {
    LangError::new(
        line,
        "unknown-name",
        format!("{name} isn't declared"),
        &[("name", name.to_string())],
    )
}

fn not_a_function(line: usize, name: &str) -> LangError {
    LangError::new(
        line,
        "not-a-function",
        format!("{name} isn't a function"),
        &[("name", name.to_string())],
    )
}

/// Where a local name lives.
#[derive(Clone, Debug)]
enum Where {
    Arg,
    Local,
}

/// Checks one function body.
struct Func<'a, 'b> {
    g: &'a BTreeMap<String, Global>,
    c: &'a mut Checker<'b>,
    /// Visible locals and parameters, innermost block last.
    scopes: Vec<BTreeMap<String, (T, Where)>>,
    /// Every name declared in this function (no name twice).
    declared: BTreeSet<String>,
    locals: BTreeMap<String, u16>,
    count: u16,
    loops: usize,
    result: T,
}

impl Func<'_, '_> {
    /// A new name in this function: false (after reporting) if it can't be.
    fn declare(&mut self, name: &str, line: usize) -> bool {
        if reserved(name) {
            self.c.errors.push(reserved_error(line, name));
            false
        } else if self.declared.contains(name) {
            self.c.errors.push(duplicate(line, name));
            false
        } else {
            self.declared.insert(name.to_string());
            true
        }
    }

    fn local(&mut self, name: &str, ty: T, line: usize, hidden: u16) {
        if self.declare(name, line) {
            self.locals.insert(name.to_string(), self.count);
            if let Some(s) = self.scopes.last_mut() {
                s.insert(name.to_string(), (ty, Where::Local));
            }
        }
        self.count += 1 + hidden;
    }

    fn lookup(&self, name: &str) -> Option<&(T, Where)> {
        self.scopes.iter().rev().find_map(|s| s.get(name))
    }

    fn block(&mut self, body: &[Stmt]) {
        self.scopes.push(BTreeMap::new());
        for s in body {
            self.stmt(s);
        }
        self.scopes.pop();
    }

    fn want(&mut self, e: &Expr, ty: &T) {
        if let Some(found) = self.expr(e) {
            if !fits(&found, ty) {
                self.c.errors.push(mismatch(e.line(), ty, &found));
            }
        }
    }

    fn stmt(&mut self, s: &Stmt) {
        match s {
            Stmt::Var {
                name,
                ty,
                value,
                line,
            } => {
                let found = self.expr(value);
                let declared = ty.as_ref().and_then(|t| self.c.ty(t, true));
                let ty = match (declared, found) {
                    (Some(d), Some(f)) => {
                        if !fits(&f, &d) {
                            self.c.errors.push(mismatch(value.line(), &d, &f));
                        }
                        d
                    }
                    (Some(d), None) => d,
                    (None, Some(T::Arr(e, _))) => T::Ref(e),
                    (None, Some(T::Nothing)) => {
                        self.c
                            .errors
                            .push(mismatch(value.line(), &T::Int, &T::Nothing));
                        T::Int
                    }
                    (None, Some(f)) => f,
                    (None, None) => T::Int,
                };
                self.local(name, ty, *line, 0);
            }
            Stmt::Assign {
                target,
                value,
                line,
            } => {
                let ty = match target {
                    Expr::Name { name, .. } => match self.lookup(name) {
                        Some((t @ (T::Int | T::Bool | T::Ref(_)), _)) => Some(t.clone()),
                        Some(_) => None,
                        None => match self.g.get(name) {
                            Some(Global::Var {
                                ty: t @ (T::Int | T::Bool),
                                ..
                            }) => Some(t.clone()),
                            None if !self.c.items.contains_key(name.as_str()) => {
                                self.c.errors.push(unknown(*line, name));
                                self.expr(value);
                                return;
                            }
                            _ => None,
                        },
                    },
                    Expr::Index { name, .. } => {
                        let constant = self.lookup(name).is_none()
                            && matches!(self.g.get(name), Some(Global::ConstArr { .. }));
                        if constant {
                            None
                        } else {
                            self.expr(target)
                        }
                    }
                    Expr::Mem { .. } => self.expr(target),
                    _ => None,
                };
                match ty {
                    Some(t) => self.want(value, &t),
                    None => {
                        self.c.errors.push(LangError::new(
                            *line,
                            "not-assignable",
                            "only a variable, an element of a variable array, or mem[...] can be assigned".into(),
                            &[],
                        ));
                        self.expr(value);
                    }
                }
            }
            Stmt::If {
                cond,
                then,
                otherwise,
                ..
            } => {
                self.want(cond, &T::Bool);
                self.block(then);
                if let Some(e) = otherwise {
                    self.block(e);
                }
            }
            Stmt::While { cond, body, .. } => {
                self.want(cond, &T::Bool);
                self.loops += 1;
                self.block(body);
                self.loops -= 1;
            }
            Stmt::For {
                var,
                from,
                to,
                body,
                line,
            } => {
                self.want(from, &T::Int);
                self.want(to, &T::Int);
                self.scopes.push(BTreeMap::new());
                // The variable, then its hidden end value.
                self.local(var, T::Int, *line, 1);
                self.loops += 1;
                self.block(body);
                self.loops -= 1;
                self.scopes.pop();
            }
            Stmt::Break { line } | Stmt::Continue { line } => {
                if self.loops == 0 {
                    self.c.errors.push(LangError::new(
                        *line,
                        "break-outside-loop",
                        "break and continue belong inside a loop".into(),
                        &[],
                    ));
                }
            }
            Stmt::Return { value, line } => match (value, self.result.clone()) {
                (None, T::Nothing) => {}
                (None, r) => self.c.errors.push(mismatch(*line, &r, &T::Nothing)),
                (Some(v), r) => self.want(v, &r),
            },
            Stmt::Expr { expr, line } => {
                if matches!(expr, Expr::Call { .. }) {
                    self.expr(expr);
                } else {
                    self.c.errors.push(LangError::new(
                        *line,
                        "call-not-statement",
                        "this does nothing: only a call can be a statement on its own".into(),
                        &[],
                    ));
                }
            }
        }
    }

    /// An expression's type (None after reporting a mistake in it).
    fn expr(&mut self, e: &Expr) -> Option<T> {
        let line = e.line();
        Some(match e {
            Expr::Num { .. } => T::Int,
            Expr::Bool { .. } => T::Bool,
            Expr::Str { text, .. } => {
                if !self.c.strings.contains(text) {
                    self.c.strings.push(text.clone());
                }
                T::Arr(Box::new(T::Int), text.len() as u16)
            }
            Expr::Array { .. } => {
                self.c.errors.push(LangError::new(
                    line,
                    "not-a-value",
                    "an array value can only be given to a global or a constant".into(),
                    &[],
                ));
                return None;
            }
            Expr::Name { name, .. } => {
                if let Some((t, _)) = self.lookup(name) {
                    return Some(t.clone());
                }
                match self.g.get(name) {
                    Some(Global::Var { ty, .. } | Global::ConstArr { ty, .. }) => ty.clone(),
                    Some(Global::Const(v)) => v.ty(),
                    Some(Global::Fn { .. }) => {
                        self.c.errors.push(LangError::new(
                            line,
                            "not-a-value",
                            format!("{name} is a function: call it with {name}(...)"),
                            &[("name", name.clone())],
                        ));
                        return None;
                    }
                    // Declared, but its declaration had a mistake.
                    None if self.c.items.contains_key(name.as_str()) => return None,
                    None => {
                        self.c.errors.push(unknown(line, name));
                        return None;
                    }
                }
            }
            Expr::Index { name, index, .. } => {
                self.want(index, &T::Int);
                let arr = self.expr(&Expr::Name {
                    name: name.clone(),
                    line,
                })?;
                match arr {
                    T::Arr(e, _) | T::Ref(e) => *e,
                    _ => {
                        self.c.errors.push(LangError::new(
                            line,
                            "not-an-array",
                            format!("{name} isn't an array"),
                            &[("name", name.clone())],
                        ));
                        return None;
                    }
                }
            }
            Expr::Mem { addr, .. } => {
                self.want(addr, &T::Int);
                T::Int
            }
            Expr::Call { name, args, .. } => {
                let sig = match self.g.get(name) {
                    _ if self.lookup(name).is_some() => None,
                    Some(Global::Fn { params, result }) => Some((params.clone(), result.clone())),
                    _ => None,
                };
                let Some((params, result)) = sig else {
                    for a in args {
                        self.expr(a);
                    }
                    let local = self.lookup(name).is_some();
                    match self.c.items.get(name.as_str()) {
                        // A function whose signature had a mistake.
                        Some(Item::Fn { .. }) if !local => {}
                        Some(_) => self.c.errors.push(not_a_function(line, name)),
                        None if local => self.c.errors.push(not_a_function(line, name)),
                        None => self.c.errors.push(unknown(line, name)),
                    }
                    return None;
                };
                if args.len() != params.len() {
                    self.c.errors.push(LangError::new(
                        line,
                        "arg-count",
                        format!(
                            "{name} takes {} argument(s), not {}",
                            params.len(),
                            args.len()
                        ),
                        &[
                            ("name", name.clone()),
                            ("expected", params.len().to_string()),
                            ("got", args.len().to_string()),
                        ],
                    ));
                    for a in args {
                        self.expr(a);
                    }
                } else {
                    for (a, p) in args.iter().zip(&params) {
                        self.want(a, p);
                    }
                }
                result
            }
            Expr::Unary { op, operand, .. } => {
                let t = if op == "not" { T::Bool } else { T::Int };
                self.want(operand, &t);
                t
            }
            Expr::Binary {
                op, left, right, ..
            } => match op.as_str() {
                "and" | "or" => {
                    self.want(left, &T::Bool);
                    self.want(right, &T::Bool);
                    T::Bool
                }
                "==" | "!=" => {
                    let (a, b) = (self.expr(left)?, self.expr(right)?);
                    if !matches!(a, T::Int | T::Bool) {
                        self.c.errors.push(mismatch(left.line(), &T::Int, &a));
                    } else if a != b {
                        self.c.errors.push(mismatch(right.line(), &a, &b));
                    }
                    T::Bool
                }
                "<" | "<=" | ">" | ">=" => {
                    self.want(left, &T::Int);
                    self.want(right, &T::Int);
                    T::Bool
                }
                _ => {
                    self.want(left, &T::Int);
                    self.want(right, &T::Int);
                    T::Int
                }
            },
        })
    }
}
