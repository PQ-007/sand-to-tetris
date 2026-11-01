// The compiler demo's model: a syntax tree (docs/LANGUAGE.md) as an
// indented outline, and tokens as short labels. No DOM.
import type {
  LangExpr,
  LangItem,
  LangProgram,
  LangStmt,
  LangToken,
  LangType,
} from "../sim/types";

export interface TreeLine {
  depth: number;
  text: string;
}

export function typeText(t: LangType | null): string {
  if (!t) return "";
  if (t.kind !== "array") return t.kind;
  if (!t.size) return `[${typeText(t.elem)}]`;
  return `[${typeText(t.elem)}; ${exprText(t.size)}]`;
}

/** An expression on one line, fully parenthesised (to show the grouping
 * the parser chose). */
export function exprText(e: LangExpr): string {
  switch (e.kind) {
    case "num":
      return String(e.value);
    case "bool":
      return String(e.value);
    case "str":
      return JSON.stringify(e.text);
    case "array":
      return `[${e.items.map(exprText).join(", ")}]`;
    case "name":
      return e.name;
    case "index":
      return `${e.name}[${exprText(e.index)}]`;
    case "mem":
      return `mem[${exprText(e.addr)}]`;
    case "call":
      return `${e.name}(${e.args.map(exprText).join(", ")})`;
    case "unary":
      return `${e.op}${e.op === "not" ? " " : ""}${exprText(e.operand)}`;
    case "binary":
      return `(${exprText(e.left)} ${e.op} ${exprText(e.right)})`;
  }
}

/** An expression as a tree: each operator above its operands. */
function exprLines(e: LangExpr, depth: number, out: TreeLine[]): void {
  switch (e.kind) {
    case "binary":
      out.push({ depth, text: e.op });
      exprLines(e.left, depth + 1, out);
      exprLines(e.right, depth + 1, out);
      return;
    case "unary":
      out.push({ depth, text: e.op });
      exprLines(e.operand, depth + 1, out);
      return;
    case "call":
      out.push({ depth, text: `call ${e.name}` });
      for (const a of e.args) exprLines(a, depth + 1, out);
      return;
    case "index":
      out.push({ depth, text: `${e.name}[ ]` });
      exprLines(e.index, depth + 1, out);
      return;
    case "mem":
      out.push({ depth, text: "mem[ ]" });
      exprLines(e.addr, depth + 1, out);
      return;
    default:
      out.push({ depth, text: exprText(e) });
  }
}

function stmtLines(s: LangStmt, depth: number, out: TreeLine[]): void {
  const sub = (label: string, e: LangExpr) => {
    out.push({ depth: depth + 1, text: label });
    exprLines(e, depth + 2, out);
  };
  const body = (label: string, b: LangStmt[]) => {
    out.push({ depth: depth + 1, text: label });
    for (const x of b) stmtLines(x, depth + 2, out);
  };
  switch (s.kind) {
    case "var":
      out.push({
        depth,
        text: `var ${s.name}${s.type ? `: ${typeText(s.type)}` : ""} =`,
      });
      exprLines(s.value, depth + 1, out);
      return;
    case "assign":
      out.push({ depth, text: `${exprText(s.target)} =` });
      exprLines(s.value, depth + 1, out);
      return;
    case "if":
      out.push({ depth, text: "if" });
      sub("condition", s.cond);
      body("then", s.then);
      if (s.else) body("else", s.else);
      return;
    case "while":
      out.push({ depth, text: "while" });
      sub("condition", s.cond);
      body("do", s.body);
      return;
    case "for":
      out.push({
        depth,
        text: `for ${s.var} in ${exprText(s.from)}..${exprText(s.to)}`,
      });
      for (const x of s.body) stmtLines(x, depth + 1, out);
      return;
    case "return":
      out.push({ depth, text: "return" });
      if (s.value) exprLines(s.value, depth + 1, out);
      return;
    case "expr":
      exprLines(s.expr, depth, out);
      return;
    default:
      out.push({ depth, text: s.kind });
  }
}

function itemLines(it: LangItem, out: TreeLine[]): void {
  if (it.kind === "fn") {
    const params = it.params
      .map((p) => `${p.name}: ${typeText(p.type)}`)
      .join(", ");
    const result = it.result ? ` -> ${typeText(it.result)}` : "";
    out.push({ depth: 0, text: `fn ${it.name}(${params})${result}` });
    for (const s of it.body) stmtLines(s, 1, out);
    return;
  }
  const type = it.type ? `: ${typeText(it.type)}` : "";
  out.push({
    depth: 0,
    text: `${it.kind} ${it.name}${type}${it.value ? ` = ${exprText(it.value)}` : ""}`,
  });
}

/** The whole tree as an outline. */
export function treeLines(p: LangProgram): TreeLine[] {
  const out: TreeLine[] = [];
  for (const it of p.items) itemLines(it, out);
  return out;
}

/** A token as it reads: its text, and its kind. */
export function tokenLabel(t: LangToken): { text: string; kind: string } {
  return {
    text:
      t.kind === "num"
        ? String(t.value)
        : t.kind === "str"
          ? JSON.stringify(t.text)
          : t.text,
    kind: t.kind,
  };
}
