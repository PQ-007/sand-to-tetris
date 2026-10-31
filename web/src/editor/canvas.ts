// The schematic editor: an SVG canvas you build circuits on.
//
// Mouse/touch: drag parts from the toolbox, drag parts to move them, drag
// from one pin to another (or click one pin, then another) to wire them,
// click a wire or part to select it, Delete removes, Escape cancels.
// Keyboard: Tab to a part, arrow keys move it, Delete removes it. Wiring by
// keyboard happens in the play page's connections panel.
//
// Every wire shows its value as text (0, 1, Z, X), not just colour, and
// every transistor says "on" or "off".
import { svg } from "../components/kit";
import type { Design, Endpoint, Part, SimView, Value } from "../sim/types";
import {
  CANVAS,
  clampToCanvas,
  labelPoint,
  pathData,
  pinPoint,
  portPoint,
  route,
  canvasSize,
  shapeOfPart,
  type ComponentPorts,
  type Size,
  snap,
  type Point,
  type Shape,
} from "./geometry";
import {
  addWire,
  endpointKey,
  movePart,
  removePart,
  removeWire,
  sameEndpoint,
} from "./model";

export interface CanvasProps {
  design: Design;
  inputs: string[];
  outputs: string[];
  /** Port lists of component kinds, for drawing them as boxes. */
  componentPorts: ComponentPorts;
  /** Bits per port of the component being built. */
  portWidths?: Record<string, number>;
  view: SimView | null;
  inputValues: Record<string, number>;
  highlightParts: Set<string>;
  highlightPorts: Set<string>;
  readOnly?: boolean;
}

export interface CanvasEvents {
  /** `commit` is false for intermediate states (mid-drag). */
  change(design: Design, commit: boolean): void;
  toggleInput(name: string): void;
  openPart(id: string): void;
  message(text: string): void;
  /** The selected part changed (null: nothing selected). */
  select?(partId: string | null): void;
}

type Selection =
  { kind: "part"; id: string } | { kind: "wire"; index: number } | null;

type Mode =
  | { kind: "idle" }
  | {
      kind: "drag";
      id: string;
      offset: Point;
      start: Point;
      moved: boolean;
      base: Design;
    }
  | { kind: "wire"; from: Endpoint; start: Point; moved: boolean };

const NAMES: Record<string, string> = {
  pmos: "PMOS",
  nmos: "NMOS",
  vdd: "VDD",
  gnd: "GND",
};

export class CircuitCanvas {
  readonly el: SVGSVGElement;
  private props!: CanvasProps;
  private selection: Selection = null;
  private mode: Mode = { kind: "idle" };
  /** First pin of a click-click wire. */
  private pending: Endpoint | null = null;
  private pointer: Point = [0, 0];
  private focusPart: string | null = null;
  private size: Size = CANVAS;
  /** For double-click detection: the canvas re-renders between clicks, so
   * the browser's own dblclick event doesn't reliably fire. */
  private lastPress: { id: string; time: number } | null = null;

  constructor(private events: CanvasEvents) {
    this.el = svg("svg", {
      viewBox: `0 0 ${CANVAS.width} ${CANVAS.height}`,
      class: "circuit",
      role: "application",
      "aria-label": "Circuit canvas",
      tabindex: 0,
    });
    this.el.addEventListener("pointerdown", (e) => this.onDown(e));
    this.el.addEventListener("pointermove", (e) => this.onMove(e));
    this.el.addEventListener("pointerup", (e) => this.onUp(e));
    this.el.addEventListener("keydown", (e) => this.onKey(e));
  }

  render(props: CanvasProps): void {
    this.props = props;
    const active = document.activeElement;
    const focused =
      active instanceof SVGElement ? active.dataset.part : undefined;
    this.el.replaceChildren();
    this.el.classList.toggle("read-only", Boolean(props.readOnly));
    // Grow with the circuit: real pixels, scrolled by the wrapper, so text
    // never shrinks on big designs.
    this.size = canvasSize(
      props.design.parts.map((p) => ({ pos: p.pos, shape: this.shape(p) })),
    );
    this.el.setAttribute(
      "viewBox",
      `0 0 ${this.size.width} ${this.size.height}`,
    );
    this.el.style.width = `${this.size.width}px`;
    this.drawGrid();
    this.drawWires();
    for (const part of props.design.parts) this.drawPart(part);
    this.drawPorts();
    this.drawPendingWire();
    // Keep keyboard focus on the part being moved.
    const keep = focused ?? this.focusPart;
    if (keep)
      this.el
        .querySelector<SVGGElement>(`[data-part="${CSS.escape(keep)}"]`)
        ?.focus();
    this.focusPart = null;
  }

  /** Converts a client (screen) position to canvas coordinates. */
  toCanvas(clientX: number, clientY: number): Point {
    const m = this.el.getScreenCTM();
    if (!m) return [clientX, clientY];
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  // ---- geometry ---------------------------------------------------------------

  private shape(part: Part): Shape {
    return shapeOfPart(part, this.props.componentPorts);
  }

  private point(e: Endpoint): Point | undefined {
    if ("port" in e)
      return portPoint(
        e.port,
        this.props.inputs,
        this.props.outputs,
        this.size,
      );
    const part = this.props.design.parts.find((p) => p.id === e.part);
    if (!part?.pos) return undefined;
    return pinPoint(part.pos, this.shape(part), e.pin);
  }

  private value(e: Endpoint): Value | undefined {
    return this.props.view?.values.find((v) => sameEndpoint(v.endpoint, e))
      ?.value;
  }

  private width(e: Endpoint): number {
    return (
      this.props.view?.values.find((v) => sameEndpoint(v.endpoint, e))?.width ??
      1
    );
  }

  // ---- drawing ----------------------------------------------------------------

  private drawGrid(): void {
    const defs = svg("defs", {}, this.el);
    const pat = svg(
      "pattern",
      { id: "grid", width: 20, height: 20, patternUnits: "userSpaceOnUse" },
      defs,
    );
    svg("circle", { cx: 0, cy: 0, r: 1, class: "grid-dot" }, pat);
    svg(
      "rect",
      {
        width: this.size.width,
        height: this.size.height,
        fill: "url(#grid)",
        class: "canvas-bg",
      },
      this.el,
    );
  }

  private drawWires(): void {
    const g = svg("g", { class: "wires" }, this.el);
    this.props.design.wires.forEach((w, i) => {
      const a = this.point(w.from);
      const b = this.point(w.to);
      if (!a || !b) return;
      const v = this.value(w.from) ?? "X";
      const bus = this.width(w.from) > 1;
      const pts = route(a, b);
      const selected =
        this.selection?.kind === "wire" && this.selection.index === i;
      const wg = svg(
        "g",
        {
          class: `wire ${valueClass(v)}${bus ? " bus" : ""}${selected ? " selected" : ""}`,
          "data-wire": i,
        },
        g,
      );
      svg("path", { d: pathData(pts), class: "wire-hit" }, wg);
      svg("path", { d: pathData(pts), class: "wire-line" }, wg);
      const [lx, ly] = labelPoint(pts);
      const tagWidth = Math.max(16, v.length * 7 + 8);
      svg(
        "rect",
        {
          x: lx - tagWidth / 2,
          y: ly - 9,
          width: tagWidth,
          height: 16,
          rx: 4,
          class: "wire-tag",
        },
        wg,
      );
      svg(
        "text",
        { x: lx, y: ly + 3, "text-anchor": "middle", class: "wire-value" },
        wg,
        v,
      );
    });
  }

  private drawPart(part: Part): void {
    const { id, kind } = part;
    const pos = part.pos ?? [CANVAS.width / 2, CANVAS.height / 2];
    const shape = this.shape(part);
    const state = this.props.view?.transistors.find(
      (t) => t.part === id,
    )?.state;
    const selected =
      this.selection?.kind === "part" && this.selection.id === id;
    const flagged = this.props.highlightParts.has(id);
    const shorted =
      this.props.view?.shorts.some((s) => s.includes(id)) ?? false;
    const base = NAMES[kind] ?? this.props.componentPorts[kind]?.name ?? kind;
    const name =
      part.repeat && part.repeat > 1 ? `${base} ×${part.repeat}` : base;
    const g = svg(
      "g",
      {
        class: `part kind-${kind}${selected ? " selected" : ""}${flagged ? " flagged" : ""}${shorted ? " shorted" : ""}${state ? ` ${state}` : ""}`,
        transform: `translate(${pos[0]},${pos[1]})`,
        "data-part": id,
        tabindex: 0,
        role: "button",
        "aria-label": `${name} ${id}${state ? `, ${state}` : ""}${shorted ? ", part of a short circuit" : ""}. Arrow keys move it, Delete removes it.`,
      },
      this.el,
    );
    svg(
      "rect",
      {
        x: -shape.width / 2 - 6,
        y: -shape.height / 2 - 6,
        width: shape.width + 12,
        height: shape.height + 12,
        rx: 8,
        class: "part-hit",
      },
      g,
    );
    const line = (d: string, cls = "sym") => svg("path", { d, class: cls }, g);
    switch (kind) {
      case "nmos":
      case "pmos": {
        const p = kind === "pmos";
        line(`M-30,0 H${p ? -20 : -12}`);
        if (p) svg("circle", { cx: -16, cy: 0, r: 4, class: "sym bubble" }, g);
        line("M-12,-16 V16");
        line("M-4,-20 V20", "sym channel");
        line("M-4,-16 H10 V-30");
        line("M-4,16 H10 V30");
        svg("text", { x: 16, y: -3, class: "part-label" }, g, id);
        svg("text", { x: 16, y: 12, class: "part-state" }, g, state ?? "");
        break;
      }
      case "vdd":
        line("M-18,-5 H18 M0,-5 V15");
        svg(
          "text",
          { x: 0, y: -10, "text-anchor": "middle", class: "part-label" },
          g,
          "VDD",
        );
        break;
      case "gnd":
        line("M0,-15 V0 M-16,0 H16 M-10,5 H10 M-4,10 H4");
        svg("text", { x: 22, y: 6, class: "part-label" }, g, "GND");
        break;
      case "split":
      case "join": {
        svg(
          "rect",
          {
            x: -4,
            y: -shape.height / 2,
            width: 8,
            height: shape.height,
            rx: 3,
            class: "bus-bar",
          },
          g,
        );
        svg(
          "text",
          {
            x: 0,
            y: -shape.height / 2 - 6,
            "text-anchor": "middle",
            class: "part-label",
          },
          g,
          `${kind === "split" ? "Split" : "Join"} ${part.width ?? ""}`,
        );
        for (const pin of shape.pins) {
          if (pin.pin === "in" || pin.pin === "out") continue;
          const right = pin.side === "right";
          svg(
            "text",
            {
              x: pin.at[0] + (right ? 8 : -8),
              y: pin.at[1] + 3,
              "text-anchor": right ? "start" : "end",
              class: "bit-label",
            },
            g,
            pin.pin,
          );
        }
        break;
      }
      default: {
        svg(
          "rect",
          {
            x: -shape.width / 2,
            y: -shape.height / 2,
            width: shape.width,
            height: shape.height,
            rx: 6,
            class: "box",
          },
          g,
        );
        svg(
          "text",
          {
            x: 0,
            y: -shape.height / 2 - 6,
            "text-anchor": "middle",
            class: "part-label",
          },
          g,
          `${name} ${id}`,
        );
        for (const pin of shape.pins) {
          const right = pin.side === "right";
          svg(
            "text",
            {
              x: pin.at[0] + (right ? -6 : 6),
              y: pin.at[1] + 4,
              "text-anchor": right ? "end" : "start",
              class: "pin-label",
            },
            g,
            part.shared?.includes(pin.pin) ? `${pin.pin} (shared)` : pin.pin,
          );
        }
      }
    }
    if (flagged || shorted)
      svg(
        "text",
        {
          x: -shape.width / 2 - 4,
          y: -shape.height / 2 - 2,
          class: "flag-mark",
        },
        g,
        "!",
      );
    const small = kind === "split" || kind === "join";
    for (const pin of shape.pins) {
      const end: Endpoint = { part: id, pin: pin.pin };
      const pending = this.pending && sameEndpoint(this.pending, end);
      const v = this.value(end);
      svg(
        "circle",
        {
          cx: pin.at[0],
          cy: pin.at[1],
          r: small ? 6.5 : 10,
          class: "pin-hit",
          "data-pin": pin.pin,
          "data-owner": id,
        },
        g,
      );
      svg(
        "circle",
        {
          cx: pin.at[0],
          cy: pin.at[1],
          r: small ? 3.5 : 4.5,
          class: `pin ${valueClass(v ?? "X")}${pending ? " pending" : ""}`,
          "data-pin": pin.pin,
          "data-owner": id,
        },
        g,
      );
    }
  }

  private drawPorts(): void {
    const { inputs, outputs, inputValues, view } = this.props;
    for (const name of [...inputs, ...outputs]) {
      const at = portPoint(name, inputs, outputs, this.size);
      if (!at) continue;
      const isIn = inputs.includes(name);
      const value = isIn
        ? String(inputValues[name] ?? 0)
        : (view?.outputs.find(([n]) => n === name)?.[1] ?? "–");
      const flagged = this.props.highlightPorts.has(name);
      const bus = (this.props.portWidths?.[name] ?? 1) > 1;
      const g = svg(
        "g",
        {
          class: `port ${isIn ? "in" : "out"} ${valueClass(value)}${bus ? " bus" : ""}${flagged ? " flagged" : ""}`,
          transform: `translate(${at[0]},${at[1]})`,
          "data-port": name,
        },
        this.el,
      );
      const label = `${name} = ${value}`;
      const boxW = Math.max(50, label.length * 7.5 + 12);
      const x = isIn ? -boxW - 8 : 8;
      svg(
        "rect",
        { x, y: -15, width: boxW, height: 30, rx: 6, class: "port-box" },
        g,
      );
      svg(
        "text",
        { x: x + boxW / 2, y: 5, "text-anchor": "middle", class: "port-label" },
        g,
        label,
      );
      if (isIn)
        svg(
          "title",
          {},
          g,
          bus
            ? `Input ${name}: click to type a number`
            : `Input ${name}: click to flip between 0 and 1`,
        );
      const pending =
        this.pending && "port" in this.pending && this.pending.port === name;
      svg(
        "circle",
        { cx: 0, cy: 0, r: 10, class: "pin-hit", "data-port-pin": name },
        g,
      );
      svg(
        "circle",
        {
          cx: 0,
          cy: 0,
          r: 5,
          class: `pin ${valueClass(value)}${pending ? " pending" : ""}`,
          "data-port-pin": name,
        },
        g,
      );
    }
  }

  private drawPendingWire(): void {
    const from = this.mode.kind === "wire" ? this.mode.from : this.pending;
    if (!from) return;
    const a = this.point(from);
    if (!a) return;
    svg(
      "path",
      { d: pathData(route(a, snap(this.pointer))), class: "wire-draft" },
      this.el,
    );
  }

  // ---- interaction ------------------------------------------------------------

  private endpointAt(target: EventTarget | null): Endpoint | null {
    if (!(target instanceof Element)) return null;
    const pin = target.closest<SVGElement>("[data-pin]");
    if (pin?.dataset.owner && pin.dataset.pin)
      return { part: pin.dataset.owner, pin: pin.dataset.pin };
    const port = target.closest<SVGElement>("[data-port-pin]");
    if (port?.dataset.portPin) return { port: port.dataset.portPin };
    return null;
  }

  private connect(a: Endpoint, b: Endpoint): void {
    const next = addWire(this.props.design, a, b);
    if (typeof next === "string") {
      this.events.message(next);
      return;
    }
    this.events.change(next, true);
  }

  private onDown(e: PointerEvent): void {
    if (this.props.readOnly) {
      const id =
        e.target instanceof Element
          ? e.target.closest<SVGGElement>("[data-part]")?.dataset.part
          : undefined;
      if (id) this.doublePress(id);
      return;
    }
    this.pointer = this.toCanvas(e.clientX, e.clientY);
    const end = this.endpointAt(e.target);
    if (end) {
      e.preventDefault();
      if (this.pending && !sameEndpoint(this.pending, end)) {
        const from = this.pending;
        this.pending = null;
        this.connect(from, end);
        return;
      }
      this.el.setPointerCapture(e.pointerId);
      this.mode = {
        kind: "wire",
        from: end,
        start: this.pointer,
        moved: false,
      };
      return;
    }
    this.pending = null;
    const target = e.target instanceof Element ? e.target : null;
    const port = target?.closest<SVGElement>(".port.in");
    if (port?.dataset.port) {
      this.events.toggleInput(port.dataset.port);
      return;
    }
    const partEl = target?.closest<SVGGElement>("[data-part]");
    if (partEl?.dataset.part) {
      const id = partEl.dataset.part;
      if (this.doublePress(id)) return;
      const part = this.props.design.parts.find((p) => p.id === id);
      if (!part?.pos) return;
      this.selection = { kind: "part", id };
      this.events.select?.(id);
      this.el.setPointerCapture(e.pointerId);
      this.mode = {
        kind: "drag",
        id,
        offset: [part.pos[0] - this.pointer[0], part.pos[1] - this.pointer[1]],
        start: this.pointer,
        moved: false,
        base: this.props.design,
      };
      this.focusPart = id;
      this.render(this.props);
      return;
    }
    const wireEl = target?.closest<SVGGElement>("[data-wire]");
    this.events.select?.(null);
    this.selection = wireEl
      ? { kind: "wire", index: Number(wireEl.dataset.wire) }
      : null;
    this.render(this.props);
  }

  private onMove(e: PointerEvent): void {
    this.pointer = this.toCanvas(e.clientX, e.clientY);
    const m = this.mode;
    if (m.kind === "drag") {
      const dist = Math.hypot(
        this.pointer[0] - m.start[0],
        this.pointer[1] - m.start[1],
      );
      if (!m.moved && dist < 3) return;
      m.moved = true;
      const pos = clampToCanvas(
        snap([this.pointer[0] + m.offset[0], this.pointer[1] + m.offset[1]]),
      );
      this.events.change(movePart(m.base, m.id, pos), false);
    } else if (m.kind === "wire" || this.pending) {
      if (
        m.kind === "wire" &&
        Math.hypot(this.pointer[0] - m.start[0], this.pointer[1] - m.start[1]) >
          4
      )
        m.moved = true;
      this.render(this.props);
    }
  }

  private onUp(e: PointerEvent): void {
    const m = this.mode;
    this.mode = { kind: "idle" };
    if (m.kind === "drag") {
      if (m.moved) this.events.change(this.props.design, true);
      return;
    }
    if (m.kind === "wire") {
      const under = this.endpointAt(
        document.elementFromPoint(e.clientX, e.clientY),
      );
      if (under && !sameEndpoint(under, m.from)) {
        this.connect(m.from, under);
      } else if (!m.moved) {
        // A click on a pin: wait for a click on the other end.
        this.pending = m.from;
        this.events.message(
          "Now click the pin to connect it to (Escape cancels).",
        );
        this.render(this.props);
      } else {
        this.render(this.props);
      }
    }
  }

  /** True (and opens the part) if this press is the second of a double-click. */
  private doublePress(id: string): boolean {
    const now = performance.now();
    const double = this.lastPress?.id === id && now - this.lastPress.time < 400;
    this.lastPress = double ? null : { id, time: now };
    const part = this.props.design.parts.find((p) => p.id === id);
    if (double && part && this.props.componentPorts[part.kind]) {
      this.events.openPart(id);
      return true;
    }
    return false;
  }

  private onKey(e: KeyboardEvent): void {
    const focused =
      e.target instanceof SVGElement ? e.target.dataset.part : undefined;
    if (this.props.readOnly) {
      const part = this.props.design.parts.find((p) => p.id === focused);
      if (
        e.key === "Enter" &&
        focused &&
        part &&
        this.props.componentPorts[part.kind]
      )
        this.events.openPart(focused);
      return;
    }
    if (e.key === "Escape") {
      this.pending = null;
      this.selection = null;
      this.render(this.props);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      const sel = focused
        ? { kind: "part" as const, id: focused }
        : this.selection;
      if (sel?.kind === "part")
        this.events.change(removePart(this.props.design, sel.id), true);
      if (sel?.kind === "wire")
        this.events.change(removeWire(this.props.design, sel.index), true);
      this.selection = null;
      return;
    }
    if (e.key === "Enter" && focused) {
      const part = this.props.design.parts.find((p) => p.id === focused);
      if (part && this.props.componentPorts[part.kind])
        this.events.openPart(focused);
      return;
    }
    const step = e.shiftKey ? 50 : 10;
    const delta: Record<string, Point> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[e.key];
    if (d && focused) {
      e.preventDefault();
      const part = this.props.design.parts.find((p) => p.id === focused);
      if (!part?.pos) return;
      this.focusPart = focused;
      this.events.change(
        movePart(
          this.props.design,
          focused,
          clampToCanvas([part.pos[0] + d[0], part.pos[1] + d[1]]),
        ),
        true,
      );
    }
  }

  /** Used by the keyboard panel: highlight what's selected there. */
  select(sel: Selection): void {
    this.selection = sel;
    this.render(this.props);
  }

  /** Key of every endpoint currently drawn, for the connections panel. */
  endpoints(): Endpoint[] {
    const out: Endpoint[] = [];
    for (const p of [...this.props.inputs, ...this.props.outputs])
      out.push({ port: p });
    for (const part of this.props.design.parts) {
      for (const pin of this.shape(part).pins)
        out.push({ part: part.id, pin: pin.pin });
    }
    return out.sort((a, b) => endpointKey(a).localeCompare(endpointKey(b)));
  }
}

/** CSS class for a value: v0, v1, vZ, vX for bits; buses are vbus unless
 * some bit is unknown (vX) or floating (vZ). */
export function valueClass(v: string): string {
  if (v === "0" || v === "1" || v === "Z" || v === "X") return `v${v}`;
  if (v.includes("X")) return "vX";
  if (v.includes("Z")) return "vZ";
  return "vbus";
}
