import { EngineTaskTable } from "@/engine/engine.sql"
import { sessionParentID, taskIDForSession } from "@/engine/task-session-lineage"
import { PersistedWorkerTurnDescriptorIncompatibleError, WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { persistedSessionAgentID } from "@/agent/persisted-session-identity"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { MessageTable, type SessionKind } from "@/session/session.sql"
import { Database, eq, sql } from "@/storage/db"
import { timelineOrderKey } from "@/timeline/order"

export interface ConversationAgentSessionLedgerRow {
  sessionID: string
  orderKey: string
  stage: SessionKind
  title?: string
  parentSessionID?: string
  metadata?: Record<string, unknown>
  agentID: string
  timeCreated: number
  timeUpdated: number
  latestStatus?: ConversationAgentSessionLedgerStatus
  latestStatusEmittedAt?: number
  latestInputMessageID?: string
  runtimeContractError?: {
    code: "worker_turn_descriptor_incompatible"
    descriptorID: string
    message: string
  }
}

export interface ConversationAgentSessionLedgerStatus {
  type: string
  reason?: string
  error?: string
  summary?: string
}

export interface AgentInvocationNode {
  sessionID: string
  orderKey: string
  agent: string
  kind: SessionKind
  title?: string
  parentSessionID?: string
  parentAgentSessionID?: string
  time: {
    created: number
    updated: number
  }
}

export interface AgentExecutionLifecycleEvent {
  eventID: string
  sequence: number
  status: ConversationAgentSessionLedgerStatus
  emittedAt: number
}

export interface AgentExecutionOccurrence {
  inputMessageID: string
  sessionID: string
  agent: string
  kind: SessionKind
  preparedAt?: number
  events: AgentExecutionLifecycleEvent[]
  latest?: AgentExecutionLifecycleEvent
}

export interface TaskExecutionProjection {
  taskID: string
  occurrences: AgentExecutionOccurrence[]
}

export interface AgentInvocationEdge {
  fromSessionID: string
  toSessionID: string
  relation: "agent_call"
  viaSessionIDs?: string[]
}

export interface SessionInvocationTopology {
  taskID: string
  rootSessionID?: string
  nodes: AgentInvocationNode[]
  edges: AgentInvocationEdge[]
  topLevelSessionIDs: string[]
}

export function matchesTaskEvent(
  event: { type: string; properties: Record<string, unknown> },
  taskID: string,
  sessionID?: string,
) {
  if (event.properties?.taskID === taskID) return true
  const evtSession = eventSession(event.properties)
  if (!evtSession) return false
  if (evtSession === sessionID) return true
  return taskIDForSession(evtSession) === taskID
}

/**
 * Latest `time_updated` watermark across every message and part in any
 * session belonging to `taskID`'s session tree. Used by the
 * conversation-history SSE bridge to detect new writes since a polling
 * cursor; lives here (not in `routes/orchestrator`) so route handlers
 * keep their SQL discipline (no direct `Database.use` / `sql\`...\``
 * inside `routes/`).
 *
 * Returns 0 when the task has no messages/parts yet, so callers can
 * safely use it as a monotonic comparator without a special-case for
 * empty tasks.
 */
export function taskMessageWatermark(taskID: string): number {
  return taskMessageWatermarkCursor(taskID).watermark
}

export function taskMessageWatermarkCursor(taskID: string): { watermark: number; signature: string } {
  const row = Database.use((db) =>
    db.get<{ watermark: number | null }>(sql`
      WITH RECURSIVE session_tree(id) AS (
        SELECT session_id FROM engine_task WHERE id = ${taskID}
        UNION ALL
        SELECT s.id FROM session s JOIN session_tree st ON s.parent_id = st.id
      ),
      message_watermark(value) AS (
        SELECT max(m.time_updated)
        FROM message m
        JOIN session_tree st ON st.id = m.session_id
      ),
      part_watermark(value) AS (
        SELECT max(p.time_updated)
        FROM part p
        JOIN session_tree st ON st.id = p.session_id
      )
      SELECT max(value) AS watermark FROM (
        SELECT value FROM message_watermark
        UNION ALL
        SELECT value FROM part_watermark
      )
    `),
  )
  const watermark = Math.max(0, Number(row?.watermark ?? 0) || 0)
  if (watermark === 0) {
    return {
      watermark,
      signature: "0:",
    }
  }
  const members = Database.use((db) =>
    db.all<{ member: string }>(sql`
      WITH RECURSIVE session_tree(id) AS (
        SELECT session_id FROM engine_task WHERE id = ${taskID}
        UNION ALL
        SELECT s.id FROM session s JOIN session_tree st ON s.parent_id = st.id
      )
      SELECT member FROM (
        SELECT 'message:' || m.id || ':' || coalesce(cast(m.data AS TEXT), '') AS member
        FROM message m
        JOIN session_tree st ON st.id = m.session_id
        WHERE m.time_updated = ${watermark}
        UNION ALL
        SELECT 'part:' || p.id || ':' || coalesce(cast(p.data AS TEXT), '') AS member
        FROM part p
        JOIN session_tree st ON st.id = p.session_id
        WHERE p.time_updated = ${watermark}
      )
      ORDER BY member
    `),
  )
  return {
    watermark,
    signature: `${watermark}:${members.map((item) => item.member).join("|")}`,
  }
}

function toConversationAgentSessionLedgerRows(
  rows: Array<{
    sessionID: string
    stage: SessionKind
    title: string
    parentSessionID: string | null
    metadata: unknown
    timeCreated: number
    timeUpdated: number
    statusType: string | null
    statusReason: string | null
    statusError: string | null
    statusEmittedAt: number | null
    statusInputMessageID: string | null
    workerDescriptorID: string | null
    workerDescriptorAgent: string | null
    workerDescriptorHash: string | null
    workerDescriptorPayload: unknown
    messageCount: number
  }>,
): ConversationAgentSessionLedgerRow[] {
  return rows.flatMap((row) => {
    const statusType = String(row.statusType || "")
    const statusEmittedAt = Number(row.statusEmittedAt ?? 0)
    if (!statusType && row.statusEmittedAt != null) {
      throw new Error(`conversation agent ledger status event missing status.type for session ${row.sessionID}`)
    }
    if (statusType && !(statusEmittedAt > 0)) {
      throw new Error(`conversation agent ledger status event missing emitted_at for session ${row.sessionID}`)
    }
    if (statusType && !row.statusInputMessageID) {
      throw new Error(
        `conversation agent ledger status event missing input message identity for session ${row.sessionID}`,
      )
    }
    const descriptorFields = [
      row.workerDescriptorID,
      row.workerDescriptorAgent,
      row.workerDescriptorHash,
      row.workerDescriptorPayload,
    ]
    const descriptorFieldCount = descriptorFields.filter((value) => value !== null).length
    if (descriptorFieldCount !== 0 && descriptorFieldCount !== descriptorFields.length) {
      throw new Error(`conversation agent ledger has partial worker descriptor evidence for session ${row.sessionID}`)
    }
    if (
      RuntimeTemplateRegistry.isWorkerSessionKind(row.stage) &&
      descriptorFieldCount === 0 &&
      !statusType &&
      row.messageCount === 0
    ) {
      return []
    }
    let projectedIdentity
    let runtimeContractError: ConversationAgentSessionLedgerRow["runtimeContractError"]
    if (row.workerDescriptorID) {
      try {
        projectedIdentity = WorkerTurnDescriptor.parsePersisted({
          id: row.workerDescriptorID,
          agentIndex: row.workerDescriptorAgent!,
          hash: row.workerDescriptorHash!,
          payload: parseLedgerMetadata(row.workerDescriptorPayload, `worker descriptor ${row.workerDescriptorID}`),
        }).identity
      } catch (error) {
        if (!(error instanceof PersistedWorkerTurnDescriptorIncompatibleError)) throw error
        runtimeContractError = {
          code: "worker_turn_descriptor_incompatible",
          descriptorID: error.descriptorID,
          message: error.message,
        }
      }
    }
    if (projectedIdentity && projectedIdentity.sessionKind !== row.stage) {
      throw new Error(
        `conversation agent ledger worker descriptor ${row.workerDescriptorID} uses session kind ${projectedIdentity.sessionKind}, not ${row.stage}`,
      )
    }
    const metadata = parseLedgerMetadata(row.metadata, row.sessionID)
    const agentID = runtimeContractError
      ? row.workerDescriptorAgent!
      : persistedSessionAgentID({
          sessionID: row.sessionID,
          sessionKind: row.stage,
          metadata,
          projectedIdentity,
        })
    return [
      {
        sessionID: row.sessionID,
        orderKey: timelineOrderKey({
          domain: "session",
          time: row.timeCreated,
          id: row.sessionID,
        }),
        stage: row.stage,
        title: row.title,
        parentSessionID: row.parentSessionID ?? undefined,
        metadata,
        agentID,
        timeCreated: row.timeCreated,
        timeUpdated: row.timeUpdated,
        ...(statusType
          ? {
              latestStatus: {
                type: statusType,
                ...(row.statusReason ? { reason: row.statusReason } : {}),
                ...(row.statusError ? { error: row.statusError } : {}),
              },
              latestStatusEmittedAt: statusEmittedAt,
              latestInputMessageID: row.statusInputMessageID!,
            }
          : {}),
        ...(runtimeContractError ? { runtimeContractError } : {}),
      },
    ]
  })
}

function parseLedgerMetadata(input: unknown, sessionID: string): Record<string, unknown> | undefined {
  if (input == null) return undefined
  if (typeof input === "object" && !Array.isArray(input)) return input as Record<string, unknown>
  if (typeof input !== "string") {
    throw new Error(`conversation agent ledger metadata for session ${sessionID} is not an object`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch (err) {
    throw new Error(
      `conversation agent ledger metadata for session ${sessionID} is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`conversation agent ledger metadata for session ${sessionID} is not an object`)
  }
  return parsed as Record<string, unknown>
}

export function listConversationAgentSessionsForSessionTree(input: {
  sessionID: string
  projectID: string
}): ConversationAgentSessionLedgerRow[] {
  const rows = Database.use((db) =>
    db.all<{
      sessionID: string
      stage: SessionKind
      title: string
      parentSessionID: string | null
      metadata: unknown
      timeCreated: number
      timeUpdated: number
      statusType: string | null
      statusReason: string | null
      statusError: string | null
      statusEmittedAt: number | null
      statusInputMessageID: string | null
      workerDescriptorID: string | null
      workerDescriptorAgent: string | null
      workerDescriptorHash: string | null
      workerDescriptorPayload: unknown
      messageCount: number
    }>(sql`
      WITH RECURSIVE session_tree(id) AS (
        SELECT id FROM session WHERE id = ${input.sessionID} AND project_id = ${input.projectID}
        UNION ALL
        SELECT s.id
        FROM session s
        JOIN session_tree st ON s.parent_id = st.id
        WHERE s.project_id = ${input.projectID}
      )
      SELECT
        s.id AS sessionID,
        s.kind AS stage,
        s.title AS title,
        s.parent_id AS parentSessionID,
        s.metadata AS metadata,
        s.time_created AS timeCreated,
        s.time_updated AS timeUpdated,
        json_extract(pe.payload, '$.status.type') AS statusType,
        json_extract(pe.payload, '$.status.reason') AS statusReason,
        json_extract(pe.payload, '$.status.error') AS statusError,
        pe.emitted_at AS statusEmittedAt,
        json_extract(pe.payload, '$.inputMessageID') AS statusInputMessageID,
        wtd.id AS workerDescriptorID,
        wtd.agent AS workerDescriptorAgent,
        wtd.hash AS workerDescriptorHash,
        wtd.payload AS workerDescriptorPayload,
        (SELECT count(*) FROM message m WHERE m.session_id = s.id) AS messageCount
      FROM session s
      JOIN session_tree st ON st.id = s.id
      LEFT JOIN worker_turn_descriptor wtd
        ON wtd.session_id = s.id
       AND NOT EXISTS (
         SELECT 1 FROM worker_turn_descriptor wtd_newer
         WHERE wtd_newer.session_id = wtd.session_id
           AND (
             wtd_newer.time_created > wtd.time_created
             OR (
               wtd_newer.time_created = wtd.time_created
               AND wtd_newer.id > wtd.id
            )
          )
       )
      LEFT JOIN protocol_event pe
        ON pe.session_id = s.id
       AND pe.type = 'agent.execution.lifecycle'
       AND (
         wtd.id IS NULL
         OR json_extract(pe.payload, '$.inputMessageID') =
            json_extract(wtd.payload, '$.messageAuthority.user_message_id')
       )
       AND NOT EXISTS (
         SELECT 1 FROM protocol_event pe_newer
         WHERE pe_newer.session_id = pe.session_id
           AND pe_newer.type = 'agent.execution.lifecycle'
           AND (
             wtd.id IS NULL
             OR json_extract(pe_newer.payload, '$.inputMessageID') =
                json_extract(wtd.payload, '$.messageAuthority.user_message_id')
           )
           AND (
             pe_newer.emitted_at > pe.emitted_at
             OR (
               pe_newer.emitted_at = pe.emitted_at
               AND pe_newer.seq > pe.seq
             )
           )
       )
      ORDER BY s.time_created, s.id
    `),
  )
  return toConversationAgentSessionLedgerRows(rows)
}

export function listTaskConversationAgentSessions(taskID: string): ConversationAgentSessionLedgerRow[] {
  const row = Database.use((db) =>
    db
      .select({
        sessionID: EngineTaskTable.session_id,
        projectID: EngineTaskTable.project_id,
      })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, taskID))
      .get(),
  )
  if (!row) throw new Error(`conversation agent ledger task ${taskID} does not exist`)
  if (!row.sessionID) return []
  return listConversationAgentSessionsForSessionTree({
    sessionID: row.sessionID,
    projectID: row.projectID,
  })
}

const NON_AGENT_SESSION_KINDS = new Set<SessionKind>(["root", "system"])

export function isAgentInvocationSession(row: ConversationAgentSessionLedgerRow) {
  return !NON_AGENT_SESSION_KINDS.has(row.stage)
}

export function sessionInvocationTopologyFromLedger(input: {
  taskID: string
  rootSessionID?: string
  sessions: ConversationAgentSessionLedgerRow[]
}): SessionInvocationTopology {
  const ledgerByID = new Map(input.sessions.map((row) => [row.sessionID, row]))
  const includedSessionIDs = new Set(
    input.sessions.filter((row) => isAgentInvocationSession(row)).map((row) => row.sessionID),
  )
  const parentAgentBySessionID = new Map<string, string>()
  const edges: AgentInvocationEdge[] = []

  const nodes: AgentInvocationNode[] = input.sessions.flatMap((row) => {
    if (!includedSessionIDs.has(row.sessionID)) return []
    if (!row.agentID?.trim()) {
      throw new Error(`conversation agent ledger session ${row.sessionID} is missing agentID`)
    }
    return [
      {
        sessionID: row.sessionID,
        orderKey: row.orderKey,
        agent: row.agentID,
        kind: row.stage,
        title: row.title,
        parentSessionID: row.parentSessionID,
        time: {
          created: row.timeCreated,
          updated: row.timeUpdated,
        },
      },
    ]
  })

  for (const node of nodes) {
    const viaSessionIDs: string[] = []
    const visited = new Set<string>([node.sessionID])
    let parentID = node.parentSessionID
    while (parentID) {
      if (visited.has(parentID)) {
        throw new Error(`Session invocation topology detected a parent cycle at Session ${parentID}`)
      }
      visited.add(parentID)
      if (includedSessionIDs.has(parentID)) {
        parentAgentBySessionID.set(node.sessionID, parentID)
        edges.push({
          fromSessionID: parentID,
          toSessionID: node.sessionID,
          relation: "agent_call",
          ...(viaSessionIDs.length > 0 ? { viaSessionIDs } : {}),
        })
        break
      }
      viaSessionIDs.push(parentID)
      parentID = ledgerByID.get(parentID)?.parentSessionID
    }
  }

  const nodesWithParent = nodes.map((node) => {
    const parentAgentSessionID = parentAgentBySessionID.get(node.sessionID)
    return parentAgentSessionID ? { ...node, parentAgentSessionID } : node
  })

  return {
    taskID: input.taskID,
    rootSessionID: input.rootSessionID,
    nodes: nodesWithParent,
    edges,
    topLevelSessionIDs: nodesWithParent
      .filter((node) => !parentAgentBySessionID.has(node.sessionID))
      .map((node) => node.sessionID),
  }
}

export function taskExecutionProjectionForTask(taskID: string): TaskExecutionProjection {
  const sessions = listTaskConversationAgentSessions(taskID)
  const sessionsByID = new Map(sessions.map((session) => [session.sessionID, session]))
  const rows = Database.use((db) =>
    db.all<{
      eventID: string
      sessionID: string
      inputMessageID: string | null
      statusType: string | null
      statusReason: string | null
      statusError: string | null
      emittedAt: number
      sequence: number
    }>(sql`
      SELECT
        id AS eventID,
        session_id AS sessionID,
        json_extract(payload, '$.inputMessageID') AS inputMessageID,
        json_extract(payload, '$.status.type') AS statusType,
        json_extract(payload, '$.status.reason') AS statusReason,
        json_extract(payload, '$.status.error') AS statusError,
        emitted_at AS emittedAt
        , seq AS sequence
      FROM protocol_event
      WHERE task_id = ${taskID}
        AND type = 'agent.execution.lifecycle'
      ORDER BY emitted_at, seq
    `),
  )
  const occurrences = new Map<string, AgentExecutionOccurrence>()
  for (const descriptor of WorkerTurnDescriptor.listForTask(taskID)) {
    const inputMessageID = descriptor.payload.messageAuthority.user_message_id
    const session = sessionsByID.get(descriptor.sessionID)
    if (!session || !isAgentInvocationSession(session)) {
      throw new Error(`Task ${taskID} worker descriptor ${descriptor.id} has no Agent Session topology`)
    }
    const inputMessage = Database.use((db) =>
      db
        .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
        .from(MessageTable)
        .where(eq(MessageTable.id, inputMessageID))
        .get(),
    )
    if (!inputMessage || inputMessage.sessionID !== descriptor.sessionID || inputMessage.data.role !== "user") {
      throw new Error(`Task ${taskID} worker descriptor ${descriptor.id} does not reference its durable user message`)
    }
    const current = occurrences.get(inputMessageID)
    if (current && current.sessionID !== descriptor.sessionID) {
      throw new Error(`Task ${taskID} input message ${inputMessageID} spans multiple Sessions`)
    }
    occurrences.set(inputMessageID, {
      inputMessageID,
      sessionID: descriptor.sessionID,
      agent: descriptor.payload.identity.agentID,
      kind: descriptor.payload.identity.sessionKind,
      preparedAt: descriptor.time.created,
      events: current?.events ?? [],
      latest: current?.latest,
    })
  }
  for (const row of rows) {
    const session = sessionsByID.get(row.sessionID)
    if (!session || !isAgentInvocationSession(session)) {
      throw new Error(`Task ${taskID} execution event ${row.eventID} has no Agent Session topology`)
    }
    if (!row.inputMessageID || !row.statusType || !(row.emittedAt > 0)) {
      throw new Error(`Task ${taskID} execution event ${row.eventID} has incomplete occurrence identity`)
    }
    const inputMessage = Database.use((db) =>
      db
        .select({ sessionID: MessageTable.session_id, data: MessageTable.data })
        .from(MessageTable)
        .where(eq(MessageTable.id, row.inputMessageID!))
        .get(),
    )
    if (!inputMessage || inputMessage.sessionID !== row.sessionID || inputMessage.data.role !== "user") {
      throw new Error(`Task ${taskID} execution event ${row.eventID} does not reference its durable user message`)
    }
    const descriptor = WorkerTurnDescriptor.findForMessageAuthority({
      sessionID: row.sessionID,
      inputMessageID: row.inputMessageID,
    })
    const event: AgentExecutionLifecycleEvent = {
      eventID: row.eventID,
      sequence: row.sequence,
      status: {
        type: row.statusType,
        ...(row.statusReason ? { reason: row.statusReason } : {}),
        ...(row.statusError ? { error: row.statusError } : {}),
      },
      emittedAt: row.emittedAt,
    }
    const current = occurrences.get(row.inputMessageID)
    if (current) {
      if (current.sessionID !== row.sessionID) {
        throw new Error(`Task ${taskID} input message ${row.inputMessageID} spans multiple Sessions`)
      }
      current.events.push(event)
      current.latest = event
      continue
    }
    occurrences.set(row.inputMessageID, {
      inputMessageID: row.inputMessageID,
      sessionID: row.sessionID,
      agent: descriptor?.payload.identity.agentID ?? session.agentID,
      kind: descriptor?.payload.identity.sessionKind ?? session.stage,
      preparedAt: descriptor?.time.created,
      events: [event],
      latest: event,
    })
  }
  return { taskID, occurrences: [...occurrences.values()] }
}

export function sessionInvocationTopologyForTask(taskID: string): SessionInvocationTopology {
  const row = Database.use((db) =>
    db
      .select({
        sessionID: EngineTaskTable.session_id,
        projectID: EngineTaskTable.project_id,
      })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, taskID))
      .get(),
  )
  if (!row) throw new Error(`Session invocation topology Task ${taskID} does not exist`)
  if (!row.sessionID) {
    return sessionInvocationTopologyFromLedger({ taskID, sessions: [] })
  }
  return sessionInvocationTopologyFromLedger({
    taskID,
    rootSessionID: row.sessionID,
    sessions: listConversationAgentSessionsForSessionTree({
      sessionID: row.sessionID,
      projectID: row.projectID,
    }),
  })
}

function eventSession(properties: Record<string, unknown>) {
  if (typeof properties.sessionID === "string") return properties.sessionID
  const info = properties.info
  if (info && typeof info === "object" && "sessionID" in info && typeof info.sessionID === "string") {
    return info.sessionID
  }
  const part = properties.part
  if (part && typeof part === "object" && "sessionID" in part && typeof part.sessionID === "string") {
    return part.sessionID
  }
  return undefined
}
