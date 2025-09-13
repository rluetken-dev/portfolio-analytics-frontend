/** @type {import('eslint').Linter.Config} */
module.exports = {
  // Use the TypeScript parser to understand TS syntax
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
    project: false, // set to true + tsconfig path if you later want stricter rules
  },
  settings: {
    react: { version: "detect" },
  },
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended",
    // Turn off rules that conflict with Prettier formatting
    "eslint-config-prettier",
  ],
  rules: {
    // Example: encourage explicit returns and cleaner code
    "react/react-in-jsx-scope": "off", // not needed in React 17+
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
};
