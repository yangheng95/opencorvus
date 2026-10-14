import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import {
  acceptTaskRootIngressInTransaction,
  acquireTaskRootIngressLease,
  assertTaskRootActivationLeaseFenceInTransaction,
} from "@/engine/task-root-fact-store"
import { TaskRootActivationSupersededError } from "@/engine/task-root-ingress-integrity"
import { appendTaskOpenedInTransaction, appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { ExecutionCancellationError } from "@/session/prompt/cancellation"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function activatedTask(title: string) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title })
  const now = Date.now() - 1000
  const ingress = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title,
        request: title,
        metadata: { actor: "user" },
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test" })
    return acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: `${taskID}:input`,
      inlinePayload: { command: "continue" },
      semanticTurnLimit: 3,
      activationLimit: 4,
      now: now + 1,
    })
  })
  const lease = acquireTaskRootIngressLease({
    ingressID: ingress.id,
    ownerOccurrenceID: `${taskID}:owner`,
    now: now + 2,
    leaseMilliseconds: 30_000,
    assertControlOwnerInTransaction: () => undefined,
  })
  if (!lease.acquired) throw new Error("Expected the actual Task-root lease")
  return { taskID, root, ingress, lease, now }
}

function cancellation(task: Awaited<ReturnType<typeof activatedTask>>, actor: "user" | "mission", epoch = 1) {
  const origin = {
    actor,
    source: actor === "user" ? ("task.cancel" as const) : ("mission.abort" as const),
    surface: actor === "user" ? "api" : "runtime",
    requestID: `${task.taskID}:cancel`,
    reason: "Stop the original execution",
    ...(actor === "mission" ? { missionID: "mission-cancellation-fence", sessionID: task.root.id } : {}),
  }
  const event = Database.immediateTransaction(() =>
    EngineProtocol.emitInTransaction(
      Event.TaskCancellationRequested,
      {
        actor: origin.actor,
        surface: origin.surface,
        reason: origin.reason,
        summary: "Cancellation requested by the original caller",
        execution_epoch: epoch,
        ...(origin.missionID ? { missionID: origin.missionID } : {}),
      },
      { source: origin.source, taskID: task.taskID, sessionID: origin.sessionID, correlationID: origin.requestID },
    ),
  )
  return { event, origin }
}

test.each(["user", "mission"] as const)(
  "current activation carries the original %s cancellation and its peer remains writable",
  async (actor) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const target = await activatedTask("Cancel the current activation")
        const peer = await activatedTask("Independent active peer")
        const { event, origin } = cancellation(target, actor)
        let failure: unknown
        try {
          Database.use((db) =>
            assertTaskRootActivationLeaseFenceInTransaction(db, {
              activationID: target.lease.activationID,
              now: Date.now(),
            }),
          )
        } catch (error) {
          failure = error
        }
        expect(failure).toBeInstanceOf(ExecutionCancellationError)
        if (!(failure instanceof ExecutionCancellationError)) throw failure
        const expectedOrigin = {
          actor: origin.actor,
          source: origin.source,
          surface: origin.surface,
          requestID: origin.requestID,
          reason: origin.reason,
          taskID: target.taskID,
          causationEventID: event.id,
          ...(origin.missionID ? { missionID: origin.missionID } : {}),
        }
        expect(failure.origin).toEqual(expectedOrigin)
        expect(Message.fromError(failure, { providerID: "openai" })).toMatchObject({
          name: "MessageAbortedError",
          data: { cancellation: expectedOrigin },
        })
        expect(
          Database.use((db) =>
            assertTaskRootActivationLeaseFenceInTransaction(db, {
              activationID: target.lease.activationID,
              now: Date.now(),
              allowAcceptedActivitySettlement: true,
            }),
          ),
        ).toMatchObject({
          ingressID: target.ingress.id,
          taskID: target.taskID,
          ownerOccurrenceID: `${target.taskID}:owner`,
        })
        expect(
          Database.use((db) =>
            assertTaskRootActivationLeaseFenceInTransaction(db, {
              activationID: peer.lease.activationID,
              now: Date.now(),
            }),
          ),
        ).toMatchObject({ ingressID: peer.ingress.id, taskID: peer.taskID, ownerOccurrenceID: `${peer.taskID}:owner` })
      },
    })
  },
)

test("an earlier execution keeps its superseded identity when the reopened Task is cancelled", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await activatedTask("Original execution")
      Database.immediateTransaction((db) => {
        writeTaskUpdateInTransaction({
          db,
          taskID: task.taskID,
          values: { status: "completed" },
          summary: "Original execution completed",
          now: Date.now() - 2,
        })
        appendTaskReopenedInTransaction({
          db,
          taskID: task.taskID,
          sessionID: task.root.id,
          now: Date.now() - 1,
          source: "test",
        })
      })
      cancellation(task, "user", 2)
      expect(() =>
        Database.use((db) =>
          assertTaskRootActivationLeaseFenceInTransaction(db, {
            activationID: task.lease.activationID,
            now: Date.now(),
          }),
        ),
      ).toThrow(TaskRootActivationSupersededError)
    },
  })
})
