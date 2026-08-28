import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { MCP } from "../../src/mcp"
import { ComputerHostRuntime } from "../../src/mcp/computer/host-runtime"
import { computerRuntimeScopeIdentity } from "../../src/mcp/computer/runtime-scope"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("a scoped MCP owner settles the Computer session it owns", () => {
  test("closing the owner destroys exactly its own Computer runtime scope", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const scope = computerRuntimeScopeIdentity({
          ownerKind: "worker",
          taskID: "tsk_computer_scope_probe",
          sessionID: "ses_computer_scope_probe",
        })
        const destroyed: string[] = []
        const destroy = spyOn(ComputerHostRuntime, "destroy").mockImplementation(async (runtimeScope: string) => {
          destroyed.push(runtimeScope)
        })
        try {
          const owner = MCP.createScopedConnectionOwner(scope)
          await owner.close()
        } finally {
          destroy.mockRestore()
        }
        // The owner's settlement is what tears the desktop session down — not
        // Project disposal, which is only the outer safety net.
        expect(destroyed).toEqual([scope])
      },
    })
  }, 60_000)

  test("a Computer teardown failure does not fail the MCP close that already settled", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const scope = computerRuntimeScopeIdentity({
          ownerKind: "conversation",
          sessionID: "ses_computer_scope_failure",
        })
        const destroy = spyOn(ComputerHostRuntime, "destroy").mockRejectedValue(
          new Error("injected Computer teardown failure"),
        )
        try {
          const owner = MCP.createScopedConnectionOwner(scope)
          await owner.close()
        } finally {
          destroy.mockRestore()
        }
      },
    })
  }, 60_000)
})
