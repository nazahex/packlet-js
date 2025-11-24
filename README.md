<div align="center">

# 📦️ Packlet

[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)<br />
![license](https://img.shields.io/github/license/nazahex/packlet-js)

</div>

Packlet is a small toolkit for building JavaScript/TypeScript packages and producing deterministic release artifacts.

It gives you:

- A single CLI (`packlet`) for common tasks like building your package, validating your `dist/` folder, and preparing GitHub Packages (GPR) artifacts.
- A set of focused libraries you can use directly if you only need one piece (build wrapper, GPR helper, core utilities).

This repository contains the source code for the Packlet ecosystem. You can install and use each package independently from npm.

## Getting started

Most users only need the main `packlet` package, which provides the CLI and a small programmatic API.

### Install

```sh
# with bun
bun add -D packlet

# with npm
npm install -D packlet
```

You can also install it globally if you prefer:

```sh
bun add -g packlet
# or
npm install -g packlet
```

### Basic CLI usage

Once installed, the `packlet` command is available in your project scripts or globally:

```sh
# build your package (ESM by default; add CJS with --cjs)
packlet build

# prepare a GitHub Packages (GPR) variant and emit a JSON manifest
packlet gpr --root . --json

# list generated tarball artifacts
packlet list-artifacts --artifacts .artifacts

# validate dist contents
packlet validate --root . --json
```

You can configure default directories and options via `package.json` (see **Configuration** below) so that your CLI usage stays minimal.

## Packages in the ecosystem

Packlet is published as several npm packages. You can use the main `packlet` package, or pick the lower-level building blocks if you prefer.

### `packlet`

Main public package. Provides the `packlet` CLI and re-exports a small programmatic API for working with artifacts, validation, and GPR preparation.

See the package README for full CLI and API details.

### `@packlet/build`

Lightweight build wrapper around Bun for TypeScript/JavaScript libraries and CLIs.

Use it when you want a simple way to:

- Bundle ESM (and optionally CJS) outputs.
- Emit `.d.ts` type declarations.
- Control sourcemaps and minification.

You can call it via npm scripts or its programmatic API. See the `@packlet/build` README for usage examples and CLI flags.

### `@packlet/core`

Headless utilities that power Packlet’s configuration and artifact handling. Useful if you want to integrate Packlet’s behavior into your own tooling.

Includes helpers for:

- Artifact manifests (`artifacts.json`).
- Dist validation.
- Name derivation and repo name extraction.
- Central configuration loading and environment variable handling.

### `@packlet/gpr`

Helper for preparing packages for GitHub Packages (GPR).

Use it when you want to:

- Stage a scoped package (e.g. `@your-scope/your-package`) in a separate directory.
- Generate `.tgz` tarballs in a predictable artifacts directory.
- Produce a machine-readable `artifacts.json` manifest.

You can call it via the main `packlet gpr` command or consume the `@packlet/gpr` API directly.

### `@packlet/cli`

Internal CLI implementation underlying the `packlet` command. Most users will not need to install this directly; it exists so the CLI can be reused in different packaging setups.

## Configuration overview

Packlet commands can be configured via a `packlet` block in your `package.json`. Configuration is centralized in the `@packlet/core` library, which also reads environment variables.

Typical configuration (simplified):

```jsonc
{
  "packlet": {
    "distDir": "dist",
    "artifactsDir": ".artifacts",
    "gprDir": ".gpr",
    "build": {
      "entry": "src/index.ts",
      "outdir": "dist",
      "formats": ["esm"],
      "sourcemap": "none",
      "types": true,
      "target": "node",
      "execJs": false,
      "minify": true
    },
    "gpr": true,
    "scope": "your-scope",
    "registry": "https://npm.pkg.github.com/",
    "includeReadme": true,
    "includeLicense": true
  }
}
```

Configuration is resolved with the following precedence:

1. CLI flags.
2. Environment variables.
3. `package.json.packlet`.
4. Built-in defaults.

For a full list of supported options and environment variables, see the `@packlet/core` README.

## Artifacts manifest

When you prepare a package for GitHub Packages using `packlet gpr`, Packlet can generate a small manifest describing the produced tarballs.

By default this is written to `<root>/.artifacts/artifacts.json` and looks like:

```json
{
  "schemaVersion": 1,
  "packageName": "<base-name>",
  "scopedName": "@<scope>/<base-name>",
  "version": "<semver>",
  "artifacts": [
    { "file": "<name>-<version>.tgz", "size": 12345, "sha512": "..." }
  ]
}
```

This is intended to be consumed by your CI or release tooling to decide what to upload or publish.

## Contributing

If you are interested in contributing to Packlet, please see `.github/CONTRIBUTING.md` in this repository for guidelines, development workflows, and notes about testing and CI.

## License

MIT © KazViz
