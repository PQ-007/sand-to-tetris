import { describe, expect, it } from "vitest";
import {
  connectionSummary,
  connectMenu,
  disconnectMenu,
  menuFor,
  pinMenu,
  type MenuContext,
} from "../src/editor/actions";
import { clampZoom, fitZoom, ZOOM, zoomStep } from "../src/editor/geometry";
import { nextEnabled } from "../src/editor/menu";
import {
  addPart,
  addWire,
  disconnect,
  duplicatePart,
  emptyDesign,
  movePort,
  resetPort,
  updatePart,
} from "../src/editor/model";
import type { Design } from "../src/sim/types";

function sample(): Design {
  let d = addPart(emptyDesign("and"), "nand", [200, 100]).design;
  d = addPart(d, "not", [320, 100]).design;
  d = addWire(d, { port: "a" }, { part: "nand1", pin: "a" }) as Design;
  d = addWire(
    d,
    { part: "nand1", pin: "out" },
    { part: "not1", pin: "in" },
  ) as Design;
  d = addWire(d, { part: "not1", pin: "out" }, { port: "out" }) as Design;
  return d;
}

describe("context menu edits", () => {
  it("duplicates a part with its options, beside it and unwired", () => {
    const d = updatePart(sample(), "nand1", { repeat: 4, shared: ["b"] });
    const dup = duplicatePart(d, "nand1");
    expect(dup?.id).toBe("nand2");
    const copy = dup?.design.parts.find((p) => p.id === "nand2");
    expect(copy).toEqual({
      id: "nand2",
      kind: "nand",
      pos: [240, 140],
      repeat: 4,
      shared: ["b"],
    });
    expect(dup?.design.wires).toEqual(d.wires);
    expect(duplicatePart(d, "nope")).toBeUndefined();
  });

  it("disconnects every wire of a part or a port, and nothing else", () => {
    const d = sample();
    expect(disconnect(d, { part: "not1" }).wires).toEqual([
      { from: { port: "a" }, to: { part: "nand1", pin: "a" } },
    ]);
    expect(disconnect(d, { port: "a" }).wires).toHaveLength(2);
    expect(disconnect(d, { port: "a" }).parts).toBe(d.parts);
  });

  it("puts a moved port back in its default spot", () => {
    const d = movePort(movePort(sample(), "a", [100, 50]), "out", [400, 50]);
    expect(resetPort(d, "a").port_pos).toEqual({ out: [400, 50] });
    // The field disappears once no port is moved.
    expect("port_pos" in resetPort(resetPort(d, "a"), "out")).toBe(false);
  });
});

describe("what the context menu offers", () => {
  const ctx = (over: Partial<MenuContext> = {}): MenuContext => ({
    design: sample(),
    inputs: ["a", "b"],
    outputs: ["out"],
    components: new Set(["nand", "not"]),
    canLookInside: () => true,
    hasOptions: () => true,
    tools: [
      { kind: "nand", label: "NAND" },
      { kind: "not", label: "NOT" },
    ],
    canUndo: true,
    canRedo: false,
    ...over,
  });
  const ids = (target: Parameters<typeof menuFor>[0], c = ctx()) =>
    menuFor(target, c).entries.map((e) =>
      e === "separator" ? "—" : `${e.id}${e.disabled ? "(off)" : ""}`,
    );

  it("a component part: look inside, options, duplicate, disconnect, delete", () => {
    expect(menuFor({ kind: "part", id: "nand1" }, ctx()).title).toBe(
      "nand1 (NAND)",
    );
    expect(ids({ kind: "part", id: "nand1" })).toEqual([
      "look-inside",
      "options",
      "—",
      "connect",
      "disconnect",
      "duplicate",
      "—",
      "delete",
    ]);
  });

  it("a transistor has no look inside or options; unwired can't disconnect", () => {
    let d = addPart(emptyDesign("not"), "nmos", [200, 100]).design;
    d = addPart(d, "pmos", [300, 100]).design;
    const c = ctx({
      design: d,
      components: new Set(),
      canLookInside: () => false,
      hasOptions: () => false,
    });
    expect(ids({ kind: "part", id: "n1" }, c)).toEqual([
      "connect",
      "disconnect(off)",
      "duplicate",
      "—",
      "delete",
    ]);
  });

  it("a wire can be deleted, and says what it joins", () => {
    const m = menuFor({ kind: "wire", index: 1 }, ctx());
    expect(m.title).toBe("Wire nand1.out — not1.in");
    expect(ids({ kind: "wire", index: 1 })).toEqual(["delete"]);
  });

  it("a port: flip (inputs only), disconnect, reset only when moved", () => {
    expect(ids({ kind: "port", name: "a" })).toEqual([
      "flip",
      "connect",
      "disconnect",
      "reset-port(off)",
    ]);
    const moved = ctx({ design: movePort(sample(), "out", [10, 10]) });
    expect(ids({ kind: "port", name: "out" }, moved)).toEqual([
      "connect",
      "disconnect",
      "reset-port",
    ]);
    expect(menuFor({ kind: "port", name: "a" }, ctx()).title).toBe("Input a");
  });

  it("empty canvas: add each toolbox part here, then undo and redo", () => {
    expect(ids({ kind: "canvas", at: [100, 100] })).toEqual([
      "add:nand",
      "add:not",
      "—",
      "undo",
      "redo(off)",
    ]);
  });
});

describe("connecting and disconnecting from the menu", () => {
  const endpoints = [
    { port: "a" },
    { port: "b" },
    { port: "out" },
    { part: "nand1", pin: "a" },
    { part: "nand1", pin: "b" },
    { part: "nand1", pin: "out" },
    { part: "not1", pin: "in" },
    { part: "not1", pin: "out" },
  ];

  it("asks which pin of a part to connect, with how many wires each has", () => {
    const m = pinMenu("nand1", ["a", "b", "out"], sample());
    expect(m.title).toBe("Connect which pin of nand1?");
    expect(m.entries).toEqual([
      { id: "pin:a", label: "a", hint: "1 wire" },
      { id: "pin:b", label: "b" },
      { id: "pin:out", label: "out", hint: "1 wire" },
    ]);
  });

  it("lists everything else a pin can connect to, minus what it already is", () => {
    const m = connectMenu(sample(), { part: "nand1", pin: "a" }, endpoints, [
      "a",
      "b",
    ]);
    expect(m.title).toBe("Connect nand1.a to…");
    const ids = m.entries.map((e) => (e === "separator" ? "—" : e.id));
    // Not itself, not input a (already wired to it).
    expect(ids).toEqual([
      "to:port:b",
      "to:port:out",
      "—",
      "to:pin:nand1.b",
      "to:pin:nand1.out",
      "to:pin:not1.in",
      "to:pin:not1.out",
    ]);
    const first = m.entries[0];
    expect(first !== "separator" && first?.label).toBe("input b");
  });

  it("lists a part's wires one by one, then all of them", () => {
    const m = disconnectMenu(sample(), { part: "nand1" }, ["a", "b"]);
    expect(m.title).toBe("Disconnect a wire from nand1");
    expect(m.entries).toEqual([
      { id: "wire:0", label: "a — input a" },
      { id: "wire:1", label: "out — not1.in" },
      "separator",
      { id: "all", label: "All wires", danger: true },
    ]);
    const port = disconnectMenu(sample(), { port: "out" }, ["a", "b"]);
    expect(port.entries[0]).toEqual({ id: "wire:2", label: "not1.out" });
  });

  it("describes connections for screen readers", () => {
    expect(connectionSummary(sample(), { part: "nand1" }, ["a", "b"])).toBe(
      "a: input a; out: not1.in",
    );
    expect(connectionSummary(sample(), { port: "out" }, ["a", "b"])).toBe(
      "not1.out",
    );
    expect(connectionSummary(sample(), { port: "b" }, ["a", "b"])).toBe("");
  });
});

describe("zoom", () => {
  it("steps through comfortable levels and stays in range", () => {
    expect(zoomStep(1, 1)).toBe(1.25);
    expect(zoomStep(1, -1)).toBe(0.9);
    expect(zoomStep(0.8, 1)).toBe(0.9);
    expect(zoomStep(ZOOM.max, 1)).toBe(ZOOM.max);
    expect(zoomStep(ZOOM.min, -1)).toBe(ZOOM.min);
    expect(clampZoom(10)).toBe(ZOOM.max);
  });

  it("fits a circuit in the visible pane, never above 150%", () => {
    const pane = { width: 800, height: 600 };
    expect(fitZoom({ x: 0, y: 0, width: 1520, height: 400 }, pane)).toBe(0.5);
    expect(fitZoom({ x: 0, y: 0, width: 100, height: 100 }, pane)).toBe(1.5);
    expect(fitZoom({ x: 0, y: 0, width: 99999, height: 99999 }, pane)).toBe(
      ZOOM.min,
    );
  });
});

describe("menu keyboard navigation", () => {
  const off = [false, true, false, false, true];
  it("skips disabled items and wraps around", () => {
    expect(nextEnabled(off, 0, 1)).toBe(2);
    expect(nextEnabled(off, 3, 1)).toBe(0);
    expect(nextEnabled(off, 0, -1)).toBe(3);
    expect(nextEnabled(off, -1, 1)).toBe(0);
    expect(nextEnabled([true, true], 0, 1)).toBe(-1);
  });
});
