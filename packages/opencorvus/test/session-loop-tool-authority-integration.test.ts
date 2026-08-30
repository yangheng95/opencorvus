import { afterEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PrimaryAssistantRegistry } from "../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../src/agent/session-agent-runtime"
import { Config } from "../src/config/config"
import { Bus } from "../src/bus"
import { Identifier } from "../src/id/id"
import { PermissionAuthority } from "../src/permission/authority"
import { Instance } from "../src/project/instance"
import { Provider } from "../src/provider/provider"
import { Message, Session } from "../src/session"
import { LLM } from "../src/session/llm"
import { SessionLoop } from "../src/session/loop"
import { MessageStore } from "../src/session/message-store"
import { SessionProcessor } from "../src/session/processor"
import { SessionStatus } from "../src/session/status"
import { normalizeToolResult } from "../src/session/tool-result-normalization"
import { ToolPartProgressTable } from "../src/session/session.sql"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { WorkerTurnDescriptor } from "../src/agent/worker-turn-descriptor"
import { SessionRuntimeContractStore } from "../src/session/runtime-contract"
import { sessionRuntimeWithResolvedModel } from "../src/agent/session-agent-runtime"
import { composeProjectedWorkerSystemPrompt } from "../src/agent/projected-worker-system-prompt"
import { RuntimeTemplateRegistry } from "../src/agent/runtime-template-registry"
import { RuntimeTemplateID } from "../src/agent/runtime-template-id"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import { coordinationHandoffPrompt } from "../src/prompt/fragments/coordination-handoff"
import { textSHA256 } from "../src/expert-squad/projection-hash"
import { MCP } from "../src/mcp"
import { computerRuntimeScopeIdentity } from "../src/mcp/computer/runtime-scope"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { createRequirementsOutputToolFactory } from "../src/requirements/output-tools"
import { createArchitectOutputTools } from "../src/architect/output-tools"
import { assertArchitectOutputToolTurnIdentity } from "../src/architect/output-tool-turn-identity"
import { bindInternalStageTool, stageToolMaterializerBindingOf } from "../src/agent/stage-tool-materializer"
import { createDecisionLog } from "../src/decision-log"
import { Database } from "../src/storage/db"
import { ToolTurnExecutionConflictError } from "../src/tool/execution-mode"
import { RuntimeCapabilityCatalog } from "../src/tool/capability-runtime-catalog"
import { CatalogOccurrenceBinding } from "../src/capability/catalog-binding"
import { ProviderToolNameCollisionError } from "../src/tool/provider-name-authority"
import { resolveTestCapabilityTools } from "./fixture/capability-occurrence"
import { harnessGrantedRefs } from "../src/capability/harness-projection"
import { createRuntimeToolOwner } from "../src/session/runtime-tool-owner"
import { testRuntimeToolFactories } from "./fixture/runtime-tool-owner"

function workerHarness(input: Parameters<typeof PromptProfileResolver.workerHarnessGrants>[0]) {
  const grants = PromptProfileResolver.workerHarnessGrants(input)
  return {
    grants,
    toolIDs: harnessGrantedRefs(grants, "execute")
      .filter((ref) => ref.kind === "tool" || ref.kind === "mcp_tool")
      .map((ref) => ref.local_ref)
      .sort(),
  }
}

function providerModel(): Provider.Model {
  return {
    id: "authority-integration-model",
    providerID: "authority-integration-provider",
    name: "Authority Integration Model",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: "authority-integration", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("SessionLoop Tool execution authority integration", () => {
  test("reserves a conditional response encoder before resolving the executable Provider surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const model = providerModel()
        const config = await Config.get()
        const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const session = await Session.create({ kind: "assistant", title: "Provider response encoder reservation" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        }
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: session.id,
          model,
          abort: new AbortController().signal,
        })
        await expect(
          resolveTestCapabilityTools({
            agent,
            agentID: "coding",
            model,
            session,
            assistant,
            processor,
            messages: await Session.messages({ sessionID: session.id }),
            config,
            activeLocalRefs: ["read"],
            reservedProviderToolNames: [
              {
                name: "read",
                owner: { source: "structured", ref: `assistant:${assistant.id}:response-encoder` },
              },
            ],
          }),
        ).rejects.toBeInstanceOf(ProviderToolNameCollisionError)
      },
    })
  })

  test("restores a persisted turn decision after database reopen and refuses a conflicting call", async () => {
    // A surface is resolved once per Provider step; a Task-root assistant Message
    // spans several. When the coordinator was built with no knowledge of that
    // Message, step two decided again beside step one's decision, the reduction
    // rejected the pair, and the Turn executed nothing — 43 times in one Base
    // batch. `resolveTools` derives the claim from the arguments it already
    // receives, so no call site can reintroduce that gap by forgetting to pass it.
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const model = providerModel()
        const config = await Config.get()
        const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const session = await Session.create({ kind: "assistant", title: "Retained turn decision claim" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool",
          tool: "dispatch_agent",
          callID: "call_retained_dispatch",
          state: {
            status: "completed",
            input: { agent: "base-developer" },
            output: "dispatched",
            title: "Accepted dispatch",
            metadata: {},
            time: { start: Date.now(), end: Date.now() + 1 },
          },
        })
        Database.close()
        Database.Client()
        const reopened = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        if (reopened.info.role !== "assistant") throw new Error("Expected the persisted assistant Message")
        const processor = SessionProcessor.create({
          assistantMessage: reopened.info,
          sessionID: session.id,
          model,
          abort: new AbortController().signal,
        })
        const withReceipt = (
          await resolveTestCapabilityTools({
          agent,
          agentID: "coding",
          model,
          session,
          assistant: reopened.info,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          })
        ).tools
        const coordinator = SessionLoop.executionCoordinatorForResolvedTools(withReceipt)
        if (!coordinator) throw new Error("Expected the resolved Tool execution coordinator")
        expect(coordinator.committedDecision).toBe("dispatch_agent")
        await expect(
          coordinator.run("ordinary", async () => "unreachable", { command: "no_action", commits: true }),
        ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
      },
    })
  })

  test("persists a provider-driven standalone write result through the real SessionLoop Tool wrapper", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const model = providerModel()
        const config = await Config.get()
        const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
        const agent = sessionRuntimeFromNativeAgent(nativeAgent)
        const session = await Session.create({ kind: "assistant", title: "SessionLoop authority integration" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Write the provider-owned authority evidence file.",
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const tools = (
          await resolveTestCapabilityTools({
          agent,
          agentID: "coding",
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["write"],
          })
        ).tools
        const evidencePath = path.join(project.path, "session-loop-authority-evidence.txt")
        const toolCallID = "call_session_loop_authority"
        const toolInput = { filePath: evidencePath, content: "session-loop-conversation-authority\n" }
        const streamSpy = spyOn(LLM, "stream").mockImplementation(async (streamInput) => {
          const write = streamInput.tools.write
          if (!write?.execute) throw new Error("SessionLoop did not project the write Tool")
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "tool-call", toolCallId: toolCallID, toolName: "write", input: toolInput }
              const output = await write.execute(toolInput, {
                toolCallId: toolCallID,
                messages: streamInput.messages,
                abortSignal: streamInput.abort,
              })
              yield { type: "tool-result", toolCallId: toolCallID, toolName: "write", input: toolInput, output }
              yield {
                type: "finish-step",
                finishReason: "stop",
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
              yield {
                type: "finish",
                finishReason: "stop",
                totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
            })(),
          } as Awaited<ReturnType<typeof LLM.stream>>
        })

        try {
          await processor.process({
            user,
            agentID: "coding",
            agent,
            abort,
            sessionID: session.id,
            system: [],
            messages: [],
            tools,
            model,
          })
        } finally {
          streamSpy.mockRestore()
        }

        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        const toolPart = persisted.parts.find((part) => part.type === "tool" && part.callID === toolCallID)
        expect({
          file: await fs.readFile(evidencePath, "utf8"),
          tool: toolPart,
          assistant: persisted.info,
        }).toMatchObject({
          file: "session-loop-conversation-authority\n",
          tool: {
            type: "tool",
            tool: "write",
            callID: toolCallID,
            state: {
              status: "completed",
              input: toolInput,
              output: expect.stringContaining("Wrote file successfully"),
            },
          },
          assistant: {
            finish: "stop",
            tokens: { total: 2, input: 1, output: 1 },
          },
        })
      },
    })
  }, 30_000)

  test("renews Session activity after the real Tool wrapper persists live metadata", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const model = providerModel()
        const config = await Config.get()
        const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
        const session = await Session.create({ kind: "assistant", title: "Durable Tool activity renewal" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          agent: "coding",
          time: { created: Date.now() },
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const tools = (
          await resolveTestCapabilityTools({
          agent,
          agentID: "coding",
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["edit"],
          })
        ).tools
        const edit = tools.edit
        if (!edit?.execute) throw new Error("SessionLoop did not project the edit Tool")
        const toolCallID = "call_durable_tool_activity"
        const evidencePath = path.join(project.path, "durable-tool-activity.txt")
        const input = {
          filePath: evidencePath,
          oldString: "",
          newString: "durable Tool metadata activity\n",
        }
        const observe = spyOn(SessionStatus, "observeActivity")
        let observed: Array<[string]>
        try {
          await edit.execute(input, {
            toolCallId: toolCallID,
            messages: [],
            abortSignal: abort,
          })
          observed = observe.mock.calls.map((call) => [call[0]])
        } finally {
          observe.mockRestore()
        }

        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        const part = persisted.parts.find((candidate) => candidate.type === "tool" && candidate.callID === toolCallID)
        const progress = Database.use((db) => db.select().from(ToolPartProgressTable).all())
        expect({ observed, file: await fs.readFile(evidencePath, "utf8"), part, progress }).toMatchObject({
          observed: [[session.id]],
          file: "durable Tool metadata activity\n",
          part: {
            type: "tool",
            tool: "edit",
            state: {
              status: "running",
              input,
              metadata: {
                diff: expect.stringContaining("durable Tool metadata activity"),
              },
            },
          },
          progress: [
            {
              request_part_id: part?.id,
              metadata: { diff: expect.stringContaining("durable Tool metadata activity") },
              time_created: expect.any(Number),
            },
          ],
        })
      },
    })
  }, 30_000)

  test("resumes the same persisted Ask-me Tool call after restart and records one execution", async () => {
    await using project = await memoryProject()
    const model = providerModel()
    const evidencePath = path.join(project.path, "restarted-permission-evidence.txt")
    const toolCallID = "call_restarted_permission"
    const toolInput = { filePath: evidencePath, content: "restarted-permission-continuation\n" }
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask" })
        const config = await Config.get()
        const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
        const agent = sessionRuntimeFromNativeAgent(nativeAgent)
        const session = await Session.create({ kind: "assistant", title: "Restarted Ask-me continuation" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
          model: { providerID: model.providerID, modelID: model.id },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Write the restart-safe permission evidence file.",
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        }
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const tools = (
          await resolveTestCapabilityTools({
          agent,
          agentID: "coding",
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["write"],
          })
        ).tools
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const pending = tools.write!.execute!(toolInput, {
          toolCallId: toolCallID,
          messages: [],
          abortSignal: abort,
        }).catch((error) => error)
        const request = await Promise.race([
          asked,
          pending.then((result) => {
            throw result instanceof Error ? result : new Error(`Permission execution settled before Ask: ${String(result)}`)
          }),
        ])
        stopAsked()
        return { sessionID: session.id, assistantID: assistant.id, request, pending }
      },
    })

    await Instance.disposeAll()
    expect(await created.pending).toBeInstanceOf(PermissionAuthority.PermissionPausedError)

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const modelSpy = spyOn(Provider, "getModel").mockRejectedValue(new Error("fixture recovery unavailable"))
        try {
          await expect(
            PermissionAuthority.reply({
              requestID: created.request.id,
              decision: "allow_once",
              actorID: "test-operator",
            }),
          ).rejects.toThrow("fixture recovery unavailable")
        } finally {
          modelSpy.mockRestore()
        }
      },
    })
    await Instance.disposeAll()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(model)
        const streamSpy = spyOn(LLM, "stream").mockImplementation(
          async () =>
            ({
              fullStream: (async function* () {
                yield { type: "start" }
                yield {
                  type: "finish-step",
                  finishReason: "stop",
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                }
                yield {
                  type: "finish",
                  finishReason: "stop",
                  totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                }
              })(),
            }) as Awaited<ReturnType<typeof LLM.stream>>,
        )
        try {
          expect(await PermissionAuthority.resumeApprovedContinuations()).toBe(1)
          await PermissionAuthority.reply({
            requestID: created.request.id,
            decision: "allow_once",
            actorID: "test-operator-retry",
          })
        } finally {
          streamSpy.mockRestore()
          modelSpy.mockRestore()
        }
        const assistant = await MessageStore.get({ sessionID: created.sessionID, messageID: created.assistantID })
        const toolPart = assistant.parts.find((part) => part.type === "tool" && part.callID === toolCallID)
        const history = await PermissionAuthority.history()
        expect({
          file: await fs.readFile(evidencePath, "utf8"),
          toolPart,
          starts: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_started",
          ).length,
          successes: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_succeeded",
          ).length,
        }).toMatchObject({
          file: "restarted-permission-continuation\n",
          toolPart: { type: "tool", state: { status: "completed", input: toolInput } },
          starts: 1,
          successes: 1,
        })
      },
    })
  }, 30_000)

  test("reconstructs a descriptor-bound projected worker Tool surface after restart", async () => {
    await using project = await memoryProject()
    const model = providerModel()
    const evidencePath = path.join(project.path, "projected-worker-restart-evidence.txt")
    const toolCallID = "call_projected_worker_restart"
    const toolInput = { filePath: evidencePath, content: "projected-worker-recovered-once\n" }
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask", prompt_profile: { active: "base" } })
        const config = await Config.get()
        const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "base-developer",
          packageRevision,
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Projected permission root",
          metadata: { configOverlay: { prompt_profile: { active: "base" } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Projected permission root",
          request: "Prove projected permission recovery",
          productPillar: "work",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const session = await Session.create({
          kind: projection.workerCapability.identity.sessionKind,
          parentID: root.id,
          title: "Projected permission worker",
        })
        const runtimeTemplate = RuntimeTemplateRegistry.get(projection.workerCapability.identity.baseRole)
        const coordinationToolID = DispatchAdapterContractRegistry.coordinationHandoffToolID(
          projection.workerCapability.identity.dispatchAdapterID,
        )
        const system = await composeProjectedWorkerSystemPrompt({
          taskID,
          baseRole: RuntimeTemplateID.get(projection.workerCapability.identity.baseRole),
          core: `${runtimeTemplate.corePromptSeed}\n\n${coordinationHandoffPrompt(coordinationToolID)}`,
          projectDirectory: project.path,
          capability: projection.workerCapability,
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: projection.workerCapability.identity.agentID,
          model: { providerID: model.providerID, modelID: model.id },
        })
        const userPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Write the projected restart evidence file.",
        })
        const contextTools = {}
        const owner = MCP.createScopedConnectionOwner(
          computerRuntimeScopeIdentity({ ownerKind: "worker", taskID, sessionID: session.id }),
        )
        const projectedTools = { projectedTools: {}, stageTools: {} }
        const runtimeHarness = workerHarness({
          taskID,
          capability: projection.workerCapability,
          projectedToolIDs: Object.keys(projectedTools.projectedTools),
          stageToolIDs: Object.keys(projectedTools.stageTools),
        })
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: session.id,
          payload: {
            identity: projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            model: { selection: "explicit", providerID: model.providerID, modelID: model.id },
            prompt: { systemMode: "complete", systemSha256: textSHA256(system.prompt) },
            tools: {
              enabled: runtimeHarness.toolIDs,
              stageOwned: [],
              stageMaterializers: {},
            },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" } },
            messageAuthority: {
              user_message_id: user.id,
              control_text_parts: [{ part_id: userPart.id, text_sha256: textSHA256(userPart.text) }],
            },
          },
        })
        await Session.updateMessage({
          ...user,
          extra: { workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash } },
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: projection.workerCapability.identity.agentID,
          agent: projection.workerCapability.identity.agentID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        }
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-worker",
            sessionID: session.id,
            ...projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            workerTurnDescriptorID: descriptor.id,
            workerTurnDescriptorHash: descriptor.hash,
            taskID,
            workScope: { kind: "task" },
            contractKind: "stage-attempt",
            installedAt: Date.now(),
          },
          runtime: sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          }),
          system: [system.prompt],
          systemMode: "complete",
          includeMcpTools: projection.workerCapability.includeMcpTools,
          skillProjection: projection.skillProjection,
          harnessGrants: runtimeHarness.grants,
          projectDirectory: project.path,
          resources: {
            mcp: owner,
            tools: createRuntimeToolOwner({
              leaves: testRuntimeToolFactories(projectedTools.projectedTools, "projected"),
            }),
          },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const projectedRuntime = sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          })
        const tools = (
          await resolveTestCapabilityTools({
          agent: projectedRuntime,
          agentID: projection.workerCapability.identity.agentID,
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["write"],
          })
        ).tools
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const pending = tools.write!.execute!(toolInput, {
          toolCallId: toolCallID,
          messages: [],
          abortSignal: abort,
        }).catch((error) => error)
        const request = await asked
        stopAsked()
        return { request, pending, sessionID: session.id, assistantID: assistant.id }
      },
    })
    await SessionRuntimeContractStore.dispose(created.sessionID)
    await Instance.disposeAll()
    expect(await created.pending).toBeInstanceOf(PermissionAuthority.PermissionPausedError)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(model)
        try {
          await PermissionAuthority.reply({
            requestID: created.request.id,
            decision: "allow_once",
            actorID: "projected-restart-test",
          })
        } finally {
          modelSpy.mockRestore()
        }
        const persisted = await MessageStore.get({ sessionID: created.sessionID, messageID: created.assistantID })
        const history = await PermissionAuthority.history()
        expect({
          content: await fs.readFile(evidencePath, "utf8"),
          part: persisted.parts.find((part) => part.type === "tool" && part.callID === toolCallID),
          starts: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_started",
          ).length,
          successes: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_succeeded",
          ).length,
        }).toMatchObject({
          content: "projected-worker-recovered-once\n",
          part: { type: "tool", state: { status: "completed", input: toolInput } },
          starts: 1,
          successes: 1,
        })
        expect(SessionRuntimeContractStore.get(created.sessionID)).toBeUndefined()
      },
    })
  }, 60_000)

  test("executes the real Architect identity boundary and recovers an effectful requirements Tool", async () => {
    await using project = await memoryProject()
    const model = providerModel()
    const toolCallID = "call_requirements_decision_restart"
    const toolInput = { key: "runtime", value: "Bun", reason: "persisted requirements evidence" }
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask", prompt_profile: { active: "advanced" } })
        const config = await Config.get()
        const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "requirement-engineer",
          packageRevision,
        })
        const architectProjection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "solution-architect",
          packageRevision,
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Requirements stage permission root",
          metadata: { configOverlay: { prompt_profile: { active: "advanced" } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Requirements stage permission root",
          request: "Persist one requirements decision",
          productPillar: "work",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const architectSession = await Session.create({
          kind: "architect",
          parentID: root.id,
          title: "Architect internal Tool authority",
        })
        const architectRuntimeTemplate = RuntimeTemplateRegistry.get("architect")
        const architectCoordinationToolID = DispatchAdapterContractRegistry.coordinationHandoffToolID("architect")
        const architectSystem = await composeProjectedWorkerSystemPrompt({
          taskID,
          baseRole: "architect",
          core: `${architectRuntimeTemplate.corePromptSeed}\n\n${coordinationHandoffPrompt(architectCoordinationToolID)}`,
          projectDirectory: project.path,
          capability: architectProjection.workerCapability,
        })
        const architectUser = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: architectSession.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: architectProjection.workerCapability.identity.agentID,
          model: { providerID: model.providerID, modelID: model.id },
        })
        const architectUserPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: architectSession.id,
          messageID: architectUser.id,
          type: "text",
          text: "Inspect the current Architect draft through persisted Tool authority.",
        })
        const architectOutputTools = createArchitectOutputTools({
          selectedExistingGoals(options, toolName) {
            assertArchitectOutputToolTurnIdentity({ taskID, toolName, options })
            return undefined
          },
        })
        const architectRuntimeTools = Object.fromEntries(
          DispatchAdapterContractRegistry.privateStageToolIDs("architect").map((toolID) => [
            toolID,
            architectOutputTools.materializeExact(toolID)!,
          ]),
        )
        for (const [toolName, runtimeTool] of Object.entries(architectRuntimeTools)) {
          bindInternalStageTool(runtimeTool as object, { adapterID: "architect", toolName })
        }
        const architectContextTools = { ...architectRuntimeTools }
        const architectOwner = MCP.createScopedConnectionOwner(
          computerRuntimeScopeIdentity({ ownerKind: "worker", taskID, sessionID: architectSession.id }),
        )
        const architectStageOwned = Object.keys(architectRuntimeTools)
        const architectProjectedTools = { projectedTools: {}, stageTools: architectContextTools }
        const architectHarness = workerHarness({
          taskID,
          capability: architectProjection.workerCapability,
          projectedToolIDs: Object.keys(architectProjectedTools.projectedTools),
          stageToolIDs: Object.keys(architectProjectedTools.stageTools),
        })
        const architectEnabled = architectHarness.toolIDs
        const architectDescriptor = WorkerTurnDescriptor.create({
          sessionID: architectSession.id,
          payload: {
            identity: architectProjection.workerCapability.identity,
            expertSquadID: architectProjection.workerCapability.expertSquadID,
            packageRevision,
            model: { selection: "explicit", providerID: model.providerID, modelID: model.id },
            prompt: { systemMode: "complete", systemSha256: textSHA256(architectSystem.prompt) },
            tools: { enabled: architectEnabled, stageOwned: architectStageOwned, stageMaterializers: {} },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" }, attemptID: "architect-attempt-1" },
            messageAuthority: {
              user_message_id: architectUser.id,
              control_text_parts: [{ part_id: architectUserPart.id, text_sha256: textSHA256(architectUserPart.text) }],
            },
          },
        })
        await Session.updateMessage({
          ...architectUser,
          extra: { workerTurnDescriptor: { id: architectDescriptor.id, hash: architectDescriptor.hash } },
        })
        const architectAssistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: architectUser.id,
          sessionID: architectSession.id,
          role: "assistant",
          author: architectProjection.workerCapability.identity.agentID,
          agent: architectProjection.workerCapability.identity.agentID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        SessionRuntimeContractStore.set(architectSession.id, {
          identity: {
            identityKind: "projected-worker",
            sessionID: architectSession.id,
            ...architectProjection.workerCapability.identity,
            expertSquadID: architectProjection.workerCapability.expertSquadID,
            packageRevision,
            workerTurnDescriptorID: architectDescriptor.id,
            workerTurnDescriptorHash: architectDescriptor.hash,
            taskID,
            workScope: { kind: "task" },
            attemptID: "architect-attempt-1",
            contractKind: "stage-attempt",
            installedAt: Date.now(),
          },
          runtime: sessionRuntimeWithResolvedModel(architectProjection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          }),
          system: [architectSystem.prompt],
          systemMode: "complete",
          includeMcpTools: architectProjection.workerCapability.includeMcpTools,
          skillProjection: architectProjection.skillProjection,
          harnessGrants: architectHarness.grants,
          projectDirectory: project.path,
          resources: {
            mcp: architectOwner,
            tools: createRuntimeToolOwner({
              leaves: [
                ...testRuntimeToolFactories(architectProjectedTools.projectedTools, "projected", {
                  workerTurnDescriptorHash: architectDescriptor.hash,
                  projectionHash: architectProjection.workerCapability.identity.projectionHash,
                }),
                ...testRuntimeToolFactories(architectProjectedTools.stageTools, "stage", {
                  workerTurnDescriptorHash: architectDescriptor.hash,
                  projectionHash: architectProjection.workerCapability.identity.projectionHash,
                }),
              ],
            }),
          },
        })
        const architectCatalog = await RuntimeCapabilityCatalog.snapshot({
          config,
          sessionID: architectSession.id,
          agentID: architectProjection.workerCapability.identity.agentID,
          executionToolIDs: architectEnabled,
          permission: [],
        })
        expect(
          architectCatalog.snapshot.descriptors
            .filter(
              (item) =>
                item.ref.owner_ref ===
                `dispatch-stage:${architectProjection.workerCapability.identity.dispatchAdapterID}`,
            )
            .map((item) => item.ref.local_ref),
        ).toEqual([...architectStageOwned].sort())
        const architectAbort = new AbortController().signal
        const architectProcessor = SessionProcessor.create({
          assistantMessage: architectAssistant,
          sessionID: architectSession.id,
          model,
          abort: architectAbort,
        })
        const architectRuntime = sessionRuntimeWithResolvedModel(architectProjection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          })
        const architectTools = (
          await resolveTestCapabilityTools({
          agent: architectRuntime,
          agentID: architectProjection.workerCapability.identity.agentID,
          model,
          session: architectSession,
          assistant: architectAssistant,
          processor: architectProcessor,
          messages: await Session.messages({ sessionID: architectSession.id }),
          config,
          activeLocalRefs: ["view_architect_draft"],
          })
        ).tools
        const architectToolCallID = "call_architect_draft_identity"
        const architectResult = await architectTools.view_architect_draft!.execute!(
          {},
          {
            toolCallId: architectToolCallID,
            messages: [],
            abortSignal: architectAbort,
          },
        )
        const architectMessage = await MessageStore.get({
          sessionID: architectSession.id,
          messageID: architectAssistant.id,
        })
        const architectPart = architectMessage.parts.find(
          (part) => part.type === "tool" && part.callID === architectToolCallID,
        )
        const session = await Session.create({ kind: "requirements", parentID: root.id, title: "Requirements worker" })
        const runtimeTemplate = RuntimeTemplateRegistry.get("requirements")
        const coordinationToolID = DispatchAdapterContractRegistry.coordinationHandoffToolID("requirements")
        const system = await composeProjectedWorkerSystemPrompt({
          taskID,
          baseRole: "requirements",
          core: `${runtimeTemplate.corePromptSeed}\n\n${coordinationHandoffPrompt(coordinationToolID)}`,
          projectDirectory: project.path,
          capability: projection.workerCapability,
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: Date.now() },
          agent: projection.workerCapability.identity.agentID,
          model: { providerID: model.providerID, modelID: model.id },
        })
        const userPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "Register the persisted runtime decision.",
        })
        const outputTools = createRequirementsOutputToolFactory({ taskID })
        const stageOwned = ["register_requirement", "register_decision"]
        const requirementsRuntimeTools = Object.fromEntries(
          stageOwned.map((toolID) => [toolID, outputTools.materializeExact(toolID)!]),
        )
        bindInternalStageTool(requirementsRuntimeTools.register_requirement as object, {
          adapterID: "requirements",
          toolName: "register_requirement",
        })
        const contextTools = { ...requirementsRuntimeTools }
        const owner = MCP.createScopedConnectionOwner(
          computerRuntimeScopeIdentity({ ownerKind: "worker", taskID, sessionID: session.id }),
        )
        const projectedTools = { projectedTools: {}, stageTools: contextTools }
        const materializer = stageToolMaterializerBindingOf(projectedTools.stageTools.register_decision as object)
        if (!materializer) throw new Error("requirements decision Tool has no materializer")
        const requirementsHarness = workerHarness({
          taskID,
          capability: projection.workerCapability,
          projectedToolIDs: Object.keys(projectedTools.projectedTools),
          stageToolIDs: Object.keys(projectedTools.stageTools),
        })
        const enabled = requirementsHarness.toolIDs
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: session.id,
          payload: {
            identity: projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            model: { selection: "explicit", providerID: model.providerID, modelID: model.id },
            prompt: { systemMode: "complete", systemSha256: textSHA256(system.prompt) },
            tools: {
              enabled,
              stageOwned,
              stageMaterializers: { register_decision: materializer },
            },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" }, attemptID: "requirements-attempt-1" },
            messageAuthority: {
              user_message_id: user.id,
              control_text_parts: [{ part_id: userPart.id, text_sha256: textSHA256(userPart.text) }],
            },
          },
        })
        await Session.updateMessage({
          ...user,
          extra: { workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash } },
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: projection.workerCapability.identity.agentID,
          agent: projection.workerCapability.identity.agentID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        }
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-worker",
            sessionID: session.id,
            ...projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            workerTurnDescriptorID: descriptor.id,
            workerTurnDescriptorHash: descriptor.hash,
            taskID,
            workScope: { kind: "task" },
            attemptID: "requirements-attempt-1",
            contractKind: "stage-attempt",
            installedAt: Date.now(),
          },
          runtime: sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          }),
          system: [system.prompt],
          systemMode: "complete",
          includeMcpTools: projection.workerCapability.includeMcpTools,
          skillProjection: projection.skillProjection,
          harnessGrants: requirementsHarness.grants,
          projectDirectory: project.path,
          resources: {
            mcp: owner,
            tools: createRuntimeToolOwner({
              leaves: [
                ...testRuntimeToolFactories(projectedTools.projectedTools, "projected", {
                  workerTurnDescriptorHash: descriptor.hash,
                  projectionHash: projection.workerCapability.identity.projectionHash,
                }),
                ...testRuntimeToolFactories(projectedTools.stageTools, "stage", {
                  workerTurnDescriptorHash: descriptor.hash,
                  projectionHash: projection.workerCapability.identity.projectionHash,
                }),
              ],
            }),
          },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const requirementsRuntime = sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          })
        const tools = (
          await resolveTestCapabilityTools({
          agent: requirementsRuntime,
          agentID: projection.workerCapability.identity.agentID,
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["register_requirement", "register_decision"],
          })
        ).tools
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const pending = tools.register_decision!.execute!(toolInput, {
          toolCallId: toolCallID,
          messages: [],
          abortSignal: abort,
        }).catch((error) => error)
        const request = await Promise.race([
          asked,
          pending.then((result) => {
            throw result instanceof Error ? result : new Error(`Permission execution settled before Ask: ${String(result)}`)
          }),
        ])
        stopAsked()
        return {
          request,
          pending,
          taskID,
          sessionID: session.id,
          assistantID: assistant.id,
          architectSessionID: architectSession.id,
          architectResult,
          architectPart,
        }
      },
    })
    await SessionRuntimeContractStore.dispose(created.architectSessionID)
    await SessionRuntimeContractStore.dispose(created.sessionID)
    await Instance.disposeAll()
    expect(await created.pending).toBeInstanceOf(PermissionAuthority.PermissionPausedError)
    expect({ result: created.architectResult, part: created.architectPart }).toMatchObject({
      result: expect.objectContaining({
        output: expect.stringContaining('"goals":[]'),
      }),
      part: {
        type: "tool",
        tool: "view_architect_draft",
        callID: "call_architect_draft_identity",
        state: { status: "running", input: {} },
      },
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(model)
        try {
          await PermissionAuthority.reply({
            requestID: created.request.id,
            decision: "allow_once",
            actorID: "requirements-stage-restart-test",
          })
        } finally {
          modelSpy.mockRestore()
        }
        const history = await PermissionAuthority.history()
        const persisted = await MessageStore.get({ sessionID: created.sessionID, messageID: created.assistantID })
        expect({
          decisions: createDecisionLog(created.taskID)
            .read()
            .map(({ phase, key, value, reason }) => ({ phase, key, value, reason })),
          part: persisted.parts.find((part) => part.type === "tool" && part.callID === toolCallID),
          starts: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_started",
          ).length,
          successes: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_succeeded",
          ).length,
        }).toMatchObject({
          decisions: [{ phase: "requirements", ...toolInput }],
          part: { type: "tool", state: { status: "completed", input: toolInput } },
          starts: 1,
          successes: 1,
        })
      },
    })
  }, 60_000)

  test("recovers the approved effectful stage Tool in a fresh operating-system process", async () => {
    await using project = await memoryProject()
    const model = providerModel()
    const toolCallID = "call_requirements_process_restart"
    const toolInput = { key: "runtime-process", value: "Bun", reason: "fresh process evidence" }
    const created = await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({ permission_mode: "ask", prompt_profile: { active: "advanced" } })
        const config = await Config.get()
        const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "requirement-engineer",
          packageRevision,
        })
        const taskID = Identifier.ascending("task")
        const root = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Process stage root",
          metadata: { configOverlay: { prompt_profile: { active: "advanced" } } },
        })
        const now = Date.now()
        persistTask({
          taskID,
          rootSession: root,
          now,
          title: "Process stage root",
          request: "process stage",
          productPillar: "work",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const session = await Session.create({
          kind: "requirements",
          parentID: root.id,
          title: "Process requirements worker",
        })
        const runtimeTemplate = RuntimeTemplateRegistry.get("requirements")
        const system = await composeProjectedWorkerSystemPrompt({
          taskID,
          baseRole: "requirements",
          core: `${runtimeTemplate.corePromptSeed}\n\n${coordinationHandoffPrompt("request_orchestrator_decision")}`,
          projectDirectory: project.path,
          capability: projection.workerCapability,
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: now },
          agent: projection.workerCapability.identity.agentID,
          model: { providerID: model.providerID, modelID: model.id },
        })
        const userPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: user.id,
          type: "text",
          text: "process restart decision",
        })
        const outputTools = createRequirementsOutputToolFactory({ taskID })
        const stageOwned = ["register_requirement", "register_decision"]
        const requirementsRuntimeTools = Object.fromEntries(
          stageOwned.map((toolID) => [toolID, outputTools.materializeExact(toolID)!]),
        )
        bindInternalStageTool(requirementsRuntimeTools.register_requirement as object, {
          adapterID: "requirements",
          toolName: "register_requirement",
        })
        const contextTools = { ...requirementsRuntimeTools }
        const owner = MCP.createScopedConnectionOwner(
          computerRuntimeScopeIdentity({ ownerKind: "worker", taskID, sessionID: session.id }),
        )
        const projected = { projectedTools: {}, stageTools: contextTools }
        const materializer = stageToolMaterializerBindingOf(projected.stageTools.register_decision as object)
        if (!materializer) throw new Error("missing process materializer")
        const processHarness = workerHarness({
          taskID,
          capability: projection.workerCapability,
          projectedToolIDs: Object.keys(projected.projectedTools),
          stageToolIDs: Object.keys(projected.stageTools),
        })
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: session.id,
          payload: {
            identity: projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            model: { selection: "explicit", providerID: model.providerID, modelID: model.id },
            prompt: { systemMode: "complete", systemSha256: textSHA256(system.prompt) },
            tools: {
              enabled: processHarness.toolIDs,
              stageOwned,
              stageMaterializers: { register_decision: materializer },
            },
            output: { format: "text", resultMode: "reply" },
            lifecycle: { taskID, workScope: { kind: "task" }, attemptID: "process-attempt" },
            messageAuthority: {
              user_message_id: user.id,
              control_text_parts: [{ part_id: userPart.id, text_sha256: textSHA256(userPart.text) }],
            },
          },
        })
        await Session.updateMessage({
          ...user,
          extra: { workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash } },
        })
        const assistant: Message.Assistant = {
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: session.id,
          role: "assistant",
          author: projection.workerCapability.identity.agentID,
          agent: projection.workerCapability.identity.agentID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: now },
        }
        SessionRuntimeContractStore.set(session.id, {
          identity: {
            identityKind: "projected-worker",
            sessionID: session.id,
            ...projection.workerCapability.identity,
            expertSquadID: projection.workerCapability.expertSquadID,
            packageRevision,
            workerTurnDescriptorID: descriptor.id,
            workerTurnDescriptorHash: descriptor.hash,
            taskID,
            workScope: { kind: "task" },
            attemptID: "process-attempt",
            contractKind: "stage-attempt",
            installedAt: now,
          },
          runtime: sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          }),
          system: [system.prompt],
          systemMode: "complete",
          includeMcpTools: projection.workerCapability.includeMcpTools,
          skillProjection: projection.skillProjection,
          harnessGrants: processHarness.grants,
          projectDirectory: project.path,
          resources: {
            mcp: owner,
            tools: createRuntimeToolOwner({
              leaves: [
                ...testRuntimeToolFactories(projected.projectedTools, "projected", {
                  workerTurnDescriptorHash: descriptor.hash,
                  projectionHash: projection.workerCapability.identity.projectionHash,
                }),
                ...testRuntimeToolFactories(projected.stageTools, "stage", {
                  workerTurnDescriptorHash: descriptor.hash,
                  projectionHash: projection.workerCapability.identity.projectionHash,
                }),
              ],
            }),
          },
        })
        const abort = new AbortController().signal
        const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
        const processRuntime = sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
            providerID: model.providerID,
            modelID: model.id,
          })
        const tools = (
          await resolveTestCapabilityTools({
          agent: processRuntime,
          agentID: projection.workerCapability.identity.agentID,
          model,
          session,
          assistant,
          processor,
          messages: await Session.messages({ sessionID: session.id }),
          config,
          activeLocalRefs: ["register_requirement", "register_decision"],
          })
        ).tools
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const catalogOccurrence = {
          payload: await CatalogOccurrenceBinding.readAssistant({
            projectID: Instance.project.id,
            sessionID: session.id,
            assistantMessageID: assistant.id,
          }),
        }
        const stageBinding = catalogOccurrence.payload.occurrence_owner_bindings[0]
        expect(stageBinding?.effectful_tools.map((tool) => tool.ref.local_ref)).toEqual(["register_decision"])
        expect(stageBinding?.collector_tools.map((tool) => tool.ref.local_ref)).toEqual(["register_requirement"])
        expect(catalogOccurrence.payload.fixed_package_digests).toEqual({
          [`${packageRevision.scope}:${packageRevision.projectID ?? "global"}:${packageRevision.namespace}:${packageRevision.id}:${packageRevision.version}`]:
            packageRevision.packageDigest,
        })
        const collectorCallID = "call_requirements_collector_before_restart"
        const collectorInput = {
          id: "REQ-1",
          type: "explicit",
          description: "Preserve collector state across permission recovery",
          acceptance: "Recovered continuation retains the completed collector fact",
          non_goals: "No unrelated collector state",
          evidence_refs: [],
        }
        const collectorRaw = await tools.register_requirement!.execute!(collectorInput, {
          toolCallId: collectorCallID,
          messages: [],
          abortSignal: abort,
        })
        const collectorOutput = normalizeToolResult(collectorRaw)
        await processor.completeRecoveredToolPart({
          toolCallID: collectorCallID,
          toolInput: collectorInput,
          output: {
            output: collectorOutput.output,
            title: collectorOutput.title,
            metadata: collectorOutput.metadata,
          },
        })
        const pending = tools.register_decision!.execute!(toolInput, {
          toolCallId: toolCallID,
          messages: [],
          abortSignal: abort,
        }).catch((error) => error)
        const request = await asked
        stop()
        return { request, pending, taskID, sessionID: session.id, assistantID: assistant.id }
      },
    })
    await SessionRuntimeContractStore.dispose(created.sessionID)
    await Instance.disposeAll()
    expect(await created.pending).toBeInstanceOf(PermissionAuthority.PermissionPausedError)
    const processState = path.join(project.path, "stage-process-state.json")
    await fs.writeFile(processState, JSON.stringify({ requestID: created.request.id }))
    const childEnv = {
      ...process.env,
      OPENCORVUS_STAGE_PROCESS_PROJECT: project.path,
      OPENCORVUS_STAGE_PROCESS_STATE: processState,
    }
    for (const phase of ["approve", "recover"] as const) {
      const child = Bun.spawn([process.execPath, "test/fixture/stage-permission-process-worker.ts", phase], {
        cwd: import.meta.dir + "/..",
        env: childEnv,
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect({ phase, exitCode, stdout, stderr }).toMatchObject({ phase, exitCode: 0 })
    }
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const history = await PermissionAuthority.history()
        const persisted = await MessageStore.get({ sessionID: created.sessionID, messageID: created.assistantID })
        expect({
          decisions: createDecisionLog(created.taskID)
            .read()
            .filter((entry) => entry.key === toolInput.key).length,
          part: persisted.parts.find((part) => part.type === "tool" && part.callID === toolCallID),
          starts: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_started",
          ).length,
          successes: history.filter(
            (event) => event.request_id === created.request.id && event.event_type === "execution_succeeded",
          ).length,
        }).toMatchObject({
          decisions: 1,
          part: { type: "tool", state: { status: "completed", input: toolInput } },
          starts: 1,
          successes: 1,
        })
      },
    })
  }, 120_000)
})
