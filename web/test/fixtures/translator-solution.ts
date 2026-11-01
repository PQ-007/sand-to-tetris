// A complete VM translator, written as a learner might (tests only: never
// bundled). It's deliberately not the reference's code: comparisons branch
// with labels, and multiplication counts 16 bits. It must pass every test.

type Seg = "const" | "local" | "arg" | "global";

type Command =
  | { op: "push" | "set"; seg: Seg; n: number }
  | { op: "label" | "jump" | "jumpif" | "jumpifnot"; name: string }
  | { op: "func"; name: string; args: number; locals: number }
  | { op: "call"; name: string; args: number }
  | { op: string };

interface Ctx {
  func: string;
  args: number;
  locals: number;
  line: number;
}

declare class VmError extends Error {
  constructor(code: string, message: string, args?: Record<string, string>);
}

const SIMPLE = [
  "pop",
  "dup",
  "load",
  "store",
  "add",
  "sub",
  "and",
  "or",
  "xor",
  "neg",
  "not",
  "shl",
  "shr",
  "sar",
  "mul",
  "div",
  "mod",
  "eq",
  "ne",
  "lt",
  "gt",
  "le",
  "ge",
  "return",
];

const SEGS = ["local", "arg", "global"];

function num(text: string): number {
  let t = text;
  let sign = 1;
  if (t.startsWith("-")) {
    sign = -1;
    t = t.slice(1);
  }
  let base = 10;
  const low = t.toLowerCase();
  if (low.startsWith("0x")) {
    base = 16;
    t = t.slice(2);
  } else if (low.startsWith("0b")) {
    base = 2;
    t = t.slice(2);
  }
  const digits =
    base === 16 ? /^[0-9a-f]+$/i : base === 2 ? /^[01]+$/ : /^[0-9]+$/;
  const clean = t.replace(/_/g, "");
  if (
    !t ||
    t.startsWith("_") ||
    t.endsWith("_") ||
    t.includes("__") ||
    !digits.test(clean)
  )
    throw new VmError("bad-number", `${text} isn't a number`);
  return sign * parseInt(clean, base);
}

function range(v: number, min: number, max: number): number {
  if (v < min || v > max)
    throw new VmError("out-of-range", `${v} isn't in ${min}..${max}`);
  return v;
}

function nameOf(text: string): string {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(text) ||
    text.includes("__") ||
    /^[rR][0-7]$/.test(text)
  )
    throw new VmError("bad-name", `${text} can't be a name`);
  return text;
}

export function parse(line: string): Command | null {
  const words = line
    .split(";")[0]!
    .trim()
    .split(/\s+/)
    .filter((w) => w);
  if (!words.length) return null;
  const op = words[0]!.toLowerCase();
  const rest = words.slice(1);
  const count = (n: number) => {
    if (rest.length !== n)
      throw new VmError("operand-count", `wrong number of operands for ${op}`);
  };
  if (SIMPLE.includes(op)) {
    count(0);
    return { op };
  }
  if (op === "push" || op === "set") {
    if (rest.length === 1) {
      const one = rest[0]!;
      if (SEGS.includes(one.toLowerCase()))
        throw new VmError("operand-count", "needs an index");
      if (op === "set") {
        if (/^[0-9-]/.test(one))
          throw new VmError("set-constant", "set needs a variable");
        throw new VmError("bad-segment", `${one} isn't a segment`);
      }
      const v = range(num(one), -32768, 65535);
      return { op, seg: "const", n: v & 0xffff };
    }
    if (rest.length === 2) {
      const seg = rest[0]!.toLowerCase();
      if (!SEGS.includes(seg))
        throw new VmError("bad-segment", `${rest[0]} isn't a segment`);
      const n = range(num(rest[1]!), 0, seg === "global" ? 4095 : 125);
      return { op, seg: seg as Seg, n };
    }
    count(-1);
  }
  if (
    op === "label" ||
    op === "jump" ||
    op === "jumpif" ||
    op === "jumpifnot"
  ) {
    count(1);
    return { op, name: nameOf(rest[0]!) };
  }
  if (op === "func") {
    count(3);
    const name = nameOf(rest[0]!);
    const args = num(rest[1]!);
    const locals = num(rest[2]!);
    if (args < 0 || locals < 0 || args + locals > 126)
      throw new VmError(
        "too-many-variables",
        "at most 126 arguments and locals",
      );
    return { op, name, args, locals };
  }
  if (op === "call") {
    count(2);
    const name = nameOf(rest[0]!);
    return { op, name, args: range(num(rest[1]!), 0, 126) };
  }
  throw new VmError("unknown-command", `unknown command ${words[0]}`);
}

const PUSH_R0 = ["SUBI r6, 1", "STORE r0, [r6]"];
/** b in r1, a in r0; a's slot is now the top. */
const TWO = ["LOAD r1, [r6]", "ADDI r6, 1", "LOAD r0, [r6]"];

function slot(seg: Seg, n: number, ctx: Ctx): string {
  const off = seg === "arg" ? ctx.locals + 2 + (ctx.args - 1 - n) : n;
  return `[r5 + ${off}]`;
}

/** r2 = -1 if r{a} < r{b}, else 0, by branching on the signs. */
function less(a: number, b: number, ctx: Ctx, tag: string): string[] {
  const same = `__same_${tag}${ctx.line}`;
  const done = `__done_${tag}${ctx.line}`;
  return [
    `XOR r2, r${a}, r${b}`,
    "TEST r2, r2",
    `JNN ${same}`,
    // Different signs: a < b exactly when a is negative.
    `SAR r2, r${a}, 15`,
    `JMP ${done}`,
    `${same}:`,
    // Same signs: a - b can't overflow.
    `SUB r2, r${a}, r${b}`,
    "SAR r2, r2, 15",
    `${done}:`,
  ];
}

export function translate(cmd: Command, ctx: Ctx): string[] {
  const c = cmd as Command & {
    seg: Seg;
    n: number;
    name: string;
    locals: number;
  };
  const binary: Record<string, string> = {
    add: "ADD",
    sub: "SUB",
    and: "AND",
    or: "OR",
    xor: "XOR",
    shl: "SHL",
    shr: "SHR",
    sar: "SAR",
  };
  if (binary[c.op])
    return [...TWO, `${binary[c.op]} r0, r0, r1`, "STORE r0, [r6]"];
  switch (c.op) {
    case "push":
      if (c.seg === "const") return [`SET16 r0, ${c.n}`, ...PUSH_R0];
      if (c.seg === "global")
        return [`SET16 r1, ${c.n}`, "LOAD r0, [r1]", ...PUSH_R0];
      return [`LOAD r0, ${slot(c.seg, c.n, ctx)}`, ...PUSH_R0];
    case "set":
      if (c.seg === "global")
        return [
          "LOAD r0, [r6]",
          "ADDI r6, 1",
          `SET16 r1, ${c.n}`,
          "STORE r0, [r1]",
        ];
      return [
        "LOAD r0, [r6]",
        "ADDI r6, 1",
        `STORE r0, ${slot(c.seg, c.n, ctx)}`,
      ];
    case "pop":
      return ["ADDI r6, 1"];
    case "dup":
      return ["LOAD r0, [r6]", ...PUSH_R0];
    case "load":
      return ["LOAD r0, [r6]", "LOAD r0, [r0]", "STORE r0, [r6]"];
    case "store":
      return [
        "LOAD r1, [r6]",
        "LOAD r0, [r6 + 1]",
        "STORE r1, [r0]",
        "ADDI r6, 2",
      ];
    case "neg":
      return ["LOAD r0, [r6]", "SET r1, 0", "SUB r0, r1, r0", "STORE r0, [r6]"];
    case "not":
      return [
        "LOAD r0, [r6]",
        "SET r1, 0",
        "XORN r0, r0, r1",
        "STORE r0, [r6]",
      ];
    case "eq":
    case "ne": {
      const skip = `__cmp${ctx.line}`;
      return [
        ...TWO,
        "SET r2, 0",
        "CMP r0, r1",
        `${c.op === "eq" ? "JNZ" : "JZ"} ${skip}`,
        "SUBI r2, 1",
        `${skip}:`,
        "STORE r2, [r6]",
      ];
    }
    case "lt":
      return [...TWO, ...less(0, 1, ctx, "lt"), "STORE r2, [r6]"];
    case "gt":
      return [...TWO, ...less(1, 0, ctx, "gt"), "STORE r2, [r6]"];
    case "ge":
    case "le":
      return [
        ...TWO,
        ...(c.op === "ge" ? less(0, 1, ctx, "ge") : less(1, 0, ctx, "le")),
        "SET r3, 0",
        "XORN r2, r2, r3",
        "STORE r2, [r6]",
      ];
    case "mul":
      return [...TWO, "SET16 r2, __mul", "CALLR r2", "STORE r0, [r6]"];
    case "div":
      return [...TWO, "SET16 r2, __div", "CALLR r2", "STORE r0, [r6]"];
    case "mod":
      return [...TWO, "SET16 r2, __div", "CALLR r2", "STORE r1, [r6]"];
    case "label":
      return [`${ctx.func}__${c.name}:`];
    case "jump":
      return [`JMP ${ctx.func}__${c.name}`];
    case "jumpif":
    case "jumpifnot":
      return [
        "LOAD r0, [r6]",
        "ADDI r6, 1",
        "TEST r0, r0",
        `${c.op === "jumpif" ? "JNZ" : "JZ"} ${ctx.func}__${c.name}`,
      ];
    case "func": {
      const out = [
        `${c.name}:`,
        "SUBI r6, 1",
        "STORE r7, [r6]",
        "SUBI r6, 1",
        "STORE r5, [r6]",
      ];
      for (let i = 0; i < c.locals; i++)
        out.push("SET r0, 0", "SUBI r6, 1", "STORE r0, [r6]");
      out.push("MOV r5, r6");
      return out;
    }
    case "call":
      return [`SET16 r0, ${c.name}`, "CALLR r0"];
    case "return":
      return [
        "LOAD r0, [r6]",
        `LOAD r7, [r5 + ${ctx.locals + 1}]`,
        `LOAD r1, [r5 + ${ctx.locals}]`,
        "MOV r6, r5",
        `ADDI r6, ${ctx.locals + 1 + ctx.args}`,
        "STORE r0, [r6]",
        "MOV r5, r1",
        "RET",
      ];
  }
  throw new VmError("unknown-command", c.op);
}

export function bootstrap(): string[] {
  return [
    "SET16 r6, 0x4000",
    "MOV r5, r6",
    "SET16 r0, main",
    "CALLR r0",
    "HALT",
  ];
}

export function runtime(): string[] {
  return [
    // r2 = product, r3 = bit mask, r4 = 16 rounds.
    "__mul:",
    "SET r2, 0",
    "SET r3, 1",
    "SET r4, 16",
    "__mul_next:",
    "TEST r1, r3",
    "JZ __mul_zero",
    "ADD r2, r2, r0",
    "__mul_zero:",
    "SHL r0, r0, 1",
    "SHL r3, r3, 1",
    "SUBI r4, 1",
    "JNZ __mul_next",
    "MOV r0, r2",
    "RET",
    // Signed division on the magnitudes; signs kept on the stack.
    "__div:",
    "TEST r1, r1",
    "JNZ __div_ok",
    "MOV r1, r0",
    "SET r0, 0",
    "SUBI r0, 1",
    "RET",
    "__div_ok:",
    "SET r4, 0",
    "TEST r0, r0",
    "JNN __div_apos",
    "SET r2, 0",
    "SUB r0, r2, r0",
    "SET r4, 3",
    "__div_apos:",
    "TEST r1, r1",
    "JNN __div_bpos",
    "SET r2, 0",
    "SUB r1, r2, r1",
    "SET r2, 1",
    "XOR r4, r4, r2",
    "__div_bpos:",
    "SUBI r6, 1",
    "STORE r4, [r6]",
    "SET r2, 0", // quotient
    "SET r3, 0", // remainder
    "SET r4, 16",
    "__div_bit:",
    "SHL r3, r3, 1",
    "TEST r0, r0",
    "JNN __div_nocarry",
    "ADDI r3, 1",
    "__div_nocarry:",
    "SHL r0, r0, 1",
    "SHL r2, r2, 1",
    "CMP r3, r1",
    "JLO __div_small",
    "SUB r3, r3, r1",
    "ADDI r2, 1",
    "__div_small:",
    "SUBI r4, 1",
    "JNZ __div_bit",
    "LOAD r4, [r6]",
    "ADDI r6, 1",
    "SET r0, 1",
    "TEST r4, r0",
    "JZ __div_qpos",
    "SET r0, 0",
    "SUB r2, r0, r2",
    "__div_qpos:",
    "SET r0, 2",
    "TEST r4, r0",
    "JZ __div_rpos",
    "SET r0, 0",
    "SUB r3, r0, r3",
    "__div_rpos:",
    "MOV r0, r2",
    "MOV r1, r3",
    "RET",
  ];
}
