// A small popup menu (the editor's right-click menu). Keyboard: arrow keys
// move between items, Home/End jump, Enter or Space runs one, Escape or Tab
// closes it. Focus goes back where it was when the menu closes.
import type { MenuEntry } from "./actions";

/**
 * Index of the next enabled item from `from` in direction `dir` (wrapping),
 * or -1 if none is enabled. `from = -1` starts before the first item.
 */
export function nextEnabled(
  disabled: boolean[],
  from: number,
  dir: 1 | -1,
): number {
  const n = disabled.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + dir * step) % n) + n) % n;
    if (!disabled[i]) return i;
  }
  return -1;
}

let closeOpen: (() => void) | null = null;

/** Closes the open menu, if any. */
export function closeMenu(): void {
  closeOpen?.();
}

/**
 * Opens a menu at a screen position. `run` gets the chosen entry's id;
 * focus returns to `returnFocus` when the menu closes without a choice.
 */
export function openMenu(
  title: string,
  entries: (MenuEntry | "separator")[],
  at: { x: number; y: number },
  run: (id: string) => void,
  returnFocus?: Element | null,
): void {
  closeMenu();
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", title);
  // Focusable itself, for when every item is disabled.
  menu.tabIndex = -1;
  const head = document.createElement("div");
  head.className = "ctx-title";
  head.setAttribute("aria-hidden", "true");
  head.textContent = title;
  menu.append(head);

  const items: HTMLButtonElement[] = [];
  for (const e of entries) {
    if (e === "separator") {
      const sep = document.createElement("div");
      sep.className = "ctx-sep";
      sep.setAttribute("role", "separator");
      menu.append(sep);
      continue;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = `ctx-item${e.danger ? " danger" : ""}`;
    b.setAttribute("role", "menuitem");
    b.tabIndex = -1;
    b.disabled = Boolean(e.disabled);
    const label = document.createElement("span");
    label.textContent = e.label;
    b.append(label);
    if (e.hint) {
      const hint = document.createElement("kbd");
      hint.textContent = e.hint;
      b.append(hint);
    }
    b.addEventListener("click", () => {
      close(false);
      run(e.id);
    });
    items.push(b);
    menu.append(b);
  }

  const disabled = items.map((b) => b.disabled);
  let current = -1;
  const focusAt = (i: number) => {
    if (i < 0) return;
    current = i;
    items[i]?.focus();
  };

  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowDown") focusAt(nextEnabled(disabled, current, 1));
    else if (ev.key === "ArrowUp") focusAt(nextEnabled(disabled, current, -1));
    else if (ev.key === "Home") focusAt(nextEnabled(disabled, -1, 1));
    else if (ev.key === "End") focusAt(nextEnabled(disabled, 0, -1));
    else if (ev.key === "Escape" || ev.key === "Tab") close(true);
    else return;
    ev.preventDefault();
    ev.stopPropagation();
  };
  const onOutside = (ev: Event) => {
    if (!(ev.target instanceof Node) || !menu.contains(ev.target)) close(false);
  };
  const onAway = () => close(false);

  function close(restore: boolean): void {
    if (!menu.isConnected) return;
    menu.remove();
    document.removeEventListener("pointerdown", onOutside, true);
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", onAway);
    window.removeEventListener("blur", onAway);
    document.removeEventListener("scroll", onAway, true);
    closeOpen = null;
    if (restore && returnFocus instanceof HTMLElement) returnFocus.focus();
    if (restore && returnFocus instanceof SVGElement) returnFocus.focus();
  }
  closeOpen = () => close(false);

  // On the document, so the keys work wherever focus is while it's open.
  document.addEventListener("keydown", onKey, true);
  menu.addEventListener("contextmenu", (ev) => ev.preventDefault());
  document.body.append(menu);
  // Keep the menu inside the window.
  const r = menu.getBoundingClientRect();
  const x = Math.min(at.x, window.innerWidth - r.width - 8);
  const y = Math.min(at.y, window.innerHeight - r.height - 8);
  menu.style.left = `${Math.max(8, x)}px`;
  menu.style.top = `${Math.max(8, y)}px`;
  // Listen after this event finishes, so the opening click doesn't close it.
  setTimeout(() => {
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", onAway);
    window.addEventListener("blur", onAway);
    document.addEventListener("scroll", onAway, true);
  });
  const first = nextEnabled(disabled, -1, 1);
  if (first >= 0) focusAt(first);
  else menu.focus();
}
