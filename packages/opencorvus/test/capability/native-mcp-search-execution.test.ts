import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { CatalogOccurrenceBinding, StaleCatalogOccurrenceError } from "../../src/capability/catalog-binding"
import { searchCapabilityCatalog } from "../../src/capability/catalog"
import { Config } from "../../src/config/config"
import { MCP } from "../../src/mcp"
import { HostSessionMcpRuntime } from "../../src/mcp/host-session-runtime"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import { SessionPrompt } from "../../src/session/prompt"
import { findInteractiveArtifact } from "../../src/interactive-artifact/persist"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const SERVER_ID = "searchnative"
const TOOL_ID = `${SERVER_ID}_echo`

function model(): ProviderType.Model {
  return {
    id: "native-mcp-search-execution",
    providerID: "native-mcp-search-provider",
    name: "Native MCP search execution",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: "native-mcp-search-execution", url: "https://native-mcp.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-31",
  } as ProviderType.Model
}

function usage() {
  return { inputTokens: 2, outputTokens: 1, totalTokens: 3 }
}

function finish(reason: "tool-calls" | "stop") {
  return [
    { type: "finish-step", finishReason: reason, usage: usage() },
    { type: "finish", finishReason: reason, totalUsage: usage() },
  ]
}

async function fixtureConfig(projectPath: string, statePath: string, callLogPath: string) {
  const server = path.resolve(import.meta.dir, "../fixture/search-native-mcp-server.mjs")
  await Config.updateProjectPatch({
    mcp: {
      [SERVER_ID]: {
        type: "local",
        command: [process.execPath, server, statePath, callLogPath],
        timeout: 10_000,
      },
    },
    primary_assistant_capabilities: {
      work: { skill_refs: [], mcp_server_refs: [SERVER_ID] },
    },
  })
  return Config.get()
}

function exactHostToolRef(sessionID: string) {
  const matches = HostSessionMcpRuntime.catalogSnapshots(sessionID).flatMap((snapshot) =>
    snapshot.tool_bindings[TOOL_ID]
      ? [
          capabilityRef({
            kind: "mcp_tool" as const,
            source: "project" as const,
            owner_ref: HostSessionMcpRuntime.catalogOwnerRef(snapshot.owner.owner_id),
            local_ref: TOOL_ID,
          }),
        ]
      : [],
  )
  if (matches.length !== 1) throw new Error(`Expected one Host Session ref for ${TOOL_ID}, found ${matches.length}.`)
  return matches[0]!
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("native Session MCP search lifecycle", () => {
  test("runs capability_search, exact reveal, and the Host-owned leaf through the real SessionLoop", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const statePath = path.join(project.path, "mcp-state.json")
        const callLogPath = path.join(project.path, "mcp-calls.jsonl")
        await fs.writeFile(statePath, JSON.stringify({ version: 1 }))
        await fs.writeFile(callLogPath, "")
        await fixtureConfig(project.path, statePath, callLogPath)
        const providerModel = model()
        const session = await Session.create({ kind: "assistant", title: "Native MCP search lifecycle" })
        let providerStep = 0
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel)
        const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
          providerStep += 1
          if (providerStep === 1) {
            expect(Object.keys(input.tools)).toEqual(["capability_search"])
            const params = {
              queries: ["echo"],
              exact_refs: [exactHostToolRef(session.id)],
              deactivate_refs: [],
              limit: 5,
            }
            return {
              fullStream: (async function* () {
                yield { type: "start" }
                yield { type: "tool-call", toolCallId: "call_reveal_echo", toolName: "capability_search", input: params }
                const output = await input.tools.capability_search!.execute!(params, {
                  toolCallId: "call_reveal_echo",
                  messages: input.messages,
                  abortSignal: input.abort,
                })
                yield { type: "tool-result", toolCallId: "call_reveal_echo", toolName: "capability_search", input: params, output }
                for (const event of finish("tool-calls")) yield event
              })(),
            } as Awaited<ReturnType<typeof LLM.stream>>
          }
          if (providerStep === 2) {
            expect(Object.keys(input.tools).sort()).toEqual(["capability_search", TOOL_ID].sort())
            const args = { value: "ping" }
            return {
              fullStream: (async function* () {
                yield { type: "start" }
                yield { type: "tool-call", toolCallId: "call_exact_echo", toolName: TOOL_ID, input: args }
                const output = await input.tools[TOOL_ID]!.execute!(args, {
                  toolCallId: "call_exact_echo",
                  messages: input.messages,
                  abortSignal: input.abort,
                })
                yield { type: "tool-result", toolCallId: "call_exact_echo", toolName: TOOL_ID, input: args, output }
                for (const event of finish("tool-calls")) yield event
              })(),
            } as Awaited<ReturnType<typeof LLM.stream>>
          }
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "text-start", id: "final" }
              yield { type: "text-delta", id: "final", text: "Exact MCP execution complete." }
              yield { type: "text-end", id: "final" }
              for (const event of finish("stop")) yield event
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        })
        try {
          const reply = await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            agent: "work",
            model: { providerID: providerModel.providerID, modelID: providerModel.id },
            parts: [{ type: "text", text: "Find and execute the exact echo capability." }],
          })
          const payload = await CatalogOccurrenceBinding.readAssistant({
            projectID: Instance.project.id,
            sessionID: session.id,
            assistantMessageID: reply.info.id,
          })
          const metadata = searchCapabilityCatalog(CatalogOccurrenceBinding.searchSnapshot(payload), "conversation", {
            kinds: ["mcp_prompt", "mcp_resource"],
            limit: 5,
          })
          const calls = (await fs.readFile(callLogPath, "utf8")).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse)
          const serverGrant = payload.mcp_tool_parent_bindings.length
            ? await SessionLoop.resolveOccurrenceHarnessGrants({
                agentID: "work",
                session,
                agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("work")),
                config: await Config.get(),
              })
            : undefined
          expect({
            providerStep,
            finish: reply.info.role === "assistant" ? reply.info.finish : undefined,
            metadata: metadata.map((entry) => [entry.ref.kind, entry.ref.local_ref, entry.next_owner.kind]),
            events: calls.map((entry) =>
              entry.event === "tools_call" ? [entry.event, entry.version, entry.params.name] : [entry.event, entry.version],
            ),
            hostParents: payload.mcp_tool_parent_bindings.map((binding) => binding.tool_ref.owner_ref),
            visibleProjectOwnedTools: payload.views
              .filter((entry) => entry.descriptor_ref.kind === "mcp_tool" && entry.descriptor_ref.owner_ref === "mcp-config")
              .map((entry) => entry.descriptor_ref.local_ref),
            descendantScope: serverGrant?.grants.find(
              (grant) => grant.ref.kind === "mcp_server" && grant.ref.local_ref === SERVER_ID,
            )?.descendant_scope,
          }).toEqual({
            providerStep: 3,
            finish: "stop",
            metadata: [
              ["mcp_prompt", `${SERVER_ID}_summarize`, "unavailable"],
              ["mcp_resource", `${SERVER_ID}_guide`, "unavailable"],
            ],
            events: [
              ["tools_list", 1],
              ["tools_list", 1],
              ["tools_list", 1],
              ["tools_list", 1],
              ["tools_call", 1, "echo"],
              ["tools_list", 1],
            ],
            hostParents: [
              HostSessionMcpRuntime.catalogOwnerRef(`session:${session.id}:mcp:${SERVER_ID}`),
            ],
            visibleProjectOwnedTools: [],
            descendantScope: ["mcp_prompt", "mcp_resource", "mcp_tool"],
          })
        } finally {
          stream.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  for (const scenario of [
    { name: "without publishing an MCP App participant", partialInput: false },
    { name: "after publishing one MCP App partial-input participant", partialInput: true },
  ] as const) {
    test(`terminalizes typed stale ${scenario.name}`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const statePath = path.join(project.path, `mcp-stale-state-${scenario.partialInput}.json`)
          const callLogPath = path.join(project.path, `mcp-stale-calls-${scenario.partialInput}.jsonl`)
          await fs.writeFile(statePath, JSON.stringify({ version: 1 }))
          await fs.writeFile(callLogPath, "")
          await fixtureConfig(project.path, statePath, callLogPath)
          const providerModel = model()
          const session = await Session.create({ kind: "assistant", title: `Native MCP stale ${scenario.name}` })
          let providerStep = 0
          let observedError: unknown
          const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel)
          const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
            providerStep += 1
            if (providerStep === 1) {
              const params = {
                queries: ["echo"],
                exact_refs: [exactHostToolRef(session.id)],
                deactivate_refs: [],
                limit: 5,
              }
              return {
                fullStream: (async function* () {
                  yield { type: "start" }
                  yield {
                    type: "tool-call",
                    toolCallId: "call_reveal_stale_echo",
                    toolName: "capability_search",
                    input: params,
                  }
                  const output = await input.tools.capability_search!.execute!(params, {
                    toolCallId: "call_reveal_stale_echo",
                    messages: input.messages,
                    abortSignal: input.abort,
                  })
                  yield {
                    type: "tool-result",
                    toolCallId: "call_reveal_stale_echo",
                    toolName: "capability_search",
                    input: params,
                    output,
                  }
                  for (const event of finish("tool-calls")) yield event
                })(),
              } as Awaited<ReturnType<typeof LLM.stream>>
            }
            await fs.writeFile(statePath, JSON.stringify({ version: 2 }))
            const toolCallID = `call_stale_echo_${scenario.partialInput}`
            const toolInput = { value: "ping" }
            return {
              fullStream: (async function* () {
                yield { type: "start" }
                if (scenario.partialInput) {
                  yield { type: "tool-input-start", id: toolCallID, toolCallId: toolCallID, toolName: TOOL_ID }
                  yield {
                    type: "tool-input-delta",
                    id: toolCallID,
                    toolCallId: toolCallID,
                    inputTextDelta: JSON.stringify(toolInput),
                  }
                }
                try {
                  await input.tools[TOOL_ID]!.execute!(toolInput, {
                    toolCallId: toolCallID,
                    messages: input.messages,
                    abortSignal: input.abort,
                  })
                } catch (error) {
                  observedError = error
                  yield { type: "tool-error", toolCallId: toolCallID, toolName: TOOL_ID, input: toolInput, error }
                  yield { type: "error", error }
                }
              })(),
            } as Awaited<ReturnType<typeof LLM.stream>>
          })
          try {
            const reply = await SessionPrompt.prompt({
              sessionID: session.id,
              author: "user",
              agent: "work",
              model: { providerID: providerModel.providerID, modelID: providerModel.id },
              parts: [{ type: "text", text: "Reveal echo, then execute only if its binding is current." }],
            })
            const parts = await MessageStore.parts(reply.info.id)
            const artifactLifecycles = parts.flatMap((part) => {
              if (part.type !== "interactive-artifact") return []
              const artifact = findInteractiveArtifact({
                projectID: Instance.project.id,
                sessionID: session.id,
                artifactID: part.artifactID,
              })
              if (!artifact || artifact.payload.renderer !== "mcp-app@1") {
                throw new Error(`Expected one persisted MCP App artifact for ${part.artifactID}`)
              }
              return [artifact.payload.tool.lifecycle]
            })
            const persistedPartTrace = parts.flatMap((part) => {
              if (part.type === "tool") {
                return [{ type: part.type, callID: part.callID, tool: part.tool, status: part.state.status }]
              }
              if (part.type === "interactive-artifact") {
                const artifact = findInteractiveArtifact({
                  projectID: Instance.project.id,
                  sessionID: session.id,
                  artifactID: part.artifactID,
                })
                if (!artifact || artifact.payload.renderer !== "mcp-app@1") {
                  throw new Error(`Expected one persisted MCP App artifact for ${part.artifactID}`)
                }
                return [{ type: part.type, artifactID: part.artifactID, status: artifact.payload.tool.lifecycle.status }]
              }
              return []
            })
            expect(observedError).toBeInstanceOf(StaleCatalogOccurrenceError)
            expect(reply.info).toMatchObject({
              role: "assistant",
              finish: "error",
              error: {
                name: "StaleCatalogOccurrenceError",
                data: { mismatches: [`tool_binding.${TOOL_ID}.tool_digest`] },
              },
            })
            expect(persistedPartTrace).toEqual(
              scenario.partialInput
                ? [
                    { type: "interactive-artifact", artifactID: expect.stringMatching(/^art_/), status: "error" },
                    { type: "tool", callID: "call_stale_echo_true", tool: TOOL_ID, status: "error" },
                  ]
                : [{ type: "tool", callID: "call_stale_echo_false", tool: TOOL_ID, status: "error" }],
            )
            if (scenario.partialInput) {
              expect(artifactLifecycles).toEqual([
                {
                  status: "error",
                  input: { value: "ping" },
                  message: `MCP Catalog binding is stale: tool_binding.${TOOL_ID}.tool_digest.`,
                },
              ])
            }
            const events = (await fs.readFile(callLogPath, "utf8"))
              .trim()
              .split(/\r?\n/)
              .filter(Boolean)
              .map(JSON.parse)
              .map((entry) => [entry.event, entry.version])
            expect(events).toEqual([
              ["tools_list", 1],
              ["tools_list", 1],
              ["tools_list", 1],
              ["tools_list", 2],
            ])
          } finally {
            stream.mockRestore()
            provider.mockRestore()
          }
        },
      })
    }, 60_000)
  }

  test("composes ask-mode, switch, and deny policy into exact native MCP Catalog views", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const statePath = path.join(project.path, "mcp-policy-state.json")
        const eventLogPath = path.join(project.path, "mcp-policy-events.jsonl")
        await fs.writeFile(statePath, JSON.stringify({ version: 1 }))
        await fs.writeFile(eventLogPath, "")
        await fixtureConfig(project.path, statePath, eventLogPath)
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const providerModel = model()
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel)
        const initialDefinitions: string[][] = []
        const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
          initialDefinitions.push(Object.keys(input.tools))
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "text-start", id: "policy" }
              yield { type: "text-delta", id: "policy", text: "Policy-composed Catalog inspected." }
              yield { type: "text-end", id: "policy" }
              for (const event of finish("stop")) yield event
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        })
        const inspect = async (input: {
          title: string
          permission?: Array<{ permission: string; pattern: string; action: "allow" | "deny" }>
          tools?: Record<string, boolean>
        }) => {
          const session = await Session.create({
            kind: "assistant",
            title: input.title,
            permission: input.permission,
          })
          const reply = await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            agent: "work",
            model: { providerID: providerModel.providerID, modelID: providerModel.id },
            tools: input.tools,
            parts: [{ type: "text", text: "Inspect the exact MCP Catalog under this declared policy." }],
          })
          const payload = await CatalogOccurrenceBinding.readAssistant({
            projectID: Instance.project.id,
            sessionID: session.id,
            assistantMessageID: reply.info.id,
          })
          return payload.views
            .filter((entry) => entry.descriptor_ref.kind.startsWith("mcp_"))
            .map((entry) => [entry.descriptor_ref.kind, entry.descriptor_ref.local_ref, entry.availability])
            .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
        }
        try {
          const ask = await inspect({ title: "Ask-mode MCP child eligibility" })
          const switched = await inspect({
            title: "Switch-composed MCP child eligibility",
            tools: { [TOOL_ID]: false },
          })
          const denied = await inspect({
            title: "Rule-composed MCP child eligibility",
            permission: [{ permission: TOOL_ID, pattern: "*", action: "deny" }],
          })
          const metadataViews = [
            ["mcp_prompt", `${SERVER_ID}_summarize`, "visible"],
            ["mcp_resource", `${SERVER_ID}_guide`, "visible"],
            ["mcp_server", "browser", "installed_unbound"],
            ["mcp_server", "computer", "installed_unbound"],
            ["mcp_server", SERVER_ID, "visible"],
          ]
          expect({ ask, switched, denied, initialDefinitions }).toEqual({
            ask: [...metadataViews, ["mcp_tool", TOOL_ID, "visible"]].sort((left, right) =>
              JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
            switched: [...metadataViews].sort((left, right) =>
              JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
            denied: [...metadataViews].sort((left, right) =>
              JSON.stringify(left).localeCompare(JSON.stringify(right)),
            ),
            initialDefinitions: [["capability_search"], ["capability_search"], ["capability_search"]],
          })
        } finally {
          stream.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)
})
