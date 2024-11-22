import globals from "globals";
import pluginJs from "@eslint/js";


/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.js"], languageOptions: { sourceType: "script" } },
  { languageOptions: { globals: { frappe: true, qz: true, erpnext: true, "$": true, "__":true, flt:true, format_currency:true, ...globals.browser } } },
  pluginJs.configs.recommended,
  { rules: { "semi": "error" } }
];