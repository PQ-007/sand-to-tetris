//! Stage 1: one line of text into a command.
use crate::{Command, Seg, VmError, MAX_GLOBAL, MAX_VARIABLES};

/// The command on one line, or `None` for a blank line or only a comment.
pub fn parse(line: &str) -> Result<Option<Command>, VmError> {
    let text = line.split(';').next().unwrap_or("");
    let words: Vec<&str> = text.split_whitespace().collect();
    let Some((&first, rest)) = words.split_first() else {
        return Ok(None);
    };
    let word = first.to_ascii_lowercase();
    let simple = match word.as_str() {
        "pop" => Some(Command::Pop),
        "dup" => Some(Command::Dup),
        "load" => Some(Command::Load),
        "store" => Some(Command::Store),
        "add" => Some(Command::Add),
        "sub" => Some(Command::Sub),
        "and" => Some(Command::And),
        "or" => Some(Command::Or),
        "xor" => Some(Command::Xor),
        "neg" => Some(Command::Neg),
        "not" => Some(Command::Not),
        "shl" => Some(Command::Shl),
        "shr" => Some(Command::Shr),
        "sar" => Some(Command::Sar),
        "mul" => Some(Command::Mul),
        "div" => Some(Command::Div),
        "mod" => Some(Command::Mod),
        "eq" => Some(Command::Eq),
        "ne" => Some(Command::Ne),
        "lt" => Some(Command::Lt),
        "gt" => Some(Command::Gt),
        "le" => Some(Command::Le),
        "ge" => Some(Command::Ge),
        "return" => Some(Command::Return),
        _ => None,
    };
    if let Some(cmd) = simple {
        count(&word, rest, 0)?;
        return Ok(Some(cmd));
    }
    let cmd = match word.as_str() {
        "push" | "set" => {
            let set = word == "set";
            match rest {
                [one] if segment(one).is_some() => return Err(operand_count(&word)),
                [one] if set => {
                    return Err(if looks_numeric(one) {
                        VmError::new(
                            "set-constant",
                            "set needs a variable (local, arg or global), not a number".into(),
                            &[],
                        )
                    } else {
                        bad_segment(one)
                    })
                }
                [one] => Command::Push {
                    seg: Seg::Const,
                    n: constant(one)?,
                },
                [seg, index] => {
                    let seg = segment(seg).ok_or_else(|| bad_segment(seg))?;
                    let max = if seg == Seg::Global {
                        MAX_GLOBAL
                    } else {
                        MAX_VARIABLES - 1
                    };
                    let n = in_range(number(index)?, 0, max as i32)?;
                    if set {
                        Command::Set { seg, n }
                    } else {
                        Command::Push { seg, n }
                    }
                }
                _ => return Err(operand_count(&word)),
            }
        }
        "label" | "jump" | "jumpif" | "jumpifnot" => {
            count(&word, rest, 1)?;
            let name = name(rest[0])?;
            match word.as_str() {
                "label" => Command::Label { name },
                "jump" => Command::Jump { name },
                "jumpif" => Command::Jumpif { name },
                _ => Command::Jumpifnot { name },
            }
        }
        "func" => {
            count(&word, rest, 3)?;
            let name = name(rest[0])?;
            let (args, locals) = (number(rest[1])?, number(rest[2])?);
            let total = args.max(0) + locals.max(0);
            if args < 0 || locals < 0 || total > MAX_VARIABLES as i32 {
                return Err(VmError::new(
                    "too-many-variables",
                    format!(
                        "a function can have at most {MAX_VARIABLES} arguments and locals together"
                    ),
                    &[("max", MAX_VARIABLES.to_string())],
                ));
            }
            Command::Func {
                name,
                args: args as u16,
                locals: locals as u16,
            }
        }
        "call" => {
            count(&word, rest, 2)?;
            let name = name(rest[0])?;
            let args = in_range(number(rest[1])?, 0, MAX_VARIABLES as i32)?;
            Command::Call { name, args }
        }
        _ => {
            return Err(VmError::new(
                "unknown-command",
                format!("unknown command {first}"),
                &[("text", first.to_string())],
            ))
        }
    };
    Ok(Some(cmd))
}

fn segment(word: &str) -> Option<Seg> {
    match word.to_ascii_lowercase().as_str() {
        "local" => Some(Seg::Local),
        "arg" => Some(Seg::Arg),
        "global" => Some(Seg::Global),
        _ => None,
    }
}

fn bad_segment(word: &str) -> VmError {
    VmError::new(
        "bad-segment",
        format!("{word} isn't local, arg or global"),
        &[("text", word.to_string())],
    )
}

fn operand_count(command: &str) -> VmError {
    VmError::new(
        "operand-count",
        format!("wrong number of operands for {command}"),
        &[("command", command.to_string())],
    )
}

fn count(command: &str, rest: &[&str], n: usize) -> Result<(), VmError> {
    if rest.len() == n {
        Ok(())
    } else {
        Err(operand_count(command))
    }
}

fn looks_numeric(word: &str) -> bool {
    word.starts_with(|c: char| c.is_ascii_digit() || c == '-')
}

/// A number as written: decimal (maybe negative), 0x hex or 0b binary, with
/// `_` allowed between digits.
fn number(word: &str) -> Result<i32, VmError> {
    let bad = || {
        VmError::new(
            "bad-number",
            format!("{word} isn't a number"),
            &[("text", word.to_string())],
        )
    };
    let (neg, body) = match word.strip_prefix('-') {
        Some(b) => (true, b),
        None => (false, word),
    };
    let lower = body.to_ascii_lowercase();
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
        return Err(bad());
    }
    let clean = digits.replace('_', "");
    // Anything this long is out of range anyway; keep it from overflowing.
    let value = i64::from_str_radix(&clean, radix).map_or(i64::MAX, |v| v);
    let value = if neg { -value } else { value };
    Ok(value.clamp(i32::MIN as i64, i32::MAX as i64) as i32)
}

fn in_range(value: i32, min: i32, max: i32) -> Result<u16, VmError> {
    if (min..=max).contains(&value) {
        Ok(value as u16) // callers with a negative min use only the check
    } else {
        Err(VmError::new(
            "out-of-range",
            format!("{value} isn't in {min}..{max}"),
            &[
                ("value", value.to_string()),
                ("min", min.to_string()),
                ("max", max.to_string()),
            ],
        ))
    }
}

/// `push n`: −32768..65535, stored as 16 bits.
fn constant(word: &str) -> Result<u16, VmError> {
    let v = number(word)?;
    in_range(v, -32768, 65535)?;
    Ok((v & 0xffff) as u16)
}

/// A function or label name (docs/VM.md "Lines").
fn name(word: &str) -> Result<String, VmError> {
    let ok = word.starts_with(|c: char| c.is_ascii_alphabetic() || c == '_')
        && word.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
        && !word.contains("__")
        && !is_register(word);
    if ok {
        Ok(word.to_string())
    } else {
        Err(VmError::new(
            "bad-name",
            format!("{word} can't be a name"),
            &[("text", word.to_string())],
        ))
    }
}

fn is_register(word: &str) -> bool {
    let w = word.as_bytes();
    w.len() == 2 && (w[0] == b'r' || w[0] == b'R') && (b'0'..=b'7').contains(&w[1])
}
