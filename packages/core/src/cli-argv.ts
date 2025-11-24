/**
 * Normalize a raw argv array (possibly full process.argv) into just the
 * command arguments expected by clibu (strip node + script if present).
 */
export function normalizeArgv(argv: readonly string[]): string[] {
  if (argv.length >= 2 && argv[0] && argv[1]) {
    const maybeNode = /node/i.test(argv[0])
    const maybeScript = /\.(mjs|cjs|js|ts)$/.test(argv[1])
    if (maybeNode || maybeScript) return Array.prototype.slice.call(argv, 2)
  }
  return Array.prototype.slice.call(argv)
}

/**
 * Adapt space-separated string options ("--root .") into equals form
 * ("--root=.") required for clibu's parsing of string options. Only
 * converts recognized string option names; leaves flags untouched.
 */
export function adaptSpaceSeparatedOptions(
  args: readonly string[],
  stringOptionNames: readonly string[]
): string[] {
  const set = new Set(stringOptionNames)
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith("--") && !a.includes("=") && set.has(a.slice(2))) {
      const next = args[i + 1]
      if (next && !next.startsWith("-")) {
        out.push(`${a}=${next}`)
        i++
        continue
      }
    }
    out.push(a)
  }
  return out
}
