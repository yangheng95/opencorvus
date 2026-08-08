import { describe, expect, test } from "bun:test"
import path from "node:path"
import { artifactBrowserMcpNodeRuntimeModules } from "../script/build-artifact"

describe("Browser Model Context Protocol Node sidecar bundle", () => {
  test("builds the complete Node entry without importing Host-only runtime modules", async () => {
    const child = Bun.spawn(
      [process.execPath, path.resolve(import.meta.dir, "../script/check-browser-mcp-node-bundle.ts")],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])

    expect({ exitCode, stderr, result: JSON.parse(stdout) }).toEqual({
      exitCode: 0,
      stderr: "",
      result: {
        outputs: 1,
        bytes: expect.any(Number),
      },
    })
  })

  test("declares the complete packaged Browser sidecar runtime closure", () => {
    expect(artifactBrowserMcpNodeRuntimeModules()).toEqual([{ name: "playwright" }])
  })
})
