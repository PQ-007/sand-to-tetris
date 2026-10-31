import "./style.css";
import "./components/core-status";
import "./components/demos";
import { installGlossaryPopover } from "./components/glossary-popover";
import { getLang, setLang, t, type Key, type Lang } from "./i18n";
import { mountLevels } from "./levels";
import { installGlossaryFilter, renderRoute, trackSections } from "./pages";
import { mountPlay } from "./play";
import { parseRoute } from "./router";

const app = document.getElementById("app");

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
}

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
});

if (app) installGlossaryPopover(app);
window.addEventListener("hashchange", show);
chrome();
show();
