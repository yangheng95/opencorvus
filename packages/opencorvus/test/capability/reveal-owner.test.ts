import { afterAll, describe, expect, test } from "bun:test"
import { tool } from "ai"
import z from "zod"
import fs from "node:fs/promises"
import path from "node:path"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Message, Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import {
  CatalogOccurrenceBinding,
  type CatalogSnapshotBindingV2,
} from "../../src/capability/catalog-binding"
import { createCapabilityCatalogSnapshot } from "../../src/capability/catalog"
import {
  CapabilitySearchInput,
  createCapabilityCatalogProjection,
  createCapabilityCatalogSource,
  createCapabilityCatalogViewEntry,
  createCapabilityDescriptor,
} from "../../src/capability/descriptor"
import { bindHarnessProjection, createHarnessGrantSet } from "../../src/capability/harness-projection"
import {
  CapabilityRevealAuthorizationError,
  CapabilityRevealConflictError,
  createCapabilityRevealOwner,
} from "../../src/capability/reveal-owner"
import { CAPABILITY_REVEAL_RECEIPT_METADATA_KEY } from "../../src/capability/reveal-receipt"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const SHA_A = "a".repeat(64)
const SHA_B = "b".repeat(64)
const searchRef = capabilityRef({
  kind: "tool",
  source: "platform",
  owner_ref: "tool-registry",
  local_ref: "capability_search",
})
const readRef = capabilityRef({
  kind: "tool",
  source: "platform",
  owner_ref: "tool-registry",
  local_ref: "read",
})

function catalogSnapshot() {
  const search = createCapabilityDescriptor({
    ref: searchRef,
    name: "Capability search",
    description: "Search and reveal exact capabilities.",
    aliases: [],
    search_terms: ["discover"],
    behavior: { kind: "call_tool", tool_ref: searchRef },
  })
  const read = createCapabilityDescriptor({
    ref: readRef,
    name: "Read",
    description: "Read one exact file.",
    aliases: [],
    search_terms: ["file"],
    behavior: { kind: "call_tool", tool_ref: readRef },
  })
  return createCapabilityCatalogSnapshot({
    context: { caller: "conversation", context_ref: "conversation:work", context_revision: SHA_A },
    sources: [
      createCapabilityCatalogSource({
        owner_ref: "tool-registry",
        owner_revision: SHA_A,
        descriptors: [search, read],
        sets: [],
      }),
    ],
    projections: [
      createCapabilityCatalogProjection({
        owner_ref: "tool-registry",
        projection_revision: SHA_B,
        entries: [search, read].map((descriptor) =>
          createCapabilityCatalogViewEntry({
            descriptor_ref: descriptor.ref,
            descriptor_digest: descriptor.metadata_digest,
            discoverable_by: ["conversation"],
            availability: "visible",
            next_owner: { kind: "call_tool", tool_id: descriptor.ref.local_ref },
          }),
        ),
      }),
    ],
  })
}

function materializationScope() {
  return {
    provider_id: "test-provider",
    model_id: "test-model",
    api_npm: "@ai-sdk/openai-compatible",
    config_revision: SHA_A,
    plugin_revision: SHA_B,
  }
}

function assistant(sessionID: string, parentID: string) {
  return Message.Assistant.parse({
    id: Identifier.ascending("message"),
    sessionID,
    parentID,
    acceptedInputMessageIDs: [parentID],
    role: "assistant",
    author: "work",
    agent: "work",
    providerID: "test-provider",
    modelID: "test-model",
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
}

async function runningSearchPart(input: {
  sessionID: string
  messageID: string
  callID: string
  params: z.output<typeof CapabilitySearchInput>
}) {
  return Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: input.callID,
    tool: "capability_search",
    state: { status: "running", input: input.params, time: { start: Date.now() } },
  }) as Promise<Message.ToolPart>
}

async function boundOccurrence() {
  const session = await Session.create({ kind: "assistant", title: "Reveal occurrence" })
  const userMessageID = Identifier.ascending("message")
  const user = await Session.persistMessage({
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
        id: Identifier.ascending("part"),
        sessionID: session.id,
        messageID: userMessageID,
        type: "text",
        text: "Read a file.",
        kind: "user_content",
      },
    ],
  })
  const payload = CatalogOccurrenceBinding.payload({
    snapshot: catalogSnapshot(),
    materializationScope: materializationScope(),
  })
  const binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
  const first = assistant(session.id, userMessageID)
  await CatalogOccurrenceBinding.bindAndBeginAssistant({
    projectID: Instance.project.id,
    assistant: first,
    parent: user,
    binding,
  })
  return { session, userMessageID, binding, first }
}

function revealOwner(input: { occurrenceID: string; binding: CatalogSnapshotBindingV2; barrier?: () => Promise<void> }) {
  const harness = bindHarnessProjection(
    createHarnessGrantSet({
      context: { kind: "conversation", agent_id: "work" },
      owner_revision: SHA_A,
      grants: [searchRef, readRef].map((ref) => ({ ref, access: "discover_execute" as const })),
    }),
    input.binding,
  )
  return createCapabilityRevealOwner({
    projectID: Instance.project.id,
    model: {} as never,
    occurrenceID: input.occurrenceID,
    harness,
    baseDefinition: {
      definitionDigest: "e".repeat(64),
      payloadChars: 120,
      payloadTokens: 30,
    },
    async materialize(_requestedRef, executableRef) {
      await input.barrier?.()
      return {
        providerName: executableRef.local_ref,
        executableRef,
        materializerBindingDigest: "d".repeat(64),
        tool: tool({
          description: "Read one exact file.",
          inputSchema: z.object({ path: z.string() }).strict(),
          async execute() {
            return { output: "unused", title: "Read", metadata: {} }
          },
        }),
      }
    },
  })
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("occurrence capability reveal owner", () => {
  test("binds an MCP server execute grant to that server's exact child Tools", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const serverA = capabilityRef({
          kind: "mcp_server",
          source: "project",
          owner_ref: "mcp-config",
          local_ref: "alpha",
        })
        const serverB = capabilityRef({
          kind: "mcp_server",
          source: "project",
          owner_ref: "mcp-config",
          local_ref: "beta",
        })
        const toolA = capabilityRef({
          kind: "mcp_tool",
          source: "project",
          owner_ref: "mcp-config",
          local_ref: "alpha_run",
        })
        const toolB = capabilityRef({
          kind: "mcp_tool",
          source: "project",
          owner_ref: "mcp-config",
          local_ref: "beta_run",
        })
        const serverDescriptors = [serverA, serverB].map((ref) =>
          createCapabilityDescriptor({
            ref,
            name: ref.local_ref,
            description: `${ref.local_ref} MCP server`,
            aliases: [],
            search_terms: [ref.local_ref],
            behavior: { kind: "unavailable", reason_code: "mcp_server_managed_in_settings" },
          }),
        )
        const toolDescriptors = [toolA, toolB].map((ref) =>
          createCapabilityDescriptor({
            ref,
            name: ref.local_ref,
            description: `${ref.local_ref} MCP Tool`,
            aliases: [],
            search_terms: [ref.local_ref],
            behavior: { kind: "call_tool", tool_ref: ref },
          }),
        )
        const snapshot = createCapabilityCatalogSnapshot({
          context: { caller: "conversation", context_ref: "conversation:mcp", context_revision: SHA_A },
          sources: [
            createCapabilityCatalogSource({
              owner_ref: "mcp-config",
              owner_revision: SHA_A,
              descriptors: [...serverDescriptors, ...toolDescriptors],
              sets: [],
            }),
          ],
          projections: [
            createCapabilityCatalogProjection({
              owner_ref: "mcp-config",
              projection_revision: SHA_B,
              entries: toolDescriptors.map((descriptor) =>
                createCapabilityCatalogViewEntry({
                  descriptor_ref: descriptor.ref,
                  descriptor_digest: descriptor.metadata_digest,
                  discoverable_by: ["conversation"],
                  availability: "visible",
                  next_owner: { kind: "call_tool", tool_id: descriptor.ref.local_ref },
                }),
              ),
            }),
          ],
        })
        const session = await Session.create({ kind: "assistant", title: "MCP parent reveal authority" })
        const userMessageID = Identifier.ascending("message")
        const user = await Session.persistMessage({
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
              id: Identifier.ascending("part"),
              sessionID: session.id,
              messageID: userMessageID,
              type: "text",
              text: "Use one exact MCP Tool.",
              kind: "user_content",
            },
          ],
        })
        const payload = CatalogOccurrenceBinding.payload({
          snapshot,
          materializationScope: materializationScope(),
          mcpToolParentBindings: [
            { tool_ref: toolA, server_ref: serverA },
            { tool_ref: toolB, server_ref: serverB },
          ],
        })
        const binding = await CatalogOccurrenceBinding.publish({ projectID: Instance.project.id, payload })
        const current = assistant(session.id, userMessageID)
        await CatalogOccurrenceBinding.bindAndBeginAssistant({
          projectID: Instance.project.id,
          assistant: current,
          parent: user,
          binding,
        })
        const harness = bindHarnessProjection(
          createHarnessGrantSet({
            context: { kind: "conversation", agent_id: "work" },
            owner_revision: SHA_A,
            grants: [
              { ref: searchRef, access: "discover_execute" },
              { ref: serverA, access: "discover_execute", descendant_scope: ["mcp_tool"] },
              { ref: serverB, access: "discover", descendant_scope: ["mcp_tool"] },
            ],
          }),
          binding,
        )
        const owner = createCapabilityRevealOwner({
          projectID: Instance.project.id,
          model: {} as never,
          occurrenceID: userMessageID,
          harness,
          baseDefinition: { definitionDigest: "e".repeat(64), payloadChars: 120, payloadTokens: 30 },
          async materialize(_requestedRef, executableRef) {
            return {
              providerName: executableRef.local_ref,
              executableRef,
              materializerBindingDigest: "d".repeat(64),
              tool: tool({
                description: executableRef.local_ref,
                inputSchema: z.object({}).strict(),
                execute: async () => executableRef.local_ref,
              }),
            }
          },
        })

        const denied = CapabilitySearchInput.parse({ queries: ["beta"], exact_refs: [toolB] })
        const deniedPart = await runningSearchPart({
          sessionID: session.id,
          messageID: current.id,
          callID: "call_beta_denied",
          params: denied,
        })
        await expect(
          owner.execute(denied, {
            callID: "call_beta_denied",
            messageID: current.id,
            sessionID: session.id,
            toolPartID: deniedPart.id,
          }),
        ).rejects.toBeInstanceOf(CapabilityRevealAuthorizationError)

        const allowed = CapabilitySearchInput.parse({ queries: ["alpha"], exact_refs: [toolA] })
        const allowedPart = await runningSearchPart({
          sessionID: session.id,
          messageID: current.id,
          callID: "call_alpha_allowed",
          params: allowed,
        })
        const result = await owner.execute(allowed, {
          callID: "call_alpha_allowed",
          messageID: current.id,
          sessionID: session.id,
          toolPartID: allowedPart.id,
        })
        expect(result.metadata).toMatchObject({ active_ref_count: 1, reveal_revision: 1 })
      },
    })
  })

  test("commits a receipt on one assistant step and reconstructs it from the next step", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await boundOccurrence()
        const params = CapabilitySearchInput.parse({ queries: ["read file"], exact_refs: [readRef] })
        const part = await runningSearchPart({
          sessionID: occurrence.session.id,
          messageID: occurrence.first.id,
          callID: "call_reveal_read",
          params,
        })
        const owner = revealOwner({ occurrenceID: occurrence.userMessageID, binding: occurrence.binding })
        const result = await owner.execute(params, {
          callID: "call_reveal_read",
          messageID: occurrence.first.id,
          sessionID: occurrence.session.id,
          toolPartID: part.id,
        })
        expect(result.metadata).toMatchObject({ reveal_revision: 1, active_ref_count: 1, truncated: false })
        const replayed = await owner.execute(params, {
          callID: "call_reveal_read",
          messageID: occurrence.first.id,
          sessionID: occurrence.session.id,
          toolPartID: part.id,
        })
        expect(replayed).toEqual(result)
        const persisted = await MessageStore.parts(occurrence.first.id)
        const completed = persisted.find(
          (candidate): candidate is Message.ToolPart => candidate.type === "tool" && candidate.id === part.id,
        )
        expect(completed?.state.status).toBe("completed")
        if (!completed || completed.state.status !== "completed") throw new Error("Reveal ToolPart did not complete")
        expect(completed.state.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY]).toMatchObject({
          occurrence_id: occurrence.userMessageID,
          revision: 1,
          active_refs: [readRef],
        })

        const second = assistant(occurrence.session.id, occurrence.userMessageID)
        await Session.beginAssistantReply(second)
        const deactivate = CapabilitySearchInput.parse({ queries: [""], deactivate_refs: [readRef] })
        expect(deactivate).toEqual({
          queries: [""],
          exact_refs: [],
          deactivate_refs: [readRef],
          limit: 5,
        })
        const secondPart = await runningSearchPart({
          sessionID: occurrence.session.id,
          messageID: second.id,
          callID: "call_deactivate_read",
          params: deactivate,
        })
        const secondResult = await owner.execute(deactivate, {
          callID: "call_deactivate_read",
          messageID: second.id,
          sessionID: occurrence.session.id,
          toolPartID: secondPart.id,
        })
        expect(secondResult.metadata).toMatchObject({ reveal_revision: 2, active_ref_count: 0 })

        const third = assistant(occurrence.session.id, occurrence.userMessageID)
        await Session.beginAssistantReply(third)
        const idempotentPart = await runningSearchPart({
          sessionID: occurrence.session.id,
          messageID: third.id,
          callID: "call_deactivate_read_again",
          params: deactivate,
        })
        const idempotentResult = await owner.execute(deactivate, {
          callID: "call_deactivate_read_again",
          messageID: third.id,
          sessionID: occurrence.session.id,
          toolPartID: idempotentPart.id,
        })
        expect(idempotentResult.metadata).toMatchObject({ reveal_revision: 3, active_ref_count: 0 })
      },
    })
  }, 0)

  test("settles concurrent reveal preparation through one revision compare-and-swap winner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await boundOccurrence()
        const second = assistant(occurrence.session.id, occurrence.userMessageID)
        await Session.beginAssistantReply(second)
        const params = CapabilitySearchInput.parse({ queries: ["read"], exact_refs: [readRef] })
        const [leftPart, rightPart] = await Promise.all([
          runningSearchPart({
            sessionID: occurrence.session.id,
            messageID: occurrence.first.id,
            callID: "call_reveal_left",
            params,
          }),
          runningSearchPart({
            sessionID: occurrence.session.id,
            messageID: second.id,
            callID: "call_reveal_right",
            params,
          }),
        ])
        let arrivals = 0
        let release!: () => void
        const ready = new Promise<void>((resolve) => {
          release = resolve
        })
        const owner = revealOwner({
          occurrenceID: occurrence.userMessageID,
          binding: occurrence.binding,
          barrier: async () => {
            arrivals += 1
            if (arrivals === 2) release()
            await ready
          },
        })
        const results = await Promise.allSettled([
          owner.execute(params, {
            callID: "call_reveal_left",
            messageID: occurrence.first.id,
            sessionID: occurrence.session.id,
            toolPartID: leftPart.id,
          }),
          owner.execute(params, {
            callID: "call_reveal_right",
            messageID: second.id,
            sessionID: occurrence.session.id,
            toolPartID: rightPart.id,
          }),
        ])
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
        const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected")
        expect(failure?.reason).toBeInstanceOf(CapabilityRevealConflictError)
        expect((failure?.reason as Error).message).toContain("compare-and-swap expected revision 0, current is 1")
      },
    })
  }, 0)

  test("settles the revision compare-and-swap across two operating-system processes", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "capability-reveal-process-state.json")
    const setup = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await boundOccurrence()
        const second = assistant(occurrence.session.id, occurrence.userMessageID)
        await Session.beginAssistantReply(second)
        const params = CapabilitySearchInput.parse({ queries: ["read"], exact_refs: [readRef] })
        const [left, right] = await Promise.all([
          runningSearchPart({
            sessionID: occurrence.session.id,
            messageID: occurrence.first.id,
            callID: "call_process_reveal_left",
            params,
          }),
          runningSearchPart({
            sessionID: occurrence.session.id,
            messageID: second.id,
            callID: "call_process_reveal_right",
            params,
          }),
        ])
        const workers = [
          {
            occurrenceID: occurrence.userMessageID,
            sessionID: occurrence.session.id,
            messageID: occurrence.first.id,
            callID: "call_process_reveal_left",
            toolPartID: left.id,
            binding: occurrence.binding,
          },
          {
            occurrenceID: occurrence.userMessageID,
            sessionID: occurrence.session.id,
            messageID: second.id,
            callID: "call_process_reveal_right",
            toolPartID: right.id,
            binding: occurrence.binding,
          },
        ]
        await fs.writeFile(statePath, JSON.stringify(workers))
        return { occurrence, workers }
      },
    })
    await Instance.disposeAll()

    const processes = setup.workers.map((worker, index) => {
      const workerStatePath = `${statePath}.${index}.json`
      return fs.writeFile(workerStatePath, JSON.stringify(worker)).then(() => ({
        workerStatePath,
        child: Bun.spawn(
          [process.execPath, "test/fixture/capability-reveal-process-worker.ts", project.path, workerStatePath, String(index)],
          {
            cwd: path.resolve(import.meta.dir, "../.."),
            env: { ...process.env },
            stdout: "pipe",
            stderr: "pipe",
          },
        ),
      }))
    })
    const children = await Promise.all(processes)
    const readyDeadline = Date.now() + 20_000
    for (const { workerStatePath } of children) {
      while (true) {
        try {
          await fs.access(`${workerStatePath}.${children.findIndex((entry) => entry.workerStatePath === workerStatePath)}.ready`)
          break
        } catch {
          if (Date.now() >= readyDeadline) throw new Error("Cross-process capability reveal did not reach its barrier.")
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
    }
    await Promise.all(children.map(({ workerStatePath }) => fs.writeFile(`${workerStatePath}.release`, "release")))
    const results = await Promise.all(
      children.map(async ({ child }) => {
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        expect(exitCode, stderr).toBe(0)
        const marker = stdout
          .split(/\r?\n/)
          .find((line) => line.startsWith("CAPABILITY_REVEAL_RESULT="))
        if (!marker) throw new Error(`Capability reveal worker returned no result marker: ${stdout}`)
        return JSON.parse(marker.slice("CAPABILITY_REVEAL_RESULT=".length)) as { status: string }
      }),
    )
    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "fulfilled"])

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const parts = (
          await Promise.all(setup.workers.map((worker) => MessageStore.parts(worker.messageID)))
        ).flat()
        expect(
          parts.filter(
            (part) =>
              part.type === "tool" &&
              part.tool === "capability_search" &&
              part.state.status === "completed" &&
              part.state.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY] !== undefined,
          ),
        ).toHaveLength(1)
      },
    })
  }, 60_000)
})
