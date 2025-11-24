# Packlet (Aggregate Changelog)

## 0.3.3

### Patch Changes

- 68e1755: Packlet now supports using `package.json.packlet` options alongside command-line arguments. And also migrate the CLI implementation to Clibu to improve efficiency and reduce overhead.
- Updated dependencies [68e1755]
  - @packlet/build@0.2.2
  - @packlet/core@0.1.3
  - @packlet/cli@0.3.3
  - @packlet/gpr@0.2.2

## 0.3.2

### Patch Changes

- ffab721: Updates the CLI entry point logic for both the cli and packlet packages to improve compatibility with CommonJS (CJS) and ECMAScript Module (ESM) environments. Also ensures that the bin directory is included in the published package files.
- Updated dependencies [ffab721]
  - @packlet/cli@0.3.2

## 0.3.1

### Patch Changes

- 54ea4c5: Improves version control and stability by ensuring each package depends on a fixed, published version of its dependencies.
- Updated dependencies [54ea4c5]
  - @packlet/cli@0.3.1
  - @packlet/gpr@0.2.1

## 0.3.0

### Minor Changes

- 65523e5: - Added support for a `packlet.gprName` field in `package.json` for each package, allowing explicit override of the GPR package name (scoped or unscoped). If unscoped, the chosen scope is applied automatically.
  - In monorepos, the default base name for GPR is now always the package's own name (scope stripped), not the repo name, to avoid registry conflicts. Single-package repos may use the repo name if it differs from the package name.
  - Internal dependencies in monorepos retain their original npm package names when preparing for GPR; only version ranges are normalized (e.g., workspace protocol to semver).
  - Improved validation for `gprName` overrides, accepting only valid scoped or unscoped names and warning on invalid values.

### Patch Changes

- Updated dependencies [65523e5]
- Updated dependencies [65523e5]
  - @packlet/cli@0.3.0
  - @packlet/gpr@0.2.0
  - @packlet/build@0.2.1
  - @packlet/core@0.1.2

## 0.2.1

### Patch Changes

- Updated dependencies [1099c2b]
  - @packlet/cli@0.2.1
  - @packlet/gpr@0.1.2

## 0.2.0

### Minor Changes

- 5f83f4d: This update modernizes the build system by making ESM the default output format (CJS now opt-in), disabling sourcemaps by default, and adding external dependency handling. The changes reduce package sizes and improve flexibility for library consumers.
  - ESM-first approach: All packages now default to ESM output with CJS available via `--cjs` flag
  - Sourcemap optimization: Disabled by default; inline maps coerced to external to prevent large base64 embeds
  - External dependencies: New `--external` and `--external-auto` flags to avoid bundling dependencies

### Patch Changes

- Updated dependencies [5f83f4d]
  - @packlet/build@0.2.0
  - @packlet/cli@0.2.0
  - @packlet/gpr@0.1.1
  - @packlet/core@0.1.1
