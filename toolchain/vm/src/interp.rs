//! The VM's meaning as code: runs commands directly, one per step, with the
//! same memory layout as the translation (docs/VM.md), so the two can be
//! compared word for word. The one difference: a frame's return address is
//! the index of the next command, not a ROM address.
use serde::{Deserialize, Serialize};

use s2t_isa::{Bus, Memory};

use crate::program::{functions, parse_all, Functions};
use crate::{Command, Seg, VmError, STACK_TOP};

/// main's "return address": returning there halts.
const HALT: u16 = 0xffff;

/// A function's frame, for showing the stack.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Frame {
    pub func: String,
    pub fp: u16,
    pub args: u16,
    pub locals: u16,
}

pub struct Vm {
    /// The program's non-blank lines: (line, command).
    cmds: Vec<(usize, Command)>,
    /// For each of `cmds`, its function (an index into `funcs.list`).
    func_of: Vec<usize>,
    funcs: Functions,
    /// Label targets per function: (function, label) → index into `cmds`.
    targets: std::collections::BTreeMap<(usize, String), usize>,
    pc: usize,
    sp: u16,
    fp: u16,
    /// What the next `func` saves as its return address (CALL's r7).
    link: u16,
    /// The functions being run, innermost last.
    calls: Vec<usize>,
    halted: bool,
    steps: usize,
    pub memory: Memory,
}

/// How a run ended.
#[derive(Clone, Debug)]
pub struct Outcome {
    pub halted: bool,
    /// main's result (the word at the top of the stack once halted).
    pub result: u16,
    pub steps: usize,
    pub memory: Memory,
}

/// Time and keys for a run: every `steps_per_frame` commands the timer at
/// 0x6001 counts one frame (0: it never moves), and `keys` says which key
/// is held from which frame on: (frame, key).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    pub steps_per_frame: usize,
    pub keys: Vec<(u16, u16)>,
}

/// Runs a program until it halts or `max_steps` commands have run.
pub fn run(source: &str, max_steps: usize) -> Result<Outcome, Vec<VmError>> {
    run_scripted(source, max_steps, &Script::default())
}

/// `run`, with the timer and keyboard driven by a script.
pub fn run_scripted(
    source: &str,
    max_steps: usize,
    script: &Script,
) -> Result<Outcome, Vec<VmError>> {
    let mut vm = Vm::new(source)?;
    let key_at = |frame: u16| {
        script
            .keys
            .iter()
            .filter(|(f, _)| *f <= frame)
            .max_by_key(|(f, _)| *f)
            .map_or(0, |(_, k)| *k)
    };
    if script.steps_per_frame == 0 {
        vm.memory.keyboard = key_at(0);
        vm.run(max_steps);
    } else {
        let mut left = max_steps;
        let mut frame: u16 = 0;
        while left > 0 && !vm.halted {
            vm.memory.timer = frame;
            vm.memory.keyboard = key_at(frame);
            let n = script.steps_per_frame.min(left);
            vm.run(n);
            left -= n;
            frame = frame.wrapping_add(1);
        }
    }
    Ok(Outcome {
        halted: vm.halted,
        result: vm.memory.read(STACK_TOP - 1),
        steps: vm.steps,
        memory: vm.memory,
    })
}

impl Vm {
    /// A checked program, about to call main.
    pub fn new(source: &str) -> Result<Vm, Vec<VmError>> {
        let (commands, mut errors) = parse_all(source);
        let (funcs, more) = functions(&commands);
        errors.extend(more);
        if !errors.is_empty() {
            errors.sort_by_key(|e| e.line);
            return Err(errors);
        }
        let mut cmds = Vec::new();
        let mut func_of = Vec::new();
        let mut targets = std::collections::BTreeMap::new();
        for (i, cmd) in commands.into_iter().enumerate() {
            let (Some(cmd), Some(fi)) = (cmd, funcs.of_line[i]) else {
                continue;
            };
            if let Command::Label { name } = &cmd {
                targets.insert((fi, name.clone()), cmds.len());
            }
            cmds.push((i + 1, cmd));
            func_of.push(fi);
        }
        let main = funcs.by_name.get("main").copied().unwrap_or(0);
        let pc = cmds
            .iter()
            .position(|(line, _)| *line == funcs.list[main].line)
            .unwrap_or(0);
        Ok(Vm {
            cmds,
            func_of,
            funcs,
            targets,
            pc,
            sp: STACK_TOP,
            fp: STACK_TOP,
            link: HALT,
            calls: Vec::new(),
            halted: false,
            steps: 0,
            memory: Memory::default(),
        })
    }

    pub fn halted(&self) -> bool {
        self.halted
    }

    pub fn steps(&self) -> usize {
        self.steps
    }

    /// The line of the command that runs next (0 once halted).
    pub fn line(&self) -> usize {
        if self.halted {
            0
        } else {
            self.cmds.get(self.pc).map_or(0, |c| c.0)
        }
    }

    pub fn sp(&self) -> u16 {
        self.sp
    }

    pub fn fp(&self) -> u16 {
        self.fp
    }

    /// The current function's own stack, top first (once halted: main's
    /// result).
    pub fn stack(&mut self) -> Vec<u16> {
        let end = if self.halted || self.calls.is_empty() {
            STACK_TOP
        } else {
            self.fp
        };
        (self.sp..end.max(self.sp))
            .map(|a| self.memory.read(a))
            .collect()
    }

    /// Every word from SP to the bottom of the stack, top first.
    pub fn whole_stack(&mut self) -> Vec<u16> {
        (self.sp..STACK_TOP).map(|a| self.memory.read(a)).collect()
    }

    /// The frames of the functions being run, innermost first.
    pub fn frames(&mut self) -> Vec<Frame> {
        let mut fp = self.fp;
        let mut out = Vec::new();
        for &fi in self.calls.iter().rev() {
            let f = &self.funcs.list[fi];
            out.push(Frame {
                func: f.name.clone(),
                fp,
                args: f.args,
                locals: f.locals,
            });
            fp = self.memory.read(fp.wrapping_add(f.locals));
        }
        out
    }

    pub fn run(&mut self, max_steps: usize) {
        for _ in 0..max_steps {
            if self.halted {
                return;
            }
            self.step();
        }
    }

    fn push(&mut self, v: u16) {
        self.sp = self.sp.wrapping_sub(1);
        self.memory.write(self.sp, v);
    }

    fn pop(&mut self) -> u16 {
        let v = self.memory.read(self.sp);
        self.sp = self.sp.wrapping_add(1);
        v
    }

    /// The address of a local or argument in the current frame.
    fn var(&self, seg: Seg, n: u16) -> u16 {
        let f = &self.funcs.list[self.func_of[self.pc]];
        let off = match seg {
            Seg::Arg => f.locals + 2 + (f.args - 1 - n),
            _ => n,
        };
        self.fp.wrapping_add(off)
    }

    /// Runs one command.
    pub fn step(&mut self) {
        if self.halted {
            return;
        }
        let Some((_, cmd)) = self.cmds.get(self.pc).cloned() else {
            self.halted = true;
            return;
        };
        self.steps += 1;
        let mut next = self.pc + 1;
        let t = |c: bool| if c { 0xffff } else { 0 };
        match &cmd {
            Command::Push { seg, n } => {
                let v = match seg {
                    Seg::Const => *n,
                    Seg::Global => self.memory.read(*n),
                    _ => self.memory.read(self.var(*seg, *n)),
                };
                self.push(v);
            }
            Command::Set { seg, n } => {
                let v = self.pop();
                let addr = match seg {
                    Seg::Global => *n,
                    _ => self.var(*seg, *n),
                };
                self.memory.write(addr, v);
            }
            Command::Pop => {
                self.pop();
            }
            Command::Dup => {
                let v = self.memory.read(self.sp);
                self.push(v);
            }
            Command::Load => {
                let a = self.pop();
                let v = self.memory.read(a);
                self.push(v);
            }
            Command::Store => {
                let v = self.pop();
                let a = self.pop();
                self.memory.write(a, v);
            }
            Command::Neg | Command::Not => {
                let a = self.pop();
                self.push(if cmd == Command::Neg {
                    a.wrapping_neg()
                } else {
                    !a
                });
            }
            Command::Label { .. } => {}
            Command::Jump { name } => next = self.target(name),
            Command::Jumpif { name } | Command::Jumpifnot { name } => {
                let v = self.pop();
                if (v != 0) == matches!(cmd, Command::Jumpif { .. }) {
                    next = self.target(name);
                }
            }
            Command::Func { locals, .. } => {
                let (link, fp) = (self.link, self.fp);
                self.push(link);
                self.push(fp);
                for _ in 0..*locals {
                    self.push(0);
                }
                self.fp = self.sp;
                self.calls.push(self.func_of[self.pc]);
            }
            Command::Call { name, .. } => {
                let fi = self.funcs.by_name.get(name).copied().unwrap_or(0);
                let line = self.funcs.list[fi].line;
                self.link = next as u16;
                next = self.cmds.iter().position(|c| c.0 == line).unwrap_or(0);
            }
            Command::Return => {
                let f = &self.funcs.list[self.func_of[self.pc]];
                let (k, n) = (f.locals, f.args);
                let result = self.memory.read(self.sp);
                let ret = self.memory.read(self.fp.wrapping_add(k + 1));
                let caller_fp = self.memory.read(self.fp.wrapping_add(k));
                self.sp = self.fp.wrapping_add(k + 1 + n);
                self.memory.write(self.sp, result);
                self.fp = caller_fp;
                self.calls.pop();
                if ret == HALT {
                    self.halted = true;
                } else {
                    next = ret as usize;
                }
            }
            _ => {
                let b = self.pop();
                let a = self.pop();
                let (sa, sb) = (a as i16, b as i16);
                let v = match cmd {
                    Command::Add => a.wrapping_add(b),
                    Command::Sub => a.wrapping_sub(b),
                    Command::And => a & b,
                    Command::Or => a | b,
                    Command::Xor => a ^ b,
                    Command::Shl => a << (b & 15),
                    Command::Shr => a >> (b & 15),
                    Command::Sar => (sa >> (b & 15)) as u16,
                    Command::Mul => a.wrapping_mul(b),
                    Command::Div if b == 0 => 0xffff,
                    Command::Div => sa.wrapping_div(sb) as u16,
                    Command::Mod if b == 0 => a,
                    Command::Mod => sa.wrapping_rem(sb) as u16,
                    Command::Eq => t(a == b),
                    Command::Ne => t(a != b),
                    Command::Lt => t(sa < sb),
                    Command::Gt => t(sa > sb),
                    Command::Le => t(sa <= sb),
                    _ => t(sa >= sb),
                };
                self.push(v);
            }
        }
        self.pc = next;
    }

    fn target(&self, name: &str) -> usize {
        let fi = self.func_of[self.pc];
        self.targets
            .get(&(fi, name.to_string()))
            .copied()
            .unwrap_or(self.pc)
    }
}
