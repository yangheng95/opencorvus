import type { Database as BunDatabase } from "bun:sqlite"
import { Identifier } from "@/id/id"
import {
  DispatchCollectionMemberResultSchema,
  PersistedDispatchAgentsInputSchema,
  readDispatchCollectionProgress,
  writeDispatchCollectionProgress,
  type DispatchCollectionMemberResult,
  type PersistedDispatchAgentsInput,
} from "@/orchestrator/dispatch-agents-contract"
import { DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { parsePersistedWorkerTurnDescriptor } from "@/agent/worker-turn-descriptor-facts"
import { parseDispatchLineagePayload } from "@/engine/dispatch-lineage-facts"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import {
  rewriteDispatchLineagePayloadForMigration,
  type DispatchLineageMigrationArtifactRow,
} from "./dispatch-lineage-owner-migration"
import { isDeepStrictEqual } from "node:util"
import { canonicalSchemaObjectSQL } from "./schema-contract"

type ToolRequestRow = {
  id: string
  message_id: string
  data: string
  time_created: number
}

type ToolOutcomeRow = {
  id: string
  request_part_id: string
  data: string
  time_created: number
}

type PersistedDescriptorRow = {
  id: string
  session_id: string
  agent: string
  hash: string
  payload: string
}

function rows<T>(db: BunDatabase, statement: string, ...parameters: unknown[]): T[] {
  const query = db.query<T, []>(statement)
  try {
    return query.all(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function run(db: BunDatabase, statement: string, ...parameters: unknown[]): void {
  const query = db.query(statement)
  try {
    query.run(...(parameters as []))
  } finally {
    query.finalize()
  }
}

function objectValue(value: string | Record<string, unknown>, subject: string): Record<string, unknown> {
  const parsed = typeof value === "string" ? JSON.parse(value) : value
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${subject} is not a JSON object`)
  }
  return parsed
}

export class DispatchCollectionMigrationInputError extends Error {
  override readonly name = "DispatchCollectionMigrationInputError"
  readonly code = "DISPATCH_COLLECTION_MIGRATION_INPUT_INVALID"
}

function exactOuterInput(row: ToolRequestRow) {
  const data = objectValue(row.data, `dispatch_agents Tool request ${row.id}`)
  if (data.type !== "tool-request" || data.tool !== "dispatch_agents" || typeof data.callID !== "string" || !data.callID) {
    throw new Error(`dispatch_agents Tool request ${row.id} has invalid identity`)
  }
  const parsed = PersistedDispatchAgentsInputSchema.safeParse(data.input)
  if (!parsed.success) {
    throw new DispatchCollectionMigrationInputError(
      `dispatch_agents Tool request ${row.id} has invalid persisted collection input: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ")}`,
    )
  }
  return { callID: data.callID, ...parsed.data }
}

function lineageRows(
  sqlite: BunDatabase,
  input: { toolPartID: string; toolCallID: string; toolName: "dispatch_agent" | "dispatch_agents"; memberIndex?: number },
) {
  const statement =
    input.toolName === "dispatch_agent"
      ? `SELECT id,task_id,kind,label,payload,time_created,time_updated,catalog_revision
         FROM engine_artifact
         WHERE kind='dispatch_lineage'
           AND json_extract(payload,'$.tool_name')='dispatch_agent'
           AND json_extract(payload,'$.tool_part_id')=?
           AND json_extract(payload,'$.tool_call_id')=?
         ORDER BY time_created,id`
      : `SELECT id,task_id,kind,label,payload,time_created,time_updated,catalog_revision
         FROM engine_artifact
         WHERE kind='dispatch_lineage'
           AND json_extract(payload,'$.tool_name')='dispatch_agents'
           AND json_extract(payload,'$.tool_part_id')=?
           AND json_extract(payload,'$.tool_call_id')=?
           AND json_extract(payload,'$.collection_member_index')=?
         ORDER BY time_created,id`
  return rows<DispatchLineageMigrationArtifactRow>(
    sqlite,
    statement,
    input.toolPartID,
    input.toolCallID,
    ...(input.memberIndex === undefined ? [] : [input.memberIndex]),
  )
}

function validateLineageAuthority(input: {
  sqlite: BunDatabase
  outer: ToolRequestRow
  outerCallID: string
  memberIndex: number
  memberCount: number
  dispatch: PersistedDispatchAgentsInput["dispatches"][number]
  lineage: DispatchLineageMigrationArtifactRow
  legacy: boolean
}): { descriptorBacked: boolean } {
  const raw = objectValue(input.lineage.payload, `Dispatch lineage ${input.lineage.id}`)
  if (input.legacy) {
    const childPartID = Identifier.deterministic("part", `dispatch-agents\0${input.outer.id}\0${input.memberIndex}`)
    const childCallID = Identifier.deterministic("call", `dispatch-agents\0${input.outer.id}\0${input.memberIndex}`)
    if (raw.tool_name !== "dispatch_agent" || raw.tool_part_id !== childPartID || raw.tool_call_id !== childCallID) {
      throw new Error(`Dispatch lineage ${input.lineage.id} does not match its legacy member occurrence`)
    }
  }
  const canonical = {
    ...raw,
    tool_part_id: input.outer.id,
    tool_call_id: input.outerCallID,
    tool_name: "dispatch_agents",
    collection_member_index: input.memberIndex,
    collection_member_count: input.memberCount,
  }
  const payload = parseDispatchLineagePayload(canonical, input.lineage.id)
  const outerMessage = rows<{ session_id: string; project_id: string }>(
    input.sqlite,
    `SELECT message.session_id,session.project_id FROM message JOIN session ON session.id=message.session_id WHERE message.id=?`,
    input.outer.message_id,
  )[0]
  const childSession = rows<{ project_id: string; kind: string }>(
    input.sqlite,
    "SELECT project_id,kind FROM session WHERE id=?",
    payload.child_session_id,
  )[0]
  const task = rows<{ project_id: string }>(input.sqlite, "SELECT project_id FROM engine_task WHERE id=?", input.lineage.task_id)[0]
  if (
    !outerMessage ||
    !childSession ||
    !task ||
    payload.task_id !== input.lineage.task_id ||
    payload.orchestrator_message_id !== input.outer.message_id ||
    payload.orchestrator_session_id !== outerMessage.session_id ||
    task.project_id !== outerMessage.project_id ||
    childSession.project_id !== task.project_id ||
    payload.target_agent_id !== input.dispatch.dispatch.target ||
    payload.projected_worker_identity.agentID !== payload.target_agent_id ||
    childSession.kind !== payload.projected_worker_identity.sessionKind ||
    !isDeepStrictEqual(payload.work_scope, input.dispatch.dispatch.work_scope)
  ) {
    throw new Error(`Dispatch lineage ${input.lineage.id} does not match outer member ${input.memberIndex} authority`)
  }
  const turn = input.dispatch.dispatch.turn
  if (turn.kind === "initial") {
    const workflowDrift =
      turn.workflow_subject.kind === "direct"
        ? payload.workflow_binding.kind !== "direct" || payload.workflow_node_id !== null
        : payload.workflow_binding.kind !== "virtual_workflow" ||
          payload.workflow_binding.workflow_id !== turn.workflow_subject.workflow_id ||
          payload.workflow_node_id !== turn.workflow_subject.node_id
    if (
      payload.coordination_action_id !== undefined ||
      payload.continuation_of_dispatch_id !== undefined ||
      !isDeepStrictEqual(payload.adapter_input, turn.input) ||
      workflowDrift
    ) {
      throw new Error(`Dispatch lineage ${input.lineage.id} does not match initial member ${input.memberIndex}`)
    }
  } else {
    const expectedCoordination =
      turn.authority.kind === "coordination_action" ? turn.authority.coordination_action_id : undefined
    const expectedContinuation =
      turn.authority.kind === "prior_dispatch" ? turn.authority.continuation_dispatch_id : undefined
    if (
      payload.coordination_action_id !== expectedCoordination ||
      payload.continuation_of_dispatch_id !== expectedContinuation
    ) {
      throw new Error(`Dispatch lineage ${input.lineage.id} does not match continuation member ${input.memberIndex}`)
    }
  }
  const descriptorRows = rows<PersistedDescriptorRow>(
    input.sqlite,
    `SELECT id,session_id,agent,hash,payload FROM worker_turn_descriptor
     WHERE session_id=? AND json_extract(payload,'$.dispatchTurn.current_dispatch_id')=?`,
    payload.child_session_id,
    payload.dispatch_id,
  )
  if (descriptorRows.length > 1) {
    throw new Error(`Dispatch lineage ${input.lineage.id} has multiple exact Worker Turn descriptors`)
  }
  const descriptorRow = descriptorRows[0]
  if (!descriptorRow) return { descriptorBacked: false }
  const descriptor = parsePersistedWorkerTurnDescriptor({
    id: descriptorRow.id,
    agentIndex: descriptorRow.agent,
    hash: descriptorRow.hash,
    payload: objectValue(descriptorRow.payload, `Worker Turn descriptor ${descriptorRow.id}`),
  })
  const authorityMessage = rows<{ session_id: string }>(
    input.sqlite,
    "SELECT session_id FROM message WHERE id=?",
    descriptor.messageAuthority.user_message_id,
  )[0]
  if (!authorityMessage || authorityMessage.session_id !== payload.child_session_id) {
    throw new Error(`Dispatch lineage ${input.lineage.id} Worker Turn input Message authority drift`)
  }
  for (const authorityPart of descriptor.messageAuthority.control_text_parts) {
    const part = rows<{ message_id: string; data: string }>(
      input.sqlite,
      "SELECT message_id,data FROM part WHERE id=?",
      authorityPart.part_id,
    )[0]
    const data = part ? objectValue(part.data, `Worker Turn control Part ${authorityPart.part_id}`) : undefined
    if (
      !part ||
      part.message_id !== descriptor.messageAuthority.user_message_id ||
      data?.type !== "text" ||
      typeof data.text !== "string" ||
      controlTextSHA256(data.text) !== authorityPart.text_sha256
    ) {
      throw new Error(`Dispatch lineage ${input.lineage.id} Worker Turn control Part authority drift`)
    }
  }
  if (
    descriptorRow.session_id !== payload.child_session_id ||
    descriptor.lifecycle.taskID !== payload.task_id ||
    !isDeepStrictEqual(descriptor.identity, payload.projected_worker_identity) ||
    !isDeepStrictEqual(descriptor.lifecycle.workScope, payload.work_scope) ||
    !descriptor.dispatchTurn ||
    descriptor.dispatchTurn.current_dispatch_id !== payload.dispatch_id ||
    !isDeepStrictEqual(descriptor.dispatchTurn.workflow_binding, payload.workflow_binding) ||
    descriptor.dispatchTurn.workflow_node_id !== payload.workflow_node_id ||
    descriptor.dispatchTurn.workflow_occurrence_id !== payload.workflow_occurrence_id ||
    !isDeepStrictEqual(descriptor.dispatchTurn.delivery_slice_revision_ids, payload.delivery_slice_revision_ids) ||
    descriptor.dispatchTurn.kind !== turn.kind
  ) {
    throw new Error(`Dispatch lineage ${input.lineage.id} Worker Turn descriptor authority drift`)
  }
  return { descriptorBacked: true }
}

function validateMemberOutcome(input: {
  outerID: string
  index: number
  outcome: ToolOutcomeRow | undefined
  lineage: DispatchLineageMigrationArtifactRow | undefined
  descriptorBacked: boolean
}): void {
  if (!input.outcome) return
  const data = objectValue(input.outcome.data, `Tool outcome ${input.outcome.id}`)
  if (data.outcome !== "completed") return
  if (typeof data.output !== "string") throw new Error(`Tool outcome ${input.outcome.id} has no current dispatch result`)
  const outcome = DispatchOutcomeSchema.parse(JSON.parse(data.output))
  const childSessionID = input.lineage
    ? objectValue(input.lineage.payload, `Dispatch lineage ${input.lineage.id}`).child_session_id
    : undefined
  if (outcome.kind === "accepted") {
    if (
      !input.lineage ||
      !input.descriptorBacked ||
      outcome.session_id !== childSessionID ||
      outcome.dispatch_lineage_id !== input.lineage.id
    ) {
      throw new Error(`Dispatch collection ${input.outerID} member ${input.index} accepted outcome authority drift`)
    }
    return
  }
  if ("session_id" in outcome && outcome.session_id && (!input.lineage || outcome.session_id !== childSessionID)) {
    throw new Error(`Dispatch collection ${input.outerID} member ${input.index} terminal Session authority drift`)
  }
  if (outcome.kind === "coordination" && outcome.dispatch_lineage_id !== input.lineage?.id) {
    throw new Error(`Dispatch collection ${input.outerID} member ${input.index} coordination authority drift`)
  }
}

function memberResult(input: {
  index: number
  name: string
  target: string
  outcome?: ToolOutcomeRow
  lineage?: DispatchLineageMigrationArtifactRow
  descriptorBacked: boolean
  outerFailure: unknown
}): DispatchCollectionMemberResult {
  if (input.outcome) {
    const data = objectValue(input.outcome.data, `Tool outcome ${input.outcome.id}`)
    if (data.outcome === "completed" && typeof data.output === "string") {
      return DispatchCollectionMemberResultSchema.parse({
        member_index: input.index,
        name: input.name,
        target: input.target,
        status: "completed",
        outcome: DispatchOutcomeSchema.parse(JSON.parse(data.output)),
      })
    }
    if (data.outcome === "failed" && data.failure && typeof data.failure === "object") {
      return DispatchCollectionMemberResultSchema.parse({
        member_index: input.index,
        name: input.name,
        target: input.target,
        status: "failed",
        failure: data.failure,
      })
    }
    throw new Error(`Tool outcome ${input.outcome.id} cannot be represented as a collection member result`)
  }
  if (input.lineage && input.descriptorBacked) {
    const payload = objectValue(input.lineage.payload, `Dispatch lineage ${input.lineage.id}`)
    if (typeof payload.child_session_id !== "string" || !payload.child_session_id) {
      throw new Error(`Dispatch lineage ${input.lineage.id} has no child Session`)
    }
    return DispatchCollectionMemberResultSchema.parse({
      member_index: input.index,
      name: input.name,
      target: input.target,
      status: "completed",
      outcome: {
        kind: "accepted",
        session_id: payload.child_session_id,
        dispatch_lineage_id: input.lineage.id,
      },
    })
  }
  if (!input.outerFailure || typeof input.outerFailure !== "object") {
    throw new Error(
      `Collection member ${input.index} has neither an exact outcome, descriptor-backed lineage, nor outer failure`,
    )
  }
  return DispatchCollectionMemberResultSchema.parse({
    member_index: input.index,
    name: input.name,
    target: input.target,
    status: "failed",
    failure: input.outerFailure,
  })
}

function outerProgressFacts(sqlite: BunDatabase, outerID: string): Record<string, unknown>[] {
  return rows<{ metadata: string | null }>(
    sqlite,
    `SELECT metadata FROM tool_part_progress WHERE request_part_id=? ORDER BY time_created,id`,
    outerID,
  ).flatMap((row) =>
    row.metadata ? [objectValue(row.metadata, `dispatch_agents outer progress ${outerID}`)] : [],
  )
}

function persistOuterMemberProgress(input: {
  sqlite: BunDatabase
  outer: ToolRequestRow
  collectionSize: number
  members: readonly DispatchCollectionMemberResult[]
}): void {
  if (input.members.length === 0) return
  const progressFacts = outerProgressFacts(input.sqlite, input.outer.id)
  const merged = new Map<number, DispatchCollectionMemberResult>()
  for (const metadata of progressFacts) {
    for (const member of readDispatchCollectionProgress(metadata)) {
      const existing = merged.get(member.member_index)
      if (existing && !isDeepStrictEqual(existing, member)) {
        throw new Error(`Dispatch collection ${input.outer.id} member ${member.member_index} progress conflicts`)
      }
      merged.set(member.member_index, member)
    }
  }
  for (const member of input.members) {
    const existing = merged.get(member.member_index)
    if (existing && !isDeepStrictEqual(existing, member)) {
      throw new Error(`Dispatch collection ${input.outer.id} member ${member.member_index} progress conflicts`)
    }
    if (existing) continue
    merged.set(member.member_index, member)
    run(
      input.sqlite,
      `INSERT INTO tool_part_progress(id,request_part_id,title,metadata,time_created) VALUES(?,?,?,?,?)`,
      Identifier.ascending("part"),
      input.outer.id,
      `Settled frontier (${merged.size}/${input.collectionSize})`,
      JSON.stringify(writeDispatchCollectionProgress(progressFacts.at(-1), [member])),
      Date.now(),
    )
  }
}

let afterAdmissionForTest: (() => void) | undefined

const DISPATCH_OCCURRENCE_INDEXES = [
  "engine_dispatch_lineage_direct_tool_occurrence_idx",
  "engine_dispatch_lineage_collection_member_idx",
  "engine_dispatch_lineage_initial_workflow_node_idx",
  "engine_dispatch_lineage_coordination_action_idx",
] as const

function missingDispatchOccurrenceIndexes(sqlite: BunDatabase): string[] {
  const present = new Set(
    rows<{ name: string }>(
      sqlite,
      `SELECT name FROM sqlite_schema WHERE type='index' AND name IN (${DISPATCH_OCCURRENCE_INDEXES.map(() => "?").join(",")})`,
      ...DISPATCH_OCCURRENCE_INDEXES,
    ).map((row) => row.name),
  )
  return DISPATCH_OCCURRENCE_INDEXES.filter((name) => !present.has(name))
}

function createDispatchOccurrenceIndexes(sqlite: BunDatabase, missing: readonly string[]): void {
  for (const name of missing) sqlite.exec(canonicalSchemaObjectSQL("index", name))
}

const COLLECTION_REPLACEMENT_TRIGGERS = [
  "engine_dispatch_lineage_immutable",
  "tool_part_request_no_delete",
  "tool_part_progress_no_delete",
  "tool_part_outcome_no_update",
  "tool_part_outcome_no_delete",
] as const

function replaceableTriggers(sqlite: BunDatabase): string[] {
  const present = new Set(
    rows<{ name: string }>(
      sqlite,
      `SELECT name FROM sqlite_schema WHERE type='trigger' AND name IN (${COLLECTION_REPLACEMENT_TRIGGERS.map(() => "?").join(",")})`,
      ...COLLECTION_REPLACEMENT_TRIGGERS,
    ).map((row) => row.name),
  )
  const missing = COLLECTION_REPLACEMENT_TRIGGERS.filter((name) => !present.has(name))
  if (missing.length > 0) {
    throw new Error(`Dispatch collection migration requires current immutable triggers: ${missing.join(", ")}`)
  }
  return [...COLLECTION_REPLACEMENT_TRIGGERS]
}

/**
 * Collapse the legacy Host-authored child Tool requests into the one real
 * dispatch_agents occurrence before current lineage validation runs.
 */
export function migrateDispatchCollectionOccurrences(sqlite: BunDatabase): boolean {
  sqlite.exec("BEGIN IMMEDIATE")
  try {
    afterAdmissionForTest?.()
    const triggerNames = replaceableTriggers(sqlite)
    const outers = rows<ToolRequestRow>(
      sqlite,
      `SELECT id,message_id,data,time_created FROM tool_part_request
       WHERE json_extract(data,'$.tool')='dispatch_agents' ORDER BY time_created,id`,
    )
    const missingIndexes = missingDispatchOccurrenceIndexes(sqlite)
    const plans: {
      outer: ToolRequestRow
      callID: string
      team: PersistedDispatchAgentsInput["team"]
      dispatches: PersistedDispatchAgentsInput["dispatches"]
      children: {
        index: number
        request?: ToolRequestRow
        outcome?: ToolOutcomeRow
        lineage?: DispatchLineageMigrationArtifactRow
        legacyLineage?: DispatchLineageMigrationArtifactRow
        descriptorBacked: boolean
      }[]
    }[] = []
    for (const outer of outers) {
      const collection = exactOuterInput(outer)
      const children = collection.dispatches.map((dispatch, index) => {
        const childPartID = Identifier.deterministic("part", `dispatch-agents\0${outer.id}\0${index}`)
        const childCallID = Identifier.deterministic("call", `dispatch-agents\0${outer.id}\0${index}`)
        const request = rows<ToolRequestRow>(
          sqlite,
          "SELECT id,message_id,data,time_created FROM tool_part_request WHERE id=?",
          childPartID,
        )[0]
        if (request) {
          const data = objectValue(request.data, `legacy dispatch member ${request.id}`)
          if (
            request.message_id !== outer.message_id ||
            data.type !== "tool-request" ||
            data.tool !== "dispatch_agent" ||
            data.callID !== childCallID ||
            !isDeepStrictEqual(data.input, dispatch)
          ) {
            throw new Error(`Legacy dispatch member ${request.id} does not match outer ${outer.id} index ${index}`)
          }
        }
        const legacyLineages = lineageRows(sqlite, {
          toolPartID: childPartID,
          toolCallID: childCallID,
          toolName: "dispatch_agent",
        })
        const canonicalLineages = lineageRows(sqlite, {
          toolPartID: outer.id,
          toolCallID: collection.callID,
          toolName: "dispatch_agents",
          memberIndex: index,
        })
        if (legacyLineages.length > 1 || canonicalLineages.length > 1 || (legacyLineages.length && canonicalLineages.length)) {
          throw new Error(`Dispatch collection ${outer.id} member ${index} has conflicting immutable lineages`)
        }
        if (canonicalLineages[0]) {
          const payload = objectValue(canonicalLineages[0].payload, `Dispatch lineage ${canonicalLineages[0].id}`)
          if (payload.collection_member_count !== collection.dispatches.length) {
            throw new Error(
              `Dispatch collection ${outer.id} member ${index} count ${String(payload.collection_member_count)} ` +
                `does not match outer count ${collection.dispatches.length}`,
            )
          }
        }
        const outcome = request
          ? rows<ToolOutcomeRow>(
              sqlite,
              "SELECT id,request_part_id,data,time_created FROM tool_part_outcome WHERE request_part_id=?",
              request.id,
            )[0]
          : undefined
        return {
          index,
          request,
          outcome,
          lineage: legacyLineages[0] ?? canonicalLineages[0],
          legacyLineage: legacyLineages[0],
          descriptorBacked: false,
        }
      })
      if (children.some((child) => child.request || child.legacyLineage)) {
        for (const child of children) {
          const lineage = child.lineage
          const authority = lineage
            ? validateLineageAuthority({
                sqlite,
                outer,
                outerCallID: collection.callID,
                memberIndex: child.index,
                memberCount: collection.dispatches.length,
                dispatch: collection.dispatches[child.index]!,
                lineage,
                legacy: Boolean(child.legacyLineage),
              })
            : { descriptorBacked: false }
          child.descriptorBacked = authority.descriptorBacked
          validateMemberOutcome({
            outerID: outer.id,
            index: child.index,
            outcome: child.outcome,
            lineage,
            descriptorBacked: authority.descriptorBacked,
          })
        }
        plans.push({ outer, ...collection, children })
      }
    }
    if (plans.length === 0 && missingIndexes.length === 0) {
      sqlite.exec("COMMIT")
      return false
    }

    if (plans.length > 0) for (const name of triggerNames) sqlite.exec(`DROP TRIGGER "${name}"`)
    for (const plan of plans) {
      for (const child of plan.children) {
        if (!child.legacyLineage) continue
        const payload = objectValue(child.legacyLineage.payload, `Dispatch lineage ${child.legacyLineage.id}`)
        payload.tool_part_id = plan.outer.id
        payload.tool_call_id = plan.callID
        payload.tool_name = "dispatch_agents"
        payload.collection_member_index = child.index
        payload.collection_member_count = plan.dispatches.length
        rewriteDispatchLineagePayloadForMigration(sqlite, child.legacyLineage, payload)
      }

      const outerOutcome = rows<ToolOutcomeRow>(
        sqlite,
        "SELECT id,request_part_id,data,time_created FROM tool_part_outcome WHERE request_part_id=?",
        plan.outer.id,
      )[0]
      const outerData = outerOutcome
        ? objectValue(outerOutcome.data, `dispatch_agents outer outcome ${outerOutcome.id}`)
        : undefined
      if (outerOutcome && (outerData?.outcome === "failed" || outerData?.outcome === "completed")) {
        const names = plan.team.map((member) => member.name)
        const targets = plan.dispatches.map((dispatch) => dispatch.dispatch.target)
        const members = plan.children.map((child) => memberResult({
          index: child.index,
          name: names[child.index]!,
          target: targets[child.index]!,
          outcome: child.outcome,
          lineage: child.lineage,
          descriptorBacked: child.descriptorBacked,
          outerFailure: outerData.outcome === "failed" ? outerData.failure : undefined,
        }))
        const completedCount = members.filter((member) => member.status === "completed").length
        const repaired = {
          outcome: "completed",
          output: JSON.stringify({ members }),
          title: `Settled frontier (${completedCount}/${members.length})`,
          metadata: {
            frontier_size: members.length,
            completed_count: completedCount,
            member_names: names,
            targets,
            members,
          },
          time: outerData.time,
        }
        run(sqlite, "UPDATE tool_part_outcome SET data=? WHERE id=?", JSON.stringify(repaired), outerOutcome.id)
      } else if (!outerOutcome) {
        const names = plan.team.map((member) => member.name)
        const targets = plan.dispatches.map((dispatch) => dispatch.dispatch.target)
        const settledMembers = plan.children.flatMap((child) => {
          if (!child.outcome && (!child.lineage || !child.descriptorBacked)) return []
          return [memberResult({
            index: child.index,
            name: names[child.index]!,
            target: targets[child.index]!,
            outcome: child.outcome,
            lineage: child.lineage,
            descriptorBacked: child.descriptorBacked,
            outerFailure: undefined,
          })]
        })
        persistOuterMemberProgress({
          sqlite,
          outer: plan.outer,
          collectionSize: plan.dispatches.length,
          members: settledMembers,
        })
      }
      for (const child of plan.children) {
        if (child.request) run(sqlite, "DELETE FROM tool_part_request WHERE id=?", child.request.id)
      }
    }
    if (plans.length > 0) {
      for (const name of triggerNames) sqlite.exec(canonicalSchemaObjectSQL("trigger", name))
    }
    createDispatchOccurrenceIndexes(sqlite, missingIndexes)
    sqlite.exec("COMMIT")
    return true
  } catch (error) {
    sqlite.exec("ROLLBACK")
    throw error
  }
}

export const DispatchCollectionOccurrenceMigrationTestHooks = {
  replaceAfterAdmission(callback: (() => void) | undefined): Disposable {
    const prior = afterAdmissionForTest
    afterAdmissionForTest = callback
    return {
      [Symbol.dispose]() {
        afterAdmissionForTest = prior
      },
    }
  },
}
