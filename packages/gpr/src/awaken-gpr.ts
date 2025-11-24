import * as child from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import {
  copyRecursive,
  deriveScopedName,
  writeArtifactsManifest
} from "@packlet/core"
import { ensureGprName } from "./name-utils"

/**
 * Options for awakenGpr. All paths are resolved relative to process.cwd() by default.
 */
export interface AwakenGprOptions {
  /** Root directory of the package to prepare. Defaults to process.cwd(). */
  rootDir?: string
  /** Directory where a scoped GPR package will be staged. Defaults to .gpr under root. */
  gprDir?: string
  /** Directory where tarballs will be placed. Defaults to .artifacts under root. */
  artifactsDir?: string
  /** Directory containing build outputs to publish. Defaults to dist under root. */
  distDir?: string
  /** GitHub Packages scope, e.g. "nazahex". Can be overridden by env GPR_SCOPE. */
  scope?: string
  /** GPR registry URL. Can be overridden by env GPR_REGISTRY. */
  registry?: string
  /** Include README.md if present. Can be toggled by env GPR_INCLUDE_README. */
  includeReadme?: boolean
  /** Include LICENSE if present. Can be toggled by env GPR_INCLUDE_LICENSE. */
  includeLicense?: boolean
  /** Name override for the scoped package. Can be provided via env GPR_NAME. */
  nameOverride?: string
}

/** Result of awakenGpr operation. */
export interface AwakenGprResult {
  /** Path to the staged GPR directory (contains package.json and dist). */
  gprDir: string
  /** Path to the artifacts directory where tarballs were placed. */
  artifactsDir: string
  /** The resolved scoped package name (e.g., @scope/name). */
  scopedName: string
  /** Version string from the root package.json. */
  version: string
}

// file copy handled by @packlet/core.copyRecursive

/**
 * Prepare a GitHub Packages (GPR) scoped variant of the current package.
 *
 * Contract:
 * - Reads root package.json to derive metadata.
 * - Stages a scoped package under gprDir with adjusted name and exports.
 * - Copies dist/ into the staged package and optionally README/LICENSE.
 * - Runs `npm pack` for root and staged package to produce tarballs in
 *   `artifactsDir`.
 *
 * The function performs synchronous filesystem operations and will throw an
 * Error on fatal conditions (for example when `dist` does not exist). Some
 * non-fatal failures (such as `npm pack` failing) are swallowed to make the
 * operation robust in CI environments.
 *
 * @param opts - Configuration options for the operation (paths, scope,
 *               registry and include flags).
 * @returns An object describing the prepared GPR artifact locations and
 *          resolved package name/version.
 * @throws When required files (e.g. `dist/`) are missing or other fatal
 *         filesystem errors occur.
 *
 * @example
 * const res = awakenGpr({ rootDir: process.cwd(), scope: 'acme' })
 */
export function awakenGpr(opts: AwakenGprOptions = {}): AwakenGprResult {
  const root = path.resolve(opts.rootDir ?? process.cwd())
  const gprDir = path.resolve(opts.gprDir ?? path.join(root, ".gpr"))
  const artifactsDir = path.resolve(
    opts.artifactsDir ?? path.join(root, ".artifacts")
  )
  const distDir = path.resolve(opts.distDir ?? path.join(root, "dist"))

  // Ensure dist exists
  if (!fs.existsSync(distDir)) {
    throw new Error("dist/ not found. Run build before preparing GPR package.")
  }

  // Clean and recreate .gpr and .artifacts
  fs.rmSync(gprDir, { recursive: true, force: true })
  fs.mkdirSync(gprDir, { recursive: true })
  fs.rmSync(artifactsDir, { recursive: true, force: true })
  fs.mkdirSync(artifactsDir, { recursive: true })

  // Read root package.json
  const rootPkgPath = path.join(root, "package.json")
  type RepoField =
    | string
    | {
        type?: string
        url?: string
        directory?: string
      }
    | undefined
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8")) as {
    name: string
    version: string
    description?: string
    license?: string
    homepage?: string
    repository?: RepoField
    author?: { name?: string; email?: string; url?: string } | string
    keywords?: string[]
    sideEffects?: boolean
    bin?: string | Record<string, string>
    engines?: Record<string, string>
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    packlet?: { gpr?: boolean; gprName?: string }
  }

  // Env-based configuration for reusability
  const SCOPE = process.env.GPR_SCOPE || opts.scope || "nazahex"
  const REGISTRY =
    process.env.GPR_REGISTRY || opts.registry || "https://npm.pkg.github.com/"
  const INCLUDE_README =
    (process.env.GPR_INCLUDE_README ?? String(opts.includeReadme ?? true)) ===
    "true"
  const INCLUDE_LICENSE =
    (process.env.GPR_INCLUDE_LICENSE ?? String(opts.includeLicense ?? true)) ===
    "true"
  // Validate optional override: allow scoped (@scope/name) or unscoped (name) without spaces
  const overrideRaw =
    process.env.GPR_NAME || opts.nameOverride || rootPkg.packlet?.gprName
  const NAME_OVERRIDE = ensureGprName(overrideRaw)

  // In CI on Windows, spawning `npm pack` is slow and flaky. Allow opt-out via env
  // and auto-disable in Windows CI to keep tests fast and deterministic.
  const IS_WINDOWS = process.platform === "win32" || path.sep === "\\"
  const IN_CI = process.env.CI === "true"
  const SKIP_PACK =
    process.env.GPR_SKIP_PACK === "true" || (IS_WINDOWS && IN_CI)

  // Create scoped package.json for GitHub Packages via shared derivation logic
  // In a monorepo, prefer the package's own name over the repo name when deriving
  // the GPR base name. Using the repo URL would make every package share the same
  // base (e.g., "packlet-js"), causing registry conflicts. Detect monorepo by
  // repository.directory or by path pattern packages/*.
  const isMonorepoPackage = (() => {
    const repo = rootPkg.repository
    if (repo && typeof repo !== "string" && repo.directory) return true
    // Fallback: if parent folder is named "packages", treat as monorepo
    return path.basename(path.dirname(root)) === "packages"
  })()

  const repoUrlRaw: string | undefined = (() => {
    if (isMonorepoPackage) return undefined
    const repo = rootPkg.repository
    if (!repo) return undefined
    if (typeof repo === "string") return repo
    return repo.url ?? undefined
  })()

  const { baseName, scopedName } = deriveScopedName({
    name: rootPkg.name,
    repoUrl: repoUrlRaw,
    override: NAME_OVERRIDE,
    scope: SCOPE
  })

  // Build a map of internal monorepo packages (name -> { version, gprName }) when running inside
  // a conventional packages/* workspace. This helps normalize workspace:* version ranges to concrete
  // versions for internal deps. We DO NOT rename dependency package names; they remain as original npm names.
  const internalMap: Record<
    string,
    { version: string; gprName: string; gprEnabled: boolean }
  > = {}
  const maybePackagesDir =
    path.basename(path.dirname(root)) === "packages"
      ? path.dirname(root)
      : undefined
  if (maybePackagesDir && fs.existsSync(maybePackagesDir)) {
    for (const entry of fs.readdirSync(maybePackagesDir)) {
      const pkgDir = path.join(maybePackagesDir, entry)
      const pkgJsonPath = path.join(pkgDir, "package.json")
      try {
        if (fs.existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")) as {
            name?: string
            version?: string
            packlet?: { gpr?: boolean; gprName?: string }
          }
          if (pkgJson.name && pkgJson.version) {
            const ovr = pkgJson.packlet?.gprName
            const validOverride = ensureGprName(ovr)
            const scoped = deriveScopedName({
              name: pkgJson.name,
              override: validOverride,
              scope: SCOPE
            }).scopedName
            internalMap[pkgJson.name] = {
              version: pkgJson.version,
              gprName: scoped,
              gprEnabled: Boolean(pkgJson.packlet?.gpr)
            }
          }
        }
      } catch {
        // ignore malformed packages
      }
    }
  }

  // Helper to normalize workspace:* ranges to concrete semver compatible ranges.
  function normalizeWorkspaceRange(
    depName: string,
    raw: string
  ): { name: string; range: string } {
    const info = internalMap[depName]
    // Map workspace protocol to actual version range
    const toRange = (def: string) => `^${def}`
    let range = raw
    if (raw.startsWith("workspace:")) {
      const spec = raw.slice("workspace:".length)
      if (info) {
        // Treat workspace:* / ^ / ~ the same and pin to ^internalVersion
        range = toRange(info.version)
      } else if (spec.startsWith("link:")) {
        // best-effort: link: is local-only; fall back to "*"
        range = "*"
      } else if (spec === "*" || spec === "^" || spec === "~") {
        range = "*"
      } else if (spec) {
        // explicit semver under workspace: — use it sans prefix
        range = spec
      } else {
        range = "*"
      }
    }
    // Keep dependency name unchanged; only adjust range
    return { name: depName, range }
  }

  function rewriteDeps(
    input?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!input) return undefined
    const out: Record<string, string> = {}
    for (const [dep, ver] of Object.entries(input)) {
      const { name, range } = normalizeWorkspaceRange(dep, ver)
      out[name] = range
    }
    return Object.keys(out).length ? out : undefined
  }
  const gprPkg = {
    name: scopedName,
    version: rootPkg.version,
    description: rootPkg.description,
    license: rootPkg.license,
    homepage: rootPkg.homepage,
    repository: rootPkg.repository,
    author: rootPkg.author,
    keywords: rootPkg.keywords,
    sideEffects: rootPkg.sideEffects,
    bin: rootPkg.bin,
    engines: rootPkg.engines,
    dependencies: rewriteDeps(rootPkg.dependencies),
    peerDependencies: rewriteDeps(rootPkg.peerDependencies),
    optionalDependencies: rewriteDeps(rootPkg.optionalDependencies),
    files: ["dist"],
    main: "./dist/index.js",
    module: "./dist/index.mjs",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        types: "./dist/index.d.ts",
        require: "./dist/index.js",
        import: "./dist/index.mjs",
        default: "./dist/index.mjs"
      }
    },
    publishConfig: {
      registry: REGISTRY,
      access: "public"
    }
  }

  fs.writeFileSync(
    path.join(gprDir, "package.json"),
    JSON.stringify(gprPkg, null, 2)
  )

  // Copy dist into .gpr/dist
  const targetDist = path.join(gprDir, "dist")
  fs.mkdirSync(targetDist, { recursive: true })
  copyRecursive(distDir, targetDist)

  // Optionally include README and LICENSE
  if (INCLUDE_README) {
    const p = path.join(root, "README.md")
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(gprDir, "README.md"))
  }
  if (INCLUDE_LICENSE) {
    const p = path.join(root, "LICENSE")
    if (fs.existsSync(p)) fs.copyFileSync(p, path.join(gprDir, "LICENSE"))
  }

  // Create npm pack tarballs for GitHub Release assets
  const version = rootPkg.version
  // pack root (npmjs package) - allow skipping during tests to speed up
  if (!SKIP_PACK) {
    try {
      const out = child
        .execSync("npm pack", {
          cwd: root,
          stdio: ["ignore", "pipe", "inherit"]
        })
        .toString()
        .trim()
        .split("\n")
        .pop()
      const packFile = out?.length ? out : `${rootPkg.name}-${version}.tgz`
      const src = path.join(root, packFile)
      const dst = path.join(artifactsDir, packFile)
      if (fs.existsSync(src)) fs.renameSync(src, dst)
    } catch {
      // non-fatal
    }
  }

  // pack GPR (scoped package) - allow skipping during tests to speed up
  if (!SKIP_PACK) {
    try {
      const out = child
        .execSync("npm pack", {
          cwd: gprDir,
          stdio: ["ignore", "pipe", "inherit"]
        })
        .toString()
        .trim()
        .split("\n")
        .pop()
      const scopeName = scopedName.replace(/^@/, "").replace("/", "-")
      const fallback = `${scopeName}-${version}.tgz`
      const packFile = out?.length ? out : fallback
      const src = path.join(gprDir, packFile)
      const dst = path.join(artifactsDir, packFile)
      if (fs.existsSync(src)) fs.renameSync(src, dst)
    } catch {
      // non-fatal
    }
  }

  // Write artifacts manifest for downstream orchestration (sailet)
  writeArtifactsManifest(artifactsDir, {
    packageName: baseName,
    scopedName,
    version
  })

  return { gprDir, artifactsDir, scopedName, version }
}
