import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { ADAPTER_HINT, bootstrapChannelRuntime } from "../src/index"

const runtimeSrc = path.join(import.meta.dir, "..", "src")
const opencorvusSrc = path.join(import.meta.dir, "..", "..", "opencorvus", "src")

describe("the Channel runtime has one composition root", () => {
  test("the bootstrap is what both owners import, and it is reachable from the package boundary", async () => {
    expect(typeof bootstrapChannelRuntime).toBe("function")
    expect(typeof ADAPTER_HINT).toBe("string")
  })

  test("this package's own entry composes through the bootstrap", async () => {
    const main = await readFile(path.join(runtimeSrc, "main.ts"), "utf8")
    expect(main).toContain("bootstrapChannelRuntime(")
    // The adapters, STT and Vision wiring live in the bootstrap now.
    expect(main).not.toContain("registerAdapters(")
    expect(main).not.toContain("new VisionPipeline(")
  })

  test("OpenCorvus consumes the declared package boundary, not this package's private source", async () => {
    const supervisor = await readFile(path.join(opencorvusSrc, "channel", "supervisor.ts"), "utf8")
    expect(supervisor).toContain('import("@opencorvus-ai/channel-runtime")')
    // Reaching across the workspace into private src is what made two roots.
    expect(supervisor).not.toContain("../../../channel-runtime/src/")
  })

  test("an environment configuring no channel yields no adapters and the shared hint", async () => {
    const bootstrap = await bootstrapChannelRuntime({ env: {} })
    try {
      expect({ adapters: bootstrap.adapterNames, hint: ADAPTER_HINT.length > 0 }).toEqual({
        adapters: [],
        hint: true,
      })
    } finally {
      await bootstrap.runtime.stop().catch(() => undefined)
    }
  })

  test("diagnostics are the host's to render, not the composition's to print", async () => {
    const messages: string[] = []
    const bootstrap = await bootstrapChannelRuntime({ env: {}, onDiagnostic: (m) => messages.push(m) })
    try {
      // The composition reports what it decided; where it goes is the host's.
      expect(messages.some((m) => m.includes("STT"))).toBe(true)
    } finally {
      await bootstrap.runtime.stop().catch(() => undefined)
    }
  })
})
