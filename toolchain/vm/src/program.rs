//! Whole programs: the checks that look past one line, and `build`, which
//! runs every stage and assembles the result.
use std::collections::BTreeMap;

use serde::Serialize;

use crate::{bootstrap, parse, runtime, translate, Command, Ctx, Seg, VmError};

/// A function as the checks see it.
#[derive(Clone, Debug)]
pub(crate) struct Function {
    pub name: String,
    pub args: u16,
    pub locals: u16,
    /// Line of its `func`.
    pub line: usize,
    /// Its labels and their lines.
    pub labels: BTreeMap<String, usize>,
}

/// The functions of a checked program (by name), and for every line the
/// function it belongs to (an index into `list`).
#[derive(Clone, Debug, Default)]
pub(crate) struct Functions {
    pub list: Vec<Function>,
    pub by_name: BTreeMap<String, usize>,
    pub of_line: Vec<Option<usize>>,
}

/// Every whole-program error (docs/VM.md "Programs"), sorted by line.
/// `commands[i]` is line i + 1 (`None` for a blank or unparseable line).
pub fn check(commands: &[Option<Command>]) -> Vec<VmError> {
    functions(commands).1
}

pub(crate) fn functions(commands: &[Option<Command>]) -> (Functions, Vec<VmError>) {
    let mut errors = Vec::new();
    let mut f = Functions {
        of_line: vec![None; commands.len()],
        ..Functions::default()
    };
    let mut current: Option<usize> = None;
    let mut last: Vec<Option<&Command>> = Vec::new();
    for (i, cmd) in commands.iter().enumerate() {
        let line = i + 1;
        let Some(cmd) = cmd else { continue };
        if let Command::Func { name, args, locals } = cmd {
            if f.by_name.contains_key(name) {
                errors.push(
                    VmError::new(
                        "duplicate-function",
                        format!("function {name} is defined twice"),
                        &[("name", name.clone())],
                    )
                    .at(line),
                );
            } else {
                f.by_name.insert(name.clone(), f.list.len());
            }
            f.list.push(Function {
                name: name.clone(),
                args: *args,
                locals: *locals,
                line,
                labels: BTreeMap::new(),
            });
            last.push(None);
            current = Some(f.list.len() - 1);
            f.of_line[i] = current;
            continue;
        }
        let Some(fi) = current else {
            errors.push(
                VmError::new(
                    "outside-function",
                    "commands belong inside a function: start with func".into(),
                    &[],
                )
                .at(line),
            );
            continue;
        };
        f.of_line[i] = Some(fi);
        last[fi] = Some(cmd);
        let func = &mut f.list[fi];
        match cmd {
            Command::Label { name } => {
                if func.labels.contains_key(name) {
                    errors.push(
                        VmError::new(
                            "duplicate-label",
                            format!("label {name} is defined twice in {}", func.name),
                            &[("name", name.clone()), ("func", func.name.clone())],
                        )
                        .at(line),
                    );
                } else {
                    func.labels.insert(name.clone(), line);
                }
            }
            Command::Push { seg, n } | Command::Set { seg, n } => {
                let (word, count) = match seg {
                    Seg::Local => ("local", func.locals),
                    Seg::Arg => ("arg", func.args),
                    _ => continue,
                };
                if *n >= count {
                    errors.push(
                        VmError::new(
                            "no-variable",
                            format!(
                                "{} has {count} {word} variables, so there's no {word} {n}",
                                func.name
                            ),
                            &[
                                ("seg", word.to_string()),
                                ("n", n.to_string()),
                                ("count", count.to_string()),
                                ("func", func.name.clone()),
                            ],
                        )
                        .at(line),
                    );
                }
            }
            _ => {}
        }
    }
    // Things that need every function and label first.
    for (i, cmd) in commands.iter().enumerate() {
        let (Some(cmd), Some(fi)) = (cmd, f.of_line[i]) else {
            continue;
        };
        let func = &f.list[fi];
        match cmd {
            Command::Jump { name } | Command::Jumpif { name } | Command::Jumpifnot { name }
                if !func.labels.contains_key(name) =>
            {
                errors.push(
                    VmError::new(
                        "unknown-label",
                        format!("there's no label {name} in {}", func.name),
                        &[("name", name.clone()), ("func", func.name.clone())],
                    )
                    .at(i + 1),
                );
            }
            Command::Call { name, args } => match f.by_name.get(name) {
                None => errors.push(
                    VmError::new(
                        "unknown-function",
                        format!("there's no function {name}"),
                        &[("name", name.clone())],
                    )
                    .at(i + 1),
                ),
                Some(&callee) if f.list[callee].args != *args => errors.push(
                    VmError::new(
                        "arg-count",
                        format!("{name} takes {} arguments, not {args}", f.list[callee].args),
                        &[
                            ("name", name.clone()),
                            ("expected", f.list[callee].args.to_string()),
                            ("got", args.to_string()),
                        ],
                    )
                    .at(i + 1),
                ),
                _ => {}
            },
            _ => {}
        }
    }
    for (fi, func) in f.list.iter().enumerate() {
        if !matches!(last[fi], Some(Command::Return | Command::Jump { .. })) {
            errors.push(
                VmError::new(
                    "no-return",
                    format!("{} must end with return or jump", func.name),
                    &[("name", func.name.clone())],
                )
                .at(func.line),
            );
        }
    }
    match f.by_name.get("main").map(|&i| &f.list[i]) {
        None => errors.push(VmError::new(
            "no-main",
            "a program needs a function main (func main 0 k)".into(),
            &[],
        )),
        Some(m) if m.args != 0 => {
            errors.push(VmError::new("main-args", "main takes no arguments".into(), &[]).at(m.line))
        }
        _ => {}
    }
    errors.sort_by_key(|e| e.line);
    (f, errors)
}

/// A translated and assembled program.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Built {
    /// The assembly, one line each.
    pub lines: Vec<String>,
    /// For each assembly line, its VM line (0: bootstrap, runtime, data).
    pub source_map: Vec<usize>,
    pub program: s2t_asm::Program,
    /// The VM program's errors; if any, there is no assembly.
    pub errors: Vec<VmError>,
}

/// Every line parsed (`None` where blank or wrong) and the parse errors.
pub(crate) fn parse_all(source: &str) -> (Vec<Option<Command>>, Vec<VmError>) {
    let mut errors = Vec::new();
    let commands = source
        .lines()
        .enumerate()
        .map(|(i, text)| match parse(text) {
            Ok(c) => c,
            Err(e) => {
                errors.push(e.at(i + 1));
                None
            }
        })
        .collect();
    (commands, errors)
}

/// Parses, checks, translates and assembles a VM program.
pub fn build(source: &str) -> Built {
    let (commands, mut errors) = parse_all(source);
    let (funcs, more) = functions(&commands);
    errors.extend(more);
    errors.sort_by_key(|e| e.line);
    if !errors.is_empty() {
        return Built {
            errors,
            ..Built::default()
        };
    }
    let mut b = Built::default();
    let emit = |lines: Vec<String>, line: usize, b: &mut Built| {
        b.source_map.extend(lines.iter().map(|_| line));
        b.lines.extend(lines);
    };
    emit(bootstrap(), 0, &mut b);
    let mut globals = 0;
    let mut arith = false;
    for (i, cmd) in commands.iter().enumerate() {
        let (Some(cmd), Some(fi)) = (cmd, funcs.of_line[i]) else {
            continue;
        };
        let func = &funcs.list[fi];
        let ctx = Ctx {
            func: func.name.clone(),
            args: func.args,
            locals: func.locals,
            line: i + 1,
        };
        match cmd {
            Command::Push {
                seg: Seg::Global,
                n,
            }
            | Command::Set {
                seg: Seg::Global,
                n,
            } => globals = globals.max(*n as usize + 1),
            Command::Mul | Command::Div | Command::Mod => arith = true,
            _ => {}
        }
        emit(translate(cmd, &ctx), i + 1, &mut b);
    }
    if arith {
        emit(runtime(), 0, &mut b);
    }
    if globals > 0 {
        emit(vec![".data".into(), format!(".space {globals}")], 0, &mut b);
    }
    b.program = s2t_asm::assemble(&b.lines.join("\n"));
    b.errors = b
        .program
        .errors
        .iter()
        .map(|e| from_asm(e, &b.source_map))
        .collect();
    b
}

/// An assembler error in the translation, on its VM line.
fn from_asm(e: &s2t_asm::AsmError, source_map: &[usize]) -> VmError {
    let line = e
        .line
        .checked_sub(1)
        .and_then(|i| source_map.get(i))
        .copied()
        .unwrap_or(0);
    if e.code == "jump-too-far" {
        VmError::new(
            "function-too-long",
            "this jump can't reach its label: the function is too long (split it)".into(),
            &[],
        )
        .at(line)
    } else {
        VmError::new(
            "asm",
            format!("the assembler rejected the translation: {}", e.message),
            &[("code", e.code.clone()), ("message", e.message.clone())],
        )
        .at(line)
    }
}
