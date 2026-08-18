import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineControlActivationLeaseTable, EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { acceptTaskRootIngressInTransaction, projectTaskRootIngress } from "@/engine/task-root-fact-store"
import {
  reconcileTaskControlPlane,
  readTaskRootIngressEvidence,
  taskControlDriverSnapshot,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageTable } from "@/session/session.sql"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

/** Accept one more operator ingress on the same epoch, behind the corrupt head. */
function acceptFollowUpIngress(taskID: string, sourceID: string) {
  return Database.immediateTransaction((db) =>
    acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID,
      inlinePayload: { note: "operator follow-up behind the corrupt head" },
      semanticTurnLimit: 3,
      activationLimit: 4,
      now: Date.now(),
    }),
  ).id
}

/**
 * Seed one Task whose durable evidence violates the integrity contract: an
 * assistant Message claims the ingress activation while living outside the
 * Task's Orchestrator Session. Before this repair the evidence reader threw,
 * which pre-empted the reduction's designed value and left the driver faulting
 * on a 60s backoff for the process lifetime.
 */
async function seedCorruptActivation(projectPath: string) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title: "Integrity root" })
  const now = Date.now()
  const ingress = Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: "Corrupt activation authority",
        request: "Reduce a persisted integrity violation to a durable blocked value",
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.integrity" })
    return acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: "corrupt-head",
      inlinePayload: { note: "head of a corrupt epoch" },
      semanticTurnLimit: 3,
      activationLimit: 4,
      now: now + 1,
    })
  })
  const activationID = Identifier.ascending("activity")
  Database.immediateTransaction((db) => {
    db.insert(EngineControlActivationLeaseTable)
      .values({
        id: activationID,
        target: "task_root_ingress",
        target_id: ingress.id,
        owner_occurrence_id: "runtime:test-integrity",
        time_activated: now + 2,
        expires_at: now + 120_000,
      })
      .run()
  })
  // The assistant claims the activation from the root Session, which is not
  // the Task's Orchestrator Session. `Session.updateMessage` refuses to write
  // this — the activation fence is the safety half doing its job — so the row
  // goes in directly, standing in for evidence left by an older binary, a
  // crash mid-write or a concurrent writer. Reduction must survive it.
  const assistantID = Identifier.ascending("message")
  Database.immediateTransaction((db) => {
    db.insert(MessageTable)
      .values({
        id: assistantID,
        session_id: root.id,
        time_created: now + 3,
        data: {
          parentID: Identifier.ascending("message"),
          role: "assistant",
          author: "orchestrator",
          time: { created: now + 3, completed: now + 4 },
          agent: "orchestrator",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: projectPath, root: projectPath },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
          activationID,
        },
      })
      .run()
  })
  return { taskID, ingressID: ingress.id }
}

describe("Task-control integrity violations", () => {
  test("reduces a corrupt persisted activation to a Host fault instead of faulting forever", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, ingressID } = await seedCorruptActivation(project.path)
        let activations = 0
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async () => {
            activations += 1
          },
        })

        const projection = projectTaskRootIngress(ingressID, Date.now(), readTaskRootIngressEvidence)
        const activated = await reconcileTaskControlPlane(taskID)
        const entry = taskControlDriverSnapshot().find((row) => row.taskID === taskID)

        expect({
          projection: projection.state,
          activated,
          activations,
          failures: entry?.failures,
          // An operator gate is not a fault: the driver must not arm a retry
          // timer for a state no retry can change.
          armedTimer: entry?.wakeAt !== undefined,
        }).toEqual({
          projection: "host_fault",
          activated: 0,
          activations: 0,
          failures: 0,
          armedTimer: false,
        })
      },
    })
  })

  test("lets a later operator ingress run past a Host-faulted head", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, ingressID } = await seedCorruptActivation(project.path)
        const followUpID = acceptFollowUpIngress(taskID, "operator-follow-up")
        const ran: (string | undefined)[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async (input) => {
            ran.push((input.event as { note?: string } | undefined)?.note)
          },
        })

        const activated = await reconcileTaskControlPlane(taskID)

        // This is the defect the slice removes: the corrupt head used to hold
        // the whole FIFO, so every later operator message queued behind it
        // forever and the only exits were an epoch-bumping Retry or hand
        // repair of the database.
        expect({
          head: projectTaskRootIngress(ingressID, Date.now(), readTaskRootIngressEvidence).state,
          followUp: projectTaskRootIngress(followUpID, Date.now(), readTaskRootIngressEvidence).state,
          activated,
          ran,
        }).toEqual({
          head: "host_fault",
          followUp: "leased",
          activated: 1,
          // Only the follow-up ran: the faulted head never reaches the runner,
          // so releasing the line does not execute anything under the
          // violation it names.
          ran: ["operator follow-up behind the corrupt head"],
        })
      },
    })
  })

  test("stays settled across repeated scans without consuming activation budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, ingressID } = await seedCorruptActivation(project.path)
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async () => {
            throw new Error("A Host-faulted ingress must never reach the runner")
          },
        })

        await reconcileTaskControlPlane(taskID)
        await reconcileTaskControlPlane(taskID)
        await reconcileTaskControlPlane(taskID)

        const state = Database.use((db) => ({
          leases: db
            .select()
            .from(EngineControlActivationLeaseTable)
            .all()
            .filter((row) => row.target_id === ingressID).length,
          gates: db
            .select()
            .from(EngineArtifactTable)
            .all()
            .filter(
              (row) =>
                row.task_id === taskID &&
                row.kind === "task-infrastructure-error" &&
                (row.payload as { operation?: string }).operation === "surface-operator-gated-ingress",
            ).length,
        }))
        expect({
          projection: projectTaskRootIngress(ingressID, Date.now(), readTaskRootIngressEvidence).state,
          // Only the seeded lease exists: a Host fault is refused before
          // acquisition, so repeated scans cannot exhaust the budget.
          leases: state.leases,
          // The settlement is durable and operator-visible, and the
          // deterministic artifact identity keeps repeated observations
          // idempotent even though the verdict is deliberately not memoized.
          gates: state.gates,
        }).toEqual({ projection: "host_fault", leases: 1, gates: 1 })
      },
    })
  })
})
