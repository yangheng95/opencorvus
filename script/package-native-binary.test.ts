import { expect, test } from "bun:test"
import path from "node:path"
import { nativeBinaryArchiveListingCommand, nativeBinaryBuildCommands } from "./package-native-binary"

test("native binary build prepares the SDK before its overlay and CLI consumers", () => {
  const repoRoot = path.resolve("clean-native-binary-source")

  expect(nativeBinaryBuildCommands(repoRoot)).toEqual([
    {
      cwd: repoRoot,
      argv: ["bun", "packages/sdk/js/script/build.ts"],
    },
    {
      cwd: path.join(repoRoot, "packages", "overlay"),
      argv: ["bun", "run", "build:vite"],
    },
    {
      cwd: path.join(repoRoot, "packages", "opencorvus"),
      argv: ["bun", "run", "script/build.ts", "--single", "--baseline", "--no-clean"],
    },
  ])
})

test("native archive verification runs tar from the archive directory", () => {
  const archive = path.resolve("native-output", "opencorvus-windows-x64.tar.gz")

  expect(nativeBinaryArchiveListingCommand(archive)).toEqual({
    cwd: path.dirname(archive),
    argv: ["tar", "-tvzf", "opencorvus-windows-x64.tar.gz"],
  })
})
