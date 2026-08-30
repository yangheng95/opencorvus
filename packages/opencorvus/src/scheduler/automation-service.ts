import { Database, NotFoundError, and, desc, eq, inArray, isNull, ne, or, sql } from "@/storage/db"
import {
  AutomationDefinitionTombstoneTable,
  AutomationFireAttemptReceiptTable,
  AutomationFireAttemptTable,
  AutomationFireTable,
  AutomationProjectTargetTable,
  AutomationRunReceiptTable,
  AutomationRunOutcomes,
  AutomationRunTable,
  AutomationTable,
} from "./automation.sql"
import {
  automationFrontierEntriesForDefinitionsInTransaction,
  currentAutomationDefinitionsInTransaction,
  currentAutomationFrontiersInTransaction,
  currentSessionDelayDefinitionsForSessionsInTransaction,
  latestAutomationDefinitionInTransaction,
  projectAutomationFireInTransaction,
  projectAutomationFrontierInTransaction,
  projectAutomationInTransaction,
  projectAutomationRunInTransaction,
  type AutomationFireProjection,
  type AutomationRunRow,
  type AutomationRow,
} from "./automation-projection"
import {
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  currentControlLeaseInTransaction,
  releaseControlLeaseInTransaction,
  renewControlLease,
} from "@/engine/control-lease"
import { Recurrence } from "./recurrence"
import { Scheduler } from "./index"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { createSchedulerExecutionInactivityFence } from "./execution-inactivity"
import type { SchedulerExecutionInactivityFence } from "./execution-inactivity"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Identifier } from "@/id/id"
import { SessionStatus } from "@/session/status"
import { Worktree } from "@/worktree"
import { PanelSurface } from "@/panel/capability"
import { Provider } from "@/provider/provider"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { rightSidebarConversationExperience, type ConversationExperience } from "@/chat/identity"
import { NamedError } from "@opencorvus-ai/util/error"
import { ProjectTable } from "@/project/project.sql"
import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { ProjectInstanceContext } from "@/project/instance-context"
import { Filesystem } from "@/util/filesystem"
import z from "zod"
import { missionProductPillar, requireMissionSession } from "@/mission/session"
import {
  admitMissionExecutionWake,
  MissionExecutionWakeClosedError,
  MissionExecutionWakeNotOpenedError,
  type MissionExecutionWakeAdmission,
} from "@/mission/execution-closure"
import type { ProductPillar } from "@opencorvus-ai/sdk/expert-squad-manifest-v2"
import { createHash } from "node:crypto"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Config } from "@/config/config"
import {
  assertMissionSchedulerOccurrenceAdmission,
  MissionSchedulerOccurrenceClosedError,
  missionSchedulerOccurrenceDisposition,
  type MissionSchedulerOccurrenceDisposition,
} from "@/protocol/delivery"
import { schedulerMissionReservationInTransaction } from "./mission-reservation"
import {
  assertScheduledToolOccurrenceInTransaction,
  scheduledToolOccurrenceConflict,
  type ScheduledToolOccurrence,
} from "./tool-occurrence"

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

export type AutomationDefinitionReceipt = {
  id: string
  revisionId: string
  revision: number
  name: string
  target: AutomationTarget
  recurrence: string
  executionMode: "local" | "worktree"
  model: { providerID: string; modelID: string } | null
  reasoningEffort: string | null
  prompt: string
  status: "active" | "paused"
  firstEligibleAt: number
}

export type PendingDelayedWakeView = {
  id: string
  projectID: string
  target: { scope: "session"; sessionID: string }
  nextRun: number
  leaseUntil: number
  state: "scheduled" | "leased"
  claim: {
    leaseID: string
    ownerOccurrenceID: string
    activatedAt: number
  } | null
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
  disposition: "mission_closed" | "target_deleted" | "superseded" | null
  closureEventID: string | null
  startedAt: number
  completedAt: number | null
  error: string | null
}

export type AutomationFireRunReceipt = {
  id: string
  targetScope: AutomationTarget["scope"]
  targetProjectId: string | null
  sessionId: string | null
  outcome: (typeof AutomationRunOutcomes)[number]
  disposition: "mission_closed" | "target_deleted" | "superseded" | null
  closureEventID: string | null
  startedAt: number
  completedAt: number | null
  error: string | null
}

export type AutomationFireHistoryView = {
  fireId: string
  automationId: string
  automationRevisionId: string
  origin: "scheduled" | "manual_api" | "manual_tool" | "legacy"
  scheduledDueAt: number
  startedAt: number
  completedAt: number | null
  state: AutomationFireProjection["state"]
  attemptCount: number
  retryAt: number | null
  error: string | null
  runs: AutomationFireRunReceipt[]
}

export type GlobalConversationCreator = (input: {
  experience: ConversationExperience
  model?: string
  sessionID?: string
}) => Promise<{ session: Session.Info }>

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
  let beforeMissionSessionAdmissionForTest: (() => void | Promise<void>) | undefined
  let beforeRunReservationForTest: (() => void | Promise<void>) | undefined
  let afterRunReservationForTest: ((input: { runIDs: string[] }) => void | Promise<void>) | undefined
  let claimClockForTest: (() => number) | undefined
  let globalConversationCreator: GlobalConversationCreator | undefined
  const log = Log.create({ service: "automation-service" })

  const POLL_INTERVAL_MS = 1_000
  const LEASE_MS = 2 * 60 * 1000
  const LEASE_RENEW_MS = 30 * 1000
  const HEARTBEAT_BUSY_RETRY_MS = 30 * 1000
  const MAX_BACKOFF_MS = 5 * 60 * 1000
  const MAX_FIRE_ATTEMPTS = 5
  const CONCURRENCY_ENV = "OPENCORVUS_AUTOMATION_CONCURRENCY"
  const CONCURRENCY_DEFAULT = 4
  const CONCURRENCY_MAX = 32

  type ScheduleToolCausation = {
    occurrence: ScheduledToolOccurrence
    inputDigest: string
  }

  const state = createInstanceState(
    () => ({
      running: false,
    }),
    async () => undefined,
    "automation-service",
  )
  let globalRunning = false

  function appendAutomationTombstoneInTransaction(
    db: Database.TxOrDb,
    row: typeof AutomationTable.$inferSelect,
    now: number,
    causation?: ScheduleToolCausation,
  ) {
    if (causation) assertScheduledToolOccurrenceInTransaction(db, causation.occurrence)
    const id = causation
      ? Identifier.deterministic("automation", `automation-tombstone-v1\0${causation.occurrence.toolPartID}`)
      : Identifier.ascending("automation")
    db.insert(AutomationDefinitionTombstoneTable)
      .values({
        id,
        definition_id: row.definition_id,
        revision: row.revision + 1,
        tool_part_id: causation?.occurrence.toolPartID,
        tool_input_digest: causation?.inputDigest,
        time_created: now,
      })
      .run()
    return id
  }

  export function init() {
    log.info("automation project hooks initialized", { projectID: Instance.project.id })
  }

  export function initGlobal(input: { createGlobalConversation: GlobalConversationCreator }) {
    if (globalConversationCreator && globalConversationCreator !== input.createGlobalConversation) {
      throw new Error("Global Automation conversation creator is already bound to another implementation.")
    }
    globalConversationCreator = input.createGlobalConversation
    Scheduler.register({
      id: "automation-service.poll",
      interval: POLL_INTERVAL_MS,
      runAtStart: true,
      run: poll,
    })
    log.info("global automation service initialized")
  }

  export async function runDueNow() {
    await poll()
  }

  function requireGlobalConversationCreator(): GlobalConversationCreator {
    if (!globalConversationCreator) {
      throw new Error("Global Automation conversation creator is not bound by the process runtime.")
    }
    return globalConversationCreator
  }

  export function list(): AutomationView[] {
    const rows = Database.use((db) =>
      currentAutomationDefinitionsInTransaction(db).filter((row) => row.kind !== "delay"),
    )
      .map((row) => Database.use((db) => projectAutomationInTransaction(db, row)))
      .sort((left, right) => left.next_run - right.next_run || left.id.localeCompare(right.id))
    return rows.map(view)
  }

  /** Read the exact active one-shot wake facts for known runtime owners.
   * This is a physical scheduling projection only: it never claims, fires,
   * consumes, or otherwise changes an Automation. */
  export function pendingDelayedWakeSchedule(input: {
    projectID: string
    sessionIDs: readonly string[]
    now?: number
  }): PendingDelayedWakeView[] {
    const sessionIDs = new Set(input.sessionIDs)
    if (sessionIDs.size === 0) return []
    const now = input.now ?? Date.now()
    return Database.use((db) => {
      const definitions = currentSessionDelayDefinitionsForSessionsInTransaction(db, input.sessionIDs).filter(
        (row) => row.project_id === input.projectID,
      )
      return automationFrontierEntriesForDefinitionsInTransaction(db, definitions)
    })
      .flatMap(({ row, lease }): PendingDelayedWakeView[] => {
        const target =
          row.session_id && sessionIDs.has(row.session_id)
            ? ({ scope: "session", sessionID: row.session_id } as const)
            : undefined
        if (!target || !row.project_id) return []
        const activeLease = lease && lease.expires_at > now ? lease : undefined
        return [
          {
            id: row.id,
            projectID: row.project_id,
            target,
            nextRun: row.next_run,
            leaseUntil: lease?.expires_at ?? 0,
            state: activeLease ? "leased" : "scheduled",
            claim: activeLease
              ? {
                  leaseID: activeLease.id,
                  ownerOccurrenceID: activeLease.owner_occurrence_id,
                  activatedAt: activeLease.time_activated,
                }
              : null,
          },
        ]
      })
      .sort((left, right) => left.nextRun - right.nextRun || left.id.localeCompare(right.id))
  }

  export function listRuns(id: string): AutomationRunView[] {
    assertPublicAutomation(id)
    return listRunsForAutomation(id)
  }

  export function listFireHistory(id: string): AutomationFireHistoryView[] {
    assertPublicAutomation(id)
    const revisionIDs = Database.use((db) =>
      db
        .select({ id: AutomationTable.id })
        .from(AutomationTable)
        .where(eq(AutomationTable.definition_id, id))
        .all()
        .map((row) => row.id),
    )
    if (revisionIDs.length === 0) return []
    return Database.use((db) =>
      db
        .select()
        .from(AutomationFireTable)
        .where(inArray(AutomationFireTable.automation_revision_id, revisionIDs))
        .orderBy(desc(AutomationFireTable.scheduled_due_at), desc(AutomationFireTable.time_created), desc(AutomationFireTable.id))
        .all()
        .map((fire) => fireHistoryView(projectAutomationFireInTransaction(db, fire))),
    )
  }

  function fireHistoryForID(fireID: string): AutomationFireHistoryView {
    return Database.use((db) => {
      const fire = db.select().from(AutomationFireTable).where(eq(AutomationFireTable.id, fireID)).get()
      if (!fire) throw new NotFoundError({ message: `Automation fire not found: ${fireID}` })
      return fireHistoryView(projectAutomationFireInTransaction(db, fire))
    })
  }

  function fireHistoryView(fire: AutomationFireProjection): AutomationFireHistoryView {
    return {
      fireId: fire.id,
      automationId: fire.automationID,
      automationRevisionId: fire.automationRevisionID,
      origin: fire.origin,
      scheduledDueAt: fire.scheduledDueAt,
      startedAt: fire.startedAt,
      completedAt: fire.completedAt,
      state: fire.state,
      attemptCount: fire.attemptCount,
      retryAt: fire.retryAt,
      error: fire.error,
      runs: fire.runs.map((run) => ({
        id: run.id,
        targetScope: run.target_scope,
        targetProjectId: run.project_id,
        sessionId: run.session_id,
        outcome: run.outcome,
        disposition: run.disposition,
        closureEventID: run.closure_event_id,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        error: run.error,
      })),
    }
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
      const session = run.session_id
        ? Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, run.session_id!)).get())
        : undefined
      return {
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
                session.kind === "mission" ? missionProductPillar({ metadata: session.metadata ?? undefined }) : null,
            }
          : null,
        outcome: run.outcome,
        disposition: run.disposition,
        closureEventID: run.closure_event_id,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        error: run.error,
      }
    })
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

  function definitionReceiptInTransaction(
    db: Database.TxOrDb,
    row: typeof AutomationTable.$inferSelect,
  ): AutomationDefinitionReceipt {
    if (row.kind !== "recurring" || !row.recurrence) {
      throw new Error(`Automation revision ${row.id} is not a public recurring definition`)
    }
    const target: AutomationTarget =
      row.scope === "session" && row.session_id
        ? { scope: "session", sessionId: row.session_id }
        : row.scope === "global"
          ? { scope: "global" }
          : row.scope === "project"
            ? {
                scope: "project",
                projectIds: db
                  .select({ projectID: AutomationProjectTargetTable.project_id })
                  .from(AutomationProjectTargetTable)
                  .where(eq(AutomationProjectTargetTable.automation_revision_id, row.id))
                  .orderBy(AutomationProjectTargetTable.position, AutomationProjectTargetTable.project_id)
                  .all()
                  .map((entry) => entry.projectID),
              }
            : (() => {
                throw new Error(`Automation revision ${row.id} has invalid public target`)
              })()
    return {
      id: row.definition_id,
      revisionId: row.id,
      revision: row.revision,
      name: row.name,
      target,
      recurrence: row.recurrence,
      executionMode: row.execution_mode,
      model:
        row.model_provider_id && row.model_id ? { providerID: row.model_provider_id, modelID: row.model_id } : null,
      reasoningEffort: row.reasoning_effort ?? null,
      prompt: row.prompt,
      status: row.status,
      firstEligibleAt: Recurrence.nextRun(row.recurrence, row.time_created),
    }
  }

  export async function create(input: CreateAutomationInput): Promise<{ id: string; name: string; nextRun: number }> {
    return createAutomation(input)
  }

  export async function createFromTool(
    input: CreateAutomationInput,
    causation: ScheduleToolCausation,
  ): Promise<AutomationDefinitionReceipt> {
    return createAutomation(input, causation)
  }

  async function createAutomation(
    input: CreateAutomationInput,
    causation: ScheduleToolCausation,
  ): Promise<AutomationDefinitionReceipt>
  async function createAutomation(
    input: CreateAutomationInput,
    causation?: undefined,
  ): Promise<{ id: string; name: string; nextRun: number }>
  async function createAutomation(
    input: CreateAutomationInput,
    causation?: ScheduleToolCausation,
  ): Promise<AutomationDefinitionReceipt | { id: string; name: string; nextRun: number }> {
    if (causation) {
      const replay = Database.immediateTransaction((tx) => {
        assertScheduledToolOccurrenceInTransaction(tx, causation.occurrence)
        const existing = tx
          .select()
          .from(AutomationTable)
          .where(eq(AutomationTable.tool_part_id, causation.occurrence.toolPartID))
          .get()
        if (!existing) return undefined
        const expectedID = Identifier.deterministic(
          "automation",
          `automation-definition-v1\0${causation.occurrence.toolPartID}`,
        )
        if (existing.tool_input_digest !== causation.inputDigest || existing.definition_id !== expectedID) {
          throw scheduledToolOccurrenceConflict(causation.occurrence, "changed its Automation create input")
        }
        return definitionReceiptInTransaction(tx, existing)
      })
      if (replay) return replay
    }
    await assertPublicInput(input)
    const now = Date.now()
    const recurrence = Recurrence.normalize(input.recurrence)
    const id = causation
      ? Identifier.deterministic("automation", `automation-definition-v1\0${causation.occurrence.toolPartID}`)
      : Identifier.ascending("automation")
    const row = Database.immediateTransaction((tx) => {
      if (causation) {
        assertScheduledToolOccurrenceInTransaction(tx, causation.occurrence)
        const existing = tx
          .select()
          .from(AutomationTable)
          .where(eq(AutomationTable.tool_part_id, causation.occurrence.toolPartID))
          .get()
        if (existing) {
          if (existing.tool_input_digest !== causation.inputDigest || existing.definition_id !== id) {
            throw scheduledToolOccurrenceConflict(causation.occurrence, "changed its Automation create input")
          }
          return existing
        }
      }
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
          tool_part_id: causation?.occurrence.toolPartID,
          tool_input_digest: causation?.inputDigest,
          time_created: now,
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
      return tx.select().from(AutomationTable).where(eq(AutomationTable.id, id)).get()!
    })
    if (causation) return Database.use((db) => definitionReceiptInTransaction(db, row))
    const projected = Database.use((db) => projectAutomationInTransaction(db, row))
    return { id: projected.id, name: projected.name, nextRun: projected.next_run }
  }

  export async function update(input: UpdateAutomationInput): Promise<AutomationView> {
    return updateAutomation(input)
  }

  export async function updateFromTool(
    input: UpdateAutomationInput,
    causation: ScheduleToolCausation,
  ): Promise<AutomationDefinitionReceipt> {
    return updateAutomation(input, causation)
  }

  async function updateAutomation(
    input: UpdateAutomationInput,
    causation: ScheduleToolCausation,
  ): Promise<AutomationDefinitionReceipt>
  async function updateAutomation(input: UpdateAutomationInput, causation?: undefined): Promise<AutomationView>
  async function updateAutomation(
    input: UpdateAutomationInput,
    causation?: ScheduleToolCausation,
  ): Promise<AutomationView | AutomationDefinitionReceipt> {
    if (causation) {
      const replay = Database.immediateTransaction((db) => {
        assertScheduledToolOccurrenceInTransaction(db, causation.occurrence)
        const existing = db
          .select()
          .from(AutomationTable)
          .where(eq(AutomationTable.tool_part_id, causation.occurrence.toolPartID))
          .get()
        if (!existing) return undefined
        if (existing.definition_id !== input.id || existing.tool_input_digest !== causation.inputDigest) {
          throw scheduledToolOccurrenceConflict(causation.occurrence, "changed its Automation update input")
        }
        return definitionReceiptInTransaction(db, existing)
      })
      if (replay) return replay
    }
    const current = assertPublicAutomation(input.id)
    const updateStartedAt = Date.now()
    if (current.pending_fire_id || (current.lease_owner && current.lease_until > updateStartedAt)) {
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
    const committedAt = Date.now()
    const row = Database.immediateTransaction((tx) => {
      const latest = latestAutomationDefinitionInTransaction(tx, input.id)
      const lease = currentControlLeaseInTransaction(tx, "automation", input.id)
      if (!latest || latest.kind === "delay" || (lease && lease.expires_at > committedAt)) return undefined
      if (projectAutomationFrontierInTransaction(tx, latest).pending_fire_id) return undefined
      if (latest.revision !== current.revision) return undefined
      if (causation) assertScheduledToolOccurrenceInTransaction(tx, causation.occurrence)
      const revisionID = causation
        ? Identifier.deterministic("automation", `automation-revision-v1\0${causation.occurrence.toolPartID}`)
        : Identifier.ascending("automation")
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
          tool_part_id: causation?.occurrence.toolPartID ?? null,
          tool_input_digest: causation?.inputDigest ?? null,
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
      return tx.select().from(AutomationTable).where(eq(AutomationTable.id, revisionID)).get()!
    })
    if (!row) {
      assertPublicAutomation(input.id)
      throw new AutomationRunningConflictError({
        message: `Automation ${input.id} began running before its update could commit`,
        automationID: input.id,
      })
    }
    if (causation) return Database.use((db) => definitionReceiptInTransaction(db, row))
    return view(Database.use((db) => projectAutomationInTransaction(db, row)))
  }

  export async function runNow(id: string): Promise<AutomationRunView[]> {
    return runNowWithExecutor(id, executeWithRuntimeSettlement)
  }

  export async function runNowFromTool(
    id: string,
    causation: ScheduleToolCausation,
  ): Promise<AutomationFireHistoryView> {
    const now = claimClockForTest?.() ?? Date.now()
    const fireID = Identifier.deterministic(
      "automation",
      `automation-manual-fire-v1\0${causation.occurrence.toolPartID}`,
    )
    const owner = `manual-tool:${process.pid}:${causation.occurrence.toolPartID}`
    const reserved = Database.immediateTransaction((db) => {
      assertScheduledToolOccurrenceInTransaction(db, causation.occurrence)
      const existing = db
        .select()
        .from(AutomationFireTable)
        .where(eq(AutomationFireTable.tool_part_id, causation.occurrence.toolPartID))
        .get()
      if (existing) {
        const definition = db
          .select()
          .from(AutomationTable)
          .where(eq(AutomationTable.id, existing.automation_revision_id))
          .get()
        if (
          !definition ||
          definition.definition_id !== id ||
          existing.id !== fireID ||
          existing.input_digest !== causation.inputDigest ||
          existing.origin !== "manual_tool"
        ) {
          throw scheduledToolOccurrenceConflict(causation.occurrence, "changed its manual run input")
        }
        const projectedFire = projectAutomationFireInTransaction(db, existing)
        const terminal = ["succeeded", "failed", "partial", "disposition"].includes(projectedFire.state)
        if (terminal) return { fire: existing, terminal: true as const }
        const acquired = acquireControlLeaseInTransaction(db, {
          target: "automation",
          targetID: id,
          ownerOccurrenceID: owner,
          now,
          leaseMilliseconds: LEASE_MS,
        })
        if (!acquired.acquired) return { fire: existing, terminal: false as const, acquired: false as const }
        reserveAutomationFireAttemptInTransaction(db, { fireID: existing.id, owner, now })
        return { fire: existing, terminal: false as const, acquired: true as const, definition }
      }
      const definition = latestAutomationDefinitionInTransaction(db, id)
      if (!definition || definition.kind === "delay") throw new NotFoundError({ message: `Automation not found: ${id}` })
      const pendingFireID = projectAutomationFrontierInTransaction(db, definition).pending_fire_id
      if (pendingFireID) {
        throw new AutomationRunningConflictError({
          message: `Automation ${id} already has unsettled fire ${pendingFireID}`,
          automationID: id,
        })
      }
      db.insert(AutomationFireTable)
        .values({
          id: fireID,
          automation_revision_id: definition.id,
          scheduled_due_at: now,
          origin: "manual_tool",
          tool_part_id: causation.occurrence.toolPartID,
          input_digest: causation.inputDigest,
          time_created: now,
        })
        .run()
      const acquired = acquireControlLeaseInTransaction(db, {
        target: "automation",
        targetID: id,
        ownerOccurrenceID: owner,
        now,
        leaseMilliseconds: LEASE_MS,
      })
      if (!acquired.acquired) throw new Error(`Fresh manual Automation fire ${fireID} could not acquire its owner`)
      reserveAutomationFireAttemptInTransaction(db, { fireID, owner, now })
      return {
        fire: db.select().from(AutomationFireTable).where(eq(AutomationFireTable.id, fireID)).get()!,
        terminal: false as const,
        acquired: true as const,
        definition,
      }
    })
    if (reserved.terminal) return fireHistoryForID(fireID)
    if (!reserved.acquired || !reserved.definition) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} manual Tool occurrence is owned by another runtime`,
        automationID: id,
      })
    }
    const projected = Database.use((db) => projectAutomationInTransaction(db, reserved.definition!))
    const job: AutomationRow = {
      ...projected,
      pending_fire_id: reserved.fire.id,
      scheduled_due_at: reserved.fire.scheduled_due_at,
      lease_owner: owner,
      lease_until: now + LEASE_MS,
    }
    try {
      await executeWithRuntimeSettlement(job, owner, now, false)
    } catch (error) {
      const fire = fireHistoryForID(fireID)
      if (["succeeded", "failed", "partial", "disposition"].includes(fire.state)) return fire
      throw error
    }
    return fireHistoryForID(fireID)
  }

  async function runNowWithExecutor(
    id: string,
    executeFire: (job: AutomationRow, owner: string, now: number, reschedule: boolean) => Promise<string>,
  ): Promise<AutomationRunView[]> {
    const automation = assertPublicAutomation(id)
    if (automation.pending_fire_id) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} already has unsettled fire ${automation.pending_fire_id}`,
        automationID: id,
      })
    }
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
    isolateGlobalConversationCreator(): Disposable {
      const prior = globalConversationCreator
      globalConversationCreator = undefined
      return {
        [Symbol.dispose]() {
          globalConversationCreator = prior
        },
      }
    },
    executeClaimedDueOccurrence(input: {
      job: typeof AutomationTable.$inferSelect
      owner: string
      now: number
      runtimeSignal?: AbortSignal
    }) {
      return execute(
        Database.use((db) => projectAutomationInTransaction(db, input.job)),
        input.owner,
        input.now,
        true,
        input.runtimeSignal ?? new AbortController().signal,
      )
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
    installBeforeMissionSessionAdmission(hook: () => void | Promise<void>): Disposable {
      if (beforeMissionSessionAdmissionForTest)
        throw new Error("Automation Mission-admission test hook is already installed")
      beforeMissionSessionAdmissionForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeMissionSessionAdmissionForTest === hook) beforeMissionSessionAdmissionForTest = undefined
        },
      }
    },
    installAfterRunReservation(hook: (input: { runIDs: string[] }) => void | Promise<void>): Disposable {
      if (afterRunReservationForTest) throw new Error("Automation run-reservation test hook is already installed")
      afterRunReservationForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterRunReservationForTest === hook) afterRunReservationForTest = undefined
        },
      }
    },
    installBeforeRunReservation(hook: () => void | Promise<void>): Disposable {
      if (beforeRunReservationForTest) throw new Error("Automation pre-reservation test hook is already installed")
      beforeRunReservationForTest = hook
      return {
        [Symbol.dispose]() {
          if (beforeRunReservationForTest === hook) beforeRunReservationForTest = undefined
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
    installClaimClock(clock: () => number): Disposable {
      if (claimClockForTest) throw new Error("Automation claim clock is already installed")
      claimClockForTest = clock
      return {
        [Symbol.dispose]() {
          if (claimClockForTest === clock) claimClockForTest = undefined
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

  export function remove(id: string): { id: string; name: string } {
    return removeAutomation(id)
  }

  export function removeFromTool(id: string, causation: ScheduleToolCausation): { id: string; name: string } {
    return removeAutomation(id, causation)
  }

  function removeAutomation(id: string, causation?: ScheduleToolCausation): { id: string; name: string } {
    if (causation) {
      const replay = Database.immediateTransaction((db) => {
        assertScheduledToolOccurrenceInTransaction(db, causation.occurrence)
        const tombstone = db
          .select()
          .from(AutomationDefinitionTombstoneTable)
          .where(eq(AutomationDefinitionTombstoneTable.tool_part_id, causation.occurrence.toolPartID))
          .get()
        if (!tombstone) return undefined
        if (tombstone.definition_id !== id || tombstone.tool_input_digest !== causation.inputDigest) {
          throw scheduledToolOccurrenceConflict(causation.occurrence, "changed its Automation delete input")
        }
        const definition = db
          .select({ name: AutomationTable.name })
          .from(AutomationTable)
          .where(eq(AutomationTable.definition_id, id))
          .orderBy(desc(AutomationTable.revision))
          .get()
        if (!definition) throw new Error(`Automation tombstone ${tombstone.id} has no definition`)
        return { id, name: definition.name }
      })
      if (replay) return replay
    }
    const current = assertPublicAutomation(id)
    const now = Date.now()
    if (current.pending_fire_id || (current.lease_owner && current.lease_until > now)) {
      throw new AutomationRunningConflictError({
        message: `Automation ${id} is currently running`,
        automationID: id,
      })
    }
    const row = Database.immediateTransaction((db) => {
      const latest = latestAutomationDefinitionInTransaction(db, id)
      const lease = currentControlLeaseInTransaction(db, "automation", id)
      if (!latest || latest.kind === "delay" || (lease && lease.expires_at > now)) return undefined
      if (projectAutomationFrontierInTransaction(db, latest).pending_fire_id) return undefined
      appendAutomationTombstoneInTransaction(db, latest, now, causation)
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

  function pendingDelays(now: number): AutomationRow[] {
    return Database.use((db) => currentAutomationFrontiersInTransaction(db, { kind: "delay", status: "active" }))
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

  async function run(now: number, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    const due = Database.use((db) => currentAutomationFrontiersInTransaction(db, { status: "active" }))
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
          const claimNow = (claimClockForTest ?? Date.now)()
          const owner = `${process.pid}:${claimNow}:${Identifier.ascending("call")}`
          const candidate = await validateDueAutomationBeforeClaim(row.id, claimNow)
          if (!candidate) continue
          const job = claim(row.id, owner, claimNow)
          if (!job) continue
          await executeWithRuntimeSettlement(job, owner, claimNow, true, execute, signal).catch((error) => {
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
    const job = Database.use((db) => projectAutomationFrontierInTransaction(db, persisted))
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
    return job
  }

  function concurrency() {
    const raw = process.env[CONCURRENCY_ENV]
    if (!raw) return CONCURRENCY_DEFAULT
    const value = Number(raw)
    if (!Number.isFinite(value)) return CONCURRENCY_DEFAULT
    if (value < 1) return 1
    return Math.min(Math.floor(value), CONCURRENCY_MAX)
  }

  /**
   * Take the fire owner for the exact revision that is being claimed.
   *
   * Reading the definition, deciding it is claimable and acquiring its lease
   * happen under one write transaction. Split across transactions, a revision
   * committed in between leaves an acquired lease that this claim then walks
   * away from: no fire owner runs, yet update, delete, manual rerun and due
   * selection all keep seeing the target as running until the lease expires.
   */
  function claim(id: string, owner: string, now: number, force = false) {
    return Database.immediateTransaction((db) => {
      const persisted = latestAutomationDefinitionInTransaction(db, id)
      if (!persisted || persisted.status !== "active") return undefined
      const projected = projectAutomationFrontierInTransaction(db, persisted)
      if (!force && projected.next_run > now) return undefined
      const acquired = acquireControlLeaseInTransaction(db, {
        target: "automation",
        targetID: id,
        ownerOccurrenceID: owner,
        now,
        leaseMilliseconds: LEASE_MS,
      })
      if (!acquired.acquired) return undefined
      const scheduledDueAt = projected.pending_fire_id
        ? projected.scheduled_due_at!
        : force
          ? now
          : projected.next_run
      const fireID =
        projected.pending_fire_id ??
        (force ? Identifier.ascending("automation") : deterministicAutomationID("cal", id, String(scheduledDueAt)))
      ensureAutomationFireInTransaction(db, {
        job: projected,
        fireID,
        scheduledDueAt,
        now,
        origin: force ? "manual_api" : "scheduled",
      })
      reserveAutomationFireAttemptInTransaction(db, {
        fireID,
        owner,
        now,
      })
      const claimed = projectAutomationFrontierInTransaction(db, persisted)
      return {
        ...claimed,
        lease_owner: acquired.lease.owner_occurrence_id,
        lease_until: acquired.lease.expires_at,
      }
    })
  }

  function missionDispositionForAutomationRun(
    run: AutomationRunRow | typeof AutomationRunTable.$inferSelect,
  ): MissionSchedulerOccurrenceDisposition | undefined {
    const projected = "session_id" in run ? run : Database.use((db) => projectAutomationRunInTransaction(db, run))
    if (!projected.session_id) return undefined
    const mission = Database.use((db) =>
      db
        .select({ id: SessionTable.id })
        .from(SessionTable)
        .where(and(eq(SessionTable.id, projected.session_id!), eq(SessionTable.kind, "mission")))
        .get(),
    )
    if (!mission) return undefined
    if (projected.mission_disposition === "mission_closed" && projected.mission_closure_event_id) {
      return {
        kind: "mission_closed",
        openedEventID: null,
        closureEventID: projected.mission_closure_event_id,
      }
    }
    return missionSchedulerOccurrenceDisposition({
      sessionID: mission.id,
      openedEventID: projected.mission_opened_event_id,
    })
  }

  function settleAutomationMissionClosed(
    job: AutomationRow,
    runID: string,
    owner: string,
    closureEventID: string,
    consumeDefinition: boolean,
  ): void {
    const now = Date.now()
    Database.immediateTransaction((db) => {
      const existing = db
        .select()
        .from(AutomationRunReceiptTable)
        .where(eq(AutomationRunReceiptTable.run_id, runID))
        .all()
        .find((receipt) => receipt.outcome !== "retry_wait")
      if (existing) {
        if (
          existing.outcome !== "disposition" ||
          existing.disposition !== "mission_closed" ||
          existing.closure_event_id !== closureEventID
        ) {
          throw new Error(`Automation run ${runID} conflicts with its terminal Mission disposition`)
        }
        return
      }
      const lease = currentControlLeaseInTransaction(db, "automation", job.id)
      if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= now) {
        throw new AutomationRunningConflictError({
          message: `Automation ${job.id} lost its lease before Mission closure settlement`,
          automationID: job.id,
        })
      }
      db.insert(AutomationRunReceiptTable)
        .values({
          id: Identifier.ascending("automation"),
          run_id: runID,
          outcome: "disposition",
          disposition: "mission_closed",
          closure_event_id: closureEventID,
          time_created: now,
        })
        .run()
      if (consumeDefinition) {
        const latest = latestAutomationDefinitionInTransaction(db, job.id)
        if (!latest || latest.id !== job.revision_id) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} definition changed before Mission closure settlement`,
            automationID: job.id,
          })
        }
        appendAutomationTombstoneInTransaction(db, latest, now)
      }
      releaseControlLeaseInTransaction(db, {
        target: "automation",
        targetID: job.id,
        leaseID: lease.id,
        ownerOccurrenceID: owner,
        now,
      })
    })
  }

  async function execute(
    job: AutomationRow,
    owner: string,
    now: number,
    reschedule: boolean,
    runtimeSignal: AbortSignal,
  ): Promise<string> {
    const scheduledDue = reschedule ? (job.scheduled_due_at ?? job.next_run) : now
    const fireID =
      job.pending_fire_id
        ? job.pending_fire_id
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
        if (!job.session_id) throw new Error(`Session delay ${job.id} has no Session target`)
        const targetSession = await Session.get(job.session_id).catch((error) => {
          if (error instanceof NotFoundError) return undefined
          throw error
        })
        if (!targetSession) {
          Database.immediateTransaction((db) => {
            const lease = currentControlLeaseInTransaction(db, "automation", job.id)
            if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) {
              throw new AutomationRunningConflictError({
                message: `Automation ${job.id} lost its lease before deleted-target settlement`,
                automationID: job.id,
              })
            }
            ensureAutomationFireInTransaction(db, {
              job,
              fireID,
              scheduledDueAt: scheduledDue,
              now,
              origin: reschedule ? "scheduled" : "manual_api",
            })
            settleAutomationFireAttemptReservedInTransaction(db, job, Date.now())
            db.insert(AutomationRunTable)
              .values({
                id: runID,
                automation_revision_id: job.revision_id,
                fire_id: fireID,
                started_at: now,
              })
              .onConflictDoNothing()
              .run()
            const projected = projectAutomationRunInTransaction(
              db,
              db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runID)).get()!,
            )
            if (projected.outcome === "running" || projected.outcome === "retry_wait") {
              db.insert(AutomationRunReceiptTable)
                .values({
                  id: Identifier.ascending("automation"),
                  run_id: runID,
                  outcome: "disposition",
                  disposition: "target_deleted",
                  time_created: Date.now(),
                })
                .run()
            }
            const latest = latestAutomationDefinitionInTransaction(db, job.id)
            if (latest?.id === job.revision_id) appendAutomationTombstoneInTransaction(db, latest, Date.now())
            releaseControlLeaseInTransaction(db, {
              target: "automation",
              targetID: job.id,
              leaseID: lease.id,
              ownerOccurrenceID: owner,
              now: Date.now(),
            })
          })
          return fireID
        }
        Database.immediateTransaction((db) => {
          const lease = currentControlLeaseInTransaction(db, "automation", job.id)
          if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) {
            throw new AutomationRunningConflictError({
              message: `Automation ${job.id} lost its lease before delay reservation`,
              automationID: job.id,
            })
          }
          ensureAutomationFireInTransaction(db, {
            job,
            fireID,
            scheduledDueAt: scheduledDue,
            now,
            origin: reschedule ? "scheduled" : "manual_api",
          })
          settleAutomationFireAttemptReservedInTransaction(db, job, now)
          const reservation = schedulerMissionReservationInTransaction(db, job.session_id)
          const inserted = db.insert(AutomationRunTable)
            .values({
              id: runID,
              automation_revision_id: job.revision_id,
              fire_id: fireID,
              target_project_id: null,
              mission_opened_event_id: reservation.openedEventID,
              mission_disposition: reservation.disposition,
              mission_closure_event_id: reservation.closureEventID,
              started_at: now,
            })
            .onConflictDoNothing()
            .returning()
            .get()
          if (inserted && reservation.kind === "mission_closed") {
            db.insert(AutomationRunReceiptTable)
              .values({
                id: Identifier.ascending("automation"),
                run_id: runID,
                outcome: "disposition",
                disposition: "mission_closed",
                closure_event_id: reservation.closureEventID,
                time_created: now,
              })
              .run()
            const latest = latestAutomationDefinitionInTransaction(db, job.id)
            if (!latest || latest.id !== job.revision_id) {
              throw new AutomationRunningConflictError({
                message: `Automation ${job.id} definition changed before terminal Mission reservation`,
                automationID: job.id,
              })
            }
            appendAutomationTombstoneInTransaction(db, latest, now)
            releaseControlLeaseInTransaction(db, {
              target: "automation",
              targetID: job.id,
              leaseID: lease.id,
              ownerOccurrenceID: owner,
              now,
            })
          }
        })
        await afterRunReservationForTest?.({ runIDs: [runID] })
        const reserved = Database.use((db) =>
          db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runID)).get(),
        )
        if (!reserved) throw new Error(`Automation delay run ${runID} was not reserved`)
        const missionDisposition = missionDispositionForAutomationRun(reserved)
        if (missionDisposition?.kind === "mission_closed") {
          settleAutomationMissionClosed(job, runID, owner, missionDisposition.closureEventID, true)
          return fireID
        }
        inactivityFence.touch("delayed wake dispatch")
        let outcome: Awaited<ReturnType<typeof executeDelayedWake>>
        try {
          outcome = await executeDelayedWake(job, fireID, runID, owner, executionSignal, inactivityFence)
        } catch (error) {
          const missionAdmissionRejected =
            MissionExecutionWakeClosedError.isInstance(error) ||
            MissionExecutionWakeNotOpenedError.isInstance(error) ||
            MissionSchedulerOccurrenceClosedError.isInstance(error)
          const disposition = missionAdmissionRejected ? missionDispositionForAutomationRun(reserved) : undefined
          if (disposition?.kind !== "mission_closed") throw error
          settleAutomationMissionClosed(job, runID, owner, disposition.closureEventID, true)
          return fireID
        }
        const completedAt = Date.now()
        // One terminal transaction: the succeeded receipt, the one-shot
        // tombstone and the end of this fire's lease are the same fact, so a
        // lost fence must leave none of them behind.
        Database.immediateTransaction((db) => {
          const lease = currentControlLeaseInTransaction(db, "automation", job.id)
          if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= completedAt) {
            throw new AutomationRunningConflictError({
              message: `Automation ${job.id} lost its execution lease before one-shot completion`,
              automationID: job.id,
            })
          }
          const existing = db
            .select()
            .from(AutomationRunReceiptTable)
            .where(eq(AutomationRunReceiptTable.run_id, runID))
            .all()
            .find((receipt) => receipt.outcome === "succeeded")
          if (!existing)
            db.insert(AutomationRunReceiptTable)
              .values({
                id: Identifier.ascending("automation"),
                run_id: runID,
                outcome: "succeeded",
                time_created: completedAt,
              })
              .run()
          const latest = latestAutomationDefinitionInTransaction(db, job.id)
          if (!latest || latest.id !== job.revision_id) {
            throw new AutomationRunningConflictError({
              message: `Automation ${job.id} definition changed before one-shot completion`,
              automationID: job.id,
            })
          }
          appendAutomationTombstoneInTransaction(db, latest, completedAt)
          releaseControlLeaseInTransaction(db, {
            target: "automation",
            targetID: job.id,
            leaseID: lease.id,
            ownerOccurrenceID: owner,
            now: completedAt,
          })
        })
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
      await beforeRunReservationForTest?.()
      Database.immediateTransaction((db) => {
        const lease = currentControlLeaseInTransaction(db, "automation", job.id)
        if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= Date.now()) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} lost its execution lease before fire reservation`,
            automationID: job.id,
          })
        }
        ensureAutomationFireInTransaction(db, {
          job,
          fireID,
          scheduledDueAt: scheduledDue,
          now,
          origin: reschedule ? "scheduled" : "manual_api",
        })
        settleAutomationFireAttemptReservedInTransaction(db, job, now)
        targets.forEach((target, index) => {
          const reservation = schedulerMissionReservationInTransaction(db, target.sessionID)
          const inserted = db.insert(AutomationRunTable)
            .values({
              id: runIDs[index],
              automation_revision_id: job.revision_id,
              fire_id: fireID,
              target_project_id: target.scope === "project" ? target.projectID : null,
              mission_opened_event_id: reservation.openedEventID,
              mission_disposition: reservation.disposition,
              mission_closure_event_id: reservation.closureEventID,
              started_at: now,
            })
            .onConflictDoNothing()
            .returning()
            .get()
          if (inserted && reservation.kind === "mission_closed") {
            db.insert(AutomationRunReceiptTable)
              .values({
                id: Identifier.ascending("automation"),
                run_id: inserted.id,
                outcome: "disposition",
                disposition: "mission_closed",
                closure_event_id: reservation.closureEventID,
                time_created: now,
              })
              .run()
          }
          if (inserted && target.disposition === "target_deleted") {
            db.insert(AutomationRunReceiptTable)
              .values({
                id: Identifier.ascending("automation"),
                run_id: inserted.id,
                outcome: "disposition",
                disposition: "target_deleted",
                time_created: now,
              })
              .run()
          }
        })
      })
      await afterRunReservationForTest?.({ runIDs })
      inactivityFence.touch("target occurrences reserved")
      const reservedRuns = new Map(
        Database.use((db) =>
          db
            .select()
            .from(AutomationRunTable)
            .where(inArray(AutomationRunTable.id, runIDs))
            .all()
            .map((run) => projectAutomationRunInTransaction(db, run)),
        ).map((run) => [run.id, run] as const),
      )
      let results: PromiseSettledResult<
        | { kind: "succeeded"; sessionID: string }
        | { kind: "target_deleted" }
        | Extract<MissionSchedulerOccurrenceDisposition, { kind: "mission_closed" }>
      >[] = []
      results = await Promise.allSettled(
        targets.map(async (target, index) => {
          const reserved = reservedRuns.get(runIDs[index]!)
          try {
            if (reserved?.outcome === "succeeded") {
              if (!reserved.session_id)
                throw new Error(`Succeeded Automation run ${reserved.id} has no Session authority`)
              return { kind: "succeeded" as const, sessionID: reserved.session_id }
            }
            if (reserved?.outcome === "disposition") {
              if (reserved.disposition === "target_deleted") return { kind: "target_deleted" as const }
              if (reserved.disposition !== "mission_closed" || !reserved.closure_event_id) {
                throw new Error(`Automation run ${reserved.id} has an invalid terminal disposition`)
              }
              const exact = missionDispositionForAutomationRun(reserved)
              if (exact?.kind !== "mission_closed" || exact.closureEventID !== reserved.closure_event_id) {
                throw new Error(`Automation run ${reserved.id} has a conflicting Mission closure disposition`)
              }
              return exact
            }
            if (!reserved) throw new Error(`Automation run ${runIDs[index]} was not reserved`)
            const missionDisposition = missionDispositionForAutomationRun(reserved)
            if (missionDisposition?.kind === "mission_closed") return missionDisposition
            const existing = findAutomationWake(job.id, fireID, target)
            if (existing) {
              return {
                kind: "succeeded" as const,
                sessionID: await resumeAutomationWake(existing, inactivityFence, reserved.id),
              }
            }
            return {
              kind: "succeeded" as const,
              ...(await executePublicWake(
                job,
                target,
                fireID,
                runIDs[index]!,
                owner,
                executionSignal,
                inactivityFence,
              )),
            }
          } catch (error) {
            const missionAdmissionRejected =
              MissionExecutionWakeClosedError.isInstance(error) ||
              MissionExecutionWakeNotOpenedError.isInstance(error) ||
              MissionSchedulerOccurrenceClosedError.isInstance(error)
            if (missionAdmissionRejected && reserved) {
              const disposition = missionDispositionForAutomationRun(reserved)
              if (disposition?.kind === "mission_closed") return disposition
            }
            throw error
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
      const exhausted = error !== null && job.failure_count + 1 >= MAX_FIRE_ATTEMPTS
      const retryAt = error && !exhausted ? automationRetryAt(job.failure_count + 1, committedAt) : 0
      const nextRun = retryAt
        ? retryAt
        : reschedule
          ? Recurrence.nextRun(job.recurrence, committedAt)
          : job.next_run
      inactivityFence.touch("durable fire settlement")
      Database.immediateTransaction((tx) => {
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
          if (prior?.outcome === "succeeded" || prior?.outcome === "disposition") return
          if (!prior) throw new Error(`Automation run ${runIDs[index]} was not reserved`)
          tx.insert(AutomationRunReceiptTable)
            .values({
              id: Identifier.ascending("automation"),
              run_id: prior.id,
              outcome:
                result.status === "fulfilled" && result.value.kind === "mission_closed"
                  ? "disposition"
                  : result.status === "fulfilled" && result.value.kind === "target_deleted"
                    ? "disposition"
                  : result.status === "fulfilled"
                    ? "succeeded"
                    : exhausted
                      ? "failed"
                      : "retry_wait",
              disposition:
                result.status === "fulfilled" && result.value.kind === "mission_closed"
                  ? "mission_closed"
                  : result.status === "fulfilled" && result.value.kind === "target_deleted"
                    ? "target_deleted"
                    : null,
              closure_event_id:
                result.status === "fulfilled" && result.value.kind === "mission_closed"
                  ? result.value.closureEventID
                  : null,
              retry_at: result.status === "rejected" && !exhausted ? retryAt : null,
              error:
                result.status === "rejected"
                  ? result.reason instanceof Error
                    ? result.reason.message
                    : String(result.reason)
                  : null,
              time_created: committedAt,
            })
            .run()
        })
        // This fire is settled. Its lease ends with the receipts that settle
        // it, so the recorded retry time — or the next recurrence — is the
        // only thing deferring the target, and an immediately following
        // update, delete or manual rerun is not refused by a dead owner.
        releaseControlLeaseInTransaction(tx, {
          target: "automation",
          targetID: job.id,
          leaseID: lease.id,
          ownerOccurrenceID: owner,
          now: committedAt,
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
      `automation-fire:${job.id}:${job.pending_fire_id ?? job.next_run}`,
    )
    const signal = lifecycleSignal ? AbortSignal.any([reservation.signal, lifecycleSignal]) : reservation.signal
    const operation = executeFire(job, owner, now, reschedule, signal).catch(async (error) => {
      await fail(job, owner, error, now)
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
    disposition?: "target_deleted"
  }

  function deterministicAutomationID(prefix: "cal" | "atr" | "ses" | "msg" | "prt", ...parts: string[]): string {
    const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex")
    return `${prefix}_automation_${digest.slice(0, 32)}`
  }

  function ensureAutomationFireInTransaction(
    db: Database.TxOrDb,
    input: {
      job: AutomationRow
      fireID: string
      scheduledDueAt: number
      now: number
      origin: "scheduled" | "manual_api"
    },
  ): void {
    db.insert(AutomationFireTable)
      .values({
        id: input.fireID,
        automation_revision_id: input.job.revision_id,
        scheduled_due_at: input.scheduledDueAt,
        origin: input.origin,
        time_created: input.now,
      })
      .onConflictDoNothing()
      .run()
    const fire = db.select().from(AutomationFireTable).where(eq(AutomationFireTable.id, input.fireID)).get()
    if (
      !fire ||
      fire.automation_revision_id !== input.job.revision_id ||
      fire.scheduled_due_at !== input.scheduledDueAt
    ) {
      throw new Error(`Automation logical fire ${input.fireID} changed its immutable occurrence`)
    }
  }

  function reserveAutomationFireAttemptInTransaction(
    db: Database.TxOrDb,
    input: { fireID: string; owner: string; now: number },
  ): typeof AutomationFireAttemptTable.$inferSelect {
    const attempts = db
      .select()
      .from(AutomationFireAttemptTable)
      .where(eq(AutomationFireAttemptTable.fire_id, input.fireID))
      .orderBy(desc(AutomationFireAttemptTable.ordinal))
      .all()
    const latest = attempts[0]
    if (latest) {
      const receipt = db
        .select()
        .from(AutomationFireAttemptReceiptTable)
        .where(eq(AutomationFireAttemptReceiptTable.attempt_id, latest.id))
        .get()
      if (!receipt) {
        db.insert(AutomationFireAttemptReceiptTable)
          .values({
            attempt_id: latest.id,
            outcome: "retry_wait",
            retry_at: input.now,
            error: `Automation fire owner ${latest.owner_occurrence_id} expired before target reservation`,
            time_created: input.now,
          })
          .run()
      } else if (receipt.outcome === "failed") {
        throw new AutomationRunningConflictError({
          message: `Automation fire ${input.fireID} is already terminal`,
          automationID: input.fireID,
        })
      } else if (receipt.outcome === "retry_wait" && receipt.retry_at! > input.now) {
        throw new AutomationRunningConflictError({
          message: `Automation fire ${input.fireID} is not ready for its next attempt`,
          automationID: input.fireID,
        })
      }
    }
    const ordinal = (latest?.ordinal ?? 0) + 1
    const attemptID = Identifier.deterministic(
      "automation",
      `automation-fire-attempt-v1\0${input.fireID}\0${ordinal}`,
    )
    db.insert(AutomationFireAttemptTable)
      .values({
        id: attemptID,
        fire_id: input.fireID,
        ordinal,
        owner_occurrence_id: input.owner,
        time_created: input.now,
      })
      .run()
    return db.select().from(AutomationFireAttemptTable).where(eq(AutomationFireAttemptTable.id, attemptID)).get()!
  }

  function settleAutomationFireAttemptReservedInTransaction(db: Database.TxOrDb, job: AutomationRow, now: number): void {
    if (!job.attempt_id) throw new Error(`Automation fire ${job.pending_fire_id ?? job.id} has no physical attempt`)
    const existing = db
      .select()
      .from(AutomationFireAttemptReceiptTable)
      .where(eq(AutomationFireAttemptReceiptTable.attempt_id, job.attempt_id))
      .get()
    if (existing) {
      if (existing.outcome !== "reserved") {
        throw new Error(`Automation fire attempt ${job.attempt_id} was already settled as ${existing.outcome}`)
      }
      return
    }
    db.insert(AutomationFireAttemptReceiptTable)
      .values({ attempt_id: job.attempt_id, outcome: "reserved", time_created: now })
      .run()
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
    runID: string | undefined,
    wake: (admission?: MissionExecutionWakeAdmission) => Receipt | Promise<Receipt>,
  ): Promise<Receipt> {
    if (session.kind !== "mission") return wake()
    if (!runID) throw new Error(`Mission Automation wake for Session ${session.id} has no exact run identity`)
    const run = Database.use((db) => db.select().from(AutomationRunTable).where(eq(AutomationRunTable.id, runID)).get())
    if (
      !run?.mission_opened_event_id ||
      run.mission_disposition !== null ||
      run.mission_closure_event_id !== null
    ) {
      throw new Error(`Automation run ${runID} has no exact Mission opened occurrence binding`)
    }
    await beforeMissionSessionAdmissionForTest?.()
    const mission = await requireMissionSession(session.id)
    return admitMissionExecutionWake({
      missionID: mission.missionID,
      sessionID: mission.id,
      wake: (admission) => {
        assertMissionSchedulerOccurrenceAdmission({
          sessionID: mission.id,
          openedEventID: run.mission_opened_event_id!,
          admissionOpenedEventID: admission.closureEventID,
        })
        return wake(admission)
      },
    })
  }

  async function resumeAutomationWake(
    existing: { sessionID: string; messageID: string },
    inactivityFence: SchedulerExecutionInactivityFence,
    runID: string,
  ): Promise<string> {
    const session = await Session.get(existing.sessionID)
    const receipt = await admitAutomationSessionWake(session, runID, (missionAdmission) =>
      SessionWake.resumePersistedWakeWithReceipt({
        sessionID: existing.sessionID,
        messageID: existing.messageID,
        directory: session.directory,
        retryFailedReply: true,
        ownerPreflight: missionAdmission?.ownerPreflight,
        ownerLifecycle: missionAdmission?.ownerLifecycle,
      }),
    )
    await receipt.activation
    const completion = await inactivityFence.runDelegated("Session owner reply completion", () => receipt.completion)
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
            sql`json_extract(${MessageTable.data}, ${SessionWake.reasonJSONPath("source")}) = 'scheduler.automation'`,
            sql`json_extract(${MessageTable.data}, ${SessionWake.reasonJSONPath("jobID")}) = ${input.jobID}`,
            sql`json_extract(${MessageTable.data}, ${SessionWake.reasonJSONPath("fireID")}) = ${input.fireID}`,
          ),
        )
        .get(),
    )
    return row ? { sessionID: row.sessionID, messageID: row.id } : undefined
  }

  async function executionTargets(job: AutomationRow): Promise<ExecutionTarget[]> {
    const target = targetForRow(job)
    if (target.scope === "session") {
      const session = await Session.get(target.sessionId).catch((error) => {
        if (error instanceof NotFoundError) return undefined
        throw error
      })
      return session
        ? [{ scope: "session", projectID: session.projectID, directory: session.directory, sessionID: session.id }]
        : [{ scope: "session", projectID: null, sessionID: target.sessionId, disposition: "target_deleted" }]
    }
    if (target.scope === "global") return [{ scope: "global", projectID: null }]
    return target.projectIds.map((projectID) => {
      const project = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get())
      if (!project) return { scope: "project" as const, projectID, disposition: "target_deleted" as const }
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
    inactivityFence: SchedulerExecutionInactivityFence,
  ): Promise<{ sessionID: string }> {
    const targetSessionID = automationTargetSessionID(target, runID)
    if (target.scope === "global") {
      let globalSession = await Session.get(targetSessionID).catch((error) => {
        if (error instanceof NotFoundError) return undefined
        throw error
      })
      if (!globalSession) {
        try {
          const created = await requireGlobalConversationCreator()({
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
        fn: async () => ({
          sessionID: await wakeSession(job, fireID, globalSession.id, runID, runID, owner, signal, inactivityFence),
        }),
      })
    }
    if (!target.directory) throw new Error(`Automation target ${target.projectID ?? target.scope} has no directory`)
    return await runInTargetProject({
      directory: target.directory,
      fn: async () => {
        if (target.scope === "session") {
          if (!target.sessionID) throw new Error(`Session automation ${job.id} has no session target`)
          return {
            sessionID: await wakeSession(job, fireID, target.sessionID, runID, runID, owner, signal, inactivityFence),
          }
        }
        if (job.execution_mode === "worktree") {
          const worktree = await Worktree.create({ name: `automation-${job.id}`, reuseIfValid: true })
          return await Instance.provide({
            directory: worktree.directory,
            fn: async () => {
              await ensureAutomationTargetSession(targetSessionID, job.prompt)
              return {
                sessionID: await wakeSession(
                  job,
                  fireID,
                  targetSessionID,
                  runID,
                  runID,
                  owner,
                  signal,
                  inactivityFence,
                ),
              }
            },
          })
        }
        await ensureAutomationTargetSession(targetSessionID, job.prompt)
        return {
          sessionID: await wakeSession(job, fireID, targetSessionID, runID, runID, owner, signal, inactivityFence),
        }
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
    inactivityFence: SchedulerExecutionInactivityFence,
  ): Promise<string> {
    const scope = job.kind === "delay" ? "session" : job.scope
    if (!scope) throw new Error(`Automation ${job.id} has no execution scope`)
    const messageID = deterministicAutomationID("msg", identityID)
    const textPartID = deterministicAutomationID("prt", identityID)
    const session = await Session.get(sessionID)
    const receipt = await admitAutomationSessionWake(session, runID, (missionAdmission) =>
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
        preflightBundle: missionAdmission?.preflightBundle,
        ownerPreflight: missionAdmission?.ownerPreflight,
        ownerLifecycle: missionAdmission?.ownerLifecycle,
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
    await receipt.activation
    const completion = await inactivityFence.runDelegated("Session owner reply completion", () => receipt.completion)
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
      const definition = persisted
        ? db
            .select({ definitionID: AutomationTable.definition_id })
            .from(AutomationTable)
            .where(eq(AutomationTable.id, persisted.automation_revision_id))
            .get()
        : undefined
      if (definition?.definitionID !== input.automationID)
        throw new AutomationRunningConflictError({
          message: `Automation run ${input.runID} belongs to another definition`,
          automationID: input.automationID,
        })
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
    inactivityFence: SchedulerExecutionInactivityFence,
  ): Promise<{
    sessionID?: string
    taskID?: string
    wakeID?: string
    dispatchResult?: string
    dispatchError?: string
  }> {
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
    if (existing) return { sessionID: await resumeAutomationWake(existing, inactivityFence, runID) }
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
      fn: () => wakeSession(job, fireID, session.id, identityID, runID, owner, signal, inactivityFence),
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
    renewControlLease({
      target: "automation",
      targetID: id,
      leaseID: lease.id,
      ownerOccurrenceID: owner,
      now,
      expiresAt: now + LEASE_MS,
    })
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

  async function fail(job: AutomationRow, owner: string, err: unknown, executionStartedAt?: number): Promise<void> {
    await failurePersistenceHookForTest?.("before")
    const now = Date.now()
    const step = job.failure_count + 1
    const retryAt = step >= MAX_FIRE_ATTEMPTS ? null : automationRetryAt(step, now)
    const msg = err instanceof Error ? err.message : String(err)

    const finalized = Database.immediateTransaction((tx) => {
      const lease = currentControlLeaseInTransaction(tx, "automation", job.id)
      if (!lease || lease.owner_occurrence_id !== owner || lease.expires_at <= now) return false
      appendAutomationFailureReceipts(tx, job, msg, retryAt, now, executionStartedAt)
      // The failure receipt owns the retry time; keeping the lease past it
      // would silently replace that retry time with the lease duration.
      releaseControlLeaseInTransaction(tx, {
        target: "automation",
        targetID: job.id,
        leaseID: lease.id,
        ownerOccurrenceID: owner,
        now,
      })
      return true
    })

    if (finalized) {
      log.error("automation execution failed", {
        jobId: job.id,
        name: job.name,
        error: msg,
        ...(retryAt === null ? { exhausted: true } : { retryAt: new Date(retryAt).toISOString() }),
      })
    }
    await failurePersistenceHookForTest?.("after")
  }

  function appendAutomationFailureReceipts(
    db: Database.TxOrDb,
    job: AutomationRow,
    message: string,
    retryAt: number | null,
    now: number,
    executionStartedAt?: number,
  ): void {
    if (!job.attempt_id) throw new Error(`Automation ${job.id} failure has no physical fire attempt`)
    const attemptReceipt = db
      .select()
      .from(AutomationFireAttemptReceiptTable)
      .where(eq(AutomationFireAttemptReceiptTable.attempt_id, job.attempt_id))
      .get()
    if (!attemptReceipt) {
      db.insert(AutomationFireAttemptReceiptTable)
        .values({
          attempt_id: job.attempt_id,
          outcome: retryAt === null ? "failed" : "retry_wait",
          retry_at: retryAt,
          error: message,
          time_created: now,
        })
        .run()
      if (retryAt === null && job.kind === "delay") {
        const latest = latestAutomationDefinitionInTransaction(db, job.id)
        if (!latest || latest.id !== job.revision_id) {
          throw new AutomationRunningConflictError({
            message: `Automation ${job.id} definition changed before terminal attempt settlement`,
            automationID: job.id,
          })
        }
        appendAutomationTombstoneInTransaction(db, latest, now)
      }
      return
    }
    if (attemptReceipt.outcome !== "reserved") return
    const revisions = db
      .select({ id: AutomationTable.id })
      .from(AutomationTable)
      .where(eq(AutomationTable.definition_id, job.id))
      .all()
      .map((row) => row.id)
    const projectedRuns =
      revisions.length === 0
        ? []
        : db
            .select()
            .from(AutomationRunTable)
            .where(inArray(AutomationRunTable.automation_revision_id, revisions))
            .all()
            .map((run) => projectAutomationRunInTransaction(db, run))
    if (
      executionStartedAt !== undefined &&
      projectedRuns.some(
        (run) =>
          run.started_at === executionStartedAt &&
          (run.outcome === "succeeded" || run.outcome === "failed" || run.outcome === "disposition"),
      )
    ) {
      return
    }
    const runs = projectedRuns.filter((run) => run.outcome === "running" || run.outcome === "retry_wait")
    if (runs.length === 0) {
      throw new Error(`Reserved Automation attempt ${job.attempt_id} has no target occurrence to settle`)
    }
    for (const run of runs) {
      db.insert(AutomationRunReceiptTable)
        .values({
          id: Identifier.ascending("automation"),
          run_id: run.id,
          outcome: retryAt === null ? "failed" : "retry_wait",
          retry_at: retryAt,
          error: message,
          time_created: now,
        })
        .run()
    }
    if (retryAt === null && job.kind === "delay") {
      const latest = latestAutomationDefinitionInTransaction(db, job.id)
      if (latest?.id === job.revision_id) appendAutomationTombstoneInTransaction(db, latest, now)
    }
  }


}
