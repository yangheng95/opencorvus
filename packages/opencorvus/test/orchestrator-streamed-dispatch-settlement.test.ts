import { afterEach, expect, spyOn, test } from "bun:test"
import { MockLanguageModelV3, simulateReadableStream } from "ai/test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { CAPABILITY_REVEAL_MAX_ACTIVE_CHARS, CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS } from "@/capability/reveal-receipt"
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
import { OrchestratorToolsTestHooks } from "@/orchestrator/tools"
import { orchestratorCommittedDecisionInParts } from "@/orchestrator/decision-tool-names"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { MessageStore } from "@/session/message-store"
import { toolResultControl } from "@/session/tool-result-control"
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

      let capabilityRevealRequests = 0
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
          if (
            toolNames.length === 1 &&
            toolNames[0] === "capability_search" &&
            (rootProviderRequests === 0 || workerProviderRequests > 0)
          ) {
            const localRef = rootProviderRequests === 0 ? "dispatch_agent" : "no_action"
            capabilityRevealRequests++
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  {
                    type: "tool-call",
                    toolCallId: `call_reveal_${localRef}`,
                    toolName: "capability_search",
                    input: JSON.stringify({
                      queries: [localRef === "dispatch_agent" ? "dispatch one worker" : "settle this wake"],
                      exact_refs: [
                        capabilityRef({
                          kind: "tool",
                          source: "platform",
                          owner_ref: "runtime-projection:orchestrator",
                          local_ref: localRef,
                        }),
                      ],
                      deactivate_refs: [],
                      limit: 5,
                    }),
                  },
                  { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage },
                ],
              }),
            }
          }
          if (toolNames.includes("dispatch_agent")) {
            rootProviderRequests++
            return {
              stream: simulateReadableStream({
                chunks: [
                  { type: "stream-start", warnings: [] },
                  { type: "text-start", id: "dispatch-preamble" },
                  {
                    type: "text-delta",
                    id: "dispatch-preamble",
                    delta: "Dispatch the exact first workflow occurrence.",
                  },
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
          if (toolNames.includes("no_action")) {
            rootProviderRequests++
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
        const orchestrator = (await Session.children(task.session_id!)).find(
          (session) => session.kind === "orchestrator",
        )
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
        const revealReceipt = toolParts.find(
          (part) => part.tool === "capability_search" && part.state.status === "completed",
        )?.state.metadata?.opencorvus_capability_reveal_v2 as
          | {
              activated?: Array<{ provider_name?: string; payload_chars?: number; payload_tokens?: number }>
            }
          | undefined
        const dispatchActivation = revealReceipt?.activated?.find((entry) => entry.provider_name === "dispatch_agent")
        expect({
          taskError: task.error,
          capabilityRevealRequests,
          rootProviderRequests,
          providerFacts,
          dispatchReceipts: toolParts.filter((part) => part.tool === "dispatch_agent").map((part) => part.state.status),
          dispatchDefinitionWithinRevealBudget:
            Boolean(dispatchActivation) &&
            dispatchActivation!.payload_chars! <= CAPABILITY_REVEAL_MAX_ACTIVE_CHARS &&
            dispatchActivation!.payload_tokens! <= CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS,
          calls: toolParts.map((part) => part.tool),
          ingress: taskRootIngressDebugProjection(taskID).map((entry) => entry.projection.state),
        }).toEqual({
          taskError: null,
          capabilityRevealRequests: 1,
          rootProviderRequests: 1,
          providerFacts: [
            { id: expect.any(String), messageID: assistantIDs[0] },
            { id: expect.any(String), messageID: assistantIDs[0] },
          ],
          dispatchReceipts: ["completed"],
          dispatchDefinitionWithinRevealBudget: true,
          calls: ["capability_search", "dispatch_agent"],
          ingress: ["resolved"],
        })
        releaseWorker()
        for (const child of await Session.children(orchestrator.id)) {
          await SessionPrompt.waitForFinish(child.id, project.path)
        }
        await waitForIngressDeliveryHooksForTest()
        await SessionPrompt.waitForFinish(orchestrator.id, project.path)
        await Database.awaitEffectIdle(30_000)
        expect({ capabilityRevealRequests, rootProviderRequests, workerProviderRequests }).toEqual({
          capabilityRevealRequests: 2,
          rootProviderRequests: 2,
          workerProviderRequests: 1,
        })
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

// Fault injection stops only an exact production dispatch admission. Tool
// declarations, streaming Tool execution, SessionLoop coordination, Tool Part
// persistence and Task ingress reduction all remain the production path.
for (const secondFails of [false, true]) {
  test(
    secondFails
      ? "streamed failed dispatch siblings release their claims before an exclusive no_action receipt"
      : "streamed dispatch success survives a late sibling failure and persists the exclusive decision conflict",
    async () => {
      using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await Config.updateProjectPatch({ prompt_profile: { active: "base" } })
          using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
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
          const firstClaimed = Promise.withResolvers<void>()
          const secondClaimed = Promise.withResolvers<void>()
          const firstFailure = Promise.withResolvers<void>()
          const secondFailure = Promise.withResolvers<void>()
          const workerFinish = Promise.withResolvers<void>()
          const order: string[] = []
          let rootSessionID = ""
          let secondDispatch: { dispatchID: string; childSessionID: string } | undefined
          let dispatchStreamStarted = false
          let rootAssistantID = ""
          const waitForPart = async (callID: string, status: "completed" | "error") => {
            const deadline = Date.now() + 15_000
            while (Date.now() < deadline) {
              const messages = rootSessionID ? await Session.messages({ sessionID: rootSessionID }) : []
              for (const message of messages) {
                const part = message.parts.find((part) => part.type === "tool" && part.callID === callID)
                if (part?.type === "tool" && part.state.status === status) {
                  rootAssistantID = message.info.id
                  return part
                }
              }
              await Bun.sleep(10)
            }
            throw new Error(`Timed out waiting for persisted ${callID}:${status}`)
          }
          using _dispatchAdmission = OrchestratorToolsTestHooks.replaceAfterDispatchLineageClaim(
            async ({ lineage }) => {
              const callID = lineage.payload.tool_call_id
              if (callID !== "call_stagger_a" && callID !== "call_stagger_b") return
              rootSessionID = lineage.payload.orchestrator_session_id
              order.push(`${callID}:claimed`)
              if (callID === "call_stagger_a") {
                firstClaimed.resolve()
                await firstFailure.promise
              } else {
                secondDispatch = { dispatchID: lineage.dispatchID, childSessionID: lineage.payload.child_session_id }
                secondClaimed.resolve()
                if (!secondFails) return
                await secondFailure.promise
              }
              const error = new Error(`Injected exact admission failure for ${callID}`)
              error.name = "StaggeredDispatchAdmissionError"
              throw error
            },
          )
          const toolCall = (callID: string, toolName: string, input: unknown) => ({
            type: "tool-call" as const,
            toolCallId: callID,
            toolName,
            input: JSON.stringify(input),
          })
          const dispatchInput = (name: string) => ({
            dispatch: {
              target: "base-planner",
              work_scope: { kind: "task" },
              turn: {
                kind: "initial",
                workflow_subject: { kind: "direct" },
                use_worktree: false,
                input: {
                  goal_ids: [],
                  instruction: `Read-only independent evidence partition ${name}.`,
                  reason: `The requested analysis has independent partition ${name}.`,
                },
              },
            },
          })
          const finish = {
            type: "finish" as const,
            finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
            usage,
          }
          const language = new MockLanguageModelV3({
            provider: model.providerID,
            modelId: model.modelID,
            async doStream(options) {
              const toolNames = Array.isArray(options.tools)
                ? options.tools.map((tool) => tool.name)
                : Object.keys(options.tools ?? {})
              if (toolNames.length === 1 && toolNames[0] === "capability_search") {
                const names = dispatchStreamStarted ? ["no_action"] : ["dispatch_agent", "no_action"]
                return {
                  stream: simulateReadableStream({
                    chunks: [
                      { type: "stream-start", warnings: [] },
                      toolCall(`call_stagger_reveal_${dispatchStreamStarted}`, "capability_search", {
                        queries: names,
                        exact_refs: names.map((local_ref) =>
                          capabilityRef({
                            kind: "tool",
                            source: "platform",
                            owner_ref: "runtime-projection:orchestrator",
                            local_ref,
                          }),
                        ),
                        deactivate_refs: [],
                        limit: 5,
                      }),
                      finish,
                    ],
                  }),
                }
              }
              if (toolNames.includes("dispatch_agent") && !dispatchStreamStarted) {
                dispatchStreamStarted = true
                return {
                  stream: new ReadableStream({
                    async start(controller) {
                      try {
                        controller.enqueue({ type: "stream-start", warnings: [] })
                        controller.enqueue(toolCall("call_stagger_a", "dispatch_agent", dispatchInput("A")))
                        await firstClaimed.promise
                        controller.enqueue(toolCall("call_stagger_b", "dispatch_agent", dispatchInput("B")))
                        await secondClaimed.promise
                        if (!secondFails) {
                          await waitForPart("call_stagger_b", "completed")
                          order.push("call_stagger_b:durable_completed")
                        }
                        firstFailure.resolve()
                        await waitForPart("call_stagger_a", "error")
                        order.push("call_stagger_a:durable_error")
                        if (secondFails) {
                          secondFailure.resolve()
                          await waitForPart("call_stagger_b", "error")
                          order.push("call_stagger_b:durable_error")
                        }
                        controller.enqueue(
                          toolCall("call_stagger_c", "no_action", {
                            reason: "Reconcile the observed dispatch outcomes in this exact ingress.",
                          }),
                        )
                        controller.enqueue(finish)
                        controller.close()
                      } catch (error) {
                        controller.error(error)
                      }
                    },
                  }),
                }
              }
              if (toolNames.includes("no_action")) {
                return {
                  stream: simulateReadableStream({
                    chunks: [
                      { type: "stream-start", warnings: [] },
                      toolCall(`call_stagger_lifecycle_${Identifier.ascending("call")}`, "no_action", {
                        reason: "The current lifecycle fact has been reconciled.",
                      }),
                      finish,
                    ],
                  }),
                }
              }
              return {
                stream: new ReadableStream({
                  async start(controller) {
                    await workerFinish.promise
                    for (const chunk of [
                      { type: "stream-start", warnings: [] },
                      { type: "text-start", id: "staggered-worker" },
                      { type: "text-delta", id: "staggered-worker", delta: "Independent partition B is examined." },
                      { type: "text-end", id: "staggered-worker" },
                      { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
                    ])
                      controller.enqueue(chunk)
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
                requestID: `staggered-dispatch-${Identifier.ascending("artifact")}`,
                title: "Staggered streamed dispatch decisions",
                request: "Analyze two independent read-only evidence partitions",
                productPillar: "work",
                model: `${model.providerID}/${model.modelID}`,
                promptProfile: "base",
              },
              { actor: "user" },
            )
            await waitForIngressDeliveryHooksForTest()
            const finalPart = await waitForPart("call_stagger_c", secondFails ? "completed" : "error")
            const assistant = await MessageStore.get({ sessionID: rootSessionID, messageID: rootAssistantID })
            const expectedDecision = secondFails ? "no_action" : "dispatch_agent"
            expect(order).toEqual(
              secondFails
                ? [
                    "call_stagger_a:claimed",
                    "call_stagger_b:claimed",
                    "call_stagger_a:durable_error",
                    "call_stagger_b:durable_error",
                  ]
                : [
                    "call_stagger_a:claimed",
                    "call_stagger_b:claimed",
                    "call_stagger_b:durable_completed",
                    "call_stagger_a:durable_error",
                  ],
            )
            expect(orchestratorCommittedDecisionInParts(assistant.parts)).toBe(expectedDecision)
            expect(
              assistant.parts
                .filter(
                  (part) =>
                    part.type === "tool" &&
                    part.callID.startsWith("call_stagger_") &&
                    part.tool !== "capability_search",
                )
                .map((part) => (part.type === "tool" ? { callID: part.callID, status: part.state.status } : undefined)),
            ).toEqual([
              { callID: "call_stagger_a", status: "error" },
              { callID: "call_stagger_b", status: secondFails ? "error" : "completed" },
              { callID: "call_stagger_c", status: secondFails ? "completed" : "error" },
            ])
            if (finalPart.state.status === "error") {
              expect(finalPart.state.failure.name).toBe("ToolTurnExecutionConflictError")
            } else if (finalPart.state.status === "completed") {
              expect(toolResultControl(finalPart.state.metadata)).toEqual({ kind: "immediate_park" })
            }
            if (!secondFails) {
              const descriptor = WorkerTurnDescriptor.findForDispatch({
                sessionID: secondDispatch!.childSessionID,
                dispatchID: secondDispatch!.dispatchID,
              })
              expect(descriptor?.payload.dispatchTurn?.current_dispatch_id).toBe(secondDispatch!.dispatchID)
            }
            const ingress = taskRootIngressDebugProjection(taskID)[0]!
            expect(ingress.projection.state).toBe("resolved")
            workerFinish.resolve()
            for (const child of await Session.children(rootSessionID)) {
              await SessionPrompt.waitForFinish(child.id, project.path)
            }
            await waitForIngressDeliveryHooksForTest()
            await SessionPrompt.waitForFinish(rootSessionID, project.path)
            await Database.awaitEffectIdle(30_000)
            Database.close()
            Database.Client()
            const reopened = await MessageStore.get({ sessionID: rootSessionID, messageID: assistant.info.id })
            expect({
              assistantID: reopened.info.id,
              decision: orchestratorCommittedDecisionInParts(reopened.parts),
              ingressState: taskRootIngressDebugProjection(taskID)[0]!.projection.state,
            }).toEqual({ assistantID: assistant.info.id, decision: expectedDecision, ingressState: "resolved" })
          } finally {
            firstFailure.resolve()
            secondFailure.resolve()
            workerFinish.resolve()
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
    },
    90_000,
  )
}
