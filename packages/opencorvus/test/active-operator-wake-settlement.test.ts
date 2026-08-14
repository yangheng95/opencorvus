import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { unlink } from "node:fs/promises"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import {
  configureTaskLoopRunner as configureEngineTaskLoopRunner,
  dispatchTaskLoop,
  dispatchPersistedTaskLoop,
  persistQueuedCoordinationWakeInTransaction,
  persistQueuedRootMessageWakeInTransaction,
  persistQueuedTaskIntentInTransaction,
  persistQueuedTaskWaitWakeInTransaction,
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
  EngineTaskTable,
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
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { EffectiveConfig } from "@/config/effective"
import { Identifier } from "@/id/id"
import { taskWaitFireID } from "@/scheduler/task-wait-fire-identity"
import { Orchestrator } from "@/orchestrator/agent"
import { orchestratorControlOccurrenceIdentity } from "@/orchestrator/control-message-identity"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { createTerminalConversationAuthority } from "@/orchestrator/terminal-conversation-authority"
import { createOrchestratorTools } from "@/orchestrator/tools"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { publishSettledSessionTerminalStatusInCurrentProject } from "@/session/status-publication"
import { SessionPromptState } from "@/session/prompt/state"
import { Message } from "@/session/message"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { SessionProcessor } from "@/session/processor"
import { MessageTable } from "@/session/session.sql"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { EngineService, TaskCancellationConvergenceTestHooks } from "@/task-api"
import { ChannelIngress } from "@/channel/ingress"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { ExecutionCancellationError, createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.09.1",
  packageDigest: "a".repeat(64),
}

type TestTaskLoopRunner = Parameters<typeof configureEngineTaskLoopRunner>[0]
const testTaskLoopRunners = new Map<string, TestTaskLoopRunner>()

function testInstanceKey(directory: string): string {
  return process.platform === "win32" ? directory.toLowerCase() : directory
}

function configureTaskLoopRunner(runner: TestTaskLoopRunner): void {
  testTaskLoopRunners.set(testInstanceKey(Instance.directory), runner)
  configureEngineTaskLoopRunner(runner)
}

async function provideTestInstance<R>(input: { directory: string; fn: () => R }): Promise<Awaited<R>> {
  const key = testInstanceKey(input.directory)
  using runnerOverride = QueueTestHooks.replaceTaskLoopRunner({
    directory: input.directory,
    runner: async (args) => {
      const runner = testTaskLoopRunners.get(key)
      if (!runner) throw new Error(`Active operator wake test runner is not configured for ${input.directory}`)
      return runner(args)
    },
  })
  try {
    return await Instance.provide({ directory: input.directory, init: InstanceBootstrap, fn: input.fn })
  } finally {
    testTaskLoopRunners.delete(key)
  }
}

function orchestratorProviderModel(): ProviderType.Model {
  return {
    id: "scheduler-settlement-test",
    providerID: "test",
    name: "Scheduler settlement test",
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
    api: { id: "scheduler-settlement-test", url: "https://scheduler.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-12",
  } as ProviderType.Model
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

async function createActiveTask(input: {
  title: string
  request: string
  packageRevision?: typeof packageRevision
  metadata?: Record<string, unknown>
}) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({
    kind: "root",
    title: input.title,
    metadata: { configOverlay: { model: "openai/gpt-5.6-sol" } },
  })
  const now = Date.now()
  const taskPackageRevision = input.packageRevision ?? packageRevision
  persistTask({
    taskID,
    sessionID: root.id,
    now,
    title: input.title,
    request: input.request,
    productPillar: "code",
    source: "test",
    priority: "normal",
    metadata: input.metadata ?? { actor: "user" },
    projectID: Instance.project.id,
    packageRevision: taskPackageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: taskPackageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return { taskID, rootSessionID: root.id }
}

function findQueuedWake(wakeID: string) {
  return Database.use((db) =>
    db
      .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.id, wakeID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
      .get(),
  )
}

async function waitForCancelledCheckpoint(taskID: string) {
  const settlementDeadline = Date.now() + 60_000
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
  const exactControlParent =
    input.taskIngress &&
    ["agent_lifecycle_delivery", "dispatch_infrastructure_failure"].includes(input.taskIngress.kind)
      ? orchestratorControlOccurrenceIdentity(input.taskIngress.id).messageID
      : undefined
  if (exactControlParent) {
    await Session.persistMessage({
      info: {
        id: exactControlParent,
        sessionID: session.id,
        role: "user",
        author: "orchestrator",
        time: { created: now },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "settlement-runner" },
      },
      parts: [completedTextPart({ sessionID: session.id, messageID: exactControlParent, text: "Exact control" })],
    })
  }
  const messageID = Identifier.ascending("message")
  const info: Message.Assistant = {
    id: messageID,
    sessionID: session.id,
    parentID: exactControlParent ?? Identifier.ascending("message"),
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
      fireID: taskWaitFireID(input.jobID),
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

describe.serial("active operator wake settlement", () => {
  test("preserves typed cancellation authority before task-loop failure normalization", () => {
    const requestID = "req_typed_task_loop_cancellation"
    const cancellation = new ExecutionCancellationError({
      source: "session_prompt",
      message: "Cancel the exact Task loop occurrence",
      origin: createExecutionCancellationOrigin({
        actor: "runtime",
        source: "process.shutdown",
        surface: "engine.queue.test",
        requestID,
        reason: "Test exact typed cancellation classification",
      }),
    })

    expect(QueueTestHooks.taskLoopExitProjection(cancellation)).toEqual({
      kind: "cancelled",
      source: "process.shutdown",
      requestID,
    })
  })
  test("joins duplicate cancellation calls and commits one terminal cancellation before checkpoint settlement", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
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
    await provideTestInstance({
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
      await provideTestInstance({
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
    await provideTestInstance({
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

  test("converges existing and later infrastructure wakes under one durable cancellation authority", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID } = await createActiveTask({
          title: "Cancellation ingress authority",
          request: "Make every queued and later infrastructure ingress terminal under one cancellation request",
        })
        const existingWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          }),
        )
        expect(QueueTestHooks.startQueuedWake(existingWakeID)).toBe(true)
        const infrastructureFactID = "art_cancellation_infrastructure_fact"
        let ingressAtCancellation:
          | {
              result: Awaited<ReturnType<typeof dispatchTaskLoop>>
              taskStatus: string
              existing: ReturnType<typeof findQueuedWake>
              infrastructure: ReturnType<typeof findQueuedWake>
            }
          | undefined
        using _lateStage = TaskCancellationConvergenceTestHooks.installBeforeLateStage(async () => {
          const result = await dispatchTaskLoop({
            taskID,
            event: {
              dispatchInfrastructureFailure: {
                infrastructureFactID,
                outcome: {
                  kind: "infrastructure_failure",
                  operation: "execute-detached-worker",
                  message: "The worker aborted while Task cancellation was converging",
                  error_name: "ExecutionCancellationError",
                  recovery_authority: { occurrence_status: "occurrence_not_committed" },
                  infrastructure_error: {
                    source: "engine_artifact",
                    artifact_id: infrastructureFactID,
                    catalog_revision: 1,
                    expected_sha256: "c".repeat(64),
                  },
                },
              },
            },
          })
          const infrastructureWakeID = Database.use(
            (db) =>
              db
                .select({ id: EngineArtifactTable.id })
                .from(EngineArtifactTable)
                .where(
                  and(
                    eq(EngineArtifactTable.task_id, taskID),
                    eq(EngineArtifactTable.kind, "queued_operator_wake"),
                    sql`json_extract(${EngineArtifactTable.payload}, '$.infrastructure_fact_id') = ${infrastructureFactID}`,
                  ),
                )
                .get()?.id,
          )
          if (!infrastructureWakeID) throw new Error("Cancellation infrastructure ingress was not persisted")
          const existingWake = findQueuedWake(existingWakeID)
          const infrastructureWake = findQueuedWake(infrastructureWakeID)
          ingressAtCancellation = {
            result,
            taskStatus: deriveTaskStatus(requireTask(taskID)),
            existing: existingWake && {
              ...existingWake,
              payload: QueuedTaskIngressSchema.parse(existingWake.payload),
            },
            infrastructure: infrastructureWake && {
              ...infrastructureWake,
              payload: QueuedTaskIngressSchema.parse(infrastructureWake.payload),
            },
          }
        })

        expect(
          await EngineService.cancelTask(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: "overlay.work_ledger",
              requestID: "cancel-infrastructure-resurrection",
              reason: "Stop this Task and converge every accepted ingress",
            },
          }),
        ).toBe(true)

        expect(ingressAtCancellation).toMatchObject({
          result: "ignored",
          taskStatus: "active",
          existing: {
            label: "terminal_inapplicable",
            payload: {
              delivery_attempt: 1,
              delivery_runtime_attempt: 1,
              delivery_result: { status: "terminal_inapplicable" },
            },
          },
          infrastructure: {
            label: "terminal_inapplicable",
            payload: {
              source_kind: "dispatch_infrastructure_failure",
              infrastructure_fact_id: infrastructureFactID,
              delivery_attempt: 1,
              delivery_runtime_attempt: 1,
              delivery_result: { status: "terminal_inapplicable" },
            },
          },
        })
        QueueTestHooks.completeQueuedWake(existingWakeID, Identifier.ascending("message"))
        const afterLateCompletion = findQueuedWake(existingWakeID)
        expect(
          afterLateCompletion && {
            label: afterLateCompletion.label,
            payload: QueuedTaskIngressSchema.parse(afterLateCompletion.payload),
          },
        ).toMatchObject({
          label: "terminal_inapplicable",
          payload: {
            delivery_attempt: 1,
            delivery_runtime_attempt: 1,
            delivery_result: {
              status: "terminal_inapplicable",
              reason: expect.stringContaining("Task cancellation"),
            },
          },
        })
        expect(deriveTaskStatus(requireTask(taskID))).toBe("cancelled")
        await waitForCancelledCheckpoint(taskID)
      },
    })
  }, 0)

  test("preserves a cancelled Task terminal conversation through an idempotent cancellation call", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Cancelled Task terminal conversation",
          request: "Keep one terminal follow-up deliverable after duplicate cancellation",
        })
        const origin = {
          actor: "user" as const,
          source: "task.cancel" as const,
          surface: "api",
          requestID: "cancel-before-terminal-conversation",
          reason: "Establish the exact terminal cancellation",
        }
        expect(await EngineService.cancelTask(taskID, { origin })).toBe(true)
        const messageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Report the cancellation receipt.",
        })
        const wakeID = Database.transaction((db) =>
          persistQueuedRootMessageWakeInTransaction(db, {
            task: requireTask(taskID),
            messageID,
            kind: "operator",
            now: Date.now(),
          }),
        )

        expect(await EngineService.cancelTask(taskID, { origin })).toBe(true)
        expect(QueueTestHooks.startQueuedWake(wakeID)).toBe(true)
        const assistantMessageID = Identifier.ascending("message")
        QueueTestHooks.completeQueuedWake(wakeID, assistantMessageID)

        const requests = ProtocolStore.listTaskEvents(taskID).filter(
          (event) => event.type === TASK_CANCELLATION_REQUESTED_EVENT_TYPE,
        )
        const settled = findQueuedWake(wakeID)
        expect({
          taskStatus: deriveTaskStatus(requireTask(taskID)),
          requestIDs: requests.map((event) => event.id),
          wake: settled && {
            label: settled.label,
            payload: QueuedTaskIngressSchema.parse(settled.payload),
          },
        }).toMatchObject({
          taskStatus: "cancelled",
          requestIDs: [expect.any(String)],
          wake: {
            label: "drained",
            payload: {
              source_kind: "operator_message",
              message_id: messageID,
              delivery_result: {
                status: "completed",
                assistant_message_id: assistantMessageID,
              },
            },
          },
        })
        await waitForCancelledCheckpoint(taskID)
      },
    })
  }, 0)

  test("commits channel binding release with cancellation and routes the same thread to a new Task", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const route = {
          platform: "test",
          channel: `cancel-route-${Identifier.uuid4First8()}`,
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
        await waitForCancelledCheckpoint(first.taskID)

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
      },
    })
  }, 0)

  test("retries the same post-terminal auxiliary settlement after a runtime gate rollback", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
    await provideTestInstance({
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

    await provideTestInstance({
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

    await provideTestInstance({
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

    await provideTestInstance({
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
    await provideTestInstance({
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

    await provideTestInstance({
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
            { kind: "task_checkpoint_settlement", label: "completed" },
          ],
        })
      },
    })
  }, 0)

  test("holds runtime shutdown admission until an in-flight mandatory spawn is tracked and stopped", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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

  test("delivers one lifecycle occurrence once when the same event is accepted concurrently", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
        const lifecycleRows = rows.filter(
          (row) =>
            QueuedTaskIngressSchema.parse(row.payload).lifecycle_event_id === event.agentLifecycleDelivery.eventID,
        )
        expect({
          invocations,
          occurrences: lifecycleRows.length,
          label: lifecycleRows[0]?.label,
        }).toEqual({ invocations: 1, occurrences: 1, label: "drained" })
      },
    })
  })

  test("records a typed delivery failure when lifecycle ingress has no assistant settlement", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "queued_operator_wake"),
                sql`json_extract(${EngineArtifactTable.payload}, '$.lifecycle_event_id') = ${event.agentLifecycleDelivery.eventID}`,
              ),
            )
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
    await provideTestInstance({
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
          (row) =>
            QueuedTaskIngressSchema.parse(row.payload).lifecycle_event_id === event.agentLifecycleDelivery.eventID,
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
    await provideTestInstance({
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

  test("retries the exact exhausted terminal Task ingress in the same runtime", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
        await waitForCancelledCheckpoint(taskID)
        let attempts = 0
        const attemptedIngresses: string[] = []
        const terminalConversation = spyOn(Orchestrator, "processTerminalConversation").mockImplementation(
          async (input) => {
            attempts += 1
            attemptedIngresses.push(input.authority.ingressID)
            if (attempts <= 4) throw new Error(`injected terminal conversation delivery failure ${attempts}`)
            return await persistFinalAssistantMessage({
              rootSessionID,
              text: "Recovered the exact terminal conversation ingress.",
            })
          },
        )
        using _runtime = QueueTestHooks.replaceTerminalIngressDeliveryRuntime("same-terminal-retry-runtime")
        const initialRetryDelay = QueueTestHooks.replaceTerminalIngressDelayedRetryDelay(5_000)
        try {
          const accepted = await EngineService.handleTaskMessage(taskID, {
            text: "Explain the terminal result through this exact ingress.",
            source: "operator.test",
          })
          expect(accepted.wake_status).toBe("accepted")
          let exhausted: { id: string; label: string; payload: unknown } | undefined
          const deadline = Date.now() + 5_000
          while (Date.now() < deadline) {
            exhausted = Database.use((db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, accepted.ingress_id!))
                .get(),
            )
            if (exhausted?.label === "delivery_failed") break
            await Bun.sleep(10)
          }
          if (!exhausted) throw new Error("Exact terminal ingress was not persisted")
          expect({
            attempts,
            id: exhausted?.id,
            label: exhausted.label,
            ingress: QueuedTaskIngressSchema.parse(exhausted.payload),
          }).toMatchObject({
            attempts: 2,
            id: accepted.ingress_id,
            label: "delivery_failed",
            ingress: {
              delivery_attempt: 2,
              delivery_runtime_id: "same-terminal-retry-runtime",
              delivery_runtime_attempt: 2,
            },
          })
          const younger = await EngineService.handleTaskMessage(taskID, {
            text: "This later terminal ingress must remain behind the failed durable head.",
            source: "operator.test",
          })
          expect(younger.wake_status).toBe("queued")
          const youngerWhileBlocked = Database.use((db) =>
            db
              .select({ label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, younger.ingress_id!))
              .get(),
          )
          expect({ attempts, attemptedIngresses, youngerLabel: youngerWhileBlocked?.label }).toEqual({
            attempts: 2,
            attemptedIngresses: [accepted.ingress_id, accepted.ingress_id],
            youngerLabel: "pending",
          })
          initialRetryDelay[Symbol.dispose]()
          using _fastRetryDelay = QueueTestHooks.replaceTerminalIngressDelayedRetryDelay(10)
          let row: { id: string; label: string; payload: unknown } | undefined
          const recoveryDeadline = Date.now() + 10_000
          while (Date.now() < recoveryDeadline) {
            row = Database.use((db) =>
              db
                .select({
                  id: EngineArtifactTable.id,
                  label: EngineArtifactTable.label,
                  payload: EngineArtifactTable.payload,
                })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, accepted.ingress_id!))
                .get(),
            )
            if (row?.label === "drained") break
            await Bun.sleep(10)
          }
          if (!row) throw new Error("Exact terminal ingress disappeared during delayed retry")
          expect({
            attempts,
            id: row.id,
            label: row.label,
            ingress: QueuedTaskIngressSchema.parse(row.payload),
          }).toMatchObject({
            attempts: 6,
            id: accepted.ingress_id,
            label: "drained",
            ingress: {
              delivery_attempt: 5,
              delivery_runtime_id: "same-terminal-retry-runtime",
              delivery_runtime_attempt: 1,
            },
          })
          const youngerDeadline = Date.now() + 5_000
          let youngerLabel: string | undefined
          while (Date.now() < youngerDeadline) {
            youngerLabel = Database.use((db) =>
              db
                .select({ label: EngineArtifactTable.label })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.id, younger.ingress_id!))
                .get(),
            )?.label
            if (youngerLabel === "drained") break
            await Bun.sleep(10)
          }
          expect({ youngerLabel, attemptedIngresses }).toEqual({
            youngerLabel: "drained",
            attemptedIngresses: [
              accepted.ingress_id,
              accepted.ingress_id,
              accepted.ingress_id,
              accepted.ingress_id,
              accepted.ingress_id,
              younger.ingress_id,
            ],
          })
        } finally {
          initialRetryDelay[Symbol.dispose]()
          terminalConversation.mockRestore()
        }
      },
    })
  }, 120_000)

  test("converges a historical non-tail failed ingress into one visible recovery occurrence", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Historical wake provenance convergence",
          request: "Preserve the failed historical input and continue from one recovery fact",
        })
        const orchestrator = await Session.create({
          kind: "orchestrator",
          parentID: rootSessionID,
          title: "Orchestrator history",
        })
        const wakeID = "art_historical_non_tail_wake"
        const controlMessageID = orchestratorControlOccurrenceIdentity(wakeID).messageID
        const newerMessageID = Identifier.ascending("message")
        for (const [messageID, text] of [
          [controlMessageID, "Historical exact control"],
          [newerMessageID, "Younger exact control"],
        ] as const) {
          await Session.persistMessage({
            info: {
              id: messageID,
              sessionID: orchestrator.id,
              role: "user",
              author: "orchestrator",
              time: { created: Date.now() },
              agent: "orchestrator",
              model: { providerID: "openai", modelID: "gpt-5.6-sol" },
            },
            parts: [completedTextPart({ sessionID: orchestrator.id, messageID, text })],
          })
        }
        const now = Date.now()
        recordEngineArtifact({
          id: wakeID,
          taskID,
          kind: "queued_operator_wake",
          label: "delivery_failed",
          payload: QueuedTaskIngressSchema.parse({
            wake_id: wakeID,
            task_id: taskID,
            root_session_id: rootSessionID,
            task_occurrence_started_at: Database.use(
              (db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!.time_started,
            ),
            source_kind: "agent_lifecycle_delivery",
            lifecycle_event_id: "evt_historical_terminal_lifecycle",
            event: {
              agentLifecycleDelivery: {
                eventID: "evt_historical_terminal_lifecycle",
                sessionID: "ses_historical_worker",
                dispatchID: "dsp_historical_worker",
              },
            },
            delivery_attempt: 2,
            delivery_runtime_id: "historical-runtime",
            delivery_runtime_attempt: 2,
            time_queued: now,
            queued_by_process_id: process.pid,
            delivery_result: {
              status: "delivery_failed",
              error_name: "QueuedWakeSettlementError",
              message: "historical assistant/control provenance conflict",
              time_completed: now,
            },
          }),
          timeCreated: now,
        })

        expect(QueueTestHooks.reconcileHistoricalNonTailFailedIngress(taskID, wakeID)).toBe(true)
        expect(QueueTestHooks.reconcileHistoricalNonTailFailedIngress(taskID, wakeID)).toBe(false)
        const artifacts = Database.use((db) =>
          db
            .select({
              id: EngineArtifactTable.id,
              kind: EngineArtifactTable.kind,
              label: EngineArtifactTable.label,
              payload: EngineArtifactTable.payload,
            })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.task_id, taskID))
            .all(),
        )
        expect(artifacts.find((artifact) => artifact.id === wakeID)).toMatchObject({
          label: "terminal_inapplicable",
          payload: {
            delivery_result: {
              status: "terminal_inapplicable",
              reason: expect.stringContaining(newerMessageID),
            },
          },
        })
        const recoveryFacts = artifacts.filter(
          (artifact) =>
            artifact.kind === "task-infrastructure-error" &&
            (artifact.payload as { operation?: string }).operation === "reconcile-historical-wake-provenance-conflict",
        )
        const recoveryWakes = artifacts.filter(
          (artifact) =>
            artifact.kind === "queued_operator_wake" &&
            (artifact.payload as { source_kind?: string }).source_kind === "infrastructure_recovery",
        )
        expect({ recoveryFacts: recoveryFacts.length, recoveryWakes: recoveryWakes.length }).toEqual({
          recoveryFacts: 1,
          recoveryWakes: 1,
        })
      },
    })
  })

  test("requeues a prior-process running ingress for an ordinary terminal Task and drains its original occurrence", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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

  test("restores the prior runtime FIFO head before interrupted execution recovery appends new wakes", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Interrupted FIFO head ordering",
          request: "Deliver both accepted operator messages in their original order across recovery",
        })
        await Session.create({
          kind: "build",
          parentID: rootSessionID,
          title: "Ownerless created worker before backend restart",
        })
        const firstMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Recovery message one must remain first.",
        })
        const secondMessageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Recovery message two must remain second.",
        })
        const [firstWakeID, secondWakeID] = Database.transaction((db) => {
          const task = requireTask(taskID)
          return [
            persistQueuedRootMessageWakeInTransaction(db, {
              task,
              messageID: firstMessageID,
              kind: "operator",
              now: Date.now(),
            }),
            persistQueuedRootMessageWakeInTransaction(db, {
              task,
              messageID: secondMessageID,
              kind: "operator",
              now: Date.now() + 1,
            }),
          ]
        })
        updateEngineArtifact({ id: firstWakeID, label: "running" })

        const delivered: string[] = []
        configureTaskLoopRunner(async ({ wakeID }) => {
          const row = Database.use((db) =>
            db
              .select({ payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, wakeID!))
              .get(),
          )
          const ingress = QueuedTaskIngressSchema.parse(row?.payload)
          delivered.push(wakeID!)
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              parentID: ingress.message_id,
              taskIngress: { id: wakeID!, kind: ingress.source_kind },
              text: `Delivered ${wakeID}`,
            }),
          }
        })

        expect(await requeueInterruptedRunningTaskIngresses()).toBe(1)
        expect(await reconcileInterruptedTaskExecutions()).toBe(1)
        await waitForQueueCompletionHooksForTest()

        expect(delivered.slice(0, 2)).toEqual([firstWakeID, secondWakeID])
        expect(
          Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
              .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
              .all(),
          ).filter((row) => row.id === firstWakeID || row.id === secondWakeID),
        ).toEqual([
          { id: firstWakeID, label: "drained" },
          { id: secondWakeID, label: "drained" },
        ])
      },
    })
  })

  test("settles a delivery-failed root Turn through its pending cancellation occurrence", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Interrupted cancellation root Turn",
          request: "Recover the accepted root Turn before converging its durable cancellation",
        })
        const messageID = await persistOperatorRootMessage({
          taskID,
          rootSessionID,
          text: "Report current work before the accepted cancellation settles.",
        })
        const wakeID = Database.transaction((db) =>
          persistQueuedRootMessageWakeInTransaction(db, {
            task: requireTask(taskID),
            messageID,
            kind: "operator",
            now: Date.now(),
          }),
        )
        updateEngineArtifact({ id: wakeID, label: "delivery_failed" })
        const requested = await EngineProtocol.emit(
          Event.TaskCancellationRequested,
          {
            taskID,
            actor: "user",
            surface: "api",
            reason: "restart cancellation convergence",
            summary: "Cancellation requested before backend restart",
          },
          { source: "task.cancel", correlationID: "restart-cancellation-root-turn" },
        )
        Database.use((db) =>
          db
            .insert(EngineTaskCancellationAuthorityTable)
            .values({ task_id: taskID, request_event_id: requested.id })
            .run(),
        )
        expect(await requeueInterruptedRunningTaskIngresses()).toBe(0)
        expect(await EngineService.reconcilePendingTaskCancellations()).toBe(1)

        expect({
          taskStatus: deriveTaskStatus(requireTask(taskID)),
          wake: Database.use((db) =>
            db
              .select({ id: EngineArtifactTable.id, label: EngineArtifactTable.label })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, wakeID))
              .get(),
          ),
        }).toEqual({ taskStatus: "cancelled", wake: { id: wakeID, label: "terminal_inapplicable" } })
      },
    })
  })

  test("terminal conversation reads the exact operator message and persisted Task evidence", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
          task_occurrence_started_at: Database.use(
            (db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()!.time_started,
          ),
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
        const artifactSnapshot = tools.artifact_snapshot as {
          execute?: (args: unknown, options: unknown) => Promise<unknown>
        }
        if (!read.execute) throw new Error("read_task_message execution is unavailable")
        if (!readContext.execute) throw new Error("read_context execution is unavailable")
        if (!artifactSearch.execute) throw new Error("artifact_search execution is unavailable")
        if (!artifactSnapshot.execute) throw new Error("artifact_snapshot execution is unavailable")

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
    await provideTestInstance({
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
    await provideTestInstance({
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

  test("settles an ownerless running head before admitting a younger active wake", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Same-runtime ownerless ingress reconciliation",
          request: "Settle the committed FIFO head before delivering later work",
        })
        const oldWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now() - 1_000,
          }),
        )
        const oldAssistantMessageID = await persistFinalAssistantMessage({
          rootSessionID,
          taskIngress: { id: oldWakeID, kind: "operator_intent" },
          text: "The older running ingress already has its exact durable result.",
        })
        updateEngineArtifact({ id: oldWakeID, label: "running" })

        const deliveredWakeIDs: string[] = []
        configureTaskLoopRunner(async ({ wakeID }) => {
          deliveredWakeIDs.push(wakeID)
          const row = Database.use((db) =>
            db
              .select({ payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .where(eq(EngineArtifactTable.id, wakeID))
              .get(),
          )
          const ingress = QueuedTaskIngressSchema.parse(row?.payload)
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID, kind: ingress.source_kind },
              text: "The younger wake ran after the durable head converged.",
            }),
          }
        })

        expect(await dispatchTaskLoop({ taskID, event: { note: "Deliver the younger active wake" } })).toBe("started")
        await waitForQueueCompletionHooksForTest()

        const wakes = Database.use((db) =>
          db
            .select({
              id: EngineArtifactTable.id,
              label: EngineArtifactTable.label,
              payload: EngineArtifactTable.payload,
            })
            .from(EngineArtifactTable)
            .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "queued_operator_wake")))
            .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
            .all(),
        )
        const relevantWakes = wakes.filter((wake) => wake.id === oldWakeID || deliveredWakeIDs.includes(wake.id))
        expect(relevantWakes).toHaveLength(2)
        expect(relevantWakes[0]).toMatchObject({
          id: oldWakeID,
          label: "drained",
          payload: {
            delivery_result: { status: "completed", assistant_message_id: oldAssistantMessageID },
          },
        })
        expect(relevantWakes[1]).toMatchObject({
          id: deliveredWakeIDs[0],
          label: "drained",
          payload: { delivery_result: { status: "completed" } },
        })
        expect(deliveredWakeIDs).toEqual([relevantWakes[1]?.id])
      },
    })
  })

  test("returns an exact persisted running wake after its durable assistant settles the sole head", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Persisted sole running settlement",
          request: "Return the idempotent result after the durable head converges",
        })
        const wakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          }),
        )
        const assistantMessageID = await persistFinalAssistantMessage({
          rootSessionID,
          taskIngress: { id: wakeID, kind: "operator_intent" },
          text: "The sole persisted wake has already completed durably.",
        })
        updateEngineArtifact({ id: wakeID, label: "running" })

        expect(await dispatchPersistedTaskLoop(taskID, wakeID)).toBe("started")
        expect(findQueuedWake(wakeID)).toMatchObject({
          label: "drained",
          payload: {
            delivery_result: { status: "completed", assistant_message_id: assistantMessageID },
          },
        })
      },
    })
  })

  test("reattaches an older ownerless running wake before a younger persisted dispatch", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Persisted FIFO owner restoration",
          request: "Restore the physical owner for the older durable head",
        })
        const oldWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now() - 1_000,
          }),
        )
        updateEngineArtifact({ id: oldWakeID, label: "running" })
        const youngerWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "replan",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          }),
        )
        const deliveredWakeIDs: string[] = []
        configureTaskLoopRunner(async ({ wakeID }) => {
          deliveredWakeIDs.push(wakeID)
          const ingress = QueuedTaskIngressSchema.parse(findQueuedWake(wakeID)?.payload)
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID, kind: ingress.source_kind },
              text: `Settled persisted FIFO wake ${wakeID}.`,
            }),
          }
        })

        expect(await dispatchPersistedTaskLoop(taskID, youngerWakeID)).toBe("queued")
        await waitForQueueCompletionHooksForTest()

        expect(deliveredWakeIDs).toEqual([oldWakeID, youngerWakeID])
        expect([findQueuedWake(oldWakeID)?.label, findQueuedWake(youngerWakeID)?.label]).toEqual(["drained", "drained"])
      },
    })
  })

  test("advances a younger persisted head after exact replay settles an older running wake", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Persisted exact replay queue advance",
          request: "Advance the next durable wake after exact replay convergence",
        })
        const oldWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "retry",
            supersededOperatorMessageIDs: [],
            now: Date.now() - 1_000,
          }),
        )
        const oldAssistantMessageID = await persistFinalAssistantMessage({
          rootSessionID,
          taskIngress: { id: oldWakeID, kind: "operator_intent" },
          text: "The replayed older ingress has already completed.",
        })
        updateEngineArtifact({ id: oldWakeID, label: "running" })
        const youngerWakeID = Database.transaction((db) =>
          persistQueuedTaskIntentInTransaction(db, {
            task: requireTask(taskID),
            intent: "replan",
            supersededOperatorMessageIDs: [],
            now: Date.now(),
          }),
        )
        const deliveredWakeIDs: string[] = []
        configureTaskLoopRunner(async ({ wakeID }) => {
          deliveredWakeIDs.push(wakeID)
          const ingress = QueuedTaskIngressSchema.parse(findQueuedWake(wakeID)?.payload)
          return {
            finalMessageID: await persistFinalAssistantMessage({
              rootSessionID,
              taskIngress: { id: wakeID, kind: ingress.source_kind },
              text: "The younger persisted wake advanced after exact replay.",
            }),
          }
        })

        expect(await dispatchPersistedTaskLoop(taskID, oldWakeID)).toBe("started")
        await waitForQueueCompletionHooksForTest()

        expect(findQueuedWake(oldWakeID)).toMatchObject({
          label: "drained",
          payload: {
            delivery_result: { status: "completed", assistant_message_id: oldAssistantMessageID },
          },
        })
        expect(deliveredWakeIDs).toEqual([youngerWakeID])
        expect(findQueuedWake(youngerWakeID)?.label).toBe("drained")
      },
    })
  })

  test("reuses one coordination ingress identity after a typed delivery failure", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
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
          db
            .select({ payload: EngineArtifactTable.payload })
            .from(EngineArtifactTable)
            .where(eq(EngineArtifactTable.id, firstID))
            .get(),
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
            .select({
              id: EngineArtifactTable.id,
              label: EngineArtifactTable.label,
              payload: EngineArtifactTable.payload,
            })
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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
    await provideTestInstance({
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

  test("settles an armed control Turn after post-commit housekeeping fails without joining its standby owner", async () => {
    await using project = await memoryProject()
    await provideTestInstance({
      directory: project.path,
      fn: async () => {
        const activePackageRevision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: Instance.project.worktree,
          config: await EffectiveConfig.snapshotCurrent(),
        })
        const { taskID, rootSessionID } = await createActiveTask({
          title: "Post-commit control settlement",
          request: "Keep one exact Orchestrator control Turn bounded across housekeeping failure",
          packageRevision: activePackageRevision,
          metadata: { actor: "user" },
        })
        const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(orchestratorProviderModel())
        const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage as Message.Assistant
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "The exact control Turn reached standby.",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "continue"
            },
          } as any
        })
        let touchSpy: ReturnType<typeof spyOn> | undefined
        try {
          const initialMessageID = await Orchestrator.processTask(taskID, {
            note: "Establish the persistent Orchestrator owner",
          })
          if (!initialMessageID) {
            throw new Error(`Initial Orchestrator Turn failed: ${JSON.stringify(requireTask(taskID).error)}`)
          }
          const orchestratorSession = (await Session.children(rootSessionID)).find(
            (session) => session.kind === "orchestrator",
          )
          if (!orchestratorSession) throw new Error("Expected the durable Orchestrator Session")
          const standbyDeadline = Date.now() + 5_000
          while (
            Date.now() < standbyDeadline &&
            (!SessionPromptState.hasOwnedPromptInAnyDirectory(orchestratorSession.id) ||
              SessionStatus.get(orchestratorSession.id).type !== "idle")
          ) {
            await Bun.sleep(10)
          }
          expect({
            promptOwner: SessionPromptState.hasOwnedPromptInAnyDirectory(orchestratorSession.id),
            status: SessionStatus.get(orchestratorSession.id).type,
          }).toEqual({ promptOwner: true, status: "idle" })

          const housekeepingFailure = new Error("Injected post-commit control housekeeping failure")
          const touch = Session.touch
          let touchCalls = 0
          touchSpy = spyOn(Session, "touch").mockImplementation(async (...args: Parameters<typeof Session.touch>) => {
            touchCalls++
            if (touchCalls === 2) throw housekeepingFailure
            return touch(...args)
          })
          const wakeID = "art_post_commit_housekeeping_failure"
          const event = OrchestratorEventSchema.parse({
            dispatchInfrastructureFailure: {
              infrastructureFactID: "art_post_commit_housekeeping_fact",
              outcome: {
                kind: "infrastructure_failure",
                operation: "worker_dispatch",
                message: "Exercise exact control settlement after committed Message housekeeping fails",
                error_name: "InjectedDispatchFailure",
                recovery_authority: { occurrence_status: "occurrence_not_committed" },
                infrastructure_error: {
                  source: "engine_artifact",
                  artifact_id: "art_post_commit_housekeeping_fact",
                  catalog_revision: 1,
                  expected_sha256: "d".repeat(64),
                },
              },
            },
          })
          const wakeController = new AbortController()
          const operation = Orchestrator.processTask(taskID, event, wakeController.signal, wakeID)
          const outcome = await Promise.race([
            operation.then(
              () => "settled" as const,
              () => "rejected" as const,
            ),
            Bun.sleep(5_000).then(() => "timed_out" as const),
          ])
          if (outcome === "timed_out") {
            wakeController.abort(new Error("Bound the injected housekeeping failure regression"))
            await operation.catch(() => undefined)
          }

          expect(outcome).toBe("rejected")
          expect(SessionRuntimeContractStore.get(orchestratorSession.id)).toBeUndefined()
          expect({
            promptOwner: SessionPromptState.hasOwnedPromptInAnyDirectory(orchestratorSession.id),
            status: SessionStatus.get(orchestratorSession.id).type,
          }).toEqual({ promptOwner: true, status: "idle" })
          const controlMessageID = orchestratorControlOccurrenceIdentity(wakeID).messageID
          const messages = await Session.messages({ sessionID: orchestratorSession.id })
          expect(
            messages
              .filter((message) => message.info.role === "assistant")
              .map((message) => ({
                parentID: message.info.parentID,
                taskIngress: message.info.taskIngress,
              })),
          ).toEqual([
            { parentID: expect.any(String), taskIngress: undefined },
            { parentID: controlMessageID, taskIngress: { id: wakeID, kind: "dispatch_infrastructure_failure" } },
          ])
          await terminalTask(
            requireTask(taskID),
            { status: "failed", error: housekeepingFailure.message },
            "Settle the injected post-commit housekeeping failure",
            { preExecutionInfrastructureFailure: true },
          )
          await SessionPromptState.release(orchestratorSession.id)
          expect(SessionPromptState.hasOwnedPromptInAnyDirectory(orchestratorSession.id)).toBe(false)
        } finally {
          touchSpy?.mockRestore()
          processorSpy.mockRestore()
          providerSpy.mockRestore()
        }
      },
    })
  }, 30_000)
})
