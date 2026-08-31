import fs from "node:fs/promises"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { EngineTaskRootIngressTable, EngineTaskWaitRegistrationTable } from "@/engine/engine.sql"
import { acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { MCP } from "@/mcp"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { createExactOrchestratorTool } from "@/orchestrator/tools"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Session } from "@/session"
import { LLM } from "@/session/llm"
import { SessionLoop } from "@/session/loop"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { createRuntimeToolOwner } from "@/session/runtime-tool-owner"
import { testRuntimeToolFactories } from "./runtime-tool-owner"
import { toolResultControl } from "@/session/tool-result-control"
import { Database, eq } from "@/storage/db"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { persistEstablishedTask } from "./engine-task"
import { resolveTestCapabilityTools } from "./capability-occurrence"

type State = {
  request: PermissionAuthority.Request
  taskID: string
  sessionID: string
  assistantID: string
  callID: string
}

const [mode, projectDirectory, stateFile] = process.argv.slice(2)
if (!mode || !projectDirectory || !stateFile) {
  throw new Error("Tool-result permission process worker requires mode, project, and state file")
}

declareNativeTaskProcessDeployment()
installDefaultControlPlaneToolLoaders()

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
} as Provider.Model

function installProviderModel() {
  Provider.getModel = (async () => model) as typeof Provider.getModel
}

async function snapshot(state: State) {
  const message = await MessageStore.get({ sessionID: state.sessionID, messageID: state.assistantID })
  const part = message.parts.find((candidate) => candidate.type === "tool" && candidate.callID === state.callID)
  const history = await PermissionAuthority.history()
  const results = Database.use((db) =>
    db.select().from(PermissionExecutionResultTable).all(),
  )
  const durableValue = results[0]?.result.kind === "json" ? results[0].result.value : undefined
  return {
    assistant: message.info.role === "assistant"
      ? { finish: message.info.finish, completed: message.info.time.completed }
      : undefined,
    part: part?.type === "tool"
      ? {
          id: part.id,
          status: part.state.status,
          control: part.state.status === "completed" ? toolResultControl(part.state.metadata) : undefined,
        }
      : undefined,
    durableControl:
      durableValue && typeof durableValue === "object" && !Array.isArray(durableValue)
        ? toolResultControl((durableValue as { metadata?: unknown }).metadata)
        : undefined,
    resultCount: results.length,
    automationCount: Database.use((db) =>
      db.select().from(EngineTaskWaitRegistrationTable)
        .where(eq(EngineTaskWaitRegistrationTable.task_id, state.taskID)).all(),
    ).length,
    executionStarts: history.filter(
      (event) => event.request_id === state.request.id && event.event_type === "execution_started",
    ).length,
    executionSuccesses: history.filter(
      (event) => event.request_id === state.request.id && event.event_type === "execution_succeeded",
    ).length,
  }
}

async function emitAndExit(state: State, exitCode: number): Promise<never> {
  process.stdout.write(JSON.stringify(await snapshot(state)))
  process.exit(exitCode)
}

async function initializeCut(): Promise<never> {
  installProviderModel()
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      await Config.updateProjectPatch({
        permission_mode: "ask",
        model: `${model.providerID}/${model.id}`,
        prompt_profile: { active: "base" },
      })
      const config = await Config.get()
      const { schedulerCapability, skillProjection } = await PromptProfileResolver.resolveSchedulerTurnProjection({
        projectDirectory,
        config,
      })
      const taskID = Identifier.ascending("task")
      const root = Session.prepareRootNext({
        kind: "root",
        directory: Instance.directory,
        title: "Cross-process Tool-result control root",
        metadata: { configOverlay: { prompt_profile: { active: schedulerCapability.expertSquadID } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: root,
        now,
        title: "Cross-process Tool-result control root",
        request: "Verify exact permission recovery across operating-system processes",
        productPillar: "code",
        metadata: { actor: "user" },
        projectID: Instance.project.id,
        packageRevision: schedulerCapability.packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: projectDirectory,
          packageRevisionSHA256: schedulerCapability.packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const ingress = Database.use((db) =>
        db.select().from(EngineTaskRootIngressTable)
          .where(eq(EngineTaskRootIngressTable.task_id, taskID))
          .orderBy(EngineTaskRootIngressTable.sequence, EngineTaskRootIngressTable.id)
          .get(),
      )
      if (!ingress) throw new Error(`Cross-process Tool-result Task ${taskID} has no creation ingress`)
      const activation = acquireTaskRootIngressLease({
        ingressID: ingress.id,
        ownerOccurrenceID: `tool-result-process:${taskID}`,
        now: now + 1,
        leaseMilliseconds: 120_000,
        assertControlOwnerInTransaction: () => undefined,
      })
      if (!activation.acquired) throw new Error(`Cross-process Tool-result Task ${taskID} could not acquire its ingress`)
      const session = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Cross-process Tool-result permission occurrence",
      })
      const control = currentOrchestratorControlMessage(
        { taskCreation: { taskID } },
        taskID,
        ingress.id,
        ingress.id,
      )
      if (!control) throw new Error(`Cross-process Tool-result Task ${taskID} has no control Message`)
      const user = await Session.updateMessage({
        id: control.messageID,
        sessionID: session.id,
        role: "user",
        author: "orchestrator",
        time: { created: now },
        agent: "orchestrator",
        model: { providerID: model.providerID, modelID: model.id },
        extra: control.extra,
      })
      await Session.updatePart({
        id: control.partID,
        sessionID: session.id,
        messageID: user.id,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      })
      const assistant = {
        id: Identifier.ascending("message"),
        parentID: user.id,
        acceptedInputMessageIDs: [user.id],
        sessionID: session.id,
        role: "assistant",
        author: "orchestrator",
        agent: "orchestrator",
        path: { cwd: projectDirectory, root: projectDirectory },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: model.id,
        providerID: model.providerID,
        time: { created: now },
        activationID: activation.activationID,
      } as const
      const owner = MCP.createScopedConnectionOwner(
        computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID, sessionID: session.id }),
      )
      const dispatchAgents = [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents]
      const materializeBuiltIn = (toolID: string) =>
        createExactOrchestratorTool({
          toolID,
          taskID,
          agentSessionID: session.id,
          sendSchedulerMessage,
          dispatchAgents,
        })
      const projectedTools = Object.fromEntries(
        await Promise.all(
          PromptProfileResolver.schedulerRuntimeToolIDs(schedulerCapability).map(async (toolID) => {
            const exact = schedulerCapability.builtInToolIDs.includes(toolID)
              ? materializeBuiltIn(toolID)
              : await PromptProfileResolver.exactProjectedExtensionTool({
                  capability: schedulerCapability,
                  providerName: toolID,
                  runtimeTool: materializeBuiltIn,
                  taskID,
                  projectDirectory,
                  toolDirectory: projectDirectory,
                  connectionOwner: owner,
                })
            if (!exact) throw new Error(`Projected process fixture cannot materialize ${toolID}`)
            return [toolID, exact] as const
          }),
        ),
      )
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
        skillProjection,
        harnessGrants: PromptProfileResolver.schedulerHarnessGrants({
          taskID,
          capability: schedulerCapability,
          projectedToolIDs: Object.keys(projectedTools),
        }),
        projectDirectory,
        includeMcpTools: false,
        system: [],
        systemMode: "complete",
        resources: {
          mcp: owner,
          tools: createRuntimeToolOwner({ leaves: testRuntimeToolFactories(projectedTools, "projected") }),
        },
      })
      const abort = new AbortController().signal
      const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
      const runtime = sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config }))
      const { tools } = await resolveTestCapabilityTools({
        agent: runtime,
        agentID: "orchestrator",
        model,
        session,
        assistant,
        processor,
        messages: await Session.messages({ sessionID: session.id }),
        config,
        activeLocalRefs: ["wait"],
      })
      const wait = tools.wait
      if (!wait?.execute) throw new Error("Projected scheduler wait is unavailable")
      let resolveAsked!: (request: PermissionAuthority.Request) => void
      const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
      const stopAsked = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
      void wait.execute(
        { duration_ms: 1_000, reason: "verify cross-process Tool-result recovery" },
        { toolCallId: "call_process_permission_wait", messages: [], abortSignal: abort },
      ).catch(() => undefined)
      const request = await asked
      stopAsked()
      const state = { request, taskID, sessionID: session.id, assistantID: assistant.id, callID: request.toolCallID }
      await fs.writeFile(stateFile, JSON.stringify(state))
      return emitAndExit(state, 86)
    },
  })
}

async function runCut(state: State, cut: "result" | "part"): Promise<never> {
  installProviderModel()
  LLM.stream = (async () => {
    throw new Error("Tool-result control recovery must not start a model turn")
  }) as typeof LLM.stream
  if (cut === "result") {
    const originalCreate = SessionProcessor.create
    SessionProcessor.create = ((input: Parameters<typeof originalCreate>[0]) => {
      const processor = originalCreate(input)
      processor.completeRecoveredToolPart = async () => emitAndExit(state, 87)
      return processor
    }) as typeof SessionProcessor.create
  } else {
    const originalUpdateMessage = Session.updateMessage
    Session.updateMessage = (async (input: Parameters<typeof originalUpdateMessage>[0]) => {
      if (input.id === state.assistantID && input.role === "assistant" && input.time.completed !== undefined) {
        return emitAndExit(state, 88)
      }
      return originalUpdateMessage(input)
    }) as typeof Session.updateMessage
  }
  return Instance.provide({
    directory: projectDirectory,
    init: async () => {},
    fn: async () => {
      Database.Client()
      await PermissionAuthority.reply({
        requestID: state.request.id,
        decision: "allow_once",
        actorID: `process-${cut}-cut`,
      })
      throw new Error(`Process ${cut} cut did not reach its exact persistence boundary`)
    },
  })
}

async function recover(state: State) {
  installProviderModel()
  LLM.stream = (async () => {
    throw new Error("Tool-result control recovery must not start a model turn")
  }) as typeof LLM.stream
  return Instance.provide({
    directory: projectDirectory,
    init: async () => {},
    fn: async () => {
      Database.Client()
      await SessionLoop.resumePermissionContinuation(state.request)
      const first = await snapshot(state)
      await SessionLoop.resumePermissionContinuation(state.request)
      return { first, second: await snapshot(state) }
    },
  })
}

try {
  if (mode === "init") await initializeCut()
  const state = JSON.parse(await fs.readFile(stateFile, "utf8")) as State
  if (mode === "cut-result") await runCut(state, "result")
  if (mode === "cut-part") await runCut(state, "part")
  if (mode !== "recover") throw new Error(`Unknown Tool-result permission process mode ${mode}`)
  const output = await recover(state)
  await Instance.disposeAll()
  Database.close()
  process.stdout.write(JSON.stringify(output))
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
