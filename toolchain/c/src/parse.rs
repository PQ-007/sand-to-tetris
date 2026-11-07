//! Tokens into a typed syntax tree. C needs to know which names are types
//! while it parses, so names, types and checks are handled here in one pass.
use std::collections::BTreeMap;

use crate::ast::*;
use crate::lex::{binary_prec, Tok, Token};
use crate::CError;

type R<T> = Result<T, CError>;

#[derive(Clone, Debug)]
enum Name {
    Var(VarRef, Ty),
    Typedef(Ty),
    Enum(i32),
    Func(FnTy),
}

#[derive(Clone, Copy, Debug)]
enum VarRef {
    Local(Slot),
    Global(usize),
}

#[derive(Default)]
struct Scope {
    names: BTreeMap<String, Name>,
    tags: BTreeMap<String, usize>,
}

/// A switch's cases so far, and its default.
type Cases = (Vec<(i32, Label)>, Option<Label>);

#[derive(Default)]
struct FnCtx {
    ret: Option<Ty>,
    words: u32,
    big: u32,
    labels: u32,
    brk: Vec<Label>,
    cont: Vec<Label>,
    switches: Vec<Cases>,
    user_labels: BTreeMap<String, (Label, bool, usize)>,
}

struct Decl {
    name: Option<String>,
    ty: Ty,
    line: usize,
}

#[derive(Default, Clone, Copy)]
struct Storage {
    typedef: bool,
    is_static: bool,
    is_extern: bool,
}

pub struct Parser {
    toks: Vec<Token>,
    pos: usize,
    pub prog: Program,
    scopes: Vec<Scope>,
    f: FnCtx,
    /// Parameter names of the last function declarator parsed.
    last_params: Vec<(Option<String>, Ty)>,
    defined: BTreeMap<String, usize>,
    statics: u32,
    /// Where the function body being parsed starts (its `{`).
    body_start: Option<usize>,
    pub errors: Vec<CError>,
}

fn err(line: usize, code: &str, message: String, args: &[(&str, String)]) -> CError {
    CError::new(line, code, message, args)
}

/// A 16-bit value as the type sees it: −32768..32767 or 0..65535.
fn norm(v: i64, ty: &Ty) -> i32 {
    let w = (v & 0xFFFF) as i32;
    if ty.is_unsigned() || w < 0x8000 {
        w
    } else {
        w - 0x10000
    }
}

pub fn parse(toks: Vec<Token>) -> (Program, Vec<CError>) {
    let mut p = Parser {
        toks,
        pos: 0,
        prog: Program::default(),
        scopes: vec![Scope::default()],
        f: FnCtx::default(),
        last_params: Vec::new(),
        defined: BTreeMap::new(),
        statics: 0,
        body_start: None,
        errors: Vec::new(),
    };
    while !p.at_eof() {
        if let Err(e) = p.top_level() {
            p.errors.push(e);
            p.sync();
        }
    }
    (p.prog, p.errors)
}

impl Parser {
    // ---- tokens ----

    fn peek(&self) -> &Tok {
        &self.toks[self.pos.min(self.toks.len() - 1)].tok
    }
    fn peek_at(&self, n: usize) -> &Tok {
        &self.toks[(self.pos + n).min(self.toks.len() - 1)].tok
    }
    fn line(&self) -> usize {
        self.toks[self.pos.min(self.toks.len() - 1)].line
    }
    fn at_eof(&self) -> bool {
        *self.peek() == Tok::Eof
    }
    fn is(&self, p: &str) -> bool {
        matches!(self.peek(), Tok::Punct(q) if *q == p)
    }
    fn is_word(&self, w: &str) -> bool {
        matches!(self.peek(), Tok::Ident(q) if q == w)
    }
    fn eat(&mut self, p: &str) -> bool {
        if self.is(p) {
            self.pos += 1;
            true
        } else {
            false
        }
    }
    fn eat_word(&mut self, w: &str) -> bool {
        if self.is_word(w) {
            self.pos += 1;
            true
        } else {
            false
        }
    }
    fn found(&self) -> String {
        match self.peek() {
            Tok::Ident(s) => s.clone(),
            Tok::Num(v, _) => v.to_string(),
            Tok::Str(_) => "a string".into(),
            Tok::Punct(p) => p.to_string(),
            Tok::Eof => "the end of the program".into(),
        }
    }
    fn expected(&self, what: &str) -> CError {
        let found = self.found();
        err(
            self.line(),
            "expected",
            format!("expected {what} here, not {found}"),
            &[("what", crate::expected_code(what)), ("found", found)],
        )
    }
    fn expect(&mut self, p: &str) -> R<()> {
        if self.eat(p) {
            Ok(())
        } else {
            Err(self.expected(&format!("`{p}`")))
        }
    }
    fn ident(&mut self) -> R<String> {
        match self.peek().clone() {
            Tok::Ident(s) if !is_keyword(&s) => {
                self.pos += 1;
                Ok(s)
            }
            _ => Err(self.expected("a name")),
        }
    }
    /// After an error: skip to the next top-level `;` or `}`.
    fn sync(&mut self) {
        if let Some(start) = self.body_start.take() {
            // Inside a function: skip the rest of its body.
            self.pos = start;
            let mut depth = 0i32;
            while !self.at_eof() {
                match self.peek() {
                    Tok::Punct("{") => depth += 1,
                    Tok::Punct("}") => {
                        depth -= 1;
                        if depth == 0 {
                            self.pos += 1;
                            break;
                        }
                    }
                    _ => {}
                }
                self.pos += 1;
            }
            self.scopes.truncate(1);
            self.f = FnCtx::default();
            return;
        }
        let mut depth = 0i32;
        while !self.at_eof() {
            match self.peek() {
                Tok::Punct("{") => depth += 1,
                Tok::Punct("}") => {
                    depth -= 1;
                    if depth <= 0 {
                        self.pos += 1;
                        if depth == 0 {
                            break;
                        }
                        depth = 0;
                        continue;
                    }
                }
                Tok::Punct(";") if depth <= 0 => {
                    self.pos += 1;
                    break;
                }
                _ => {}
            }
            self.pos += 1;
        }
        self.scopes.truncate(1);
        self.f = FnCtx::default();
    }

    // ---- names ----

    fn lookup(&self, name: &str) -> Option<&Name> {
        self.scopes.iter().rev().find_map(|s| s.names.get(name))
    }
    fn declare(&mut self, name: &str, n: Name, line: usize) -> R<()> {
        let global = self.scopes.len() == 1;
        let Some(scope) = self.scopes.last_mut() else {
            return Ok(());
        };
        if let Some(old) = scope.names.get(name) {
            // A global or function may be declared again with the same type.
            let same = match (old, &n) {
                (Name::Func(a), Name::Func(b)) => a.ret == b.ret,
                (Name::Var(_, a), Name::Var(_, b)) => global && a == b,
                (Name::Typedef(a), Name::Typedef(b)) => a == b,
                _ => false,
            };
            if !same {
                return Err(err(
                    line,
                    "duplicate",
                    format!("{name} is already declared here"),
                    &[("name", name.to_string())],
                ));
            }
            if matches!(n, Name::Var(..)) {
                return Ok(());
            }
        }
        scope.names.insert(name.to_string(), n);
        Ok(())
    }
    fn is_typename(&self) -> bool {
        match self.peek() {
            Tok::Ident(s) => {
                matches!(
                    s.as_str(),
                    "void"
                        | "char"
                        | "short"
                        | "int"
                        | "long"
                        | "float"
                        | "double"
                        | "signed"
                        | "unsigned"
                        | "struct"
                        | "union"
                        | "enum"
                        | "typedef"
                        | "static"
                        | "extern"
                        | "const"
                        | "volatile"
                        | "register"
                        | "auto"
                        | "inline"
                        | "_Bool"
                ) || matches!(self.lookup(s), Some(Name::Typedef(_)))
            }
            _ => false,
        }
    }
    fn size(&self, ty: &Ty, line: usize) -> R<u32> {
        self.prog.size(ty).ok_or_else(|| {
            err(
                line,
                "unknown-type",
                "this type has no size (void, a function, or a struct not defined yet)".into(),
                &[],
            )
        })
    }

    // ---- declarations ----

    fn declspec(&mut self) -> R<(Ty, Storage)> {
        let mut st = Storage::default();
        let mut base: Option<Ty> = None;
        let mut unsigned = None;
        let mut any = false;
        let line = self.line();
        while let Tok::Ident(w) = self.peek().clone() {
            match w.as_str() {
                "typedef" => st.typedef = true,
                "static" => st.is_static = true,
                "extern" => st.is_extern = true,
                "const" | "volatile" | "register" | "auto" | "inline" => {}
                "signed" => unsigned = Some(false),
                "unsigned" => unsigned = Some(true),
                "char" | "short" | "int" | "_Bool" => {
                    if base.is_some() && w != "int" {
                        return Err(self.expected("one type"));
                    }
                    base.get_or_insert(INT);
                }
                "void" => base = Some(Ty::Void),
                "long" => return Err(unsupported(line, "long (the machine is 16-bit)")),
                "float" | "double" => {
                    return Err(unsupported(
                        line,
                        "floating point (use fixed-point ints instead)",
                    ))
                }
                "struct" | "union" => {
                    self.pos += 1;
                    base = Some(self.struct_decl(w == "union")?);
                    any = true;
                    continue;
                }
                "enum" => {
                    self.pos += 1;
                    base = Some(self.enum_decl()?);
                    any = true;
                    continue;
                }
                _ => {
                    if base.is_none() && unsigned.is_none() {
                        if let Some(Name::Typedef(t)) = self.lookup(&w) {
                            base = Some(t.clone());
                            self.pos += 1;
                            any = true;
                            continue;
                        }
                    }
                    break;
                }
            }
            any = true;
            self.pos += 1;
        }
        if !any {
            return Err(self.expected("a type"));
        }
        let ty = match (base, unsigned) {
            (Some(Ty::Int { .. }) | None, Some(u)) => Ty::Int { unsigned: u },
            (Some(t), _) => t,
            (None, None) => INT,
        };
        Ok((ty, st))
    }

    fn struct_decl(&mut self, union: bool) -> R<Ty> {
        let line = self.line();
        let tag = match self.peek() {
            Tok::Ident(_) => Some(self.ident()?),
            _ => None,
        };
        if !self.is("{") {
            let Some(tag) = tag else {
                return Err(self.expected("a struct name or `{`"));
            };
            if let Some(i) = self.scopes.iter().rev().find_map(|s| s.tags.get(&tag)) {
                return Ok(Ty::Struct(*i));
            }
            return Ok(Ty::Struct(self.new_struct(Some(tag), union)));
        }
        self.expect("{")?;
        // A definition: a tag already in this scope and not yet complete is
        // filled in; otherwise a new struct.
        let id = match tag
            .as_ref()
            .and_then(|t| self.scopes.last()?.tags.get(t).copied())
        {
            Some(i) if !self.prog.structs[i].complete => i,
            Some(_) => {
                return Err(err(
                    line,
                    "duplicate",
                    format!("struct {} is already defined", tag.unwrap_or_default()),
                    &[("name", "struct".into())],
                ))
            }
            None => self.new_struct(tag, union),
        };
        let mut members = Vec::new();
        let mut size = 0u32;
        while !self.eat("}") {
            let (base, _) = self.declspec()?;
            loop {
                let d = self.declarator(base.clone())?;
                if self.is(":") {
                    return Err(unsupported(d.line, "bit-fields"));
                }
                let Some(name) = d.name else {
                    return Err(self.expected("a member name"));
                };
                let s = self.size(&d.ty, d.line)?;
                if members.iter().any(|m: &Member| m.name == name) {
                    return Err(err(
                        d.line,
                        "duplicate",
                        format!("{name} is already a member"),
                        &[("name", name)],
                    ));
                }
                members.push(Member {
                    name,
                    ty: d.ty,
                    offset: if union { 0 } else { size },
                });
                size = if union { size.max(s) } else { size + s };
                if !self.eat(",") {
                    break;
                }
            }
            self.expect(";")?;
        }
        let def = &mut self.prog.structs[id];
        def.members = members;
        def.size = size;
        def.complete = true;
        Ok(Ty::Struct(id))
    }

    fn new_struct(&mut self, tag: Option<String>, union: bool) -> usize {
        let id = self.prog.structs.len();
        self.prog.structs.push(StructDef {
            tag: tag.clone(),
            union,
            members: Vec::new(),
            size: 0,
            complete: false,
        });
        if let (Some(t), Some(s)) = (tag, self.scopes.last_mut()) {
            s.tags.insert(t, id);
        }
        id
    }

    fn enum_decl(&mut self) -> R<Ty> {
        if let Tok::Ident(_) = self.peek() {
            self.ident()?;
        }
        if !self.eat("{") {
            return Ok(INT);
        }
        let mut next = 0i32;
        while !self.eat("}") {
            let line = self.line();
            let name = self.ident()?;
            if self.eat("=") {
                next = self.const_expr()?;
            }
            self.declare(&name, Name::Enum(next), line)?;
            next = norm(next as i64 + 1, &INT);
            if !self.eat(",") {
                self.expect("}")?;
                break;
            }
        }
        Ok(INT)
    }

    fn pointers(&mut self, mut ty: Ty) -> Ty {
        while self.eat("*") {
            while self.eat_word("const") || self.eat_word("volatile") {}
            ty = Ty::ptr(ty);
        }
        ty
    }

    /// A declarator: pointers, a name (or none, for type names), and array
    /// or function suffixes, with C's inside-out reading for parentheses.
    fn declarator(&mut self, base: Ty) -> R<Decl> {
        let ty = self.pointers(base);
        let line = self.line();
        if self.is("(") && matches!(self.peek_at(1), Tok::Punct("*") | Tok::Punct("(")) {
            // `(*name)(...)`: read the suffixes after the parentheses first,
            // then the inside with the type they make.
            let start = self.pos;
            self.pos += 1;
            self.declarator(INT)?;
            self.expect(")")?;
            let outer = self.suffixes(ty)?;
            let end = self.pos;
            self.pos = start + 1;
            let d = self.declarator(outer)?;
            self.expect(")")?;
            self.pos = end;
            return Ok(d);
        }
        let name = match self.peek() {
            Tok::Ident(s) if !is_keyword(s) => Some(self.ident()?),
            _ => None,
        };
        let ty = self.suffixes(ty)?;
        Ok(Decl { name, ty, line })
    }

    fn suffixes(&mut self, ty: Ty) -> R<Ty> {
        if self.eat("[") {
            let n = if self.eat("]") {
                None
            } else {
                let line = self.line();
                let n = self.const_expr()?;
                self.expect("]")?;
                if n <= 0 {
                    return Err(err(
                        line,
                        "bad-initializer",
                        "an array's size must be at least 1".into(),
                        &[],
                    ));
                }
                Some(n as u32)
            };
            let inner = self.suffixes(ty)?;
            return Ok(Ty::Array(Box::new(inner), n));
        }
        if self.eat("(") {
            let mut params = Vec::new();
            let mut unspecified = false;
            if self.eat(")") {
                unspecified = true;
            } else if self.is_word("void") && matches!(self.peek_at(1), Tok::Punct(")")) {
                self.pos += 2;
            } else {
                loop {
                    if self.is("...") {
                        return Err(unsupported(self.line(), "variadic functions (...)"));
                    }
                    let (base, _) = self.declspec()?;
                    let d = self.declarator(base)?;
                    let t = match d.ty {
                        Ty::Array(t, _) => Ty::Ptr(t),
                        f @ Ty::Func(_) => Ty::ptr(f),
                        t => t,
                    };
                    params.push((d.name, t));
                    if !self.eat(",") {
                        break;
                    }
                }
                self.expect(")")?;
            }
            let ret = self.suffixes(ty)?;
            self.last_params = params.clone();
            return Ok(Ty::Func(Box::new(FnTy {
                ret,
                params: params.into_iter().map(|(_, t)| t).collect(),
                unspecified,
            })));
        }
        Ok(ty)
    }

    fn type_name(&mut self) -> R<Ty> {
        let (base, _) = self.declspec()?;
        let d = self.declarator(base)?;
        if d.name.is_some() {
            return Err(self.expected("`)`"));
        }
        Ok(d.ty)
    }

    fn top_level(&mut self) -> R<()> {
        let (base, st) = self.declspec()?;
        if self.eat(";") {
            return Ok(());
        }
        loop {
            let d = self.declarator(base.clone())?;
            let Some(name) = d.name.clone() else {
                return Err(self.expected("a name"));
            };
            if st.typedef {
                self.declare(&name, Name::Typedef(d.ty), d.line)?;
            } else if let Ty::Func(f) = &d.ty {
                if matches!(f.ret, Ty::Struct(_) | Ty::Array(..)) {
                    return Err(unsupported(d.line, "returning a struct (return a pointer)"));
                }
                self.declare(&name, Name::Func((**f).clone()), d.line)?;
                if self.is("{") {
                    return self.function(name, (**f).clone(), d.line);
                }
            } else {
                self.global(name, d.ty, d.line, st)?;
            }
            if !self.eat(",") {
                break;
            }
        }
        self.expect(";")
    }

    fn global(&mut self, name: String, ty: Ty, line: usize, st: Storage) -> R<()> {
        if ty == Ty::Void {
            return Err(err(
                line,
                "void-value",
                format!("{name} can't be void"),
                &[("name", name)],
            ));
        }
        let index = match self.defined.get(&name) {
            Some(&i) => i,
            None => {
                let i = self.prog.globals.len();
                self.prog.globals.push(Global {
                    name: name.clone(),
                    ty: ty.clone(),
                    init: Vec::new(),
                    line,
                });
                self.defined.insert(name.clone(), i);
                i
            }
        };
        self.declare(&name, Name::Var(VarRef::Global(index), ty.clone()), line)?;
        if self.eat("=") {
            let (ty, words) = self.global_init(ty, line)?;
            let g = &mut self.prog.globals[index];
            g.ty = ty.clone();
            g.init = words;
            if let Some(Scope { names, .. }) = self.scopes.last_mut() {
                names.insert(name, Name::Var(VarRef::Global(index), ty));
            }
        } else if !st.is_extern {
            self.size(&self.prog.globals[index].ty.clone(), line)?;
        }
        Ok(())
    }

    /// A global's starting words; an array of unknown size gets its size.
    fn global_init(&mut self, ty: Ty, line: usize) -> R<(Ty, Vec<Word>)> {
        let mut items = Vec::new();
        let ty = self.initializer(ty, 0, &mut items)?;
        let size = self.size(&ty, line)?;
        let mut words = vec![Word::Num(0); size as usize];
        for (off, e) in items {
            let w = self.const_word(&e).ok_or_else(|| {
                err(
                    e.line,
                    "not-constant",
                    "a global's starting value must be known when compiling".into(),
                    &[],
                )
            })?;
            if let Some(slot) = words.get_mut(off as usize) {
                *slot = w;
            }
        }
        while words.last() == Some(&Word::Num(0)) {
            words.pop();
        }
        Ok((ty, words))
    }

    /// A constant or an address known when linking.
    fn const_word(&self, e: &Expr) -> Option<Word> {
        match &e.kind {
            Kind::Num(v) => Some(Word::Num(*v as u16)),
            Kind::Cast(x) => self.const_word(x),
            Kind::Func(n) => Some(Word::Func(n.clone())),
            Kind::Addr(x) => self.const_addr(x),
            Kind::Binary(BinOp::Add, _, a, b) => {
                let (p, k) = match (self.const_word(a)?, b.constant()) {
                    (w, Some(k)) => (w, k),
                    _ => (self.const_word(b)?, a.constant()?),
                };
                Some(match p {
                    Word::Global(g, o) => Word::Global(g, o + k),
                    Word::Str(s, o) => Word::Str(s, o + k),
                    Word::Num(v) => Word::Num((v as i32 + k) as u16),
                    Word::Func(_) => return None,
                })
            }
            _ => None,
        }
    }
    fn const_addr(&self, e: &Expr) -> Option<Word> {
        match &e.kind {
            Kind::Global(g) => Some(Word::Global(*g, 0)),
            Kind::Str(s) => Some(Word::Str(*s, 0)),
            Kind::Func(n) => Some(Word::Func(n.clone())),
            Kind::Deref(p) => self.const_word(p),
            Kind::Member(b, off) => match self.const_addr(b)? {
                Word::Global(g, o) => Some(Word::Global(g, o + *off as i32)),
                Word::Str(s, o) => Some(Word::Str(s, o + *off as i32)),
                _ => None,
            },
            _ => None,
        }
    }

    /// Reads an initialiser for `ty` at word `off`, adding (offset, value)
    /// pairs; returns the type with an array's size filled in.
    fn initializer(&mut self, ty: Ty, off: u32, out: &mut Vec<(u32, Expr)>) -> R<Ty> {
        let line = self.line();
        match &ty {
            Ty::Array(elem, n) => {
                if elem.is_int() {
                    let braced = self.is("{") && matches!(self.peek_at(1), Tok::Str(_));
                    if braced {
                        self.pos += 1;
                    }
                    if let Tok::Str(_) = self.peek() {
                        let s = self.string_lit();
                        if braced {
                            self.eat(",");
                            self.expect("}")?;
                        }
                        let len = n.unwrap_or(s.len() as u32 + 1);
                        if s.len() as u32 > len {
                            return Err(err(
                                line,
                                "bad-initializer",
                                format!("the string has {} characters, the array {len}", s.len()),
                                &[],
                            ));
                        }
                        for (i, c) in s.iter().enumerate() {
                            out.push((off + i as u32, Expr::num(*c as i32, line)));
                        }
                        return Ok(Ty::Array(elem.clone(), Some(len)));
                    }
                }
                let esize = self.size(elem, line)?;
                let mut count = 0u32;
                if self.eat("{") {
                    while !self.is("}") {
                        if n.is_some_and(|n| count >= n) {
                            return Err(err(
                                self.line(),
                                "bad-initializer",
                                "more values than the array holds".into(),
                                &[],
                            ));
                        }
                        self.initializer((**elem).clone(), off + count * esize, out)?;
                        count += 1;
                        if !self.eat(",") {
                            break;
                        }
                    }
                    self.expect("}")?;
                } else {
                    // Braces left out: fill elements from the enclosing list.
                    let Some(n) = n else {
                        return Err(self.expected("`{`"));
                    };
                    while count < *n {
                        self.initializer((**elem).clone(), off + count * esize, out)?;
                        count += 1;
                        if count < *n && self.is(",") && !matches!(self.peek_at(1), Tok::Punct("}"))
                        {
                            self.pos += 1;
                        } else {
                            break;
                        }
                    }
                }
                Ok(Ty::Array(elem.clone(), Some(n.unwrap_or(count.max(1)))))
            }
            Ty::Struct(id) => {
                let def = self.prog.structs[*id].clone();
                if !def.complete {
                    return Err(err(
                        line,
                        "unknown-type",
                        "this struct isn't defined yet".into(),
                        &[],
                    ));
                }
                let braced = self.eat("{");
                if !braced && !self.is("{") {
                    // A struct value: only as a whole local copy, handled by
                    // the caller; here it must be a list.
                    if def.members.is_empty() {
                        return Ok(ty);
                    }
                }
                for (i, m) in def.members.iter().enumerate() {
                    if braced && self.is("}") {
                        break;
                    }
                    self.initializer(m.ty.clone(), off + m.offset, out)?;
                    if def.union || i + 1 == def.members.len() {
                        break;
                    }
                    if self.is(",") && !matches!(self.peek_at(1), Tok::Punct("}")) {
                        self.pos += 1;
                    } else {
                        break;
                    }
                }
                if braced {
                    self.eat(",");
                    self.expect("}")?;
                }
                Ok(ty)
            }
            _ => {
                if self.eat("{") {
                    let t = self.initializer(ty, off, out)?;
                    self.eat(",");
                    self.expect("}")?;
                    return Ok(t);
                }
                let e = self.assign()?;
                let e = self.convert(e, &ty, "this value")?;
                out.push((off, e));
                Ok(ty)
            }
        }
    }

    fn function(&mut self, name: String, ty: FnTy, line: usize) -> R<()> {
        if self.prog.funcs.iter().any(|f| f.name == name) {
            return Err(err(
                line,
                "duplicate",
                format!("the function {name} is already defined"),
                &[("name", name)],
            ));
        }
        if matches!(ty.ret, Ty::Struct(_)) {
            return Err(unsupported(line, "returning a struct (return a pointer)"));
        }
        let params = std::mem::take(&mut self.last_params);
        self.f = FnCtx {
            ret: Some(ty.ret.clone()),
            ..FnCtx::default()
        };
        self.scopes.push(Scope::default());
        for (i, (pname, pty)) in params.iter().enumerate() {
            if matches!(pty, Ty::Struct(_)) {
                return Err(unsupported(line, "passing a struct (pass a pointer)"));
            }
            if let Some(n) = pname {
                self.declare(
                    n,
                    Name::Var(VarRef::Local(Slot::Param(i as u32)), pty.clone()),
                    line,
                )?;
            }
        }
        self.body_start = Some(self.pos);
        let body = self.block()?;
        self.body_start = None;
        self.scopes.pop();
        for (n, (_, defined, l)) in &self.f.user_labels {
            if !defined {
                return Err(err(
                    *l,
                    "unknown-label",
                    format!("goto {n}: there is no label {n} in this function"),
                    &[("name", n.clone())],
                ));
            }
        }
        let f = std::mem::take(&mut self.f);
        self.prog.funcs.push(Func {
            name,
            ty,
            body,
            words: f.words,
            big: f.big,
            labels: f.labels,
            line,
        });
        Ok(())
    }

    fn new_label(&mut self) -> Label {
        self.f.labels += 1;
        self.f.labels - 1
    }

    // ---- statements ----

    fn block(&mut self) -> R<Stmt> {
        self.expect("{")?;
        self.scopes.push(Scope::default());
        let mut out = Vec::new();
        while !self.eat("}") {
            if self.at_eof() {
                return Err(self.expected("`}`"));
            }
            if self.is_typename() {
                self.local_decl(&mut out)?;
            } else {
                out.push(self.stmt()?);
            }
        }
        self.scopes.pop();
        Ok(Stmt::Block(out))
    }

    fn local_decl(&mut self, out: &mut Vec<Stmt>) -> R<()> {
        let (base, st) = self.declspec()?;
        if self.eat(";") {
            return Ok(());
        }
        loop {
            let d = self.declarator(base.clone())?;
            let Some(name) = d.name.clone() else {
                return Err(self.expected("a name"));
            };
            if st.typedef {
                self.declare(&name, Name::Typedef(d.ty), d.line)?;
            } else if let Ty::Func(f) = &d.ty {
                self.declare(&name, Name::Func((**f).clone()), d.line)?;
            } else if st.is_static || st.is_extern {
                // Stored with the globals, under a name no one else has.
                self.statics += 1;
                let key = format!("{name}.{}", self.statics);
                let index = self.prog.globals.len();
                self.prog.globals.push(Global {
                    name: key,
                    ty: d.ty.clone(),
                    init: Vec::new(),
                    line: d.line,
                });
                let mut ty = d.ty.clone();
                if self.eat("=") {
                    let (t, words) = self.global_init(d.ty.clone(), d.line)?;
                    self.prog.globals[index].ty = t.clone();
                    self.prog.globals[index].init = words;
                    ty = t;
                } else {
                    self.size(&ty, d.line)?;
                }
                self.declare(&name, Name::Var(VarRef::Global(index), ty), d.line)?;
            } else {
                self.local_var(name, d.ty, d.line, out)?;
            }
            if !self.eat(",") {
                break;
            }
        }
        self.expect(";")
    }

    fn local_var(&mut self, name: String, ty: Ty, line: usize, out: &mut Vec<Stmt>) -> R<()> {
        if ty == Ty::Void {
            return Err(err(
                line,
                "void-value",
                format!("{name} can't be void"),
                &[("name", name)],
            ));
        }
        let mut items = Vec::new();
        let mut whole: Option<Expr> = None;
        let mut ty = ty;
        let has_init = self.eat("=");
        if has_init {
            if matches!(ty, Ty::Struct(_)) && !self.is("{") {
                whole = Some(self.assign()?);
            } else {
                ty = self.initializer(ty, 0, &mut items)?;
            }
        }
        let size = self.size(&ty, line)?;
        let slot = if size == 1 && ty.is_scalar() {
            self.f.words += 1;
            Slot::Word(self.f.words - 1)
        } else {
            self.f.big += size;
            Slot::Big(self.f.big - size)
        };
        self.declare(&name, Name::Var(VarRef::Local(slot), ty.clone()), line)?;
        let var = Expr {
            kind: Kind::Local(slot),
            ty: ty.clone(),
            line,
        };
        if let Some(rhs) = whole {
            out.push(Stmt::Expr(self.assign_to(var, rhs, line)?));
            return Ok(());
        }
        if !has_init {
            return Ok(());
        }
        if ty.is_scalar() {
            if let Some((_, e)) = items.pop() {
                out.push(Stmt::Expr(Expr {
                    kind: Kind::Assign(Box::new(var), Box::new(e)),
                    ty,
                    line,
                }));
            }
            return Ok(());
        }
        // An aggregate: every word, the ones not given set to 0.
        let mut values: Vec<Option<Expr>> = vec![None; size as usize];
        for (off, e) in items {
            if let Some(v) = values.get_mut(off as usize) {
                *v = Some(e);
            }
        }
        for (off, v) in values.into_iter().enumerate() {
            let target = Expr {
                kind: Kind::Member(Box::new(var.clone()), off as u32),
                ty: INT,
                line,
            };
            let value = v.unwrap_or_else(|| Expr::num(0, line));
            out.push(Stmt::Expr(Expr {
                kind: Kind::Assign(Box::new(target), Box::new(value)),
                ty: INT,
                line,
            }));
        }
        Ok(())
    }

    fn stmt(&mut self) -> R<Stmt> {
        let line = self.line();
        if self.is("{") {
            return self.block();
        }
        if self.eat(";") {
            return Ok(Stmt::Block(Vec::new()));
        }
        if let Tok::Ident(w) = self.peek().clone() {
            // A label: `name:` (not `a ? b : c`, which never starts a statement
            // with a name and a colon).
            if !is_keyword(&w) && matches!(self.peek_at(1), Tok::Punct(":")) {
                self.pos += 2;
                let l = self.user_label(&w, line);
                if let Some(e) = self.f.user_labels.get_mut(&w) {
                    if e.1 {
                        return Err(err(
                            line,
                            "duplicate",
                            format!("the label {w} is already used"),
                            &[("name", w)],
                        ));
                    }
                    e.1 = true;
                }
                let next = if self.is("}") {
                    Stmt::Block(Vec::new())
                } else {
                    self.stmt()?
                };
                return Ok(Stmt::Block(vec![Stmt::Label(l), next]));
            }
            match w.as_str() {
                "if" => {
                    self.pos += 1;
                    self.expect("(")?;
                    let c = self.cond_expr()?;
                    self.expect(")")?;
                    let then = self.stmt()?;
                    let other = if self.eat_word("else") {
                        Some(Box::new(self.stmt()?))
                    } else {
                        None
                    };
                    return Ok(Stmt::If(c, Box::new(then), other));
                }
                "while" => {
                    self.pos += 1;
                    self.expect("(")?;
                    let c = self.cond_expr()?;
                    self.expect(")")?;
                    let (body, brk, cont) = self.loop_body()?;
                    return Ok(Stmt::Loop {
                        init: None,
                        cond: Some(c),
                        step: None,
                        body: Box::new(body),
                        brk,
                        cont,
                        test_first: true,
                    });
                }
                "do" => {
                    self.pos += 1;
                    let (body, brk, cont) = self.loop_body()?;
                    if !self.eat_word("while") {
                        return Err(self.expected("`while`"));
                    }
                    self.expect("(")?;
                    let c = self.cond_expr()?;
                    self.expect(")")?;
                    self.expect(";")?;
                    return Ok(Stmt::Loop {
                        init: None,
                        cond: Some(c),
                        step: None,
                        body: Box::new(body),
                        brk,
                        cont,
                        test_first: false,
                    });
                }
                "for" => {
                    self.pos += 1;
                    self.expect("(")?;
                    self.scopes.push(Scope::default());
                    let init = if self.eat(";") {
                        None
                    } else if self.is_typename() {
                        let mut v = Vec::new();
                        self.local_decl(&mut v)?;
                        Some(Box::new(Stmt::Block(v)))
                    } else {
                        let e = self.expr()?;
                        self.expect(";")?;
                        Some(Box::new(Stmt::Expr(e)))
                    };
                    let cond = if self.is(";") {
                        None
                    } else {
                        Some(self.cond_expr()?)
                    };
                    self.expect(";")?;
                    let step = if self.is(")") {
                        None
                    } else {
                        Some(self.expr()?)
                    };
                    self.expect(")")?;
                    let (body, brk, cont) = self.loop_body()?;
                    self.scopes.pop();
                    return Ok(Stmt::Loop {
                        init,
                        cond,
                        step,
                        body: Box::new(body),
                        brk,
                        cont,
                        test_first: true,
                    });
                }
                "switch" => {
                    self.pos += 1;
                    self.expect("(")?;
                    let v = self.rvalue()?;
                    if !v.ty.is_int() {
                        return Err(mismatch(line, "switch needs an int"));
                    }
                    self.expect(")")?;
                    let brk = self.new_label();
                    self.f.brk.push(brk);
                    self.f.switches.push((Vec::new(), None));
                    let body = self.stmt();
                    self.f.brk.pop();
                    let (cases, default) = self.f.switches.pop().unwrap_or_default();
                    return Ok(Stmt::Switch {
                        value: v,
                        cases,
                        default,
                        body: Box::new(body?),
                        brk,
                    });
                }
                "case" | "default" => {
                    self.pos += 1;
                    let value = if w == "case" {
                        Some(self.const_expr()?)
                    } else {
                        None
                    };
                    self.expect(":")?;
                    let l = self.new_label();
                    let Some(sw) = self.f.switches.last_mut() else {
                        return Err(err(
                            line,
                            "case-outside",
                            format!("{w} is only allowed inside a switch"),
                            &[("what", w)],
                        ));
                    };
                    match value {
                        Some(v) => {
                            if sw.0.iter().any(|(c, _)| *c == v) {
                                return Err(err(
                                    line,
                                    "duplicate-case",
                                    format!("case {v} appears twice"),
                                    &[("value", v.to_string())],
                                ));
                            }
                            sw.0.push((v, l));
                        }
                        None => {
                            if sw.1.is_some() {
                                return Err(err(
                                    line,
                                    "duplicate-case",
                                    "default appears twice".into(),
                                    &[("value", "default".into())],
                                ));
                            }
                            sw.1 = Some(l);
                        }
                    }
                    let next = if self.is("}") {
                        Stmt::Block(Vec::new())
                    } else {
                        self.stmt()?
                    };
                    return Ok(Stmt::Block(vec![Stmt::Label(l), next]));
                }
                "break" | "continue" => {
                    self.pos += 1;
                    self.expect(";")?;
                    let target = if w == "break" {
                        self.f.brk.last()
                    } else {
                        self.f.cont.last()
                    };
                    let Some(&l) = target else {
                        return Err(err(
                            line,
                            if w == "break" {
                                "break-outside"
                            } else {
                                "continue-outside"
                            },
                            format!(
                                "{w} is only allowed inside a loop{}",
                                if w == "break" { " or switch" } else { "" }
                            ),
                            &[],
                        ));
                    };
                    return Ok(Stmt::Goto(l));
                }
                "return" => {
                    self.pos += 1;
                    let ret = self.f.ret.clone().unwrap_or(Ty::Void);
                    if self.eat(";") {
                        if ret != Ty::Void {
                            return Err(mismatch(line, "this function must return a value"));
                        }
                        return Ok(Stmt::Return(None, line));
                    }
                    let e = self.expr()?;
                    self.expect(";")?;
                    if ret == Ty::Void {
                        return Err(mismatch(line, "a void function can't return a value"));
                    }
                    let e = self.convert(e, &ret, "the returned value")?;
                    return Ok(Stmt::Return(Some(e), line));
                }
                "goto" => {
                    self.pos += 1;
                    let n = self.ident()?;
                    self.expect(";")?;
                    return Ok(Stmt::Goto(self.user_label(&n, line)));
                }
                _ => {}
            }
        }
        let e = self.expr()?;
        self.expect(";")?;
        Ok(Stmt::Expr(e))
    }

    fn user_label(&mut self, name: &str, line: usize) -> Label {
        if let Some((l, ..)) = self.f.user_labels.get(name) {
            return *l;
        }
        let l = self.new_label();
        self.f
            .user_labels
            .insert(name.to_string(), (l, false, line));
        l
    }

    fn loop_body(&mut self) -> R<(Stmt, Label, Label)> {
        let brk = self.new_label();
        let cont = self.new_label();
        self.f.brk.push(brk);
        self.f.cont.push(cont);
        let body = self.stmt();
        self.f.brk.pop();
        self.f.cont.pop();
        Ok((body?, brk, cont))
    }

    // ---- expressions ----

    fn const_expr(&mut self) -> R<i32> {
        let line = self.line();
        let e = self.cond()?;
        e.constant().ok_or_else(|| {
            err(
                line,
                "not-constant",
                "this must be a constant (known when compiling)".into(),
                &[],
            )
        })
    }

    /// A condition: any scalar.
    fn cond_expr(&mut self) -> R<Expr> {
        let e = self.expr()?;
        let e = self.decay(e);
        if !e.ty.is_scalar() {
            return Err(mismatch(
                e.line,
                "a condition must be a number or a pointer",
            ));
        }
        Ok(e)
    }

    fn rvalue(&mut self) -> R<Expr> {
        let e = self.expr()?;
        Ok(self.decay(e))
    }

    pub fn expr(&mut self) -> R<Expr> {
        let mut e = self.assign()?;
        while self.eat(",") {
            let line = self.line();
            let r = self.assign()?;
            let r = self.decay(r);
            e = Expr {
                ty: r.ty.clone(),
                kind: Kind::Comma(Box::new(e), Box::new(r)),
                line,
            };
        }
        Ok(e)
    }

    /// Arrays become pointers to their first element, functions pointers
    /// to themselves.
    fn decay(&self, e: Expr) -> Expr {
        match &e.ty {
            Ty::Array(t, _) => Expr {
                ty: Ty::Ptr(t.clone()),
                line: e.line,
                kind: Kind::Addr(Box::new(e)),
            },
            Ty::Func(_) => Expr {
                ty: Ty::ptr(e.ty.clone()),
                ..e
            },
            _ => e,
        }
    }

    /// `e` as a value of type `ty` (assignment, argument, return).
    fn convert(&self, e: Expr, ty: &Ty, what: &str) -> R<Expr> {
        let e = self.decay(e);
        let ok = match (ty, &e.ty) {
            (a, b) if a.is_scalar() && b.is_scalar() => true,
            (Ty::Struct(a), Ty::Struct(b)) => a == b,
            _ => false,
        };
        if !ok {
            return Err(mismatch(
                e.line,
                &format!(
                    "{what} has the wrong type ({} for {})",
                    self.show(&e.ty),
                    self.show(ty)
                ),
            ));
        }
        if e.ty == *ty {
            return Ok(e);
        }
        Ok(match e.kind {
            Kind::Num(v) => Expr {
                kind: Kind::Num(norm(v as i64, ty)),
                ty: ty.clone(),
                line: e.line,
            },
            _ => Expr {
                line: e.line,
                kind: Kind::Cast(Box::new(e)),
                ty: ty.clone(),
            },
        })
    }

    fn show(&self, t: &Ty) -> String {
        match t {
            Ty::Void => "void".into(),
            Ty::Int { unsigned: false } => "int".into(),
            Ty::Int { unsigned: true } => "unsigned".into(),
            Ty::Ptr(t) => format!("{} *", self.show(t)),
            Ty::Array(t, n) => format!(
                "{}[{}]",
                self.show(t),
                n.map(|n| n.to_string()).unwrap_or_default()
            ),
            Ty::Func(_) => "a function".into(),
            Ty::Struct(i) => {
                let s = &self.prog.structs[*i];
                format!(
                    "{} {}",
                    if s.union { "union" } else { "struct" },
                    s.tag.clone().unwrap_or_default()
                )
            }
        }
    }

    fn assign(&mut self) -> R<Expr> {
        let lhs = self.cond()?;
        let line = self.line();
        let op = match self.peek() {
            Tok::Punct(p) => *p,
            _ => return Ok(lhs),
        };
        let bin = match op {
            "=" => None,
            "+=" => Some(BinOp::Add),
            "-=" => Some(BinOp::Sub),
            "*=" => Some(BinOp::Mul),
            "/=" => Some(BinOp::Div),
            "%=" => Some(BinOp::Mod),
            "<<=" => Some(BinOp::Shl),
            ">>=" => Some(BinOp::Shr),
            "&=" => Some(BinOp::And),
            "|=" => Some(BinOp::Or),
            "^=" => Some(BinOp::Xor),
            _ => return Ok(lhs),
        };
        self.pos += 1;
        let rhs = self.assign()?;
        let Some(op) = bin else {
            return self.assign_to(lhs, rhs, line);
        };
        self.lvalue(&lhs)?;
        let rhs = self.decay(rhs);
        if !lhs.ty.is_scalar() || !rhs.ty.is_int() {
            return Err(mismatch(
                line,
                &format!("{op} needs numbers (or a pointer and a number)"),
            ));
        }
        let (rhs, signed) = if lhs.ty.is_ptr() {
            if !matches!(op, BinOp::Add | BinOp::Sub) {
                return Err(mismatch(line, &format!("{op} can't be used on a pointer")));
            }
            let s = self.target_size(&lhs.ty, line)?;
            (self.scale(rhs, s), false)
        } else {
            let signed = !(lhs.ty.is_unsigned() || rhs.ty.is_unsigned());
            (rhs, signed)
        };
        Ok(Expr {
            ty: lhs.ty.clone(),
            kind: Kind::OpAssign(op, signed, Box::new(lhs), Box::new(rhs)),
            line,
        })
    }

    fn assign_to(&self, lhs: Expr, rhs: Expr, line: usize) -> R<Expr> {
        self.lvalue(&lhs)?;
        if matches!(lhs.ty, Ty::Array(..)) {
            return Err(err(
                line,
                "not-lvalue",
                "an array can't be assigned as a whole (copy its elements)".into(),
                &[],
            ));
        }
        let rhs = self.convert(rhs, &lhs.ty, "the value assigned")?;
        if let Ty::Struct(_) = lhs.ty {
            if !rhs.is_lvalue() {
                return Err(unsupported(
                    line,
                    "this struct value (assign from a variable)",
                ));
            }
        }
        Ok(Expr {
            ty: lhs.ty.clone(),
            kind: Kind::Assign(Box::new(lhs), Box::new(rhs)),
            line,
        })
    }

    fn lvalue(&self, e: &Expr) -> R<()> {
        if e.is_lvalue() && !matches!(e.kind, Kind::Str(_)) {
            Ok(())
        } else {
            Err(err(
                e.line,
                "not-lvalue",
                "this can't be assigned to (it isn't a variable, element or member)".into(),
                &[],
            ))
        }
    }

    fn target_size(&self, ty: &Ty, line: usize) -> R<i32> {
        match ty.target() {
            Some(Ty::Void) => Ok(1),
            Some(t) => Ok(self.size(t, line)? as i32),
            None => Ok(1),
        }
    }

    fn scale(&self, e: Expr, s: i32) -> Expr {
        if s == 1 {
            return e;
        }
        let line = e.line;
        self.binary(BinOp::Mul, true, e, Expr::num(s, line), INT, line)
    }

    fn cond(&mut self) -> R<Expr> {
        let c = self.binary_expr(1)?;
        if !self.is("?") {
            return Ok(c);
        }
        let line = self.line();
        self.pos += 1;
        let a = self.expr()?;
        self.expect(":")?;
        let b = self.cond()?;
        let c = self.decay(c);
        let a = self.decay(a);
        let b = self.decay(b);
        if !c.ty.is_scalar() {
            return Err(mismatch(
                line,
                "the condition of ?: must be a number or a pointer",
            ));
        }
        let ty = match (&a.ty, &b.ty) {
            (x, y) if x.is_int() && y.is_int() => {
                if x.is_unsigned() || y.is_unsigned() {
                    UNSIGNED
                } else {
                    INT
                }
            }
            (x @ Ty::Ptr(_), _) => x.clone(),
            (_, y @ Ty::Ptr(_)) => y.clone(),
            (Ty::Void, Ty::Void) => Ty::Void,
            _ => return Err(mismatch(line, "the two sides of ?: have different types")),
        };
        if let Some(v) = c.constant() {
            return Ok(if v != 0 { a } else { b });
        }
        Ok(Expr {
            kind: Kind::Cond(Box::new(c), Box::new(a), Box::new(b)),
            ty,
            line,
        })
    }

    fn binary_expr(&mut self, min: u8) -> R<Expr> {
        let mut l = self.cast()?;
        loop {
            let Tok::Punct(op) = self.peek() else {
                return Ok(l);
            };
            let op = *op;
            let Some(p) = binary_prec(op) else {
                return Ok(l);
            };
            if p < min {
                return Ok(l);
            }
            let line = self.line();
            self.pos += 1;
            let r = self.binary_expr(p + 1)?;
            l = self.make_binary(op, l, r, line)?;
        }
    }

    fn make_binary(&self, op: &str, l: Expr, r: Expr, line: usize) -> R<Expr> {
        let l = self.decay(l);
        let r = self.decay(r);
        if !l.ty.is_scalar() || !r.ty.is_scalar() {
            return Err(mismatch(line, &format!("{op} needs numbers or pointers")));
        }
        let unsigned = l.ty.is_unsigned() || r.ty.is_unsigned();
        let ty = if unsigned { UNSIGNED } else { INT };
        let logic = |and: bool, l: Expr, r: Expr| {
            if let (Some(a), Some(b)) = (l.constant(), r.constant()) {
                return Expr::num(
                    if and {
                        a != 0 && b != 0
                    } else {
                        a != 0 || b != 0
                    } as i32,
                    line,
                );
            }
            Expr {
                kind: if and {
                    Kind::And(Box::new(l), Box::new(r))
                } else {
                    Kind::Or(Box::new(l), Box::new(r))
                },
                ty: INT,
                line,
            }
        };
        let cmp = |c: CmpOp, l: Expr, r: Expr| {
            if let (Some(a), Some(b)) = (l.constant(), r.constant()) {
                let (a, b) = if unsigned {
                    ((a & 0xFFFF) as i64, (b & 0xFFFF) as i64)
                } else {
                    (a as i64, b as i64)
                };
                let v = match c {
                    CmpOp::Eq => a == b,
                    CmpOp::Ne => a != b,
                    CmpOp::Lt => a < b,
                    CmpOp::Le => a <= b,
                    CmpOp::Gt => a > b,
                    CmpOp::Ge => a >= b,
                };
                return Expr::num(v as i32, line);
            }
            Expr {
                kind: Kind::Cmp(c, !unsigned, Box::new(l), Box::new(r)),
                ty: INT,
                line,
            }
        };
        let bin = |o: BinOp, l: Expr, r: Expr| -> R<Expr> {
            if l.ty.is_ptr() || r.ty.is_ptr() {
                return Err(mismatch(line, &format!("{op} can't be used on a pointer")));
            }
            Ok(self.binary(o, !unsigned, l, r, ty.clone(), line))
        };
        Ok(match op {
            "+" => self.add(l, r, line)?,
            "-" => self.sub(l, r, line)?,
            "*" => bin(BinOp::Mul, l, r)?,
            "/" => bin(BinOp::Div, l, r)?,
            "%" => bin(BinOp::Mod, l, r)?,
            "<<" | ">>" => {
                if l.ty.is_ptr() || r.ty.is_ptr() {
                    return Err(mismatch(line, &format!("{op} can't be used on a pointer")));
                }
                // A shift keeps the left operand's type.
                let ty = l.ty.clone();
                let signed = !ty.is_unsigned();
                let o = if op == "<<" { BinOp::Shl } else { BinOp::Shr };
                self.binary(o, signed, l, r, ty, line)
            }
            "&" => bin(BinOp::And, l, r)?,
            "|" => bin(BinOp::Or, l, r)?,
            "^" => bin(BinOp::Xor, l, r)?,
            "==" => cmp(CmpOp::Eq, l, r),
            "!=" => cmp(CmpOp::Ne, l, r),
            "<" => cmp(CmpOp::Lt, l, r),
            "<=" => cmp(CmpOp::Le, l, r),
            ">" => cmp(CmpOp::Gt, l, r),
            ">=" => cmp(CmpOp::Ge, l, r),
            "&&" => logic(true, l, r),
            "||" => logic(false, l, r),
            _ => return Err(self.expected("an operator")),
        })
    }

    /// A binary operation, folded when both sides are constants.
    fn binary(&self, op: BinOp, signed: bool, l: Expr, r: Expr, ty: Ty, line: usize) -> Expr {
        if let (Some(a), Some(b)) = (l.constant(), r.constant()) {
            let (ua, ub) = ((a & 0xFFFF) as i64, (b & 0xFFFF) as i64);
            let (sa, sb) = (norm(a as i64, &INT) as i64, norm(b as i64, &INT) as i64);
            let v: i64 = match op {
                BinOp::Add => ua + ub,
                BinOp::Sub => ua - ub,
                BinOp::Mul => ua * ub,
                BinOp::Div if signed => {
                    if sb == 0 {
                        0
                    } else {
                        sa / sb
                    }
                }
                BinOp::Div => ua.checked_div(ub).unwrap_or(0),
                BinOp::Mod if signed => {
                    if sb == 0 {
                        sa
                    } else {
                        sa % sb
                    }
                }
                BinOp::Mod => ua.checked_rem(ub).unwrap_or(ua),
                BinOp::Shl => ua << (ub & 15),
                BinOp::Shr if signed => sa >> (ub & 15),
                BinOp::Shr => ua >> (ub & 15),
                BinOp::And => ua & ub,
                BinOp::Or => ua | ub,
                BinOp::Xor => ua ^ ub,
            };
            return Expr {
                kind: Kind::Num(norm(v, &ty)),
                ty,
                line,
            };
        }
        Expr {
            kind: Kind::Binary(op, signed, Box::new(l), Box::new(r)),
            ty,
            line,
        }
    }

    fn add(&self, l: Expr, r: Expr, line: usize) -> R<Expr> {
        let (p, i) = match (l.ty.is_ptr(), r.ty.is_ptr()) {
            (false, false) => {
                let unsigned = l.ty.is_unsigned() || r.ty.is_unsigned();
                let ty = if unsigned { UNSIGNED } else { INT };
                return Ok(self.binary(BinOp::Add, !unsigned, l, r, ty, line));
            }
            (true, false) => (l, r),
            (false, true) => (r, l),
            (true, true) => return Err(mismatch(line, "two pointers can't be added")),
        };
        let s = self.target_size(&p.ty, line)?;
        let ty = p.ty.clone();
        let i = self.scale(i, s);
        Ok(self.binary(BinOp::Add, false, p, i, ty, line))
    }

    fn sub(&self, l: Expr, r: Expr, line: usize) -> R<Expr> {
        match (l.ty.is_ptr(), r.ty.is_ptr()) {
            (false, false) => {
                let unsigned = l.ty.is_unsigned() || r.ty.is_unsigned();
                let ty = if unsigned { UNSIGNED } else { INT };
                Ok(self.binary(BinOp::Sub, !unsigned, l, r, ty, line))
            }
            (true, false) => {
                let s = self.target_size(&l.ty, line)?;
                let ty = l.ty.clone();
                let r = self.scale(r, s);
                Ok(self.binary(BinOp::Sub, false, l, r, ty, line))
            }
            (true, true) => {
                let s = self.target_size(&l.ty, line)?;
                let d = self.binary(BinOp::Sub, true, l, r, INT, line);
                Ok(if s == 1 {
                    d
                } else {
                    self.binary(BinOp::Div, true, d, Expr::num(s, line), INT, line)
                })
            }
            (false, true) => Err(mismatch(
                line,
                "a pointer can't be subtracted from a number",
            )),
        }
    }

    fn cast(&mut self) -> R<Expr> {
        if self.is("(") {
            let save = self.pos;
            self.pos += 1;
            if self.is_typename() {
                let line = self.line();
                let ty = self.type_name()?;
                self.expect(")")?;
                let e = self.cast()?;
                let e = self.decay(e);
                if ty == Ty::Void {
                    return Ok(Expr {
                        line,
                        kind: Kind::Cast(Box::new(e)),
                        ty: Ty::Void,
                    });
                }
                if !ty.is_scalar() || !e.ty.is_scalar() {
                    return Err(mismatch(line, "only numbers and pointers can be cast"));
                }
                return Ok(match e.kind {
                    Kind::Num(v) => Expr {
                        kind: Kind::Num(norm(v as i64, &ty)),
                        ty,
                        line,
                    },
                    _ => Expr {
                        kind: Kind::Cast(Box::new(e)),
                        ty,
                        line,
                    },
                });
            }
            self.pos = save;
        }
        self.unary()
    }

    fn unary(&mut self) -> R<Expr> {
        let line = self.line();
        let Tok::Punct(op) = self.peek().clone() else {
            if self.is_word("sizeof") {
                self.pos += 1;
                let ty = if self.is("(") && {
                    let save = self.pos;
                    self.pos += 1;
                    let t = self.is_typename();
                    self.pos = save;
                    t
                } {
                    self.pos += 1;
                    let t = self.type_name()?;
                    self.expect(")")?;
                    t
                } else {
                    self.unary()?.ty
                };
                let s = self.size(&ty, line)?;
                return Ok(Expr {
                    kind: Kind::Num(s as i32),
                    ty: UNSIGNED,
                    line,
                });
            }
            return self.postfix();
        };
        match op {
            "++" | "--" => {
                self.pos += 1;
                let e = self.unary()?;
                self.inc_dec(e, op == "++", false, line)
            }
            "+" => {
                self.pos += 1;
                let e = self.cast()?;
                Ok(self.decay(e))
            }
            "-" | "~" | "!" => {
                self.pos += 1;
                let e = self.cast()?;
                let e = self.decay(e);
                if !e.ty.is_scalar() || (op != "!" && e.ty.is_ptr()) {
                    return Err(mismatch(line, &format!("{op} needs a number")));
                }
                let ty = if op == "!" { INT } else { e.ty.clone() };
                if let Some(v) = e.constant() {
                    let v = match op {
                        "-" => -(v as i64),
                        "~" => !(v as i64),
                        _ => (v == 0) as i64,
                    };
                    return Ok(Expr {
                        kind: Kind::Num(norm(v, &ty)),
                        ty,
                        line,
                    });
                }
                let u = match op {
                    "-" => UnOp::Neg,
                    "~" => UnOp::BitNot,
                    _ => UnOp::Not,
                };
                Ok(Expr {
                    kind: Kind::Unary(u, Box::new(e)),
                    ty,
                    line,
                })
            }
            "*" => {
                self.pos += 1;
                let e = self.cast()?;
                self.deref(e, line)
            }
            "&" => {
                self.pos += 1;
                let e = self.cast()?;
                if let Kind::Func(_) = e.kind {
                    return Ok(self.decay(e));
                }
                if !e.is_lvalue() {
                    return Err(err(
                        line,
                        "not-lvalue",
                        "& needs a variable, element or member".into(),
                        &[],
                    ));
                }
                Ok(Expr {
                    ty: Ty::ptr(e.ty.clone()),
                    kind: Kind::Addr(Box::new(e)),
                    line,
                })
            }
            _ => self.postfix(),
        }
    }

    fn deref(&self, e: Expr, line: usize) -> R<Expr> {
        let e = self.decay(e);
        let Some(t) = e.ty.target().cloned() else {
            return Err(mismatch(line, "* needs a pointer"));
        };
        if let Ty::Func(_) = t {
            return Ok(e);
        }
        if t == Ty::Void {
            return Err(err(
                line,
                "void-value",
                "a void pointer can't be read (cast it first)".into(),
                &[],
            ));
        }
        Ok(Expr {
            kind: Kind::Deref(Box::new(e)),
            ty: t,
            line,
        })
    }

    fn inc_dec(&self, e: Expr, inc: bool, post: bool, line: usize) -> R<Expr> {
        self.lvalue(&e)?;
        if !e.ty.is_scalar() {
            return Err(mismatch(line, "++ and -- need a number or a pointer"));
        }
        let step = if e.ty.is_ptr() {
            self.target_size(&e.ty, line)?
        } else {
            1
        };
        Ok(Expr {
            ty: e.ty.clone(),
            kind: Kind::IncDec {
                target: Box::new(e),
                delta: if inc { step } else { -step },
                post,
            },
            line,
        })
    }

    fn postfix(&mut self) -> R<Expr> {
        let mut e = self.primary()?;
        loop {
            let line = self.line();
            if self.eat("[") {
                let i = self.expr()?;
                self.expect("]")?;
                let sum = self.make_binary("+", e, i, line)?;
                e = self.deref(sum, line)?;
            } else if self.eat("(") {
                e = self.call(e, line)?;
            } else if self.eat(".") {
                let name = self.ident()?;
                e = self.member(e, &name, line)?;
            } else if self.eat("->") {
                let name = self.ident()?;
                let d = self.deref(e, line)?;
                e = self.member(d, &name, line)?;
            } else if self.eat("++") {
                e = self.inc_dec(e, true, true, line)?;
            } else if self.eat("--") {
                e = self.inc_dec(e, false, true, line)?;
            } else {
                return Ok(e);
            }
        }
    }

    fn member(&self, e: Expr, name: &str, line: usize) -> R<Expr> {
        let Ty::Struct(id) = e.ty else {
            return Err(mismatch(line, &format!(".{name} needs a struct")));
        };
        let def = &self.prog.structs[id];
        let Some(m) = def.members.iter().find(|m| m.name == name) else {
            return Err(err(
                line,
                "unknown-member",
                format!(
                    "{} has no member {name}",
                    def.tag
                        .clone()
                        .map_or("this struct".into(), |t| format!("struct {t}"))
                ),
                &[("name", name.to_string())],
            ));
        };
        if !e.is_lvalue() {
            return Err(unsupported(
                line,
                "a member of a struct value (use a variable)",
            ));
        }
        Ok(Expr {
            kind: Kind::Member(Box::new(e), m.offset),
            ty: m.ty.clone(),
            line,
        })
    }

    fn call(&mut self, callee: Expr, line: usize) -> R<Expr> {
        let callee = self.decay(callee);
        let Some(f) = callee.ty.func().cloned() else {
            return Err(err(
                line,
                "not-callable",
                "only functions (and function pointers) can be called".into(),
                &[],
            ));
        };
        let mut args = Vec::new();
        if !self.eat(")") {
            loop {
                args.push(self.assign()?);
                if !self.eat(",") {
                    break;
                }
            }
            self.expect(")")?;
        }
        if !f.unspecified && args.len() != f.params.len() {
            let name = match &callee.kind {
                Kind::Func(n) => n.clone(),
                _ => "this function".into(),
            };
            return Err(err(
                line,
                "arg-count",
                format!(
                    "{name} takes {} arguments, not {}",
                    f.params.len(),
                    args.len()
                ),
                &[
                    ("name", name),
                    ("want", f.params.len().to_string()),
                    ("got", args.len().to_string()),
                ],
            ));
        }
        let mut out = Vec::new();
        for (i, a) in args.into_iter().enumerate() {
            let a = match f.params.get(i) {
                Some(t) => self.convert(a, t, &format!("argument {}", i + 1))?,
                None => self.decay(a),
            };
            if !a.ty.is_scalar() {
                return Err(unsupported(line, "passing a struct (pass a pointer)"));
            }
            out.push(a);
        }
        Ok(Expr {
            kind: Kind::Call(Box::new(callee), out),
            ty: f.ret.clone(),
            line,
        })
    }

    fn string_lit(&mut self) -> Vec<u16> {
        let mut s = Vec::new();
        while let Tok::Str(part) = self.peek().clone() {
            s.extend(part);
            self.pos += 1;
        }
        s
    }

    fn primary(&mut self) -> R<Expr> {
        let line = self.line();
        match self.peek().clone() {
            Tok::Num(v, uns) => {
                self.pos += 1;
                let ty = if uns { UNSIGNED } else { INT };
                Ok(Expr {
                    kind: Kind::Num(norm(v, &ty)),
                    ty,
                    line,
                })
            }
            Tok::Str(_) => {
                let mut s = self.string_lit();
                s.push(0);
                let n = s.len() as u32;
                let i = match self.prog.strings.iter().position(|x| *x == s) {
                    Some(i) => i,
                    None => {
                        self.prog.strings.push(s);
                        self.prog.strings.len() - 1
                    }
                };
                Ok(Expr {
                    kind: Kind::Str(i),
                    ty: Ty::Array(Box::new(INT), Some(n)),
                    line,
                })
            }
            Tok::Punct("(") => {
                self.pos += 1;
                let e = self.expr()?;
                self.expect(")")?;
                Ok(e)
            }
            Tok::Ident(name) if !is_keyword(&name) => {
                self.pos += 1;
                match self.lookup(&name).cloned() {
                    Some(Name::Var(VarRef::Local(s), ty)) => Ok(Expr {
                        kind: Kind::Local(s),
                        ty,
                        line,
                    }),
                    Some(Name::Var(VarRef::Global(g), ty)) => Ok(Expr {
                        kind: Kind::Global(g),
                        ty,
                        line,
                    }),
                    Some(Name::Enum(v)) => Ok(Expr::num(v, line)),
                    Some(Name::Func(f)) => Ok(Expr {
                        kind: Kind::Func(name),
                        ty: Ty::Func(Box::new(f)),
                        line,
                    }),
                    Some(Name::Typedef(_)) => Err(self.expected("a value")),
                    None => Err(err(
                        line,
                        "unknown-name",
                        format!("{name} isn't declared"),
                        &[("name", name)],
                    )),
                }
            }
            _ => Err(self.expected("a value")),
        }
    }
}

fn mismatch(line: usize, msg: &str) -> CError {
    err(
        line,
        "type-mismatch",
        msg.to_string(),
        &[("message", msg.to_string())],
    )
}

fn unsupported(line: usize, what: &str) -> CError {
    err(
        line,
        "unsupported",
        format!("{what} isn't supported here (docs/C.md lists what is)"),
        &[("what", crate::unsupported_code(what).to_string())],
    )
}

pub fn is_keyword(w: &str) -> bool {
    matches!(
        w,
        "if" | "else"
            | "while"
            | "do"
            | "for"
            | "switch"
            | "case"
            | "default"
            | "break"
            | "continue"
            | "return"
            | "goto"
            | "sizeof"
            | "void"
            | "char"
            | "short"
            | "int"
            | "long"
            | "float"
            | "double"
            | "signed"
            | "unsigned"
            | "struct"
            | "union"
            | "enum"
            | "typedef"
            | "static"
            | "extern"
            | "const"
            | "volatile"
            | "register"
            | "auto"
            | "inline"
            | "_Bool"
    )
}

impl std::fmt::Display for BinOp {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            BinOp::Add => "+=",
            BinOp::Sub => "-=",
            BinOp::Mul => "*=",
            BinOp::Div => "/=",
            BinOp::Mod => "%=",
            BinOp::Shl => "<<=",
            BinOp::Shr => ">>=",
            BinOp::And => "&=",
            BinOp::Or => "|=",
            BinOp::Xor => "^=",
        };
        write!(f, "{s}")
    }
}
