import { expect, test } from "bun:test"
import { adaptSpaceSeparatedOptions, normalizeArgv } from "@packlet/core"

// normalizeArgv tests

test("normalizeArgv strips node + script", () => {
  const raw = [
    "/usr/bin/node",
    "/repo/packages/cli/dist/index.mjs",
    "gpr",
    "--root",
    "."
  ]
  expect(normalizeArgv(raw)).toEqual(["gpr", "--root", "."])
})

test("normalizeArgv leaves already-trimmed args intact", () => {
  const raw = ["build", "--entry", "src/index.ts"]
  expect(normalizeArgv(raw)).toEqual(raw)
})

// adaptSpaceSeparatedOptions tests

const stringOpts = [
  "root",
  "dist",
  "gprDir",
  "artifacts",
  "scope",
  "registry",
  "name",
  "entry"
]

test("adaptSpaceSeparatedOptions converts --opt value -> --opt=value for string opts", () => {
  const args = ["--root", ".", "--name", "pkg", "--json"]
  const adapted = adaptSpaceSeparatedOptions(args, stringOpts)
  expect(adapted).toEqual(["--root=.", "--name=pkg", "--json"])
})

test("adaptSpaceSeparatedOptions leaves flags without value untouched", () => {
  const args = ["--json", "--root", "--json"]
  const adapted = adaptSpaceSeparatedOptions(args, stringOpts)
  expect(adapted).toEqual(["--json", "--root", "--json"]) // root followed by flag is not converted
})

test("adaptSpaceSeparatedOptions preserves already equals-form args", () => {
  const args = ["--root=.", "--entry=src/index.ts", "--json"]
  const adapted = adaptSpaceSeparatedOptions(args, stringOpts)
  expect(adapted).toEqual(args)
})

test("adaptSpaceSeparatedOptions does not convert unknown option names", () => {
  const args = ["--unknown", "value", "--root", "."]
  const adapted = adaptSpaceSeparatedOptions(args, stringOpts)
  expect(adapted).toEqual(["--unknown", "value", "--root=."]) // unknown stays space-separated
})
