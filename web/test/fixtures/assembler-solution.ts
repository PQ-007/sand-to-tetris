// A complete solution to the assembler workshop, written the way a learner
// would: one TypeScript module exporting the four stages, using the global
// AsmError. Tests only (it proves the workshop is solvable and its tests are
// right); never imported by the site. Spoiler!
import type {
  AsmBody,
  AsmLayout,
  AsmLine,
  AsmOperand,
  AsmPlaced,
  AsmSymbol,
  AsmToken,
} from "../../src/sim/types";

declare class AsmError extends Error {
  constructor(
    code: string,
    message: string,
    args?: Record<string, string>,
    line?: number,
  );
}

// ---- stage 1 -----------------------------------------------------------------

export function tokenize(line: string): AsmToken[] {
  const out: AsmToken[] = [];
  let i = 0;
  const isDigit = (c: string | undefined) => !!c && c >= "0" && c <= "9";
  const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9_]/.test(c);
  const number = (start: number): [number, number] => {
    let end = start;
    while (isWord(line[end])) end++;
    const text = line.slice(start, end);
    const d = text.replace(/_/g, "").toLowerCase();
    let v = NaN;
    if (/^0x[0-9a-f]+$/.test(d)) v = parseInt(d.slice(2), 16);
    else if (/^0b[01]+$/.test(d)) v = parseInt(d.slice(2), 2);
    else if (/^[0-9]+$/.test(d)) v = parseInt(d, 10);
    if (!Number.isFinite(v) || v > 0x7fffffff)
      throw new AsmError("bad-number", `\`${text}\` isn't a number`, { text });
    return [v, end];
  };
  while (i < line.length) {
    const c = line[i]!;
    if (c === ";") break;
    if (/\s/.test(c)) i++;
    else if (c === ",") {
      out.push({ kind: "comma" });
      i++;
    } else if (c === "[") {
      out.push({ kind: "lbracket" });
      i++;
    } else if (c === "]") {
      out.push({ kind: "rbracket" });
      i++;
    } else if (c === "+") {
      out.push({ kind: "plus" });
      i++;
    } else if (c === "-" && isDigit(line[i + 1])) {
      const [v, next] = number(i + 1);
      out.push({ kind: "number", value: -v });
      i = next;
    } else if (isDigit(c)) {
      const [v, next] = number(i);
      out.push({ kind: "number", value: v });
      i = next;
    } else if (c === "'") {
      const ch = line[i + 1];
      if (ch === undefined || line[i + 2] !== "'" || ch < " " || ch > "~")
        throw new AsmError(
          "bad-char",
          "a character is one character in quotes",
          { char: "'" },
        );
      out.push({ kind: "number", value: ch.charCodeAt(0) });
      i += 3;
    } else if (c === ".") {
      let end = i + 1;
      while (end < line.length && /[A-Za-z]/.test(line[end]!)) end++;
      if (end === i + 1)
        throw new AsmError("bad-char", "`.` can't appear here", { char: "." });
      out.push({
        kind: "directive",
        name: line.slice(i + 1, end).toLowerCase(),
      });
      i = end;
    } else if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (isWord(line[i])) i++;
      const text = line.slice(start, i);
      if (line[i] === ":") {
        out.push({ kind: "label", name: text });
        i++;
      } else out.push({ kind: "ident", text });
    } else
      throw new AsmError("bad-char", `\`${c}\` can't appear here`, { char: c });
  }
  return out;
}

// ---- stage 2 -----------------------------------------------------------------

const register = (text: string): number | null =>
  /^[rR][0-7]$/.test(text) ? Number(text[1]) : null;

const expected = (what: string): AsmError =>
  new AsmError("expected", `expected ${what}`, { what });

export function parse(tokens: AsmToken[]): AsmLine {
  let at = 0;
  const line: AsmLine = { label: null, body: null };
  const first = tokens[0];
  if (first?.kind === "label") {
    line.label = first.name;
    at = 1;
  }
  const head = tokens[at++];
  if (!head) return line;
  const operand = (): AsmOperand => {
    const t = tokens[at++];
    if (t?.kind === "number") return { kind: "num", value: t.value };
    if (t?.kind === "ident") {
      const r = register(t.text);
      return r === null
        ? { kind: "sym", name: t.text }
        : { kind: "reg", reg: r };
    }
    if (t?.kind === "lbracket") {
      const rt = tokens[at++];
      const reg = rt?.kind === "ident" ? register(rt.text) : null;
      if (reg === null) throw expected("register");
      let offset: AsmOperand = { kind: "num", value: 0 };
      if (tokens[at]?.kind === "plus") {
        at++;
        const o = tokens[at++];
        if (o?.kind === "number") offset = { kind: "num", value: o.value };
        else if (o?.kind === "ident" && register(o.text) === null)
          offset = { kind: "sym", name: o.text };
        else throw expected("offset");
      }
      const close = tokens[at++];
      if (close?.kind !== "rbracket") throw expected("rbracket");
      return { kind: "mem", reg, offset };
    }
    throw expected("operand");
  };
  const operands = (): AsmOperand[] => {
    const args: AsmOperand[] = [];
    if (at >= tokens.length) return args;
    for (;;) {
      args.push(operand());
      const t = tokens[at++];
      if (!t) return args;
      if (t.kind !== "comma") throw expected("comma");
    }
  };
  if (head.kind === "ident") {
    line.body = {
      kind: "instr",
      mnemonic: head.text.toUpperCase(),
      args: operands(),
    };
  } else if (head.kind === "directive" && head.name === "equ") {
    const n = tokens[at++];
    if (n?.kind !== "ident")
      throw new AsmError("bad-name", "`.equ` needs a name", {});
    const value = operand();
    if (at < tokens.length) throw expected("end");
    line.body = {
      kind: "dir",
      name: "equ",
      args: [{ kind: "sym", name: n.text }, value],
    };
  } else if (head.kind === "directive") {
    line.body = { kind: "dir", name: head.name, args: operands() };
  } else throw expected("instruction");
  return line;
}

// ---- stage 3 -----------------------------------------------------------------

export function layout(lines: AsmLine[]): AsmLayout {
  const symbols: Record<string, AsmSymbol> = {};
  const placedLines: (AsmPlaced | null)[] = [];
  let inData = false;
  let code = 0;
  let data = 0;
  const define = (
    name: string,
    kind: AsmSymbol["kind"],
    value: number,
    n: number,
  ) => {
    if (name in symbols)
      throw new AsmError(
        "duplicate-symbol",
        `\`${name}\` is already defined`,
        { name },
        n,
      );
    symbols[name] = { kind, value };
  };
  const known = (op: AsmOperand | undefined, n: number): number => {
    if (op?.kind === "num") return op.value;
    if (op?.kind === "sym" && op.name in symbols)
      return symbols[op.name]!.value;
    throw new AsmError("unknown-symbol", "not defined above", {}, n);
  };
  const place = (section: "code" | "data", size: number): AsmPlaced => {
    const p = { section, address: section === "code" ? code : data, size };
    if (section === "code") code += size;
    else data += size;
    return p;
  };
  lines.forEach((line, i) => {
    const n = i + 1;
    if (line.label !== null)
      define(line.label, inData ? "data" : "code", inData ? data : code, n);
    const b = line.body;
    if (!b) return placedLines.push(null);
    if (b.kind === "instr") {
      if (inData)
        throw new AsmError(
          "code-in-data",
          "instructions belong in .code",
          {},
          n,
        );
      let size = 1;
      if (b.mnemonic === "SET16") {
        const v = b.args[1];
        const k =
          v?.kind === "num"
            ? v.value
            : v?.kind === "sym" && symbols[v.name]?.kind === "const"
              ? symbols[v.name]!.value
              : null;
        size = k !== null && k >= 0 && k <= 255 ? 1 : 2;
      }
      return placedLines.push(place("code", size));
    }
    switch (b.name) {
      case "code":
      case "data":
        inData = b.name === "data";
        return placedLines.push(null);
      case "equ":
        define(
          (b.args[0] as { name: string }).name,
          "const",
          known(b.args[1], n),
          n,
        );
        return placedLines.push(null);
      case "word":
      case "space": {
        if (!inData)
          throw new AsmError("data-in-code", "data belongs after .data", {}, n);
        if (b.name === "word")
          return placedLines.push(place("data", b.args.length));
        if (b.args.length !== 1)
          throw new AsmError("operand-count", ".space takes 1", {}, n);
        const size = known(b.args[0], n);
        if (size < 0 || size > 16384)
          throw new AsmError("out-of-range", "0..16384", {}, n);
        return placedLines.push(place("data", size));
      }
      default:
        throw new AsmError("unknown-directive", `\`.${b.name}\``, {}, n);
    }
  });
  return { symbols, lines: placedLines };
}

// ---- stage 4 -----------------------------------------------------------------

const ALU: Record<string, [number, number, number]> = {
  ADD: [0, 0, 0],
  SUB: [0, 1, 1],
  AND: [1, 0, 0],
  ANDN: [1, 1, 0],
  OR: [2, 0, 0],
  ORN: [2, 1, 0],
  XOR: [3, 0, 0],
  XORN: [3, 1, 0],
};
const JUMPS: Record<string, number> = {
  JMP: 0,
  JZ: 1,
  JEQ: 1,
  JNZ: 2,
  JNE: 2,
  JN: 3,
  JNN: 4,
  JC: 5,
  JHS: 5,
  JNC: 6,
  JLO: 6,
  JHI: 7,
};

export function encode(
  body: AsmBody,
  symbols: Record<string, AsmSymbol>,
  placed: AsmPlaced,
): number[] {
  const value = (op: AsmOperand | undefined): number => {
    if (op?.kind === "num") return op.value;
    if (op?.kind === "sym") {
      const s = symbols[op.name];
      if (!s)
        throw new AsmError("unknown-symbol", `\`${op.name}\` isn't defined`);
      return s.value;
    }
    throw new AsmError("bad-operand", "expected a number");
  };
  const ranged = (op: AsmOperand | undefined, lo: number, hi: number) => {
    const v = value(op);
    if (v < lo || v > hi)
      throw new AsmError("out-of-range", `${v} must be ${lo}..${hi}`);
    return v;
  };
  if (body.kind === "dir")
    return body.name === "word"
      ? body.args.map((a) => ranged(a, -32768, 65535) & 0xffff)
      : new Array<number>(placed.size).fill(0);
  const m = body.mnemonic;
  const a = body.args;
  const count = (n: number) => {
    if (a.length !== n) throw new AsmError("operand-count", `${m} takes ${n}`);
  };
  const reg = (op: AsmOperand | undefined): number => {
    if (op?.kind !== "reg")
      throw new AsmError("not-a-register", "expected a register");
    return op.reg;
  };
  const mem = (op: AsmOperand | undefined): [number, number] => {
    if (op?.kind !== "mem")
      throw new AsmError("bad-operand", "expected [rA + n]");
    return [op.reg, ranged(op.offset, 0, 127)];
  };
  const target = (
    op: AsmOperand | undefined,
    lo: number,
    hi: number,
  ): number => {
    if (op?.kind === "sym") {
      const s = symbols[op.name];
      if (s?.kind === "data")
        throw new AsmError("jump-to-data", "a data address");
      if (s?.kind === "code") {
        const d = s.value - placed.address;
        if (d < lo || d > hi) throw new AsmError("jump-too-far", "too far");
        return d;
      }
    }
    return ranged(op, lo, hi);
  };
  const alu = (
    rd: number,
    ra: number,
    rb: number,
    f: number,
    invb: number,
    cin: number,
  ) => (rd << 10) | (ra << 7) | (rb << 4) | (f << 2) | (invb << 1) | cin;
  const imm = (k: number, rd: number, n: number) =>
    (2 << 13) | (rd << 10) | (k << 8) | (n & 0xff);
  const jump = (cond: number, off: number) =>
    (6 << 13) | (cond << 10) | (off & 0x3ff);

  if (m in ALU) {
    count(3);
    const [f, invb, cin] = ALU[m]!;
    return [alu(reg(a[0]), reg(a[1]), reg(a[2]), f, invb, cin)];
  }
  if (m in JUMPS) {
    count(1);
    return [jump(JUMPS[m]!, target(a[0], -512, 511))];
  }
  switch (m) {
    case "ALU":
      count(6);
      return [
        alu(
          reg(a[0]),
          reg(a[1]),
          reg(a[2]),
          ranged(a[3], 0, 3),
          ranged(a[4], 0, 1),
          ranged(a[5], 0, 1),
        ),
      ];
    case "MOV": {
      count(2);
      const ra = reg(a[1]);
      return [alu(reg(a[0]), ra, ra, 2, 0, 0)];
    }
    case "CMP":
    case "TEST": {
      if (m === "CMP" && a.length === 5)
        return [
          (1 << 13) |
            alu(
              0,
              reg(a[0]),
              reg(a[1]),
              ranged(a[2], 0, 3),
              ranged(a[3], 0, 1),
              ranged(a[4], 0, 1),
            ),
        ];
      count(2);
      const [f, invb, cin] = m === "CMP" ? [0, 1, 1] : [1, 0, 0];
      return [(1 << 13) | alu(0, reg(a[0]), reg(a[1]), f, invb, cin)];
    }
    case "SET":
    case "SETH":
    case "ADDI":
    case "SUBI":
      count(2);
      return [
        imm(
          ["SET", "SETH", "ADDI", "SUBI"].indexOf(m),
          reg(a[0]),
          ranged(a[1], 0, 255),
        ),
      ];
    case "INC":
    case "DEC":
      count(1);
      return [imm(m === "INC" ? 2 : 3, reg(a[0]), 1)];
    case "SET16": {
      count(2);
      const rd = reg(a[0]);
      const v = ranged(a[1], -32768, 65535) & 0xffff;
      return placed.size === 1
        ? [imm(0, rd, v)]
        : [imm(0, rd, v), imm(1, rd, v >> 8)];
    }
    case "SHL":
    case "SHR":
    case "SAR": {
      count(3);
      const dir = m === "SHL" ? 0 : m === "SHR" ? 2 : 3;
      const by =
        a[2]?.kind === "reg" ? (1 << 6) | a[2].reg : ranged(a[2], 0, 15);
      return [
        (3 << 13) | (reg(a[0]) << 10) | (reg(a[1]) << 7) | (dir << 4) | by,
      ];
    }
    case "LOAD":
    case "STORE": {
      count(2);
      const r = reg(a[0]);
      const [ra, off] = mem(a[1]);
      return [((m === "LOAD" ? 4 : 5) << 13) | (r << 10) | (ra << 7) | off];
    }
    case "CALL":
      count(1);
      return [(7 << 13) | (target(a[0], -2048, 2047) & 0xfff)];
    case "JR":
    case "CALLR":
      count(1);
      return [
        (7 << 13) |
          (1 << 12) |
          ((m === "CALLR" ? 1 : 0) << 11) |
          (reg(a[0]) << 8),
      ];
    case "RET":
      count(0);
      return [(7 << 13) | (1 << 12) | (7 << 8)];
    case "NOP":
      count(0);
      return [jump(0, 1)];
    case "HALT":
      count(0);
      return [jump(0, 0)];
    default:
      throw new AsmError("unknown-mnemonic", `\`${m}\` isn't an instruction`);
  }
}
