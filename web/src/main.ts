import "./style.css";
import "./components/core-status";
import "./components/demos";
import { getApp } from "./app";
import { installGlossaryPopover } from "./components/glossary-popover";
import { getLang, setLang, t, type Key, type Lang } from "./i18n";
import { mountLevels } from "./levels";
import { mountMachine } from "./machine";
import { installGlossaryFilter, renderRoute, trackSections } from "./pages";
import { mountPlay } from "./play";
import { parseRoute } from "./router";
import { getTheme, initTheme, setTheme } from "./theme";
import { mountWorkshop } from "./workshop";

const app = document.getElementById("app");

/**
 * Keeps hairline figures in step with the page: draws a placeholder as soon
 * as it appears (pages like the level map render later, and re-render) and
 * stops figures whose element left. Their code loads with the first one.
 */
let figures: Promise<typeof import("./hairline")> | null = null;
let figureSync = 0;
function syncFigures(): void {
  if (!app || figureSync) return;
  figureSync = requestAnimationFrame(() => {
    figureSync = 0;
    if (!figures && !app.querySelector(".hl-figure")) return;
    figures ??= import("./hairline");
    void figures.then((m) => m.syncFigures(app));
  });
}
// The home page's button takes the computer figure apart and puts it back.
document.addEventListener("click", (e) => {
  const button = (e.target as Element | null)?.closest?.<HTMLButtonElement>(
    "[data-figure-toggle]",
  );
  const figure = button
    ?.closest(".hero-figure")
    ?.querySelector<HTMLElement>(".hl-figure");
  if (!button || !figure) return;
  const apart = button.dataset.apart !== "true";
  button.dataset.apart = String(apart);
  button.textContent = t(apart ? "home.putTogether" : "home.takeApart");
  void figures?.then((m) => m.setFigureValue(figure, apart ? 1 : 0));
});
if (app)
  new MutationObserver(syncFigures).observe(app, {
    childList: true,
    subtree: true,
  });

function show(): void {
  if (!app) return;
  const route = parseRoute(location.hash);
  const { html, title, anchor } = renderRoute(route);
  app.innerHTML = html;
  document.title = title;
  // Each page type gets its own layout (see style.css).
  document.body.dataset.page = route.page;
  const section =
    route.page === "levels" || route.page === "play"
      ? "build"
      : route.page === "machine" ||
          route.page === "assembler" ||
          route.page === "translator" ||
          route.page === "compiler" ||
          route.page === "os"
        ? "machine"
        : route.page === "glossary"
          ? "glossary"
          : "learn";
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((a) => {
    if (a.dataset.nav === section) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (route.page === "chapter") trackSections(app);
  if (route.page === "glossary") installGlossaryFilter(app);
  const done = () =>
    app.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  if (route.page === "play") {
    const root = document.getElementById("play-root");
    if (root)
      void mountPlay(root, route.level).then(done, (e) => showError(root, e));
    window.scrollTo(0, 0);
    return;
  }
  if (
    route.page === "machine" ||
    route.page === "assembler" ||
    route.page === "translator" ||
    route.page === "compiler" ||
    route.page === "os"
  ) {
    const page = route.page;
    const root = document.getElementById(`${page}-root`);
    const mount =
      page === "machine"
        ? mountMachine
        : (r: HTMLElement) => mountWorkshop(r, page);
    if (root) void mount(root).then(done, (e) => showError(root, e));
    window.scrollTo(0, 0);
    return;
  }
  if (route.page === "levels") {
    const root = document.getElementById("levels-root");
    if (root) void mountLevels(root).then(done, (e) => showError(root, e));
    window.scrollTo(0, 0);
    return;
  }
  const target = anchor ? document.getElementById(anchor) : null;
  if (target) {
    target.scrollIntoView();
    target.classList.add("flash");
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  } else {
    window.scrollTo(0, 0);
    // Move focus to the new page's heading so screen readers announce it.
    app.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }
}

function showError(root: HTMLElement, e: unknown): void {
  root.innerHTML = "";
  const h = document.createElement("h1");
  h.textContent = t("page.error");
  const p = document.createElement("p");
  p.textContent = String(e);
  root.append(h, p);
}

/** The header's levels meter: passed out of all levels. */
async function updateHud(): Promise<void> {
  const box = document.querySelector<HTMLElement>(".hud-xp");
  if (!box) return;
  // No meter if the simulator can't load; the page says why.
  const a = await getApp().catch(() => null);
  if (!a) return;
  const total = a.levels.length;
  const passed = Object.values(a.status).filter((s) => s === "passed").length;
  const count = box.querySelector(".hud-xp-count");
  if (count) count.textContent = `${passed}/${total}`;
  const bar = box.querySelector<HTMLElement>(".hud-xp-bar > span");
  if (bar) bar.style.width = `${total ? (passed / total) * 100 : 0}%`;
  box.setAttribute("aria-label", t("hud.levelsLabel", { passed, total }));
  box.hidden = false;
}

/** The header and other text outside the page, in the current language. */
function chrome(): void {
  const lang = getLang();
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-text]").forEach((el) => {
    el.textContent = t(el.dataset.text as Key);
  });
  document
    .querySelector(".site-nav")
    ?.setAttribute("aria-label", t("nav.label"));
  document
    .querySelector(".lang-switch")
    ?.setAttribute("aria-label", t("nav.language"));
  document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
  });
  themeButton();
}

/** The toggle says what pressing it does: "Dark theme" while light. */
function themeButton(): void {
  const b = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if (!b) return;
  const label = t(getTheme() === "dark" ? "theme.toLight" : "theme.toDark");
  b.setAttribute("aria-label", label);
  b.title = label;
}

document
  .querySelector<HTMLButtonElement>("[data-theme-toggle]")
  ?.addEventListener("click", () =>
    setTheme(getTheme() === "dark" ? "light" : "dark"),
  );
window.addEventListener("s2t-theme", themeButton);

document.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => {
  b.addEventListener("click", () => {
    const lang = b.dataset.lang as Lang;
    if (lang !== getLang()) setLang(lang);
  });
});
// A new language re-renders everything in place (no reload, same page).
document.addEventListener("s2t-lang", () => {
  chrome();
  show();
  void updateHud();
});
document.addEventListener("s2t-progress", () => void updateHud());

if (app) installGlossaryPopover(app);
window.addEventListener("hashchange", show);
initTheme();
chrome();
show();
void updateHud();
