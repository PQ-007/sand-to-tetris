// A level page: goal, toolbox, canvas, inputs, live truth table, Check,
// and a keyboard/screen-reader panel listing every part and connection.
import { fastIds, getApp, levelEntry, saveDesign, type App } from "./app";
import { CircuitCanvas, type CanvasProps } from "./editor/canvas";
import { clampToCanvas, freeSpot, snap, type Point } from "./editor/geometry";
import {
  addPart,
  addWire,
  emptyDesign,
  endpointKey,
  endpointLabel,
  History,
  removePart,
  removeWire,
  updatePart,
} from "./editor/model";
import { orderLevels, playLibrary, toolbox, type ToolboxItem } from "./game";
import { playHref } from "./router";
import { check, simulate } from "./sim/core";
import type {
  Design,
  Diagnostic,
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
    root.innerHTML = `<h1 tabindex="-1">No such level</h1><p><a href="#/levels">Back to the level map</a></p>`;
    return;
  }
  const level = entry.info.level;
  const status = a.status[levelId];
  if (status === "locked") {
    const need = level.requires.filter((r) => a.status[r] !== "passed");
    root.innerHTML = `<h1 tabindex="-1">${esc(level.name)} is locked</h1>
      <p>Pass ${need.map((r) => `<a href="${playHref(r)}">${esc(levelEntry(a, r)?.info.level.name ?? r)}</a>`).join(" and ")} first.</p>
      <p><a href="#/levels">Back to the level map</a></p>`;
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
  private undoBtn = el("button", { type: "button" }, "Undo");
  private redoBtn = el("button", { type: "button" }, "Redo");
  private inputBox = el("div", { class: "input-toggles" });
  private tableBody = el("tbody");
  private result = el("div", { class: "check-result", "aria-live": "polite" });
  private problemList = el("ul", { class: "problems" });
  private partsList = el("ul", { class: "kbd-list" });
  private wiresList = el("ul", { class: "kbd-list" });
  private fromSelect = el("select", { "aria-label": "Connect from" });
  private toSelect = el("select", { "aria-label": "Connect to" });
  private inside = el("div", { class: "inside", hidden: "" });
  private stats = el("p", { class: "sim-stats", "aria-live": "polite" });
  private propsBox = el("div", { class: "props" });
  private runsAs = el("ul", { class: "runs-as" });
  private selected: string | null = null;

  constructor(
    private root: HTMLElement,
    private app: App,
    private level: Level,
    private table: {
      inputs: [string, number][];
      outputs: [string, number][];
    }[],
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
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/levels">Levels</a> › Layer ${l.layer} › ${esc(l.name)}</nav>
      <h1 tabindex="-1">${esc(l.name)}${l.optional ? ' <span class="badge">side quest</span>' : ""}</h1>
      <p class="goal">${esc(l.goal.trim())}</p>`;
    this.root.dataset.next = next ?? "";
    if (!this.app.store.persistent) {
      this.root.append(
        el(
          "p",
          { class: "notice" },
          "Your browser isn't letting this site save data, so progress lasts only until you close this tab. Use Export on the level map to keep it.",
        ),
      );
    }

    const grid = el("div", { class: "play-grid" });
    const bench = el("section", { class: "bench", "aria-label": "Workbench" });
    const toolbar = el("div", {
      class: "toolbar",
      role: "toolbar",
      "aria-label": "Toolbox",
    });
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
    toolbar.append(this.undoBtn, this.redoBtn);
    const wrap = el("div", { class: "canvas-wrap" });
    wrap.append(this.canvas.el);
    bench.append(
      toolbar,
      el(
        "p",
        { class: "narrow-note" },
        "The editor works best on a larger screen. On a phone, scroll the canvas sideways, or use the parts and connections panel below.",
      ),
      wrap,
      this.stats,
      this.statusLine,
      this.propsBox,
      this.inside,
    );
    bench.append(
      el(
        "p",
        { class: "help" },
        "Drag parts from the toolbox. Drag from one pin to another (or click both) to wire them. Click an input on the left to flip it. Double-click a component to look inside. Delete removes the selection; Ctrl+Z undoes.",
      ),
    );

    const side = el("aside", {
      class: "side",
      "aria-label": "Inputs and tests",
    });
    side.append(el("h2", {}, "Inputs"), this.inputBox);
    if (l.inputs.some((p) => this.width(p) > 1)) {
      side.append(
        el(
          "p",
          { class: "help", id: "bus-help" },
          "Type a number for each bus input: decimal, 0x… hex or 0b… binary. Press Enter to apply.",
        ),
      );
    }
    const table = el("table", { class: "truth" });
    const head = el("thead");
    head.innerHTML = `<tr>${l.inputs.map((i) => `<th scope="col">${esc(i)}</th>`).join("")}${l.outputs.map((o) => `<th scope="col">${esc(o)} (want)</th><th scope="col">${esc(o)} (yours)</th>`).join("")}<th scope="col"><span class="visually-hidden">Result</span></th></tr>`;
    table.append(head, this.tableBody);
    const checkBtn = el(
      "button",
      { type: "button", class: "primary" },
      "Check",
    );
    checkBtn.addEventListener("click", () => this.runCheck());
    side.append(
      el("h2", {}, "Truth table"),
      el(
        "p",
        { class: "help" },
        "Updates live as you wire. Click a row to set those inputs.",
      ),
      table,
      checkBtn,
      this.result,
      this.problemList,
    );
    if (l.layer >= 2) {
      side.append(
        el("h2", {}, "How parts run"),
        el(
          "p",
          { class: "help" },
          "Change which parts run as fast models on the level map.",
        ),
        this.runsAs,
      );
    }

    grid.append(bench, side);
    this.root.append(grid);
    this.root.append(this.keyboardPanel());

    document.addEventListener("keydown", this.onKeys);
    window.addEventListener(
      "hashchange",
      () => document.removeEventListener("keydown", this.onKeys),
      { once: true },
    );
  }

  private keyboardPanel(): HTMLElement {
    const details = el("details", { class: "kbd-panel" });
    details.append(
      el(
        "summary",
        {},
        "Parts and connections (keyboard and screen-reader view)",
      ),
    );
    const form = el("form", { class: "connect" });
    const btn = el("button", { type: "submit" }, "Connect");
    form.append(
      el("label", {}, "From "),
      this.fromSelect,
      el("label", {}, " to "),
      this.toSelect,
      btn,
    );
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const all = this.canvas.endpoints();
      const a = all.find((x) => endpointKey(x) === this.fromSelect.value);
      const b = all.find((x) => endpointKey(x) === this.toSelect.value);
      if (!a || !b) return;
      const next = addWire(this.design, a, b);
      if (typeof next === "string") this.say(next);
      else {
        this.onChange(next, true);
        this.say(
          `Connected ${endpointLabel(a, this.level.inputs)} to ${endpointLabel(b, this.level.inputs)}.`,
        );
      }
    });
    details.append(
      el(
        "p",
        { class: "help" },
        "Add parts with the toolbox buttons. On the canvas, Tab to a part and use the arrow keys to move it (Shift for bigger steps).",
      ),
      el("h3", {}, "Parts"),
      this.partsList,
      el("h3", {}, "Connections"),
      form,
      this.wiresList,
    );
    return details;
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
      ? `Settled after ${v.depth} gate delay${v.depth === 1 ? "" : "s"}.`
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
    this.refresh(false);
  }

  private setInputs(values: [string, number | string][]): void {
    for (const [k, v] of values) this.inputs[k] = Number(v);
  }

  private say(text: string): void {
    this.statusLine.textContent = text;
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      void saveDesign(this.app, this.level.id, this.design);
    }, 300);
  }

  // ---- simulation and checking ------------------------------------------------

  private simulateWith(inputs: Record<string, number>): SimView | null {
    try {
      return simulate(this.library, this.level.id, this.design, inputs);
    } catch (e) {
      this.say(`Simulation error: ${String(e)}`);
      return null;
    }
  }

  /** Re-simulates; `full` also refreshes the truth table and lists. */
  private refresh(full: boolean): void {
    this.view = this.simulateWith(this.inputs);
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
    this.renderInputs();
    this.renderStats();
    if (full) {
      this.renderProps();
      this.renderRunsAs();
      this.renderTable();
      this.renderLists();
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
    this.tableBody.replaceChildren(
      ...this.table.map((row, i) => {
        const inputs = Object.fromEntries(row.inputs);
        const view = this.simulateWith(inputs);
        const tr = el("tr", { tabindex: "0", "data-row": String(i) });
        let ok = Boolean(view && !view.blocked);
        let cells = row.inputs
          .map(([n, v]) => `<td>${formatValue(v, this.width(n))}</td>`)
          .join("");
        for (const [name, want] of row.outputs) {
          const got = view?.blocked
            ? "–"
            : (view?.outputs.find(([n]) => n === name)?.[1] ?? "–");
          if (got !== String(want)) ok = false;
          const shown = /^\d+$/.test(got)
            ? formatValue(Number(got), this.width(name))
            : got;
          cells += `<td>${formatValue(want, this.width(name))}</td><td class="got">${shown}</td>`;
        }
        cells += `<td class="mark">${ok ? '<span class="ok">✓ match</span>' : '<span class="bad">✗ differs</span>'}</td>`;
        tr.innerHTML = cells;
        tr.classList.toggle("row-ok", ok);
        const pick = () => {
          this.setInputs(row.inputs);
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
      const current = row.inputs.every(([k, v]) => (this.inputs[k] ?? 0) === v);
      const tr = this.tableBody.querySelector(`[data-row="${i}"]`);
      tr?.classList.toggle("current", current);
      if (current) tr?.setAttribute("aria-current", "true");
      else tr?.removeAttribute("aria-current");
    });
  }

  private renderProblems(): void {
    const problems = this.view?.problems ?? [];
    this.problemList.replaceChildren(
      ...problems.map((p) =>
        el(
          "li",
          { class: p.severity },
          `${p.severity === "error" ? "Error" : "Note"}: ${p.message}`,
        ),
      ),
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

  private renderLists(): void {
    const ins = this.level.inputs;
    this.partsList.replaceChildren(
      ...this.design.parts.map((p) => {
        const li = el("li");
        li.append(
          `${p.id} (${this.ports[p.kind]?.name ?? p.kind.toUpperCase()}) `,
        );
        const del = el("button", { type: "button" }, `Remove ${p.id}`);
        del.addEventListener("click", () =>
          this.onChange(removePart(this.design, p.id), true),
        );
        li.append(del);
        return li;
      }),
    );
    if (!this.design.parts.length)
      this.partsList.append(el("li", {}, "No parts yet."));
    this.wiresList.replaceChildren(
      ...this.design.wires.map((w, i) => {
        const li = el("li");
        li.append(
          `${endpointLabel(w.from, ins)} — ${endpointLabel(w.to, ins)} `,
        );
        const del = el("button", { type: "button" }, "Disconnect");
        del.addEventListener("click", () =>
          this.onChange(removeWire(this.design, i), true),
        );
        li.append(del);
        return li;
      }),
    );
    if (!this.design.wires.length)
      this.wiresList.append(el("li", {}, "No connections yet."));
    const options = this.canvas.endpoints().map((e) => {
      const o = el("option", { value: endpointKey(e) }, endpointLabel(e, ins));
      return o;
    });
    const keep = [this.fromSelect.value, this.toSelect.value];
    this.fromSelect.replaceChildren(...options.map((o) => o.cloneNode(true)));
    this.toSelect.replaceChildren(...options);
    if (keep[0]) this.fromSelect.value = keep[0];
    if (keep[1]) this.toSelect.value = keep[1];
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
        : `All ${report.rows.length} rows match`;
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
      ? `✗ ${failed} of ${report.rows.length} rows don't match yet.${randomNote}`
      : "✗ The design has errors (see below).";
    this.result.append(el("p", { class: "failed" }, head));
    const list = el("ul", { class: "diagnostics" });
    for (const p of report.problems.filter((x) => x.severity === "error")) {
      list.append(el("li", {}, p.message));
    }
    for (const d of report.diagnostics) list.append(this.diagnosticItem(d));
    this.result.append(list);
  }

  private diagnosticItem(d: Diagnostic): HTMLElement {
    const li = el("li");
    const b = el("button", { type: "button", class: "diag" }, d.message);
    b.addEventListener("click", () => {
      this.setInputs(d.inputs);
      this.highlightParts = new Set(d.parts);
      this.highlightPorts = new Set(d.ports);
      this.refresh(false);
      this.say(`Showing row ${d.row}. Highlighted parts are marked with "!".`);
    });
    li.append(b);
    if (d.hint) li.append(el("p", { class: "hint" }, `Hint: ${d.hint}`));
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
