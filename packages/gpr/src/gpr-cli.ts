import {
  loadPackletConfig,
  readPackletEnv,
  resolveGprOptions
} from "@packlet/core"
import type { AwakenGprOptions } from "./awaken-gpr"
import { awakenGpr } from "./awaken-gpr"

/**
 * Handle the `gpr` CLI command (full feature) as a separate module for clarity.
 */
/**
 * Handle the `gpr` CLI command.
 *
 * This function adapts raw Clibu option objects into a strongly-typed
 * {@link AwakenGprOptions} and invokes {@link awakenGpr}. Any errors are
 * logged and the process exit code is set to `1` on failure.
 *
 * @param opts - Raw options object produced by the CLI wrapper (e.g. parsed
 *               by clibu). Common fields include:
 *               `root`, `gprDir`, `artifacts`, `dist`, `scope`, `registry`,
 *               `name`, `includeReadme`, `includeLicense`.
 * @returns A promise that resolves when the operation completes.
 *
 * @example
 * await handleGpr({ root: '.', dist: 'dist' })
 */
export async function handleGpr(opts: Record<string, unknown>): Promise<void> {
  const env = readPackletEnv()
  const cfg = loadPackletConfig((opts.root as string) || process.cwd())
  const options: AwakenGprOptions = resolveGprOptions({ cli: opts, env, cfg })

  try {
    const res = awakenGpr(options)
    console.log(`Prepared GPR package at ${res.gprDir}`)
    console.log(`Artifacts prepared at ${res.artifactsDir}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(message)
    process.exitCode = 1
  }
}

export default handleGpr
