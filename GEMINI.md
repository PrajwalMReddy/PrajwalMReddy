# PersonalWebsite Development Guidelines

## 1. Build & Verification Guardrails
- **Do NOT run full production builds (`npm run build`) for routine UI or logic changes.** Production webpack builds include heavy asset copying and minification that introduce significant delays.
- For verification, rely on:
  - Syntax/lint checks or dev server hot reload.
  - Quick targeted Node scripts for utility/logic testing.
  - Run `npm run build` only if explicitly requested by the user or when verifying a production deployment issue.

## 2. File Search & Command Scoping
- **Always scope file searches to `src/` or specific target directories.**
- **Never perform recursive scans across `node_modules` or `dist/`.** When using PowerShell or grep commands, explicitly filter out dependencies and generated bundles.

## 3. Tool Execution Efficiency
- Avoid speculative multi-step investigations for small, localized components. Inspect the immediate target file first and keep round-trips to a minimum.

