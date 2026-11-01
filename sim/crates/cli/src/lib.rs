//! `s2t`: command-line front end to the simulator core.
//!
//! ```text
//! s2t version
//! s2t check <level-dir> [design.json] [--json]   check one design (default: the reference)
//! s2t check-all <levels-dir>                     check every reference solution
//! ```
//!
//! Every level found under the levels folder is known to the library, and
//! every other level's reference counts as unlocked: that's what a learner
//! who passed those levels would have.

use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use s2t_checker::{check_with, Report, Table};
use s2t_netlist::{Design, Level, Library};

const USAGE: &str = "usage:
  s2t version
  s2t check <level-dir> [design.json] [--json]
  s2t check-all <levels-dir>
  s2t asm <program.s> [--json]
  s2t vm <program.vm> [--json]
  s2t compile <program.shard>";

struct Entry {
    dir: PathBuf,
    level: Level,
    reference: Option<Design>,
}

fn read(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("can't read {}: {e}", path.display()))
}

fn load_level(dir: &Path) -> Result<Entry, String> {
    let level = Level::from_toml(&read(&dir.join("level.toml"))?)
        .map_err(|e| format!("{}: {e}", dir.join("level.toml").display()))?;
    let reference_path = dir.join("reference.json");
    let reference = if reference_path.exists() {
        Some(
            Design::from_json(&read(&reference_path)?)
                .map_err(|e| format!("{}: {e}", reference_path.display()))?,
        )
    } else {
        None
    };
    Ok(Entry {
        dir: dir.to_path_buf(),
        level,
        reference,
    })
}

fn subdirs(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut dirs: Vec<PathBuf> = fs::read_dir(dir)
        .map_err(|e| format!("can't read {}: {e}", dir.display()))?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    dirs.sort();
    Ok(dirs)
}

/// Loads `<root>/<layerN>/<id>/level.toml` for every level, checking that
/// folder names agree with the files.
fn load_tree(root: &Path) -> Result<Vec<Entry>, String> {
    let mut entries = Vec::new();
    for layer_dir in subdirs(root)? {
        for dir in subdirs(&layer_dir)? {
            if !dir.join("level.toml").exists() {
                continue;
            }
            let e = load_level(&dir)?;
            let folder = dir.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if folder != e.level.id {
                return Err(format!(
                    "{}: folder `{folder}` holds level `{}`; they must match",
                    dir.display(),
                    e.level.id
                ));
            }
            let layer_name = layer_dir.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if layer_name != format!("layer{}", e.level.layer) {
                return Err(format!(
                    "{}: level `{}` says layer {}, but it's in `{layer_name}`",
                    dir.display(),
                    e.level.id,
                    e.level.layer
                ));
            }
            entries.push(e);
        }
    }
    Ok(entries)
}

fn library_for(entries: &[Entry], exclude: &str) -> Library {
    let mut lib = Library::new();
    for e in entries {
        lib.add_level(e.level.clone());
        if e.level.id != exclude {
            if let Some(r) = &e.reference {
                lib.unlock(r.clone());
            }
        }
    }
    lib
}

/// Memory components (registers, RAM) other than `exclude` run as their
/// fast models: built all the way down to gates, RAM4K would be millions of
/// gates. That's sound because each one's own reference is checked against
/// that same model, just as a learner's design must match before a swap.
fn fast_memory(entries: &[Entry], exclude: &str) -> BTreeSet<String> {
    entries
        .iter()
        .filter(|e| e.level.id != exclude && e.level.sequential)
        .filter(|e| {
            e.level
                .model
                .as_deref()
                .and_then(s2t_models::clocked)
                .is_some()
        })
        .map(|e| e.level.id.clone())
        .collect()
}

fn title(level: &Level) -> String {
    format!(
        "{} (Layer {}{})",
        level.id,
        level.layer,
        if level.optional { ", optional" } else { "" }
    )
}

/// Human-readable report. `Ok` if it passed.
fn render(level: &Level, report: &Report) -> Result<String, String> {
    let rows = report.rows.len();
    let unit = if level.sequential { "steps" } else { "rows" };
    if report.passed {
        if level.layer == 1 {
            return Ok(format!(
                "✓ {}: all {rows} rows pass, {} transistors",
                title(level),
                report.transistors
            ));
        }
        let random = report
            .random
            .as_ref()
            .map(|r| {
                format!(
                    " + {} random {}",
                    r.run,
                    if level.sequential { "steps" } else { "tests" }
                )
            })
            .unwrap_or_default();
        return Ok(format!(
            "✓ {}: all {rows} {unit}{random} pass, {} gates, {} gate delay{} deep",
            title(level),
            report.cells,
            report.depth,
            if report.depth == 1 { "" } else { "s" }
        ));
    }
    let mut out = if report.rows.is_empty() {
        format!("✗ {}: the design has errors", title(level))
    } else {
        let failed = report.rows.iter().filter(|r| !r.passed).count();
        let random = match &report.random {
            Some(r) if r.failed > 0 => format!(
                ", {} of {} random {} fail",
                r.failed,
                r.run,
                if level.sequential { "steps" } else { "tests" }
            ),
            _ => String::new(),
        };
        format!("✗ {}: {failed} of {rows} {unit} fail{random}", title(level))
    };
    for p in &report.problems {
        out.push_str(&format!("\n  {}: {}", p.severity, p.message));
    }
    for d in &report.diagnostics {
        out.push_str(&format!("\n  {}", d.message));
        if let Some(h) = &d.hint {
            out.push_str(&format!("\n    hint: {h}"));
        }
    }
    Err(out)
}

fn check_dir(level_dir: &Path, design: Option<&Path>, json: bool) -> Result<String, String> {
    let entry = load_level(level_dir)?;
    // Sibling levels live in <root>/<layer>/<id>.
    let entries = match level_dir.parent().and_then(Path::parent) {
        Some(root) if root.is_dir() => load_tree(root)?,
        _ => vec![],
    };
    let entries = if entries.iter().any(|e| e.level.id == entry.level.id) {
        entries
    } else {
        vec![entry]
    };
    let me = entries
        .iter()
        .find(|e| e.dir.canonicalize().ok() == level_dir.canonicalize().ok())
        .or_else(|| entries.first())
        .ok_or("no level found")?;
    let design = match design {
        Some(path) => {
            Design::from_json(&read(path)?).map_err(|e| format!("{}: {e}", path.display()))?
        }
        None => me.reference.clone().ok_or_else(|| {
            format!(
                "{}: no reference.json; pass a design file",
                me.dir.display()
            )
        })?,
    };
    let lib = library_for(&entries, &me.level.id);
    let report = check_with(
        &me.level,
        &design,
        &lib,
        &fast_memory(&entries, &me.level.id),
    )
    .map_err(|e| format!("{}: {e}", me.dir.display()))?;
    if json {
        let text = serde_json::to_string_pretty(&report).map_err(|e| e.to_string())?;
        return if report.passed { Ok(text) } else { Err(text) };
    }
    render(&me.level, &report)
}

fn check_all(root: &Path) -> Result<String, String> {
    let entries = load_tree(root)?;
    if entries.is_empty() {
        return Err(format!("no levels found under {}", root.display()));
    }
    let mut lines = Vec::new();
    let mut ok = true;
    for e in &entries {
        let table = Table::parse(&e.level.truth_table, &e.level)
            .map_err(|err| format!("{}: {err}", e.dir.display()))?;
        if let Some(m) = &e.level.model {
            let widths =
                |ports: &[String]| ports.iter().map(|p| e.level.width(p)).collect::<Vec<_>>();
            match s2t_models::widths(m) {
                None => {
                    ok = false;
                    lines.push(format!("✗ {}: model `{m}` doesn't exist", title(&e.level)));
                    continue;
                }
                Some((ins, outs))
                    if ins != widths(&e.level.inputs) || outs != widths(&e.level.outputs) =>
                {
                    ok = false;
                    lines.push(format!(
                        "✗ {}: model `{m}` has different port widths",
                        title(&e.level)
                    ));
                    continue;
                }
                Some(_) => {}
            }
        } else if !e.level.sequential && !table.is_exhaustive(&e.level) {
            ok = false;
            lines.push(format!(
                "✗ {}: the truth table doesn't list every input combination, and there's no model to test against",
                title(&e.level)
            ));
            continue;
        }
        let Some(reference) = &e.reference else {
            ok = false;
            lines.push(format!("✗ {}: no reference.json", title(&e.level)));
            continue;
        };
        let report = check_with(
            &e.level,
            reference,
            &library_for(&entries, &e.level.id),
            &fast_memory(&entries, &e.level.id),
        )
        .map_err(|err| format!("{}: {err}", e.dir.display()))?;
        match render(&e.level, &report) {
            Ok(line) => lines.push(line),
            Err(text) => {
                ok = false;
                lines.push(text);
            }
        }
    }
    let text = lines.join("\n");
    if ok {
        Ok(text)
    } else {
        Err(text)
    }
}

/// Assembles a program: a listing (address, word, source line), or the
/// whole program as JSON; every error with its line otherwise.
fn asm(path: &Path, json: bool) -> Result<String, String> {
    let source = read(path)?;
    let p = s2t_asm::assemble(&source);
    if !p.errors.is_empty() {
        let lines: Vec<String> = p.errors.iter().map(|e| e.to_string()).collect();
        return Err(format!("{}:\n{}", path.display(), lines.join("\n")));
    }
    if json {
        return serde_json::to_string(&p).map_err(|e| e.to_string());
    }
    let src: Vec<&str> = source.lines().collect();
    let mut out: Vec<String> = p
        .code
        .iter()
        .zip(&p.source_map)
        .enumerate()
        .map(|(addr, (w, line))| {
            let text = src.get(line - 1).map_or("", |l| l.trim());
            format!("{addr:04x}  {w:04x}  {line}: {text}")
        })
        .collect();
    if !p.data.is_empty() {
        out.push(format!("data ({} words): {:04x?}", p.data.len(), p.data));
    }
    Ok(out.join("\n"))
}

/// Translates a VM program: the assembly, each VM command's lines under a
/// comment with its line, or the whole result as JSON; every error with its
/// line otherwise.
fn vm(path: &Path, json: bool) -> Result<String, String> {
    let source = read(path)?;
    let b = s2t_vm::build(&source);
    if !b.errors.is_empty() {
        let lines: Vec<String> = b.errors.iter().map(|e| e.to_string()).collect();
        return Err(format!("{}:\n{}", path.display(), lines.join("\n")));
    }
    if json {
        return serde_json::to_string(&b).map_err(|e| e.to_string());
    }
    let src: Vec<&str> = source.lines().collect();
    let mut out = Vec::new();
    let mut last = 0;
    for (text, &line) in b.lines.iter().zip(&b.source_map) {
        if line != last && line > 0 {
            let vm_text = src.get(line - 1).map_or("", |l| l.trim());
            out.push(format!("; {line}: {vm_text}"));
        }
        last = line;
        out.push(text.clone());
    }
    Ok(out.join("\n"))
}

/// Compiles a C Shard program to VM code; every error with its line
/// otherwise.
fn compile(path: &Path) -> Result<String, String> {
    let c = s2t_lang::compile(&read(path)?);
    if c.errors.is_empty() {
        Ok(c.vm.join("\n"))
    } else {
        let lines: Vec<String> = c.errors.iter().map(|e| e.to_string()).collect();
        Err(format!("{}:\n{}", path.display(), lines.join("\n")))
    }
}

/// Runs a command. `Ok` output goes to stdout with exit code 0; `Err`
/// output goes to stderr with exit code 1.
pub fn run(args: &[String]) -> Result<String, String> {
    let json = args.iter().any(|a| a == "--json");
    let rest: Vec<&str> = args
        .iter()
        .map(String::as_str)
        .filter(|a| *a != "--json")
        .collect();
    match rest.as_slice() {
        ["version"] | ["--version"] => Ok(format!(
            "s2t {} (netlist format {})",
            env!("CARGO_PKG_VERSION"),
            s2t_netlist::FORMAT_VERSION
        )),
        ["check", dir] => check_dir(Path::new(dir), None, json),
        ["check", dir, design] => check_dir(Path::new(dir), Some(Path::new(design)), json),
        ["check-all", root] => check_all(Path::new(root)),
        ["asm", file] => asm(Path::new(file), json),
        ["vm", file] => vm(Path::new(file), json),
        ["compile", file] => compile(Path::new(file)),
        [] => Err(USAGE.to_string()),
        [cmd, ..] if !["check", "check-all", "asm", "vm", "compile", "version"].contains(cmd) => {
            Err(format!("unknown command `{cmd}`\n\n{USAGE}"))
        }
        _ => Err(USAGE.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_command_reports_format() {
        let out = run(&["version".into()]);
        assert_eq!(out, Ok("s2t 0.1.0 (netlist format 1)".to_string()));
    }
}
