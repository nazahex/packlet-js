/**
 * Tests for the `prepare` CLI subcommand.
 *
 * This suite verifies the CLI's behaviour when invoked with `packlet prepare`:
 * - Skips when `packlet.gpr` flag is missing in package.json.
 * - Skips when `dist` is missing.
 * - Prepares a staged `.gpr` package when flag and `dist` are present.
 * - Honors a valid `packlet.gprName` override and ignores invalid overrides.
 *
 * The tests create temporary fixture directories and capture console output
 * to assert expected informational or warning messages.
 */
import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import { runCli } from "../src/index"

const createdTempRoots: string[] = []

function makeTempFixture(name: string): string {
  const baseTemp = path.join(process.cwd(), ".temp")
  // ensure test temp root exists so mkdtempSync can create a unique dir inside it
  fs.mkdirSync(baseTemp, { recursive: true })
  const root = fs.mkdtempSync(path.join(baseTemp, `tmp-gpr-${name}-`))
  // remember for cleanup
  createdTempRoots.push(root)
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: `fixture-${name}`, version: "1.2.3" }, null, 2)
  )
  return root
}

async function runPrepare(root: string): Promise<string> {
  let output = ""
  const origLog = console.log
  const origWarn = console.warn
  const origError = console.error
  console.log = (...args: unknown[]) => {
    output += `${args.join(" ")}\n`
    origLog(...args)
  }
  console.warn = (...args: unknown[]) => {
    output += `${args.join(" ")}\n`
    origWarn(...args)
  }
  console.error = (...args: unknown[]) => {
    output += `${args.join(" ")}\n`
    origError(...args)
  }
  try {
    await runCli(["node", "packlet", "prepare", "--root", root])
  } finally {
    console.log = origLog
    console.warn = origWarn
    console.error = origError
  }
  return output
}

describe("gpr prepare subcommand", () => {
  beforeAll(() => {
    // speed up CLI tests by skipping npm pack operations
    process.env.GPR_SKIP_PACK = "true"
  })
  /**
   * CLI behavior: when `packlet.gpr` flag is not set in package.json the
   * command should skip staging.
   *
   * @expectation The CLI prints a skip message and does not create `.gpr`.
   */
  it("skips when packlet.gpr flag missing", async () => {
    const dir = makeTempFixture("skip-flag")
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true })
    fs.writeFileSync(path.join(dir, "dist", "index.js"), "module.exports = {}")
    const out = await runPrepare(dir)
    // Expect skip message indicating missing packlet.gpr flag
    expect(out).toMatch(/skip: packlet\.gpr flag not enabled/)
    // No staging directory should have been created
    expect(fs.existsSync(path.join(dir, ".gpr"))).toBe(false)
  })

  /**
   * CLI behavior: when `dist` is missing the command should skip.
   *
   * @expectation CLI reports `skip: no dist` and does not create `.gpr`.
   */
  it("skips when dist missing", async () => {
    const dir = makeTempFixture("skip-dist")
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        { name: "fixture-skip-dist", version: "1.2.3", packlet: { gpr: true } },
        null,
        2
      )
    )
    const out = await runPrepare(dir)
    // CLI should explicitly note that dist is missing
    expect(out).toMatch(/skip: no dist/)
    // No staging should occur
    expect(fs.existsSync(path.join(dir, ".gpr"))).toBe(false)
  })

  /**
   * Positive path: when `packlet.gpr` is true and `dist` exists, the CLI
   * should stage a `.gpr` package and report success.
   */
  it("prepares when flag and dist present", async () => {
    const dir = makeTempFixture("prepare-ok")
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        { name: "fixture-ok", version: "1.2.3", packlet: { gpr: true } },
        null,
        2
      )
    )
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true })
    fs.writeFileSync(path.join(dir, "dist", "index.js"), "export {}")
    const out = await runPrepare(dir)
    // CLI should indicate a prepared GPR package
    expect(out).toMatch(/Prepared GPR package/)
    // Staged package.json must exist in .gpr
    expect(fs.existsSync(path.join(dir, ".gpr", "package.json"))).toBe(true)
  })

  /**
   * Configuration override: valid `packlet.gprName` should be applied
   * verbatim to the staged package.json.
   */
  it("applies valid gprName override from packlet.gprName", async () => {
    const dir = makeTempFixture("gprName-valid")
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: "fixture-valid",
          version: "1.2.3",
          packlet: { gpr: true, gprName: "@scope/valid-name" }
        },
        null,
        2
      )
    )
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true })
    fs.writeFileSync(path.join(dir, "dist", "index.js"), "export {}")
    await runPrepare(dir)
    const staged = JSON.parse(
      fs.readFileSync(path.join(dir, ".gpr", "package.json"), "utf8")
    )
    // The staged package name should equal the valid override provided
    expect(staged.name).toBe("@scope/valid-name")
  })

  /**
   * Invalid override handling: invalid `packlet.gprName` should be ignored
   * and derivation should be used instead.
   */
  it("ignores invalid gprName override and falls back to derived", async () => {
    const dir = makeTempFixture("gprName-invalid")
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify(
        {
          name: "fixture-invalid",
          version: "1.2.3",
          packlet: { gpr: true, gprName: "not scoped" }
        },
        null,
        2
      )
    )
    fs.mkdirSync(path.join(dir, "dist"), { recursive: true })
    fs.writeFileSync(path.join(dir, "dist", "index.js"), "export {}")
    const out = await runPrepare(dir)
    // CLI should warn about invalid override and continue using derived name
    expect(out).toMatch(/invalid gprName/)
    const staged = JSON.parse(
      fs.readFileSync(path.join(dir, ".gpr", "package.json"), "utf8")
    )
    // Default scope (nazahex) should be applied when override is invalid
    expect(staged.name).toBe("@nazahex/fixture-invalid")
  })
})

// Cleanup any temporary fixtures we created during the tests.
// Be defensive: only remove directories we created (matching tmp-gpr-*) and
// attempt to remove their parent `temp` directory if it is empty.
afterAll(() => {
  for (const root of createdTempRoots) {
    try {
      if (root?.includes("tmp-gpr-")) {
        fs.rmSync(root, { recursive: true, force: true })
      }
      const parent = path.dirname(root)
      if (path.basename(parent) === ".temp") {
        // attempt to remove parent if empty
        try {
          const entries = fs.readdirSync(parent)
          if (entries.length === 0) fs.rmdirSync(parent)
        } catch {
          // ignore
        }
      }
    } catch {
      // best-effort cleanup only
    }
  }
})
