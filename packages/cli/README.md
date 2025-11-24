<div align="center">

# 📦️ @packlet/cli

[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?logo=node.js&logoColor=white)<br />
![license](https://img.shields.io/github/license/kazvizian/packlet-js)

</div>

`@packlet/cli` provides the implementation behind the `packlet` command-line interface. It exposes the build, packaging, validation, and artifact utilities used across the Packlet toolchain.

Most users should install the higher-level `packlet` package, which bundles this CLI with defaults and additional conveniences. Use `@packlet/cli` directly only when you specifically need the standalone CLI internals.

## Installation

```sh
# bun
bun add -D @packlet/cli

# npm
npm install -D @packlet/cli
```

## Usage

When installed as a development dependency, the `packlet` binary becomes available through your package manager:

```sh
npx packlet --help
```

You may also invoke the commands via npm scripts:

```jsonc
{
  "scripts": {
    "build": "packlet build",
    "gpr": "packlet gpr --root .",
    "validate": "packlet validate --root .",
    "list-artifacts": "packlet list-artifacts --artifacts .artifacts"
  }
}
```

The behavior matches the public `packlet` package, including configuration resolution and defaults.

## Commands overview

The CLI offers four primary commands:

- **`packlet build`** — Bundles the package (ESM by default, optional CJS) and generates declaration files.
- **`packlet gpr`** — Produces a GitHub Packages–compatible scoped variant and emits `.tgz` artifacts.
- **`packlet validate`** — Verifies that required output files exist in `dist/`.
- **`packlet list-artifacts`** — Enumerates `.tgz` files in an artifacts directory.

All commands use the shared configuration model from `@packlet/core`, respecting overrides from CLI flags, environment variables, and `package.json.packlet`.

## When to use @packlet/cli

Install and use `@packlet/cli` directly if:

- You are embedding the Packlet CLI within another system and require only the CLI implementation.
- You maintain a wrapper or custom workflow that should not depend on the higher-level `packlet` meta-package.

For typical development workflows, the `packlet` package remains the recommended entry point.

## License

MIT © KazViz
