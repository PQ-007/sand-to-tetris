import { describe, expect, it } from "vitest";
import { chapterHref, parseRoute } from "../src/router";

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
});
