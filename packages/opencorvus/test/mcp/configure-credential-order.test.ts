import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { Database, eq } from "@/storage/db"
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
  test("a refreshed Instance admits credentials for the recreated Project occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const oldGeneration = Instance.projectGeneration
        const recreatedGeneration = crypto.randomUUID()
        Database.use((db) => {
          const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get()
          if (!row) throw new Error("Expected the old Project occurrence")
          db.delete(ProjectTable).where(eq(ProjectTable.id, projectID)).run()
          db.insert(ProjectTable)
            .values({ ...row, generation: recreatedGeneration })
            .run()
        })

        await Instance.refresh(project.path)
        await MCP.configure(SERVER, remoteConfig(), "replacement-secret")

        expect({
          generations: {
            old: oldGeneration,
            instance: Instance.projectGeneration,
            durable: Project.occurrence(projectID)?.generation,
          },
          credential: (await McpAuth.get(`${projectID}:${SERVER}`))?.staticCredential?.secret,
        }).toEqual({
          generations: {
            old: expect.not.stringMatching(new RegExp(`^${recreatedGeneration}$`)),
            instance: recreatedGeneration,
            durable: recreatedGeneration,
          },
          credential: "replacement-secret",
        })
      },
    })
  }, 60_000)

  test("a stale static configure cannot persist a secret after its Project occurrence is deleted", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectID = Instance.project.id
        const entered = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        MCP.TestHooks.setAfterStaticConfigureRuntimeAdmission(async () => {
          entered.resolve()
          await release.promise
        })
        try {
          const configure = MCP.configure(SERVER, remoteConfig(), "stale-secret").catch((error) => error)
          await entered.promise
          Database.use((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, projectID)).run())
          await McpAuth.removeProject(projectID)
          release.resolve()

          const result = await configure
          expect({
            result: result instanceof Error ? result.message : result,
            credential: await McpAuth.get(`${projectID}:${SERVER}`),
          }).toEqual({
            result: expect.stringContaining("MCP Project owner changed while staging"),
            credential: undefined,
          })
        } finally {
          release.resolve()
          MCP.TestHooks.setAfterStaticConfigureRuntimeAdmission(undefined)
        }
      },
    })
  }, 60_000)

  test("a stale reconcile cannot remove a credential owned by a recreated Project occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "old-secret")
        const before = await Config.getProject()
        const authKey = `${Instance.project.id}:${SERVER}`
        const oldGeneration = Instance.projectGeneration
        const recreatedGeneration = crypto.randomUUID()
        Database.use((db) => {
          const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, Instance.project.id)).get()
          if (!row) throw new Error("Expected the old Project occurrence")
          db.delete(ProjectTable).where(eq(ProjectTable.id, row.id)).run()
          db.insert(ProjectTable)
            .values({ ...row, generation: recreatedGeneration })
            .run()
        })
        await McpAuth.stageStaticCredential(authKey, "recreated-secret", URL, "recreated-identity")
        await McpAuth.promoteStagedStaticCredential(authKey, {
          serverUrl: URL,
          credentialIdentity: "recreated-identity",
        })

        const replacementDefinition = {
          ...remoteConfig(),
          credential: { type: "header" as const, name: "X-Recreated-Key" },
        }
        const result = await MCP.reconcileProjectConfig({
          before,
          after: { ...before, mcp: { [SERVER]: replacementDefinition } },
        }).catch((error) => error)
        expect({
          result: result instanceof Error ? result.message : result,
          causes:
            result instanceof AggregateError
              ? result.errors.map((error) => (error instanceof Error ? error.message : String(error)))
              : [],
          generations: { old: oldGeneration, current: Project.occurrence(Instance.project.id)?.generation },
          credential: (await McpAuth.get(authKey))?.staticCredential?.secret,
          identity: (await McpAuth.get(authKey))?.credentialIdentity,
        }).toEqual({
          result: "MCP configuration committed, but runtime cleanup did not fully settle",
          causes: [expect.stringContaining("MCP Project owner changed while")],
          generations: { old: oldGeneration, current: recreatedGeneration },
          credential: "recreated-secret",
          identity: "recreated-identity",
        })
      },
    })
  }, 60_000)

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
        await McpAuth.stageStaticCredential(authKey, "orphaned-secret", URL, "identity-from-dead-configure")
        await McpAuth.promoteStagedStaticCredential(authKey, {
          serverUrl: URL,
          credentialIdentity: "identity-from-dead-configure",
        })
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

  test("an interrupted identity-changing reconfigure leaves the previous credential serving", async () => {
    await using project = await memoryProject()
    const authKey = await Instance.provide({
      directory: project.path,
      fn: async () => {
        // A fully committed configure with its active secret...
        await MCP.configure(SERVER, remoteConfig(), "previous-secret")
        const key = `${Instance.project.id}:${SERVER}`
        expect((await McpAuth.get(key))?.staticCredential?.secret).toBe("previous-secret")

        // ...then a reconfigure toward a different identity dies after
        // staging, before its definition commit. The active secret is
        // untouched; only the staged slot holds the abandoned intent.
        await McpAuth.stageStaticCredential(
          key,
          "abandoned-secret",
          "https://mcp.example.test/other",
          "identity-of-the-dead-reconfigure",
        )

        // The abandoned stage is settled by the crash owner — the next
        // project open — which drops it and leaves the committed definition's
        // credential serving.
        expect((await McpAuth.get(key))?.stagedStaticCredential).toBeDefined()
        return key
      },
    })
    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.status()
        const entry = await McpAuth.get(authKey)
        expect({ secret: entry?.staticCredential?.secret, staged: entry?.stagedStaticCredential }).toEqual({
          secret: "previous-secret",
          staged: undefined,
        })
      },
    })
  }, 60_000)

  test("a completed identity-changing reconfigure keeps serving its new secret", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const authKey = `${Instance.project.id}:${SERVER}`
        await MCP.configure(SERVER, remoteConfig(), "previous-secret")

        // A normal, uninterrupted reconfigure toward a DIFFERENT credential
        // identity. The retirement of the old credential must not outlive the
        // promotion of the new one that replaced it.
        const rotated = { ...remoteConfig(), credential: { type: "header" as const, name: "X-Api-Key" } }
        await MCP.configure(SERVER, rotated, "rotated-secret")

        const entry = await McpAuth.get(authKey)
        expect({
          secret: entry?.staticCredential?.secret,
          staged: entry?.stagedStaticCredential,
          definition: (await Config.getProject()).mcp?.[SERVER],
        }).toMatchObject({
          secret: "rotated-secret",
          staged: undefined,
          definition: { credential: { type: "header", name: "X-Api-Key" } },
        })
      },
    })
  }, 60_000)

  test("a staged secret left by a crash is settled when the project opens", async () => {
    await using project = await memoryProject()
    const authKey = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "previous-secret")
        const key = `${Instance.project.id}:${SERVER}`
        const identity = (await McpAuth.get(key))!.credentialIdentity!
        // The durable state of a configure that died after its definition
        // commit but before promotion. No further config commit follows.
        await McpAuth.stageStaticCredential(key, "staged-secret", URL, identity)
        return key
      },
    })
    await Instance.disposeAll()

    // Opening the project is the crash owner: the staged secret is settled
    // before any connection is projected.
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.status()
        const entry = await McpAuth.get(authKey)
        expect({ secret: entry?.staticCredential?.secret, staged: entry?.stagedStaticCredential }).toEqual({
          secret: "staged-secret",
          staged: undefined,
        })
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
        const stored = await McpAuth.getForUrl(`${Instance.project.id}:${SERVER}`, URL, undefined as never)
        expect((await McpAuth.get(`${Instance.project.id}:${SERVER}`))?.staticCredential?.secret).toBe("live-secret")
        void stored
      },
    })
  }, 60_000)
})
