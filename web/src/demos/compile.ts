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

export interface TreeNode {
  text: string;
  depth: number;
  /** Centre of the node's box. */
  x: number;
  y: number;
  /** Box width (from the text's length, in a monospace font). */
  w: number;
}

export interface TreeLayout {
  nodes: TreeNode[];
  /** [parent, child] node indexes. */
  edges: [number, number][];
  width: number;
  height: number;
}

const CHAR_W = 7.3;
const PAD = 14;
const GAP = 12;
const ROW = 46;
const BOX_H = 24;

/**
 * Lays an outline out as a tree drawing: leaves side by side in reading
 * order, each parent centred over its children, one row per depth.
 */
export function treeLayout(lines: TreeLine[]): TreeLayout {
  const nodes: TreeNode[] = lines.map((l) => ({
    text: l.text,
    depth: l.depth,
    x: 0,
    y: l.depth * ROW + BOX_H / 2 + 2,
    w: l.text.length * CHAR_W + PAD,
  }));
  // A line's parent is the nearest line above it one level up.
  const parent: number[] = nodes.map(() => -1);
  const children: number[][] = nodes.map(() => []);
  const last: number[] = [];
  nodes.forEach((n, i) => {
    last[n.depth] = i;
    last.length = n.depth + 1;
    const p = n.depth > 0 ? (last[n.depth - 1] ?? -1) : -1;
    parent[i] = p;
    if (p >= 0) children[p]?.push(i);
  });
  let next = 2;
  const shift = (i: number, dx: number): void => {
    const n = nodes[i];
    if (n) n.x += dx;
    for (const k of children[i] ?? []) shift(k, dx);
  };
  const place = (i: number): void => {
    const n = nodes[i];
    if (!n) return;
    const start = next;
    const kids = children[i] ?? [];
    if (!kids.length) {
      n.x = next + n.w / 2;
      next += n.w + GAP;
      return;
    }
    for (const k of kids) place(k);
    const first = nodes[kids[0] ?? i];
    const lastKid = nodes[kids[kids.length - 1] ?? i];
    n.x = ((first?.x ?? 0) + (lastKid?.x ?? 0)) / 2;
    // A parent wider than its children must not reach into the subtree on
    // its left: move the whole subtree right instead.
    const over = start - (n.x - n.w / 2);
    if (over > 0) {
      shift(i, over);
      next += over;
    }
    next = Math.max(next, n.x + n.w / 2 + GAP);
  };
  nodes.forEach((_, i) => {
    if (parent[i] === -1) place(i);
  });
  const edges: [number, number][] = [];
  parent.forEach((p, i) => {
    if (p >= 0) edges.push([p, i]);
  });
  const depth = Math.max(0, ...nodes.map((n) => n.depth));
  return {
    nodes,
    edges,
    width: Math.ceil(next - GAP + 2),
    height: depth * ROW + BOX_H + 4,
  };
}
