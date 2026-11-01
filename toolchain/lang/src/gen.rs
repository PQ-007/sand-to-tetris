//! Stage 4: VM code (docs/VM.md) from the checked tree, as
//! docs/LANGUAGE.md "Compiling to the VM" describes.
use crate::{Expr, FuncInfo, Info, Item, Program, Stmt};

/// The program as VM code, one command per line.
pub fn generate(program: &Program, info: &Info) -> Vec<String> {
    let mut out = Vec::new();
    // Starting values of globals and constant arrays (zeros are already 0).
    let mut init = Vec::new();
    for g in info.globals.values() {
        for (j, w) in g.init.iter().enumerate() {
            if *w != 0 {
                init.push(format!("push {w}"));
                init.push(format!("set global {}", g.index as usize + j));
            }
        }
    }
    for item in &program.items {
        let Item::Fn { name, body, .. } = item else {
            continue;
        };
        let Some(f) = info.functions.get(name) else {
            continue;
        };
        out.push(format!("func {name} {} {}", f.params.len(), f.count));
        if name == "main" && !init.is_empty() {
            out.push("call _init 0".into());
            out.push("pop".into());
        }
        let mut g = Gen {
            info,
            f,
            out: &mut out,
            labels: 0,
            loops: Vec::new(),
        };
        for s in body {
            g.stmt(s);
        }
        if out.last().map(String::as_str) != Some("return") {
            out.push("push 0".into());
            out.push("return".into());
        }
    }
    if !init.is_empty() {
        out.push("func _init 0 0".into());
        out.extend(init);
        out.push("push 0".into());
        out.push("return".into());
    }
    out
}

struct Gen<'a> {
    info: &'a Info,
    f: &'a FuncInfo,
    out: &'a mut Vec<String>,
    labels: usize,
    /// (continue label, break label) of each loop we're in.
    loops: Vec<(String, String)>,
}

impl Gen<'_> {
    fn emit(&mut self, s: impl Into<String>) {
        self.out.push(s.into());
    }

    fn label(&mut self) -> String {
        self.labels += 1;
        format!("L{}", self.labels)
    }

    /// Where a variable lives: "local 3", "arg 0" or "global 7".
    fn place(&self, name: &str) -> Option<String> {
        if let Some(i) = self.f.locals.get(name) {
            return Some(format!("local {i}"));
        }
        if let Some(i) = self.f.params.iter().position(|p| p == name) {
            return Some(format!("arg {i}"));
        }
        self.info
            .globals
            .get(name)
            .map(|g| format!("global {}", g.index))
    }

    /// Pushes an array's address: a global array's first global, or a
    /// `[T]` variable's value.
    fn base(&mut self, name: &str) {
        if self.f.locals.contains_key(name) || self.f.params.iter().any(|p| p == name) {
            let at = self.place(name).unwrap_or_default();
            self.emit(format!("push {at}"));
        } else if let Some(g) = self.info.globals.get(name) {
            self.emit(format!("push {}", g.index));
        }
    }

    fn is_array_global(&self, name: &str) -> bool {
        !self.f.locals.contains_key(name)
            && !self.f.params.iter().any(|p| p == name)
            && self.info.globals.get(name).is_some_and(|g| g.array)
    }

    fn stmt(&mut self, s: &Stmt) {
        match s {
            Stmt::Var { name, value, .. } => {
                self.expr(value);
                let at = self.place(name).unwrap_or_default();
                self.emit(format!("set {at}"));
            }
            Stmt::Assign { target, value, .. } => match target {
                Expr::Name { name, .. } => {
                    self.expr(value);
                    let at = self.place(name).unwrap_or_default();
                    self.emit(format!("set {at}"));
                }
                Expr::Index { name, index, .. } => {
                    self.base(name);
                    self.expr(index);
                    self.emit("add");
                    self.expr(value);
                    self.emit("store");
                }
                Expr::Mem { addr, .. } => {
                    self.expr(addr);
                    self.expr(value);
                    self.emit("store");
                }
                _ => {}
            },
            Stmt::If {
                cond,
                then,
                otherwise,
                ..
            } => {
                let other = self.label();
                self.expr(cond);
                self.emit(format!("jumpifnot {other}"));
                self.block(then);
                match otherwise {
                    Some(e) => {
                        let end = self.label();
                        self.emit(format!("jump {end}"));
                        self.emit(format!("label {other}"));
                        self.block(e);
                        self.emit(format!("label {end}"));
                    }
                    None => self.emit(format!("label {other}")),
                }
            }
            Stmt::While { cond, body, .. } => {
                let (top, end) = (self.label(), self.label());
                self.emit(format!("label {top}"));
                self.expr(cond);
                self.emit(format!("jumpifnot {end}"));
                self.loops.push((top.clone(), end.clone()));
                self.block(body);
                self.loops.pop();
                self.emit(format!("jump {top}"));
                self.emit(format!("label {end}"));
            }
            Stmt::For {
                var,
                from,
                to,
                body,
                ..
            } => {
                let i = self.f.locals.get(var).copied().unwrap_or(0);
                let (top, next, end) = (self.label(), self.label(), self.label());
                self.expr(from);
                self.emit(format!("set local {i}"));
                self.expr(to);
                self.emit(format!("set local {}", i + 1));
                self.emit(format!("label {top}"));
                self.emit(format!("push local {i}"));
                self.emit(format!("push local {}", i + 1));
                self.emit("lt");
                self.emit(format!("jumpifnot {end}"));
                self.loops.push((next.clone(), end.clone()));
                self.block(body);
                self.loops.pop();
                self.emit(format!("label {next}"));
                self.emit(format!("push local {i}"));
                self.emit("push 1");
                self.emit("add");
                self.emit(format!("set local {i}"));
                self.emit(format!("jump {top}"));
                self.emit(format!("label {end}"));
            }
            Stmt::Break { .. } | Stmt::Continue { .. } => {
                if let Some((cont, brk)) = self.loops.last().cloned() {
                    let to = if matches!(s, Stmt::Break { .. }) {
                        brk
                    } else {
                        cont
                    };
                    self.emit(format!("jump {to}"));
                }
            }
            Stmt::Return { value, .. } => {
                match value {
                    Some(v) => self.expr(v),
                    None => self.emit("push 0"),
                }
                self.emit("return");
            }
            Stmt::Expr { expr, .. } => {
                self.expr(expr);
                self.emit("pop");
            }
        }
    }

    fn block(&mut self, body: &[Stmt]) {
        for s in body {
            self.stmt(s);
        }
    }

    fn expr(&mut self, e: &Expr) {
        match e {
            Expr::Num { value, .. } => self.emit(format!("push {value}")),
            Expr::Bool { value, .. } => self.emit(if *value { "push -1" } else { "push 0" }),
            Expr::Str { .. } | Expr::Array { .. } => {}
            Expr::Name { name, .. } => {
                if let Some(v) = self.info.consts.get(name) {
                    self.emit(format!("push {v}"));
                } else if self.is_array_global(name) {
                    self.base(name);
                } else {
                    let at = self.place(name).unwrap_or_default();
                    self.emit(format!("push {at}"));
                }
            }
            Expr::Index { name, index, .. } => {
                self.base(name);
                self.expr(index);
                self.emit("add");
                self.emit("load");
            }
            Expr::Mem { addr, .. } => {
                self.expr(addr);
                self.emit("load");
            }
            Expr::Call { name, args, .. } => {
                for a in args {
                    self.expr(a);
                }
                self.emit(format!("call {name} {}", args.len()));
            }
            Expr::Unary { op, operand, .. } => {
                self.expr(operand);
                self.emit(if op == "-" { "neg" } else { "not" });
            }
            Expr::Binary {
                op, left, right, ..
            } => {
                if op == "and" || op == "or" {
                    let end = self.label();
                    self.expr(left);
                    self.emit("dup");
                    self.emit(format!(
                        "{} {end}",
                        if op == "and" { "jumpifnot" } else { "jumpif" }
                    ));
                    self.emit("pop");
                    self.expr(right);
                    self.emit(format!("label {end}"));
                    return;
                }
                self.expr(left);
                self.expr(right);
                self.emit(match op.as_str() {
                    "+" => "add",
                    "-" => "sub",
                    "*" => "mul",
                    "/" => "div",
                    "%" => "mod",
                    "&" => "and",
                    "|" => "or",
                    "^" => "xor",
                    "<<" => "shl",
                    ">>" => "shr",
                    "==" => "eq",
                    "!=" => "ne",
                    "<" => "lt",
                    "<=" => "le",
                    ">" => "gt",
                    _ => "ge",
                });
            }
        }
    }
}
