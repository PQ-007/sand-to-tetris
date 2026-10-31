import { defineConfig } from "vitest/config";
import { contentPlugin } from "./content/vite-plugin";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [contentPlugin("../docs")],
  build: { target: "es2022" },
  test: { include: ["test/**/*.test.ts"] },
});
