<div align="center">

# 📦️ @packlet/build

[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?logo=node.js&logoColor=white)<br />
![license](https://img.shields.io/github/license/nazahex/packlet-js)

</div>

`@packlet/build` is a focused, minimal build layer for TypeScript and JavaScript packages. It wraps Bun’s high-performance bundler with a clean, consistent interface tailored for libraries and CLIs—no heavy configuration, no multi-tool orchestration.

If you want a predictable, modern build pipeline with ESM-first output, optional CJS, and automatic type generation, `@packlet/build` gives you exactly that with a single command or function call.

Use it standalone or as the build engine behind the higher-level `packlet` CLI.

## Features

- **ESM by default** (`dist/index.mjs`), with optional **CJS output** (`dist/index.cjs`)
- **TypeScript declarations** generated automatically into `dist/`
- **Fast Bun-based bundling** with a single consistent interface
- **Simple control** over sourcemaps, minification, externalization, and CLI executables
- **Programmatic API** for embedding in your own tooling

## Installation

```sh
# with bun
bun add -D @packlet/build

# with npm
npm install -D @packlet/build
```

> **Note:** `@packlet/build` uses `bun build` internally. Bun must be installed on the machine running the build (recommended: Bun ≥ 1.2.0).
> For environments without Bun, you may still use the programmatic API with custom bundlers.

## Usage via npm scripts

Add build scripts to your `package.json`:

```jsonc
{
  "scripts": {
    "build": "packlet-build build --sourcemap none --external-auto",
    "build:cli": "packlet-build build --cjs --exec-js --sourcemap none --external-auto"
  }
}
```

Run them normally:

```sh
npm run build
# or
bun run build
```

Or run the CLI directly using `npx` / `bunx`:

```sh
npx @packlet/build build --sourcemap none --external-auto
```

## Programmatic API

You can also invoke the builder directly from JavaScript or TypeScript for full control:

```ts
import { build } from "@packlet/build"

await build({
  entry: "src/index.ts",
  outdir: "dist",
  formats: ["esm"],
  sourcemap: "none",
  types: true,
  target: "node",
  execJs: false,
  minify: true
})
```

This API is ideal for custom workflows, monorepos, or script-driven build pipelines.

## CLI flags

`packlet-build` supports the following build flags:

- `--entry <file>`: entry file (default: `src/index.ts`)
- `--outdir <dir>`: output directory (default: `dist`)
- `--formats <list>`: comma-separated formats (default: `esm`)
- `--cjs`: shorthand to also emit CommonJS (`index.cjs`)
- `--sourcemap <kind>`: `external` or `none` (default: `none`)
- `--no-types`: skip type declaration generation
- `--target <target>`: build target (default: `node`)
- `--exec-js`: mark generated output as executable (helpful for CLIs)
- `--no-minify`: disable minification (enabled by default)
- `--external <packages>`: specify external packages
- `--external-auto`: automatically externalize dependencies and peerDependencies

### Notes

- Type declarations come from `tsc --emitDeclarationOnly`, always using your local `tsconfig.json`.
- For debugging, prefer `--sourcemap external` to keep maps separate from published artifacts.
- Disable minification (`--no-minify`) when inspecting bundles locally.

## License

MIT © KazViz
