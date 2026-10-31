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
    const title = `Chapter ${ch.number}: ${esc(ch.title)}`;
    return `<li class="chapter" data-ready="${ready}">
      <span class="chapter-number" aria-hidden="true">${ch.number}</span>
      <div>
        <h3>${ready ? `<a href="${chapterHref(ch.number)}">${title}</a>` : title}</h3>
        <p>${esc(ch.summary)}</p>
        <span class="chapter-status">${ready ? "Ready to read" : "Coming soon"}</span>
      </div>
    </li>`;
  }).join("");
  return `<h1 tabindex="-1">Sand to Tetris</h1>
    <p class="tagline">Start with sand. Build switches, gates, memory, a CPU, a compiler and an
    operating system. Finish by playing Tetris on the computer you made.</p>
    <h2>Chapters</h2>
    <ol class="chapters">${items}</ol>`;
}

function chapter(number: number): string {
  const ch = available.get(number);
  if (!ch) return notFound(`Chapter ${number} isn't written yet.`);
  const toc = ch.toc
    .map(
      (t) =>
        `<li><a href="${chapterHref(number, t.id)}">${esc(t.text)}</a></li>`,
    )
    .join("");
  const prev = available.get(number - 1);
  const next = available.get(number + 1);
  const pager = `<nav class="pager" aria-label="Chapters">
    ${prev ? `<a href="${chapterHref(prev.number)}">← Chapter ${prev.number}: ${esc(prev.title)}</a>` : "<span></span>"}
    ${next ? `<a href="${chapterHref(next.number)}">Chapter ${next.number}: ${esc(next.title)} →</a>` : ""}
  </nav>`;
  return `<article class="chapter-page">
    <p class="eyebrow">Chapter ${ch.number}</p>
    <h1 tabindex="-1">${esc(ch.title)}</h1>
    <p class="lead">${esc(ch.summary)}</p>
    <nav class="toc" aria-label="In this chapter"><h2>In this chapter</h2><ol>${toc}</ol></nav>
    ${ch.html}
  </article>${pager}`;
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
      return `<div class="gloss-entry" id="term-${g.id}">
        <dt>${esc(g.term)}</dt>
        <dd><p>${g.shortHtml}</p>${g.longHtml ? `<p>${g.longHtml}</p>` : ""}
        ${see ? `<p class="see">See also: ${see}</p>` : ""}</dd>
      </div>`;
    })
    .join("");
  return `<h1 tabindex="-1">Glossary</h1>
    <p class="lead">Every technical term used in the chapters, in plain language.</p>
    <dl class="glossary">${items}</dl>`;
}

function notFound(message = "There's no page at this address."): string {
  return `<h1 tabindex="-1">Not found</h1><p>${esc(message)}</p><p><a href="#/">Back to the chapters</a></p>`;
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
