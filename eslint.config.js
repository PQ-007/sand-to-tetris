import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "target/**",
      "web/dist/**",
      "web/src/sim/pkg/**",
      // Vendored hairline engine and figures (see its README).
      "web/src/vendor/hairline/*.js",
    ],
  },
  ...tseslint.configs.recommended,
);
