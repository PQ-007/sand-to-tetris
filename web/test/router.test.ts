import { describe, expect, it } from "vitest";
import { chapterHref, parseRoute, playHref } from "../src/router";

describe("parseRoute", () => {
  it("parses home, chapters, sections and glossary terms", () => {
    expect(parseRoute("")).toEqual({ page: "home" });
    expect(parseRoute("#/")).toEqual({ page: "home" });
    expect(parseRoute("#/chapter/0")).toEqual({ page: "chapter", number: 0 });
    expect(parseRoute("#/chapter/0/s/src-eniac")).toEqual({
      page: "chapter",
      number: 0,
      anchor: "src-eniac",
    });
    expect(parseRoute("#/glossary")).toEqual({ page: "glossary" });
    expect(parseRoute("#/glossary/mosfet")).toEqual({
      page: "glossary",
      term: "mosfet",
    });
  });

  it("parses the level map and level pages", () => {
    expect(parseRoute("#/levels")).toEqual({ page: "levels" });
    expect(parseRoute(playHref("nand"))).toEqual({
      page: "play",
      level: "nand",
    });
  });

  it("reports unknown routes instead of guessing", () => {
    expect(parseRoute("#/nope")).toEqual({ page: "not-found", hash: "#/nope" });
  });

  it("round-trips chapter links", () => {
    expect(parseRoute(chapterHref(3, "latches"))).toEqual({
      page: "chapter",
      number: 3,
      anchor: "latches",
    });
  });
  it("knows the machine and the assembler workshop", () => {
    expect(parseRoute("#/machine")).toEqual({ page: "machine" });
    expect(parseRoute("#/assembler")).toEqual({ page: "assembler" });
    expect(parseRoute("#/translator")).toEqual({ page: "translator" });
  });
});
