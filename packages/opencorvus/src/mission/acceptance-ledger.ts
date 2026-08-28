import z from "zod"
import { artifactReadLocatorKey } from "@opencorvus-ai/plugin/artifact-catalog"
import { Database, and, desc, eq } from "@/storage/db"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { insertEngineArtifact } from "@/engine/artifact"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { readTaskWorkflowBindingInTransaction } from "@/engine/workflow-binding-facts"
import type { SelectedWorkflowBinding } from "@/engine/workflow-binding"
import { MissionAcceptanceGapSchema, type MissionAcceptanceGap } from "./acceptance-gap"

export const TaskAcceptanceLedgerRevisionSchema = z
  .object({
    protocol: z.literal("task-acceptance-ledger-v1"),
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

function locatorIdentitySet(locators: MissionAcceptanceGap["criteria"][number]["relied_evidence_locators"]) {
  return new Set(locators.map(artifactReadLocatorKey))
}

function sameLocatorSet(
  left: MissionAcceptanceGap["criteria"][number]["relied_evidence_locators"],
  right: MissionAcceptanceGap["criteria"][number]["relied_evidence_locators"],
) {
  const leftKeys = [...locatorIdentitySet(left)].sort()
  const rightKeys = [...locatorIdentitySet(right)].sort()
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index])
}

function requireGapWorkflowNodes(input: {
  taskID: string
  gap: MissionAcceptanceGap
  binding: SelectedWorkflowBinding | undefined
}) {
  if (!input.binding) {
    throw new MissionAcceptanceGapIntegrityError(
      input.taskID,
      `Task ${input.taskID} has no immutable workflow binding for Mission acceptance repair.`,
    )
  }
  if (input.binding.kind !== "virtual_workflow") {
    throw new MissionAcceptanceGapIntegrityError(
      input.taskID,
      `Task ${input.taskID} has a direct workflow binding and therefore no workflow node that can own an acceptance gap.`,
    )
  }
  const nodeIDs = new Set(input.binding.nodes.map((node) => node.node_id))
  for (const criterion of input.gap.criteria) {
    if (!nodeIDs.has(criterion.responsible_workflow_node_id)) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Acceptance criterion ${criterion.criterion_id} references unknown workflow node ${criterion.responsible_workflow_node_id}.`,
      )
    }
  }
}

function requirePreservedAcceptanceContinuity(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
}) {
  if (!input.previous) return
  const current = new Map(input.gap.preserved_acceptances.map((acceptance) => [acceptance.criterion_id, acceptance]))
  for (const prior of input.previous.revision.gap.preserved_acceptances) {
    const preserved = current.get(prior.criterion_id)
    if (!preserved || !sameLocatorSet(prior.evidence_locators, preserved.evidence_locators)) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Previously accepted criterion ${prior.criterion_id} must retain its exact immutable evidence locators.`,
      )
    }
  }
}

function requireRepeatedGapProgress(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
}) {
  if (!input.previous) return
  const priorCriteria = new Map(
    input.previous.revision.gap.criteria.map((criterion) => [criterion.criterion_id, criterion]),
  )
  for (const criterion of input.gap.criteria) {
    const prior = priorCriteria.get(criterion.criterion_id)
    if (!prior) continue
    if (criterion.repeat_disposition !== "repairable_with_new_evidence") {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Repeated criterion ${criterion.criterion_id} must explicitly choose repairable_with_new_evidence to open another repair epoch.`,
      )
    }
    const priorEvidence = locatorIdentitySet([
      ...prior.relied_evidence_locators,
      ...prior.contradictory_evidence_locators,
    ])
    const hasNewEvidence = [...criterion.relied_evidence_locators, ...criterion.contradictory_evidence_locators].some(
      (locator) => !priorEvidence.has(artifactReadLocatorKey(locator)),
    )
    const hasNewAction = input.gap.requested_next_action !== input.previous.revision.gap.requested_next_action
    if (!hasNewEvidence && !hasNewAction) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Repeated criterion ${criterion.criterion_id} cites neither a new fact nor a previously untried requested action.`,
      )
    }
  }
}

function requirePriorOpenCriterionDisposition(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
}) {
  if (!input.previous) return
  const currentOpen = new Set(input.gap.criteria.map((criterion) => criterion.criterion_id))
  const currentPreserved = new Map(
    input.gap.preserved_acceptances.map((acceptance) => [acceptance.criterion_id, acceptance]),
  )
  for (const prior of input.previous.revision.gap.criteria) {
    if (currentOpen.has(prior.criterion_id)) continue
    const accepted = currentPreserved.get(prior.criterion_id)
    if (!accepted) {
      throw new MissionAcceptanceGapIntegrityError(
        input.taskID,
        `Previously open criterion ${prior.criterion_id} must remain open or move to preserved acceptance; it cannot disappear from the append-only ledger.`,
      )
    }
    const acceptedEvidence = locatorIdentitySet(accepted.evidence_locators)
    for (const locator of [...prior.relied_evidence_locators, ...prior.contradictory_evidence_locators]) {
      if (!acceptedEvidence.has(artifactReadLocatorKey(locator))) {
        throw new MissionAcceptanceGapIntegrityError(
          input.taskID,
          `Accepted criterion ${prior.criterion_id} must retain every evidence locator from its prior open revision.`,
        )
      }
    }
  }
}

export function validateTaskAcceptanceLedgerTransition(input: {
  taskID: string
  previous: TaskAcceptanceLedgerProjection | undefined
  gap: MissionAcceptanceGap
  workflowBinding: SelectedWorkflowBinding | undefined
}) {
  const gap = MissionAcceptanceGapSchema.parse(input.gap)
  requireGapWorkflowNodes({ taskID: input.taskID, gap, binding: input.workflowBinding })
  requirePreservedAcceptanceContinuity({ taskID: input.taskID, previous: input.previous, gap })
  requirePriorOpenCriterionDisposition({ taskID: input.taskID, previous: input.previous, gap })
  requireRepeatedGapProgress({ taskID: input.taskID, previous: input.previous, gap })
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
  })
  const revision = TaskAcceptanceLedgerRevisionSchema.parse({
    protocol: "task-acceptance-ledger-v1",
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

export function affectedAcceptanceWorkflowNodes(
  binding: SelectedWorkflowBinding,
  gap: MissionAcceptanceGap,
): Set<string> {
  if (binding.kind !== "virtual_workflow") return new Set()
  const affected = new Set(gap.criteria.map((criterion) => criterion.responsible_workflow_node_id))
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
