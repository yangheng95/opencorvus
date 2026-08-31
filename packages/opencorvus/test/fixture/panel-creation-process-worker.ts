import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { Config } from "@/config/config"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Question } from "@/question"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { SessionWake } from "@/session/wake"
import { Tool } from "@/tool/tool"
import { PanelTool } from "@/tool/panel"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { TaskCreationCommitTestHooks } from "@/task-api"
import { requireTask } from "@/engine/store"

const [mode, barrierDirectory, projectDirectory, action] = process.argv.slice(2)
if (
  !mode ||
  !barrierDirectory ||
  !projectDirectory ||
  (action !== "create_task" && action !== "wake_mission" && action !== "wake_work")
) {
  throw new Error("Panel process worker requires mode, barrier, project directory and Panel creation action")
}

declareNativeTaskProcessDeployment()
const identityPath = path.join(barrierDirectory, `${action}.identity.json`)
const readyPath = path.join(barrierDirectory, `${action}.ready`)

async function seed() {
  await Config.updateProjectPatch({
    model: "panel-process/model",
    provider: {
      "panel-process": {
        name: "Panel process recovery",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/panel-process",
        models: {
          model: {
            name: "Panel process recovery",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
  const caller = await createRightSidebarConversationSession("chat", { title: `Process ${action}` })
  const now = Date.now()
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: caller.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "chat",
    model: { providerID: "panel-process", modelID: "model" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: caller.id,
    role: "assistant",
    author: "chat",
    parentID: user.id,
    time: { created: now + 1 },
    agent: "chat",
    providerID: "panel-process",
    modelID: "model",
    path: { cwd: Instance.directory, root: Instance.project.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const callID = `panel-process-${action}`
  const params = action === "create_task"
    ? {
        action,
        title: `Process ${action}`,
        request: `Recover ${action} after its target commits`,
        productPillar: "code" as const,
      }
    : {
        action,
        title: `Process ${action}`,
        request: `Recover ${action} after its target commits`,
        reason: "Cross-process recovery acceptance",
      }
  const { action: _action, ...toolInput } = params
  const part = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: caller.id,
    messageID: assistant.id,
    type: "tool",
    callID,
    tool: `panel_${action}`,
    state: { status: "running", input: toolInput, time: { start: now + 1 } },
  })
  await fs.writeFile(identityPath, JSON.stringify({ callerID: caller.id, messageID: assistant.id, partID: part.id }))
  const cut = action === "create_task"
    ? TaskCreationCommitTestHooks.installBeforeAcceptedReconciliation(() => {
        fsSync.writeFileSync(readyPath, "target-committed")
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0)
      })
    : SessionWake.TestHooks.installBeforeWakeLoopActivation(async () => {
        await fs.writeFile(readyPath, "target-committed")
        await new Promise<never>(() => undefined)
      })
  using _cut = cut
  const panel = await PanelTool.init({ agentID: "chat" })
  const execution = panel.execute(params, {
    sessionID: caller.id,
    messageID: assistant.id,
    callID,
    agent: "chat",
    abort: new AbortController().signal,
    messages: [],
    executionSurface: Tool.executionSurface([`panel_${action}`], []),
    extra: { surface: "right-sidebar" },
    metadata() {},
  })
  if (action !== "create_task") {
    const deadline = Date.now() + 15_000
    while (true) {
      const pending = (await Question.list()).find((candidate) => candidate.sessionID === caller.id)
      if (pending) {
        await Question.reply({ requestID: pending.id, answers: [["yes"]] })
        break
      }
      if (Date.now() >= deadline) throw new Error(`panel.${action} did not request operator confirmation`)
      await Bun.sleep(5)
    }
  }
  await execution
  throw new Error("Panel process cut unexpectedly completed")
}

async function recover() {
  const identity = JSON.parse(await fs.readFile(identityPath, "utf8")) as {
    callerID: string
    messageID: string
    partID: string
  }
  using _wake = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  const recovered = await SessionLoop.terminalizeRecoveredIncompleteAssistant(identity.callerID)
  const message = (await Session.messages({ sessionID: identity.callerID }))
    .find((candidate) => candidate.info.id === identity.messageID)
  const part = message?.parts.find((candidate) => candidate.id === identity.partID)
  if (!message || part?.type !== "tool" || part.state.status !== "completed") {
    throw new Error(`Panel ${action} generic recovery did not complete the persisted Tool occurrence`)
  }
  const output = JSON.parse(part.state.output) as { session_id?: string; task_id?: string }
  const targetID = output.task_id ?? output.session_id
  if (!targetID) throw new Error(`Panel ${action} recovered without a target identity`)
  const targetSessionID = output.task_id ? requireTask(output.task_id).session_id : output.session_id
  if (!targetSessionID) throw new Error(`Panel ${action} recovered target has no Session`)
  const targetMessages = await Session.messages({ sessionID: targetSessionID })
  return {
    recovered,
    partStatus: part.state.status,
    assistantCompleted: message.info.time.completed !== undefined,
    targetID,
    targetUserMessages: targetMessages.filter((candidate) => candidate.info.role === "user").length,
  }
}

try {
  const output = await Instance.provide({
    directory: projectDirectory,
    init: InstanceBootstrap,
    fn: () => mode === "seed" ? seed() : recover(),
  })
  console.log(JSON.stringify(output))
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
