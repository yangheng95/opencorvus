import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { selectOverlayBuildMatrix } from "./overlay-build-selection"

test("selects native Intel macOS and Linux rows from the release matrix", async () => {
  expect(await selectOverlayBuildMatrix("darwin-x64")).toEqual([{ runner: "macos-15-intel", platform: "darwin-x64" }])
  expect(await selectOverlayBuildMatrix("linux")).toEqual([
    { runner: "ubuntu-latest", platform: "linux-x64" },
    { runner: "ubuntu-24.04-arm", platform: "linux-arm64" },
  ])
  expect((await selectOverlayBuildMatrix("all")).map((row) => row.platform).sort()).toEqual([
    "darwin-arm64",
    "darwin-x64",
    "linux-arm64",
    "linux-x64",
    "windows-x64",
  ])
  await expect(selectOverlayBuildMatrix("unavailable")).rejects.toThrow("Unknown overlay build platform: unavailable")
})

test("emits the exact Actions matrix through the runnable selector", async () => {
  const child = Bun.spawn([process.execPath, fileURLToPath(new URL("./overlay-build-selection.ts", import.meta.url))], {
    env: { ...process.env, OVERLAY_BUILD_PLATFORM: "darwin-arm64" },
    stdout: "pipe",
    stderr: "pipe",
  })
  const output = await new Response(child.stdout).text()
  expect({ exitCode: await child.exited, output }).toEqual({
    exitCode: 0,
    output: 'matrix={"include":[{"runner":"macos-latest","platform":"darwin-arm64"}]}\n',
  })
})
