import { describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { AttachmentStore } from "../../src/storage/attachment-store"
import {
  CatalogOccurrenceBinding,
  CatalogViewSnapshotPayloadV3,
  CorruptCatalogOccurrenceError,
  StaleCatalogOccurrenceError,
} from "../../src/capability/catalog-binding"
import {
  CapabilityCatalogCache,
  createCapabilityCatalogSnapshot,
  searchCapabilityCatalog,
} from "../../src/capability/catalog"
import {
  createCapabilityCatalogProjection,
  createCapabilityCatalogSource,
  createCapabilityCatalogViewEntry,
  createCapabilityDescriptor,
} from "../../src/capability/descriptor"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { memoryProject } from "../fixture/memory"
import { Config } from "../../src/config/config"
import { persistEstablishedTask } from "../fixture/engine-task"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Database, eq } from "../../src/storage/db"
import { PartTable } from "../../src/session/session.sql"
import { acceptTaskRootIngressInTransaction } from "../../src/engine/task-root-fact-store"
import { MCP } from "../../src/mcp"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { resolveCapabilityCaller } from "../../src/capability/caller-authority"
import { PermissionAuthority } from "../../src/permission/authority"
import { canonicalJSONValue } from "../../src/util/canonical-digest"

const SHA_A = "a".repeat(64)
const SHA_B = "b".repeat(64)

function permanentBaseDefinition() {
  return { providerNames: ["capability_search"], definitionDigest: SHA_A, payloadChars: 1, payloadTokens: 1 }
}

function snapshot(caller: "conversation" | "mission" | "task_scheduler" | "task_agent" = "conversation") {
  const ref = capabilityRef({
    kind: "tool",
    source: "platform",
    owner_ref: "tool-registry",
    local_ref: "capability_search",
  })
  const descriptor = createCapabilityDescriptor({
    ref,
    name: "capability_search",
    description: "Search the bound capability catalog.",
    aliases: ["capability search"],
    search_terms: ["discover"],
    behavior: { kind: "call_tool", tool_ref: ref },
  })
  const stageRef = capabilityRef({
    kind: "tool",
    source: "package",
    owner_ref: "dispatch-stage:requirements",
    local_ref: "register_requirement",
  })
  const stageDescriptor = createCapabilityDescriptor({
    ref: stageRef,
    name: "register_requirement",
    description: "Register one exact requirement.",
    aliases: [],
    search_terms: ["requirement"],
    behavior: { kind: "call_tool", tool_ref: stageRef },
  })
  return createCapabilityCatalogSnapshot({
    context: { caller, context_ref: `${caller}:work`, context_revision: SHA_A },
    sources: [
      createCapabilityCatalogSource({
        owner_ref: "tool-registry",
        owner_revision: "tool-owner-v1",
        descriptors: [descriptor],
        sets: [
          {
            ref: capabilityRef({
              kind: "capability_set",
              source: "platform",
              owner_ref: "tool-registry",
              local_ref: "discovery",
            }),
            name: "Discovery",
            description: "Platform discovery capabilities.",
            member_refs: [ref],
          },
        ],
      }),
      createCapabilityCatalogSource({
        owner_ref: "dispatch-stage:requirements",
        owner_revision: "stage-owner-v1",
        descriptors: [stageDescriptor],
        sets: [],
      }),
    ],
    projections: [
      createCapabilityCatalogProjection({
        owner_ref: "tool-registry",
        projection_revision: SHA_B,
        entries: [
          createCapabilityCatalogViewEntry({
            descriptor_ref: ref,
            descriptor_digest: descriptor.metadata_digest,
            discoverable_by: ["conversation"],
            availability: "visible",
            next_owner: { kind: "call_tool", tool_id: "capability_search" },
          }),
        ],
      }),
      createCapabilityCatalogProjection({
        owner_ref: "dispatch-stage:requirements",
        projection_revision: "c".repeat(64),
        entries: [],
      }),
    ],
  })
}

function scope(configRevision = SHA_A) {
  return {
    provider_id: "test-provider",
    model_id: "test-model",
    api_npm: "@ai-sdk/openai-compatible",
    config_revision: configRevision,
    plugin_revision: SHA_B,
  }
}

function assistant(input: { sessionID: string; parentID: string; id?: string }) {
  return {
    id: input.id ?? Identifier.ascending("message"),
    sessionID: input.sessionID,
    parentID: input.parentID,
    acceptedInputMessageIDs: [input.parentID],
    role: "assistant" as const,
    author: "work",
    agent: "work",
    providerID: "test-provider",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  }
}

describe("occurrence-bound capability catalog", () => {
  test("hashes the complete canonical payload including set, scope, and reducer bindings", () => {
    const base = CatalogOccurrenceBinding.payload({
      snapshot: snapshot(),
      materializationScope: scope(),
      permanentProviderBaseDefinition: permanentBaseDefinition(),
    })
    const ref = base.descriptors.find((descriptor) => descriptor.ref.owner_ref === "dispatch-stage:requirements")!.ref
    const withReducer = CatalogViewSnapshotPayloadV3.parse({
      ...base,
      fixed_package_digests: { "built_in:global:opencorvus/base:base:2026.08.30.1": SHA_A },
      occurrence_owner_bindings: [
        {
          kind: "dispatch_stage",
          adapter_id: "requirements",
          adapter_abi_version: 1,
          dispatch_turn_digest: SHA_A,
          effectful_tools: [],
          collector_tools: [
            {
              ref,
              reducer_version: 1,
              toolkit_input_refs: ["task:task-1", "message:message-1"],
              toolkit_input_digest: SHA_B,
            },
          ],
        },
      ],
    })
    const reordered = CatalogViewSnapshotPayloadV3.parse(JSON.parse(JSON.stringify(withReducer)))
    const changedToolkitInput = CatalogViewSnapshotPayloadV3.parse({
      ...withReducer,
      occurrence_owner_bindings: [
        {
          ...withReducer.occurrence_owner_bindings[0]!,
          collector_tools: [
            { ...withReducer.occurrence_owner_bindings[0]!.collector_tools[0]!, toolkit_input_digest: SHA_A },
          ],
        },
      ],
    })
    const changedScope = CatalogOccurrenceBinding.payload({
      snapshot: snapshot(),
      materializationScope: scope("c".repeat(64)),
      permanentProviderBaseDefinition: permanentBaseDefinition(),
    })
    const changedPermanentBase = CatalogOccurrenceBinding.payload({
      snapshot: snapshot(),
      materializationScope: scope(),
      permanentProviderBaseDefinition: {
        ...permanentBaseDefinition(),
        definitionDigest: SHA_B,
      },
    })

    expect(CatalogOccurrenceBinding.hash(reordered)).toBe(CatalogOccurrenceBinding.hash(withReducer))
    expect(CatalogOccurrenceBinding.hash(changedToolkitInput)).not.toBe(CatalogOccurrenceBinding.hash(withReducer))
    expect(CatalogOccurrenceBinding.hash(changedScope)).not.toBe(CatalogOccurrenceBinding.hash(base))
    expect(CatalogOccurrenceBinding.hash(changedPermanentBase)).not.toBe(CatalogOccurrenceBinding.hash(base))
    expect(CatalogOccurrenceBinding.hash(base)).not.toBe(CatalogOccurrenceBinding.hash(withReducer))
  })

  test("retires a version-two occurrence that has no permanent Provider base authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const current = CatalogOccurrenceBinding.payload({
          snapshot: snapshot(),
          materializationScope: scope(),
          permanentProviderBaseDefinition: permanentBaseDefinition(),
        })
        const legacy = { ...current } as Record<string, unknown>
        legacy.schema_version = 2
        delete legacy.permanent_provider_base_definition
        const reference = await AttachmentStore.write(
          Instance.project.id,
          Buffer.from(canonicalJSONValue(legacy), "utf8"),
          "application/json",
          "catalog-v2.json",
        )
        await expect(
          CatalogOccurrenceBinding.read({
            projectID: Instance.project.id,
            binding: {
              snapshot_ref: reference.url,
              snapshot_hash: reference.sha,
            },
          }),
        ).rejects.toMatchObject({
          name: "StaleCatalogOccurrenceError",
          mismatches: ["permanent_provider_base_definition"],
        })
      },
    })
  })

  test("atomically binds the canonical input carrier and reuses it for later assistant steps", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Bound catalog occurrence" })
        const userMessageID = Identifier.ascending("message")
        const textPartID = Identifier.ascending("part")
        const persisted = await Session.persistMessage({
          info: {
            id: userMessageID,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "work",
            model: { providerID: "test-provider", modelID: "test-model" },
            time: { created: Date.now() },
          },
          parts: [
            {
              id: textPartID,
              sessionID: session.id,
              messageID: userMessageID,
              type: "text",
              text: "Find the exact capability.",
              kind: "user_content",
              metadata: { preserved: "yes" },
            },
          ],
        })
        const payload = CatalogOccurrenceBinding.payload({
          snapshot: snapshot(),
          materializationScope: scope(),
          permanentProviderBaseDefinition: permanentBaseDefinition(),
        })
        const binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
        const first = assistant({ sessionID: session.id, parentID: userMessageID })
        await CatalogOccurrenceBinding.bindAndBeginAssistant({
          projectID: Instance.project.id,
          assistant: first,
          parent: persisted,
          binding,
        })

        const rebound = await MessageStore.get({ sessionID: session.id, messageID: userMessageID })
        expect(rebound.parts[0]).toMatchObject({
          id: textPartID,
          type: "text",
          text: "Find the exact capability.",
          metadata: {
            preserved: "yes",
            catalog_snapshot_ref: binding.snapshot_ref,
            catalog_snapshot_hash: binding.snapshot_hash,
          },
        })
        expect(AttachmentStore.collectReferencedShas(Instance.project.id).get(Instance.project.id)).toContain(
          binding.snapshot_hash,
        )
        const restored = await CatalogOccurrenceBinding.readAssistant({
          projectID: Instance.project.id,
          sessionID: session.id,
          assistantMessageID: first.id,
        })
        expect(CatalogOccurrenceBinding.hash(restored)).toBe(binding.snapshot_hash)

        const beforeMutation = searchCapabilityCatalog(
          CatalogOccurrenceBinding.searchSnapshot(restored),
          "conversation",
          { queries: ["discover"] },
        )
        await CapabilityCatalogCache.invalidate("tool-registry")
        const afterMutation = searchCapabilityCatalog(
          CatalogOccurrenceBinding.searchSnapshot(restored),
          "conversation",
          { queries: ["discover"] },
        )
        expect(afterMutation).toEqual(beforeMutation)

        const second = assistant({ sessionID: session.id, parentID: userMessageID })
        await Session.beginAssistantReply(second)
        const secondRestored = await CatalogOccurrenceBinding.readAssistant({
          projectID: Instance.project.id,
          sessionID: session.id,
          assistantMessageID: second.id,
        })
        expect(secondRestored).toEqual(restored)
      },
    })
  }, 0)

  test("binds a previously accepted Task-root Message only inside assistant admission", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const packageRevision = {
          scope: "built_in" as const,
          projectID: null,
          namespace: "builtin",
          id: "base",
          version: "2026.08.30.1",
          packageDigest: SHA_A,
        }
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Accepted Catalog ingress",
        })
        const taskID = Identifier.ascending("task")
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: "Accepted Catalog ingress",
          request: "Bind the accepted Task-root input.",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const messageID = Identifier.ascending("message")
        const message = await Session.persistMessage({
          info: {
            id: messageID,
            sessionID: root.id,
            role: "user",
            author: "orchestrator",
            agent: "orchestrator",
            model: { providerID: "test-provider", modelID: "test-model" },
            time: { created: now },
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              sessionID: root.id,
              messageID,
              type: "text",
              text: "Accepted before model occurrence admission.",
              kind: "control",
            },
          ],
        })
        Database.immediateTransaction((db) =>
          acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "message",
            sourceID: messageID,
            semanticTurnLimit: 3,
            activationLimit: 3,
            now,
          }),
        )
        const payload = CatalogOccurrenceBinding.payload({
          snapshot: snapshot(),
          materializationScope: scope(),
          permanentProviderBaseDefinition: permanentBaseDefinition(),
        })
        const binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
        const reply = assistant({ sessionID: root.id, parentID: messageID })
        await CatalogOccurrenceBinding.bindAndBeginAssistant({
          projectID: Instance.project.id,
          assistant: reply,
          parent: message,
          binding,
        })
        const restored = await CatalogOccurrenceBinding.readAssistant({
          projectID: Instance.project.id,
          sessionID: root.id,
          assistantMessageID: reply.id,
        })
        expect(CatalogOccurrenceBinding.hash(restored)).toBe(binding.snapshot_hash)
      },
    })
  }, 0)

  test("returns typed cross-project and missing-blob occurrence corruption", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const payload = CatalogOccurrenceBinding.payload({
          snapshot: snapshot(),
          materializationScope: scope(),
          permanentProviderBaseDefinition: permanentBaseDefinition(),
        })
        const binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
        await expect(
          CatalogOccurrenceBinding.read({
            projectID: Instance.project.id,
            binding: {
              snapshot_ref: binding.snapshot_ref.replace(
                `/attachment/${Instance.project.id}/`,
                "/attachment/foreign-project/",
              ),
              snapshot_hash: binding.snapshot_hash,
            },
          }),
        ).rejects.toMatchObject<Partial<CorruptCatalogOccurrenceError>>({
          name: "CorruptCatalogOccurrenceError",
          code: "cross_project",
        })
        await expect(
          CatalogOccurrenceBinding.read({
            projectID: Instance.project.id,
            binding: {
              snapshot_ref: `/attachment/${Instance.project.id}/${"f".repeat(64)}.json`,
              snapshot_hash: "f".repeat(64),
            },
          }),
        ).rejects.toMatchObject<Partial<CorruptCatalogOccurrenceError>>({
          name: "CorruptCatalogOccurrenceError",
          code: "missing_blob",
        })
        await expect(
          CatalogOccurrenceBinding.read({
            projectID: Instance.project.id,
            binding: {
              snapshot_ref: binding.snapshot_ref.replace(`${binding.snapshot_hash}.json`, `${binding.snapshot_hash}.txt`),
              snapshot_hash: binding.snapshot_hash,
            },
          }),
        ).rejects.toMatchObject<Partial<CorruptCatalogOccurrenceError>>({
          name: "CorruptCatalogOccurrenceError",
          code: "digest_mismatch",
        })
      },
    })
  }, 0)

  test("rejects a stale parent snapshot when another persisted TextPart is concurrently pre-bound", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Concurrent catalog carrier" })
        const messageID = Identifier.ascending("message")
        const secondPartID = Identifier.ascending("part")
        const parent = await Session.persistMessage({
          info: {
            id: messageID,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "work",
            model: { providerID: "test-provider", modelID: "test-model" },
            time: { created: Date.now() },
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID,
              type: "text",
              text: "canonical carrier",
            },
            {
              id: secondPartID,
              sessionID: session.id,
              messageID,
              type: "text",
              text: "concurrent carrier",
            },
          ],
        })
        const second = parent.parts[1]!
        Database.immediateTransaction((db) =>
          db
            .update(PartTable)
            .set({
              data: {
                ...second,
                metadata: { catalog_snapshot_ref: `/attachment/${Instance.project.id}/${SHA_A}.json` },
              } as any,
            })
            .where(eq(PartTable.id, secondPartID))
            .run(),
        )
        const binding = await CatalogOccurrenceBinding.publish({
          projectID: Instance.project.id,
          payload: CatalogOccurrenceBinding.payload({
            snapshot: snapshot(),
            materializationScope: scope(),
            permanentProviderBaseDefinition: permanentBaseDefinition(),
          }),
        })
        await expect(
          CatalogOccurrenceBinding.bindAndBeginAssistant({
            projectID: Instance.project.id,
            assistant: assistant({ sessionID: session.id, parentID: messageID }),
            parent,
            binding,
          }),
        ).rejects.toMatchObject<Partial<CorruptCatalogOccurrenceError>>({
          name: "CorruptCatalogOccurrenceError",
          code: "partial_binding",
        })
      },
    })
  }, 0)

  test("derives every catalog caller from the execution authority", () => {
    expect(
      resolveCapabilityCaller({ sessionKind: "assistant", agentID: "work" }),
    ).toBe("conversation")
    expect(
      resolveCapabilityCaller({ sessionKind: "mission", agentID: "mission" }),
    ).toBe("mission")
    expect(
      resolveCapabilityCaller({
        sessionKind: "root",
        agentID: "orchestrator",
        runtimeIdentityKind: "projected-scheduler",
      }),
    ).toBe("task_scheduler")
    expect(
      resolveCapabilityCaller({
        sessionKind: "delegated-worker",
        agentID: "worker",
        runtimeIdentityKind: "projected-worker",
      }),
    ).toBe("task_agent")
  })

  test("rejects a bound payload whose caller disagrees with the durable execution authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Catalog caller mismatch" })
        const messageID = Identifier.ascending("message")
        const parent = await Session.persistMessage({
          info: {
            id: messageID,
            sessionID: session.id,
            role: "user",
            author: "user",
            agent: "work",
            model: { providerID: "test-provider", modelID: "test-model" },
            time: { created: Date.now() },
          },
          parts: [
            {
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID,
              type: "text",
              text: "Reject the forged Mission caller.",
            },
          ],
        })
        const binding = await CatalogOccurrenceBinding.publish({
          projectID: Instance.project.id,
          payload: CatalogOccurrenceBinding.payload({
            snapshot: snapshot("mission"),
            materializationScope: scope(),
            permanentProviderBaseDefinition: permanentBaseDefinition(),
          }),
        })
        const reply = assistant({ sessionID: session.id, parentID: messageID })
        await CatalogOccurrenceBinding.bindAndBeginAssistant({
          projectID: Instance.project.id,
          assistant: reply,
          parent,
          binding,
        })
        await expect(
          CatalogOccurrenceBinding.readAssistant({
            projectID: Instance.project.id,
            sessionID: session.id,
            assistantMessageID: reply.id,
          }),
        ).rejects.toMatchObject<Partial<CorruptCatalogOccurrenceError>>({
          name: "CorruptCatalogOccurrenceError",
          code: "invalid_payload",
        })
      },
    })
  }, 0)

  test("maps partial carriers, duplicate carriers, and scope drift to exact occurrence errors", () => {
    const payload = CatalogOccurrenceBinding.payload({
      snapshot: snapshot(),
      materializationScope: scope(),
      permanentProviderBaseDefinition: permanentBaseDefinition(),
    })
    const message = (parts: Array<Record<string, unknown>>) =>
      ({
        info: {
          id: "message-binding-errors",
          sessionID: "session-binding-errors",
          role: "user" as const,
          author: "user",
          agent: "work",
          model: { providerID: "test-provider", modelID: "test-model" },
          time: { created: 1 },
          orderKey: "v1:test",
        },
        parts,
      }) as any
    expect(() =>
      CatalogOccurrenceBinding.bindingFromInput(
        message([
          {
            id: "part-partial",
            sessionID: "session-binding-errors",
            messageID: "message-binding-errors",
            type: "text",
            text: "partial",
            metadata: { catalog_snapshot_ref: "/attachment/project/partial.json" },
          },
        ]),
      ),
    ).toThrow(expect.objectContaining<Partial<CorruptCatalogOccurrenceError>>({ code: "partial_binding" }))
    expect(() =>
      CatalogOccurrenceBinding.bindingFromInput(
        message(
          ["one", "two"].map((id) => ({
            id: `part-${id}`,
            sessionID: "session-binding-errors",
            messageID: "message-binding-errors",
            type: "text",
            text: id,
            metadata: {
              catalog_snapshot_ref: `/attachment/project/${SHA_A}.json`,
              catalog_snapshot_hash: SHA_A,
            },
          })),
        ),
      ),
    ).toThrow(expect.objectContaining<Partial<CorruptCatalogOccurrenceError>>({ code: "duplicate_binding" }))
    expect(() =>
      CatalogOccurrenceBinding.assertCurrent({
        payload,
        materializationScope: scope("c".repeat(64)),
        permanentProviderBaseDefinition: permanentBaseDefinition(),
      }),
    ).toThrow(
      expect.objectContaining<Partial<StaleCatalogOccurrenceError>>({
        name: "StaleCatalogOccurrenceError",
        mismatches: ["materialization_scope.config_revision"],
      }),
    )
    expect(() =>
      CatalogOccurrenceBinding.assertCurrent({
        payload,
        materializationScope: scope(),
        permanentProviderBaseDefinition: {
          ...permanentBaseDefinition(),
          definitionDigest: SHA_B,
        },
      }),
    ).toThrow(
      expect.objectContaining<Partial<StaleCatalogOccurrenceError>>({
        name: "StaleCatalogOccurrenceError",
        mismatches: ["permanent_provider_base_definition"],
      }),
    )
  })

  test("keeps bound search immutable while owner generation advances", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        const payload = CatalogOccurrenceBinding.payload({
          snapshot: snapshot(),
          materializationScope: scope(),
          permanentProviderBaseDefinition: permanentBaseDefinition(),
        })
        const bound = CatalogOccurrenceBinding.searchSnapshot(payload)
        const before = searchCapabilityCatalog(bound, "conversation", { queries: ["discover"] })
        const firstGeneration = await CapabilityCatalogCache.invalidate("tool-registry")
        const secondGeneration = await CapabilityCatalogCache.invalidate("tool-registry")
        const after = searchCapabilityCatalog(bound, "conversation", { queries: ["discover"] })

        expect(firstGeneration).toEqual({ "tool-registry": 1 })
        expect(secondGeneration).toEqual({ "tool-registry": 2 })
        expect(after).toEqual(before)
        expect(after[0]?.ref.local_ref).toBe("capability_search")
      },
    })
  }, 0)

  test("advances the next-occurrence owner generation after a real Config settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await CapabilityCatalogCache.reset()
        expect(await CapabilityCatalogCache.ownerGeneration("tool-registry")).toBe(0)
        await Config.updateProjectPatch({ permission_mode: "ask" })
        expect(await CapabilityCatalogCache.ownerGeneration("tool-registry")).toBeGreaterThan(0)
        expect(await CapabilityCatalogCache.ownerGeneration("mcp-config")).toBeGreaterThan(0)
        expect(await CapabilityCatalogCache.ownerGeneration("skill-manager")).toBeGreaterThan(0)
      },
    })
  }, 0)

  test("collects every deterministic MCP Tool page and rejects a repeated cursor", async () => {
    const calls: Array<string | undefined> = []
    const tools = await MCP.TestHooks.collectToolDefinitionPages(async (cursor) => {
      calls.push(cursor)
      return cursor === undefined
        ? { tools: [{ name: "zeta", inputSchema: { type: "object" } } as any], nextCursor: "page-2" }
        : { tools: [{ name: "alpha", inputSchema: { type: "object" } } as any] }
    })
    expect(calls).toEqual([undefined, "page-2"])
    expect(tools.map((tool) => tool.name)).toEqual(["alpha", "zeta"])
    await expect(
      MCP.TestHooks.collectToolDefinitionPages(async () => ({
        tools: [{ name: "loop", inputSchema: { type: "object" } } as any],
        nextCursor: "same",
      })),
    ).rejects.toThrow("repeated tool pagination cursor same")
  })

  test("publishes one atomic scoped MCP inventory across removal and schema-changing listChanged", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "catalog-list-changed.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "let expanded=false;",
            "const oldSchema={type:'object',properties:{},additionalProperties:false};",
            "const newSchema={type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false};",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:true}},serverInfo:{name:'catalog-list-changed',version:'1'}}});",
            "if(request.method==='tools/list'){const first=!expanded;send({jsonrpc:'2.0',id:request.id,result:{tools:expanded?[{name:'activate',description:'activate v2',inputSchema:newSchema},{name:'successor',description:'successor tool',inputSchema:oldSchema}]:[{name:'activate',description:'activate v1',inputSchema:oldSchema},{name:'retiring',description:'retiring tool',inputSchema:oldSchema}]}});if(first){expanded=true;setTimeout(()=>send({jsonrpc:'2.0',method:'notifications/tools/list_changed'}),100);}return;}",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({
          type: "local",
          command: [process.execPath, fixture],
          timeout: 10_000,
        })
        const owner = MCP.createScopedConnectionOwner("catalog-list-changed-owner")
        const connection = {
          key: "catalog-list-changed",
          mcp,
          cwd: project.path,
          connectionOwner: owner,
          connectionIdentity: "catalog-list-changed-identity",
          processAuthority: MCP.hostProcessAuthority(project.path),
        }
        try {
          const initialSnapshot = await MCP.inspectScopedCapabilitySnapshot(connection)
          expect(initialSnapshot.tool_definitions.map((tool) => tool.name)).toEqual(["activate", "retiring"])
          const bindingsBefore = MCP.catalogToolBindings("catalog-list-changed", mcp, initialSnapshot)
          const activateBefore = MCP.toolAuthorityBinding(
            await MCP.scopedTool({ ...connection, toolName: "activate" }),
          )
          expect(bindingsBefore.map((binding) => binding.runtime_name)).toContain("catalog-list-changed_retiring")
          const before = owner.catalogSnapshot().owner_revision
          let after = owner.catalogSnapshot().owner_revision
          for (let attempt = 0; attempt < 100 && after === before; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 10))
            after = owner.catalogSnapshot().owner_revision
          }
          expect(after).not.toBe(before)
          const afterSnapshot = await MCP.inspectScopedCapabilitySnapshot(connection)
          const bindingsAfter = MCP.catalogToolBindings("catalog-list-changed", mcp, afterSnapshot)
          const activateAfter = MCP.toolAuthorityBinding(
            await MCP.scopedTool({ ...connection, toolName: "activate" }),
          )
          expect(bindingsAfter.map((binding) => binding.runtime_name)).toEqual([
            "catalog-list-changed_activate",
            "catalog-list-changed_successor",
          ])
          expect(activateAfter?.toolDigest).not.toBe(activateBefore?.toolDigest)
        } finally {
          await owner.close()
        }
      },
    })
  }, 0)

  test("converges five concurrent exact leaves on one identical immutable owner snapshot", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "catalog-concurrent-exact.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "const schema={type:'object',properties:{},additionalProperties:false};",
            "const names=['alpha','beta','delta','epsilon','gamma'];",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'catalog-concurrent-exact',version:'1'}}});",
            "if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:names.map(name=>({name,description:'exact '+name,inputSchema:schema}))}});",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 10_000 })
        const owner = MCP.createScopedConnectionOwner("catalog-concurrent-exact-owner")
        const connection = {
          key: "catalog-concurrent-exact",
          mcp,
          cwd: project.path,
          connectionOwner: owner,
          connectionIdentity: "catalog-concurrent-exact-identity",
          processAuthority: MCP.hostProcessAuthority(project.path),
        }
        const names = ["alpha", "beta", "delta", "epsilon", "gamma"]
        try {
          const inventory = await MCP.inspectScopedCapabilitySnapshot(connection)
          const ownerRevision = owner.catalogSnapshot().owner_revision
          const exact = await Promise.all(
            names.map((toolName) => MCP.exactScopedTool({ ...connection, toolName })),
          )
          expect({
            inventory: inventory.tool_definitions.map((definition) => definition.name),
            definitions: exact.map((tool) => tool.description),
            authorities: exact.map((tool) => MCP.toolAuthorityBinding(tool)!.toolDigest),
            assertions: exact.map((tool) => typeof MCP.exactToolAssertion(tool)),
            ownerRevision: owner.catalogSnapshot().owner_revision,
          }).toEqual({
            inventory: names,
            definitions: names.map((name) => `exact ${name}`),
            authorities: names.map(() => expect.stringMatching(/^[a-f0-9]{64}$/)),
            assertions: names.map(() => "function"),
            ownerRevision,
          })
        } finally {
          await owner.close()
        }
      },
    })
  }, 0)

  test("advances scoped MCP inventory while a long Tool call is still running", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const fixture = path.join(project.path, "catalog-long-call-list-changed.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "let changed=false;",
            "const schema={type:'object',properties:{},additionalProperties:false};",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:true}},serverInfo:{name:'catalog-long-call',version:'1'}}});",
            "if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'long_call',description:changed?'v2':'v1',inputSchema:schema}]}});",
            "if(request.method==='tools/call'){changed=true;send({jsonrpc:'2.0',method:'notifications/tools/list_changed'});setTimeout(()=>send({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:'done'}]}}),750);return;}",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 10_000 })
        const owner = MCP.createScopedConnectionOwner("catalog-long-call-owner")
        const connection = {
          key: "catalog-long-call",
          mcp,
          cwd: project.path,
          connectionOwner: owner,
          connectionIdentity: "catalog-long-call-identity",
          processAuthority: MCP.hostProcessAuthority(project.path),
        }
        try {
          const exact = await MCP.exactScopedTool({ ...connection, toolName: "long_call" })
          const authority = MCP.toolAuthorityBinding(exact)
          const assertCurrent = MCP.exactToolAssertion(exact)
          if (!authority || !assertCurrent || !exact.execute) {
            throw new Error("Exact long-call fixture did not publish its invocation authority.")
          }
          await assertCurrent()
          const before = owner.catalogSnapshot().owner_revision
          const session = await Session.create({ kind: "assistant", title: "MCP listChanged during long call" })
          const timeline = ["invocation_started"]
          const call = PermissionAuthority.authorizeAndExecute(
            {
              projectID: Instance.project.id,
              sessionID: session.id,
              messageID: "message_catalog_long_call",
              toolCallID: "call_catalog_long_call",
              providerKind: "mcp",
              providerID: connection.key,
              providerDigest: `${authority.configDigest}:${authority.toolDigest}`,
              toolName: "long_call",
              args: {},
            },
            () =>
              exact.execute!({}, {
                toolCallId: "call_catalog_long_call",
                messages: [],
                abortSignal: new AbortController().signal,
              }) as Promise<{ content: unknown }>,
          ).then((result) => {
            timeline.push("invocation_completed")
            return result
          })
          let after = owner.catalogSnapshot().owner_revision
          for (let attempt = 0; attempt < 100 && after === before; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 10))
            after = owner.catalogSnapshot().owner_revision
          }
          timeline.push("inventory_advanced")
          expect(after).not.toBe(before)
          expect((await call).content).toEqual([{ type: "text", text: "done" }])
          expect(timeline).toEqual(["invocation_started", "inventory_advanced", "invocation_completed"])
        } finally {
          await owner.close()
        }
      },
    })
  }, 0)

  test("converges when listChanged arrives before the in-flight tools/list response", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "catalog-reentrant-list-changed.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "let first=true;",
            "const schema={type:'object',properties:{},additionalProperties:false};",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:true}},serverInfo:{name:'catalog-reentrant',version:'1'}}});",
            "if(request.method==='tools/list'){if(first){first=false;send({jsonrpc:'2.0',method:'notifications/tools/list_changed'});setTimeout(()=>send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'retired',inputSchema:schema}]}}),100);return;}return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'current',inputSchema:schema}]}});}",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 2_000 })
        const owner = MCP.createScopedConnectionOwner("catalog-reentrant-owner")
        try {
          const snapshot = await MCP.inspectScopedCapabilitySnapshot({
            key: "catalog-reentrant",
            mcp,
            cwd: project.path,
            connectionOwner: owner,
            connectionIdentity: "catalog-reentrant-identity",
            processAuthority: MCP.hostProcessAuthority(project.path),
          })
          expect(snapshot.tool_definitions.map((tool) => tool.name)).toEqual(["current"])
          expect(owner.catalogSnapshot().entries[0]?.inventory_revision).toBe(snapshot.inventory_revision)
        } finally {
          await owner.close()
        }
      },
    })
  }, 0)

  test("rejects same-server and cross-server MCP runtime-name collisions without dropping capabilities", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "catalog-name-collision.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "const names=process.argv.includes('--same-server')?['a.b','a/b']:['same'];",
            "const schema={type:'object',properties:{},additionalProperties:false};",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'catalog-collision',version:'1'}}});",
            "if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:names.map(name=>({name,inputSchema:schema}))}});",
            "});",
          ].join("\n"),
        )
        const sameServer = Config.Mcp.parse({
          type: "local",
          command: [process.execPath, fixture, "--same-server"],
          timeout: 2_000,
        })
        const owner = MCP.createScopedConnectionOwner("catalog-collision-owner")
        try {
          const collisionInput = {
              key: "collision",
              mcp: sameServer,
              cwd: project.path,
              connectionOwner: owner,
              connectionIdentity: "catalog-collision-identity",
              processAuthority: MCP.hostProcessAuthority(project.path),
            }
          const collisionSnapshot = await MCP.inspectScopedCapabilitySnapshot(collisionInput)
          expect(() =>
            MCP.catalogToolBindings("collision", sameServer, collisionSnapshot),
          ).toThrow(expect.objectContaining<Partial<MCP.McpRuntimeNameCollisionError>>({
            name: "McpRuntimeNameCollisionError",
            owner_ref: "mcp-server:collision",
            runtime_name: "collision_a_b",
          }))
        } finally {
          await owner.close()
        }

        const one = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 2_000 })
        await Config.updateProjectPatch({ mcp: { "a.b": one, "a/b": one } })
        const config = await Config.get()
        await Promise.all([MCP.connect("a.b"), MCP.connect("a/b")])
        await expect(MCP.observedCatalogSnapshot(config)).rejects.toMatchObject<
          Partial<MCP.McpRuntimeNameCollisionError>
        >({
          name: "McpRuntimeNameCollisionError",
          owner_ref: "mcp-config",
          runtime_name: "a_b_same",
        })
      },
    })
  }, 0)

  test("publishes paginated shared MCP resources through the same listChanged snapshot", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "catalog-resource-pages.mjs")
        await writeFile(
          fixture,
          [
            "import readline from 'node:readline';",
            "const rl=readline.createInterface({input:process.stdin});",
            "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
            "let expanded=false;let notified=false;",
            "const resource=(name)=>({name,uri:'test://'+name,mimeType:'text/plain'});",
            "rl.on('line',(line)=>{const request=JSON.parse(line);",
            "if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{resources:{listChanged:true}},serverInfo:{name:'catalog-resources',version:'1'}}});",
            "if(request.method==='resources/list'){if(!request.params?.cursor)return send({jsonrpc:'2.0',id:request.id,result:{resources:[resource('one')],nextCursor:'page-2'}});send({jsonrpc:'2.0',id:request.id,result:{resources:[resource('two'),...(expanded?[resource('three')]:[])]}});if(!notified){notified=true;expanded=true;setTimeout(()=>send({jsonrpc:'2.0',method:'notifications/resources/list_changed'}),200);}return;}",
            "});",
          ].join("\n"),
        )
        const mcp = Config.Mcp.parse({ type: "local", command: [process.execPath, fixture], timeout: 2_000 })
        await Config.updateProjectPatch({ mcp: { "resource-pages": mcp } })
        const config = await Config.get()
        const initial = await MCP.resourcesForServers(config, ["resource-pages"])
        expect(Object.values(initial).map((resource) => resource.name).sort()).toEqual(["one", "two"])
        const before = (await MCP.observedCatalogSnapshot(config)).owner_revision
        let after = before
        for (let attempt = 0; attempt < 100 && after === before; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 10))
          after = (await MCP.observedCatalogSnapshot(config)).owner_revision
        }
        expect(after).not.toBe(before)
        const refreshed = await MCP.resourcesForServers(config, ["resource-pages"])
        expect(Object.values(refreshed).map((resource) => resource.name).sort()).toEqual(["one", "three", "two"])
      },
    })
  }, 0)
})
