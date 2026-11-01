// The level map: every layer's levels, what's open, passed or broken, as a
// tech tree (each level below the levels it needs) or as a list, plus
// export/import of progress (it lives only in this browser).
import {
  fastIds,
  getApp,
  levelEntry,
  replaceProgress,
  setFast,
  type App,
} from "./app";
import { fingerprint } from "./fast";
import { orderLevels, playLibrary, type Status } from "./game";
import {
  layoutTree,
  NODE_H,
  NODE_W,
  neighbours,
  type TreeInput,
} from "./techtree";
import { t, type Key } from "./i18n";
import { matchCheck } from "./sim/core";
import { parseProgressFile, progressFile } from "./progress";
import { playHref } from "./router";
import { levelGoal, levelName } from "./text";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const statusText = (st: Status) => t(`status.${st}` as Key);

/** Layer N is taught in chapter N, so it shares the chapter's title. */
const layerName = (layer: number) => t(`outline.${layer}.title` as Key);

export async function mountLevels(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="loading">${esc(t("page.loading"))}</p>`;
  const a = await getApp();
  selected = null;
  render(root, a);
}

type View = "tree" | "list";
const VIEW_KEY = "s2t-map-view";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "tree";
  } catch {
    return "tree";
  }
}

/** The level selected in the tree (kept across re-renders). */
let selected: string | null = null;

/** Why a level is open, passed, locked or broken, in one line. */
function detailText(a: App, id: string): string {
  const lv = levelEntry(a, id)?.info.level;
  if (!lv) return "";
  const st = a.status[id] ?? "locked";
  if (st === "locked") {
    const need = lv.requires
      .filter((r) => a.status[r] !== "passed")
      .map((r) => {
        const req = levelEntry(a, r)?.info.level;
        return req ? levelName(req) : r;
      });
    return t("levels.opensAfter", { names: need.join(t("levels.and")) });
  }
  if (st === "broken") return t("levels.brokenText");
  return levelGoal(lv).split("\n")[0] ?? "";
}

/** The fast-model switch for a passed component (Layer 2 and up). */
function swapHtml(a: App, id: string): string {
  const lv = levelEntry(a, id)?.info.level;
  if (!lv || a.status[id] !== "passed" || lv.layer < 2) return "";
  const isFast = fastIds(a).includes(id);
  return `<p class="swap"><button type="button" data-swap="${id}" aria-pressed="${isFast}">${esc(t("levels.runsAs", { mode: t(isFast ? "levels.fastModel" : "levels.yourDesign") }))}</button></p>
    <p class="swap-result" data-swap-result="${id}" aria-live="polite"></p>`;
}

function listHtml(a: App): string {
  const ordered = orderLevels(a.levels);
  const layers = [...new Set(ordered.map((l) => l.info.level.layer))];
  return layers
    .map((layer) => {
      const cards = ordered
        .filter((l) => l.info.level.layer === layer)
        .map((l) => {
          const lv = l.info.level;
          const st = a.status[lv.id] ?? "locked";
          const title =
            esc(levelName(lv)) +
            (lv.optional
              ? ` <span class="badge">${esc(t("levels.sideQuest"))}</span>`
              : "");
          return `<li class="level-card" data-status="${st}">
            <div class="level-top">
              <h3>${st === "locked" ? title : `<a href="${playHref(lv.id)}">${title}</a>`}</h3>
              <span class="pill level-status pill-${st}">${esc(statusText(st))}</span>
            </div>
            <p>${esc(detailText(a, lv.id))}</p>
            ${swapHtml(a, lv.id)}
          </li>`;
        })
        .join("");
      return `<section class="layer">
        <div class="section-head"><h2>${esc(t("levels.layer", { n: layer, name: layerName(layer) }))}</h2>
</div>
        <ol class="level-cards">${cards}</ol></section>`;
    })
    .join("");
}

function treeInput(a: App): TreeInput[] {
  return orderLevels(a.levels).map((l) => ({
    id: l.info.level.id,
    layer: l.info.level.layer,
    requires: l.info.level.requires,
  }));
}

function treeHtml(a: App): string {
  const tree = layoutTree(treeInput(a));
  const fast = new Set(fastIds(a));
  const bands = tree.bands
    .map(
      (b) => `<div class="tree-band" style="top:${b.y}px;height:${b.height}px">
        <h2>${esc(t("levels.layer", { n: b.layer, name: layerName(b.layer) }))}</h2></div>`,
    )
    .join("");
  const edges = tree.edges
    .map(
      (e) =>
        `<path d="${e.path}" data-from="${e.from}" data-to="${e.to}" class="edge${a.status[e.from] === "passed" ? " done" : ""}"/>`,
    )
    .join("");
  const nodes = tree.nodes
    .map((n) => {
      const lv = levelEntry(a, n.id)?.info.level;
      const st = a.status[n.id] ?? "locked";
      const extra = [
        fast.has(n.id) ? t("levels.fastBadge") : "",
        lv?.optional ? t("levels.sideQuest") : "",
      ].filter(Boolean);
      return `<button type="button" class="tree-node" data-node="${n.id}" data-status="${st}" aria-pressed="false"
        style="left:${n.x}px;top:${n.y}px;width:${NODE_W}px;height:${NODE_H}px">
        <span class="tn-name">${esc(lv ? levelName(lv) : n.id)}</span>
        <span class="tn-status">${esc([statusText(st), ...extra].join(" · "))}</span></button>`;
    })
    .join("");
  return `<div class="tree-wrap">
    <div class="tree-scroll" role="group" aria-label="${esc(t("levels.treeLabel"))}" aria-describedby="tree-help">
      <div class="tree" style="width:${tree.width}px;height:${tree.height}px">
        ${bands}
        <svg class="tree-edges" width="${tree.width}" height="${tree.height}" aria-hidden="true">${edges}</svg>
        ${nodes}
      </div>
    </div>
    <aside class="tree-detail" aria-live="polite"></aside>
  </div>`;
}

/** The detail panel for the selected level. */
function renderDetail(root: HTMLElement, a: App, id: string): void {
  const panel = root.querySelector<HTMLElement>(".tree-detail");
  const lv = levelEntry(a, id)?.info.level;
  if (!panel || !lv) return;
  const st = a.status[id] ?? "locked";
  const { needs, unlocks } = neighbours(treeInput(a), id);
  const chips = (ids: string[], empty: string) =>
    ids.length
      ? `<ul class="tree-chips">${ids
          .map((r) => {
            const l = levelEntry(a, r)?.info.level;
            const rs = a.status[r] ?? "locked";
            return `<li><button type="button" data-select="${r}" data-status="${rs}">${esc(l ? levelName(l) : r)} <span class="muted">${esc(statusText(rs))}</span></button></li>`;
          })
          .join("")}</ul>`
      : `<p class="muted">${esc(empty)}</p>`;
  panel.innerHTML = `
    <p class="panel-kicker">${esc(t("levels.layer", { n: lv.layer, name: layerName(lv.layer) }))}</p>
    <h2>${esc(levelName(lv))}</h2>
    <p><span class="pill level-status pill-${st}">${esc(statusText(st))}</span></p>
    <p>${esc(detailText(a, id))}</p>
    ${st === "locked" ? "" : `<p><a class="button primary block" href="${playHref(id)}">${esc(t("levels.play"))}</a></p>`}
    ${swapHtml(a, id)}
    <h3>${esc(t("levels.needs"))}</h3>${chips(needs, t("levels.needsNothing"))}
    <h3>${esc(t("levels.unlocks"))}</h3>${chips(unlocks, t("levels.unlocksNothing"))}`;
  panel.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((b) =>
    b.addEventListener("click", () => {
      select(root, a, b.dataset.select ?? "");
      root
        .querySelector<HTMLElement>(`[data-node="${b.dataset.select}"]`)
        ?.focus();
    }),
  );
  panel
    .querySelector<HTMLButtonElement>("[data-swap]")
    ?.addEventListener("click", () => swap(root, a, id));
}

/**
 * Lights up a level's lines and neighbours. While hovering or focusing
 * (`dim`), the rest of the tree fades; the selected level alone doesn't.
 */
function highlight(root: HTMLElement, id: string | null, dim = true): void {
  root.querySelectorAll<SVGPathElement>(".tree-edges path").forEach((p) => {
    const on = id !== null && (p.dataset.from === id || p.dataset.to === id);
    p.classList.toggle("hot", on);
  });
  const near = new Set<string>();
  if (id)
    root
      .querySelectorAll<SVGPathElement>(".tree-edges path.hot")
      .forEach((p) => {
        near.add(p.dataset.from ?? "");
        near.add(p.dataset.to ?? "");
      });
  root.querySelectorAll<HTMLElement>(".tree-node").forEach((n) => {
    n.classList.toggle(
      "near",
      near.has(n.dataset.node ?? "") && n.dataset.node !== id,
    );
  });
  root.querySelector(".tree")?.classList.toggle("focusing", dim && id !== null);
}

function select(root: HTMLElement, a: App, id: string): void {
  selected = id;
  root.querySelectorAll<HTMLElement>(".tree-node").forEach((n) => {
    n.setAttribute("aria-pressed", String(n.dataset.node === id));
  });
  highlight(root, id, false);
  renderDetail(root, a, id);
}

/** Arrow keys move between levels: along a row, or to the nearest level
 * in the row above or below. */
function moveFocus(root: HTMLElement, from: HTMLElement, key: string): void {
  const nodes = [...root.querySelectorAll<HTMLElement>(".tree-node")];
  const pos = (n: HTMLElement) => ({
    x: parseFloat(n.style.left),
    y: parseFloat(n.style.top),
  });
  const me = pos(from);
  const rows = [...new Set(nodes.map((n) => pos(n).y))].sort((p, q) => p - q);
  const row = rows.indexOf(me.y);
  let target: HTMLElement | undefined;
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const same = nodes
      .filter((n) => pos(n).y === me.y)
      .sort((p, q) => pos(p).x - pos(q).x);
    target = same[same.indexOf(from) + (key === "ArrowLeft" ? -1 : 1)];
  } else {
    const y = rows[row + (key === "ArrowUp" ? -1 : 1)];
    target = nodes
      .filter((n) => pos(n).y === y)
      .sort((p, q) => Math.abs(pos(p).x - me.x) - Math.abs(pos(q).x - me.x))[0];
  }
  target?.focus();
}

function wireTree(root: HTMLElement, a: App): void {
  const tree = root.querySelector<HTMLElement>(".tree");
  if (!tree) return;
  tree.querySelectorAll<HTMLButtonElement>(".tree-node").forEach((n) => {
    const id = n.dataset.node ?? "";
    n.addEventListener("click", () => select(root, a, id));
    n.addEventListener("pointerenter", () => highlight(root, id));
    n.addEventListener("pointerleave", () => highlight(root, selected, false));
    n.addEventListener("focus", () => highlight(root, id));
    n.addEventListener("blur", () => highlight(root, selected, false));
    n.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      moveFocus(root, n, e.key);
    });
  });
  // Start on the level to play next: the first open one, in play order.
  const order = orderLevels(a.levels).map((l) => l.info.level.id);
  if (!selected || !order.includes(selected))
    selected =
      order.find((id) => a.status[id] === "open") ??
      order.find((id) => a.status[id] === "broken") ??
      order[order.length - 1] ??
      null;
  if (selected) select(root, a, selected);
}

function render(root: HTMLElement, a: App): void {
  const view = savedView();
  const toggle = (v: View, key: Key) =>
    `<button type="button" data-view="${v}" aria-pressed="${view === v}">${esc(t(key))}</button>`;
  root.innerHTML = `
    <div class="page-head levels-head">
      <div>
        <h1 tabindex="-1">${esc(t("levels.title"))}</h1>
        <p class="lead">${esc(t("levels.lead"))}</p>
        <div class="view-toggle" role="group" aria-label="${esc(t("levels.viewLabel"))}">
          ${toggle("tree", "levels.viewTree")}${toggle("list", "levels.viewList")}
        </div>
        ${view === "tree" ? `<p class="visually-hidden" id="tree-help">${esc(t("levels.treeHelp"))}</p>` : ""}
      </div>
      <section class="save-box" aria-labelledby="progress-h">
        <h2 id="progress-h">${esc(t("levels.progress"))}</h2>
        <p class="help">${esc(t(a.store.persistent ? "levels.saved" : "levels.notSaved"))}
        ${esc(t("levels.exportHint"))}</p>
        <p class="save-actions"><button type="button" data-export>${esc(t("levels.export"))}</button>
        <label class="file-button">${esc(t("levels.import"))}<input type="file" accept="application/json,.json" data-import></label></p>
        <p class="import-status" aria-live="polite"></p>
      </section>
    </div>
    ${view === "tree" ? treeHtml(a) : listHtml(a)}`;
  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      try {
        localStorage.setItem(VIEW_KEY, b.dataset.view ?? "tree");
      } catch {
        // Not saved; the view still switches for now.
      }
      render(root, a);
      root
        .querySelector<HTMLElement>(`[data-view="${b.dataset.view}"]`)
        ?.focus();
    }),
  );
  if (view === "tree") wireTree(root, a);
  root
    .querySelectorAll<HTMLButtonElement>(".level-card [data-swap]")
    .forEach((btn) => {
      btn.addEventListener("click", () =>
        swap(root, a, btn.dataset.swap ?? ""),
      );
    });
  root.querySelector("[data-export]")?.addEventListener("click", () => {
    const blob = new Blob([progressFile(a.progress)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sand-to-tetris-progress.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  const statusEl = root.querySelector(".import-status");
  root
    .querySelector<HTMLInputElement>("[data-import]")
    ?.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const parsed = parseProgressFile(await file.text());
      if (typeof parsed === "string") {
        if (statusEl) statusEl.textContent = parsed;
        return;
      }
      if (!confirm(t("levels.confirmImport"))) return;
      await replaceProgress(a, parsed);
      selected = null;
      render(root, a);
      root.querySelector(".import-status")!.textContent = t("levels.imported");
    });
}

/**
 * Switches a component between the learner's design and its fast model.
 * Switching to the fast model first runs the match check; a mismatch
 * refuses the swap and shows where they differ.
 */
function swap(root: HTMLElement, a: App, id: string): void {
  const out = root.querySelector<HTMLElement>(`[data-swap-result="${id}"]`);
  const design = a.progress[id]?.design;
  if (!out || !design) return;
  if (fastIds(a).includes(id)) {
    setFast(a, id, null);
    render(root, a);
    root.querySelector<HTMLElement>(`[data-swap-result="${id}"]`)!.textContent =
      t("levels.nowYours");
    return;
  }
  out.textContent = t("levels.comparing");
  // Let the message paint before the (possibly long) comparison.
  setTimeout(() => {
    let report;
    try {
      report = matchCheck(
        playLibrary(a.levels, a.progress, a.status, "", fastIds(a)),
        id,
      );
    } catch (e) {
      out.textContent = t("levels.cantSwap", { error: String(e) });
      return;
    }
    const memory = levelEntry(a, id)?.info.level.sequential;
    const n = report.compared.toLocaleString("en-US");
    const scope = t(
      report.exhaustive
        ? "levels.scopeAll"
        : memory
          ? "levels.scopeCycles"
          : "levels.scopeRandom",
      { n },
    );
    if (!report.ok) {
      const m = report.mismatches[0];
      const show = (xs: [string, string][]) =>
        xs.map(([k, v]) => `${k}=${v}`).join(" ");
      out.textContent =
        t("levels.notSwapped", {
          failed: report.failed.toLocaleString("en-US"),
          scope,
        }) +
        (m
          ? t("levels.example", {
              inputs: show(m.inputs),
              expected: show(m.expected),
              actual: show(m.actual),
            })
          : "");
      return;
    }
    setFast(a, id, fingerprint(design));
    render(root, a);
    root.querySelector<HTMLElement>(`[data-swap-result="${id}"]`)!.textContent =
      t("levels.matched", { scope });
  }, 30);
}
