import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { unlink } from "node:fs/promises"
import { persistQueuedTask } from "@/engine/pipeline"
import {
  configureTaskLoopRunner,
  dispatchTaskLoop,
  dispatchPersistedTaskLoop,
  persistQueuedTaskIntentInTransaction,
  persistQueuedTaskWaitWakeInTransaction,
  requeueInterruptedRunningTaskIngresses,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import {
  EngineArtifactTable,
  EngineProgressSnapshotTable,
  EngineTaskCancellationAuthorityTable,
} from "@/engine/engine.sql"
import { recordEngineArtifact, updateEngineArtifact } from "@/engine/artifact"
import { QueuedTaskIngressSchema } from "@/engine/queued-task-ingress"
import { Event } from "@/engine/model"
import { TASK_CANCELLED_EVENT_TYPE, TASK_CANCELLATION_REQUESTED_EVENT_TYPE } from "@/engine/cancellation-origin"
import { pendingTaskCancellationProjection } from "@/engine/cancellation-projection"
import { EngineProtocol } from "@/engine/protocol"
import { deriveTaskStatus } from "@/engine/task-status"
import { reconcilePendingCancelledTaskSettlements, terminalTask } from "@/engine/state"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY } from "@/orchestrator/stateful-tool-names"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import type { Message } from "@/session/message"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { EngineService } from "@/task-api"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await waitForQueueCompletionHooksForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function completedTextPart(input: { sessionID: string; messageID: string; text: string }): Message.TextPart {
  return {
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "text",
    text: input.text,
  }
}

function completedToolPart(input: {
  sessionID: string
  messageID: string
  callID: string
  tool: string
  stateInput: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Message.ToolPart {
  const start = Date.now()
  return {
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: input.callID,
    tool: input.tool,
    state: {
      status: "completed",
      input: input.stateInput,
      output: "ok",
      title: input.tool,
      metadata: input.metadata ?? {},
      time: { start, end: start + 1 },
    },
  }
}

async function createActiveTask(input: { title: string; request: string }) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({
    kind: "root",
    title: input.title,
    metadata: { configOverlay: { model: "openai/gpt-5.6-sol" } },
  })
  const now = Date.now()
  persistQueuedTask({
    taskID,
    sessionID: root.id,
    now,
    title: input.title,
    request: input.request,
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    queue: false,
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
  return { taskID, rootSessionID: root.id }
}

async function waitForCancelledCheckpoint(taskID: string) {
  const settlementDeadline = Date.now() + 5_000
  let settlement: { label: string; payload: { status?: string } } | undefined
  while (Date.now() < settlementDeadline) {
    settlement = Database.use(
      (db) =>
        db
          .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
          .from(EngineArtifactTable)
          .where(
            and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_checkpoint_settlement")),
          )
          .get() as typeof settlement,
    )
    if ((requireTask(taskID).metadata as any)?.git?.result && settlement?.label === "completed") break
    await Bun.sleep(20)
  }
  expect((requireTask(taskID).metadata as any)?.git?.result?.checkpoint_receipt).toBeDefined()
  expect(settlement).toMatchObject({ label: "completed", payload: { status: "completed" } })
}

async function persistFinalAssistantMessage(input: {
  rootSessionID: string
  text: string
  parts?: (sessionID: string, messageID: string) => Message.Part[]
}) {
  const session = await Session.create({
    kind: "orchestrator",
    parentID: input.rootSessionID,
    title: "Operator wake settlement runner",
  })
  const now = Date.now()
  const messageID = Identifier.ascending("message")
  const info: Message.Assistant = {
    id: messageID,
    sessionID: session.id,
    parentID: Identifier.ascending("message"),
    role: "assistant",
    author: "orchestrator",
    time: { created: now, completed: now + 1 },
    agent: "orchestrator",
    providerID: "test",
    modelID: "settlement-runner",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "stop",
  }
  await Session.persistMessage({
    info,
    parts: [
      completedTextPart({ sessionID: session.id, messageID, text: input.text }),
      ...(input.parts?.(session.id, messageID) ?? []),
    ],
  })
  return messageID
}

async function persistAssistantInvocation(input: {
  rootSessionID: string
  sessionID?: string
  parentID?: string
  turns: {
    text: string
    parts?: (sessionID: string, messageID: string) => Message.Part[]
  }[]
}) {
  const session = input.sessionID
    ? await Session.get(input.sessionID)
    : await Session.create({
        kind: "orchestrator",
        parentID: input.rootSessionID,
        title: "Operator wake settlement runner",
      })
  const parentID = input.parentID ?? Identifier.ascending("message")
  let finalMessageID = ""
  for (const [index, turn] of input.turns.entries()) {
    const now = Date.now() + index * 10
    const messageID = Identifier.ascending("message")
    finalMessageID = messageID
    const info: Message.Assistant = {
      id: messageID,
      sessionID: session.id,
      parentID,
      role: "assistant",
      author: "orchestrator",
      time: { created: now, completed: now + 1 },
      agent: "orchestrator",
      providerID: "test",
      modelID: "settlement-runner",
      path: { cwd: Instance.directory, root: Instance.directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      finish: "stop",
    }
    await Session.persistMessage({
      info,
      parts: [
        completedTextPart({ sessionID: session.id, messageID, text: turn.text }),
        ...(turn.parts?.(session.id, messageID) ?? []),
      ],
    })
  }
  return finalMessageID
}

async function persistOperatorRootMessage(input: { taskID: string; rootSessionID: string; text: string }) {
  const now = Date.now()
  const messageID = Identifier.ascending("message")
  await Session.persistMessage({
    info: {
      id: messageID,
      sessionID: input.rootSessionID,
      role: "user",
      author: "operator",
      time: { created: now },
      agent: "orchestrator",
      model: { providerID: "openai", modelID: "gpt-5.6-sol" },
      extra: {
        task_root_message: {
          protocol: "task-root-message",
          taskID: input.taskID,
          kind: "operator",
          source: "operator.test",
        },
      },
    },
    parts: [completedTextPart({ sessionID: input.rootSessionID, messageID, text: input.text })],
  })
  return messageID
}

async function dispatchOperatorIntent(input: { taskID: string; supersededOperatorMessageIDs: string[] }) {
  Database.transaction((db) => {
    persistQueuedTaskIntentInTransaction(db, {
      task: requireTask(input.taskID),
      intent: "retry",
      supersededOperatorMessageIDs: input.supersededOperatorMessageIDs,
      now: Date.now(),
    })
  })
  return dispatchPersistedTaskLoop(input.taskID)
}

async function dispatchTaskWaitWake(input: { taskID: string; jobID: string }) {
  Database.transaction((db) => {
    persistQueuedTaskWaitWakeInTransaction(db, {
      taskID: input.taskID,
      projectID: Instance.project.id,
      jobID: input.jobID,
      fireID: `cal_task_wait_${input.jobID}`,
      dueAt: Date.now() - 1,
      note: "Resume from the exact durable Task wait wake",
      now: Date.now(),
    })
  })
  return dispatchPersistedTaskLoop(input.taskID)
}

function latestQueuedOperatorWake(taskID: string) {
  const row = Database.use((db) =>
    db
      .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .get(),
  )
  if (!row) throw new Error(`Task ${taskID} has no queued_operator_wake artifact`)
  return { label: row.label, payload: QueuedTaskIngressSchema.parse(row.payload) }
}

describe("active operator wake settlement", () => {
  test("joins duplicate cancellation calls and commits one terminal cancellation before checkpoint settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Idempotent task cancellation",
          request: "Cancel this active task once",
        })
        const mandatoryProcess = await ProcessSupervisor.spawnTaskCommand(
          { taskID, cwd: project.path },
          {
            executable: process.execPath,
            args: ["-e", "setInterval(()=>{},1000)"],
            owner: "cancellation-mandatory-barrier-test",
          },
        )
        let resolveAuxiliaryExit!: (code: number) => void
        const auxiliaryExited = new Promise<number>((resolve) => (resolveAuxiliaryExit = resolve))
        const restoreCommandFactory = ProcessSupervisor.setCommandFactoryForTest(async () => ({
          pid: 41_002,
          stdin: null,
          stdout: null,
          stderr: null,
          exited: auxiliaryExited,
          outputSettled: auxiliaryExited.then(() => undefined),
          async terminate() {},
          async dispose() {},
          unref() {},
        }))
        const auxiliaryProcess = await ProcessSupervisor.spawnTaskCommand(
          { taskID, cwd: project.path },
          {
            executable: process.execPath,
            args: ["-e", "setInterval(()=>{},1000)"],
            owner: "cancellation-auxiliary-settlement-test",
            taskCancellationRole: "auxiliary",
          },
        )
        restoreCommandFactory()
        const cancel = (requestID: string) =>
          EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID,
              reason: "operator requested cancellation",
            },
          })
        const taskUpdatedBeforeCancellation = requireTask(taskID).time_updated
        await Bun.sleep(2)
        const requestedAt = performance.now()
        const receipt = await EngineService.requestTaskCancellation(taskID, {
          origin: {
            actor: "user",
            source: "task.cancel",
            surface: "api",
            requestID: "cancel-request-a",
            reason: "operator requested cancellation",
          },
        })
        expect(["cancelling", "cancelled"]).toContain(receipt.status)
        expect(performance.now() - requestedAt).toBeLessThan(1_000)
        expect(requireTask(taskID).time_updated).toBeGreaterThan(taskUpdatedBeforeCancellation)
        expect(
          await Promise.race([
            Promise.all([cancel("cancel-request-a"), cancel("cancel-request-b")]),
            Bun.sleep(2_000).then(() => ["timed-out"]),
          ]),
        ).toEqual([true, true])
        expect(typeof (await mandatoryProcess.exited)).toBe("number")
        expect({
          status: deriveTaskStatus(requireTask(taskID)),
          auxiliaryProcesses:
            ProcessSupervisor.metricsSnapshot().owners["cancellation-auxiliary-settlement-test"]?.count,
        }).toEqual({ status: "cancelled", auxiliaryProcesses: 1 })
        resolveAuxiliaryExit(0)
        expect(await auxiliaryProcess.exited).toBe(0)

        const events = ProtocolStore.listTaskEvents(taskID)
        const cancellationRequestTime = events.find((event) => event.type === TASK_CANCELLATION_REQUESTED_EVENT_TYPE)!
          .time.emitted
        expect({
          status: deriveTaskStatus(requireTask(taskID)),
          requests: events.filter((event) => event.type === TASK_CANCELLATION_REQUESTED_EVENT_TYPE).length,
          terminals: events.filter((event) => event.type === TASK_CANCELLED_EVENT_TYPE).length,
        }).toEqual({ status: "cancelled", requests: 1, terminals: 1 })

        await waitForCancelledCheckpoint(taskID)
        const settlementDeadline = Date.now() + 5_000
        while (Date.now() < settlementDeadline) {
          const active = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskID),
                  sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
                  sql`${EngineArtifactTable.label} IN ('pending', 'running')`,
                ),
              )
              .all(),
          )
          if (active.length === 0) break
          await Bun.sleep(20)
        }
        const settlements = Database.use((db) =>
          db
            .select({
              kind: EngineArtifactTable.kind,
              label: EngineArtifactTable.label,
              payload: EngineArtifactTable.payload,
            })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
              ),
            )
            .orderBy(EngineArtifactTable.kind)
            .all(),
        )
        expect(
          settlements.map((item) => ({
            kind: item.kind,
            label: item.label,
            requestEventID: (item.payload as Record<string, unknown>).cancellation_request_event_id,
            requestedAt: (item.payload as Record<string, unknown>).time_requested,
          })),
        ).toEqual([
          {
            kind: "task_auxiliary_settlement",
            label: "completed",
            requestEventID: receipt.requestEventID,
            requestedAt: cancellationRequestTime,
          },
          {
            kind: "task_checkpoint_settlement",
            label: "completed",
            requestEventID: receipt.requestEventID,
            requestedAt: cancellationRequestTime,
          },
        ])
        const staleSettlementID = recordEngineArtifact({
          taskID,
          kind: "task_auxiliary_settlement",
          label: "running",
          payload: {
            task_id: taskID,
            cancellation_request_event_id: receipt.requestEventID,
            status: "running",
            time_requested: Date.now(),
            owner_id: "prior-settlement-owner",
            owner_process_id: process.pid + 10_000,
            owner_started_at: Date.now(),
            lease_expires_at: Date.now() + 100,
          },
        })
        expect(reconcilePendingCancelledTaskSettlements()).toBeGreaterThanOrEqual(1)
        const takeoverDeadline = Date.now() + 3_000
        let reclaimed: { label: string; payload: Record<string, unknown> } | undefined
        while (Date.now() < takeoverDeadline) {
          reclaimed = Database.use(
            (db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, staleSettlementID))
                .get() as typeof reclaimed,
          )
          if (reclaimed?.label === "completed") break
          await Bun.sleep(25)
        }
        expect(reclaimed).toMatchObject({
          label: "completed",
          payload: {
            cancellation_request_event_id: receipt.requestEventID,
            status: "completed",
            owner_id: expect.stringMatching(/^settlement-owner:/),
          },
        })

        const retrySettlementID = recordEngineArtifact({
          taskID,
          kind: "task_auxiliary_settlement",
          label: "pending",
          payload: {
            task_id: taskID,
            cancellation_request_event_id: receipt.requestEventID,
            status: "pending",
            time_requested: cancellationRequestTime,
          },
        })
        const immediateTransaction = Database.immediateTransaction
        let completionWriteFailed = false
        let transactionCalls = 0
        const transactionSpy = spyOn(Database, "immediateTransaction").mockImplementation(((callback: never) => {
          transactionCalls += 1
          if (transactionCalls === 2) {
            completionWriteFailed = true
            throw new Error("injected settlement completion write failure")
          }
          return immediateTransaction(callback)
        }) as typeof Database.immediateTransaction)
        try {
          expect(reconcilePendingCancelledTaskSettlements()).toBeGreaterThanOrEqual(1)
          const failureDeadline = Date.now() + 1_000
          while (!completionWriteFailed && Date.now() < failureDeadline) await Bun.sleep(10)
          expect(completionWriteFailed).toBe(true)
        } finally {
          transactionSpy.mockRestore()
        }
        const retryDeadline = Date.now() + 3_000
        let retrySettlement: { label: string } | undefined
        while (Date.now() < retryDeadline) {
          retrySettlement = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, retrySettlementID))
              .get(),
          )
          if (retrySettlement?.label === "completed") break
          await Bun.sleep(25)
        }
        expect(retrySettlement).toEqual({ label: "completed" })
      },
    })
  }, 0)

  test("reuses a durable pending cancellation occurrence after process-local ownership is absent", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Recovered task cancellation",
          request: "Resume cancellation convergence from its durable request",
        })
        const requested = await EngineProtocol.emit(
          Event.TaskCancellationRequested,
          {
            taskID,
            actor: "user",
            surface: "api",
            reason: "operator requested cancellation",
            summary: "Cancellation requested: operator requested cancellation",
          },
          { source: "task.cancel", correlationID: "durable-cancel-request" },
        )
        Database.use((db) =>
          db
            .insert(EngineTaskCancellationAuthorityTable)
            .values({
              task_id: taskID,
              request_event_id: requested.id,
              convergence_owner_id: "prior-backend-owner",
              convergence_owner_process_id: process.pid + 10_000,
              convergence_lease_expires_at: Date.now() + 50,
            })
            .run(),
        )
        expect(pendingTaskCancellationProjection(taskID)).toMatchObject({
          status: "cancelling",
          requestEventID: requested.id,
          requestID: "durable-cancel-request",
        })
        let interruptedIngressID = ""
        Database.transaction((db) => {
          interruptedIngressID = persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          })
        })
        const interruptedIngress = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, interruptedIngressID))
            .get(),
        )
        updateEngineArtifact({
          id: interruptedIngressID,
          label: "running",
          payload: {
            ...QueuedTaskIngressSchema.parse(interruptedIngress?.payload),
            queued_by_process_id: process.pid + 10_000,
          },
        })
        expect(requeueInterruptedRunningTaskIngresses()).toBe(0)

        expect(
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "duplicate-after-restart",
              reason: "repeat cancellation request",
            },
          }),
        ).toBe(true)
        const requests = ProtocolStore.listTaskEvents(taskID).filter(
          (event) => event.type === TASK_CANCELLATION_REQUESTED_EVENT_TYPE,
        )
        expect({
          requestIDs: requests.map((event) => event.id),
          status: deriveTaskStatus(requireTask(taskID)),
          convergenceOwner: Database.use(
            (db) =>
              db
                .select({ ownerID: EngineTaskCancellationAuthorityTable.convergence_owner_id })
                .from(EngineTaskCancellationAuthorityTable)
                .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
                .get()?.ownerID,
          ),
        }).toEqual({
          requestIDs: [requested.id],
          status: "cancelled",
          convergenceOwner: expect.stringMatching(/^cancellation-owner:/),
        })
        expect(
          Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, interruptedIngressID))
              .get(),
          ),
        ).toEqual({ label: "terminal_inapplicable" })
        await waitForCancelledCheckpoint(taskID)
      },
    })
  }, 0)

  test("commits terminal cancellation before recording a failed post-terminal checkpoint settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Cancellation with changed workspace",
          request: "Cancel even when the immutable checkpoint baseline cannot be prepared",
        })
        await Bun.write(`${project.path}/changed-after-task-creation.txt`, "workspace changed")

        expect(
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "cancel-with-checkpoint-failure",
              reason: "operator requested cancellation",
            },
          }),
        ).toBe(true)
        expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")

        const deadline = Date.now() + 15_000
        let settlement:
          | { label: string; payload: { status?: string; failures?: Array<{ stage?: string }> } }
          | undefined
        while (Date.now() < deadline) {
          settlement = Database.use(
            (db) =>
              db
                .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "task_checkpoint_settlement"),
                  ),
                )
                .get() as typeof settlement,
          )
          if (settlement && !["pending", "running"].includes(settlement.label)) break
          await Bun.sleep(20)
        }
        expect(settlement).toMatchObject({
          label: "failed",
          payload: { status: "failed", failures: [{ stage: "baseline" }] },
        })
        const allSettlementsDeadline = Date.now() + 5_000
        while (Date.now() < allSettlementsDeadline) {
          const active = Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskID),
                  sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
                  sql`${EngineArtifactTable.label} IN ('pending', 'running')`,
                ),
              )
              .all(),
          )
          if (active.length === 0) break
          await Bun.sleep(20)
        }
        expect(
          Database.use((db) =>
            db
              .select({ kind: EngineArtifactTable.kind, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskID),
                  sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
                ),
              )
              .orderBy(EngineArtifactTable.kind)
              .all(),
          ),
        ).toEqual([
          { kind: "task_auxiliary_settlement", label: "completed" },
          { kind: "task_checkpoint_settlement", label: "failed" },
        ])
        await unlink(`${project.path}/changed-after-task-creation.txt`)
        const settlementID = recordEngineArtifact({
          taskID,
          kind: "task_checkpoint_settlement",
          label: "pending",
          payload: {
            task_id: taskID,
            cancellation_request_event_id: "evt_checkpoint_retry_contract",
            status: "pending",
            time_requested: Date.now(),
          },
        })
        const immediateTransaction = Database.immediateTransaction
        let completionWriteFailed = false
        let transactionCalls = 0
        const transactionSpy = spyOn(Database, "immediateTransaction").mockImplementation(((callback: never) => {
          transactionCalls += 1
          if (transactionCalls === 2) {
            completionWriteFailed = true
            throw new Error("injected checkpoint receipt completion write failure")
          }
          return immediateTransaction(callback)
        }) as typeof Database.immediateTransaction)
        try {
          expect(reconcilePendingCancelledTaskSettlements()).toBeGreaterThanOrEqual(1)
          const failureDeadline = Date.now() + 5_000
          while (!completionWriteFailed && Date.now() < failureDeadline) await Bun.sleep(20)
          expect(completionWriteFailed).toBe(true)
        } finally {
          transactionSpy.mockRestore()
        }
        const retryDeadline = Date.now() + 15_000
        let label: string | undefined
        while (Date.now() < retryDeadline) {
          label = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, settlementID))
              .get(),
          )?.label
          if (label === "completed") break
          await Bun.sleep(25)
        }
        const resultCheckpoints = Database.use((db) =>
          db
            .select({ payload: EngineProgressSnapshotTable.payload })
            .from(EngineProgressSnapshotTable)
            .where(eq(EngineProgressSnapshotTable.task_id, taskID))
            .all()
            .filter((row) => (row.payload as Record<string, unknown>).stage === "result"),
        )
        const gitMetadata = (requireTask(taskID).metadata as any).git as Record<string, unknown> | undefined
        expect({
          label,
          resultCheckpoints: resultCheckpoints.length,
          resultHistory: Array.isArray(gitMetadata?.result_history) ? gitMetadata.result_history.length : undefined,
        }).toEqual({ label: "completed", resultCheckpoints: 1, resultHistory: 0 })
      },
    })
  }, 0)

  test("holds runtime shutdown admission until an in-flight mandatory spawn is tracked and stopped", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Runtime mandatory spawn gate",
          request: "Do not let a late mandatory spawn escape runtime settlement",
        })
        let enterFactory!: () => void
        const factoryEntered = new Promise<void>((resolve) => (enterFactory = resolve))
        let releaseFactory!: () => void
        const factoryReleased = new Promise<void>((resolve) => (releaseFactory = resolve))
        let resolveExit!: (code: number) => void
        const exited = new Promise<number>((resolve) => (resolveExit = resolve))
        const restoreFactory = ProcessSupervisor.setCommandFactoryForTest(async () => {
          enterFactory()
          await factoryReleased
          return {
            pid: 41_003,
            stdin: null,
            stdout: null,
            stderr: null,
            exited,
            outputSettled: exited.then(() => undefined),
            async terminate() {
              resolveExit(0)
            },
            async dispose() {
              resolveExit(0)
            },
            unref() {},
          }
        })
        try {
          const spawn = ProcessSupervisor.spawnTaskCommand(
            { taskID, cwd: project.path },
            {
              executable: process.execPath,
              args: ["-e", "setInterval(()=>{},1000)"],
              owner: "runtime-mandatory-spawn-gate-test",
            },
          )
          await factoryEntered
          const gate = ProcessSupervisor.acquireRuntimeMandatorySettlementGate()
          expect(await Promise.race([gate.then(() => "acquired"), Bun.sleep(25).then(() => "blocked")])).toBe("blocked")
          releaseFactory()
          const acquiredGate = await gate
          try {
            expect(await (await spawn).exited).toBe(0)
            expect(ProcessSupervisor.metricsSnapshot().live).toBe(0)
          } finally {
            acquiredGate[Symbol.dispose]()
          }
        } finally {
          restoreFactory()
          releaseFactory()
        }
      },
    })
  }, 0)

  test("reports a later operator ingress as queued while an earlier root Turn owns delivery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Contended operator wake",
          request: "Keep operator messages ordered while work is active",
        })
        let releaseFirst!: () => void
        const firstReleased = new Promise<void>((resolve) => (releaseFirst = resolve))
        let observeFirstStarted!: () => void
        const firstStarted = new Promise<void>((resolve) => (observeFirstStarted = resolve))
        let invocation = 0
        configureTaskLoopRunner(async ({ event }) => {
          invocation += 1
          if (invocation === 1) {
            observeFirstStarted()
            await firstReleased
          }
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake contention test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: `Read ordered operator ingress ${invocation}.`,
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: `call_read_ordered_operator_message_${invocation}`,
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this response to the exact queued operator message.",
                      },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        try {
          const acceptedAt = performance.now()
          const first = await EngineService.handleTaskMessage(taskID, {
            text: "Report the first current status.",
            source: "operator.test",
          })
          await firstStarted
          const firstIngress = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, first.ingress_id!))
              .get(),
          )
          expect({ label: firstIngress?.label, runningWithinMs: performance.now() - acceptedAt }).toEqual({
            label: "running",
            runningWithinMs: expect.any(Number),
          })
          expect(performance.now() - acceptedAt).toBeLessThan(2_000)
          const second = await EngineService.handleTaskMessage(taskID, {
            text: "Report the next current status after the first response.",
            source: "operator.test",
          })
          expect({ first: first.wake_status, second: second.wake_status }).toEqual({
            first: "accepted",
            second: "queued",
          })
        } finally {
          releaseFirst()
        }
        await waitForQueueCompletionHooksForTest()
      },
    })
  })

  test("delivers one lifecycle occurrence once when the same event is accepted concurrently", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Idempotent lifecycle delivery",
          request: "Deliver an exact worker terminal lifecycle occurrence once",
        })
        let release!: () => void
        const released = new Promise<void>((resolve) => (release = resolve))
        let started!: () => void
        const observedStart = new Promise<void>((resolve) => (started = resolve))
        let invocations = 0
        configureTaskLoopRunner(async () => {
          invocations += 1
          started()
          await released
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "Observed the exact terminal worker lifecycle occurrence.",
            }),
          }
        })
        const event = {
          note: "Deliver terminal worker lifecycle occurrence",
          agentLifecycleDelivery: {
            eventID: "evt_worker_terminal_once",
            sessionID: "ses_worker_terminal_once",
            dispatchID: "dispatch_worker_terminal_once",
          },
        }
        try {
          expect(await dispatchTaskLoop({ taskID, event })).toBe("started")
          await observedStart
          expect(await dispatchTaskLoop({ taskID, event })).toBe("started")
        } finally {
          release()
        }
        await waitForQueueCompletionHooksForTest()
        const rows = Database.use((db) =>
          db
            .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
            .all(),
        )
        expect({
          invocations,
          occurrences: rows.filter(
            (row) =>
              QueuedTaskIngressSchema.parse(row.payload).lifecycle_event_id === event.agentLifecycleDelivery.eventID,
          ).length,
          label: rows[0]?.label,
        }).toEqual({ invocations: 1, occurrences: 1, label: "drained" })
      },
    })
  })

  test("settles the owning lifecycle wake before evaluating its terminal delivery phase", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Lifecycle wake terminal handoff",
          request: "Complete from this exact worker lifecycle occurrence",
        })
        const event = {
          note: "Complete from terminal worker lifecycle occurrence",
          agentLifecycleDelivery: {
            eventID: "evt_worker_terminal_handoff",
            sessionID: "ses_worker_terminal_handoff",
            dispatchID: "dispatch_worker_terminal_handoff",
          },
        }
        let duplicateDispatchStatus = ""
        configureTaskLoopRunner(async ({ event: currentEvent }) => {
          const finalMessageID = await persistFinalAssistantMessage({
            rootSessionID,
            text: "Completed the Task from the exact terminal worker lifecycle occurrence.",
            parts: (sessionID, messageID) => [
              completedToolPart({
                sessionID,
                messageID,
                callID: "call_complete_from_lifecycle",
                tool: "manage_task",
                stateInput: { action: "complete_task" },
                metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
              }),
            ],
          })
          await terminalTask(requireTask(taskID), { status: "completed" }, "Lifecycle handoff completed")
          duplicateDispatchStatus = await dispatchTaskLoop({ taskID, event: currentEvent })
          return { finalMessageID }
        })

        expect(await dispatchTaskLoop({ taskID, event })).toBe("started")
        await waitForQueueCompletionHooksForTest()
        const rows = Database.use((db) =>
          db
            .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
            .all(),
        )
        const occurrence = rows.filter(
          (row) => QueuedTaskIngressSchema.parse(row.payload).lifecycle_event_id === event.agentLifecycleDelivery.eventID,
        )
        expect({
          taskStatus: deriveTaskStatus(requireTask(taskID)),
          duplicateDispatchStatus,
          occurrenceCount: occurrence.length,
          occurrenceLabel: occurrence[0]?.label,
          rootWakeQueue: SessionPromptState.TestHooks.rootWakeQueueSnapshot(rootSessionID),
        }).toEqual({
          taskStatus: "completed",
          duplicateDispatchStatus: "started",
          occurrenceCount: 1,
          occurrenceLabel: "drained",
          rootWakeQueue: undefined,
        })
      },
    })
  })

  test("requeues a prior-process running ingress and drains its original occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Recovered running ingress",
          request: "Resume the exact ingress left running by a prior host process",
        })
        let artifactID = ""
        Database.transaction((db) => {
          artifactID = persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          })
        })
        const row = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, artifactID))
            .get(),
        )
        const payload = QueuedTaskIngressSchema.parse(row?.payload)
        updateEngineArtifact({
          id: artifactID,
          label: "running",
          payload: { ...payload, queued_by_process_id: process.pid + 10_000 },
        })
        configureTaskLoopRunner(async () => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            text: "Recovered and settled the original retry ingress.",
            parts: (sessionID, messageID) => [
              completedToolPart({
                sessionID,
                messageID,
                callID: "call_recovered_ingress_decision",
                tool: "dispatch_agent",
                stateInput: { dispatch: { target: "base-developer" } },
                metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
              }),
            ],
          }),
        }))

        expect(requeueInterruptedRunningTaskIngresses()).toBe(1)
        expect(await dispatchPersistedTaskLoop(taskID)).toBe("started")
        await waitForQueueCompletionHooksForTest()
        expect(latestQueuedOperatorWake(taskID)).toMatchObject({
          label: "drained",
          payload: { wake_id: expect.any(String) },
        })
      },
    })
  })

  test("drains a status response after reading the exact active operator message", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Prose-only operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator status wake test expected a rootMessage event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "The current worker is still running and has not produced a terminal result.",
              parts: (sessionID, turnMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: turnMessageID,
                  callID: "call_read_status_operator_message",
                  tool: "read_task_message",
                  stateInput: {
                    message_id: messageID,
                    reason: "Bind the visible status response to the exact operator question.",
                  },
                }),
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("accepted")
        expect(requireTask(taskID).time_updated).toBeGreaterThanOrEqual(response.user_message!.info.time.created)
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({ label: wake.label, sourceKind: wake.payload.source_kind }).toEqual({
          label: "drained",
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains an active operator wake after reading the exact message and making a scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the current follow-up.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this scheduler decision to the exact current operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatched the continuation after reading the current follow-up.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("accepted")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
        expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      },
    })
  })

  test("drains an operator response that reads the exact message in the same assistant turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Same-turn read and dispatch",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "Issued a read and dispatch in one tool batch.",
              parts: (sessionID, finalMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_read_current_operator_message",
                  tool: "read_task_message",
                  stateInput: {
                    message_id: messageID,
                    reason: "Read the current operator message.",
                  },
                }),
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_dispatch_same_turn",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up before dispatching the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("accepted")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains an active operator wake when settlement tools span assistant turns", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Multi-turn settled operator wake",
          request: "Wait for an operator follow-up",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the current operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this scheduler decision to the exact current operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatch the continuation.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
                {
                  text: "The current operator wake was read and scheduled.",
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and dispatch the continuation.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("accepted")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains a current status response without borrowing or requiring a prior scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Current wake cannot borrow prior decision",
          request: "Wait for operator follow-ups",
        })
        const session = await Session.create({
          kind: "orchestrator",
          parentID: rootSessionID,
          title: "Operator wake settlement runner",
        })
        const parentID = Identifier.ascending("message")
        await persistAssistantInvocation({
          rootSessionID,
          sessionID: session.id,
          parentID,
          turns: [
            {
              text: "A previous wake dispatched a continuation.",
              parts: (sessionID, turnMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: turnMessageID,
                  callID: "call_prior_dispatch",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            },
          ],
        })
        configureTaskLoopRunner(async ({ event }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              sessionID: session.id,
              parentID,
              turns: [
                {
                  text: "Read the current operator message but made no scheduler decision.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_current_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Read the current operator message.",
                      },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        const response = await EngineService.handleTaskMessage(taskID, {
          text: "Read this exact follow-up and make a fresh scheduler decision.",
          source: "operator.test",
        })
        expect(response.wake_status).toBe("accepted")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("records delivery_failed when an operator intent wake ignores superseded messages and makes no decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Prose-only operator intent",
          request: "Wait for a retry intent",
        })
        const supersededMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Retry by reading this retired operator message before scheduling.",
        })
        configureTaskLoopRunner(async () => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            text: "Retry acknowledged; I will continue later.",
          }),
        }))

        await expect(
          dispatchOperatorIntent({ taskID, supersededOperatorMessageIDs: [supersededMessageID] }),
        ).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          errorName:
            wake.payload.delivery_result?.status === "delivery_failed"
              ? wake.payload.delivery_result.error_name
              : undefined,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "delivery_failed",
          deliveryStatus: "delivery_failed",
          errorName: "QueuedWakeSettlementError",
          sourceKind: "operator_intent",
        })
      },
    })
  })

  test("drains an operator intent wake after reading superseded messages and making a scheduler decision", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled operator intent",
          request: "Wait for a retry intent",
        })
        const supersededMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Retry by reading this retired operator message before scheduling.",
        })
        configureTaskLoopRunner(async ({ event }) => {
          const [messageID] = event?.taskIntent?.supersededOperatorMessageIDs ?? []
          if (!messageID) throw new Error("operator intent test expected a superseded operator message")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              turns: [
                {
                  text: "Read the retired operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_read_superseded_operator_message",
                      tool: "read_task_message",
                      stateInput: {
                        message_id: messageID,
                        reason: "Bind this retry decision to the superseded operator message.",
                      },
                    }),
                  ],
                },
                {
                  text: "Dispatched the retry continuation after reading the retired operator message.",
                  parts: (sessionID, turnMessageID) => [
                    completedToolPart({
                      sessionID,
                      messageID: turnMessageID,
                      callID: "call_dispatch_retry_continuation",
                      tool: "dispatch_agent",
                      stateInput: { dispatch: { target: "base-developer" } },
                      metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                    }),
                  ],
                },
              ],
            }),
          }
        })

        await expect(
          dispatchOperatorIntent({ taskID, supersededOperatorMessageIDs: [supersededMessageID] }),
        ).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "operator_intent",
        })
      },
    })
  })

  test("drains a task wait wake with a scheduler decision and no root-message read", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Settled task wait wake",
          request: "Wait for a scheduled continuation",
        })
        configureTaskLoopRunner(async ({ event }) => {
          if (!event?.taskWaitWake?.jobID) throw new Error("task wait test expected a taskWaitWake event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              text: "Observed the scheduled wait wake and dispatched the continuation.",
              parts: (sessionID, finalMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_dispatch_wait_continuation",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
                  metadata: { [ORCHESTRATOR_DECISION_EFFECT_METADATA_KEY]: "decision" },
                }),
              ],
            }),
          }
        })

        await expect(dispatchTaskWaitWake({ taskID, jobID: "wait_active_settlement" })).resolves.toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wake = latestQueuedOperatorWake(taskID)
        expect({
          label: wake.label,
          deliveryStatus: wake.payload.delivery_result?.status,
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: undefined,
          sourceKind: "task_wait_wake",
        })
      },
    })
  })
})
