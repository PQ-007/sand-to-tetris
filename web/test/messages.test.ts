import { describe, expect, it } from "vitest";
import { setLang } from "../src/i18n";
import { cErrorText, diagnosticText, problemText } from "../src/messages";
import type { Diagnostic, Problem } from "../src/sim/types";

const problem = (code: string, args: Record<string, string>): Problem => ({
  severity: "error",
  message: "the core's English message",
  code,
  args,
  parts: [],
  ports: [],
});

const diag = (over: Partial<Diagnostic>): Diagnostic => ({
  row: 1,
  inputs: [
    ["d", "0"],
    ["clk", "1"],
  ],
  port: "q",
  expected: "1",
  actual: "0",
  kind: "wrong",
  message: "the core's English message",
  hint: "English hint",
  parts: [],
  ports: [],
  ...over,
});

describe("checker messages in the learner's language", () => {
  it("two signals on one wire: names both ends in Mongolian", () => {
    setLang("mn");
    expect(
      problemText(
        problem("two-drivers", {
          listeners: "`or4.a`",
          drivers: "input `in` bit 5 and input `in` bit 6",
        }),
      ),
    ).toBe(
      "`or4.a`: нэг дор хоёр дохио ирж байна (оролт `in` бит 5, оролт `in` бит 6). Хоёр гаралт нэг wire-ыг булаацалдаж байна; wire бүр яг нэг эх үүсвэртэй байх ёстой",
    );
    setLang("en");
  });

  it("keeps the core's exact English", () => {
    setLang("en");
    expect(problemText(problem("output-unconnected", { port: "out" }))).toBe(
      "the core's English message",
    );
    expect(diagnosticText(diag({}), { sequential: false, rows: 4 })).toBe(
      "the core's English message",
    );
  });

  it("builds Mongolian from the problem's code and values", () => {
    setLang("mn");
    expect(problemText(problem("output-unconnected", { port: "out" }))).toBe(
      "`out` гаралт юутай ч холбогдоогүй байна",
    );
    // Free-text reasons and endpoints are translated too.
    expect(
      problemText(
        problem("bad-part", {
          part: "s",
          reason: "width 99 isn't allowed; use 2 to 64",
        }),
      ),
    ).toBe("`s` part: 99 өргөн зөвшөөрөгдөхгүй; 2-оос 64 хүртэл байна");
    expect(
      problemText(
        problem("width-mismatch", {
          from: "port `a`",
          from_width: "16",
          to: "`n.a`",
          to_width: "1",
        }),
      ),
    ).toContain("`a` нь 16 бит, `n.a` нь 1 бит");
    // An unknown code falls back to the core's English.
    expect(problemText(problem("something-new", {}))).toBe(
      "the core's English message",
    );
    setLang("en");
  });

  it("labels steps, rows and random steps", () => {
    setLang("mn");
    const ctx = { sequential: true, rows: 12 };
    expect(diagnosticText(diag({ row: 3 }), ctx)).toBe(
      "Step 3 (step 1–2-ийн дараа): d=0 clk=1 → q=1 байх ёстой, гэтэл q=0 гарлаа.",
    );
    expect(diagnosticText(diag({ row: 14 }), ctx)).toMatch(
      /^Санамсаргүй step 2 \(санамсаргүй step 1-ийн дараа\)/,
    );
    expect(
      diagnosticText(diag({ row: 2, kind: "floating", actual: "Z" }), {
        sequential: false,
        rows: 4,
      }),
    ).toMatch(/^2-р мөр: .* floating байна/);
    setLang("en");
  });
});

describe("C errors in the learner's language", () => {
  const e = (code: string, args: Record<string, string>, message = "msg") => ({
    line: 3,
    code,
    args,
    message,
  });

  it("keeps the compiler's English and builds other languages from codes", () => {
    setLang("en");
    expect(
      cErrorText(e("unknown-name", { name: "y" }, "y isn't declared")),
    ).toBe("y isn't declared");
    setLang("mn");
    expect(cErrorText(e("unknown-name", { name: "y" }))).toBe(
      "Зарлагдаагүй нэр: y",
    );
    // `what` is a short code, spelled out in the language.
    expect(cErrorText(e("unsupported", { what: "float" }))).toContain(
      "fixed-point int",
    );
    expect(cErrorText(e("expected", { what: "value", found: ";" }))).toBe(
      "Энд утга байх ёстой, гэтэл: ;",
    );
    expect(cErrorText(e("expected", { what: "`)`", found: ";" }))).toBe(
      "Энд `)` байх ёстой, гэтэл: ;",
    );
    // A code the site doesn't know keeps the compiler's message.
    expect(cErrorText(e("brand-new", {}, "as written"))).toBe("as written");
    setLang("en");
  });
});
