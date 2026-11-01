// A complete C Shard compiler, written as a learner might (tests only:
// never bundled). It must pass every test of the compiler workshop.

type Token =
  | { kind: "num"; value: number; line: number }
  | { kind: "str"; text: string; line: number }
  | { kind: "name"; text: string; line: number }
  | { kind: "kw"; text: string; line: number }
  | { kind: "sym"; text: string; line: number };

type Type =
  | { kind: "int" }
  | { kind: "bool" }
  | { kind: "array"; elem: Type; size: Expr | null };

type Expr =
  | { kind: "num"; value: number; line: number }
  | { kind: "bool"; value: boolean; line: number }
  | { kind: "str"; text: string; line: number }
  | { kind: "array"; items: Expr[]; line: number }
  | { kind: "name"; name: string; line: number }
  | { kind: "index"; name: string; index: Expr; line: number }
  | { kind: "mem"; addr: Expr; line: number }
  | { kind: "call"; name: string; args: Expr[]; line: number }
  | { kind: "unary"; op: string; operand: Expr; line: number }
  | { kind: "binary"; op: string; left: Expr; right: Expr; line: number };

type Stmt =
  | { kind: "var"; name: string; type: Type | null; value: Expr; line: number }
  | { kind: "assign"; target: Expr; value: Expr; line: number }
  | {
      kind: "if";
      cond: Expr;
      then: Stmt[];
      else: Stmt[] | null;
      line: number;
    }
  | { kind: "while"; cond: Expr; body: Stmt[]; line: number }
  | {
      kind: "for";
      var: string;
      from: Expr;
      to: Expr;
      body: Stmt[];
      line: number;
    }
  | { kind: "break"; line: number }
  | { kind: "continue"; line: number }
  | { kind: "return"; value: Expr | null; line: number }
  | { kind: "expr"; expr: Expr; line: number };

type Item =
  | {
      kind: "fn";
      name: string;
      params: { name: string; type: Type }[];
      result: Type | null;
      body: Stmt[];
      line: number;
    }
  | {
      kind: "var";
      name: string;
      type: Type | null;
      value: Expr | null;
      line: number;
    }
  | {
      kind: "const";
      name: string;
      type: Type | null;
      value: Expr;
      line: number;
    };

interface Program {
  items: Item[];
}

interface Info {
  globals: Record<
    string,
    { index: number; size: number; array: boolean; init: number[] }
  >;
  consts: Record<string, number>;
  functions: Record<
    string,
    {
      params: string[];
      result: boolean;
      locals: Record<string, number>;
      count: number;
    }
  >;
}

declare class CompileError extends Error {
  constructor(
    code: string,
    message: string,
    args?: Record<string, string>,
    line?: number,
  );
}

// ---- 1. tokenize ------------------------------------------------------------------

const KEYWORDS = new Set(
  "fn var const if else while for in break continue return and or not true false int bool mem".split(
    " ",
  ),
);
const TWO = ["->", "..", "<<", ">>", "==", "!=", "<=", ">="];
const ONE = "(){}[],;:=+-*/%&|^~<>";

function escapeOf(c: string | undefined): number | null {
  if (c === "'" || c === '"' || c === "\\") return c.charCodeAt(0);
  if (c === "n") return 10;
  return null;
}

const printable = (c: string | undefined) =>
  c !== undefined && c >= " " && c <= "~";

export function tokenize(source: string): Token[] {
  const out: Token[] = [];
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const c = source[i]!;
    if (c === "\n") {
      line++;
      i++;
    } else if (/\s/.test(c)) i++;
    else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j++;
      const text = source.slice(i, j);
      out.push({ kind: KEYWORDS.has(text) ? "kw" : "name", text, line });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j++;
      const text = source.slice(i, j);
      const v = parseNumber(text);
      if (v === null)
        throw new CompileError(
          "bad-number",
          `${text} isn't a number from 0 to 65535`,
          { text },
          line,
        );
      out.push({ kind: "num", value: v, line });
      i = j;
    } else if (c === "'") {
      let value: number | null = null;
      let len = 0;
      if (source[i + 1] === "\\" && source[i + 3] === "'") {
        value = escapeOf(source[i + 2]);
        len = 4;
      } else if (
        source[i + 2] === "'" &&
        printable(source[i + 1]) &&
        source[i + 1] !== "'" &&
        source[i + 1] !== "\\"
      ) {
        value = source.charCodeAt(i + 1);
        len = 3;
      }
      if (value === null)
        throw new CompileError("bad-char-literal", "bad character", {}, line);
      out.push({ kind: "num", value, line });
      i += len;
    } else if (c === '"') {
      let text = "";
      let j = i + 1;
      for (;;) {
        const d = source[j];
        if (d === '"') break;
        if (d === "\\") {
          const v = escapeOf(source[j + 1]);
          if (v === null)
            throw new CompileError("bad-string", "bad string", {}, line);
          text += String.fromCharCode(v);
          j += 2;
        } else if (printable(d)) {
          text += d;
          j++;
        } else throw new CompileError("bad-string", "bad string", {}, line);
      }
      out.push({ kind: "str", text, line });
      i = j + 1;
    } else if (TWO.includes(source.slice(i, i + 2))) {
      out.push({ kind: "sym", text: source.slice(i, i + 2), line });
      i += 2;
    } else if (ONE.includes(c)) {
      out.push({ kind: "sym", text: c, line });
      i++;
    } else
      throw new CompileError("bad-char", `${c} can't appear here`, {}, line);
  }
  return out;
}

function parseNumber(text: string): number | null {
  const low = text.toLowerCase();
  let base = 10;
  let digits = low;
  if (low.startsWith("0x")) {
    base = 16;
    digits = low.slice(2);
  } else if (low.startsWith("0b")) {
    base = 2;
    digits = low.slice(2);
  }
  const ok =
    base === 16 ? /^[0-9a-f_]+$/ : base === 2 ? /^[01_]+$/ : /^[0-9_]+$/;
  if (
    !digits ||
    !ok.test(digits) ||
    digits.startsWith("_") ||
    digits.endsWith("_") ||
    digits.includes("__")
  )
    return null;
  const v = parseInt(digits.replace(/_/g, ""), base);
  return v > 65535 ? null : v;
}

// ---- 2. parse ------------------------------------------------------------------------

export function parse(tokens: Token[]): Program {
  let i = 0;
  const peek = () => tokens[i];
  const lineNow = () => (tokens[i] ?? tokens[tokens.length - 1])?.line ?? 1;
  const text = (t: Token | undefined) =>
    !t
      ? "the end"
      : t.kind === "num"
        ? String(t.value)
        : t.kind === "str"
          ? `"${t.text}"`
          : t.text;
  const isSym = (s: string) => {
    const t = peek();
    return t?.kind === "sym" && t.text === s;
  };
  const isKw = (s: string) => {
    const t = peek();
    return t?.kind === "kw" && t.text === s;
  };
  const fail = (what: string): never => {
    throw new CompileError(
      "expected",
      `expected ${what}, found ${text(peek())}`,
      { what, found: text(peek()) },
      lineNow(),
    );
  };
  const sym = (s: string) => (isSym(s) ? void i++ : fail(`\`${s}\``));
  const kw = (s: string) => (isKw(s) ? void i++ : fail(`\`${s}\``));
  const eat = (s: string) => (isSym(s) ? (i++, true) : false);
  const name = (): string => {
    const t = peek();
    if (t?.kind !== "name") return fail("name");
    i++;
    return t.text;
  };

  function type(): Type {
    if (isKw("int") || isKw("bool")) {
      const k = (peek() as { text: "int" | "bool" }).text;
      i++;
      return { kind: k };
    }
    if (eat("[")) {
      if (!isKw("int") && !isKw("bool")) fail("type");
      const elem = type();
      const size = eat(";") ? expr() : null;
      sym("]");
      return { kind: "array", elem, size };
    }
    return fail("type");
  }

  function block(): Stmt[] {
    sym("{");
    const out: Stmt[] = [];
    while (!isSym("}")) {
      if (!peek()) fail("`}`");
      out.push(stmt());
    }
    i++;
    return out;
  }

  function ifStmt(): Stmt {
    const line = lineNow();
    kw("if");
    const cond = expr();
    const then = block();
    let otherwise: Stmt[] | null = null;
    if (isKw("else")) {
      i++;
      otherwise = isKw("if") ? [ifStmt()] : block();
    }
    return { kind: "if", cond, then, else: otherwise, line };
  }

  function stmt(): Stmt {
    const line = lineNow();
    if (isKw("var")) {
      i++;
      const n = name();
      const t = eat(":") ? type() : null;
      sym("=");
      const value = expr();
      sym(";");
      return { kind: "var", name: n, type: t, value, line };
    }
    if (isKw("if")) return ifStmt();
    if (isKw("while")) {
      i++;
      const cond = expr();
      return { kind: "while", cond, body: block(), line };
    }
    if (isKw("for")) {
      i++;
      const v = name();
      kw("in");
      const from = expr();
      sym("..");
      const to = expr();
      return { kind: "for", var: v, from, to, body: block(), line };
    }
    if (isKw("break") || isKw("continue")) {
      const k = (peek() as { text: "break" | "continue" }).text;
      i++;
      sym(";");
      return { kind: k, line };
    }
    if (isKw("return")) {
      i++;
      const value = isSym(";") ? null : expr();
      sym(";");
      return { kind: "return", value, line };
    }
    if (!peek()) fail("statement");
    const target = expr();
    if (eat("=")) {
      const value = expr();
      sym(";");
      return { kind: "assign", target, value, line };
    }
    sym(";");
    return { kind: "expr", expr: target, line };
  }

  // Precedence levels, loosest first.
  const LEVELS: { ops: string[]; kw: boolean }[] = [
    { ops: ["or"], kw: true },
    { ops: ["and"], kw: true },
  ];
  const BITS: string[][] = [
    ["|"],
    ["^"],
    ["&"],
    ["<<", ">>"],
    ["+", "-"],
    ["*", "/", "%"],
  ];

  function opHere(ops: string[], isKeyword: boolean): string | null {
    const t = peek();
    if (!t) return null;
    if (t.kind !== (isKeyword ? "kw" : "sym")) return null;
    const text = (t as { text: string }).text;
    return ops.includes(text) ? text : null;
  }

  function leveled(n: number): Expr {
    if (n === LEVELS.length) return notExpr();
    const { ops, kw: k } = LEVELS[n]!;
    let left = leveled(n + 1);
    for (;;) {
      const line = lineNow();
      const op = opHere(ops, k);
      if (!op) return left;
      i++;
      left = { kind: "binary", op, left, right: leveled(n + 1), line };
    }
  }

  function notExpr(): Expr {
    if (isKw("not")) {
      const line = lineNow();
      i++;
      return { kind: "unary", op: "not", operand: notExpr(), line };
    }
    const CMP = ["==", "!=", "<", "<=", ">", ">="];
    const left = bits(0);
    const op = opHere(CMP, false);
    if (!op) return left;
    const line = lineNow();
    i++;
    const right = bits(0);
    if (opHere(CMP, false))
      throw new CompileError(
        "chained-comparison",
        "comparisons don't chain",
        {},
        lineNow(),
      );
    return { kind: "binary", op, left, right, line };
  }

  function bits(n: number): Expr {
    if (n === BITS.length) return unary();
    let left = bits(n + 1);
    for (;;) {
      const line = lineNow();
      const op = opHere(BITS[n]!, false);
      if (!op) return left;
      i++;
      left = { kind: "binary", op, left, right: bits(n + 1), line };
    }
  }

  function unary(): Expr {
    if (isSym("-") || isSym("~")) {
      const line = lineNow();
      const op = (peek() as { text: string }).text;
      i++;
      return { kind: "unary", op, operand: unary(), line };
    }
    return primary();
  }

  function list(close: string): Expr[] {
    const items: Expr[] = [];
    if (!isSym(close)) {
      do items.push(expr());
      while (eat(","));
    }
    sym(close);
    return items;
  }

  function primary(): Expr {
    const line = lineNow();
    const t = peek();
    if (t?.kind === "num") {
      i++;
      return { kind: "num", value: t.value, line };
    }
    if (t?.kind === "str") {
      i++;
      return { kind: "str", text: t.text, line };
    }
    if (t?.kind === "kw" && (t.text === "true" || t.text === "false")) {
      i++;
      return { kind: "bool", value: t.text === "true", line };
    }
    if (t?.kind === "kw" && t.text === "mem") {
      i++;
      sym("[");
      const addr = expr();
      sym("]");
      return { kind: "mem", addr, line };
    }
    if (isSym("(")) {
      i++;
      const e = expr();
      sym(")");
      return e;
    }
    if (isSym("[")) {
      i++;
      return { kind: "array", items: list("]"), line };
    }
    if (t?.kind === "name") {
      i++;
      if (eat("("))
        return { kind: "call", name: t.text, args: list(")"), line };
      if (eat("[")) {
        const index = expr();
        sym("]");
        return { kind: "index", name: t.text, index, line };
      }
      return { kind: "name", name: t.text, line };
    }
    return fail("expression");
  }

  const expr = (): Expr => leveled(0);

  const items: Item[] = [];
  while (peek()) {
    const line = lineNow();
    if (isKw("fn")) {
      i++;
      const n = name();
      sym("(");
      const params: { name: string; type: Type }[] = [];
      if (!isSym(")")) {
        do {
          const p = name();
          sym(":");
          params.push({ name: p, type: type() });
        } while (eat(","));
      }
      sym(")");
      const result = eat("->") ? type() : null;
      items.push({ kind: "fn", name: n, params, result, body: block(), line });
    } else if (isKw("var") || isKw("const")) {
      const isConst = isKw("const");
      i++;
      const n = name();
      const t = eat(":") ? type() : null;
      let value: Expr | null = null;
      if (isConst) {
        sym("=");
        value = expr();
      } else if (eat("=")) value = expr();
      sym(";");
      items.push(
        isConst
          ? { kind: "const", name: n, type: t, value: value!, line }
          : { kind: "var", name: n, type: t, value, line },
      );
    } else fail("declaration");
  }
  return { items };
}

// ---- 3. check ------------------------------------------------------------------------

type T =
  | { k: "int" }
  | { k: "bool" }
  | { k: "arr"; e: T; n: number }
  | { k: "ref"; e: T }
  | { k: "nothing" };

const INT: T = { k: "int" };
const BOOL: T = { k: "bool" };
const NOTHING: T = { k: "nothing" };

function show(t: T): string {
  return t.k === "arr"
    ? `[${show(t.e)}; ${t.n}]`
    : t.k === "ref"
      ? `[${show(t.e)}]`
      : t.k;
}

const same = (a: T, b: T) => show(a) === show(b);
const fits = (from: T, to: T) =>
  to.k === "ref" && (from.k === "arr" || from.k === "ref")
    ? same(from.e, to.e)
    : same(from, to);

type CVal = { t: T; words: number[] };

class Problems {
  list: {
    line: number;
    code: string;
    message: string;
    args: Record<string, string>;
  }[] = [];
  add(
    line: number,
    code: string,
    message: string,
    args: Record<string, string> = {},
  ) {
    this.list.push({ line, code, message, args });
  }
  mismatch(line: number, want: T, got: T) {
    this.add(
      line,
      "type-mismatch",
      `expected ${show(want)}, found ${show(got)}`,
      {
        expected: show(want),
        found: show(got),
      },
    );
  }
}

export function check(program: Program): Info {
  const p = new Problems();
  const items = new Map<string, Item>();
  for (const it of program.items) {
    if (it.name.startsWith("_")) p.add(it.line, "reserved-name", it.name);
    else if (items.has(it.name)) p.add(it.line, "duplicate-name", it.name);
    else items.set(it.name, it);
  }

  // Constants, worked out once.
  const consts = new Map<string, CVal>();
  const busy = new Set<string>();
  const constant = (name: string): CVal | null => {
    const known = consts.get(name);
    if (known) return known;
    const it = items.get(name);
    if (it?.kind !== "const") return null;
    if (busy.has(name)) {
      p.add(it.line, "not-constant", "defined by itself");
      return null;
    }
    busy.add(name);
    const v = evalConst(it.value);
    busy.delete(name);
    if (v) consts.set(name, v);
    return v;
  };

  function evalConst(e: Expr): CVal | null {
    const int = (x: Expr): number | null => {
      const v = evalConst(x);
      if (!v) return null;
      if (v.t.k !== "int") {
        p.mismatch(x.line, INT, v.t);
        return null;
      }
      return v.words[0]!;
    };
    const bool = (x: Expr): boolean | null => {
      const v = evalConst(x);
      if (!v) return null;
      if (v.t.k !== "bool") {
        p.mismatch(x.line, BOOL, v.t);
        return null;
      }
      return v.words[0] !== 0;
    };
    const I = (v: number): CVal => ({ t: INT, words: [v & 0xffff] });
    const B = (v: boolean): CVal => ({ t: BOOL, words: [v ? 0xffff : 0] });
    const s16 = (v: number) => (v << 16) >> 16;
    switch (e.kind) {
      case "num":
        return I(e.value);
      case "bool":
        return B(e.value);
      case "str":
        return {
          t: { k: "arr", e: INT, n: e.text.length },
          words: [...e.text].map((c) => c.charCodeAt(0)),
        };
      case "array": {
        let elem: T | null = null;
        const words: number[] = [];
        for (const it of e.items) {
          const v = evalConst(it);
          if (!v) return null;
          if (v.t.k !== "int" && v.t.k !== "bool") {
            p.mismatch(it.line, INT, v.t);
            return null;
          }
          if (elem && !same(elem, v.t)) {
            p.mismatch(it.line, elem, v.t);
            return null;
          }
          elem = v.t;
          words.push(...v.words);
        }
        if (!words.length) {
          p.add(e.line, "bad-array-size", "empty", { max: "4096" });
          return null;
        }
        return { t: { k: "arr", e: elem ?? INT, n: words.length }, words };
      }
      case "name": {
        const it = items.get(e.name);
        if (it?.kind === "const") return constant(e.name);
        if (it) p.add(e.line, "not-constant", "not a constant");
        else p.add(e.line, "unknown-name", e.name, { name: e.name });
        return null;
      }
      case "unary":
        if (e.op === "not") {
          const b = bool(e.operand);
          return b === null ? null : B(!b);
        } else {
          const v = int(e.operand);
          return v === null ? null : I(e.op === "-" ? -v : ~v);
        }
      case "binary": {
        if (e.op === "and" || e.op === "or") {
          const a = bool(e.left);
          const b = bool(e.right);
          if (a === null || b === null) return null;
          return B(e.op === "and" ? a && b : a || b);
        }
        if (e.op === "==" || e.op === "!=") {
          const a = evalConst(e.left);
          const b = evalConst(e.right);
          if (!a || !b) return null;
          if (!same(a.t, b.t) || a.t.k === "arr") {
            p.mismatch(e.line, a.t, b.t);
            return null;
          }
          return B((a.words[0] === b.words[0]) === (e.op === "=="));
        }
        const a = int(e.left);
        const b = int(e.right);
        if (a === null || b === null) return null;
        const [sa, sb] = [s16(a), s16(b)];
        switch (e.op) {
          case "<":
            return B(sa < sb);
          case "<=":
            return B(sa <= sb);
          case ">":
            return B(sa > sb);
          case ">=":
            return B(sa >= sb);
          case "+":
            return I(a + b);
          case "-":
            return I(a - b);
          case "*":
            return I(Math.imul(a, b));
          case "/":
            return I(b === 0 ? -1 : Math.trunc(sa / sb));
          case "%":
            return I(b === 0 ? a : sa % sb);
          case "&":
            return I(a & b);
          case "|":
            return I(a | b);
          case "^":
            return I(a ^ b);
          case "<<":
            return I(a << (b & 15));
          default:
            return I(a >>> (b & 15));
        }
      }
      default:
        p.add(e.line, "not-constant", "not a constant");
        return null;
    }
  }

  function typeOf(t: Type, param: boolean): T | null {
    if (t.kind === "int") return INT;
    if (t.kind === "bool") return BOOL;
    const e = typeOf(t.elem, false);
    if (!e) return null;
    if (!t.size) return { k: "ref", e };
    const v = evalConst(t.size);
    if (!v) return null;
    const n = (v.words[0]! << 16) >> 16;
    if (v.t.k !== "int" || n < 1 || n > 4096) {
      p.add(t.size.line, "bad-array-size", "bad size", { max: "4096" });
      return null;
    }
    if (param) {
      p.mismatch(t.size.line, { k: "ref", e }, { k: "arr", e, n });
      return null;
    }
    return { k: "arr", e, n };
  }

  const check1 = (found: T, want: T, line: number) => {
    if (
      found.k === "arr" &&
      want.k === "arr" &&
      same(found.e, want.e) &&
      found.n !== want.n
    )
      p.add(line, "array-length", "length", {
        found: String(found.n),
        expected: String(want.n),
      });
    else if (!fits(found, want)) p.mismatch(line, want, found);
  };

  const info: Info = { globals: {}, consts: {}, functions: {} };
  type G =
    | { kind: "var" | "constArr"; t: T }
    | { kind: "const"; v: CVal }
    | { kind: "fn"; params: T[]; result: T };
  const globals = new Map<string, G>();
  let next = 0;
  for (const it of program.items) {
    if (items.get(it.name) !== it) continue;
    if (it.kind === "const") {
      const v = constant(it.name);
      if (!v) continue;
      if (it.type) {
        const want = typeOf(it.type, false);
        if (want) check1(v.t, want, it.line);
      }
      if (v.t.k === "arr") {
        info.globals[it.name] = {
          index: next,
          size: v.words.length,
          array: true,
          init: v.words,
        };
        next += v.words.length;
        globals.set(it.name, { kind: "constArr", t: v.t });
      } else {
        info.consts[it.name] = v.words[0]!;
        globals.set(it.name, { kind: "const", v });
      }
    } else if (it.kind === "var") {
      const declared = it.type ? typeOf(it.type, false) : null;
      const start = it.value ? evalConst(it.value) : null;
      let t: T;
      if (declared && start) {
        check1(start.t, declared, it.line);
        t = declared;
      } else if (declared && !it.value) t = declared;
      else if (!it.type && start) t = start.t;
      else if (!it.type && !it.value) {
        p.add(it.line, "missing-type", it.name, { name: it.name });
        continue;
      } else continue;
      if (t.k === "ref") {
        p.mismatch(it.line, { k: "arr", e: t.e, n: 0 }, t);
        continue;
      }
      const size = t.k === "arr" ? t.n : 1;
      info.globals[it.name] = {
        index: next,
        size,
        array: t.k === "arr",
        init: start && start.words.some((w) => w !== 0) ? start.words : [],
      };
      next += size;
      globals.set(it.name, { kind: "var", t });
    }
  }
  if (next > 4096) {
    const last = program.items[program.items.length - 1];
    p.add(last?.line ?? 0, "too-many-globals", "too many", {
      words: String(next),
      max: "4096",
    });
  }
  for (const it of program.items) {
    if (it.kind !== "fn" || items.get(it.name) !== it) continue;
    const params = it.params.map((x) => typeOf(x.type, true) ?? INT);
    let result: T = NOTHING;
    if (it.result) {
      const r = typeOf(it.result, false);
      if (r && r.k !== "int" && r.k !== "bool") {
        p.mismatch(it.line, INT, r);
        result = INT;
      } else result = r ?? INT;
    }
    globals.set(it.name, { kind: "fn", params, result });
  }
  const main = items.get("main");
  if (main?.kind !== "fn") p.add(0, "no-main", "no main");
  else if (main.params.length || (main.result && main.result.kind !== "int"))
    p.add(main.line, "main-signature", "bad main");

  for (const it of program.items) {
    if (it.kind !== "fn") continue;
    const g = globals.get(it.name);
    if (g?.kind !== "fn" || items.get(it.name) !== it) continue;
    const sig = g;
    const scopes: Map<string, T>[] = [new Map()];
    const declared = new Set<string>();
    const locals: Record<string, number> = {};
    let count = 0;
    let loops = 0;
    const declare = (name: string, line: number) => {
      if (name.startsWith("_")) p.add(line, "reserved-name", name);
      else if (declared.has(name) || items.has(name))
        p.add(line, "duplicate-name", name);
      else {
        declared.add(name);
        return true;
      }
      return false;
    };
    const local = (name: string, t: T, line: number, hidden: number) => {
      if (declare(name, line)) {
        locals[name] = count;
        scopes[scopes.length - 1]!.set(name, t);
      }
      count += 1 + hidden;
    };
    const lookup = (name: string): T | undefined => {
      for (let s = scopes.length - 1; s >= 0; s--) {
        const t = scopes[s]!.get(name);
        if (t) return t;
      }
      return undefined;
    };
    it.params.forEach((x, k) => {
      if (declare(x.name, it.line)) scopes[0]!.set(x.name, sig.params[k]!);
    });

    const want = (e: Expr, t: T) => {
      const got = expr(e);
      if (got && !fits(got, t)) p.mismatch(e.line, t, got);
    };

    function expr(e: Expr): T | null {
      switch (e.kind) {
        case "num":
          return INT;
        case "bool":
          return BOOL;
        case "str":
        case "array":
          p.add(e.line, "not-a-value", "array value");
          return null;
        case "name": {
          const l = lookup(e.name);
          if (l) return l;
          const g = globals.get(e.name);
          if (g?.kind === "var" || g?.kind === "constArr") return g.t;
          if (g?.kind === "const") return g.v.t;
          if (g?.kind === "fn") {
            p.add(e.line, "not-a-value", "function");
            return null;
          }
          if (items.has(e.name)) return null;
          p.add(e.line, "unknown-name", e.name, { name: e.name });
          return null;
        }
        case "index": {
          want(e.index, INT);
          const a = expr({ kind: "name", name: e.name, line: e.line });
          if (!a) return null;
          if (a.k === "arr" || a.k === "ref") return a.e;
          p.add(e.line, "not-an-array", e.name, { name: e.name });
          return null;
        }
        case "mem":
          want(e.addr, INT);
          return INT;
        case "call": {
          const local = lookup(e.name);
          const g = globals.get(e.name);
          if (local || g?.kind !== "fn") {
            for (const a of e.args) expr(a);
            const item = items.get(e.name);
            if (local || (item && item.kind !== "fn"))
              p.add(e.line, "not-a-function", e.name);
            else if (!item) p.add(e.line, "unknown-name", e.name);
            return null;
          }
          if (e.args.length !== g.params.length) {
            p.add(e.line, "arg-count", e.name);
            for (const a of e.args) expr(a);
          } else e.args.forEach((a, k) => want(a, g.params[k]!));
          return g.result;
        }
        case "unary": {
          const t = e.op === "not" ? BOOL : INT;
          want(e.operand, t);
          return t;
        }
        case "binary": {
          if (e.op === "and" || e.op === "or") {
            want(e.left, BOOL);
            want(e.right, BOOL);
            return BOOL;
          }
          if (e.op === "==" || e.op === "!=") {
            const a = expr(e.left);
            const b = expr(e.right);
            if (!a || !b) return null;
            if (a.k !== "int" && a.k !== "bool")
              p.mismatch(e.left.line, INT, a);
            else if (!same(a, b)) p.mismatch(e.right.line, a, b);
            return BOOL;
          }
          want(e.left, INT);
          want(e.right, INT);
          return ["<", "<=", ">", ">="].includes(e.op) ? BOOL : INT;
        }
      }
    }

    function block(body: Stmt[]) {
      scopes.push(new Map());
      for (const s of body) stmt(s);
      scopes.pop();
    }

    function stmt(s: Stmt) {
      switch (s.kind) {
        case "var": {
          const found = expr(s.value);
          const d = s.type ? typeOf(s.type, true) : null;
          let t: T = INT;
          if (d) {
            if (found && !fits(found, d)) p.mismatch(s.value.line, d, found);
            t = d;
          } else if (found?.k === "arr") t = { k: "ref", e: found.e };
          else if (found?.k === "nothing")
            p.mismatch(s.value.line, INT, NOTHING);
          else if (found) t = found;
          local(s.name, t, s.line, 0);
          break;
        }
        case "assign": {
          let t: T | null = null;
          const target = s.target;
          if (target.kind === "name") {
            const l = lookup(target.name);
            if (l) t = l.k === "arr" ? null : l;
            else {
              const g = globals.get(target.name);
              if (g?.kind === "var" && (g.t.k === "int" || g.t.k === "bool"))
                t = g.t;
              else if (!g && !items.has(target.name)) {
                p.add(s.line, "unknown-name", target.name);
                expr(s.value);
                return;
              }
            }
          } else if (target.kind === "index") {
            const constArr =
              !lookup(target.name) &&
              globals.get(target.name)?.kind === "constArr";
            t = constArr ? null : expr(target);
          } else if (target.kind === "mem") t = expr(target);
          if (t) want(s.value, t);
          else {
            p.add(s.line, "not-assignable", "can't assign");
            expr(s.value);
          }
          break;
        }
        case "if":
          want(s.cond, BOOL);
          block(s.then);
          if (s.else) block(s.else);
          break;
        case "while":
          want(s.cond, BOOL);
          loops++;
          block(s.body);
          loops--;
          break;
        case "for":
          want(s.from, INT);
          want(s.to, INT);
          scopes.push(new Map());
          local(s.var, INT, s.line, 1);
          loops++;
          block(s.body);
          loops--;
          scopes.pop();
          break;
        case "break":
        case "continue":
          if (!loops) p.add(s.line, "break-outside-loop", "not in a loop");
          break;
        case "return":
          if (!s.value) {
            if (sig.result.k !== "nothing")
              p.mismatch(s.line, sig.result, NOTHING);
          } else want(s.value, sig.result);
          break;
        case "expr":
          if (s.expr.kind === "call") expr(s.expr);
          else p.add(s.line, "call-not-statement", "does nothing");
      }
    }

    block(it.body);
    const returns = (body: Stmt[]): boolean => {
      const last = body[body.length - 1];
      return (
        last?.kind === "return" ||
        (last?.kind === "if" &&
          !!last.else &&
          returns(last.then) &&
          returns(last.else))
      );
    };
    if (sig.result.k !== "nothing" && !returns(it.body))
      p.add(it.line, "missing-return", it.name);
    if (it.params.length + count > 126)
      p.add(it.line, "too-many-variables", it.name);
    info.functions[it.name] = {
      params: it.params.map((x) => x.name),
      result: sig.result.k !== "nothing",
      locals,
      count,
    };
  }
  if (p.list.length) {
    const first = p.list.reduce((a, b) => (b.line < a.line ? b : a));
    throw new CompileError(first.code, first.message, first.args, first.line);
  }
  return info;
}

// ---- 4. generate ----------------------------------------------------------------------

export function generate(program: Program, info: Info): string[] {
  const out: string[] = [];
  const init: string[] = [];
  for (const g of Object.values(info.globals))
    g.init.forEach((w, j) => {
      if (w) init.push(`push ${w}`, `set global ${g.index + j}`);
    });
  for (const it of program.items) {
    if (it.kind !== "fn") continue;
    const f = info.functions[it.name]!;
    out.push(`func ${it.name} ${f.params.length} ${f.count}`);
    if (it.name === "main" && init.length) out.push("call _init 0", "pop");
    let labels = 0;
    const label = () => `L${++labels}`;
    const loops: { cont: string; brk: string }[] = [];
    const place = (name: string): string | null => {
      if (name in f.locals) return `local ${f.locals[name]}`;
      const a = f.params.indexOf(name);
      if (a >= 0) return `arg ${a}`;
      const g = info.globals[name];
      return g ? `global ${g.index}` : null;
    };
    const isVar = (name: string) => name in f.locals || f.params.includes(name);
    const base = (name: string) =>
      out.push(
        isVar(name)
          ? `push ${place(name)}`
          : `push ${info.globals[name]!.index}`,
      );

    const OPS: Record<string, string> = {
      "+": "add",
      "-": "sub",
      "*": "mul",
      "/": "div",
      "%": "mod",
      "&": "and",
      "|": "or",
      "^": "xor",
      "<<": "shl",
      ">>": "shr",
      "==": "eq",
      "!=": "ne",
      "<": "lt",
      "<=": "le",
      ">": "gt",
      ">=": "ge",
    };

    const expr = (e: Expr): void => {
      switch (e.kind) {
        case "num":
          out.push(`push ${e.value}`);
          break;
        case "bool":
          out.push(e.value ? "push -1" : "push 0");
          break;
        case "name":
          if (e.name in info.consts) out.push(`push ${info.consts[e.name]}`);
          else if (!isVar(e.name) && info.globals[e.name]?.array) base(e.name);
          else out.push(`push ${place(e.name)}`);
          break;
        case "index":
          base(e.name);
          expr(e.index);
          out.push("add", "load");
          break;
        case "mem":
          expr(e.addr);
          out.push("load");
          break;
        case "call":
          e.args.forEach(expr);
          out.push(`call ${e.name} ${e.args.length}`);
          break;
        case "unary":
          expr(e.operand);
          out.push(e.op === "-" ? "neg" : "not");
          break;
        case "binary":
          if (e.op === "and" || e.op === "or") {
            // Keep the left value if it decides; otherwise the right one.
            const end = label();
            expr(e.left);
            out.push(
              "dup",
              `${e.op === "and" ? "jumpifnot" : "jumpif"} ${end}`,
              "pop",
            );
            expr(e.right);
            out.push(`label ${end}`);
          } else {
            expr(e.left);
            expr(e.right);
            out.push(OPS[e.op]!);
          }
          break;
        default:
          break;
      }
    };

    const stmt = (s: Stmt): void => {
      switch (s.kind) {
        case "var":
          expr(s.value);
          out.push(`set local ${f.locals[s.name]}`);
          break;
        case "assign":
          if (s.target.kind === "name") {
            expr(s.value);
            out.push(`set ${place(s.target.name)}`);
          } else if (s.target.kind === "index") {
            base(s.target.name);
            expr(s.target.index);
            out.push("add");
            expr(s.value);
            out.push("store");
          } else if (s.target.kind === "mem") {
            expr(s.target.addr);
            expr(s.value);
            out.push("store");
          }
          break;
        case "if": {
          const other = label();
          const end = label();
          expr(s.cond);
          out.push(`jumpifnot ${other}`);
          s.then.forEach(stmt);
          out.push(`jump ${end}`, `label ${other}`);
          (s.else ?? []).forEach(stmt);
          out.push(`label ${end}`);
          break;
        }
        case "while": {
          const top = label();
          const end = label();
          out.push(`label ${top}`);
          expr(s.cond);
          out.push(`jumpifnot ${end}`);
          loops.push({ cont: top, brk: end });
          s.body.forEach(stmt);
          loops.pop();
          out.push(`jump ${top}`, `label ${end}`);
          break;
        }
        case "for": {
          const i = f.locals[s.var]!;
          const top = label();
          const next = label();
          const end = label();
          expr(s.from);
          out.push(`set local ${i}`);
          expr(s.to);
          out.push(`set local ${i + 1}`, `label ${top}`);
          out.push(
            `push local ${i}`,
            `push local ${i + 1}`,
            "lt",
            `jumpifnot ${end}`,
          );
          loops.push({ cont: next, brk: end });
          s.body.forEach(stmt);
          loops.pop();
          out.push(`label ${next}`, `push local ${i}`, "push 1", "add");
          out.push(`set local ${i}`, `jump ${top}`, `label ${end}`);
          break;
        }
        case "break":
          out.push(`jump ${loops[loops.length - 1]!.brk}`);
          break;
        case "continue":
          out.push(`jump ${loops[loops.length - 1]!.cont}`);
          break;
        case "return":
          if (s.value) expr(s.value);
          else out.push("push 0");
          out.push("return");
          break;
        case "expr":
          expr(s.expr);
          out.push("pop");
      }
    };

    it.body.forEach(stmt);
    // Always end with a return (unreachable after a final return).
    out.push("push 0", "return");
  }
  if (init.length) out.push("func _init 0 0", ...init, "push 0", "return");
  return out;
}
