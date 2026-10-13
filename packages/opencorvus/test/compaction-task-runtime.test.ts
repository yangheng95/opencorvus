import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { Identifier } from "@/id/id"
import { EngineService } from "@/task-api"
import { Orchestrator } from "@/orchestrator/agent"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { TestHooks, waitForIngressDeliveryHooksForTest } from "@/engine/task-root-ingress-delivery"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("a real Task ingress keeps its assistant occurrence and late Tool result through automatic compaction", async () => {
  await using project = await memoryProject("task-open-compaction")
  const target = { providerID: "opencorvus-compaction-runtime", modelID: "checkpoint" }
  const evidencePath = path.join(project.path, "evidence.txt")
  await fs.writeFile(evidencePath, "TRACE-TASK-AFTER-CHECKPOINT-432 next_offset=17031\n")
  let taskSteps = 0
  let compactions = 0
  let controlID = ""
  let rootSessionID = ""
  let rootMessageID = ""
  const requests: { sessionID: string; body: any }[] = []
  const occurrences: { step: number; id: string; tokens: number; finishedSteps: number }[] = []
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = (await request.json()) as any
      const sessionID = request.headers.get("x-opencorvus-session") ?? ""
      requests.push({ sessionID, body: structuredClone(body) })
      const tools = body.tools.map((tool: any) => tool.function.name) as string[]
      const event = (delta: unknown, finish: string | null) =>
        `data: ${JSON.stringify({
          id: `task-${requests.length}`,
          object: "chat.completion.chunk",
          created: 1,
          model: target.modelID,
          choices: [{ index: 0, delta, finish_reason: finish }],
          ...(finish ? { usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 } } : {}),
        })}\n\n`
      let chunks: string
      if (tools.includes("ReadCompactionEvidence")) {
        compactions++
        chunks =
          event(
            {
              role: "assistant",
              content:
                "The Task has inspected evidence.txt twice. Continue the same execution and preserve later Tool traces.",
            },
            null,
          ) + event({}, "stop")
      } else {
        taskSteps++
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            const history = await Session.messages({ sessionID })
            const active = history.findLast(
              (message) => message.info.role === "assistant" && message.info.author === "orchestrator",
            )!
            if (active?.info.role !== "assistant") throw new Error("Expected actual Task-root assistant")
            rootSessionID = sessionID
            rootMessageID ||= active.info.id
            expect(active.info.id).toBe(rootMessageID)
            occurrences.push({
              step: taskSteps,
              id: active.info.id,
              tokens: active.info.tokens.total ?? 0,
              finishedSteps: active.parts.filter((part) => part.type === "step-finish").length,
            })
            if (taskSteps === 2) {
              const source = await MessageStore.get({ sessionID, messageID: active.info.parentID })
              if (source.info.role !== "user") throw new Error("Expected actual ingress source")
              controlID = (
                await SessionCompaction.create({
                  sessionID,
                  source: source.info,
                  auto: true,
                  overflow: true,
                  model: target,
                })
              ).id
            }
          },
        })
        if (taskSteps > 4) throw new Error(`Unexpected Task Provider step ${taskSteps}`)
        let toolName = "read"
        let args: unknown = { filePath: evidencePath }
        if (taskSteps === 4) {
          expect(body.messages).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                role: "tool",
                tool_call_id: "read_after_compaction",
                content: expect.stringContaining("TRACE-TASK-AFTER-CHECKPOINT-432"),
              }),
            ]),
          )
          toolName = "no_action"
          args = await Instance.provide({
            directory: project.path,
            fn: async () => ({
              observed_task: noActionTaskObservation(taskLifecycleProjection(taskIDForSession(sessionID)!)),
              reason: "The isolated compaction probe has recorded its exact trace and stops this ingress.",
            }),
          })
        }
        expect(tools).toContain(toolName)
        const callID = taskSteps === 3 ? "read_after_compaction" : `task_call_${taskSteps}`
        chunks =
          (taskSteps === 1 ? event({ role: "assistant", content: "Earlier Task evidence. ".repeat(1000) }, null) : "") +
          event(
            {
              tool_calls: [
                {
                  index: 0,
                  id: callID,
                  type: "function",
                  function: { name: toolName, arguments: JSON.stringify(args) },
                },
              ],
            },
            null,
          ) +
          event({}, "tool_calls")
      }
      return new Response(chunks + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } })
    },
  })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: `${target.providerID}/${target.modelID}`,
          small_model: `${target.providerID}/${target.modelID}`,
          enabled_providers: [target.providerID],
          compaction: { tail_turns: 0 },
          provider: {
            [target.providerID]: {
              name: "Task compaction transport",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${server.port}/v1`,
              models: {
                [target.modelID]: {
                  name: "Checkpoint",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 16_000 },
                },
              },
            },
          },
        })
        using runner = TestHooks.replaceTaskIngressRunner({
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
            requestID: Identifier.ascending("artifact"),
            title: "Open Message compaction",
            request: "Read evidence.txt and retain every exact trace through the checkpoint.",
            productPillar: "work",
            promptProfile: "base",
            model: `${target.providerID}/${target.modelID}`,
          },
          { actor: "user" },
        )
        await waitForIngressDeliveryHooksForTest()
        expect({ taskSteps, compactions }).toEqual({ taskSteps: 4, compactions: 1 })
        expect(SessionControl.get(controlID)).toMatchObject({ status: "consumed" })
        const root = await MessageStore.get({ sessionID: rootSessionID, messageID: rootMessageID })
        const rootReceipt = structuredClone(root.info)
        expect(occurrences).toEqual(
          [0, 1, 2, 3].map((index) => ({
            step: index + 1,
            id: rootMessageID,
            tokens: index * 18,
            finishedSteps: index,
          })),
        )
        // no_action parks immediately after its durable Tool result. Its stream
        // ends before finish-step; only the three received usage receipts count.
        expect(root.info).toMatchObject({
          id: rootMessageID,
          role: "assistant",
          finish: "tool-calls",
          time: { completed: expect.any(Number) },
          tokens: { input: 33, output: 21, total: 54 },
        })
        expect(root.parts.filter((part) => part.type === "step-finish")).toHaveLength(3)
        expect(root.parts.find((part) => part.type === "tool" && part.tool === "no_action")).toMatchObject({
          state: { status: "completed" },
        })
        expect(
          root.parts.find((part) => part.type === "tool" && part.callID === "read_after_compaction"),
        ).toMatchObject({
          state: { status: "completed", output: expect.stringContaining("TRACE-TASK-AFTER-CHECKPOINT-432") },
        })
        console.log(
          JSON.stringify({
            scenario: "task-open-message-compaction",
            taskID,
            controlID,
            rootSessionID,
            rootMessageID,
            taskSteps,
            compactions,
            occurrences,
            info: rootReceipt,
            requests,
          }),
        )
      },
    })
  } finally {
    await waitForIngressDeliveryHooksForTest()
    await Instance.disposeAll()
    await server.stop(true)
  }
})
