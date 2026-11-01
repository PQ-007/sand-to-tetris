//! The JavaScript-facing API of the simulator core: thin wrappers over
//! `s2t_checker::api`, exchanging JSON strings. Errors become JS exceptions
//! carrying the same plain-language message.

use serde::Serialize;
use wasm_bindgen::prelude::*;

use s2t_checker::api;

/// Identifies the loaded core, e.g. `"0.1.0 (format 1)"`. The site shows
/// it so a stale WASM build is easy to spot.
#[wasm_bindgen(js_name = coreVersion)]
pub fn core_version() -> String {
    format!(
        "{} (format {})",
        env!("CARGO_PKG_VERSION"),
        s2t_netlist::FORMAT_VERSION
    )
}

fn to_json<T: Serialize>(result: Result<T, String>) -> Result<String, String> {
    result.and_then(|v| serde_json::to_string(&v).map_err(|e| e.to_string()))
}

fn js(result: Result<String, String>) -> Result<String, JsError> {
    result.map_err(|e| JsError::new(&e))
}

/// Parses a level definition (TOML) → `LevelInfo` JSON.
#[wasm_bindgen(js_name = levelInfo)]
pub fn level_info(toml: &str) -> Result<String, JsError> {
    js(to_json(api::level_info(toml)))
}

/// Runs a level's tests → `Report` JSON.
#[wasm_bindgen]
pub fn check(library: &str, level: &str, design: &str) -> Result<String, JsError> {
    js(to_json(api::check(library, level, design)))
}

/// Live simulation of a (possibly unfinished) design → `SimView` JSON,
/// continuing from `state` (the previous view's `state`, or `{}`).
#[wasm_bindgen]
pub fn simulate(
    library: &str,
    level: &str,
    design: &str,
    inputs: &str,
    state: &str,
) -> Result<String, JsError> {
    js(to_json(api::simulate_from(
        library, level, design, inputs, state,
    )))
}

/// Runs a sequence of input steps on one circuit, continuing from `state`
/// → `StepsView` JSON (the view after the last step, and each step's
/// outputs).
#[wasm_bindgen(js_name = simulateSteps)]
pub fn simulate_steps(
    library: &str,
    level: &str,
    design: &str,
    steps: &str,
    state: &str,
) -> Result<String, JsError> {
    js(to_json(api::simulate_steps(
        library, level, design, steps, state,
    )))
}

/// Compares the learner's design of a component with its fast model →
/// `MatchReport` JSON. The swap is allowed only if `ok`.
#[wasm_bindgen(js_name = matchCheck)]
pub fn match_check(library: &str, component: &str) -> Result<String, JsError> {
    js(to_json(api::match_check(library, component)))
}

/// An instruction word as assembly, e.g. `SET r1, 5` (docs/ISA.md).
/// Every 16-bit word is an instruction, so this never fails.
#[wasm_bindgen]
pub fn disassemble(word: u16) -> String {
    s2t_isa::decode(word).to_string()
}

/// Runs a program on the reference CPU (s2t-isa) from reset, for the
/// chapter's CPU demo. `rom` is a JSON array of words → JSON
/// `{"states": [..], "writes": [..]}`: `states[0]` is the CPU after reset
/// (registers and flags start at 0), `states[i + 1]` after instruction i;
/// `writes[i]` is `[address, value]` if instruction i stored a word, else null.
#[wasm_bindgen(js_name = isaTrace)]
pub fn isa_trace(rom: &str, steps: usize) -> Result<String, JsError> {
    let rom: Vec<u16> = serde_json::from_str(rom).map_err(|e| JsError::new(&e.to_string()))?;
    let (states, writes): (Vec<_>, Vec<_>) = s2t_isa::trace(&rom, steps.min(10_000))
        .into_iter()
        .map(|(c, w)| {
            let state = serde_json::json!({
                "pc": c.pc, "regs": c.regs, "z": c.flags.z, "n": c.flags.n, "c": c.flags.c
            });
            (state, w.map(|(a, v)| [a, v]))
        })
        .unzip();
    // The first entry is the start state, which stored nothing.
    Ok(serde_json::json!({ "states": states, "writes": &writes[1..] }).to_string())
}

// ---- the assembler (docs/ASSEMBLY.md) ---------------------------------------

/// A stage's result as JSON: `{"ok": value}` or `{"error": AsmError}`.
fn stage<T: serde::Serialize>(r: Result<T, s2t_asm::AsmError>) -> Result<String, JsError> {
    let v = match r {
        Ok(v) => serde_json::json!({ "ok": v }),
        Err(e) => serde_json::json!({ "error": e }),
    };
    Ok(v.to_string())
}

fn from_json<T: serde::de::DeserializeOwned>(s: &str) -> Result<T, JsError> {
    serde_json::from_str(s).map_err(|e| JsError::new(&e.to_string()))
}

/// Assembles a whole program → `Program` JSON (code, data, symbols,
/// sourceMap, errors).
#[wasm_bindgen(js_name = asmAssemble)]
pub fn asm_assemble(source: &str) -> Result<String, JsError> {
    js(to_json(Ok::<_, String>(s2t_asm::assemble(source))))
}

/// Stage 1 on one line → `{"ok": [Token]}` or `{"error": ...}`.
#[wasm_bindgen(js_name = asmTokenize)]
pub fn asm_tokenize(line: &str) -> Result<String, JsError> {
    stage(s2t_asm::tokenize(line))
}

/// Stage 2 on a JSON token list → `{"ok": Line}` or `{"error": ...}`.
#[wasm_bindgen(js_name = asmParse)]
pub fn asm_parse(tokens: &str) -> Result<String, JsError> {
    stage(s2t_asm::parse(&from_json::<Vec<s2t_asm::Token>>(tokens)?))
}

/// Stage 3 on a JSON list of lines → `{"ok": Layout}` or `{"error": first}`.
#[wasm_bindgen(js_name = asmLayout)]
pub fn asm_layout(lines: &str) -> Result<String, JsError> {
    let lines: Vec<s2t_asm::Line> = from_json(lines)?;
    stage(s2t_asm::layout(&lines).map_err(|mut errs| errs.remove(0)))
}

/// Stage 4 on one line's body, the symbols and its placement →
/// `{"ok": [word]}` or `{"error": ...}`.
#[wasm_bindgen(js_name = asmEncode)]
pub fn asm_encode(body: &str, symbols: &str, placed: &str) -> Result<String, JsError> {
    stage(s2t_asm::encode(
        &from_json(body)?,
        &from_json(symbols)?,
        &from_json(placed)?,
    ))
}

// ---- the VM (docs/VM.md) ----------------------------------------------------

fn vm_stage<T: serde::Serialize>(r: Result<T, s2t_vm::VmError>) -> Result<String, JsError> {
    let v = match r {
        Ok(v) => serde_json::json!({ "ok": v }),
        Err(e) => serde_json::json!({ "error": e }),
    };
    Ok(v.to_string())
}

/// Translates and assembles a VM program → `Built` JSON (lines, sourceMap,
/// program, errors).
#[wasm_bindgen(js_name = vmBuild)]
pub fn vm_build(source: &str) -> Result<String, JsError> {
    js(to_json(Ok::<_, String>(s2t_vm::build(source))))
}

/// Stage 1 on one line → `{"ok": Command | null}` or `{"error": ...}`.
#[wasm_bindgen(js_name = vmParse)]
pub fn vm_parse(line: &str) -> Result<String, JsError> {
    vm_stage(s2t_vm::parse(line))
}

/// Stage 2: one command (JSON) in its context (JSON `Ctx`) → `[line]`.
#[wasm_bindgen(js_name = vmTranslate)]
pub fn vm_translate(cmd: &str, ctx: &str) -> Result<String, JsError> {
    let lines = s2t_vm::translate(&from_json(cmd)?, &from_json(ctx)?);
    js(to_json(Ok::<_, String>(lines)))
}

/// Stage 3: the bootstrap and the runtime routines → `{bootstrap, runtime}`.
#[wasm_bindgen(js_name = vmStart)]
pub fn vm_start() -> String {
    serde_json::json!({ "bootstrap": s2t_vm::bootstrap(), "runtime": s2t_vm::runtime() })
        .to_string()
}

/// The whole-program checks on a JSON list of commands (null for blank
/// lines) → `[VmError]`.
#[wasm_bindgen(js_name = vmCheck)]
pub fn vm_check(commands: &str) -> Result<String, JsError> {
    let commands: Vec<Option<s2t_vm::Command>> = from_json(commands)?;
    js(to_json(Ok::<_, String>(s2t_vm::check(&commands))))
}

/// Runs a VM program on the interpreter → `{halted, result, steps, ram
/// (the first 64 words), screen}` or `{errors}`.
#[wasm_bindgen(js_name = vmRun)]
pub fn vm_run(source: &str, max_steps: u32) -> String {
    match s2t_vm::run(source, max_steps as usize) {
        Ok(o) => serde_json::json!({
            "halted": o.halted,
            "result": o.result,
            "steps": o.steps,
            "ram": &o.memory.ram[..64],
            "screen": o.memory.screen,
        }),
        Err(errors) => serde_json::json!({ "errors": errors }),
    }
    .to_string()
}

/// A VM program running on the interpreter, one command per step: for the
/// chapter's stack demo.
#[wasm_bindgen]
pub struct VmRunner {
    vm: s2t_vm::Vm,
}

#[wasm_bindgen]
impl VmRunner {
    /// Throws the program's errors (JSON) if it doesn't pass the checks.
    #[wasm_bindgen(constructor)]
    pub fn new(source: &str) -> Result<VmRunner, JsError> {
        s2t_vm::Vm::new(source)
            .map(|vm| VmRunner { vm })
            .map_err(|e| JsError::new(&serde_json::to_string(&e).unwrap_or_default()))
    }

    pub fn step(&mut self) {
        self.vm.step();
    }

    pub fn halted(&self) -> bool {
        self.vm.halted()
    }

    /// The line that runs next (0 once halted).
    pub fn line(&self) -> usize {
        self.vm.line()
    }

    pub fn sp(&self) -> u16 {
        self.vm.sp()
    }

    /// Every word from SP to the bottom of the stack, top first.
    pub fn stack(&mut self) -> Vec<u16> {
        self.vm.whole_stack()
    }

    /// The frames, innermost first (JSON: func, fp, args, locals).
    pub fn frames(&mut self) -> String {
        serde_json::to_string(&self.vm.frames()).unwrap_or_default()
    }
}

// ---- the C Shard compiler (docs/LANGUAGE.md) ---------------------------------

fn lang_stage<T: serde::Serialize>(r: Result<T, s2t_lang::LangError>) -> Result<String, JsError> {
    let v = match r {
        Ok(v) => serde_json::json!({ "ok": v }),
        Err(e) => serde_json::json!({ "error": e }),
    };
    Ok(v.to_string())
}

/// Compiles a whole program → `Compiled` JSON (vm, sourceMap, errors).
#[wasm_bindgen(js_name = langCompile)]
pub fn lang_compile(source: &str) -> Result<String, JsError> {
    js(to_json(Ok::<_, String>(s2t_lang::compile(source))))
}

/// Stage 1 → `{"ok": [Token]}` or `{"error": ...}`.
#[wasm_bindgen(js_name = langTokenize)]
pub fn lang_tokenize(source: &str) -> Result<String, JsError> {
    lang_stage(s2t_lang::tokenize(source))
}

/// Stage 2 on a JSON token list → `{"ok": Program}` or `{"error": ...}`.
#[wasm_bindgen(js_name = langParse)]
pub fn lang_parse(tokens: &str) -> Result<String, JsError> {
    lang_stage(s2t_lang::parse(&from_json::<Vec<s2t_lang::Token>>(tokens)?))
}

/// Stage 3 on a JSON program → `{"ok": Info}` or `{"error": first}` (and
/// `errors`: all of them).
#[wasm_bindgen(js_name = langCheck)]
pub fn lang_check(program: &str) -> Result<String, JsError> {
    let p: s2t_lang::Program = from_json(program)?;
    let v = match s2t_lang::check(&p) {
        Ok(info) => serde_json::json!({ "ok": info }),
        Err(errors) => serde_json::json!({ "error": errors.first(), "errors": errors }),
    };
    Ok(v.to_string())
}

/// Stage 4 on a JSON program and info → `[VM line]`.
#[wasm_bindgen(js_name = langGenerate)]
pub fn lang_generate(program: &str, info: &str) -> Result<String, JsError> {
    let lines = s2t_lang::generate(&from_json(program)?, &from_json(info)?);
    js(to_json(Ok::<_, String>(lines)))
}

// ---- the Machine page: a program running on the reference CPU ---------------

/// A running program: the reference CPU, RAM, screen and keyboard. Kept in
/// WASM so a frame can run thousands of instructions without JSON.
#[wasm_bindgen]
pub struct Machine {
    cpu: s2t_isa::Cpu,
    mem: s2t_isa::Memory,
    rom: Vec<u16>,
    steps: u64,
    halted: bool,
}

#[wasm_bindgen]
impl Machine {
    /// Loads `rom`, and copies `data` into RAM from address 0 (the loader).
    #[wasm_bindgen(constructor)]
    pub fn new(rom: Vec<u16>, data: Vec<u16>) -> Machine {
        let mut mem = s2t_isa::Memory::default();
        let n = data.len().min(mem.ram.len());
        mem.ram[..n].copy_from_slice(&data[..n]);
        Machine {
            cpu: s2t_isa::Cpu::default(),
            mem,
            rom,
            steps: 0,
            halted: false,
        }
    }

    /// Runs up to `max` instructions; stops early once halted (an
    /// instruction that leaves PC where it was, like `HALT`). Returns how
    /// many ran.
    pub fn run(&mut self, max: u32) -> u32 {
        let mut done = 0;
        while done < max && !self.halted {
            let pc = self.cpu.pc;
            self.cpu.step(&self.rom, &mut self.mem);
            self.steps += 1;
            done += 1;
            self.halted = self.cpu.pc == pc;
        }
        done
    }

    pub fn halted(&self) -> bool {
        self.halted
    }

    pub fn pc(&self) -> u16 {
        self.cpu.pc
    }

    pub fn regs(&self) -> Vec<u16> {
        self.cpu.regs.to_vec()
    }

    /// z, n, c as bits 2, 1, 0.
    pub fn flags(&self) -> u8 {
        let f = self.cpu.flags;
        (f.z as u8) << 2 | (f.n as u8) << 1 | f.c as u8
    }

    /// Instructions run so far.
    pub fn steps(&self) -> f64 {
        self.steps as f64
    }

    /// The 768 screen words (row y = words 8y..8y+7, bit 15 leftmost).
    pub fn screen(&self) -> Vec<u16> {
        self.mem.screen.clone()
    }

    /// The key held now (docs/ASSEMBLY.md: keyboard codes), 0 for none.
    #[wasm_bindgen(js_name = setKey)]
    pub fn set_key(&mut self, key: u16) {
        self.mem.keyboard = key;
        // A halted program may be waiting on the keyboard in a loop.
        self.halted = false;
    }

    /// The frame counter at 0x6001 (docs/ISA.md): frames since the program
    /// started, 60 a second.
    #[wasm_bindgen(js_name = setTimer)]
    pub fn set_timer(&mut self, frames: u16) {
        self.mem.timer = frames;
    }

    /// `len` RAM words from `start`.
    pub fn ram(&self, start: u16, len: u16) -> Vec<u16> {
        let s = (start as usize).min(self.mem.ram.len());
        let e = (s + len as usize).min(self.mem.ram.len());
        self.mem.ram[s..e].to_vec()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assembler_stages_round_trip_through_json() {
        let tokens = asm_tokenize("loop: ADD r1, r2, r3").unwrap();
        assert!(tokens.contains("\"kind\":\"label\""), "{tokens}");
        let ok: serde_json::Value = serde_json::from_str(&tokens).unwrap();
        let line = asm_parse(&ok["ok"].to_string()).unwrap();
        assert!(line.contains("\"mnemonic\":\"ADD\""), "{line}");
        let err = asm_tokenize("SET r1, #").unwrap();
        assert!(err.contains("\"code\":\"bad-char\""), "{err}");
        let p = asm_assemble("SET r1, 5\nHALT").unwrap();
        assert!(p.contains("\"code\":[17413,49152]"), "{p}");
    }

    #[test]
    fn vm_stages_and_runs_through_json() {
        let cmd: serde_json::Value =
            serde_json::from_str(&vm_parse("push local 2").unwrap()).unwrap();
        assert_eq!(
            cmd,
            serde_json::json!({"ok": {"op": "push", "seg": "local", "n": 2}})
        );
        assert_eq!(vm_parse("; nothing").unwrap(), r#"{"ok":null}"#);
        assert!(vm_parse("frob").unwrap().contains("unknown-command"));
        let ctx = r#"{"func":"main","args":0,"locals":3,"line":2}"#;
        let lines = vm_translate(r#"{"op":"push","seg":"local","n":2}"#, ctx).unwrap();
        assert!(lines.contains("LOAD r0, [r5 + 2]"), "{lines}");
        assert!(vm_start().contains("__mul:"));
        let errors = vm_check(r#"[{"op":"add"}]"#).unwrap();
        assert!(errors.contains("outside-function"), "{errors}");
        let b = vm_build("func main 0 0\npush 6\npush 7\nmul\nreturn").unwrap();
        assert!(b.contains("\"errors\":[]"), "{b}");
        let r = vm_run("func main 0 0\npush 6\npush 7\nmul\nreturn", 100);
        assert!(r.contains("\"result\":42"), "{r}");
        let mut v = VmRunner::new("func main 0 0\npush 6\nreturn").unwrap();
        v.step();
        v.step();
        assert_eq!(v.stack()[0], 6);
        assert!(v.frames().contains("\"func\":\"main\""));
    }

    #[test]
    fn compiler_stages_round_trip_through_json() {
        let src = "fn main() -> int { return 6 * 7; }";
        let tokens: serde_json::Value = serde_json::from_str(&lang_tokenize(src).unwrap()).unwrap();
        let program: serde_json::Value =
            serde_json::from_str(&lang_parse(&tokens["ok"].to_string()).unwrap()).unwrap();
        let info: serde_json::Value =
            serde_json::from_str(&lang_check(&program["ok"].to_string()).unwrap()).unwrap();
        let vm = lang_generate(&program["ok"].to_string(), &info["ok"].to_string()).unwrap();
        assert!(vm.contains("mul"), "{vm}");
        assert!(lang_compile(src).unwrap().contains("\"sourceMap\":[1,"));
        let bad = lang_check(r#"{"items":[]}"#).unwrap();
        assert!(bad.contains("no-main"), "{bad}");
        assert!(lang_tokenize("x = #").unwrap().contains("bad-char"));
    }

    #[test]
    fn the_machine_reads_the_timer() {
        // LOAD r1, [r0 + 1] with r0 = 0x6000: SET r0, 0; SETH r0, 0x60; LOAD; HALT.
        let p = s2t_asm::assemble("SET16 r0, 0x6000\nLOAD r1, [r0 + 1]\nHALT");
        let mut m = Machine::new(p.code, vec![]);
        m.set_timer(321);
        m.run(100);
        assert_eq!(m.regs()[1], 321);
    }

    #[test]
    fn machine_runs_until_halted() {
        // SET r1, 5; HALT
        let mut m = Machine::new(vec![17413, 49152], vec![7]);
        assert_eq!(m.run(100), 2);
        assert!(m.halted());
        assert_eq!(m.regs()[1], 5);
        assert_eq!(m.ram(0, 2), vec![7, 0]);
        assert_eq!(m.run(100), 0);
    }

    #[test]
    fn traces_a_program() {
        // SET r1, 5; STORE r1, [r1 + 0]; JMP 0
        let out = isa_trace("[17413, 42112, 49152]", 3).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(v["states"][1]["regs"][1], 5);
        assert_eq!(v["writes"][1], serde_json::json!([5, 5]));
        assert_eq!(v["states"][3]["pc"], 2);
    }

    #[test]
    fn disassembles_any_word() {
        assert_eq!(disassemble(0x4405), "SET r1, 5");
        assert_eq!(disassemble(0xf700), "RET");
        assert_eq!(disassemble(0xc000), "JMP 0");
    }

    #[test]
    fn core_version_names_crate_and_format() {
        assert_eq!(core_version(), "0.1.0 (format 1)");
    }

    #[test]
    fn json_wrappers_pass_errors_through() {
        let lib = r#"{"levels":[]}"#;
        assert_eq!(
            to_json(api::check(lib, "x", "{}")),
            Err("no level `x` in the library".to_string())
        );
    }
}
