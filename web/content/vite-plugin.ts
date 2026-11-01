// Exposes docs/ as `virtual:s2t-content`. Any content error (broken glossary
// link, unknown citation, unregistered component) fails the build.
import { resolve } from "node:path";
import type { Plugin } from "vite";
import { loadContent, loadLevelText, loadLevels } from "./load";

const ID = "virtual:s2t-content";
const RESOLVED = "\0" + ID;

export function contentPlugin(docsDir: string, levelsDir: string): Plugin {
  const dir = resolve(docsDir);
  const levels = resolve(levelsDir);
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
      // Level definitions only (level.toml) and their translated texts;
      // never reference solutions.
      const levelFiles = loadLevels(levels);
      const mnText = resolve(levels, "mn.yaml");
      this.addWatchFile(mnText);
      const levelText = { mn: loadLevelText(mnText) };
      return (
        `export const content = ${JSON.stringify(content)};\n` +
        `export const levelFiles = ${JSON.stringify(levelFiles)};\n` +
        `export const levelText = ${JSON.stringify(levelText)};\n`
      );
    },
    configureServer(server) {
      server.watcher.add([dir, levels]);
      server.watcher.on("change", (file) => {
        const f = resolve(file);
        if (
          !f.startsWith(dir) &&
          !(
            f.startsWith(levels) &&
            (f.endsWith("level.toml") || f.endsWith("mn.yaml"))
          )
        )
          return;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}
