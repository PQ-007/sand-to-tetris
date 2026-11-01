//! Stage 1: the source into tokens.
use crate::{LangError, Token};

pub const KEYWORDS: [&str; 18] = [
    "fn", "var", "const", "if", "else", "while", "for", "in", "break", "continue", "return", "and",
    "or", "not", "true", "false", "int", "bool",
];

/// `mem` is a keyword too; it's listed apart so the list above reads as
/// the language's words.
pub fn is_keyword(word: &str) -> bool {
    word == "mem" || KEYWORDS.contains(&word)
}

const SYMBOLS_2: [&str; 8] = ["->", "..", "<<", ">>", "==", "!=", "<=", ">="];
const SYMBOLS_1: &str = "(){}[],;:=+-*/%&|^~<>";

/// Every token of the source, each with its line; the first mistake stops it.
pub fn tokenize(source: &str) -> Result<Vec<Token>, LangError> {
    let chars: Vec<char> = source.chars().collect();
    let mut out = Vec::new();
    let mut line = 1;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let next = chars.get(i + 1).copied();
        if c == '\n' {
            line += 1;
            i += 1;
        } else if c.is_whitespace() {
            i += 1;
        } else if c == '/' && next == Some('/') {
            while i < chars.len() && chars[i] != '\n' {
                i += 1;
            }
        } else if c.is_ascii_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let text: String = chars[start..i].iter().collect();
            out.push(if is_keyword(&text) {
                Token::Kw { text, line }
            } else {
                Token::Name { text, line }
            });
        } else if c.is_ascii_digit() {
            let start = i;
            while i < chars.len() && (chars[i].is_ascii_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let text: String = chars[start..i].iter().collect();
            let value = number(&text).ok_or_else(|| {
                LangError::new(
                    line,
                    "bad-number",
                    format!("{text} isn't a number from 0 to 65535"),
                    &[("text", text.clone())],
                )
            })?;
            out.push(Token::Num { value, line });
        } else if c == '\'' {
            let (value, len) = char_literal(&chars[i..]).ok_or_else(|| {
                let text: String = chars[i..chars.len().min(i + 4)]
                    .iter()
                    .take_while(|c| **c != '\n')
                    .collect();
                LangError::new(
                    line,
                    "bad-char-literal",
                    format!("{text} isn't a character: write 'A', '\\'', '\\\\' or '\\n'"),
                    &[("text", text)],
                )
            })?;
            out.push(Token::Num { value, line });
            i += len;
        } else if c == '"' {
            let (text, len) = string(&chars[i..]).ok_or_else(|| {
                LangError::new(
                    line,
                    "bad-string",
                    "a string must end on its line, with printable characters (escapes: \\\" \\\\ \\n)".into(),
                    &[],
                )
            })?;
            out.push(Token::Str { text, line });
            i += len;
        } else if let Some(sym) = next
            .map(|n| format!("{c}{n}"))
            .filter(|two| SYMBOLS_2.contains(&two.as_str()))
        {
            out.push(Token::Sym { text: sym, line });
            i += 2;
        } else if SYMBOLS_1.contains(c) {
            out.push(Token::Sym {
                text: c.to_string(),
                line,
            });
            i += 1;
        } else {
            return Err(LangError::new(
                line,
                "bad-char",
                format!("{c} can't appear here"),
                &[("char", c.to_string())],
            ));
        }
    }
    Ok(out)
}

/// 42, 0x2A, 0b101, with _ between digits; 0..65535.
fn number(text: &str) -> Option<u16> {
    let lower = text.to_ascii_lowercase();
    let (radix, digits) = if let Some(d) = lower.strip_prefix("0x") {
        (16, d)
    } else if let Some(d) = lower.strip_prefix("0b") {
        (2, d)
    } else {
        (10, lower.as_str())
    };
    if digits.is_empty()
        || digits.starts_with('_')
        || digits.ends_with('_')
        || digits.contains("__")
        || !digits.chars().all(|c| c == '_' || c.is_digit(radix))
    {
        return None;
    }
    u16::from_str_radix(&digits.replace('_', ""), radix).ok()
}

/// A character literal at the start of `s`: its value and length.
fn char_literal(s: &[char]) -> Option<(u16, usize)> {
    match s {
        ['\'', '\\', e, '\'', ..] => escape(*e).map(|v| (v, 4)),
        ['\'', c, '\'', ..] if printable(*c) && *c != '\'' && *c != '\\' => Some((*c as u16, 3)),
        _ => None,
    }
}

fn escape(c: char) -> Option<u16> {
    match c {
        '\'' | '"' | '\\' => Some(c as u16),
        'n' => Some(10),
        _ => None,
    }
}

fn printable(c: char) -> bool {
    (' '..='~').contains(&c)
}

/// A string literal at the start of `s`: its text and length.
fn string(s: &[char]) -> Option<(String, usize)> {
    let mut out = String::new();
    let mut i = 1;
    loop {
        match s.get(i)? {
            '"' => return Some((out, i + 1)),
            '\\' => {
                out.push(escape(*s.get(i + 1)?).and_then(|v| char::from_u32(v as u32))?);
                i += 2;
            }
            c if printable(*c) => {
                out.push(*c);
                i += 1;
            }
            _ => return None,
        }
    }
}
