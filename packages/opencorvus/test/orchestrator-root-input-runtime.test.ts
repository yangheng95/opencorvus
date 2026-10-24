import { afterEach, expect, spyOn, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { TestHooks as Ingress, waitForIngressDeliveryHooksForTest } from "@/engine/task-root-ingress-delivery"
import * as Projection from "@/engine/task-package-projection"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Orchestrator, currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { controlledMemoryReply, controlledProviderRequestKind } from "./fixture/controlled-streaming-provider"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("an operator input retains its Task-root owner during scheduler preparation, then receives its exact runtime reply", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      let calls = 0
      // Explicit streamed protocol input; every Tool result and persisted effect
      // below comes from the production Task, Session and no_action writers.
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = (await request.json()) as any
          const messages = body.messages ?? []
          const isMemory = controlledProviderRequestKind(messages) === "memory"
          const action = body.tools?.some((tool: any) => tool.function?.name === "no_action")
          const task = action ? Database.use((db) => db.select().from(EngineTaskTable).get())! : undefined
          const text = isMemory ? controlledMemoryReply(messages) : "Local input delivered."
          const toolCall = action
            ? {
                index: 0,
                id: `local_input_${++calls}`,
                type: "function",
                function: {
                  name: "no_action",
                  arguments: JSON.stringify({
                    reason: "Local status input answered.",
                    observed_task: noActionTaskObservation(taskLifecycleProjection(task!.id)),
                  }),
                },
              }
            : undefined
          const chunks = [{ role: "assistant" }, toolCall ? { tool_calls: [toolCall] } : { content: text }].map(
            (delta) => ({
              id: "local-input-runtime",
              object: "chat.completion.chunk",
              created: 1,
              model: "fixture",
              choices: [{ index: 0, delta, finish_reason: null }],
            }),
          )
          const finish = {
            id: "local-input-runtime",
            object: "chat.completion.chunk",
            created: 1,
            model: "fixture",
            choices: [{ index: 0, delta: {}, finish_reason: toolCall ? "tool_calls" : "stop" }],
          }
          return new Response(
            [...chunks, finish].map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
      try {
        await Config.updateProjectPatch({
          model: "input-runtime/fixture",
          small_model: "input-runtime/fixture",
          permission_mode: "full_access",
          provider: {
            "input-runtime": {
              name: "Local input runtime",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${server.port}/v1`,
              models: {
                fixture: {
                  name: "Local fixture",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4096 },
                },
              },
            },
          },
        })
        using runner = Ingress.replaceTaskIngressRunner({
          runner: async (input) => ({
            finalMessageID: await Orchestrator.processTask(
              input.taskID,
              input.event,
              input.signal,
              input.wakeID,
              input.activationID,
              input.predecessorID,
            ),
          }),
        })
        const taskID = await EngineService.createTask(
          {
            requestID: "root-input-runtime",
            title: "Exact input runtime",
            request: "Return the current local status.",
            productPillar: "work",
            model: "input-runtime/fixture",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        for (let pass = 0; pass < 3; pass++) await waitForIngressDeliveryHooksForTest()
        await Database.awaitEffectIdle(30_000)
        const task = await EngineService.getTask(taskID)
        const entered = Promise.withResolvers<void>(),
          release = Promise.withResolvers<void>()
        const original = Projection.resolvePinnedTaskSchedulerTurnProjection
        using preparation = spyOn(Projection, "resolvePinnedTaskSchedulerTurnProjection").mockImplementation(
          async (input) => {
            entered.resolve()
            await release.promise
            return original(input)
          },
        )
        const moved: Array<{ messageID: string; runtimeInput: string | undefined; taskID: string | undefined }> = []
        const unsubscribe = Bus.subscribe(Message.Event.Moved, (event) => {
          const contract = SessionRuntimeContractStore.get(event.properties.info.sessionID)
          moved.push({
            messageID: event.properties.info.id,
            runtimeInput: contract?.identity.inputMessageID,
            taskID: contract?.identity.taskID,
          })
        })
        let accepted: Awaited<ReturnType<typeof EngineService.handleTaskMessage>> | undefined
        try {
          accepted = await EngineService.handleTaskMessage(taskID, {
            text: "Use the current budget of 1200.",
            source: "api",
          })
          await entered.promise
          const source = Database.use((db) =>
            db.select().from(MessageTable).where(eq(MessageTable.id, accepted!.user_message.info.id)).get(),
          )!
          expect({
            sessionID: source.session_id,
            body: accepted.user_message.parts[0]?.type === "text" ? accepted.user_message.parts[0].text : undefined,
          }).toEqual({ sessionID: task.sessionID, body: "Use the current budget of 1200." })
        } finally {
          release.resolve()
          for (let pass = 0; pass < 3; pass++) await waitForIngressDeliveryHooksForTest()
          await Database.awaitEffectIdle(30_000)
          unsubscribe()
        }
        const current = currentOrchestratorControlMessage(
          { rootMessage: { messageID: accepted!.user_message.info.id, kind: "operator" } },
          taskID,
          accepted!.ingress_id!,
        )!
        expect(moved).toEqual([{ messageID: accepted!.user_message.info.id, runtimeInput: current.messageID, taskID }])
        const located = Database.use((db) =>
          db.select().from(MessageTable).where(eq(MessageTable.id, accepted!.user_message.info.id)).get(),
        )!
        const replies = (await Session.messages({ sessionID: located.session_id })).filter(
          (message) =>
            message.info.role === "assistant" &&
            message.info.parentID === current.messageID &&
            message.info.time.completed,
        )
        expect(replies.map((message) => message.info.agent)).toEqual(["orchestrator"])
      } finally {
        await server.stop(true)
      }
    },
  })
}, 120_000)
