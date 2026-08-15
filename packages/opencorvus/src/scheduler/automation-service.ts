import { Database, NotFoundError, and, desc, eq, inArray, isNull, ne, or, sql } from "@/storage/db"
import {
  AutomationDefinitionTombstoneTable,
  AutomationProjectTargetTable,
  AutomationRunReceiptTable,
  AutomationRunOutcomes,
  AutomationRunTable,
  AutomationTable,
} from "./automation.sql"
import { projectAutomationInTransaction, projectAutomationRunInTransaction, type AutomationRow } from "./automation-projection"
import { acquireControlLease, assertControlLeaseInTransaction, currentControlLeaseInTransaction, renewControlLease } from "@/engine/control-lease"
import { Recurrence } from "./recurrence"
import { Scheduler } from "./index"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { createSchedulerExecutionInactivityFence } from "./execution-inactivity"
import { taskWaitFireID } from "./task-wait-fire-identity"
import { EngineTaskTable } from "@/engine/engine.sql"
import { persistTaskWaitIngressInTransaction } from "@/engine/task-root-ingress-delivery"
import { findTask } from "@/engine/store"
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
import { missionProductPillar, requireMissionSession } from "@/mission/session"
import { admitMissionExecutionWake } from "@/mission/execution-closure"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v1"
import { createHash } from "node:crypto"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Config } from "@/config/config"

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
  let wakeSessionForTest: typeof SessionWake.wakeWithReceipt | undefined
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

  function latestAutomationDefinitionInTransaction(db: Database.TxOrDb, definitionID: string) {
    const row = db.select().from(AutomationTable)
      .where(eq(AutomationTable.definition_id, definitionID))
      .orderBy(desc(AutomationTable.revision), desc(AutomationTable.id)).get()
    const tombstone = db.select().from(AutomationDefinitionTombstoneTable)
      .where(eq(AutomationDefinitionTombstoneTable.definition_id, definitionID))
      .orderBy(desc(AutomationDefinitionTombstoneTable.revision), desc(AutomationDefinitionTombstoneTable.id)).get()
    return row && (!tombstone || row.revision > tombstone.revision) ? row : undefined
  }

  function currentAutomationDefinitions(db: Database.TxOrDb) {
    const latest = new Map<string, typeof AutomationTable.$inferSelect>()
    for (const row of db.select().from(AutomationTable)
      .orderBy(AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id)).all()) {
      if (!latest.has(row.definition_id)) latest.set(row.definition_id, row)
    }
    return [...latest.values()].filter((row) => {
      const tombstone = db.select({ revision: AutomationDefinitionTombstoneTable.revision })
        .from(AutomationDefinitionTombstoneTable)
        .where(eq(AutomationDefinitionTombstoneTable.definition_id, row.definition_id))
        .orderBy(desc(AutomationDefinitionTombstoneTable.revision)).get()
      return !tombstone || row.revision > tombstone.revision
    })
  }

  function appendAutomationTombstoneInTransaction(db: Database.TxOrDb, row: typeof AutomationTable.$inferSelect, now: number) {
    const id = Identifier.ascending("automation")
    db.insert(AutomationDefinitionTombstoneTable).values({
      id,
      definition_id: row.definition_id,
      revision: row.revision + 1,
      time_created: now,
    }).run()
    return id
  }

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
    const rows = Database.use((db) => currentAutomationDefinitions(db).filter((row) => row.kind !== "delay"))
      .map((row) => Database.use((db) => projectAutomationInTransaction(db, row))).sort((left, right) => left.next_run - right.next_run || left.id.localeCompare(right.id))
    return rows.map(view)
  }

  export function listRuns(id: string): AutomationRunView[] {
    assertPublicAutomation(id)
    return listRunsForAutomation(id)
  }

  function listRunsForAutomation(id: string, fireID?: string): AutomationRunView[] {
    const rows = Database.use((db) =>
      db
        .select({ run: AutomationRunTable })
        .from(AutomationRunTable)
        .innerJoin(AutomationTable, eq(AutomationTable.id, AutomationRunTable.automation_revision_id))
        .where(
          fireID
            ? and(eq(AutomationTable.definition_id, id), eq(AutomationRunTable.fire_id, fireID))
            : eq(AutomationTable.definition_id, id),
        )
        .orderBy(desc(AutomationRunTable.started_at), desc(AutomationRunTable.id))
        .all(),
    )
    return rows.map((row) => {
      const run = Database.use((db) => projectAutomationRunInTransaction(db, row.run))
      const session = run.session_id ? Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, run.session_id!)).get()) : undefined
      return ({
      id: run.id,
      automationId: run.automation_id,
      fireId: run.fire_id,
      targetScope: run.target_scope,
      targetProjectId: run.project_id ?? null,
      session: session
        ? {
            id: session.id,
            title: session.title,
            directory: session.directory,
            kind: session.kind,
            experience:
              rightSidebarConversationExperience({
                kind: session.kind,
                metadata: session.metadata,
              }) ?? null,
            productPillar:
              session.kind === "mission"
                ? missionProductPillar({ metadata: session.metadata ?? undefined })
                : null,
          }
        : null,
      outcome: run.outcome,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      error: run.error,
    })})
  }

  function view(row: AutomationRow): AutomationView {
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
          .where(eq(AutomationProjectTargetTable.automation_revision_id, row.id))
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
    const task = findTask(input.taskId)
    if (!task || task.project_id !== input.projectId) throw new NotFoundError({ message: `Task not found: ${input.taskId}` })
    if (!task.session_id) throw new Error(`Task ${input.taskId} has no root session; cannot schedule task wake.`)
    const rootSession = await Session.assertLineageInProject({ sessionID: task.session_id, projectID: input.projectId })
    return { ...task, sessionID: task.session_id, rootSession }
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
          definition_id: id,
          revision: 1,
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
        })
        .run()
      if (input.target.scope === "project") {
        tx.insert(AutomationProjectTargetTable)
          .values(
            input.target.projectIds.map((projectID, position) => ({
              automation_revision_id: id,
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
    const nextRun = next.status === "active" ? Recurrence.nextRun(next.recurrence, Date.now()) : current.next_run
    const committedAt = Date.now()
    const row = Database.immediateTransaction((tx) => {
      const latest = latestAutomationDefinitionInTransaction(tx, input.id)
      const lease = currentControlLeaseInTransaction(tx, "automation", input.id)
      if (!latest || latest.kind === "delay" || (lease && lease.expires_at > committedAt)) return undefined
      if (latest.revision !== current.revision) return undefined
      const revisionID = Identifier.ascending("automation")
      tx.insert(AutomationTable)
        .values({
          ...latest,
          id: revisionID,
          definition_id: input.id,
          revision: latest.revision + 1,
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
          time_created: committedAt,
        })
        .run()
      if (next.target.scope === "project") {
        tx.insert(AutomationProjectTargetTable)
          .values(
            next.target.projectIds.map((projectID, position) => ({
              automation_revision_id: revisionID,
              project_id: projectID,
              position,
            })),
          )
          .run()
      }
      const updated = tx.select().from(AutomationTable).where(eq(AutomationTable.id, revisionID)).get()!
      return projectAutomationInTransaction(tx, updated)
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
      job: AutomationRow,
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
    const row = claim(id, owner, now, true)
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
      return execute(Database.use((db) => projectAutomationInTransaction(db, input.job)), input.owner, input.now, true, input.runtimeSignal ?? new AbortController().signal)
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
    installWakeExecutor(executor: typeof SessionWake.wakeWithReceipt): Disposable {
      if (wakeSessionForTest) throw new Error("Automation wake executor is already installed")
      wakeSessionForTest = executor
      return {
        [Symbol.dispose]() {
          if (wakeSessionForTest === executor) wakeSessionForTest = undefined
        },
      }
    },
    installFailurePersistenceHook(hook: (phase: "before" | "after") => void | Promise<void>): Disposable {
      if (failurePersistenceHookForTest)
        throw new Error("Automation failure persistence test hook is already installed")
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
    const row = Database.use((db) => latestAutomationDefinitionInTransaction(db, id))
    if (!row || row.kind === "delay") throw new NotFoundError({ message: `Automation not found: ${id}` })
    if (!row) throw new NotFoundError({ message: `Automation not found: ${id}` })
    return Database.use((db) => projectAutomationInTransaction(db, row))
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
    if (input.model && input.target.scope === "global") {
      const modelInput = input.model
      const config = await Config.getGlobal()
      const model = await Provider.getModelGlobal(modelInput.providerID, modelInput.modelID, config)
      if (input.reasoningEffort && !model.variants?.[input.reasoningEffort]) {
        throw new Error(
          `Automation reasoning effort ${input.reasoningEffort} is not available for ${modelInput.providerID}/${modelInput.modelID}`,
        )
      }
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
          definition_id: id,
          revision: 1,
          project_id: input.projectId,
          session_id: input.sessionId,
          name: input.name,
          kind: "delay",
          surface: input.surface ? PanelSurface.parse(input.surface) : undefined,
          prompt: input.prompt,
          status: "active",
          due_at: nextRun,
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
          definition_id: id,
          revision: 1,
          project_id: input.projectId,
          task_id: input.taskId,
          name: input.name,
          kind: "delay",
          prompt: input.reason,
          status: "active",
          due_at: nextRun,
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
    const row = Database.immediateTransaction((db) => {
      const latest = latestAutomationDefinitionInTransaction(db, id)
      const lease = currentControlLeaseInTransaction(db, "automation", id)
      if (!latest || latest.kind === "delay" || (lease && lease.expires_at > now)) return undefined
      appendAutomationTombstoneInTransaction(db, latest, now)
      return { id, name: latest.name }
    })
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
    const pending = pendingDelays(now).filter((row) => row.project_id === input.projectId && row.task_id === input.taskId)
    if (pending.length === 0) return { jobIDs: [] }
    await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    const jobIDs = Database.immediateTransaction((db) => pending.flatMap((row) => {
      const latest = latestAutomationDefinitionInTransaction(db, row.id)
      if (!latest || latest.id !== row.revision_id) return []
      appendAutomationTombstoneInTransaction(db, latest, now)
      return [row.id]
    }))
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
    const pending = pendingDelays(now).filter((row) => row.project_id === input.projectId && row.session_id === input.sessionId && row.task_id === null)
    const jobIDs = pending.length === 0 ? [] : Database.immediateTransaction((db) => pending.flatMap((row) => {
      const latest = latestAutomationDefinitionInTransaction(db, row.id)
      if (!latest || latest.id !== row.revision_id) return []
      appendAutomationTombstoneInTransaction(db, latest, now)
      return [row.id]
    }))
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
    Database.transaction((db) => {
      for (const job of claimed) {
        const lease = currentControlLeaseInTransaction(db, "automation", job.id)
        if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) throw new AutomationRunningConflictError({ message: `Automation ${job.id} lost its activity lease`, automationID: job.id })
        const latest = latestAutomationDefinitionInTransaction(db, job.id)
        if (!latest || latest.id !== job.revision_id) throw new AutomationRunningConflictError({ message: `Automation ${job.id} definition changed during activity delivery`, automationID: job.id })
        appendAutomationTombstoneInTransaction(db, latest, Date.now())
      }
    })
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
    const pending = pendingDelays(now).filter((row) => row.project_id === input.projectId && row.task_id === input.taskId)
    if (pending.length === 0) return []
    await assertTaskRootSessionInProject({ taskId: input.taskId, projectId: input.projectId })
    return pending.flatMap((job) => acquireControlLease({ target: "automation", targetID: job.id, ownerOccurrenceID: input.owner, now, leaseMilliseconds: LEASE_MS }).acquired ? [job] : [])
  }

  function pendingDelays(now: number): AutomationRow[] {
    return Database.use((db) => currentAutomationDefinitions(db).filter((row) => row.kind === "delay" && row.status === "active"))
      .map((row) => Database.use((db) => projectAutomationInTransaction(db, row)))
      .filter((row) => row.lease_until <= now)
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
    const due = Database.use((db) => currentAutomationDefinitions(db).filter((row) => row.status === "active"))
      .map((row) => Database.use((db) => projectAutomationInTransaction(db, row)))
      .filter((row) => row.next_run <= now && row.lease_until <= now)
      .sort((left, right) => left.next_run - right.next_run || left.id.localeCompare(right.id))

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
    const persisted = Database.use((db) => latestAutomationDefinitionInTransaction(db, id))
    if (persisted?.status !== "active") return undefined
    const job = Database.use((db) => projectAutomationInTransaction(db, persisted))
    if (job.next_run > now || job.lease_until > now) return undefined
    if (
      job.scope === "session" &&
      job.session_id &&
      ["streaming", "retry"].includes(SessionStatus.get(job.session_id).type)
    ) {
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

  async function assertAutomationLineage(job: AutomationRow): Promise<void> {
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

  function claim(id: string, owner: string, now: number, force = false) {
    const persisted = Database.use((db) => latestAutomationDefinitionInTransaction(db, id))
    if (!persisted || persisted.status !== "active") return undefined
    const projected = Database.use((db) => projectAutomationInTransaction(db, persisted))
    if (!force && projected.next_run > now) return undefined
    const acquired = acquireControlLease({ target: "automation", targetID: id, ownerOccurrenceID: owner, now, leaseMilliseconds: LEASE_MS })
    if (!acquired.acquired) return undefined
    const claimed = Database.use((db) => latestAutomationDefinitionInTransaction(db, id))
    if (!claimed || claimed.id !== persisted.id || claimed.status !== "active") return undefined
    return Database.use((db) => projectAutomationInTransaction(db, claimed))
  }

  async function execute(
    job: AutomationRow,
    owner: string,
    now: number,
    reschedule: boolean,
    runtimeSignal: AbortSignal,
  ): Promise<string> {
    const scheduledDue = reschedule ? job.next_run : now
    const fireID =
      job.kind === "delay" && job.task_id
        ? taskWaitFireID(job.id)
        : deterministicAutomationID("cal", job.id, String(scheduledDue))
    log.info("executing automation", { jobId: job.id, fireID, name: job.name, prompt: job.prompt.slice(0, 100) })

    const leaseFence = createAutomationLeaseFence(job.id, owner, fireID)
    using inactivityFence = await createSchedulerExecutionInactivityFence({
      occurrence: `Automation fire ${fireID}`,
      signals: [leaseFence.signal, runtimeSignal],
      initialPhase: "claimed",
      configurationOwner: "global",
    })
    const executionSignal = inactivityFence.signal
    const leaseRenewTimer = startLeaseRenewTimer(() => leaseFence.renewOrAbort())

    try {
      if (job.kind === "delay") {
        const runID = deterministicAutomationID("atr", fireID, "delay")
        Database.immediateTransaction((db) => {
          const lease = currentControlLeaseInTransaction(db, "automation", job.id)
          if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) {
            throw new AutomationRunningConflictError({ message: `Automation ${job.id} lost its lease before delay reservation`, automationID: job.id })
          }
          db.insert(AutomationRunTable).values({
            id: runID,
            automation_revision_id: job.revision_id,
            fire_id: fireID,
            target_project_id: null,
            started_at: now,
          }).onConflictDoNothing().run()
        })
        inactivityFence.touch("delayed wake dispatch")
        const outcome = await executeDelayedWake(job, fireID, runID, owner, executionSignal)
        const completedAt = Date.now()
        Database.immediateTransaction((db) => {
          const existing = db.select().from(AutomationRunReceiptTable).where(eq(AutomationRunReceiptTable.run_id, runID)).all()
            .find((receipt) => receipt.outcome === "succeeded")
          if (!existing) db.insert(AutomationRunReceiptTable).values({ id: Identifier.ascending("automation"), run_id: runID, outcome: "succeeded", time_created: completedAt }).run()
        })
        if (!outcome.automationConsumed) {
          const consumed = Database.transaction((db) => {
            const lease = currentControlLeaseInTransaction(db, "automation", job.id)
            if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) return undefined
            const latest = latestAutomationDefinitionInTransaction(db, job.id)
            if (!latest || latest.id !== job.revision_id) return undefined
            appendAutomationTombstoneInTransaction(db, latest, Date.now())
            return { id: job.id }
          })
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
      inactivityFence.touch("target resolution")
      const targets = await executionTargets(job)
      const runIDs = targets.map((target) => deterministicAutomationID("atr", fireID, automationTargetIdentity(target)))
      Database.immediateTransaction((db) => {
        const lease = currentControlLeaseInTransaction(db, "automation", job.id)
        if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} lost its execution lease before fire reservation`,
            automationID: job.id,
          })
        }
        db.insert(AutomationRunTable)
          .values(
            targets.map((target, index) => ({
              id: runIDs[index],
              automation_revision_id: job.revision_id,
              fire_id: fireID,
              target_project_id: target.scope === "project" ? target.projectID : null,
              started_at: now,
            })),
          )
          .onConflictDoNothing()
          .run()
      })
      inactivityFence.touch("target occurrences reserved")
      const reservedRuns = new Map(
        Database.use((db) => db.select().from(AutomationRunTable)
            .where(inArray(AutomationRunTable.id, runIDs))
            .all().map((run) => projectAutomationRunInTransaction(db, run)),
        ).map((run) => [run.id, run] as const),
      )
      let results: PromiseSettledResult<{ sessionID: string }>[] = []
      results = await Promise.allSettled(
        targets.map(async (target, index) => {
          try {
            const reserved = reservedRuns.get(runIDs[index]!)
            if (reserved?.outcome === "succeeded") {
              if (!reserved.session_id)
                throw new Error(`Succeeded Automation run ${reserved.id} has no Session authority`)
              return { sessionID: reserved.session_id }
            }
            const existing = findAutomationWake(job.id, fireID, target)
            if (existing) return { sessionID: await resumeAutomationWake(existing) }
            return executePublicWake(job, target, fireID, runIDs[index]!, owner, executionSignal)
          } finally {
            inactivityFence.touch(`target ${index + 1}/${targets.length} settled`)
          }
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
      const nextRun = error ? retryAt : reschedule ? Recurrence.nextRun(job.recurrence, committedAt) : job.next_run
      inactivityFence.touch("durable fire settlement")
      Database.transaction((tx) => {
        const lease = currentControlLeaseInTransaction(tx, "automation", job.id)
        if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= committedAt) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} lost its execution lease before completion`,
            automationID: job.id,
          })
        }
        results.forEach((result, index) => {
          const persisted = tx.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runIDs[index])).get()
          const prior = persisted ? projectAutomationRunInTransaction(tx, persisted) : undefined
          if (prior?.outcome === "succeeded") return
          if (!prior) throw new Error(`Automation run ${runIDs[index]} was not reserved`)
          tx.insert(AutomationRunReceiptTable).values({
            id: Identifier.ascending("automation"),
            run_id: prior.id,
            outcome: result.status === "fulfilled" ? "succeeded" : "retry_wait",
            retry_at: result.status === "rejected" ? retryAt : null,
            error: result.status === "rejected" ? (result.reason instanceof Error ? result.reason.message : String(result.reason)) : null,
            time_created: committedAt,
          }).run()
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
    job: AutomationRow,
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

  async function admitAutomationSessionWake<Receipt extends { activation: Promise<unknown> }>(
    session: Session.Info,
    wake: () => Receipt | Promise<Receipt>,
  ): Promise<Receipt> {
    if (session.kind !== "mission") return wake()
    const mission = await requireMissionSession(session.id)
    return admitMissionExecutionWake({ missionID: mission.missionID, sessionID: mission.id, wake })
  }

  async function resumeAutomationWake(existing: { sessionID: string; messageID: string }): Promise<string> {
    const session = await Session.get(existing.sessionID)
    const receipt = await admitAutomationSessionWake(session, () =>
      SessionWake.resumePersistedWakeWithReceipt({
        sessionID: existing.sessionID,
        messageID: existing.messageID,
        directory: session.directory,
        retryFailedReply: true,
      }),
    )
    const completion = await receipt.completion
    assertWakeCompleted(completion)
    return existing.sessionID
  }

  function assertWakeCompleted(completion: SessionWake.WakeCompletion): void {
    if (!completion.ok) throw new Error(`Scheduled Automation Session wake failed: ${completion.error}`)
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

  async function executionTargets(job: AutomationRow): Promise<ExecutionTarget[]> {
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
    job: AutomationRow,
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
    job: AutomationRow,
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
    const session = await Session.get(sessionID)
    const receipt = await admitAutomationSessionWake(session, () =>
      (wakeSessionForTest ?? SessionWake.wakeWithReceipt)({
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
      }),
    )
    const completion = await receipt.completion
    assertWakeCompleted(completion)
    return receipt.sessionID
  }

  function fenceAutomationWakeCommit(input: {
    automationID: string
    runID?: string
    owner: string
    sessionID: string
  }): void {
    Database.use((db) => {
      const lease = currentControlLeaseInTransaction(db, "automation", input.automationID)
      if (!lease || lease.owner_occurrence_id !== input.owner || lease.expires_at <= Date.now()) {
        throw new AutomationRunningConflictError({
          message: `Automation ${input.automationID} lost its lease before wake Message commit`,
          automationID: input.automationID,
        })
      }
      if (!input.runID) return
      const persisted = db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, input.runID)).get()
      const definition = persisted ? db.select({ definitionID: AutomationTable.definition_id }).from(AutomationTable).where(eq(AutomationTable.id, persisted.automation_revision_id)).get() : undefined
      if (definition?.definitionID !== input.automationID) throw new AutomationRunningConflictError({ message: `Automation run ${input.runID} belongs to another definition`, automationID: input.automationID })
      const run = persisted ? projectAutomationRunInTransaction(db, persisted) : undefined
      if (!run || run.outcome !== "running" || run.session_id !== input.sessionID) {
        throw new AutomationRunningConflictError({
          message: `Automation run ${input.runID} lost ownership before wake Message commit`,
          automationID: input.automationID,
        })
      }
    })
  }

  async function executeDelayedWake(
    job: AutomationRow,
    fireID: string,
    runID: string,
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
            const persistedWakeID = persistTaskWaitIngressInTransaction(tx, {
              task,
              jobID: job.id,
              fireID,
              runID,
              dueAt: job.next_run,
              now: committedAt,
            })
            const lease = currentControlLeaseInTransaction(tx, "automation", job.id)
            if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= committedAt) throw new AutomationRunningConflictError({ message: `Automation ${job.id} lost its execution lease before Task wait ownership transfer`, automationID: job.id })
            const latest = latestAutomationDefinitionInTransaction(tx, job.id)
            const consumed = latest && latest.id === job.revision_id && latest.kind === "delay" && latest.status === "active"
              ? (appendAutomationTombstoneInTransaction(tx, latest, committedAt), { id: job.id })
              : undefined
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
            log.error("scheduled Task wait ingress remains accepted after delivery failure", {
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
              dispatchResult: "accepted",
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
    const now = Date.now()
    const lease = Database.use((db) => currentControlLeaseInTransaction(db, "automation", id))
    if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= now) return false
    renewControlLease({ target: "automation", targetID: id, leaseID: lease.id, ownerOccurrenceID: owner, now, expiresAt: now + LEASE_MS })
    return true
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

  async function fail(job: AutomationRow, owner: string, err: unknown): Promise<void> {
    await failurePersistenceHookForTest?.("before")
    const now = Date.now()
    const step = job.failure_count + 1
    const retryAt = automationRetryAt(step, now)
    const msg = err instanceof Error ? err.message : String(err)

    const finalized = Database.transaction((tx) => {
      const lease = currentControlLeaseInTransaction(tx, "automation", job.id)
      if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= now) return false
      appendAutomationFailureReceipts(tx, job, msg, retryAt, now)
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

  async function failBeforeLease(job: AutomationRow, err: unknown): Promise<void> {
    const now = Date.now()
    const step = job.failure_count + 1
    const retryAt = automationRetryAt(step, now)
    const msg = err instanceof Error ? err.message : String(err)

    Database.transaction((db) => appendAutomationFailureReceipts(db, job, msg, retryAt, now))

    log.error("automation rejected before lease", {
      jobId: job.id,
      name: job.name,
      error: msg,
      retryAt: new Date(retryAt).toISOString(),
    })
  }

  function appendAutomationFailureReceipts(
    db: Database.TxOrDb,
    job: AutomationRow,
    message: string,
    retryAt: number,
    now: number,
  ): void {
    const revisions = db.select({ id: AutomationTable.id }).from(AutomationTable).where(eq(AutomationTable.definition_id, job.id)).all().map((row) => row.id)
    let runs = revisions.length === 0 ? [] : db.select().from(AutomationRunTable).where(inArray(AutomationRunTable.automation_revision_id, revisions)).all()
      .map((run) => projectAutomationRunInTransaction(db, run)).filter((run) => run.outcome === "running")
    if (runs.length === 0) {
      const id = deterministicAutomationID("atr", job.id, `failure:${job.next_run}`)
      db.insert(AutomationRunTable).values({
        id,
        automation_revision_id: job.revision_id,
        fire_id: deterministicAutomationID("cal", job.id, String(job.next_run)),
        target_project_id: null,
        started_at: now,
      }).onConflictDoNothing().run()
      const persisted = db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, id)).get()
      if (persisted) runs = [projectAutomationRunInTransaction(db, persisted)]
    }
    for (const run of runs) {
      db.insert(AutomationRunReceiptTable).values({
        id: Identifier.ascending("automation"),
        run_id: run.id,
        outcome: "retry_wait",
        retry_at: retryAt,
        error: message,
        time_created: now,
      }).run()
    }
  }

  function assertDuration(durationMs: number) {
    if (!Number.isInteger(durationMs) || durationMs <= 0) {
      throw new Error(`Invalid delay duration: ${durationMs}`)
    }
  }

  function renderTaskWaitWakeNote(job: AutomationRow, fireID: string) {
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
