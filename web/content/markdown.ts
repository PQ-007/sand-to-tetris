// Renders a chapter's Markdown to HTML, with two extensions:
//   [[term]] / [[shown text|term-id]]  → glossary link (hover card in the UI)
//   [@source-id]                       → numbered citation; "?" marks contested claims
// Every reference is checked; problems are reported with file:line.
import MarkdownIt, { type Env as MdEnv, type StateInline } from "markdown-it";
import { parse as parseYaml } from "yaml";
import type { GlossaryEntry, SourceEntry } from "./data";

export interface ChapterMeta {
  number: number;
  title: string;
  summary: string;
}

export interface TocEntry {
  id: string;
  text: string;
}

export interface RenderedChapter extends ChapterMeta {
  html: string;
  toc: TocEntry[];
}

export interface RenderResult {
  chapter?: RenderedChapter;
  errors: string[];
}

export interface RenderContext {
  glossary: GlossaryEntry[];
  sources: SourceEntry[];
  /** Custom element tags that chapters may use. */
  knownTags: readonly string[];
}

interface Env extends MdEnv {
  file: string;
  line: number;
  errors: string[];
  cited: string[];
  routeBase: string;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitFrontmatter(src: string): {
  meta: unknown;
  body: string;
  offset: number;
} {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(src);
  if (!m) return { meta: undefined, body: src, offset: 0 };
  return {
    meta: parseYaml(m[1] ?? ""),
    body: src.slice(m[0].length),
    offset: m[0].split("\n").length - 1,
  };
}

function bracketRule(
  name: string,
  open: string,
  handle: (inner: string, state: StateInline) => string | null,
) {
  return (state: StateInline, silent: boolean): boolean => {
    const start = state.pos;
    if (!state.src.startsWith(open, start)) return false;
    const close = open === "[[" ? "]]" : "]";
    const end = state.src.indexOf(close, start + open.length);
    if (end < 0) return false;
    const inner = state.src.slice(start + open.length, end);
    if (inner.includes("\n") || inner.trim() === "") return false;
    if (!silent) {
      const html = handle(inner.trim(), state);
      const token = state.push("html_inline", "", 0);
      token.content =
        html ?? escapeHtml(state.src.slice(start, end + close.length));
      token.info = name;
    }
    state.pos = end + close.length;
    return true;
  };
}

export function createRenderer(ctx: RenderContext) {
  const terms = new Map(ctx.glossary.map((g) => [g.id, g]));
  const sources = new Map(ctx.sources.map((s) => [s.id, s]));
  const known = new Set(ctx.knownTags);

  const md = new MarkdownIt({ html: true, typographer: true });

  const lineOf = (state: StateInline): number => {
    const env = state.env as Env;
    const tokenLine = (state as unknown as { parentLine?: number }).parentLine;
    return env.line + (tokenLine ?? 0) + 1;
  };

  md.inline.ruler.before(
    "link",
    "glossary_link",
    bracketRule("glossary", "[[", (inner, state) => {
      const env = state.env as Env;
      const [shown, idRaw] = inner.includes("|")
        ? inner.split("|", 2)
        : [inner, undefined];
      const text = (shown ?? "").trim();
      const id = (idRaw ?? slugify(text)).trim();
      const entry = terms.get(id);
      if (!entry) {
        env.errors.push(
          `${env.file}:${lineOf(state)}: [[${inner}]] → no glossary entry \`${id}\``,
        );
        return null;
      }
      return (
        `<a class="term" href="#/glossary/${id}" data-term="${id}">` +
        `${escapeHtml(text)}</a>`
      );
    }),
  );

  md.inline.ruler.before(
    "link",
    "citation",
    bracketRule("citation", "[@", (inner, state) => {
      const env = state.env as Env;
      const id = inner.trim();
      const src = sources.get(id);
      if (!src) {
        env.errors.push(
          `${env.file}:${lineOf(state)}: [@${id}] → no entry \`${id}\` in sources.yaml`,
        );
        return null;
      }
      let n = env.cited.indexOf(id) + 1;
      if (n === 0) {
        env.cited.push(id);
        n = env.cited.length;
      }
      const contested = src.uncertain ? "?" : "";
      const label = `Source ${n}${src.uncertain ? ", contested" : ""}`;
      return (
        `<sup class="cite${src.uncertain ? " cite--contested" : ""}">` +
        `<a href="${env.routeBase}/s/src-${id}" aria-label="${label}" title="${label}">` +
        `${n}${contested}</a></sup>`
      );
    }),
  );

  // Parse inline content per block token, remembering the block's line so
  // inline rules can report file:line.
  md.core.ruler.at("inline", (state) => {
    for (const tok of state.tokens) {
      if (tok.type !== "inline") continue;
      const inlineState = new md.inline.State(
        tok.content,
        md,
        state.env,
        tok.children ?? [],
      );
      (inlineState as unknown as { parentLine?: number }).parentLine =
        tok.map?.[0] ?? 0;
      tok.children = inlineState.tokens;
      md.inline.tokenize(inlineState);
    }
  });

  // Heading ids for the table of contents and deep links.
  md.core.ruler.push("s2t_heading_ids", (state) => {
    const env = state.env as Env;
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const inline = tokens[i + 1];
      if (t?.type !== "heading_open" || !inline) continue;
      const id = slugify(inline.content);
      t.attrSet("id", id);
      if (t.tag === "h2")
        (env as Env & { toc: TocEntry[] }).toc.push({
          id,
          text: inline.content,
        });
    }
  });

  // Only known custom elements may appear in chapter HTML.
  const checkTags = (html: string, line: number, env: Env) => {
    for (const m of html.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]*)/g)) {
      const tag = m[1] ?? "";
      if (!known.has(tag)) {
        env.errors.push(
          `${env.file}:${line}: <${tag}> is not a registered component ` +
            `(known: ${[...known].join(", ")})`,
        );
      }
    }
  };
  md.core.ruler.push("s2t_tags", (state) => {
    const env = state.env as Env;
    for (const t of state.tokens) {
      if (t.type === "html_block")
        checkTags(t.content, env.line + (t.map?.[0] ?? 0) + 1, env);
      if (t.type === "inline") {
        for (const c of t.children ?? []) {
          if (c.type === "html_inline" && !c.info) {
            checkTags(c.content, env.line + (t.map?.[0] ?? 0) + 1, env);
          }
        }
      }
    }
  });

  function sourcesSection(cited: string[]): string {
    if (cited.length === 0) return "";
    const items = cited
      .map((id) => {
        const s = sources.get(id);
        if (!s) return "";
        const refs = s.sources
          .map((r) =>
            r.estimate
              ? `<li>Estimate: ${escapeHtml(r.note ?? "")}</li>`
              : `<li><a href="${escapeHtml(r.url ?? "")}" rel="noopener" target="_blank">${escapeHtml(r.title ?? "")}</a></li>`,
          )
          .join("");
        const contested = s.uncertain
          ? `<p class="contested"><strong>Contested:</strong> ${escapeHtml(s.uncertain)}</p>`
          : "";
        return (
          `<li id="src-${id}"><p class="claim">${escapeHtml(s.claim)}</p>` +
          `${contested}<ul class="refs">${refs}</ul>` +
          `<p class="checked">Checked: ${escapeHtml(s.checked)}</p></li>`
        );
      })
      .join("");
    return `<section class="sources" aria-labelledby="sources"><h2 id="sources">Sources</h2><ol>${items}</ol></section>`;
  }

  function renderChapter(src: string, file: string): RenderResult {
    const errors: string[] = [];
    const { meta, body, offset } = splitFrontmatter(src);
    const m = meta as Partial<ChapterMeta> | undefined;
    if (!m || typeof m.number !== "number" || !m.title || !m.summary) {
      errors.push(
        `${file}:1: frontmatter needs \`number\`, \`title\` and \`summary\``,
      );
      return { errors };
    }
    const routeBase = `#/chapter/${m.number}`;
    const env: Env & { toc: TocEntry[] } = {
      file,
      line: offset,
      errors,
      cited: [],
      routeBase,
      toc: [],
    };
    const html = md.render(body, env) + sourcesSection(env.cited);
    return {
      chapter: {
        number: m.number,
        title: String(m.title),
        summary: String(m.summary),
        html,
        toc: env.toc,
      },
      errors,
    };
  }

  /** Renders a short Markdown snippet (glossary text) inline. */
  function renderInline(
    src: string,
    file: string,
  ): { html: string; errors: string[] } {
    const env: Env & { toc: TocEntry[] } = {
      file,
      line: 0,
      errors: [],
      cited: [],
      routeBase: "#/glossary",
      toc: [],
    };
    return { html: md.renderInline(src, env), errors: env.errors };
  }

  return { renderChapter, renderInline };
}
