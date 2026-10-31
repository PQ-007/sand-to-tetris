import "./style.css";
import "./components/core-status";
import "./components/demos";
import { installGlossaryPopover } from "./components/glossary-popover";
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
  h.textContent = "Something went wrong loading this page";
  const p = document.createElement("p");
  p.textContent = String(e);
  root.append(h, p);
}

if (app) installGlossaryPopover(app);
window.addEventListener("hashchange", show);
show();
