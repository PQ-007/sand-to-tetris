// The glue around a VM translator's stages (docs/VM.md "How it's built"):
// the whole-program checks and the loop that translates every command.
// The learner writes the stages; this part is shared, so the same code runs
// the reference's stages and theirs. A test keeps the checks identical to
// s2t-vm's. Pure: runs in the worker and in vitest.
import type { AsmError, VmCommand, VmCtx, VmError } from "./sim/types";

export interface TranslatorStages {
  parse(line: string): VmCommand | null;
  translate(cmd: VmCommand, ctx: VmCtx): string[];
  bootstrap(): string[];
  runtime(): string[];
}

export interface VmTranslation {
  /** The assembly, one line each (empty if there are errors). */
  lines: string[];
  /** For each assembly line, its VM line (0: bootstrap, runtime, data). */
  sourceMap: number[];
  errors: VmError[];
}

/** What a stage threw, as an error on `line`. */
export function errorOf(e: unknown, line: number): VmError {
  if (e && typeof e === "object" && "code" in e) {
    const err = e as {
      code: unknown;
      message?: unknown;
      line?: unknown;
      args?: unknown;
    };
    const args: Record<string, string> = {};
    if (err.args && typeof err.args === "object")
      for (const [k, v] of Object.entries(err.args)) args[k] = String(v);
    return {
      line: typeof err.line === "number" && err.line > 0 ? err.line : line,
      code: String(err.code),
      args,
      message: String(err.message ?? ""),
    };
  }
  return { line, code: "crash", args: {}, message: String(e) };
}

const err = (
  line: number,
  code: string,
  message: string,
  args: Record<string, string> = {},
): VmError => ({ line, code, args, message });

interface Func {
  name: string;
  args: number;
  locals: number;
  line: number;
  labels: Set<string>;
  last: VmCommand | null;
}

/** For every line, its function (null outside one), and the functions. */
function functionsOf(commands: (VmCommand | null)[]): {
  ofLine: (Func | null)[];
  byName: Map<string, Func>;
  list: Func[];
  errors: VmError[];
} {
  const errors: VmError[] = [];
  const byName = new Map<string, Func>();
  const list: Func[] = [];
  const ofLine: (Func | null)[] = commands.map(() => null);
  let current: Func | null = null;
  commands.forEach((cmd, i) => {
    const line = i + 1;
    if (!cmd) return;
    if (cmd.op === "func") {
      current = {
        name: cmd.name,
        args: cmd.args,
        locals: cmd.locals,
        line,
        labels: new Set(),
        last: null,
      };
      if (byName.has(cmd.name))
        errors.push(
          err(
            line,
            "duplicate-function",
            `function ${cmd.name} is defined twice`,
            {
              name: cmd.name,
            },
          ),
        );
      else byName.set(cmd.name, current);
      list.push(current);
      ofLine[i] = current;
      return;
    }
    const f: Func | null = current;
    if (!f) {
      errors.push(
        err(
          line,
          "outside-function",
          "commands belong inside a function: start with func",
        ),
      );
      return;
    }
    ofLine[i] = f;
    f.last = cmd;
    if (cmd.op === "label") {
      if (f.labels.has(cmd.name))
        errors.push(
          err(
            line,
            "duplicate-label",
            `label ${cmd.name} is defined twice in ${f.name}`,
            { name: cmd.name, func: f.name },
          ),
        );
      else f.labels.add(cmd.name);
    }
    if (
      (cmd.op === "push" || cmd.op === "set") &&
      (cmd.seg === "local" || cmd.seg === "arg")
    ) {
      const count = cmd.seg === "local" ? f.locals : f.args;
      if (cmd.n >= count)
        errors.push(
          err(
            line,
            "no-variable",
            `${f.name} has ${count} ${cmd.seg} variables, so there's no ${cmd.seg} ${cmd.n}`,
            {
              seg: cmd.seg,
              n: String(cmd.n),
              count: String(count),
              func: f.name,
            },
          ),
        );
    }
  });
  return { ofLine, byName, list, errors };
}

/** Every whole-program error (docs/VM.md "Programs"), sorted by line, as
 * s2t-vm's `check`. `commands[i]` is line i + 1. */
export function checkProgram(commands: (VmCommand | null)[]): VmError[] {
  const { ofLine, byName, list, errors } = functionsOf(commands);
  commands.forEach((cmd, i) => {
    const f = ofLine[i];
    if (!cmd || !f) return;
    const line = i + 1;
    if (
      (cmd.op === "jump" || cmd.op === "jumpif" || cmd.op === "jumpifnot") &&
      !f.labels.has(cmd.name)
    )
      errors.push(
        err(
          line,
          "unknown-label",
          `there's no label ${cmd.name} in ${f.name}`,
          {
            name: cmd.name,
            func: f.name,
          },
        ),
      );
    if (cmd.op === "call") {
      const callee = byName.get(cmd.name);
      if (!callee)
        errors.push(
          err(line, "unknown-function", `there's no function ${cmd.name}`, {
            name: cmd.name,
          }),
        );
      else if (callee.args !== cmd.args)
        errors.push(
          err(
            line,
            "arg-count",
            `${cmd.name} takes ${callee.args} arguments, not ${cmd.args}`,
            {
              name: cmd.name,
              expected: String(callee.args),
              got: String(cmd.args),
            },
          ),
        );
    }
  });
  for (const f of list)
    if (f.last?.op !== "return" && f.last?.op !== "jump")
      errors.push(
        err(f.line, "no-return", `${f.name} must end with return or jump`, {
          name: f.name,
        }),
      );
  const main = byName.get("main");
  if (!main)
    errors.push(
      err(0, "no-main", "a program needs a function main (func main 0 k)"),
    );
  else if (main.args !== 0)
    errors.push(err(main.line, "main-args", "main takes no arguments"));
  // Stable, like Rust's sort_by_key.
  return errors
    .map((e, i) => [e, i] as const)
    .sort((a, b) => a[0].line - b[0].line || a[1] - b[1])
    .map(([e]) => e);
}

/** Translates parsed commands with the stages' translate, bootstrap and
 * runtime (after the checks, which must have passed). */
export function translateCommands(
  stages: Pick<TranslatorStages, "translate" | "bootstrap" | "runtime">,
  commands: (VmCommand | null)[],
): VmTranslation {
  const errors = checkProgram(commands);
  const out: VmTranslation = { lines: [], sourceMap: [], errors };
  if (errors.length) return out;
  const { ofLine } = functionsOf(commands);
  const emit = (lines: string[], line: number) => {
    if (!Array.isArray(lines))
      throw Object.assign(
        new Error("translate must return an array of lines"),
        {
          code: "not-lines",
        },
      );
    for (const l of lines) {
      out.lines.push(String(l));
      out.sourceMap.push(line);
    }
  };
  const tryEmit = (make: () => string[], line: number) => {
    try {
      emit(make(), line);
    } catch (e) {
      errors.push(errorOf(e, line));
    }
  };
  tryEmit(() => stages.bootstrap(), 0);
  let globals = 0;
  let arith = false;
  commands.forEach((cmd, i) => {
    const f = ofLine[i];
    if (!cmd || !f) return;
    if ((cmd.op === "push" || cmd.op === "set") && cmd.seg === "global")
      globals = Math.max(globals, cmd.n + 1);
    if (cmd.op === "mul" || cmd.op === "div" || cmd.op === "mod") arith = true;
    const ctx: VmCtx = {
      func: f.name,
      args: f.args,
      locals: f.locals,
      line: i + 1,
    };
    tryEmit(() => stages.translate(cmd, ctx), i + 1);
  });
  if (arith) tryEmit(() => stages.runtime(), 0);
  if (globals > 0) emit([".data", `.space ${globals}`], 0);
  if (errors.length) {
    out.lines = [];
    out.sourceMap = [];
  }
  return out;
}

/** Parses every line, then translates: s2t-vm's `build`, minus assembling. */
export function translateWith(
  stages: TranslatorStages,
  source: string,
): VmTranslation {
  const errors: VmError[] = [];
  const lines = source.split("\n");
  // Rust's str::lines() doesn't count a final empty line; neither do we.
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  const commands = lines.map((text, i) => {
    try {
      return stages.parse(text) ?? null;
    } catch (e) {
      errors.push(errorOf(e, i + 1));
      return null;
    }
  });
  const t = translateCommands(stages, commands);
  if (!errors.length) return t;
  const all = [...errors, ...t.errors]
    .map((e, i) => [e, i] as const)
    .sort((a, b) => a[0].line - b[0].line || a[1] - b[1])
    .map(([e]) => e);
  return { lines: [], sourceMap: [], errors: all };
}

/** The assembler's errors on the translation, on their VM lines (as
 * s2t-vm's build does: jump-too-far is function-too-long). */
export function fromAsmErrors(
  errors: AsmError[],
  sourceMap: number[],
): VmError[] {
  return errors.map((e) => {
    const line = sourceMap[e.line - 1] ?? 0;
    return e.code === "jump-too-far"
      ? err(
          line,
          "function-too-long",
          "this jump can't reach its label: the function is too long (split it)",
        )
      : err(
          line,
          "asm",
          `the assembler rejected the translation: ${e.message}`,
          { code: e.code, message: e.message },
        );
  });
}
