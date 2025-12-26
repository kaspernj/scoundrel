import js from "@eslint/js"
import jsdoc from "eslint-plugin-jsdoc"
import globals from "globals"
import {defineConfig} from "eslint/config"

export default defineConfig([
  {
    ignores: ["build/**"]
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {js, jsdoc},
    extends: ["js/recommended", "jsdoc/recommended"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jasmine
      }
    }
  }
])
