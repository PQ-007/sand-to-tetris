//! The preprocessor and lexer: source text into tokens, with `#define`,
//! `#if…`, `#include <machine.h>` and comments handled on the way.
use std::collections::BTreeMap;

use crate::CError;

/// The library behind `#include <machine.h>` (docs/C.md).
pub const MACHINE_H: &str = include_str!("../../../os/machine.h");

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Tok {
    Ident(String),
    /// A number or character; `true` when it was written unsigned (a `u`
    /// suffix, or too big for an int).
    Num(i64, bool),
    /// A string literal's characters, without the terminating zero.
    Str(Vec<u16>),
    Punct(&'static str),
    Eof,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    pub tok: Tok,
    /// 1-based line in the program; 0 inside `machine.h`.
    pub line: usize,
}

const PUNCTS: [&str; 49] = [
    "<<=", ">>=", "...", "->", "++", "--", "<<", ">>", "<=", ">=", "==", "!=", "&&", "||", "+=",
    "-=", "*=", "/=", "%=", "&=", "|=", "^=", "##", "+", "-", "*", "/", "%", "&", "|", "^", "~",
    "!", "=", "<", ">", "?", ":", ";", ",", ".", "(", ")", "[", "]", "{", "}", "#", "\\",
];

#[derive(Clone, Debug)]
struct Macro {
    params: Option<Vec<String>>,
    body: Vec<Token>,
}

/// One `#if` level: is this branch on, has any branch been on, was the
/// level around it on.
struct Cond {
    on: bool,
    taken: bool,
    outer: bool,
    line: usize,
}

struct Pre {
    macros: BTreeMap<String, Macro>,
    out: Vec<Token>,
    included: bool,
}

/// The whole program as tokens, ending with `Eof`.
pub fn tokenize(source: &str) -> Result<Vec<Token>, CError> {
    let mut pre = Pre {
        macros: BTreeMap::new(),
        out: Vec::new(),
        included: false,
    };
    pre.file(source, false)?;
    let line = pre.out.last().map_or(1, |t| t.line);
    pre.out.push(Token {
        tok: Tok::Eof,
        line,
    });
    Ok(pre.out)
}

/// Comments out and continued lines joined: (text, line) per logical line.
fn logical_lines(source: &str, lib: bool) -> Result<Vec<(String, usize)>, CError> {
    let chars: Vec<char> = source.chars().collect();
    let mut lines = Vec::new();
    let mut cur = String::new();
    let mut line = 1;
    let mut start = 1;
    let mut i = 0;
    let at = |l: usize| if lib { 0 } else { l };
    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied();
        if c == '\\' && next == Some('\n') {
            line += 1;
            i += 2;
        } else if c == '\n' {
            lines.push((std::mem::take(&mut cur), at(start)));
            line += 1;
            start = line;
            i += 1;
        } else if c == '/' && next == Some('/') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
        } else if c == '/' && next == Some('*') {
            let from = line;
            i += 2;
            loop {
                if i >= chars.len() {
                    return Err(CError::new(
                        at(from),
                        "unterminated-comment",
                        "this /* comment never ends (no */)".into(),
                        &[],
                    ));
                }
                if chars[i] == '*' && chars.get(i + 1) == Some(&'/') {
                    i += 2;
                    break;
                }
                if chars[i] == '\n' {
                    line += 1;
                }
                i += 1;
            }
            cur.push(' ');
        } else if c == '"' || c == '\'' {
            // Copy a literal whole, so // or /* inside it isn't a comment.
            cur.push(c);
            i += 1;
            while i < chars.len() && chars[i] != c && chars[i] != '\n' {
                if chars[i] == '\\' && i + 1 < chars.len() {
                    cur.push(chars[i]);
                    i += 1;
                }
                cur.push(chars[i]);
                i += 1;
            }
            if i < chars.len() && chars[i] == c {
                cur.push(c);
                i += 1;
            }
        } else {
            cur.push(c);
            i += 1;
        }
    }
    lines.push((cur, at(start)));
    Ok(lines)
}

impl Pre {
    fn file(&mut self, source: &str, lib: bool) -> Result<(), CError> {
        let mut conds: Vec<Cond> = Vec::new();
        for (text, line) in logical_lines(source, lib)? {
            let on = conds.last().is_none_or(|c| c.on);
            let trimmed = text.trim_start();
            if let Some(rest) = trimmed.strip_prefix('#') {
                self.directive(rest.trim(), line, on, &mut conds)?;
            } else if on {
                let toks = lex_line(&text, line)?;
                let mut hide = Vec::new();
                let mut out = Vec::new();
                self.expand(&toks, &mut hide, &mut out)?;
                self.out.extend(out);
            }
        }
        if let Some(c) = conds.last() {
            return Err(CError::new(
                c.line,
                "unterminated-if",
                "this #if has no #endif".into(),
                &[],
            ));
        }
        Ok(())
    }

    fn directive(
        &mut self,
        text: &str,
        line: usize,
        on: bool,
        conds: &mut Vec<Cond>,
    ) -> Result<(), CError> {
        let name: String = text
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect();
        let rest = text[name.len()..].trim();
        let bad = |what: &str| {
            CError::new(
                line,
                "bad-directive",
                format!("#{what} isn't written right here"),
                &[("what", what.to_string())],
            )
        };
        match name.as_str() {
            "ifdef" | "ifndef" => {
                let defined = self.macros.contains_key(rest.trim());
                let v = (name == "ifdef") == defined;
                conds.push(Cond {
                    on: on && v,
                    taken: v,
                    outer: on,
                    line,
                });
            }
            "if" => {
                let v = on && self.if_value(rest, line)? != 0;
                conds.push(Cond {
                    on: on && v,
                    taken: v,
                    outer: on,
                    line,
                });
            }
            "elif" => {
                let Some(top) = conds.last() else {
                    return Err(bad("elif"));
                };
                let (outer, taken) = (top.outer, top.taken);
                let v = outer && !taken && self.if_value(rest, line)? != 0;
                if let Some(top) = conds.last_mut() {
                    top.on = v;
                    top.taken = taken || v;
                }
            }
            "else" => {
                let Some(top) = conds.last_mut() else {
                    return Err(bad("else"));
                };
                top.on = top.outer && !top.taken;
                top.taken = true;
            }
            "endif" => {
                if conds.pop().is_none() {
                    return Err(bad("endif"));
                }
            }
            _ if !on => {}
            "define" => self.define(rest, line)?,
            "undef" => {
                self.macros.remove(rest.trim());
            }
            "include" => {
                let file = rest.trim();
                if file != "<machine.h>" && file != "\"machine.h\"" {
                    return Err(CError::new(
                        line,
                        "bad-include",
                        format!(
                            "only <machine.h> can be included (there are no other headers), not {file}"
                        ),
                        &[("file", file.to_string())],
                    ));
                }
                if !self.included {
                    self.included = true;
                    self.file(MACHINE_H, true)?;
                }
            }
            "pragma" | "" => {}
            "error" => {
                return Err(CError::new(
                    line,
                    "bad-directive",
                    format!("#error {rest}"),
                    &[("what", "error".into())],
                ));
            }
            _ => return Err(bad(&name)),
        }
        Ok(())
    }

    fn define(&mut self, rest: &str, line: usize) -> Result<(), CError> {
        let name: String = rest
            .chars()
            .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
            .collect();
        if name.is_empty() || name.starts_with(|c: char| c.is_ascii_digit()) {
            return Err(CError::new(
                line,
                "bad-directive",
                "#define needs a name".into(),
                &[("what", "define".into())],
            ));
        }
        let after = &rest[name.len()..];
        let (params, body) = if let Some(p) = after.strip_prefix('(') {
            let Some(close) = p.find(')') else {
                return Err(CError::new(
                    line,
                    "bad-directive",
                    format!("#define {name}( has no )"),
                    &[("what", "define".into())],
                ));
            };
            let params: Vec<String> = p[..close]
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            if params.iter().any(|p| p == "...") {
                return Err(unsupported(line, "variadic macros"));
            }
            (Some(params), &p[close + 1..])
        } else {
            (None, after)
        };
        let body = lex_line(body, line)?;
        if body.iter().any(|t| t.tok == Tok::Punct("##")) {
            return Err(unsupported(line, "## in a macro"));
        }
        self.macros.insert(name, Macro { params, body });
        Ok(())
    }

    /// Expands macros in `toks` into `out`; `hide` holds the macros being
    /// expanded (a macro never expands inside itself).
    fn expand(
        &self,
        toks: &[Token],
        hide: &mut Vec<String>,
        out: &mut Vec<Token>,
    ) -> Result<(), CError> {
        let mut i = 0;
        while i < toks.len() {
            let t = &toks[i];
            let Tok::Ident(name) = &t.tok else {
                out.push(t.clone());
                i += 1;
                continue;
            };
            let Some(m) = self.macros.get(name).filter(|_| !hide.contains(name)) else {
                out.push(t.clone());
                i += 1;
                continue;
            };
            let at = |body: &[Token]| -> Vec<Token> {
                body.iter()
                    .map(|b| Token {
                        tok: b.tok.clone(),
                        line: t.line,
                    })
                    .collect()
            };
            match &m.params {
                None => {
                    hide.push(name.clone());
                    self.expand(&at(&m.body), hide, out)?;
                    hide.pop();
                    i += 1;
                }
                Some(params) => {
                    if toks.get(i + 1).map(|n| &n.tok) != Some(&Tok::Punct("(")) {
                        out.push(t.clone());
                        i += 1;
                        continue;
                    }
                    let (args, end) = macro_args(toks, i + 2, t.line, name)?;
                    let args = if params.is_empty() && args.len() == 1 && args[0].is_empty() {
                        Vec::new()
                    } else {
                        args
                    };
                    if args.len() != params.len() {
                        return Err(CError::new(
                            t.line,
                            "macro-args",
                            format!(
                                "the macro {name} takes {} arguments, not {}",
                                params.len(),
                                args.len()
                            ),
                            &[
                                ("name", name.clone()),
                                ("want", params.len().to_string()),
                                ("got", args.len().to_string()),
                            ],
                        ));
                    }
                    let mut expanded = Vec::new();
                    for a in &args {
                        let mut e = Vec::new();
                        self.expand(a, hide, &mut e)?;
                        expanded.push(e);
                    }
                    let mut body = Vec::new();
                    for b in at(&m.body) {
                        match &b.tok {
                            Tok::Ident(p) => match params.iter().position(|q| q == p) {
                                Some(k) => body.extend(expanded[k].iter().cloned()),
                                None => body.push(b),
                            },
                            Tok::Punct("#") => {
                                return Err(unsupported(t.line, "# in a macro"));
                            }
                            _ => body.push(b),
                        }
                    }
                    hide.push(name.clone());
                    self.expand(&body, hide, out)?;
                    hide.pop();
                    i = end;
                }
            }
        }
        Ok(())
    }

    /// The value of an `#if` condition.
    fn if_value(&self, text: &str, line: usize) -> Result<i64, CError> {
        let toks = lex_line(text, line)?;
        // `defined X` and `defined(X)` first, before macros expand.
        let mut pre = Vec::new();
        let mut i = 0;
        while i < toks.len() {
            if toks[i].tok == Tok::Ident("defined".into()) {
                let (name, skip) = match (toks.get(i + 1), toks.get(i + 2), toks.get(i + 3)) {
                    (
                        Some(Token {
                            tok: Tok::Punct("("),
                            ..
                        }),
                        Some(Token {
                            tok: Tok::Ident(n), ..
                        }),
                        Some(Token {
                            tok: Tok::Punct(")"),
                            ..
                        }),
                    ) => (n.clone(), 4),
                    (
                        Some(Token {
                            tok: Tok::Ident(n), ..
                        }),
                        _,
                        _,
                    ) => (n.clone(), 2),
                    _ => {
                        return Err(CError::new(
                            line,
                            "bad-directive",
                            "defined needs a macro name".into(),
                            &[("what", "if".into())],
                        ))
                    }
                };
                pre.push(Token {
                    tok: Tok::Num(self.macros.contains_key(&name) as i64, false),
                    line,
                });
                i += skip;
            } else {
                pre.push(toks[i].clone());
                i += 1;
            }
        }
        let mut out = Vec::new();
        self.expand(&pre, &mut Vec::new(), &mut out)?;
        let vals: Vec<Tok> = out
            .into_iter()
            .map(|t| match t.tok {
                Tok::Ident(_) => Tok::Num(0, false),
                x => x,
            })
            .collect();
        let mut e = IfEval { toks: &vals, i: 0 };
        let v = e.ternary();
        match v {
            Some(v) if e.i == vals.len() => Ok(v),
            _ => Err(CError::new(
                line,
                "bad-directive",
                "this #if condition isn't a constant expression".into(),
                &[("what", "if".into())],
            )),
        }
    }
}

fn unsupported(line: usize, what: &str) -> CError {
    CError::new(
        line,
        "unsupported",
        format!("{what} isn't supported here (docs/C.md lists what is)"),
        &[("what", crate::unsupported_code(what).to_string())],
    )
}

/// A macro call's arguments from `start` (just after its `(`); returns them
/// and the index after the closing `)`.
fn macro_args(
    toks: &[Token],
    start: usize,
    line: usize,
    name: &str,
) -> Result<(Vec<Vec<Token>>, usize), CError> {
    let mut args = vec![Vec::new()];
    let mut depth = 0;
    let mut i = start;
    while i < toks.len() {
        let t = &toks[i];
        match t.tok {
            Tok::Punct("(") => depth += 1,
            Tok::Punct(")") if depth == 0 => return Ok((args, i + 1)),
            Tok::Punct(")") => depth -= 1,
            Tok::Punct(",") if depth == 0 => {
                args.push(Vec::new());
                i += 1;
                continue;
            }
            _ => {}
        }
        if let Some(a) = args.last_mut() {
            a.push(t.clone());
        }
        i += 1;
    }
    Err(CError::new(
        line,
        "macro-args",
        format!("the call of the macro {name} needs a ) on the same line"),
        &[("name", name.to_string())],
    ))
}

/// A constant expression for `#if`.
struct IfEval<'a> {
    toks: &'a [Tok],
    i: usize,
}

impl IfEval<'_> {
    fn peek(&self) -> Option<&Tok> {
        self.toks.get(self.i)
    }
    fn eat(&mut self, p: &str) -> bool {
        if matches!(self.peek(), Some(Tok::Punct(q)) if *q == p) {
            self.i += 1;
            true
        } else {
            false
        }
    }
    fn ternary(&mut self) -> Option<i64> {
        let c = self.binary(0)?;
        if self.eat("?") {
            let a = self.ternary()?;
            if !self.eat(":") {
                return None;
            }
            let b = self.ternary()?;
            return Some(if c != 0 { a } else { b });
        }
        Some(c)
    }
    fn binary(&mut self, min: u8) -> Option<i64> {
        let mut l = self.unary()?;
        loop {
            let Some(Tok::Punct(op)) = self.peek() else {
                return Some(l);
            };
            let op = *op;
            let Some(p) = binary_prec(op) else {
                return Some(l);
            };
            if p < min {
                return Some(l);
            }
            self.i += 1;
            let r = self.binary(p + 1)?;
            l = match op {
                "*" => l.wrapping_mul(r),
                "/" => l.checked_div(r).unwrap_or(0),
                "%" => l.checked_rem(r).unwrap_or(0),
                "+" => l.wrapping_add(r),
                "-" => l.wrapping_sub(r),
                "<<" => l.wrapping_shl(r as u32),
                ">>" => l.wrapping_shr(r as u32),
                "<" => (l < r) as i64,
                ">" => (l > r) as i64,
                "<=" => (l <= r) as i64,
                ">=" => (l >= r) as i64,
                "==" => (l == r) as i64,
                "!=" => (l != r) as i64,
                "&" => l & r,
                "^" => l ^ r,
                "|" => l | r,
                "&&" => (l != 0 && r != 0) as i64,
                "||" => (l != 0 || r != 0) as i64,
                _ => return None,
            };
        }
    }
    fn unary(&mut self) -> Option<i64> {
        if self.eat("-") {
            return Some(-self.unary()?);
        }
        if self.eat("+") {
            return self.unary();
        }
        if self.eat("!") {
            return Some((self.unary()? == 0) as i64);
        }
        if self.eat("~") {
            return Some(!self.unary()?);
        }
        if self.eat("(") {
            let v = self.ternary()?;
            return self.eat(")").then_some(v);
        }
        match self.peek() {
            Some(Tok::Num(v, _)) => {
                let v = *v;
                self.i += 1;
                Some(v)
            }
            _ => None,
        }
    }
}

/// How tightly a binary operator binds (higher = tighter); None if it
/// isn't one.
pub fn binary_prec(op: &str) -> Option<u8> {
    Some(match op {
        "*" | "/" | "%" => 10,
        "+" | "-" => 9,
        "<<" | ">>" => 8,
        "<" | ">" | "<=" | ">=" => 7,
        "==" | "!=" => 6,
        "&" => 5,
        "^" => 4,
        "|" => 3,
        "&&" => 2,
        "||" => 1,
        _ => return None,
    })
}

/// The tokens of one line (comments already gone).
fn lex_line(text: &str, line: usize) -> Result<Vec<Token>, CError> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
        } else if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            out.push(Token {
                tok: Tok::Ident(chars[start..i].iter().collect()),
                line,
            });
        } else if c.is_ascii_digit() {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let text: String = chars[start..i].iter().collect();
            out.push(Token {
                tok: number(&text, line)?,
                line,
            });
        } else if c == '\'' {
            let (chars_, end) = literal(&chars, i + 1, '\'', line)?;
            if chars_.len() != 1 {
                return Err(CError::new(
                    line,
                    "bad-string",
                    "a character literal holds exactly one character".into(),
                    &[],
                ));
            }
            out.push(Token {
                tok: Tok::Num(chars_[0] as i64, false),
                line,
            });
            i = end;
        } else if c == '"' {
            let (s, end) = literal(&chars, i + 1, '"', line)?;
            out.push(Token {
                tok: Tok::Str(s),
                line,
            });
            i = end;
        } else {
            let rest: String = chars[i..chars.len().min(i + 3)].iter().collect();
            let Some(p) = PUNCTS.iter().find(|p| rest.starts_with(**p)) else {
                return Err(CError::new(
                    line,
                    "bad-char",
                    format!("{c} can't be used here"),
                    &[("char", c.to_string())],
                ));
            };
            out.push(Token {
                tok: Tok::Punct(p),
                line,
            });
            i += p.len();
        }
    }
    Ok(out)
}

fn number(text: &str, line: usize) -> Result<Tok, CError> {
    let bad = || {
        CError::new(
            line,
            "bad-number",
            format!("{text} isn't a number the machine can hold (0 to 65535)"),
            &[("text", text.to_string())],
        )
    };
    let lower = text.to_ascii_lowercase();
    if lower.ends_with('l') && !lower.starts_with("0x")
        || lower.contains("ul")
        || lower.contains("lu")
    {
        return Err(unsupported(line, "long"));
    }
    let (digits, uns) = match lower.strip_suffix('u') {
        Some(d) => (d.to_string(), true),
        None => (lower.clone(), false),
    };
    let digits = digits.replace('_', "");
    let v = if let Some(h) = digits.strip_prefix("0x") {
        i64::from_str_radix(h, 16)
    } else if let Some(b) = digits.strip_prefix("0b") {
        i64::from_str_radix(b, 2)
    } else if digits.len() > 1 && digits.starts_with('0') {
        i64::from_str_radix(&digits[1..], 8)
    } else {
        digits.parse::<i64>()
    }
    .map_err(|_| bad())?;
    if v > 0xFFFF {
        return Err(bad());
    }
    Ok(Tok::Num(v, uns || v > 0x7FFF))
}

/// A quoted literal's characters from `start` (after the quote) to the
/// closing `quote`; returns them and the index after it.
fn literal(
    chars: &[char],
    start: usize,
    quote: char,
    line: usize,
) -> Result<(Vec<u16>, usize), CError> {
    let mut out = Vec::new();
    let mut i = start;
    let bad = |what: &str| {
        CError::new(
            line,
            "bad-string",
            format!("this literal {what}"),
            &[("what", what.to_string())],
        )
    };
    loop {
        let Some(&c) = chars.get(i) else {
            return Err(bad("has no closing quote"));
        };
        i += 1;
        if c == quote {
            return Ok((out, i));
        }
        if c != '\\' {
            out.push(c as u32 as u16);
            continue;
        }
        let Some(&e) = chars.get(i) else {
            return Err(bad("has no closing quote"));
        };
        i += 1;
        let v = match e {
            'n' => 10,
            't' => 9,
            'r' => 13,
            '0'..='7' => {
                let mut v = e as u32 - '0' as u32;
                for _ in 0..2 {
                    match chars.get(i) {
                        Some(&d @ '0'..='7') => {
                            v = v * 8 + (d as u32 - '0' as u32);
                            i += 1;
                        }
                        _ => break,
                    }
                }
                v
            }
            'x' => {
                let mut v = 0u32;
                let from = i;
                while let Some(d) = chars.get(i).and_then(|c| c.to_digit(16)) {
                    v = v * 16 + d;
                    i += 1;
                }
                if i == from || v > 0xFFFF {
                    return Err(bad("has a bad \\x escape"));
                }
                v
            }
            'a' => 7,
            'b' => 8,
            'e' => 27,
            'f' => 12,
            'v' => 11,
            '\\' | '\'' | '"' | '?' => e as u32,
            _ => return Err(bad(&format!("has an unknown escape \\{e}"))),
        };
        out.push(v as u16);
    }
}
