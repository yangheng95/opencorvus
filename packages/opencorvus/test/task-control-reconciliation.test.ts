import { afterEach, describe, expect, test } from "bun:test"
import { EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
import {
  reconcileTaskControlPlane,
  readTaskRootIngressEvidence,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import {
  acceptTaskRootIngressInTransaction,
  listTaskRootIngresses,
  projectTaskRootIngress,
} from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import {
  currentOrchestratorControlMessage,
} from "@/orchestrator/agent"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { Database, asc, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task-control reconciliation", () => {
  test("continues one prose-only ingress and resolves it from a later exact decision receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Fact-reduced continuation" })
        const now = Date.now()
        const ingress = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Fact-reduced continuation",
            request: "Continue the same ingress until a decision exists",
            time_created: now,
          }).run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.task-control" })
          return acceptTaskRootIngressInTransaction(db, {
            taskID,
            executionEpoch: 1,
            source: "inline",
            sourceID: "continuation-source",
            inlinePayload: { note: "decide once" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now,
          })
        })

        const calls: Array<{ activationID: string; predecessorID: string; assistantID: string }> = []
        using _owner = TaskControlTestHooks.replaceTerminalIngressDeliveryRuntime("runtime:test-task-control")
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ event, wakeID, activationID, predecessorID }) => {
            if (!event || !wakeID || !activationID || !predecessorID) throw new Error("Missing exact activation identity")
            const control = currentOrchestratorControlMessage(event, taskID, wakeID, predecessorID)
            if (!control) throw new Error("Expected an Orchestrator control occurrence")
            await Session.persistMessage({
              info: {
                id: control.messageID,
                sessionID: root.id,
                role: "user",
                author: "orchestrator",
                time: { created: Date.now() },
                agent: "orchestrator",
                model: { providerID: "openai", modelID: "gpt-5.6-terra" },
                extra: control.extra,
              },
              parts: [{
                id: control.partID,
                sessionID: root.id,
                messageID: control.messageID,
                type: "text",
                text: control.text,
                kind: "control",
                source: "system",
              } satisfies Message.TextPart],
            })
            const assistantInput: Message.Assistant = {
              id: Identifier.ascending("message"),
              sessionID: root.id,
              parentID: control.messageID,
              role: "assistant",
              author: "orchestrator",
              time: calls.length === 0 ? { created: Date.now(), completed: Date.now() + 1 } : { created: Date.now() },
              agent: "orchestrator",
              providerID: "openai",
              modelID: "gpt-5.6-terra",
              path: { cwd: project.path, root: project.path },
              cost: 0,
              tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
              finish: calls.length === 0 ? "stop" : "tool-calls",
              activationID,
            }
            let assistant = await Session.updateMessage(assistantInput)
            calls.push({ activationID, predecessorID, assistantID: assistant.id })
            if (calls.length === 1) return { finalMessageID: assistant.id }
            const request = await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: root.id,
              messageID: assistant.id,
              type: "tool",
              callID: "call_manage_task_decision",
              tool: "manage_task",
              state: { status: "running", input: { action: "inspect" }, time: { start: Date.now() } },
            })
            await Session.updatePart({
              ...request,
              state: {
                status: "completed",
                input: { action: "inspect" },
                output: "decision committed",
                title: "Manage Task",
                metadata: {},
                time: { start: request.state.time.start, end: Date.now() },
              },
            })
            assistant = await Session.updateMessage({
              ...assistant,
              time: { ...assistant.time, completed: Date.now() },
            })
            return { finalMessageID: assistant.id }
          },
        })

        expect(await reconcileTaskControlPlane(taskID)).toBe(2)

        const leases = Database.use((db) => db.select().from(EngineControlActivationLeaseTable)
          .where(eq(EngineControlActivationLeaseTable.target_id, ingress.id))
          .orderBy(asc(EngineControlActivationLeaseTable.time_activated), asc(EngineControlActivationLeaseTable.id)).all())
        expect({
          ingresses: listTaskRootIngresses(taskID, 1).map((row) => row.id),
          predecessors: calls.map((call) => call.predecessorID),
          activations: calls.map((call) => call.activationID),
          leaseIDs: leases.map((lease) => lease.id),
          projection: projectTaskRootIngress(ingress.id, Date.now(), readTaskRootIngressEvidence),
        }).toEqual({
          ingresses: [ingress.id],
          predecessors: [ingress.id, calls[0]!.assistantID],
          activations: leases.map((lease) => lease.id),
          leaseIDs: leases.map((lease) => lease.id),
          projection: { state: "resolved", decisionID: expect.any(String) },
        })
      },
    })
  })
})
