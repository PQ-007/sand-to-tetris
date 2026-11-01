// The starting point of the assembler workshop, in each language: the
// types every stage works with, AsmError, and the four functions to write.
import type { Lang } from "./i18n";

const TYPES = `type Token =
  | { kind: "label"; name: string } // "loop:" at the start of a line
  | { kind: "ident"; text: string } // ADD, r1, loop (as written)
  | { kind: "directive"; name: string } // ".word" -> "word" (lower case)
  | { kind: "number"; value: number } // 42, -5, 0x2A, 0b101, 'A'
  | { kind: "comma" }
  | { kind: "lbracket" }
  | { kind: "rbracket" }
  | { kind: "plus" };

type Operand =
  | { kind: "reg"; reg: number } // r0..r7
  | { kind: "num"; value: number }
  | { kind: "sym"; name: string } // a label or a constant
  | { kind: "mem"; reg: number; offset: Operand }; // [r1 + 2]; [r1] has offset 0

type Body =
  | { kind: "instr"; mnemonic: string; args: Operand[] } // mnemonic in UPPER case
  | { kind: "dir"; name: string; args: Operand[] }; // name in lower case, no dot

interface Line {
  label: string | null;
  body: Body | null;
}

interface Symbol {
  kind: "code" | "data" | "const";
  value: number;
}

interface Placed {
  section: "code" | "data";
  address: number;
  size: number;
}

interface Layout {
  symbols: Record<string, Symbol>;
  lines: (Placed | null)[]; // null: no words (empty, label only, .equ, .code, .data)
}

// Provided: throw new AsmError(code, message, args?, line?)
declare class AsmError extends Error {
  constructor(code: string, message: string, args?: Record<string, string>, line?: number);
}`;

const EN = `// Your assembler, in four stages. Each stage has its own tests, and each is
// tested with correct input from the stage before, so you can build them in
// order. The language is in docs/ASSEMBLY.md; the bits in docs/ISA.md.
// On a mistake in the source, throw an AsmError with a code from the spec:
// the tests check the code, not your message.

${TYPES}

// Stage 1: one line of text into tokens. Skip spaces; ";" starts a comment.
// "name:" is a label token; numbers can be 42, -5, 0x2A, 0b1010 (with _ between
// digits) or 'A'. Codes: bad-char, bad-number.
export function tokenize(line: string): Token[] {
  throw new AsmError("todo", "TODO: write tokenize");
}

// Stage 2: tokens into a line. An optional label, then an instruction (an
// ident) or a directive, then operands separated by commas. ".equ NAME value"
// has no comma. Registers r0..r7 (any case) become { kind: "reg" }, other
// idents { kind: "sym" }. Codes: expected, bad-name.
export function parse(tokens: Token[]): Line {
  throw new AsmError("todo", "TODO: write parse");
}

// Stage 3 (pass 1): give every line its section and address, and collect the
// symbols. Start in .code; a label takes the current address of its section.
// Every instruction is 1 word, except SET16: 1 word when its value is a number
// (or a constant defined above) from 0 to 255, else 2. When you throw, pass the
// line number (index + 1) as the 4th argument.
// Codes: duplicate-symbol, code-in-data, data-in-code, unknown-directive,
// unknown-symbol (in .equ / .space), operand-count, out-of-range.
export function layout(lines: Line[]): Layout {
  throw new AsmError("todo", "TODO: write layout");
}

// Stage 4 (pass 2): one placed line into its words.
//   .word values -> themselves (-32768..65535, as 16-bit); .space n -> n zeros.
//   Instructions -> docs/ISA.md. Bits 15-13 are the group:
//     000 ALU   rd ra rb f f invb cin       001 CMP   - ra rb f f invb cin
//     010 IMM   rd k k imm8 (SET SETH ADDI SUBI = k 0..3)
//     011 SHIFT rd ra reg right arith amount (by register: rb in bits 2-0)
//     100 LOAD  rd ra off7                  101 STORE rs ra off7
//     110 JUMP  cond off10                  111 CALL 0 off12 / JR 1 link ra
//   A jump to a code label encodes (label - this address); a number is the offset.
// Codes: unknown-mnemonic, operand-count, not-a-register, bad-operand,
// out-of-range, unknown-symbol, jump-to-data, jump-too-far.
export function encode(body: Body, symbols: Record<string, Symbol>, placed: Placed): number[] {
  throw new AsmError("todo", "TODO: write encode");
}
`;

const MN = `// Таны ассемблер, дөрвөн үе шаттай. Үе шат бүр өөрийн шалгалттай бөгөөд
// өмнөх үе шатны зөв гаралтаар шалгагдах тул тэдгээрийг дарааллаар нь бичиж
// болно. Хэл нь docs/ASSEMBLY.md-д, битүүд нь docs/ISA.md-д бий.
// Эх кодонд алдаа байвал spec-ийн code-той AsmError шид: шалгалт таны
// message-ийг биш, code-ыг шалгана.

${TYPES}

// 1-р үе шат: нэг мөр бичвэрийг token болгох. Хоосон зайг алгас; ";" тайлбар
// эхлүүлнэ. "name:" бол label token; тоо нь 42, -5, 0x2A, 0b1010 (цифрүүдийн
// хооронд _ байж болно) эсвэл 'A'. Code: bad-char, bad-number.
export function tokenize(line: string): Token[] {
  throw new AsmError("todo", "TODO: tokenize-ыг бич");
}

// 2-р үе шат: token-уудыг мөр болгох. Сонголттой label, дараа нь заавар
// (ident) эсвэл directive, дараа нь таслалаар тусгаарласан operand-ууд.
// ".equ NAME value"-д таслал байхгүй. r0..r7 (том, жижиг үсгээр) нь
// { kind: "reg" }, бусад ident нь { kind: "sym" }. Code: expected, bad-name.
export function parse(tokens: Token[]): Line {
  throw new AsmError("todo", "TODO: parse-ыг бич");
}

// 3-р үе шат (1-р давталт): мөр бүрд section ба хаяг өгч, symbol-уудыг цуглуул.
// .code-оос эхэл; label нь section-ийнхаа одоогийн хаягийг авна. Заавар бүр
// 1 үг, SET16-аас бусад нь: түүний утга нь 0-ээс 255 хүртэлх тоо (эсвэл дээр
// тодорхойлсон тогтмол) бол 1 үг, эс бөгөөс 2. Алдаа шидэхдээ мөрийн дугаарыг
// (index + 1) 4-р аргумент болгон өг.
// Code: duplicate-symbol, code-in-data, data-in-code, unknown-directive,
// unknown-symbol (.equ / .space-д), operand-count, out-of-range.
export function layout(lines: Line[]): Layout {
  throw new AsmError("todo", "TODO: layout-ыг бич");
}

// 4-р үе шат (2-р давталт): байрлуулсан нэг мөрийг үгс болгох.
//   .word утгууд -> өөрсдөө (-32768..65535, 16 битээр); .space n -> n тэг.
//   Заавар -> docs/ISA.md. 15-13-р бит нь бүлэг:
//     000 ALU   rd ra rb f f invb cin       001 CMP   - ra rb f f invb cin
//     010 IMM   rd k k imm8 (SET SETH ADDI SUBI = k 0..3)
//     011 SHIFT rd ra reg right arith amount (register-оор: rb нь 2-0-р бит)
//     100 LOAD  rd ra off7                  101 STORE rs ra off7
//     110 JUMP  cond off10                  111 CALL 0 off12 / JR 1 link ra
//   Code label руу үсрэх нь (label - энэ хаяг)-ийг кодлоно; тоо бол offset өөрөө.
// Code: unknown-mnemonic, operand-count, not-a-register, bad-operand,
// out-of-range, unknown-symbol, jump-to-data, jump-too-far.
export function encode(body: Body, symbols: Record<string, Symbol>, placed: Placed): number[] {
  throw new AsmError("todo", "TODO: encode-ыг бич");
}
`;

export const STARTERS: Record<Lang, string> = { en: EN, mn: MN };
