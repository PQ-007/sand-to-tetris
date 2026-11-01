// The starting point of the C Shard compiler workshop, in each language:
// the types every stage works with, CompileError, and the four functions.
import type { Lang } from "./i18n";

const TYPES = `type Token =
  | { kind: "num"; value: number; line: number } // 42, 0x2A, 0b101, 'A' (= 65)
  | { kind: "str"; text: string; line: number } // "HI" (escapes already applied)
  | { kind: "name"; text: string; line: number }
  | { kind: "kw"; text: string; line: number } // fn var const if else while for in break
  //   continue return and or not true false int bool mem
  | { kind: "sym"; text: string; line: number }; // ( ) { } [ ] , ; : -> .. = + - * / % & | ^ ~ << >> == != < <= > >=

type Type =
  | { kind: "int" }
  | { kind: "bool" }
  | { kind: "array"; elem: Type; size: Expr | null }; // [int; 20] or [int] (size null)

// Every node has the line of its first token (a binary operator: the operator's line).
type Expr =
  | { kind: "num"; value: number; line: number }
  | { kind: "bool"; value: boolean; line: number }
  | { kind: "str"; text: string; line: number }
  | { kind: "array"; items: Expr[]; line: number } // [1, 2, 3]
  | { kind: "name"; name: string; line: number }
  | { kind: "index"; name: string; index: Expr; line: number } // board[i]
  | { kind: "mem"; addr: Expr; line: number } // mem[a]
  | { kind: "call"; name: string; args: Expr[]; line: number }
  | { kind: "unary"; op: string; operand: Expr; line: number } // "-", "~", "not"
  | { kind: "binary"; op: string; left: Expr; right: Expr; line: number };
// (parentheses leave no node of their own)

type Stmt =
  | { kind: "var"; name: string; type: Type | null; value: Expr; line: number }
  | { kind: "assign"; target: Expr; value: Expr; line: number }
  | { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] | null; line: number } // else if: else = [if]
  | { kind: "while"; cond: Expr; body: Stmt[]; line: number }
  | { kind: "for"; var: string; from: Expr; to: Expr; body: Stmt[]; line: number }
  | { kind: "break"; line: number }
  | { kind: "continue"; line: number }
  | { kind: "return"; value: Expr | null; line: number }
  | { kind: "expr"; expr: Expr; line: number };

type Item =
  | { kind: "fn"; name: string; params: { name: string; type: Type }[]; result: Type | null; body: Stmt[]; line: number }
  | { kind: "var"; name: string; type: Type | null; value: Expr | null; line: number }
  | { kind: "const"; name: string; type: Type | null; value: Expr; line: number };

interface Program {
  items: Item[];
}

interface Info {
  // Global vars and constant arrays: their first VM global, size in words,
  // whether it's an array, and its starting words ([] if all 0).
  globals: Record<string, { index: number; size: number; array: boolean; init: number[] }>;
  consts: Record<string, number>; // constant ints and bools (true = 65535)
  functions: Record<string, {
    params: string[]; // in order: VM arg 0, 1, ...
    result: boolean; // returns a value
    locals: Record<string, number>; // every var and for variable -> VM local number
    count: number; // VM locals in all
  }>;
}

// Provided: throw new CompileError(code, message, args?, line?)
declare class CompileError extends Error {
  constructor(code: string, message: string, args?: Record<string, string>, line?: number);
}`;

const EN = `// Your C Shard compiler, in four stages. Each stage has its own tests, and
// each is tested with correct input from the stage before, so you can build
// them in order. The language is in docs/LANGUAGE.md; the VM in docs/VM.md.
// On a mistake in the source, throw a CompileError with a code from the
// spec and the line: the tests check the code and the line, not your message.

${TYPES}

// Stage 1: the whole source into tokens, each with its line. Skip spaces and
// // comments. Codes: bad-char, bad-number (above 65535 too),
// bad-char-literal, bad-string.
export function tokenize(source: string): Token[] {
  throw new CompileError("todo", "TODO: write tokenize");
}

// Stage 2: tokens into the tree, by recursive descent: one function per
// precedence level, loosest first: or, and, not, comparisons (== != < <= > >=,
// no chaining), |, ^, &, << >>, + -, * / %, prefix - ~, then calls, a[i],
// mem[i], numbers, (...). Code: expected (args: what, found), with what one
// of: "name", "type", "expression", "declaration", "statement", or a
// symbol/keyword in backticks like "\`;\`". chained-comparison.
export function parse(tokens: Token[]): Program {
  throw new CompileError("todo", "TODO: write parse");
}

// Stage 3: names and types; work out constants; give each global its VM
// globals (from 0, in the order declared; arrays take N) and each function's
// locals their numbers (in the order they appear; a for variable i takes two:
// i, then its hidden end value). Throw the first mistake (lowest line).
// Codes: see docs/LANGUAGE.md "Errors".
export function check(program: Program): Info {
  throw new CompileError("todo", "TODO: write check");
}

// Stage 4: VM code, one command per line. Start main with "call _init 0" and
// "pop" if any global has a starting value, and add "func _init 0 0" that sets
// them. true is -1; and/or jump over their right side; a call used as a
// statement is followed by pop; end every function with a return.
export function generate(program: Program, info: Info): string[] {
  throw new CompileError("todo", "TODO: write generate");
}
`;

const MN = `// Таны C Shard хөрвүүлэгч, дөрвөн үе шаттай. Үе шат бүр өөрийн шалгалттай
// бөгөөд өмнөх үе шатны зөв гаралтаар шалгагдах тул тэдгээрийг дарааллаар нь
// бичиж болно. Хэл нь docs/LANGUAGE.md-д, VM нь docs/VM.md-д бий.
// Эх кодонд алдаа байвал spec-ийн code ба мөрийн дугаартай CompileError шид:
// шалгалт таны message-ийг биш, code ба мөрийг шалгана.

${TYPES}

// 1-р үе шат: эх кодыг бүхэлд нь token болгох, тус бүр мөрийн дугаартай.
// Хоосон зай ба // тайлбарыг алгас. Code: bad-char, bad-number (65535-аас их
// бол ч), bad-char-literal, bad-string.
export function tokenize(source: string): Token[] {
  throw new CompileError("todo", "TODO: tokenize-ыг бич");
}

// 2-р үе шат: token-уудыг мод болгох, recursive descent-ээр: precedence-ийн
// түвшин бүрд нэг функц, хамгийн сулаас нь: or, and, not, харьцуулалт
// (== != < <= > >=, гинжлэхгүй), |, ^, &, << >>, + -, * / %, угтвар - ~, дараа
// нь дуудлага, a[i], mem[i], тоо, (...). Code: expected (args: what, found),
// what нь "name", "type", "expression", "declaration", "statement", эсвэл
// "\`;\`" шиг backtick доторх тэмдэгт/түлхүүр үгийн нэг. chained-comparison.
export function parse(tokens: Token[]): Program {
  throw new CompileError("todo", "TODO: parse-ыг бич");
}

// 3-р үе шат: нэр ба төрөл; тогтмолуудыг бод; global бүрд VM global-ууд өг
// (0-ээс, зарласан дарааллаар; массив N-ийг эзэлнэ), функц бүрийн
// local-уудад дугаар өг (гарч ирсэн дарааллаар; for-ын i хувьсагч хоёрыг
// эзэлнэ: i, дараа нь түүний нуугдмал төгсгөлийн утга). Эхний алдааг (хамгийн
// бага мөр) шид. Code: docs/LANGUAGE.md "Errors"-ыг үз.
export function check(program: Program): Info {
  throw new CompileError("todo", "TODO: check-ыг бич");
}

// 4-р үе шат: VM код, мөр бүрд нэг команд. Аль нэг global эхлэх утгатай бол
// main-ийг "call _init 0" ба "pop"-оор эхлүүлж, тэдгээрийг тохируулдаг
// "func _init 0 0"-ыг нэм. true бол -1; and/or баруун талаа үсэрч гарна;
// statement болгон ашигласан дуудлагын дараа pop; функц бүрийг return-ээр төгсгө.
export function generate(program: Program, info: Info): string[] {
  throw new CompileError("todo", "TODO: generate-ыг бич");
}
`;

export const COMPILER_STARTERS: Record<Lang, string> = { en: EN, mn: MN };
