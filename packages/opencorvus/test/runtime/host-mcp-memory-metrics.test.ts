import { afterEach, describe, expect, test } from "bun:test"
import { requireRuntimeProviderSnapshots } from "../../script/benchmark/runtime-memory-soak-support"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const zeroSnapshot = {
  projects: 0,
  connected: 0,
  local: 0,
  remote: 0,
  localStdioTransports: 0,
  connecting: 0,
  failedAwaitingReconnect: 0,
}

afterEach(async () => {
  await resetMemoryDatabase()
})

describe("Host MCP runtime memory metrics", () => {
  test("aggregates the MCP states owned by every live project without ambient Instance context", async () => {
    expect(await MCP.connectionStats()).toEqual(zeroSnapshot)

    await using first = await memoryProject()
    await using second = await memoryProject()
    await Instance.provide({ directory: first.path, fn: () => MCP.status() })
    await Instance.provide({ directory: second.path, fn: () => MCP.status() })

    expect(await MCP.connectionStats()).toEqual({ ...zeroSnapshot, projects: 2 })

    await Instance.provide({ directory: first.path, fn: () => Instance.dispose() })
    expect(await MCP.connectionStats()).toEqual({ ...zeroSnapshot, projects: 1 })

    await Instance.provide({ directory: second.path, fn: () => Instance.dispose() })
    expect(await MCP.connectionStats()).toEqual(zeroSnapshot)
  }, 0)

  test("accepts the required Host MCP success shape and surfaces provider failures to the soak checker", () => {
    expect(requireRuntimeProviderSnapshots({ "host-mcp": { ...zeroSnapshot, projects: 2, connected: 1 } })).toEqual({
      ...zeroSnapshot,
      projects: 2,
      connected: 1,
    })
    expect(() =>
      requireRuntimeProviderSnapshots({ "host-mcp": { error: "No context found for instance" } }),
    ).toThrow("Runtime memory provider host-mcp failed: No context found for instance")
  })
})
