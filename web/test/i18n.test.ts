import { describe, expect, it } from "vitest";
import { detectLang, format, setLang, t } from "../src/i18n";
import { en } from "../src/i18n/en";
import { ja } from "../src/i18n/ja";
import { mn } from "../src/i18n/mn";
import { compare, SWITCHES } from "../src/demos/switches";

const holes = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("has a Mongolian text for every English key, and nothing extra", () => {
    expect(Object.keys(mn).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(mn)) {
      if (typeof v === "string") expect(v.trim(), k).not.toBe("");
    }
  });

  it("uses the same {placeholders} in both languages", () => {
    for (const [k, v] of Object.entries(en)) {
      const m = mn[k as keyof typeof en];
      if (typeof v === "string" && typeof m === "string")
        expect([...new Set(holes(m))], k).toEqual([...new Set(holes(v))]);
    }
  });

  it("has a Japanese text for every English key, with the same placeholders", () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(en)) {
      const j = ja[k as keyof typeof en];
      if (typeof j === "string") expect(j.trim(), k).not.toBe("");
      if (typeof v === "string" && typeof j === "string")
        expect([...new Set(holes(j))], k).toEqual([...new Set(holes(v))]);
    }
  });

  it("compares two switches in Japanese as a list (no conjugated adjectives)", () => {
    const relay = SWITCHES.find((s) => s.id === "relay")!;
    const today = SWITCHES.find((s) => s.id === "transistor-today")!;
    setLang("ja");
    expect(compare(relay, today)).toBe(
      "リレー と 現在のトランジスタ: 大きさは約百万倍大きい、速さは約十億倍遅い。",
    );
    setLang("en");
  });

  it("compares two switches in Mongolian without case suffixes", () => {
    const relay = SWITCHES.find((s) => s.id === "relay")!;
    const today = SWITCHES.find((s) => s.id === "transistor-today")!;
    setLang("mn");
    expect(compare(relay, today)).toBe(
      "Реле ба өнөөгийн транзистор: эхнийх нь сая орчим дахин урт, тэрбум орчим дахин удаан.",
    );
    setLang("en");
  });

  it("fills in {placeholders} and calls message functions", () => {
    expect(format("Pass {name} first.", { name: "NOT" })).toBe(
      "Pass NOT first.",
    );
    setLang("en");
    expect(t("hud.levelsLabel", { passed: 1, total: 5 })).toBe(
      "Levels passed: 1 of 5. Open the level map.",
    );
    setLang("mn");
    expect(t("nav.learn")).toBe(mn["nav.learn"]);
    setLang("en");
    expect(t("nav.learn")).toBe("Learn");
  });

  it("picks Mongolian for a Mongolian browser unless the learner chose", () => {
    expect(detectLang(null, ["mn-MN", "en"])).toBe("mn");
    expect(detectLang(null, ["en-US"])).toBe("en");
    expect(detectLang("en", ["mn"])).toBe("en");
    expect(detectLang("mn", ["en"])).toBe("mn");
    expect(detectLang("fr", ["en"])).toBe("en");
    expect(detectLang(null, ["ja-JP", "en"])).toBe("ja");
    expect(detectLang(null, ["fr-FR", "ja"])).toBe("ja");
    expect(detectLang("ja", ["mn"])).toBe("ja");
  });
});
