import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  loadPackletConfig,
  readPackletEnv,
  resolveBuildOptions,
  resolveGprOptions,
  resolveListArtifactsOptions,
  resolveValidateOptions
} from "@packlet/core"

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "packlet-config-test-"))
})

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {}
})

function writePkg(root: string, packlet: unknown) {
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "x", version: "0.0.0", packlet }, null, 2),
    "utf8"
  )
}

test("build resolver precedence: CLI > env > config > defaults", () => {
  writePkg(tmpDir, {
    build: {
      entry: "src/a.ts",
      outdir: "lib",
      formats: ["esm"],
      sourcemap: "none",
      types: true,
      target: "node",
      execJs: false,
      minify: true,
      external: ["react"],
      externalAuto: false
    }
  })
  const cfg = loadPackletConfig(tmpDir)
  const env = readPackletEnv({
    ...process.env,
    PACKLET_BUILD_ENTRY: "src/env.ts",
    PACKLET_BUILD_OUTDIR: "envdist",
    PACKLET_BUILD_FORMATS: "cjs",
    PACKLET_SOURCEMAP: "external",
    PACKLET_TYPES: "false",
    PACKLET_TARGET: "bun",
    PACKLET_EXEC_JS: "true",
    PACKLET_MINIFY: "false",
    PACKLET_EXTERNAL: "vue",
    PACKLET_EXTERNAL_AUTO: "false"
  } as NodeJS.ProcessEnv)
  const cli = {
    entry: "src/cli.ts",
    outdir: "out",
    formats: "esm,cjs",
    sourcemap: "inline",
    types: true,
    target: "node",
    execJs: true,
    minify: true,
    external: "lodash",
    externalAuto: false
  }
  const resolved = resolveBuildOptions({ cli, env, cfg })
  expect(resolved.entry).toBe("src/cli.ts")
  expect(resolved.outdir).toBe("out")
  expect(resolved.formats).toEqual(["esm", "cjs"]) // from CLI
  expect(resolved.sourcemap).toBe("inline") // CLI wins; downstream coerces to external
  expect(resolved.types).toBe(true)
  expect(resolved.target).toBe("node")
  expect(resolved.execJs).toBe(true)
  expect(resolved.minify).toBe(true)
  expect(resolved.external).toEqual(["lodash"]) // CLI list wins
})

test("gpr resolver precedence: CLI > env > config", () => {
  writePkg(tmpDir, {
    gprName: "cfg-name",
    scope: "cfg-scope",
    registry: "https://example.invalid/",
    includeReadme: true,
    includeLicense: false,
    distDir: "cfgdist",
    artifactsDir: ".cfgart",
    gprDir: ".cfggpr"
  })
  const cfg = loadPackletConfig(tmpDir)
  const env = readPackletEnv({
    ...process.env,
    GPR_NAME: "env-name",
    GPR_SCOPE: "env-scope",
    GPR_REGISTRY: "https://env.invalid/",
    GPR_INCLUDE_README: "false",
    GPR_INCLUDE_LICENSE: "true",
    PACKLET_DIST_DIR: "envdist",
    PACKLET_ARTIFACTS_DIR: ".envart",
    PACKLET_GPR_DIR: ".envgpr"
  } as NodeJS.ProcessEnv)
  const cli = {
    root: tmpDir,
    name: "cli-name",
    scope: "cli-scope",
    registry: "https://cli.invalid/",
    includeReadme: true,
    includeLicense: true,
    dist: "clidist",
    artifacts: ".cliart",
    gprDir: ".cligpr"
  }
  const r = resolveGprOptions({ cli, env, cfg })
  expect(r.nameOverride).toBe("cli-name")
  expect(r.scope).toBe("cli-scope")
  expect(r.registry).toBe("https://cli.invalid/")
  expect(r.includeReadme).toBe(true)
  expect(r.includeLicense).toBe(true)
  expect(r.distDir).toBe("clidist")
  expect(r.artifactsDir).toBe(".cliart")
  expect(r.gprDir).toBe(".cligpr")
})

test("validate/list resolvers use config defaults when CLI not provided", () => {
  writePkg(tmpDir, {
    distDir: "distcfg",
    validate: { dist: "valcfg" },
    artifactsDir: ".artcfg",
    listArtifacts: { artifactsDir: ".artlistcfg" }
  })
  const cfg = loadPackletConfig(tmpDir)
  const env = readPackletEnv()
  const rv = resolveValidateOptions({ cli: { root: tmpDir }, env, cfg })
  expect(rv.dist).toBe(path.resolve(tmpDir, "valcfg"))
  const rl = resolveListArtifactsOptions({ cli: {}, env, cfg })
  expect(path.basename(rl.artifacts)).toBe(".artlistcfg")
})
