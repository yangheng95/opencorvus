import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { SessionProcessor } from "@/session/processor"
import { SessionLoop } from "@/session/loop"
import { acquireControlLease } from "@/engine/control-lease"
import { Database, eq } from "@/storage/db"
import { EngineArtifactTable, EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { TaskRootIngressIntegrityError } from "@/engine/task-root-ingress-integrity"
import { projectTaskRootIngress } from "@/engine/task-root-fact-store"
import { readTaskRootIngressEvidence } from "@/engine/task-root-ingress-delivery"
import { reconcileTaskControlPlane } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { EngineService } from "@/task-api"
import { Orchestrator } from "@/orchestrator/agent"
import { noActionTaskObservation } from "@/orchestrator/no-action-tool"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { TestHooks, waitForIngressDeliveryHooksForTest } from "@/engine/task-root-ingress-delivery"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const trigger of [
  "control",
  "usage-tool",
  "usage-text",
  "predictive",
  "predictive-default-tail",
  "predictive-prepared",
  "foreign-control",
  "provider-overflow",
  "incomplete-reply",
] as const) {
  test(`a real Task ingress keeps its assistant occurrence through ${trigger} compaction`, async () => {
    const successor = trigger === "predictive-prepared" || trigger === "foreign-control"
    const foreignStandbys: string[] = []
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
        const tools = (body.tools ?? []).map((tool: any) => tool.function.name) as string[]
        const event = (delta: unknown, finish: string | null) =>
          `data: ${JSON.stringify({
            id: `task-${requests.length}`,
            object: "chat.completion.chunk",
            created: 1,
            model: target.modelID,
            choices: [{ index: 0, delta, finish_reason: finish }],
            ...(finish
              ? {
                  usage:
                    !tools.includes("ReadCompactionEvidence") && taskSteps === 2 && trigger.startsWith("usage-")
                      ? { prompt_tokens: 240_000, completion_tokens: 7, total_tokens: 240_007 }
                      : { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
                }
              : {}),
          })}\n\n`
        let chunks: string
        if (tools.length === 0) {
          return new Response(event({role:"assistant",content:"Isolated follow-up evidence review"},null)+event({},"stop")+"data: [DONE]\n\n",{headers:{"content-type":"text/event-stream"}})
        }
        if (tools.includes("ReadCompactionEvidence")) {
          compactions++
          chunks =
            event(
              {
                role: "assistant",
                content:
                "Continue the accepted Task input and preserve original evidence and later Tool traces.",
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
              if (trigger === "provider-overflow" || trigger === "incomplete-reply" || successor) rootMessageID = active.info.id
              else rootMessageID ||= active.info.id
              expect(active.info.id).toBe(rootMessageID)
              occurrences.push({
                step: taskSteps,
                id: active.info.id,
                tokens: active.info.tokens.total ?? 0,
                finishedSteps: active.parts.filter((part) => part.type === "step-finish").length,
              })
              if (taskSteps === 2 && trigger === "control") {
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
          if (taskSteps === 2 && trigger === "provider-overflow") {
            return Response.json(
              {
                error: {
                  message: "maximum context length exceeded",
                  type: "invalid_request_error",
                  code: "context_length_exceeded",
                },
              },
              { status: 400 },
            )
          }
          if (taskSteps > 4) throw new Error(`Unexpected Task Provider step ${taskSteps}`)
          let toolName = "read"
          let args: unknown = { filePath: evidencePath }
          if (taskSteps === 4 || (successor && taskSteps === 1)) {
            if (taskSteps === 4)
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
          if (taskSteps === 2 && trigger === "usage-text") {
            chunks =
              event({ role: "assistant", content: "Evidence inspected; the scheduling decision is pending." }, null) +
              event({}, "stop")
          } else
            chunks =
              (taskSteps === 1
                ? event(
                    {
                      role: "assistant",
                    content: "Earlier Task evidence. ".repeat(trigger.startsWith("predictive") ? 45_000 : 1000),
                    },
                    null,
                  )
                : "") +
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
          using _standby = SessionLoop.TestHooks.installStandbyObserver(sessionID => {
            if (trigger === "foreign-control" && sessionID === rootSessionID && SessionControl.get(controlID)?.status === "pending") {
              const identity = SessionLoop.getSessionRuntimeContract(sessionID)?.identity
              foreignStandbys.push(identity?.identityKind === "projected-scheduler" ? identity.inputMessageID! : "unknown")
            }
          })
          const createProcessor = SessionProcessor.create
          const faultInjection =
            trigger === "incomplete-reply"
              ? spyOn(SessionProcessor, "create").mockImplementation((input) =>
                  createProcessor(
                    input.assistantMessage.activationID
                      ? {
                          ...input,
                          retainAssistantOnToolContinuation: false,
                          retainAssistantForNextProviderStep: () => false,
                        }
                      : input,
                  ),
                )
              : undefined
          using _faultInjection = {
            [Symbol.dispose]() {
              faultInjection?.mockRestore()
            },
          }
          await Config.updateProjectPatch({
            model: `${target.providerID}/${target.modelID}`,
            small_model: `${target.providerID}/${target.modelID}`,
            enabled_providers: [target.providerID],
            compaction: trigger === "predictive-default-tail" ? { preserve_recent_tokens: 4000 } : { tail_turns: 0 },
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
          if (successor) {
            const first = await MessageStore.get({sessionID:rootSessionID,messageID:rootMessageID})
            expect(structuredClone(first.info)).toMatchObject({time:{completed:expect.any(Number)},finish:"tool-calls"})
            if (trigger === "foreign-control") {
              const source = (await MessageStore.get({sessionID:rootSessionID,messageID:first.info.parentID!})).info
              if(source.role!=="user")throw Error("Expected the actual compaction source")
              controlID = (await SessionCompaction.create({sessionID:rootSessionID,source,auto:true,overflow:false,model:target})).id
              const lease = acquireControlLease({target:"session_control",targetID:controlID,ownerOccurrenceID:"test-foreign-control-owner",now:Date.now(),leaseMilliseconds:2000})
              expect(lease.acquired).toBe(true)
            }
            await EngineService.handleTaskMessage(taskID,{text:"Read the exact evidence and settle this new input while retaining the prior completed occurrence.",source:"test.predictive-prepared"})
            await reconcileTaskControlPlane(taskID)
            await waitForIngressDeliveryHooksForTest()
            expect((await MessageStore.get({sessionID:rootSessionID,messageID:first.info.id})).info).toEqual(first.info)
          }
          if (trigger === "incomplete-reply") {
            const ingress = Database.use((db) =>
              db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.task_id, taskID)).get(),
            )!
            expect(() => Database.use((db) => readTaskRootIngressEvidence(db, ingress))).toThrow(
              TaskRootIngressIntegrityError,
            )
            const projection = projectTaskRootIngress(ingress.id, Date.now(), readTaskRootIngressEvidence)
            expect(structuredClone(projection)).toMatchObject({ state: "operator_abandoned", evidenceIDs: [expect.any(String)] })
            if (projection.state !== "operator_abandoned") throw Error("Expected the settled Host fault disposition")
            const gate = Database.use((db) =>
              db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, projection.evidenceIDs[0]!)).get(),
            )!
            expect(gate).toMatchObject({
              kind: "task-infrastructure-error",
              payload: { context: { ingressID: ingress.id, state: "host_fault", gateReason: "evidence_violation" } },
            })
            expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "active", epoch: 1 })
            const root = await MessageStore.get({ sessionID: rootSessionID, messageID: rootMessageID })
            expect(root.info).toMatchObject({ finish: "tool-calls", time: { completed: expect.any(Number) } })
            expect(root.parts.find((part) => part.type === "tool" && part.callID === "task_call_1")).toMatchObject({
              state: { status: "completed", output: expect.stringContaining("TRACE-TASK-AFTER-CHECKPOINT-432") },
            })
            faultInjection?.mockRestore()
            const followUp = await EngineService.handleTaskMessage(taskID, {
              text: "Continue the isolated evidence check under this new operator input; the prior Host fault remains recorded.",
              source: "test.compaction-fault-successor",
            })
            await reconcileTaskControlPlane(taskID)
            await waitForIngressDeliveryHooksForTest()
            expect(projectTaskRootIngress(followUp.ingress_id!, Date.now(), readTaskRootIngressEvidence)).toMatchObject(
              { state: "resolved", decisionIDs: [expect.any(String)] },
            )
            expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "active", epoch: 1 })
            expect((await MessageStore.get({ sessionID: rootSessionID, messageID: root.info.id })).info).toEqual(
              root.info,
            )
            console.log(
              JSON.stringify({
                scenario: trigger,
                taskID,
                ingressID: ingress.id,
                root: root.info,
                projection: projectTaskRootIngress(ingress.id, Date.now(), readTaskRootIngressEvidence),
              }),
            )
            return
          }
          expect({ taskSteps, compactions }).toEqual({ taskSteps: 4, compactions: 1 })
          const controls = SessionControl.list(rootSessionID).filter((control) => control.kind === "compaction_request")
          expect(controls).toHaveLength(1)
          controlID = controls[0]!.id
          expect(controls[0]).toMatchObject({ status: "consumed" })
          const root = await MessageStore.get({ sessionID: rootSessionID, messageID: rootMessageID })
          const rootReceipt = structuredClone(root.info)
          expect(occurrences).toEqual(
            trigger === "provider-overflow" || successor
              ? [
                  { step: 1, id: occurrences[0]!.id, tokens: 0, finishedSteps: 0 },
                  { step: 2, id: successor ? rootMessageID : occurrences[0]!.id, tokens: successor ? 0 : 18, finishedSteps: successor ? 0 : 1 },
                  { step: 3, id: rootMessageID, tokens: successor ? 18 : 0, finishedSteps: successor ? 1 : 0 },
                  { step: 4, id: rootMessageID, tokens: successor ? 36 : 18, finishedSteps: successor ? 2 : 1 },
                ]
              : [0, 1, 2, 3].map((index) => ({
                  step: index + 1,
                  id: rootMessageID,
                  tokens:
                    index * 18 +
                    (trigger.startsWith("usage-") && index >= 2 ? 239_989 : 0) -
                    (trigger === "provider-overflow" && index >= 2 ? 18 : 0),
                  finishedSteps: index - (trigger === "provider-overflow" && index >= 2 ? 1 : 0),
                })),
          )
          // no_action parks immediately after its durable Tool result. Its stream
          // ends before finish-step; only the three received usage receipts count.
          if (trigger === "foreign-control") expect(foreignStandbys).toEqual([root.info.parentID])
          const successfulSteps = trigger === "provider-overflow" ? 1 : successor ? 2 : 3
          expect(root.info).toMatchObject({
            id: rootMessageID,
            role: "assistant",
            finish: "tool-calls",
            time: { completed: expect.any(Number) },
            tokens: {
              input: trigger.startsWith("usage-") ? 240_022 : successfulSteps * 11,
              output: successfulSteps * 7,
              total: trigger.startsWith("usage-") ? 240_043 : successfulSteps * 18,
            },
          })
          expect(root.parts.filter((part) => part.type === "step-finish")).toHaveLength(
            successfulSteps,
          )
          if (trigger === "provider-overflow") {
            const failed = await MessageStore.get({ sessionID: rootSessionID, messageID: occurrences[0]!.id })
            expect(failed.info).toMatchObject({
              role: "assistant",
              finish: "error",
              error: { name: "ContextOverflowError" },
              time: { completed: expect.any(Number) },
            })
            const source = await MessageStore.get({ sessionID: rootSessionID, messageID: root.info.parentID })
            expect(source.info).toMatchObject({
              extra: { orchestrator_control_ingress: { predecessor_id: failed.info.id } },
            })
            expect(taskLifecycleProjection(taskID)).toMatchObject({ status: "active" })
          }
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
              scenario: `task-open-message-${trigger}-compaction`,
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
}
