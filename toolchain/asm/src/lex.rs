//! Stage 1: one line of text into tokens.
use crate::{AsmError, Token};

/// The tokens of one line; a comment (`;` to the end) is dropped.
pub fn tokenize(line: &str) -> Result<Vec<Token>, AsmError> {
    let chars: Vec<char> = line.chars().collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            ';' => break,
            c if c.is_whitespace() => i += 1,
            ',' => {
                out.push(Token::Comma);
                i += 1;
            }
            '[' => {
                out.push(Token::LBracket);
                i += 1;
            }
            ']' => {
                out.push(Token::RBracket);
                i += 1;
            }
            '+' => {
                out.push(Token::Plus);
                i += 1;
            }
            '-' if chars.get(i + 1).is_some_and(|d| d.is_ascii_digit()) => {
                let (value, next) = number(&chars, i + 1)?;
                out.push(Token::Number { value: -value });
                i = next;
            }
            c if c.is_ascii_digit() => {
                let (value, next) = number(&chars, i)?;
                out.push(Token::Number { value });
                i = next;
            }
            '\'' => {
                let ch = chars.get(i + 1).copied();
                match (ch, chars.get(i + 2)) {
                    (Some(ch), Some('\'')) if (' '..='~').contains(&ch) => {
                        out.push(Token::Number { value: ch as i32 });
                        i += 3;
                    }
                    _ => return Err(bad_char('\'')),
                }
            }
            '.' => {
                let start = i + 1;
                let mut end = start;
                while chars.get(end).is_some_and(|c| c.is_ascii_alphabetic()) {
                    end += 1;
                }
                if end == start {
                    return Err(bad_char('.'));
                }
                let name: String = chars[start..end].iter().collect();
                out.push(Token::Directive {
                    name: name.to_ascii_lowercase(),
                });
                i = end;
            }
            c if c.is_ascii_alphabetic() || c == '_' => {
                let start = i;
                while chars
                    .get(i)
                    .is_some_and(|c| c.is_ascii_alphanumeric() || *c == '_')
                {
                    i += 1;
                }
                let text: String = chars[start..i].iter().collect();
                if chars.get(i) == Some(&':') {
                    out.push(Token::Label { name: text });
                    i += 1;
                } else {
                    out.push(Token::Ident { text });
                }
            }
            c => return Err(bad_char(c)),
        }
    }
    Ok(out)
}

fn bad_char(c: char) -> AsmError {
    let message = if c == '\'' {
        "a character is one character in quotes, like 'A'".to_string()
    } else {
        format!("`{c}` can't appear here")
    };
    AsmError::new("bad-char", message, &[("char", c.to_string())])
}

/// A number starting at `start`: decimal, 0x hex or 0b binary, `_` allowed
/// between digits. Returns its value and the index after it.
fn number(chars: &[char], start: usize) -> Result<(i32, usize), AsmError> {
    let mut end = start;
    while chars
        .get(end)
        .is_some_and(|c| c.is_ascii_alphanumeric() || *c == '_')
    {
        end += 1;
    }
    let text: String = chars[start..end].iter().collect();
    let digits = text.replace('_', "");
    let lower = digits.to_ascii_lowercase();
    let parsed = if let Some(hex) = lower.strip_prefix("0x") {
        u32::from_str_radix(hex, 16)
            .ok()
            .filter(|_| !hex.is_empty())
    } else if let Some(bin) = lower.strip_prefix("0b") {
        u32::from_str_radix(bin, 2).ok().filter(|_| !bin.is_empty())
    } else if !lower.is_empty() && lower.chars().all(|c| c.is_ascii_digit()) {
        lower.parse::<u32>().ok()
    } else {
        None
    };
    match parsed.and_then(|v| i32::try_from(v).ok()) {
        Some(v) => Ok((v, end)),
        None => Err(AsmError::new(
            "bad-number",
            format!("`{text}` isn't a number: write 42, -5, 0x2A, 0b101 or 'A'"),
            &[("text", text.clone())],
        )),
    }
}
