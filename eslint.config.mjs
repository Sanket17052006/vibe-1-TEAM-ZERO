import tseslint from "typescript-eslint";

const config = tseslint.config(
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...tseslint.configs.recommended,
);

export default config;
