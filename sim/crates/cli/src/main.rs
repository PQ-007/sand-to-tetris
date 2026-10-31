//! `s2t`: command-line front end to the simulator core.
//! M0: `s2t version`. M2 adds `s2t check <level-dir>`.

use std::process::ExitCode;

fn run(args: &[String]) -> Result<String, String> {
    match args.first().map(String::as_str) {
        Some("version") | Some("--version") => Ok(format!(
            "s2t {} (netlist format {})",
            env!("CARGO_PKG_VERSION"),
            s2t_netlist::FORMAT_VERSION
        )),
        Some(other) => Err(format!("unknown command `{other}`\n\nusage: s2t version")),
        None => Err("usage: s2t version".to_string()),
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args) {
        Ok(out) => {
            println!("{out}");
            ExitCode::SUCCESS
        }
        Err(msg) => {
            eprintln!("error: {msg}");
            ExitCode::FAILURE
        }
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

    #[test]
    fn unknown_command_is_named_in_error() {
        let err = run(&["frobnicate".into()]).unwrap_err();
        assert!(err.contains("`frobnicate`"), "{err}");
    }
}
