import fs from "node:fs"
import path from "node:path"
import {
  loadPackletConfig,
  readPackletEnv,
  resolveGprOptions,
  resolveValidateOptions,
  writeArtifactsManifest
} from "@packlet/core"
import type { AwakenGprOptions } from "./awaken-gpr"
import { awakenGpr } from "./awaken-gpr"
import { ensureGprName } from "./name-utils"

/**
 * Handle the `prepare` CLI subcommand.
 *
 * This lighter-weight command inspects `package.json` for a `packlet.gpr`
 * flag and, if enabled and a `dist` directory exists, delegates to
 * {@link awakenGpr} to stage and pack the GPR variant. The function writes
 * an artifacts manifest and supports CLI-style options for compatibility
 * with release tooling.
 *
 * @param opts - Raw options object produced by the CLI wrapper (e.g. parsed
 *               by clibu). Recognized fields include `root`, `dist`,
 *               `gprDir`, `artifacts`, `scope`, `registry`, and `name`.
 * @returns void. On failure the function logs an error and sets
 *          `process.exitCode = 1`.
 *
 * @example
 * handlePrepare({ root: '.', dist: 'dist' })
 */
export function handlePrepare(opts: Record<string, unknown>): void {
  const rootDir = path.resolve((opts.root as string) || process.cwd())
  const env = readPackletEnv()
  const cfg = loadPackletConfig(rootDir)
  const { dist } = resolveValidateOptions({
    cli: { ...opts, root: rootDir },
    env,
    cfg
  })
  const distDir = dist

  try {
    const pkgPath = path.join(rootDir, "package.json")
    const raw = fs.readFileSync(pkgPath, "utf8")
    const pkg = JSON.parse(raw) as {
      packlet?: { gpr?: boolean; gprName?: string }
    }
    if (!pkg.packlet || pkg.packlet.gpr !== true) {
      console.log(
        `[gpr:prepare] skip: packlet.gpr flag not enabled in ${pkgPath}`
      )
      return
    }
    if (!fs.existsSync(distDir)) {
      console.log(`[gpr:prepare] skip: no dist at ${distDir}`)
      return
    }

    // Optional gprName override: allow either scoped (@scope/name) or unscoped (name)
    // Let awakenGpr/deriveScopedName apply the scope when unscoped is provided.
    let nameOverride = (opts.name as string) || pkg.packlet.gprName
    if (nameOverride && !ensureGprName(nameOverride)) {
      console.warn(
        `[gpr:prepare] invalid gprName '${nameOverride}' (expected @scope/name or unscoped base); ignoring override.`
      )
      nameOverride = undefined
    }

    const baseOptions = resolveGprOptions({
      cli: { ...opts, root: rootDir },
      env,
      cfg
    })
    const options: AwakenGprOptions = { ...baseOptions, distDir, nameOverride }

    const res = awakenGpr(options)
    // always write artifacts manifest into artifactsDir (awakenGpr already does so),
    // but support --manifest and --json flags for CLI compatibility with release tooling
    const artifactsDir = res.artifactsDir
    const manifest = writeArtifactsManifest(artifactsDir, {
      packageName:
        path.basename(res.scopedName).replace(/^@.+\//, "") || res.scopedName,
      scopedName: res.scopedName,
      version: res.version
    })

    // If caller passed a manifest path, write manifest there as well
    if (opts.manifest) {
      const manifestPath = path.resolve(String(opts.manifest))
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    }

    if ((opts.json as boolean) === true || opts.json === "true") {
      process.stdout.write(`${JSON.stringify(manifest)}\n`)
    } else {
      console.log(`Prepared GPR package at ${res.gprDir}`)
      console.log(`Artifacts prepared at ${res.artifactsDir}`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    process.exitCode = 1
  }
}

export default handlePrepare
