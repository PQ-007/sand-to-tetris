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
import { widthFixes, type Fix } from "./editor/fixes";
import { bitsOf, formatValue, parseNumber, showValue } from "./editor/values";
import { drawWaveform } from "./editor/waveform-view";
import type { Signal } from "./editor/waveform";
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
import {
  memoryParts,
  orderLevels,
  playLibrary,
  toolbox,
  type ToolboxItem,
} from "./game";
import { t, type Key } from "./i18n";
import { diagnosticText, knownText, problemText } from "./messages";
import { playHref } from "./router";
import { levelGoal, levelHint, levelName } from "./text";
import { check, disassemble, simulate, simulateSteps } from "./sim/core";
import type {
  Design,
  Diagnostic,
  Endpoint,
  LevelInfo,
  StepsView,
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
      name: levelName(l.info.level),
      widths: l.info.level.widths,
    };
  }
  return out;
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
  root.innerHTML = `<p class="loading">${esc(t("play.loading"))}</p>`;
  const a = await getApp();
  const entry = levelEntry(a, levelId);
  if (!entry) {
    root.innerHTML = `<div class="narrow-page"><h1 tabindex="-1">${esc(t("play.noLevel"))}</h1><p><a href="#/levels">${esc(t("play.backToMap"))}</a></p></div>`;
    return;
  }
  const level = entry.info.level;
  const status = a.status[levelId];
  if (status === "locked") {
    const need = level.requires.filter((r) => a.status[r] !== "passed");
    const links = need
      .map((r) => {
        const req = levelEntry(a, r)?.info.level;
        return `<a href="${playHref(r)}">${esc(req ? levelName(req) : r)}</a>`;
      })
      .join(esc(t("levels.and")));
    root.innerHTML = `<div class="narrow-page"><h1 tabindex="-1">${esc(t("play.locked", { name: levelName(level) }))}</h1>
      <p>${t("play.passFirst", { names: links })}</p>
      <p><a href="#/levels">${esc(t("play.backToMap"))}</a></p></div>`;
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
    { type: "button", title: t("play.zoomReset") },
    "100%",
  );
  private undoBtn = el("button", { type: "button" }, t("play.undo"));
  private redoBtn = el("button", { type: "button" }, t("play.redo"));
  private inputBox = el("div", { class: "input-toggles" });
  private outputBox = el("div", { class: "output-bits" });
  /** One-click fixes for wires of different widths, over the canvas. */
  private fixBox = el("ul", {
    class: "canvas-fixes",
    "aria-live": "polite",
  });
  private tableBody = el("tbody");
  /** What the live circuit holds (sequential levels): fed back into every
   * simulation so latches and flip-flops remember. */
  private memory: Record<string, string> = {};
  /** For sequential levels: the test step the canvas is showing (null
   * once the learner changes something). */
  private currentStep: number | null = null;
  /** The test run shown in the waveform: each step's outputs, and which
   * steps fail. */
  private testRun: { outputs: [string, string][][]; failed: Set<number> } = {
    outputs: [],
    failed: new Set(),
  };
  /** Live history for the waveform: inputs and outputs after each change. */
  private liveLog: {
    inputs: Record<string, number>;
    outputs: [string, string][];
  }[] = [];
  private wave = el("div", { class: "wave-panel" });
  private waveTab: "test" | "live" = "test";
  private result = el("div", { class: "check-result", "aria-live": "polite" });
  private problemList = el("ul", { class: "problems" });
  private inside = el("div", { class: "inside", hidden: "" });
  private stats = el("p", { class: "sim-stats", "aria-live": "polite" });
  private slowNote = el("p", { class: "slow-note" });
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
      message: (text) => this.say(text),
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
        <nav class="crumbs" aria-label="${esc(t("play.crumbs"))}"><a href="#/levels">${esc(t("title.levels"))}</a> <span aria-hidden="true">/</span> ${esc(t("play.layerN", { n: l.layer }))} <span aria-hidden="true">/</span></nav>
        <h1 tabindex="-1">${esc(levelName(l))}${l.optional ? ` <span class="badge">${esc(t("levels.sideQuest"))}</span>` : ""}</h1>
        ${next && this.app.status[next] !== "locked" ? `<a class="play-next" href="${playHref(next)}">${esc(t("play.nextLevel"))}</a>` : ""}
      </div>`;
    this.root.dataset.next = next ?? "";

    const grid = el("div", { class: "play-grid" });
    const bench = el("section", {
      class: "bench",
      "aria-label": t("play.workbench"),
    });
    const toolbar = el("div", {
      class: "toolbar",
      role: "toolbar",
      "aria-label": t("play.toolbox"),
    });
    toolbar.append(el("span", { class: "toolbar-label" }, t("play.parts")));
    for (const tool of this.tools) {
      const label = this.toolLabel(tool);
      const b = el(
        "button",
        {
          type: "button",
          class: `tool${tool.primitive ? "" : " component"}`,
          "data-kind": tool.kind,
          title: t("play.addTool", { name: label }),
        },
        label,
      );
      b.addEventListener("pointerdown", (e) => this.startPlacing(tool, e));
      // A click (mouse or keyboard) adds the part at a free spot, unless
      // this press was a drag that already dropped it on the canvas.
      b.addEventListener("click", () => {
        if (this.dropped) this.dropped = false;
        else this.addAtFreeSpot(tool.kind);
      });
      toolbar.append(b);
    }
    toolbar.append(el("span", { class: "spacer" }));
    this.undoBtn.addEventListener("click", () => this.undo());
    this.redoBtn.addEventListener("click", () => this.redo());
    this.undoBtn.title = t("play.undoTitle");
    this.redoBtn.title = t("play.redoTitle");
    toolbar.append(this.undoBtn, this.redoBtn, this.shortcutsButton());

    // The canvas scrolls inside a frame that also holds overlays: the
    // status pill, the empty-canvas hint and the zoom controls.
    const frame = el("div", { class: "canvas-frame" });
    const wrap = el("div", { class: "canvas-wrap" });
    wrap.append(this.canvas.el);
    this.canvas.fillContainer(wrap);
    // Suggested fixes sit above the status pill, bottom left.
    const dock = el("div", { class: "canvas-dock" });
    dock.append(this.fixBox, this.statusLine);
    frame.append(wrap, this.emptyHint, dock, this.zoomControls());
    const footer = el("div", { class: "bench-footer" });
    footer.append(this.stats, this.slowNote);
    bench.append(
      el("p", { class: "narrow-note" }, t("play.narrow")),
      toolbar,
      frame,
      footer,
      ...(l.sequential ? [this.wavePanel()] : []),
      this.propsBox,
    );

    const side = el("aside", {
      class: "side",
      "aria-label": t("play.sideLabel"),
    });
    const goal = el("section", { class: "side-section goal-box" });
    goal.append(
      el("h2", {}, t("play.goal")),
      el("p", { class: "goal" }, levelGoal(l)),
    );
    side.append(goal);
    if (!this.app.store.persistent) {
      side.append(el("p", { class: "notice" }, t("play.notSaving")));
    }
    const inputs = el("section", { class: "side-section" });
    inputs.append(el("h2", {}, t("play.inputs")), this.inputBox);
    if (l.sequential) inputs.append(this.memoryControls());
    side.append(inputs);
    if (l.inputs.some((p) => this.width(p) > 1)) {
      inputs.append(
        el("p", { class: "help", id: "bus-help" }, t("play.busHelp")),
      );
      if (l.inputs.some((p) => this.showsBits(p)))
        inputs.append(el("p", { class: "help" }, t("play.bitsHelp")));
    }
    if (l.outputs.some((p) => this.showsBits(p))) {
      const outputs = el("section", { class: "side-section" });
      outputs.append(el("h2", {}, t("play.outputs")), this.outputBox);
      side.append(outputs);
    }
    const table = el("table", { class: "truth" });
    const head = el("thead");
    head.innerHTML = `<tr>${l.sequential ? `<th scope="col">${esc(t("play.step"))}</th>` : ""}${l.inputs.map((i) => `<th scope="col">${esc(i)}</th>`).join("")}${l.outputs.map((o) => `<th scope="col">${esc(t("play.want", { name: o }))}</th><th scope="col">${esc(t("play.yours", { name: o }))}</th>`).join("")}<th scope="col"><span class="visually-hidden">${esc(t("play.result"))}</span></th></tr>`;
    table.append(head, this.tableBody);
    const checkBtn = el(
      "button",
      { type: "button", class: "primary" },
      t("play.check"),
    );
    checkBtn.addEventListener("click", () => {
      // Big circuits take a moment: say so, and let the message paint first.
      checkBtn.disabled = true;
      this.result.replaceChildren(
        el("p", { class: "help" }, t("play.checking")),
      );
      setTimeout(() => {
        this.runCheck();
        checkBtn.disabled = false;
      }, 20);
    });
    const tests = el("section", { class: "side-section" });
    const tableWrap = el("div", { class: "table-wrap" });
    tableWrap.append(table);
    tests.append(
      el("h2", {}, t(l.sequential ? "play.testSteps" : "play.truthTable")),
      el(
        "p",
        { class: "help" },
        t(l.sequential ? "play.stepsHelp" : "play.tableHelp"),
      ),
      tableWrap,
      this.problemList,
      this.result,
    );
    side.append(tests);
    if (l.layer >= 2) {
      const runs = el("section", { class: "side-section" });
      runs.append(
        el("h2", {}, t("play.howPartsRun")),
        el("p", { class: "help" }, t("play.howPartsRunHelp")),
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
    // Leaving the page (or re-rendering it in another language) drops the
    // page-wide shortcut.
    const leave = () => document.removeEventListener("keydown", this.onKeys);
    window.addEventListener("hashchange", leave, { once: true });
    document.addEventListener("s2t-lang", leave, { once: true });
  }

  /** Tick (pulse clk) and power-cycle buttons for circuits with memory. */
  private memoryControls(): HTMLElement {
    const box = el("div", { class: "memory-controls" });
    if (this.level.inputs.includes("clk")) {
      const tick = el(
        "button",
        { type: "button", title: t("play.tickTitle") },
        t("play.tick"),
      );
      tick.addEventListener("click", () => {
        this.currentStep = null;
        // Both edges in one run: the circuit is built once.
        // 0 → 1 → 0 from wherever clk is, so a tick always has a rising
        // edge.
        const run = this.runSteps(
          [
            { ...this.inputs, clk: 0 },
            { ...this.inputs, clk: 1 },
            { ...this.inputs, clk: 0 },
          ],
          this.memory,
        );
        if (run) {
          // Record each half of the tick, not just where it ends.
          this.inputs.clk = 0;
          this.record({ ...run.view, outputs: run.outputs[0] ?? [] });
          this.inputs.clk = 1;
          this.record({ ...run.view, outputs: run.outputs[1] ?? [] });
          this.memory = run.view.state;
        }
        this.inputs.clk = 0;
        this.refresh(false, run?.view);
        this.say(t("play.ticked"));
      });
      box.append(tick);
    }
    const reset = el(
      "button",
      {
        type: "button",
        title: t("play.resetMemoryTitle"),
      },
      t("play.resetMemory"),
    );
    reset.addEventListener("click", () => {
      this.memory = {};
      this.currentStep = null;
      this.refresh(false);
      this.say(t("play.memoryCleared"));
    });
    box.append(reset);
    return box;
  }

  private zoomControls(): HTMLElement {
    const box = el("div", {
      class: "zoom",
      role: "group",
      "aria-label": t("play.zoom"),
    });
    const out = el(
      "button",
      { type: "button", title: t("play.zoomOutTitle") },
      "−",
    );
    const into = el(
      "button",
      { type: "button", title: t("play.zoomInTitle") },
      "+",
    );
    const fit = el(
      "button",
      { type: "button", title: t("play.fitTitle") },
      t("play.fit"),
    );
    out.setAttribute("aria-label", t("play.zoomOut"));
    into.setAttribute("aria-label", t("play.zoomIn"));
    this.zoomLabel.setAttribute("aria-label", t("play.zoomLevel"));
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
      t("play.shortcuts"),
    );
    const panel = el("div", {
      class: "shortcuts-panel",
      id: "shortcuts",
      hidden: "",
    });
    const rows = [
      "add",
      "wire",
      "move",
      "flip",
      "more",
      "inside",
      "delete",
      "undo",
      "pan",
      "zoom",
      "cancel",
    ];
    const dl = el("dl");
    for (const row of rows)
      dl.append(
        el("dt", {}, t(`keys.${row}` as Key)),
        el("dd", {}, t(`keys.${row}How` as Key)),
      );
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
        el("p", { class: "help" }, t("play.changed")),
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
      tools: this.tools.map((tool) => ({
        kind: tool.kind,
        label: this.toolLabel(tool),
      })),
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
            t("play.connected", {
              from: endpointLabel(from, this.level.inputs),
              to: endpointLabel(to, this.level.inputs),
            }),
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
          this.say(t("play.disconnectedAll", { name }));
        } else {
          this.onChange(removeWire(this.design, Number(pick.slice(5))), true);
          this.say(t("play.disconnectedOne", { name }));
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
          this.say(t("play.duplicated", { id: dup.id, from: id }));
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
        this.say(t("play.deleted", { id }));
        back();
      }
    } else if (target.kind === "wire" && action === "delete") {
      this.canvas.select(null);
      this.onChange(removeWire(d, target.index), true);
      this.say(t("play.deletedWire"));
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
        this.say(t("play.movedBack", { name }));
        back();
      }
    } else if (target.kind === "canvas") {
      if (action.startsWith("add:")) {
        const { design, id } = addPart(d, action.slice(4), target.at);
        this.onChange(design, true);
        this.say(t("play.added", { id }));
      } else if (action === "undo") this.undo();
      else if (action === "redo") this.redo();
      back();
    }
  }

  private addAtFreeSpot(kind: string): void {
    const taken = this.design.parts.map((p) => p.pos ?? ([0, 0] as Point));
    const { design, id } = addPart(this.design, kind, freeSpot(taken));
    this.onChange(design, true);
    this.say(t("play.addedFree", { id }));
  }

  /** A toolbox item's name in the current language. */
  private toolLabel(tool: ToolboxItem): string {
    if (tool.kind === "split") return t("tool.split");
    if (tool.kind === "join") return t("tool.join");
    if (tool.primitive) return tool.label;
    const lv = levelEntry(this.app, tool.kind)?.info.level;
    return lv ? levelName(lv) : tool.label;
  }

  private startPlacing(tool: ToolboxItem, e: PointerEvent): void {
    if (e.button !== 0) return;
    this.dropped = false;
    const ghost = el(
      "div",
      { class: "ghost", "aria-hidden": "true" },
      this.toolLabel(tool),
    );
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
        const { design, id } = addPart(this.design, tool.kind, pos);
        this.onChange(design, true);
        this.say(t("play.added", { id }));
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
      ? t("play.settled", {
          depth: v.depth,
          fast: this.library.fast?.length ? 1 : 0,
        })
      : t("play.oscillates");
    this.renderSlowNote(v.cells);
  }

  /** Big circuits are slow: point at the parts that could run fast. */
  private renderSlowNote(cells: number): void {
    const fast = new Set(this.library.fast ?? []);
    const swappable = [...new Set(this.design.parts.map((p) => p.kind))]
      .filter((k) => !fast.has(k) && this.app.status[k] === "passed")
      .map((k) => levelEntry(this.app, k)?.info.level)
      .filter((l) => l?.model)
      .map((l) => (l ? levelName(l) : ""));
    this.slowNote.replaceChildren();
    if (cells < 5000 || !swappable.length) return;
    this.slowNote.append(
      t("play.slow", {
        cells: cells.toLocaleString("en-US"),
        names: swappable.join(", "),
        count: swappable.length,
      }),
      el("a", { href: "#/levels" }, t("play.slowLink")),
      t("play.slowEnd"),
    );
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
        const how = t(
          lv?.layer === 1
            ? "play.runsTable"
            : fast.has(k)
              ? "play.runsFast"
              : "play.runsYours",
        );
        return el(
          "li",
          {},
          t("play.runsItem", { name: lv ? levelName(lv) : k, how }),
        );
      }),
    );
    if (!kinds.length) this.runsAs.append(el("li", {}, t("play.noComponents")));
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
    box.append(el("legend", {}, t("play.optionsFor", { id: part.id })));
    if (wiring) {
      const label = el("label", {}, t("play.busWidth"));
      const select = el("select");
      for (let w = 2; w <= 16; w++) {
        const o = el("option", { value: String(w) }, t("play.bits", { n: w }));
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
      const label = el("label", {}, t("play.repeat"));
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
        box.append(el("p", { class: "help" }, t("play.repeatHelp")));
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
          lab.append(cb, t("play.share", { pin }));
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
    this.statusLine.textContent = knownText(text);
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
      this.say(t("play.simError", { error: String(e) }));
      return null;
    }
  }

  /** Runs input steps in order on one circuit (sequential levels). */
  private runSteps(
    steps: Record<string, number>[],
    state: Record<string, string>,
  ): StepsView | null {
    try {
      return simulateSteps(
        this.library,
        this.level.id,
        this.design,
        steps,
        state,
      );
    } catch (e) {
      this.say(t("play.simError", { error: String(e) }));
      return null;
    }
  }

  /** Re-simulates (or draws `view`, already simulated); `full` also
   * refreshes the truth table and lists. */
  private refresh(full: boolean, view?: SimView): void {
    // Combinational levels always start fresh, exactly like the checker.
    this.view =
      view ??
      this.simulateWith(this.inputs, this.level.sequential ? this.memory : {});
    if (this.level.sequential && this.view) this.memory = this.view.state;
    // Live history is what the learner did; a replayed test step isn't.
    if (this.currentStep === null) this.record(this.view);
    else this.renderWave();
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
    this.emptyHint.textContent = t("play.emptyHint");
    this.renderInputs();
    this.renderOutputs();
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
    // Clicking a bit re-renders the inputs: keep focus on that bit.
    const focused =
      document.activeElement instanceof HTMLElement &&
      this.inputBox.contains(document.activeElement)
        ? document.activeElement.dataset.key
        : undefined;
    this.inputBox.replaceChildren(
      ...this.level.inputs.map((name) => {
        const v = this.inputs[name] ?? 0;
        const w = this.width(name);
        if (w > 1) {
          const label = el(
            "label",
            { class: "bus-input" },
            t("play.busLabel", { name, w }),
          );
          const input = el("input", {
            type: "text",
            inputmode: "numeric",
            "data-port": name,
            value: formatValue(v, w),
            "aria-describedby": "bus-help",
          });
          // For an instruction, its assembly next to the number.
          const describe = this.describer(name);
          const asm = describe
            ? el("span", { class: "asm" }, describe(String(v)))
            : null;
          let bits = this.showsBits(name) ? this.bitRow(name, v, w) : null;
          input.addEventListener("change", () => {
            const n = parseNumber(input.value);
            if (n === undefined || n >= 2 ** w || n < 0) {
              this.say(
                t("play.notANumber", { text: input.value, max: 2 ** w - 1 }),
              );
              input.value = formatValue(v, w);
              return;
            }
            this.inputs[name] = n;
            this.currentStep = null;
            if (asm) asm.textContent = describe?.(String(n)) ?? "";
            // The inputs aren't rebuilt while this box has focus.
            const row = bits && this.bitRow(name, n, w);
            if (row) bits?.replaceWith(row);
            bits = row;
            this.refresh(false);
          });
          label.append(input);
          if (asm) label.append(asm);
          if (!bits) return label;
          const group = el("div", { class: "bus-field" });
          group.append(label, bits);
          return group;
        }
        const b = el(
          "button",
          {
            type: "button",
            class: "input-toggle",
            "aria-pressed": String(v === 1),
            "data-key": name,
          },
          `${name} = ${v}`,
        );
        b.addEventListener("click", () => this.toggle(name));
        return b;
      }),
    );
    if (focused)
      this.inputBox
        .querySelector<HTMLElement>(`[data-key="${CSS.escape(focused)}"]`)
        ?.focus();
  }

  /** Buses up to 16 bits also show their bits (inputs can flip them). */
  private showsBits(port: string): boolean {
    const w = this.width(port);
    return w > 1 && w <= 16;
  }

  /** One button per bit of a bus input, most significant first. */
  private bitRow(name: string, v: number, w: number): HTMLElement {
    const row = el("div", {
      class: "bits",
      role: "group",
      "aria-label": t("play.bitsOf", { name }),
    });
    bitsOf(v, w).forEach((bit, k) => {
      const i = w - 1 - k;
      const b = el(
        "button",
        {
          type: "button",
          class: `bit v${bit}`,
          "aria-pressed": String(bit === 1),
          "data-key": `${name}.${i}`,
          title: t("play.bitTitle", { name, i, v: bit }),
          "aria-label": t("play.bitTitle", { name, i, v: bit }),
        },
        String(bit),
      );
      b.addEventListener("click", () => {
        this.inputs[name] = bit ? v - 2 ** i : v + 2 ** i;
        this.currentStep = null;
        this.refresh(false);
      });
      row.append(b);
    });
    return row;
  }

  /** Bus outputs as a number and as bits, so a change shows bit by bit. */
  private renderOutputs(): void {
    this.outputBox.replaceChildren(
      ...this.level.outputs
        .filter((name) => this.showsBits(name))
        .map((name) => {
          const w = this.width(name);
          const got = this.view?.outputs.find(([n]) => n === name)?.[1];
          const bits =
            got === undefined
              ? []
              : /^\d+$/.test(got)
                ? bitsOf(Number(got), w).map(String)
                : got.length === w
                  ? [...got]
                  : [];
          const field = el("div", { class: "bus-field" });
          field.append(
            el(
              "p",
              { class: "bus-input" },
              `${name} = ${got === undefined ? "–" : showValue(got, w)}`,
            ),
          );
          const row = el("div", {
            class: "bits",
            role: "img",
            "aria-label": `${t("play.bitsOf", { name })}: ${bits.join(" ") || "–"}`,
          });
          for (const bit of bits)
            row.append(el("span", { class: `bit v${bit}` }, bit));
          field.append(row);
          return field;
        }),
    );
  }

  private renderTable(): void {
    // A sequential level's steps run in order on one circuit, in a single
    // run from power-on; combinational rows each start fresh.
    const steps = this.table.map((row) => Object.fromEntries(row.inputs));
    const run = this.level.sequential ? this.runSteps(steps, {}) : null;
    const failed = new Set<number>();
    this.tableBody.replaceChildren(
      ...this.table.map((row, i) => {
        const inputs = steps[i] ?? {};
        const view: Pick<SimView, "blocked" | "outputs"> | null = run
          ? { blocked: run.view.blocked, outputs: run.outputs[i] ?? [] }
          : this.simulateWith(inputs);
        const tr = el("tr", { tabindex: "0", "data-row": String(i) });
        let ok = Boolean(view && !view.blocked);
        let cells = this.level.sequential
          ? `<td class="step">${i + 1}</td>`
          : "";
        cells += row.inputs
          .map(([n, v]) => {
            const asm = this.describer(n)?.(String(v));
            const title = asm ? ` title="${esc(asm)}"` : "";
            return `<td${title}>${formatValue(v, this.width(n))}</td>`;
          })
          .join("");
        for (const [name, want] of row.outputs) {
          const got = view?.blocked
            ? "–"
            : (view?.outputs.find(([n]) => n === name)?.[1] ?? "–");
          const any = row.skip.includes(name);
          if (!any && got !== String(want)) ok = false;
          const shown = got === "–" ? got : showValue(got, this.width(name));
          cells += `<td>${any ? `<span class="any">${esc(t("play.any"))}</span>` : formatValue(want, this.width(name))}</td><td class="got">${shown}</td>`;
        }
        cells += `<td class="mark">${ok ? `<span class="ok">${esc(t("play.match"))}</span>` : `<span class="bad">${esc(t("play.differs"))}</span>`}</td>`;
        tr.innerHTML = cells;
        tr.classList.toggle("row-ok", ok);
        if (!ok) failed.add(i);
        const pick = () => {
          if (this.level.sequential) this.replayStep(i);
          else {
            this.setInputs(row.inputs);
            this.refresh(false);
          }
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
    this.testRun = { outputs: run?.outputs ?? [], failed };
    this.markCurrentRow();
    this.renderWave();
  }

  /** Replays the test up to step `i`: the canvas shows that moment. */
  private replayStep(i: number): void {
    const row = this.table[i];
    if (!row) return;
    const steps = this.table
      .slice(0, i + 1)
      .map((r) => Object.fromEntries(r.inputs));
    this.setInputs(row.inputs);
    const run = this.runSteps(steps, {});
    this.memory = run?.view.state ?? {};
    this.currentStep = i;
    this.say(
      i === 0
        ? t("play.showingStep1")
        : t("play.showingStep", { n: i + 1, m: i }),
    );
    this.refresh(false, run?.view);
  }

  // ---- waveform ---------------------------------------------------------------

  private wavePanel(): HTMLElement {
    const box = el("section", { class: "wave-box", "aria-label": "Waveform" });
    const head = el("div", { class: "wave-head" });
    const toggle = el(
      "button",
      { type: "button", "aria-expanded": "true", class: "wave-toggle" },
      t("play.waveform"),
    );
    const tabs = el("div", { class: "wave-tabs", role: "group" });
    const tab = (id: "test" | "live", label: string) => {
      const b = el(
        "button",
        { type: "button", "aria-pressed": String(this.waveTab === id) },
        label,
      );
      b.addEventListener("click", () => {
        this.waveTab = id;
        tabs
          .querySelectorAll("button")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        this.renderWave();
      });
      return b;
    };
    tabs.append(
      tab("test", t("play.waveTest")),
      tab("live", t("play.waveLive")),
    );
    const clear = el(
      "button",
      { type: "button", class: "wave-clear" },
      t("play.waveClear"),
    );
    clear.addEventListener("click", () => {
      this.liveLog = [];
      this.renderWave();
    });
    toggle.addEventListener("click", () => {
      const open = this.wave.hidden;
      this.wave.hidden = !open;
      tabs.hidden = !open;
      clear.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    head.append(toggle, tabs, clear);
    box.append(head, this.wave);
    return box;
  }

  /** Remembers a live moment for the waveform (sequential levels). */
  private record(view: SimView | null): void {
    if (!this.level.sequential || !view || view.blocked) return;
    const sample = { inputs: { ...this.inputs }, outputs: view.outputs };
    const last = this.liveLog[this.liveLog.length - 1];
    if (last && JSON.stringify(last) === JSON.stringify(sample)) return;
    this.liveLog.push(sample);
    if (this.liveLog.length > 40) this.liveLog.shift();
    this.renderWave();
  }

  /** For a 16-bit `instr` port: its value as assembly ("SET r1, 5"). */
  private describer(name: string): ((value: string) => string) | undefined {
    if (name !== "instr" || this.width(name) !== 16) return undefined;
    return (value) => (/^\d+$/.test(value) ? disassemble(Number(value)) : "");
  }

  private renderWave(): void {
    if (!this.level.sequential || this.wave.hidden) return;
    const l = this.level;
    const live = this.waveTab === "live";
    const count = live ? this.liveLog.length : this.table.length;
    const input = (name: string): Signal => ({
      name,
      width: this.width(name),
      describe: this.describer(name),
      values: live
        ? this.liveLog.map((h) => String(h.inputs[name] ?? 0))
        : this.table.map((r) =>
            String(r.inputs.find(([n]) => n === name)?.[1] ?? ""),
          ),
    });
    const output = (name: string): Signal => ({
      name,
      width: this.width(name),
      output: true,
      values: (live
        ? this.liveLog.map((h) => h.outputs)
        : this.testRun.outputs
      ).map((outs) => outs.find(([n]) => n === name)?.[1] ?? ""),
    });
    const signals = [...l.inputs.map(input), ...l.outputs.map(output)];
    if (!count) {
      this.wave.replaceChildren(
        el(
          "p",
          { class: "help" },
          live ? t("play.waveLiveEmpty") : t("play.waveEmpty"),
        ),
      );
      return;
    }
    this.wave.replaceChildren(
      drawWaveform(
        signals,
        count,
        live
          ? { first: 1 }
          : {
              failed: this.testRun.failed,
              current: this.currentStep,
              pick: (i) => this.replayStep(i),
            },
      ),
    );
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
          el(
            "strong",
            {},
            t(p.severity === "error" ? "play.error" : "play.note"),
          ),
          ...rich(problemText(p)),
        );
        return li;
      }),
    );
    // Wires of different widths usually mean a missing Repeat or Share:
    // offer it as a button on the canvas, where the wiring happens.
    const fixes =
      this.level.layer >= 2
        ? widthFixes(this.design, this.level.widths ?? {}, this.ports)
        : [];
    this.fixBox.replaceChildren(...fixes.map((fix) => this.fixItem(fix)));
    if (this.view?.shorts.length) {
      this.problemList.prepend(
        el(
          "li",
          { class: "error" },
          t("play.shortNow", { parts: this.view.shorts[0]?.join(", ") ?? "" }),
        ),
      );
    }
  }

  private fixItem(fix: Fix): HTMLElement {
    const part = this.design.parts.find((p) => p.id === fix.part);
    const base = (pin: string) =>
      (part && this.ports[part.kind]?.widths?.[pin]) ?? 1;
    const li = el("li", { class: "fix" });
    const button = el(
      "button",
      { type: "button" },
      fix.kind === "repeat"
        ? t("play.fixRepeat", { part: fix.part, n: fix.n })
        : t("play.fixShare", { part: fix.part, pin: fix.pin }),
    );
    button.addEventListener("click", () => {
      const next =
        fix.kind === "repeat"
          ? updatePart(this.design, fix.part, { repeat: fix.n })
          : updatePart(this.design, fix.part, {
              shared: [...(part?.shared ?? []), fix.pin],
            });
      this.selected = fix.part;
      this.onChange(next, true);
    });
    const why =
      fix.kind === "repeat"
        ? t("play.fixRepeatWhy", {
            w: fix.n * base(fix.pin),
            b: base(fix.pin),
          })
        : t("play.fixShareWhy", { pin: fix.pin, b: base(fix.pin) });
    li.append(el("strong", {}, t("play.fixTry")), button, ...rich(why));
    return li;
  }

  /**
   * Check runs passed memory components as their models, like the level
   * map's re-check; the live editor keeps the learner's own choice.
   */
  private checkLibrary(): LibraryInput {
    const memory = memoryParts(
      this.app.levels,
      this.library.unlocked.map((d) => d.component),
    );
    return {
      ...this.library,
      fast: [...new Set([...(this.library.fast ?? []), ...memory])],
    };
  }

  private runCheck(): void {
    let report: Report;
    try {
      report = check(this.checkLibrary(), this.level.id, this.design);
    } catch (e) {
      this.result.textContent = t("play.couldntCheck", { error: String(e) });
      return;
    }
    this.result.replaceChildren();
    if (report.passed) {
      void saveDesign(this.app, this.level.id, this.design, true);
      const next = this.root.dataset.next;
      const box = el("div", { class: "passed" });
      const seq = this.level.sequential ? 1 : 0;
      const tested = t("play.passedRows", {
        rows: report.rows.length,
        random: report.random ? report.random.run.toLocaleString("en-US") : 0,
        seq,
      });
      const stats =
        this.level.layer === 1
          ? t("play.usingTransistors", { n: report.transistors })
          : t("play.usingGates", { cells: report.cells, depth: report.depth });
      box.innerHTML = `<p><strong>${esc(t("play.passed"))}</strong> ${esc(tested)}, ${esc(stats)}.
        ${esc(t("play.nowInToolbox", { name: levelName(this.level) }))}</p>
        <p>${next ? `<a href="${playHref(next)}">${esc(t("play.nextLevel"))}</a> · ` : ""}<a href="#/levels">${esc(t("play.levelMap"))}</a></p>`;
      this.result.append(box);
      this.highlightParts.clear();
      this.highlightPorts.clear();
      this.refresh(false);
      return;
    }
    const failed = report.rows.filter((r) => !r.passed).length;
    const seq = this.level.sequential ? 1 : 0;
    const randomNote =
      report.random && report.random.failed > 0
        ? t("play.failedRandom", {
            failed: report.random.failed.toLocaleString("en-US"),
            run: report.random.run.toLocaleString("en-US"),
            seq,
          })
        : "";
    const head = report.rows.length
      ? t("play.failedRows", { failed, rows: report.rows.length, seq }) +
        randomNote
      : t("play.designErrors");
    this.result.append(el("p", { class: "failed" }, head));
    const list = el("ul", { class: "diagnostics" });
    for (const p of report.problems.filter((x) => x.severity === "error")) {
      const li = el("li");
      li.append(...rich(problemText(p)));
      list.append(li);
    }
    for (const d of report.diagnostics) list.append(this.diagnosticItem(d));
    this.result.append(list);
  }

  private diagnosticItem(d: Diagnostic): HTMLElement {
    const li = el("li");
    const b = el("button", { type: "button", class: "diag" });
    b.append(
      ...rich(
        diagnosticText(d, {
          sequential: this.level.sequential,
          rows: this.table.length,
        }),
      ),
    );
    b.addEventListener("click", () => {
      this.setInputs(d.inputs);
      this.highlightParts = new Set(d.parts);
      this.highlightPorts = new Set(d.ports);
      this.refresh(false);
      this.say(t("play.showingRow", { n: d.row }));
    });
    li.append(b);
    const hintText = levelHint(this.level, d.kind, d.hint);
    if (hintText) {
      const hint = el("p", { class: "hint" }, t("play.hint"));
      hint.append(...rich(hintText));
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
      levelName(this.level),
      ...stack.map((s) => {
        const p = s.design.parts.find((x) => x.id === s.id);
        return `${s.id} (${this.ports[p?.kind ?? ""]?.name ?? p?.kind})`;
      }),
    ].join(" › ");
    const head = el("div", { class: "inside-head" });
    head.append(
      el("h2", { tabindex: "-1" }, t("play.inside", { path: crumbs })),
    );
    const back = el(
      "button",
      { type: "button" },
      t(stack.length > 1 ? "play.upOne" : "play.close"),
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
      t("play.insideNote", {
        name: levelName(comp),
        parent: levelName(this.level),
      }),
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
    const edit = el(
      "a",
      { href: playHref(comp.id) },
      t("play.editIt", { name: levelName(comp) }),
    );
    this.inside.append(head, note, c.el, edit);
    this.inside.querySelector<HTMLElement>("h2")?.focus();
  }
}
