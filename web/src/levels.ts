// The level map: every layer's levels, what's open, passed or broken,
// plus export/import of progress (it lives only in this browser).
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
  render(root, a);
}

function render(root: HTMLElement, a: App): void {
  const ordered = orderLevels(a.levels);
  const fast = new Set(fastIds(a));
  const layers = [...new Set(ordered.map((l) => l.info.level.layer))];
  const sections = layers
    .map((layer) => {
      const cards = ordered
        .filter((l) => l.info.level.layer === layer)
        .map((l) => {
          const lv = l.info.level;
          const st = a.status[lv.id] ?? "locked";
          const need = lv.requires
            .filter((r) => a.status[r] !== "passed")
            .map((r) => {
              const req = levelEntry(a, r)?.info.level;
              return req ? levelName(req) : r;
            });
          const detail =
            st === "locked"
              ? esc(
                  t("levels.opensAfter", { names: need.join(t("levels.and")) }),
                )
              : st === "broken"
                ? esc(t("levels.brokenText"))
                : esc(levelGoal(lv).split("\n")[0] ?? "");
          const title =
            esc(levelName(lv)) +
            (lv.optional
              ? ` <span class="badge">${esc(t("levels.sideQuest"))}</span>`
              : "");
          const isFast = fast.has(lv.id);
          const swap =
            st === "passed" && lv.layer >= 2
              ? `<p class="swap"><button type="button" data-swap="${lv.id}" aria-pressed="${isFast}">${esc(t("levels.runsAs", { mode: t(isFast ? "levels.fastModel" : "levels.yourDesign") }))}</button></p>
                 <p class="swap-result" data-swap-result="${lv.id}" aria-live="polite"></p>`
              : "";
          return `<li class="level-card" data-status="${st}">
            <div class="level-top">
              <h3>${st === "locked" ? title : `<a href="${playHref(lv.id)}">${title}</a>`}</h3>
              <span class="pill level-status pill-${st}">${esc(statusText(st))}</span>
            </div>
            <p>${detail}</p>
            ${swap}
          </li>`;
        })
        .join("");
      const inLayer = ordered.filter((l) => l.info.level.layer === layer);
      const done = inLayer.filter(
        (l) => a.status[l.info.level.id] === "passed",
      ).length;
      return `<section class="layer">
        <div class="section-head"><h2>${esc(t("levels.layer", { n: layer, name: layerName(layer) }))}</h2>
        <span class="muted">${esc(t("levels.passedCount", { passed: done, total: inLayer.length }))}</span></div>
        <ol class="level-cards">${cards}</ol></section>`;
    })
    .join("");
  const passed = Object.values(a.status).filter((s) => s === "passed").length;
  const pct = a.levels.length
    ? Math.round((passed / a.levels.length) * 100)
    : 0;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <h1 tabindex="-1">${esc(t("levels.title"))}</h1>
        <p class="lead">${esc(t("levels.lead"))}</p>
      </div>
      <section class="save-box" aria-labelledby="progress-h">
        <h2 id="progress-h">${esc(t("levels.progress"))}</h2>
        <p class="meter-label"><strong>${esc(t("levels.meter", { passed, total: a.levels.length }))}</strong> ${esc(t("levels.meterText"))}</p>
        <div class="meter" role="progressbar" aria-labelledby="progress-h" aria-valuemin="0" aria-valuemax="${a.levels.length}" aria-valuenow="${passed}" aria-valuetext="${esc(t("levels.passedCount", { passed, total: a.levels.length }))}"><span style="width:${pct}%"></span></div>
        <p class="help">${esc(t(a.store.persistent ? "levels.saved" : "levels.notSaved"))}
        ${esc(t("levels.exportHint"))}</p>
        <p class="save-actions"><button type="button" data-export>${esc(t("levels.export"))}</button>
        <label class="file-button">${esc(t("levels.import"))}<input type="file" accept="application/json,.json" data-import></label></p>
        <p class="import-status" aria-live="polite"></p>
      </section>
    </div>
    ${sections}`;
  root.querySelectorAll<HTMLButtonElement>("[data-swap]").forEach((btn) => {
    btn.addEventListener("click", () => swap(root, a, btn.dataset.swap ?? ""));
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
