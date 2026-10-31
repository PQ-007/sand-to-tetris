// Exposes docs/ as `virtual:s2t-content`. Any content error (broken glossary
// link, unknown citation, unregistered component) fails the build.
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { loadContent } from "./load";

const ID = "virtual:s2t-content";
const RESOLVED = "\0" + ID;

export function contentPlugin(docsDir: string): Plugin {
  const dir = resolve(docsDir);
  return {
    name: "s2t-content",
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      const { content, files, errors } = loadContent(dir);
      for (const f of files) this.addWatchFile(f);
      if (errors.length)
        this.error(`Content errors:\n  ${errors.join("\n  ")}`);
      return (
        `export const chapters = ${JSON.stringify(content.chapters)};\n` +
        `export const glossary = ${JSON.stringify(content.glossary)};\n`
      );
    },
    configureServer(server) {
      server.watcher.add(dir);
      server.watcher.on("change", (file) => {
        if (!resolve(file).startsWith(dir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
