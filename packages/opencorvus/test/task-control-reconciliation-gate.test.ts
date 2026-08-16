import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { insertEngineInteractionRequest } from "@/engine/interaction-request"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { EngineService } from "@/task-api"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/**
 * The gate the control plane raises when an external effect's outcome cannot be
 * determined. It is inserted directly rather than registered with the Question
 * subsystem, and only an answered outcome produces the unknown-activity fact
 * the reduction needs.
 */
async function seedReconciliationGate(projectPath: string) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title: "Reconciliation root" })
  const now = Date.now()
  const interactionID = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: "External effect of unknown outcome",
        request: "Gate an external effect whose result was never recorded",
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.gate" })
    return insertEngineInteractionRequest(db, {
      taskID,
      sessionID: root.id,
      externalID: Identifier.ascending("activity"),
      requestType: "question",
      title: "外部操作结果待确认",
      body: "外部操作的结果未知。",
      payload: {
        activity_reconciliation: {
          ingress_id: Identifier.ascending("activity"),
          request_id: Identifier.ascending("part"),
          assistant_message_id: Identifier.ascending("message"),
        },
        questions: [
          {
            header: "结果确认",
            question: "是否确认该外部操作的最终结果无法确定？",
            options: [{ value: "acknowledge_unknown", label: "确认结果未知", description: "以未知结果继续。" }],
          },
        ],
      },
      eventSource: "task-control.activity-reconciliation",
      eventSummary: "External activity outcome requires operator reconciliation",
      now,
    })
  })
  void projectPath
  return { taskID, interactionID }
}

describe("activity reconciliation gate", () => {
  test("refuses rejection with an actionable error and leaves the gate pending", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, interactionID } = await seedReconciliationGate(project.path)

        const attempts: string[] = []
        for (const reject of [
          () => EngineService.rejectInteraction(interactionID, { autoReply: false }),
          () =>
            EngineService.rejectUserInteraction(interactionID, {
              userInput: { surface: "test", text: "dismiss" },
            }),
        ]) {
          try {
            await reject()
            attempts.push("resolved")
          } catch (error) {
            attempts.push(error instanceof Error ? error.message : String(error))
          }
        }

        // Rejecting used to throw NotFoundError from the Question subsystem and
        // leave the Task waiting on a gate nothing could resolve. Resolving it
        // as rejected would be worse: no unknown-activity fact is synthesized,
        // so the ingress returns to reconcile_required with no gate at all.
        expect({
          refused: attempts.every((message) => message.includes("acknowledge_unknown")),
          status: (await EngineService.listTaskInteractions(taskID)).find((row) => row.id === interactionID)?.status,
        }).toEqual({ refused: true, status: "pending" })
      },
    })
  })
})
