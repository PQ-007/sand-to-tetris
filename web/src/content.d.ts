declare module "virtual:s2t-content" {
  export const chapters: import("../content/markdown").RenderedChapter[];
  export const glossary: import("../content/load").GlossaryItem[];
  export const levelFiles: import("../content/load").LevelFile[];
}
