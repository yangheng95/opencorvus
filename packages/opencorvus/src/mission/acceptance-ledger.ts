import z from "zod"
import { artifactReadLocatorKey } from "@opencorvus-ai/plugin/artifact-catalog"
import { Database, and, desc, eq } from "@/storage/db"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { insertEngineArtifact } from "@/engine/artifact"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { readTaskWorkflowBindingInTransaction } from "@/engine/workflow-binding-facts"
import { sameSelectedWorkflowBinding, type SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { dispatchLineageRow, type DispatchLineageRow } from "@/engine/dispatch-lineage-facts"
import { canonicalJSONValue } from "@/util/canonical-digest"
import {
  MissionAcceptanceGapSchema,
  type MissionAcceptanceCriterion,
  type MissionAcceptanceCriterionResponsibility,
  type MissionAcceptanceGap,
  type MissionAcceptanceOpenCriterion,
} from "./acceptance-gap"

export const TaskAcceptanceLedgerRevisionSchema = z
  .object({
    protocol: z.literal("task-acceptance-ledger-v2"),
    revision: z.number().int().positive(),
    task_id: z.string().min(1),
    execution_epoch: z.number().int().positive(),
    previous_revision_artifact_id: z.string().min(1).nullable(),
    gap: MissionAcceptanceGapSchema,
    time_recorded: z.number().int().positive(),
  })
  .strict()

export type TaskAcceptanceLedgerRevision = z.infer<typeof TaskAcceptanceLedgerRevisionSchema>

export interface TaskAcceptanceLedgerProjection {
  artifactID: string
  revision: TaskAcceptanceLedgerRevision
}

export interface ActiveTaskAcceptanceRepair extends TaskAcceptanceLedgerProjection {
  executionEpoch: number
  workflowBinding: SelectedWorkflowBinding
  affectedWorkflowNodeIDs: Set<string>
}

export class MissionAcceptanceLedgerConflictError extends Error {
  readonly code = "mission_acceptance_ledger_conflict"

  constructor(
    readonly taskID: string,
    readonly expectedArtifactID: string | null,
    readonly currentArtifactID: string | null,
    message: string,
  ) {
    super(message)
    this.name = "MissionAcceptanceLedgerConflictError"
  }
}

export class MissionAcceptanceGapIntegrityError extends Error {
  readonly code = "mission_acceptance_gap_integrity"

  constructor(
    readonly taskID: string,
    message: string,
  ) {
    super(message)
    this.name = "MissionAcceptanceGapIntegrityError"
  }
}

export function readLatestTaskAcceptanceLedgerInTransaction(
  db: Database.TxOrDb,
  taskID: string,
): TaskAcceptanceLedgerProjection | undefined {
  const row = db
    .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
    .from(EngineArtifactTable)
    .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_acceptance_ledger")))
    .orderBy(desc(EngineArtifactTable.catalog_revision), desc(EngineArtifactTable.id))
    .get()
  if (!row) return undefined
  return { artifactID: row.id, revision: TaskAcceptanceLedgerRevisionSchema.parse(row.payload) }
}

export function readLatestTaskAcceptanceLedger(taskID: string): TaskAcceptanceLedgerProjection | undefined {
  return Database.use((db) => readLatestTaskAcceptanceLedgerInTransaction(db, taskID))
}

export function readTaskAcceptanceLedgerArtifact(taskID: string, artifactID: string): TaskAcceptanceLedgerProjection {
  return Database.use((db) => {
    const row = db
      .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.id, artifactID),
          eq(EngineArtifactTable.task_id, taskID),
          eq(EngineArtifactTable.kind, "task_acceptance_ledger"),
        ),
      )
      .get()
    if (!row) {
      throw new MissionAcceptanceGapIntegrityError(
        taskID,
        `Task ${taskID} acceptance ledger Artifact ${artifactID} does not exist.`,
      )
    }
    return { artifactID: row.id, revision: TaskAcceptanceLedgerRevisionSchema.parse(row.payload) }
  })
}

const evidenceRoleFields = [
  "observation_evidence_locators",
  "repair_evidence_locators",
  "resolution_evidence_locators",
  "invalidating_evidence_locators",
  "irreducible_blocker_evidence_locators",
] as const

type EvidenceRoleField = (typeof evidenceRoleFields)[number]

function locatorIdentitySet(criterion: MissionAcceptanceCriterion, role: EvidenceRoleField) {
  return new Set(criterion[role].map(artifactReadLocatorKey))
}

function hasNewLocatorInRole(
  current: MissionAcceptanceCriterion,
  prior: MissionAcceptanceCriterion,
  role: EvidenceRoleField,
): boolean {
  const priorEvidence = locatorIdentitySet(prior, role)
  return current[role].some((locator) => !priorEvidence.has(artifactReadLocatorKey(locator)))
}

function hasNewLocator(current: MissionAcceptanceCriterion, prior: MissionAcceptanceCriterion): boolean {
  return evidenceRoleFields.some((role) => hasNewLocatorInRole(current, prior, role))
}

function retainsAllLocatorsByRole(current: MissionAcceptanceCriterion, prior: MissionAcceptanceCriterion): boolean {
  return evidenceRoleFields.every((role) => {
    const currentEvidence = locatorIdentitySet(current, role)
    return prior[role].every((locator) => currentEvidence.has(artifactReadLocatorKey(locator)))
  })
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJSONValue(left) === canonicalJSONValue(right)
}

type DispatchLineageLookup = (artifactID: string) => DispatchLineageRow | undefined

function requireCriterionResponsibilities(input: {
  taskID: string
  gap: MissionAcceptanceGap
  binding: SelectedWorkflowBinding | undefined
  dispatchLineageByArtifactID?: DispatchLineageLookup
}) {
  if (!input.binding) {
    throw new MissionAcceptanceGapIntegrityError(
      input.taskID,
      `Task ${input.taskID} has no immutable workflow binding for Mission acceptance repair.`,
    )
  }
  for (const criterion of input.gap.criteria) {
    const responsibility = criterion.responsibility
    if (responsibility.kind === "workflow_node") {
      if (input.binding.kind !== "virtual_workflow" || input.binding.workflow_id !== responsibility.workflow_id) {
        throw new MissionAcceptanceGapIntegrityError(
          input.taskID,
          `Acceptance criterion ${criterion.criterion_id} workflow responsibility does not match the Task binding.`,
        )
      }
      if (!input.binding.nodes.some((node) => node.node_id === responsibility.workflow_node_id)) {
        throw new MissionAcceptanceGapIntegrityError(
          input.taskID,
          `Acceptance criterion ${criterion.criterion_id} references unknown workflow node ${responsibility.workflow_node_id}.`,
        )
      }
      continue
    }
    if (input.binding.kind !== "direct" || !sameCanonicalValue(input.binding.package_revision, responsibility.package_revision)) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Acceptance criterion ${criterion.criterion_id} direct responsibility does not match the Task package revision.`,
      )
    }
    const lineage = input.dispatchLineageByArtifactID?.(responsibility.dispatch_lineage_id)
    if (!lineage) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Acceptance criterion ${criterion.criterion_id} direct dispatch lineage ${responsibility.dispatch_lineage_id} does not exist.`,
      )
    }
    if (
      lineage.taskID !== input.taskID ||
      lineage.payload.target_agent_id !== responsibility.agent_id ||
      lineage.payload.workflow_node_id !== null ||
      !sameSelectedWorkflowBinding(lineage.payload.workflow_binding, input.binding)
    ) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Acceptance criterion ${criterion.criterion_id} direct responsibility does not match immutable dispatch lineage ${lineage.artifactID}.`,
      )
    }
  }
}

function requireSameResponsibility(
  taskID: string,
  prior: MissionAcceptanceCriterion,
  current: MissionAcceptanceCriterion,
) {
  if (!sameCanonicalValue(prior.responsibility, current.responsibility)) {
    throw new MissionAcceptanceGapIntegrityError(
      taskID,
      `Acceptance criterion ${prior.criterion_id} cannot change its immutable responsibility.`,
    )
  }
}

function requireOpenTransition(
  taskID: string,
  prior: MissionAcceptanceOpenCriterion,
  current: MissionAcceptanceCriterion,
) {
  if (!retainsAllLocatorsByRole(current, prior)) {
    throw new MissionAcceptanceGapIntegrityError(
      taskID,
      `Acceptance criterion ${prior.criterion_id} must retain every prior evidence locator in its original role.`,
    )
  }
  if (current.state === "open") {
    if (!hasNewLocator(current, prior) && current.repair_action.identity_sha256 === prior.repair_action.identity_sha256) {
      throw new MissionAcceptanceGapIntegrityError(
        taskID,
        `Repeated criterion ${prior.criterion_id} requires new evidence or a changed canonical repair action.`,
      )
    }
    return
  }
  if (current.state === "accepted") {
    if (!hasNewLocatorInRole(current, prior, "resolution_evidence_locators")) {
      throw new MissionAcceptanceGapIntegrityError(
        taskID,
        `Acceptance criterion ${prior.criterion_id} requires new resolution evidence before it can be accepted.`,
      )
    }
    return
  }
  if (!hasNewLocatorInRole(current, prior, "irreducible_blocker_evidence_locators")) {
    throw new MissionAcceptanceGapIntegrityError(
      taskID,
      `Acceptance criterion ${prior.criterion_id} requires new irreducible-blocker evidence before it can be blocked.`,
    )
  }
}

function requireAcceptedTransition(
  taskID: string,
  prior: Extract<MissionAcceptanceCriterion, { state: "accepted" }>,
  current: MissionAcceptanceCriterion,
) {
  if (current.state === "accepted") {
    if (!sameCanonicalValue(prior, current)) {
      throw new MissionAcceptanceGapIntegrityError(
        taskID,
        `Accepted criterion ${prior.criterion_id} must retain its exact immutable evidence and finding.`,
      )
    }
    return
  }
  if (
    current.state !== "open" ||
    current.disposition !== "stale_evidence" ||
    !retainsAllLocatorsByRole(current, prior)
  ) {
    throw new MissionAcceptanceGapIntegrityError(
      taskID,
      `Accepted criterion ${prior.criterion_id} can reopen only as stale_evidence while retaining prior evidence.`,
    )
  }
  if (!hasNewLocatorInRole(current, prior, "invalidating_evidence_locators")) {
    throw new MissionAcceptanceGapIntegrityError(
      taskID,
      `Accepted criterion ${prior.criterion_id} requires new contradictory evidence before reopening.`,
    )
  }
}

function requireCriterionStateContinuity(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
}) {
  if (!input.previous) return
  const currentByID = new Map(input.gap.criteria.map((criterion) => [criterion.criterion_id, criterion]))
  for (const prior of input.previous.revision.gap.criteria) {
    const current = currentByID.get(prior.criterion_id)
    if (!current) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Acceptance criterion ${prior.criterion_id} cannot disappear from the append-only ledger.`,
      )
    }
    requireSameResponsibility(input.taskID, prior, current)
    if (prior.state === "open") {
      requireOpenTransition(input.taskID, prior, current)
    } else if (prior.state === "accepted") {
      requireAcceptedTransition(input.taskID, prior, current)
    } else if (!sameCanonicalValue(prior, current)) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Irreducibly blocked criterion ${prior.criterion_id} must retain its exact evidence-backed state.`,
      )
    }
  }
}

export function validateTaskAcceptanceLedgerTransition(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
  workflowBinding: SelectedWorkflowBinding | undefined
  dispatchLineageByArtifactID?: DispatchLineageLookup
}) {
  const gap = MissionAcceptanceGapSchema.parse(input.gap)
  requireCriterionResponsibilities({
    taskID: input.taskID,
    gap,
    binding: input.workflowBinding,
    dispatchLineageByArtifactID: input.dispatchLineageByArtifactID,
  })
  requireCriterionStateContinuity({ taskID: input.taskID, previous: input.previous, gap })
  return gap
}

export function appendTaskAcceptanceLedgerRevisionInTransaction(input: {
  db: Database.TxOrDb
  taskID: string
  artifactID: string
  executionEpoch: number
  expectedPreviousArtifactID: string | null
  gap: MissionAcceptanceGap
  now: number
}): TaskAcceptanceLedgerProjection {
  const gap = MissionAcceptanceGapSchema.parse(input.gap)
  const previous = readLatestTaskAcceptanceLedgerInTransaction(input.db, input.taskID)
  const currentArtifactID = previous?.artifactID ?? null
  if (currentArtifactID !== input.expectedPreviousArtifactID) {
    throw new MissionAcceptanceLedgerConflictError(
      input.taskID,
      input.expectedPreviousArtifactID,
      currentArtifactID,
      `Task ${input.taskID} acceptance ledger changed; query the current Task before resuming.`,
    )
  }
  const lifecycle = taskLifecycleProjectionInTransaction(input.db, input.taskID)
  if (lifecycle.status !== "active" || lifecycle.epoch !== input.executionEpoch) {
    throw new MissionAcceptanceGapIntegrityError(
      input.taskID,
      `Task ${input.taskID} acceptance ledger revision targets epoch ${input.executionEpoch}, current lifecycle is ${lifecycle.status} epoch ${lifecycle.epoch}.`,
    )
  }
  validateTaskAcceptanceLedgerTransition({
    taskID: input.taskID,
    gap,
    workflowBinding: readTaskWorkflowBindingInTransaction(input.db, input.taskID),
    previous,
    dispatchLineageByArtifactID: (artifactID) => {
      const row = input.db
        .select()
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.id, artifactID),
            eq(EngineArtifactTable.task_id, input.taskID),
            eq(EngineArtifactTable.kind, "dispatch_lineage"),
          ),
        )
        .get()
      return row ? dispatchLineageRow(row) : undefined
    },
  })
  const revision = TaskAcceptanceLedgerRevisionSchema.parse({
    protocol: "task-acceptance-ledger-v2",
    revision: (previous?.revision.revision ?? 0) + 1,
    task_id: input.taskID,
    execution_epoch: input.executionEpoch,
    previous_revision_artifact_id: currentArtifactID,
    gap,
    time_recorded: input.now,
  })
  insertEngineArtifact(input.db, {
    id: input.artifactID,
    taskID: input.taskID,
    kind: "task_acceptance_ledger",
    label: `acceptance-ledger-r${revision.revision}`,
    payload: revision,
    timeCreated: input.now,
  })
  return { artifactID: input.artifactID, revision }
}

export function openAcceptanceCriteria(gap: MissionAcceptanceGap): MissionAcceptanceOpenCriterion[] {
  return gap.criteria.filter((criterion): criterion is MissionAcceptanceOpenCriterion => criterion.state === "open")
}

export function affectedAcceptanceWorkflowNodes(
  binding: SelectedWorkflowBinding,
  gap: MissionAcceptanceGap,
): Set<string> {
  if (binding.kind !== "virtual_workflow") return new Set()
  const affected = new Set(
    openAcceptanceCriteria(gap).flatMap((criterion) =>
      criterion.responsibility.kind === "workflow_node" ? [criterion.responsibility.workflow_node_id] : [],
    ),
  )
  let changed = true
  while (changed) {
    changed = false
    for (const node of binding.nodes) {
      if (affected.has(node.node_id) || !node.depends_on.some((dependency) => affected.has(dependency))) continue
      affected.add(node.node_id)
      changed = true
    }
  }
  return affected
}

export function workflowNodeConsumesAcceptanceCriterion(
  binding: SelectedWorkflowBinding,
  responsibleWorkflowNodeID: string,
  candidateWorkflowNodeID: string,
): boolean {
  if (binding.kind !== "virtual_workflow") return false
  if (responsibleWorkflowNodeID === candidateWorkflowNodeID) return true
  const byID = new Map(binding.nodes.map((node) => [node.node_id, node]))
  const visited = new Set<string>()
  const pending = [candidateWorkflowNodeID]
  while (pending.length > 0) {
    const current = pending.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    const node = byID.get(current)
    if (!node) return false
    if (node.depends_on.includes(responsibleWorkflowNodeID)) return true
    pending.push(...node.depends_on)
  }
  return false
}

export function dispatchConsumesAcceptanceCriterion(input: {
  binding: SelectedWorkflowBinding
  responsibility: MissionAcceptanceCriterionResponsibility
  candidateWorkflowNodeID: string | null
  sourceDispatchLineageArtifactID: string
  targetAgentID: string
}): boolean {
  if (input.responsibility.kind === "workflow_node") {
    return (
      input.candidateWorkflowNodeID !== null &&
      input.binding.kind === "virtual_workflow" &&
      input.binding.workflow_id === input.responsibility.workflow_id &&
      workflowNodeConsumesAcceptanceCriterion(
        input.binding,
        input.responsibility.workflow_node_id,
        input.candidateWorkflowNodeID,
      )
    )
  }
  return (
    input.binding.kind === "direct" &&
    input.candidateWorkflowNodeID === null &&
    input.responsibility.dispatch_lineage_id === input.sourceDispatchLineageArtifactID &&
    input.responsibility.agent_id === input.targetAgentID &&
    sameCanonicalValue(input.binding.package_revision, input.responsibility.package_revision)
  )
}

export function currentTaskAcceptanceRepair(taskID: string): ActiveTaskAcceptanceRepair | undefined {
  return Database.use((db) => {
    const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
    if (lifecycle.status !== "active") return undefined
    const ledger = readLatestTaskAcceptanceLedgerInTransaction(db, taskID)
    if (!ledger || ledger.revision.execution_epoch !== lifecycle.epoch) return undefined
    const binding = readTaskWorkflowBindingInTransaction(db, taskID)
    if (!binding) throw new MissionAcceptanceGapIntegrityError(taskID, `Task ${taskID} has no workflow binding.`)
    return {
      ...ledger,
      executionEpoch: lifecycle.epoch,
      workflowBinding: binding,
      affectedWorkflowNodeIDs: affectedAcceptanceWorkflowNodes(binding, ledger.revision.gap),
    }
  })
}
