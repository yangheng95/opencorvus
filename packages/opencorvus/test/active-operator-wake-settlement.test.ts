import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { unlink } from "node:fs/promises"
import { persistQueuedTask } from "@/engine/pipeline"
import {
  configureTaskLoopRunner,
  dispatchTaskLoop,
  dispatchPersistedTaskLoop,
  persistQueuedCoordinationWakeInTransaction,
  persistQueuedTaskIntentInTransaction,
  persistQueuedTaskWaitWakeInTransaction,
  reconcileFailedExactTerminalIngressDeliveries,
  reconcileInterruptedTaskExecutions,
  requeueInterruptedRunningTaskIngresses,
  TestHooks as QueueTestHooks,
  waitForQueueCompletionHooksForTest,
} from "@/engine/queue"
import {
  EngineArtifactTable,
  EngineChannelBindingTable,
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
import { createDecisionLog } from "@/decision-log"
import {
  acquireCancelledTaskSettlementGate,
  CancelledTaskSettlementTestHooks,
  reconcilePendingCancelledTaskSettlements,
  terminalTask,
} from "@/engine/state"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { requireTask } from "@/engine/store"
import { Identifier } from "@/id/id"
import { Orchestrator } from "@/orchestrator/agent"
import { createTerminalConversationAuthority } from "@/orchestrator/terminal-conversation-authority"
import { createOrchestratorTools } from "@/orchestrator/tools"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { publishSettledSessionTerminalStatusInCurrentProject } from "@/session/status-publication"
import { SessionPromptState } from "@/session/prompt/state"
import { Message } from "@/session/message"
import { MessageTable } from "@/session/session.sql"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { EngineService, TaskCancellationConvergenceTestHooks } from "@/task-api"
import { ChannelIngress } from "@/channel/ingress"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { RuntimeServerOwnership } from "@/server/runtime-server-ownership"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
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

async function createActiveTask(input: { title: string; request: string; queue?: boolean }) {
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
    queue: input.queue ?? false,
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
  const settlementDeadline = Date.now() + 15_000
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
  taskIngress?: { id: string; kind: string }
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
    taskIngress: input.taskIngress,
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
  taskIngress?: { id: string; kind: string }
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
      taskIngress: input.taskIngress,
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
      author: "user",
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
        expect(await requeueInterruptedRunningTaskIngresses()).toBe(0)

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
          convergenceOwner: null,
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

  for (const failureMode of ["zero-row", "exception"] as const) {
    test(`fences cancellation convergence after a ${failureMode} heartbeat failure and resumes its durable request`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const { taskID } = await createActiveTask({
            title: `Cancellation heartbeat ${failureMode}`,
            request: "Fence the stale owner before any later physical cancellation stage",
          })
          const origin = {
            actor: "user" as const,
            source: "task.cancel",
            surface: "api",
            requestID: `cancel-heartbeat-${failureMode}`,
            reason: "operator requested cancellation",
          }
          let failure: unknown
          {
            using _heartbeatFailure = TaskCancellationConvergenceTestHooks.failNextHeartbeat(failureMode)
            try {
              await EngineService.cancelTask(taskID, { origin })
            } catch (error) {
              failure = error
            }
          }
          expect({
            failure: failure instanceof Error ? failure.message : String(failure),
            taskStatus: deriveTaskStatus(requireTask(taskID)),
            cancellation: pendingTaskCancellationProjection(taskID),
            convergenceOwner: Database.use(
              (db) =>
                db
                  .select({ ownerID: EngineTaskCancellationAuthorityTable.convergence_owner_id })
                  .from(EngineTaskCancellationAuthorityTable)
                  .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
                  .get()?.ownerID,
            ),
          }).toMatchObject({
            failure:
              failureMode === "zero-row"
                ? `Task ${taskID} cancellation convergence owner lease is no longer authoritative`
                : "injected Task cancellation convergence heartbeat failure",
            taskStatus: "active",
            cancellation: { status: "cancelling", requestID: origin.requestID },
            convergenceOwner: null,
          })

          await Promise.resolve()
          expect(await EngineService.cancelTask(taskID, { origin })).toBe(true)
          expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")
          await waitForCancelledCheckpoint(taskID)
        },
      })
    }, 0)
  }

  test("aborts a late cancellation wait when its convergence heartbeat loses the lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Late cancellation heartbeat fence",
          request: "Lose the convergence lease after prompt, queue, and lifecycle settlement",
        })
        const origin = {
          actor: "user" as const,
          source: "task.cancel",
          surface: "api",
          requestID: "cancel-heartbeat-late-stage",
          reason: "operator requested cancellation",
        }
        let lateSignal: AbortSignal | undefined
        const lateStage = TaskCancellationConvergenceTestHooks.installBeforeLateStage(({ signal, failHeartbeat }) => {
          lateSignal = signal
          queueMicrotask(() => failHeartbeat("zero-row"))
          return new Promise<void>(() => undefined)
        })
        let failure: unknown
        try {
          await EngineService.cancelTask(taskID, { origin })
        } catch (error) {
          failure = error
        } finally {
          lateStage[Symbol.dispose]()
        }

        expect({
          failure: failure instanceof Error ? failure.message : String(failure),
          lateSignalAborted: lateSignal?.aborted,
          taskStatus: deriveTaskStatus(requireTask(taskID)),
          cancellation: pendingTaskCancellationProjection(taskID),
          convergenceOwner: Database.use(
            (db) =>
              db
                .select({ ownerID: EngineTaskCancellationAuthorityTable.convergence_owner_id })
                .from(EngineTaskCancellationAuthorityTable)
                .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
                .get()?.ownerID,
          ),
        }).toMatchObject({
          failure: `Task ${taskID} cancellation convergence owner lease is no longer authoritative`,
          lateSignalAborted: true,
          taskStatus: "active",
          cancellation: { status: "cancelling", requestID: origin.requestID },
          convergenceOwner: null,
        })

        expect(await EngineService.cancelTask(taskID, { origin })).toBe(true)
        expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")
        await waitForCancelledCheckpoint(taskID)
      },
    })
  }, 0)

  test("commits channel binding release with cancellation and routes the same thread to a new Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const route = {
          platform: "test",
          channel: `cancel-route-${Identifier.ascending("channel")}`,
          thread: "root",
        }
        const first = await createActiveTask({
          title: "Channel-bound cancellation owner",
          request: "Release this exact route in the cancellation terminal commit",
        })
        ChannelIngress.bindThread({ ...route, taskID: first.taskID, payload: { ingress: "first" } })
        expect(ChannelIngress.findBinding(route.platform, route.channel, route.thread)).toMatchObject({
          task_id: first.taskID,
          payload: { ingress: "first" },
        })

        const origin = {
          actor: "user" as const,
          source: "task.cancel",
          surface: "api",
          requestID: "cancel-channel-binding-owner",
          reason: "operator requested cancellation",
        }
        expect(await EngineService.cancelTask(first.taskID, { origin })).toBe(true)
        const releasedBindings = Database.use((db) =>
          db
            .select({ id: EngineChannelBindingTable.id })
            .from(EngineChannelBindingTable)
            .where(eq(EngineChannelBindingTable.task_id, first.taskID))
            .all(),
        )

        const successor = await createActiveTask({
          title: "Channel route successor",
          request: "Own the released thread as a new ingress route",
        })
        ChannelIngress.bindThread({ ...route, taskID: successor.taskID, payload: { ingress: "successor" } })
        expect(await EngineService.cancelTask(first.taskID, { origin })).toBe(true)
        expect({
          releasedBindings,
          route: ChannelIngress.findBinding(route.platform, route.channel, route.thread),
        }).toEqual({
          releasedBindings: [],
          route: expect.objectContaining({
            task_id: successor.taskID,
            platform: route.platform,
            channel: route.channel,
            thread: route.thread,
            payload: { ingress: "successor" },
          }),
        })
        await waitForCancelledCheckpoint(first.taskID)
      },
    })
  }, 0)

  test("retries the same post-terminal auxiliary settlement after a runtime gate rollback", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Cancellation settlement gate rollback",
          request: "Resume the exact auxiliary receipt after a shutdown gate rolls back",
        })
        let auxiliaryAttempts = 0
        const auxiliarySettlement = spyOn(ProcessSupervisor, "settleTaskAuxiliaryProcesses").mockImplementation(
          async () => {
            auxiliaryAttempts += 1
            if (auxiliaryAttempts === 1) throw new Error("injected first auxiliary settlement failure")
          },
        )

        expect(
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "cancel-with-auxiliary-failure",
              reason: "operator requested cancellation",
            },
          }),
        ).toBe(true)
        expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")

        const deadline = Date.now() + 15_000
        let settlement:
          | {
              id: string
              label: string
              payload: { status?: string; attempt?: number; last_failure?: Array<{ stage?: string }> }
            }
          | undefined
        while (Date.now() < deadline) {
          settlement = Database.use(
            (db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "task_auxiliary_settlement"),
                  ),
                )
                .get() as typeof settlement,
          )
          if (settlement?.payload.last_failure?.some((failure) => failure.stage === "auxiliary_process_settlement"))
            break
          await Bun.sleep(20)
        }
        const auxiliarySettlementID = settlement!.id
        expect(settlement).toMatchObject({
          id: auxiliarySettlementID,
          payload: {
            attempt: expect.any(Number),
            last_failure: [{ stage: "auxiliary_process_settlement" }],
          },
        })
        const gate = acquireCancelledTaskSettlementGate()
        await gate.waitForIdle()
        const resumeAfterRollback = gate.rollback()
        gate[Symbol.dispose]()
        await resumeAfterRollback()
        const recoveryDeadline = Date.now() + 30_000
        while (Date.now() < recoveryDeadline) {
          const currentSettlement = Database.use(
            (db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, auxiliarySettlementID))
                .get() as typeof settlement,
          )
          if (currentSettlement) settlement = currentSettlement
          if (settlement?.label === "completed") break
          await Bun.sleep(20)
        }
        expect(settlement).toMatchObject({
          id: auxiliarySettlementID,
          label: "completed",
          payload: { status: "completed", attempt: expect.any(Number) },
        })
        expect(auxiliaryAttempts).toBe(2)
        auxiliarySettlement.mockRestore()
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
          { kind: "task_checkpoint_settlement", label: "completed" },
        ])
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

  test("fences displaced cancellation settlement owners before successor cleanup", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const failureMode of ["owner-steal", "renew-throw"] as const) {
          const { taskID } = await createActiveTask({
            title: `Cancellation settlement lease fence ${failureMode}`,
            request: "Abort the displaced cleanup owner before its successor starts",
          })
          const events: string[] = []
          let activeOwners = 0
          let attempt = 0
          const auxiliarySettlement = spyOn(ProcessSupervisor, "settleTaskAuxiliaryProcesses").mockImplementation(
            async (_taskID, options) => {
              attempt += 1
              const currentAttempt = attempt
              expect(activeOwners).toBe(0)
              activeOwners += 1
              events.push(`start:${currentAttempt}`)
              try {
                if (currentAttempt === 1) {
                  const signal = options?.signal
                  if (!signal) throw new Error("settlement cleanup did not receive its lease fence")
                  await new Promise<void>((resolve) => {
                    if (signal.aborted) return resolve()
                    signal.addEventListener("abort", () => resolve(), { once: true })
                  })
                  events.push(`aborted:${currentAttempt}`)
                  signal.throwIfAborted()
                }
              } finally {
                activeOwners -= 1
                events.push(`settled:${currentAttempt}`)
              }
            },
          )
          try {
            expect(
              await EngineService.cancelTask(taskID, {
                origin: {
                  actor: "user",
                  source: "task.cancel",
                  surface: "api",
                  requestID: `cancel-settlement-fence-${failureMode}`,
                  reason: "operator requested cancellation",
                },
              }),
            ).toBe(true)
            let settlement: { id: string; label: string; payload: Record<string, unknown> } | undefined
            const runningDeadline = Date.now() + 5_000
            while (Date.now() < runningDeadline) {
              settlement = Database.use(
                (db) =>
                  db
                    .select({
                      id: EngineArtifactTable.id,
                      label: EngineArtifactTable.label,
                      payload: EngineArtifactTable.payload,
                    })
                    .from(EngineArtifactTable)
                    .where(
                      and(
                        eq(EngineArtifactTable.task_id, taskID),
                        eq(EngineArtifactTable.kind, "task_auxiliary_settlement"),
                      ),
                    )
                    .get() as typeof settlement,
              )
              if (settlement?.label === "running" && events.includes("start:1")) break
              await Bun.sleep(10)
            }
            expect(settlement).toMatchObject({ label: "running", payload: { owner_id: expect.any(String) } })

            if (failureMode === "owner-steal") {
              updateEngineArtifact({
                id: settlement!.id,
                payload: { ...settlement!.payload, owner_id: "successor-owner", lease_expires_at: 0 },
              })
              CancelledTaskSettlementTestHooks.renewLeaseNow(settlement!.id)
            } else {
              const immediateTransaction = Database.immediateTransaction
              const renewalFailure = spyOn(Database, "immediateTransaction").mockImplementation((() => {
                throw new Error("injected settlement lease renewal failure")
              }) as typeof Database.immediateTransaction)
              try {
                CancelledTaskSettlementTestHooks.renewLeaseNow(settlement!.id)
              } finally {
                renewalFailure.mockRestore()
              }
              if (Database.immediateTransaction !== immediateTransaction) {
                throw new Error("settlement renewal transaction spy did not restore")
              }
            }

            const quiesce = acquireCancelledTaskSettlementGate()
            await quiesce.waitForIdle()
            expect({ activeOwners, events }).toEqual({
              activeOwners: 0,
              events: ["start:1", "aborted:1", "settled:1"],
            })
            const current = Database.use((db) =>
              db
                .select({ payload: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, settlement!.id))
                .get(),
            )!.payload as Record<string, unknown>
            const {
              owner_id: _ownerID,
              owner_process_id: _ownerProcessID,
              owner_started_at: _ownerStartedAt,
              lease_expires_at: _leaseExpiresAt,
              ...pending
            } = current
            updateEngineArtifact({ id: settlement!.id, label: "pending", payload: { ...pending, status: "pending" } })
            quiesce.commit()
            quiesce[Symbol.dispose]()
            expect(reconcilePendingCancelledTaskSettlements()).toBeGreaterThanOrEqual(1)
            const successorGate = acquireCancelledTaskSettlementGate()
            await successorGate.waitForIdle()
            successorGate.commit()
            successorGate[Symbol.dispose]()
            expect({ activeOwners, events }).toEqual({
              activeOwners: 0,
              events: ["start:1", "aborted:1", "settled:1", "start:2", "settled:2"],
            })
            expect(
              Database.use((db) =>
                db
                  .select({ label: EngineArtifactTable.label })
                  .from(EngineArtifactTable)
                  .where(eq(EngineArtifactTable.id, settlement!.id))
                  .get(),
              ),
            ).toEqual({ label: "completed" })
          } finally {
            auxiliarySettlement.mockRestore()
          }
        }
      },
    })
  }, 0)

  test("reconciles cancelled Task settlements only in their owning project", async () => {
    await using projectA = await memoryProject()
    await using projectB = await memoryProject()
    let taskB = ""

    await Instance.provide({
      directory: projectB.path,
      fn: async () => {
        taskB = (
          await createActiveTask({
            title: "Project-scoped cancellation settlement",
            request: "Keep cancellation settlement inside this project authority",
          })
        ).taskID
        const gate = acquireCancelledTaskSettlementGate()
        try {
          expect(
            await EngineService.cancelTask(taskB, {
              origin: {
                actor: "user",
                source: "task.cancel",
                surface: "api",
                requestID: "project-scoped-cancellation-settlement",
                reason: "exercise project-scoped recovery",
              },
            }),
          ).toBe(true)
          await gate.waitForIdle()
        } finally {
          gate.commit()
          gate[Symbol.dispose]()
        }
      },
    })

    await Instance.provide({
      directory: projectA.path,
      fn: async () => {
        expect(reconcilePendingCancelledTaskSettlements()).toBe(0)
        expect(
          Database.use((db) =>
            db
              .select({ kind: EngineArtifactTable.kind, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskB),
                  sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
                ),
              )
              .orderBy(EngineArtifactTable.kind)
              .all(),
          ),
        ).toEqual([
          { kind: "task_auxiliary_settlement", label: "pending" },
          { kind: "task_checkpoint_settlement", label: "pending" },
        ])
      },
    })

    await Instance.provide({
      directory: projectB.path,
      fn: async () => {
        expect(reconcilePendingCancelledTaskSettlements()).toBe(2)
        const gate = acquireCancelledTaskSettlementGate()
        try {
          await gate.waitForIdle()
        } finally {
          gate.commit()
          gate[Symbol.dispose]()
        }
        expect(
          Database.use((db) =>
            db
              .select({ kind: EngineArtifactTable.kind, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, taskB),
                  sql`${EngineArtifactTable.kind} IN ('task_checkpoint_settlement', 'task_auxiliary_settlement')`,
                ),
              )
              .orderBy(EngineArtifactTable.kind)
              .all(),
          ),
        ).toEqual([
          { kind: "task_auxiliary_settlement", label: "completed" },
          { kind: "task_checkpoint_settlement", label: "completed" },
        ])
      },
    })
  }, 0)

  test("retries the same cancelled-Task rollback receipt until durable settlement owners recover", async () => {
    await using project = await memoryProject()
    let taskID = ""
    let gate!: ReturnType<typeof acquireCancelledTaskSettlementGate>
    let resume!: () => Promise<void>
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        taskID = (
          await createActiveTask({
            title: "Retry cancelled Task rollback receipt",
            request: "Recover both durable cancellation settlement owners",
          })
        ).taskID
        gate = acquireCancelledTaskSettlementGate()
        resume = gate.rollback()
        expect(
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "api",
              requestID: "cancelled-task-rollback-retry",
              reason: "exercise exact rollback retry",
            },
          }),
        ).toBe(true)
        await gate.waitForIdle()
      },
    })
    await Instance.disposeAll()
    gate[Symbol.dispose]()
    let rollbackAttempts = 0
    using _failure = CancelledTaskSettlementTestHooks.installBeforeRollbackRecovery(() => {
      rollbackAttempts += 1
      if (rollbackAttempts === 1) throw new Error("injected cancelled Task rollback recovery failure")
    })
    await expect(resume()).rejects.toThrow("injected cancelled Task rollback recovery failure")
    await resume()
    const settledGate = acquireCancelledTaskSettlementGate()
    await settledGate.waitForIdle()
    settledGate.commit()
    settledGate[Symbol.dispose]()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const settlementOwners = Database.use((db) =>
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
        )
        expect({ rollbackAttempts, settlementOwners }).toEqual({
          rollbackAttempts: 2,
          settlementOwners: [
            { kind: "task_auxiliary_settlement", label: "completed" },
            { kind: "task_checkpoint_settlement", label: "pending" },
          ],
        })
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
        const { taskID } = await createActiveTask({
          title: "Contended operator wake",
          request: "Keep operator messages ordered while work is active",
        })
        let releaseFirst!: () => void
        const firstReleased = new Promise<void>((resolve) => (releaseFirst = resolve))
        let observeFirstStarted!: () => void
        const firstStarted = new Promise<void>((resolve) => (observeFirstStarted = resolve))
        let invocation = 0
        configureTaskLoopRunner(async ({ event, wakeID }) => {
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
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
        configureTaskLoopRunner(async ({ wakeID }) => {
          invocations += 1
          started()
          await released
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "agent_lifecycle_delivery" },
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

  test("records a typed delivery failure when lifecycle ingress has no assistant settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Lifecycle delivery settlement",
          request: "Settle one exact worker lifecycle delivery with visible assistant evidence",
        })
        let invocations = 0
        configureTaskLoopRunner(async () => {
          invocations += 1
          return
        })
        const event = {
          note: "Deliver worker lifecycle occurrence with exact settlement",
          agentLifecycleDelivery: {
            eventID: "evt_worker_lifecycle_settlement",
            sessionID: "ses_worker_lifecycle_settlement",
            dispatchID: "dispatch_worker_lifecycle_settlement",
          },
        }

        expect(await dispatchTaskLoop({ taskID, event })).toBe("started")
        await waitForQueueCompletionHooksForTest()
        const row = Database.use((db) =>
          db
            .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
            .get(),
        )!

        expect({ invocations, label: row.label, ingress: QueuedTaskIngressSchema.parse(row.payload) }).toMatchObject({
          invocations: 1,
          label: "delivery_failed",
          ingress: {
            lifecycle_event_id: event.agentLifecycleDelivery.eventID,
            delivery_attempt: 1,
            delivery_result: {
              status: "delivery_failed",
              error_name: "QueuedWakeSettlementError",
              message: expect.stringContaining("completed without a final assistant message"),
            },
          },
        })
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
        configureTaskLoopRunner(async ({ event: currentEvent, wakeID }) => {
          const finalMessageID = await persistFinalAssistantMessage({
            rootSessionID,
            taskIngress: { id: wakeID!, kind: "agent_lifecycle_delivery" },
            text: "Completed the Task from the exact terminal worker lifecycle occurrence.",
            parts: (sessionID, messageID) => [
              completedToolPart({
                sessionID,
                messageID,
                callID: "call_complete_from_lifecycle",
                tool: "manage_task",
                stateInput: { action: "complete_task" },
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
          occurrenceDelivery: occurrence[0]
            ? QueuedTaskIngressSchema.parse(occurrence[0].payload).delivery_result
            : undefined,
          rootWakeQueue: SessionPromptState.TestHooks.rootWakeQueueSnapshot(rootSessionID),
        }).toEqual({
          taskStatus: "completed",
          duplicateDispatchStatus: "started",
          occurrenceCount: 1,
          occurrenceLabel: "drained",
          occurrenceDelivery: {
            status: "completed",
            assistant_message_id: expect.any(String),
            time_completed: expect.any(Number),
          },
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
            taskIngress: { id: artifactID, kind: "operator_intent" },
            text: "Recovered and settled the original retry ingress.",
            parts: (sessionID, messageID) => [
              completedToolPart({
                sessionID,
                messageID,
                callID: "call_recovered_ingress_decision",
                tool: "dispatch_agent",
                stateInput: { dispatch: { target: "base-developer" } },
              }),
            ],
          }),
        }))

        expect(await requeueInterruptedRunningTaskIngresses()).toBe(1)
        expect(await dispatchPersistedTaskLoop(taskID)).toBe("started")
        await waitForQueueCompletionHooksForTest()
        expect(latestQueuedOperatorWake(taskID)).toMatchObject({
          label: "drained",
          payload: {
            wake_id: expect.any(String),
            delivery_result: {
              status: "completed",
              assistant_message_id: expect.any(String),
              time_completed: expect.any(Number),
            },
          },
        })
      },
    })
  })

  test("retries the exact terminal Task ingress after its first conversation delivery fails", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Terminal ingress retry",
          request: "Retry one exact terminal conversation delivery",
        })
        await EngineService.cancelTask(taskID, {
          origin: {
            actor: "user",
            source: "task.cancel",
            surface: "api",
            requestID: "terminal-ingress-retry-cancel",
            reason: "move the Task to a terminal occurrence",
          },
        })
        let attempts = 0
        const terminalConversation = spyOn(Orchestrator, "processTerminalConversation").mockImplementation(async () => {
          attempts += 1
          if (attempts <= 2) throw new Error(`injected terminal conversation delivery failure ${attempts}`)
          return await persistFinalAssistantMessage({
            rootSessionID,
            text: "Recovered the exact terminal conversation ingress.",
          })
        })
        let runtimeOwner = RuntimeServerOwnership.acquire({ database: Database.Path() })
        const firstRuntimeOccurrenceID = runtimeOwner.owner.occurrenceID
        try {
          const accepted = await EngineService.handleTaskMessage(taskID, {
            text: "Explain the terminal result through this exact ingress.",
            source: "operator.test",
          })
          expect(accepted.wake_status).toBe("accepted")
          await waitForQueueCompletionHooksForTest()
          const exhausted = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, accepted.ingress_id!))
              .get(),
          )!
          expect({
            attempts,
            label: exhausted.label,
            ingress: QueuedTaskIngressSchema.parse(exhausted.payload),
          }).toMatchObject({
            attempts: 2,
            label: "delivery_failed",
            ingress: { delivery_attempt: 2, delivery_runtime_attempt: 2 },
          })
          runtimeOwner.release()
          runtimeOwner = RuntimeServerOwnership.acquire({ database: Database.Path() })
          const successorRuntimeOccurrenceID = runtimeOwner.owner.occurrenceID
          expect(successorRuntimeOccurrenceID).not.toBe(firstRuntimeOccurrenceID)
          expect(await reconcileFailedExactTerminalIngressDeliveries()).toBe(1)
          await waitForQueueCompletionHooksForTest()
          const row = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, accepted.ingress_id!))
              .get(),
          )!
          expect({ attempts, label: row.label, ingress: QueuedTaskIngressSchema.parse(row.payload) }).toMatchObject({
            attempts: 3,
            label: "drained",
            ingress: {
              delivery_attempt: 3,
              delivery_runtime_id: successorRuntimeOccurrenceID,
              delivery_runtime_attempt: 1,
            },
          })
        } finally {
          runtimeOwner.release()
          terminalConversation.mockRestore()
        }
      },
    })
  }, 30_000)

  test("settles one durable Task loop launch receipt after a transient acceptance write failure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Task loop launch receipt retry",
          request: "Attach one claimed queue launch and settle its durable receipt",
          queue: true,
        })
        configureTaskLoopRunner(async ({ wakeID }) => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            taskIngress: { id: wakeID!, kind: "orchestrator_event" },
            text: "The claimed Task loop is attached.",
          }),
        }))
        using _failure = QueueTestHooks.failNextTaskLoopLaunchAcceptanceWrites(1)

        expect(await dispatchTaskLoop({ taskID, event: { note: "Start the queued Task" } })).toBe("started")
        const deadline = Date.now() + 3_000
        let launch: { id: string; label: string; payload: { status?: string; acceptance_attempt?: number } } | undefined
        while (Date.now() < deadline) {
          launch = Database.use((db) =>
            db
              .select({
                id: EngineArtifactTable.id,
                label: EngineArtifactTable.label,
                payload: EngineArtifactTable.payload,
              })
              .from(EngineArtifactTable)
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_loop_launch")))
              .get(),
          ) as typeof launch
          if (launch?.label === "completed") break
          await Bun.sleep(20)
        }
        await waitForQueueCompletionHooksForTest()
        expect(launch).toMatchObject({
          id: expect.any(String),
          label: "completed",
          payload: { status: "loop_attached", acceptance_attempt: 2 },
        })
        expect(deriveTaskStatus(requireTask(taskID))).toBe("active")
      },
    })
  })

  test("retries one exact completion receipt and advances the queued sibling before runtime settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const first = await createActiveTask({
          title: "Completion retry source",
          request: "Complete and advance the same-directory sibling",
          queue: true,
        })
        const sibling = await createActiveTask({
          title: "Completion retry sibling",
          request: "Start after the source completion receipt settles",
          queue: true,
        })
        const events: string[] = []
        configureTaskLoopRunner(async ({ taskID, wakeID }) => {
          const rootSessionID = taskID === first.taskID ? first.rootSessionID : sibling.rootSessionID
          const finalMessageID = await persistFinalAssistantMessage({
            rootSessionID,
            taskIngress: { id: wakeID!, kind: "orchestrator_event" },
            text: `Settled queue loop for ${taskID}.`,
          })
          if (taskID === first.taskID) {
            events.push("source_completed")
            await terminalTask(
              requireTask(taskID),
              { status: "completed", time_completed: Date.now() },
              "Completion retry source finished",
            )
          } else {
            events.push("sibling_started")
          }
          return { finalMessageID }
        })
        using _failure = QueueTestHooks.failNextTaskLoopCompletionAdvances(1)

        expect(await dispatchTaskLoop({ taskID: first.taskID, event: { note: "Start completion retry source" } })).toBe(
          "started",
        )
        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        try {
          await gate.waitForIdle(["engine_queue_completion"])
          events.push("runtime_settled")
        } finally {
          gate[Symbol.dispose]()
        }

        const receipt = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, first.taskID),
                eq(EngineArtifactTable.kind, "task_loop_launch"),
              ),
            )
            .get(),
        )?.payload as { completion_receipt?: Record<string, unknown> }
        expect({ events, receipt: receipt.completion_receipt }).toEqual({
          events: ["source_completed", "sibling_started", "runtime_settled"],
          receipt: expect.objectContaining({
            status: "completed",
            disposition: "cwd_queue_observed",
            attempt: 2,
          }),
        })
      },
    })
  })

  test("persists a positive exact completion handoff before shutdown settlement crosses", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await createActiveTask({
          title: "Completion shutdown handoff",
          request: "Retain the exact completion receipt during runtime quiescence",
          queue: true,
        })
        configureTaskLoopRunner(async ({ taskID, wakeID }) => {
          const finalMessageID = await persistFinalAssistantMessage({
            rootSessionID: source.rootSessionID,
            taskIngress: { id: wakeID!, kind: "orchestrator_event" },
            text: "The source loop completed before runtime handoff.",
          })
          await terminalTask(
            requireTask(taskID),
            { status: "completed", time_completed: Date.now() },
            "Completion shutdown source finished",
          )
          return { finalMessageID }
        })
        using _failure = QueueTestHooks.failNextTaskLoopCompletionAdvances(1)

        expect(await dispatchTaskLoop({ taskID: source.taskID, event: { note: "Start shutdown handoff source" } })).toBe(
          "started",
        )
        const failureDeadline = Date.now() + 15_000
        while (QueueTestHooks.taskLoopCompletionAdvanceFailuresRemaining() > 0 && Date.now() < failureDeadline) {
          await Bun.sleep(10)
        }
        expect(QueueTestHooks.taskLoopCompletionAdvanceFailuresRemaining()).toBe(0)

        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        try {
          gate.closeAdmission(["engine_queue_completion"])
          gate.requestCancellation(["engine_queue_completion"], new Error("test runtime shutdown"))
          await gate.waitForIdle(["engine_queue_completion"])
          gate.commit()
        } finally {
          gate[Symbol.dispose]()
        }

        const receipt = Database.use((db) =>
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, source.taskID),
                eq(EngineArtifactTable.kind, "task_loop_launch"),
              ),
            )
            .get(),
        )?.payload as { completion_receipt?: Record<string, unknown> }
        expect(receipt.completion_receipt).toEqual(
          expect.objectContaining({
            status: "completed",
            disposition: "runtime_handoff",
            attempt: expect.any(Number),
          }),
        )
      },
    })
  })

  test("hands a pre-run rejected wake and persistently unaccepted launch to successor recovery", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await createActiveTask({
          title: "Pre-run completion handoff",
          request: "Keep one exact launch recoverable when root execution is destructively fenced",
          queue: true,
        })
        let runnerInvocations = 0
        configureTaskLoopRunner(async () => {
          runnerInvocations += 1
          throw new Error("The destructively fenced root wake must not enter the Task loop runner")
        })
        const destructiveScope = SessionPromptState.beginRootSessionDestructiveScope(source.rootSessionID, {
          actor: "runtime",
          source: "process.shutdown",
          surface: "engine.queue.test",
          requestID: "pre-run-completion-handoff",
          reason: "Reject the root wake before its Task loop starts",
          targetSessionID: source.rootSessionID,
          taskID: source.taskID,
        })
        using _failure = QueueTestHooks.failNextTaskLoopLaunchAcceptanceWrites(1_000_000)
        try {
          expect(
            await dispatchTaskLoop({ taskID: source.taskID, event: { note: "Start pre-run rejected source" } }),
          ).toBe("started")
          const launchDeadline = Date.now() + 3_000
          let launch:
            | { id: string; label: string; payload: { status?: string; wake_id?: string; handoff_attempt?: number } }
            | undefined
          while (Date.now() < launchDeadline) {
            launch = Database.use((db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, source.taskID),
                    eq(EngineArtifactTable.kind, "task_loop_launch"),
                  ),
                )
                .get(),
            ) as typeof launch
            if (launch) break
            await Bun.sleep(10)
          }
          expect(launch).toMatchObject({ id: expect.any(String), label: "pending" })

          const gate = RuntimeExecutionSettlement.acquireSettlementGate()
          try {
            gate.closeAdmission(["engine_queue_completion"])
            gate.requestCancellation(["engine_queue_completion"], new Error("test runtime shutdown"))
            await gate.waitForIdle(["engine_queue_completion"])
            gate.commit()
          } finally {
            gate[Symbol.dispose]()
          }

          const handedOff = Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, source.taskID),
                  eq(EngineArtifactTable.kind, "task_loop_launch"),
                ),
              )
              .get(),
          ) as typeof launch
          expect({ runnerInvocations, handedOff }).toMatchObject({
            runnerInvocations: 0,
            handedOff: {
              id: launch!.id,
              label: "pending",
              payload: {
                status: "runtime_handoff_pending",
                wake_id: expect.any(String),
                handoff_attempt: expect.any(Number),
              },
            },
          })

          destructiveScope.close()
          expect(await reconcileInterruptedTaskExecutions()).toBe(1)
          const recovered = Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, source.taskID),
                  eq(EngineArtifactTable.kind, "task_loop_launch"),
                ),
              )
              .get(),
          )
          expect({ recovered, taskStatus: deriveTaskStatus(requireTask(source.taskID)) }).toMatchObject({
            recovered: {
              id: launch!.id,
              label: "completed",
              payload: { status: "recovered_to_queue" },
            },
            taskStatus: "queued",
          })
        } finally {
          destructiveScope.close()
        }
      },
    })
  })

  test("recovers a drained exact wake after an abrupt launch-receipt gap without creating a replacement wake", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await createActiveTask({
          title: "Abrupt launch receipt gap",
          request: "Recover the exact drained wake without manufacturing another occurrence",
          queue: true,
        })
        configureTaskLoopRunner(async ({ wakeID }) => {
          const finalMessageID = await persistFinalAssistantMessage({
            rootSessionID: source.rootSessionID,
            taskIngress: { id: wakeID!, kind: "orchestrator_event" },
            text: "The exact launch wake completed before its launch receipt was accepted.",
          })
          const row = Database.use((db) =>
            db
              .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
              .from(MessageTable)
              .where(eq(MessageTable.id, finalMessageID))
              .get(),
          )!
          const assistant = Message.Assistant.parse({ ...row.data, id: finalMessageID, sessionID: row.sessionID })
          await Session.updateMessage({
            id: assistant.parentID,
            sessionID: assistant.sessionID,
            role: "user",
            author: "orchestrator",
            time: { created: assistant.time.created - 1 },
            agent: "orchestrator",
            model: { providerID: "test", modelID: "abrupt-launch-gap" },
          })
          await publishSettledSessionTerminalStatusInCurrentProject({
            session: await Session.get(assistant.sessionID),
            taskID: source.taskID,
            inputMessageID: assistant.parentID,
            status: { type: "terminal", reason: "completed" },
          })
          return { finalMessageID }
        })
        using _failure = QueueTestHooks.failNextTaskLoopLaunchAcceptanceWrites(1_000_000)

        expect(await dispatchTaskLoop({ taskID: source.taskID, event: { note: "Start exact abrupt wake" } })).toBe(
          "started",
        )
        const drainedDeadline = Date.now() + 10_000
        let exactWake:
          | { id: string; label: string; payload: ReturnType<typeof QueuedTaskIngressSchema.parse> }
          | undefined
        while (Date.now() < drainedDeadline) {
          const row = Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(
                and(
                  eq(EngineArtifactTable.task_id, source.taskID),
                  eq(EngineArtifactTable.kind, "queued_operator_wake"),
                ),
              )
              .get(),
          )
          if (row?.label === "drained") {
            exactWake = { ...row, payload: QueuedTaskIngressSchema.parse(row.payload) }
            break
          }
          await Bun.sleep(10)
        }
        expect(exactWake).toMatchObject({ id: expect.any(String), label: "drained" })
        const launchBeforeRestart = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, source.taskID),
                eq(EngineArtifactTable.kind, "task_loop_launch"),
              ),
            )
            .get(),
        ) as { id: string; label: string; payload: { wake_id?: string } }
        expect(launchBeforeRestart).toMatchObject({
          id: expect.any(String),
          label: "pending",
          payload: { wake_id: exactWake!.id },
        })

        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        try {
          gate.closeAdmission(["engine_queue_completion"])
          gate.requestCancellation(["engine_queue_completion"], new Error("simulate abrupt runtime replacement"))
          await gate.waitForIdle(["engine_queue_completion"])
          gate.commit()
        } finally {
          gate[Symbol.dispose]()
        }

        expect(await reconcileInterruptedTaskExecutions()).toBe(1)
        const launches = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, source.taskID),
                eq(EngineArtifactTable.kind, "task_loop_launch"),
              ),
            )
            .all(),
        )
        const wakes = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, source.taskID),
                eq(EngineArtifactTable.kind, "queued_operator_wake"),
              ),
            )
            .all(),
        )
        expect({ launches, wakes, taskStatus: deriveTaskStatus(requireTask(source.taskID)) }).toMatchObject({
          launches: [
            {
              id: launchBeforeRestart.id,
              label: "completed",
              payload: {
                status: "recovered_exact_wake_completion",
                wake_id: exactWake!.id,
                assistant_message_id: exactWake!.payload.delivery_result?.status === "completed"
                  ? exactWake!.payload.delivery_result.assistant_message_id
                  : undefined,
              },
            },
          ],
          wakes: [{ id: exactWake!.id, label: "drained" }],
          taskStatus: "active",
        })
      },
    })
  })

  test("hands a persistently failing Task loop launch receipt to shutdown and settles it for a terminal Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Task loop launch shutdown handoff",
          request: "Retain the exact launch receipt across runtime shutdown",
          queue: true,
        })
        configureTaskLoopRunner(async ({ wakeID }) => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            taskIngress: { id: wakeID!, kind: "orchestrator_event" },
            text: "The claimed Task loop is attached before shutdown.",
          }),
        }))
        using _failure = QueueTestHooks.failNextTaskLoopLaunchAcceptanceWrites(1_000_000)

        expect(await dispatchTaskLoop({ taskID, event: { note: "Start before shutdown" } })).toBe("started")
        const attemptsBefore = QueueTestHooks.taskLoopLaunchAcceptanceAttempts()
        await Bun.sleep(140)
        const attemptsDuringFailure = QueueTestHooks.taskLoopLaunchAcceptanceAttempts() - attemptsBefore
        const gate = RuntimeExecutionSettlement.acquireSettlementGate()
        gate.closeAdmission(["engine_queue_completion"])
        gate.requestCancellation(["engine_queue_completion"], new Error("test runtime shutdown"))
        await gate.waitForIdle(["engine_queue_completion"])
        expect(attemptsDuringFailure).toBeGreaterThanOrEqual(2)
        expect(attemptsDuringFailure).toBeLessThanOrEqual(5)
        expect(QueueTestHooks.taskLoopLaunchAcceptanceAttempts()).toBe(attemptsBefore + attemptsDuringFailure)
        gate.commit()
        gate[Symbol.dispose]()

        const pending = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_loop_launch")))
            .get(),
        )!
        expect(pending).toMatchObject({ id: expect.any(String), label: "pending" })

        await terminalTask(
          requireTask(taskID),
          { status: "failed", error: "Injected terminal state after shutdown retained the launch receipt" },
          "Terminalized retained Task loop launch receipt",
        )
        expect(await reconcileInterruptedTaskExecutions()).toBe(1)
        expect(
          Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_loop_launch")))
              .all(),
          ),
        ).toEqual([
          {
            id: pending.id,
            label: "completed",
            payload: expect.objectContaining({ status: "terminal_inapplicable", terminal_status: "failed" }),
          },
        ])
      },
    })
  }, 60_000)

  test("requeues a prior-process running ingress for an ordinary terminal Task and drains its original occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
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
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_completed: Date.now() },
          "Task completed before the host restarted its running ingress",
        )

        expect(await requeueInterruptedRunningTaskIngresses()).toBe(1)
        expect(await dispatchPersistedTaskLoop(taskID)).toBe("started")
        await waitForQueueCompletionHooksForTest()
        expect(
          Database.use((db) =>
            db
              .select({
                id: EngineArtifactTable.id,
                label: EngineArtifactTable.label,
                payload: EngineArtifactTable.payload,
              })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, artifactID))
              .get(),
          ),
        ).toMatchObject({
          id: artifactID,
          label: "drained",
          payload: {
            wake_id: payload.wake_id,
            delivery_result: { status: "terminal_inapplicable" },
          },
        })
      },
    })
  })

  test("terminal conversation reads the exact operator message and persisted Task evidence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Terminal follow-up evidence",
          request: "Answer one exact terminal follow-up from its recorded message",
        })
        await EngineService.cancelTask(taskID, {
          origin: {
            actor: "user",
            source: "task.cancel",
            surface: "api",
            requestID: "terminal-follow-up-evidence-cancel",
            reason: "establish a terminal occurrence for the conversation",
          },
        })
        const messageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Which exact terminal occurrence ended this Task?",
        })
        createDecisionLog(taskID).append({
          phase: "operator_follow_up",
          key: "terminal_occurrence",
          value: "The exact cancellation occurrence remains the terminal authority.",
          reason: "Answer the operator from persisted Task evidence.",
        })
        const ingress = QueuedTaskIngressSchema.parse({
          wake_id: "art_terminal_follow_up_evidence",
          delivery_attempt: 1,
          task_id: taskID,
          root_session_id: rootSessionID,
          time_queued: Date.now(),
          queued_by_process_id: process.pid,
          source_kind: "operator_message",
          message_id: messageID,
          event: { rootMessage: { messageID, kind: "operator" } },
        })
        if (ingress.source_kind !== "operator_message") throw new Error("expected operator-message ingress")
        const authority = createTerminalConversationAuthority({
          taskID,
          ingressID: ingress.wake_id,
          ingress,
        })
        const { tools } = createOrchestratorTools({
          taskID,
          agentSessionID: rootSessionID,
          dispatchAgents: [
            {
              identity: {
                agentID: "base-developer",
                baseRole: "build",
                sessionKind: "build",
                dispatchAdapterID: "build",
                runtimeTemplateABIVersion: 1,
                dispatchAdapterABIVersion: 1,
                projectionHash: "b".repeat(64),
              },
              packageRevision,
              virtualWorkflows: {},
              capabilityOwner: "platform",
              label: "terminal-read-test",
              builtInToolIDs: [],
              projectedToolIDs: [],
            } as never,
          ],
          rootMessage: ingress.event.rootMessage,
          terminalConversationAuthority: authority,
        })
        const read = tools.read_task_message as {
          execute?: (args: { message_id: string; reason: string }, options: unknown) => Promise<unknown>
        }
        const readContext = tools.read_context as {
          execute?: (args: { scope: "decisions" }, options: unknown) => Promise<unknown>
        }
        const artifactSearch = tools.artifact_search as {
          execute?: (args: Record<string, never>, options: unknown) => Promise<{ output: string }>
        }
        if (!read.execute) throw new Error("read_task_message execution is unavailable")
        if (!readContext.execute) throw new Error("read_context execution is unavailable")
        if (!artifactSearch.execute) throw new Error("artifact_search execution is unavailable")

        const result = await read.execute({ message_id: messageID, reason: "Answer the exact terminal follow-up." }, {})
        const decisionContext = await readContext.execute({ scope: "decisions" }, {})
        const catalog = await artifactSearch.execute(
          {},
          {
            toolCallId: "terminal-artifact-search",
            messages: [],
            abortSignal: new AbortController().signal,
            opencorvus: { sessionID: rootSessionID },
          },
        )

        expect(result).toContain(`Task-root message ${messageID} (operator) is already recorded`)
        expect(result).toContain("Which exact terminal occurrence ended this Task?")
        expect(decisionContext).toContain("terminal_occurrence")
        expect(decisionContext).toContain("The exact cancellation occurrence remains the terminal authority.")
        expect(JSON.parse(catalog.output)).toMatchObject({ catalog_complete: true })
      },
    })
  })

  test("requeues a valid durable ingress while reporting a malformed peer item", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const malformedTask = await createActiveTask({
          title: "Malformed recovery peer",
          request: "Keep the independent valid recovery item progressing",
        })
        const validTask = await createActiveTask({
          title: "Valid recovery peer",
          request: "Recover this durable ingress despite another bad item",
        })
        const persistRunningIngress = (taskID: string) => {
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
          updateEngineArtifact({
            id: artifactID,
            label: "running",
            payload: { ...QueuedTaskIngressSchema.parse(row?.payload), queued_by_process_id: process.pid + 10_000 },
          })
          return artifactID
        }
        const malformedID = persistRunningIngress(malformedTask.taskID)
        const validID = persistRunningIngress(validTask.taskID)
        const queuePosition = spyOn(SessionPromptState, "rootWakeQueuePosition").mockImplementation(
          (rootSessionID, wakeID) => {
            if (wakeID === malformedID) throw new Error("injected malformed peer recovery failure")
            return undefined
          },
        )
        try {
          await expect(requeueInterruptedRunningTaskIngresses()).rejects.toBeInstanceOf(AggregateError)
        } finally {
          queuePosition.mockRestore()
        }
        expect(
          Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, validID))
              .get(),
          ),
        ).toEqual({ id: validID, label: "pending" })
      },
    })
  })

  test("reconciles a committed active assistant result before requeueing its running ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Active ingress crash reconciliation",
          request: "Reuse the exact committed assistant result after restart",
        })
        const artifactID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          }),
        )
        const assistantMessageID = await persistFinalAssistantMessage({
          rootSessionID,
          taskIngress: { id: artifactID, kind: "operator_intent" },
          text: "The exact active ingress has a durable assistant result.",
        })
        updateEngineArtifact({ id: artifactID, label: "running" })

        expect(await requeueInterruptedRunningTaskIngresses()).toBe(0)
        expect(
          Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, artifactID))
              .get(),
          ),
        ).toMatchObject({
          label: "drained",
          payload: {
            delivery_result: { status: "completed", assistant_message_id: assistantMessageID },
          },
        })
      },
    })
  })

  test("reuses one coordination ingress identity after a typed delivery failure", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Coordination ingress identity",
          request: "Keep one durable occurrence for one coordination request",
        })
        const requestID = "coordination-request:stable-identity"
        const firstID = Database.transaction((db) =>
          persistQueuedCoordinationWakeInTransaction(db, { taskID, rootSessionID, requestID }),
        )
        const first = Database.use((db) =>
          db.select({ payload: EngineArtifactTable.payload }).from(EngineArtifactTable).where(eq(EngineArtifactTable.id, firstID)).get(),
        )
        updateEngineArtifact({
          id: firstID,
          label: "delivery_failed",
          payload: QueuedTaskIngressSchema.parse({
            ...QueuedTaskIngressSchema.parse(first?.payload),
            delivery_result: {
              status: "delivery_failed",
              error_name: "InjectedDeliveryError",
              message: "Retry the same durable occurrence",
              time_completed: Date.now(),
            },
          }),
        })

        const retryID = Database.transaction((db) =>
          persistQueuedCoordinationWakeInTransaction(db, { taskID, rootSessionID, requestID }),
        )
        const rows = Database.use((db) =>
          db
            .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "queued_operator_wake"),
                sql`json_extract(${EngineArtifactTable.payload}, '$.request_id') = ${requestID}`,
              ),
            )
            .all(),
        )
        expect({ firstID, retryID, rows }).toMatchObject({
          firstID,
          retryID: firstID,
          rows: [{ id: firstID, label: "pending", payload: { delivery_attempt: 2, wake_id: requestID } }],
        })
      },
    })
  })

  test("persists a historical terminal occurrence without replacing the live Session occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Historical lifecycle publication",
          request: "Keep the live occurrence authoritative while recovery publishes history",
        })
        const historicalInput = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: rootSessionID,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "historical-lifecycle" },
        })
        const liveInput = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: rootSessionID,
          role: "user",
          author: "user",
          time: { created: Date.now() + 1 },
          agent: "orchestrator",
          model: { providerID: "test", modelID: "live-lifecycle" },
        })
        const liveOwner = new AbortController()
        SessionStatus.beginExecutionOccurrence(rootSessionID, liveInput.id, liveOwner.signal)
        await SessionStatus.set(rootSessionID, { type: "streaming" }, { publish: false, inputMessageID: liveInput.id })

        await publishSettledSessionTerminalStatusInCurrentProject({
          session: await Session.get(rootSessionID),
          taskID,
          inputMessageID: historicalInput.id,
          status: { type: "terminal", reason: "completed" },
        })

        expect({
          occurrence: SessionStatus.executionOccurrence(rootSessionID),
          live: SessionStatus.getExecution(rootSessionID, liveInput.id),
        }).toEqual({
          occurrence: { inputMessageID: liveInput.id, owner: liveOwner.signal },
          live: { type: "streaming" },
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator status wake test expected a rootMessage event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
          deliveryStatus: "completed",
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
          deliveryStatus: "completed",
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
          deliveryStatus: "completed",
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
                }),
              ],
            },
          ],
        })
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const messageID = event?.rootMessage?.messageID
          if (!messageID) throw new Error("operator wake test expected a rootMessage event")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              sessionID: session.id,
              parentID,
              taskIngress: { id: wakeID!, kind: "operator_message" },
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
          deliveryStatus: "completed",
          sourceKind: "operator_message",
        })
      },
    })
  })

  test("drains the exact operator intent from its assistant receipt without requiring a named retrieval tool", async () => {
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
        configureTaskLoopRunner(async ({ wakeID }) => ({
          finalMessageID: await persistFinalAssistantMessage({
            rootSessionID,
            taskIngress: { id: wakeID!, kind: "operator_intent" },
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
          sourceKind: wake.payload.source_kind,
        }).toEqual({
          label: "drained",
          deliveryStatus: "completed",
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          const [messageID] = event?.taskIntent?.supersededOperatorMessageIDs ?? []
          if (!messageID) throw new Error("operator intent test expected a superseded operator message")
          return {
            finalMessageID: await persistAssistantInvocation({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "operator_intent" },
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
          deliveryStatus: "completed",
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
        configureTaskLoopRunner(async ({ event, wakeID }) => {
          if (!event?.taskWaitWake?.jobID) throw new Error("task wait test expected a taskWaitWake event")
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID!, kind: "task_wait_wake" },
              text: "Observed the scheduled wait wake and dispatched the continuation.",
              parts: (sessionID, finalMessageID) => [
                completedToolPart({
                  sessionID,
                  messageID: finalMessageID,
                  callID: "call_dispatch_wait_continuation",
                  tool: "dispatch_agent",
                  stateInput: { dispatch: { target: "base-developer" } },
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
          deliveryStatus: "completed",
          sourceKind: "task_wait_wake",
        })
      },
    })
  })
})
