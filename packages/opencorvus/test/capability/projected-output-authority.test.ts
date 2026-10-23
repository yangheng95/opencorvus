import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import z from "zod"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { HostAgentRegistry } from "../../src/agent/host-agent-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { configureTaskIngressRunner } from "../../src/engine/task-root-ingress-delivery"
import { requireTask } from "../../src/engine/store"
import { ExpertSquadConversationAuthoring } from "../../src/expert-squad/conversation-authoring"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { MCP } from "../../src/mcp"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { SessionProcessor } from "../../src/session/processor"
import { SessionRuntimeContractStore } from "../../src/session/runtime-contract"
import { createRuntimeToolOwner } from "../../src/session/runtime-tool-owner"
import { EngineService } from "../../src/task-api"
import { buildExpertSquadAuthorDefinition } from "../../src/tool/expert-squad-author"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const providerModel = {
  id: "projected-output-contract",
  providerID: "test",
  name: "Projected output contract",
  api: { id: "projected-output-contract", npm: "@ai-sdk/anthropic" },
  options: {},
  limit: { context: 100000, input: 90000, output: 4096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
} as Provider.Model

for (const [family, representation] of [
  ["package-tool", "text"],
  ["package-mcp", "text"],
  ["default-mcp", "text"],
  ["package-mcp", "structured"],
  ["default-mcp", "structured"],
] as const)
  test(`${family} preserves oversized ${representation} output in its exact Task and Session directory`, async () => {
    await using project = await memoryProject()
    const calls: string[] = []
    const mcpServers = new Set<McpServer>()
    const http = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const server = new McpServer({ name: "projected-output-contract", version: "1.0.0" })
        mcpServers.add(server)
        server.registerTool(
          "emit",
          {
            description: "Return the exact requested public test text.",
            inputSchema: { text: z.string() },
            ...(representation === "structured" ? { outputSchema: { report: z.string() } } : {}),
          },
          async ({ text }) => {
            calls.push(text)
            return representation === "structured"
              ? { content: [], structuredContent: { report: text } }
              : { content: [{ type: "text" as const, text }] }
          },
        )
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        })
        await server.connect(transport)
        return transport.handleRequest(request)
      },
    })
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const id = `output-${family}`
          const ref =
            family === "package-tool"
              ? `${id}/shared/emit`
              : family === "package-mcp"
                ? `${id}/shared/output/tool/emit`
                : "default/mcp/output/tool/emit"
          const declared = capabilityRef({
            kind: family === "package-tool" ? "tool" : "mcp_tool",
            source: family === "default-mcp" ? "project" : "package",
            owner_ref: family === "default-mcp" ? "default-mcp-registry" : id,
            local_ref: ref,
          })
          const mcp = {
            type: "remote" as const,
            transport: "streamable-http" as const,
            url: http.url.href,
            oauth: false as const,
            timeout: 10000,
          }
          const extraFiles: Record<string, string> =
            family === "package-tool"
              ? {
                  "tools/emit.ts": `import { tool } from "@opencorvus-ai/plugin"
export default tool({ description: "Return the exact requested public test text.",
args: { text: tool.schema.string() }, async execute(args) { return args.text } })`,
                }
              : family === "package-mcp"
                ? { "mcp/output.json": JSON.stringify({ ...mcp, capabilities: { tools: ["emit"] } }) }
                : {}
          await ExpertSquadConversationAuthoring.author({
            projectDirectory: project.path,
            installationScope: "project",
            definition: buildExpertSquadAuthorDefinition({
              schema_version: 2,
              namespace: "test",
              id,
              label: "Projected output contract",
              description: "Exercise the actual projected result boundary.",
              version: "2026.10.13.1",
              product_pillars: ["work"],
              readme: "# Projected output contract\n",
              selector: {
                summary: "Output contract",
                selection_guidance: "Local output contract only",
                instructions: "# Local selection\n",
              },
              scheduler: {
                prompt: "Read the requested public test text.",
                capability_refs: [
                  CapabilityRefCodec.encode(declared),
                  CapabilityRefCodec.encode(
                    capabilityRef({ kind: "tool", source: "platform", owner_ref: "tool-registry", local_ref: "read" }),
                  ),
                ].sort(),
              },
              agents: {
                "output-worker": {
                  label: "Worker",
                  description: "Package worker",
                  base_role: "build",
                  prompt: "Local work",
                },
              },
              virtual_workflows: {},
              extra_files: extraFiles,
            }),
          })
          await Config.updateProjectPatch({
            prompt_profile: { active: id },
            ...(family === "default-mcp" ? { mcp: { output: mcp } } : {}),
          })
          const config = await Config.get()
          const { schedulerCapability: capability, skillProjection } =
            await PromptProfileResolver.resolveSchedulerTurnProjection({ projectDirectory: project.path, config })
          const providerName =
            family === "package-tool"
              ? capability.packageTools[0]!.providerName
              : family === "package-mcp"
                ? capability.packageMcpTools[0]!.providerName
                : capability.defaultMcpTools[0]!.providerName
          // Task ingress/model execution is outside this backend contract. The
          // selected runtime and tool calls below use real persisted ownership.
          configureTaskIngressRunner(async () => {})
          const taskID = await EngineService.createTask(
            {
              requestID: `projected-output-${family}`,
              request: "Exercise the projected output boundary",
              productPillar: "work",
              model: "firmware/gpt-5",
              promptProfile: id,
              expectedPackageDigest: capability.packageRevision.packageDigest,
            },
            { actor: "user" },
          )
          const executedBodies: string[] = []
          const recovered: Array<{ sessionID: string; path: string }> = []
          for (const boundary of representation === "structured" ? (["bytes"] as const) : (["bytes", "lines"] as const)) {
            const session = await Session.create({
              kind: "orchestrator",
              parentID: requireTask(taskID).session_id!,
              title: `Projected output ${boundary}`,
            })
            const owner = MCP.createScopedConnectionOwner(`projected-output-${session.id}`)
            SessionRuntimeContractStore.set(session.id, {
              identity: {
                identityKind: "projected-scheduler",
                sessionID: session.id,
                ...capability.identity,
                expertSquadID: id,
                packageRevision: capability.packageRevision,
                taskID,
                contractKind: "orchestrator-wake",
                installedAt: Date.now(),
              },
              skillProjection,
              harnessGrants: PromptProfileResolver.schedulerHarnessGrants({ taskID, capability, projectedToolIDs: [] }),
              projectDirectory: project.path,
              includeMcpTools: false,
              system: [],
              systemMode: "complete",
              resources: { mcp: owner, tools: createRuntimeToolOwner({ leaves: [] }) },
            })
            try {
              for (const over of [false, true]) {
                const text =
                  boundary === "bytes"
                    ? "x".repeat(51200 + Number(over) - (representation === "structured" ? 13 : 0))
                    : Array.from({ length: 2000 + Number(over) }, (_, index) => `line ${index + 1}`).join("\n")
                // The structured representation includes the 13 bytes in {"report":""}.
                const body = representation === "structured" ? JSON.stringify({ report: text }) : text
                const user = await Session.updateMessage({
                  id: Identifier.ascending("message"),
                  sessionID: session.id,
                  role: "user",
                  author: "orchestrator",
                  agent: "orchestrator",
                  time: { created: Date.now() },
                  model: { providerID: providerModel.providerID, modelID: providerModel.id },
                })
                await Session.updatePart({
                  id: Identifier.ascending("part"),
                  sessionID: session.id,
                  messageID: user.id,
                  type: "text",
                  kind: "user_content",
                  text: `Read ${boundary} boundary ${over ? "over" : "exact"}.`,
                })
                const assistant = {
                  id: Identifier.ascending("message"),
                  sessionID: session.id,
                  parentID: user.id,
                  role: "assistant" as const,
                  author: "orchestrator",
                  agent: "orchestrator",
                  path: { cwd: project.path, root: project.path },
                  cost: 0,
                  tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
                  modelID: providerModel.id,
                  providerID: providerModel.providerID,
                  time: { created: Date.now() },
                }
                const processor = SessionProcessor.create({
                  assistantMessage: assistant,
                  sessionID: session.id,
                  model: providerModel,
                  abort: new AbortController().signal,
                })
                const resolved = await resolveTestCapabilityTools({
                  config,
                  model: providerModel,
                  session: await Session.get(session.id),
                  assistant,
                  processor,
                  agent: sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config })),
                  agentID: "orchestrator",
                  messages: await Session.messages({ sessionID: session.id }),
                  activeLocalRefs: [providerName],
                })
                if (family === "package-tool") {
                  const declared = resolved.occurrence.payload.descriptors.find((entry) => entry.ref.kind === "tool" && entry.ref.local_ref === providerName)
                  expect({ name: declared?.name, description: declared?.description }).toEqual({ name: providerName, description: "Return the exact requested public test text." })
                }
                const args = { text }
                const call = Identifier.ascending("tool")
                const result = (await resolved.tools[providerName]!.execute!(args, {
                  toolCallId: call,
                  messages: [],
                  abortSignal: new AbortController().signal,
                })) as {
                  output: string
                  metadata: { truncated: boolean; outputPath?: string }
                }
                executedBodies.push(text)
                expect(result.metadata.truncated).toBe(over)
                if (!over) expect(result.output).toBe(body)
                else {
                  const outputPath = result.metadata.outputPath!
                  expect(path.dirname(outputPath)).toBe(
                    ProjectRuntimePaths.toolOutputDir(project.path, taskID, session.id),
                  )
                  expect(await fs.readFile(outputPath, "utf8")).toBe(body)
                  const preview = boundary === "bytes" ? "" : body.split("\n").slice(1).join("\n")
                  const removed = boundary === "bytes" ? "51201 bytes" : "1 lines"
                  expect(result.output).toBe(
                    `...${removed} truncated...\n\nThe tool call succeeded but the output was truncated. Full output saved to: ${outputPath}\nUse Read with offset/limit to view the required sections.\n\n${preview}`,
                  )
                  recovered.push({ sessionID: session.id, path: outputPath })
                }
                await processor.completeRecoveredToolPart({ toolCallID: call, toolInput: args, output: result })
                const completed = (await MessageStore.get({ sessionID: session.id, messageID: assistant.id })).parts.find(
                  (part) => part.type === "tool" && part.callID === call,
                )
                expect(completed).toMatchObject({
                  type: "tool",
                  callID: call,
                  state: { status: "completed", output: result.output, metadata: result.metadata },
                })
              }
            } finally {
              await SessionRuntimeContractStore.dispose(session.id)
            }
          }
          expect(recovered.map(({ sessionID, path: outputPath }) => path.dirname(outputPath))).toEqual(
            recovered.map(({ sessionID }) => ProjectRuntimePaths.toolOutputDir(project.path, taskID, sessionID)),
          )
          expect(new Set(recovered.map((entry) => entry.sessionID)).size).toBe(representation === "structured" ? 1 : 2)
          if (family !== "package-tool") expect(calls).toEqual(executedBodies)
          console.log(
            JSON.stringify({
              family,
              representation,
              taskID,
              projectID: Instance.project.id,
              outputs: recovered,
              executedCalls: executedBodies.length,
            }),
          )
        },
      })
    } finally {
      for (const server of mcpServers) await server.close()
      await http.stop(true)
    }
  }, 120000)
