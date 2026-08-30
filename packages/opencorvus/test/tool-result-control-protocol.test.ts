import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import fs from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import z from "zod"
import { sessionRuntimeFromNativeAgent } from "../src/agent/session-agent-runtime"
import { sessionRuntimeWithResolvedModel } from "../src/agent/session-agent-runtime"
import { WorkerTurnDescriptor } from "../src/agent/worker-turn-descriptor"
import { createAgentCoordinationRuntimeTools } from "../src/agent/coordination-runtime-tools"
import { filterAgentTools } from "../src/agent/filter-tools"
import { HostAgentRegistry } from "../src/agent/host-agent-registry"
import { Bus } from "../src/bus"
import { Config } from "../src/config/config"
import { requireTask } from "../src/engine/store"
import { deriveTaskStatus } from "../src/engine/task-status"
import { terminalTask } from "../src/engine/state"
import { createDispatchLineageOrigin, listDispatchLineage } from "../src/engine/dispatch-lineage"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { selectedWorkflowBinding } from "../src/engine/workflow-binding"
import {
  findAgentCoordinationRequest,
  listAgentCoordinationActions,
  listAgentCoordinationResponses,
} from "../src/engine/agent-coordination"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { PermissionExecutionResultTable } from "../src/permission/permission.sql"
import { ToolPartOutcomeTable } from "../src/session/session.sql"
import { PermissionAuthority } from "../src/permission/authority"
import { Identifier } from "../src/id/id"
import { MCP } from "../src/mcp"
import { computerRuntimeScopeIdentity } from "../src/mcp/computer/runtime-scope"
import { createOrchestratorTools, OrchestratorToolsTestHooks } from "../src/orchestrator/tools"
import { sendSchedulerMessage } from "../src/protocol/scheduler-message"
import { taskRequestSHA256 } from "../src/orchestrator/dispatch-turn-projection"
import { Provider } from "../src/provider/provider"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageStore } from "../src/session/message-store"
import { LLM } from "../src/session/llm"
import { SessionProcessor } from "../src/session/processor"
import { SessionLoop } from "../src/session/loop"
import { SessionRuntimeContractStore } from "../src/session/runtime-contract"
import { joinProcessLivenessLease } from "../src/engine/process-liveness"
import { currentRuntimeOccurrenceID } from "../src/runtime/process-occurrence"
import {
  InvalidToolResultControlError,
  TOOL_RESULT_CONTROL_METADATA_KEY,
  toolResultControl,
  withHandoffDrainToolResultControl,
  withImmediateParkToolResultControl,
} from "../src/session/tool-result-control"
import { createBatchTool } from "../src/tool/batch"
import { RequestOrchestratorDecisionTool } from "../src/tool/request-orchestrator-decision"
import { Tool } from "../src/tool/tool"
import {
  bindToolExecutionMode,
  ToolTurnExecutionConflictError,
  ToolTurnExecutionCoordinator,
  toolExecutionModeOf,
} from "../src/tool/execution-mode"
import { WaitTool } from "../src/tool/wait"
import { withTaskToolInvocation } from "../src/tool/task-tool-invocation"
import { textSHA256 } from "../src/expert-squad/projection-hash"
import { AutomationTable } from "../src/scheduler/automation.sql"
import { Database, DatabaseUnavailableError, eq } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { persistEstablishedTask } from "./fixture/engine-task"

const model = {
  id: "tool-result-control-model",
  providerID: "tool-result-control-provider",
  name: "Tool result control",
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
  api: { id: "tool-result-control", npm: "@ai-sdk/anthropic" },
  options: {},
} as any

type ProjectedSchedulerInstrumentation = (tools: Record<string, any>) => void

async function projectedSchedulerSurface(input: {
  projectPath: string
  permissionMode: "ask" | "full_access"
  instrument?: ProjectedSchedulerInstrumentation
}) {
  await Config.updateProjectPatch({
    permission_mode: input.permissionMode,
    prompt_profile: { active: "base" },
  })
  const config = await Config.get()
  const { schedulerCapability, skillProjection } = await PromptProfileResolver.resolveSchedulerTurnProjection({
    projectDirectory: input.projectPath,
    config,
  })
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Projected scheduler control root",
    metadata: { configOverlay: { prompt_profile: { active: schedulerCapability.expertSquadID } } },
  })
  const now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Projected scheduler control root",
    request: "Exercise the projected scheduler Tool-result control surface",
    productPillar: "code",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision: schedulerCapability.packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: input.projectPath,
      packageRevisionSHA256: schedulerCapability.packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const session = await Session.create({
    kind: "orchestrator",
    parentID: root.id,
    title: "Projected scheduler control occurrence",
  })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "orchestrator",
    model: { providerID: model.providerID, modelID: model.id },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: user.id,
    type: "text",
    text: "Exercise the projected scheduler Tool-result control surface.",
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID: session.id,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: now },
  })
  const raw = createOrchestratorTools({
    taskID,
    agentSessionID: session.id,
    sendSchedulerMessage,
    dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
  }).tools as Record<string, any>
  input.instrument?.(raw)
  const owner = MCP.createScopedConnectionOwner(
    computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID, sessionID: session.id }),
  )
  const projectedTools = await PromptProfileResolver.projectOrchestratorTools(raw, schedulerCapability, {
    taskID,
    projectDirectory: input.projectPath,
    connectionOwner: owner,
  })
  SessionRuntimeContractStore.set(session.id, {
    identity: {
      identityKind: "projected-scheduler",
      sessionID: session.id,
      ...schedulerCapability.identity,
      expertSquadID: schedulerCapability.expertSquadID,
      packageRevision: schedulerCapability.packageRevision,
      taskID,
      contractKind: "orchestrator-wake",
      installedAt: now,
    },
    projectedTools,
    projectedRegistryToolIDs: schedulerCapability.builtInToolIDs,
    skillProjection,
    harnessProjection: PromptProfileResolver.schedulerHarnessProjection({ taskID, capability: schedulerCapability }),
    projectDirectory: input.projectPath,
    includeMcpTools: false,
    system: [],
    systemMode: "complete",
    resources: { mcp: owner },
  })
  const runtime = sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config }))
  const abort = new AbortController().signal
  const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
  const tools = await SessionLoop.resolveTools({
    agent: runtime,
    agentID: "orchestrator",
    model,
    session,
    processor,
    messages: await Session.messages({ sessionID: session.id }),
    config,
  })
  return { taskID, session, assistant, processor, tools, abort }
}

async function projectedWorkerDecisionSurface(input: { projectPath: string }) {
  await Config.updateProjectPatch({ permission_mode: "full_access", prompt_profile: { active: "base" } })
  const config = await Config.get()
  const packageRevision = await PromptProfileResolver.resolveActivePackageRevision({
    projectDirectory: input.projectPath,
    config,
  })
  const projection = await PromptProfileResolver.resolveWorkerTurnProjection({
    projectDirectory: input.projectPath,
    config,
    agentID: "base-tester",
    packageRevision,
  })
  const scheduler = await PromptProfileResolver.resolveSchedulerTurnProjection({
    projectDirectory: input.projectPath,
    config,
  })
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Projected worker control root",
    metadata: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
  })
  const now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Projected worker control root",
    request: "Exercise the production worker coordination control writer",
    productPillar: "code",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: input.projectPath,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const session = await Session.create({
    kind: projection.workerCapability.identity.sessionKind as any,
    parentID: root.id,
    title: "Projected worker control occurrence",
  })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: projection.workerCapability.identity.agentID,
    model: { providerID: model.providerID, modelID: model.id },
  })
  const userPart = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: user.id,
    type: "text",
    text: "Request one exact scheduler decision.",
  })
  const owner = MCP.createScopedConnectionOwner(
    computerRuntimeScopeIdentity({ ownerKind: "worker", taskID, sessionID: session.id }),
  )
  const contextTools = await filterAgentTools(
    await createAgentCoordinationRuntimeTools({
      agentID: projection.workerCapability.identity.agentID,
      taskID,
    }),
    projection.workerCapability.identity.baseRole,
    { taskID, sessionID: root.id },
  )
  const projected = await PromptProfileResolver.projectWorkerTools(contextTools, projection.workerCapability, {
    taskID,
    projectDirectory: input.projectPath,
    toolDirectory: input.projectPath,
    stageOwnedToolIDs: [],
    connectionOwner: owner,
  })
  const enabledTools = [...Object.keys(projected.projectedTools), ...Object.keys(projected.stageTools)].sort()
  const descriptor = WorkerTurnDescriptor.create({
    sessionID: session.id,
    payload: {
      identity: projection.workerCapability.identity,
      expertSquadID: projection.workerCapability.expertSquadID,
      packageRevision,
      model: { selection: "explicit", providerID: model.providerID, modelID: model.id },
      prompt: { systemMode: "complete", systemSha256: "c".repeat(64) },
      tools: {
        enabled: enabledTools,
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
  await Session.updateMessage({ ...user, extra: { workerTurnDescriptor: { id: descriptor.id, hash: descriptor.hash } } })
  const workflowProjection = {
    packageRevision,
    virtualWorkflows: projection.workerCapability.virtualWorkflows,
  }
  const dispatchID = Identifier.ascending("artifact")
  const dispatchLineage = recordTestDispatchLineage({
    origin: createDispatchLineageOrigin({
      dispatchID,
      taskID,
      orchestratorSessionID: root.id,
      orchestratorMessageID: Identifier.ascending("message"),
      toolPartID: Identifier.ascending("part"),
      toolCallID: Identifier.ascending("call"),
      targetAgentID: projection.workerCapability.identity.agentID,
      projectedWorkerIdentity: projection.workerCapability.identity,
      workScope: { kind: "task" },
      workflowBinding: selectedWorkflowBinding({ projection: workflowProjection, workflowID: null }),
      workflowNodeID: null,
      adapterInput: {},
    }),
    childSessionID: session.id,
    now: now + 2,
  })
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
      installedAt: now,
    },
    runtime: sessionRuntimeWithResolvedModel(projection.workerCapability.runtime, {
      providerID: model.providerID,
      modelID: model.id,
    }),
    projectedTools: projected.projectedTools,
    stageTools: projected.stageTools,
    system: [],
    systemMode: "complete",
    projectedRegistryToolIDs: projection.workerCapability.builtInToolIDs,
    skillProjection: projection.skillProjection,
    harnessProjection: PromptProfileResolver.workerHarnessProjection({
      taskID,
      capability: projection.workerCapability,
    }),
    projectDirectory: input.projectPath,
    resources: { mcp: owner },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID: session.id,
    role: "assistant",
    author: projection.workerCapability.identity.agentID,
    agent: projection.workerCapability.identity.agentID,
    path: { cwd: input.projectPath, root: input.projectPath },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: now + 3 },
  })
  const abort = new AbortController().signal
  const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
  const tools = projected.projectedTools
  const executeWorkerTool = async (name: string, args: unknown, callID: string) => {
    const selected = tools[name] as { execute?: (args: unknown, options: unknown) => Promise<unknown> } | undefined
    if (!selected?.execute) throw new Error(`Projected worker Tool ${name} is unavailable`)
    const part = await processor.ensureToolPart(callID, name, args)
    const identity = {
      projectID: Instance.project.id,
      sessionID: session.id,
      messageID: assistant.id,
      toolCallID: callID,
      toolPartID: part.id,
      providerName: name,
      providerKind: "builtin" as const,
      providerID: name,
      args,
    }
    return withTaskToolInvocation(identity, Tool.executionSurface(Object.keys(tools), []), (invocationAuthority) =>
      selected.execute!(args, {
        toolCallId: callID,
        messages: [],
        abortSignal: abort,
        opencorvus: { ...identity, invocationAuthority },
      }),
    )
  }
  return {
    taskID,
    root,
    session,
    assistant,
    abort,
    tools,
    executeWorkerTool,
    dispatchLineage,
    scheduler,
    projection,
    packageRevision,
  }
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("single Tool-result turn-control protocol", () => {
  test("projects the typed no_action receipt on the production scheduler Tool surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "full_access",
        })
        const projected = fixture.tools.no_action
        if (!projected?.execute) throw new Error("Production scheduler projection omitted no_action")
        const result = await projected.execute(
          { reason: "Lifecycle evidence is reconciled." },
          { toolCallId: "call_projected_no_action", messages: [], abortSignal: fixture.abort },
        )
        expect({
          toolNames: Object.keys(fixture.tools),
          result,
          control: toolResultControl((result as { metadata: Record<string, unknown> }).metadata),
        }).toEqual({
          toolNames: expect.arrayContaining(["no_action"]),
          result: {
            title: "Current Ingress Reconciled",
            output: "Lifecycle evidence is reconciled.",
            metadata: expect.any(Object),
          },
          control: { kind: "immediate_park" },
        })
      },
    })
  }, 0)

  test("treats a completed immediate-park Tool outcome as the durable reply boundary", () => {
    const userMessageID = "message:parked-input"
    expect(SessionLoop.TestHooks.isSettledReplyToUserMessage({
      info: {
        id: "message:parked-assistant",
        role: "assistant",
        parentID: userMessageID,
        time: { created: 1, completed: 2 },
        finish: "tool-calls",
      },
      parts: [{
        type: "tool",
        state: {
          status: "completed",
          metadata: withImmediateParkToolResultControl({ jobID: "automation:parked-reply" }),
        },
      }],
    } as any, userMessageID)).toBe(true)
  })

  test("a live typed park completes its visible ToolPart and stops the current stream", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Live Tool result control" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const metadata = withImmediateParkToolResultControl({ jobID: "automation_live" })
        const stream = spyOn(LLM, "stream").mockResolvedValue({
          fullStream: (async function* () {
            yield { type: "start" }
            yield { type: "tool-call", toolCallId: "call_live_park", toolName: "wait", input: {} }
            yield {
              type: "tool-result",
              toolCallId: "call_live_park",
              toolName: "wait",
              input: {},
              output: { output: "scheduled", title: "Wait Scheduled", metadata },
            }
            yield { type: "text-start", id: "text_after_park" }
            yield { type: "text-delta", id: "text_after_park", text: "must not be consumed" }
            yield { type: "text-end", id: "text_after_park" }
          })(),
        } as Awaited<ReturnType<typeof LLM.stream>>)
        try {
          const disposition = await processor.process({
            user,
            agentID: "coding",
            agent: { name: "coding", mode: "primary", permission: [], options: {} } as any,
            abort,
            sessionID: session.id,
            system: [],
            messages: [],
            tools: {},
            model,
          })
          const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
          expect({
            disposition,
            finish: persisted.info.role === "assistant" ? persisted.info.finish : undefined,
            parts: persisted.parts.map((part) =>
              part.type === "tool"
                ? { type: part.type, callID: part.callID, status: part.state.status, metadata: part.state.metadata }
                : { type: part.type },
            ),
          }).toEqual({
            disposition: "stop",
            finish: "tool-calls",
            parts: [{ type: "tool", callID: "call_live_park", status: "completed", metadata }],
          })
        } finally {
          stream.mockRestore()
        }
      },
    })
  })

  test("validates and persists the exact control before completing a ToolPart", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Tool result control" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const processor = SessionProcessor.create({
          assistantMessage: assistant,
          sessionID: session.id,
          model,
          abort: new AbortController().signal,
        })

        await processor.ensureToolPart("call_park", "wait", {})
        const parkMetadata = withImmediateParkToolResultControl({ jobID: "automation_1" })
        const park = await processor.completeRecoveredToolPart({
          toolCallID: "call_park",
          toolInput: {},
          output: { output: "scheduled", title: "Wait Scheduled", metadata: parkMetadata },
        })

        await processor.ensureToolPart("call_handoff", "request_orchestrator_decision", {})
        const handoffMetadata = withHandoffDrainToolResultControl(
          { requestID: "coordination_1" },
          { requestID: "coordination_1", dispatchLineageID: "dispatch_1" },
        )
        const handoff = await processor.completeRecoveredToolPart({
          toolCallID: "call_handoff",
          toolInput: {},
          output: { output: "handoff", title: "Coordination", metadata: handoffMetadata },
        })

        await processor.ensureToolPart("call_invalid", "wait", {})
        const invalid = processor.completeRecoveredToolPart({
          toolCallID: "call_invalid",
          toolInput: {},
          output: {
            output: "invalid",
            title: "Invalid",
            metadata: { [TOOL_RESULT_CONTROL_METADATA_KEY]: { kind: "immediate_park", extra: true } },
          },
        })
        await expect(invalid).rejects.toBeInstanceOf(InvalidToolResultControlError)

        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        const states = persisted.parts
          .filter((part) => part.type === "tool")
          .map((part) => ({ callID: part.callID, status: part.state.status, metadata: part.state.metadata }))
        expect({ park, handoff, states }).toEqual({
          park: { kind: "immediate_park" },
          handoff: {
            kind: "handoff_drain",
            request_id: "coordination_1",
            dispatch_lineage_id: "dispatch_1",
          },
          states: [
            { callID: "call_park", status: "completed", metadata: parkMetadata },
            { callID: "call_handoff", status: "completed", metadata: handoffMetadata },
            { callID: "call_invalid", status: "running", metadata: undefined },
          ],
        })
      },
    })
  })

  test("projects ordinary batch targets while exclusive control Tools remain direct-only", async () => {
    const ordinary = await Tool.define("ordinary", {
      description: "ordinary",
      parameters: z.object({ value: z.string() }),
      async execute({ value }) {
        return { title: "ordinary", output: value, metadata: {} }
      },
    }).init()
    const wait = await WaitTool.init()
    const decision = await RequestOrchestratorDecisionTool.init()
    const ordinaryWithoutControl = bindToolExecutionMode(
      await Tool.define("ordinary_exclusive", {
        description: "ordinary exclusive",
        parameters: z.object({}),
        executionMode: "turn_control_exclusive",
        async execute() {
          return { title: "ordinary", output: "ordinary", metadata: {} }
        },
      }).init(),
      "turn_control_exclusive",
    )
    const batch = await createBatchTool([
      { id: "ordinary", ...ordinary },
      { id: "wait", ...wait },
      { id: "request_orchestrator_decision", ...decision },
    ]).init()

    expect({ wait: wait.executionMode, decision: decision.executionMode }).toEqual({
      wait: "turn_control_exclusive",
      decision: "turn_control_exclusive",
    })
    expect(batch.parameters.parse({ tool_calls: [{ tool: "ordinary", parameters: { value: "ok" } }] })).toEqual({
      tool_calls: [{ tool: "ordinary", parameters: { value: "ok" } }],
    })
    expect(() =>
      batch.parameters.parse({ tool_calls: [{ tool: "wait", parameters: { duration_ms: 1000, reason: "later" } }] }),
    ).toThrow()
    expect(toolResultControl({})).toBeUndefined()
    const coordinator = new ToolTurnExecutionCoordinator()
    expect(
      await coordinator.run("turn_control_exclusive", () => ordinaryWithoutControl.execute({}, {} as any)),
    ).toEqual({
      title: "ordinary",
      output: "ordinary",
      metadata: { truncated: false },
    })
    expect(await coordinator.run("ordinary", async () => ({ metadata: {} }))).toEqual({ metadata: {} })
  })

  test("executes the normal Wait Tool producer and keeps an aborted occurrence ordinary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "full_access",
        })
        const initialized = await WaitTool.init()
        const context = (abort: AbortSignal, callID: string) => ({
          sessionID: fixture.session.id,
          messageID: Identifier.ascending("message"),
          callID,
          agent: "coding",
          abort,
          messages: [],
          executionAuthority: {
            kind: "conversation" as const,
            sessionID: fixture.session.id,
            projectID: Instance.project.id,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["wait"], []),
          metadata() {},
        })

        const scheduled = await initialized.execute(
          { duration_ms: 1_000, reason: "verify the normal Wait Tool producer" },
          context(new AbortController().signal, "call_normal_wait"),
        )
        const abortedController = new AbortController()
        abortedController.abort()
        const aborted = await initialized.execute(
          { duration_ms: 1_000, reason: "verify the aborted Wait Tool result" },
          context(abortedController.signal, "call_aborted_wait"),
        )

        expect({
          scheduledControl: toolResultControl(scheduled.metadata),
          scheduledMetadata: scheduled.metadata,
          abortedControl: toolResultControl(aborted.metadata),
          abortedMetadata: aborted.metadata,
        }).toMatchObject({
          scheduledControl: { kind: "immediate_park" },
          scheduledMetadata: {
            aborted: false,
            jobID: expect.any(String),
            mode: "session",
          },
          abortedControl: undefined,
          abortedMetadata: {
            aborted: true,
            jobID: undefined,
            mode: undefined,
          },
        })
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  test("executes the production projected orchestrator wait writer", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "full_access",
        })
        const wait = fixture.tools.wait
        if (!wait?.execute) throw new Error("Projected scheduler orchestrator wait is unavailable")
        const result = await wait.execute(
          { duration_ms: 1_000, reason: "verify the orchestrator wait producer" },
          { toolCallId: "call_orchestrator_wait", messages: [], abortSignal: fixture.abort },
        )
        const automations = Database.use((db) =>
          db.select().from(AutomationTable).where(eq(AutomationTable.task_id, fixture.taskID)).all(),
        )
        expect({ control: toolResultControl((result as any).metadata), automations }).toMatchObject({
          control: { kind: "immediate_park" },
          automations: [expect.objectContaining({ task_id: fixture.taskID, status: "active" })],
        })
        expect(automations).toHaveLength(1)
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  for (const terminalAction of ["complete_task", "fail_task"] as const) {
    test(`executes the real projected manage_task ${terminalAction} producer`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const fixture = await projectedSchedulerSurface({
            projectPath: project.path,
            permissionMode: "full_access",
          })
          const manageTask = fixture.tools.manage_task
          if (!manageTask?.execute) throw new Error("Projected scheduler manage_task is unavailable")
          const args =
            terminalAction === "complete_task"
              ? {
                  action: terminalAction,
                  summary: "Focused Tool-result control acceptance is complete",
                  evidence_locators: [],
                  deliverable_artifact_locators: [],
                  accepted_delivery_slice_revision_ids: [],
                  workflow_id: null,
                }
              : {
                  action: terminalAction,
                  error: "Exact external force-majeure evidence prevents completion",
                }
          const callID = `call_manage_${terminalAction}`
          const result = await manageTask.execute(args, {
            toolCallId: callID,
            messages: [],
            abortSignal: fixture.abort,
          })
          const persisted = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
          const task = requireTask(fixture.taskID)
          expect({
            control: toolResultControl((result as any).metadata),
            status: deriveTaskStatus(task),
            error: task.error,
            part: persisted.parts.find((part) => part.type === "tool" && part.callID === callID),
          }).toMatchObject({
            control: { kind: "immediate_park" },
            status: terminalAction === "complete_task" ? "completed" : "failed",
            error: terminalAction === "complete_task" ? null : args.error,
            part: { type: "tool", state: { status: "running", input: args } },
          })
          await SessionRuntimeContractStore.dispose(fixture.session.id)
        },
      })
    }, 120_000)
  }

  test("keeps a rejected projected completion occurrence ordinary", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "full_access",
        })
        await terminalTask(
          requireTask(fixture.taskID),
          { status: "failed", error: "Existing terminal authority", time_completed: Date.now() },
          "Existing terminal authority",
        )
        const manageTask = fixture.tools.manage_task
        if (!manageTask?.execute) throw new Error("Projected scheduler manage_task is unavailable")
        // No per-call authority wrapper: the lifecycle Tool's own invariant
        // answers with a model-visible rejection and the durable status holds.
        const rejection = await manageTask.execute(
          {
            action: "complete_task",
            summary: "Must reuse the existing terminal authority",
            evidence_locators: [],
            deliverable_artifact_locators: [],
            accepted_delivery_slice_revision_ids: [],
            workflow_id: null,
          },
          { toolCallId: "call_rejected_completion", messages: [], abortSignal: fixture.abort },
        )
        expect(JSON.stringify(rejection)).toContain("already terminal with status=failed")
        expect(deriveTaskStatus(requireTask(fixture.taskID))).toBe("failed")
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  test("creates and exactly replays the production worker coordination handoff writer", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await projectedWorkerDecisionSurface({ projectPath: project.path })
        const args = {
          summary: "Need one exact scheduling decision",
          details: "The worker has reached a real dispatch-bound decision point.",
          blocking: true,
          requested_decision: "Choose the next same-Task scheduling action",
          evidence_locators: [],
          severity: "blocked" as const,
        }
        const created = await fixture.executeWorkerTool(
          "request_orchestrator_decision",
          args,
          "call_worker_decision",
        )
        const replayed = await fixture.executeWorkerTool(
          "request_orchestrator_decision",
          args,
          "call_worker_decision",
        )
        const createdControl = toolResultControl((created as any).metadata)
        const replayedControl = toolResultControl((replayed as any).metadata)
        const request = createdControl?.kind === "handoff_drain"
          ? findAgentCoordinationRequest({ taskID: fixture.taskID, requestID: createdControl.request_id })
          : undefined
        expect({ createdControl, replayedControl, request }).toMatchObject({
          createdControl: {
            kind: "handoff_drain",
            request_id: expect.any(String),
            dispatch_lineage_id: fixture.dispatchLineage.artifactID,
          },
          replayedControl: createdControl,
          request: {
            payload: {
              request_id: createdControl?.kind === "handoff_drain" ? createdControl.request_id : "",
              dispatch_lineage_id: fixture.dispatchLineage.artifactID,
              status: "pending",
            },
          },
        })
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  test("persists one production coordination source in lineage and the Worker Turn descriptor", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worker = await projectedWorkerDecisionSurface({ projectPath: project.path })
        const requestResult = await worker.executeWorkerTool(
          "request_orchestrator_decision",
          {
            summary: "Continue the same worker occurrence",
            details: "The scheduler must redispatch this exact production worker Session.",
            blocking: true,
            requested_decision: "Redispatch this worker with incremental guidance",
            evidence_locators: [],
            severity: "blocked",
          },
          "call_coordination_continuation_request",
        )
        const requestControl = toolResultControl((requestResult as any).metadata)
        if (requestControl?.kind !== "handoff_drain") throw new Error("Worker request did not produce handoff control")
        const sourceDescriptor = WorkerTurnDescriptor.latestForSession(worker.session.id)
        if (!sourceDescriptor) throw new Error("Source worker descriptor was not persisted")
        WorkerTurnDescriptor.create({
          sessionID: worker.session.id,
          payload: {
            ...sourceDescriptor.payload,
            dispatchTurn: {
              kind: "initial",
              current_dispatch_id: worker.dispatchLineage.dispatchID,
              workflow_binding: worker.dispatchLineage.payload.workflow_binding,
              workflow_node_id: worker.dispatchLineage.payload.workflow_node_id,
              workflow_occurrence_id: worker.dispatchLineage.payload.workflow_occurrence_id,
              delivery_slice_revision_ids: worker.dispatchLineage.payload.delivery_slice_revision_ids,
              evidence_locators: [],
              task_authority: {
                task_id: worker.taskID,
                root_session_id: worker.root.id,
                request_sha256: taskRequestSHA256(requireTask(worker.taskID).request),
                initial_user_message_id: sourceDescriptor.payload.messageAuthority.user_message_id,
                initial_control_text_parts: sourceDescriptor.payload.messageAuthority.control_text_parts,
              },
            },
          },
        })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: worker.root.id,
          title: "Coordination continuation scheduler",
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          agent: "orchestrator",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const dispatchAgents = [
          ...worker.scheduler.skillProjection.schedulerOnlyAgents,
          ...worker.scheduler.skillProjection.projectedAgents,
        ]
        const surface = createOrchestratorTools({
          taskID: worker.taskID,
          agentSessionID: orchestrator.id,
          sendSchedulerMessage,
          dispatchAgents,
        })
        const runTool = async (toolName: "respond_agent_coordination" | "dispatch_agent", callID: string, args: any) => {
          const part = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: orchestrator.id,
            messageID: assistant.id,
            type: "tool",
            callID,
            tool: toolName,
            state: { status: "running", input: args, time: { start: Date.now() } },
          })
          return {
            part,
            options: {
              toolCallId: callID,
              messages: [],
              abortSignal: new AbortController().signal,
              opencorvus: {
                sessionID: orchestrator.id,
                messageID: assistant.id,
                toolCallID: callID,
                toolPartID: part.id,
                visibleToolName: toolName,
              },
            },
          }
        }
        const responseExecution = await runTool("respond_agent_coordination", "call_coordination_redispatch", {})
        const respond = (surface.tools as Record<string, any>).respond_agent_coordination
        await respond.execute(
          {
            request_id: requestControl.request_id,
            decision: "redispatch",
            message: "Continue with the scheduler's exact incremental guidance.",
            reason: "The existing worker owns the same Task-scoped occurrence.",
          },
          responseExecution.options,
        )
        const action = listAgentCoordinationActions(worker.taskID)[0]
        if (!action) throw new Error("Coordination redispatch action was not persisted")
        const target = dispatchAgents.find(
          (candidate) => candidate.identity.agentID === worker.projection.workerCapability.identity.agentID,
        )
        if (!target) throw new Error("Coordination redispatch target was not projected")
        const dispatchExecution = await runTool("dispatch_agent", "call_coordination_dispatch", {})
        const deliveryOwner = joinProcessLivenessLease(currentRuntimeOccurrenceID())
        const lineageHandle = await OrchestratorToolsTestHooks.openDispatchLineage(surface)({
          taskID: worker.taskID,
          targetAgentID: target.identity.agentID,
          projectedAgent: target,
          workScope: { kind: "task" },
          deliverySliceRevisionIDs: [],
          coordinationActionID: action.payload.action_id,
          toolOptions: dispatchExecution.options,
          adapterInput: {},
          continuationGuidance: "Continue with the scheduler's exact incremental guidance.",
          evidenceLocators: [],
        })
        const peerLineageHandle = OrchestratorToolsTestHooks.openDispatchLineage(surface)({
          taskID: worker.taskID,
          targetAgentID: target.identity.agentID,
          projectedAgent: target,
          workScope: { kind: "task" },
          deliverySliceRevisionIDs: [],
          coordinationActionID: action.payload.action_id,
          toolOptions: dispatchExecution.options,
          adapterInput: {},
          continuationGuidance: "Continue with the scheduler's exact incremental guidance.",
          evidenceLocators: [],
        })
        const previous = WorkerTurnDescriptor.latestForSession(worker.session.id)
        if (!previous) throw new Error("Coordination source descriptor was not persisted")
        const descriptor = WorkerTurnDescriptor.create({
          sessionID: worker.session.id,
          payload: { ...previous.payload, dispatchTurn: lineageHandle.turn },
        })
        try {
          lineageHandle.commitSession(worker.session.id, descriptor)
        } finally {
          deliveryOwner.release()
        }
        const peer = await peerLineageHandle
        const continuation = listDispatchLineage(worker.taskID).find(
          (lineage) => lineage.payload.coordination_action_id === action.payload.action_id,
        )
        const persistedDescriptor = continuation
          ? WorkerTurnDescriptor.findForDispatch({
              sessionID: continuation.payload.child_session_id,
              dispatchID: continuation.dispatchID,
            })
          : undefined
        expect({
          lineageSource: continuation?.payload.continuation_of_dispatch_id,
          descriptorSource:
            persistedDescriptor?.payload.dispatchTurn?.kind === "continuation"
              ? persistedDescriptor.payload.dispatchTurn.source_dispatch_id
              : undefined,
          peerReplay: peer.replayOutcome,
        }).toEqual({
          lineageSource: worker.dispatchLineage.dispatchID,
          descriptorSource: worker.dispatchLineage.dispatchID,
          peerReplay: {
            kind: "accepted",
            session_id: worker.session.id,
            dispatch_lineage_id: continuation?.artifactID,
          },
        })
        await SessionRuntimeContractStore.dispose(worker.session.id)
      },
    })
  }, 120_000)

  test("settles and replays the production A2A fail_task control writer", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const worker = await projectedWorkerDecisionSurface({ projectPath: project.path })
        const requestArgs = {
          summary: "Force-majeure evidence requires scheduler settlement",
          details: "The exact external authority is unavailable and cannot be repaired inside this Task.",
          blocking: true,
          requested_decision: "Settle the force-majeure failure",
          evidence_locators: [],
          severity: "failure" as const,
        }
        const requestResult = await worker.executeWorkerTool(
          "request_orchestrator_decision",
          requestArgs,
          "call_a2a_request",
        )
        const requestControl = toolResultControl((requestResult as any).metadata)
        if (requestControl?.kind !== "handoff_drain") throw new Error("Worker request did not produce handoff control")
        await SessionRuntimeContractStore.dispose(worker.session.id)

        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: worker.root.id,
          title: "A2A fail_task scheduler occurrence",
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: orchestrator.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: model.providerID, modelID: model.id },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: user.id,
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          agent: "orchestrator",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: model.id,
          providerID: model.providerID,
          time: { created: Date.now() },
        })
        const callID = "call_a2a_fail_task"
        const toolPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: orchestrator.id,
          messageID: assistant.id,
          type: "tool",
          callID,
          tool: "respond_agent_coordination",
          state: {
            status: "running",
            input: {
              request_id: requestControl.request_id,
              decision: "fail_task",
              message: "The exact external authority is unavailable",
              reason: "Force majeure is proven by the worker evidence",
            },
            time: { start: Date.now() },
          },
        })
        const raw = createOrchestratorTools({
          taskID: worker.taskID,
          agentSessionID: orchestrator.id,
          sendSchedulerMessage,
          dispatchAgents: [
            ...worker.scheduler.skillProjection.schedulerOnlyAgents,
            ...worker.scheduler.skillProjection.projectedAgents,
          ],
        }).tools as Record<string, any>
        const respond = raw.respond_agent_coordination
        if (!respond?.execute) throw new Error("respond_agent_coordination is unavailable")
        const args = {
          request_id: requestControl.request_id,
          decision: "fail_task",
          message: "The exact external authority is unavailable",
          reason: "Force majeure is proven by the worker evidence",
        }
        const options = {
          toolCallId: callID,
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: {
            sessionID: orchestrator.id,
            messageID: assistant.id,
            toolCallID: callID,
            toolPartID: toolPart.id,
            visibleToolName: "respond_agent_coordination",
          },
        }
        const settled = await respond.execute(args, options)
        const replaySurface = createOrchestratorTools({
          taskID: worker.taskID,
          agentSessionID: orchestrator.id,
          sendSchedulerMessage,
          dispatchAgents: [
            ...worker.scheduler.skillProjection.schedulerOnlyAgents,
            ...worker.scheduler.skillProjection.projectedAgents,
          ],
        }).tools as Record<string, any>
        const replayRespond = replaySurface.respond_agent_coordination
        if (!replayRespond?.execute) throw new Error("respond_agent_coordination replay is unavailable")
        const replayed = await replayRespond.execute(args, options)
        const response = listAgentCoordinationResponses(worker.taskID)[0]
        const action = listAgentCoordinationActions(worker.taskID)[0]
        expect({
          settledControl: toolResultControl(settled.metadata),
          replayedControl: toolResultControl(replayed.metadata),
          replayedOutput: replayed.output,
          taskStatus: deriveTaskStatus(requireTask(worker.taskID)),
          response,
          action,
        }).toMatchObject({
          settledControl: { kind: "immediate_park" },
          replayedControl: { kind: "immediate_park" },
          replayedOutput: expect.stringContaining("already completed as fail_task"),
          taskStatus: "failed",
          response: { payload: { request_id: requestControl.request_id, decision: "fail_task" } },
          action: { payload: { action: "fail_task", status: "completed" } },
        })
      },
    })
  }, 180_000)

  test("serializes an exclusive Tool occurrence after prior ordinary work and seals later siblings", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    const order: string[] = []
    let releaseOrdinary!: () => void
    const ordinaryGate = new Promise<void>((resolve) => (releaseOrdinary = resolve))
    const ordinary = coordinator.run("ordinary", async () => {
      order.push("ordinary:start")
      await ordinaryGate
      order.push("ordinary:end")
      return { metadata: {} }
    })
    const exclusive = coordinator.run("turn_control_exclusive", async () => {
      order.push("exclusive:start")
      return { metadata: withImmediateParkToolResultControl({ wakeID: "wake_1" }) }
    })
    const later = coordinator.run("ordinary", async () => ({ metadata: {} }))
    await expect(later).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
    releaseOrdinary()
    await Promise.all([ordinary, exclusive])
    await expect(coordinator.run("ordinary", async () => ({ metadata: {} }))).rejects.toBeInstanceOf(
      ToolTurnExecutionConflictError,
    )
    await expect(
      new ToolTurnExecutionCoordinator().run("ordinary", async () => ({
        metadata: withImmediateParkToolResultControl({}),
      })),
    ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
    expect(order).toEqual(["ordinary:start", "ordinary:end", "exclusive:start"])
  })

  test("seals a misclassified occurrence after a malformed hook mutation exposes committed control", async () => {
    const coordinator = new ToolTurnExecutionCoordinator()
    let effects = 0
    const committed = withImmediateParkToolResultControl({ effect_id: "misclassified-effect" })
    await expect(
      coordinator.run("ordinary", async () => {
        effects++
        throw new InvalidToolResultControlError("plugin mutated committed control", { kind: "malformed" }, committed)
      }),
    ).rejects.toBeInstanceOf(InvalidToolResultControlError)
    await expect(
      coordinator.run("ordinary", async () => {
        effects++
        return { metadata: {} }
      }),
    ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
    expect(effects).toBe(1)
  })

  for (const settlement of ["returned-control", "mutated-control"] as const) {
    test(`stops a queued exclusive effect when ordinary work seals with ${settlement}`, async () => {
      const coordinator = new ToolTurnExecutionCoordinator()
      let releaseOrdinary!: () => void
      const ordinaryGate = new Promise<void>((resolve) => (releaseOrdinary = resolve))
      const committed = withImmediateParkToolResultControl({ effect_id: settlement })
      const ordinary = coordinator.run("ordinary", async () => {
        await ordinaryGate
        if (settlement === "mutated-control") {
          throw new InvalidToolResultControlError("plugin mutated committed control", { kind: "malformed" }, committed)
        }
        return { metadata: committed }
      })
      let exclusiveEffects = 0
      const exclusive = coordinator.run("turn_control_exclusive", async () => {
        exclusiveEffects++
        return { metadata: withImmediateParkToolResultControl({ effect_id: "exclusive" }) }
      })
      releaseOrdinary()
      const [ordinaryResult, exclusiveResult] = await Promise.allSettled([ordinary, exclusive])
      expect(ordinaryResult).toMatchObject({
        status: "rejected",
        reason: expect.any(
          settlement === "mutated-control" ? InvalidToolResultControlError : ToolTurnExecutionConflictError,
        ),
      })
      expect(exclusiveResult).toMatchObject({
        status: "rejected",
        reason: expect.any(ToolTurnExecutionConflictError),
      })
      expect(exclusiveEffects).toBe(0)
    })
  }

  test("preserves projected exclusive mode through provider preparation and the final Session Tool surface", async () => {
    const exclusive = bindToolExecutionMode(
      {
        inputSchema: z.object({}),
        async execute() {
          return { title: "terminal", output: "terminal", metadata: withImmediateParkToolResultControl({}) }
        },
      } as any,
      "turn_control_exclusive",
    )
    const prepared = SessionLoop.prepareProviderTool({
      name: "complete_task",
      source: "extra",
      model,
      tool: exclusive,
    })
    expect(toolExecutionModeOf(prepared as object)).toBe("turn_control_exclusive")

    const coordinator = new ToolTurnExecutionCoordinator()
    let releaseOrdinary!: () => void
    let exclusiveStarted = false
    const gate = new Promise<void>((resolve) => (releaseOrdinary = resolve))
    const ordinary = coordinator.run("ordinary", async () => {
      await gate
      return { metadata: {} }
    })
    const terminal = coordinator.run(toolExecutionModeOf(prepared as object), async () => {
      exclusiveStarted = true
      return prepared.execute!(
        {},
        { toolCallId: "call_projected_terminal", messages: [], abortSignal: new AbortController().signal },
      )
    })
    await Promise.resolve()
    expect(exclusiveStarted).toBeFalse()
    releaseOrdinary()
    await ordinary
    expect(toolResultControl(((await terminal) as any).metadata)).toEqual({ kind: "immediate_park" })
    await expect(coordinator.run("ordinary", async () => ({ metadata: {} }))).rejects.toBeInstanceOf(
      ToolTurnExecutionConflictError,
    )
  })

  test("coordinates a real projected scheduler wait with its ordinary sibling on the final Session Tool surface", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const order: string[] = []
        let ordinaryEffects = 0
        let waitEffects = 0
        let releaseOrdinary!: () => void
        let markOrdinaryStarted!: () => void
        const ordinaryGate = new Promise<void>((resolve) => (releaseOrdinary = resolve))
        const ordinaryStarted = new Promise<void>((resolve) => (markOrdinaryStarted = resolve))
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "full_access",
          instrument(raw) {
            const originalReadContext = raw.read_context
            const originalWait = raw.wait
            if (!originalReadContext?.execute || !originalWait?.execute) {
              throw new Error("Base scheduler projection did not build read_context and wait")
            }
            raw.read_context = bindToolExecutionMode(
              {
                ...originalReadContext,
                async execute(args: unknown, options: unknown) {
                  ordinaryEffects++
                  order.push("ordinary:start")
                  markOrdinaryStarted()
                  await ordinaryGate
                  const result = await originalReadContext.execute(args, options)
                  order.push("ordinary:end")
                  return result
                },
              },
              toolExecutionModeOf(originalReadContext),
            )
            raw.wait = bindToolExecutionMode(
              {
                ...originalWait,
                async execute(args: unknown, options: unknown) {
                  waitEffects++
                  order.push("exclusive:start")
                  return originalWait.execute(args, options)
                },
              },
              toolExecutionModeOf(originalWait),
            )
          },
        })
        const readContext = fixture.tools.read_context
        const wait = fixture.tools.wait
        if (!readContext?.execute || !wait?.execute) throw new Error("Projected scheduler Tool surface is incomplete")
        expect({ readContext: toolExecutionModeOf(readContext), wait: toolExecutionModeOf(wait) }).toEqual({
          readContext: "ordinary",
          wait: "turn_control_exclusive",
        })

        const ordinary = readContext.execute(
          { scope: "decisions" },
          { toolCallId: "call_projected_read", messages: [], abortSignal: fixture.abort },
        )
        await ordinaryStarted
        const exclusive = wait.execute(
          { duration_ms: 1_000, reason: "verify the projected scheduler execution coordinator" },
          { toolCallId: "call_projected_wait", messages: [], abortSignal: fixture.abort },
        )
        const rejectedSibling = readContext.execute(
          { scope: "decisions" },
          { toolCallId: "call_projected_read_rejected", messages: [], abortSignal: fixture.abort },
        )
        await expect(rejectedSibling).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
        expect({ order, ordinaryEffects, waitEffects }).toEqual({
          order: ["ordinary:start"],
          ordinaryEffects: 1,
          waitEffects: 0,
        })
        releaseOrdinary()
        const [, waitResult] = await Promise.all([ordinary, exclusive])
        await expect(
          readContext.execute(
            { scope: "decisions" },
            { toolCallId: "call_projected_read_after_park", messages: [], abortSignal: fixture.abort },
          ),
        ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)
        const automations = Database.use((db) =>
          db.select().from(AutomationTable).where(eq(AutomationTable.task_id, fixture.taskID)).all(),
        )
        const persisted = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
        expect({
          order,
          ordinaryEffects,
          waitEffects,
          control: toolResultControl((waitResult as any).metadata),
          automations,
          parts: persisted.parts
            .filter((part) => part.type === "tool")
            .map((part) => ({ callID: part.callID, status: part.state.status })),
        }).toMatchObject({
          order: ["ordinary:start", "ordinary:end", "exclusive:start"],
          ordinaryEffects: 1,
          waitEffects: 1,
          control: { kind: "immediate_park" },
          automations: [expect.objectContaining({ task_id: fixture.taskID, status: "active" })],
          parts: [
            { callID: "call_projected_read", status: "running" },
            { callID: "call_projected_wait", status: "running" },
          ],
        })
        expect(automations).toHaveLength(1)
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  test("replays a permission-owned projected wait result across the result-to-ToolPart cut without a second effect", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let waitEffects = 0
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "ask",
          instrument(raw) {
            const originalWait = raw.wait
            if (!originalWait?.execute) throw new Error("Base scheduler projection did not build wait")
            raw.wait = bindToolExecutionMode(
              {
                ...originalWait,
                async execute(args: unknown, options: unknown) {
                  waitEffects++
                  return originalWait.execute(args, options)
                },
              },
              toolExecutionModeOf(originalWait),
            )
          },
        })
        const wait = fixture.tools.wait
        if (!wait?.execute) throw new Error("Projected scheduler wait is unavailable")
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const pending = wait.execute(
          { duration_ms: 1_000, reason: "verify permission result replay into the ToolPart" },
          { toolCallId: "call_permission_result_cut", messages: [], abortSignal: fixture.abort },
        )
        const request = await asked
        stopAsked()
        await PermissionAuthority.reply({
          requestID: request.id,
          decision: "allow_once",
          actorID: "result-cut-test",
        })
        const committed = await pending
        const before = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
        const beforePart = before.parts.find(
          (part) => part.type === "tool" && part.callID === "call_permission_result_cut",
        )
        const stored = Database.use((db) =>
          db
            .select()
            .from(PermissionExecutionResultTable)
            .all(),
        )
        const durableValue = stored[0]?.result.kind === "json" ? stored[0].result.value : undefined
        expect({
          control: toolResultControl((committed as any).metadata),
          durableControl:
            durableValue && typeof durableValue === "object" && !Array.isArray(durableValue)
              ? toolResultControl((durableValue as { metadata?: unknown }).metadata)
              : undefined,
          partStatus: beforePart?.type === "tool" ? beforePart.state.status : undefined,
          durable: stored,
          waitEffects,
        }).toMatchObject({
          control: { kind: "immediate_park" },
          durableControl: { kind: "immediate_park" },
          partStatus: "running",
          durable: [
            expect.objectContaining({
              attempt_id: expect.any(String),
              result: expect.objectContaining({
                kind: "json",
                value: expect.objectContaining({ metadata: expect.any(Object) }),
              }),
              time_created: expect.any(Number),
            }),
          ],
          waitEffects: 1,
        })

        const modelLookup = spyOn(Provider, "getModel").mockResolvedValue(model)
        const stream = spyOn(LLM, "stream").mockRejectedValue(new Error("park recovery must not start a model turn"))
        try {
          await SessionLoop.resumePermissionContinuation(request)
        } finally {
          stream.mockRestore()
          modelLookup.mockRestore()
        }
        const recovered = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
        const history = await PermissionAuthority.history()
        expect({
          assistant: recovered.info,
          part: recovered.parts.find((part) => part.type === "tool" && part.callID === request.toolCallID),
          waitEffects,
          automations: Database.use((db) =>
            db.select().from(AutomationTable).where(eq(AutomationTable.task_id, fixture.taskID)).all(),
          ),
          starts: history.filter(
            (event) => event.request_id === request.id && event.event_type === "execution_started",
          ),
          successes: history.filter(
            (event) => event.request_id === request.id && event.event_type === "execution_succeeded",
          ),
        }).toMatchObject({
          assistant: { finish: "tool-calls", time: { completed: expect.any(Number) } },
          part: { type: "tool", state: { status: "completed", metadata: expect.any(Object) } },
          waitEffects: 1,
          automations: [expect.objectContaining({ task_id: fixture.taskID })],
          starts: [expect.any(Object)],
          successes: [expect.any(Object)],
        })
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  test("completes the assistant exactly once after a permission-owned ToolPart-to-assistant cut", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        let waitEffects = 0
        const fixture = await projectedSchedulerSurface({
          projectPath: project.path,
          permissionMode: "ask",
          instrument(raw) {
            const originalWait = raw.wait
            if (!originalWait?.execute) throw new Error("Base scheduler projection did not build wait")
            raw.wait = bindToolExecutionMode(
              {
                ...originalWait,
                async execute(args: unknown, options: unknown) {
                  waitEffects++
                  return originalWait.execute(args, options)
                },
              },
              toolExecutionModeOf(originalWait),
            )
          },
        })
        const wait = fixture.tools.wait
        if (!wait?.execute) throw new Error("Projected scheduler wait is unavailable")
        let resolveAsked!: (request: PermissionAuthority.Request) => void
        const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
        const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
        const pending = wait.execute(
          { duration_ms: 1_000, reason: "verify the permission ToolPart-to-assistant recovery cut" },
          { toolCallId: "call_permission_part_cut", messages: [], abortSignal: fixture.abort },
        )
        const request = await asked
        stopAsked()
        await PermissionAuthority.reply({
          requestID: request.id,
          decision: "allow_once",
          actorID: "part-cut-test",
        })
        const committed = await pending
        await fixture.processor.completeRecoveredToolPart({
          toolCallID: request.toolCallID,
          toolInput: { duration_ms: 1_000, reason: "verify the permission ToolPart-to-assistant recovery cut" },
          output: committed as any,
        })
        const cut = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
        expect({
          assistantCompleted: cut.info.time.completed,
          part: cut.parts.find((part) => part.type === "tool" && part.callID === request.toolCallID),
        }).toMatchObject({
          assistantCompleted: undefined,
          part: { type: "tool", state: { status: "completed", metadata: expect.any(Object) } },
        })

        const stream = spyOn(LLM, "stream").mockRejectedValue(new Error("part recovery must not start a model turn"))
        try {
          await SessionLoop.resumePermissionContinuation(request)
          const first = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
          await SessionLoop.resumePermissionContinuation(request)
          const second = await MessageStore.get({ sessionID: fixture.session.id, messageID: fixture.assistant.id })
          const history = await PermissionAuthority.history()
          expect({
            first: first.info,
            second: second.info,
            waitEffects,
            automations: Database.use((db) =>
              db.select().from(AutomationTable).where(eq(AutomationTable.task_id, fixture.taskID)).all(),
            ),
            starts: history.filter(
              (event) => event.request_id === request.id && event.event_type === "execution_started",
            ).length,
            successes: history.filter(
              (event) => event.request_id === request.id && event.event_type === "execution_succeeded",
            ).length,
          }).toMatchObject({
            first: { finish: "tool-calls", time: { completed: expect.any(Number) } },
            second: { finish: "tool-calls", time: { completed: first.info.time.completed } },
            waitEffects: 1,
            automations: [expect.objectContaining({ task_id: fixture.taskID })],
            starts: 1,
            successes: 1,
          })
          expect(stream).toHaveBeenCalledTimes(0)
        } finally {
          stream.mockRestore()
        }
        await SessionRuntimeContractStore.dispose(fixture.session.id)
      },
    })
  }, 120_000)

  for (const cut of ["result", "part"] as const) {
    test(`recovers a projected permission wait exactly once across the ${cut}-boundary operating-system process cut`, async () => {
      await using project = await memoryProject()
      const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
      if (!processRoot) throw new Error("Tool-result permission process tests require the repository test runtime")
      const runtime = await createManagedTemporaryDirectory(processRoot, `tool-result-${cut}-runtime-`)
      const stateDirectory = await createManagedTemporaryDirectory(processRoot, `tool-result-${cut}-state-`)
      const stateFile = path.join(stateDirectory, "state.json")
      const worker = path.join(import.meta.dir, "fixture", "tool-result-control-permission-process-worker.ts")
      const environment = { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: processRoot }
      const children: ReturnType<typeof Bun.spawn>[] = []
      const spawn = (mode: string) => {
        const child = Bun.spawn(
          [
            process.execPath,
            `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
            worker,
            mode,
            project.path,
            stateFile,
          ],
          { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
        )
        children.push(child)
        return child
      }
      const read = async (child: ReturnType<typeof spawn>, expectedExit: number) => {
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ])
        expect(exitCode, stderr).toBe(expectedExit)
        return JSON.parse(stdout.trim()) as Record<string, any>
      }
      const openOccurrence = {
        assistant: {},
        part: expect.objectContaining({ status: "running" }),
        resultCount: 0,
        automationCount: 0,
        executionStarts: 0,
        executionSuccesses: 0,
      }
      const committedEffect = {
        durableControl: { kind: "immediate_park" },
        resultCount: 1,
        automationCount: 1,
        executionStarts: 1,
        executionSuccesses: 1,
      }
      try {
        expect(await read(spawn("init"), 86)).toMatchObject(openOccurrence)
        const cutSnapshot = await read(spawn(`cut-${cut}`), cut === "result" ? 87 : 88)
        expect(cutSnapshot).toMatchObject({
          assistant: {},
          part: expect.objectContaining(
            cut === "result"
              ? { status: "running" }
              : { status: "completed", control: { kind: "immediate_park" } },
          ),
          ...committedEffect,
        })
        const recovered = await read(spawn("recover"), 0)
        const completedOccurrence = {
          assistant: { finish: "tool-calls", completed: expect.any(Number) },
          part: expect.objectContaining({ status: "completed", control: { kind: "immediate_park" } }),
          ...committedEffect,
        }
        expect(recovered).toEqual({ first: completedOccurrence, second: completedOccurrence })
      } finally {
        for (const child of children) if (child.exitCode === null) child.kill()
        await Promise.all(children.map((child) => child.exited.catch(() => -1)))
        await removeManagedDirectoryTree(runtime)
        await removeManagedDirectoryTree(stateDirectory)
      }
    }, 300_000)
  }

  test("replays a completed parked ToolPart into its assistant exactly once after the Part-to-message cut", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Completed ToolPart recovery" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const toolStart = Date.now()
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_completed_park",
          tool: "wait",
          state: {
            status: "completed",
            input: { duration_ms: 1_000, reason: "recover assistant" },
            output: "scheduled",
            title: "Wait Scheduled",
            metadata: withImmediateParkToolResultControl({ jobID: "automation_recovered" }),
            time: { start: toolStart, end: toolStart + 1 },
          },
        })
        const request = PermissionAuthority.Request.parse({
          id: Identifier.ascending("permission"),
          projectID: Instance.project.id,
          sessionID: session.id,
          messageID: assistant.id,
          toolCallID: part.callID,
          mode: "ask",
          policyRevision: "policy-completed-park",
          providerKind: "builtin",
          providerID: "builtin",
          providerDigest: "provider-completed-park",
          toolName: "wait",
          effectClass: "internal",
          scopeVersion: "2",
          scope: {},
          fingerprint: "fingerprint-completed-park",
          summary: "recover completed parked ToolPart",
          projectGrantEligible: false,
          choices: ["allow_once", "deny"],
          timeCreated: Date.now(),
        })
        const stream = spyOn(LLM, "stream").mockRejectedValue(new Error("park recovery must not start a model turn"))
        try {
          await SessionLoop.resumePermissionContinuation(request)
          const first = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
          await SessionLoop.resumePermissionContinuation(request)
          const second = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
          expect({ first: first.info, second: second.info, parts: second.parts }).toMatchObject({
            first: { finish: "tool-calls", time: { completed: expect.any(Number) } },
            second: { finish: "tool-calls", time: { completed: first.info.time.completed } },
            parts: [expect.objectContaining({ id: part.id, state: expect.objectContaining({ status: "completed" }) })],
          })
          expect(stream).toHaveBeenCalledTimes(0)
        } finally {
          stream.mockRestore()
        }
      },
    })
  }, 120_000)

  test("requires a reset for a legacy successful permission result whose ToolPart is still recoverable", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Legacy Tool control recovery" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_legacy_permission_result",
          tool: "wait",
          state: { status: "running", input: {}, time: { start: Date.now() } },
        })
        Database.transaction((db) =>
          db
            .insert(PermissionExecutionResultTable)
            .values({
              attempt_id: "pat_legacy_tool_control",
              result: {
                kind: "json",
                value: {
                  title: "Wait Scheduled",
                  output: "scheduled",
                  metadata: { opencorvusParkAfterToolResult: true },
                },
              },
              time_created: Date.now(),
            })
            .run(),
        )
        Database.close()
        let observed: unknown
        try {
          Database.Client()
        } catch (error) {
          observed = error
        }
        expect(DatabaseUnavailableError.isInstance(observed) ? observed.data : undefined).toMatchObject({
          code: "DATA_RESET_REQUIRED",
          operation: "Database.Client.dataIntegrity.toolResultControl",
        })
        await Database.resetFiles(Database.Path())
        Database.Client()
      },
    })
  }, 120_000)

  test("accepts a completed historical ToolPart because it has no recoverable turn disposition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Historical Tool control" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const toolStart = Date.now()
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_historical_permission_result",
          tool: "wait",
          state: {
            status: "completed",
            input: {},
            output: "scheduled",
            title: "Wait Scheduled",
            metadata: { opencorvusParkAfterToolResult: true },
            time: { start: toolStart, end: toolStart + 1 },
          },
        })
        await Session.updateMessage({
          ...assistant,
          time: { ...assistant.time, completed: Date.now() },
          finish: "tool-calls",
        })
        Database.close()
        const reopened = Database.Client()
        expect(reopened.select().from(ToolPartOutcomeTable).get()).toMatchObject({ request_part_id: part.id })
      },
    })
  }, 120_000)

  test("rejects a real post-execution plugin that removes or changes host-owned turn control", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const pluginURL = pathToFileURL(
          path.resolve(import.meta.dir, "fixture/tool-result-control-mutation-plugin.ts"),
        ).href
        await Config.updateProjectPatch({ permission_mode: "full_access", plugin: [pluginURL] })
        const config = await Config.get()
        const agent = sessionRuntimeFromNativeAgent({ options: {}, tools: { global: ["wait"] } })
        const session = await Session.create({ kind: "assistant", title: "Plugin control preservation" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "coding",
          time: { created: Date.now() },
          agent: "coding",
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
        const executionSurface = async () => {
          const tools = await SessionLoop.resolveTools({
            agent,
            agentID: "coding",
            model,
            session,
            processor,
            messages: await Session.messages({ sessionID: session.id }),
            config,
          })
          const wait = tools.wait
          if (!wait?.execute) throw new Error("Wait Tool was not projected")
          return (reason: string, callID: string, signal: AbortSignal = abort) =>
            wait.execute!({ duration_ms: 1_000, reason }, { toolCallId: callID, messages: [], abortSignal: signal })
        }

        const removeSurface = await executionSurface()
        await expect(removeSurface("plugin-remove-control", "call_plugin_remove")).rejects.toBeInstanceOf(
          InvalidToolResultControlError,
        )
        const abortedAfterPhysicalControl = new AbortController()
        abortedAfterPhysicalControl.abort()
        await expect(
          removeSurface(
            "ordinary-after-removed-control",
            "call_plugin_after_remove",
            abortedAfterPhysicalControl.signal,
          ),
        ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)

        const changeSurface = await executionSurface()
        await expect(changeSurface("plugin-change-control", "call_plugin_change")).rejects.toBeInstanceOf(
          InvalidToolResultControlError,
        )
        const abortedAfterMalformedControl = new AbortController()
        abortedAfterMalformedControl.abort()
        await expect(
          changeSurface(
            "ordinary-after-changed-control",
            "call_plugin_after_change",
            abortedAfterMalformedControl.signal,
          ),
        ).rejects.toBeInstanceOf(ToolTurnExecutionConflictError)

        const ordinarySurface = await executionSurface()
        const aborted = new AbortController()
        aborted.abort()
        const ordinary = await ordinarySurface("ordinary-aborted-wait", "call_plugin_ordinary", aborted.signal)
        const persisted = await MessageStore.get({ sessionID: session.id, messageID: assistant.id })
        expect({ ordinary: toolResultControl(ordinary.metadata), parts: persisted.parts }).toEqual({
          ordinary: undefined,
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: "tool",
              callID: "call_plugin_remove",
              state: expect.objectContaining({ status: "running" }),
            }),
            expect.objectContaining({
              type: "tool",
              callID: "call_plugin_change",
              state: expect.objectContaining({ status: "running" }),
            }),
          ]),
        })
      },
    })
  }, 120_000)
})
