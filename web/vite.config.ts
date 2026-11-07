import { defineConfig } from "vitest/config";
import { contentPlugin } from "./content/vite-plugin";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [contentPlugin("../docs", "../hdl/levels")],
  build: {
    target: "es2022",
    // Keep `/*! @license … */` notices (the hairline figures' MIT notice).
    rolldownOptions: { output: { comments: { legal: true } } },
  },
  test: { include: ["test/**/*.test.ts"] },
});
