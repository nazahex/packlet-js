#!/usr/bin/env node
import path from "node:path"
import { pathToFileURL } from "node:url"
import { type BuildOptions, build as buildPacklet } from "@packlet/build"
import {
  adaptSpaceSeparatedOptions,
  listArtifacts,
  loadPackletConfig,
  normalizeArgv,
  readPackletEnv,
  resolveBuildOptions,
  resolveGprOptions,
  resolveListArtifactsOptions,
  resolveValidateOptions,
  validateDist,
  writeArtifactsManifest
} from "@packlet/core"
import { awakenGpr } from "@packlet/gpr"
import {
  loadConfig as clibuLoadConfig,
  run as clibuRun,
  createCLI,
  defineConfig,
  flag,
  string
} from "clibu"

function outputJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data)}\n`)
}

/**
 * Execute the `packlet` command-line interface using `clibu`.
 */
export async function runCli(argv: readonly string[] = process.argv) {
  const rawArgs = normalizeArgv(argv)
  const stringOpts = [
    "entry",
    "outdir",
    "formats",
    "sourcemap",
    "target",
    "external",
    "manifest",
    "root",
    "dist",
    "artifacts",
    "gprDir",
    "scope",
    "registry",
    "name"
  ]
  const args = adaptSpaceSeparatedOptions(rawArgs.map(String), stringOpts)

  const cwd = process.cwd()
  const loaded = await clibuLoadConfig(cwd)
  if (loaded) {
    const code = await clibuRun(cwd, args)
    if (typeof code === "number") process.exitCode = code
    return
  }

  // Fallback inline config when no clibu config file present.
  const cfg = defineConfig({
    name: "packlet",
    version: "0.1.0",
    options: {
      // Global options example: we could add verbose later
    },
    commands: {
      build: {
        description:
          "Build ESM (default) and emit types for current package; add CJS via --cjs",
        options: {
          entry: string({
            description: "Entry file (default: src/index.ts)"
          }),
          outdir: string({ description: "Output directory (default: dist)" }),
          formats: string({
            description: "Comma-separated: esm,cjs (default: esm)"
          }),
          sourcemap: string({
            description:
              "external | none (default: none). 'inline' is coerced to external."
          }),
          types: flag({
            description: "Emit .d.ts (use --no-types to disable)"
          }),
          target: string({ description: "Build target (default: node)" }),
          execJs: flag({
            description:
              "chmod +x built entry (prefers dist/index.mjs; falls back to dist/index.cjs)"
          }),
          cjs: flag({ description: "Also emit CommonJS output" }),
          external: string({
            description:
              "Comma-separated package names to externalize (e.g., react,react-dom)"
          }),
          externalAuto: flag({
            description:
              "Externalize all dependencies and peerDependencies as listed in package.json"
          }),
          minify: flag({
            description: "Minify output (use --no-minify to disable)"
          })
        },
        async run(ctx) {
          const cwd = process.cwd()
          const packletCfg = loadPackletConfig(cwd)
          const env = readPackletEnv()
          try {
            const buildCli = ctx.options as {
              entry?: string
              outdir?: string
              formats?: string
              sourcemap?: string
              types?: boolean
              target?: string
              execJs?: boolean
              cjs?: boolean
              external?: string
              externalAuto?: boolean
              minify?: boolean
            }
            const resolved = resolveBuildOptions({
              cli: buildCli as Record<string, unknown>,
              env,
              cfg: packletCfg
            })
            const buildOpts: BuildOptions = resolved
            await buildPacklet(buildOpts)
          } catch (err) {
            console.error(err instanceof Error ? err.message : String(err))
            process.exitCode = 1
          }
        }
      },
      gpr: {
        description: "Prepare a GitHub Packages scoped build and tarballs",
        options: {
          root: string({ description: "Root directory (default: cwd)" }),
          dist: string({
            description: "Built output directory (default: dist)"
          }),
          artifacts: string({
            description: "Directory for tarballs (default: .artifacts)"
          }),
          gprDir: string({
            description: "Directory to stage GPR package (default: .gpr)"
          }),
          scope: string({
            description:
              "GitHub Packages scope (default: env GPR_SCOPE or kazvizian)"
          }),
          registry: string({
            description:
              "Registry URL (default: env GPR_REGISTRY or https://npm.pkg.github.com/)"
          }),
          name: string({
            description: "Override base package name for the scoped package"
          }),
          includeReadme: flag({ description: "Include README.md" }),
          includeLicense: flag({ description: "Include LICENSE" }),
          json: flag({ description: "Output JSON manifest after packing" }),
          manifest: string({
            description:
              "Write artifacts manifest to file (default: artifacts.json in artifacts dir)"
          })
        },
        run(ctx) {
          const env = readPackletEnv()
          const gprOpts = ctx.options as {
            root?: string
            dist?: string
            artifacts?: string
            gprDir?: string
            scope?: string
            registry?: string
            name?: string
            includeReadme?: boolean
            includeLicense?: boolean
            json?: boolean
            manifest?: string
          }
          const cfg = loadPackletConfig(
            path.resolve(gprOpts.root || process.cwd())
          )
          const options = resolveGprOptions({
            cli: gprOpts as Record<string, unknown>,
            env,
            cfg
          })
          try {
            const res = awakenGpr(options)
            const artifactsDir = res.artifactsDir
            const manifest = writeArtifactsManifest(artifactsDir, {
              packageName:
                path.basename(res.scopedName).replace(/^@.+\//, "") ||
                res.scopedName,
              scopedName: res.scopedName,
              version: res.version
            })
            const manifestPath = gprOpts.manifest
              ? path.resolve(String(gprOpts.manifest))
              : path.join(artifactsDir, "artifacts.json")
            if (gprOpts.manifest) {
              require("node:fs").writeFileSync(
                manifestPath,
                JSON.stringify(manifest, null, 2)
              )
            }
            if (gprOpts.json) {
              outputJson(manifest)
            } else {
              console.log(`Prepared GPR package at ${res.gprDir}`)
              console.log(`Artifacts prepared at ${res.artifactsDir}`)
            }
          } catch (err) {
            console.error(err instanceof Error ? err.message : String(err))
            process.exitCode = 1
          }
        }
      },
      validate: {
        description: "Validate dist directory contains expected entry files",
        options: {
          dist: string({ description: "Dist directory (default: dist)" }),
          root: string({ description: "Root directory (default: cwd)" }),
          json: flag({ description: "Output JSON result" })
        },
        run(ctx) {
          const env = readPackletEnv()
          const vOpts = ctx.options as {
            dist?: string
            root?: string
            json?: boolean
          }
          const cfg = loadPackletConfig(
            path.resolve(vOpts.root || process.cwd())
          )
          const { dist } = resolveValidateOptions({
            cli: vOpts as Record<string, unknown>,
            env,
            cfg
          })
          const result = validateDist({ distDir: dist })
          if (vOpts.json) {
            outputJson(result)
          } else if (result.ok) {
            console.log("dist validation: OK")
          } else {
            console.error("Missing files:", result.missing.join(", "))
            process.exitCode = 1
          }
        }
      },
      "list-artifacts": {
        description: "List tarball artifacts in a directory",
        options: {
          artifacts: string({
            description: "Artifacts directory (default: .artifacts)"
          }),
          json: flag({ description: "Output JSON list" })
        },
        run(ctx) {
          const env = readPackletEnv()
          const laOpts = ctx.options as { artifacts?: string; json?: boolean }
          const cfg = loadPackletConfig(process.cwd())
          const { artifacts } = resolveListArtifactsOptions({
            cli: laOpts as Record<string, unknown>,
            env,
            cfg
          })
          const list = listArtifacts(artifacts)
          if (laOpts.json) outputJson(list)
          else if (!list.length) console.log("No artifacts found.")
          else
            list.forEach((a: { file: string; size: number }) => {
              console.log(`${a.file}\t${a.size} bytes`)
            })
        }
      }
    }
  })

  const cli = createCLI(cfg)
  const code = await cli.run(args)
  if (typeof code === "number") process.exitCode = code
}

// Execute when run directly (support both CJS and ESM entrypoints)
const isCjsMain =
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
const isEsmMain = (() => {
  try {
    const invoked = process.argv[1]
    if (!invoked) return false
    const invokedUrl = pathToFileURL(invoked).href
    return typeof import.meta !== "undefined" && import.meta.url === invokedUrl
  } catch {
    return false
  }
})()

if (isCjsMain || isEsmMain) void runCli(process.argv)
