import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { Auth } from "@/auth"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import {
  TestHooks as TaskControlTestHooks,
  taskRootIngressDebugProjection,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { EngineGit } from "@/engine/git"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { Orchestrator } from "@/orchestrator/agent"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { MessageTable, ProviderActivityRequestTable } from "@/session/session.sql"
import { Database, eq, inArray } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const model = { providerID: "streamed-dispatch", modelID: "settlement" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Streamed dispatch settlement",
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
    api: { id: model.modelID, url: "https://streamed-dispatch.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-29",
  } as ProviderType.Model
}

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a streamed dispatch decision settles from one Task-root Provider request", async () => {
  using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ prompt_profile: { active: "base" } })
      using _runtime = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:streamed-dispatch")
      using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
        runner: async (input) =>
          await Orchestrator.processTask(
            input.taskID,
            input.event,
            input.signal,
            input.wakeID,
            input.activationID,
            input.predecessorID,
          ).then((finalMessageID) => ({ finalMessageID })),
      })

      let rootProviderRequests = 0
      let workerProviderRequests = 0
      let releaseWorker!: () => void
      const workerGate = new Promise<void>((resolve) => {
        releaseWorker = resolve
      })
      const language = new MockLanguageModelV3({
        provider: model.providerID,
        modelId: model.modelID,
        async doStream(options) {
          const toolNames = Array.isArray(options.tools)
            ? options.tools.map((item) => item.name)
            : Object.keys(options.tools ?? {})
          if (toolNames.includes("dispatch_agent")) {
            rootProviderRequests++
            if (rootProviderRequests > 1) {
              return {
                stream: simulateReadableStream({
                  chunks: [
                    { type: "stream-start", warnings: [] },
                    {
                      type: "tool-call",
                      toolCallId: `call_lifecycle_reconciled_${rootProviderRequests}`,
                      toolName: "no_action",
                      input: JSON.stringify({ reason: "The worker lifecycle fact has no newly ready frontier." }),
                    },
                    { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                  ],
                }),
              }
            }
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "dispatch-preamble" },
                  { type: "text-delta", id: "dispatch-preamble", delta: "Dispatch the exact first workflow occurrence." },
                  { type: "text-end", id: "dispatch-preamble" },
                  {
                    type: "tool-call",
                    toolCallId: "call_streamed_dispatch",
                    toolName: "dispatch_agent",
                    input: JSON.stringify({
                      dispatch: {
                        target: "base-planner",
                        work_scope: { kind: "task" },
                        turn: {
                          kind: "initial",
                          workflow_subject: {
                            kind: "virtual_workflow",
                            workflow_id: "planner-parallel-delivery",
                            node_id: "base-planner",
                          },
                          use_worktree: false,
                          input: {
                            goal_ids: [],
                            instruction: "Record one durable streamed dispatch receipt.",
                            reason: "The Task requires its first package-owned workflow occurrence.",
                          },
                        },
                      },
                    }),
                  },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ],
              }),
            }
          }
          workerProviderRequests++
          return {
            stream: new ReadableStream({
              async start(controller) {
                await workerGate
                for (const chunk of [
                { type: "stream-start", warnings: [] },
                { type: "text-start", id: "worker-result" },
                { type: "text-delta", id: "worker-result", delta: "The streamed dispatch receipt is durable." },
                { type: "text-end", id: "worker-result" },
                { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                ] as const) {
                  controller.enqueue(chunk)
                }
                controller.close()
              },
            }),
          }
        },
      })
      const resolvedModel = providerModel()
      const modelSpy = spyOn(Provider, "getModel").mockResolvedValue(resolvedModel)
      const languageSpy = spyOn(Provider, "getLanguage").mockResolvedValue(language)
      const providerSpy = spyOn(Provider, "getProvider").mockResolvedValue({
        id: model.providerID,
        name: "Streamed dispatch test",
        source: "custom",
        env: [],
        options: {},
        models: { [resolvedModel.id]: resolvedModel },
      } as never)
      const authSpy = spyOn(Auth, "get").mockResolvedValue(undefined)
      const gitPrepareSpy = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
      const gitCompleteSpy = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))

      try {
        const taskID = await EngineService.createTask(
          {
            requestID: `streamed-dispatch-${Identifier.ascending("artifact")}`,
            title: "Streamed dispatch settlement",
            request: "Produce one streamed dispatch and durable receipt",
            productPillar: "work",
            model: `${model.providerID}/${model.modelID}`,
            promptProfile: "base",
          },
          { actor: "user" },
        )
        await waitForIngressDeliveryHooksForTest()
        const task = requireTask(taskID)
        const orchestrator = (await Session.children(task.session_id!)).find((session) => session.kind === "orchestrator")
        if (!orchestrator) throw new Error("Task-root Orchestrator Session was not created")
        await Database.awaitEffectIdle(30_000)
        const messages = await Session.messages({ sessionID: orchestrator.id })
        const assistantIDs = messages.filter((item) => item.info.role === "assistant").map((item) => item.info.id)
        const providerFacts = Database.use((db) =>
          assistantIDs.length === 0
            ? []
            : db
                .select({ id: ProviderActivityRequestTable.id, messageID: MessageTable.id })
                .from(ProviderActivityRequestTable)
                .innerJoin(MessageTable, eq(MessageTable.id, ProviderActivityRequestTable.assistant_message_id))
                .where(inArray(ProviderActivityRequestTable.assistant_message_id, assistantIDs))
                .all(),
        )
        const toolParts = messages.flatMap((message) => message.parts).filter((part) => part.type === "tool")
        expect({
          taskError: task.error,
          rootProviderRequests,
          providerFacts,
          dispatchReceipts: toolParts.filter((part) => part.tool === "dispatch_agent").map((part) => part.state.status),
          decisions: toolParts.map((part) => part.tool),
          ingress: taskRootIngressDebugProjection(taskID).map((entry) => entry.projection.state),
        }).toEqual({
          taskError: null,
          rootProviderRequests: 1,
          providerFacts: [{ id: expect.any(String), messageID: assistantIDs[0] }],
          dispatchReceipts: ["completed"],
          decisions: ["dispatch_agent"],
          ingress: ["resolved"],
        })
        releaseWorker()
        for (const child of await Session.children(orchestrator.id)) {
          await SessionPrompt.waitForFinish(child.id, project.path)
        }
        await waitForIngressDeliveryHooksForTest()
        await SessionPrompt.waitForFinish(orchestrator.id, project.path)
        await Database.awaitEffectIdle(30_000)
        expect(workerProviderRequests).toBe(1)
      } finally {
        releaseWorker()
        gitCompleteSpy.mockRestore()
        gitPrepareSpy.mockRestore()
        authSpy.mockRestore()
        providerSpy.mockRestore()
        languageSpy.mockRestore()
        modelSpy.mockRestore()
      }
    },
  })
  await waitForIngressDeliveryHooksForTest()
  await Instance.disposeAll()
  await Database.awaitEffectIdle(30_000)
}, 60_000)
