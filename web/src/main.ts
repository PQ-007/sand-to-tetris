import "./style.css";
import "./components/core-status";
import "./components/demos";
import { installGlossaryPopover } from "./components/glossary-popover";
import { renderRoute } from "./pages";
import { parseRoute } from "./router";

const app = document.getElementById("app");

function show(): void {
  if (!app) return;
  const { html, title, anchor } = renderRoute(parseRoute(location.hash));
  app.innerHTML = html;
  document.title = title;
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

if (app) installGlossaryPopover(app);
window.addEventListener("hashchange", show);
show();
