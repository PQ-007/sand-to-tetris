import { describe, expect, it } from "vitest";
import {
  CANVAS,
  freeSpot,
  pinPoint,
  portPoint,
  route,
  shapeOf,
  snap,
} from "../src/editor/geometry";
import {
  addPart,
  addWire,
  emptyDesign,
  endpointKey,
  endpointLabel,
  History,
  movePart,
  nextId,
  removePart,
  removeWire,
} from "../src/editor/model";

describe("editing a design", () => {
  it("names parts by kind", () => {
    let d = emptyDesign("not");
    d = addPart(d, "pmos", [100, 100]).design;
    d = addPart(d, "pmos", [200, 100]).design;
    expect(nextId(d, "pmos")).toBe("p3");
    expect(nextId(d, "nmos")).toBe("n1");
    expect(nextId(d, "vdd")).toBe("vdd1");
    expect(nextId(d, "nand")).toBe("nand1");
  });

  it("connects endpoints once, never to themselves", () => {
    const d = addPart(emptyDesign("not"), "nmos", [100, 100]).design;
    const a = { port: "a" };
    const g = { part: "n1", pin: "gate" };
    const d2 = addWire(d, a, g);
    expect(typeof d2).toBe("object");
    expect(addWire(d2 as never, g, a)).toBe("Those two are already connected.");
    expect(addWire(d, a, a)).toBe("A wire needs two different ends.");
  });

  it("removing a part removes its wires", () => {
    let d = addPart(emptyDesign("not"), "nmos", [100, 100]).design;
    d = addWire(d, { port: "a" }, { part: "n1", pin: "gate" }) as typeof d;
    d = addWire(d, { port: "out" }, { port: "a" }) as typeof d;
    d = removePart(d, "n1");
    expect(d.parts).toEqual([]);
    expect(d.wires).toEqual([{ from: { port: "out" }, to: { port: "a" } }]);
    expect(removeWire(d, 0).wires).toEqual([]);
  });

  it("undo and redo step through changes; replace doesn't add a step", () => {
    const h = new History(emptyDesign("not"));
    h.apply(addPart(h.current, "nmos", [100, 100]).design);
    h.replace(movePart(h.current, "n1", [120, 100]));
    h.replace(movePart(h.current, "n1", [140, 100]));
    expect(h.current.parts[0]?.pos).toEqual([140, 100]);
    h.undo();
    expect(h.current.parts).toEqual([]);
    expect(h.canRedo()).toBe(true);
    h.redo();
    expect(h.current.parts[0]?.pos).toEqual([140, 100]);
    h.apply(removePart(h.current, "n1"));
    expect(h.canRedo()).toBe(false);
  });

  it("labels endpoints for people", () => {
    expect(endpointKey({ part: "p1", pin: "gate" })).toBe("pin:p1.gate");
    expect(endpointLabel({ port: "a" }, ["a"])).toBe("input a");
    expect(endpointLabel({ port: "out" }, ["a"])).toBe("output out");
    expect(endpointLabel({ part: "p1", pin: "gate" })).toBe("p1.gate");
  });
});

describe("layout", () => {
  it("gives transistors a gate and two channel ends", () => {
    expect(shapeOf("nmos").pins.map((p) => p.pin)).toEqual([
      "gate",
      "drain",
      "source",
    ]);
    expect(pinPoint([100, 100], shapeOf("pmos"), "source")).toEqual([110, 70]);
    expect(pinPoint([100, 100], shapeOf("pmos"), "nope")).toBeUndefined();
  });

  it("lays out component pins: inputs left, outputs right", () => {
    const s = shapeOf("nand", { inputs: ["a", "b"], outputs: ["out"] });
    const [a, b, out] = s.pins;
    expect(a?.at[0]).toBeLessThan(0);
    expect(out?.at[0]).toBeGreaterThan(0);
    expect(a?.at[1]).toBeLessThan(b?.at[1] ?? 0);
    expect(out?.at[1]).toBe(((a?.at[1] ?? 0) + (b?.at[1] ?? 0)) / 2);
  });

  it("puts inputs on the left edge and outputs on the right", () => {
    const [ax] = portPoint("a", ["a", "b"], ["out"]) ?? [0];
    const [ox] = portPoint("out", ["a", "b"], ["out"]) ?? [0];
    expect(ax).toBeLessThan(CANVAS.width / 2);
    expect(ox).toBeGreaterThan(CANVAS.width / 2);
    expect(portPoint("zz", ["a"], ["out"])).toBeUndefined();
  });

  it("routes wires at right angles and snaps to the grid", () => {
    expect(route([0, 0], [100, 50])).toEqual([
      [0, 0],
      [50, 0],
      [50, 50],
      [100, 50],
    ]);
    expect(route([0, 0], [0, 50])).toEqual([
      [0, 0],
      [0, 50],
    ]);
    expect(snap([14, 26])).toEqual([10, 30]);
  });

  it("finds free space for new parts", () => {
    const first = freeSpot([]);
    const second = freeSpot([first]);
    expect(second).not.toEqual(first);
  });
});

describe("bus parts", () => {
  it("a splitter has the bus on the left and one pin per bit on the right", async () => {
    const { shapeOfPart } = await import("../src/editor/geometry");
    const s = shapeOfPart({ id: "s", kind: "split", width: 4 }, {});
    expect(s.pins.map((p) => p.pin)).toEqual(["in", "0", "1", "2", "3"]);
    expect(s.pins[0]?.side).toBe("left");
    expect(s.pins[4]?.side).toBe("right");
    expect(s.height).toBeGreaterThan(4 * 12);
  });

  it("a joiner is the mirror image", async () => {
    const { shapeOfPart } = await import("../src/editor/geometry");
    const s = shapeOfPart({ id: "j", kind: "join", width: 2 }, {});
    expect(s.pins.map((p) => [p.pin, p.side])).toEqual([
      ["0", "left"],
      ["1", "left"],
      ["out", "right"],
    ]);
  });

  it("a repeated component keeps its component shape", async () => {
    const { shapeOfPart } = await import("../src/editor/geometry");
    const ports = {
      and: { inputs: ["a", "b"], outputs: ["out"], name: "AND" },
    };
    const plain = shapeOfPart({ id: "g", kind: "and" }, ports);
    const rep = shapeOfPart({ id: "g", kind: "and", repeat: 16 }, ports);
    expect(rep.pins).toEqual(plain.pins);
  });

  it("pin widths account for repeat and shared pins", async () => {
    const { pinWidth } = await import("../src/editor/geometry");
    const ports = {
      mux: {
        inputs: ["a", "b", "sel"],
        outputs: ["out"],
        name: "MUX",
        widths: {},
      },
    };
    const part = { id: "m", kind: "mux", repeat: 16, shared: ["sel"] };
    expect(pinWidth(part, "a", ports)).toBe(16);
    expect(pinWidth(part, "sel", ports)).toBe(1);
    expect(pinWidth({ id: "s", kind: "split", width: 8 }, "in", ports)).toBe(8);
    expect(pinWidth({ id: "s", kind: "split", width: 8 }, "3", ports)).toBe(1);
  });
});

describe("part options", () => {
  it("new splitters and joiners start 16 bits wide", async () => {
    const { addPart, emptyDesign } = await import("../src/editor/model");
    const { design } = addPart(emptyDesign("x"), "split", [100, 100]);
    expect(design.parts[0]).toMatchObject({
      id: "split1",
      kind: "split",
      width: 16,
    });
  });

  it("narrowing a splitter drops wires to bits that no longer exist", async () => {
    const { addPart, addWire, emptyDesign, updatePart } =
      await import("../src/editor/model");
    let d = addPart(emptyDesign("x"), "split", [100, 100]).design;
    d = addWire(d, { port: "a" }, { part: "split1", pin: "in" }) as typeof d;
    d = addWire(d, { part: "split1", pin: "2" }, { port: "out" }) as typeof d;
    d = addWire(d, { part: "split1", pin: "9" }, { port: "out" }) as typeof d;
    d = updatePart(d, "split1", { width: 8 });
    expect(d.parts[0]?.width).toBe(8);
    expect(d.wires.map((w) => ("pin" in w.from ? w.from.pin : "port"))).toEqual(
      ["port", "2"],
    );
  });

  it("repeat 1 removes repeat and shared", async () => {
    const { updatePart } = await import("../src/editor/model");
    const d = {
      format: 1 as const,
      component: "x",
      parts: [{ id: "m", kind: "mux", repeat: 16, shared: ["sel"] }],
      wires: [],
    };
    expect(updatePart(d, "m", { repeat: 1 }).parts[0]).toEqual({
      id: "m",
      kind: "mux",
    });
  });
});

describe("canvas size", () => {
  it("never shrinks below the default and grows with far parts", async () => {
    const { canvasSize, CANVAS, MAX_CANVAS, shapeOf } =
      await import("../src/editor/geometry");
    const s = shapeOf("nmos");
    expect(canvasSize([])).toEqual(CANVAS);
    const big = canvasSize([{ pos: [1500, 900], shape: s }]);
    expect(big.width).toBeGreaterThanOrEqual(1500 + 200);
    expect(big.height).toBeGreaterThanOrEqual(900 + 80);
    expect(canvasSize([{ pos: [99999, 99999], shape: s }])).toEqual(MAX_CANVAS);
  });
});
