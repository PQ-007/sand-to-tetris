//! The typed tree into assembly (docs/ASSEMBLY.md).
//!
//! Registers: r0–r4 hold values while an expression is worked out (a value
//! at depth d lives in r{d}); r5 is always 0; r6 is the stack pointer; r7 is
//! scratch (constants, long jumps) and the return address on entry.
//!
//! A function's frame, from r6 up: the outgoing arguments, the saved return
//! address, one-word locals, spill slots, big locals; the caller's
//! arguments to this function sit just above it.
use std::collections::{BTreeMap, BTreeSet};

use crate::ast::*;

/// Registers for values: r0..r4.
const REGS: u8 = 5;

/// Stack space kept free above the globals.
pub const STACK_ROOM: u32 = 512;
pub const STACK_TOP: u32 = 0x4000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum J {
    Always,
    Z,
    Nz,
    N,
    Nn,
    C,
    Nc,
}

impl J {
    fn name(self) -> &'static str {
        match self {
            J::Always => "JMP",
            J::Z => "JZ",
            J::Nz => "JNZ",
            J::N => "JN",
            J::Nn => "JNN",
            J::C => "JC",
            J::Nc => "JNC",
        }
    }
    pub fn name_pub(self) -> &'static str {
        self.name()
    }
    pub fn not_pub(self) -> J {
        self.not()
    }
    fn not(self) -> J {
        match self {
            J::Always => J::Always,
            J::Z => J::Nz,
            J::Nz => J::Z,
            J::N => J::Nn,
            J::Nn => J::N,
            J::C => J::Nc,
            J::Nc => J::C,
        }
    }
}

/// One piece of output. Jumps and calls start short and are made long when
/// the assembler says they don't reach.
#[derive(Clone, Debug)]
pub enum Item {
    Line(String, usize),
    Label(String),
    Jump {
        cond: J,
        target: String,
        line: usize,
        long: bool,
    },
    Call {
        target: String,
        line: usize,
        long: bool,
    },
}

pub struct Output {
    pub items: Vec<Item>,
    /// The data image's end (first free RAM word).
    pub data_end: u32,
}

pub fn generate(prog: &Program) -> Output {
    let reach = Reach::find(prog);
    let mut g = Gen {
        prog,
        addr: BTreeMap::new(),
        str_addr: BTreeMap::new(),
        out: Vec::new(),
        line: 0,
        temp: 0,
        f: FrameInfo::default(),
        spill: 0,
        spill_max: 0,
        fid: 0,
        runtime: BTreeSet::new(),
    };
    // Globals from address 1 (so no object is at NULL), one-word ones first
    // (in reach of [r5 + n]).
    let mut next = 1u32;
    let sizes: Vec<u32> = prog
        .globals
        .iter()
        .map(|gl| prog.size(&gl.ty).unwrap_or(1))
        .collect();
    for small in [true, false] {
        for (i, _) in prog.globals.iter().enumerate() {
            if reach.globals.contains(&i) && (sizes[i] == 1) == small {
                g.addr.insert(i, next);
                next += sizes[i];
            }
        }
    }
    for (i, s) in prog.strings.iter().enumerate() {
        if reach.strings.contains(&i) {
            g.str_addr.insert(i, next);
            next += s.len() as u32;
        }
    }
    let data_end = next;

    g.emit("        .code");
    g.emit("        SET r5, 0");
    g.emit(&format!("        SET16 r6, {STACK_TOP}"));
    g.call("main");
    g.emit("        HALT");
    for (i, f) in prog.funcs.iter().enumerate() {
        if reach.funcs.contains(&f.name) {
            g.fid = i;
            g.function(f);
        }
    }
    for r in g.runtime.clone() {
        for l in runtime(r) {
            g.emit(&l);
        }
    }

    // The data image.
    let mut words: Vec<String> = vec!["0".into(); data_end as usize];
    for (i, gl) in prog.globals.iter().enumerate() {
        let Some(&a) = g.addr.get(&i) else { continue };
        for (k, w) in gl.init.iter().enumerate() {
            words[(a as usize) + k] = g.word(w);
        }
    }
    for (i, s) in prog.strings.iter().enumerate() {
        let Some(&a) = g.str_addr.get(&i) else {
            continue;
        };
        for (k, c) in s.iter().enumerate() {
            words[(a as usize) + k] = c.to_string();
        }
    }
    if !words.is_empty() {
        g.emit("        .data");
        let mut i = 0;
        while i < words.len() {
            let zeros = words[i..].iter().take_while(|w| *w == "0").count();
            if zeros >= 4 {
                g.emit(&format!("        .space {zeros}"));
                i += zeros;
                continue;
            }
            let mut chunk = Vec::new();
            while i < words.len() && chunk.len() < 8 {
                let z = words[i..].iter().take_while(|w| *w == "0").count();
                if z >= 4 {
                    break;
                }
                chunk.push(words[i].clone());
                i += 1;
            }
            g.emit(&format!("        .word {}", chunk.join(", ")));
        }
    }
    Output {
        items: peephole(g.out),
        data_end,
    }
}

/// Small clean-ups on the output: a value stored to the frame or a low
/// global and loaded straight back into the same register needs no load,
/// and a jump to the very next line needs no jump.
fn peephole(items: Vec<Item>) -> Vec<Item> {
    let mut out: Vec<Item> = Vec::with_capacity(items.len());
    for item in items {
        if let (Item::Line(text, _), Some(Item::Line(prev, _))) = (&item, out.last()) {
            if let (Some(load), Some(store)) = (
                text.trim().strip_prefix("LOAD "),
                prev.trim().strip_prefix("STORE "),
            ) {
                // Only the frame (r6) and globals (r5): no device sits there.
                if load == store && (load.contains("[r6 ") || load.contains("[r5 ")) {
                    continue;
                }
            }
        }
        if let Item::Label(l) = &item {
            if let Some(Item::Jump {
                cond: J::Always,
                target,
                ..
            }) = out.last()
            {
                if target == l {
                    out.pop();
                }
            }
        }
        out.push(item);
    }
    out
}

/// Which functions, globals and strings the program uses, from `main`.
#[derive(Default)]
struct Reach {
    funcs: BTreeSet<String>,
    globals: BTreeSet<usize>,
    strings: BTreeSet<usize>,
}

impl Reach {
    fn find(prog: &Program) -> Reach {
        let mut r = Reach::default();
        let mut todo = vec!["main".to_string()];
        let mut todo_g: Vec<usize> = Vec::new();
        while !todo.is_empty() || !todo_g.is_empty() {
            if let Some(name) = todo.pop() {
                if !r.funcs.insert(name.clone()) {
                    continue;
                }
                if let Some(f) = prog.funcs.iter().find(|f| f.name == name) {
                    let mut found = Found::default();
                    found.stmt(&f.body);
                    todo.extend(found.funcs);
                    todo_g.extend(found.globals);
                    r.strings.extend(found.strings);
                }
            } else if let Some(g) = todo_g.pop() {
                if !r.globals.insert(g) {
                    continue;
                }
                for w in &prog.globals[g].init {
                    match w {
                        Word::Global(x, _) => todo_g.push(*x),
                        Word::Str(s, _) => {
                            r.strings.insert(*s);
                        }
                        Word::Func(n) => todo.push(n.clone()),
                        Word::Num(_) => {}
                    }
                }
            }
        }
        r
    }
}

#[derive(Default)]
struct Found {
    funcs: Vec<String>,
    globals: Vec<usize>,
    strings: Vec<usize>,
}

impl Found {
    fn stmt(&mut self, s: &Stmt) {
        match s {
            Stmt::Expr(e) => self.expr(e),
            Stmt::If(c, a, b) => {
                self.expr(c);
                self.stmt(a);
                if let Some(b) = b {
                    self.stmt(b);
                }
            }
            Stmt::Loop {
                init,
                cond,
                step,
                body,
                ..
            } => {
                if let Some(i) = init {
                    self.stmt(i);
                }
                if let Some(c) = cond {
                    self.expr(c);
                }
                if let Some(s) = step {
                    self.expr(s);
                }
                self.stmt(body);
            }
            Stmt::Switch { value, body, .. } => {
                self.expr(value);
                self.stmt(body);
            }
            Stmt::Return(Some(e), _) => self.expr(e),
            Stmt::Block(v) => v.iter().for_each(|s| self.stmt(s)),
            Stmt::Label(_) | Stmt::Goto(_) | Stmt::Return(None, _) => {}
        }
    }
    fn expr(&mut self, e: &Expr) {
        match &e.kind {
            Kind::Num(_) | Kind::Local(_) => {}
            Kind::Global(g) => self.globals.push(*g),
            Kind::Str(s) => self.strings.push(*s),
            Kind::Func(n) => self.funcs.push(n.clone()),
            Kind::Deref(x)
            | Kind::Member(x, _)
            | Kind::Addr(x)
            | Kind::Unary(_, x)
            | Kind::Cast(x)
            | Kind::IncDec { target: x, .. } => self.expr(x),
            Kind::Binary(_, _, a, b)
            | Kind::Cmp(_, _, a, b)
            | Kind::And(a, b)
            | Kind::Or(a, b)
            | Kind::Assign(a, b)
            | Kind::OpAssign(_, _, a, b)
            | Kind::Comma(a, b) => {
                self.expr(a);
                self.expr(b);
            }
            Kind::Cond(a, b, c) => {
                self.expr(a);
                self.expr(b);
                self.expr(c);
            }
            Kind::Call(f, args) => {
                self.expr(f);
                args.iter().for_each(|a| self.expr(a));
            }
        }
    }
}

#[derive(Default, Clone, Copy)]
struct FrameInfo {
    /// Outgoing argument words at [r6 + 0..].
    args: u32,
    words: u32,
    spills: u32,
    big: u32,
}

impl FrameInfo {
    fn ra(&self) -> u32 {
        self.args
    }
    fn word(&self, n: u32) -> u32 {
        self.args + 1 + n
    }
    fn spill(&self, n: u32) -> u32 {
        self.args + 1 + self.words + n
    }
    fn big(&self, n: u32) -> u32 {
        self.args + 1 + self.words + self.spills + n
    }
    fn size(&self) -> u32 {
        self.args + 1 + self.words + self.spills + self.big
    }
}

struct Gen<'a> {
    prog: &'a Program,
    addr: BTreeMap<usize, u32>,
    str_addr: BTreeMap<usize, u32>,
    out: Vec<Item>,
    line: usize,
    temp: u32,
    f: FrameInfo,
    spill: u32,
    spill_max: u32,
    fid: usize,
    runtime: BTreeSet<&'static str>,
}

fn r(d: u8) -> String {
    format!("r{d}")
}

fn is_call_free(e: &Expr) -> bool {
    let mut f = CallFinder(false);
    f.expr(e);
    !f.0
}

struct CallFinder(bool);
impl CallFinder {
    fn expr(&mut self, e: &Expr) {
        match &e.kind {
            Kind::Call(..) => self.0 = true,
            Kind::Binary(op, _, a, b) | Kind::OpAssign(op, _, a, b) => {
                // Multiplying or dividing by a variable calls the runtime,
                // which uses registers but not the argument area: fine.
                let _ = op;
                self.expr(a);
                self.expr(b);
            }
            Kind::Deref(x)
            | Kind::Member(x, _)
            | Kind::Addr(x)
            | Kind::Unary(_, x)
            | Kind::Cast(x)
            | Kind::IncDec { target: x, .. } => self.expr(x),
            Kind::Cmp(_, _, a, b)
            | Kind::And(a, b)
            | Kind::Or(a, b)
            | Kind::Assign(a, b)
            | Kind::Comma(a, b) => {
                self.expr(a);
                self.expr(b);
            }
            Kind::Cond(a, b, c) => {
                self.expr(a);
                self.expr(b);
                self.expr(c);
            }
            _ => {}
        }
    }
}

/// Registers an expression needs (a value at depth d uses r{d}..).
fn need(e: &Expr) -> u32 {
    let n = match &e.kind {
        Kind::Num(_) | Kind::Local(_) | Kind::Global(_) | Kind::Str(_) | Kind::Func(_) => 1,
        Kind::Call(..) => 1,
        Kind::Deref(x) | Kind::Member(x, _) | Kind::Addr(x) | Kind::Unary(_, x) | Kind::Cast(x) => {
            need(x)
        }
        Kind::Binary(_, _, a, b) | Kind::Cmp(_, _, a, b) => {
            if b.constant().is_some() {
                need(a)
            } else {
                need(a).max(need(b) + 1)
            }
        }
        Kind::And(a, b) | Kind::Or(a, b) | Kind::Comma(a, b) => need(a).max(need(b)),
        Kind::Cond(a, b, c) => need(a).max(need(b)).max(need(c)),
        Kind::Assign(l, v) => need(v).max(need(l) + 1),
        Kind::OpAssign(_, _, l, v) => need(l) + need(v) + 1,
        Kind::IncDec { target, .. } => need(target) + 1,
    };
    n.min(9)
}

/// A place in memory: a base register and an offset 0..127.
type Place = (u8, u32);

impl Gen<'_> {
    fn emit(&mut self, s: &str) {
        self.out.push(Item::Line(s.to_string(), self.line));
    }
    fn ins(&mut self, s: String) {
        self.out.push(Item::Line(format!("        {s}"), self.line));
    }
    fn label(&mut self, l: &str) {
        self.out.push(Item::Label(l.to_string()));
    }
    fn jump(&mut self, cond: J, target: &str) {
        self.out.push(Item::Jump {
            cond,
            target: target.to_string(),
            line: self.line,
            long: false,
        });
    }
    fn call(&mut self, target: &str) {
        self.out.push(Item::Call {
            target: label_of(target),
            line: self.line,
            long: false,
        });
    }
    fn temp_label(&mut self) -> String {
        self.temp += 1;
        format!("__t{}", self.temp)
    }
    fn flabel(&self, l: Label) -> String {
        format!("__f{}_{l}", self.fid)
    }
    fn word(&self, w: &Word) -> String {
        match w {
            Word::Num(v) => v.to_string(),
            Word::Global(g, o) => {
                ((*self.addr.get(g).unwrap_or(&0) as i32 + o) & 0xFFFF).to_string()
            }
            Word::Str(s, o) => {
                ((*self.str_addr.get(s).unwrap_or(&0) as i32 + o) & 0xFFFF).to_string()
            }
            Word::Func(n) => label_of(n),
        }
    }

    /// rd ← a constant.
    fn set(&mut self, d: u8, v: i32) {
        let v = v & 0xFFFF;
        if v <= 255 {
            self.ins(format!("SET {}, {v}", r(d)));
        } else {
            self.ins(format!("SET16 {}, {v}", r(d)));
        }
    }
    fn set_r7(&mut self, v: i32) {
        self.set(7, v);
    }
    /// rd ← rd + v.
    fn add_const(&mut self, d: u8, v: i32) {
        let v = v & 0xFFFF;
        if v == 0 {
        } else if v <= 255 {
            self.ins(format!("ADDI {}, {v}", r(d)));
        } else if v >= 0x10000 - 255 {
            self.ins(format!("SUBI {}, {}", r(d), 0x10000 - v));
        } else {
            self.set_r7(v);
            self.ins(format!("ADD {0}, {0}, r7", r(d)));
        }
    }

    fn load_frame(&mut self, reg: u8, off: u32) {
        if off <= 127 {
            self.ins(format!("LOAD {}, [r6 + {off}]", r(reg)));
        } else {
            self.set_r7(off as i32);
            self.ins("ADD r7, r7, r6".into());
            self.ins(format!("LOAD {}, [r7 + 0]", r(reg)));
        }
    }
    fn store_frame(&mut self, reg: u8, off: u32) {
        if off <= 127 {
            self.ins(format!("STORE {}, [r6 + {off}]", r(reg)));
        } else {
            self.set_r7(off as i32);
            self.ins("ADD r7, r7, r6".into());
            self.ins(format!("STORE {}, [r7 + 0]", r(reg)));
        }
    }
    fn push_spill(&mut self) -> u32 {
        self.spill += 1;
        self.spill_max = self.spill_max.max(self.spill);
        self.f.spill(self.spill - 1)
    }
    fn pop_spills(&mut self, n: u32) {
        self.spill -= n;
    }

    // ---- functions ----

    fn function(&mut self, f: &Func) {
        let mut args = 0;
        max_args(&f.body, &mut args);
        // Twice: the first run counts spill slots, the second uses them.
        let start = self.out.len();
        let temp = self.temp;
        self.f = FrameInfo {
            args,
            words: f.words,
            spills: 0,
            big: f.big,
        };
        self.spill_max = 0;
        self.body(f);
        self.out.truncate(start);
        self.temp = temp;
        self.f.spills = self.spill_max;
        self.body(f);
    }

    fn body(&mut self, f: &Func) {
        self.line = f.line;
        self.spill = 0;
        let size = self.f.size();
        self.label(&label_of(&f.name));
        if size <= 255 {
            self.ins(format!("SUBI r6, {size}"));
        } else {
            self.set(1, size as i32);
            self.ins("SUB r6, r6, r1".into());
        }
        self.store_frame(7, self.f.ra());
        self.stmt(&f.body);
        let ret = format!("__f{}_ret", self.fid);
        // A `return` as the very last statement needs no jump.
        if let Some(Item::Jump { target, .. }) = self.out.last() {
            if *target == ret {
                self.out.pop();
            }
        }
        self.label(&ret);
        self.load_frame(7, self.f.ra());
        if size <= 255 {
            self.ins(format!("ADDI r6, {size}"));
        } else {
            self.set(1, size as i32);
            self.ins("ADD r6, r6, r1".into());
        }
        self.ins("RET".into());
    }

    fn slot(&self, s: Slot) -> u32 {
        match s {
            Slot::Word(n) => self.f.word(n),
            Slot::Big(n) => self.f.big(n),
            Slot::Param(n) => self.f.size() + n,
        }
    }

    // ---- statements ----

    fn stmt(&mut self, s: &Stmt) {
        match s {
            Stmt::Expr(e) => self.discard(e),
            Stmt::If(c, a, b) => {
                let other = self.temp_label();
                self.branch(c, 0, &other, false);
                self.stmt(a);
                match b {
                    Some(b) => {
                        let end = self.temp_label();
                        self.jump(J::Always, &end);
                        self.label(&other);
                        self.stmt(b);
                        self.label(&end);
                    }
                    None => self.label(&other),
                }
            }
            Stmt::Loop {
                init,
                cond,
                step,
                body,
                brk,
                cont,
                test_first,
            } => {
                if let Some(i) = init {
                    self.stmt(i);
                }
                let top = self.temp_label();
                let test = self.temp_label();
                if *test_first && cond.is_some() {
                    self.jump(J::Always, &test);
                }
                self.label(&top);
                self.stmt(body);
                self.label(&self.flabel(*cont));
                if let Some(s) = step {
                    self.discard(s);
                }
                self.label(&test);
                match cond {
                    Some(c) => self.branch(c, 0, &top, true),
                    None => self.jump(J::Always, &top),
                }
                self.label(&self.flabel(*brk));
            }
            Stmt::Switch {
                value,
                cases,
                default,
                body,
                brk,
            } => {
                self.gen(value, 0);
                for (v, l) in cases {
                    self.set(1, *v);
                    self.ins("CMP r0, r1".into());
                    self.jump(J::Z, &self.flabel(*l));
                }
                self.jump(J::Always, &self.flabel(default.unwrap_or(*brk)));
                self.stmt(body);
                self.label(&self.flabel(*brk));
            }
            Stmt::Label(l) => self.label(&self.flabel(*l)),
            Stmt::Goto(l) => self.jump(J::Always, &self.flabel(*l)),
            Stmt::Return(e, line) => {
                self.line = *line;
                if let Some(e) = e {
                    self.gen(e, 0);
                }
                self.jump(J::Always, &format!("__f{}_ret", self.fid));
            }
            Stmt::Block(v) => v.iter().for_each(|s| self.stmt(s)),
        }
    }

    /// An expression whose value isn't used.
    fn discard(&mut self, e: &Expr) {
        self.line = e.line;
        match &e.kind {
            Kind::IncDec { target, delta, .. } => self.inc_dec(target, *delta, false, 0, true),
            Kind::Comma(a, b) => {
                self.discard(a);
                self.discard(b);
            }
            Kind::Cast(x) => self.discard(x),
            Kind::Cond(c, a, b) => {
                let other = self.temp_label();
                let end = self.temp_label();
                self.branch(c, 0, &other, false);
                self.discard(a);
                self.jump(J::Always, &end);
                self.label(&other);
                self.discard(b);
                self.label(&end);
            }
            _ => self.gen(e, 0),
        }
    }

    // ---- expressions ----

    /// The value of `e` into r{d}.
    fn gen(&mut self, e: &Expr, d: u8) {
        self.line = e.line;
        if d > 0 && d as u32 + need(e) > REGS as u32 {
            // Not enough registers: park r0..r{d-1}, work from r0.
            let base: Vec<u32> = (0..d).map(|_| self.push_spill()).collect();
            for (i, off) in base.iter().enumerate() {
                self.store_frame(i as u8, *off);
            }
            self.gen_value(e, 0);
            self.ins(format!("MOV {}, r0", r(d)));
            for (i, off) in base.iter().enumerate() {
                self.load_frame(i as u8, *off);
            }
            self.pop_spills(d as u32);
            return;
        }
        self.gen_value(e, d);
    }

    fn gen_value(&mut self, e: &Expr, d: u8) {
        match &e.kind {
            Kind::Num(v) => self.set(d, *v),
            Kind::Func(n) => self.ins(format!("SET16 {}, {}", r(d), label_of(n))),
            Kind::Local(_) | Kind::Global(_) | Kind::Deref(_) | Kind::Member(..) | Kind::Str(_) => {
                let p = self.place(e, d);
                if matches!(e.ty, Ty::Array(..) | Ty::Struct(_)) {
                    self.materialize(p, d);
                } else {
                    self.ins(format!("LOAD {}, [{} + {}]", r(d), r(p.0), p.1));
                }
            }
            Kind::Addr(x) => {
                if let Kind::Func(n) = &x.kind {
                    self.ins(format!("SET16 {}, {}", r(d), label_of(n)));
                    return;
                }
                let p = self.place(x, d);
                self.materialize(p, d);
            }
            Kind::Cast(x) => {
                if x.ty == Ty::Void {
                    self.discard(x);
                } else {
                    self.gen(x, d);
                }
            }
            Kind::Unary(op, x) => {
                self.gen(x, d);
                match op {
                    UnOp::Neg => self.ins(format!("SUB {0}, r5, {0}", r(d))),
                    UnOp::BitNot => self.ins(format!("XORN {0}, {0}, r5", r(d))),
                    UnOp::Not => {
                        self.ins(format!("CMP {}, r5", r(d)));
                        self.ins(format!("SET {}, 0", r(d)));
                        self.ins("JNZ 2".into());
                        self.ins(format!("SET {}, 1", r(d)));
                    }
                }
            }
            Kind::Binary(op, signed, a, b) => {
                self.gen(a, d);
                self.apply(*op, *signed, d, b);
            }
            Kind::Cmp(op, signed, a, b) => {
                let c = self.compare(*op, *signed, a, b, d);
                self.ins(format!("SET {}, 1", r(d)));
                self.ins(format!("{} 2", c.name()));
                self.ins(format!("SET {}, 0", r(d)));
            }
            Kind::And(..) | Kind::Or(..) => {
                let no = self.temp_label();
                let end = self.temp_label();
                self.branch(e, d, &no, false);
                self.ins(format!("SET {}, 1", r(d)));
                self.jump(J::Always, &end);
                self.label(&no);
                self.ins(format!("SET {}, 0", r(d)));
                self.label(&end);
            }
            Kind::Cond(c, a, b) => {
                let other = self.temp_label();
                let end = self.temp_label();
                self.branch(c, d, &other, false);
                self.gen(a, d);
                self.jump(J::Always, &end);
                self.label(&other);
                self.gen(b, d);
                self.label(&end);
            }
            Kind::Comma(a, b) => {
                self.discard(a);
                self.gen(b, d);
            }
            Kind::Assign(l, v) => self.assign(l, v, d),
            Kind::OpAssign(op, signed, l, v) => self.op_assign(*op, *signed, l, v, d),
            Kind::IncDec {
                target,
                delta,
                post,
            } => self.inc_dec(target, *delta, *post, d, false),
            Kind::Call(f, args) => self.call_expr(f, args, d),
        }
    }

    /// r{d} ← the address `p` names.
    fn materialize(&mut self, p: Place, d: u8) {
        match p.0 {
            5 => self.set(d, p.1 as i32),
            6 => {
                self.ins(format!("MOV {}, r6", r(d)));
                self.add_const(d, p.1 as i32);
            }
            reg => {
                if reg != d {
                    self.ins(format!("MOV {}, {}", r(d), r(reg)));
                }
                self.add_const(d, p.1 as i32);
            }
        }
    }

    /// Where an lvalue is, as [base + 0..127]; computing it may use r{d}.
    fn place(&mut self, e: &Expr, d: u8) -> Place {
        match &e.kind {
            Kind::Local(s) => {
                let off = self.slot(*s);
                self.near(6, off, d)
            }
            Kind::Global(g) => {
                let a = *self.addr.get(g).unwrap_or(&0);
                self.near(5, a, d)
            }
            Kind::Str(s) => {
                let a = *self.str_addr.get(s).unwrap_or(&0);
                self.near(5, a, d)
            }
            Kind::Member(b, k) => {
                let (reg, o) = self.place(b, d);
                self.near(reg, o + k, d)
            }
            Kind::Deref(p) => self.pointed(p, d),
            _ => {
                self.gen(e, d);
                (d, 0)
            }
        }
    }

    /// [reg + off] if off fits; otherwise the full address into r{d}.
    fn near(&mut self, reg: u8, off: u32, d: u8) -> Place {
        if off <= 127 {
            return (reg, off);
        }
        self.materialize((reg, off), d);
        (d, 0)
    }

    /// The place a pointer value points at.
    fn pointed(&mut self, p: &Expr, d: u8) -> Place {
        match &p.kind {
            Kind::Addr(x) => return self.place(x, d),
            Kind::Cast(x) if x.ty.is_scalar() => return self.pointed(x, d),
            Kind::Binary(BinOp::Add, _, a, b) => {
                if let Some(k) = b.constant() {
                    if (0..=127).contains(&k) && a.ty.is_ptr() {
                        let (reg, o) = self.pointed(a, d);
                        return self.near(reg, o + k as u32, d);
                    }
                }
                // An array in the frame or the globals plus an index: the
                // index into r{d}, the array's offset in the instruction.
                if let Some((reg, o)) = self.fixed_place(a) {
                    self.gen(b, d);
                    if reg == 6 {
                        self.ins(format!("ADD {0}, {0}, r6", r(d)));
                    }
                    return self.near(d, o, d);
                }
            }
            _ => {}
        }
        self.gen(p, d);
        (d, 0)
    }

    /// The place of an array whose address needs no code (a global or a
    /// local), as (r5 or r6, offset).
    fn fixed_place(&self, a: &Expr) -> Option<Place> {
        let Kind::Addr(x) = &a.kind else { return None };
        let (reg, off) = self.fixed(x)?;
        (off <= 127).then_some((reg, off))
    }
    fn fixed(&self, x: &Expr) -> Option<Place> {
        match &x.kind {
            Kind::Local(s) => Some((6, self.slot(*s))),
            Kind::Global(g) => Some((5, *self.addr.get(g)?)),
            Kind::Str(s) => Some((5, *self.str_addr.get(s)?)),
            Kind::Member(b, k) => {
                let (reg, o) = self.fixed(b)?;
                Some((reg, o + k))
            }
            _ => None,
        }
    }

    fn assign(&mut self, l: &Expr, v: &Expr, d: u8) {
        if let Ty::Struct(_) = l.ty {
            let size = self.prog.size(&l.ty).unwrap_or(0);
            let src = self.place(v, d);
            self.materialize(src, d);
            let dst = self.place(l, d + 1);
            self.materialize(dst, d + 1);
            for w in 0..size {
                if w > 0 && w % 128 == 0 {
                    self.ins(format!("ADDI {}, 128", r(d)));
                    self.ins(format!("ADDI {}, 128", r(d + 1)));
                }
                self.ins(format!("LOAD r7, [{} + {}]", r(d), w % 128));
                self.ins(format!("STORE r7, [{} + {}]", r(d + 1), w % 128));
            }
            return;
        }
        self.gen(v, d);
        let (reg, off) = self.place(l, d + 1);
        self.ins(format!("STORE {}, [{} + {off}]", r(d), r(reg)));
    }

    fn op_assign(&mut self, op: BinOp, signed: bool, l: &Expr, v: &Expr, d: u8) {
        let (reg, off) = self.place(l, d);
        if reg != d {
            self.ins(format!("LOAD {}, [{} + {off}]", r(d), r(reg)));
            self.apply(op, signed, d, v);
            self.ins(format!("STORE {}, [{} + {off}]", r(d), r(reg)));
        } else {
            let t = d + 1;
            self.ins(format!("LOAD {}, [{} + {off}]", r(t), r(d)));
            self.apply(op, signed, t, v);
            self.ins(format!("STORE {}, [{} + {off}]", r(t), r(d)));
            self.ins(format!("MOV {}, {}", r(d), r(t)));
        }
    }

    fn inc_dec(&mut self, target: &Expr, delta: i32, post: bool, d: u8, discard: bool) {
        let (reg, off) = self.place(target, d);
        self.ins(format!("LOAD r7, [{} + {off}]", r(reg)));
        let dl = delta & 0xFFFF;
        if dl <= 255 {
            self.ins(format!("ADDI r7, {dl}"));
        } else if dl >= 0x10000 - 255 {
            self.ins(format!("SUBI r7, {}", 0x10000 - dl));
        } else {
            // A big step (a pointer to a big struct): the step in r{d+1}.
            let t = d + 1;
            self.set(t, dl);
            self.ins(format!("ADD r7, r7, {}", r(t)));
        }
        self.ins(format!("STORE r7, [{} + {off}]", r(reg)));
        if discard {
            return;
        }
        self.ins(format!("MOV {}, r7", r(d)));
        if post {
            self.add_const(d, -delta);
        }
    }

    fn call_expr(&mut self, f: &Expr, args: &[Expr], d: u8) {
        // Values in r0..r{d-1} survive the call in spill slots.
        let saved: Vec<u32> = (0..d).map(|_| self.push_spill()).collect();
        for (i, off) in saved.iter().enumerate() {
            self.store_frame(i as u8, *off);
        }
        let direct = match &f.kind {
            Kind::Func(n) => Some(n.clone()),
            _ => None,
        };
        let callee_slot = if direct.is_none() {
            self.gen(f, 0);
            let s = self.push_spill();
            self.store_frame(0, s);
            Some(s)
        } else {
            None
        };
        if args.iter().all(is_call_free) {
            for (i, a) in args.iter().enumerate() {
                self.gen(a, 0);
                self.ins(format!("STORE r0, [r6 + {i}]"));
            }
        } else {
            let temps: Vec<u32> = args
                .iter()
                .map(|a| {
                    self.gen(a, 0);
                    let s = self.push_spill();
                    self.store_frame(0, s);
                    s
                })
                .collect();
            for (i, s) in temps.iter().enumerate() {
                self.load_frame(0, *s);
                self.ins(format!("STORE r0, [r6 + {i}]"));
            }
            self.pop_spills(temps.len() as u32);
        }
        self.line = f.line;
        match (direct, callee_slot) {
            (Some(n), _) => self.call(&n),
            (None, Some(s)) => {
                self.load_frame(7, s);
                self.ins("CALLR r7".into());
                self.pop_spills(1);
            }
            (None, None) => {}
        }
        if d != 0 {
            self.ins(format!("MOV {}, r0", r(d)));
        }
        for (i, off) in saved.iter().enumerate() {
            self.load_frame(i as u8, *off);
        }
        self.pop_spills(d as u32);
    }

    /// r{d} ← r{d} op v.
    fn apply(&mut self, op: BinOp, signed: bool, d: u8, v: &Expr) {
        if let Some(c) = v.constant() {
            self.apply_const(op, signed, d, c);
            return;
        }
        self.gen(v, d + 1);
        let (a, b) = (r(d), r(d + 1));
        match op {
            BinOp::Add => self.ins(format!("ADD {a}, {a}, {b}")),
            BinOp::Sub => self.ins(format!("SUB {a}, {a}, {b}")),
            BinOp::And => self.ins(format!("AND {a}, {a}, {b}")),
            BinOp::Or => self.ins(format!("OR {a}, {a}, {b}")),
            BinOp::Xor => self.ins(format!("XOR {a}, {a}, {b}")),
            BinOp::Shl => self.ins(format!("SHL {a}, {a}, {b}")),
            BinOp::Shr if signed => self.ins(format!("SAR {a}, {a}, {b}")),
            BinOp::Shr => self.ins(format!("SHR {a}, {a}, {b}")),
            BinOp::Mul => self.runtime_op("__mul", d, false),
            BinOp::Div => self.runtime_op(if signed { "__divs" } else { "__divu" }, d, false),
            BinOp::Mod => self.runtime_op(if signed { "__divs" } else { "__divu" }, d, true),
        }
    }

    /// r{d} ← routine(r{d}, r{d+1}); the routines take r0, r1 and return
    /// the result in r0 (a division's remainder in r1), using r0–r4.
    fn runtime_op(&mut self, name: &'static str, d: u8, remainder: bool) {
        self.runtime.insert(name);
        let saved: Vec<u32> = (0..d).map(|_| self.push_spill()).collect();
        for (i, off) in saved.iter().enumerate() {
            self.store_frame(i as u8, *off);
        }
        if d != 0 {
            self.ins(format!("MOV r0, {}", r(d)));
            self.ins(format!("MOV r1, {}", r(d + 1)));
        }
        self.call(name);
        let res = if remainder { 1 } else { 0 };
        if d != res {
            self.ins(format!("MOV {}, r{res}", r(d)));
        }
        for (i, off) in saved.iter().enumerate() {
            self.load_frame(i as u8, *off);
        }
        self.pop_spills(d as u32);
    }

    /// r{d} ← routine(r{d}, c).
    fn runtime_const(&mut self, name: &'static str, d: u8, c: i32, remainder: bool) {
        self.runtime.insert(name);
        let saved: Vec<u32> = (0..d).map(|_| self.push_spill()).collect();
        for (i, off) in saved.iter().enumerate() {
            self.store_frame(i as u8, *off);
        }
        if d != 0 {
            self.ins(format!("MOV r0, {}", r(d)));
        }
        self.set(1, c);
        self.call(name);
        let res = if remainder { 1 } else { 0 };
        if d != res {
            self.ins(format!("MOV {}, r{res}", r(d)));
        }
        for (i, off) in saved.iter().enumerate() {
            self.load_frame(i as u8, *off);
        }
        self.pop_spills(d as u32);
    }

    fn apply_const(&mut self, op: BinOp, signed: bool, d: u8, c: i32) {
        let a = r(d);
        let c16 = c & 0xFFFF;
        match op {
            BinOp::Add => self.add_const(d, c16),
            BinOp::Sub => self.add_const(d, -c16),
            BinOp::And | BinOp::Or | BinOp::Xor => {
                let name = match op {
                    BinOp::And => "AND",
                    BinOp::Or => "OR",
                    _ => "XOR",
                };
                match (op, c16) {
                    (BinOp::And, 0xFFFF) | (BinOp::Or | BinOp::Xor, 0) => {}
                    (BinOp::And, 0) => self.set(d, 0),
                    (BinOp::Xor, 0xFFFF) => self.ins(format!("XORN {a}, {a}, r5")),
                    _ => {
                        self.set_r7(c16);
                        self.ins(format!("{name} {a}, {a}, r7"));
                    }
                }
            }
            BinOp::Shl => {
                if c16 >= 16 {
                    self.set(d, 0);
                } else if c16 > 0 {
                    self.ins(format!("SHL {a}, {a}, {c16}"));
                }
            }
            BinOp::Shr => {
                if signed {
                    if c16 > 0 {
                        self.ins(format!("SAR {a}, {a}, {}", c16.min(15)));
                    }
                } else if c16 >= 16 {
                    self.set(d, 0);
                } else if c16 > 0 {
                    self.ins(format!("SHR {a}, {a}, {c16}"));
                }
            }
            BinOp::Mul => self.mul_const(d, c16 as u16),
            BinOp::Div | BinOp::Mod => {
                let neg = signed && c < 0;
                let m = if signed { c.unsigned_abs() } else { c16 as u32 };
                if m.is_power_of_two() && m < 0x8000 {
                    let k = m.trailing_zeros();
                    if op == BinOp::Div {
                        if signed && k > 0 {
                            // Round toward zero: add m − 1 to negatives.
                            self.ins(format!("SAR r7, {a}, 15"));
                            self.ins(format!("SHR r7, r7, {}", 16 - k));
                            self.ins(format!("ADD {a}, {a}, r7"));
                            self.ins(format!("SAR {a}, {a}, {k}"));
                        } else if k > 0 {
                            self.ins(format!("SHR {a}, {a}, {k}"));
                        }
                        if neg {
                            self.ins(format!("SUB {a}, r5, {a}"));
                        }
                    } else if !signed {
                        self.apply_const(BinOp::And, false, d, (m - 1) as i32);
                    } else if k == 0 {
                        self.set(d, 0);
                    } else {
                        self.ins(format!("SAR r7, {a}, 15"));
                        self.ins(format!("SHR r7, r7, {}", 16 - k));
                        self.ins(format!("ADD r7, r7, {a}"));
                        self.ins(format!("SAR r7, r7, {k}"));
                        self.ins(format!("SHL r7, r7, {k}"));
                        self.ins(format!("SUB {a}, {a}, r7"));
                    }
                    return;
                }
                // Through the runtime.
                let name = if signed { "__divs" } else { "__divu" };
                self.runtime_const(name, d, c16, op == BinOp::Mod);
            }
        }
    }

    /// r{d} ← r{d} × c with shifts and adds when c has few bits.
    fn mul_const(&mut self, d: u8, c: u16) {
        let a = r(d);
        if c == 0 {
            self.set(d, 0);
            return;
        }
        let neg = (c as i16) < 0 && (c.wrapping_neg()).count_ones() < c.count_ones();
        let m = if neg { c.wrapping_neg() } else { c };
        let bits: Vec<u32> = (0..16).rev().filter(|b| m >> b & 1 == 1).collect();
        if bits.len() <= 4 {
            if bits.len() > 1 {
                self.ins(format!("MOV r7, {a}"));
            }
            for w in bits.windows(2) {
                self.ins(format!("SHL {a}, {a}, {}", w[0] - w[1]));
                self.ins(format!("ADD {a}, {a}, r7"));
            }
            let last = bits.last().copied().unwrap_or(0);
            if last > 0 {
                self.ins(format!("SHL {a}, {a}, {last}"));
            }
        } else if (m as u32 + (m & m.wrapping_neg()) as u32).is_power_of_two() {
            // 2^p − 2^q (a run of ones).
            let q = m.trailing_zeros();
            let p = (m as u32 + (1 << q)).trailing_zeros();
            self.ins(format!("MOV r7, {a}"));
            if p >= 16 {
                self.set(d, 0);
            } else {
                self.ins(format!("SHL {a}, {a}, {p}"));
            }
            if q > 0 {
                self.ins(format!("SHL r7, r7, {q}"));
            }
            self.ins(format!("SUB {a}, {a}, r7"));
        } else {
            self.runtime_const("__mul", d, c as i32, false);
            return;
        }
        if neg {
            self.ins(format!("SUB {a}, r5, {a}"));
        }
    }

    /// Works out a comparison and sets the flags; returns the jump that is
    /// taken when it holds.
    fn compare(&mut self, op: CmpOp, signed: bool, a: &Expr, b: &Expr, d: u8) -> J {
        let mut op = op;
        let mut konst = b.constant();
        // a <= c is a < c + 1, a > c is a >= c + 1.
        if let Some(c) = konst {
            let max = if signed { 0x7FFF } else { 0xFFFF };
            let c = if signed { c } else { c & 0xFFFF };
            if c < max {
                if op == CmpOp::Le {
                    op = CmpOp::Lt;
                    konst = Some(c + 1);
                } else if op == CmpOp::Gt {
                    op = CmpOp::Ge;
                    konst = Some(c + 1);
                }
            }
        }
        self.gen(a, d);
        let ra = r(d);
        if konst == Some(0) {
            match op {
                CmpOp::Eq | CmpOp::Ne => {
                    self.ins(format!("CMP {ra}, r5"));
                    return if op == CmpOp::Eq { J::Z } else { J::Nz };
                }
                CmpOp::Lt | CmpOp::Ge if signed => {
                    self.ins(format!("CMP {ra}, r5"));
                    return if op == CmpOp::Lt { J::N } else { J::Nn };
                }
                CmpOp::Ge => {
                    // Unsigned x >= 0: always.
                    self.ins("CMP r5, r5".into());
                    return J::Z;
                }
                _ => {}
            }
        }
        let flip = signed && !matches!(op, CmpOp::Eq | CmpOp::Ne);
        if konst.is_none() {
            self.gen(b, d + 1);
        }
        if flip {
            // Signed order = unsigned order with both sign bits flipped.
            self.ins("SET r7, 0".into());
            self.ins("SETH r7, 128".into());
            self.ins(format!("XOR {ra}, {ra}, r7"));
        }
        let rb = match konst {
            Some(c) => {
                let c = if flip {
                    (c ^ 0x8000) & 0xFFFF
                } else {
                    c & 0xFFFF
                };
                self.set_r7(c);
                "r7".to_string()
            }
            None => {
                if flip {
                    self.ins(format!("XOR {0}, {0}, r7", r(d + 1)));
                }
                r(d + 1)
            }
        };
        match op {
            CmpOp::Eq | CmpOp::Ne => {
                self.ins(format!("CMP {ra}, {rb}"));
                if op == CmpOp::Eq {
                    J::Z
                } else {
                    J::Nz
                }
            }
            CmpOp::Lt => {
                self.ins(format!("CMP {ra}, {rb}"));
                J::Nc
            }
            CmpOp::Ge => {
                self.ins(format!("CMP {ra}, {rb}"));
                J::C
            }
            CmpOp::Gt => {
                self.ins(format!("CMP {rb}, {ra}"));
                J::Nc
            }
            CmpOp::Le => {
                self.ins(format!("CMP {rb}, {ra}"));
                J::C
            }
        }
    }

    /// Jumps to `target` when `e` is true (`when`) or false (`!when`).
    fn branch(&mut self, e: &Expr, d: u8, target: &str, when: bool) {
        self.line = e.line;
        match &e.kind {
            Kind::Num(v) => {
                if (*v != 0) == when {
                    self.jump(J::Always, target);
                }
            }
            Kind::Unary(UnOp::Not, x) => self.branch(x, d, target, !when),
            Kind::And(a, b) => {
                if when {
                    let skip = self.temp_label();
                    self.branch(a, d, &skip, false);
                    self.branch(b, d, target, true);
                    self.label(&skip);
                } else {
                    self.branch(a, d, target, false);
                    self.branch(b, d, target, false);
                }
            }
            Kind::Or(a, b) => {
                if when {
                    self.branch(a, d, target, true);
                    self.branch(b, d, target, true);
                } else {
                    let skip = self.temp_label();
                    self.branch(a, d, &skip, true);
                    self.branch(b, d, target, false);
                    self.label(&skip);
                }
            }
            Kind::Cmp(op, signed, a, b) if d as u32 + need(e) <= REGS as u32 => {
                let c = self.compare(*op, *signed, a, b, d);
                self.jump(if when { c } else { c.not() }, target);
            }
            Kind::Cast(x) if x.ty.is_scalar() => self.branch(x, d, target, when),
            Kind::Comma(a, b) => {
                self.discard(a);
                self.branch(b, d, target, when);
            }
            _ => {
                self.gen(e, d);
                self.ins(format!("CMP {}, r5", r(d)));
                self.jump(if when { J::Nz } else { J::Z }, target);
            }
        }
    }
}

/// Most arguments of any call in a statement.
fn max_args(s: &Stmt, m: &mut u32) {
    struct V<'a>(&'a mut u32);
    impl V<'_> {
        fn e(&mut self, e: &Expr) {
            match &e.kind {
                Kind::Call(f, args) => {
                    *self.0 = (*self.0).max(args.len() as u32);
                    self.e(f);
                    args.iter().for_each(|a| self.e(a));
                }
                Kind::Deref(x)
                | Kind::Member(x, _)
                | Kind::Addr(x)
                | Kind::Unary(_, x)
                | Kind::Cast(x)
                | Kind::IncDec { target: x, .. } => self.e(x),
                Kind::Binary(_, _, a, b)
                | Kind::Cmp(_, _, a, b)
                | Kind::And(a, b)
                | Kind::Or(a, b)
                | Kind::Assign(a, b)
                | Kind::OpAssign(_, _, a, b)
                | Kind::Comma(a, b) => {
                    self.e(a);
                    self.e(b);
                }
                Kind::Cond(a, b, c) => {
                    self.e(a);
                    self.e(b);
                    self.e(c);
                }
                _ => {}
            }
        }
        fn s(&mut self, s: &Stmt) {
            match s {
                Stmt::Expr(e) | Stmt::Return(Some(e), _) => self.e(e),
                Stmt::If(c, a, b) => {
                    self.e(c);
                    self.s(a);
                    if let Some(b) = b {
                        self.s(b);
                    }
                }
                Stmt::Loop {
                    init,
                    cond,
                    step,
                    body,
                    ..
                } => {
                    if let Some(i) = init {
                        self.s(i);
                    }
                    if let Some(c) = cond {
                        self.e(c);
                    }
                    if let Some(st) = step {
                        self.e(st);
                    }
                    self.s(body);
                }
                Stmt::Switch { value, body, .. } => {
                    self.e(value);
                    self.s(body);
                }
                Stmt::Block(v) => v.iter().for_each(|x| self.s(x)),
                _ => {}
            }
        }
    }
    V(m).s(s);
}

/// A C function's assembly label (register names can't be labels).
pub fn label_of(name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    let reg = lower.len() == 2 && lower.starts_with('r') && lower.as_bytes()[1].is_ascii_digit();
    if reg || is_mnemonic(&lower) {
        format!("_{name}")
    } else {
        name.to_string()
    }
}

fn is_mnemonic(w: &str) -> bool {
    matches!(
        w,
        "add"
            | "sub"
            | "and"
            | "andn"
            | "or"
            | "orn"
            | "xor"
            | "xorn"
            | "alu"
            | "mov"
            | "cmp"
            | "test"
            | "set"
            | "seth"
            | "addi"
            | "subi"
            | "shl"
            | "shr"
            | "sar"
            | "load"
            | "store"
            | "jmp"
            | "jz"
            | "jeq"
            | "jnz"
            | "jne"
            | "jn"
            | "jnn"
            | "jc"
            | "jhs"
            | "jnc"
            | "jlo"
            | "jhi"
            | "call"
            | "jr"
            | "callr"
            | "ret"
            | "set16"
            | "inc"
            | "dec"
            | "nop"
            | "halt"
    )
}

/// The runtime routines in assembly. Arguments in r0 and r1; the result in
/// r0 (and a division's remainder in r1); they use r0–r4 and r7.
fn runtime(name: &str) -> Vec<String> {
    let s = |v: &[&str]| v.iter().map(|l| l.to_string()).collect::<Vec<_>>();
    match name {
        // Shift-and-add over the smaller operand's bits.
        "__mul" => s(&[
            "__mul:  CMP r0, r1",
            "        JHS __mul_go",
            "        MOV r2, r0",
            "        MOV r0, r1",
            "        MOV r1, r2",
            "__mul_go: SET r2, 0",
            "        SET r3, 1",
            "__mul_l: CMP r1, r5",
            "        JZ __mul_d",
            "        TEST r1, r3",
            "        JZ __mul_s",
            "        ADD r2, r2, r0",
            "__mul_s: SHL r0, r0, 1",
            "        SHR r1, r1, 1",
            "        JMP __mul_l",
            "__mul_d: MOV r0, r2",
            "        RET",
        ]),
        "__divu" => {
            let mut v = s(&["__divu:"]);
            v.extend(divide_core("__du"));
            v.push("        RET".into());
            v
        }
        // Signed: divide the sizes, then put the signs back. r4 bit 0: the
        // dividend was negative; bit 1: the quotient is.
        "__divs" => {
            let mut v = s(&[
                "__divs: SET r4, 0",
                "        CMP r0, r5",
                "        JNN __dsg_a",
                "        SUB r0, r5, r0",
                "        SET r4, 3",
                "__dsg_a: CMP r1, r5",
                "        JNN __dsg_b",
                "        SUB r1, r5, r1",
                "        SET r3, 2",
                "        XOR r4, r4, r3",
                "__dsg_b:",
            ]);
            v.extend(divide_core("__ds"));
            v.extend(s(&[
                "        SET r3, 2",
                "        TEST r4, r3",
                "        JZ __dsg_c",
                "        SUB r0, r5, r0",
                "__dsg_c: SET r3, 1",
                "        TEST r4, r3",
                "        JZ __dsg_d",
                "        SUB r1, r5, r1",
                "__dsg_d: RET",
            ]));
            v
        }
        _ => Vec::new(),
    }
}

/// Unsigned r0 / r1 → quotient r0, remainder r1; dividing by 0 gives 0
/// and the dividend.
fn divide_core(p: &str) -> Vec<String> {
    [
        "        CMP r1, r5",
        "        JNZ {p}_nz",
        "        MOV r1, r0",
        "        SET r0, 0",
        "        JMP {p}_end",
        // A divisor of 0x8000 or more goes in at most once.
        "{p}_nz: CMP r1, r5",
        "        JNN {p}_go",
        "        CMP r0, r1",
        "        JLO {p}_zero",
        "        SUB r1, r0, r1",
        "        SET r0, 1",
        "        JMP {p}_end",
        "{p}_zero: MOV r1, r0",
        "        SET r0, 0",
        "        JMP {p}_end",
        "{p}_go: SET r2, 0",
        "        SET r3, 16",
        "{p}_l:  SHL r2, r2, 1",
        "        CMP r0, r5",
        "        JNN {p}_b",
        "        ADDI r2, 1",
        "{p}_b:  SHL r0, r0, 1",
        "        CMP r2, r1",
        "        JLO {p}_n",
        "        SUB r2, r2, r1",
        "        ADDI r0, 1",
        "{p}_n:  SUBI r3, 1",
        "        JNZ {p}_l",
        "        MOV r1, r2",
        "{p}_end:",
    ]
    .iter()
    .map(|l| l.replace("{p}", p))
    .collect()
}
