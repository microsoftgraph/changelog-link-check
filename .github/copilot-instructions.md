# Copilot Instructions

## Build and test commands

```bash
npm run build        # TypeScript compilation (tsc)
npm run test         # Run all tests (Jest with ESM support)
npm run lint         # ESLint
npm run package      # Clean dist/ and bundle with Rollup into dist/index.js
npm run all          # Format + build + test + package

# Run a single test file
npx cross-env NODE_OPTIONS='--experimental-vm-modules' jest test/validation.test.ts

# Run a single test by name
npx cross-env NODE_OPTIONS='--experimental-vm-modules' jest -t "Valid URL passes"
```

After any source change that should ship, run `npm run package` to regenerate
`dist/index.js` — this bundled file is what the GitHub Action actually executes.

## Architecture

This is a **GitHub Action** (Node.js) that validates links in changelog JSON
files within pull requests for the Microsoft Graph documentation repository.

### Entry points

- **`src/index.ts`** — Action entry point. Runs on `pull_request` events: lists
  PR files, calls validation, posts a PR comment and applies the `invalid links`
  label when broken links are found, or removes the label when none are found.
- **`src/scan.ts`** — Standalone CLI scanner (`--changelog-directory <path>`)
  for local validation. Can optionally remove broken links
  (`--remove-broken-links`).

### Core flow

1. `checkFilesForBrokenLinks` filters PR files to JSON files matching the
   configured changelog directory, then checks each file.
2. `checkFileForBrokenLinks` reads a file line-by-line, extracts Markdown-style
   links `[text](url)`, and validates each URL via HTTP HEAD request.
3. URL results are cached in module-level `knownGoodUrls`/`knownBadUrls` arrays
   to avoid duplicate requests. Timed-out requests get one automatic retry.
4. `getListOfNewUrls` generates expected Microsoft Learn URLs from newly-added
   files in the PR, so links to not-yet-published docs aren't flagged.
5. `generateGraphUrl` maps repo file paths (e.g.,
   `api-reference/beta/api/foo.md`) to their corresponding
   `learn.microsoft.com/en-us/graph/...` URLs.

### Bundling

Rollup bundles everything into a single `dist/index.js` (ES module format).
The action runs this bundle directly via `node24` (see `action.yml`).

## Conventions

- **ESM throughout** — the project uses `"type": "module"` with `.js` extensions
  in TypeScript imports (e.g., `import { ... } from './validation.js'`).
- **Copyright header required** — every `.ts` and `.js` file must start with:
  ```
  // Copyright (c) Microsoft Corporation.
  // Licensed under the MIT license.
  ```
  This is enforced by ESLint (`@tony.ganchev/eslint-plugin-header`).
- **Prettier via ESLint** — formatting (single quotes, 80-char line width,
  auto line endings) is enforced through the `eslint-plugin-prettier` integration.
- **User-facing strings** — PR comment text lives in `src/strings.ts`.
- **Tests** — Jest test files live in `test/` with `.test.ts` suffix. Tests use
  `@jest/globals` imports (`import { expect, test } from '@jest/globals'`).
