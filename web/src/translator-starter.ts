// The starting point of the VM translator workshop, in each language: the
// types, VmError, the calling convention, and the four functions to write.
import type { Lang } from "./i18n";

const TYPES = `type Seg = "const" | "local" | "arg" | "global";

type Command =
  | { op: "push" | "set"; seg: Seg; n: number } // push 5 -> seg "const", n 5 (0..65535)
  | { op: "label" | "jump" | "jumpif" | "jumpifnot"; name: string }
  | { op: "func"; name: string; args: number; locals: number }
  | { op: "call"; name: string; args: number }
  | { op: "pop" | "dup" | "load" | "store" | "add" | "sub" | "and" | "or" | "xor"
        | "neg" | "not" | "shl" | "shr" | "sar" | "mul" | "div" | "mod"
        | "eq" | "ne" | "lt" | "gt" | "le" | "ge" | "return" };

interface Ctx {
  func: string; // the function this command is in
  args: number; // its number of arguments (n)
  locals: number; // its number of locals (k)
  line: number; // this command's line: use it to make labels unique
}

// Provided: throw new VmError(code, message, args?)
declare class VmError extends Error {
  constructor(code: string, message: string, args?: Record<string, string>);
}`;

const EN = `// Your VM translator. Each stage has its own tests: a stage's commands are
// translated with your code and everything else with the reference's, so you
// can build them in any order. The VM is in docs/VM.md; the assembly language
// in docs/ASSEMBLY.md. On a mistake in a line, throw a VmError with a code
// from the spec: the tests check the code, not your message.

${TYPES}

// The calling convention (docs/VM.md), which every translation follows:
//   r6 = SP: the top of the stack is [r6]; the one below it is [r6 + 1].
//        The stack grows down: push = SUBI r6, 1 then STORE; it starts at 0x4000.
//   r5 = FP: local i is [r5 + i]; the caller's FP is [r5 + k];
//        the return address [r5 + k + 1]; arg i is [r5 + k + 2 + (n - 1 - i)].
//   r7 = the return address (CALLR writes it).  r0..r4 = free in any command.
//   global i = RAM[i].  true = -1, false = 0.
//   Function f is the label "f"; label L in function f is "f__L".
//   Labels you make up yourself start with "__" (e.g. "__eq" + ctx.line).

// Stage 1: one line into a command, or null for a blank line or a comment.
// Command words in any case; numbers 42, -5, 0x2A, 0b1010 (with _ between
// digits). Codes: unknown-command, operand-count, bad-number, out-of-range,
// bad-segment, set-constant, bad-name, too-many-variables.
export function parse(line: string): Command | null {
  throw new VmError("todo", "TODO: write parse");
}

// Stages 2-6: one command into assembly lines, e.g. for "add":
//   ["LOAD r1, [r6]", "ADDI r6, 1", "LOAD r0, [r6]", "ADD r0, r0, r1", "STORE r0, [r6]"]
// func: the label, then save r7 and r5, make room for the locals (set to 0),
// and set FP.  call: SET16 r0, f then CALLR r0.  return: put the result where
// arg 0 was, restore FP, jump back with RET.  mul, div, mod: call __mul / __div.
export function translate(cmd: Command, ctx: Ctx): string[] {
  throw new VmError("todo", "TODO: write translate");
}

// The start of every program: SP = 0x4000, FP = SP, call main, then HALT.
export function bootstrap(): string[] {
  throw new VmError("todo", "TODO: write bootstrap");
}

// __mul: r0 = r0 * r1.  __div: r0 = r0 / r1 and r1 = r0 mod r1, signed,
// rounding toward 0; dividing by 0 gives -1 and r0.  Use only r0..r4 (and
// the stack below SP), and return with RET.
export function runtime(): string[] {
  throw new VmError("todo", "TODO: write runtime");
}
`;

const MN = `// Таны VM translator. Үе шат бүр өөрийн шалгалттай: тухайн үе шатны
// командуудыг таны кодоор, бусдыг нь жишиг кодоор хөрвүүлдэг тул тэдгээрийг
// ямар ч дарааллаар бичиж болно. VM нь docs/VM.md-д, ассемблер хэл нь
// docs/ASSEMBLY.md-д бий. Мөрөнд алдаа байвал spec-ийн code-той VmError шид:
// шалгалт таны message-ийг биш, code-ыг шалгана.

${TYPES}

// Calling convention (docs/VM.md): хөрвүүлэлт бүр үүнийг дагана:
//   r6 = SP: stack-ийн орой нь [r6]; түүний доорх нь [r6 + 1].
//        Stack доош ургана: push = SUBI r6, 1 дараа нь STORE; 0x4000-аас эхэлнэ.
//   r5 = FP: local i нь [r5 + i]; дуудагчийн FP нь [r5 + k];
//        буцах хаяг [r5 + k + 1]; arg i нь [r5 + k + 2 + (n - 1 - i)].
//   r7 = буцах хаяг (CALLR бичнэ).  r0..r4 = ямар ч командад чөлөөтэй.
//   global i = RAM[i].  true = -1, false = 0.
//   f функц нь "f" label; f функц доторх L label нь "f__L".
//   Өөрөө зохиосон label-ууд "__"-ээр эхэлнэ (жишээ нь "__eq" + ctx.line).

// 1-р үе шат: нэг мөрийг команд болгох; хоосон мөр эсвэл тайлбар бол null.
// Командын үгс ямар ч үсгээр; тоо нь 42, -5, 0x2A, 0b1010 (цифрүүдийн хооронд
// _ байж болно). Code: unknown-command, operand-count, bad-number,
// out-of-range, bad-segment, set-constant, bad-name, too-many-variables.
export function parse(line: string): Command | null {
  throw new VmError("todo", "TODO: parse-ыг бич");
}

// 2-6-р үе шат: нэг командыг ассемблер мөрүүд болгох, жишээ нь "add":
//   ["LOAD r1, [r6]", "ADDI r6, 1", "LOAD r0, [r6]", "ADD r0, r0, r1", "STORE r0, [r6]"]
// func: label, дараа нь r7 ба r5-ыг хадгалж, local-уудад зай гаргаж (0 болгож),
// FP-г тохируул.  call: SET16 r0, f дараа нь CALLR r0.  return: үр дүнг arg 0
// байсан газар тавьж, FP-г сэргээж, RET-ээр буц.  mul, div, mod: __mul / __div дууд.
export function translate(cmd: Command, ctx: Ctx): string[] {
  throw new VmError("todo", "TODO: translate-ыг бич");
}

// Програм бүрийн эхлэл: SP = 0x4000, FP = SP, main-ийг дуудаж, дараа нь HALT.
export function bootstrap(): string[] {
  throw new VmError("todo", "TODO: bootstrap-ыг бич");
}

// __mul: r0 = r0 * r1.  __div: r0 = r0 / r1 ба r1 = r0 mod r1, тэмдэгтэй,
// 0 руу тоймлоно; 0-д хуваавал -1 ба r0.  Зөвхөн r0..r4-ыг (мөн SP-ийн доорх
// stack-ийг) ашиглаж, RET-ээр буц.
export function runtime(): string[] {
  throw new VmError("todo", "TODO: runtime-ыг бич");
}
`;

const JA = `// あなたの VM トランスレータ。どの段階にも専用のテストがあります。その段階の
// コマンドはあなたのコードで、それ以外は参照のコードで翻訳されるので、どの順番で
// 作ってもかまいません。VM は docs/VM.md、アセンブリ言語は docs/ASSEMBLY.md に
// あります。行に誤りがあれば、仕様の code をもつ VmError を throw します。
// テストが確かめるのは code で、メッセージではありません。

${TYPES}

// 呼び出し規約(docs/VM.md)。どの翻訳もこれに従う:
//   r6 = SP:スタックの一番上は [r6]、その一つ下は [r6 + 1]。
//        スタックは下へ伸びる:push = SUBI r6, 1 のあと STORE。0x4000 から始まる。
//   r5 = FP:local i は [r5 + i]、呼び出し元の FP は [r5 + k]、
//        戻りアドレスは [r5 + k + 1]、arg i は [r5 + k + 2 + (n - 1 - i)]。
//   r7 = 戻りアドレス(CALLR が書く)。 r0..r4 = どのコマンドでも自由に使える。
//   global i = RAM[i]。 true = -1、false = 0。
//   関数 f はラベル "f"、関数 f の中のラベル L は "f__L"。
//   自分で作るラベルは "__" で始める(例:"__eq" + ctx.line)。

// 段階 1:1 行をコマンドにする。空行やコメントなら null。
// コマンドの語は大文字でも小文字でもよい。数は 42、-5、0x2A、0b1010(桁の間に
// _ を入れてよい)。code: unknown-command, operand-count, bad-number,
// out-of-range, bad-segment, set-constant, bad-name, too-many-variables。
export function parse(line: string): Command | null {
  throw new VmError("todo", "TODO: parse を書く");
}

// 段階 2〜6:1 つのコマンドをアセンブリの行にする。たとえば "add" は:
//   ["LOAD r1, [r6]", "ADDI r6, 1", "LOAD r0, [r6]", "ADD r0, r0, r1", "STORE r0, [r6]"]
// func:ラベル、次に r7 と r5 を保存し、ローカル変数の場所を空けて(0 にして)、
// FP を設定する。 call:SET16 r0, f のあと CALLR r0。 return:結果を arg 0 が
// あった場所に置き、FP を戻し、RET で戻る。 mul, div, mod:__mul / __div を呼ぶ。
export function translate(cmd: Command, ctx: Ctx): string[] {
  throw new VmError("todo", "TODO: translate を書く");
}

// どのプログラムも最初はこれ:SP = 0x4000、FP = SP、main を呼び、そのあと HALT。
export function bootstrap(): string[] {
  throw new VmError("todo", "TODO: bootstrap を書く");
}

// __mul:r0 = r0 * r1。 __div:r0 = r0 / r1 と r1 = r0 mod r1、符号付きで、
// 0 の方向へ丸める。0 で割ると -1 と r0。使うのは r0..r4(と SP より下の
// スタック)だけにし、RET で戻る。
export function runtime(): string[] {
  throw new VmError("todo", "TODO: runtime を書く");
}
`;

export const TRANSLATOR_STARTERS: Record<Lang, string> = {
  en: EN,
  mn: MN,
  ja: JA,
};
