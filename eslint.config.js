import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly"
      }
    },
    rules: {
      // Logic & Complexity
      "complexity": ["error", 10],
      "max-depth": ["error", 3],
      "max-lines-per-function": ["error", 50],
      "max-params": ["error", 3],
      "max-nested-callbacks": ["error", 3],
      
      // Strictness
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "no-console": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-wrappers": "error",
      "no-caller": "error",
      "no-undef-init": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "yoda": ["error", "never"],
      "no-return-await": "off", // We want explicit returns in some stunts
      "consistent-return": "error",
      "no-shadow": "error",
      "no-use-before-define": ["error", { "functions": false }],
      
      // Style (that affects logic)
      "no-lonely-if": "error",
      "no-unneeded-ternary": "error",
      "one-var": ["error", "never"]
    }
  }
];