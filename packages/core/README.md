<div align="center">

# 📦️ @packlet/core

[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?logo=node.js&logoColor=white)<br />
![license](https://img.shields.io/github/license/kazvizian/packlet-js)

</div>

`@packlet/core` provides the foundational utilities used across the Packlet ecosystem for producing deterministic release artifacts and resolving unified configuration. It offers cryptographic helpers, artifact manifest tooling, name derivation logic, directory utilities, and a centralized configuration model for both CLI and programmatic consumers.

## Features

- **Types:** Artifact manifest structures (`ArtifactEntry`, `ArtifactsManifestV1`).
- **Cryptography:** `computeSha512(filePath)` — compute SHA-512 digests.
- **Artifacts:** `listArtifacts(dir)` and `writeArtifactsManifest(dir, data)` — enumerate `.tgz` artifacts and emit `artifacts.json`.
- **Validation:** `validateDist({ distDir })` — verify the presence of expected build outputs.
- **Utilities:** `deriveScopedName`, `extractRepoName`, `copyRecursive`.

All exports are available from `src/index.ts`.

## Centralized configuration

`@packlet/core` implements the unified configuration loader used by other Packlet tools. It consolidates defaults, environment variable parsing, directory conventions, and precedence rules.

- Primary source: the `packlet` block in `package.json`.
- Precedence order: CLI flags > environment variables > `package.json.packlet` > built-in defaults.

Configuration schema (excerpt):

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
      "minify": true,
      "external": ["react"],
      "externalAuto": true
    },

    "gpr": true,
    "gprName": "packlet-core",
    "scope": "kazvizian",
    "registry": "https://npm.pkg.github.com/",
    "includeReadme": true,
    "includeLicense": true,

    "validate": { "dist": "dist" },
    "listArtifacts": { "artifactsDir": ".artifacts" }
  }
}
```

Environment variables parsed by `readPackletEnv()` include:

- Directories: `PACKLET_DIST_DIR`, `PACKLET_ARTIFACTS_DIR`, `PACKLET_GPR_DIR`
- Build options:
  `PACKLET_BUILD_ENTRY`, `PACKLET_BUILD_OUTDIR`, `PACKLET_BUILD_FORMATS`,
  `PACKLET_SOURCEMAP`, `PACKLET_TYPES`, `PACKLET_TARGET`,
  `PACKLET_EXEC_JS`, `PACKLET_MINIFY`,
  `PACKLET_EXTERNAL` (comma-separated), `PACKLET_EXTERNAL_AUTO`
- GPR options: `GPR_NAME`, `GPR_SCOPE`, `GPR_REGISTRY`, `GPR_INCLUDE_README`, `GPR_INCLUDE_LICENSE`

### Configuration API

- `loadPackletConfig(rootDir: string): PackletConfigV1`
- `readPackletEnv(env?: NodeJS.ProcessEnv): PackletEnv`
- `resolveBuildOptions({ cli?, env?, cfg?, defaults? }): ResolvedBuildOptions`
- `resolveGprOptions({ cli?, env?, cfg?, defaults? }): ResolvedGprOptions`
- `resolveValidateOptions({ cli?, env?, cfg?, defaults? })`
- `resolveListArtifactsOptions({ cli?, env?, cfg?, defaults? })`

Example:

```ts
import {
  loadPackletConfig,
  readPackletEnv,
  resolveBuildOptions,
  resolveGprOptions
} from "@packlet/core"

const root = process.cwd()
const cfg = loadPackletConfig(root)
const env = readPackletEnv()

const build = resolveBuildOptions({
  cli: { formats: "esm,cjs" },
  env,
  cfg
})

const gpr = resolveGprOptions({
  cli: { root },
  env,
  cfg
})
```

## Examples

```ts
import {
  deriveScopedName,
  writeArtifactsManifest,
  validateDist,
  listArtifacts
} from "@packlet/core"

const { baseName, scopedName } = deriveScopedName({
  name: "my-lib",
  override: "packlet-core",
  scope: "acme"
})
console.log(scopedName) // @acme/my-lib

const v = validateDist({ distDir: "./dist" })
if (!v.ok) console.warn("Missing dist files:", v.missing)

writeArtifactsManifest("./.artifacts", {
  packageName: baseName,
  scopedName,
  version: "0.1.0"
})
```

## Behavior

- `computeSha512(filePath)` — returns a hex-encoded SHA-512 digest.
- `listArtifacts(dir)` — returns an array of `{ file, size, sha512 }` for `.tgz` files.
- `writeArtifactsManifest(dir, data)` — writes `artifacts.json` (v1) and returns the manifest.
- `validateDist({ distDir, expected? })` — checks for common output files (`index.js`, `index.mjs`, `index.d.ts`) and reports missing entries.
- `deriveScopedName({ name, repoUrl?, override?, scope? })` — derives consistent base and scoped names.
  - Fully scoped overrides are used unchanged.
  - Unscoped overrides apply the configured scope.

Edge cases:

- `listArtifacts` returns an empty array if the directory does not exist.
- `writeArtifactsManifest` invokes `listArtifacts` if no artifact list is provided.

## License

MIT © KazViz
