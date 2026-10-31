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
import { matchCheck } from "./sim/core";
import { parseProgressFile, progressFile } from "./progress";
import { playHref } from "./router";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STATUS_TEXT: Record<Status, string> = {
  passed: "✓ Passed",
  open: "Open",
  locked: "Locked",
  broken: "⚠ Broken",
};

const LAYER_NAMES: Record<number, string> = {
  1: "Transistors to gates",
  2: "Combinational logic",
  3: "Memory",
};

export async function mountLevels(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="loading">Loading…</p>`;
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
            .map((r) => levelEntry(a, r)?.info.level.name ?? r);
          const detail =
            st === "locked"
              ? `Opens after ${need.join(" and ")}.`
              : st === "broken"
                ? "Something it uses changed and it no longer passes. Open it to see why."
                : esc(lv.goal.trim().split("\n")[0] ?? "");
          const title =
            esc(lv.name) +
            (lv.optional ? ' <span class="badge">side quest</span>' : "");
          const isFast = fast.has(lv.id);
          const swap =
            st === "passed" && lv.layer >= 2
              ? `<p class="swap"><button type="button" data-swap="${lv.id}" aria-pressed="${isFast}">Runs as: ${isFast ? "fast model" : "your design"}</button></p>
                 <p class="swap-result" data-swap-result="${lv.id}" aria-live="polite"></p>`
              : "";
          return `<li class="level-card" data-status="${st}">
            <h3>${st === "locked" ? title : `<a href="${playHref(lv.id)}">${title}</a>`}</h3>
            <p class="level-status">${STATUS_TEXT[st]}</p>
            <p>${detail}</p>
            ${swap}
          </li>`;
        })
        .join("");
      return `<section class="layer"><h2>Layer ${layer}: ${esc(LAYER_NAMES[layer] ?? "")}</h2><ol class="level-cards">${cards}</ol></section>`;
    })
    .join("");
  const passed = Object.values(a.status).filter((s) => s === "passed").length;
  root.innerHTML = `
    <h1 tabindex="-1">Build your computer</h1>
    <p class="lead">Each level is one component. Pass it, and it joins your toolbox for the levels after it.
      ${passed} of ${a.levels.length} passed.</p>
    ${sections}
    <section class="save-box">
      <h2>Your progress</h2>
      <p>${a.store.persistent ? "Saved in this browser automatically." : "This browser isn't letting the site save data, so export your progress before closing the tab."}
      To move it to another browser or keep a backup, export it to a file.</p>
      <p><button type="button" data-export>Export progress</button>
      <label class="file-button">Import progress<input type="file" accept="application/json,.json" data-import></label></p>
      <p class="import-status" aria-live="polite"></p>
    </section>`;
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
      if (!confirm("Replace your current progress with the imported file?"))
        return;
      await replaceProgress(a, parsed);
      render(root, a);
      root.querySelector(".import-status")!.textContent = "Imported.";
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
      "Now running as your own design.";
    return;
  }
  out.textContent = "Comparing your design with the fast model…";
  // Let the message paint before the (possibly long) comparison.
  setTimeout(() => {
    let report;
    try {
      report = matchCheck(
        playLibrary(a.levels, a.progress, a.status, "", fastIds(a)),
        id,
      );
    } catch (e) {
      out.textContent = `Can't swap: ${String(e)}`;
      return;
    }
    const scope = report.exhaustive
      ? `all ${report.compared.toLocaleString("en-US")} possible inputs`
      : `${report.compared.toLocaleString("en-US")} random inputs`;
    if (!report.ok) {
      const m = report.mismatches[0];
      const show = (xs: [string, string][]) =>
        xs.map(([k, v]) => `${k}=${v}`).join(" ");
      out.textContent = `✗ Not swapped: your design differs from the model on ${report.failed.toLocaleString("en-US")} of ${scope}.${m ? ` For example ${show(m.inputs)}: model gives ${show(m.expected)}, yours gives ${show(m.actual)}.` : ""}`;
      return;
    }
    setFast(a, id, fingerprint(design));
    render(root, a);
    root.querySelector<HTMLElement>(`[data-swap-result="${id}"]`)!.textContent =
      `✓ Matched on ${scope}. Now running as the fast model.`;
  }, 30);
}
