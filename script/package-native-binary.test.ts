import { expect, test } from "bun:test"
import path from "node:path"
import { nativeBinaryBuildCommands } from "./package-native-binary"

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
