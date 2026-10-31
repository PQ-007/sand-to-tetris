// The level map: every layer's levels, what's open, passed or broken,
// plus export/import of progress (it lives only in this browser).
import { getApp, levelEntry, replaceProgress, type App } from "./app";
import { orderLevels, type Status } from "./game";
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
          return `<li class="level-card" data-status="${st}">
            <h3>${st === "locked" ? title : `<a href="${playHref(lv.id)}">${title}</a>`}</h3>
            <p class="level-status">${STATUS_TEXT[st]}</p>
            <p>${detail}</p>
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
