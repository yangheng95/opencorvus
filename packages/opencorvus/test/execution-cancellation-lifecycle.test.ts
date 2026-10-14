import { afterEach, expect, mock, spyOn, test } from "bun:test"
import { EngineGit } from "@/engine/git"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import {
  TestHooks as TaskControlTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Orchestrator } from "@/orchestrator/agent"
import {
  ensureTaskMessageProtocolBridge,
  awaitTaskMessageProtocolBridgeIdle,
} from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { ExecutionCancellationError, createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { SessionStatus } from "@/session/status"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { DelegateAgentTool } from "@/tool/delegate-agent"
import { Tool } from "@/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  mock.restore()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

const model = {
  id: "cancellation-lifecycle",
  providerID: "test",
  name: "Cancellation lifecycle contract",
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
  api: { id: "cancellation-lifecycle", url: "https://cancellation.test.invalid", npm: "@ai-sdk/anthropic" },
  options: {},
  headers: {},
  status: "active",
  release_date: "2026-10-15",
} as Provider.Model

function lifecycle(sessionID: string, inputMessageID: string) {
  return ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", inputMessageID)?.payload
}

async function inputOccurrence(sessionID: string, agent: string) {
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID,
    role: "user",
    author: "user",
    agent,
    time: { created: Date.now() },
    model: { providerID: model.providerID, modelID: model.id },
  })
  SessionStatus.beginExecutionOccurrence(sessionID, input.id)
  await SessionStatus.set(sessionID, { type: "streaming" })
  return input.id
}

for (const source of ["user", "mission", "provider"] as const) {
  test(`Orchestrator records the exact ${source} disposition while its wake signal remains active`, async () => {
    await using project = await memoryProject(`orchestrator-disposition-${source}`)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        ensureTaskMessageProtocolBridge()
        using runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async (input) => {
            expect(input.signal.aborted).toBe(false)
            return {
              finalMessageID: await Orchestrator.processTask(
                input.taskID,
                input.event,
                input.signal,
                input.wakeID,
                input.activationID,
                input.predecessorID,
              ),
            }
          },
        })
        spyOn(Provider, "getModel").mockResolvedValue(model)
        spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
        spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))
        let sessionID = "",
          inputID = "",
          taskID = ""
        const reason = source === "provider" ? "Actual provider failure contract" : `Original ${source} cancellation`
        spyOn(SessionPrompt, "loop").mockImplementation(async (input) => {
          sessionID = input.sessionID
          inputID = input.reply_to_message_id!
          const contract = SessionPrompt.getSessionRuntimeContract(sessionID)
          taskID = contract!.identity.taskID!
          SessionStatus.beginExecutionOccurrence(sessionID, inputID)
          await SessionStatus.set(sessionID, { type: "streaming" }, { taskID })
          if (source === "provider") throw new Error(reason)
          const origin = createExecutionCancellationOrigin({
            actor: source,
            source: source === "user" ? "task.cancel" : "mission.abort",
            surface: "runtime",
            reason,
            taskID,
            requestID: `${taskID}:original-cancel`,
            ...(source === "mission" ? { missionID: "mission-lifecycle-contract" } : {}),
          })
          const requested = Database.immediateTransaction(() =>
            EngineProtocol.emitInTransaction(
              Event.TaskCancellationRequested,
              {
                actor: origin.actor,
                surface: origin.surface,
                reason,
                summary: reason,
                execution_epoch: 1,
                ...(origin.missionID ? { missionID: origin.missionID } : {}),
              },
              { taskID, source: origin.source, correlationID: origin.requestID },
            ),
          )
          throw new ExecutionCancellationError({
            source: "session_prompt",
            sessionID,
            message: reason,
            origin: { ...origin, causationEventID: requested.id },
          })
        })
        const peer = await Session.create({ kind: "assistant", title: "Independent active peer" })
        const peerInput = await inputOccurrence(peer.id, "work")
        await EngineService.createTask(
          {
            requestID: `disposition-${Identifier.ascending("artifact")}`,
            title: `Orchestrator ${source} disposition`,
            request: "Verify the original execution disposition",
            productPillar: "work",
            model: `${model.providerID}/${model.id}`,
            promptProfile: "base",
          },
          { actor: "user" },
        )
        await waitForIngressDeliveryHooksForTest()
        await awaitTaskMessageProtocolBridgeIdle()
        expect(lifecycle(sessionID, inputID)).toMatchObject({
          inputMessageID: inputID,
          status: {
            type: "terminal",
            reason: source === "provider" ? "error" : "aborted",
            error: source === "provider" ? `Error: ${reason}` : reason,
          },
        })
        expect(lifecycle(peer.id, peerInput)).toMatchObject({
          inputMessageID: peerInput,
          status: { type: "streaming" },
        })
        if (source === "provider") expect(taskLifecycleProjection(taskID).status).toBe("failed")
      },
    })
  }, 60_000)
}

for (const source of ["user", "mission", "provider"] as const) {
  test(`standalone delegation preserves the exact ${source} rejection and publishes its disposition`, async () => {
    await using project = await memoryProject(`delegate-disposition-${source}`)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        ensureTaskMessageProtocolBridge()
        const parent = await Session.create({ kind: "assistant", title: "Independent parent" })
        const parentAbort = new AbortController()
        const reason = `Original ${source} rejection`
        const failure =
          source === "provider"
            ? new Error(reason)
            : new ExecutionCancellationError({
                source: "session_prompt",
                message: reason,
                origin: createExecutionCancellationOrigin({
                  actor: source,
                  source: source === "user" ? "session.abort" : "mission.abort",
                  surface: "runtime",
                  reason,
                }),
              })
        let childID = "",
          inputID = ""
        spyOn(SessionPrompt, "prompt").mockImplementation(async (input, hooks) => {
          await hooks?.beforeLoop?.()
          childID = input.sessionID
          inputID = await inputOccurrence(childID, "work")
          throw failure
        })
        const tool = await DelegateAgentTool.init()
        const actual = await tool
          .execute(
            { instruction: "Verify one original rejection" },
            {
              sessionID: parent.id,
              messageID: "msg_parent",
              callID: "call_disposition",
              agent: "work",
              abort: parentAbort.signal,
              extra: { model: { providerID: model.providerID, id: model.id } },
              messages: [],
              executionAuthority: Object.freeze({
                kind: "conversation",
                sessionID: parent.id,
                projectID: Instance.project.id,
                rootDirectory: Instance.directory,
              }),
              executionSurface: Tool.executionSurface(["delegate_agent"], []),
              metadata() {},
            },
          )
          .then(
            () => {
              throw new Error("Expected the original rejection")
            },
            (error) => error,
          )
        await awaitTaskMessageProtocolBridgeIdle()
        expect(actual).toBe(failure)
        expect(parentAbort.signal.aborted).toBe(false)
        expect(lifecycle(childID, inputID)).toMatchObject({
          inputMessageID: inputID,
          status: { type: "terminal", reason: source === "provider" ? "error" : "aborted", error: reason },
        })
      },
    })
  }, 30_000)
}
