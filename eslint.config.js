import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["target/**", "web/dist/**", "web/src/sim/pkg/**"] },
  ...tseslint.configs.recommended,
);
