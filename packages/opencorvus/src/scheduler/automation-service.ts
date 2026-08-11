import { Database, NotFoundError, and, desc, eq, inArray, isNull, ne, or, sql } from "@/storage/db"
import {
  AutomationProjectTargetTable,
  AutomationRunOutcomes,
  AutomationRunTable,
  AutomationTable,
} from "./automation.sql"
import { Recurrence } from "./recurrence"
import { Scheduler } from "./index"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { EngineTaskTable } from "@/engine/engine.sql"
import { persistQueuedTaskWaitWakeInTransaction } from "@/engine/queue"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Identifier } from "@/id/id"
import { Bus } from "@/bus"
import { Message } from "@/session/message"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { requireTaskWakeRuntime } from "./task-wake-runtime"
import { SessionStatus } from "@/session/status"
import { Worktree } from "@/worktree"
import { PanelSurface } from "@/panel/capability"
import { Provider } from "@/provider/provider"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { rightSidebarConversationExperience, type ConversationExperience } from "@/chat/identity"
import { NamedError } from "@opencorvus-ai/util/error"
import { ProjectTable } from "@/project/project.sql"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { GlobalConversationService } from "@/chat/global-chat-service"
import { ProjectInstanceContext } from "@/project/instance-context"
import { Filesystem } from "@/util/filesystem"
import z from "zod"
import { missionProductPillar } from "@/mission/session"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"
import { createHash } from "node:crypto"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"

export { AutomationRunOutcomes }

export type AutomationTarget =
  | { scope: "session"; sessionId: string }
  | { scope: "project"; projectIds: string[] }
  | { scope: "global" }

export type AutomationView = {
  id: string
  name: string
  target: AutomationTarget
  recurrence: string
  executionMode: "local" | "worktree"
  model: { providerID: string; modelID: string } | null
  reasoningEffort: string | null
  prompt: string
  status: "active" | "paused"
  lastRun: number | null
  nextRun: number
  failureCount: number
  lastError: string | null
}

export type CreateAutomationInput = {
  name: string
  target: AutomationTarget
  recurrence: string
  executionMode?: "local" | "worktree"
  model?: { providerID: string; modelID: string }
  reasoningEffort?: string
  prompt: string
}

export type UpdateAutomationInput = {
  id: string
  name?: string
  target?: AutomationTarget
  recurrence?: string
  executionMode?: "local" | "worktree"
  model?: { providerID: string; modelID: string } | null
  reasoningEffort?: string | null
  prompt?: string
  status?: "active" | "paused"
}

export type AutomationRunView = {
  id: string
  automationId: string
  fireId: string
  targetScope: AutomationTarget["scope"]
  targetProjectId: string | null
  session: {
    id: string
    title: string
    directory: string
    kind: Session.Info["kind"]
    experience: ConversationExperience | null
    productPillar: ProductPillar | null
  } | null
  outcome: (typeof AutomationRunOutcomes)[number]
  startedAt: number
  completedAt: number | null
  error: string | null
}

export type CreateDelayedSessionWakeInput = {
  name: string
  prompt: string
  projectId: string
  sessionId: string
  durationMs: number
  surface?: string
}

export type CreateTaskWakeInput = {
  name: string
  reason: string
  projectId: string
  taskId: string
  durationMs: number
}

export type ConsumedAutomationWaits = {
  jobIDs: string[]
}

export const AutomationRunningConflictError = NamedError.create(
  "AutomationRunningConflictError",
  z.object({
    message: z.string(),
    automationID: z.string(),
  }),
)

/**
 * AutomationService polls due automations and executes them with lease-based claims.
 *
 * Guarantees:
 * - public recurring definitions are global and processed by one global poller
 * - private delayed wakes retain exact project ownership
 * - job state is committed after successful wake (no one-shot loss on failure)
 * - failed jobs are retried with bounded exponential backoff
 */
export namespace AutomationService {
  let wakeSessionForTest: typeof SessionWake.wake | undefined
  const log = Log.create({ service: "automation-service" })

  const POLL_INTERVAL_MS = 1_000
  const LEASE_MS = 2 * 60 * 1000
  const LEASE_RENEW_MS = 30 * 1000
  const HEARTBEAT_BUSY_RETRY_MS = 30 * 1000
  const MAX_BACKOFF_MS = 5 * 60 * 1000
  const CONCURRENCY_ENV = "OPENCORVUS_AUTOMATION_CONCURRENCY"
  const CONCURRENCY_DEFAULT = 4
  const CONCURRENCY_MAX = 32

  const state = createInstanceState(
    () => ({
      running: false,
      activityUnsubscribers: [] as Array<() => void>,
    }),
    async (entry) => {
      for (const unsubscribe of entry.activityUnsubscribers.splice(0)) unsubscribe()
    },
    "automation-service",
  )
  let globalRunning = false

  export function init() {
    initGlobal()
    installActivitySubscriptions()
    log.info("automation project hooks initialized", { projectID: Instance.project.id })
  }

  export function initGlobal() {
    Scheduler.register({
      id: "automation-service.poll",
      interval: POLL_INTERVAL_MS,
      runAtStart: true,
      run: poll,
      scope: "global",
    })
    log.info("global automation service initialized")
  }

  export async function runDueNow() {
    await poll()
  }

  export function list(): AutomationView[] {
    const rows = Database.use((db) =>
      db
        .select()
        .from(AutomationTable)
        .where(ne(AutomationTable.kind, "delay"))
        .orderBy(AutomationTable.next_run, AutomationTable.id)
        .all(),
    )
    return rows.map(view)
  }

  export function listRuns(id: string): AutomationRunView[] {
    assertPublicAutomation(id)
    return listRunsForAutomation(id)
  }

  function listRunsForAutomation(id: string, fireID?: string): AutomationRunView[] {
    return Database.use((db) =>
      db
        .select({
          id: AutomationRunTable.id,
          automationId: AutomationRunTable.automation_id,
          fireId: AutomationRunTable.fire_id,
          targetScope: AutomationRunTable.target_scope,
          targetProjectId: AutomationRunTable.project_id,
          outcome: AutomationRunTable.outcome,
          startedAt: AutomationRunTable.started_at,
          completedAt: AutomationRunTable.completed_at,
          error: AutomationRunTable.error,
          sessionID: SessionTable.id,
          sessionTitle: SessionTable.title,
          sessionDirectory: SessionTable.directory,
          sessionKind: SessionTable.kind,
          sessionMetadata: SessionTable.metadata,
        })
        .from(AutomationRunTable)
        .leftJoin(SessionTable, eq(SessionTable.id, AutomationRunTable.session_id))
        .where(
          fireID
            ? and(eq(AutomationRunTable.automation_id, id), eq(AutomationRunTable.fire_id, fireID))
            : eq(AutomationRunTable.automation_id, id),
        )
        .orderBy(desc(AutomationRunTable.started_at), desc(AutomationRunTable.id))
        .all(),
    ).map((row) => ({
      id: row.id,
      automationId: row.automationId,
      fireId: row.fireId,
      targetScope: row.targetScope,
      targetProjectId: row.targetProjectId ?? null,
      session: row.sessionID
        ? {
            id: row.sessionID,
            title: row.sessionTitle!,
            directory: row.sessionDirectory!,
            kind: row.sessionKind!,
            experience:
              rightSidebarConversationExperience({
                kind: row.sessionKind!,
                metadata: row.sessionMetadata,
              }) ?? null,
            productPillar:
              row.sessionKind === "mission"
                ? missionProductPillar({ metadata: row.sessionMetadata ?? undefined })
                : null,
          }
        : null,
      outcome: row.outcome,
      startedAt: row.startedAt,
      completedAt: row.completedAt ?? null,
      error: row.error ?? null,
    }))
  }

  function view(row: typeof AutomationTable.$inferSelect): AutomationView {
    if (row.kind === "delay" || !row.recurrence) {
      throw new Error(`Automation ${row.id} is not a public recurring automation`)
    }
    return {
      id: row.id,
      name: row.name,
      target: targetForRow(row),
      recurrence: row.recurrence,
      executionMode: row.execution_mode,
      model:
        row.model_provider_id && row.model_id ? { providerID: row.model_provider_id, modelID: row.model_id } : null,
      reasoningEffort: row.reasoning_effort ?? null,
      prompt: row.prompt,
      status: row.status,
      lastRun: row.last_run,
      nextRun: row.next_run,
      failureCount: row.failure_count,
      lastError: row.last_error ?? null,
    }
  }

  function targetForRow(row: typeof AutomationTable.$inferSelect): AutomationTarget {
    if (row.scope === "session" && row.session_id) return { scope: "session", sessionId: row.session_id }
    if (row.scope === "global") return { scope: "global" }
    if (row.scope === "project") {
      const projectIds = Database.use((db) =>
        db
          .select({ projectID: AutomationProjectTargetTable.project_id })
          .from(AutomationProjectTargetTable)
          .where(eq(AutomationProjectTargetTable.automation_id, row.id))
          .orderBy(AutomationProjectTargetTable.position, AutomationProjectTargetTable.project_id)
          .all(),
      ).map((target) => target.projectID)
      return { scope: "project", projectIds }
    }
    throw new Error(`Automation ${row.id} has invalid public target`)
  }

  async function assertSessionInProject(input: { sessionId?: string; projectId: string }) {
    const sessionId = input.sessionId
    if (!sessionId) return
    await Session.assertLineageInProject({ sessionID: sessionId, projectID: input.projectId })
  }

  async function assertTaskRootSessionInProject(input: { taskId: string; projectId: string }) {
    const task = Database.use((db) =>
      db
        .select({ id: EngineTaskTable.id, sessionID: EngineTaskTable.session_id })
        .from(EngineTaskTable)
        .where(and(eq(EngineTaskTable.id, input.taskId), eq(EngineTaskTable.project_id, input.projectId)))
        .get(),
    )
    if (!task) throw new NotFoundError({ message: `Task not found: ${input.taskId}` })
    if (!task.sessionID) throw new Error(`Task ${input.taskId} has no root session; cannot schedule task wake.`)
    const rootSession = await Session.assertLineageInProject({ sessionID: task.sessionID, projectID: input.projectId })
    return { ...task, rootSession }
  }

  export async function create(input: CreateAutomationInput): Promise<{ id: string; name: string; nextRun: number }> {
    await assertPublicInput(input)
    const now = Date.now()
    const recurrence = Recurrence.normalize(input.recurrence)
    const nextRun = Recurrence.nextRun(recurrence, now)
    const id = Identifier.ascending("automation")
    Database.transaction((tx) => {
      tx.insert(AutomationTable)
        .values({
          id,
          project_id: null,
          session_id: input.target.scope === "session" ? input.target.sessionId : null,
          name: input.name,
          kind: "recurring",
          scope: input.target.scope,
          recurrence,
          execution_mode: input.target.scope === "session" ? "local" : (input.executionMode ?? "local"),
          model_provider_id: input.model?.providerID,
          model_id: input.model?.modelID,
          reasoning_effort: input.reasoningEffort,
          prompt: input.prompt,
          status: "active",
          next_run: nextRun,
        })
        .run()
      if (input.target.scope === "project") {
        tx.insert(AutomationProjectTargetTable)
          .values(
            input.target.projectIds.map((projectID, position) => ({
              automation_id: id,
              project_id: projectID,
              position,
            })),
          )
          .run()
      }
    })
    return { id, name: input.name, nextRun }
  }

  export async function update(input: UpdateAutomationInput): Promise<AutomationView> {
    const current = assertPublicAutomation(input.id)
    const updateStartedAt = Date.now()
    if (current.lease_owner && current.lease_until > updateStartedAt) {
      throw new AutomationRunningConflictError({
        message: `Automation ${input.id} cannot be updated while it is running`,
        automationID: input.id,
      })
    }
    const currentTarget = targetForRow(current)
    const next = {
      name: input.name ?? current.name,
      target: input.target ?? currentTarget,
      recurrence: input.recurrence ?? current.recurrence ?? "",
      executionMode: input.executionMode ?? current.execution_mode,
      model:
        input.model === undefined
          ? current.model_provider_id && current.model_id
            ? { providerID: current.model_provider_id, modelID: current.model_id }
            : undefined
          : (input.model ?? undefined),
      reasoningEffort:
        input.reasoningEffort === undefined
          ? (current.reasoning_effort ?? undefined)
          : (input.reasoningEffort ?? undefined),
      prompt: input.prompt ?? current.prompt,
      status: input.status ?? current.status,
    }
    await assertPublicInput({
      name: next.name,
      target: next.target,
      recurrence: next.recurrence,
      executionMode: next.executionMode,
      model: next.model,
      reasoningEffort: next.reasoningEffort,
      prompt: next.prompt,
    })
    const nextRun =
      next.status === "active" && (input.recurrence !== undefined || current.status === "paused")
        ? Recurrence.nextRun(next.recurrence, Date.now())
        : current.next_run
    const committedAt = Date.now()
    const row = Database.transaction((tx) => {
      const updated = tx
        .update(AutomationTable)
        .set({
          name: next.name,
          kind: "recurring",
          scope: next.target.scope,
          recurrence: Recurrence.normalize(next.recurrence),
          execution_mode: next.target.scope === "session" ? "local" : next.executionMode,
          model_provider_id: next.model?.providerID,
          model_id: next.model?.modelID,
          reasoning_effort: next.reasoningEffort,
          prompt: next.prompt,
          session_id: next.target.scope === "session" ? next.target.sessionId : null,
          status: next.status,
          next_run: nextRun,
          last_error: input.recurrence !== undefined ? null : current.last_error,
          failure_count: input.recurrence !== undefined ? 0 : current.failure_count,
        })
        .where(
          sql`${AutomationTable.id} = ${input.id}
            AND ${AutomationTable.kind} != 'delay'
            AND (${AutomationTable.lease_until} <= ${committedAt} OR ${AutomationTable.lease_owner} IS NULL)`,
        )
        .returning()
        .get()
      if (!updated) return undefined
      tx.delete(AutomationProjectTargetTable).where(eq(AutomationProjectTargetTable.automation_id, input.id)).run()
      if (next.target.scope === "project") {
        tx.insert(AutomationProjectTargetTable)
          .values(
            next.target.projectIds.map((projectID, position) => ({
              automation_id: input.id,
              project_id: projectID,
              position,
            })),
          )
          .run()
      }
      return updated
    })
    if (!row) {
      assertPublicAutomation(input.id)
      throw new AutomationRunningConflictError({
        message: `Automation ${input.id} began running before its update could commit`,
        automationID: input.id,
      })
    }
    return view(row)
  }

  export async function runNow(id: string): Promise<AutomationRunView[]> {
    return runNowWithExecutor(id, executeWithRuntimeSettlement)
  }

  async function runNowWithExecutor(
    id: string,
    executeFire: (
      job: typeof AutomationTable.$inferSelect,
      owner: string,
      now: number,
      reschedule: boolean,
    ) => Promise<string>,
  ): Promise<AutomationRunView[]> {
    const automation = assertPublicAutomation(id)
    if (
      automation.scope === "session" &&
      automation.session_id &&
      ["streaming", "retry"].includes(SessionStatus.get(automation.session_id).type)
    ) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} cannot run while session ${automation.session_id} is busy`,
        automationID: id,
      })
    }
    const now = Date.now()
    const owner = `manual:${process.pid}:${now}`
    const row = Database.use((db) =>
      db
        .update(AutomationTable)
        .set({ lease_owner: owner, lease_until: now + LEASE_MS })
        .where(
          sql`${AutomationTable.id} = ${id}
            AND ${AutomationTable.kind} != 'delay'
            AND (${AutomationTable.lease_until} <= ${now} OR ${AutomationTable.lease_owner} IS NULL)`,
        )
        .returning()
        .get(),
    )
    if (!row) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} is already running`,
        automationID: id,
      })
    }
    const fireID = await executeFire(row, owner, now, false)
    const runs = listRunsForAutomation(id, fireID)
    if (runs.length === 0) throw new Error(`Automation ${id} completed without run records`)
    return runs
  }

  export const TestHooks = {
    runNowWithExecutor,
    claim,
    executeClaimedDueOccurrence(input: {
      job: typeof AutomationTable.$inferSelect
      owner: string
      now: number
      runtimeSignal?: AbortSignal
    }) {
      return execute(input.job, input.owner, input.now, true, input.runtimeSignal ?? new AbortController().signal)
    },
    createLeaseFence: createAutomationLeaseFence,
    installLeaseRenewTimerFactory(factory: LeaseRenewTimerFactory): Disposable {
      if (leaseRenewTimerFactoryForTest) throw new Error("Automation lease renew timer factory is already installed")
      leaseRenewTimerFactoryForTest = factory
      return {
        [Symbol.dispose]() {
          if (leaseRenewTimerFactoryForTest === factory) leaseRenewTimerFactoryForTest = undefined
        },
      }
    },
    installWakeExecutor(executor: typeof SessionWake.wake): Disposable {
      if (wakeSessionForTest) throw new Error("Automation wake executor is already installed")
      wakeSessionForTest = executor
      return {
        [Symbol.dispose]() {
          if (wakeSessionForTest === executor) wakeSessionForTest = undefined
        },
      }
    },
    installFailurePersistenceHook(hook: (phase: "before" | "after") => void | Promise<void>): Disposable {
      if (failurePersistenceHookForTest) throw new Error("Automation failure persistence test hook is already installed")
      failurePersistenceHookForTest = hook
      return {
        [Symbol.dispose]() {
          if (failurePersistenceHookForTest === hook) failurePersistenceHookForTest = undefined
        },
      }
    },
    executeWithRuntimeSettlement,
  }

  function assertPublicAutomation(id: string) {
    const row = Database.use((db) =>
      db
        .select()
        .from(AutomationTable)
        .where(and(eq(AutomationTable.id, id), ne(AutomationTable.kind, "delay")))
        .get(),
    )
    if (!row) throw new NotFoundError({ message: `Automation not found: ${id}` })
    return row
  }

  async function assertPublicInput(input: CreateAutomationInput) {
    if (!input.name.trim()) throw new Error("Automation name is required")
    if (!input.prompt.trim()) throw new Error("Automation prompt is required")
    Recurrence.parse(input.recurrence)
    if (input.target.scope === "session" && input.executionMode === "worktree") {
      throw new Error("Session automation executes in its exact conversation and requires local execution mode")
    }
    if (input.target.scope === "session") {
      await Session.get(input.target.sessionId)
    }
    if (input.target.scope === "project") {
      const projectIds = [...new Set(input.target.projectIds)]
      if (projectIds.length === 0 || projectIds.length !== input.target.projectIds.length) {
        throw new Error("Project automation requires one or more unique project IDs")
      }
      const projects = Database.use((db) =>
        projectIds.map((projectID) =>
          db.select({ id: ProjectTable.id }).from(ProjectTable).where(eq(ProjectTable.id, projectID)).get(),
        ),
      )
      if (projects.some((project) => !project))
        throw new NotFoundError({ message: "Automation target project not found" })
    }
    if (input.model && (!input.model.providerID.trim() || !input.model.modelID.trim())) {
      throw new Error("Automation model requires providerID and modelID")
    }
    if (!input.model && input.reasoningEffort) {
      throw new Error("Automation reasoning effort requires an explicit model")
    }
    if (input.model && input.target.scope !== "global") {
      const modelInput = input.model
      const target = input.target
      const directories =
        target.scope === "session"
          ? [(await Session.get(target.sessionId)).directory]
          : Database.use((db) =>
              target.projectIds.map(
                (projectID) =>
                  db
                    .select({ worktree: ProjectTable.worktree })
                    .from(ProjectTable)
                    .where(eq(ProjectTable.id, projectID))
                    .get()!.worktree,
              ),
            )
      for (const directory of directories) {
        await runInTargetProject({
          directory,
          fn: async () => {
            const model = await Provider.getModel(modelInput.providerID, modelInput.modelID)
            if (input.reasoningEffort && !model.variants?.[input.reasoningEffort]) {
              throw new Error(
                `Automation reasoning effort ${input.reasoningEffort} is not available for ${modelInput.providerID}/${modelInput.modelID}`,
              )
            }
          },
        })
      }
    }
  }

  export async function createDelayedSessionWake(input: CreateDelayedSessionWakeInput): Promise<{
    id: string
    name: string
    nextRun: number
  }> {
    await assertSessionInProject({ sessionId: input.sessionId, projectId: input.projectId })
    assertDuration(input.durationMs)
    const now = Date.now()
    const nextRun = now + input.durationMs
    const id = Identifier.ascending("automation")
    Database.use((db) =>
      db
        .insert(AutomationTable)
        .values({
          id,
          project_id: input.projectId,
          session_id: input.sessionId,
          name: input.name,
          kind: "delay",
          surface: input.surface ? PanelSurface.parse(input.surface) : undefined,
          prompt: input.prompt,
          status: "active",
          next_run: nextRun,
        })
        .run(),
    )
    return { id, name: input.name, nextRun }
  }

  export async function createTaskWake(
    input: CreateTaskWakeInput,
  ): Promise<{ id: string; name: string; nextRun: number }> {
    await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    assertDuration(input.durationMs)
    const now = Date.now()
    const nextRun = now + input.durationMs
    const id = Identifier.ascending("automation")
    Database.use((db) =>
      db
        .insert(AutomationTable)
        .values({
          id,
          project_id: input.projectId,
          task_id: input.taskId,
          name: input.name,
          kind: "delay",
          prompt: input.reason,
          status: "active",
          next_run: nextRun,
        })
        .run(),
    )
    return { id, name: input.name, nextRun }
  }

  export function remove(id: string): { id: string; name: string } {
    const current = assertPublicAutomation(id)
    const now = Date.now()
    if (current.lease_owner && current.lease_until > now) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} is currently running`,
        automationID: id,
      })
    }
    const row = Database.use((db) =>
      db
        .delete(AutomationTable)
        .where(
          and(
            eq(AutomationTable.id, id),
            ne(AutomationTable.kind, "delay"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .returning({ id: AutomationTable.id, name: AutomationTable.name })
        .get(),
    )
    if (!row) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} began running before it could be deleted`,
        automationID: id,
      })
    }
    return row
  }

  export async function consumePendingTaskWaits(input: {
    taskId: string
    projectId: string
    reason: string
    now?: number
  }): Promise<ConsumedAutomationWaits> {
    const now = input.now ?? Date.now()
    const pending = Database.use((db) =>
      db
        .select({ id: AutomationTable.id })
        .from(AutomationTable)
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.task_id, input.taskId),
            eq(AutomationTable.status, "active"),
            eq(AutomationTable.kind, "delay"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .all(),
    )
    if (pending.length === 0) return { jobIDs: [] }
    await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    const rows = Database.use((db) =>
      db
        .delete(AutomationTable)
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.task_id, input.taskId),
            eq(AutomationTable.status, "active"),
            eq(AutomationTable.kind, "delay"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .returning({ id: AutomationTable.id })
        .all(),
    )
    const jobIDs = rows.map((row) => row.id)
    if (jobIDs.length > 0) {
      log.info("pending task wait consumed", {
        taskID: input.taskId,
        projectID: input.projectId,
        jobIDs,
        reason: input.reason,
      })
    }
    return { jobIDs }
  }

  export async function consumePendingSessionWaits(input: {
    sessionId: string
    projectId: string
    reason: string
    now?: number
  }): Promise<ConsumedAutomationWaits> {
    await Session.assertLineageInProject({ sessionID: input.sessionId, projectID: input.projectId })
    const now = input.now ?? Date.now()
    const rows = Database.use((db) =>
      db
        .delete(AutomationTable)
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.session_id, input.sessionId),
            isNull(AutomationTable.task_id),
            eq(AutomationTable.kind, "delay"),
            eq(AutomationTable.status, "active"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .returning({ id: AutomationTable.id })
        .all(),
    )
    const jobIDs = rows.map((row) => row.id)
    if (jobIDs.length > 0) {
      log.info("pending session wait consumed", {
        sessionID: input.sessionId,
        projectID: input.projectId,
        jobIDs,
        reason: input.reason,
      })
    }
    return { jobIDs }
  }

  export async function triggerTaskWaitFromActivity(input: {
    taskId: string
    projectId: string
    source: string
    detail: string
  }): Promise<ConsumedAutomationWaits & { dispatchResult?: string }> {
    const task = await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    const owner = Identifier.ascending("call")
    const claimed = await claimPendingTaskWaitsFromActivity({
      taskId: input.taskId,
      projectId: input.projectId,
      owner,
    })
    const jobIDs = claimed.map((job) => job.id)
    if (jobIDs.length === 0) return { jobIDs }
    let dispatchResult: string
    try {
      dispatchResult = await runInTargetProject({
        directory: task.rootSession.directory,
        fn: () =>
          requireTaskWakeRuntime().dispatchTaskLoop({
            taskID: input.taskId,
            event: {
              note: renderTaskWaitEarlyActivityNote({
                source: input.source,
                detail: input.detail,
                jobIDs,
              }),
              taskWaitActivity: {
                source: input.source,
                detail: input.detail,
                jobIDs,
              },
            },
          }),
      })
    } catch (error) {
      for (const job of claimed) await fail(job, owner, error)
      throw error
    }
    Database.use((db) =>
      db
        .delete(AutomationTable)
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.task_id, input.taskId),
            eq(AutomationTable.lease_owner, owner),
          ),
        )
        .run(),
    )
    log.info("pending task wait triggered early from activity", {
      taskID: input.taskId,
      projectID: input.projectId,
      source: input.source,
      jobIDs,
      dispatchResult,
    })
    return { jobIDs, dispatchResult }
  }

  async function claimPendingTaskWaitsFromActivity(input: {
    taskId: string
    projectId: string
    owner: string
    now?: number
  }) {
    const now = input.now ?? Date.now()
    const pending = Database.use((db) =>
      db
        .select({ id: AutomationTable.id })
        .from(AutomationTable)
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.task_id, input.taskId),
            eq(AutomationTable.status, "active"),
            eq(AutomationTable.kind, "delay"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .all(),
    )
    if (pending.length === 0) return []
    await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    return Database.use((db) =>
      db
        .update(AutomationTable)
        .set({
          lease_until: now + LEASE_MS,
          lease_owner: input.owner,
        })
        .where(
          and(
            eq(AutomationTable.project_id, input.projectId),
            eq(AutomationTable.task_id, input.taskId),
            eq(AutomationTable.status, "active"),
            eq(AutomationTable.kind, "delay"),
            or(isNull(AutomationTable.lease_owner), sql`${AutomationTable.lease_until} <= ${now}`),
          ),
        )
        .returning()
        .all(),
    )
  }

  async function poll(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (globalRunning) {
      log.info("poll skipped while previous run is still active")
      return
    }
    globalRunning = true
    await run(Date.now(), signal).finally(() => {
      globalRunning = false
    })
  }

  function installActivitySubscriptions() {
    const s = state()
    if (s.activityUnsubscribers.length > 0) return
    s.activityUnsubscribers.push(
      Bus.subscribe(Message.Event.Created, (event) => handleMessageCreated(event.properties.info)),
      Bus.subscribe(Message.Event.PartUpdated, (event) => handlePartUpdated(event.properties.part)),
    )
  }

  async function handleMessageCreated(info: Message.VisibleInfo): Promise<void> {
    if (info.role !== "user") return
    if (isSchedulerWakeMessage(info)) return
    await consumePendingSessionWaits({
      sessionId: info.sessionID,
      projectId: Instance.project.id,
      reason: "user message created before scheduled wait due time",
    })
    if (isTaskOperatorMessage(info)) return
    const taskID = await taskIDForDirectSchedulerActivity(info.sessionID)
    if (!taskID) return
    await triggerTaskWaitFromActivity({
      taskId: taskID,
      projectId: Instance.project.id,
      source: "message.created",
      detail: `user message ${info.id} created in session ${info.sessionID}`,
    })
  }

  async function handlePartUpdated(part: Message.Part): Promise<void> {
    if (part.type !== "tool") return
    if (part.tool === "wait") return
    if (part.state.status !== "completed" && part.state.status !== "error") return
    const taskID = await taskIDForDirectSchedulerActivity(part.sessionID)
    if (!taskID) return
    await triggerTaskWaitFromActivity({
      taskId: taskID,
      projectId: Instance.project.id,
      source: "message.part.updated",
      detail: `terminal ${part.tool} tool result ${part.id} arrived in session ${part.sessionID}`,
    })
  }

  export async function taskIDForDirectSchedulerActivity(sessionID: string): Promise<string | undefined> {
    const taskID = taskIDForSession(sessionID)
    if (!taskID) return undefined
    const projectID = Instance.project.id
    const [task, session] = await Promise.all([
      assertTaskRootSessionInProject({ taskId: taskID, projectId: projectID }),
      Session.getInProject({ sessionID, projectID }),
    ])
    if (session.kind !== "orchestrator" || session.parentID !== task.sessionID) return undefined
    return taskID
  }

  function isSchedulerWakeMessage(info: Message.User): boolean {
    const reason = info.extra?.wake_reason
    if (!reason || typeof reason !== "object" || Array.isArray(reason)) return false
    const source = (reason as Record<string, unknown>).source
    return typeof source === "string" && source.startsWith("scheduler.")
  }

  function isTaskOperatorMessage(info: Message.User): boolean {
    const provenance = TaskRootMessageProvenance.safeParse(info.extra?.task_root_message)
    return provenance.success && provenance.data.kind === "operator"
  }

  async function run(now: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const owner = `${process.pid}:${now}`
    const due = Database.use((db) =>
      db
        .select({ id: AutomationTable.id })
        .from(AutomationTable)
        .where(
          sql`${AutomationTable.status} = 'active'
            AND ${AutomationTable.next_run} <= ${now}
            AND (${AutomationTable.lease_until} <= ${now} OR ${AutomationTable.lease_until} IS NULL)`,
        )
        .orderBy(AutomationTable.next_run, AutomationTable.id)
        .all(),
    )

    if (due.length === 0) return
    log.info("found due automations", { count: due.length })

    const slots = Math.min(concurrency(), due.length)
    let offset = 0
    const pick = () => {
      const row = due[offset]
      offset += 1
      return row
    }

    await Promise.all(
      Array.from({ length: slots }, async () => {
        while (true) {
          signal?.throwIfAborted()
          const row = pick()
          if (!row) return
          const candidate = await validateDueAutomationBeforeClaim(row.id, now)
          if (!candidate) continue
          const job = claim(row.id, owner, now)
          if (!job) continue
          await executeWithRuntimeSettlement(job, owner, now, true, execute, signal).catch((error) => {
            signal?.throwIfAborted()
            return undefined
          })
        }
      }),
    )
  }

  async function validateDueAutomationBeforeClaim(id: string, now: number) {
    const job = Database.use((db) =>
      db
        .select()
        .from(AutomationTable)
        .where(
          sql`${AutomationTable.id} = ${id}
            AND ${AutomationTable.status} = 'active'
            AND ${AutomationTable.next_run} <= ${now}
            AND (${AutomationTable.lease_until} <= ${now} OR ${AutomationTable.lease_until} IS NULL)`,
        )
        .get(),
    )
    if (!job) return undefined
    if (
      job.scope === "session" &&
      job.session_id &&
      ["streaming", "retry"].includes(SessionStatus.get(job.session_id).type)
    ) {
      Database.use((db) =>
        db
          .update(AutomationTable)
          .set({ lease_until: now + HEARTBEAT_BUSY_RETRY_MS, lease_owner: null })
          .where(and(eq(AutomationTable.id, job.id), eq(AutomationTable.status, "active")))
          .run(),
      )
      log.info("session automation delayed while its conversation is busy", {
        automationID: job.id,
        sessionID: job.session_id,
        retryAt: new Date(now + HEARTBEAT_BUSY_RETRY_MS).toISOString(),
      })
      return undefined
    }
    try {
      await assertAutomationLineage(job)
      return job
    } catch (error) {
      await failBeforeLease(job, error)
      return undefined
    }
  }

  async function assertAutomationLineage(job: typeof AutomationTable.$inferSelect): Promise<void> {
    if (job.task_id) {
      if (!job.project_id) throw new Error(`Delayed task wake ${job.id} has no project owner`)
      await assertTaskRootSessionInProject({ taskId: job.task_id, projectId: job.project_id })
      return
    }
    if (job.kind === "delay" && job.session_id) {
      if (!job.project_id) throw new Error(`Delayed session wake ${job.id} has no project owner`)
      await Session.assertLineageInProject({ sessionID: job.session_id, projectID: job.project_id })
      return
    }
    if (job.scope === "session" && job.session_id) {
      await Session.get(job.session_id)
      return
    }
    if (job.scope === "project") {
      const target = targetForRow(job)
      if (target.scope !== "project" || target.projectIds.length === 0) {
        throw new Error(`Project automation ${job.id} has no target projects`)
      }
    }
  }

  function concurrency() {
    const raw = process.env[CONCURRENCY_ENV]
    if (!raw) return CONCURRENCY_DEFAULT
    const value = Number(raw)
    if (!Number.isFinite(value)) return CONCURRENCY_DEFAULT
    if (value < 1) return 1
    return Math.min(Math.floor(value), CONCURRENCY_MAX)
  }

  function claim(id: string, owner: string, now: number) {
    Database.use((db) =>
      db
        .update(AutomationTable)
        .set({
          lease_until: now + LEASE_MS,
          lease_owner: owner,
        })
        .where(
          sql`${AutomationTable.id} = ${id}
            AND ${AutomationTable.status} = 'active'
            AND ${AutomationTable.next_run} <= ${now}
            AND (${AutomationTable.lease_until} <= ${now} OR ${AutomationTable.lease_until} IS NULL)`,
        )
        .run(),
    )

    return Database.use((db) =>
      db
        .select()
        .from(AutomationTable)
        .where(and(eq(AutomationTable.id, id), eq(AutomationTable.lease_owner, owner)))
        .get(),
    )
  }

  async function execute(
    job: typeof AutomationTable.$inferSelect,
    owner: string,
    now: number,
    reschedule: boolean,
    runtimeSignal: AbortSignal,
  ): Promise<string> {
    const scheduledDue = reschedule ? job.next_run : now
    const fireID =
      job.kind === "delay" && job.task_id
        ? `cal_task_wait_${job.id}`
        : deterministicAutomationID("cal", job.id, String(scheduledDue))
    log.info("executing automation", { jobId: job.id, fireID, name: job.name, prompt: job.prompt.slice(0, 100) })

    const leaseFence = createAutomationLeaseFence(job.id, owner, fireID)
    const executionSignal = AbortSignal.any([leaseFence.signal, runtimeSignal])
    const leaseRenewTimer = startLeaseRenewTimer(() => leaseFence.renewOrAbort())

    try {
      if (job.kind === "delay") {
        const outcome = await executeDelayedWake(job, fireID, owner, executionSignal)
        if (!outcome.automationConsumed) {
          const consumed = Database.use((db) =>
            db
              .delete(AutomationTable)
              .where(and(eq(AutomationTable.id, job.id), eq(AutomationTable.lease_owner, owner)))
              .returning({ id: AutomationTable.id })
              .get(),
          )
          if (!consumed) {
            throw new AutomationRunningConflictError({
              message: `Automation ${job.id} lost its execution lease before one-shot completion`,
              automationID: job.id,
            })
          }
        }
        log.info("automation triggered session wake", {
          jobId: job.id,
          fireID,
          name: job.name,
          ...outcome,
          nextRun: "completed",
        })
        return fireID
      }

      if (!job.recurrence) throw new Error(`Automation ${job.id} has no recurrence rule`)
      const targets = await executionTargets(job)
      const runIDs = targets.map((target) => deterministicAutomationID("atr", fireID, automationTargetIdentity(target)))
      Database.immediateTransaction((db) => {
        const lease = db
          .select({ owner: AutomationTable.lease_owner })
          .from(AutomationTable)
          .where(eq(AutomationTable.id, job.id))
          .get()
        if (lease?.owner !== owner) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} lost its execution lease before fire reservation`,
            automationID: job.id,
          })
        }
        db.insert(AutomationRunTable)
          .values(
            targets.map((target, index) => ({
              id: runIDs[index],
              automation_id: job.id,
              fire_id: fireID,
              target_scope: target.scope,
              project_id: target.projectID,
              owner,
              outcome: "running" as const,
              started_at: now,
            })),
          )
          .onConflictDoNothing()
          .run()
        for (const runID of runIDs) {
          db.update(AutomationRunTable)
            .set({ owner, outcome: "running", completed_at: null, error: null, started_at: now })
            .where(and(eq(AutomationRunTable.id, runID), ne(AutomationRunTable.outcome, "succeeded")))
            .run()
        }
      })
      const reservedRuns = new Map(
        Database.use((db) =>
          db
            .select({
              id: AutomationRunTable.id,
              outcome: AutomationRunTable.outcome,
              sessionID: AutomationRunTable.session_id,
            })
            .from(AutomationRunTable)
            .where(inArray(AutomationRunTable.id, runIDs))
            .all(),
        ).map((run) => [run.id, run] as const),
      )
      let results: PromiseSettledResult<{ sessionID: string }>[] = []
      results = await Promise.allSettled(
        targets.map(async (target, index) => {
          const reserved = reservedRuns.get(runIDs[index]!)
          if (reserved?.outcome === "succeeded") {
            if (!reserved.sessionID) throw new Error(`Succeeded Automation run ${reserved.id} has no Session authority`)
            return { sessionID: reserved.sessionID }
          }
          const existing = findAutomationWake(job.id, fireID, target)
          if (existing) return { sessionID: await resumeAutomationWake(existing) }
          return executePublicWake(job, target, fireID, runIDs[index]!, owner, executionSignal)
        }),
      )
      const committedAt = Date.now()
      const failures = results
        .map((result, index) =>
          result.status === "rejected"
            ? {
                index,
                message: result.reason instanceof Error ? result.reason.message : String(result.reason),
              }
            : undefined,
        )
        .filter((failure): failure is { index: number; message: string } => !!failure)
      const error = failures.length > 0 ? failures.map((failure) => failure.message).join("; ") : null
      const retryAt = error ? automationRetryAt(job.failure_count + 1, committedAt) : 0
      const nextRun = error ? job.next_run : reschedule ? Recurrence.nextRun(job.recurrence, committedAt) : job.next_run
      Database.transaction((tx) => {
        const automation = tx
          .update(AutomationTable)
          .set({
            last_run: committedAt,
            next_run: nextRun,
            failure_count: error ? sql`${AutomationTable.failure_count} + 1` : 0,
            last_error: error,
            lease_until: retryAt,
            lease_owner: null,
          })
          .where(and(eq(AutomationTable.id, job.id), eq(AutomationTable.lease_owner, owner)))
          .returning({ id: AutomationTable.id })
          .get()
        if (!automation) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} lost its execution lease before completion`,
            automationID: job.id,
          })
        }
        results.forEach((result, index) => {
          const prior = tx
            .select({ outcome: AutomationRunTable.outcome, sessionID: AutomationRunTable.session_id })
            .from(AutomationRunTable)
            .where(eq(AutomationRunTable.id, runIDs[index]))
            .get()
          if (prior?.outcome === "succeeded") return
          const run = tx
            .update(AutomationRunTable)
            .set({
              session_id: result.status === "fulfilled" ? result.value.sessionID : (prior?.sessionID ?? null),
              outcome: result.status === "fulfilled" ? "succeeded" : "retry_wait",
              completed_at: result.status === "fulfilled" ? committedAt : null,
              error:
                result.status === "rejected"
                  ? result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason)
                  : null,
            })
            .where(
              and(
                eq(AutomationRunTable.id, runIDs[index]),
                eq(AutomationRunTable.owner, owner),
                eq(AutomationRunTable.outcome, "running"),
              ),
            )
            .returning({ id: AutomationRunTable.id })
            .get()
          if (!run) throw new Error(`Automation run ${runIDs[index]} was not running for lease owner ${owner}`)
        })
      })
      log.info("automation fire completed", {
        jobId: job.id,
        fireID,
        name: job.name,
        targets: targets.length,
        failures: failures.length,
        nextRun: new Date(nextRun).toISOString(),
        ...(retryAt ? { retryAt: new Date(retryAt).toISOString() } : {}),
      })
      return fireID
    } finally {
      leaseRenewTimer[Symbol.dispose]()
    }
  }

  function executeWithRuntimeSettlement(
    job: typeof AutomationTable.$inferSelect,
    owner: string,
    now: number,
    reschedule: boolean,
    executeFire: typeof execute = execute,
    lifecycleSignal?: AbortSignal,
  ): Promise<string> {
    const reservation = RuntimeExecutionSettlement.reserve(
      "scheduler_automation_fire",
      `automation-fire:${job.id}:${job.next_run}`,
    )
    const signal = lifecycleSignal ? AbortSignal.any([reservation.signal, lifecycleSignal]) : reservation.signal
    const operation = executeFire(job, owner, now, reschedule, signal).catch(async (error) => {
      await fail(job, owner, error)
      throw error
    })
    reservation.settleWith(operation)
    return operation
  }

  type ExecutionTarget = {
    scope: AutomationTarget["scope"]
    projectID: string | null
    directory?: string
    sessionID?: string
  }

  function deterministicAutomationID(prefix: "cal" | "atr" | "ses" | "msg" | "prt", ...parts: string[]): string {
    const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex")
    return `${prefix}_automation_${digest.slice(0, 32)}`
  }

  function automationTargetIdentity(target: ExecutionTarget): string {
    if (target.scope === "session") return `session:${target.sessionID}`
    if (target.scope === "project") return `project:${target.projectID}`
    return "global"
  }

  function automationTargetSessionID(target: ExecutionTarget, runID: string): string {
    return target.sessionID ?? deterministicAutomationID("ses", runID)
  }

  function findAutomationWake(
    jobID: string,
    fireID: string,
    target: ExecutionTarget,
  ): { sessionID: string; messageID: string } | undefined {
    const sessionID = automationTargetSessionID(
      target,
      deterministicAutomationID("atr", fireID, automationTargetIdentity(target)),
    )
    const messageID = deterministicAutomationID(
      "msg",
      deterministicAutomationID("atr", fireID, automationTargetIdentity(target)),
    )
    return findExactAutomationWake({ jobID, fireID, sessionID, messageID })
  }

  async function resumeAutomationWake(existing: { sessionID: string; messageID: string }): Promise<string> {
    const session = await Session.get(existing.sessionID)
    SessionWake.resumePersistedWake({
      sessionID: existing.sessionID,
      messageID: existing.messageID,
      directory: session.directory,
    })
    return existing.sessionID
  }

  function findExactAutomationWake(input: {
    jobID: string
    fireID: string
    sessionID: string
    messageID: string
  }): { sessionID: string; messageID: string } | undefined {
    const row = Database.use((db) =>
      db
        .select({ id: MessageTable.id, sessionID: MessageTable.session_id })
        .from(MessageTable)
        .where(
          and(
            eq(MessageTable.id, input.messageID),
            eq(MessageTable.session_id, input.sessionID),
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.source') = 'scheduler.automation'`,
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.jobID') = ${input.jobID}`,
            sql`json_extract(${MessageTable.data}, '$.extra.wake_reason.fireID') = ${input.fireID}`,
          ),
        )
        .get(),
    )
    return row ? { sessionID: row.sessionID, messageID: row.id } : undefined
  }

  async function executionTargets(job: typeof AutomationTable.$inferSelect): Promise<ExecutionTarget[]> {
    const target = targetForRow(job)
    if (target.scope === "session") {
      const session = await Session.get(target.sessionId)
      return [{ scope: "session", projectID: session.projectID, directory: session.directory, sessionID: session.id }]
    }
    if (target.scope === "global") return [{ scope: "global", projectID: null }]
    return target.projectIds.map((projectID) => {
      const project = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get())
      if (!project) throw new NotFoundError({ message: `Automation target project not found: ${projectID}` })
      return { scope: "project" as const, projectID, directory: project.worktree }
    })
  }

  async function executePublicWake(
    job: typeof AutomationTable.$inferSelect,
    target: ExecutionTarget,
    fireID: string,
    runID: string,
    owner: string,
    signal: AbortSignal,
  ): Promise<{ sessionID: string }> {
    const targetSessionID = automationTargetSessionID(target, runID)
    if (target.scope === "global") {
      let globalSession = await Session.get(targetSessionID).catch((error) => {
        if (error instanceof NotFoundError) return undefined
        throw error
      })
      if (!globalSession) {
        try {
          const created = await GlobalConversationService.create({
            experience: "chat",
            model: job.model_provider_id && job.model_id ? `${job.model_provider_id}/${job.model_id}` : undefined,
            sessionID: targetSessionID,
          })
          globalSession = created.session
        } catch (error) {
          globalSession = await Session.get(targetSessionID).catch(() => {
            throw error
          })
        }
      }
      return await runInTargetProject({
        directory: globalSession.directory,
        fn: async () => ({ sessionID: await wakeSession(job, fireID, globalSession.id, runID, runID, owner, signal) }),
      })
    }
    if (!target.directory) throw new Error(`Automation target ${target.projectID ?? target.scope} has no directory`)
    return await runInTargetProject({
      directory: target.directory,
      fn: async () => {
        if (target.scope === "session") {
          if (!target.sessionID) throw new Error(`Session automation ${job.id} has no session target`)
          return { sessionID: await wakeSession(job, fireID, target.sessionID, runID, runID, owner, signal) }
        }
        if (job.execution_mode === "worktree") {
          const worktree = await Worktree.create({ name: `automation-${job.id}`, reuseIfValid: true })
          return await Instance.provide({
            directory: worktree.directory,
            fn: async () => {
              await ensureAutomationTargetSession(targetSessionID, job.prompt)
              return { sessionID: await wakeSession(job, fireID, targetSessionID, runID, runID, owner, signal) }
            },
          })
        }
        await ensureAutomationTargetSession(targetSessionID, job.prompt)
        return { sessionID: await wakeSession(job, fireID, targetSessionID, runID, runID, owner, signal) }
      },
    })
  }

  async function ensureAutomationTargetSession(sessionID: string, prompt: string): Promise<void> {
    const existing = await Session.getInProject({ sessionID, projectID: Instance.project.id }).catch((error) => {
      if (error instanceof NotFoundError) return undefined
      throw error
    })
    if (existing) return
    try {
      await Session.createNext({
        id: sessionID,
        kind: "assistant",
        directory: Instance.directory,
        title: `Scheduled: ${prompt.slice(0, 60)}`,
      })
    } catch (error) {
      const converged = await Session.getInProject({ sessionID, projectID: Instance.project.id }).catch(() => undefined)
      if (!converged) throw error
    }
  }

  async function wakeSession(
    job: typeof AutomationTable.$inferSelect,
    fireID: string,
    sessionID: string,
    identityID: string,
    runID: string | undefined,
    owner: string,
    signal: AbortSignal,
  ): Promise<string> {
    const scope = job.kind === "delay" ? "session" : job.scope
    if (!scope) throw new Error(`Automation ${job.id} has no execution scope`)
    const messageID = deterministicAutomationID("msg", identityID)
    const textPartID = deterministicAutomationID("prt", identityID)
    return await (wakeSessionForTest ?? SessionWake.wake)({
      sessionID,
      messageID,
      textPartID,
      signal,
      prompt: job.prompt,
      author: "orchestrator",
      agent: job.agent === "default" ? undefined : job.agent,
      model:
        job.model_provider_id && job.model_id
          ? { providerID: job.model_provider_id, modelID: job.model_id }
          : undefined,
      variant: job.reasoning_effort ?? undefined,
      surface: persistedSurface(job.surface),
      commitBundle: (message, parts) => {
        if (message.id !== messageID || !parts.some((part) => part.id === textPartID)) {
          throw new Error(`Automation ${job.id} wake materialized identities outside fire ${fireID}`)
        }
        fenceAutomationWakeCommit({ automationID: job.id, runID, owner, sessionID: message.sessionID })
      },
      reason: {
        source: "scheduler.automation",
        jobID: job.id,
        jobName: job.name,
        fireID,
        scope,
        recurrence: job.recurrence,
      },
    })
  }

  function fenceAutomationWakeCommit(input: {
    automationID: string
    runID?: string
    owner: string
    sessionID: string
  }): void {
    Database.use((db) => {
      const lease = db
        .select({ owner: AutomationTable.lease_owner })
        .from(AutomationTable)
        .where(eq(AutomationTable.id, input.automationID))
        .get()
      if (lease?.owner !== input.owner) {
        throw new AutomationRunningConflictError({
          message: `Automation ${input.automationID} lost its lease before wake Message commit`,
          automationID: input.automationID,
        })
      }
      if (!input.runID) return
      const run = db
        .update(AutomationRunTable)
        .set({ session_id: input.sessionID })
        .where(
          and(
            eq(AutomationRunTable.id, input.runID),
            eq(AutomationRunTable.automation_id, input.automationID),
            eq(AutomationRunTable.owner, input.owner),
            eq(AutomationRunTable.outcome, "running"),
          ),
        )
        .returning({ id: AutomationRunTable.id })
        .get()
      if (!run) {
        throw new AutomationRunningConflictError({
          message: `Automation run ${input.runID} lost ownership before wake Message commit`,
          automationID: input.automationID,
        })
      }
    })
  }

  async function executeDelayedWake(
    job: typeof AutomationTable.$inferSelect,
    fireID: string,
    owner: string,
    signal: AbortSignal,
  ): Promise<{
    sessionID?: string
    taskID?: string
    wakeID?: string
    dispatchResult?: string
    dispatchError?: string
    automationConsumed?: true
  }> {
    if (job.task_id) {
      signal.throwIfAborted()
      if (!job.project_id) throw new Error(`Delayed task wake ${job.id} has no project owner`)
      const task = await assertTaskRootSessionInProject({ taskId: job.task_id, projectId: job.project_id })
      return await runInTargetProject({
        directory: task.rootSession.directory,
        fn: async () => {
          const committedAt = Date.now()
          const wakeID = Database.transaction((tx) => {
            const persistedWakeID = persistQueuedTaskWaitWakeInTransaction(tx, {
              taskID: job.task_id!,
              projectID: job.project_id!,
              jobID: job.id,
              fireID,
              dueAt: job.next_run,
              note: renderTaskWaitWakeNote(job, fireID),
              now: committedAt,
            })
            const consumed = tx
              .delete(AutomationTable)
              .where(
                and(
                  eq(AutomationTable.id, job.id),
                  eq(AutomationTable.project_id, job.project_id!),
                  eq(AutomationTable.task_id, job.task_id!),
                  eq(AutomationTable.kind, "delay"),
                  eq(AutomationTable.status, "active"),
                  eq(AutomationTable.lease_owner, owner),
                ),
              )
              .returning({ id: AutomationTable.id })
              .get()
            if (!consumed) {
              throw new AutomationRunningConflictError({
                message: `Automation ${job.id} lost its execution lease before Task wait ownership transfer`,
                automationID: job.id,
              })
            }
            return persistedWakeID
          })
          try {
            const dispatchResult = await requireTaskWakeRuntime().dispatchPersistedTaskLoop(job.task_id!)
            return { taskID: job.task_id!, wakeID, dispatchResult, automationConsumed: true as const }
          } catch (error) {
            const dispatchError = error instanceof Error ? error.message : String(error)
            log.error("scheduled Task wait ingress remains queued after delivery failure", {
              jobId: job.id,
              taskID: job.task_id!,
              wakeID,
              fireID,
              error: dispatchError,
              errorName: error instanceof Error ? error.name : undefined,
            })
            return {
              taskID: job.task_id!,
              wakeID,
              dispatchResult: "queued",
              dispatchError,
              automationConsumed: true as const,
            }
          }
        },
      })
    }

    if (!job.project_id) throw new Error(`Delayed session wake ${job.id} has no project owner`)
    const session = job.session_id
      ? await Session.assertLineageInProject({ sessionID: job.session_id, projectID: job.project_id })
      : undefined
    if (!session) throw new Error(`Delayed session wake ${job.id} has no Session target`)
    const identityID = deterministicAutomationID("atr", fireID, `session:${session.id}`)
    const existing = findExactAutomationWake({
      jobID: job.id,
      fireID,
      sessionID: session.id,
      messageID: deterministicAutomationID("msg", identityID),
    })
    if (existing) return { sessionID: await resumeAutomationWake(existing) }
    const project = Database.use((db) =>
      db
        .select({ worktree: ProjectTable.worktree })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, job.project_id!))
        .get(),
    )
    if (!project) throw new NotFoundError({ message: `Delayed wake project not found: ${job.project_id}` })
    const sessionID = await runInTargetProject({
      directory: session.directory ?? project.worktree,
      fn: () => wakeSession(job, fireID, session.id, identityID, undefined, owner, signal),
    })
    return { sessionID }
  }

  async function runInTargetProject<R>(input: { directory: string; fn: () => R }): Promise<Awaited<R>> {
    const current = ProjectInstanceContext.tryUse()
    if (current && Filesystem.resolve(current.directory) === Filesystem.resolve(input.directory)) {
      return await input.fn()
    }
    return await runWithInitializedIndependentProject(input)
  }

  function persistedSurface(value: string | null) {
    if (!value) return undefined
    return PanelSurface.parse(value)
  }

  function renew(id: string, owner: string): boolean {
    return !!Database.use((db) =>
      db
        .update(AutomationTable)
        .set({
          lease_until: Date.now() + LEASE_MS,
        })
        .where(and(eq(AutomationTable.id, id), eq(AutomationTable.lease_owner, owner)))
        .returning({ id: AutomationTable.id })
        .get(),
    )
  }

  function createAutomationLeaseFence(automationID: string, owner: string, fireID: string) {
    const controller = new AbortController()
    const lose = (cause: unknown) => {
      if (controller.signal.aborted) return
      const reason =
        cause instanceof AutomationRunningConflictError || cause instanceof Error ? cause : new Error(String(cause))
      controller.abort(reason)
      log.warn("automation lease fence lost", {
        automationID,
        fireID,
        owner,
        error: reason.message,
      })
    }
    return {
      signal: controller.signal,
      renewOrAbort(): boolean {
        try {
          if (renew(automationID, owner)) return true
          lose(
            new AutomationRunningConflictError({
              message: `Automation ${automationID} lost its execution lease during fire ${fireID}`,
              automationID,
            }),
          )
        } catch (error) {
          lose(error)
        }
        return false
      },
    }
  }

  type LeaseRenewTimerFactory = (renew: () => boolean) => Disposable
  let leaseRenewTimerFactoryForTest: LeaseRenewTimerFactory | undefined
  let failurePersistenceHookForTest: ((phase: "before" | "after") => void | Promise<void>) | undefined

  function startLeaseRenewTimer(renew: () => boolean): Disposable {
    if (leaseRenewTimerFactoryForTest) return leaseRenewTimerFactoryForTest(renew)
    const timer = setInterval(renew, LEASE_RENEW_MS)
    timer.unref()
    return {
      [Symbol.dispose]() {
        clearInterval(timer)
      },
    }
  }

  function automationRetryAt(step: number, now: number): number {
    return now + Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(step, 30))
  }

  async function fail(job: typeof AutomationTable.$inferSelect, owner: string, err: unknown): Promise<void> {
    await failurePersistenceHookForTest?.("before")
    const now = Date.now()
    const step = job.failure_count + 1
    const retryAt = automationRetryAt(step, now)
    const msg = err instanceof Error ? err.message : String(err)

    const finalized = Database.transaction((tx) => {
      const automation = tx
        .update(AutomationTable)
        .set({
          failure_count: sql`${AutomationTable.failure_count} + 1`,
          last_error: msg,
          lease_until: retryAt,
          lease_owner: null,
        })
        .where(and(eq(AutomationTable.id, job.id), eq(AutomationTable.lease_owner, owner)))
        .returning({ id: AutomationTable.id })
        .get()
      if (!automation) return false
      if (job.kind !== "delay") {
        const runs = tx
          .update(AutomationRunTable)
          .set({
            outcome: "retry_wait",
            completed_at: null,
            error: msg,
          })
          .where(
            and(
              eq(AutomationRunTable.automation_id, job.id),
              eq(AutomationRunTable.owner, owner),
              eq(AutomationRunTable.outcome, "running"),
            ),
          )
          .returning({ id: AutomationRunTable.id })
          .all()
      }
      return true
    })

    if (finalized) {
      log.error("automation execution failed", {
        jobId: job.id,
        name: job.name,
        error: msg,
        retryAt: new Date(retryAt).toISOString(),
      })
    }
    await failurePersistenceHookForTest?.("after")
  }

  async function failBeforeLease(job: typeof AutomationTable.$inferSelect, err: unknown): Promise<void> {
    const now = Date.now()
    const step = job.failure_count + 1
    const retryAt = automationRetryAt(step, now)
    const msg = err instanceof Error ? err.message : String(err)

    Database.use((db) =>
      db
        .update(AutomationTable)
        .set({
          failure_count: sql`${AutomationTable.failure_count} + 1`,
          last_error: msg,
          lease_until: retryAt,
          lease_owner: null,
        })
        .where(
          sql`${AutomationTable.id} = ${job.id}
            AND (${AutomationTable.lease_until} <= ${now} OR ${AutomationTable.lease_until} IS NULL)`,
        )
        .run(),
    )

    log.error("automation rejected before lease", {
      jobId: job.id,
      name: job.name,
      error: msg,
      retryAt: new Date(retryAt).toISOString(),
    })
  }

  function assertDuration(durationMs: number) {
    if (!Number.isInteger(durationMs) || durationMs <= 0) {
      throw new Error(`Invalid delay duration: ${durationMs}`)
    }
  }

  function renderTaskWaitWakeNote(job: typeof AutomationTable.$inferSelect, fireID: string) {
    return [
      "This is a scheduled task wait wake, not a user-authored message.",
      `wait_job_id=${job.id}`,
      `fire_id=${fireID}`,
      `due_at=${new Date(job.next_run).toISOString()}`,
      `Reason: ${job.prompt}`,
      "Read the current task snapshot and decide the next workflow action from present evidence.",
    ].join("\n")
  }

  function renderTaskWaitEarlyActivityNote(input: { source: string; detail: string; jobIDs: string[] }) {
    return [
      "This is an early task wait wake triggered by new task/session activity, not a user-authored message.",
      "The pending scheduled task wait was cancelled by newer task/session activity.",
      `activity_source=${input.source}`,
      `activity_detail=${input.detail}`,
      `wait_job_ids=${input.jobIDs.join(",")}`,
      "Read the current task snapshot and decide the next workflow action from present evidence.",
    ].join("\n")
  }
}
