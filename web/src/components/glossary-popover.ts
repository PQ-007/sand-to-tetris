// Hover/focus cards for glossary links (<a class="term" data-term="...">).
// The link itself still goes to the glossary page, so nothing depends on
// hovering; the card is a shortcut for mouse and keyboard users.
import { glossary } from "virtual:s2t-content";

const byId = new Map(glossary.map((g) => [g.id, g]));

export function installGlossaryPopover(root: HTMLElement): void {
  const card = document.createElement("div");
  card.className = "term-card";
  card.id = "term-card";
  card.setAttribute("role", "tooltip");
  card.hidden = true;
  document.body.append(card);

  let current: HTMLAnchorElement | null = null;

  const hide = () => {
    card.hidden = true;
    current?.removeAttribute("aria-describedby");
    current = null;
  };

  const show = (link: HTMLAnchorElement) => {
    const entry = byId.get(link.dataset.term ?? "");
    if (!entry) return;
    current?.removeAttribute("aria-describedby");
    current = link;
    const title = document.createElement("strong");
    title.textContent = entry.term;
    const body = document.createElement("span");
    body.innerHTML = entry.shortHtml; // rendered from our own glossary.yaml at build time
    card.replaceChildren(title, body);
    card.hidden = false;
    link.setAttribute("aria-describedby", card.id);
    const r = link.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 32);
    card.style.width = `${width}px`;
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
    const below = r.bottom + 8 + card.offsetHeight < window.innerHeight;
    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${(below ? r.bottom + 8 : r.top - card.offsetHeight - 8) + window.scrollY}px`;
  };

  const termFrom = (t: EventTarget | null) =>
    t instanceof Element ? t.closest<HTMLAnchorElement>("a.term") : null;

  root.addEventListener("mouseover", (e) => {
    const link = termFrom(e.target);
    if (link && link !== current) show(link);
  });
  root.addEventListener("mouseout", (e) => {
    if (termFrom(e.target) && !termFrom(e.relatedTarget)) hide();
  });
  root.addEventListener("focusin", (e) => {
    const link = termFrom(e.target);
    if (link) show(link);
  });
  root.addEventListener("focusout", hide);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  window.addEventListener("hashchange", hide);
}
