// A level page: goal, toolbox, canvas, inputs, live truth table and Check.
// Keyboard and screen-reader users work on the canvas itself: parts and
// ports are focusable, say what they're wired to, and the actions menu
// (menu key / Shift+F10) connects and disconnects them.
import { fastIds, getApp, levelEntry, saveDesign, type App } from "./app";
import {
  connectMenu,
  disconnectMenu,
  menuFor,
  pinMenu,
  type MenuContext,
  type MenuTarget,
} from "./editor/actions";
import { CircuitCanvas, type CanvasProps } from "./editor/canvas";
import {
  clampToCanvas,
  freeSpot,
  snap,
  zoomStep,
  type Point,
} from "./editor/geometry";
import { openMenu } from "./editor/menu";
import {
  addPart,
  addWire,
  disconnect,
  duplicatePart,
  emptyDesign,
  endpointKey,
  endpointLabel,
  History,
  removePart,
  removeWire,
  resetPort,
  updatePart,
} from "./editor/model";
import { orderLevels, playLibrary, toolbox, type ToolboxItem } from "./game";
import { playHref } from "./router";
import { check, simulate } from "./sim/core";
import type {
  Design,
  Diagnostic,
  Endpoint,
  LevelInfo,
  Level,
  LibraryInput,
  Report,
  SimView,
} from "./sim/types";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Message text with `backticked` names shown as code. */
function rich(text: string): Node[] {
  return text.split("`").map((part, i) => {
    if (i % 2 === 0) return document.createTextNode(part);
    const code = document.createElement("code");
    code.textContent = part;
    return code;
  });
}

/** Ports of every component kind, for drawing component boxes. */
function componentPorts(a: App): CanvasProps["componentPorts"] {
  const out: CanvasProps["componentPorts"] = {};
  for (const l of a.levels) {
    out[l.info.level.id] = {
      inputs: l.info.level.inputs,
      outputs: l.info.level.outputs,
      name: l.info.level.name,
      widths: l.info.level.widths,
    };
  }
  return out;
}

/** `5 (0101)` for small buses, `0x1235` for wide ones (as the checker). */
export function formatValue(v: number, width: number): string {
  if (width === 1) return String(v);
  if (width <= 8) return `${v} (${v.toString(2).padStart(width, "0")})`;
  return `0x${v.toString(16).padStart(Math.ceil(width / 4), "0")}`;
}

/** Parses `13`, `0xd` or `0b1101` (underscores allowed). */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(/_/g, "").toLowerCase();
  const n = t.startsWith("0x")
    ? parseInt(t.slice(2), 16)
    : t.startsWith("0b")
      ? parseInt(t.slice(2), 2)
      : /^\d+$/.test(t)
        ? Number(t)
        : NaN;
  return Number.isFinite(n) && /^(0x[0-9a-f]+|0b[01]+|\d+)$/.test(t)
    ? n
    : undefined;
}

/** Inputs to a component part, read from the parent's simulated pins. */
function partInputs(
  view: SimView | null,
  partId: string,
  inputs: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name of inputs) {
    const v = view?.values.find(
      (x) =>
        "part" in x.endpoint &&
        x.endpoint.part === partId &&
        x.endpoint.pin === name,
    )?.value;
    if (v !== undefined && /^\d+$/.test(v)) out[name] = Number(v);
  }
  return out;
}

export async function mountPlay(
  root: HTMLElement,
  levelId: string,
): Promise<void> {
  root.innerHTML = `<p class="loading">Loading the simulator…</p>`;
  const a = await getApp();
  const entry = levelEntry(a, levelId);
  if (!entry) {
    root.innerHTML = `<div class="narrow-page"><h1 tabindex="-1">No such level</h1><p><a href="#/levels">Back to the level map</a></p></div>`;
    return;
  }
  const level = entry.info.level;
  const status = a.status[levelId];
  if (status === "locked") {
    const need = level.requires.filter((r) => a.status[r] !== "passed");
    root.innerHTML = `<div class="narrow-page"><h1 tabindex="-1">${esc(level.name)} is locked</h1>
      <p>Pass ${need.map((r) => `<a href="${playHref(r)}">${esc(levelEntry(a, r)?.info.level.name ?? r)}</a>`).join(" and ")} first.</p>
      <p><a href="#/levels">Back to the level map</a></p></div>`;
    return;
  }
  new PlayPage(root, a, level, entry.info.table);
}

class PlayPage {
  private history: History;
  private inputs: Record<string, number> = {};
  private view: SimView | null = null;
  private highlightParts = new Set<string>();
  private highlightPorts = new Set<string>();
  private canvas: CircuitCanvas;
  private library: LibraryInput;
  private tools: ToolboxItem[];
  private ports: CanvasProps["componentPorts"];
  private saveTimer = 0;
  private dropped = false;

  // DOM
  private statusLine = el("p", {
    class: "editor-status",
    "aria-live": "polite",
  });
  private statusTimer = 0;
  private emptyHint = el("p", { class: "canvas-empty" });
  private zoomLabel = el(
    "button",
    { type: "button", title: "Reset to 100% (0)" },
    "100%",
  );
  private undoBtn = el("button", { type: "button" }, "Undo");
  private redoBtn = el("button", { type: "button" }, "Redo");
  private inputBox = el("div", { class: "input-toggles" });
  private tableBody = el("tbody");
  /** What the live circuit holds (sequential levels): fed back into every
   * simulation so latches and flip-flops remember. */
  private memory: Record<string, string> = {};
  /** For sequential levels: the state after each test step, and the step
   * the canvas is showing (null once the learner changes something). */
  private stepStates: Record<string, string>[] = [];
  private currentStep: number | null = null;
  private result = el("div", { class: "check-result", "aria-live": "polite" });
  private problemList = el("ul", { class: "problems" });
  private inside = el("div", { class: "inside", hidden: "" });
  private stats = el("p", { class: "sim-stats", "aria-live": "polite" });
  private propsBox = el("div", { class: "props" });
  private runsAs = el("ul", { class: "runs-as" });
  private selected: string | null = null;

  constructor(
    private root: HTMLElement,
    private app: App,
    private level: Level,
    private table: LevelInfo["table"],
  ) {
    const saved = app.progress[level.id]?.design;
    this.history = new History(saved ?? emptyDesign(level.id));
    for (const i of level.inputs) this.inputs[i] = 0;
    this.library = playLibrary(
      app.levels,
      app.progress,
      app.status,
      level.id,
      fastIds(app),
    );
    this.tools = toolbox(app.levels, app.status, level.id);
    this.ports = componentPorts(app);
    this.canvas = new CircuitCanvas({
      change: (d, commit) => this.onChange(d, commit),
      toggleInput: (name) => this.toggle(name),
      select: (id) => {
        this.selected = id;
        this.renderProps();
      },
      openPart: (id) =>
        this.openInside([
          { id, design: this.design, inputs: this.inputs, view: this.view },
        ]),
      message: (t) => this.say(t),
      menu: (target, at) => this.showMenu(target, at),
      zoomed: (z) => {
        this.zoomLabel.textContent = `${Math.round(z * 100)}%`;
      },
    });
    this.build();
    this.refresh(true);
  }

  private get design(): Design {
    return this.history.current;
  }

  // ---- layout ---------------------------------------------------------------

  private build(): void {
    const l = this.level;
    const ordered = orderLevels(this.app.levels).map((e) => e.info.level.id);
    const next = ordered[ordered.indexOf(l.id) + 1];
    this.root.innerHTML = `
      <div class="play-head">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="#/levels">Levels</a> <span aria-hidden="true">/</span> Layer ${l.layer} <span aria-hidden="true">/</span></nav>
        <h1 tabindex="-1">${esc(l.name)}${l.optional ? ' <span class="badge">side quest</span>' : ""}</h1>
        ${next && this.app.status[next] !== "locked" ? `<a class="play-next" href="${playHref(next)}">Next level →</a>` : ""}
      </div>`;
    this.root.dataset.next = next ?? "";

    const grid = el("div", { class: "play-grid" });
    const bench = el("section", { class: "bench", "aria-label": "Workbench" });
    const toolbar = el("div", {
      class: "toolbar",
      role: "toolbar",
      "aria-label": "Toolbox",
    });
    toolbar.append(el("span", { class: "toolbar-label" }, "Parts"));
    for (const t of this.tools) {
      const b = el(
        "button",
        {
          type: "button",
          class: `tool${t.primitive ? "" : " component"}`,
          "data-kind": t.kind,
          title: `Add ${t.label} (or drag it onto the canvas)`,
        },
        t.label,
      );
      b.addEventListener("pointerdown", (e) => this.startPlacing(t, e));
      // A click (mouse or keyboard) adds the part at a free spot, unless
      // this press was a drag that already dropped it on the canvas.
      b.addEventListener("click", () => {
        if (this.dropped) this.dropped = false;
        else this.addAtFreeSpot(t.kind);
      });
      toolbar.append(b);
    }
    toolbar.append(el("span", { class: "spacer" }));
    this.undoBtn.addEventListener("click", () => this.undo());
    this.redoBtn.addEventListener("click", () => this.redo());
    this.undoBtn.title = "Undo (Ctrl+Z)";
    this.redoBtn.title = "Redo (Ctrl+Shift+Z)";
    toolbar.append(this.undoBtn, this.redoBtn, this.shortcutsButton());

    // The canvas scrolls inside a frame that also holds overlays: the
    // status pill, the empty-canvas hint and the zoom controls.
    const frame = el("div", { class: "canvas-frame" });
    const wrap = el("div", { class: "canvas-wrap" });
    wrap.append(this.canvas.el);
    this.canvas.fillContainer(wrap);
    frame.append(wrap, this.emptyHint, this.statusLine, this.zoomControls());
    const footer = el("div", { class: "bench-footer" });
    footer.append(this.stats);
    bench.append(
      el(
        "p",
        { class: "narrow-note" },
        "The editor works best on a larger screen. On a phone, drag the canvas to pan; the menu key or a right-click shows each part's actions.",
      ),
      toolbar,
      frame,
      footer,
      this.propsBox,
    );

    const side = el("aside", {
      class: "side",
      "aria-label": "Goal, inputs and tests",
    });
    const goal = el("section", { class: "side-section goal-box" });
    goal.append(
      el("h2", {}, "Goal"),
      el("p", { class: "goal" }, l.goal.trim()),
    );
    side.append(goal);
    if (!this.app.store.persistent) {
      side.append(
        el(
          "p",
          { class: "notice" },
          "Your browser isn't letting this site save data, so progress lasts only until you close this tab. Use Export on the level map to keep it.",
        ),
      );
    }
    const inputs = el("section", { class: "side-section" });
    inputs.append(el("h2", {}, "Inputs"), this.inputBox);
    if (l.sequential) inputs.append(this.memoryControls());
    side.append(inputs);
    if (l.inputs.some((p) => this.width(p) > 1)) {
      inputs.append(
        el(
          "p",
          { class: "help", id: "bus-help" },
          "Type a number for each bus input: decimal, 0x… hex or 0b… binary. Press Enter to apply.",
        ),
      );
    }
    const table = el("table", { class: "truth" });
    const head = el("thead");
    head.innerHTML = `<tr>${l.sequential ? '<th scope="col">Step</th>' : ""}${l.inputs.map((i) => `<th scope="col">${esc(i)}</th>`).join("")}${l.outputs.map((o) => `<th scope="col">${esc(o)} (want)</th><th scope="col">${esc(o)} (yours)</th>`).join("")}<th scope="col"><span class="visually-hidden">Result</span></th></tr>`;
    table.append(head, this.tableBody);
    const checkBtn = el(
      "button",
      { type: "button", class: "primary" },
      "Check",
    );
    checkBtn.addEventListener("click", () => {
      // Big circuits take a moment: say so, and let the message paint first.
      checkBtn.disabled = true;
      this.result.replaceChildren(el("p", { class: "help" }, "Checking…"));
      setTimeout(() => {
        this.runCheck();
        checkBtn.disabled = false;
      }, 20);
    });
    const tests = el("section", { class: "side-section" });
    const tableWrap = el("div", { class: "table-wrap" });
    tableWrap.append(table);
    tests.append(
      el("h2", {}, l.sequential ? "Test steps" : "Truth table"),
      el(
        "p",
        { class: "help" },
        l.sequential
          ? "Steps run top to bottom, and the circuit remembers between them. “any” means any value is fine. Click a step to replay the test up to it."
          : "Updates live as you wire. Click a row to set those inputs.",
      ),
      tableWrap,
      this.problemList,
      this.result,
    );
    side.append(tests);
    if (l.layer >= 2) {
      const runs = el("section", { class: "side-section" });
      runs.append(
        el("h2", {}, "How parts run"),
        el(
          "p",
          { class: "help" },
          "Change which parts run as fast models on the level map.",
        ),
        this.runsAs,
      );
      side.append(runs);
    }
    // Check stays in view at the bottom of the panel while it scrolls.
    const actions = el("div", { class: "side-actions" });
    actions.append(checkBtn);
    side.append(actions);

    grid.append(bench, side);
    this.root.append(grid, this.inside);

    document.addEventListener("keydown", this.onKeys);
    window.addEventListener(
      "hashchange",
      () => document.removeEventListener("keydown", this.onKeys),
      { once: true },
    );
  }

  /** Tick (pulse clk) and power-cycle buttons for circuits with memory. */
  private memoryControls(): HTMLElement {
    const box = el("div", { class: "memory-controls" });
    if (this.level.inputs.includes("clk")) {
      const tick = el(
        "button",
        { type: "button", title: "Raise clk to 1, then back to 0" },
        "Tick clk ⎍",
      );
      tick.addEventListener("click", () => {
        this.currentStep = null;
        this.inputs.clk = 1;
        this.refresh(false);
        this.inputs.clk = 0;
        this.refresh(false);
        this.say(
          "Tick: clk rose to 1 (the moment flip-flops store) and fell back to 0.",
        );
      });
      box.append(tick);
    }
    const reset = el(
      "button",
      {
        type: "button",
        title: "Forget everything stored, like switching off and on",
      },
      "Reset memory",
    );
    reset.addEventListener("click", () => {
      this.memory = {};
      this.currentStep = null;
      this.refresh(false);
      this.say(
        "Memory cleared: every stored bit is unknown (X) again, as at power-on.",
      );
    });
    box.append(reset);
    return box;
  }

  private zoomControls(): HTMLElement {
    const box = el("div", {
      class: "zoom",
      role: "group",
      "aria-label": "Zoom",
    });
    const out = el("button", { type: "button", title: "Zoom out (−)" }, "−");
    const into = el("button", { type: "button", title: "Zoom in (+)" }, "+");
    const fit = el(
      "button",
      { type: "button", title: "Fit the circuit in view" },
      "Fit",
    );
    out.setAttribute("aria-label", "Zoom out");
    into.setAttribute("aria-label", "Zoom in");
    this.zoomLabel.setAttribute("aria-label", "Zoom level; reset to 100%");
    out.addEventListener("click", () =>
      this.canvas.setZoom(zoomStep(this.canvas.getZoom(), -1)),
    );
    into.addEventListener("click", () =>
      this.canvas.setZoom(zoomStep(this.canvas.getZoom(), 1)),
    );
    this.zoomLabel.addEventListener("click", () => this.canvas.setZoom(1));
    fit.addEventListener("click", () => this.canvas.fit());
    box.append(out, this.zoomLabel, into, fit);
    return box;
  }

  /** A "Shortcuts" button that shows every mouse and keyboard control. */
  private shortcutsButton(): HTMLElement {
    const wrap = el("div", { class: "shortcuts" });
    const btn = el(
      "button",
      {
        type: "button",
        "aria-expanded": "false",
        "aria-controls": "shortcuts",
      },
      "Shortcuts",
    );
    const panel = el("div", {
      class: "shortcuts-panel",
      id: "shortcuts",
      hidden: "",
    });
    const rows: [string, string][] = [
      ["Add a part", "Drag it from the toolbox, or click it"],
      ["Wire two pins", "Drag from one pin to the other, or click both"],
      ["Move a part, input or output", "Drag it · Tab to it, then arrow keys"],
      ["Flip an input", "Click it · Enter"],
      [
        "More actions (connect, delete…)",
        "Right-click · menu key or Shift+F10",
      ],
      ["Look inside a component", "Double-click it · Enter"],
      ["Delete", "Delete or Backspace"],
      ["Undo / redo", "Ctrl+Z / Ctrl+Shift+Z"],
      ["Pan", "Drag empty canvas · scroll"],
      ["Zoom", "Ctrl+scroll · + and − · 0 resets"],
      ["Cancel a wire", "Escape"],
    ];
    const dl = el("dl");
    for (const [what, how] of rows)
      dl.append(el("dt", {}, what), el("dd", {}, how));
    panel.append(dl);
    const set = (open: boolean) => {
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    };
    btn.addEventListener("click", () => set(panel.hidden));
    wrap.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) {
        set(false);
        btn.focus();
      }
    });
    document.addEventListener("pointerdown", (e) => {
      if (e.target instanceof Node && !wrap.contains(e.target)) set(false);
    });
    wrap.append(btn, panel);
    return wrap;
  }

  // ---- editing --------------------------------------------------------------

  private onKeys = (e: KeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.key.toLowerCase() !== "z") return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    e.preventDefault();
    if (e.shiftKey) this.redo();
    else this.undo();
  };

  private onChange(design: Design, commit: boolean): void {
    if (commit) this.history.apply(design);
    else this.history.replace(design);
    this.highlightParts.clear();
    this.highlightPorts.clear();
    if (commit && this.result.childElementCount) {
      // Don't leave an old verdict next to a changed circuit.
      this.result.replaceChildren(
        el(
          "p",
          { class: "help" },
          "Changed since the last check. Press Check again.",
        ),
      );
    }
    if (commit) this.say("");
    this.refresh(commit);
    if (commit) this.scheduleSave();
  }

  private undo(): void {
    this.history.undo();
    this.refresh(true);
    this.scheduleSave();
  }

  private redo(): void {
    this.history.redo();
    this.refresh(true);
    this.scheduleSave();
  }

  // ---- right-click menu -------------------------------------------------------

  private showMenu(target: MenuTarget, at: { x: number; y: number }): void {
    const part = (id: string) => this.design.parts.find((p) => p.id === id);
    const ctx: MenuContext = {
      design: this.design,
      inputs: this.level.inputs,
      outputs: this.level.outputs,
      components: new Set(Object.keys(this.ports)),
      canLookInside: (id) => {
        const kind = part(id)?.kind;
        return kind !== undefined && Boolean(this.app.progress[kind]?.design);
      },
      hasOptions: (id) => {
        const kind = part(id)?.kind ?? "";
        return (
          this.level.layer >= 2 &&
          (kind === "split" || kind === "join" || Boolean(this.ports[kind]))
        );
      },
      tools: this.tools.map((t) => ({ kind: t.kind, label: t.label })),
      widths: this.level.widths,
      canUndo: this.history.canUndo(),
      canRedo: this.history.canRedo(),
    };
    const { title, entries } = menuFor(target, ctx);
    this.menuAt = at;
    const active = document.activeElement;
    openMenu(
      title,
      entries,
      at,
      (id) => this.runMenu(target, id),
      active && this.canvas.el.contains(active) ? active : this.canvas.el,
    );
  }

  /** Where the last menu opened; follow-up menus open in the same spot. */
  private menuAt = { x: 0, y: 0 };

  /** Second step of Connect…: pick what to wire `from` to. */
  private chooseTarget(from: Endpoint): void {
    const all = this.canvas.endpoints();
    const m = connectMenu(this.design, from, all, this.level.inputs);
    openMenu(
      m.title,
      m.entries,
      this.menuAt,
      (pick) => {
        const to = all.find((e) => `to:${endpointKey(e)}` === pick);
        if (!to) return;
        const next = addWire(this.design, from, to);
        if (typeof next === "string") this.say(next);
        else {
          this.onChange(next, true);
          this.say(
            `Connected ${endpointLabel(from, this.level.inputs)} to ${endpointLabel(to, this.level.inputs)}.`,
          );
        }
        this.canvas.el.focus({ preventScroll: true });
      },
      this.canvas.el,
    );
  }

  /** Disconnect…: pick one wire of a part or port, or all of them. */
  private chooseWire(owner: { part: string } | { port: string }): void {
    const m = disconnectMenu(this.design, owner, this.level.inputs);
    const name = "part" in owner ? owner.part : owner.port;
    openMenu(
      m.title,
      m.entries,
      this.menuAt,
      (pick) => {
        if (pick === "all") {
          this.onChange(disconnect(this.design, owner), true);
          this.say(`Disconnected every wire from ${name}.`);
        } else {
          this.onChange(removeWire(this.design, Number(pick.slice(5))), true);
          this.say(`Disconnected a wire from ${name}.`);
        }
        this.canvas.el.focus({ preventScroll: true });
      },
      this.canvas.el,
    );
  }

  private runMenu(target: MenuTarget, action: string): void {
    const d = this.design;
    // Keyboard users land back on the canvas after an edit.
    const back = () => this.canvas.el.focus({ preventScroll: true });
    if (target.kind === "part") {
      const id = target.id;
      if (action === "look-inside") {
        this.openInside([
          { id, design: d, inputs: this.inputs, view: this.view },
        ]);
      } else if (action === "options") {
        this.selected = id;
        this.renderProps();
        const first = this.propsBox.querySelector<HTMLElement>("select, input");
        first?.scrollIntoView({ block: "nearest" });
        first?.focus();
      } else if (action === "duplicate") {
        const dup = duplicatePart(d, id);
        if (dup) {
          this.onChange(dup.design, true);
          this.say(`Added ${dup.id}, a copy of ${id}.`);
        }
        back();
      } else if (action === "connect") {
        const pins = this.canvas.pinsOf(id);
        const m = pinMenu(id, pins, d);
        openMenu(m.title, m.entries, this.menuAt, (pick) =>
          this.chooseTarget({ part: id, pin: pick.slice(4) }),
        );
      } else if (action === "disconnect") {
        this.chooseWire({ part: id });
      } else if (action === "delete") {
        this.canvas.select(null);
        this.onChange(removePart(d, id), true);
        this.say(`Deleted ${id}.`);
        back();
      }
    } else if (target.kind === "wire" && action === "delete") {
      this.canvas.select(null);
      this.onChange(removeWire(d, target.index), true);
      this.say("Deleted the wire.");
      back();
    } else if (target.kind === "port") {
      const name = target.name;
      if (action === "flip") {
        this.toggle(name);
        if (this.width(name) === 1) back();
      } else if (action === "connect") {
        this.chooseTarget({ port: name });
      } else if (action === "disconnect") {
        this.chooseWire({ port: name });
      } else if (action === "reset-port") {
        this.onChange(resetPort(d, name), true);
        this.say(`Moved ${name} back to the edge.`);
        back();
      }
    } else if (target.kind === "canvas") {
      if (action.startsWith("add:")) {
        const { design, id } = addPart(d, action.slice(4), target.at);
        this.onChange(design, true);
        this.say(`Added ${id}.`);
      } else if (action === "undo") this.undo();
      else if (action === "redo") this.redo();
      back();
    }
  }

  private addAtFreeSpot(kind: string): void {
    const taken = this.design.parts.map((p) => p.pos ?? ([0, 0] as Point));
    const { design, id } = addPart(this.design, kind, freeSpot(taken));
    this.onChange(design, true);
    this.say(
      `Added ${id}. Tab to it on the canvas to move it with the arrow keys.`,
    );
  }

  private startPlacing(t: ToolboxItem, e: PointerEvent): void {
    if (e.button !== 0) return;
    this.dropped = false;
    const ghost = el("div", { class: "ghost", "aria-hidden": "true" }, t.label);
    const move = (ev: PointerEvent) => {
      if (!ghost.isConnected) document.body.append(ghost);
      ghost.style.left = `${ev.clientX + 8}px`;
      ghost.style.top = `${ev.clientY + 8}px`;
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      ghost.remove();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (over && this.canvas.el.contains(over)) {
        const pos = clampToCanvas(
          snap(this.canvas.toCanvas(ev.clientX, ev.clientY)),
        );
        const { design, id } = addPart(this.design, t.kind, pos);
        this.onChange(design, true);
        this.say(`Added ${id}.`);
        this.dropped = true;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
  }

  /** Live stats for gate-level circuits. */
  private renderStats(): void {
    const v = this.view;
    if (this.level.layer < 2 || !v || v.blocked) {
      this.stats.textContent = "";
      return;
    }
    this.stats.textContent = v.settled
      ? `Settled after ${v.depth} gate delay${v.depth === 1 ? "" : "s"}${
          this.library.fast?.length
            ? " (each fast model counts as one step, so real hardware would take longer)"
            : ""
        }.`
      : "Still changing: this circuit oscillates and never settles.";
  }

  /** Which component kinds this design uses, and how each one runs. */
  private renderRunsAs(): void {
    if (this.level.layer < 2) return;
    const fast = new Set(this.library.fast ?? []);
    const kinds = [...new Set(this.design.parts.map((p) => p.kind))].filter(
      (k) => this.ports[k],
    );
    this.runsAs.replaceChildren(
      ...kinds.map((k) => {
        const lv = levelEntry(this.app, k)?.info.level;
        const how =
          lv?.layer === 1
            ? "its truth table (your transistors passed every row)"
            : fast.has(k)
              ? "fast model (matched your design)"
              : "your design";
        return el("li", {}, `${lv?.name ?? k}: ${how}`);
      }),
    );
    if (!kinds.length) this.runsAs.append(el("li", {}, "No components yet."));
  }

  /** Options for the selected part: bus width, or repeat and shared pins. */
  private renderProps(): void {
    const part = this.design.parts.find((p) => p.id === this.selected);
    this.propsBox.replaceChildren();
    if (!part || this.level.layer < 2) return;
    const wiring = part.kind === "split" || part.kind === "join";
    const comp = this.ports[part.kind];
    if (!wiring && !comp) return;
    const box = el("fieldset");
    box.append(el("legend", {}, `Options for ${part.id}`));
    if (wiring) {
      const label = el("label", {}, "Bus width ");
      const select = el("select");
      for (const w of [2, 4, 8, 16]) {
        const o = el("option", { value: String(w) }, `${w} bits`);
        if (w === (part.width ?? 16)) o.selected = true;
        select.append(o);
      }
      select.addEventListener("change", () =>
        this.onChange(
          updatePart(this.design, part.id, { width: Number(select.value) }),
          true,
        ),
      );
      label.append(select);
      box.append(label);
    } else if (comp) {
      const label = el("label", {}, "Repeat × ");
      const input = el("input", {
        type: "number",
        min: "1",
        max: "64",
        value: String(part.repeat ?? 1),
      });
      input.addEventListener("change", () => {
        const n = Math.max(
          1,
          Math.min(64, Math.round(Number(input.value)) || 1),
        );
        this.onChange(updatePart(this.design, part.id, { repeat: n }), true);
      });
      label.append(input);
      box.append(label);
      if ((part.repeat ?? 1) > 1) {
        box.append(
          el(
            "p",
            { class: "help" },
            "Each copy gets its own slice of every bus pin, except shared inputs, which all copies read.",
          ),
        );
        for (const pin of comp.inputs) {
          const lab = el("label", { class: "check" });
          const cb = el("input", { type: "checkbox" });
          cb.checked = part.shared?.includes(pin) ?? false;
          cb.addEventListener("change", () => {
            const shared = new Set(part.shared ?? []);
            if (cb.checked) shared.add(pin);
            else shared.delete(pin);
            this.onChange(
              updatePart(this.design, part.id, { shared: [...shared] }),
              true,
            );
          });
          lab.append(cb, ` share ${pin}`);
          box.append(lab);
        }
      }
    }
    this.propsBox.append(box);
  }

  private width(port: string): number {
    return this.level.widths?.[port] ?? 1;
  }

  private toggle(name: string): void {
    if (this.width(name) > 1) {
      // Buses take a typed number instead of a flip.
      this.inputBox
        .querySelector<HTMLInputElement>(`input[data-port="${name}"]`)
        ?.focus();
      return;
    }
    this.inputs[name] = this.inputs[name] ? 0 : 1;
    this.currentStep = null;
    this.refresh(false);
  }

  private setInputs(values: [string, number | string][]): void {
    for (const [k, v] of values) this.inputs[k] = Number(v);
  }

  /** A short message in the canvas's status pill; it fades after a while. */
  private say(text: string): void {
    this.statusLine.textContent = text;
    clearTimeout(this.statusTimer);
    if (text)
      this.statusTimer = window.setTimeout(() => {
        this.statusLine.textContent = "";
      }, 7000);
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void saveDesign(this.app, this.level.id, this.design);
    }, 300);
  }

  // ---- simulation and checking ------------------------------------------------

  private simulateWith(
    inputs: Record<string, number>,
    state: Record<string, string> = {},
  ): SimView | null {
    try {
      return simulate(this.library, this.level.id, this.design, inputs, state);
    } catch (e) {
      this.say(`Simulation error: ${String(e)}`);
      return null;
    }
  }

  /** Re-simulates; `full` also refreshes the truth table and lists. */
  private refresh(full: boolean): void {
    // Combinational levels always start fresh, exactly like the checker.
    this.view = this.simulateWith(
      this.inputs,
      this.level.sequential ? this.memory : {},
    );
    if (this.level.sequential && this.view) this.memory = this.view.state;
    this.undoBtn.disabled = !this.history.canUndo();
    this.redoBtn.disabled = !this.history.canRedo();
    this.canvas.render({
      design: this.design,
      inputs: this.level.inputs,
      outputs: this.level.outputs,
      componentPorts: this.ports,
      portWidths: this.level.widths,
      view: this.view,
      inputValues: this.inputs,
      highlightParts: this.highlightParts,
      highlightPorts: this.highlightPorts,
    });
    this.emptyHint.hidden = this.design.parts.length > 0;
    this.emptyHint.textContent =
      "Drag a part here from the toolbox, or right-click the canvas to add one. Then drag from pin to pin to wire it.";
    this.renderInputs();
    this.renderStats();
    if (full) {
      this.renderProps();
      this.renderRunsAs();
      this.renderTable();
    } else {
      this.markCurrentRow();
    }
    this.renderProblems();
  }

  private renderInputs(): void {
    // Don't rebuild while someone is typing a number.
    if (
      this.inputBox.contains(document.activeElement) &&
      document.activeElement instanceof HTMLInputElement
    )
      return;
    this.inputBox.replaceChildren(
      ...this.level.inputs.map((name) => {
        const v = this.inputs[name] ?? 0;
        const w = this.width(name);
        if (w > 1) {
          const label = el(
            "label",
            { class: "bus-input" },
            `${name} (${w} bits) `,
          );
          const input = el("input", {
            type: "text",
            inputmode: "numeric",
            "data-port": name,
            value: formatValue(v, w),
            "aria-describedby": "bus-help",
          });
          input.addEventListener("change", () => {
            const n = parseNumber(input.value);
            if (n === undefined || n >= 2 ** w || n < 0) {
              this.say(
                `"${input.value}" isn't a number from 0 to ${2 ** w - 1}. You can type decimal, 0x… hex or 0b… binary.`,
              );
              input.value = formatValue(v, w);
              return;
            }
            this.inputs[name] = n;
            this.currentStep = null;
            this.refresh(false);
          });
          label.append(input);
          return label;
        }
        const b = el(
          "button",
          {
            type: "button",
            class: "input-toggle",
            "aria-pressed": String(v === 1),
          },
          `${name} = ${v}`,
        );
        b.addEventListener("click", () => this.toggle(name));
        return b;
      }),
    );
  }

  private renderTable(): void {
    // A sequential level's steps run in order, each from the state the
    // previous one left; combinational rows each start fresh.
    let state: Record<string, string> = {};
    this.stepStates = [];
    this.tableBody.replaceChildren(
      ...this.table.map((row, i) => {
        const inputs = Object.fromEntries(row.inputs);
        const view = this.simulateWith(
          inputs,
          this.level.sequential ? state : {},
        );
        if (this.level.sequential) {
          state = view?.state ?? {};
          this.stepStates.push(state);
        }
        const tr = el("tr", { tabindex: "0", "data-row": String(i) });
        let ok = Boolean(view && !view.blocked);
        let cells = this.level.sequential
          ? `<td class="step">${i + 1}</td>`
          : "";
        cells += row.inputs
          .map(([n, v]) => `<td>${formatValue(v, this.width(n))}</td>`)
          .join("");
        for (const [name, want] of row.outputs) {
          const got = view?.blocked
            ? "–"
            : (view?.outputs.find(([n]) => n === name)?.[1] ?? "–");
          const any = row.skip.includes(name);
          if (!any && got !== String(want)) ok = false;
          const shown = /^\d+$/.test(got)
            ? formatValue(Number(got), this.width(name))
            : got;
          cells += `<td>${any ? '<span class="any">any</span>' : formatValue(want, this.width(name))}</td><td class="got">${shown}</td>`;
        }
        cells += `<td class="mark">${ok ? '<span class="ok">✓ match</span>' : '<span class="bad">✗ differs</span>'}</td>`;
        tr.innerHTML = cells;
        tr.classList.toggle("row-ok", ok);
        const pick = () => {
          this.setInputs(row.inputs);
          if (this.level.sequential) {
            // Replay the test up to this step: the canvas shows that moment.
            this.memory = this.stepStates[i] ?? {};
            this.currentStep = i;
            this.say(
              i === 0
                ? "Showing step 1, from power-on."
                : `Showing step ${i + 1}, after replaying steps 1–${i}.`,
            );
          }
          this.refresh(false);
        };
        tr.addEventListener("click", pick);
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        });
        return tr;
      }),
    );
    this.markCurrentRow();
  }

  private markCurrentRow(): void {
    this.table.forEach((row, i) => {
      // Steps repeat the same inputs, so a sequential level marks the step
      // that was replayed, not every row with matching inputs.
      const current = this.level.sequential
        ? this.currentStep === i
        : row.inputs.every(([k, v]) => (this.inputs[k] ?? 0) === v);
      const tr = this.tableBody.querySelector(`[data-row="${i}"]`);
      tr?.classList.toggle("current", current);
      if (current) tr?.setAttribute("aria-current", "true");
      else tr?.removeAttribute("aria-current");
    });
  }

  private renderProblems(): void {
    const problems = this.view?.problems ?? [];
    this.problemList.replaceChildren(
      ...problems.map((p) => {
        const li = el("li", { class: p.severity });
        li.append(
          el("strong", {}, p.severity === "error" ? "Error: " : "Note: "),
          ...rich(p.message),
        );
        return li;
      }),
    );
    if (this.view?.shorts.length) {
      this.problemList.prepend(
        el(
          "li",
          { class: "error" },
          `Short circuit right now: VDD and GND are connected through ${this.view.shorts[0]?.join(", ")}.`,
        ),
      );
    }
  }

  private runCheck(): void {
    let report: Report;
    try {
      report = check(this.library, this.level.id, this.design);
    } catch (e) {
      this.result.textContent = `Couldn't check: ${String(e)}`;
      return;
    }
    this.result.replaceChildren();
    if (report.passed) {
      void saveDesign(this.app, this.level.id, this.design, true);
      const next = this.root.dataset.next;
      const box = el("div", { class: "passed" });
      const tested = report.random
        ? `All ${report.rows.length} rows and ${report.random.run.toLocaleString("en-US")} random tests match`
        : `All ${report.rows.length} ${this.level.sequential ? "steps" : "rows"} match`;
      const stats =
        this.level.layer === 1
          ? `using ${report.transistors} transistors`
          : `using ${report.cells} gates, ${report.depth} gate delay${report.depth === 1 ? "" : "s"} deep`;
      box.innerHTML = `<p><strong>✓ Passed!</strong> ${tested}, ${stats}.
        ${esc(this.level.name)} is now in your toolbox.</p>
        <p>${next ? `<a href="${playHref(next)}">Next level →</a> · ` : ""}<a href="#/levels">Level map</a></p>`;
      this.result.append(box);
      this.highlightParts.clear();
      this.highlightPorts.clear();
      this.refresh(false);
      return;
    }
    const failed = report.rows.filter((r) => !r.passed).length;
    const randomNote =
      report.random && report.random.failed > 0
        ? ` ${report.random.failed.toLocaleString("en-US")} of ${report.random.run.toLocaleString("en-US")} random tests fail too.`
        : "";
    const head = report.rows.length
      ? `✗ ${failed} of ${report.rows.length} ${this.level.sequential ? "steps" : "rows"} don't match yet.${randomNote}`
      : "✗ The design has errors (see below).";
    this.result.append(el("p", { class: "failed" }, head));
    const list = el("ul", { class: "diagnostics" });
    for (const p of report.problems.filter((x) => x.severity === "error")) {
      const li = el("li");
      li.append(...rich(p.message));
      list.append(li);
    }
    for (const d of report.diagnostics) list.append(this.diagnosticItem(d));
    this.result.append(list);
  }

  private diagnosticItem(d: Diagnostic): HTMLElement {
    const li = el("li");
    const b = el("button", { type: "button", class: "diag" });
    b.append(...rich(d.message));
    b.addEventListener("click", () => {
      this.setInputs(d.inputs);
      this.highlightParts = new Set(d.parts);
      this.highlightPorts = new Set(d.ports);
      this.refresh(false);
      this.say(`Showing row ${d.row}. Highlighted parts are marked with "!".`);
    });
    li.append(b);
    if (d.hint) {
      const hint = el("p", { class: "hint" }, "Hint: ");
      hint.append(...rich(d.hint));
      li.append(hint);
    }
    return li;
  }

  // ---- look inside ------------------------------------------------------------

  /**
   * Shows a component part's own design, read-only, running with the
   * values its pins have in the parent. Components inside can be opened
   * too; `stack` is the path from the top design down.
   */
  private openInside(
    stack: {
      id: string;
      design: Design;
      inputs: Record<string, number>;
      view: SimView | null;
    }[],
  ): void {
    const top = stack[stack.length - 1];
    if (!top) return;
    const part = top.design.parts.find((p) => p.id === top.id);
    const comp = part ? levelEntry(this.app, part.kind)?.info.level : undefined;
    const inner = part ? this.app.progress[part.kind]?.design : undefined;
    if (!part || !comp || !inner) return;
    const inputs = partInputs(top.view, part.id, comp.inputs);
    const lib = playLibrary(
      this.app.levels,
      this.app.progress,
      this.app.status,
      comp.id,
      fastIds(this.app),
    );
    let view: SimView | null = null;
    try {
      view = simulate(lib, comp.id, inner, inputs);
    } catch {
      view = null;
    }
    this.inside.hidden = false;
    this.inside.replaceChildren();
    const crumbs = [
      this.level.name,
      ...stack.map((s) => {
        const p = s.design.parts.find((x) => x.id === s.id);
        return `${s.id} (${this.ports[p?.kind ?? ""]?.name ?? p?.kind})`;
      }),
    ].join(" › ");
    const head = el("div", { class: "inside-head" });
    head.append(el("h2", { tabindex: "-1" }, `Inside: ${crumbs}`));
    const back = el(
      "button",
      { type: "button" },
      stack.length > 1 ? "Up one level" : "Close",
    );
    back.addEventListener("click", () => {
      if (stack.length > 1) this.openInside(stack.slice(0, -1));
      else {
        this.inside.hidden = true;
        this.canvas.el.focus();
      }
    });
    head.append(back);
    const note = el(
      "p",
      { class: "help" },
      `Your ${comp.name} design, running with the values it gets inside ${this.level.name}. Read-only here: edit it on its own level page.`,
    );
    const c = new CircuitCanvas({
      change: () => {},
      toggleInput: () => {},
      openPart: (id) =>
        this.openInside([...stack, { id, design: inner, inputs, view }]),
      message: () => {},
    });
    c.render({
      design: inner,
      inputs: comp.inputs,
      outputs: comp.outputs,
      componentPorts: this.ports,
      view,
      inputValues: inputs,
      highlightParts: new Set(),
      highlightPorts: new Set(),
      readOnly: true,
    });
    const edit = el("a", { href: playHref(comp.id) }, `Edit ${comp.name}`);
    this.inside.append(head, note, c.el, edit);
    this.inside.querySelector<HTMLElement>("h2")?.focus();
  }
}
