# @packlet/core

## 0.1.3

### Patch Changes

- 68e1755: Packlet now supports using `package.json.packlet` options alongside command-line arguments. And also migrate the CLI implementation to Clibu to improve efficiency and reduce overhead.

## 0.1.2

### Patch Changes

- 65523e5: Small addition: accepts the `packlet.gprName` field in package metadata (no behavior change beyond allowing the field).

## 0.1.1

### Patch Changes

- 5f83f4d: This update modernizes the build system by making ESM the default output format (CJS now opt-in), disabling sourcemaps by default, and adding external dependency handling. The changes reduce package sizes and improve flexibility for library consumers.
  - ESM-first approach: All packages now default to ESM output with CJS available via `--cjs` flag
  - Sourcemap optimization: Disabled by default; inline maps coerced to external to prevent large base64 embeds
  - External dependencies: New `--external` and `--external-auto` flags to avoid bundling dependencies
