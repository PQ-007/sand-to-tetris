// Light or dark. The page carries the theme as <html data-theme>, set
// before first paint by a script in index.html (same rule as `resolve`),
// and CSS keys the dark tokens off it. Until the learner picks one with the
// header's toggle, the theme follows the system and changes with it; the
// pick is kept in localStorage `s2t-theme`. Every change fires `s2t-theme`
// on window, for anything drawn from colours read once (the Machine's
// screen).

export type Theme = "light" | "dark";

const KEY = "s2t-theme";

/** The theme to show: the saved pick, else the system's. */
export function resolve(saved: string | null, systemDark: boolean): Theme {
  if (saved === "light" || saved === "dark") return saved;
  return systemDark ? "dark" : "light";
}

function saved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const system = () =>
  window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme): void {
  if (getTheme() === theme && document.documentElement.dataset.theme) return;
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent("s2t-theme", { detail: theme }));
}

/** Shows `theme` and remembers it (the system no longer decides). */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Not saved; the theme still changes for this visit.
  }
  apply(theme);
}

/** Applies the theme now and follows the system until the learner picks. */
export function initTheme(): void {
  const media = system();
  apply(resolve(saved(), media?.matches ?? false));
  media?.addEventListener?.("change", (e) => {
    if (!saved()) apply(e.matches ? "dark" : "light");
  });
}
