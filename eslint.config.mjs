import nextConfig from "eslint-config-next";

/** eslint-config-next v16 exports an ESLint flat-config array. */
const eslintConfig = [
  ...nextConfig,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "dist/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
