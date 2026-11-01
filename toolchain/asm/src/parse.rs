//! Stage 2: tokens into a line (label, instruction or directive, operands).
use crate::{AsmError, Body, Line, Operand, Token};

/// Parses one line's tokens. An empty line has no label and no body.
pub fn parse(tokens: &[Token]) -> Result<Line, AsmError> {
    let mut p = Parser { tokens, at: 0 };
    let mut line = Line::default();
    if let Some(Token::Label { name }) = p.peek() {
        line.label = Some(name.clone());
        p.at += 1;
    }
    let Some(head) = p.next() else {
        return Ok(line);
    };
    line.body = Some(match head {
        Token::Ident { text } => Body::Instr {
            mnemonic: text.to_ascii_uppercase(),
            args: p.operands()?,
        },
        Token::Directive { name } if name == "equ" => Body::Dir {
            name: name.clone(),
            args: p.equ()?,
        },
        Token::Directive { name } => Body::Dir {
            name: name.clone(),
            args: p.operands()?,
        },
        other => return Err(expected("instruction", Some(other))),
    });
    Ok(line)
}

struct Parser<'a> {
    tokens: &'a [Token],
    at: usize,
}

impl Parser<'_> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.at)
    }

    fn next(&mut self) -> Option<&Token> {
        let t = self.tokens.get(self.at);
        self.at += 1;
        t
    }

    /// Operands separated by commas, up to the end of the line.
    fn operands(&mut self) -> Result<Vec<Operand>, AsmError> {
        let mut args = Vec::new();
        if self.peek().is_none() {
            return Ok(args);
        }
        loop {
            args.push(self.operand()?);
            match self.next() {
                None => return Ok(args),
                Some(Token::Comma) => {}
                other => return Err(expected("comma", other)),
            }
        }
    }

    /// `.equ NAME value`: a name, then a value (no comma).
    fn equ(&mut self) -> Result<Vec<Operand>, AsmError> {
        let name = match self.next() {
            Some(Token::Ident { text }) => text.clone(),
            other => {
                let found = describe_token(other);
                return Err(AsmError::new(
                    "bad-name",
                    format!("`{found}` isn't a name: names are letters, digits and _, not starting with a digit"),
                    &[("found", found)],
                ));
            }
        };
        let value = self.operand()?;
        if let Some(extra) = self.next() {
            return Err(expected("end", Some(extra)));
        }
        Ok(vec![Operand::Sym { name }, value])
    }

    fn operand(&mut self) -> Result<Operand, AsmError> {
        match self.next() {
            Some(Token::Number { value }) => Ok(Operand::Num { value: *value }),
            Some(Token::Ident { text }) => Ok(match register(text) {
                Some(reg) => Operand::Reg { reg },
                None => Operand::Sym { name: text.clone() },
            }),
            Some(Token::LBracket) => {
                let reg = match self.next() {
                    Some(Token::Ident { text }) if register(text).is_some() => {
                        register(text).unwrap_or(0)
                    }
                    other => return Err(expected("register", other)),
                };
                let offset = if self.peek() == Some(&Token::Plus) {
                    self.at += 1;
                    match self.next() {
                        Some(Token::Number { value }) => Operand::Num { value: *value },
                        Some(Token::Ident { text }) if register(text).is_none() => {
                            Operand::Sym { name: text.clone() }
                        }
                        other => return Err(expected("offset", other)),
                    }
                } else {
                    Operand::Num { value: 0 }
                };
                match self.next() {
                    Some(Token::RBracket) => Ok(Operand::Mem {
                        reg,
                        offset: Box::new(offset),
                    }),
                    other => Err(expected("rbracket", other)),
                }
            }
            other => Err(expected("operand", other)),
        }
    }
}

/// `r0`..`r7` (any case) is a register number.
fn register(text: &str) -> Option<u8> {
    let b = text.as_bytes();
    (b.len() == 2 && (b[0] == b'r' || b[0] == b'R') && (b'0'..=b'7').contains(&b[1]))
        .then(|| b[1] - b'0')
}

fn describe_token(t: Option<&Token>) -> String {
    match t {
        None => "the end of the line".into(),
        Some(Token::Label { name }) => format!("{name}:"),
        Some(Token::Ident { text }) => text.clone(),
        Some(Token::Directive { name }) => format!(".{name}"),
        Some(Token::Number { value }) => value.to_string(),
        Some(Token::Comma) => ",".into(),
        Some(Token::LBracket) => "[".into(),
        Some(Token::RBracket) => "]".into(),
        Some(Token::Plus) => "+".into(),
    }
}

/// `what` is a short code (instruction, comma, end, register, offset,
/// rbracket, operand) so messages can be built in any language.
fn expected(what: &str, found: Option<&Token>) -> AsmError {
    let found = describe_token(found);
    let text = match what {
        "instruction" => "an instruction or a directive",
        "comma" => "a comma",
        "end" => "the end of the line",
        "register" => "a register (r0–r7)",
        "offset" => "a number or a name",
        "rbracket" => "`]`",
        _ => "an operand",
    };
    AsmError::new(
        "expected",
        format!("expected {text}, found `{found}`"),
        &[("what", what.to_string()), ("found", found)],
    )
}
