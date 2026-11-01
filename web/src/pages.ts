import { CHAPTERS } from "./chapters";
import { t, type Key } from "./i18n";
import { chapterHref, type Route } from "./router";
import { site } from "./text";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Chapters written so far, in the current language. */
const available = () => new Map(site().chapters.map((c) => [c.number, c]));

/** A planned chapter's title or summary (also for chapters not written). */
const outline = (n: number, part: "title" | "summary") =>
  t(`outline.${n}.${part}` as Key);

function home(): string {
  const ready = available();
  const items = CHAPTERS.map((ch) => {
    const isReady = ready.has(ch.number);
    const title = esc(outline(ch.number, "title"));
    const sr = `<span class="visually-hidden">${esc(t("chapter.n", { n: ch.number }))}: </span>`;
    // Ready chapters are lit and linked, the rest dashed: no tag needed.
    // Screen readers still hear "(soon)".
    const soon = `<span class="visually-hidden"> ${esc(t("chapter.soonSr"))}</span>`;
    return `<li class="chapter" data-ready="${isReady}">
      <div class="chapter-top">
        <span class="chapter-number" aria-hidden="true">${String(ch.number).padStart(2, "0")}</span>
      </div>
      <h3>${isReady ? `<a href="${chapterHref(ch.number)}">${sr}${title}</a>` : `${sr}${title}${soon}`}</h3>
      <p>${esc(outline(ch.number, "summary"))}</p>
    </li>`;
  }).join("");
  const step = (n: number, h: Key, p: Key) =>
    `<div><span class="step-n" aria-hidden="true">${n}</span><h2>${esc(t(h))}</h2><p>${esc(t(p))}</p></div>`;
  // The whole course as a stack of chips: sand at the bottom, Tetris on top.
  const stack = [...CHAPTERS]
    .reverse()
    .map((ch) => {
      const on = ready.has(ch.number);
      const label = `<span class="chip-n" aria-hidden="true">${ch.number}</span><span class="chip-name">${esc(outline(ch.number, "title"))}</span>`;
      return `<li class="stack-chip" data-ready="${on}" style="--i:${ch.number}">${on ? `<a href="${chapterHref(ch.number)}">${label}</a>` : `${label}<span class="visually-hidden"> ${esc(t("chapter.soonSr"))}</span>`}</li>`;
    })
    .join("");
  return `<section class="hero">
      <div class="hero-text">
        <p class="eyebrow">${esc(t("home.eyebrow", { n: CHAPTERS.length }))}</p>
        <h1 tabindex="-1">${esc(t("home.title"))}</h1>
        <p class="tagline">${esc(t("home.tagline"))}</p>
        <p class="hero-actions">
          <a class="button primary" href="${chapterHref(0)}">${esc(t("home.start"))}</a>
          <a class="button" href="#/levels">${esc(t("home.workbench"))}</a>
        </p>
      </div>
      <ol class="stack" aria-label="${esc(t("home.stackLabel"))}">${stack}</ol>
    </section>
    <section class="steps" aria-label="${esc(t("home.howItWorks"))}">
      ${step(1, "home.read", "home.readText")}
      ${step(2, "home.build", "home.buildText")}
      ${step(3, "home.unlock", "home.unlockText")}
    </section>
    <section aria-labelledby="chapters-h">
      <div class="section-head">
        <h2 id="chapters-h">${esc(t("home.chapters"))}</h2>
      </div>
      <ol class="chapters">${items}</ol>
    </section>`;
}

/** Every chapter, for the left column of a chapter page. */
function courseNav(current: number): string {
  const ready = available();
  const items = CHAPTERS.map((ch) => {
    const label = `<span class="num" aria-hidden="true">${ch.number}</span><span>${esc(outline(ch.number, "title"))}</span>`;
    if (!ready.has(ch.number))
      return `<li class="soon">${label}<span class="visually-hidden"> ${esc(t("chapter.soonSr"))}</span></li>`;
    const here = ch.number === current ? ' aria-current="page"' : "";
    return `<li><a href="${chapterHref(ch.number)}"${here}>${label}</a></li>`;
  }).join("");
  return `<nav class="course-nav" aria-label="${esc(t("chapter.chaptersLabel"))}"><p class="side-title">${esc(t("chapter.course"))}</p><ol>${items}</ol></nav>`;
}

function chapter(number: number): string {
  const ready = available();
  const ch = ready.get(number);
  if (!ch) return notFound(t("chapter.notWritten", { n: number }));
  const toc = ch.toc
    .map(
      (entry) =>
        `<li><a href="${chapterHref(number, entry.id)}" data-section="${entry.id}">${esc(entry.text)}</a></li>`,
    )
    .join("");
  const sources = ch.html.includes('id="sources"')
    ? `<li><a href="${chapterHref(number, "sources")}" data-section="sources">${esc(t("chapter.sources"))}</a></li>`
    : "";
  const prev = ready.get(number - 1);
  const next = ready.get(number + 1);
  const pagerLink = (c: typeof ch, cls: string, label: Key) =>
    `<a class="pager-link${cls}" href="${chapterHref(c.number)}"><span class="muted">${esc(t(label))}</span><span>${esc(t("chapter.n", { n: c.number }))}: ${esc(c.title)}</span></a>`;
  const pager = `<nav class="pager" aria-label="${esc(t("chapter.pagerLabel"))}">
    ${prev ? pagerLink(prev, "", "chapter.previous") : "<span></span>"}
    ${next ? pagerLink(next, " next", "chapter.next") : ""}
  </nav>`;
  // The table of contents comes before the article in the DOM (so it's
  // reachable early by keyboard); CSS puts it in the right-hand column.
  return `<div class="doc-layout">
    ${courseNav(number)}
    <nav class="toc" aria-label="${esc(t("chapter.inThisChapter"))}">
      <details open>
        <summary class="side-title">${esc(t("chapter.onThisPage"))}</summary>
        <ol>${toc}${sources}</ol>
        <p class="toc-top"><a href="${chapterHref(number)}">${esc(t("chapter.backToTop"))}</a></p>
      </details>
    </nav>
    <article class="chapter-page">
      <header class="chapter-head">
        <p class="eyebrow">${esc(t("chapter.n", { n: ch.number }))}</p>
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
  const glossary = site().glossary;
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
        ${see ? `<p class="see">${esc(t("glossary.seeAlso"))} ${see}</p>` : ""}</dd>
      </div>`;
    })
    .join("");
  return `<div class="page-head">
      <div>
        <h1 tabindex="-1">${esc(t("title.glossary"))}</h1>
        <p class="lead">${esc(t("glossary.lead"))}</p>
      </div>
      <label class="search">
        <span class="visually-hidden">${esc(t("glossary.filterLabel"))}</span>
        <input type="search" placeholder="${esc(t("glossary.filter", { n: glossary.length }))}" data-gloss-filter />
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
        ? t("glossary.matches", {
            shown,
            total: entries.length,
            q: input.value.trim(),
          })
        : "";
  });
}

function notFound(message = t("notFound.text")): string {
  return `<div class="narrow-page"><h1 tabindex="-1">${esc(t("title.notFound"))}</h1><p>${esc(message)}</p><p><a href="#/">${esc(t("notFound.back"))}</a></p></div>`;
}

const titled = (page: string) => `${page} · ${t("site.name")}`;

export function renderRoute(route: Route): {
  html: string;
  title: string;
  anchor?: string;
} {
  switch (route.page) {
    case "home":
      return { html: home(), title: t("site.name") };
    case "chapter": {
      const ch = available().get(route.number);
      return {
        html: chapter(route.number),
        title: titled(ch ? ch.title : t("title.notFound")),
        anchor: route.anchor,
      };
    }
    case "glossary":
      return {
        html: glossaryPage(),
        title: titled(t("title.glossary")),
        anchor: route.term ? `term-${route.term}` : undefined,
      };
    case "levels":
      return {
        html: `<div id="levels-root"></div>`,
        title: titled(t("title.levels")),
      };
    case "play":
      return {
        html: `<div id="play-root" class="play"></div>`,
        title: titled(t("title.level")),
      };
    case "machine":
      return {
        html: `<div id="machine-root" class="machine"></div>`,
        title: titled(t("title.machine")),
      };
    case "assembler":
      return {
        html: `<div id="assembler-root" class="workshop"></div>`,
        title: titled(t("title.assembler")),
      };
    case "not-found":
      return { html: notFound(), title: titled(t("title.notFound")) };
  }
}
