// Loads and validates docs/glossary.yaml and docs/sources.yaml.
// Runs at build time (Node) and in tests; never shipped to the browser.
import { parse } from "yaml";

export interface GlossaryEntry {
  id: string;
  term: string;
  /** One plain-language sentence, shown in hover cards. */
  short: string;
  /** Optional longer explanation (Markdown, may link other terms). */
  long?: string;
  see?: string[];
}

export interface SourceRef {
  title?: string;
  url?: string;
  estimate?: boolean;
  note?: string;
}

export interface SourceEntry {
  id: string;
  claim: string;
  sources: SourceRef[];
  checked: string;
  uncertain?: string;
}

export class ContentError extends Error {}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(
  entry: Record<string, unknown>,
  key: string,
  where: string,
  errors: string[],
): string {
  const v = entry[key];
  if (typeof v !== "string" || v.trim() === "") {
    errors.push(`${where}: missing or empty \`${key}\``);
    return "";
  }
  return v.trim();
}

function optStr(
  entry: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = entry[key];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function list(text: string, file: string): unknown[] {
  const data: unknown = parse(text);
  if (!Array.isArray(data)) {
    throw new ContentError(`${file}: expected a YAML list at the top level`);
  }
  return data;
}

function checkIds(ids: string[], file: string, errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!ID.test(id)) errors.push(`${file}: id \`${id}\` must be kebab-case`);
    if (seen.has(id)) errors.push(`${file}: duplicate id \`${id}\``);
    seen.add(id);
  }
}

export function parseGlossary(
  text: string,
  file = "glossary.yaml",
): GlossaryEntry[] {
  const errors: string[] = [];
  const out = list(text, file).map((raw, i): GlossaryEntry => {
    const where = `${file} entry ${i + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${where}: expected a mapping`);
      return { id: "", term: "", short: "" };
    }
    const see = Array.isArray(raw.see) ? raw.see.map(String) : undefined;
    return {
      id: str(raw, "id", where, errors),
      term: str(raw, "term", where, errors),
      short: str(raw, "short", where, errors),
      long: optStr(raw, "long"),
      see,
    };
  });
  checkIds(
    out.map((e) => e.id),
    file,
    errors,
  );
  const ids = new Set(out.map((e) => e.id));
  for (const e of out) {
    for (const s of e.see ?? []) {
      if (!ids.has(s))
        errors.push(
          `${file}: \`${e.id}\` has see: \`${s}\`, which is not a glossary id`,
        );
    }
  }
  if (errors.length) throw new ContentError(errors.join("\n"));
  return out.sort((a, b) => a.term.localeCompare(b.term));
}

export function parseSources(
  text: string,
  file = "sources.yaml",
): SourceEntry[] {
  const errors: string[] = [];
  const out = list(text, file).map((raw, i): SourceEntry => {
    const where = `${file} entry ${i + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${where}: expected a mapping`);
      return { id: "", claim: "", sources: [], checked: "" };
    }
    const sources: SourceRef[] = [];
    if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
      errors.push(`${where}: needs at least one entry under \`sources\``);
    } else {
      raw.sources.forEach((s: unknown, j) => {
        if (!isRecord(s)) {
          errors.push(`${where}, source ${j + 1}: expected a mapping`);
          return;
        }
        const ref: SourceRef = {
          title: optStr(s, "title"),
          url: optStr(s, "url"),
          estimate: s.estimate === true,
          note: optStr(s, "note"),
        };
        if (ref.estimate) {
          if (!ref.note)
            errors.push(
              `${where}, source ${j + 1}: an estimate needs a \`note\` explaining it`,
            );
        } else if (!ref.title || !ref.url || !/^https:\/\//.test(ref.url)) {
          errors.push(
            `${where}, source ${j + 1}: needs a \`title\` and an https \`url\``,
          );
        }
        sources.push(ref);
      });
    }
    return {
      id: str(raw, "id", where, errors),
      claim: str(raw, "claim", where, errors),
      sources,
      checked: str(raw, "checked", where, errors),
      uncertain: optStr(raw, "uncertain"),
    };
  });
  checkIds(
    out.map((e) => e.id),
    file,
    errors,
  );
  if (errors.length) throw new ContentError(errors.join("\n"));
  return out;
}

/** A translated source: the claim (and, if the original is contested, why)
 * in another language; links and dates of checking come from the original. */
export interface SourceText {
  id: string;
  claim: string;
  uncertain?: string;
  checked?: string;
  /** Translation of an estimate's note. */
  note?: string;
}

export function parseSourceTexts(text: string, file: string): SourceText[] {
  const errors: string[] = [];
  const out = list(text, file).map((raw, i): SourceText => {
    const where = `${file} entry ${i + 1}`;
    if (!isRecord(raw)) {
      errors.push(`${where}: expected a mapping`);
      return { id: "", claim: "" };
    }
    return {
      id: str(raw, "id", where, errors),
      claim: str(raw, "claim", where, errors),
      uncertain: optStr(raw, "uncertain"),
      checked: optStr(raw, "checked"),
      note: optStr(raw, "note"),
    };
  });
  checkIds(
    out.map((e) => e.id),
    file,
    errors,
  );
  if (errors.length) throw new ContentError(errors.join("\n"));
  return out;
}
