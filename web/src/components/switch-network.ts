import { LOGIC, lampOn, type Arrangement } from "../demos/network";
import { t } from "../i18n";
import { Demo, figcaption, sheet, svg, wide } from "./kit";

const CSS = sheet(`
  .row { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  .wire { stroke: var(--muted); stroke-width: 3; fill: none; }
  .wire.live { stroke: var(--wire-1); }
  .lamp { fill: var(--bg); stroke: var(--text); stroke-width: 2; }
  .lamp.on { fill: var(--channel); }
  .switch-btn { display: flex; gap: 0.5rem; margin: 0.5rem 0 0.75rem; }
  table { border-collapse: collapse; font-variant-numeric: tabular-nums; margin-top: 0.5rem; }
  td, th { padding: 0.125rem 0.625rem; text-align: center; border-bottom: 1px solid var(--border); }
  tr.current { background: color-mix(in srgb, var(--accent) 18%, transparent); font-weight: 700; }
  h3 { margin: 0; font-size: 1rem; }
`);

/**
 * <switch-network>: flip two switches and see why switches in series
 * compute AND and switches in parallel compute OR.
 */
export class SwitchNetwork extends Demo {
  private a = false;
  private b = false;

  constructor() {
    super(CSS);
  }

  protected build(): void {
    const fig = document.createElement("figure");
    fig.append(figcaption(t("net.caption"), t("net.captionHtml")));
    const buttons = document.createElement("div");
    buttons.className = "switch-btn";
    const mk = (name: "a" | "b") => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.addEventListener("click", () => {
        this[name] = !this[name];
        this.draw();
      });
      buttons.append(btn);
      return btn;
    };
    const ba = mk("a");
    const bb = mk("b");
    const row = document.createElement("div");
    row.className = "row";
    const panels = (["series", "parallel"] as Arrangement[]).map((arr) => {
      const box = document.createElement("div");
      const h = document.createElement("h3");
      h.textContent = `${t(`net.${arr}`)}: ${LOGIC[arr]}`;
      const pic = svg("svg", { viewBox: "0 0 300 130", role: "img" });
      const out = document.createElement("p");
      out.setAttribute("aria-live", "polite");
      const table = document.createElement("table");
      box.append(h, wide(pic), out, table);
      row.append(box);
      return { arr, pic, out, table };
    });
    fig.append(buttons, row);
    this.root.append(fig);

    this.draw = () => {
      const state = (closed: boolean) =>
        t(closed ? "net.closed1" : "net.open0");
      ba.textContent = t("net.switch", { name: "A", state: state(this.a) });
      bb.textContent = t("net.switch", { name: "B", state: state(this.b) });
      ba.setAttribute("aria-pressed", String(this.a));
      bb.setAttribute("aria-pressed", String(this.b));
      for (const { arr, pic, out, table } of panels) {
        const on = lampOn(arr, this.a, this.b);
        pic.replaceChildren();
        pic.setAttribute(
          "aria-label",
          t("net.picLabel", {
            arr: t(`net.${arr}`),
            state: t(on ? "net.on" : "net.off"),
          }),
        );
        // Battery on the left, lamp on the right.
        svg("text", { x: 14, y: 70, "font-weight": 600 }, pic, "+");
        const sw = (
          x: number,
          y: number,
          closed: boolean,
          label: string,
          live: boolean,
        ) => {
          svg("circle", { cx: x, cy: y, r: 3, fill: "var(--text)" }, pic);
          svg("circle", { cx: x + 40, cy: y, r: 3, fill: "var(--text)" }, pic);
          svg(
            "path",
            {
              d: closed
                ? `M${x},${y} L${x + 40},${y}`
                : `M${x},${y} L${x + 36},${y - 18}`,
              class: `wire${live ? " live" : ""}`,
            },
            pic,
          );
          svg(
            "text",
            { x: x + 20, y: y - 22, "text-anchor": "middle" },
            pic,
            `${label}: ${t(closed ? "net.closed" : "net.open")}`,
          );
        };
        if (arr === "series") {
          const live1 = true;
          const live2 = this.a;
          const live3 = this.a && this.b;
          svg(
            "path",
            { d: "M30,65 H70", class: `wire${live1 ? " live" : ""}` },
            pic,
          );
          sw(70, 65, this.a, "A", live1);
          svg(
            "path",
            { d: "M110,65 H140", class: `wire${live2 ? " live" : ""}` },
            pic,
          );
          sw(140, 65, this.b, "B", live2);
          svg(
            "path",
            { d: "M180,65 H230", class: `wire${live3 ? " live" : ""}` },
            pic,
          );
        } else {
          svg(
            "path",
            {
              d: "M30,65 H60 M60,35 V95 M60,35 H90 M60,95 H90",
              class: "wire live",
            },
            pic,
          );
          sw(90, 35, this.a, "A", true);
          sw(90, 95, this.b, "B", true);
          svg("path", { d: "M130,35 H160 M130,95 H160", class: "wire" }, pic);
          svg(
            "path",
            { d: `M130,35 H160 V65`, class: `wire${this.a ? " live" : ""}` },
            pic,
          );
          svg(
            "path",
            { d: `M130,95 H160 V65`, class: `wire${this.b ? " live" : ""}` },
            pic,
          );
          svg(
            "path",
            { d: "M160,65 H230", class: `wire${on ? " live" : ""}` },
            pic,
          );
        }
        svg(
          "circle",
          { cx: 250, cy: 65, r: 18, class: `lamp${on ? " on" : ""}` },
          pic,
        );
        svg(
          "text",
          { x: 250, y: 108, "text-anchor": "middle" },
          pic,
          t(on ? "net.lampOn" : "net.lampOff"),
        );
        out.textContent = t("net.result", {
          a: Number(this.a),
          b: Number(this.b),
          state: t(on ? "net.on1" : "net.off0"),
        });
        const rows = [
          [0, 0],
          [0, 1],
          [1, 0],
          [1, 1],
        ];
        table.innerHTML =
          `<caption class="muted">${t("net.table", { logic: LOGIC[arr] })}</caption><tr><th>A</th><th>B</th><th>${t("net.lamp")}</th></tr>` +
          rows
            .map(([a, b]) => {
              const cur = a === Number(this.a) && b === Number(this.b);
              return `<tr class="${cur ? "current" : ""}"><td>${a}</td><td>${b}</td><td>${Number(lampOn(arr, a === 1, b === 1))}</td></tr>`;
            })
            .join("");
      }
    };
    this.draw();
  }

  private draw: () => void = () => {};
}

customElements.define("switch-network", SwitchNetwork);
