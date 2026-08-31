import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { createRightSidebarConversationSession } from "@/chat/session"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Question } from "@/question"
import { Session } from "@/session"
import type { Message } from "@/session/message"
import { SessionWake } from "@/session/wake"
import { Tool } from "@/tool/tool"
import { PanelTool, recoverPanelCreationToolPart } from "@/tool/panel"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { exportMysqlTransferSnapshot, importMysqlTransferSnapshot } from "@/storage/mysql-transfer"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function persistedPanelWake(action: "wake_mission" | "wake_work", label: string) {
  const caller = await createRightSidebarConversationSession("chat", { title: `Caller ${label}` })
  const now = Date.now()
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: caller.id,
    role: "user",
    author: "user",
    time: { created: now },
    agent: "chat",
    model: { providerID: "panel-recovery", modelID: "model" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: caller.id,
    role: "assistant",
    author: "chat",
    parentID: user.id,
    time: { created: now + 1 },
    agent: "chat",
    providerID: "panel-recovery",
    modelID: "model",
    path: { cwd: Instance.directory, root: Instance.project.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const callID = `panel-${action}-${label}`
  const params = {
    action,
    title: `${action} ${label}`,
    request: `Continue the exact ${action} occurrence ${label}`,
    reason: `The request belongs in ${action === "wake_mission" ? "Mission" : "Work"}`,
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
  if (part.type !== "tool") throw new Error("Panel wake fixture did not persist a Tool Part")
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
  const deadline = Date.now() + 10_000
  let pending: Awaited<ReturnType<typeof Question.list>>[number] | undefined
  while (!pending) {
    pending = (await Question.list()).find((candidate) => candidate.sessionID === caller.id)
    if (Date.now() >= deadline) throw new Error(`panel.${action} did not publish its operator question`)
    if (!pending) await Bun.sleep(5)
  }
  await Question.reply({ requestID: pending.id, answers: [["yes"]] })
  return { caller, assistant, part: part as Message.ToolPart, first: await execution }
}

describe("persisted Panel creation occurrence recovery", () => {
  for (const action of ["wake_mission", "wake_work"] as const) {
    test(`panel.${action} replays the exact accepted target from its persisted Tool Part`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        init: InstanceBootstrap,
        fn: async () => {
          await Config.updateProjectPatch({
            model: "panel-recovery/model",
            provider: {
              "panel-recovery": {
                name: "Panel recovery provider",
                npm: "@ai-sdk/openai-compatible",
                api: "http://127.0.0.1:9/panel-recovery",
                models: {
                  model: {
                    name: "Panel recovery model",
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 1_000_000, output: 4_096 },
                  },
                  "model-2": {
                    name: "Changed caller model",
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 1_000_000, output: 4_096 },
                  },
                },
              },
            },
          })
          using _wake = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
          const occurrence = await persistedPanelWake(action, "recovery")
          await Database.awaitEffectIdle(10_000)
          const targetID = JSON.parse(occurrence.first.output).session_id as string
          const snapshot = exportMysqlTransferSnapshot()
          const targetRow = snapshot.tables
            .find((table) => table.name === "session")
            ?.rows.find((row) => row.id === targetID)
          if (!targetRow) throw new Error("Panel recovery transfer omitted its accepted target Session")
          const targetMetadata = JSON.parse(String(targetRow.metadata)) as Record<string, unknown>
          const panelCreation = targetMetadata.panelCreation as Record<string, unknown>
          const reorderedPanelCreation = Object.fromEntries(Object.entries(panelCreation).reverse())
          expect(JSON.stringify(reorderedPanelCreation)).not.toBe(JSON.stringify(panelCreation))
          targetMetadata.panelCreation = reorderedPanelCreation
          targetRow.metadata = JSON.stringify(targetMetadata)
          expect(importMysqlTransferSnapshot(snapshot)).toMatchObject({ ok: true })
          if (action === "wake_mission") {
            await Session.mergeConfigOverlay({
              sessionID: occurrence.caller.id,
              patch: { model: "panel-recovery/model-2" },
            })
          }
          const replay = await recoverPanelCreationToolPart({
            sessionID: occurrence.caller.id,
            messageID: occurrence.assistant.id,
            agent: "chat",
            part: occurrence.part,
          })
          expect(replay).toEqual(occurrence.first)
          const targetMessages = await Session.messages({ sessionID: targetID })
          expect({ targetID, userMessages: targetMessages.filter((message) => message.info.role === "user").length }).toEqual({
            targetID: expect.any(String),
            userMessages: 1,
          })
          expect(await EngineService.deleteSession(targetID, { projectID: Instance.project.id })).toBe(true)
          const unavailable = await recoverPanelCreationToolPart({
            sessionID: occurrence.caller.id,
            messageID: occurrence.assistant.id,
            agent: "chat",
            part: occurrence.part,
          })
          const repeated = await recoverPanelCreationToolPart({
            sessionID: occurrence.caller.id,
            messageID: occurrence.assistant.id,
            agent: "chat",
            part: occurrence.part,
          })
          expect(unavailable).toEqual(repeated)
          expect(JSON.parse(unavailable!.output)).toEqual({
            kind: "accepted_target_unavailable",
            operation: action,
            target_id: targetID,
            message: `The accepted ${action} target ${targetID} is no longer available.`,
          })
        },
      })
    }, 120_000)
  }
})
