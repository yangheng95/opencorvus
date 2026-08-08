import z from "zod"
import { Instance, runAsInstanceActivity } from "@/project/instance"
import {
  provideInitializedProjectExecution,
  runWithIndependentProjectIdentity,
} from "@/project/independent-project-owner"
import { createInstanceState } from "@/project/instance-state"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { BusEvent } from "@/bus/bus-event"
import { Session } from "@/session"
import { SessionStatus, sessionLifecycleOrderKey } from "@/session/status"
import { SessionPrompt } from "@/session/prompt"
import { SessionPromptReplyError } from "@/session/prompt/state"
import { SessionContext } from "@/session/context"
import { SessionTable } from "@/session/session.sql"
import { Message } from "@/session/message"
import { Database, and, eq, inArray, sql, type SQL } from "@/storage/db"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { AwaitTimeoutError } from "@/util/await-with-timeout"
import { EngineConfig } from "@/engine/config"
import { terminateOwnedSessionPromptInScope } from "@/engine/cancellation-scope"
import { createExecutionCancellationOrigin, type ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { TaskQueueTable } from "./task-queue.sql"
import { SessionWake } from "@/session/wake"
import { NamedError } from "@opencorvus-ai/util/error"

export const TaskQueueEvent = {
  Changed: BusEvent.define(
    "task-queue.changed",
    z.object({
      queueTaskID: z.string(),
      sessionID: z.string(),
      status: z.enum(["queued", "failed"]),
      sequence: z.number(),
    }),
  ),
  Completed: BusEvent.define(
    "task-queue.completed",
    z.object({
      queueTaskID: z.string(),
      sessionID: z.string(),
    }),
  ),
}

const RawTaskMetadata = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("session_prompt"),
    input: z.unknown(),
  }),
  z.object({
    kind: z.literal("session_wake"),
    messageID: z.string(),
    input: z.unknown(),
  }),
  z.object({
    kind: z.literal("session_compaction"),
    input: z.unknown(),
  }),
])

const EnqueuePromptInput = z.object({
  sessionID: Identifier.schema("session"),
  prompt: z.unknown(),
  priority: z.enum(["high", "normal", "low"]).optional(),
  source: z.string().optional(),
})

const CompactionModelRef = z.object({
  providerID: z.string(),
  modelID: z.string(),
})

const ExecuteCompactionInput = z.object({
  sessionID: Identifier.schema("session"),
  sourceUserMessageID: Identifier.schema("message"),
  model: CompactionModelRef.optional(),
  auto: z.boolean().optional().default(false),
  overflow: z.boolean().optional().default(false),
  focus: z.string().optional(),
})

const StoredCompactionInput = ExecuteCompactionInput.omit({ sessionID: true })

const EnqueueCompactionInput = ExecuteCompactionInput.extend({
  priority: z.enum(["high", "normal", "low"]).optional(),
  source: z.string().optional(),
})

export namespace TaskQueueService {
  const log = Log.create({ service: "task-queue-service" })

  const CONCURRENCY_ENV = "OPENCORVUS_TASK_QUEUE_CONCURRENCY"
  const CONCURRENCY_LIMIT = 100

  function publishQueueChanged(input: {
    queueTaskID: string
    sessionID: string
    status: "queued" | "failed"
    sequence: number
  }) {
    void Bus.publish(TaskQueueEvent.Changed, input).catch((error) => {
      log.warn("task queue changed publish failed", { ...input, error: message(error) })
    })
  }

  export function deleteSettledForSessions(db: Database.TxOrDb, input: { sessionIDs: string[] }): void {
    if (input.sessionIDs.length === 0) return
    db.delete(TaskQueueTable)
      .where(
        and(
          inArray(TaskQueueTable.session_id, input.sessionIDs),
          inArray(TaskQueueTable.status, ["completed", "failed"]),
        ),
      )
      .run()
    const unsettled = db
      .select({ id: TaskQueueTable.id, status: TaskQueueTable.status })
      .from(TaskQueueTable)
      .where(inArray(TaskQueueTable.session_id, input.sessionIDs))
      .orderBy(TaskQueueTable.time_created, TaskQueueTable.id)
      .all()
    if (unsettled.length > 0) {
      throw new Error(
        `Session deletion requires settled task queue rows: ${unsettled.map((row) => `${row.id}:${row.status}`).join(", ")}`,
      )
    }
  }

  type QueueTaskRow = typeof TaskQueueTable.$inferSelect
  type InFlightTask = {
    promise: Promise<void>
    cleanup: () => void
    sessionID: string
    source: string
    cancellationReason?: string
    cancellationOrigin?: ExecutionCancellationOrigin
    promptOwner?: AbortSignal
    progressSessionIDs?: Set<string>
  }

  type QueueProgressEnvelope = {
    directory?: string
    payload: any
  }

  const state = createInstanceState(
    () => ({
      draining: false,
      activeDrain: undefined as Promise<Promise<void>[]> | undefined,
      inFlight: new Map<string, InFlightTask>(),
      recoveryTimers: new Map<string, ReturnType<typeof setTimeout>>(),
      recoveryTimerTokens: new Map<string, number>(),
      recoveryTimerSequence: 0,
      progressListener: undefined as ((message: QueueProgressEnvelope) => void) | undefined,
    }),
    async (current) => {
      if (current.progressListener) GlobalBus.off("event", current.progressListener)
      for (const timer of current.recoveryTimers.values()) clearTimeout(timer)
      current.recoveryTimers.clear()
      current.recoveryTimerTokens.clear()
      current.inFlight.clear()
    },
    "task-queue-service",
  )

  export function init() {
    const recovered = requeueOwnerlessRunningRows()
    if (recovered > 0) requestDrain("project bootstrap recovered ownerless queue rows")
    log.info("task queue service initialized", { recoveredOwnerlessRows: recovered })
  }

  export async function runNow() {
    await drainUntilIdle("runNow")
  }

  export const TestHooks = {
    async claimReadyTaskIDs(input: {
      limit: number
      beforeValidation?: (sessionID: string) => void | Promise<void>
    }): Promise<string[]> {
      const claimed = await claimReadyTasks(input.limit, async (sessionID) => {
        await input.beforeValidation?.(sessionID)
        return assertSessionLineageInCurrentProject(sessionID)
      })
      return claimed.map((task) => task.id)
    },
  }

  export type QueuedTaskStatus = {
    taskID: string
    sessionID: string
    status: "queued" | "running" | "completed" | "failed"
    source: string
    prompt: string
    error: string | null
    startedAt: number | null
    completedAt: number | null
    updatedAt: number
  }

  export function getStatus(input: { sessionID: string; taskID: string; source: string }): QueuedTaskStatus | null {
    const row = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          and(
            eq(TaskQueueTable.id, input.taskID),
            eq(TaskQueueTable.session_id, input.sessionID),
            eq(TaskQueueTable.source, input.source),
          ),
        )
        .get(),
    )
    return row ? queuedTaskStatusFromRow(row) : null
  }

  export function getStatusByID(taskID: string): QueuedTaskStatus | null {
    const row = Database.use((db) => db.select().from(TaskQueueTable).where(eq(TaskQueueTable.id, taskID)).get())
    return row ? queuedTaskStatusFromRow(row) : null
  }

  function queuedTaskStatusFromRow(row: QueueTaskRow): QueuedTaskStatus {
    return {
      taskID: row.id,
      sessionID: row.session_id,
      status: row.status,
      source: row.source,
      prompt: row.prompt,
      error: row.error_message ?? null,
      startedAt: row.time_started ?? null,
      completedAt: row.time_completed ?? null,
      updatedAt: row.time_updated,
    }
  }

  export async function executePrompt(
    raw: { sessionID: string; prompt: unknown; source?: string },
    hooks?: { beforeLoop?: () => void | Promise<void> },
  ) {
    const input = z
      .object({
        sessionID: Identifier.schema("session"),
        prompt: z.unknown(),
        source: z.string().optional(),
      })
      .parse(raw)
    await assertSessionLineageInCurrentProject(input.sessionID)
    const prompt = stampTaskQueueWakeReason(
      validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "new"),
      { queueSource: input.source },
    )
    const promptInput = {
      sessionID: input.sessionID,
      ...prompt,
    }
    if (hooks) return SessionPrompt.prompt(promptInput, hooks)
    return SessionPrompt.prompt(promptInput)
  }

  export async function executeCompaction(
    raw: z.input<typeof ExecuteCompactionInput>,
    hooks?: { beforeLoop?: () => void | Promise<void> },
  ) {
    const input = ExecuteCompactionInput.parse(raw)
    const session = await assertSessionLineageInCurrentProject(input.sessionID)
    const source = await compactionSource(input.sessionID, input.sourceUserMessageID)
    const { SessionCompaction } = await import("@/session/compaction")
    await SessionCompaction.create({
      sessionID: input.sessionID,
      source,
      model: input.model,
      auto: input.auto,
      overflow: input.overflow,
      focus: input.focus,
    })
    return SessionContext.provide(session, () =>
      provideInitializedProjectExecution({
        directory: session.directory,
        fn: async () => {
          const beforeLoop = hooks?.beforeLoop?.()
          if (beforeLoop) await beforeLoop
          return SessionPrompt.loop(
            input.auto ? { sessionID: input.sessionID } : { sessionID: input.sessionID, result_mode: "summary" },
          )
        },
      }),
    )
  }

  export function enqueuePrompt(raw: z.input<typeof EnqueuePromptInput>) {
    const input = EnqueuePromptInput.parse(raw)
    const id = Identifier.ascending("task")
    const prompt = stampTaskQueueWakeReason(
      validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "new"),
      { queueTaskID: id, queueSource: input.source ?? "api" },
    )
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(TaskQueueTable)
        .values({
          id,
          session_id: input.sessionID,
          prompt: firstText(prompt),
          priority: input.priority ?? "normal",
          status: "queued",
          source: input.source ?? "api",
          metadata: {
            kind: "session_prompt",
            input: { ...prompt },
          },
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    log.info("task queued", { id, sessionID: input.sessionID, source: input.source ?? "api" })
    publishQueueChanged({ queueTaskID: id, sessionID: input.sessionID, status: "queued", sequence: now })
    requestDrain("enqueuePrompt")
    return id
  }

  export function enqueueCompaction(raw: z.input<typeof EnqueueCompactionInput>) {
    const input = EnqueueCompactionInput.parse(raw)
    const id = Identifier.ascending("task")
    const now = Date.now()
    const payload = StoredCompactionInput.parse({
      sourceUserMessageID: input.sourceUserMessageID,
      model: input.model,
      auto: input.auto,
      overflow: input.overflow,
      focus: input.focus,
    })
    Database.use((db) =>
      db
        .insert(TaskQueueTable)
        .values({
          id,
          session_id: input.sessionID,
          prompt: compactionPrompt(payload),
          priority: input.priority ?? "normal",
          status: "queued",
          source: input.source ?? "api",
          metadata: {
            kind: "session_compaction",
            input: payload,
          },
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    log.info("compaction task queued", { id, sessionID: input.sessionID, source: input.source ?? "api" })
    requestDrain("enqueueCompaction")
    return id
  }

  export async function enqueuePromptAfterPersistingUserMessage(raw: z.input<typeof EnqueuePromptInput>) {
    const input = EnqueuePromptInput.parse(raw)
    const id = Identifier.ascending("task")
    const prompt = stampTaskQueueWakeReason(
      validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "new"),
      { queueTaskID: id, queueSource: input.source ?? "api" },
    )
    const userMessage = await SessionPrompt.prompt({
      sessionID: input.sessionID,
      ...prompt,
      noReply: true,
    })
    const now = Date.now()
    Database.use((db) =>
      db
        .insert(TaskQueueTable)
        .values({
          id,
          session_id: input.sessionID,
          prompt: firstText(prompt),
          priority: input.priority ?? "normal",
          status: "queued",
          source: input.source ?? "api",
          metadata: {
            kind: "session_wake",
            messageID: userMessage.info.id,
            input: { ...prompt },
          },
          time_created: now,
          time_updated: now,
        })
        .run(),
    )
    log.info("task queued after visible user message persisted", {
      id,
      sessionID: input.sessionID,
      messageID: userMessage.info.id,
      source: input.source ?? "api",
    })
    publishQueueChanged({ queueTaskID: id, sessionID: input.sessionID, status: "queued", sequence: now })
    requestDrain("enqueuePromptAfterPersistingUserMessage")
    return { taskID: id, userMessage }
  }

  export function cancelSessionPrompts(input: {
    sessionIDs: string[]
    reason: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
    source?: string
  }): number {
    const sessionIDs = normalizeSessionIDs(input.sessionIDs)
    if (sessionIDs.length === 0) return 0
    const now = Date.now()
    const reason = input.reason
    const cancelledRows = Database.use((db) => {
      const where: SQL[] = [inArray(TaskQueueTable.session_id, sessionIDs), eq(TaskQueueTable.status, "queued")]
      if (input.source) where.push(eq(TaskQueueTable.source, input.source))
      return db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: reason,
          time_updated: now,
        })
        .where(and(...where))
        .returning({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id })
        .all()
    })
    if (Instance.current()) {
      for (const row of cancelledRows) clearRecoveryTimer(row.id)
    }
    for (const row of cancelledRows) {
      publishQueueChanged({ queueTaskID: row.id, sessionID: row.sessionID, status: "failed", sequence: now })
    }
    const inFlightCancellations = requestInFlightCancellation({
      sessionIDs,
      reason,
      source: input.source,
      origin: input.origin,
    })
    return cancelledRows.length + inFlightCancellations
  }

  /** Project whether an exact Session owns queued or running prompt work. */
  export function sessionPromptsInterruptible(input: { sessionID: string; source?: string }): boolean {
    const where: SQL[] = [
      eq(TaskQueueTable.session_id, input.sessionID),
      inArray(TaskQueueTable.status, ["queued", "running"]),
    ]
    if (input.source) where.push(eq(TaskQueueTable.source, input.source))
    const row = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id })
        .from(TaskQueueTable)
        .where(and(...where))
        .limit(1)
        .get(),
    )
    return row !== undefined
  }

  export function failQueuedOrRunning(input: { taskIDs: string[]; reason: string }): number {
    const taskIDs = [...new Set(input.taskIDs.filter((id) => id.length > 0))]
    if (taskIDs.length === 0) return 0
    const current = Instance.current() ? state() : undefined
    const candidates = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id, status: TaskQueueTable.status })
        .from(TaskQueueTable)
        .where(and(inArray(TaskQueueTable.id, taskIDs), inArray(TaskQueueTable.status, ["queued", "running"])))
        .all(),
    )
    const ownedRunning = candidates.filter((row) => row.status === "running" && current?.inFlight.has(row.id))
    const immediateIDs = candidates
      .filter((row) => row.status === "queued" || (current !== undefined && !current.inFlight.has(row.id)))
      .map((row) => row.id)
    const now = Date.now()
    const rows =
      immediateIDs.length === 0
        ? []
        : Database.use((db) =>
            db
              .update(TaskQueueTable)
              .set({
                status: "failed",
                error_message: input.reason,
                time_completed: now,
                time_updated: now,
              })
              .where(
                and(inArray(TaskQueueTable.id, immediateIDs), inArray(TaskQueueTable.status, ["queued", "running"])),
              )
              .returning({ id: TaskQueueTable.id })
              .all(),
          )
    if (current) {
      const directoryBySession = new Map(
        Database.use((db) =>
          db
            .select({ id: SessionTable.id, directory: SessionTable.directory })
            .from(SessionTable)
            .where(
              inArray(
                SessionTable.id,
                ownedRunning.map((row) => row.sessionID),
              ),
            )
            .all(),
        ).map((session) => [session.id, session.directory]),
      )
      for (const row of rows) clearRecoveryTimer(row.id)
      for (const row of ownedRunning) {
        clearRecoveryTimer(row.id)
        const inFlight = current.inFlight.get(row.id)
        if (!inFlight) continue
        inFlight.cancellationReason = input.reason
        inFlight.cancellationOrigin = createExecutionCancellationOrigin({
          actor: "scheduler",
          source: "task.lifecycle",
          surface: "scheduler",
          requestID: row.id,
          reason: input.reason,
          targetSessionID: row.sessionID,
          queueOccurrenceID: row.id,
        })
        inFlight.cleanup()
        const directory = directoryBySession.get(row.sessionID)
        if (directory && inFlight.promptOwner) {
          SessionPrompt.cancelOwned(row.sessionID, directory, inFlight.promptOwner, {
            origin: inFlight.cancellationOrigin,
          })
        }
      }
    }
    return rows.length + ownedRunning.length
  }

  export async function awaitSessionPromptsIdle(input: {
    sessionIDs: string[]
    source?: string
    inactivityTimeoutMs?: number
  }) {
    const sessionIDs = normalizeSessionIDs(input.sessionIDs)
    if (sessionIDs.length === 0) return
    if (!Instance.current()) return
    const sessions = new Set(sessionIDs)
    const inactivityTimeoutMs = input.inactivityTimeoutMs
    if (inactivityTimeoutMs !== undefined && (!Number.isInteger(inactivityTimeoutMs) || inactivityTimeoutMs <= 0)) {
      throw new Error(`awaitSessionPromptsIdle: invalid inactivityTimeoutMs ${inactivityTimeoutMs}`)
    }
    const pollMs =
      inactivityTimeoutMs === undefined ? 250 : Math.min(250, Math.max(25, Math.floor(inactivityTimeoutMs / 10)))
    let lastSignature = ""
    let idleDeadline = inactivityTimeoutMs === undefined ? undefined : Date.now() + inactivityTimeoutMs
    while (true) {
      const running = [...state().inFlight.entries()]
        .filter(([, task]) => sessions.has(task.sessionID))
        .filter(([, task]) => !input.source || task.source === input.source)
      if (running.length === 0) {
        const stillRunning = Database.use((db) => {
          const where: SQL[] = [inArray(TaskQueueTable.session_id, sessionIDs), eq(TaskQueueTable.status, "running")]
          if (input.source) where.push(eq(TaskQueueTable.source, input.source))
          return db
            .select({ id: TaskQueueTable.id })
            .from(TaskQueueTable)
            .where(and(...where))
            .all()
        })
        if (stillRunning.length === 0) return
        throw new Error(
          `queue task(s) still running without an in-flight prompt: ${stillRunning.map((row) => row.id).join(", ")}`,
        )
      }
      if (inactivityTimeoutMs === undefined) {
        await Promise.all(running.map(([, task]) => task.promise))
        continue
      }
      const signature = running
        .map(([id, task]) => {
          const status = SessionStatus.get(task.sessionID)
          const activity = SessionStatus.getActivity(task.sessionID)
          return [
            id,
            task.sessionID,
            task.cancellationReason ?? "",
            status.type,
            status.type === "terminal" ? status.reason : "",
            activity?.last_activity_at ?? 0,
          ].join(":")
        })
        .sort()
        .join("|")
      if (signature !== lastSignature) {
        lastSignature = signature
        idleDeadline = Date.now() + inactivityTimeoutMs
      }
      if (Date.now() > idleDeadline!) {
        throw new AwaitTimeoutError(
          `TaskQueueService.awaitSessionPromptsIdle inactive (${running.map(([id]) => id).join(", ")})`,
          inactivityTimeoutMs,
        )
      }
      await Promise.race([
        Promise.allSettled(running.map(([, task]) => task.promise)),
        new Promise<void>((resolve) => setTimeout(resolve, pollMs)),
      ])
    }
  }

  function normalizeSessionIDs(sessionIDs: string[]) {
    return [...new Set(sessionIDs.map((id) => String(id || "").trim()).filter(Boolean))]
  }

  function requestInFlightCancellation(input: {
    sessionIDs: string[]
    reason: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
    source?: string
  }) {
    if (!Instance.current()) return 0
    const sessions = new Set(input.sessionIDs)
    const liveSessions = Database.use((db) =>
      db
        .select({
          id: SessionTable.id,
          directory: SessionTable.directory,
        })
        .from(SessionTable)
        .where(inArray(SessionTable.id, input.sessionIDs))
        .all(),
    )
    const directoryBySession = new Map(liveSessions.map((session) => [session.id, session.directory]))
    let cancelled = 0
    for (const task of state().inFlight.values()) {
      if (!sessions.has(task.sessionID)) continue
      if (input.source && task.source !== input.source) continue
      task.cancellationReason = input.reason
      task.cancellationOrigin = { ...input.origin, targetSessionID: task.sessionID }
      task.cleanup()
      cancelled += 1
      const directory = directoryBySession.get(task.sessionID)
      if (directory && task.promptOwner) {
        SessionPrompt.cancelOwned(task.sessionID, directory, task.promptOwner, {
          origin: task.cancellationOrigin,
        })
      }
    }
    return cancelled
  }

  function assertInFlightNotCancelled(task: typeof TaskQueueTable.$inferSelect, inFlight: InFlightTask) {
    if (!inFlight.cancellationReason) return
    throw new Error(inFlight.cancellationReason || `queue task ${task.id} cancelled`)
  }

  function requestDrain(reason: string) {
    const directory = Instance.directory
    void runTaskQueueOwner(directory, () => drainUntilIdle(reason)).catch((error) => {
      log.error("explicit queue drain failed", {
        reason,
        error: message(error),
      })
    })
  }

  async function drainUntilIdle(reason: string) {
    while (true) {
      const started = await drainReadyTasks(reason)
      const current = state()
      const running = [...current.inFlight.values()].map((task) => task.promise)
      if (started.length === 0 && running.length === 0) return
      await Promise.allSettled([...started, ...running])
    }
  }

  async function drainReadyTasks(reason: string) {
    const current = state()
    if (current.draining) {
      return current.activeDrain ? await current.activeDrain : []
    }
    current.draining = true
    current.activeDrain = run(Date.now(), reason)
    try {
      return await current.activeDrain
    } finally {
      current.activeDrain = undefined
      current.draining = false
    }
  }

  async function run(now: number, reason: string): Promise<Promise<void>[]> {
    const current = state()
    await recover(now)
    const limit = Math.max(0, concurrency() - current.inFlight.size)
    if (limit === 0) return []
    const list = await claimReadyTasks(limit)
    if (list.length === 0) return []
    log.info("claimed queued tasks", { count: list.length, projectID: Instance.project.id, reason })
    const started = list.map((task) => {
      let running!: Promise<void>
      const inFlight: InFlightTask = {
        promise: Promise.resolve(),
        cleanup: () => {},
        sessionID: task.session_id,
        source: task.source,
      }
      current.inFlight.set(task.id, inFlight)
      running = execute(task, inFlight)
        .catch(async (error) => {
          try {
            await fail(task, inFlight.cancellationReason ? new Error(inFlight.cancellationReason) : error)
          } catch (failError) {
            log.error("task failure handler failed", {
              id: task.id,
              sessionID: task.session_id,
              originalError: message(error),
              error: message(failError),
            })
          }
        })
        .finally(() => {
          if (current.inFlight.get(task.id)?.promise === running) {
            current.inFlight.delete(task.id)
          }
          releaseProgressSubscriptionIfIdle(current)
        })
      inFlight.promise = running
      return running
    })
    return started
  }

  async function claimReadyTasks(
    limit: number,
    validateSession: (sessionID: string) => Promise<Session.Info> = assertSessionLineageInCurrentProject,
  ): Promise<QueueTaskRow[]> {
    const list: Array<typeof TaskQueueTable.$inferSelect> = []
    while (list.length < limit) {
      const queued = pending(limit - list.length)
      if (queued.length === 0) break
      for (const item of queued) {
        const valid = await validateSession(item.session_id).catch(async (error) => {
          await failQueued(item.id, item.session_id, error)
          return undefined
        })
        if (!valid) continue
        const task = claim(item.id, item.session_id)
        if (!task) continue
        list.push(task)
        if (list.length >= limit) break
      }
    }
    return list
  }

  function concurrency() {
    const raw = process.env[CONCURRENCY_ENV]
    if (!raw) return CONCURRENCY_LIMIT
    const value = Number(raw)
    if (!Number.isFinite(value)) return CONCURRENCY_LIMIT
    if (value < 1) return 1
    return Math.min(Math.floor(value), CONCURRENCY_LIMIT)
  }

  function pending(limit: number) {
    return Database.use((db) =>
      db
        .select({
          id: TaskQueueTable.id,
          session_id: TaskQueueTable.session_id,
        })
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'queued'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )
            AND NOT EXISTS (
              SELECT 1
              FROM a2a_task_queue running
              WHERE running.session_id = ${TaskQueueTable.session_id}
                AND running.status = 'running'
            )
            AND ${isBestQueuedTaskForSession()}`,
        )
        .orderBy(
          sql`CASE ${TaskQueueTable.priority}
            WHEN 'high' THEN 0
            WHEN 'normal' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END`,
          TaskQueueTable.time_created,
          TaskQueueTable.id,
        )
        .limit(limit)
        .all(),
    )
  }

  function claim(id: string, sessionID: string) {
    const now = Date.now()
    const task = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "running",
          time_started: now,
          time_completed: null,
          error_message: null,
          time_updated: now,
        })
        .where(
          sql`${TaskQueueTable.id} = ${id}
            AND ${TaskQueueTable.session_id} = ${sessionID}
            AND ${TaskQueueTable.status} = 'queued'
            AND NOT EXISTS (
              SELECT 1
              FROM a2a_task_queue running
              WHERE running.session_id = ${sessionID}
                AND running.status = 'running'
                AND running.id != ${id}
            )
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )
            AND ${isBestQueuedTaskForSession()}`,
        )
        .returning()
        .get(),
    )
    if (task) scheduleRunningRecoveryTimer(task, "claim")
    return task
  }

  function isBestQueuedTaskForSession(): SQL {
    return sql`NOT EXISTS (
      SELECT 1
      FROM a2a_task_queue better
      WHERE better.session_id = ${TaskQueueTable.session_id}
        AND better.status = 'queued'
        AND (
          CASE better.priority
            WHEN 'high' THEN 0
            WHEN 'normal' THEN 1
            WHEN 'low' THEN 2
            ELSE 3
          END
            < CASE ${TaskQueueTable.priority}
                WHEN 'high' THEN 0
                WHEN 'normal' THEN 1
                WHEN 'low' THEN 2
                ELSE 3
              END
          OR (
            CASE better.priority
              WHEN 'high' THEN 0
              WHEN 'normal' THEN 1
              WHEN 'low' THEN 2
              ELSE 3
            END
              = CASE ${TaskQueueTable.priority}
                  WHEN 'high' THEN 0
                  WHEN 'normal' THEN 1
                  WHEN 'low' THEN 2
                  ELSE 3
                END
            AND (
              better.time_created < ${TaskQueueTable.time_created}
              OR (
                better.time_created = ${TaskQueueTable.time_created}
                AND better.id < ${TaskQueueTable.id}
              )
            )
          )
        )
    )`
  }

  function ensureProgressSubscription(input: { directory: string; projectID: string }) {
    const current = state()
    if (current.progressListener) return
    const handler = (envelope: QueueProgressEnvelope) => {
      const event = envelope.payload
      if (!event || typeof event.type !== "string") return
      if (event.type === Session.Event.Created.type) {
        const info = event.properties?.info
        if (
          !info ||
          typeof info.id !== "string" ||
          typeof info.projectID !== "string" ||
          info.projectID !== input.projectID ||
          typeof info.parentID !== "string"
        ) {
          return
        }
        for (const task of current.inFlight.values()) {
          if (task.progressSessionIDs?.has(info.parentID)) task.progressSessionIDs.add(info.id)
        }
        return
      }
      if (event.type !== Message.Event.PartDelta.type && event.type !== Message.Event.PartUpdated.type) return
      const properties = event.properties ?? {}
      const sessionID =
        (typeof properties.sessionID === "string" && properties.sessionID) ||
        (typeof properties.part === "object" &&
          properties.part &&
          typeof properties.part.sessionID === "string" &&
          properties.part.sessionID) ||
        undefined
      if (!sessionID) return
      for (const [taskID, task] of current.inFlight) {
        if (!task.progressSessionIDs?.has(sessionID)) continue
        void runTaskQueueOwner(input.directory, async () => touch(taskID)).catch((error) => {
          log.warn("task progress touch failed", {
            id: taskID,
            sessionID: task.sessionID,
            error: message(error),
          })
        })
      }
    }
    current.progressListener = handler
    GlobalBus.on("event", handler)
  }

  function releaseProgressSubscriptionIfIdle(current: ReturnType<typeof state>) {
    if (current.inFlight.size > 0 || !current.progressListener) return
    GlobalBus.off("event", current.progressListener)
    current.progressListener = undefined
  }

  async function execute(task: typeof TaskQueueTable.$inferSelect, inFlight: InFlightTask) {
    const queueDirectory = Instance.directory
    inFlight.promptOwner ??= SessionPrompt.promptOwner(task.session_id)
    await assertSessionLineageInCurrentProject(task.session_id)
    inFlight.promptOwner = SessionPrompt.promptOwner(task.session_id) ?? inFlight.promptOwner
    const queueProjectID = Instance.project.id
    const progressSessionIDs = new Set(
      await Session.treeInProject({
        sessionID: task.session_id,
        projectID: queueProjectID,
      }),
    )
    const metadata = RawTaskMetadata.safeParse(task.metadata)
    if (!metadata.success) {
      throw new Error("invalid queue metadata")
    }
    // Chunk-driven heartbeat: touch() only fires when the queued prompt's
    // durable session tree makes progress (message.part.delta /
    // message.part.updated). The initial tree comes from Session.treeInProject;
    // authoritative session.created events extend the task-local membership
    // while execution is live. This replaces the old exact-root filter, which
    // cancelled a parent prompt after the inactivity window even while its
    // delegated child Agent was actively streaming. It also preserves the
    // removal of the unconditional setInterval(touch, 15s), which masked a
    // genuinely dead upstream stream. One shared subscription per active
    // Project queue multiplexes progress across all in-flight tasks, so the
    // supported 100-way concurrency does not create 100 EventEmitter
    // listeners. GlobalBus covers worktree Instances too (session lives in
    // one, executor in another).
    inFlight.progressSessionIDs = progressSessionIDs
    ensureProgressSubscription({ directory: queueDirectory, projectID: queueProjectID })
    const cleanup = () => {
      inFlight.progressSessionIDs = undefined
    }
    inFlight.cleanup = cleanup
    const beforeLoop = () => {
      SessionPrompt.capturePromptOwner(task.session_id, queueDirectory)
      assertInFlightNotCancelled(task, inFlight)
    }
    try {
      assertInFlightNotCancelled(task, inFlight)
      await SessionPrompt.withPromptOwnerCapture(
        (owner) => {
          inFlight.promptOwner = owner
          if (inFlight.cancellationReason && inFlight.cancellationOrigin) {
            SessionPrompt.cancelOwned(task.session_id, queueDirectory, owner, {
              origin: inFlight.cancellationOrigin,
            })
          }
        },
        async () => {
          let result: Message.WithParts
          if (metadata.data.kind === "session_prompt") {
            result = await executeStoredPrompt(
              {
                sessionID: task.session_id,
                prompt: metadata.data.input,
                source: "task-queue-service",
              },
              {
                beforeLoop,
              },
            )
          } else if (metadata.data.kind === "session_wake") {
            result = await executeSessionWake(task.session_id, metadata.data.messageID, {
              beforeLoop,
            })
          } else {
            result = await executeCompaction(
              {
                sessionID: task.session_id,
                ...StoredCompactionInput.parse(metadata.data.input),
              },
              {
                beforeLoop,
              },
            )
          }
          if (result.info.role === "assistant" && (result.info.error !== undefined || result.info.finish === "error")) {
            throw new SessionPromptReplyError(task.session_id, result.info.id, result.info.error)
          }
        },
      )
      assertInFlightNotCancelled(task, inFlight)
    } catch (error) {
      cleanup()
      if (inFlight.promptOwner) {
        SessionPrompt.cancelOwned(task.session_id, queueDirectory, inFlight.promptOwner, {
          origin: createExecutionCancellationOrigin({
            actor: "runtime",
            source: "runtime.prompt_owner",
            surface: "scheduler",
            requestID: task.id,
            reason: message(error),
            targetSessionID: task.session_id,
            queueOccurrenceID: task.id,
          }),
        })
        await SessionPrompt.waitForOwnedFinish(task.session_id, queueDirectory, inFlight.promptOwner)
      }
      throw error
    }
    cleanup()
    const now = Date.now()
    const completed = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "completed",
          time_completed: now,
          error_message: null,
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .get(),
    )
    if (!completed) {
      log.info("task finished after queue row was no longer running", { id: task.id, sessionID: task.session_id })
      return
    }
    clearRecoveryTimer(task.id)
    log.info("task completed", { id: task.id, sessionID: task.session_id })
    await publishTaskQueueCompleted(task.id, task.session_id)
  }

  async function executeSessionWake(
    sessionID: string,
    messageID: string,
    hooks?: { beforeLoop?: () => void | Promise<void> },
  ) {
    const session = await assertSessionLineageInCurrentProject(sessionID)
    return SessionContext.provide(session, () =>
      provideInitializedProjectExecution({
        directory: session.directory,
        fn: async () => {
          const beforeLoop = hooks?.beforeLoop?.()
          if (beforeLoop) await beforeLoop
          return SessionPrompt.loop({ sessionID, reply_to_message_id: messageID })
        },
      }),
    )
  }

  async function recover(now: number) {
    const timeout = await runTimeout()
    const stale = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND (
              ${TaskQueueTable.time_updated} <= ${now - timeout}
              OR (
                ${TaskQueueTable.time_updated} IS NULL
                AND ${TaskQueueTable.time_started} <= ${now - timeout}
              )
            )
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all(),
    )
    if (stale.length === 0) return 0
    let recovered = 0
    for (const task of stale) {
      const session = await assertSessionLineageInCurrentProject(task.session_id).catch(async (error) => {
        await fail(task, error)
        return undefined
      })
      if (!session) continue
      const inFlight = state().inFlight.get(task.id)
      const cancellationReason = "task timed out while running"
      const cancellationOrigin = createExecutionCancellationOrigin({
        actor: "scheduler",
        source: "task.queue_timeout",
        surface: "scheduler",
        requestID: task.id,
        reason: cancellationReason,
        targetSessionID: session.id,
        queueOccurrenceID: task.id,
      })
      if (inFlight) {
        inFlight.cancellationReason = cancellationReason
        inFlight.cancellationOrigin = cancellationOrigin
      }
      const promptCancelled = inFlight?.promptOwner
        ? await terminateOwnedSessionPromptInScope({
            session,
            owner: inFlight.promptOwner,
            origin: cancellationOrigin,
            handle: "TaskQueueService.recover",
          })
        : false
      const failed = Database.use((db) =>
        db
          .update(TaskQueueTable)
          .set({
            status: "failed",
            time_completed: now,
            error_message: cancellationReason,
            time_updated: now,
          })
          .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
          .returning({ id: TaskQueueTable.id })
          .get(),
      )
      if (!failed) continue
      recovered += 1
      clearRecoveryTimer(task.id)
      log.warn("marked stale running task failed after inactivity", {
        id: task.id,
        sessionID: task.session_id,
      })
      log.warn("cancelled stale running session prompt after inactivity", {
        id: task.id,
        sessionID: task.session_id,
        promptCancelled,
      })
      if (inFlight) {
        inFlight.cleanup()
        state().inFlight.delete(task.id)
      }
    }
    return recovered
  }

  /**
   * A persisted `running` value describes the previous process's claim; it is
   * not proof that an executor is live in this process. Project bootstrap
   * releases every claim that has no real in-memory owner immediately.
   */
  function requeueOwnerlessRunningRows(): number {
    const current = state()
    const rows = Database.use((db) =>
      db
        .select({ id: TaskQueueTable.id, sessionID: TaskQueueTable.session_id })
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all(),
    )
    const ownerless = rows.filter((row) => !current.inFlight.has(row.id))
    if (ownerless.length === 0) return 0
    const ids = ownerless.map((row) => row.id)
    const now = Date.now()
    const released = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "queued",
          time_started: null,
          time_completed: null,
          error_message: null,
          time_updated: now,
        })
        .where(and(inArray(TaskQueueTable.id, ids), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .all(),
    )
    for (const row of released) clearRecoveryTimer(row.id)
    if (released.length > 0) {
      log.warn("released ownerless persisted queue claims after runtime restart", {
        taskIDs: released.map((row) => row.id),
      })
    }
    return released.length
  }

  async function assertSessionLineageInCurrentProject(sessionID: string): Promise<Session.Info> {
    return Session.assertLineageInProject({ sessionID, projectID: Instance.project.id })
  }

  async function fail(task: QueueTaskRow, error: unknown) {
    const now = Date.now()
    const failed = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: message(error),
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, task.id), eq(TaskQueueTable.status, "running")))
        .returning({ id: TaskQueueTable.id })
        .get(),
    )
    if (!failed) {
      log.info("task failed after queue row was no longer running", {
        id: task.id,
        sessionID: task.session_id,
        error: message(error),
      })
      return
    }
    clearRecoveryTimer(task.id)
    if (SessionStatus.get(task.session_id).type !== "terminal") {
      const errorMessage = message(error)
      const publications = await Promise.allSettled([
        Promise.resolve().then(() =>
          Bus.publish(Session.Event.Error, {
            sessionID: task.session_id,
            orderKey: sessionLifecycleOrderKey(task.session_id),
            error: new NamedError.Unknown({ message: errorMessage }).toObject(),
          }),
        ),
        Promise.resolve().then(() =>
          SessionStatus.set(task.session_id, {
            type: "terminal",
            reason: "error",
            error: errorMessage,
          }),
        ),
      ])
      const publicationFailures = publications.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      )
      if (publicationFailures.length > 0) {
        throw new AggregateError(
          publicationFailures,
          `Queue task ${task.id} terminal publication failed for ${publicationFailures.length} owner(s)`,
        )
      }
    }
    log.error("task failed", {
      id: task.id,
      sessionID: task.session_id,
      error: message(error),
    })
  }

  async function failQueued(id: string, sessionID: string, error: unknown) {
    const now = Date.now()
    const failed = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          status: "failed",
          time_completed: now,
          error_message: message(error),
          time_updated: now,
        })
        .where(and(eq(TaskQueueTable.id, id), eq(TaskQueueTable.status, "queued")))
        .returning({ id: TaskQueueTable.id })
        .get(),
    )
    if (!failed) return
    clearRecoveryTimer(id)
    log.error("queued task rejected before claim", {
      id,
      sessionID,
      error: message(error),
    })
  }

  async function publishTaskQueueCompleted(queueTaskID: string, sessionID: string) {
    await Bus.publish(TaskQueueEvent.Completed, { queueTaskID, sessionID }).catch((error) => {
      log.warn("task queue completed publish failed", {
        queueTaskID,
        sessionID,
        error: message(error),
      })
    })
  }

  function touch(id: string) {
    const updated = Database.use((db) =>
      db
        .update(TaskQueueTable)
        .set({
          time_updated: Date.now(),
        })
        .where(and(eq(TaskQueueTable.id, id), eq(TaskQueueTable.status, "running")))
        .returning()
        .get(),
    )
    if (updated) scheduleRunningRecoveryTimer(updated, "progress")
  }

  function scheduleRunningRecoveryTimers(reason: string) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(TaskQueueTable)
        .where(
          sql`${TaskQueueTable.status} = 'running'
            AND ${TaskQueueTable.session_id} IN (
              SELECT ${SessionTable.id}
              FROM ${SessionTable}
              WHERE ${SessionTable.project_id} = ${Instance.project.id}
            )`,
        )
        .all(),
    )
    for (const row of rows) scheduleRunningRecoveryTimer(row, reason)
  }

  function scheduleRunningRecoveryTimer(task: QueueTaskRow, reason: string) {
    const directory = Instance.directory
    const current = state()
    const token = current.recoveryTimerSequence + 1
    current.recoveryTimerSequence = token
    current.recoveryTimerTokens.set(task.id, token)
    const existing = current.recoveryTimers.get(task.id)
    if (existing) {
      clearTimeout(existing)
      current.recoveryTimers.delete(task.id)
    }
    void runAsInstanceActivity(async () => {
      const timeout = await runTimeout()
      if (state().recoveryTimerTokens.get(task.id) !== token) return
      const anchor = task.time_updated ?? task.time_started ?? Date.now()
      const delay = Math.max(0, anchor + timeout - Date.now())
      const timer = setTimeout(() => {
        void runTaskQueueOwner(directory, async () => {
          const latest = state()
          if (latest.recoveryTimerTokens.get(task.id) !== token) return
          latest.recoveryTimers.delete(task.id)
          latest.recoveryTimerTokens.delete(task.id)
          try {
            const recovered = await recover(Date.now())
            if (recovered > 0) await drainUntilIdle("task inactivity timeout")
            scheduleRunningRecoveryTimers(
              recovered > 0
                ? "task inactivity timeout recovered running rows"
                : "task inactivity timeout not yet stale",
            )
          } catch (error) {
            log.error("task inactivity recovery failed", {
              id: task.id,
              reason,
              error: message(error),
            })
            scheduleRunningRecoveryRetry(task, "task inactivity recovery failed")
          }
        }).catch((error) => {
          log.error("task inactivity recovery owner failed", {
            id: task.id,
            directory,
            reason,
            error: message(error),
          })
        })
      }, delay)
      timer.unref()
      const latest = state()
      if (latest.recoveryTimerTokens.get(task.id) !== token) {
        clearTimeout(timer)
        return
      }
      latest.recoveryTimers.set(task.id, timer)
    }).catch((error) => {
      log.error("task inactivity timer scheduling failed", {
        id: task.id,
        directory,
        reason,
        error: message(error),
      })
    })
  }

  function scheduleRunningRecoveryRetry(task: QueueTaskRow, reason: string) {
    const retryAnchor = Date.now()
    scheduleRunningRecoveryTimer(
      { ...task, time_updated: retryAnchor, time_started: task.time_started ?? retryAnchor },
      reason,
    )
  }

  function clearRecoveryTimer(taskID: string) {
    const current = state()
    const timer = current.recoveryTimers.get(taskID)
    if (timer) clearTimeout(timer)
    current.recoveryTimers.delete(taskID)
    current.recoveryTimerTokens.delete(taskID)
  }

  async function runTimeout() {
    // Single source: engine/config.ts ActivityConfig.task_queue_run_timeout_ms.
    // No OPENCORVUS_TASK_QUEUE_RUN_TIMEOUT_MS env — assistant.activity in
    // opencorvus.jsonc is the one place to adjust it (CLAUDE.md #25).
    const cfg = await EngineConfig.get()
    return cfg.activity.task_queue_run_timeout_ms
  }

  async function runTaskQueueOwner<R>(directory: string, fn: () => R): Promise<Awaited<R>> {
    return await runWithIndependentProjectIdentity({ directory, fn })
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function promptSchema() {
  return SessionPrompt.PromptInput.omit({
    sessionID: true,
  })
}

function validateQueuedPromptMaterialization<T extends z.infer<ReturnType<typeof promptSchema>>>(
  sessionID: string,
  prompt: T,
  mode: "new" | "stored",
): T {
  const row = Database.use((db) =>
    db
      .select({
        projectID: SessionTable.project_id,
        kind: SessionTable.kind,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
  if (!row) throw new Error(`Session not found: ${sessionID}`)
  if (!prompt.agent) {
    throw new Error(`Queued prompt for session ${sessionID} requires an explicit agent identity`)
  }
  const installedRuntimeContract = SessionPrompt.getSessionRuntimeContract(sessionID)
  SessionPrompt.validateSessionRuntimeContractForContinuation({
    sessionID,
    expectedSessionKind: row.kind,
    expectedAgentID: prompt.agent,
    requireWorkerTurnDescriptor: installedRuntimeContract?.identity.identityKind === "projected-worker",
    requireRuntimeContract: SessionPrompt.sessionKindRequiresRuntimeContract(row.kind),
  })
  if (mode === "stored" && !prompt.byteMaterializationProjectID) {
    throw new Error(`Stored queued prompt for session ${sessionID} is missing byteMaterializationProjectID`)
  }
  if (prompt.byteMaterializationProjectID && prompt.byteMaterializationProjectID !== row.projectID) {
    throw new Error(
      `SessionPrompt byteMaterializationProjectID ${prompt.byteMaterializationProjectID} does not match session project ${row.projectID}`,
    )
  }
  return {
    ...prompt,
    byteMaterializationProjectID: row.projectID,
  }
}

async function executeStoredPrompt(
  input: { sessionID: string; prompt: unknown; source?: string },
  hooks?: { beforeLoop?: () => void | Promise<void> },
) {
  const prompt = stampTaskQueueWakeReason(
    validateQueuedPromptMaterialization(input.sessionID, promptSchema().parse(input.prompt), "stored"),
    { queueSource: input.source },
  )
  const promptInput = {
    sessionID: input.sessionID,
    ...prompt,
  }
  if (hooks) return SessionPrompt.prompt(promptInput, hooks)
  return SessionPrompt.prompt(promptInput)
}

function stampTaskQueueWakeReason<T extends z.infer<ReturnType<typeof promptSchema>>>(
  prompt: T,
  reason: { queueTaskID?: string; queueSource?: string },
): T {
  const existing = SessionWake.WakeReason.safeParse(prompt.extra?.wake_reason)
  if (existing.success && existing.data.source === "scheduler.task_queue") return prompt
  return {
    ...prompt,
    extra: {
      ...(prompt.extra ?? {}),
      ...SessionWake.reasonExtra({
        source: "scheduler.task_queue",
        ...reason,
      }),
    },
  }
}

async function compactionSource(sessionID: string, sourceUserMessageID: string): Promise<Message.User> {
  const source = (await Session.messages({ sessionID })).find(
    (message) => message.info.id === sourceUserMessageID,
  )?.info
  if (!source) throw new Error(`Compaction source message not found: ${sourceUserMessageID}`)
  if (source.role !== "user") {
    throw new Error(`Compaction source message ${sourceUserMessageID} is ${source.role}, not user`)
  }
  return source
}

function compactionPrompt(input: z.infer<typeof StoredCompactionInput>) {
  const kind = input.auto ? "automatic compaction" : "manual summarize"
  return input.focus ? `${kind}: ${input.focus}` : kind
}

type PromptPart = z.infer<ReturnType<typeof promptSchema>>["parts"][number]
type TextPart = Extract<PromptPart, { type: "text" }>

function textPart(part: PromptPart): part is TextPart {
  return part.type === "text"
}

function firstText(input: z.infer<ReturnType<typeof promptSchema>>) {
  const part = input.parts.find(textPart)
  if (!part) return "[task]"
  if (part.text.trim().length === 0) return "[task]"
  return part.text
}
