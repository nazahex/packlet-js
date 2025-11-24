import fs from "node:fs"
import path from "node:path"

export type SourcemapKind = "inline" | "external" | "none"
export type ModuleFormat = "esm" | "cjs"

export type PackletConfigV1 = {
  configVersion?: 1
  distDir?: string
  artifactsDir?: string
  gprDir?: string
  build?: {
    entry?: string
    outdir?: string
    formats?: ModuleFormat[] | string[]
    sourcemap?: SourcemapKind
    types?: boolean
    target?: string
    execJs?: boolean
    minify?: boolean
    external?: string[]
    externalAuto?: boolean
  }
  gpr?: boolean
  gprName?: string
  scope?: string
  registry?: string
  includeReadme?: boolean
  includeLicense?: boolean
  validate?: { dist?: string }
  listArtifacts?: { artifactsDir?: string }
}

export function loadPackletConfig(rootDir: string): PackletConfigV1 {
  try {
    const pkgPath = path.join(rootDir, "package.json")
    const raw = fs.readFileSync(pkgPath, "utf8")
    const pkg = JSON.parse(raw) as { packlet?: PackletConfigV1 }
    return pkg.packlet ?? {}
  } catch {
    return {}
  }
}

function toBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === "boolean") return v
  const s = String(v).trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(s)) return true
  if (["0", "false", "no", "off"].includes(s)) return false
  return undefined
}

function toList(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  const s = String(v)
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
}

export type PackletEnv = {
  DIST_DIR?: string
  ARTIFACTS_DIR?: string
  GPR_DIR?: string
  BUILD_ENTRY?: string
  BUILD_OUTDIR?: string
  BUILD_FORMATS?: string
  SOURCEMAP?: SourcemapKind | string
  TYPES?: boolean
  TARGET?: string
  EXEC_JS?: boolean
  MINIFY?: boolean
  EXTERNAL?: string[]
  EXTERNAL_AUTO?: boolean
  GPR_NAME?: string
  GPR_SCOPE?: string
  GPR_REGISTRY?: string
  GPR_INCLUDE_README?: boolean
  GPR_INCLUDE_LICENSE?: boolean
}

export function readPackletEnv(env = process.env): PackletEnv {
  return {
    DIST_DIR: env.PACKLET_DIST_DIR,
    ARTIFACTS_DIR: env.PACKLET_ARTIFACTS_DIR,
    GPR_DIR: env.PACKLET_GPR_DIR,
    BUILD_ENTRY: env.PACKLET_BUILD_ENTRY,
    BUILD_OUTDIR: env.PACKLET_BUILD_OUTDIR,
    BUILD_FORMATS: env.PACKLET_BUILD_FORMATS,
    SOURCEMAP:
      (env.PACKLET_SOURCEMAP as SourcemapKind | undefined) ?? undefined,
    TYPES: toBool(env.PACKLET_TYPES),
    TARGET: env.PACKLET_TARGET,
    EXEC_JS: toBool(env.PACKLET_EXEC_JS),
    MINIFY: toBool(env.PACKLET_MINIFY),
    EXTERNAL: toList(env.PACKLET_EXTERNAL),
    EXTERNAL_AUTO: toBool(env.PACKLET_EXTERNAL_AUTO),
    GPR_NAME: env.GPR_NAME,
    GPR_SCOPE: env.GPR_SCOPE,
    GPR_REGISTRY: env.GPR_REGISTRY,
    GPR_INCLUDE_README: toBool(env.GPR_INCLUDE_README),
    GPR_INCLUDE_LICENSE: toBool(env.GPR_INCLUDE_LICENSE)
  }
}

export type ResolvedBuildOptions = {
  entry: string
  outdir: string
  formats: ModuleFormat[]
  sourcemap: SourcemapKind
  types: boolean
  target: string
  execJs: boolean
  minify: boolean
  external?: string[] | "auto"
}

type ResolveCtx = {
  cli?: Record<string, unknown>
  env?: PackletEnv
  cfg?: PackletConfigV1
  defaults?: Partial<ResolvedBuildOptions>
}

function coerceFormats(value: unknown): ModuleFormat[] | undefined {
  if (!value) return undefined
  if (Array.isArray(value))
    return value
      .map((s) => String(s).trim())
      .filter(Boolean)
      .map((s) => (s === "cjs" ? "cjs" : "esm"))
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s === "cjs" ? "cjs" : "esm"))
}

export function resolveBuildOptions({
  cli = {},
  env = readPackletEnv(),
  cfg = {},
  defaults = {}
}: ResolveCtx): ResolvedBuildOptions {
  const cfgBuild = cfg.build ?? {}
  const cliFormats = coerceFormats(
    (cli.formats ?? cli.cjs) ? "esm,cjs" : undefined
  )
  const envFormats = coerceFormats(env.BUILD_FORMATS)
  const formats = cliFormats ??
    envFormats ??
    (Array.isArray(cfgBuild.formats)
      ? (cfgBuild.formats as ModuleFormat[])
      : coerceFormats(cfgBuild.formats)) ??
    defaults.formats ?? ["esm"]

  const sourcemap = ((): SourcemapKind => {
    const val =
      (cli.sourcemap as SourcemapKind | undefined) ??
      (env.SOURCEMAP as SourcemapKind | undefined) ??
      (cfgBuild.sourcemap as SourcemapKind | undefined) ??
      defaults.sourcemap ??
      "none"
    return val === "inline"
      ? "inline"
      : val === "external"
        ? "external"
        : "none"
  })()

  const types = ((): boolean => {
    const v =
      (cli.types as boolean | undefined) ??
      env.TYPES ??
      cfgBuild.types ??
      defaults.types ??
      true
    return v !== false
  })()

  const external = ((): ResolvedBuildOptions["external"] => {
    if (cli.externalAuto === true) return "auto"
    const cliList = toList(cli.external)
    if (cliList?.length) return cliList
    if (env.EXTERNAL_AUTO) return "auto"
    if (env.EXTERNAL?.length) return env.EXTERNAL
    if (cfgBuild.externalAuto) return "auto"
    if (cfgBuild.external?.length) return cfgBuild.external
    return defaults.external
  })()

  return {
    entry:
      (cli.entry as string) ??
      env.BUILD_ENTRY ??
      cfgBuild.entry ??
      defaults.entry ??
      "src/index.ts",
    outdir:
      (cli.outdir as string) ??
      env.BUILD_OUTDIR ??
      cfgBuild.outdir ??
      cfg.distDir ??
      defaults.outdir ??
      "dist",
    formats,
    sourcemap,
    types,
    target:
      (cli.target as string) ??
      env.TARGET ??
      cfgBuild.target ??
      defaults.target ??
      "node",
    execJs: Boolean(
      (cli.execJs as boolean | undefined) ??
        env.EXEC_JS ??
        cfgBuild.execJs ??
        defaults.execJs ??
        false
    ),
    minify: ((): boolean => {
      const v =
        (cli.minify as boolean | undefined) ??
        env.MINIFY ??
        cfgBuild.minify ??
        defaults.minify ??
        true
      return v !== false
    })(),
    external
  }
}

export type ResolvedGprOptions = {
  rootDir: string
  distDir?: string
  artifactsDir?: string
  gprDir?: string
  scope?: string
  registry?: string
  nameOverride?: string
  includeReadme?: boolean
  includeLicense?: boolean
}

export function resolveGprOptions({
  cli = {},
  env = readPackletEnv(),
  cfg = {},
  defaults = {} as Partial<ResolvedGprOptions>
}: {
  cli?: Record<string, unknown>
  env?: PackletEnv
  cfg?: PackletConfigV1
  defaults?: Partial<ResolvedGprOptions>
}): ResolvedGprOptions {
  const rootDir = path.resolve((cli.root as string) || process.cwd())
  return {
    rootDir,
    distDir:
      (cli.dist as string) ?? env.DIST_DIR ?? cfg.distDir ?? defaults.distDir,
    artifactsDir:
      (cli.artifacts as string) ??
      env.ARTIFACTS_DIR ??
      cfg.artifactsDir ??
      defaults.artifactsDir,
    gprDir:
      (cli.gprDir as string) ??
      (cli["gpr-dir"] as string) ??
      env.GPR_DIR ??
      cfg.gprDir ??
      defaults.gprDir,
    scope:
      (cli.scope as string) ?? env.GPR_SCOPE ?? cfg.scope ?? defaults.scope,
    registry:
      (cli.registry as string) ??
      env.GPR_REGISTRY ??
      cfg.registry ??
      defaults.registry,
    nameOverride:
      (cli.name as string) ??
      env.GPR_NAME ??
      cfg.gprName ??
      defaults.nameOverride,
    includeReadme:
      (cli.includeReadme as boolean | undefined) ??
      env.GPR_INCLUDE_README ??
      cfg.includeReadme ??
      defaults.includeReadme,
    includeLicense:
      (cli.includeLicense as boolean | undefined) ??
      env.GPR_INCLUDE_LICENSE ??
      cfg.includeLicense ??
      defaults.includeLicense
  }
}

export type ResolvedValidateOptions = { dist: string }
export function resolveValidateOptions({
  cli = {},
  env = readPackletEnv(),
  cfg = {},
  defaults = {} as Partial<ResolvedValidateOptions>
}: {
  cli?: Record<string, unknown>
  env?: PackletEnv
  cfg?: PackletConfigV1
  defaults?: Partial<ResolvedValidateOptions>
}): ResolvedValidateOptions {
  const root = path.resolve((cli.root as string) || process.cwd())
  const distRel =
    (cli.dist as string) ??
    cfg.validate?.dist ??
    env.DIST_DIR ??
    cfg.distDir ??
    defaults.dist ??
    "dist"
  return { dist: path.resolve(root, distRel) }
}

export type ResolvedArtifactsOptions = { artifacts: string }
export function resolveListArtifactsOptions({
  cli = {},
  env = readPackletEnv(),
  cfg = {},
  defaults = {} as Partial<ResolvedArtifactsOptions>
}: {
  cli?: Record<string, unknown>
  env?: PackletEnv
  cfg?: PackletConfigV1
  defaults?: Partial<ResolvedArtifactsOptions>
}): ResolvedArtifactsOptions {
  const cwd = process.cwd()
  const artifactsRel =
    (cli.artifacts as string) ??
    cfg.listArtifacts?.artifactsDir ??
    env.ARTIFACTS_DIR ??
    cfg.artifactsDir ??
    defaults.artifacts ??
    ".artifacts"
  return { artifacts: path.resolve(cwd, artifactsRel) }
}
