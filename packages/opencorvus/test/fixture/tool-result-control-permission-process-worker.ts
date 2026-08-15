import fs from "node:fs/promises"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { MCP } from "@/mcp"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { createOrchestratorTools } from "@/orchestrator/tools"
import { PermissionAuthority } from "@/permission/authority"
import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { installDefaultTaskWakeRuntime } from "@/scheduler/task-wake-composition"
import { AutomationTable } from "@/scheduler/automation.sql"
import { Session } from "@/session"
import { LLM } from "@/session/llm"
import { SessionLoop } from "@/session/loop"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { toolResultControl } from "@/session/tool-result-control"
import { Database, eq } from "@/storage/db"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { persistEstablishedTask } from "./engine-task"

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
installDefaultTaskWakeRuntime()
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
      db.select().from(AutomationTable).where(eq(AutomationTable.task_id, state.taskID)).all(),
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
      const root = await Session.create({
        kind: "root",
        title: "Cross-process Tool-result control root",
        metadata: { configOverlay: { prompt_profile: { active: schedulerCapability.expertSquadID } } },
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        sessionID: root.id,
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
      const session = await Session.create({
        kind: "orchestrator",
        parentID: root.id,
        title: "Cross-process Tool-result permission occurrence",
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
        text: "Schedule one exact projected wait.",
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        parentID: user.id,
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
      })
      const raw = createOrchestratorTools({
        taskID,
        agentSessionID: session.id,
        dispatchAgents: [...skillProjection.schedulerOnlyAgents, ...skillProjection.projectedAgents],
      }).tools as Record<string, any>
      const owner = MCP.createScopedConnectionOwner(
        computerRuntimeScopeIdentity({ ownerKind: "orchestrator", taskID, sessionID: session.id }),
      )
      const projectedTools = await PromptProfileResolver.projectOrchestratorTools(raw, schedulerCapability, {
        taskID,
        projectDirectory,
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
        projectDirectory,
        includeMcpTools: false,
        system: [],
        systemMode: "complete",
        resources: { mcp: owner },
      })
      const abort = new AbortController().signal
      const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
      const runtime = sessionRuntimeFromNativeAgent(await HostAgentRegistry.get("orchestrator", { config }))
      const tools = await SessionLoop.resolveTools({
        agent: runtime,
        agentID: "orchestrator",
        model,
        session,
        processor,
        messages: await Session.messages({ sessionID: session.id }),
        config,
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
