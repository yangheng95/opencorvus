import { deriveTaskStatus, isTaskActive, taskTerminalReason } from "@/engine/task-status"
import { Log } from "@/util/log"

const log = Log.create({ service: "workbench.board" })
import {
  listCurrentGoals,
  listTaskRows,
  resolveCurrentGoalMembershipContext,
  viewTask,
  viewInteraction,
  viewBuildHostObservationArtifact,
  findTask,
  type ArtifactRow,
  type TaskRow,
  listInteractions,
} from "@/engine/store"
import {
  EngineArtifactTable,
  EngineChannelBindingTable,
  EngineGoalTable,
  EngineInteractionRequestTable,
  EngineInteractionOutcomeTable,
  EngineProgressSnapshotTable,
  EngineTaskTable,
} from "@/engine"
import { ProtocolEventTable, protocolEventBelongsToTask } from "@/protocol/protocol.sql"
import { Database, and, desc, eq, sql } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"
import { compileBrief } from "./brief"
import { Project } from "@/project/project"
import { sessionInvocationTopologyForTask, taskExecutionProjectionForTask } from "@/orchestrator/task-event"
import { parseAcceptanceSpecs } from "@/acceptance/types"
import { requirementIDsFromAcceptanceSpecs } from "@/requirements/traceability"
import { ArchitectContractGraphSchema } from "@/architect/contract-graph"
import type { RequirementSet } from "@/requirements/types"
import { deriveDeliverySliceFacts } from "./delivery-slice-facts"
import { parseDispatchLineagePayload } from "@/engine/dispatch-lineage-facts"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import { IntegrityReviewArtifactPayloadSchema } from "@/integrity/review-artifact"
import { VisualReviewArtifactPayloadSchema } from "@/visual-qa/persist"
import { FactCheckReviewArtifactSchema } from "@/fact-check/schema"
import { parseProcessRecoveryFactContext } from "@/engine/process-recovery-fact"
import { MessageTable } from "@/session/session.sql"

const BOARD_SNAPSHOT_LIMIT = 80
const BOARD_SUMMARY_LIMIT = 4000
const BOARD_ARTIFACT_STRING_LIMIT = 1200
const BOARD_ARTIFACT_ARRAY_LIMIT = 8
const BOARD_ARTIFACT_OBJECT_DEPTH_LIMIT = 3

function artifactPayloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {}
}

export function compileBoard(input: { taskID: string }) {
  const task = findTask(input.taskID)
  if (!task) throw new Error(`Task not found: ${input.taskID}`)
  const tag = boardTagForTask(task)
  const lastSequence = latestTaskProtocolSequence(task.id)
  return buildBoard(task, tag, taskDirectory(task), lastSequence)
}

export function boardTag(input: { taskID: string }) {
  const task = findTask(input.taskID)
  if (!task) throw new Error(`Task not found: ${input.taskID}`)
  return boardTagForTask(task)
}

function buildBoard(
  task: TaskRow,
  snapshotVersion: string,
  directory: string,
  lastSequence = latestTaskProtocolSequence(task.id),
) {
  const goals = listCurrentGoals(task.id)
  const interactions = listInteractions(task.id).toReversed()
  const brief = compileBrief({
    taskID: task.id,
    sessionID: task.session_id ?? undefined,
  })
  const bindings = Database.use((db) =>
    db
      .select()
      .from(EngineChannelBindingTable)
      .where(eq(EngineChannelBindingTable.task_id, task.id))
      .orderBy(EngineChannelBindingTable.time_created)
      .all(),
  )
  const artifacts = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.task_id, task.id))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  const pendingInteractions = interactions.filter((item) => item.status === "pending")
  const executionProjection = taskExecutionProjectionForTask(task.id)
  const currentFailure = boardFailure({
    task,
    interactions: pendingInteractions,
  })
  const overview = boardOverview({
    task,
    pendingInteractions,
    currentFailure,
    executionProjection,
  })

  // lastSequence: must use the same sequence space as protocol_event.seq
  // (auto-incrementing integer), NOT timestamps. The panel's monotonic guard
  // compares this against SSE event.sequence — mismatched number spaces
  // would cause ALL SSE events to be silently discarded.
  const goalFields = buildGoalFields(task, goals, artifacts, executionProjection)
  const project = Project.get(task.project_id)
  return {
    snapshotVersion,
    lastSequence,
    ...goalFields,
    project: project
      ? {
          id: project.id,
          name: project.name,
          worktree: project.worktree,
        }
      : undefined,
    task: viewTask(task, { directory }),
    interactions: interactions.map(viewInteraction),
    channels: bindings.map((item) => ({
      id: item.id,
      platform: item.platform,
      channel: item.channel,
      thread: item.thread,
      payload: item.payload ?? undefined,
      time: {
        created: item.time_created,
        updated: item.time_updated,
      },
    })),
    sessionInvocationTopology: sessionInvocationTopologyForTask(task.id),
    executionProjection,
    processIncidents: taskProcessIncidents(task.id, executionProjection),
    artifacts: artifacts.map((item) => {
      const payload =
        item.kind === "build_host_observation"
          ? compactBuildObservationPayload(item)
          : compactArtifactPayload(item.kind, item.payload)
      return {
        id: item.id,
        taskID: item.task_id,
        locator: {
          source: "engine_artifact" as const,
          artifact_id: item.id,
          catalog_revision: item.catalog_revision,
          expected_sha256: item.payload_sha256,
        },
        kind: item.kind,
        label: item.label,
        payload,
        time: {
          created: item.time_created,
          updated: item.time_updated,
        },
      }
    }),
    overview,
    brief: {
      content: brief.content,
      updated_at: brief.updatedAt ?? Date.now(),
    },
  }
}

function taskDirectory(task: TaskRow) {
  return listTaskRows([task])[0]?.directory ?? ""
}

function latestTaskProtocolSequence(taskID: string) {
  return Database.use(
    (db) =>
      db
        .select({ seq: sql<number>`coalesce(max(seq), 0)` })
        .from(ProtocolEventTable)
        .where(protocolEventBelongsToTask(taskID))
        .get()?.seq ?? 0,
  )
}

function taskProcessIncidents(taskID: string, executionProjection: ReturnType<typeof taskExecutionProjectionForTask>) {
  const streamRows = Database.use((db) =>
    db
      .select({
        eventID: ProtocolEventTable.id,
        sessionID: ProtocolEventTable.session_id,
        emittedAt: ProtocolEventTable.emitted_at,
        payload: ProtocolEventTable.payload,
      })
      .from(ProtocolEventTable)
      .where(and(protocolEventBelongsToTask(taskID), eq(ProtocolEventTable.type, "session.error")))
      .orderBy(ProtocolEventTable.emitted_at, ProtocolEventTable.seq)
      .all(),
  )
  const streamIncidents = streamRows.map((row) => {
    if (!row.sessionID) throw new Error(`Task ${taskID} process incident ${row.eventID} has no Session identity`)
    const payload = artifactPayloadRecord(row.payload)
    const error = artifactPayloadRecord(payload.error)
    const errorData = artifactPayloadRecord(error.data)
    const occurrence = artifactPayloadRecord(payload.failureOccurrence)
    const errorName = typeof error.name === "string" ? error.name.trim() : ""
    if (!errorName) throw new Error(`Task ${taskID} process incident ${row.eventID} has no canonical error name`)
    const message = [payload.summary, error.message, errorData.message].find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    )
    const assistantMessageID =
      typeof occurrence.assistant_message_id === "string" && occurrence.assistant_message_id.trim()
        ? occurrence.assistant_message_id
        : undefined
    return {
      id: row.eventID,
      source: "session_stream" as const,
      sessionID: row.sessionID,
      errorName,
      ...(message ? { message } : {}),
      ...(assistantMessageID ? { assistantMessageID } : {}),
      emittedAt: row.emittedAt,
    }
  })
  const infrastructureRows = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        label: EngineArtifactTable.label,
        payload: EngineArtifactTable.payload,
        timeCreated: EngineArtifactTable.time_created,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task-infrastructure-error")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  const recoveryInputMessageIDs = new Set<string>()
  const infrastructureIncidents = infrastructureRows.map((row) => {
    const payload = artifactPayloadRecord(row.payload)
    const operation = typeof payload.operation === "string" ? payload.operation : "infrastructure"
    const errorName = typeof payload.errorName === "string" ? payload.errorName : "InfrastructureError"
    const base = {
      id: row.id,
      source: "infrastructure" as const,
      ...(typeof payload.sessionID === "string" ? { sessionID: payload.sessionID } : {}),
      errorName,
      message: typeof payload.reason === "string" ? `${operation}: ${payload.reason}` : operation,
      emittedAt: row.timeCreated,
    }
    // The board is a read-only rendering of history. One artifact this build
    // cannot interpret — an older writer's shape, a future writer's shape —
    // must degrade to a plain incident row, never take the whole Task view
    // down: an uninterpretable detail is information, an HTTP 500 is a
    // locked-out Task.
    try {
      const isRecovery =
        operation === "handoff-process-owned-task-execution" || operation === "recover-interrupted-task-execution"
      const parsed = isRecovery ? parseProcessRecoveryFactContext(payload.context, row.id) : undefined
      const recovery = parsed?.kind === "v1" ? parsed.context : undefined
      const affectedExecutions = recovery?.affected_subjects.map((subject) => {
        if (subject.kind !== "affected_created_session") recoveryInputMessageIDs.add(subject.input_message_id)
        return {
          sessionID: subject.session_id,
          ...(subject.kind !== "affected_created_session" ? { inputMessageID: subject.input_message_id } : {}),
        }
      })
      return {
        ...base,
        ...(recovery?.physical_evidence.kind === "managed_process_occurrence"
          ? { processOccurrenceID: recovery.physical_evidence.process_occurrence_id }
          : {}),
        ...(affectedExecutions ? { affectedExecutions } : {}),
      }
    } catch (error) {
      log.warn("Task incident artifact could not be interpreted; rendering it degraded", {
        taskID,
        artifactID: row.id,
        error,
      })
      return {
        ...base,
        errorName: "UnparseableIncidentArtifact",
        message: `${base.message} (context not interpretable by this build)`,
      }
    }
  })
  const lifecycleIncidents = executionProjection.occurrences.flatMap((occurrence) => {
    if (recoveryInputMessageIDs.has(occurrence.inputMessageID)) return []
    const latest = occurrence.latest
    if (
      !latest ||
      latest.status.type !== "terminal" ||
      (latest.status.reason !== "error" && latest.status.reason !== "aborted")
    ) {
      return []
    }
    return [
      {
        id: latest.eventID,
        source: "execution_lifecycle" as const,
        sessionID: occurrence.sessionID,
        inputMessageID: occurrence.inputMessageID,
        errorName: latest.status.reason === "aborted" ? "ExecutionAborted" : "ExecutionError",
        ...(latest.status.error ? { message: latest.status.error } : {}),
        emittedAt: latest.emittedAt,
      },
    ]
  })
  const inputAuthorityForAssistant = (assistantMessageID: string, sessionID: string): string | undefined => {
    let messageID: string | undefined = assistantMessageID
    const visited = new Set<string>()
    while (messageID && !visited.has(messageID)) {
      visited.add(messageID)
      const message = Database.use((db) =>
        db
          .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
          .from(MessageTable)
          .where(eq(MessageTable.id, messageID!))
          .get(),
      )
      if (!message || message.sessionID !== sessionID) return undefined
      if (message.data.role === "user") return messageID
      messageID =
        message.data.role === "assistant" && "parentID" in message.data && typeof message.data.parentID === "string"
          ? message.data.parentID
          : undefined
    }
    return undefined
  }
  const independentStreamIncidents = streamIncidents.filter((incident) => {
    if (!incident.assistantMessageID) return true
    const inputMessageID = inputAuthorityForAssistant(incident.assistantMessageID, incident.sessionID)
    return !inputMessageID || !recoveryInputMessageIDs.has(inputMessageID)
  })
  return [...independentStreamIncidents, ...infrastructureIncidents, ...lifecycleIncidents].sort(
    (left, right) => left.emittedAt - right.emittedAt || left.id.localeCompare(right.id),
  )
}

function taskSessionTreeVersion(taskID: string) {
  return (
    Database.use((db) =>
      db.get<{
        count: number
        updated: number
        statusSeq: number
        statusUpdated: number
        incidentSeq: number
        incidentUpdated: number
      }>(sql`
        WITH RECURSIVE session_tree(id) AS (
          SELECT session_id FROM engine_task WHERE id = ${taskID} AND session_id IS NOT NULL
          UNION ALL
          SELECT s.id FROM session s JOIN session_tree st ON s.parent_id = st.id
        )
        SELECT
          count(distinct s.id) AS count,
          coalesce(max(s.time_updated), 0) AS updated,
          coalesce(max(pe.seq), 0) AS statusSeq,
          coalesce(max(pe.emitted_at), 0) AS statusUpdated,
          coalesce(max(incident.seq), 0) AS incidentSeq,
          coalesce(max(incident.emitted_at), 0) AS incidentUpdated
        FROM session_tree st
        JOIN session s ON s.id = st.id
        LEFT JOIN protocol_event pe ON pe.session_id = s.id AND pe.type = 'agent.execution.lifecycle'
        LEFT JOIN protocol_event incident ON incident.session_id = s.id AND incident.type = 'session.error'
      `),
    ) ?? { count: 0, updated: 0, statusSeq: 0, statusUpdated: 0, incidentSeq: 0, incidentUpdated: 0 }
  )
}

function boardTagForTask(task: TaskRow) {
  const sessionTree = taskSessionTreeVersion(task.id)
  const goals = Database.use((db) =>
    db
      .select({
        count: sql<number>`count(*)`,
        updated: sql<number>`coalesce(max(${EngineGoalTable.time_updated}), 0)`,
      })
      .from(EngineGoalTable)
      .where(eq(EngineGoalTable.task_id, task.id))
      .get(),
  )
  const taskInteractions = listInteractions(task.id)
  const interactions = {
    count: taskInteractions.length,
    updated: Math.max(0, ...taskInteractions.map((interaction) => interaction.time_updated)),
  }
  const artifacts = Database.use((db) =>
    db
      .select({
        count: sql<number>`count(*)`,
        updated: sql<number>`coalesce(max(${EngineArtifactTable.time_updated}), 0)`,
      })
      .from(EngineArtifactTable)
      .where(eq(EngineArtifactTable.task_id, task.id))
      .get(),
  )
  const bindings = Database.use((db) =>
    db
      .select({
        count: sql<number>`count(*)`,
        updated: sql<number>`coalesce(max(${EngineChannelBindingTable.time_updated}), 0)`,
      })
      .from(EngineChannelBindingTable)
      .where(eq(EngineChannelBindingTable.task_id, task.id))
      .get(),
  )
  const snapshots = Database.use((db) =>
    db
      .select({
        count: sql<number>`count(*)`,
        updated: sql<number>`coalesce(max(${EngineProgressSnapshotTable.time_created}), 0)`,
      })
      .from(EngineProgressSnapshotTable)
      .where(eq(EngineProgressSnapshotTable.task_id, task.id))
      .get(),
  )
  return [
    task.id,
    task.time_created,
    task.time_updated,
    task.budget?.max_executor_groups ?? "",
    sessionTree.count,
    sessionTree.updated,
    sessionTree.statusSeq,
    sessionTree.statusUpdated,
    sessionTree.incidentSeq,
    sessionTree.incidentUpdated,
    goals?.count ?? 0,
    goals?.updated ?? 0,
    interactions?.count ?? 0,
    interactions?.updated ?? 0,
    artifacts?.count ?? 0,
    artifacts?.updated ?? 0,
    bindings?.count ?? 0,
    bindings?.updated ?? 0,
    snapshots?.count ?? 0,
    snapshots?.updated ?? 0,
  ].join("|")
}

function clipBoard(input: string) {
  if (input.length <= BOARD_SUMMARY_LIMIT) return input
  return `${input.slice(0, BOARD_SUMMARY_LIMIT)}\n...[truncated]`
}

function clipArtifactString(input: string) {
  if (input.length <= BOARD_ARTIFACT_STRING_LIMIT) return input
  return `${input.slice(0, BOARD_ARTIFACT_STRING_LIMIT)}\n...[truncated ${input.length - BOARD_ARTIFACT_STRING_LIMIT} chars]`
}

function compactArtifactValue(input: unknown, depth = 0): unknown {
  if (typeof input === "string") return clipArtifactString(input)
  if (input == null || typeof input !== "object") return input
  if (Array.isArray(input)) {
    const items = input.slice(0, BOARD_ARTIFACT_ARRAY_LIMIT).map((item) => compactArtifactValue(item, depth + 1))
    if (input.length <= BOARD_ARTIFACT_ARRAY_LIMIT) return items
    return {
      items,
      truncated: true,
      total: input.length,
    }
  }
  if (depth >= BOARD_ARTIFACT_OBJECT_DEPTH_LIMIT) {
    return {
      truncated: true,
      keys: Object.keys(input as Record<string, unknown>).slice(0, BOARD_ARTIFACT_ARRAY_LIMIT),
    }
  }
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key,
      compactArtifactValue(value, depth + 1),
    ]),
  )
}

function compactArtifactPayload(kind: string, input: unknown) {
  if (!input || typeof input !== "object") return undefined
  const item = input as Record<string, unknown>
  if (kind === "log") {
    return {
      command: typeof item.command === "string" ? item.command : undefined,
      code: typeof item.code === "number" ? item.code : undefined,
      output: typeof item.output === "string" ? clipBoard(item.output) : undefined,
    }
  }
  return compactArtifactValue(item)
}

function compactBuildObservationPayload(row: typeof EngineArtifactTable.$inferSelect) {
  const observation = viewBuildHostObservationArtifact(row)
  return {
    task_id: observation.task_id,
    session_id: observation.session_id,
    final_message_id: observation.final_message_id,
    execution_mode: observation.execution_mode,
    contribution_commit_ref: observation.commit_ref,
    published_commit_ref: observation.published_commit_ref,
    primary_base_commit_ref: observation.primary_base_commit_ref,
    primary_terminal_commit_ref: observation.primary_terminal_commit_ref,
    diff_base_ref: observation.diff_base_ref,
    diff_head_ref: observation.diff_head_ref,
    diffs: observation.diffs,
    observed_artifact_locators: observation.observed_artifact_locators,
    source_artifact_locators: observation.source_artifact_locators,
  }
}

function boardFailure(input: {
  task: TaskRow
  interactions: Array<typeof EngineInteractionRequestTable.$inferSelect>
}) {
  const interaction = input.interactions[0]
  if (interaction) {
    return {
      source: "interaction" as const,
      title: interaction.title ?? "Interaction requires attention",
      summary:
        input.interactions.length > 1
          ? `${clipBoard(interaction.body ?? "")}\n\n${input.interactions.length} pending interactions need attention.`
          : clipBoard(interaction.body ?? ""),
      checks: undefined,
    }
  }
  const terminalReason = taskTerminalReason(input.task)
  if (terminalReason === "interrupted") {
    return {
      source: "task" as const,
      title: "Task interrupted",
      summary: clipBoard(input.task.error ?? "Task execution was interrupted."),
      checks: undefined,
    }
  }
  if (input.task.error) {
    return {
      source: "task" as const,
      title: "Task failed",
      summary: clipBoard(input.task.error),
      checks: undefined,
    }
  }
  return undefined
}

function boardOverview(input: {
  task: TaskRow
  pendingInteractions: Array<typeof EngineInteractionRequestTable.$inferSelect>
  currentFailure:
    | {
        source: "task" | "interaction"
        title: string
        summary: string
      }
    | undefined
  executionProjection: ReturnType<typeof taskExecutionProjectionForTask>
}) {
  const derivedStatus = deriveTaskStatus(input.task)
  const terminalReason = taskTerminalReason(input.task)
  const active = derivedStatus === "active"
  const terminal = derivedStatus === "completed" || derivedStatus === "failed" || derivedStatus === "cancelled"
  const headline =
    input.pendingInteractions.length > 0
      ? "Waiting on human input"
      : terminalReason === "interrupted"
        ? "Task was interrupted"
        : derivedStatus === "active"
          ? "Task is actively progressing"
          : derivedStatus === "completed"
            ? "Task completed"
            : derivedStatus === "failed"
              ? "Task ended with a recorded failure"
              : "Task was cancelled"
  const activeExecutionCount = input.executionProjection.occurrences.filter(
    (occurrence) => occurrence.latest?.status.type === "streaming" || occurrence.latest?.status.type === "retry",
  ).length
  const summary =
    input.pendingInteractions.length > 0
      ? `${input.pendingInteractions.length} interaction${input.pendingInteractions.length > 1 ? "s" : ""} need attention before the task can continue.`
      : derivedStatus === "completed"
        ? "The Orchestrator completed this Task. Review its visible decision message, tool call, domain artifacts, Delivery Slice revisions, and Host observations."
        : (input.currentFailure?.summary ??
          (activeExecutionCount > 0
            ? `${activeExecutionCount} execution occurrence${activeExecutionCount > 1 ? "s are" : " is"} currently active.`
            : "Task is ready for its next scheduler decision."))
  const nextStep =
    input.pendingInteractions.length > 0
      ? {
          kind: "resolve_blocker" as const,
          title: "Resolve the pending interaction",
          detail: "Reply to the permission or question request to unblock the task.",
        }
      : derivedStatus === "failed"
        ? terminalReason === "interrupted"
          ? {
              kind: "message" as const,
              title: "Say what to do after the interruption",
              detail: "The server interrupted this attempt. A message continues from the latest durable task context.",
            }
          : {
              kind: "message" as const,
              title: "Say what to change after the failure",
              detail:
                "Review the visible failure and evidence facts, then send a message with the corrected scope; it opens the next occurrence.",
            }
        : derivedStatus === "cancelled"
          ? {
              kind: "message" as const,
              title: "Say what to do if the task should continue",
              detail: "The task is cancelled. A message resumes it from the latest durable context.",
            }
          : derivedStatus === "completed"
            ? {
                kind: "review_acceptance" as const,
                title: "Review the completion facts",
                detail:
                  "Inspect the Orchestrator decision message, Delivery Slice reviews, Host observations, and every domain artifact.",
              }
            : active
              ? {
                  kind: "observe" as const,
                  title: "Monitor active execution",
                  detail: "Watch progress, handle blockers quickly, and keep follow-up instructions concise.",
                }
              : {
                  kind: "message" as const,
                  title: "Add the next instruction",
                  detail: "Use natural language to refine goals, preferences, or plan hints before resuming the task.",
                }

  return {
    headline,
    summary,
    currentFailure: input.currentFailure,
    nextStep,
    controls: {
      canCancel: isTaskActive(input.task),
    },
  }
}

type ReviewAssociationProjection = {
  deliverySliceRevisionIDs: string[]
  judgment: "accepted" | "rejected" | "inconclusive"
}

function reviewAssociationProjection(
  artifact: ArtifactRow,
  dispatches: Array<{ sessionID: string; deliverySliceRevisionIDs: string[] }>,
): ReviewAssociationProjection | undefined {
  if (artifact.kind === "integrity_review") {
    const payload = IntegrityReviewArtifactPayloadSchema.parse(artifact.payload)
    const judgment =
      payload.verdict === "pass" ? "accepted" : payload.verdict === "needs_correction" ? "rejected" : "inconclusive"
    return { deliverySliceRevisionIDs: payload.goal_ids, judgment }
  }
  if (artifact.kind === "visual_review") {
    const payload = VisualReviewArtifactPayloadSchema.parse(artifact.payload)
    const judgment =
      payload.review.accepted === true ? "accepted" : payload.review.accepted === false ? "rejected" : "inconclusive"
    return { deliverySliceRevisionIDs: payload.goal_ids, judgment }
  }
  if (artifact.kind === "fact_check_review") {
    const payload = FactCheckReviewArtifactSchema.parse(artifact.payload)
    const deliverySliceRevisionIDs = dispatches
      .filter((dispatch) => dispatch.sessionID === payload.fact_check_session_id)
      .flatMap((dispatch) => dispatch.deliverySliceRevisionIDs)
    const judgment =
      payload.review.overall_verdict === "clean"
        ? "accepted"
        : payload.review.overall_verdict === "needs_orchestrator_action"
          ? "rejected"
          : "inconclusive"
    return { deliverySliceRevisionIDs: [...new Set(deliverySliceRevisionIDs)], judgment }
  }
  return undefined
}

function normalizedBoardPath(input: string) {
  return input
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "")
}

function ownedPathContainsFile(ownedPaths: readonly string[], file: string) {
  const normalizedFile = normalizedBoardPath(file)
  return ownedPaths.some((ownedPath) => {
    const normalizedOwnedPath = normalizedBoardPath(ownedPath)
    if (normalizedOwnedPath === ".") return normalizedFile.length > 0
    return (
      normalizedOwnedPath.length > 0 &&
      (normalizedFile === normalizedOwnedPath || normalizedFile.startsWith(`${normalizedOwnedPath}/`))
    )
  })
}

function buildGoalFields(
  task: TaskRow,
  goals: Array<typeof EngineGoalTable.$inferSelect>,
  artifacts: ArtifactRow[],
  executionProjection: ReturnType<typeof taskExecutionProjectionForTask>,
) {
  const membership = resolveCurrentGoalMembershipContext(task.id)
  const identityByRevisionID = new Map(membership.goals.map((context) => [context.deliverySliceRevisionID, context]))
  const activeExecutionSessionIDs = new Set(
    executionProjection.occurrences
      .filter((occurrence) => occurrence.latest?.status.type !== "terminal")
      .map((occurrence) => occurrence.sessionID),
  )
  const dispatchLineages = artifacts
    .filter((artifact) => artifact.kind === "dispatch_lineage")
    .map((artifact) => ({
      artifact,
      payload: parseDispatchLineagePayload(artifact.payload, artifact.id),
    }))
  const completedAt = deriveTaskStatus(task) === "completed" ? task.time_completed : null
  const currentCompletionDecision =
    completedAt === null
      ? undefined
      : findTaskCompletionDecisionForTerminalTime({ taskID: task.id, timeCompleted: completedAt })
  const taskWorkflowDispatches = dispatchLineages.map((lineage) => ({
    artifactID: lineage.artifact.id,
    sessionID: lineage.payload.child_session_id,
    deliverySliceRevisionIDs: lineage.payload.delivery_slice_revision_ids,
  }))
  const reviewProjections = artifacts.flatMap((artifact) => {
    const projection = reviewAssociationProjection(artifact, taskWorkflowDispatches)
    return projection ? [{ artifact, projection }] : []
  })
  const buildObservations = artifacts
    .filter((artifact) => artifact.kind === "build_host_observation")
    .map((artifact) => viewBuildHostObservationArtifact(artifact))
  const contributionForRevision = (deliverySliceRevisionID: string, ownedPaths: readonly string[]) => {
    const subjectSessionIDs = new Set(
      taskWorkflowDispatches
        .filter((dispatch) => dispatch.deliverySliceRevisionIDs.includes(deliverySliceRevisionID))
        .map((dispatch) => dispatch.sessionID),
    )
    const observations = buildObservations.filter(
      (observation) =>
        observation.session_id &&
        subjectSessionIDs.has(observation.session_id) &&
        observation.diffs.some((diff) => ownedPathContainsFile(ownedPaths, diff.file)),
    )
    const filesByPath = new Map<
      string,
      { file: string; status: string; additions: number; deletions: number; isBinary: boolean }
    >()
    for (const observation of observations) {
      for (const diff of observation.diffs) {
        if (!ownedPathContainsFile(ownedPaths, diff.file)) continue
        filesByPath.set(normalizedBoardPath(diff.file), {
          file: diff.file,
          status: diff.status,
          additions: diff.additions,
          deletions: diff.deletions,
          isBinary: diff.is_binary,
        })
      }
    }
    return {
      observationArtifactIDs: observations.map((observation) => observation.id),
      sessionIDs: [
        ...new Set(observations.flatMap((observation) => (observation.session_id ? [observation.session_id] : []))),
      ],
      files: [...filesByPath.values()].sort((left, right) => left.file.localeCompare(right.file)),
      contributionCommitRefs: [
        ...new Set(observations.flatMap((observation) => (observation.commit_ref ? [observation.commit_ref] : []))),
      ],
      publishedCommitRefs: [
        ...new Set(
          observations.flatMap((observation) =>
            observation.published_commit_ref ? [observation.published_commit_ref] : [],
          ),
        ),
      ],
      diffRefs: observations.flatMap((observation) =>
        observation.diff_base_ref && observation.diff_head_ref
          ? [{ base: observation.diff_base_ref, head: observation.diff_head_ref }]
          : [],
      ),
    }
  }
  const factsForRevision = (deliverySliceRevisionID: string) => {
    const subjectDispatches = taskWorkflowDispatches.filter((dispatch) =>
      dispatch.deliverySliceRevisionIDs.includes(deliverySliceRevisionID),
    )
    const activeSessionIDs = subjectDispatches
      .filter((dispatch) => activeExecutionSessionIDs.has(dispatch.sessionID))
      .map((dispatch) => dispatch.sessionID)
    const applicableDispatchArtifactIDs = new Set(subjectDispatches.map((dispatch) => dispatch.artifactID))
    const scopedReviewProjections = reviewProjections.filter(({ projection }) =>
      projection.deliverySliceRevisionIDs.includes(deliverySliceRevisionID),
    )
    const scopedArtifacts = [
      ...artifacts.filter((artifact) => applicableDispatchArtifactIDs.has(artifact.id)),
      ...scopedReviewProjections.map(({ artifact }) => artifact),
    ]
    const reviewAssociations = scopedReviewProjections.map(({ artifact, projection }) => ({
      artifactID: artifact.id,
      deliverySliceRevisionID,
      judgment: projection.judgment,
    }))
    return deriveDeliverySliceFacts({
      deliverySliceRevisionID,
      associatedSessionIDs: subjectDispatches.map((dispatch) => dispatch.sessionID),
      activeSessionIDs,
      evidenceArtifactIDs: scopedArtifacts.map((artifact) => artifact.id),
      reviewAssociations,
      ...(currentCompletionDecision
        ? {
            completionDecision: {
              artifactID: currentCompletionDecision.id,
              acceptedDeliverySliceRevisionIDs: currentCompletionDecision.payload.accepted_delivery_slice_revision_ids,
            },
          }
        : {}),
    })
  }
  const boardGoals = goals.map((goal) => {
    const identity = identityByRevisionID.get(goal.id)
    if (!identity) throw new Error(`Current Delivery Slice revision ${goal.id} has no membership identity`)
    return {
      goalID: goal.id,
      deliverySliceID: identity.deliverySliceID,
      deliverySliceRevisionID: identity.deliverySliceRevisionID,
      revision: identity.revision,
      ...(identity.priorRevisionID ? { priorRevisionID: identity.priorRevisionID } : {}),
      orderKey: timelineOrderKey({
        domain: "board_goal",
        time: goal.time_created,
        id: goal.id,
      }),
      goalTitle: goal.title,
      goalObjective: goal.objective?.trim() ? goal.objective.trim() : undefined,
      kind: goal.kind,
      ownedPaths: goal.owned_paths,
      ...factsForRevision(goal.id),
      contribution: contributionForRevision(goal.id, goal.owned_paths),
      orderIndex: goal.order_index,
      acceptanceSpecs: parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal ${goal.id}.acceptance_specs`),
      priority: (goal.priority ?? "blocking") as "blocking" | "advisory",
    }
  })
  return {
    goals: boardGoals,
    requirements: buildRequirementSetRequirements(artifacts, goals, currentCompletionDecision),
    architect: buildArchitectSummary(artifacts),
  }
}

function buildRequirementSetRequirements(
  artifacts: ArtifactRow[],
  goals: Array<Pick<typeof EngineGoalTable.$inferSelect, "id" | "requirement_set_artifact_id" | "acceptance_specs">>,
  completionDecision: ReturnType<typeof findTaskCompletionDecisionForTerminalTime>,
) {
  return artifacts
    .filter((artifact) => artifact.kind === "requirement_set")
    .flatMap((artifact) => {
      const requirementSet = artifact.payload as unknown as RequirementSet
      return requirementSet.requirements.map((requirement) => {
        const claimingGoals = goals.filter(
          (goal) =>
            goal.requirement_set_artifact_id === artifact.id &&
            requirementIDsFromAcceptanceSpecs(
              parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal(${goal.id}).acceptance_specs`),
            ).includes(requirement.id),
        )
        const claimingDeliverySliceRevisionIDs = claimingGoals.map((goal) => goal.id)
        const acceptedRevisionIDs = new Set(completionDecision?.payload.accepted_delivery_slice_revision_ids ?? [])
        const acceptedDeliverySliceRevisionIDs = claimingDeliverySliceRevisionIDs.filter((goalID) =>
          acceptedRevisionIDs.has(goalID),
        )
        return {
          id: `${artifact.id}:${requirement.id}`,
          description: requirement.description,
          type: requirement.type === "explicit" ? ("explicit" as const) : ("inferred" as const),
          priority: "blocking" as const,
          acceptance: {
            accepted:
              claimingDeliverySliceRevisionIDs.length > 0 &&
              acceptedDeliverySliceRevisionIDs.length === claimingDeliverySliceRevisionIDs.length,
            claimingDeliverySliceRevisionIDs,
            acceptedDeliverySliceRevisionIDs,
            ...(completionDecision ? { completionDecisionArtifactID: completionDecision.id } : {}),
          },
        }
      })
    })
}

/** Build architect summary from the Architect Contract Graph artifact. */
function buildArchitectSummary(artifacts: ArtifactRow[]) {
  const graphs = artifacts
    .filter((artifact) => artifact.kind === "architect_contract_graph")
    .map((artifact) => ({
      artifactID: artifact.id,
      graph: ArchitectContractGraphSchema.parse((artifact.payload as { graph?: unknown } | null | undefined)?.graph),
    }))
  if (graphs.length === 0) return undefined
  const categories = [...new Set(graphs.flatMap(({ graph }) => graph.contracts.map((contract) => contract.kind)))]
  const contractCount = graphs.reduce((count, { graph }) => count + graph.contracts.length, 0)
  return {
    summary: `${graphs.length} ContractGraph artifact(s) and ${contractCount} interface contracts; every artifact remains visible.`,
    contractCount,
    categories,
    decisions: graphs.flatMap(({ artifactID, graph }) => [
      ...graph.contracts.map((contract) => ({
        key: `${artifactID}:${contract.kind}`,
        value: `${contract.name}: ${contract.summary}`,
        reason: `artifact=${artifactID}; producer=${contract.producer_goal_id}; consumers=${contract.consumer_goal_ids.join(", ") || "(none)"}`,
        goalID: contract.producer_goal_id,
      })),
    ]),
  }
}
