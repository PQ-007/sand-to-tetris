import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  build: { target: "es2022" },
  test: { include: ["test/**/*.test.ts"] },
});
