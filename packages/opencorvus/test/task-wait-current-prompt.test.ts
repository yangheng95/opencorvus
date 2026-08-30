import { afterEach, expect, test } from "bun:test"
import { describeTask, renderTaskDescription } from "@/engine/describe"
import { EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { createTaskWait, listTaskWaits } from "@/engine/task-wait"
import { Identifier } from "@/id/id"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Database, asc, eq } from "@/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function establishedTask() {
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Bounded current-epoch wait prompt",
  })
  const now = Date.now()
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.09.1",
    packageDigest: "a".repeat(64),
  }
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Bounded current-epoch wait prompt",
    request: "Render only the current bounded Task waits",
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const scheduler = await Session.create({
    kind: "orchestrator",
    parentID: root.id,
    title: "Bounded current-epoch wait prompt scheduler",
  })
  return { taskID, root, scheduler, now }
}

async function createWaitBatch(input: {
  taskID: string
  sessionID: string
  executionEpoch: number
  creatorIngressID: string
  now: number
  waits: Array<{ duration: number; reason: string }>
}) {
  const lease = acquireTaskRootIngressLease({
    ingressID: input.creatorIngressID,
    ownerOccurrenceID: `task-wait-prompt-owner-${input.executionEpoch}`,
    now: input.now,
    leaseMilliseconds: 60_000,
    assertControlOwnerInTransaction: () => undefined,
  })
  if (!lease.acquired) throw new Error(`Expected Task wait epoch ${input.executionEpoch} activation owner`)
  const control = currentOrchestratorControlMessage(
    { taskCreation: { taskID: input.taskID } },
    input.taskID,
    input.creatorIngressID,
    input.creatorIngressID,
  )
  if (!control) throw new Error(`Expected Task wait epoch ${input.executionEpoch} control occurrence`)
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: input.sessionID,
      role: "user",
      author: "orchestrator",
      agent: "orchestrator",
      model: { providerID: "test", modelID: "task-wait-current-prompt" },
      time: { created: input.now + 1 },
      extra: control.extra,
    },
    parts: [
      {
        id: control.partID,
        sessionID: input.sessionID,
        messageID: control.messageID,
        type: "text",
        text: control.text,
        kind: "control",
        source: "system",
      },
    ],
  })
  const messageID = Identifier.ascending("message")
  await Session.updateMessage({
    id: messageID,
    parentID: control.messageID,
    sessionID: input.sessionID,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID: "test",
    modelID: "task-wait-current-prompt",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: input.now + 2 },
    activationID: lease.activationID,
  })
  const projections = []
  for (const [index, wait] of input.waits.entries()) {
    const toolPartID = Identifier.ascending("part")
    const toolCallID = Identifier.ascending("call")
    await Session.updatePart({
      id: toolPartID,
      sessionID: input.sessionID,
      messageID,
      type: "tool",
      callID: toolCallID,
      tool: "wait",
      state: {
        status: "running",
        input: { duration_ms: wait.duration, reason: wait.reason },
        time: { start: input.now + 3 + index },
      },
    })
    projections.push(
      createTaskWait({
        taskID: input.taskID,
        projectID: Instance.project.id,
        durationMs: wait.duration,
        reason: wait.reason,
        occurrence: {
          sessionID: input.sessionID,
          messageID,
          toolPartID,
          toolCallID,
        },
        now: input.now + 20,
      }),
    )
  }
  return projections
}

test("Task prompt renders the ordered SQL-bounded waits from only the current reopened epoch", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const task = await establishedTask()
      const epochOneIngress = Database.use((db) =>
        db
          .select({ id: EngineTaskRootIngressTable.id })
          .from(EngineTaskRootIngressTable)
          .where(eq(EngineTaskRootIngressTable.task_id, task.taskID))
          .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
          .get(),
      )
      if (!epochOneIngress) throw new Error("Expected the established Task creation ingress")
      const epochOneRows = await createWaitBatch({
        taskID: task.taskID,
        sessionID: task.scheduler.id,
        executionEpoch: 1,
        creatorIngressID: epochOneIngress.id,
        now: task.now + 20,
        waits: Array.from({ length: 6 }, (_, index) => ({
          duration: 800_000 + index * 10_000,
          reason: `epoch-one-history-${index + 1}`,
        })),
      })
      const epochTwoNow = task.now + 200
      const epochTwoIngress = Database.immediateTransaction((db) => {
        ProtocolStore.appendEventInTransaction({
          kind: "event",
          type: "task.completed",
          aggregate: "task",
          aggregate_id: task.taskID,
          task_id: null,
          session_id: task.root.id,
          source: "test",
          emitted_at: task.now + 100,
          payload: { execution_epoch: 1 },
        })
        appendTaskReopenedInTransaction({
          db,
          taskID: task.taskID,
          sessionID: task.root.id,
          now: task.now + 101,
          source: "test",
        })
        return acceptTaskRootIngressInTransaction(db, {
          taskID: task.taskID,
          executionEpoch: 2,
          source: "inline",
          sourceID: "current-wait-prompt-epoch-two",
          inlinePayload: { purpose: "Current Task wait prompt evidence" },
          semanticTurnLimit: 1,
          activationLimit: 1,
          now: epochTwoNow,
        })
      })
      const epochTwoRows = await createWaitBatch({
        taskID: task.taskID,
        sessionID: task.scheduler.id,
        executionEpoch: 2,
        creatorIngressID: epochTwoIngress.id,
        now: epochTwoNow + 20,
        waits: [
          { duration: 700_000, reason: "epoch-two-seven" },
          { duration: 100_000, reason: "epoch-two-one-a" },
          { duration: 600_000, reason: "epoch-two-six" },
          { duration: 100_000, reason: "epoch-two-one-b" },
          { duration: 500_000, reason: "epoch-two-five" },
          { duration: 300_000, reason: "epoch-two-three" },
          { duration: 400_000, reason: "epoch-two-four" },
        ],
      })

      const description = await describeTask(task.taskID)
      const prompt = renderTaskDescription(description)
      const promptWaitLines = prompt.split("\n").filter((line) => line.startsWith("- pending job="))
      const promptWaitReasons = promptWaitLines.map((line) => line.slice(line.lastIndexOf(": ") + 2))
      const history = listTaskWaits(task.taskID)
      const expectedCurrentRows = [...epochTwoRows]
        .sort((left, right) => left.dueAt - right.dueAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
        .slice(0, 5)

      expect({
        completeHistory: {
          count: history.length,
          epochOne: history
            .filter((wait) => wait.executionEpoch === 1)
            .map((wait) => ({ reason: wait.reason, status: wait.status })),
          epochTwoCount: history.filter((wait) => wait.executionEpoch === 2).length,
        },
        promptWaits: description.task_scheduled_waits?.map((wait) => ({
          reason: wait.reason,
          nextRun: wait.next_run,
        })),
        promptWaitReasons,
      }).toEqual({
        completeHistory: {
          count: 13,
          epochOne: epochOneRows.map((row) => ({
            reason: row.reason,
            status: "terminal_inapplicable",
          })),
          epochTwoCount: epochTwoRows.length,
        },
        promptWaits: expectedCurrentRows.map((row) => ({ reason: row.reason, nextRun: row.dueAt })),
        promptWaitReasons: expectedCurrentRows.map((row) => row.reason),
      })
    },
  })
})
