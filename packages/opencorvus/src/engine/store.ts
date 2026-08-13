import { ProjectTable } from "@/project/project.sql"
import { isDeepStrictEqual } from "node:util"
import { SessionTable } from "@/session/session.sql"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { timelineInteractionResponseOrderKey, timelineOrderKey } from "@/timeline/order"
import {
  Database,
  NotFoundError,
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  sql,
} from "@/storage/db"
import type { SQL } from "@/storage/db"
import { parseIntegrityReviewArtifactPayload, type IntegrityReviewArtifactPayload } from "@/integrity/review-artifact"
import { parseAcceptanceSpecs } from "@/acceptance/types"
import {
  EngineArtifactTable,
  EngineGoalTable,
  EngineInteractionRequestTable,
  EngineProgressSnapshotTable,
  EngineTaskTable,
  type EngineBudget,
  type EngineArtifactKind,
  type EngineMetadata,
} from "./engine.sql"
import { deriveTaskStatus, taskTerminalReason } from "./task-status"
import { pendingTaskCancellationProjection, taskCancellationProjection } from "./cancellation-projection"
import { GoalWorkloadArtifactSchema, type GoalWorkloadArtifact } from "@/goal-workload-analyst/types"
import { validateGoalWorkloadArtifactRelationalIntegrity } from "@/goal-workload-analyst/publication"
import { RequirementSetArtifactPayloadSchema, type RequirementSet } from "@/requirements/types"
import {
  ResearchBriefSchema,
  validateResearchBriefIntegrity,
  validateResearchBriefTaskBoundary,
  type ResearchBrief,
} from "@/research/schema"
import {
  BuildFileObservation as SnapshotBuildFileObservation,
  type BuildFileObservation as SnapshotBuildFileObservationData,
} from "@/snapshot/types"
import { SessionPromptState } from "@/session/prompt/state"
import { taskIDForSession } from "./task-session-lineage"
import { findTaskCompletionDecisionForTerminalTime } from "./completion-decision"
import {
  ArtifactReadLocatorSchema,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import {
  ArchitectContractGraphArtifactPayloadSchema,
  type ArchitectContractGraphArtifactPayload,
} from "./architect-contract-graph-artifact"
import {
  GoalGraphProjectionArtifactPayloadSchema,
  resolveGoalGraphProjectionTip,
  type GoalGraphProducer,
  type GoalGraphProjectionArtifactPayload,
} from "./goal-graph-projection"
import type { ArchitectFidelityState } from "@/architect/fidelity"
import { emptyArchitectFidelityState } from "@/architect/fidelity"
import { assertEngineArtifactPayloadIdentity } from "./artifact-catalog-metadata"
import {
  type ArchitectContractGraph,
} from "@/architect/contract-graph"
import { requireTaskPackageRevisionBinding } from "./task-package-revision-binding"
import { parseFrontendResearchBriefArtifactEnvelope } from "@/research/frontend-research-artifact"
import {
  resolveDeliverySliceRevisionIdentity,
  type DeliverySliceRevisionIdentity,
} from "./delivery-slice"

export type TaskRow = typeof EngineTaskTable.$inferSelect
export type GoalRow = typeof EngineGoalTable.$inferSelect
export type InteractionRow = typeof EngineInteractionRequestTable.$inferSelect
export type ArtifactRow = typeof EngineArtifactTable.$inferSelect
export type RequirementSetArtifactRow = Omit<ArtifactRow, "kind" | "payload"> & {
  kind: "requirement_set"
  payload: import("@/requirements/types").RequirementSetArtifactPayload
}
export type ContractGraphArtifactPayload = ArchitectContractGraphArtifactPayload
export type ContractGraphArtifactRow = Omit<ArtifactRow, "kind" | "payload"> & {
  kind: "architect_contract_graph"
  payload: ContractGraphArtifactPayload
}
export type GoalGraphProjectionArtifactRow = Omit<ArtifactRow, "kind" | "payload"> & {
  kind: "goal_graph_projection"
  payload: GoalGraphProjectionArtifactPayload
}
export type ResearchBriefArtifactRow = ArtifactRow & { payload: ResearchBrief }
export type GoalWorkloadArtifactRow = Omit<ArtifactRow, "kind" | "payload"> & {
  kind: "goal_workload"
  payload: GoalWorkloadArtifact
}
export type BuildHostObservationRow = {
  id: string
  locator: EngineArtifactLocator
  task_id: string
  session_id: string | null
  final_message_id: string | null
  execution_mode: "current_project" | "managed_worktree"
  commit_ref: string | null
  published_commit_ref: string | null
  primary_base_commit_ref: string | null
  primary_terminal_commit_ref: string | null
  diff_base_ref: string | null
  diff_head_ref: string | null
  diffs: SnapshotBuildFileObservationData[]
  changed_files: string[]
  observed_artifact_locators: ArtifactReadLocator[]
  source_artifact_locators: ArtifactReadLocator[]
  time_created: number
  time_updated: number
}
export type ProgressRow = typeof EngineProgressSnapshotTable.$inferSelect

function exactGoalArtifactLocator(input: {
  goal: GoalRow
  id: string | null
  revision: number | null
  sha256: string | null
  field: "requirement_set" | "contract_graph"
}): EngineArtifactLocator | undefined {
  if (input.id === null && input.revision === null && input.sha256 === null) return undefined
  if (!input.id || !input.revision || !input.sha256) {
    throw new Error(
      `Goal ${input.goal.id} has an incomplete ${input.field} Artifact locator`,
    )
  }
  return {
    source: "engine_artifact",
    artifact_id: input.id,
    catalog_revision: input.revision,
    expected_sha256: input.sha256,
  }
}

export function goalBirthRequirementSetArtifactLocator(goal: GoalRow): EngineArtifactLocator | undefined {
  return exactGoalArtifactLocator({
    goal,
    id: goal.requirement_set_artifact_id,
    revision: goal.requirement_set_artifact_revision,
    sha256: goal.requirement_set_artifact_sha256,
    field: "requirement_set",
  })
}

export function goalBirthContractGraphArtifactLocator(goal: GoalRow): EngineArtifactLocator | undefined {
  return exactGoalArtifactLocator({
    goal,
    id: goal.contract_graph_artifact_id,
    revision: goal.contract_graph_artifact_revision,
    sha256: goal.contract_graph_artifact_sha256,
    field: "contract_graph",
  })
}
export type TaskProjectRow = {
  id: string
  name?: string
  worktree: string
}
export type TaskListRow = {
  task: TaskRow
  directory: string
  project: TaskProjectRow | null
}

export function findArtifact(input: { taskID: string; artifactID: string }): ArtifactRow | undefined {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.id, input.artifactID)))
      .get(),
  )
}

export function requireTask(taskID: string) {
  const row = findTask(taskID)
  if (!row) throw new NotFoundError({ message: `Task not found: ${taskID}` })
  return row
}

export function requireInteraction(interactionID: string) {
  const row = findInteraction(interactionID)
  if (!row) throw new NotFoundError({ message: `Interaction not found: ${interactionID}` })
  return row
}

export function findTask(taskID: string) {
  return Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get())
}

// Resolve a task into the set of session IDs that belong to it (root +
// orchestrator + every nested executor / sub-agent session). Memory rows are
// keyed by session_id, so to surface "task context" the panel must collect
// every session under the task tree. Returns an empty array when the task
// has no root session (deleted task / dangling FK), which collapses any
// downstream filter to "this task contributed nothing yet".
export function sessionIDsForTask(taskID: string): string[] {
  return Database.use((db) =>
    db
      .all<{ id: string }>(
        sql`
        WITH RECURSIVE session_tree(id) AS (
          SELECT session_id FROM engine_task WHERE id = ${taskID}
          UNION ALL
          SELECT s.id FROM session s JOIN session_tree st ON s.parent_id = st.id
        )
        SELECT id FROM session_tree WHERE id IS NOT NULL
      `,
      )
      .map((row) => row.id),
  )
}

function missionTaskConditions(input: { projectID: string; missionID: string; sessionID: string }) {
  return [
    eq(EngineTaskTable.project_id, input.projectID),
    eq(EngineTaskTable.source, "mission"),
    sql`json_extract(${EngineTaskTable.metadata}, '$.actor') = 'mission'`,
    sql`json_extract(${EngineTaskTable.metadata}, '$.mission.id') = ${input.missionID}`,
    sql`json_extract(${EngineTaskTable.metadata}, '$.mission.session_id') = ${input.sessionID}`,
  ] as const
}

export function listAllMissionTasks(input: { projectID: string; missionID: string; sessionID: string }): TaskRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskTable)
      .where(and(...missionTaskConditions(input)))
      .orderBy(desc(EngineTaskTable.time_updated), desc(EngineTaskTable.id))
      .all(),
  )
}

export function listMissionTasks(input: { projectID: string; missionID: string; sessionID: string }): TaskRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskTable)
      .where(and(...missionTaskConditions(input), isNull(EngineTaskTable.time_archived)))
      .orderBy(desc(EngineTaskTable.time_updated), desc(EngineTaskTable.id))
      .all(),
  )
}

export function findTaskByRequest(projectID: string, requestID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.project_id, projectID), eq(EngineTaskTable.request_id, requestID)))
      .get(),
  )
}

export function parseContractGraphArtifact(row: ArtifactRow): ContractGraphArtifactRow {
  if (row.kind !== "architect_contract_graph") {
    throw new Error(`Artifact ${row.id} is ${row.kind}, not architect_contract_graph`)
  }
  assertEngineArtifactPayloadIdentity({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    payloadSHA256: row.payload_sha256,
    payloadBytes: row.payload_bytes,
  })
  return {
    ...row,
    kind: "architect_contract_graph",
    payload: ArchitectContractGraphArtifactPayloadSchema.parse(row.payload),
  }
}

export function parseGoalGraphProjectionArtifact(
  row: ArtifactRow,
): GoalGraphProjectionArtifactRow {
  if (row.kind !== "goal_graph_projection") {
    throw new Error(`Artifact ${row.id} is ${row.kind}, not goal_graph_projection`)
  }
  assertEngineArtifactPayloadIdentity({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    payloadSHA256: row.payload_sha256,
    payloadBytes: row.payload_bytes,
  })
  return {
    ...row,
    kind: "goal_graph_projection",
    payload: GoalGraphProjectionArtifactPayloadSchema.parse(row.payload),
  }
}

export function parseRequirementSetArtifact(row: ArtifactRow): RequirementSetArtifactRow {
  if (row.kind !== "requirement_set") {
    throw new Error(`Artifact ${row.id} is ${row.kind}, not requirement_set`)
  }
  return {
    ...row,
    kind: "requirement_set",
    payload: RequirementSetArtifactPayloadSchema.parse(row.payload),
  }
}

export function listRequirementSetArtifacts(taskID: string): RequirementSetArtifactRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "requirement_set")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all(),
  ).map(parseRequirementSetArtifact)
}

export function findRequirementSetArtifact(input: {
  taskID: string
  artifactID: string
}): RequirementSetArtifactRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "requirement_set"),
        ),
      )
      .get(),
  )
  return row ? parseRequirementSetArtifact(row) : undefined
}

export function listArchitectContractGraphArtifacts(taskID: string): ContractGraphArtifactRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "architect_contract_graph")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  ).map(parseContractGraphArtifact)
}

export function findArchitectContractGraphArtifact(input: {
  taskID: string
  artifactID: string
}): ContractGraphArtifactRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "architect_contract_graph"),
        ),
      )
      .get(),
  )
  return row ? parseContractGraphArtifact(row) : undefined
}

export function listGoalGraphProjectionArtifacts(
  taskID: string,
): GoalGraphProjectionArtifactRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "goal_graph_projection"),
        ),
      )
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  ).map(parseGoalGraphProjectionArtifact)
}

export function findGoalGraphProjectionArtifact(input: {
  taskID: string
  artifactID: string
}): GoalGraphProjectionArtifactRow | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "goal_graph_projection"),
        ),
      )
      .get(),
  )
  return row ? parseGoalGraphProjectionArtifact(row) : undefined
}

export function listGoalWorkloadArtifacts(taskID: string): GoalWorkloadArtifactRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "goal_workload")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all()
      .map((row) => ({
        ...row,
        kind: "goal_workload" as const,
        payload: validateGoalWorkloadArtifactRelationalIntegrity({
          db,
          row,
          payload: GoalWorkloadArtifactSchema.parse(row.payload),
        }),
      })),
  )
}

export function findGoalWorkloadArtifact(input: {
  taskID: string
  artifactID: string
}): GoalWorkloadArtifactRow | undefined {
  return Database.use((db) => {
    const row = db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "goal_workload"),
        ),
      )
      .get()
    return row
      ? {
          ...row,
          kind: "goal_workload",
          payload: validateGoalWorkloadArtifactRelationalIntegrity({
            db,
            row,
            payload: GoalWorkloadArtifactSchema.parse(row.payload),
          }),
        }
      : undefined
  })
}

export function listResearchBriefArtifacts(taskID: string): ResearchBriefArtifactRow[] {
  return listResearchBriefArtifactsByKind(taskID, "research_brief")
}

export function listFrontendResearchBriefArtifacts(taskID: string): ResearchBriefArtifactRow[] {
  return listResearchBriefArtifactsByKind(taskID, "frontend_research_brief")
}

function listResearchBriefArtifactsByKind(
  taskID: string,
  kind: "research_brief" | "frontend_research_brief",
): ResearchBriefArtifactRow[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, kind)))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all(),
  )
  return rows.flatMap((row) => {
    const parsed = parseResearchBriefArtifactRow(row, taskID)
    return parsed ? [parsed] : []
  })
}

function parseResearchBriefArtifactRow(row: ArtifactRow, taskID: string): ResearchBriefArtifactRow | undefined {
  let rawBrief: unknown = row.payload
  if (row.kind === "frontend_research_brief") {
    try {
      rawBrief = parseFrontendResearchBriefArtifactEnvelope(row.payload).payload.brief
    } catch {
      return undefined
    }
  }
  const parsed = ResearchBriefSchema.safeParse(rawBrief)
  if (!parsed.success) return undefined
  if (validateResearchBriefIntegrity(parsed.data)) return undefined
  if (validateResearchBriefTaskBoundary(parsed.data, taskID)) return undefined
  return { ...row, payload: parsed.data }
}

// ---------------------------------------------------------------------------

export function findInteraction(interactionID: string) {
  return Database.use((db) =>
    db.select().from(EngineInteractionRequestTable).where(eq(EngineInteractionRequestTable.id, interactionID)).get(),
  )
}

export function findInteractionByExternal(externalID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineInteractionRequestTable)
      .where(eq(EngineInteractionRequestTable.external_id, externalID))
      .orderBy(desc(EngineInteractionRequestTable.time_created))
      .get(),
  )
}

export function findBuildHostObservationsForTask(taskID: string): BuildHostObservationRow[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "build_host_observation")))
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all(),
  )
  return rows.map(viewBuildHostObservationArtifact)
}

export function findGoal(goalID: string) {
  return Database.use((db) => db.select().from(EngineGoalTable).where(eq(EngineGoalTable.id, goalID)).get())
}

export type IntegrityReviewArtifactQuery = {
  taskID: string
  artifactIDs?: string[]
  /** Filter by recorded evidence chronology (`pre_build` | `post_build`).
   *  Omit to match any phase. This marker does not define scheduler order or
   *  task completion. */
  phase?: "pre_build" | "post_build"
}

export type IntegrityReviewArtifactTaskQuery = {
  taskID: string
  phase?: "pre_build" | "post_build"
}

export type IntegrityReviewArtifactRow = Omit<ArtifactRow, "payload"> & {
  artifactID: string
  taskID: string
  timeCreated: number
  payload: IntegrityReviewArtifactPayload
}

export function listIntegrityReviewArtifacts(input: IntegrityReviewArtifactQuery): IntegrityReviewArtifactRow[] {
  return selectIntegrityReviewArtifacts({
    taskID: input.taskID,
    artifactIDs: input.artifactIDs,
    phase: input.phase,
  })
}

/** List every persisted IntegrityReview fact for a Task without selecting a
 * Task-current Spec snapshot or collapsing conflicting reviews. */
export function listIntegrityReviewArtifactsForTask(
  input: IntegrityReviewArtifactTaskQuery,
): IntegrityReviewArtifactRow[] {
  return selectIntegrityReviewArtifacts({
    taskID: input.taskID,
    phase: input.phase,
  })
}

function selectIntegrityReviewArtifacts(input: {
  taskID: string
  artifactIDs?: string[]
  phase?: "pre_build" | "post_build"
}): IntegrityReviewArtifactRow[] {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.kind, "integrity_review"),
          input.artifactIDs
            ? input.artifactIDs.length === 0
              ? sql`0 = 1`
              : inArray(EngineArtifactTable.id, input.artifactIDs)
            : sql`1 = 1`,
          input.phase ? sql`json_extract(${EngineArtifactTable.payload}, '$.phase') = ${input.phase}` : sql`1 = 1`,
        ),
      )
      .orderBy(desc(EngineArtifactTable.time_created), desc(EngineArtifactTable.id))
      .all()
      .map(toIntegrityReviewArtifactRow),
  )
}

export function integrityReviewVerdict(row: ArtifactRow | undefined | null) {
  if (!row) return undefined
  return parseIntegrityReviewArtifactPayload(row.payload, `integrity review artifact ${row.id}`).verdict
}

function toIntegrityReviewArtifactRow(row: ArtifactRow): IntegrityReviewArtifactRow {
  const payload = parseIntegrityReviewArtifactPayload(row.payload, `integrity review artifact ${row.id}`)
  return {
    ...row,
    payload,
    artifactID: row.id,
    taskID: row.task_id,
    timeCreated: row.time_created,
  }
}

/**
 * Recent orchestrator-stream-error artifacts for a task, newest first.
 *
 * Each row marks a wake whose LLM stream aborted (provider onError, idle
 * watchdog, mid-stream protocol violation) before the orchestrator could
 * make any decision. `recordOrchestratorStreamError` (engine/persist.ts)
 * is the single writer; `describe.ts` is the single reader, surfacing
 * the rows into the orchestrator prompt after an explicit operator Retry/Replan
 * opens a fresh execution window. The Orchestrator can then dispatch, propose
 * follow-up work, or fail the Task from the exact persisted evidence.
 *
 * Filtered by `time_created >= sinceMs` so a long-running task's old
 * incidents don't follow it forever; the bench / orchestrator pass
 * `task.time_started ?? task.time_created` as the floor.
 */
export function listOrchestratorStreamErrorArtifacts(taskID: string, sinceMs: number, limit: number) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "orchestrator-stream-error"),
          sql`${EngineArtifactTable.time_created} >= ${sinceMs}`,
        ),
      )
      .orderBy(desc(EngineArtifactTable.time_created))
      .limit(limit)
      .all(),
  )
}

export function listTaskInfrastructureErrorArtifacts(taskID: string, sinceMs: number, limit: number) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task-infrastructure-error"),
          sql`${EngineArtifactTable.time_created} >= ${sinceMs}`,
        ),
      )
      .orderBy(desc(EngineArtifactTable.time_created))
      .limit(limit)
      .all(),
  )
}

export function listToolExecuteErrorArtifacts(taskID: string, sinceMs: number, limit: number) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "tool-execute-error"),
          sql`${EngineArtifactTable.time_created} >= ${sinceMs}`,
        ),
      )
      .orderBy(desc(EngineArtifactTable.time_created))
      .limit(limit)
      .all(),
  )
}

export function listGoals(taskID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineGoalTable)
      .where(eq(EngineGoalTable.task_id, taskID))
      .orderBy(EngineGoalTable.order_index)
      .all(),
  )
}

export interface CurrentGoalContext extends DeliverySliceRevisionIdentity {
  goal: GoalRow
  membershipIndex: number
  birthRequirementSetArtifactLocator?: EngineArtifactLocator
  birthContractGraphArtifactLocator?: EngineArtifactLocator
}

export interface CurrentGoalMembershipContext {
  taskID: string
  goalGraphProjectionArtifactLocator?: EngineArtifactLocator
  contractGraphArtifactLocator?: EngineArtifactLocator
  requirementSetArtifactLocator?: EngineArtifactLocator
  producer?: GoalGraphProducer
  fidelity: ArchitectFidelityState
  contractGraphArtifact?: ContractGraphArtifactRow
  effectiveContractGraph?: ArchitectContractGraph
  goalGraphFindings: GoalGraphProjectionArtifactPayload["findings"]
  goals: CurrentGoalContext[]
  historicalGoals: GoalRow[]
}

function resolveGoalMembershipContext(input: {
  taskID: string
  projectionArtifact?: GoalGraphProjectionArtifactRow
  resolveContractGraph?: boolean
}): CurrentGoalMembershipContext {
  const goals = listGoals(input.taskID)
  const projectionArtifact = input.projectionArtifact
  const projection = projectionArtifact?.payload.projection
  if (!projectionArtifact || projection === null || projection === undefined) {
    return {
      taskID: input.taskID,
      fidelity: emptyArchitectFidelityState(),
      goalGraphFindings: [],
      goals: [],
      historicalGoals: goals,
    }
  }
  const goalsByID = new Map(goals.map((goal) => [goal.id, goal]))
  const memberGoals = projection.goal_revision_ids.map((goalID) => {
    const goal = goalsByID.get(goalID)
    if (!goal) {
      throw new Error(
        `GoalGraph projection ${projectionArtifact.id} references missing Goal revision ${goalID}`,
      )
    }
    return goal
  })
  for (const [index, goal] of memberGoals.entries()) {
    const canonical = projectionArtifact.payload.projected_goals[index]
    if (!canonical || canonical.id !== goal.id) {
      throw new Error(
        `GoalGraph projection ${projectionArtifact.id} has no canonical Goal contract for revision ${goal.id}`,
      )
    }
    const materialized = {
      id: goal.id,
      title: goal.title,
      objective: goal.objective,
      acceptance_specs: goal.acceptance_specs,
      owned_paths: goal.owned_paths,
      priority: goal.priority,
      kind: goal.kind,
      source: goal.source,
    }
    if (!isDeepStrictEqual(canonical, materialized)) {
      throw new Error(
        `Materialized Goal revision ${goal.id} differs from canonical GoalGraph Artifact ${projectionArtifact.id}`,
      )
    }
  }
  const currentByLineageRoot = new Map<string, GoalRow>()
  for (const goal of memberGoals) {
    const identity = resolveDeliverySliceRevisionIdentity(goal, goals)
    const duplicate = currentByLineageRoot.get(identity.deliverySliceID)
    if (duplicate) {
      throw new Error(
        `GoalGraph projection ${projectionArtifact.id} projects multiple current revisions for Delivery Slice ${identity.deliverySliceID}: ${duplicate.id}, ${goal.id}`,
      )
    }
    currentByLineageRoot.set(identity.deliverySliceID, goal)
  }
  const currentGoalIDs = new Set(memberGoals.map((goal) => goal.id))
  const contexts = memberGoals.map((goal, membershipIndex) => {
    return {
      ...resolveDeliverySliceRevisionIdentity(goal, goals),
      goal,
      membershipIndex,
      birthRequirementSetArtifactLocator:
        goalBirthRequirementSetArtifactLocator(goal),
      birthContractGraphArtifactLocator:
        goalBirthContractGraphArtifactLocator(goal),
    }
  })
  const graphLocator = projectionArtifact.payload.contract_graph_artifact_locator
  const graphArtifact = graphLocator && input.resolveContractGraph !== false
    ? parseContractGraphArtifact(
        requireEngineArtifactByLocator({
          taskID: input.taskID,
          locator: graphLocator,
        }),
      )
    : undefined
  const fidelity = graphArtifact
    ? graphArtifact.payload.fidelity
    : emptyArchitectFidelityState()
  return {
    taskID: input.taskID,
    goalGraphProjectionArtifactLocator: {
      source: "engine_artifact",
      artifact_id: projectionArtifact.id,
      catalog_revision: projectionArtifact.catalog_revision,
      expected_sha256: projectionArtifact.payload_sha256,
    },
    contractGraphArtifactLocator: graphLocator ?? undefined,
    requirementSetArtifactLocator:
      graphArtifact?.payload.requirement_set_artifact_locator ?? undefined,
    producer: projectionArtifact.payload.producer,
    fidelity,
    contractGraphArtifact: graphArtifact,
    effectiveContractGraph: graphArtifact?.payload.graph,
    goalGraphFindings: projectionArtifact.payload.findings,
    goals: contexts,
    historicalGoals: goals.filter((goal) => !currentGoalIDs.has(goal.id)),
  }
}

/**
 * Resolve the only current executable Goal view. A projected GoalGraph,
 * including an explicit empty membership, is authoritative. Raw
 * `projection:null` facts remain history and never create a second current
 * source.
 */
export function resolveCurrentGoalMembershipContext(
  taskID: string,
): CurrentGoalMembershipContext {
  return resolveGoalMembershipContext({
    taskID,
    projectionArtifact: resolveCurrentGoalGraphProjectionArtifact(taskID),
  })
}

export function resolveCurrentGoalGraphProjectionArtifact(
  taskID: string,
): GoalGraphProjectionArtifactRow | undefined {
  return resolveGoalGraphProjectionTip(
    taskID,
    listGoalGraphProjectionArtifacts(taskID),
  )
}

export function resolveCurrentGoalGraphProjectionArtifactLocator(
  taskID: string,
): EngineArtifactLocator | undefined {
  const artifact = resolveCurrentGoalGraphProjectionArtifact(taskID)
  return artifact
    ? {
        source: "engine_artifact",
        artifact_id: artifact.id,
        catalog_revision: artifact.catalog_revision,
        expected_sha256: artifact.payload_sha256,
      }
    : undefined
}

export function resolveTaskGoalProjection(taskID: string) {
  const context = resolveCurrentGoalMembershipContext(taskID)
  return {
    currentContractGraphArtifactID: context.contractGraphArtifactLocator?.artifact_id,
    currentGoalGraphProjectionArtifactLocator:
      context.goalGraphProjectionArtifactLocator,
    currentContractGraphArtifactLocator: context.contractGraphArtifactLocator,
    currentGoals: context.goals.map(({ goal, membershipIndex }) => ({
      ...goal,
      order_index: membershipIndex,
    })),
    historicalGoals: context.historicalGoals,
  }
}

export function listCurrentGoals(taskID: string) {
  return resolveTaskGoalProjection(taskID).currentGoals
}

export function resolveGoalMembershipContextForProjectionArtifact(input: {
  taskID: string
  projectionArtifactLocator: EngineArtifactLocator
}): CurrentGoalMembershipContext {
  const artifact = parseGoalGraphProjectionArtifact(
    requireEngineArtifactByLocator({
      taskID: input.taskID,
      locator: input.projectionArtifactLocator,
    }),
  )
  return resolveGoalMembershipContext({
    taskID: input.taskID,
    projectionArtifact: artifact,
  })
}

/**
 * Resolve only immutable GoalGraph membership and current Goal identities.
 * Linked ContractGraph/fidelity bodies remain consumer-owned and are not read
 * through this boundary.
 */
export function resolveGoalMembershipForProjectionArtifact(input: {
  taskID: string
  projectionArtifactLocator: EngineArtifactLocator
}): CurrentGoalMembershipContext {
  const artifact = parseGoalGraphProjectionArtifact(
    requireEngineArtifactByLocator({
      taskID: input.taskID,
      locator: input.projectionArtifactLocator,
    }),
  )
  return resolveGoalMembershipContext({
    taskID: input.taskID,
    projectionArtifact: artifact,
    resolveContractGraph: false,
  })
}

export function requireCurrentGoalContext(input: {
  taskID: string
  goalID: string
}): {
  membership: CurrentGoalMembershipContext
  goal: CurrentGoalContext
} {
  const membership = resolveCurrentGoalMembershipContext(input.taskID)
  const goal = membership.goals.find((candidate) => candidate.goal.id === input.goalID)
  if (!goal) {
    throw new Error(
      `Goal ${input.goalID} is not a member of the current GoalGraph for Task ${input.taskID}`,
    )
  }
  return { membership, goal }
}

/**
 * Validates immutable Delivery Slice revision subjects against the Task's
 * single current GoalGraph projection and returns their stable input order.
 */
export function assertCurrentDeliverySliceRevisionIDs(input: {
  taskID: string
  deliverySliceRevisionIDs: readonly string[]
  subject: string
}): string[] {
  const membership = resolveCurrentGoalMembershipContext(input.taskID)
  const currentRevisionIDs = new Set(
    membership.goals.map((candidate) => candidate.deliverySliceRevisionID),
  )
  const missing = input.deliverySliceRevisionIDs.filter(
    (revisionID) => !currentRevisionIDs.has(revisionID),
  )
  if (missing.length > 0) {
    throw new Error(
      `${input.subject} Delivery Slice revisions are not current members of Task ${input.taskID}: ${[
        ...new Set(missing),
      ].join(", ")}`,
    )
  }
  return [...input.deliverySliceRevisionIDs]
}

/** Exact Sessions with a prompt controller owned by this process. */
export function listOwnedPromptSessionsForTask(taskID: string) {
  return SessionPromptState.ownedPromptSessionIDs().flatMap((sessionID) => {
    if (taskIDForSession(sessionID) !== taskID) return []
    const row = Database.use((db) =>
      db
        .select({
          sessionID: SessionTable.id,
          kind: SessionTable.kind,
        })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get(),
    )
    if (!row) return []
    return [
      {
        ...row,
        lastActivityMs: SessionPromptState.activity(sessionID)?.timeUpdated ?? 0,
      },
    ]
  })
}

function taskRows(rows: TaskRow[]) {
  const sessionIDs = [...new Set(rows.map((row) => row.session_id).filter((item): item is string => !!item))]
  const projectIDs = [...new Set(rows.map((row) => row.project_id))]
  const sessions = new Map<string, string>()
  const projects = new Map<string, TaskProjectRow>()

  if (sessionIDs.length > 0) {
    const items = Database.use((db) =>
      db
        .select({ id: SessionTable.id, directory: SessionTable.directory })
        .from(SessionTable)
        .where(inArray(SessionTable.id, sessionIDs))
        .all(),
    )
    for (const item of items) {
      sessions.set(item.id, item.directory)
    }
  }

  if (projectIDs.length > 0) {
    const items = Database.use((db) =>
      db
        .select({ id: ProjectTable.id, name: ProjectTable.name, worktree: ProjectTable.worktree })
        .from(ProjectTable)
        .where(inArray(ProjectTable.id, projectIDs))
        .all(),
    )
    for (const item of items) {
      projects.set(item.id, {
        id: item.id,
        name: item.name ?? undefined,
        worktree: item.worktree,
      })
    }
  }

  return rows.map((task) => {
    const project = projects.get(task.project_id) ?? null
    return {
      task,
      directory: sessions.get(task.session_id ?? "") ?? project?.worktree ?? "",
      project,
    }
  })
}

export function listTaskRows(rows: TaskRow[]) {
  return taskRows(rows)
}

export function listProjectTasks(projectID: string, limit = 50) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskTable)
      .where(and(eq(EngineTaskTable.project_id, projectID), isNull(EngineTaskTable.time_archived)))
      .orderBy(desc(EngineTaskTable.time_updated))
      .limit(limit)
      .all(),
  )
}

export function listStartedIncompleteTaskIDs(input?: { projectID?: string }): string[] {
  const conditions: SQL[] = [
    isNull(EngineTaskTable.time_archived),
    isNotNull(EngineTaskTable.time_started),
    isNull(EngineTaskTable.time_completed),
  ]
  if (input?.projectID) conditions.unshift(eq(EngineTaskTable.project_id, input.projectID))
  return Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(and(...conditions))
      .all()
      .map((row) => row.id),
  )
}

/** 按关键词和/或状态搜索 project 内的 task */
export function searchProjectTasks(projectID: string, opts: { query?: string; status?: string; limit?: number }) {
  const conditions = [eq(EngineTaskTable.project_id, projectID), isNull(EngineTaskTable.time_archived)]
  if (opts.status) {
    conditions.push(taskStatusCondition(opts.status))
  }
  if (opts.query) {
    conditions.push(like(EngineTaskTable.title, `%${opts.query}%`))
  }
  return Database.use((db) =>
    db
      .select()
      .from(EngineTaskTable)
      .where(and(...conditions))
      .orderBy(desc(EngineTaskTable.time_updated))
      .limit(opts.limit ?? 50)
      .all(),
  )
}

/**
 * Translate a logical task-status filter (queued / active / completed /
 * failed / cancelled) into a fact-field SQL condition now that the status
 * column is gone. Unknown statuses resolve to `1=0` so a caller's typo
 * returns zero rows rather than all rows.
 */
function taskStatusCondition(status: string): SQL {
  const cancelledMark = sql`json_extract(${EngineTaskTable.metadata}, '$.cancelled') = 1`
  switch (status) {
    case "queued":
      return and(isNull(EngineTaskTable.time_started), isNull(EngineTaskTable.time_completed))!
    case "active":
      return and(isNotNull(EngineTaskTable.time_started), isNull(EngineTaskTable.time_completed))!
    case "completed":
      return and(
        isNotNull(EngineTaskTable.time_completed),
        isNull(EngineTaskTable.error),
        sql`(${cancelledMark}) IS NOT TRUE`,
      )!
    case "failed":
      return and(
        isNotNull(EngineTaskTable.time_completed),
        isNotNull(EngineTaskTable.error),
        sql`(${cancelledMark}) IS NOT TRUE`,
      )!
    case "cancelled":
      return cancelledMark
    default:
      return sql`1 = 0`
  }
}

export function listGlobalTasks(input?: {
  directory?: string
  cursor?: number
  cursorTaskID?: string
  query?: string
  status?: string
  limit?: number
}) {
  const conditions: SQL[] = [isNull(EngineTaskTable.time_archived)]

  if (input?.directory) {
    conditions.push(eq(SessionTable.directory, input.directory))
  }
  if (input?.cursor && input.cursorTaskID) {
    conditions.push(sql`(
      ${EngineTaskTable.time_updated} < ${input.cursor}
      OR (${EngineTaskTable.time_updated} = ${input.cursor} AND ${EngineTaskTable.id} < ${input.cursorTaskID})
    )`)
  } else if (input?.cursor) {
    conditions.push(lt(EngineTaskTable.time_updated, input.cursor))
  }
  if (input?.status) {
    conditions.push(taskStatusCondition(input.status))
  }
  if (input?.query) {
    conditions.push(like(EngineTaskTable.title, `%${input.query}%`))
  }

  const rows = Database.use((db) => {
    const query = db
      .select({ task: EngineTaskTable })
      .from(EngineTaskTable)
      .leftJoin(SessionTable, eq(EngineTaskTable.session_id, SessionTable.id))
    return (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(EngineTaskTable.time_updated), desc(EngineTaskTable.id))
      .limit(input?.limit ?? 100)
      .all()
      .map((item) => item.task)
  })

  return taskRows(rows)
}

export function listInteractions(taskID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineInteractionRequestTable)
      .where(eq(EngineInteractionRequestTable.task_id, taskID))
      .orderBy(desc(EngineInteractionRequestTable.time_created))
      .all(),
  )
}

export function pendingInteractionCounts(taskIDs?: string[]): ReadonlyMap<string, number> {
  if (taskIDs?.length === 0) return new Map()
  const conditions = [eq(EngineInteractionRequestTable.status, "pending")]
  if (taskIDs) conditions.push(inArray(EngineInteractionRequestTable.task_id, taskIDs))
  const rows = Database.use((db) =>
    db
      .select({ taskID: EngineInteractionRequestTable.task_id, count: sql<number>`count(*)` })
      .from(EngineInteractionRequestTable)
      .where(and(...conditions))
      .groupBy(EngineInteractionRequestTable.task_id)
      .all(),
  )
  return new Map(rows.map((row) => [row.taskID, row.count]))
}

export function listSnapshots(taskID: string) {
  return Database.use((db) =>
    db
      .select()
      .from(EngineProgressSnapshotTable)
      .where(eq(EngineProgressSnapshotTable.task_id, taskID))
      .orderBy(desc(EngineProgressSnapshotTable.time_created))
      .limit(20)
      .all(),
  )
}

export function viewTask(row: TaskRow, input?: { directory?: string }) {
  const status = deriveTaskStatus(row)
  const completionDecision =
    status === "completed" && row.time_completed != null
      ? findTaskCompletionDecisionForTerminalTime({
          taskID: row.id,
          timeCompleted: row.time_completed,
        })
      : undefined
  return {
    id: row.id,
    orderKey: timelineOrderKey({
      domain: "task",
      time: row.time_created,
      id: row.id,
    }),
    projectID: row.project_id,
    directory: input?.directory,
    sessionID: row.session_id ?? undefined,
    requestID: row.request_id ?? undefined,
    source: row.source,
    productPillar: row.product_pillar,
    title: row.title,
    request: row.request,
    status,
    terminalReason: taskTerminalReason(row),
    cancellation:
      status === "cancelled" ? taskCancellationProjection(row.id) : pendingTaskCancellationProjection(row.id),
    priority: row.priority,
    packageRevisionBinding: requireTaskPackageRevisionBinding(row.id),
    queue: {
      order: row.queue_order,
      revision: undefined as string | undefined,
    },
    error: row.error ?? undefined,
    completionDecision: completionDecision
      ? {
          artifactLocator: completionDecision.locator,
          orchestratorSessionID: completionDecision.payload.orchestrator_session_id,
          orchestratorMessageID: completionDecision.payload.orchestrator_message_id,
          toolCallID: completionDecision.payload.tool_call_id,
          toolPartID: completionDecision.payload.tool_part_id,
          evidenceLocators: completionDecision.payload.evidence_locators,
          deliverableArtifactLocators: completionDecision.payload.deliverable_artifact_locators,
          acceptedDeliverySliceRevisionIDs: completionDecision.payload.accepted_delivery_slice_revision_ids,
          workflowBinding: completionDecision.payload.workflow_binding,
          timeRecorded: completionDecision.payload.time_recorded,
        }
      : undefined,
    budget: budgetModel(row.budget),
    metadata: row.metadata ?? undefined,
    attachments: row.attachments ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      started: row.time_started ?? undefined,
      completed: row.time_completed ?? undefined,
      archived: row.time_archived ?? undefined,
    },
  }
}

export function viewTaskListTask(row: TaskRow, input?: { directory?: string; queueRevision?: string }) {
  return {
    id: row.id,
    orderKey: timelineOrderKey({
      domain: "task",
      time: row.time_created,
      id: row.id,
    }),
    projectID: row.project_id,
    directory: input?.directory,
    sessionID: row.session_id ?? undefined,
    requestID: row.request_id ?? undefined,
    source: row.source,
    productPillar: row.product_pillar,
    title: row.title,
    status: deriveTaskStatus(row),
    terminalReason: taskTerminalReason(row),
    priority: row.priority,
    packageRevisionBinding: requireTaskPackageRevisionBinding(row.id),
    queue: {
      order: row.queue_order,
      revision: input?.queueRevision,
    },
    time: {
      created: row.time_created,
      updated: row.time_updated,
      started: row.time_started ?? undefined,
      completed: row.time_completed ?? undefined,
      archived: row.time_archived ?? undefined,
    },
  }
}

// Pure Delivery Slice revision row → DTO mapping. Independent activity,
// evidence, review associations, and acceptance are projected from their exact
// Task/Session/Artifact facts rather than stored on the revision.
export function viewGoal(row: GoalRow) {
  return {
    id: row.id,
    taskID: row.task_id,
    requirementSetArtifactLocator: goalBirthRequirementSetArtifactLocator(row),
    contractGraphArtifactLocator: goalBirthContractGraphArtifactLocator(row),
    supersedeOf: row.supersede_of,
    title: row.title,
    objective: row.objective,
    acceptance_specs: parseAcceptanceSpecs(row.acceptance_specs, `engine_goal ${row.id}.acceptance_specs`),
    owned_paths: row.owned_paths,
    kind: row.kind,
    priority: row.priority,
    source: row.source,
    orderIndex: row.order_index,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

export function viewInteraction(row: InteractionRow) {
  return {
    id: row.id,
    taskID: row.task_id,
    orderKey: timelineOrderKey({
      domain: "interaction",
      time: row.time_created,
      id: row.id,
    }),
    ...(row.time_resolved
      ? {
          responseOrderKey: timelineInteractionResponseOrderKey({
            id: row.id,
            timeResolved: row.time_resolved,
          }),
        }
      : {}),
    sessionID: row.session_id ?? undefined,
    externalID: row.external_id,
    type: row.request_type,
    status: row.status,
    title: row.title,
    body: row.body,
    payload: row.payload ?? undefined,
    response: row.response ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
      resolved: row.time_resolved ?? undefined,
    },
  }
}

export function viewArtifact(row: ArtifactRow) {
  return {
    id: row.id,
    taskID: row.task_id,
    locator: {
      source: "engine_artifact" as const,
      artifact_id: row.id,
      catalog_revision: row.catalog_revision,
      expected_sha256: row.payload_sha256,
    },
    kind: row.kind,
    label: row.label,
    payload: row.payload ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

export function viewSnapshot(row: ProgressRow) {
  return {
    id: row.id,
    taskID: row.task_id,
    status: row.status,
    summary: row.summary,
    payload: row.payload ?? undefined,
    time: {
      created: row.time_created,
      updated: row.time_updated,
    },
  }
}

function budgetModel(input?: EngineBudget | null) {
  if (!input) return undefined
  return {
    maxExecutorGroups: input.max_executor_groups,
  }
}

export function viewBuildHostObservationArtifact(
  row: typeof EngineArtifactTable.$inferSelect,
): BuildHostObservationRow {
  const payload = (row.payload ?? {}) as {
    task_id?: string
    session_id?: string | null
    final_message_id?: string | null
    execution_mode?: unknown
    contribution_commit_ref?: unknown
    published_commit_ref?: unknown
    primary_base_commit_ref?: unknown
    primary_terminal_commit_ref?: unknown
    diff_base_ref?: unknown
    diff_head_ref?: unknown
    diffs?: unknown
    observed_artifact_locators?: unknown
    source_artifact_locators?: unknown
  }
  const diffs = SnapshotBuildFileObservation.array().parse(payload.diffs ?? [])
  const changedFiles = diffs.map((diff) => diff.file)
  return {
    id: row.id,
    locator: {
      source: "engine_artifact",
      artifact_id: row.id,
      catalog_revision: row.catalog_revision,
      expected_sha256: row.payload_sha256,
    },
    task_id: payload.task_id ?? row.task_id,
    session_id: payload.session_id ?? null,
    final_message_id: payload.final_message_id ?? null,
    execution_mode:
      payload.execution_mode === "managed_worktree" ? "managed_worktree" : "current_project",
    commit_ref:
      typeof payload.contribution_commit_ref === "string" && payload.contribution_commit_ref.trim()
        ? payload.contribution_commit_ref
        : null,
    published_commit_ref: typeof payload.published_commit_ref === "string" ? payload.published_commit_ref : null,
    primary_base_commit_ref:
      typeof payload.primary_base_commit_ref === "string" ? payload.primary_base_commit_ref : null,
    primary_terminal_commit_ref:
      typeof payload.primary_terminal_commit_ref === "string" ? payload.primary_terminal_commit_ref : null,
    diff_base_ref: typeof payload.diff_base_ref === "string" ? payload.diff_base_ref : null,
    diff_head_ref: typeof payload.diff_head_ref === "string" ? payload.diff_head_ref : null,
    diffs,
    changed_files: changedFiles,
    observed_artifact_locators: ArtifactReadLocatorSchema.array().parse(
      payload.observed_artifact_locators ?? [],
    ),
    source_artifact_locators: ArtifactReadLocatorSchema.array().parse(
      payload.source_artifact_locators ?? [],
    ),
    time_created: row.time_created,
    time_updated: row.time_updated,
  }
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function changedFilePathsFromObservation(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (typeof item === "string" && item.trim()) return [item.trim()]
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const path = (item as Record<string, unknown>).path
      if (typeof path === "string" && path.trim()) return [path.trim()]
    }
    return []
  })
}
