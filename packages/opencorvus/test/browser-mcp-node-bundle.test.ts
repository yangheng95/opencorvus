import { describe, expect, test } from "bun:test"
import path from "node:path"
import {
  artifactBrowserMcpNodeExternalModules,
  artifactBrowserMcpNodeRuntimeModules,
} from "../script/build-artifact"

describe("Browser Model Context Protocol Node sidecar bundle", () => {
  test("builds the complete Node entry without importing Host-only runtime modules", async () => {
    const result = await Bun.build({
      entrypoints: [path.resolve(import.meta.dir, "../src/mcp/browser/entry.ts")],
      target: "node",
      external: artifactBrowserMcpNodeExternalModules(),
    })

    expect(result.success).toBe(true)
    expect(result.outputs).toHaveLength(1)
    expect((await result.outputs[0]!.arrayBuffer()).byteLength).toBeGreaterThan(0)
  })

  test("declares the complete packaged Browser sidecar runtime closure", () => {
    expect(artifactBrowserMcpNodeRuntimeModules()).toEqual([{ name: "playwright" }])
  })
})
