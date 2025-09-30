// eslint.config.js

import globals from "globals";
import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  // Global ignores
  {
    ignores: ["node_modules/", "dist/", "coverage/", "_TRASH_/", "eslint.config.js*"],
  },

  // Main configuration for your JavaScript files
  {
    files: ["**/*.js"], // Apply this configuration to all .js files
    
    // Extends from recommended configurations
    ...js.configs.recommended,
    ...prettierRecommended,

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs", // Specify you are using CommonJS
      globals: {
        ...globals.node, // Add all Node.js global variables
      },
    },

    // Custom rules
    rules: {
      "no-console": "warn",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];