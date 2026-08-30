import fs from "node:fs"
import path from "node:path"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import {
  reconcileTaskControlPlane,
  TestHooks as TaskControlTestHooks,
  type TaskIngressRunResult,
} from "@/engine/task-root-ingress-delivery"
import { listTaskWaits } from "@/engine/task-wait"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionTable } from "@/session/session.sql"
import { Database, and, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { Tool } from "@/tool/tool"
import { WaitTool } from "@/tool/wait"
import { persistEstablishedTask } from "./engine-task"

type Mode = "seed" | "due-blocked" | "operator" | "reconcile"

const [rawMode, projectPath, taskKey, barrierDirectory] = process.argv.slice(2)
if (
  (rawMode !== "seed" && rawMode !== "due-blocked" && rawMode !== "operator" && rawMode !== "reconcile") ||
  !projectPath ||
  !taskKey
) {
  throw new Error("Task wait ingress race worker requires seed|due-blocked|operator|reconcile, project path and key")
}
const mode: Mode = rawMode
if (mode === "due-blocked" && !barrierDirectory) {
  throw new Error("Blocked Task wait worker requires a barrier directory")
}

declareNativeTaskProcessDeployment()

const taskID = Identifier.deterministic("task", `task-wait-ingress-race\0${taskKey}`)
const rootSessionID = Identifier.deterministic("session", `task-wait-ingress-race-root\0${taskKey}`)
const modelID = "task-wait-race-model"
const providerID = "task-wait-race-provider"
const config = Config.Info.parse({
  model: `${providerID}/${modelID}`,
  prompt_profile: { active: "base" },
  mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
  provider: {
    [providerID]: {
      name: "Task wait race Provider",
      npm: "@ai-sdk/openai-compatible",
      api: "http://127.0.0.1:9/task-wait-race",
      models: {
        [modelID]: {
          name: "Task wait race model",
          tool_call: true,
          modalities: { input: ["text"], output: ["text"] },
          limit: { context: 1_000_000, output: 4_096 },
        },
      },
    },
  },
})

function requireTaskSessions() {
  return Database.use((db) => {
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
    if (!task?.session_id) throw new Error(`Task wait race Task ${taskID} has no root Session`)
    const scheduler = db
      .select()
      .from(SessionTable)
      .where(and(eq(SessionTable.parent_id, task.session_id), eq(SessionTable.kind, "orchestrator")))
      .get()
    if (!scheduler) throw new Error(`Task wait race Task ${taskID} has no Orchestrator Session`)
    return { rootSessionID: task.session_id, schedulerSessionID: scheduler.id }
  })
}

async function persistControl(input: {
  event: Parameters<typeof currentOrchestratorControlMessage>[0]
  wakeID: string
  predecessorID?: string
  schedulerSessionID: string
}) {
  const control = currentOrchestratorControlMessage(
    input.event,
    taskID,
    input.wakeID,
    input.predecessorID ?? input.wakeID,
  )
  if (!control) throw new Error(`Task wait race ingress ${input.wakeID} has no control Message`)
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: input.schedulerSessionID,
      role: "user",
      author: "orchestrator",
      time: { created: Date.now() },
      agent: "orchestrator",
      model: { providerID, modelID },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: input.schedulerSessionID,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      } satisfies Message.TextPart,
    ],
  })
  return control
}

async function commitWaitDecision(input: {
  event?: Parameters<typeof currentOrchestratorControlMessage>[0]
  wakeID?: string
  activationID?: string
  predecessorID?: string
}): Promise<TaskIngressRunResult> {
  if (!input.event || !input.wakeID || !input.activationID) {
    throw new Error("Task wait seed runner requires exact event, wake and activation identities")
  }
  const { schedulerSessionID } = requireTaskSessions()
  const control = await persistControl({
    event: input.event,
    wakeID: input.wakeID,
    predecessorID: input.predecessorID,
    schedulerSessionID,
  })
  let assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: control.messageID,
    sessionID: schedulerSessionID,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID,
    modelID,
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
    finish: "tool-calls",
    activationID: input.activationID,
  })
  const waitInput = { duration_ms: 1_500, reason: `Cross-process wait for ${taskKey}` }
  const toolPartID = Identifier.ascending("part")
  const toolCallID = Identifier.ascending("call")
  const startedAt = Date.now()
  await Session.updatePart({
    id: toolPartID,
    sessionID: schedulerSessionID,
    messageID: assistant.id,
    type: "tool",
    callID: toolCallID,
    tool: "wait",
    state: { status: "running", input: waitInput, time: { start: startedAt } },
  })
  const waitTool = await WaitTool.init()
  const result = await waitTool.execute(waitInput, {
    sessionID: schedulerSessionID,
    messageID: assistant.id,
    callID: toolCallID,
    agent: "orchestrator",
    abort: new AbortController().signal,
    extra: { toolPartID, projectID: Instance.project.id, surface: "task-wait-cross-process" },
    messages: [],
    executionAuthority: {
      kind: "task",
      sessionID: schedulerSessionID,
      projectID: Instance.project.id,
      taskID,
      directory: projectPath,
    },
    executionSurface: Tool.executionSurface(["wait"], []),
    metadata() {},
  })
  await Session.updatePart({
    id: toolPartID,
    sessionID: schedulerSessionID,
    messageID: assistant.id,
    type: "tool",
    callID: toolCallID,
    tool: "wait",
    state: {
      status: "completed",
      input: waitInput,
      output: result.output,
      title: result.title,
      metadata: result.metadata,
      time: { start: startedAt, end: Date.now() },
    },
  })
  assistant = await Session.updateMessage({ ...assistant, time: { ...assistant.time, completed: Date.now() } })
  return { finalMessageID: assistant.id }
}

async function commitManageTaskDecision(input: {
  event?: Parameters<typeof currentOrchestratorControlMessage>[0]
  wakeID?: string
  activationID?: string
  predecessorID?: string
}): Promise<TaskIngressRunResult> {
  if (!input.event || !input.wakeID || !input.activationID) {
    throw new Error("Task wait reconciliation runner requires exact event, wake and activation identities")
  }
  const { schedulerSessionID } = requireTaskSessions()
  const control = await persistControl({
    event: input.event,
    wakeID: input.wakeID,
    predecessorID: input.predecessorID,
    schedulerSessionID,
  })
  let assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: control.messageID,
    sessionID: schedulerSessionID,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID,
    modelID,
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
    finish: "tool-calls",
    activationID: input.activationID,
  })
  const stateInput = { action: "inspect" }
  const startedAt = Date.now()
  const request = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: schedulerSessionID,
    messageID: assistant.id,
    type: "tool",
    callID: `call_${input.wakeID}`,
    tool: "manage_task",
    state: { status: "running", input: stateInput, time: { start: startedAt } },
  })
  await Session.updatePart({
    ...request,
    state: {
      status: "completed",
      input: stateInput,
      output: "Task ingress reconciled",
      title: "Manage Task",
      metadata: {},
      time: { start: startedAt, end: Date.now() },
    },
  })
  assistant = await Session.updateMessage({ ...assistant, time: { ...assistant.time, completed: Date.now() } })
  return { finalMessageID: assistant.id }
}

async function run() {
  return Instance.provide({
    directory: projectPath,
    fn: async () => {
      if (mode === "seed") {
        await Config.updateGlobalPatch({ model: config.model, provider: config.provider })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: projectPath,
          config,
        })
        const now = Date.now()
        const root = Session.prepareRootNext({
          id: rootSessionID,
          kind: "root",
          directory: projectPath,
          title: `Task wait ingress race ${taskKey}`,
          metadata: {
            configOverlay: {
              model: `${providerID}/${modelID}`,
              prompt_profile: { active: scheduler.packageRevision.id },
            },
          },
        })
        persistEstablishedTask({
          taskID,
          rootSession: root,
          now,
          title: `Task wait ingress race ${taskKey}`,
          request: "Converge one due wait against concurrent operator input after process restart",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision: scheduler.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: projectPath,
            packageRevisionSHA256: scheduler.packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        await Session.create({ kind: "orchestrator", parentID: root.id, title: `Task wait scheduler ${taskKey}` })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: commitWaitDecision })
        await reconcileTaskControlPlane(taskID)
        const waits = listTaskWaits(taskID)
        if (waits.length !== 1 || waits[0].status !== "scheduled") {
          throw new Error(`Task wait seed ${taskKey} produced ${JSON.stringify(waits)}`)
        }
        return { mode, taskID, projectID: Instance.project.id, rootSessionID, wait: waits[0] }
      }

      if (mode === "due-blocked") {
        using _timing = TaskControlTestHooks.replaceLeaseTiming({
          leaseMilliseconds: 500,
          renewalMilliseconds: 150,
        })
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID, activationID, event }) => {
            if (!wakeID || !activationID || !event?.taskWaitWake) {
              throw new Error("Blocked Task wait worker claimed a non-wait ingress")
            }
            fs.writeFileSync(
              path.join(barrierDirectory!, "due-owner-ready.json"),
              JSON.stringify({ taskID, waitID: event.taskWaitWake.jobID, wakeID, activationID }),
            )
            // Keep a referenced timer alive so the production renewal interval
            // can extend this lease until the parent really kills the process.
            for (;;) await Bun.sleep(50)
          },
        })
        await reconcileTaskControlPlane(taskID)
        throw new Error("Blocked Task wait owner unexpectedly completed")
      }

      if (mode === "operator") {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: commitManageTaskDecision })
        const result = await EngineService.handleTaskMessage(taskID, {
          text: `Operator input racing due wait for ${taskKey}`,
          source: "test.task-wait-cross-process-race",
        })
        return { mode, taskID, result }
      }

      const activatedWakeIDs: string[] = []
      using _timing = TaskControlTestHooks.replaceLeaseTiming({ leaseMilliseconds: 500, renewalMilliseconds: 150 })
      using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
        runner: async (input) => {
          if (!input.wakeID) throw new Error("Task wait reconciliation has no exact wake ID")
          activatedWakeIDs.push(input.wakeID)
          return commitManageTaskDecision(input)
        },
      })
      const activatedCount = await reconcileTaskControlPlane(taskID)
      return {
        mode,
        taskID,
        projectID: Instance.project.id,
        activatedCount,
        activatedWakeIDs,
        waits: listTaskWaits(taskID),
      }
    },
  })
}

try {
  const output = await run()
  await Instance.disposeAll()
  console.log(JSON.stringify(output))
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
