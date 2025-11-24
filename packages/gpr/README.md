<div align="center">

# 📦️ @packlet/gpr

[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?logo=node.js&logoColor=white)<br />
![license](https://img.shields.io/github/license/nazahex/packlet-js)

Lightweight tooling for preparing packages for distribution through GitHub Packages (GPR).

</div>

`@packlet/gpr` streamlines the creation of **GPR-compatible package variants** by generating deterministic staging directories and `.tgz` artifacts suitable for CI environments. It focuses on predictable behavior, minimal configuration, and compatibility with both standalone usage and the broader `packlet` toolchain.

This utility produces ready-to-publish artifacts but **does not perform publishing**. Publishing should be handled explicitly in your CI or release workflow.

## Features

- Generates a staged package in a dedicated directory (default: `.gpr/`).
- Applies a scoped package name suitable for GitHub Packages.
- Copies compiled output from `dist/` into the staging area.
- Optionally includes `README.md` and `LICENSE`.
- Produces reproducible `.tgz` artifacts (default: `.artifacts/`).
- Provides deterministic rules for deriving GPR package names.
- Supports both CLI and programmatic usage.

## Installation

```sh
# npm
npm install -D @packlet/gpr

# pnpm
pnpm add -D @packlet/gpr

# bun
bun add -D @packlet/gpr
```

## CLI Usage

If you use the `packlet` CLI:

```sh
packlet gpr [options]
```

Or invoke directly via an npm script:

```jsonc
{
  "scripts": {
    "gpr": "node -e \"require('@packlet/gpr').awakenGpr({ rootDir: '.' })\""
  }
}
```

## CLI Options

| Option               | Description                       | Default                            |
| -------------------- | --------------------------------- | ---------------------------------- |
| `--root <path>`      | Project root directory            | Current directory                  |
| `--gpr-dir <path>`   | Staging directory                 | `.gpr`                             |
| `--artifacts <path>` | Output directory for `.tgz` files | `.artifacts`                       |
| `--dist <path>`      | Build directory                   | `dist`                             |
| `--scope <scope>`    | Package scope                     | `GPR_SCOPE` or `nazahex`           |
| `--registry <url>`   | Registry URL                      | `GPR_REGISTRY` or GitHub Packages  |
| `--name <name>`      | Override staged package name      | From `packlet.gprName` if provided |
| `--include-readme`   | Include `README.md`               | true                               |
| `--include-license`  | Include `LICENSE`                 | true                               |
| `--json`             | Print artifact manifest to stdout | false                              |
| `--manifest <file>`  | Write artifact manifest to a file | —                                  |

## Output Structure

- **Staging directory:** `.gpr/`
  Contains the staged `package.json`, `dist/`, and optional documentation files.

- **Artifact directory:** `.artifacts/`
  Contains generated `.tgz` files for the staged package.

## Environment Variables

| Variable              | Description           | Example                       |
| --------------------- | --------------------- | ----------------------------- |
| `GPR_SCOPE`           | Default package scope | `acme`                        |
| `GPR_REGISTRY`        | Registry URL          | `https://npm.pkg.github.com/` |
| `GPR_INCLUDE_README`  | Include `README.md`   | `true`                        |
| `GPR_INCLUDE_LICENSE` | Include `LICENSE`     | `true`                        |
| `GPR_NAME`            | Override package name | `@acme/pkg`                   |

Directory-related variables supported by `@packlet/core` are also recognized:
`PACKLET_DIST_DIR`, `PACKLET_ARTIFACTS_DIR`, `PACKLET_GPR_DIR`.

## Package.json Configuration

`@packlet/gpr` can be configured through a `packlet` block:

```jsonc
{
  "packlet": {
    "gpr": true,
    "gprName": "packlet-core"
  }
}
```

Rules:

- Unscoped `gprName` values are automatically scoped using `--scope` or `GPR_SCOPE`.
- Fully scoped names are used as-is.
- Invalid values are ignored with a warning.

**Precedence:**
CLI flags > Environment variables > `package.json.packlet` > defaults.

## Programmatic API

```ts
import { awakenGpr } from "@packlet/gpr"

const result = awakenGpr({
  rootDir: "/path/to/project",
  scope: "acme",
  includeReadme: true
})

console.log(result.scopedName)
console.log(result.version)
console.log(result.gprDir)
console.log(result.artifactsDir)
```

### Options

```ts
interface AwakenGprOptions {
  rootDir?: string
  gprDir?: string
  artifactsDir?: string
  distDir?: string
  scope?: string
  registry?: string
  nameOverride?: string
}
```

## Naming Behavior

`@packlet/gpr` derives a valid GPR package name using the following priority:

1. **Explicit overrides**
   - CLI `--name`
   - `GPR_NAME`
   - `packlet.gprName`

2. **Project metadata**
   `package.json.name`, with any existing scope removed.

3. **Scope application**
   If the selected name is unscoped, the configured scope is applied:

   ```
   @<scope>/<name>
   ```

## CI Example (GitHub Actions)

```yaml
name: Build and Pack

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build

      - name: Prepare GPR package
        run: npx packlet gpr --root . --scope your-org

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: gpr-artifacts
          path: .artifacts
```

### Publishing

Publishing should occur in a separate step using a token with `packages:write` permission:

```sh
npm publish <artifact.tgz> --registry https://npm.pkg.github.com/
```

## Troubleshooting

- **`dist/` missing**
  Ensure a build has been performed.

- **Artifacts not generated**
  Review the output of `npm pack` for naming issues.

- **Unexpected package name**
  Override via `--name` or `GPR_NAME`.

- **Manifest not found in CI**
  Use `--json` or `--manifest <file>` to emit the artifact manifest.

## License

MIT © KazViz
