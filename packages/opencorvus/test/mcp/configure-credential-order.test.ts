import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const SERVER = "credential-order-server"
const URL = "https://mcp.example.test/connect"

function remoteConfig() {
  return {
    type: "remote" as const,
    transport: "streamable-http" as const,
    url: URL,
    oauth: false as const,
    credential: { type: "bearer" as const },
    enabled: false,
  }
}

describe("MCP configure commits the credential before the definition", () => {
  test("a definition-commit failure hands the credential store back and leaves no half-configured server", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const patchSpy = spyOn(Config, "updateProjectPatchAtomic").mockRejectedValueOnce(
          new Error("injected definition commit failure"),
        )
        try {
          await expect(MCP.configure(SERVER, remoteConfig(), "secret-value")).rejects.toThrow(
            "injected definition commit failure",
          )
        } finally {
          patchSpy.mockRestore()
        }
        // Neither half survived: no definition, no credential.
        expect((await Config.getProject()).mcp?.[SERVER]).toBeUndefined()
        expect(await McpAuth.get(`${Instance.project.id}:${SERVER}`)).toBeUndefined()
      },
    })
  }, 60_000)

  test("an interrupted configure's orphan credential is collected by credential reconciliation", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        // The exact durable state a crash between the credential write and the
        // definition commit leaves behind: a credential for a name no
        // definition declares.
        const authKey = `${Instance.project.id}:${SERVER}`
        await McpAuth.setStaticCredential(authKey, "orphaned-secret", URL, "identity-from-dead-configure")
        expect(await McpAuth.get(authKey)).toBeDefined()

        // Any project-config commit runs credential reconciliation; the next
        // one after the crash is the recovery path.
        await Config.updateProjectPatch({ theme: undefined })

        const deadline = Date.now() + 15_000
        for (;;) {
          if ((await McpAuth.get(authKey)) === undefined) break
          if (Date.now() > deadline) throw new Error("orphan credential was never collected")
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
      },
    })
  }, 60_000)

  test("a completed configure serves the credential to its committed definition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "live-secret")
        expect((await Config.getProject()).mcp?.[SERVER]).toMatchObject({ type: "remote", url: URL })
        const stored = await McpAuth.getForUrl(
          `${Instance.project.id}:${SERVER}`,
          URL,
          undefined as never,
        )
        expect((await McpAuth.get(`${Instance.project.id}:${SERVER}`))?.staticCredential?.secret).toBe("live-secret")
        void stored
      },
    })
  }, 60_000)
})
