/**
 * Describe layer — render a task's durable facts for Orchestrator judgment.
 *
 * This is the single read-path the orchestrator LLM uses to see "what's going
 * on." It composes an LLM-readable snapshot from durable facts:
 *   - engine_goal (immutable Delivery Slice contract revisions)
 *   - engine_artifact  (domain artifacts and Host observations)
 *   - decision_log     (operator + agent decisions)
 *   - answered clarifications
 *
 * The Orchestrator interprets this visible projection alongside the conversation
 * and tool results. The description contains facts, not an admission verdict.
 */

import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import type { EvidenceLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import z from "zod"
import { createDecisionLog, type DecisionEntry } from "@/decision-log"
import { renderUserRequestSection } from "@/intent/request-prompt"
import { deriveTaskStatus } from "./task-status"
import { ToolFailureCause, renderToolFailureCause } from "@/session/tool-failure-cause"
import { SessionStatus } from "@/session/status"
import { AutomationTable } from "@/scheduler/automation.sql"
import { projectAutomationInTransaction } from "@/scheduler/automation-projection"
import { Database, and, asc, desc, eq, isNotNull, or, sql } from "@/storage/db"
import { listAgentCoordinationResponses, listPendingAgentCoordinationRequests } from "./agent-coordination"
import { listRecentTaskMailboxMessages, type MailboxSchedulerMessage } from "./mailbox"
import { EngineArtifactTable } from "./engine.sql"
import { findDispatchLineageByArtifactID, parseDispatchLineagePayload } from "./dispatch-lineage"
import { findDispatchSettlementByDispatchID } from "./dispatch-settlement"
import { type SelectedWorkflowBinding } from "./workflow-binding"
import { readTaskWorkflowBinding } from "./workflow-binding-facts"
import { taskExecutionProjectionForTask } from "@/orchestrator/task-event"
import { findTaskCompletionDecisionForTerminalTime } from "./completion-decision"
import { parseProcessRecoveryFactContext, type ProcessRecoveryFactContext } from "./process-recovery-fact"
import { validateProcessPhysicalEvidence } from "@/runtime/process-occurrence"

import { effectiveMaxAgentParallelism, clarificationTranscriptSection } from "./helpers"
import {
  findTask,
  resolveCurrentGoalMembershipContext,
  listOrchestratorStreamErrorArtifacts,
  listTaskInfrastructureErrorArtifacts,
  listToolExecuteErrorArtifacts,
  type GoalRow,
  type TaskRow,
} from "./store"
import { listOwnedPromptSessionsForTask } from "./runtime"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { AgentRoleContract } from "@/agent/role-contract"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { ProtocolEventTable, protocolEventBelongsToTask } from "@/protocol/protocol.sql"
import { taskRewindCursor } from "./rewind"

/** Cap recent stream-failure entries surfaced into the orchestrator prompt.
 *  A chronically failing provider can write an artifact every wake; older
 *  entries add no decision value once the LLM has seen the trend. */
const STREAM_FAILURE_PROMPT_CAP = 5
const INFRASTRUCTURE_FAILURE_PROMPT_CAP = 5
const AGENT_FAILURE_PROMPT_CAP = 5
const TOOL_EXECUTE_FAILURE_PROMPT_CAP = 5
const OPEN_TOOL_CALL_PROMPT_CAP = 5
const AGENT_COORDINATION_PROMPT_CAP = 8
const TASK_SCHEDULED_WAIT_PROMPT_CAP = 5

export function describeProcessRecoveryFact(taskID: string, factID: string) {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, factID),
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task-infrastructure-error"),
          eq(EngineArtifactTable.label, "process-recovery"),
        ),
      )
      .get(),
  )
  if (!row) throw new Error(`Task ${taskID} process recovery fact ${factID} is missing`)
  const payload = row.payload as { operation?: unknown; context?: unknown }
  if (
    payload.operation !== "handoff-process-owned-task-execution" &&
    payload.operation !== "recover-interrupted-task-execution"
  ) {
    throw new Error(`Task ${taskID} artifact ${factID} is not a process execution recovery occurrence`)
  }
  const parsed = parseProcessRecoveryFactContext(payload.context, factID)
  if (parsed.kind === "legacy_shutdown_handoff") {
    // Pre-v1 facts carry only the owned Session list. Nothing per-subject is
    // verifiable, and nothing needs to be: the description exists to tell the
    // Orchestrator what this wake is about, not to re-litigate old evidence.
    return {
      schema_version: 1,
      origin: "process_shutdown",
      physical_evidence: {
        kind: "unmanaged_process_cause_unknown",
        reason: `legacy shutdown handoff (pre-v1 context); owned sessions: ${parsed.ownedSessionIDs.join(", ") || "none"}`,
      },
      affected_subjects: [],
    } satisfies ProcessRecoveryFactContext
  }
  const context = parsed.context
  validateProcessPhysicalEvidence(context.physical_evidence)
  for (const subject of context.affected_subjects) {
    const session = Database.use((db) =>
      db
        .select({ id: SessionTable.id, timeCreated: SessionTable.time_created })
        .from(SessionTable)
        .where(eq(SessionTable.id, subject.session_id))
        .get(),
    )
    if (!session) throw new Error(`Process recovery fact ${factID} Session ${subject.session_id} is missing`)
    if (subject.kind === "affected_created_session") {
      if (session.timeCreated !== subject.session_created_at) {
        throw new Error(`Process recovery fact ${factID} created Session identity changed`)
      }
      continue
    }
    const message = Database.use((db) =>
      db
        .select({ id: MessageTable.id })
        .from(MessageTable)
        .where(and(eq(MessageTable.id, subject.input_message_id), eq(MessageTable.session_id, subject.session_id)))
        .get(),
    )
    if (!message) throw new Error(`Process recovery fact ${factID} input message identity changed`)
    const descriptor = subject.worker
      ? WorkerTurnDescriptor.get({ id: subject.worker.worker_turn_descriptor.id, sessionID: subject.session_id })
      : undefined
    if (
      subject.worker &&
      (!descriptor ||
        descriptor.hash !== subject.worker.worker_turn_descriptor.hash ||
        descriptor.payload.messageAuthority.user_message_id !== subject.input_message_id)
    ) {
      throw new Error(`Process recovery fact ${factID} Worker Turn descriptor authority changed`)
    }
    if (subject.kind === "affected_execution") {
      const lifecycleEventID = subject.lifecycle_event_id
      const lifecycle = Database.use((db) =>
        db
          .select({ payload: ProtocolEventTable.payload })
          .from(ProtocolEventTable)
          .where(
            and(
              eq(ProtocolEventTable.id, lifecycleEventID),
              protocolEventBelongsToTask(taskID),
              eq(ProtocolEventTable.session_id, subject.session_id),
              eq(ProtocolEventTable.type, SessionStatus.Event.Status.type),
            ),
          )
          .get(),
      )
      if (lifecycle?.payload?.inputMessageID !== subject.input_message_id) {
        throw new Error(`Process recovery fact ${factID} lifecycle occurrence identity changed`)
      }
    }
    if (subject.worker) {
      const lineage = findDispatchLineageByArtifactID({
        taskID,
        artifactID: subject.worker.dispatch_lineage_artifact_id,
      })
      if (
        !lineage ||
        lineage.payload.child_session_id !== subject.session_id ||
        (descriptor?.payload.dispatchTurn && descriptor.payload.dispatchTurn.current_dispatch_id !== lineage.dispatchID)
      ) {
        throw new Error(`Process recovery fact ${factID} dispatch lineage authority changed`)
      }
    }
  }
  return context
}

// ---------------------------------------------------------------------------
// Structured description types (exported for tests / UI)
// ---------------------------------------------------------------------------

export interface CurrentProcessPromptOwnerDesc {
  session_id: string
  session_kind: string
  /** Current process-local lifecycle observation. An idle owner is retained
   * for coordination continuation and is not an executing worker. */
  lifecycle_status: SessionStatus.Info["type"]
}

export function currentProcessPromptOwnersForTask(taskID: string): CurrentProcessPromptOwnerDesc[] {
  return listOwnedPromptSessionsForTask(taskID).map((owner) => ({
    session_id: owner.sessionID,
    session_kind: owner.kind,
    lifecycle_status: SessionStatus.get(owner.sessionID).type,
  }))
}

export interface GoalDesc {
  id: string
  delivery_slice_id: string
  delivery_slice_revision_id: string
  delivery_slice_revision: number
  prior_delivery_slice_revision_id?: string
  title: string
  kind: string
  priority: "blocking" | "advisory"
  objective: string
  acceptance_summary: string
  owned_paths: string[]
  supersede_of?: string
  requirement_set_artifact_id?: string
  requirement_set_artifact_revision?: number
  requirement_set_artifact_sha256?: string
  contract_graph_artifact_id?: string
  contract_graph_artifact_revision?: number
  contract_graph_artifact_sha256?: string
}

export interface StreamFailureDesc {
  artifact_id: string
  time_created: number
  /** Free-text reason recorded by `recordOrchestratorStreamError` —
   *  e.g. "APIError: Provider alibaba-coding-plan returned HTTP 401 …". */
  reason: string
  /** Class name from the AI SDK error (`APIError`, `AbortError`, …) when
   *  the writer captured one. */
  error_name?: string
  /** Orchestrator session id active at the moment of the failure, when
   *  available. */
  session_id?: string
}

export interface InfrastructureFailureDesc {
  artifact_id: string
  time_created: number
  component: string
  operation: string
  reason: string
  error_name?: string
  session_id?: string
  recovery?: import("./process-recovery-fact").ProcessRecoveryFactContext
}

export interface ToolExecuteFailureDesc {
  artifact_id: string
  time_created: number
  session_id?: string
  message_id?: string
  part_id?: string
  tool_name: string
  call_id: string
  reason: string
}

export interface AgentFailureDesc {
  decision_id: string
  time_created: number
  key: string
  reason: string
  goal_id?: string
}

export interface AgentCoordinationRequestDesc {
  request_id: string
  time_created: number
  session_id: string
  agent: string
  origin: "worker_handoff" | "operator_steer"
  message_id?: string
  operator_steer_id?: string
  operator_message?: string
  delivery_slice_subject?: string
  blocking: boolean
  severity: "info" | "blocked" | "failure"
  summary: string
  details: string
  requested_decision: string
  evidence_locators: EvidenceLocator[]
  last_failed_response_id?: string
  last_failed_action_id?: string
  last_action_error?: string
  last_action_failed_at?: number
}

export interface OpenToolCallDesc {
  time_created: number
  session_id: string
  session_kind: string
  message_id: string
  part_id: string
  tool_name: string
  call_id: string
  status: string
}

export interface CompletedToolCallRefDesc {
  time_created: number
  session_id: string
  session_kind: string
  message_id: string
  part_id: string
  tool_name: string
  call_id: string
}

export interface AgentMessageRefDesc {
  time_completed: number
  session_id: string
  session_kind: string
  message_id: string
  parent_message_id: string
  agent_id: string
  worker_turn_descriptor_id?: string
  worker_turn_descriptor_error?: string
}

export interface TaskWorkflowDispatchDesc {
  artifact_id: string
  dispatch_id: string
  workflow_occurrence_id: string
  session_id: string
  target_agent_id: string
  delivery_slice_revision_ids: string[]
  session_status: {
    type: string
    reason?: string
    error?: string
    summary?: string
    emitted_at: number
  } | null
  settlement: { artifact_id: string; outcome_kind: string } | null
  terminal_success: boolean
}

export interface TaskWorkflowNodeDesc {
  node_id: string
  agent_id: string
  depends_on: string[]
  dispatches: TaskWorkflowDispatchDesc[]
  terminal_success: boolean
  terminal_success_predecessor_ids: string[]
  occurrence_status: "occurrence_not_committed" | "occurrence_committed"
}

export interface TaskWorkflowExecutionDesc {
  binding: SelectedWorkflowBinding
  nodes: TaskWorkflowNodeDesc[]
  /** Dependency-ready, still-undispatched nodes are visible scheduling facts.
   * This projection does not admit, queue, or execute them. */
  frontier_node_ids: string[]
}

export interface TaskScheduledWaitDesc {
  job_id: string
  name: string
  reason: string
  expression: string
  enabled: boolean
  one_shot: boolean
  next_run: number
  last_run?: number
  failure_count: number
  last_error?: string
}

export interface TaskDesc {
  id: string
  title: string
  status: string
  source: string
  request: string
  error?: string
  clarifications?: string
  goals: GoalDesc[]
  /** Immutable workflow binding and dispatch/Session observations reconstructed
   * for every natural Orchestrator wake. This is evidence, not persisted step
   * state or a Host scheduling gate. */
  workflow_execution?: TaskWorkflowExecutionDesc
  /** Complete current-process prompt-controller inventory for this Task.
   * Includes the root Orchestrator and subject-scoped workers. */
  current_process_prompt_owners?: CurrentProcessPromptOwnerDesc[]
  budget: {
    max_executor_groups: number
  }
  /** Host/runtime/tooling failures remain independent of expert and Task
   * business outcomes. */
  recent_infrastructure_failures?: InfrastructureFailureDesc[]
  /** Recent orchestrator-stream-error artifacts (newest first, capped at
   *  STREAM_FAILURE_PROMPT_CAP). Most entries are wakes whose LLM stream
   *  aborted before any decision was made. The orchestrator LLM reads this
   *  list on its next wake and decides from the current task context — there
   *  is no engine state machine that auto-handles them (rule 13). Empty /
   *  undefined when the task has had no such artifacts since
   *  `task.time_started`. */
  recent_stream_failures?: StreamFailureDesc[]
  recent_tool_execute_failures?: ToolExecuteFailureDesc[]
  /** Persisted unfinished tool calls in the task Session tree without an
   *  actual process-owned prompt controller. This is diagnostic evidence,
   *  never a lifecycle or admission predicate. */
  open_tool_calls_without_current_owner?: OpenToolCallDesc[]
  /** Complete stable-ref inventory for completed specialist/control messages
   *  whose physical stream reached a recorded completion. Payloads remain in
   *  the exact Message Parts and are not copied into this ephemeral prompt
   *  projection. */
  agent_message_refs?: AgentMessageRefDesc[]
  /** Complete stable-ref inventory for completed specialist tool calls. This
   *  is independent of assistant-message completion because a process may
   *  stop after a tool result is durable but before the enclosing message
   *  receives a completion timestamp. */
  completed_tool_call_refs?: CompletedToolCallRefDesc[]
  /** Durable task-scoped scheduled waits created by the `wait` tool. These are
   *  scheduling facts for the Large Language Model (LLM), not a host-side
   *  flow gate. */
  task_scheduled_waits?: TaskScheduledWaitDesc[]
  /** Recent sub-agent session failures recorded in decision_log phase
   *  "agent_error". These are the model-visible counterpart to overlay red
   *  session cards: provider quota, network, schema, and terminal session
   *  errors that would otherwise live only in User Interface (UI) / log status. */
  recent_agent_failures?: AgentFailureDesc[]
  /** Pending worker/operator-to-orchestrator coordination requests. These are durable
   *  coordination facts: a worker or operator asked for an explicit scheduling decision.
   *  The orchestrator must answer through `respond_agent_coordination` or take
   *  another visible lifecycle action; do not inject private steering without
   *  a request id. */
  pending_agent_coordination?: AgentCoordinationRequestDesc[]
  /** Total durable pending requests before the bounded prompt projection. */
  pending_agent_coordination_total?: number
  /** True when pending_agent_coordination is only a prefix of the durable set. */
  pending_agent_coordination_truncated?: boolean
  /** Ordinary worker progress, status, and notification messages. They are
   *  durable task evidence for the next natural scheduler wake, not a wake
   *  trigger, lifecycle transition, or pending decision request. */
  recent_mailbox_messages?: MailboxSchedulerMessage[]
}

function describeTaskScheduledWaits(taskID: string, floor: number): TaskScheduledWaitDesc[] {
  const persisted = Database.use((db) => db
      .select()
      .from(AutomationTable)
      .where(and(eq(AutomationTable.task_id, taskID), eq(AutomationTable.kind, "delay")))
      .orderBy(AutomationTable.definition_id, desc(AutomationTable.revision), desc(AutomationTable.id)).all())
  const latest = new Map<string, (typeof persisted)[number]>()
  for (const row of persisted) if (!latest.has(row.definition_id)) latest.set(row.definition_id, row)
  const rows = [...latest.values()]
    .map((row) => Database.use((db) => projectAutomationInTransaction(db, row)))
    .filter((row) => row.status === "active" || row.last_error !== null)
    .sort((left, right) => Number(right.status === "active") - Number(left.status === "active") || left.next_run - right.next_run || (right.last_run ?? 0) - (left.last_run ?? 0) || right.id.localeCompare(left.id))
    .slice(0, TASK_SCHEDULED_WAIT_PROMPT_CAP)
  return rows.map((row) => ({
    job_id: row.id,
    name: row.name,
    reason: row.prompt,
    expression: `until ${new Date(row.next_run).toISOString()}`,
    enabled: row.status === "active",
    one_shot: true,
    next_run: row.next_run,
    last_run: row.last_run ?? undefined,
    failure_count: row.failure_count,
    last_error: row.last_error ?? undefined,
  }))
}

function listOpenToolCallsWithoutCurrentOwner(task: TaskRow): OpenToolCallDesc[] {
  if (!task.session_id) return []
  const rows = Database.use((db) =>
    db.all<{
      time_created: number
      session_id: string
      session_kind: string
      message_id: string
      part_id: string
      tool_name: string | null
      call_id: string | null
      status: string | null
    }>(sql`
      WITH RECURSIVE session_tree(id, kind) AS (
        SELECT id, kind
        FROM session
        WHERE id = ${task.session_id}
          AND project_id = ${task.project_id}
        UNION ALL
        SELECT s.id, s.kind
        FROM session s
        JOIN session_tree st ON s.parent_id = st.id
      )
      SELECT
        p.time_created AS time_created,
        m.session_id AS session_id,
        st.kind AS session_kind,
        p.message_id AS message_id,
        p.id AS part_id,
        json_extract(p.data, '$.tool') AS tool_name,
        json_extract(p.data, '$.callID') AS call_id,
        'running' AS status
      FROM tool_part_request p
      JOIN message m ON m.id = p.message_id
      JOIN session_tree st ON st.id = m.session_id
      LEFT JOIN tool_part_outcome o ON o.request_part_id = p.id
      WHERE o.id IS NULL
      ORDER BY p.time_created DESC, p.id DESC
    `),
  )

  return rows
    .flatMap((row) => {
      const currentStatus = SessionStatus.get(row.session_id)
      if (currentStatus.type === "streaming" || currentStatus.type === "retry") return []
      if (!row.tool_name || !row.call_id || !row.status) return []
      return [
        {
          time_created: row.time_created,
          session_id: row.session_id,
          session_kind: row.session_kind,
          message_id: row.message_id,
          part_id: row.part_id,
          tool_name: row.tool_name,
          call_id: row.call_id,
          status: row.status,
        },
      ]
    })
    .slice(0, OPEN_TOOL_CALL_PROMPT_CAP)
}

function listCompletedToolCallRefs(task: TaskRow): CompletedToolCallRefDesc[] {
  if (!task.session_id) return []
  return Database.use((db) =>
    db.all<CompletedToolCallRefDesc>(sql`
      WITH RECURSIVE session_tree(id, kind) AS (
        SELECT id, kind
        FROM session
        WHERE id = ${task.session_id}
          AND project_id = ${task.project_id}
        UNION ALL
        SELECT s.id, s.kind
        FROM session s
        JOIN session_tree st ON s.parent_id = st.id
      )
      SELECT
        p.time_created AS time_created,
        m.session_id AS session_id,
        st.kind AS session_kind,
        p.message_id AS message_id,
        p.id AS part_id,
        json_extract(p.data, '$.tool') AS tool_name,
        json_extract(p.data, '$.callID') AS call_id
      FROM tool_part_request p
      JOIN message m ON m.id = p.message_id
      JOIN session_tree st ON st.id = m.session_id
      JOIN tool_part_outcome o ON o.request_part_id = p.id
      WHERE st.kind NOT IN ('root', 'orchestrator', 'mission', 'system')
        AND json_extract(o.data, '$.outcome') = 'completed'
      ORDER BY p.time_created, p.id
    `),
  ).filter((row) => Boolean(row.tool_name && row.call_id))
}

function listAgentMessageRefs(task: TaskRow): AgentMessageRefDesc[] {
  if (!task.session_id) return []
  const messages = Database.use((db) =>
    db.all<{
      time_completed: number
      session_id: string
      session_kind: string
      message_id: string
      parent_message_id: string | null
      agent_id: string | null
      worker_turn_descriptor_id: string | null
      worker_turn_descriptor_hash: string | null
    }>(sql`
      WITH RECURSIVE session_tree(id, kind) AS (
        SELECT id, kind
        FROM session
        WHERE id = ${task.session_id}
          AND project_id = ${task.project_id}
        UNION ALL
        SELECT s.id, s.kind
        FROM session s
        JOIN session_tree st ON s.parent_id = st.id
      )
      SELECT
        CAST(json_extract(m.data, '$.time.completed') AS INTEGER) AS time_completed,
        m.session_id AS session_id,
        st.kind AS session_kind,
        m.id AS message_id,
        json_extract(m.data, '$.parentID') AS parent_message_id,
        json_extract(m.data, '$.agent') AS agent_id,
        json_extract(parent.data, '$.extra.workerTurnDescriptor.id') AS worker_turn_descriptor_id,
        json_extract(parent.data, '$.extra.workerTurnDescriptor.hash') AS worker_turn_descriptor_hash
      FROM message m
      JOIN session_tree st ON st.id = m.session_id
      LEFT JOIN message parent
        ON parent.id = json_extract(m.data, '$.parentID')
       AND parent.session_id = m.session_id
      WHERE st.kind NOT IN ('root', 'orchestrator', 'mission', 'system')
        AND json_extract(m.data, '$.role') = 'assistant'
        AND json_extract(m.data, '$.time.completed') IS NOT NULL
      ORDER BY CAST(json_extract(m.data, '$.time.completed') AS INTEGER), m.id
    `),
  )
  return messages.flatMap((message) => {
    if (!message.parent_message_id || !message.agent_id) return []
    let descriptorError: string | undefined
    if (message.worker_turn_descriptor_id) {
      try {
        const descriptor = WorkerTurnDescriptor.get({
          id: message.worker_turn_descriptor_id,
          sessionID: message.session_id,
        })
        if (!descriptor) {
          throw new Error(
            `descriptor ${message.worker_turn_descriptor_id} is missing from Session ${message.session_id}`,
          )
        }
        if (descriptor.hash !== message.worker_turn_descriptor_hash) {
          throw new Error(`descriptor ${descriptor.id} hash does not match parent message ${message.parent_message_id}`)
        }
        const fixedRole = AgentRoleContract.isRoleID(message.agent_id)
          ? AgentRoleContract.get(message.agent_id)
          : undefined
        if (fixedRole?.controlSurface !== "helper" && descriptor.payload.identity.agentID !== message.agent_id) {
          throw new Error(
            `descriptor ${descriptor.id} agent ${descriptor.payload.identity.agentID} does not match assistant ${message.agent_id}`,
          )
        }
      } catch (error) {
        descriptorError = error instanceof Error ? error.message : String(error)
      }
    }
    return [
      {
        time_completed: message.time_completed,
        session_id: message.session_id,
        session_kind: message.session_kind,
        message_id: message.message_id,
        parent_message_id: message.parent_message_id,
        agent_id: message.agent_id,
        ...(message.worker_turn_descriptor_id ? { worker_turn_descriptor_id: message.worker_turn_descriptor_id } : {}),
        ...(descriptorError ? { worker_turn_descriptor_error: descriptorError } : {}),
      },
    ]
  })
}

function describeTaskWorkflowExecution(task: TaskRow): TaskWorkflowExecutionDesc | undefined {
  const binding = readTaskWorkflowBinding(task.id)
  const currentCompletionDecision =
    deriveTaskStatus(task) === "completed" && task.time_completed !== null
      ? findTaskCompletionDecisionForTerminalTime({ taskID: task.id, timeCompleted: task.time_completed })
      : undefined
  const rows = Database.use((db) =>
    db
      .select({
        id: EngineArtifactTable.id,
        kind: EngineArtifactTable.kind,
        payload: EngineArtifactTable.payload,
      })
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, task.id), eq(EngineArtifactTable.kind, "dispatch_lineage")))
      .orderBy(asc(EngineArtifactTable.time_created), asc(EngineArtifactTable.id))
      .all(),
  )
  if (!binding) return undefined

  const dispatches = rows
    .filter((row) => row.kind === "dispatch_lineage")
    .map((row) => ({ artifactID: row.id, payload: parseDispatchLineagePayload(row.payload, row.id) }))
  const executionByInputMessageID = new Map(
    taskExecutionProjectionForTask(task.id).occurrences.map((occurrence) => [occurrence.inputMessageID, occurrence]),
  )
  const executionForDispatch = (dispatch: { payload: { child_session_id: string; dispatch_id: string } }) => {
    const descriptor = WorkerTurnDescriptor.findForDispatch({
      sessionID: dispatch.payload.child_session_id,
      dispatchID: dispatch.payload.dispatch_id,
    })
    return descriptor ? executionByInputMessageID.get(descriptor.payload.messageAuthority.user_message_id) : undefined
  }
  if (binding.kind === "direct") {
    const directDispatches = dispatches.map((dispatch): TaskWorkflowDispatchDesc => {
      const execution = executionForDispatch(dispatch)
      const status = execution?.latest
      const settlement = findDispatchSettlementByDispatchID({
        taskID: task.id,
        dispatchID: dispatch.payload.dispatch_id,
      })
      return {
        artifact_id: dispatch.artifactID,
        dispatch_id: dispatch.payload.dispatch_id,
        workflow_occurrence_id: dispatch.payload.workflow_occurrence_id,
        session_id: dispatch.payload.child_session_id,
        target_agent_id: dispatch.payload.target_agent_id,
        delivery_slice_revision_ids: dispatch.payload.delivery_slice_revision_ids,
        session_status: status
          ? {
              type: status.status.type,
              ...(status.status.reason ? { reason: status.status.reason } : {}),
              ...(status.status.error ? { error: status.status.error } : {}),
              ...(status.status.summary ? { summary: status.status.summary } : {}),
              emitted_at: status.emittedAt,
            }
          : null,
        settlement: settlement
          ? { artifact_id: settlement.artifactID, outcome_kind: settlement.payload.outcome.kind }
          : null,
        terminal_success: settlement?.payload.outcome.kind === "terminal_success",
      }
    })
    return {
      binding,
      nodes: [
        {
          node_id: "__direct_task__",
          agent_id: "direct-task",
          depends_on: [],
          dispatches: directDispatches,
          terminal_success: directDispatches.some((dispatch) => dispatch.terminal_success),
          terminal_success_predecessor_ids: [],
          occurrence_status: directDispatches.length > 0 ? "occurrence_committed" : "occurrence_not_committed",
        },
      ],
      frontier_node_ids: [],
    }
  }

  const dispatchesByNodeID = new Map<string, TaskWorkflowDispatchDesc[]>()
  for (const dispatch of dispatches) {
    if (!dispatch.payload.workflow_node_id) continue
    const execution = executionForDispatch(dispatch)
    const status = execution?.latest
    const settlement = findDispatchSettlementByDispatchID({ taskID: task.id, dispatchID: dispatch.payload.dispatch_id })
    const nodeDispatches = dispatchesByNodeID.get(dispatch.payload.workflow_node_id) ?? []
    nodeDispatches.push({
      artifact_id: dispatch.artifactID,
      dispatch_id: dispatch.payload.dispatch_id,
      workflow_occurrence_id: dispatch.payload.workflow_occurrence_id,
      session_id: dispatch.payload.child_session_id,
      target_agent_id: dispatch.payload.target_agent_id,
      delivery_slice_revision_ids: dispatch.payload.delivery_slice_revision_ids,
      session_status: status
        ? {
            type: status.status.type,
            ...(status.status.reason ? { reason: status.status.reason } : {}),
            ...(status.status.error ? { error: status.status.error } : {}),
            ...(status.status.summary ? { summary: status.status.summary } : {}),
            emitted_at: status.emittedAt,
          }
        : null,
      settlement: settlement
        ? { artifact_id: settlement.artifactID, outcome_kind: settlement.payload.outcome.kind }
        : null,
      terminal_success: settlement?.payload.outcome.kind === "terminal_success",
    })
    dispatchesByNodeID.set(dispatch.payload.workflow_node_id, nodeDispatches)
  }

  const terminalSuccessNodeIDs = new Set(
    binding.nodes
      .filter((node) => dispatchesByNodeID.get(node.node_id)?.some((dispatch) => dispatch.terminal_success))
      .map((node) => node.node_id),
  )
  const nodes = binding.nodes.map((node): TaskWorkflowNodeDesc => {
    const nodeDispatches = dispatchesByNodeID.get(node.node_id) ?? []
    return {
      node_id: node.node_id,
      agent_id: node.agent_id,
      depends_on: node.depends_on,
      dispatches: nodeDispatches,
      terminal_success: terminalSuccessNodeIDs.has(node.node_id),
      terminal_success_predecessor_ids: node.depends_on.filter((nodeID) => terminalSuccessNodeIDs.has(nodeID)),
      occurrence_status: nodeDispatches.length > 0 ? "occurrence_committed" : "occurrence_not_committed",
    }
  })
  return {
    binding,
    nodes,
    frontier_node_ids: nodes
      .filter(
        (node) =>
          node.dispatches.length === 0 &&
          node.depends_on.every((predecessorID) => terminalSuccessNodeIDs.has(predecessorID)),
      )
      .map((node) => node.node_id),
  }
}

// ---------------------------------------------------------------------------
// Goal description
// ---------------------------------------------------------------------------

export function describeGoal(
  goal: GoalRow,
  identity: Pick<
    import("./delivery-slice").DeliverySliceRevisionIdentity,
    "deliverySliceID" | "deliverySliceRevisionID" | "revision" | "priorRevisionID"
  >,
): GoalDesc {
  return {
    id: goal.id,
    delivery_slice_id: identity.deliverySliceID,
    delivery_slice_revision_id: identity.deliverySliceRevisionID,
    delivery_slice_revision: identity.revision,
    prior_delivery_slice_revision_id: identity.priorRevisionID ?? undefined,
    title: goal.title,
    kind: goal.kind ?? "feature",
    priority: goal.priority as "blocking" | "advisory",
    objective: goal.objective,
    acceptance_summary: renderSpecsAsText(
      parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal ${goal.id}.acceptance_specs`),
    ).slice(0, 300),
    owned_paths: (goal.owned_paths ?? []) as string[],
    supersede_of: goal.supersede_of ?? undefined,
    requirement_set_artifact_id: goal.requirement_set_artifact_id ?? undefined,
    requirement_set_artifact_revision: goal.requirement_set_artifact_revision ?? undefined,
    requirement_set_artifact_sha256: goal.requirement_set_artifact_sha256 ?? undefined,
    contract_graph_artifact_id: goal.contract_graph_artifact_id ?? undefined,
    contract_graph_artifact_revision: goal.contract_graph_artifact_revision ?? undefined,
    contract_graph_artifact_sha256: goal.contract_graph_artifact_sha256 ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Task description
// ---------------------------------------------------------------------------

export async function describeTask(taskID: string): Promise<TaskDesc> {
  const task = findTask(taskID)
  if (!task) {
    throw new Error(`describeTask: task ${taskID} not found`)
  }
  return describeTaskFromRow(task)
}

async function describeTaskFromRow(task: TaskRow): Promise<TaskDesc> {
  // Rewind is conversation visibility only. Current Delivery Slice contracts
  // and immutable Task workflow facts remain authoritative on every wake.
  const rewindCursor = taskRewindCursor(task.id)

  const goalContexts = resolveCurrentGoalMembershipContext(task.id).goals
  const currentProcessPromptOwners = currentProcessPromptOwnersForTask(task.id)
  const goals = goalContexts.map((context) => describeGoal(context.goal, context))
  const workflowExecution = describeTaskWorkflowExecution(task)

  const maxExecutorGroups = await effectiveMaxAgentParallelism(task)

  // Surface recent orchestrator stream errors so the LLM can read them on
  // the next user-driven wake and decide retry / restart / fail. Runtime
  // restart must not auto-wake active tasks: the overlay restores the task
  // view and waits for a real operator message.
  const streamErrorFloor = task.time_started
  const infrastructureErrorRows = listTaskInfrastructureErrorArtifacts(
    task.id,
    streamErrorFloor,
    INFRASTRUCTURE_FAILURE_PROMPT_CAP,
  )
  const recentInfrastructureFailures: InfrastructureFailureDesc[] = infrastructureErrorRows.map((row) => {
    const payload = (row.payload ?? {}) as {
      component?: string
      operation?: string
      reason?: string
      errorName?: string
      sessionID?: string
      context?: unknown
    }
    const isRecoveryOccurrence =
      payload.operation === "handoff-process-owned-task-execution" ||
      payload.operation === "recover-interrupted-task-execution"
    const recovery = isRecoveryOccurrence ? describeProcessRecoveryFact(task.id, row.id) : undefined
    return {
      artifact_id: row.id,
      time_created: row.time_created,
      component: typeof payload.component === "string" ? payload.component : row.label,
      operation: typeof payload.operation === "string" ? payload.operation : "",
      reason: typeof payload.reason === "string" ? payload.reason : "",
      error_name: typeof payload.errorName === "string" ? payload.errorName : undefined,
      session_id: typeof payload.sessionID === "string" ? payload.sessionID : undefined,
      ...(recovery ? { recovery } : {}),
    }
  })
  const streamErrorRows = listOrchestratorStreamErrorArtifacts(task.id, streamErrorFloor, STREAM_FAILURE_PROMPT_CAP)
  const recentStreamFailures: StreamFailureDesc[] = streamErrorRows.map((row) => {
    const payload = (row.payload ?? {}) as {
      reason?: string
      errorName?: string
      sessionID?: string
    }
    return {
      artifact_id: row.id,
      time_created: row.time_created,
      reason: typeof payload.reason === "string" ? payload.reason : "",
      error_name: typeof payload.errorName === "string" ? payload.errorName : undefined,
      session_id: typeof payload.sessionID === "string" ? payload.sessionID : undefined,
    }
  })
  const toolExecuteRows = listToolExecuteErrorArtifacts(task.id, streamErrorFloor, TOOL_EXECUTE_FAILURE_PROMPT_CAP)
  const recentToolExecuteFailures: ToolExecuteFailureDesc[] = toolExecuteRows.map((row) => {
    const payload = (row.payload ?? {}) as {
      sessionID?: string
      messageID?: string
      partID?: string
      toolName?: string
      callID?: string
      failure?: unknown
    }
    const parsedFailure = ToolFailureCause.safeParse(payload.failure)
    return {
      artifact_id: row.id,
      time_created: row.time_created,
      session_id: typeof payload.sessionID === "string" ? payload.sessionID : undefined,
      message_id: typeof payload.messageID === "string" ? payload.messageID : undefined,
      part_id: typeof payload.partID === "string" ? payload.partID : undefined,
      tool_name: typeof payload.toolName === "string" ? payload.toolName : "",
      call_id: typeof payload.callID === "string" ? payload.callID : "",
      reason: parsedFailure.success ? renderToolFailureCause(parsedFailure.data) : "",
    }
  })

  const agentFailureFloor = task.time_started
  const recentAgentFailures: AgentFailureDesc[] = createDecisionLog(task.id)
    .readByPhase("agent_error")
    .filter((entry) => entry.timeCreated >= agentFailureFloor)
    .slice(-AGENT_FAILURE_PROMPT_CAP)
    .reverse()
    .map((entry) => ({
      decision_id: entry.id,
      time_created: entry.timeCreated,
      key: entry.key,
      reason: entry.value,
      goal_id: entry.goalID ?? undefined,
    }))
  const allPendingAgentCoordination = listPendingAgentCoordinationRequests(task.id)
  const pendingAgentCoordination: AgentCoordinationRequestDesc[] = allPendingAgentCoordination
    .slice(0, AGENT_COORDINATION_PROMPT_CAP)
    .map((row) => ({
      request_id: row.payload.request_id,
      time_created: row.timeCreated,
      session_id: row.payload.session_id,
      agent: row.payload.agent,
      origin: row.payload.origin,
      message_id: row.payload.message_id,
      operator_steer_id: row.payload.operator_steer_id,
      operator_message: row.payload.operator_message,
      delivery_slice_subject: row.payload.delivery_slice_subject,
      blocking: row.payload.blocking,
      severity: row.payload.severity,
      summary: row.payload.summary,
      details: row.payload.details,
      requested_decision: row.payload.requested_decision,
      evidence_locators: row.payload.evidence_locators ?? [],
      last_failed_response_id: row.payload.last_failed_response_id,
      last_failed_action_id: row.payload.last_failed_action_id,
      last_action_error: row.payload.last_action_error,
      last_action_failed_at: row.payload.last_action_failed_at,
    }))
  const recentMailboxMessages = listRecentTaskMailboxMessages(task.id)
  // Validate the full A2A mailbox while building the orchestrator view. Response rows are
  // not prompt material, but malformed durable responses must fail loudly instead of hiding.
  listAgentCoordinationResponses(task.id)
  const openToolCallsWithoutCurrentOwner = listOpenToolCallsWithoutCurrentOwner(task)
  const completedToolCallRefs = listCompletedToolCallRefs(task)
  const agentMessageRefs = listAgentMessageRefs(task)
  const taskScheduledWaits = describeTaskScheduledWaits(task.id, task.time_started)

  return {
    id: task.id,
    title: task.title,
    status: deriveTaskStatus(task),
    source: task.source,
    request: task.request,
    error: task.error ?? undefined,
    clarifications: clarificationTranscriptSection(task.id) || undefined,
    goals,
    ...(workflowExecution ? { workflow_execution: workflowExecution } : {}),
    current_process_prompt_owners: currentProcessPromptOwners.length > 0 ? currentProcessPromptOwners : undefined,
    budget: {
      max_executor_groups: maxExecutorGroups,
    },
    recent_infrastructure_failures: recentInfrastructureFailures.length > 0 ? recentInfrastructureFailures : undefined,
    recent_stream_failures: recentStreamFailures.length > 0 ? recentStreamFailures : undefined,
    recent_tool_execute_failures: recentToolExecuteFailures.length > 0 ? recentToolExecuteFailures : undefined,
    open_tool_calls_without_current_owner:
      openToolCallsWithoutCurrentOwner.length > 0 ? openToolCallsWithoutCurrentOwner : undefined,
    agent_message_refs: agentMessageRefs.length > 0 ? agentMessageRefs : undefined,
    completed_tool_call_refs: completedToolCallRefs.length > 0 ? completedToolCallRefs : undefined,
    task_scheduled_waits: taskScheduledWaits.length > 0 ? taskScheduledWaits : undefined,
    recent_agent_failures: recentAgentFailures.length > 0 ? recentAgentFailures : undefined,
    pending_agent_coordination: pendingAgentCoordination.length > 0 ? pendingAgentCoordination : undefined,
    pending_agent_coordination_total:
      allPendingAgentCoordination.length > 0 ? allPendingAgentCoordination.length : undefined,
    pending_agent_coordination_truncated:
      allPendingAgentCoordination.length > pendingAgentCoordination.length ? true : undefined,
    recent_mailbox_messages: recentMailboxMessages.length > 0 ? recentMailboxMessages : undefined,
  }
}

// ---------------------------------------------------------------------------
// Markdown rendering — the orchestrator prompt consumes this directly.
// ---------------------------------------------------------------------------

export function renderGoal(g: GoalDesc): string[] {
  const lines: string[] = []
  lines.push(`### Goal ${g.id}: ${g.title} [${g.priority}, ${g.kind}]`)
  lines.push(`Objective: ${g.objective}`)
  if (g.owned_paths.length > 0) lines.push(`Responsibility paths: ${g.owned_paths.join(", ")}`)
  if (g.acceptance_summary) lines.push(`Acceptance (first 300): ${g.acceptance_summary}`)
  lines.push("State: current_contract_revision")
  lines.push(
    `Delivery Slice identity: stable=${g.delivery_slice_id} | revision_id=${g.delivery_slice_revision_id} | revision=${g.delivery_slice_revision} | prior_revision=${g.prior_delivery_slice_revision_id ?? "none"}`,
  )
  const revisionParts = [
    g.supersede_of ? `supersedes=${g.supersede_of}` : "root_revision",
    g.requirement_set_artifact_id
      ? `requirement_set=${g.requirement_set_artifact_id}@${g.requirement_set_artifact_revision}`
      : undefined,
    g.contract_graph_artifact_id
      ? `contract_graph=${g.contract_graph_artifact_id}@${g.contract_graph_artifact_revision}`
      : undefined,
  ].filter((part): part is string => Boolean(part))
  lines.push(`Delivery Slice revision: ${revisionParts.join(" | ")}`)

  return lines
}

function renderTaskWorkflowExecution(execution: TaskWorkflowExecutionDesc | undefined): string[] {
  if (!execution) return []
  const lines = ["## Immutable Task workflow execution evidence"]
  lines.push(`- binding=${JSON.stringify(execution.binding)}`)
  for (const node of execution.nodes) {
    lines.push(
      `- node=${node.node_id}; agent=${node.agent_id}; depends_on=${node.depends_on.join(",") || "(none)"}; ` +
        `occurrence_status=${node.occurrence_status}; terminal_success=${node.terminal_success}; ` +
        `terminal_success_predecessors=${node.terminal_success_predecessor_ids.join(",") || "(none)"}`,
    )
    for (const dispatch of node.dispatches) {
      const status = dispatch.session_status
        ? `${dispatch.session_status.type}${dispatch.session_status.reason ? `/${dispatch.session_status.reason}` : ""}`
        : "unreported"
      lines.push(
        `  - dispatch_artifact=${dispatch.artifact_id}; dispatch=${dispatch.dispatch_id}; session=${dispatch.session_id}; ` +
          `target=${dispatch.target_agent_id}; session_status=${status}; settlement=${dispatch.settlement?.outcome_kind ?? "unsettled"}; terminal_success=${dispatch.terminal_success}; ` +
          `delivery_slice_subjects=${dispatch.delivery_slice_revision_ids.join(",") || "(none)"}`,
      )
    }
  }
  lines.push(`- dependency_ready_undispatched_frontier=${execution.frontier_node_ids.join(",") || "(none)"}`)
  lines.push(
    "A frontier node has occurrence_status=occurrence_not_committed and its next dispatch uses turn.kind=initial. A physical created-only Session is audit evidence, not continuation authority. A node with occurrence_status=occurrence_committed may be continued only through an exact dispatch ID listed above.",
  )
  lines.push(
    "This is a natural-wake projection of immutable dispatch lineage and real Session observations. It is evidence for Orchestrator judgment, not persisted workflow step state, a queue, an admission rule, or a Host scheduling gate.",
  )
  return lines
}

export function renderTaskScheduledWaits(waits: TaskScheduledWaitDesc[] | undefined): string[] {
  if (!waits || waits.length === 0) return []
  const lines: string[] = []
  lines.push(`## Scheduled task waits (${waits.length})`)
  for (const wait of waits) {
    const state = wait.enabled ? "pending" : wait.last_error ? "failed" : "fired"
    const due = new Date(wait.next_run).toISOString()
    const lastRun = wait.last_run ? ` last_run=${new Date(wait.last_run).toISOString()}` : ""
    const error = wait.last_error ? ` error=${truncate(wait.last_error, 180)}` : ""
    lines.push(
      `- ${state} job=${wait.job_id} name=${wait.name} due=${due}${lastRun} delay=${wait.expression} failures=${wait.failure_count}${error}: ${truncate(wait.reason, 240)}`,
    )
  }
  lines.push(
    `These entries are durable scheduled waits created by \`wait\`. ` +
      `A pending entry is the future wake source; a fired or failed entry is current evidence. ` +
      `Do not use \`wait\` to poll live child agents, sibling goals, or ordinary in-task state.`,
  )
  return lines
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + "…"
}

function renderCompletedSpecialistMessageRefs(refs: AgentMessageRefDesc[] | undefined): string[] {
  if (!refs || refs.length === 0) return []

  const groups = new Map<
    string,
    {
      session_id: string
      session_kind: string
      agent_id: string
      messages: AgentMessageRefDesc[]
    }
  >()
  for (const ref of refs) {
    const key = `${ref.session_id}\u0000${ref.session_kind}\u0000${ref.agent_id}`
    const group = groups.get(key)
    if (group) {
      group.messages.push(ref)
      continue
    }
    groups.set(key, {
      session_id: ref.session_id,
      session_kind: ref.session_kind,
      agent_id: ref.agent_id,
      messages: [ref],
    })
  }

  const lines = [`## Completed specialist message refs (${refs.length} across ${groups.size} session/agent groups)`]
  for (const group of groups.values()) {
    lines.push(
      `- agent=${group.agent_id} session=${group.session_id} kind=${group.session_kind} ` +
        `messages_oldest_to_newest=${group.messages.map((message) => message.message_id).join(",")}`,
    )
    for (const message of group.messages) {
      if (!message.worker_turn_descriptor_error) continue
      lines.push(
        `  - message=${message.message_id} descriptor_error=${truncate(message.worker_turn_descriptor_error, 240)}`,
      )
    }
  }
  lines.push(
    `These are stable references to real completed assistant messages, grouped only to avoid repeating shared ` +
      `Session identity. Every exact message ref remains listed in durable order. Use read_agent_message with the ` +
      `group's session ref and an exact message ref when text or tool facts matter.`,
  )
  return lines
}

function renderOrphanedCompletedToolCallRefs(input: {
  messageRefs: AgentMessageRefDesc[] | undefined
  toolRefs: CompletedToolCallRefDesc[] | undefined
}): string[] {
  if (!input.toolRefs || input.toolRefs.length === 0) return []
  const completedMessages = new Set(
    (input.messageRefs ?? []).map((message) => `${message.session_id}\u0000${message.message_id}`),
  )
  const orphaned = input.toolRefs.filter((ref) => !completedMessages.has(`${ref.session_id}\u0000${ref.message_id}`))
  if (orphaned.length === 0) return []

  const groups = new Map<
    string,
    {
      session_id: string
      session_kind: string
      message_id: string
      refs: CompletedToolCallRefDesc[]
    }
  >()
  for (const ref of orphaned) {
    const key = `${ref.session_id}\u0000${ref.session_kind}\u0000${ref.message_id}`
    const group = groups.get(key)
    if (group) {
      group.refs.push(ref)
      continue
    }
    groups.set(key, {
      session_id: ref.session_id,
      session_kind: ref.session_kind,
      message_id: ref.message_id,
      refs: [ref],
    })
  }

  const lines = [
    `## Completed specialist tool-call refs without a projected completed assistant-message ref ` +
      `(${orphaned.length} of ${input.toolRefs.length} completed tool refs)`,
  ]
  for (const group of groups.values()) {
    lines.push(
      `- session=${group.session_id} kind=${group.session_kind} message=${group.message_id} tools=` +
        group.refs.map((ref) => `${ref.tool_name}:call=${ref.call_id}:part=${ref.part_id}`).join(","),
    )
  }
  lines.push(
    `These tool results have no matching entry in the completed assistant-message projection above. The enclosing ` +
      `message may be incomplete, or it may be completed but lack the parent/agent identity required for that ` +
      `projection. Use read_agent_message with the exact session/message refs when payload matters. The remaining ` +
      `${input.toolRefs.length - orphaned.length} completed tool refs belong to completed messages listed above and ` +
      `are returned by that same exact-message reader. Missing, partial, or conflicting registrations remain evidence ` +
      `for natural Orchestrator judgment; they do not imply business success.`,
  )
  return lines
}

/**
 * Render a TaskDesc as markdown suitable for direct injection into the
 * orchestrator's system prompt. LLM reads this instead of querying piecemeal.
 */
export function renderTaskDescription(desc: TaskDesc): string {
  const lines: string[] = []
  lines.push(`## Task: ${desc.title} (${desc.status})`)
  lines.push(`Task source: ${desc.source}`)
  lines.push(renderUserRequestSection({ heading: "## Request", request: desc.request, taskID: desc.id }))
  if (desc.current_process_prompt_owners && desc.current_process_prompt_owners.length > 0) {
    lines.push("## Current-process prompt owners")
    for (const owner of desc.current_process_prompt_owners) {
      // Keep raw activity milliseconds out of this prefix: they advance every Provider step,
      // while lifecycle is the execution signal the Orchestrator is instructed to use.
      lines.push(`- session=${owner.session_id}; kind=${owner.session_kind}; lifecycle=${owner.lifecycle_status}`)
    }
    lines.push(
      "These are current-now ephemeral prompt-controller facts from this exact Host process, including when the durable view is rewound. Ownership alone does not mean a worker is executing: use the lifecycle field. These observations do not mutate Delivery Slice contracts or Task lifecycle.",
    )
  }
  lines.push("## Durable evidence")
  lines.push(
    "The Task Artifact Catalog is the only durable evidence inventory. Use artifact_search to enumerate it, pass artifact_locator_ref to artifact_read until complete, and pass artifact_read_ref to artifact_select for each semantic source of a typed output. Complete but unselected reads remain observations; zero selections are valid. This Task description does not copy Artifact IDs, payload summaries, paths, or domain inventories.",
  )
  if (desc.error) lines.push(`Error: ${desc.error}`)
  lines.push(
    `Runtime facts: agent_parallelism=${desc.budget.max_executor_groups}.`,
  )

  const workflowExecutionLines = renderTaskWorkflowExecution(desc.workflow_execution)
  if (workflowExecutionLines.length > 0) {
    lines.push("")
    lines.push(...workflowExecutionLines)
  }

  const taskScheduledWaitLines = renderTaskScheduledWaits(desc.task_scheduled_waits)
  if (taskScheduledWaitLines.length > 0) {
    lines.push("")
    lines.push(...taskScheduledWaitLines)
  }

  if (desc.clarifications) {
    lines.push("")
    lines.push(desc.clarifications)
  }

  if (desc.recent_infrastructure_failures && desc.recent_infrastructure_failures.length > 0) {
    lines.push("")
    lines.push(`## Recent infrastructure failures (${desc.recent_infrastructure_failures.length})`)
    for (const failure of desc.recent_infrastructure_failures) {
      const ts = new Date(failure.time_created).toISOString()
      const tag = failure.error_name ? `[${failure.error_name}] ` : ""
      lines.push(
        `- ${ts} component=${failure.component} operation=${failure.operation} ${tag}${truncate(failure.reason, 240)}`,
      )
      if (failure.recovery) {
        lines.push(
          `  physical_evidence=${JSON.stringify(failure.recovery.physical_evidence)}; affected_subjects=${failure.recovery.affected_subjects
            .map((subject) =>
              subject.kind !== "affected_created_session"
                ? `${subject.session_id}/${subject.input_message_id}`
                : `${subject.session_id}/created`,
            )
            .join(", ")}`,
        )
      }
    }
    lines.push(
      `These are Host/runtime/tooling facts. They do not retroactively change any expert report, Session terminal fact, ` +
        `Delivery Slice review, or Task business conclusion. Continue from existing facts. Resolve command-side infrastructure directly, then inspect immutable dispatch lineage. ` +
        `A created-only Session has occurrence_not_committed and does not block the dependency-ready node's one initial dispatch; an occurrence_committed failure must continue through its exact listed dispatch ID. Build cannot replace ` +
        `another mandatory node's terminal-success evidence. Keep the fixed Squad and Phase; do not create a correction Task.`,
    )
  }

  lines.push("")
  if (desc.goals.length === 0) {
    lines.push("## Goals (none authored yet)")
  } else {
    lines.push(`## Goals (${desc.goals.length})`)
    for (const g of desc.goals) {
      lines.push("")
      lines.push(...renderGoal(g))
    }
  }

  if (desc.recent_stream_failures && desc.recent_stream_failures.length > 0) {
    lines.push("")
    lines.push(`## Recent orchestrator stream failures (${desc.recent_stream_failures.length})`)
    for (const f of desc.recent_stream_failures) {
      const ts = new Date(f.time_created).toISOString()
      const tag = f.error_name ? `[${f.error_name}] ` : ""
      lines.push(`- ${ts} ${tag}${truncate(f.reason, 240)}`)
    }
    lines.push(
      `These entries are upstream LLM-call failures that aborted a wake before any decision ` +
        `was made. They are physical interruption evidence, not a Task business rejection. On this wake, continue from the exact durable facts, ` +
        `resolve a recoverable runtime or provider choice autonomously when current configuration permits, and use \`question\` only for an ` +
        `operator-owned key, provider installation, or external-authority choice. Keep the current Phase open or blocked on the named external event.`,
    )
  }

  if (desc.pending_agent_coordination && desc.pending_agent_coordination.length > 0) {
    lines.push("")
    const total = desc.pending_agent_coordination_total ?? desc.pending_agent_coordination.length
    lines.push(
      `## Pending agent coordination requests (${desc.pending_agent_coordination.length} displayed of ${total})`,
    )
    if (desc.pending_agent_coordination_truncated) {
      lines.push(
        `This projection is truncated. Use artifact_search with kind=agent_coordination_request, then ` +
          `artifact_read every matching exact locator to enumerate the complete durable set before concluding ` +
          `that no additional request needs a decision.`,
      )
    }
    for (const request of desc.pending_agent_coordination) {
      const ts = new Date(request.time_created).toISOString()
      const slice = request.delivery_slice_subject ? ` delivery_slice=${request.delivery_slice_subject}` : ""
      const refs =
        request.evidence_locators.length > 0
          ? ` locators=${request.evidence_locators.map((locator) => JSON.stringify(locator)).join(",")}`
          : ""
      const origin = request.origin
      const messageID = request.message_id ? ` message=${request.message_id}` : ""
      lines.push(
        `- ${ts} request=${request.request_id} origin=${origin} agent=${request.agent} session=${request.session_id}${messageID}${slice} ` +
          `blocking=${request.blocking} severity=${request.severity}: ${truncate(request.summary, 220)}`,
      )
      if (request.operator_message) {
        lines.push(`  operator_message: ${truncate(request.operator_message, 420)}`)
      }
      lines.push(`  requested_decision: ${truncate(request.requested_decision, 240)}`)
      lines.push(`  details: ${truncate(request.details, 420)}${refs}`)
      if (request.last_failed_action_id || request.last_action_error) {
        const failedAt = request.last_action_failed_at
          ? ` at=${new Date(request.last_action_failed_at).toISOString()}`
          : ""
        lines.push(
          `  last_failed_action: response=${request.last_failed_response_id ?? "(unknown)"} action=${request.last_failed_action_id ?? "(unknown)"}${failedAt} error=${truncate(request.last_action_error ?? "(missing error)", 240)}`,
        )
      }
    }
    lines.push(
      `These requests are durable worker/operator-to-orchestrator coordination messages. Answer a request with ` +
        `respond_agent_coordination(request_id=...) or choose another visible lifecycle action. ` +
        `Do not use private steering without a request id.`,
    )
  }

  if (desc.recent_mailbox_messages && desc.recent_mailbox_messages.length > 0) {
    lines.push("")
    lines.push(`## Recent squad mailbox messages (${desc.recent_mailbox_messages.length})`)
    for (const message of desc.recent_mailbox_messages) {
      const ts = new Date(message.createdAt).toISOString()
      const progress = message.progress === undefined ? "" : ` progress=${Math.round(message.progress * 100)}%`
      const refs =
        message.evidenceLocators.length > 0
          ? ` locators=${message.evidenceLocators.map((locator) => JSON.stringify(locator)).join(",")}`
          : ""
      lines.push(
        `- ${ts} message=${message.id} category=${message.category} attention=${message.attention} ` +
          `squad=${message.expertSquadID} agent=${message.sourceAgentID} session=${message.sessionID}${progress}: ` +
          `${truncate(message.subject, 220)}`,
      )
      lines.push(`  body: ${truncate(message.body, 420)}${refs}`)
    }
    lines.push(
      `These are ordinary visible squad updates. Read them as execution evidence on this natural wake. ` +
        `They do not require a response unless their content warrants a visible scheduler action; explicit pending decisions remain under agent coordination requests.`,
    )
  }

  if (desc.open_tool_calls_without_current_owner && desc.open_tool_calls_without_current_owner.length > 0) {
    lines.push("")
    lines.push(
      `## Open tool calls without current process owner (${desc.open_tool_calls_without_current_owner.length})`,
    )
    for (const f of desc.open_tool_calls_without_current_owner) {
      const ts = new Date(f.time_created).toISOString()
      lines.push(
        `- ${ts} ${f.tool_name} status=${f.status} call=${f.call_id} session=${f.session_id} kind=${f.session_kind} message=${f.message_id} part=${f.part_id}`,
      )
    }
    lines.push(
      `Each entry is a persisted assistant tool call in this task's session tree with no completion/error result ` +
        `and no current-process session owner. Treat it as execution evidence from a previous interrupted wake; ` +
        `inspect the immutable workflow execution evidence before acting. Settle the physical interruption, then use initial for a dependency-ready occurrence_not_committed node or the exact dispatch ID for an occurrence_committed continuation. Preserve the fixed Squad and Phase; ` +
        `ask the operator only for external authority, destructive approval, or an irreducible product decision.`,
    )
  }

  const completedMessageRefLines = renderCompletedSpecialistMessageRefs(desc.agent_message_refs)
  if (completedMessageRefLines.length > 0) {
    lines.push("")
    lines.push(...completedMessageRefLines)
  }

  const orphanedToolRefLines = renderOrphanedCompletedToolCallRefs({
    messageRefs: desc.agent_message_refs,
    toolRefs: desc.completed_tool_call_refs,
  })
  if (orphanedToolRefLines.length > 0) {
    lines.push("")
    lines.push(...orphanedToolRefLines)
  }

  if (desc.recent_agent_failures && desc.recent_agent_failures.length > 0) {
    lines.push("")
    lines.push(`## Recent agent session failures (${desc.recent_agent_failures.length})`)
    for (const f of desc.recent_agent_failures) {
      const ts = new Date(f.time_created).toISOString()
      const goal = f.goal_id ? ` goal=${f.goal_id}` : ""
      lines.push(`- ${ts} ${f.key}${goal}: ${truncate(f.reason, 360)}`)
    }
    lines.push(
      `These entries are failed agent/tool sessions made visible to this prompt. ` +
        `Treat quota/network/provider failures as failed physical child Sessions of the current Task; an attached Delivery Slice revision is only an evidence subject. ` +
        `Inspect immutable dispatch lineage: use initial when the affected dependency-ready node is occurrence_not_committed, and continue only an occurrence_committed node through its exact dispatch ID. A mandatory non-Build node's terminal-success evidence and Artifact cannot be transferred to Build. ` +
        `Do not create a new Task or infer a fresh Task start merely because the latest wake repeats the original request.`,
    )
  }

  if (desc.recent_tool_execute_failures && desc.recent_tool_execute_failures.length > 0) {
    lines.push("")
    lines.push(`## Recent tool execution failures (${desc.recent_tool_execute_failures.length})`)
    for (const f of desc.recent_tool_execute_failures) {
      const ts = new Date(f.time_created).toISOString()
      const session = f.session_id ? ` session=${f.session_id}` : ""
      lines.push(`- ${ts} ${f.tool_name} call=${f.call_id}${session}: ${truncate(f.reason, 360)}`)
    }
    lines.push(
      `These entries are persisted tool-call failures with the original ToolFailureCause. ` +
        `Use them as audit evidence. Repair command-side failures directly, then use initial for an affected dependency-ready occurrence_not_committed node or the exact dispatch ID for an occurrence_committed continuation. Build cannot replace another mandatory node's evidence contract. ` +
        `Use a terminal lifecycle decision only for a proven external, destructive, fixed-Squad-authority, or irreducible product-decision blocker.`,
    )
  }

  return lines.join("\n")
}
