#!/usr/bin/env node
import { pathToFileURL } from "node:url"
import { adaptSpaceSeparatedOptions, normalizeArgv } from "@packlet/core"
import {
  loadConfig as clibuLoadConfig,
  run as clibuRun,
  createCLI,
  defineConfig,
  flag,
  string
} from "clibu"
import { awakenGpr } from "./awaken-gpr"
import { handleGpr } from "./gpr-cli"
import { handlePrepare } from "./prepare-gpr"

/**
 * Public API surface re-exports
 */
export { awakenGpr }

/**
 * CLI entrypoint for `packlet` using `clibu`.
 */
export async function runCli(argv: readonly string[] = process.argv) {
  const rawArgs = normalizeArgv(argv)
  const stringOpts = [
    "root",
    "dist",
    "gprDir",
    "artifacts",
    "scope",
    "registry",
    "name",
    "manifest"
  ]
  const args = adaptSpaceSeparatedOptions(rawArgs, stringOpts)

  const cwd = process.cwd()
  const loaded = await clibuLoadConfig(cwd)
  if (loaded) {
    const code = await clibuRun(cwd, args)
    if (typeof code === "number") process.exitCode = code
    return
  }

  const cfg = defineConfig({
    name: "packlet",
    version: "0.1.0",
    commands: {
      prepare: {
        description:
          "Prepare GPR variant if dist exists and packlet.gpr flag is enabled; writes basic output",
        options: {
          root: string({ description: "Root directory (default: cwd)" }),
          dist: string({
            description: "Built output directory (default: dist)"
          }),
          gprDir: string({
            description: "Directory to stage GPR package (default: .gpr)"
          }),
          artifacts: string({
            description: "Directory for tarballs (default: .artifacts)"
          }),
          scope: string({
            description: "GitHub Packages scope (default env or nazahex)"
          }),
          registry: string({
            description: "Registry URL (default env or GitHub Packages)"
          }),
          name: string({
            description: "Override fully-scoped name or base name"
          }),
          json: flag({ description: "Emit JSON result" })
        },
        run(ctx) {
          const pOpts = ctx.options as {
            root?: string
            dist?: string
            artifacts?: string
            gprDir?: string
            scope?: string
            registry?: string
            name?: string
            json?: boolean
          }
          handlePrepare(pOpts as Record<string, unknown>)
        }
      },
      gpr: {
        description: "Prepare a GitHub Packages scoped build and tarballs",
        options: {
          root: string({ description: "Root directory (default: cwd)" }),
          gprDir: string({
            description: "Directory to stage GPR package (default: .gpr)"
          }),
          artifacts: string({
            description: "Directory for tarballs (default: .artifacts)"
          }),
          dist: string({
            description: "Built output directory (default: dist)"
          }),
          scope: string({
            description:
              "GitHub Packages scope (default: env GPR_SCOPE or nazahex)"
          }),
          registry: string({
            description:
              "Registry URL (default: env GPR_REGISTRY or https://npm.pkg.github.com/)"
          }),
          name: string({
            description: "Override package name for the scoped package"
          }),
          includeReadme: flag({ description: "Include README.md" }),
          includeLicense: flag({ description: "Include LICENSE" }),
          json: flag({ description: "Emit JSON manifest" }),
          manifest: string({ description: "Write manifest JSON to path" })
        },
        async run(ctx) {
          const gOpts = ctx.options as {
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
          await handleGpr(gOpts as Record<string, unknown>)
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
