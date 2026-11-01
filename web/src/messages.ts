// The checker's messages in the learner's language. In English the core's
// own text is used as is; otherwise the message is rebuilt from the
// problem's code and values, or the diagnostic's structured fields.
import { getLang, t, type Key } from "./i18n";
import { en } from "./i18n/en";
import type { AsmError, Diagnostic, Problem } from "./sim/types";

/** Free-text reasons the core gives for a bad part. */
function reasonText(reason: string): string {
  const fixed: Record<string, Key> = {
    "only splitters and joiners have a width": "reason.widthOnlyWiring",
    "only components can be repeated": "reason.repeatOnlyComponents",
    "shared pins only make sense on a repeated component":
      "reason.sharedNeedsRepeat",
    "a splitter or joiner needs a width": "reason.needsWidth",
    "repeating makes a pin wider than 64 bits": "reason.tooWide",
    "splitters and joiners arrive in Layer 2, with buses":
      "reason.wiringLayer2",
  };
  const key = fixed[reason];
  if (key) return t(key);
  const width = /^width (\d+) isn't allowed/.exec(reason);
  if (width) return t("reason.badWidth", { n: width[1] ?? "" });
  const repeat = /^repeat (\d+) isn't allowed/.exec(reason);
  if (repeat) return t("reason.badRepeat", { n: repeat[1] ?? "" });
  return reason;
}

/** "port `a`" → "`a`"; "`n.a`" stays. */
function endpointText(text: string): string {
  return text.replace(/^port (`[^`]+`)$/, "$1");
}

export function problemText(p: Problem): string {
  if (getLang() === "en") return p.message;
  const key = `problem.${p.code}`;
  if (!(key in en)) return p.message;
  const args: Record<string, string> = { ...p.args };
  if (args.reason) args.reason = reasonText(args.reason);
  if (args.from) args.from = endpointText(args.from);
  if (args.to) args.to = endpointText(args.to);
  return t(key as Key, args);
}

function label(row: number, ctx: { sequential: boolean; rows: number }) {
  const random = row > ctx.rows;
  const n = random ? row - ctx.rows : row;
  if (!ctx.sequential)
    return random ? t("diag.randomTest", { n }) : t("diag.row", { n });
  if (n === 1) return t(random ? "diag.randomStep1" : "diag.step1");
  if (n === 2) return t(random ? "diag.randomStep2" : "diag.step2");
  return t(random ? "diag.randomStepN" : "diag.stepN", { n, m: n - 1 });
}

/** A failed row or step, in the learner's language. `rows` is how many
 * rows the level's table has (later rows are random tests). */
export function diagnosticText(
  d: Diagnostic,
  ctx: { sequential: boolean; rows: number },
): string {
  if (getLang() === "en") return d.message;
  const key: Key = `diag.${d.kind}`;
  return t(key, {
    label: label(d.row, ctx),
    inputs: d.inputs.map(([k, v]) => `${k}=${v}`).join(" "),
    port: d.port,
    expected: d.expected,
    actual: d.actual,
  });
}

/** Fixed English sentences from the pure editing modules, translated. */
export function knownText(text: string): string {
  const known: Record<string, Key> = {
    "A wire needs two different ends.": "model.sameEnd",
    "Those two are already connected.": "model.alreadyConnected",
    "Now click the pin to connect it to (Escape cancels).":
      "canvas.pendingWire",
  };
  const key = known[text];
  return key ? t(key) : text;
}

/** An assembler error in the current language: English comes from the
 * assembler itself; other languages are built from its code and values. */
/** A C Shard error (docs/LANGUAGE.md) in the current language; a code the
 * site doesn't know (the learner's own) keeps its message. */
export function langErrorText(e: AsmError): string {
  if (getLang() === "en" || !(`lang.${e.code}` in en)) return e.message;
  const args: Record<string, string> = { ...e.args };
  if (args.what && !args.what.startsWith("`") && `lang.what.${args.what}` in en)
    args.what = t(`lang.what.${args.what}` as Key);
  return t(`lang.${e.code}` as Key, args);
}

/** A VM error (docs/VM.md) in the current language; a code the site
 * doesn't know (the learner's own, like "todo") keeps its message. */
export function vmErrorText(e: AsmError): string {
  if (getLang() === "en" || !(`vm.${e.code}` in en)) return e.message;
  return t(`vm.${e.code}` as Key, e.args);
}

export function asmErrorText(e: AsmError): string {
  if (getLang() === "en" || !(`asm.${e.code}` in en)) return e.message;
  const args: Record<string, string> = { ...e.args };
  if (args.what && `asm.what.${args.what}` in en)
    args.what = t(`asm.what.${args.what}` as Key);
  if (args.expected && `asm.expect.${args.expected}` in en)
    args.expected = t(`asm.expect.${args.expected}` as Key);
  return t(`asm.${e.code}` as Key, args);
}
