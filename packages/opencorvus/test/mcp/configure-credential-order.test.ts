import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { Database, eq } from "@/storage/db"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { GlobalBus } from "@/bus/global"
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
        const result = await MCP.prepareProjectConfigReconciliation({
          before,
          after: { ...before, mcp: { [SERVER]: replacementDefinition } },
        })
          .then((apply) => apply())
          .catch((error) => error)
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

  test("a definition-commit failure preserves the committed definition and its serving credential", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "previous-secret")
        const replacement = { ...remoteConfig(), credential: { type: "header" as const, name: "X-Replacement" } }
        const patchSpy = spyOn(Config, "updateProjectPatchAtomic").mockRejectedValueOnce(
          new Error("injected definition commit failure"),
        )
        try {
          await expect(MCP.configure(SERVER, replacement, "secret-value")).rejects.toThrow(
            "injected definition commit failure",
          )
        } finally {
          patchSpy.mockRestore()
        }
        expect({
          definition: (await Config.getProject()).mcp?.[SERVER],
          secret: (await McpAuth.get(`${Instance.project.id}:${SERVER}`))?.staticCredential?.secret,
        }).toEqual({ definition: remoteConfig(), secret: "previous-secret" })
      },
    })
  }, 60_000)

  test("credential recovery revokes an orphan's lease and admits its successor", async () => {
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
        const oldLease = await McpAuth.ensureRevision(authKey)

        // Any project-config commit runs credential reconciliation; the next
        // one after the crash is the recovery path.
        await Config.updateProjectPatch({ theme: undefined })

        const successor = await McpAuth.ensureRevision(authKey)
        await expect(
          McpAuth.set(authKey, { staticCredential: { secret: "stale-write" } }, URL, oldLease),
        ).rejects.toThrow(`MCP auth lease was revoked: ${authKey}`)
        await McpAuth.set(authKey, { staticCredential: { secret: "successor-secret" } }, URL, successor)
        expect((await McpAuth.get(authKey))?.staticCredential?.secret).toBe("successor-secret")
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

  test("credential admission failure reports the committed definition and its promoted secret", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "previous-secret")
        const authKey = `${Instance.project.id}:${SERVER}`
        const orphanKey = `${Instance.project.id}:interrupted-orphan`
        await McpAuth.set(orphanKey, { staticCredential: { secret: "orphan-secret" } }, URL)
        const orphanLease = await McpAuth.ensureRevision(orphanKey)
        const replacement = { ...remoteConfig(), credential: { type: "header" as const, name: "X-Committed-Key" } }
        const remove = spyOn(McpAuth, "removeMany").mockRejectedValueOnce(
          new Error("injected credential retirement failure"),
        )
        let result: unknown
        try {
          result = await MCP.configure(SERVER, replacement, "committed-secret").catch((error) => error)
        } finally {
          remove.mockRestore()
        }
        expect({
          error: result instanceof Config.ProjectConfigCommittedReconcileError ? result.name : result,
          committed:
            result instanceof Config.ProjectConfigCommittedReconcileError ? result.config.mcp?.[SERVER] : result,
          canonical: (await Config.getProject()).mcp?.[SERVER],
          secret: (await McpAuth.get(authKey))?.staticCredential?.secret,
        }).toEqual({
          error: "ProjectConfigCommittedReconcileError",
          committed: replacement,
          canonical: replacement,
          secret: "committed-secret",
        })
        await Config.updateProjectPatch({ theme: undefined })
        await expect(
          McpAuth.set(orphanKey, { staticCredential: { secret: "stale-write" } }, URL, orphanLease),
        ).rejects.toThrow(`MCP auth lease was revoked: ${orphanKey}`)
        expect((await MCP.projectStatus())[SERVER]).toEqual({ status: "disabled" })
      },
    })
  }, 60_000)

  test("a failed cleanup and the next configure settle the new credential and ordered definitions", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "AUDIT_SYNTHETIC_A")
        const authKey = `${Instance.project.id}:${SERVER}`
        const orphanKey = `${Instance.project.id}:interrupted-orphan`
        await McpAuth.set(orphanKey, { staticCredential: { secret: "AUDIT_SYNTHETIC_ORPHAN" } }, URL)
        const orphanLease = await McpAuth.ensureRevision(orphanKey)
        const interrupted = { ...remoteConfig(), credential: { type: "header" as const, name: "X-Interrupted" } }
        const replacement = { ...remoteConfig(), credential: { type: "header" as const, name: "X-Recovered" } }
        let stagedReplacement = false
        const remove = McpAuth.removeMany
        const stage = McpAuth.stageStaticCredential
        const removeSpy = spyOn(McpAuth, "removeMany").mockImplementation(async (...args) => {
          if (args[0].includes(orphanKey) && !stagedReplacement)
            throw new Error("controlled credential cleanup failure")
          return remove(...args)
        })
        const stageSpy = spyOn(McpAuth, "stageStaticCredential").mockImplementation(async (...args) => {
          const result = await stage(...args)
          if (args[0] === authKey && args[1] === "AUDIT_SYNTHETIC_C") stagedReplacement = true
          return result
        })
        const definitions: string[] = []
        const listener = (event: { directory?: string; payload: { type?: string; properties?: Config.Info } }) => {
          if (event.directory !== project.path || event.payload.type !== "config.changed") return
          const definition = event.payload.properties?.mcp?.[SERVER]
          if (definition && "credential" in definition && definition.credential?.type === "header") {
            definitions.push(definition.credential.name)
          }
        }
        GlobalBus.on("event", listener)
        try {
          const failed = await MCP.configure(SERVER, interrupted, "AUDIT_SYNTHETIC_B").catch((error) => error)
          expect(failed).toBeInstanceOf(Config.ProjectConfigCommittedReconcileError)
          const recovered = await MCP.configure(SERVER, replacement, "AUDIT_SYNTHETIC_C")
          expect({
            secret: (await McpAuth.get(authKey))?.staticCredential?.secret,
            definition: (await Config.getProject()).mcp?.[SERVER],
            status: recovered.status[SERVER],
            definitions,
          }).toEqual({
            secret: "AUDIT_SYNTHETIC_C",
            definition: replacement,
            status: { status: "disabled" },
            definitions: ["X-Interrupted", "X-Recovered"],
          })
          await expect(
            McpAuth.set(orphanKey, { staticCredential: { secret: "stale-write" } }, URL, orphanLease),
          ).rejects.toThrow(`MCP auth lease was revoked: ${orphanKey}`)
        } finally {
          GlobalBus.off("event", listener)
          removeSpy.mockRestore()
          stageSpy.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a prepared reconciliation applies through its exact Project runtime", async () => {
    await using source = await memoryProject()
    await using other = await memoryProject()
    let apply!: () => Promise<void>
    await Instance.provide({
      directory: source.path,
      fn: async () => {
        await MCP.configure(SERVER, remoteConfig(), "AUDIT_SYNTHETIC_PREPARED_SOURCE")
        const config = await Config.get()
        apply = await MCP.prepareProjectConfigReconciliation({ before: config, after: config })
      },
    })
    await Instance.provide({
      directory: other.path,
      fn: async () => {
        await expect(apply()).rejects.toBeInstanceOf(MCP.McpConfigReconciliationScopeError)
      },
    })
    await Instance.provide({
      directory: source.path,
      fn: async () => {
        await apply()
        expect({
          status: (await MCP.projectStatus())[SERVER],
          credential: (await McpAuth.get(`${Instance.project.id}:${SERVER}`))?.staticCredential?.secret,
        }).toEqual({ status: { status: "disabled" }, credential: "AUDIT_SYNTHETIC_PREPARED_SOURCE" })
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
