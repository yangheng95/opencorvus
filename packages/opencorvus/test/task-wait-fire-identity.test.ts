import { afterAll, describe, expect, test } from "bun:test"
import {
  EngineTaskRootIngressTable,
  EngineTaskWaitRegistrationTable,
  EngineTaskWaitSettlementTable,
} from "../src/engine/engine.sql"
import { deleteEngineTasksForProjectSessions } from "../src/engine/task"
import {
  dispatchTaskLoop,
  reconcileTaskControlPlane,
  taskControlDriverSnapshot,
  TestHooks as TaskControlTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "../src/engine/task-root-ingress-delivery"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { createTaskWait, listTaskWaits, TaskWaitIngressLineageError } from "../src/engine/task-wait"
import { appendTaskReopenedInTransaction } from "../src/engine/task-lifecycle"
import { acquireControlLease, releaseControlLease } from "../src/engine/control-lease"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease } from "../src/engine/task-root-fact-store"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProtocolStore } from "../src/protocol/store"
import { currentOrchestratorControlMessage } from "../src/orchestrator/agent"
import {
  AutomationDelaySettlementTable,
  AutomationDefinitionTombstoneTable,
  AutomationFireAttemptTable,
  AutomationFireTable,
  AutomationRunReceiptTable,
  AutomationRunTable,
  AutomationTable,
} from "../src/scheduler/automation.sql"
import { AutomationService } from "../src/scheduler/automation-service"
import { createDelayedSessionWake } from "../src/scheduler/delayed-wake-schedule"
import { settleSessionDelaysAtAssistantAcceptanceInTransaction } from "../src/scheduler/session-delay-admission"
import { recoverScheduledToolPart } from "../src/scheduler/tool-recovery"
import { ScheduledToolOccurrenceConflictError } from "../src/scheduler/tool-occurrence"
import { Session } from "../src/session"
import { SessionLoop } from "../src/session/loop"
import { Message } from "../src/session/message"
import { MessageStore } from "../src/session/message-store"
import { SessionWake } from "../src/session/wake"
import { Config } from "../src/config/config"
import { Database, asc, eq } from "../src/storage/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Tool } from "../src/tool/tool"
import { WaitTool } from "../src/tool/wait"
import { restartTaskControlProjectFrontier } from "../src/engine/task-root-ingress-disposition"

afterAll(async () => {
  await waitForIngressDeliveryHooksForTest()
  await resetMemoryDatabase()
})

async function persistedToolOccurrence(input: {
  sessionID: string
  tool: "wait" | "schedule"
  toolInput: Record<string, unknown>
}) {
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: input.sessionID,
    role: "user",
    author: "user",
    agent: "orchestrator",
    model: { providerID: "test", modelID: "scheduler-occurrence" },
    time: { created: Date.now() },
  })
  const messageID = Identifier.ascending("message")
  await Session.updateMessage({
    id: messageID,
    parentID: user.id,
    sessionID: input.sessionID,
    role: "assistant",
    author: "orchestrator",
    agent: "orchestrator",
    providerID: "test",
    modelID: "scheduler-occurrence",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  })
  const toolPartID = Identifier.ascending("part")
  const toolCallID = Identifier.ascending("call")
  await Session.updatePart({
    id: toolPartID,
    sessionID: input.sessionID,
    messageID,
    type: "tool",
    callID: toolCallID,
    tool: input.tool,
    state: { status: "running", input: input.toolInput, time: { start: Date.now() } },
  })
  return { sessionID: input.sessionID, messageID, toolPartID, toolCallID }
}

async function persistedTaskWaitOccurrence(input: {
  taskID: string
  sessionID: string
  toolInput: Record<string, unknown>
  now?: number
}) {
  const now = input.now ?? Date.now()
  const ingress = Database.immediateTransaction((db) => {
    const existing = db
      .select()
      .from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.task_id, input.taskID))
      .orderBy(asc(EngineTaskRootIngressTable.sequence), asc(EngineTaskRootIngressTable.id))
      .get()
    return (
      existing ??
      acceptTaskRootIngressInTransaction(db, {
        taskID: input.taskID,
        executionEpoch: 1,
        source: "inline",
        sourceID: `task-wait-source-${Identifier.uuid4First8()}`,
        inlinePayload: { purpose: "Task wait Tool occurrence" },
        semanticTurnLimit: 1,
        activationLimit: 1,
        now,
      })
    )
  })
  const ownerOccurrenceID = `task-wait-owner-${Identifier.uuid4First8()}`
  const lease = acquireTaskRootIngressLease({
    ingressID: ingress.id,
    ownerOccurrenceID,
    now: now + 1,
    leaseMilliseconds: 60_000,
    assertControlOwnerInTransaction: () => undefined,
  })
  if (!lease.acquired) throw new Error("Expected Task wait source ingress ownership")
  const control = currentOrchestratorControlMessage(
    { taskCreation: { taskID: input.taskID } },
    input.taskID,
    ingress.id,
    ingress.id,
  )
  if (!control) throw new Error("Expected Task wait control occurrence")
  await Session.persistMessage({
    info: {
      id: control.messageID,
      sessionID: input.sessionID,
      role: "user",
      author: "orchestrator",
      agent: "orchestrator",
      model: { providerID: "test", modelID: "scheduler-occurrence" },
      time: { created: now + 2 },
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
    modelID: "scheduler-occurrence",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: now + 3 },
    activationID: lease.activationID,
  })
  const toolPartID = Identifier.ascending("part")
  const toolCallID = Identifier.ascending("call")
  await Session.updatePart({
    id: toolPartID,
    sessionID: input.sessionID,
    messageID,
    type: "tool",
    callID: toolCallID,
    tool: "wait",
    state: { status: "running", input: input.toolInput, time: { start: now + 4 } },
  })
  return {
    sessionID: input.sessionID,
    messageID,
    toolPartID,
    toolCallID,
    ingressID: ingress.id,
    activationID: lease.activationID,
    ownerOccurrenceID,
  }
}

async function establishedTask(title: string) {
  const taskID = Identifier.ascending("task")
  const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title })
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
    title,
    request: "Resume from exact durable wait evidence",
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
  const scheduler = await Session.create({ kind: "orchestrator", parentID: root.id, title: `${title} scheduler` })
  return { taskID, root, scheduler }
}

describe("native Task wait occurrence", () => {
  test("discovers a wait committed after the Project checkpoint with an older due time", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Late physical wait source")
        const now = Date.now()
        const firstOccurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 120_000, reason: "seed physical wait tail" },
          now,
        })
        createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 120_000,
          reason: "seed physical wait tail",
          occurrence: firstOccurrence,
          now,
        })
        releaseControlLease({
          target: "task_root_ingress",
          targetID: firstOccurrence.ingressID,
          leaseID: firstOccurrence.activationID,
          ownerOccurrenceID: firstOccurrence.ownerOccurrenceID,
          now: Date.now(),
        })
        let frontier = TaskControlTestHooks.currentProjectFrontierSlice()
        while (frontier.next) frontier = TaskControlTestHooks.currentProjectFrontierSlice(frontier.next)
        const checkpoint = restartTaskControlProjectFrontier(frontier.checkpoint)

        const lateTask = await establishedTask("Late physical wait commit")
        const lateOccurrence = await persistedTaskWaitOccurrence({
          taskID: lateTask.taskID,
          sessionID: lateTask.scheduler.id,
          toolInput: { duration_ms: 60_000, reason: "late commit with older due time" },
          now: Date.now(),
        })
        const lateWait = createTaskWait({
          taskID: lateTask.taskID,
          projectID: Instance.project.id,
          durationMs: 60_000,
          reason: "late commit with older due time",
          occurrence: lateOccurrence,
          now: Date.now(),
        })
        expect(TaskControlTestHooks.currentProjectFrontierSlice(checkpoint).taskIDs).toContain(lateTask.taskID)

        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(lateTask.taskID)
        const armedWake = taskControlDriverSnapshot().find((entry) => entry.taskID === lateTask.taskID)?.wakeAt
        expect(armedWake).toBeDefined()
        expect(armedWake!).toBeLessThanOrEqual(lateWait.dueAt)
        expect(armedWake!).toBeGreaterThanOrEqual(lateWait.dueAt - 1_000)
      },
    })
  })

  test("materializes one due ingress and settles the exact wait in the current execution epoch", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Native due wait")
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 1, reason: "resume once" },
        })
        const wait = createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 1,
          reason: "resume once",
          occurrence,
          now: Date.now() - 10,
        })
        using runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(task.taskID)
        await waitForIngressDeliveryHooksForTest()

        const settlement = Database.use((db) =>
          db
            .select()
            .from(EngineTaskWaitSettlementTable)
            .where(eq(EngineTaskWaitSettlementTable.wait_id, wait.id))
            .get(),
        )
        const ingress = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.id, settlement!.ingress_id))
            .get(),
        )
        expect({ settlement, ingress, projection: listTaskWaits(task.taskID) }).toMatchObject({
          settlement: { wait_id: wait.id, disposition: "due_ingress_accepted" },
          ingress: {
            task_id: task.taskID,
            execution_epoch: 1,
            source: "inline",
            inline_payload: { taskWaitWake: { jobID: wait.id, dueAt: wait.dueAt } },
          },
          projection: [{ id: wait.id, executionEpoch: 1, status: "due_ingress_accepted" }],
        })
      },
    })
  }, 30_000)

  test("a newer accepted Task ingress atomically supersedes the current wait", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Superseded wait")
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 60_000, reason: "wait for evidence" },
        })
        const wait = createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 60_000,
          reason: "wait for evidence",
          occurrence,
        })
        using runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await dispatchTaskLoop({ taskID: task.taskID, event: { note: "New operator evidence arrived" } })
        expect(listTaskWaits(task.taskID)).toMatchObject([
          { id: wait.id, executionEpoch: 1, status: "superseded", ingressID: expect.any(String) },
        ])
      },
    })
  }, 30_000)

  test("a mismatched Task wait wake fails closed before one exact due ingress is materialized", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Exact due wait lineage")
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 1, reason: "accept only exact due identity" },
        })
        const wait = createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 1,
          reason: "accept only exact due identity",
          occurrence,
          now: Date.now() - 10,
        })
        using runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        let rejected: unknown
        try {
          await dispatchTaskLoop({
            taskID: task.taskID,
            event: {
              note: "mismatched due wake",
              taskWaitWake: { jobID: wait.id, fireID: "cal_wrong", dueAt: wait.dueAt },
            },
          })
        } catch (error) {
          rejected = error
        }
        expect(rejected).toBeInstanceOf(TaskWaitIngressLineageError)
        expect(rejected).toMatchObject({ code: "malformed_due_identity", waitID: wait.id })
        expect(
          Database.use((db) =>
            db
              .select()
              .from(EngineTaskWaitSettlementTable)
              .where(eq(EngineTaskWaitSettlementTable.wait_id, wait.id))
              .get(),
          ),
        ).toBeUndefined()

        await reconcileTaskControlPlane(task.taskID)
        await waitForIngressDeliveryHooksForTest()
        const settlements = Database.use((db) =>
          db
            .select()
            .from(EngineTaskWaitSettlementTable)
            .where(eq(EngineTaskWaitSettlementTable.wait_id, wait.id))
            .all(),
        )
        const dueIngresses = Database.use((db) =>
          db.select().from(EngineTaskRootIngressTable).where(eq(EngineTaskRootIngressTable.source_id, wait.id)).all(),
        )
        expect({ settlements, dueIngresses }).toMatchObject({
          settlements: [{ wait_id: wait.id, disposition: "due_ingress_accepted" }],
          dueIngresses: [{ source: "inline", inline_payload: { taskWaitWake: { jobID: wait.id, fireID: wait.id } } }],
        })
      },
    })
  }, 30_000)

  test("a wait remains bound to its creation epoch after terminal reopen", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Epoch-bound wait")
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 1, reason: "epoch one only" },
        })
        const wait = createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 1,
          reason: "epoch one only",
          occurrence,
        })
        Database.immediateTransaction((db) => {
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: task.taskID,
            task_id: null,
            session_id: task.root.id,
            source: "test",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1 },
          })
          appendTaskReopenedInTransaction({
            db,
            taskID: task.taskID,
            sessionID: task.root.id,
            now: Date.now() + 1,
            source: "test",
          })
        })
        expect(listTaskWaits(task.taskID)).toMatchObject([
          { id: wait.id, executionEpoch: 1, status: "terminal_inapplicable" },
        ])
      },
    })
  })

  test("the real Wait Tool and outer recovery replay one exact native Task wait result", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Task wait lost response")
        const input = { duration_ms: 60_000, reason: "recover exact native wait" }
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: input,
        })
        const persisted = await MessageStore.get({ sessionID: task.scheduler.id, messageID: occurrence.messageID })
        const part = persisted.parts.find((candidate) => candidate.id === occurrence.toolPartID)
        if (!part || part.type !== "tool") throw new Error("Expected persisted Task wait Tool request")
        const wait = await WaitTool.init()
        const live = await wait.execute(input, {
          sessionID: task.scheduler.id,
          messageID: occurrence.messageID,
          callID: occurrence.toolCallID,
          agent: "orchestrator",
          abort: new AbortController().signal,
          extra: { toolPartID: occurrence.toolPartID, projectID: Instance.project.id },
          messages: [],
          executionAuthority: {
            kind: "task",
            sessionID: task.scheduler.id,
            projectID: Instance.project.id,
            taskID: task.taskID,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["wait"], []),
          metadata() {},
        })
        expect(await recoverScheduledToolPart(part)).toEqual(live)
        await expect(
          recoverScheduledToolPart({
            ...part,
            state: { ...part.state, input: { ...input, reason: "changed after commit" } },
          }),
        ).rejects.toBeInstanceOf(ScheduledToolOccurrenceConflictError)

        const completedAt = Date.now() + 1
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(task.scheduler.id, undefined, [
            { messageID: occurrence.messageID, completedAt },
          ]),
        ).toBe(true)
        const recovered = await MessageStore.get({ sessionID: task.scheduler.id, messageID: occurrence.messageID })
        expect(recovered.parts.find((candidate) => candidate.id === occurrence.toolPartID)).toMatchObject({
          type: "tool",
          state: { status: "completed", title: live.title, output: live.output, metadata: live.metadata },
        })
        expect(
          await SessionLoop.terminalizeRecoveredIncompleteAssistant(task.scheduler.id, undefined, [
            { messageID: occurrence.messageID, completedAt: completedAt + 1 },
          ]),
        ).toBe(false)
      },
    })
  }, 30_000)

  test("the Project session cleanup primitive cascades one settled native Task wait", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const task = await establishedTask("Task wait Project cleanup")
        const occurrence = await persistedTaskWaitOccurrence({
          taskID: task.taskID,
          sessionID: task.scheduler.id,
          toolInput: { duration_ms: 1, reason: "settle before Project cleanup" },
        })
        const wait = createTaskWait({
          taskID: task.taskID,
          projectID: Instance.project.id,
          durationMs: 1,
          reason: "settle before Project cleanup",
          occurrence,
          now: Date.now() - 10,
        })
        using runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await reconcileTaskControlPlane(task.taskID)
        await waitForIngressDeliveryHooksForTest()

        Database.immediateTransaction((db) => {
          deleteEngineTasksForProjectSessions(db, {
            projectID: Instance.project.id,
            sessionIDs: [task.root.id],
          })
        })
        expect(
          Database.use((db) => ({
            registrations: db
              .select()
              .from(EngineTaskWaitRegistrationTable)
              .where(eq(EngineTaskWaitRegistrationTable.task_id, task.taskID))
              .all(),
            settlements: db
              .select()
              .from(EngineTaskWaitSettlementTable)
              .where(eq(EngineTaskWaitSettlementTable.wait_id, wait.id))
              .all(),
            ingresses: db
              .select()
              .from(EngineTaskRootIngressTable)
              .where(eq(EngineTaskRootIngressTable.task_id, task.taskID))
              .all(),
          })),
        ).toEqual({ registrations: [], settlements: [], ingresses: [] })
      },
    })
  }, 30_000)
})

function assistantAccepting(sessionID: string, inputMessageID: string, now: number): Message.Assistant {
  return {
    id: Identifier.ascending("message"),
    sessionID,
    parentID: inputMessageID,
    acceptedInputMessageIDs: [inputMessageID],
    role: "assistant",
    author: "primary",
    agent: "primary",
    providerID: "test",
    modelID: "session-delay",
    path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    time: { created: now },
  }
}

function beginAssistantWithDelayAdmission(assistant: Message.Assistant) {
  return Session.beginAssistantReplyWithCommit(assistant, (db) => {
    settleSessionDelaysAtAssistantAcceptanceInTransaction(db, {
      sessionID: assistant.sessionID,
      assistantMessageID: assistant.id,
      acceptedInputMessageIDs: assistant.acceptedInputMessageIDs ?? [],
      now: assistant.time.created,
    })
  })
}

describe("Session one-shot delay admission", () => {
  test("ordinary input supersedes an expired production delay reservation before wake dispatch", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "session-delay-test/wake",
          provider: {
            "session-delay-test": {
              name: "Session delay test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                wake: {
                  name: "Session delay wake",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        })
        const session = await Session.create({ kind: "root", title: "Expired Session delay owner" })
        const occurrence = await persistedToolOccurrence({
          sessionID: session.id,
          tool: "wait",
          toolInput: { duration_ms: 1, reason: "expired owner race" },
        })
        const delay = await createDelayedSessionWake({
          name: "session wait",
          projectId: Instance.project.id,
          sessionId: session.id,
          durationMs: 1,
          prompt: "resume after expired owner",
          occurrence,
        })
        const definition = Database.use(
          (db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, delay.id)).get()!,
        )
        const owner = `expired-session-delay-${Identifier.uuid4First8()}`
        const claimedAt = delay.nextRun + 1
        if (!AutomationService.TestHooks.claim(delay.id, owner, claimedAt)) {
          throw new Error("Expected expired-owner Session delay claim")
        }
        let releaseReservation!: () => void
        const reservationGate = new Promise<void>((resolve) => {
          releaseReservation = resolve
        })
        let announceReservation!: () => void
        const reserved = new Promise<void>((resolve) => {
          announceReservation = resolve
        })
        using _reservation = AutomationService.TestHooks.installAfterRunReservation(async () => {
          announceReservation()
          await reservationGate
        })
        const execution = AutomationService.TestHooks.executeClaimedDueOccurrence({
          job: definition,
          owner,
          now: claimedAt,
        })
        await reserved
        const takeoverAt = claimedAt + 2 * 60 * 1000 + 1
        const takeover = acquireControlLease({
          target: "automation",
          targetID: delay.id,
          ownerOccurrenceID: "expired-session-delay-takeover",
          now: takeoverAt,
          leaseMilliseconds: 60_000,
        })
        if (!takeover.acquired) throw new Error("Expected expired Session delay owner takeover")
        releaseControlLease({
          target: "automation",
          targetID: delay.id,
          leaseID: takeover.lease.id,
          ownerOccurrenceID: takeover.lease.owner_occurrence_id,
          now: Date.now(),
        })
        const ordinary = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "primary",
          model: { providerID: "test", modelID: "session-delay" },
          pendingDelivery: true,
          time: { created: takeoverAt + 2 },
        })
        await beginAssistantWithDelayAdmission(assistantAccepting(session.id, ordinary.id, takeoverAt + 3))
        releaseReservation()
        await expect(execution).rejects.toThrow("lost its lease")

        const facts = Database.use((db) => {
          const run = db
            .select()
            .from(AutomationRunTable)
            .where(eq(AutomationRunTable.automation_revision_id, definition.id))
            .get()!
          return {
            settlement: db
              .select()
              .from(AutomationDelaySettlementTable)
              .where(eq(AutomationDelaySettlementTable.definition_id, delay.id))
              .get(),
            receipt: db
              .select()
              .from(AutomationRunReceiptTable)
              .where(eq(AutomationRunReceiptTable.run_id, run.id))
              .all()
              .at(-1),
            tombstone: db
              .select()
              .from(AutomationDefinitionTombstoneTable)
              .where(eq(AutomationDefinitionTombstoneTable.definition_id, delay.id))
              .get(),
          }
        })
        expect(facts).toMatchObject({
          settlement: {
            disposition: "input_accepted",
            accepted_input_message_ids: [ordinary.id],
          },
          receipt: { outcome: "disposition", disposition: "superseded" },
          tombstone: { definition_id: delay.id, revision: 2 },
        })
      },
    })
  }, 60_000)

  test("a production due claim admits one exact wake before an ordinary concurrent input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Config.updateProjectPatch({
          model: "session-delay-test/wake",
          provider: {
            "session-delay-test": {
              name: "Session delay test",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                wake: {
                  name: "Session delay wake",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        })
        const session = await Session.create({ kind: "root", title: "Production Session delay race" })
        const occurrence = await persistedToolOccurrence({
          sessionID: session.id,
          tool: "wait",
          toolInput: { duration_ms: 1, reason: "due production race" },
        })
        const delay = await createDelayedSessionWake({
          name: "session wait",
          projectId: Instance.project.id,
          sessionId: session.id,
          durationMs: 1,
          prompt: "resume due production race",
          occurrence,
        })
        const definition = Database.use(
          (db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, delay.id)).get()!,
        )
        const owner = `session-delay-race-${Identifier.uuid4First8()}`
        const claimedAt = delay.nextRun + 1
        const claim = AutomationService.TestHooks.claim(delay.id, owner, claimedAt)
        if (!claim) throw new Error("Expected production Session delay claim")
        let releaseWake!: () => void
        const wakeGate = new Promise<void>((resolve) => {
          releaseWake = resolve
        })
        let announceWake!: (messageID: string) => void
        const wakePersisted = new Promise<string>((resolve) => {
          announceWake = resolve
        })
        using _loop = SessionWake.TestHooks.installWakeLoopExecutor(async (input) => {
          announceWake(input.messageID)
          await wakeGate
        })
        const execution = AutomationService.TestHooks.executeClaimedDueOccurrence({
          job: definition,
          owner,
          now: claimedAt,
        })
        const wakeMessageID = await wakePersisted
        const ordinary = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "primary",
          model: { providerID: "session-delay-test", modelID: "wake" },
          pendingDelivery: true,
          time: { created: claimedAt + 1 },
        })
        await expect(
          beginAssistantWithDelayAdmission(assistantAccepting(session.id, ordinary.id, claimedAt + 2)),
        ).rejects.toThrow("owns a live due occurrence")
        await beginAssistantWithDelayAdmission(assistantAccepting(session.id, wakeMessageID, claimedAt + 3))
        releaseWake()
        await execution

        const facts = Database.use((db) => {
          const settlement = db
            .select()
            .from(AutomationDelaySettlementTable)
            .where(eq(AutomationDelaySettlementTable.definition_id, delay.id))
            .get()
          const run = db
            .select()
            .from(AutomationRunTable)
            .where(eq(AutomationRunTable.automation_revision_id, definition.id))
            .get()
          const receipt = run
            ? db
                .select()
                .from(AutomationRunReceiptTable)
                .where(eq(AutomationRunReceiptTable.run_id, run.id))
                .all()
                .at(-1)
            : undefined
          const tombstone = db
            .select()
            .from(AutomationDefinitionTombstoneTable)
            .where(eq(AutomationDefinitionTombstoneTable.definition_id, delay.id))
            .get()
          return { settlement, run, receipt, tombstone }
        })
        expect(facts).toMatchObject({
          settlement: {
            disposition: "due_accepted",
            assistant_message_id: expect.any(String),
            accepted_input_message_ids: [wakeMessageID],
          },
          run: { automation_revision_id: definition.id },
          receipt: { outcome: "succeeded" },
          tombstone: { definition_id: delay.id, revision: 2 },
        })
        expect((await MessageStore.get({ sessionID: session.id, messageID: ordinary.id })).info).toMatchObject({
          id: ordinary.id,
          pendingDelivery: true,
        })
      },
    })
  }, 60_000)

  test("ordinary accepted input consumes the exact Session delay in the assistant acceptance transaction", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Session delay input winner" })
        const occurrence = await persistedToolOccurrence({
          sessionID: session.id,
          tool: "wait",
          toolInput: { duration_ms: 60_000, reason: "wait" },
        })
        const delay = await createDelayedSessionWake({
          name: "session wait",
          projectId: Instance.project.id,
          sessionId: session.id,
          durationMs: 60_000,
          prompt: "resume later",
          occurrence,
        })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "primary",
          model: { providerID: "test", modelID: "session-delay" },
          pendingDelivery: true,
          time: { created: Date.now() },
        })
        await beginAssistantWithDelayAdmission(assistantAccepting(session.id, input.id, Date.now() + 1))
        expect(
          Database.use((db) =>
            db
              .select()
              .from(AutomationDefinitionTombstoneTable)
              .where(eq(AutomationDefinitionTombstoneTable.definition_id, delay.id))
              .get(),
          ),
        ).toMatchObject({ definition_id: delay.id, revision: 2 })
        expect((await MessageStore.get({ sessionID: session.id, messageID: input.id })).info).toMatchObject({
          id: input.id,
          role: "user",
        })
      },
    })
  })

  test("a capacity-waiting Automation takes its lease from the fresh worker claim time", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const delays = []
        for (const position of [1, 2]) {
          const session = await Session.create({ kind: "root", title: `Capacity delay ${position}` })
          const occurrence = await persistedToolOccurrence({
            sessionID: session.id,
            tool: "wait",
            toolInput: { duration_ms: 1, reason: `capacity ${position}` },
          })
          delays.push(
            await createDelayedSessionWake({
              name: `capacity delay ${position}`,
              projectId: Instance.project.id,
              sessionId: session.id,
              durationMs: 1,
              prompt: `resume capacity delay ${position}`,
              occurrence,
            }),
          )
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 5))

        const priorConcurrency = process.env.OPENCORVUS_AUTOMATION_CONCURRENCY
        process.env.OPENCORVUS_AUTOMATION_CONCURRENCY = "1"
        const firstClaimAt = Date.now()
        let workerClaimAt = firstClaimAt
        let releaseFirst!: () => void
        const firstGate = new Promise<void>((resolve) => {
          releaseFirst = resolve
        })
        let announceFirst!: () => void
        const firstReserved = new Promise<void>((resolve) => {
          announceFirst = resolve
        })
        let reservationCount = 0
        using _clock = AutomationService.TestHooks.installClaimClock(() => workerClaimAt)
        using _reservation = AutomationService.TestHooks.installAfterRunReservation(async () => {
          reservationCount += 1
          if (reservationCount !== 1) return
          announceFirst()
          await firstGate
        })
        using _wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
          sessionID: input.sessionID!,
          messageID: input.messageID!,
          activation: Promise.resolve({ owner: new AbortController().signal }),
          completion: Promise.resolve({ ok: true as const }),
        }))
        try {
          const run = AutomationService.runDueNow()
          await firstReserved
          workerClaimAt = firstClaimAt + 10 * 60 * 1000
          releaseFirst()
          await run
        } finally {
          if (priorConcurrency === undefined) delete process.env.OPENCORVUS_AUTOMATION_CONCURRENCY
          else process.env.OPENCORVUS_AUTOMATION_CONCURRENCY = priorConcurrency
        }

        const attemptTimes = delays
          .map((delay) =>
            Database.use((db) => {
              const fire = db
                .select({ id: AutomationFireTable.id })
                .from(AutomationFireTable)
                .innerJoin(AutomationTable, eq(AutomationFireTable.automation_revision_id, AutomationTable.id))
                .where(eq(AutomationTable.definition_id, delay.id))
                .get()!
              return db
                .select({ timeCreated: AutomationFireAttemptTable.time_created })
                .from(AutomationFireAttemptTable)
                .where(eq(AutomationFireAttemptTable.fire_id, fire.id))
                .get()!.timeCreated
            }),
          )
          .sort((left, right) => left - right)
        expect(attemptTimes).toEqual([firstClaimAt, firstClaimAt + 10 * 60 * 1000])
      },
    })
  }, 60_000)

  test("an accepted exact due wake retains the live due occurrence for its terminal receipt", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "Session delay due winner" })
        const occurrence = await persistedToolOccurrence({
          sessionID: session.id,
          tool: "wait",
          toolInput: { duration_ms: 1, reason: "due" },
        })
        const delay = await createDelayedSessionWake({
          name: "session wait",
          projectId: Instance.project.id,
          sessionId: session.id,
          durationMs: 1,
          prompt: "resume due",
          occurrence,
        })
        const definition = Database.use(
          (db) => db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, delay.id)).get()!,
        )
        const fireID = Identifier.ascending("call")
        Database.immediateTransaction((db) => {
          db.insert(AutomationFireTable)
            .values({
              id: fireID,
              automation_revision_id: definition.id,
              scheduled_due_at: delay.nextRun,
              origin: "scheduled",
              time_created: Date.now(),
            })
            .run()
          db.insert(AutomationRunTable)
            .values({
              id: Identifier.ascending("automation"),
              automation_revision_id: definition.id,
              fire_id: fireID,
              started_at: Date.now(),
            })
            .run()
        })
        const now = Date.now()
        const lease = acquireControlLease({
          target: "automation",
          targetID: delay.id,
          ownerOccurrenceID: "session-delay-due-owner",
          now,
          leaseMilliseconds: 60_000,
        })
        if (!lease.acquired) throw new Error("Expected Session delay due owner")
        const wake = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "scheduler",
          agent: "primary",
          model: { providerID: "test", modelID: "session-delay" },
          pendingDelivery: true,
          extra: {
            wake_reason: {
              source: "scheduler.automation",
              jobID: delay.id,
              jobName: "session wait",
              fireID,
              scope: "session",
              recurrence: null,
            },
          },
          time: { created: now + 1 },
        })
        await beginAssistantWithDelayAdmission(assistantAccepting(session.id, wake.id, now + 2))
        expect(
          Database.use((db) =>
            db.select().from(AutomationTable).where(eq(AutomationTable.definition_id, delay.id)).get(),
          ),
        ).toMatchObject({ id: definition.id, due_at: delay.nextRun })
      },
    })
  })
})
