import { POWER_ON, settle, type Bit, type LatchState } from "../demos/latch";
import { t } from "../i18n";
import { Demo, figcaption, reducedMotion, sheet, svg, wide } from "./kit";

const CSS = sheet(`
  .wire { stroke: var(--muted); stroke-width: 3; fill: none; }
  .wire.v1 { stroke: var(--wire-1); }
  .wire.vX { stroke: var(--wire-x); stroke-dasharray: 6 4; }
  .gate { fill: var(--bg); stroke: var(--text); stroke-width: 2; }
  .tag { fill: var(--surface); stroke: var(--border); }
  .val { font-weight: 700; }
  .name { font-weight: 600; }
  .delay { fill: var(--muted); }
  .note.warn { color: var(--error); font-weight: 600; }
`);

/**
 * <latch-demo>: two NOR gates, each output wired back into the other. Set
 * and reset it, watch the signal go round the loop one gate delay at a
 * time, and see why s and r must not both be 1.
 */
export class LatchDemo extends Demo {
  private s: 0 | 1 = 0;
  private r: 0 | 1 = 0;
  private state: LatchState = POWER_ON;
  /** Gate delays since the last input change (for the step display). */
  private delay = 0;
  private timer = 0;
  private settled = true;

  constructor() {
    super(CSS);
  }

  disconnectedCallback(): void {
    clearTimeout(this.timer);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("latch.caption"), t("latch.captionText")));
    const controls = document.createElement("div");
    controls.className = "controls";
    const btn = (onClick: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    };
    this.sBtn = btn(() => this.set(this.s ? 0 : 1, this.r));
    this.rBtn = btn(() => this.set(this.s, this.r ? 0 : 1));
    const both = btn(() => this.set(0, 0, true));
    both.textContent = t("latch.release");
    const power = btn(() => {
      clearTimeout(this.timer);
      this.s = 0;
      this.r = 0;
      this.state = POWER_ON;
      this.delay = 0;
      this.settled = true;
      this.draw();
    });
    power.textContent = t("latch.power");
    controls.append(this.sBtn, this.rBtn, both, power);
    this.pic = document.createElement("div");
    this.status = document.createElement("p");
    this.status.className = "note";
    this.status.setAttribute("aria-live", "polite");
    fig.append(controls, this.pic, this.status);
    this.root.append(fig);
    this.draw();
  }

  private sBtn!: HTMLButtonElement;
  private rBtn!: HTMLButtonElement;
  private pic!: HTMLElement;
  private status!: HTMLElement;

  /** New inputs: play the gate delays (all at once with reduced motion). */
  private set(s: 0 | 1, r: 0 | 1, release = false): void {
    clearTimeout(this.timer);
    if (release) {
      // Both 1 first (the forbidden state), then both 0 together.
      this.state = settle(1, 1, this.state).trace.at(-1) ?? this.state;
    }
    this.s = s;
    this.r = r;
    const run = settle(s, r, this.state);
    this.settled = run.settled;
    this.delay = 0;
    if (reducedMotion()) {
      this.state = run.trace.at(-1) ?? this.state;
      this.delay = run.trace.length;
      this.draw();
      return;
    }
    const play = (i: number) => {
      const next = run.trace[i];
      if (!next) return;
      this.state = next;
      this.delay = i + 1;
      this.draw();
      this.timer = window.setTimeout(() => play(i + 1), 450);
    };
    this.draw();
    play(0);
  }

  private draw(): void {
    const { q, qn } = this.state;
    this.sBtn.textContent = t("latch.s", { v: this.s });
    this.sBtn.setAttribute("aria-pressed", String(this.s === 1));
    this.rBtn.textContent = t("latch.r", { v: this.r });
    this.rBtn.setAttribute("aria-pressed", String(this.r === 1));
    const pic = svg("svg", {
      viewBox: "0 0 560 230",
      role: "img",
      "aria-label": t("latch.picLabel", { r: this.r, s: this.s, q, qn }),
    });
    const cls = (v: Bit) => `wire v${v}`;
    const wire = (d: string, v: Bit) => svg("path", { d, class: cls(v) }, pic);
    const tag = (x: number, y: number, v: Bit) => {
      svg(
        "rect",
        { x: x - 11, y: y - 11, width: 22, height: 18, rx: 4, class: "tag" },
        pic,
      );
      svg(
        "text",
        { x, y: y + 3, "text-anchor": "middle", class: "val" },
        pic,
        String(v),
      );
    };
    const nor = (x: number, y: number, label: string) => {
      svg(
        "path",
        {
          d: `M${x},${y - 30} Q${x + 30},${y - 30} ${x + 60},${y} Q${x + 30},${y + 30} ${x},${y + 30} Q${x + 15},${y} ${x},${y - 30} Z`,
          class: "gate",
        },
        pic,
      );
      svg("circle", { cx: x + 66, cy: y, r: 6, class: "gate" }, pic);
      svg("text", { x: x + 22, y: y + 4, class: "name" }, pic, label);
    };
    // Inputs, outputs, and the loop: each output drops into the gap
    // between the gates and enters the other gate's free input.
    wire("M40,45 H232", this.r);
    wire("M40,175 H232", this.s);
    wire("M302,60 H500", q);
    wire("M302,160 H500", qn);
    wire("M330,60 V115 H205 V145 H232", q); // q → bottom gate
    wire("M345,160 V105 H190 V75 H232", qn); // q̄ → top gate
    nor(230, 60, "NOR");
    nor(230, 160, "NOR");
    svg("text", { x: 14, y: 49, class: "name" }, pic, "r");
    svg("text", { x: 14, y: 179, class: "name" }, pic, "s");
    svg("text", { x: 508, y: 64, class: "name" }, pic, "q");
    svg("text", { x: 508, y: 164, class: "name" }, pic, "q̄");
    tag(120, 45, this.r);
    tag(120, 175, this.s);
    tag(450, 60, q);
    tag(450, 160, qn);
    if (this.delay)
      svg(
        "text",
        { x: 14, y: 222, class: "delay" },
        pic,
        t("latch.delays", { n: this.delay }),
      );
    this.pic.replaceChildren(wide(pic));
    this.status.className = "note";
    if (!this.settled) {
      this.status.className = "note warn";
      this.status.textContent = t("latch.oscillates");
    } else if (q === "X") {
      this.status.textContent = t("latch.unknown");
    } else if (this.s === 1 && this.r === 1) {
      this.status.className = "note warn";
      this.status.textContent = t("latch.forbidden");
    } else if (this.s === 0 && this.r === 0) {
      this.status.textContent = t("latch.holding", { q, qn });
    } else {
      this.status.textContent = t(
        this.s === 1 ? "latch.setting" : "latch.resetting",
      );
    }
  }
}

customElements.define("latch-demo", LatchDemo);
