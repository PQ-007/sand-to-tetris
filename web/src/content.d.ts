declare module "virtual:s2t-content" {
  /** Chapters and glossary, per language. */
  export const content: Record<
    import("../content/load").Lang,
    import("../content/load").SiteContent
  >;
  export const levelFiles: import("../content/load").LevelFile[];
  /** Translated level names, goals and hints (English is in the files). */
  export const levelText: {
    mn: Record<string, import("../content/load").LevelText>;
  };
}
