import { chapters, glossary } from "virtual:s2t-content";
import { CHAPTERS } from "./chapters";
import { chapterHref, type Route } from "./router";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const available = new Map(chapters.map((c) => [c.number, c]));

function home(): string {
  const items = CHAPTERS.map((ch) => {
    const ready = available.has(ch.number);
    const title = esc(ch.title);
    return `<li class="chapter" data-ready="${ready}">
      <div class="chapter-top">
        <span class="chapter-number" aria-hidden="true">${String(ch.number).padStart(2, "0")}</span>
        <span class="pill${ready ? " pill-ok" : ""}">${ready ? "Ready to read" : "Coming soon"}</span>
      </div>
      <h3>${ready ? `<a href="${chapterHref(ch.number)}"><span class="visually-hidden">Chapter ${ch.number}: </span>${title}</a>` : `<span class="visually-hidden">Chapter ${ch.number}: </span>${title}`}</h3>
      <p>${esc(ch.summary)}</p>
    </li>`;
  }).join("");
  const ready = chapters.length;
  return `<section class="hero">
      <p class="eyebrow">A course in ${CHAPTERS.length} chapters</p>
      <h1 tabindex="-1">From sand to Tetris</h1>
      <p class="tagline">Start with sand. Build switches, gates, memory, a CPU, a compiler and an
      operating system. Finish by playing Tetris on the computer you made.</p>
      <p class="hero-actions">
        <a class="button primary" href="${chapterHref(0)}">Start reading</a>
        <a class="button" href="#/levels">Open the workbench</a>
      </p>
    </section>
    <section class="steps" aria-label="How it works">
      <div><span class="step-n" aria-hidden="true">1</span><h2>Read</h2><p>Each chapter explains one layer in plain language, with interactive demos.</p></div>
      <div><span class="step-n" aria-hidden="true">2</span><h2>Build</h2><p>Wire the component yourself in the editor, from parts you already made.</p></div>
      <div><span class="step-n" aria-hidden="true">3</span><h2>Unlock</h2><p>Pass the tests and it joins your toolbox as a sealed block for the next layer.</p></div>
    </section>
    <section aria-labelledby="chapters-h">
      <div class="section-head">
        <h2 id="chapters-h">Chapters</h2>
        <span class="muted">${ready} of ${CHAPTERS.length} ready</span>
      </div>
      <ol class="chapters">${items}</ol>
    </section>`;
}

/** Every chapter, for the left column of a chapter page. */
function courseNav(current: number): string {
  const items = CHAPTERS.map((ch) => {
    const label = `<span class="num" aria-hidden="true">${ch.number}</span><span>${esc(ch.title)}</span>`;
    if (!available.has(ch.number))
      return `<li class="soon">${label}<span class="visually-hidden"> (coming soon)</span></li>`;
    const here = ch.number === current ? ' aria-current="page"' : "";
    return `<li><a href="${chapterHref(ch.number)}"${here}>${label}</a></li>`;
  }).join("");
  return `<nav class="course-nav" aria-label="Chapters"><p class="side-title">Course</p><ol>${items}</ol></nav>`;
}

function chapter(number: number): string {
  const ch = available.get(number);
  if (!ch) return notFound(`Chapter ${number} isn't written yet.`);
  const toc = ch.toc
    .map(
      (t) =>
        `<li><a href="${chapterHref(number, t.id)}" data-section="${t.id}">${esc(t.text)}</a></li>`,
    )
    .join("");
  const sources = ch.html.includes('id="sources"')
    ? `<li><a href="${chapterHref(number, "sources")}" data-section="sources">Sources</a></li>`
    : "";
  const prev = available.get(number - 1);
  const next = available.get(number + 1);
  const pager = `<nav class="pager" aria-label="Previous and next chapter">
    ${prev ? `<a class="pager-link" href="${chapterHref(prev.number)}"><span class="muted">← Previous</span><span>Chapter ${prev.number}: ${esc(prev.title)}</span></a>` : "<span></span>"}
    ${next ? `<a class="pager-link next" href="${chapterHref(next.number)}"><span class="muted">Next →</span><span>Chapter ${next.number}: ${esc(next.title)}</span></a>` : ""}
  </nav>`;
  // The table of contents comes before the article in the DOM (so it's
  // reachable early by keyboard); CSS puts it in the right-hand column.
  return `<div class="doc-layout">
    ${courseNav(number)}
    <nav class="toc" aria-label="In this chapter">
      <details open>
        <summary class="side-title">On this page</summary>
        <ol>${toc}${sources}</ol>
        <p class="toc-top"><a href="${chapterHref(number)}">↑ Back to top</a></p>
      </details>
    </nav>
    <article class="chapter-page">
      <header class="chapter-head">
        <p class="eyebrow">Chapter ${ch.number}</p>
        <h1 tabindex="-1">${esc(ch.title)}</h1>
        <p class="lead">${esc(ch.summary)}</p>
      </header>
      ${ch.html}
      ${pager}
    </article>
  </div>`;
}

/**
 * Highlights the table-of-contents entry for the section being read. The
 * observer is dropped on the next navigation.
 */
export function trackSections(root: HTMLElement): void {
  // On narrow screens the contents sit above the article: start collapsed.
  const box = root.querySelector<HTMLDetailsElement>(".toc details");
  if (box && window.matchMedia("(max-width: 900px)").matches) box.open = false;
  const links = new Map(
    [...root.querySelectorAll<HTMLAnchorElement>(".toc [data-section]")].map(
      (a) => [a.dataset.section ?? "", a],
    ),
  );
  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter((h): h is HTMLElement => h !== null);
  if (!headings.length) return;
  const mark = () => {
    // The current section is the last heading above the top quarter of the
    // window (or the first one, before any is reached).
    const line = window.innerHeight * 0.25;
    let current = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) current = h;
    }
    for (const [id, a] of links) {
      a.classList.toggle("active", id === current?.id);
    }
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      mark();
    });
  };
  mark();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener(
    "hashchange",
    () => window.removeEventListener("scroll", onScroll),
    { once: true },
  );
}

function glossaryPage(): string {
  const byId = new Map(glossary.map((g) => [g.id, g]));
  const items = glossary
    .map((g) => {
      const see = g.see
        .map((id) => byId.get(id))
        .filter((s) => s !== undefined)
        .map((s) => `<a href="#/glossary/${s.id}">${esc(s.term)}</a>`)
        .join(", ");
      return `<div class="gloss-entry" id="term-${g.id}" data-search="${esc(g.term.toLowerCase())}">
        <dt>${esc(g.term)}</dt>
        <dd><p>${g.shortHtml}</p>${g.longHtml ? `<p>${g.longHtml}</p>` : ""}
        ${see ? `<p class="see">See also: ${see}</p>` : ""}</dd>
      </div>`;
    })
    .join("");
  return `<div class="page-head">
      <div>
        <h1 tabindex="-1">Glossary</h1>
        <p class="lead">Every technical term used in the chapters, in plain language.</p>
      </div>
      <label class="search">
        <span class="visually-hidden">Filter terms</span>
        <input type="search" placeholder="Filter ${glossary.length} terms…" data-gloss-filter />
      </label>
    </div>
    <p class="muted" data-gloss-count aria-live="polite"></p>
    <dl class="glossary">${items}</dl>`;
}

/** Hides glossary entries whose term doesn't contain the typed text. */
export function installGlossaryFilter(root: HTMLElement): void {
  const input = root.querySelector<HTMLInputElement>("[data-gloss-filter]");
  const count = root.querySelector<HTMLElement>("[data-gloss-count]");
  const entries = [...root.querySelectorAll<HTMLElement>(".gloss-entry")];
  input?.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const e of entries) {
      const match = !q || (e.dataset.search ?? "").includes(q);
      e.hidden = !match;
      if (match) shown++;
    }
    if (count)
      count.textContent = q
        ? `${shown} of ${entries.length} terms match “${input.value.trim()}”.`
        : "";
  });
}

function notFound(message = "There's no page at this address."): string {
  return `<div class="narrow-page"><h1 tabindex="-1">Not found</h1><p>${esc(message)}</p><p><a href="#/">Back to the chapters</a></p></div>`;
}

export function renderRoute(route: Route): {
  html: string;
  title: string;
  anchor?: string;
} {
  switch (route.page) {
    case "home":
      return { html: home(), title: "Sand to Tetris" };
    case "chapter": {
      const ch = available.get(route.number);
      return {
        html: chapter(route.number),
        title: ch
          ? `${ch.title} · Sand to Tetris`
          : "Not found · Sand to Tetris",
        anchor: route.anchor,
      };
    }
    case "glossary":
      return {
        html: glossaryPage(),
        title: "Glossary · Sand to Tetris",
        anchor: route.term ? `term-${route.term}` : undefined,
      };
    case "levels":
      return {
        html: `<div id="levels-root"></div>`,
        title: "Levels · Sand to Tetris",
      };
    case "play":
      return {
        html: `<div id="play-root" class="play"></div>`,
        title: `Level · Sand to Tetris`,
      };
    case "not-found":
      return { html: notFound(), title: "Not found · Sand to Tetris" };
  }
}
