import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { findInteractiveArtifact } from "../src/interactive-artifact/persist"
import {
  McpAppToolLifecycleOwnerConflictError,
  createMcpAppToolLifecycle,
  registerMcpAppToolLifecycleController,
  type McpAppToolLifecycleController,
} from "../src/interactive-artifact/mcp-app-lifecycle"
import type { MCP } from "../src/mcp"
import { Instance } from "../src/project/instance"
import { Message, Session } from "../src/session"
import { MessageStore } from "../src/session/message-store"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function binding(configDigest: string): MCP.AppToolBinding {
  const tool = {
    name: "render",
    description: "Render one exact MCP App participant",
    inputSchema: {
      type: "object" as const,
      properties: { value: { type: "string" as const } },
      required: ["value"],
      additionalProperties: false,
    },
    _meta: { ui: { resourceUri: "ui://render" } },
  }
  return {
    serverID: "render-server",
    configDigest,
    tool,
    resourceURI: "ui://render",
    withClient: async (run) =>
      run(
        {
          getServerCapabilities: () => ({ resources: {} }),
          listResources: async () => ({ resources: [] }),
          readResource: async () => ({
            contents: [
              {
                uri: "ui://render",
                mimeType: "text/html;profile=mcp-app",
                text: "<!doctype html><title>Render</title><main>Lifecycle owner</main>",
              },
            ],
          }),
        } as never,
        1_000,
      ),
  }
}

async function assistantOccurrence() {
  const session = await Session.create({ kind: "assistant", title: "MCP App lifecycle owner" })
  const userID = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id: userID,
      sessionID: session.id,
      role: "user",
      author: "user",
      agent: "work",
      model: { providerID: "test-provider", modelID: "test-model" },
      time: { created: Date.now() },
    },
    parts: [],
  })
  const assistant = Message.Assistant.parse({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    parentID: userID,
    acceptedInputMessageIDs: [userID],
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
  await Session.persistMessage({ info: assistant, parts: [] })
  return { session, assistant }
}

test("reuses one exact MCP App lifecycle identity from partial input through final completion", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { session, assistant } = await assistantOccurrence()
      const input = {
        sessionID: session.id,
        messageID: assistant.id,
        binding: binding("a".repeat(64)),
        authority: { kind: "configured" as const },
      }
      const first = createMcpAppToolLifecycle(input)
      const sameIdentity = createMcpAppToolLifecycle({ ...input, binding: { ...input.binding } })
      const registry = new Map<string, McpAppToolLifecycleController>()
      const canonical = registerMcpAppToolLifecycleController(registry, "render", first)
      const reentered = registerMcpAppToolLifecycleController(registry, "render", sameIdentity)

      expect({ sameController: reentered === canonical, identity: canonical.identity }).toEqual({
        sameController: true,
        identity: {
          session_id: session.id,
          message_id: assistant.id,
          server_id: "render-server",
          config_digest: "a".repeat(64),
          tool_definition_digest: expect.stringMatching(/^[a-f0-9]{64}$/),
          resource_uri: "ui://render",
          authority: { kind: "configured" },
        },
      })

      await canonical.partial("call_render", { value: "par" })
      expect(reentered.started("call_render")).toBe(true)
      await reentered.complete(
        "call_render",
        { value: "final" },
        { content: [{ type: "text", text: "completed" }] },
      )

      const parts = await MessageStore.parts(assistant.id)
      const trace = parts.flatMap((part) => {
        if (part.type !== "interactive-artifact") return []
        const artifact = findInteractiveArtifact({
          projectID: Instance.project.id,
          sessionID: session.id,
          artifactID: part.artifactID,
        })
        if (!artifact || artifact.payload.renderer !== "mcp-app@1") {
          throw new Error(`Expected MCP App artifact ${part.artifactID}`)
        }
        return [{ type: part.type, artifactID: part.artifactID, lifecycle: artifact.payload.tool.lifecycle }]
      })
      expect(trace).toEqual([
        {
          type: "interactive-artifact",
          artifactID: expect.stringMatching(/^art_/),
          lifecycle: {
            status: "completed",
            input: { value: "final" },
            result: { content: [{ type: "text", text: "completed" }] },
          },
        },
      ])
    },
  })
}, 60_000)

test("returns a typed owner conflict for one provider name with a different immutable MCP App identity", () => {
  const registry = new Map<string, McpAppToolLifecycleController>()
  const first = createMcpAppToolLifecycle({
    sessionID: "session-owner-conflict",
    messageID: "message-owner-conflict",
    binding: binding("a".repeat(64)),
    authority: { kind: "configured" },
  })
  const conflicting = createMcpAppToolLifecycle({
    sessionID: "session-owner-conflict",
    messageID: "message-owner-conflict",
    binding: binding("b".repeat(64)),
    authority: { kind: "configured" },
  })
  registerMcpAppToolLifecycleController(registry, "render", first)

  expect(() => registerMcpAppToolLifecycleController(registry, "render", conflicting)).toThrow(
    expect.objectContaining<Partial<McpAppToolLifecycleOwnerConflictError>>({
      name: "McpAppToolLifecycleOwnerConflictError",
      tool_name: "render",
      existing_identity: expect.objectContaining({ config_digest: "a".repeat(64) }),
      candidate_identity: expect.objectContaining({ config_digest: "b".repeat(64) }),
    }),
  )
})
