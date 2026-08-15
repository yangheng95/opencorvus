import { afterEach, describe, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { PermissionAuthority } from "@/permission/authority"
import { permissionDescriptor } from "@/permission/invocation"
import { PermissionExecutionResultTable, PermissionLedgerTable, PermissionPolicyTable } from "@/permission/permission.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function invocation(sessionID: string, call: string, args: unknown = { url: "https://example.test/approved" }) {
  return {
    projectID: Instance.project.id,
    sessionID,
    messageID: `msg_${call}`,
    toolCallID: `call_${call}`,
    providerKind: "builtin" as const,
    providerID: "builtin",
    toolName: "webfetch",
    args,
  }
}

async function nextRequest(run: () => Promise<unknown>) {
  let resolveRequest!: (request: PermissionAuthority.Request) => void
  const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveRequest = resolve))
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveRequest(properties))
  const execution = run()
  const request = await asked
  stop()
  return { request, execution }
}

describe("two-mode permission authority", () => {
  test("one-time legacy permission config migration emits the canonical Full access or Ask me choice", () => {
    expect(Config.migrateLegacyPermissionConfig({ permission: "allow" })).toEqual({
      config: {
        permission_mode: "full_access",
        permission_migration: {
          version: 1,
          source_fields: ["permission"],
          permission_mode: "full_access",
          reason: "all_allow",
        },
      },
      migration: {
        sourceFields: ["permission"],
        permissionMode: "full_access",
        reason: "all_allow",
      },
    })
    expect(
      Config.migrateLegacyPermissionConfig({
        permission: { read: "allow", bash: "ask" },
        tool_permissions: { webfetch: "deny" },
      }),
    ).toEqual({
      config: {
        permission_mode: "ask",
        permission_migration: {
          version: 1,
          source_fields: ["permission", "tool_permissions"],
          permission_mode: "ask",
          reason: "restricted_or_mixed",
        },
      },
      migration: {
        sourceFields: ["permission", "tool_permissions"],
        permissionMode: "ask",
        reason: "restricted_or_mixed",
      },
    })
    expect(() => Config.migrateLegacyPermissionConfig({ permission: { bash: "sometimes" } })).toThrow(
      "Legacy permission configuration at permission.bash is malformed",
    )
  })

  test("uses Full access when permission mode is omitted", async () => {
    expect(Config.Info.parse({}).permission_mode).toBe("full_access")
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Default full access authority" })
        const result = await PermissionAuthority.authorizeAndExecute(
          invocation(session.id, "default-full-access"),
          async () => "default-result",
        )
        expect(result).toBe("default-result")
        const history = await PermissionAuthority.history()
        expect(history.map((row) => row.event_type)).toEqual([
          "execution_succeeded",
          "execution_started",
          "allowed_once",
          "requested",
        ])
        const identities =
          history.flatMap((row) =>
            [row.id, row.request_id, row.attempt_id, row.source_event_id, row.decision_slot, row.outcome_slot].filter(
              (value): value is string => Boolean(value),
            ),
          )
        expect(identities.every((id) => id.length <= Identifier.MAX_LENGTH && Identifier.isCanonical("permission", id))).toBe(true)
        const request = history.find((row) => row.event_type === "requested")!
        expect([request.policy_revision, request.provider_digest, request.fingerprint].every(
          (value) => value?.length === 64,
        )).toBe(true)
      },
    })
  })

  test("legacy configuration is captured once by the Session permission policy fact", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          permission_mode: "full_access",
          permission_migration: {
            version: 1,
            source_fields: ["permission"],
            permission_mode: "full_access",
            reason: "all_allow",
          },
        })
        const session = await Session.create({ kind: "assistant", title: "Migrated permission config" })
        await PermissionAuthority.authorizeAndExecute(invocation(session.id, "migration-first"), async () => "one")
        await PermissionAuthority.authorizeAndExecute(invocation(session.id, "migration-second"), async () => "two")
        const policies = Database.use((db) => db.select().from(PermissionPolicyTable).all())
        expect(policies).toHaveLength(1)
        expect(policies[0]).toMatchObject({
          mode: "full_access",
          session_id: session.id,
          project_id: Instance.project.id,
        })
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const changed = await Session.create({ kind: "assistant", title: "Changed permission mode" })
        const pending = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(invocation(changed.id, "migration-mode-changed"), async () => "two"),
        )
        await PermissionAuthority.reply({
          requestID: pending.request.id,
          decision: "deny",
          actorID: "test-operator",
          autoReply: false,
        })
        await expect(pending.execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)
        expect(Database.use((db) => db.select().from(PermissionPolicyTable).all())).toHaveLength(2)
      },
    })
  })

  test("Ask me records an exact project grant, reuses it, and asks again for changed arguments", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Ask authority" })
        const first = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(invocation(session.id, "first"), async () => "first-result"),
        )
        expect(first.request).toMatchObject({
          mode: "ask",
          toolName: "webfetch",
          effectClass: "network_read",
          choices: ["allow_once", "allow_project", "deny"],
        })
        const resolved = await PermissionAuthority.reply({
          requestID: first.request.id,
          decision: "allow_project",
          actorID: "test-operator",
          autoReply: false,
        })
        expect(resolved).toMatchObject({ decision: "allow_project", request: { id: first.request.id } })
        expect(await first.execution).toBe("first-result")

        expect(
          await PermissionAuthority.authorizeAndExecute(invocation(session.id, "second"), async () => "grant-result"),
        ).toBe("grant-result")

        const changed = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(
            invocation(session.id, "changed", { url: "https://example.test/changed" }),
            async () => "changed-result",
          ),
        )
        await PermissionAuthority.reply({
          requestID: changed.request.id,
          decision: "deny",
          actorID: "test-operator",
          autoReply: false,
        })
        await expect(changed.execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)

        expect((await PermissionAuthority.grants()).map((row) => row.decision_scope)).toEqual(["project"])
        expect((await PermissionAuthority.history()).map((row) => row.event_type)).toEqual([
          "denied",
          "requested",
          "execution_succeeded",
          "execution_started",
          "grant_used",
          "requested",
          "execution_succeeded",
          "execution_started",
          "grant_created",
          "requested",
        ])
      },
    })
  })

  test("Full access executes built-in and MCP calls while retaining auditable outcomes", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const session = await Session.create({ kind: "assistant", title: "Full authority" })
        expect(await PermissionAuthority.authorizeAndExecute(invocation(session.id, "builtin"), async () => 1)).toBe(1)
        expect(
          await PermissionAuthority.authorizeAndExecute(
            {
              ...invocation(session.id, "mcp", { query: "current docs" }),
              providerKind: "mcp",
              providerID: "controlled-local-mcp",
              providerDigest: "controlled-local-mcp-v1",
              toolName: "lookup",
            },
            async () => 2,
          ),
        ).toBe(2)
        expect((await PermissionAuthority.history()).map((row) => row.event_type).sort()).toEqual(
          [
            "execution_succeeded",
            "execution_started",
            "allowed_once",
            "requested",
            "execution_succeeded",
            "execution_started",
            "allowed_once",
            "requested",
          ].sort(),
        )
      },
    })
  })

  test("an event consumer can decide during publication without losing the authorization wake", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Synchronous permission reply" })
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) =>
          PermissionAuthority.reply({
            requestID: properties.id,
            decision: "allow_once",
            actorID: "synchronous-test-operator",
            autoReply: false,
          }).then(() => undefined),
        )
        try {
          await expect(
            PermissionAuthority.authorizeAndExecute(invocation(session.id, "synchronous"), async () => "executed"),
          ).resolves.toBe("executed")
        } finally {
          stop()
        }
      },
    })
  })

  test("reply and stale settlement converge on one durable typed decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Concurrent permission settlement" })
        const pending = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(invocation(session.id, "concurrent-settlement"), async () => "ran"),
        )
        const [reply, stale] = await Promise.all([
          PermissionAuthority.reply({
            requestID: pending.request.id,
            decision: "allow_once",
            actorID: "concurrent-operator",
            autoReply: false,
          }),
          PermissionAuthority.settleStale(pending.request.id, "concurrent input invalidation"),
        ])
        expect(reply.eventID).toBe(stale.eventID)
        expect(reply.decision).toBe(stale.decision)
        const decisions = (await PermissionAuthority.history()).filter(
          (row) => row.decision_slot === pending.request.id,
        )
        expect(decisions).toHaveLength(1)
        if (reply.decision === "deny") await expect(pending.execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)
        else await expect(pending.execution).resolves.toBe("ran")
      },
    })
  })

  test("Session deletion cancels a pending request and retains its authorization history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Cancelled permission owner" })
        const pending = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(invocation(session.id, "cancelled"), async () => "must-not-run"),
        )
        const rejected = pending.execution.catch((error) => error)
        await Session.remove(session.id)
        expect(await rejected).toBeInstanceOf(PermissionAuthority.RejectedError)
        expect((await PermissionAuthority.history()).map((row) => row.event_type)).toEqual(["cancelled", "requested"])
      },
    })
  })

  test("scope fingerprints redact secrets and bind exact provider and arguments", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const first = (await permissionDescriptor({
          providerKind: "mcp",
          providerID: "fixture",
          providerDigest: "fixture-v1",
          toolName: "send",
          args: { token: "secret-value", destination: "alpha" },
        }))!
        const second = (await permissionDescriptor({
          providerKind: "mcp",
          providerID: "fixture",
          providerDigest: "fixture-v1",
          toolName: "send",
          args: { token: "secret-value", destination: "beta" },
        }))!
        expect((first.scope.resource as Record<string, unknown>).arguments).toEqual({
          token: "<redacted>",
          destination: "alpha",
        })
        expect(first.fingerprint).not.toBe(second.fingerprint)
        expect(
          (await permissionDescriptor({
            providerKind: "mcp",
            providerID: "fixture",
            providerDigest: "fixture-v1",
            toolName: "send",
            args: {
              callbackUrl: "https://example.test/callback?code=secret-code&state=secret-state#fragment",
              accessTokenValue: "secret-value",
            },
          }))!.scope.resource,
        ).toEqual({
          scope_type: "provider",
          operation: "send",
          arguments: {
            callbackUrl: "https://example.test/callback?<redacted>#<redacted>",
            accessTokenValue: "<redacted>",
          },
          arguments_sha256: expect.any(String),
        })
        expect(
          (await permissionDescriptor({
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "bash",
            args: { command: "echo safe" },
          }))!.projectGrantEligible,
        ).toBe(false)
        expect(
          (await permissionDescriptor({
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "webfetch",
            args: { url: "https://EXAMPLE.test:443/docs?token=secret#private" },
          }))!.scope.resource,
        ).toEqual({
          scope_type: "network",
          operation: "webfetch",
          endpoint: {
            scheme: "https",
            hostname: "example.test",
            port: "443",
            pathname: "/docs",
            query_sha256: expect.any(String),
            fragment_present: true,
          },
          request_sha256: expect.any(String),
        })
        const structuredShell = (await permissionDescriptor({
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "bash",
            args: {
              command: "TOKEN=secret env curl https://example.test/path?secret=value | tee output.txt > audit.log",
              workdir: project.path,
              background: true,
            },
          }))!
        expect(structuredShell.scope.resource).toMatchObject({
          scope_type: "shell",
          ast_sha256: expect.any(String),
          commands: [
            { executable: "curl", argument_sha256: expect.any(String) },
            { executable: "tee", argument_sha256: expect.any(String) },
          ],
          environment_names: ["TOKEN"],
          pipeline_count: 1,
          redirects: [{ operator_sha256: expect.any(String), target_sha256: expect.any(String) }],
          endpoints: ["https://example.test:443/path"],
          background: true,
        })
        const equivalentShell = (await permissionDescriptor({
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "bash",
          args: {
            command: "TOKEN=secret   env curl https://example.test/path?secret=value | tee output.txt > audit.log # display-only spacing/comment",
            workdir: project.path,
            background: true,
          },
        }))!
        const changedShell = (await permissionDescriptor({
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "bash",
          args: {
            command: "TOKEN=secret env curl https://other.example/path | tee output.txt > audit.log",
            workdir: project.path,
            background: true,
          },
        }))!
        expect(equivalentShell.fingerprint).toBe(structuredShell.fingerprint)
        expect(changedShell.fingerprint).not.toBe(structuredShell.fingerprint)
        expect(
          (await permissionDescriptor({
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "schedule",
            args: { action: "create", scope: "project", projectIds: ["beta", "alpha"], recurrence: "RRULE:FREQ=DAILY" },
          }))!.scope.resource,
        ).toMatchObject({
          scope_type: "schedule",
          action: "create",
          target_scope: "project",
          project_ids: ["alpha", "beta"],
          recurrence_sha256: expect.any(String),
        })
        await expect(
          permissionDescriptor({
            providerKind: "mcp",
            providerID: "unbound",
            toolName: "send",
            args: {},
          }),
        ).rejects.toThrow("Permission provider binding is required")
      },
    })
  })

  test("a project symlink read is authorized against its canonical external target", async () => {
    await using project = await memoryProject()
    const external = await mkdtemp(path.join(tmpdir(), "opencorvus-permission-external-"))
    try {
      const target = path.join(external, "controlled.txt")
      const linked = path.join(project.path, "linked-external")
      await writeFile(target, "controlled")
      await symlink(external, linked, process.platform === "win32" ? "junction" : "dir")
      const canonicalProject = await realpath(project.path)
      const canonicalTarget = await realpath(target)
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const descriptor = (await permissionDescriptor({
            providerKind: "builtin",
            providerID: "builtin",
            toolName: "read",
            args: { filePath: path.join(linked, "controlled.txt") },
          }))!
          expect(descriptor).toMatchObject({
            effectClass: "read_local",
            projectGrantEligible: true,
            scope: {
              resource: {
                scope_type: "filesystem",
                paths: [canonicalTarget],
                working_directory: canonicalProject,
              },
            },
          })
        },
      })
    } finally {
      await rm(external, { recursive: true, force: true })
    }
  })

  test("grant expiry and stale settlement produce durable typed lifecycles", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const session = await Session.create({ kind: "assistant", title: "Permission lifecycle" })
        const grantRun = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(invocation(session.id, "grant-expiry"), async () => "granted"),
        )
        await PermissionAuthority.reply({
          requestID: grantRun.request.id,
          decision: "allow_project",
          actorID: "test-operator",
          autoReply: false,
        })
        await expect(grantRun.execution).resolves.toBe("granted")
        const [grant] = await PermissionAuthority.grants()
        await PermissionAuthority.expire(grant.id, "operator-set expiry elapsed", "expiry-service")
        expect(await PermissionAuthority.grants()).toEqual([])

        const staleRun = await nextRequest(() =>
          PermissionAuthority.authorizeAndExecute(
            invocation(session.id, "stale", { url: "https://example.test/stale" }),
            async () => "must-not-run",
          ),
        )
        await PermissionAuthority.settleStale(staleRun.request.id, "Tool input changed before execution")
        await expect(staleRun.execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)
        expect((await PermissionAuthority.history()).map((row) => row.event_type)).toContain("expired")
        expect((await PermissionAuthority.history()).map((row) => row.event_type)).toContain("stale")
      },
    })
  })

  test("an unknown execution outcome is explicitly reconciled without rewriting its history", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Permission reconciliation" })
        await PermissionAuthority.authorizeAndExecute(invocation(session.id, "reconcile-source"), async () => "done")
        const source = (await PermissionAuthority.history()).find((row) => row.event_type === "execution_succeeded")!
        const attemptID = Identifier.deterministic("permission", `test-attempt\0${randomUUID()}`)
        Database.transaction((db) =>
          db
            .insert(PermissionLedgerTable)
            .values({
              ...source,
              id: Identifier.ascending("permission"),
              attempt_id: attemptID,
              event_type: "outcome_unknown",
              outcome_slot: attemptID,
              source_event_id: source.id,
              reason: "fixture interrupted outcome",
              metadata: null,
              time_created: Date.now(),
            })
            .run(),
        )
        const reconciled = await PermissionAuthority.reconcileExecution({
          attemptID,
          outcome: "execution_succeeded",
          actorID: "test-operator",
          reason: "verified controlled provider receipt",
        })
        expect(reconciled).toMatchObject({
          event_type: "execution_reconciled",
          attempt_id: attemptID,
          actor_id: "test-operator",
          metadata: { outcome: "execution_succeeded" },
        })
        expect((await PermissionAuthority.history()).map((row) => row.event_type)).toContain("outcome_unknown")
      },
    })
  })

  test("a completed execution replays from the Session-owned result store without copying Tool output into the ledger", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Permission result replay" })
        const input = invocation(session.id, "result-replay")
        let effects = 0
        const first = await PermissionAuthority.authorizeAndExecute(input, async () => ({ output: "durable result" }))
        const replay = await PermissionAuthority.authorizeAndExecute(input, async () => {
            effects += 1
            return { output: "duplicate" }
          })
        const outcome = (await PermissionAuthority.history()).find(
          (row) => row.event_type === "execution_succeeded",
        )!
        const stored = Database.use((db) => db.select().from(PermissionExecutionResultTable).get())!
        expect({ first, replay, effects, metadata: outcome.metadata, stored }).toEqual({
          first: { output: "durable result" },
          replay: { output: "durable result" },
          effects: 0,
          metadata: null,
          stored: {
            attempt_id: expect.any(String),
            result: { kind: "json", value: { output: "durable result" } },
            time_created: expect.any(Number),
          },
        })
        expect(JSON.stringify(outcome)).not.toContain("durable result")
      },
    })
  })

})
