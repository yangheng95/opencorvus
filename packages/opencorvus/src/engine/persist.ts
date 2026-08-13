import { Identifier } from "@/id/id"
import { isDeepStrictEqual } from "node:util"
import { Database, and, desc, eq, inArray, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Event } from "./model"
import { EngineArtifactTable, EngineGoalTable, EngineTaskTable, type EngineArtifactKind } from "./engine.sql"
import type { ToolFailureCause } from "@/session/tool-failure-cause"
import { createIntegrityReviewArtifactPayload } from "@/integrity/review-artifact"
import type { IntegrityReview } from "@/integrity/team-schema"
import { EngineProtocol } from "./protocol"
import { insertEngineArtifact, recordEngineArtifact } from "./artifact"
import { assertEngineArtifactPayloadIdentity } from "./artifact-catalog-metadata"
import {
  assertCurrentDeliverySliceRevisionIDs,
  findGoal,
  type GoalRow,
  type TaskRow,
} from "./store"
import type { BuildFileObservation } from "@/snapshot/types"
import {
  ArchitectContractGraphSchema,
  remapArchitectContractGraphGoalIDs,
  type ArchitectContractGraph,
} from "@/architect/contract-graph"
import type { ArchitectFidelityCoverage } from "@/architect/types"
import { emptyArchitectFidelityState } from "@/architect/fidelity"
import {
  ArchitectContractGraphArtifactPayloadSchema,
  type ArchitectTurnProducer,
} from "./architect-contract-graph-artifact"
import {
  GoalGraphProjectionArtifactPayloadSchema,
  GoalGraphRemovalSchema,
  resolveGoalGraphProjectionTip,
  type GoalGraphRemoval,
  type GoalGraphMutationProducer,
  type GoalGraphProjectionConflict,
} from "./goal-graph-projection"
import type { WorkloadBrief } from "@/goal-workload-analyst/types"
import {
  ResearchBriefSchema,
  validateResearchBriefIntegrity,
  validateResearchBriefTaskBoundary,
  type ResearchBrief,
} from "@/research/schema"
import { ResearchPartialDraftSchema, type ResearchPartialDraft } from "@/research/output-tools"
import { renderSpecsAsText } from "@/acceptance/types"
import {
  RequirementCoverageDeclarationSchema,
  RequirementCoverageReceiptSchema,
  RequirementSetArtifactPayloadSchema,
  RequirementSetSchema,
  type RequirementCoverageIssue,
  type RequirementSet,
} from "@/requirements/types"
import { IntentAnalysisArtifactPayloadSchema, type IntentAnalysisArtifactPayload } from "@/intent-analysis/artifact"
import { assertTaskAssistantProducerMessage } from "./producer-turn"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import type { TaskArtifactRef } from "@opencorvus-ai/plugin/task-artifact"
import { FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE, FRONTEND_RESEARCH_BRIEF_PRODUCER } from "./artifact-catalog-constants"
import {
  FrontendResearchBriefArtifactPayloadSchema,
  parseFrontendResearchBriefArtifactEnvelope,
  type FrontendResearchVisualEvidence,
} from "@/research/frontend-research-artifact"
import { researchEvidenceRefsForArtifactLocators } from "@/research/evidence-ref-projection"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { classifyArchitectReferenceIntegrity } from "@/architect/reference-integrity"
import { artifactProvenanceForAgentTurn } from "@/agent/artifact-read-facts"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { findDispatchLineageByDispatchID } from "./dispatch-lineage"
import { taskRequestSHA256 } from "@/orchestrator/dispatch-turn-projection"

type EngineDatabaseConnection = Parameters<Parameters<typeof Database.transaction>[0]>[0]

const log = Log.create({ service: "engine-transition" })

function artifactConsumptionProvenance(input: {
  observedArtifactLocators?: readonly ArtifactReadLocator[]
  sourceArtifactLocators?: readonly ArtifactReadLocator[]
}) {
  return ArtifactConsumptionProvenanceSchema.parse({
    observed_artifact_locators: input.observedArtifactLocators ?? [],
    source_artifact_locators: input.sourceArtifactLocators ?? [],
  })
}

/**
 * Derive a human-readable slug from a goal title. Display-only — goal_id
 * remains the sole identity. Immutable once set.
 */
export function goalSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "goal"
  )
}

interface GoalRowInput {
  goalID?: string
  title: string
  objective: string
  acceptance_specs: import("@/acceptance/types").AcceptanceSpec[]
  owned_paths?: string[]
  kind?: string
  priority?: "blocking" | "advisory"
  source?: "spec" | "system"
  metadata?: Record<string, unknown>
}

function exactGoalArtifactBinding(
  db: Database.TxOrDb,
  input: {
    taskID: string
    artifactID: string | undefined
    kind: "requirement_set" | "architect_contract_graph" | "goal_graph_projection"
  },
): { id: string | null; revision: number | null; sha256: string | null } {
  if (!input.artifactID) return { id: null, revision: null, sha256: null }
  const row = db
    .select({
      id: EngineArtifactTable.id,
      taskID: EngineArtifactTable.task_id,
      kind: EngineArtifactTable.kind,
      sha256: EngineArtifactTable.payload_sha256,
      revision: EngineArtifactTable.catalog_revision,
    })
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, input.artifactID))
    .get()
  if (!row || row.taskID !== input.taskID || row.kind !== input.kind) {
    throw new Error(`Goal Artifact binding ${input.artifactID} is not a ${input.kind} fact in Task ${input.taskID}`)
  }
  return { id: row.id, revision: row.revision, sha256: row.sha256 }
}

export function persistRequirementSet(
  db: Database.TxOrDb,
  input: {
    taskID: string
    sessionID: string
    finalMessageID: string
    dispatchID: string
    requirementSet: RequirementSet
    finalization?: unknown
    now: number
  },
): {
  locator: EngineArtifactLocator
  deliveryStatus: "complete" | "incomplete"
} {
  const descriptor = WorkerTurnDescriptor.findForDispatch({
    sessionID: input.sessionID,
    dispatchID: input.dispatchID,
  })
  if (!descriptor) {
    throw new Error(
      `Requirements dispatch ${input.dispatchID} has no Worker Turn descriptor in Session ${input.sessionID}.`,
    )
  }
  if (descriptor.payload.lifecycle.taskID !== input.taskID) {
    throw new Error(
      `Requirements Worker Turn ${descriptor.id} belongs to Task ${descriptor.payload.lifecycle.taskID}, not ${input.taskID}.`,
    )
  }
  const lineage = findDispatchLineageByDispatchID({ taskID: input.taskID, dispatchID: input.dispatchID })
  if (!lineage || lineage.payload.child_session_id !== input.sessionID) {
    throw new Error(`Requirements dispatch ${input.dispatchID} has no exact child Session lineage for ${input.sessionID}.`)
  }
  const producer = assertTaskAssistantProducerMessage({
    taskID: input.taskID,
    sessionID: input.sessionID,
    messageID: input.finalMessageID,
    expectedSessionKind: "requirements",
    requireCompleted: true,
  })
  if (producer.parentID !== descriptor.payload.messageAuthority.user_message_id) {
    throw new Error(
      `Requirements final Message ${input.finalMessageID} is not the completed Turn for dispatch ${input.dispatchID}.`,
    )
  }
  const task = db
    .select({ request: EngineTaskTable.request })
    .from(EngineTaskTable)
    .where(eq(EngineTaskTable.id, input.taskID))
    .get()
  if (!task) throw new Error(`Requirements Task not found: ${input.taskID}`)
  const requirementSet = RequirementSetSchema.parse(input.requirementSet)
  const provenance = artifactProvenanceForAgentTurn(input.sessionID, input.finalMessageID)
  const declaration = input.finalization === undefined
    ? null
    : RequirementCoverageDeclarationSchema.parse(input.finalization)
  const requestSHA256 = taskRequestSHA256(task.request)
  const requirementIDs = requirementSet.requirements.map((requirement) => requirement.id).sort()
  const sourceLocators = [...provenance.sourceArtifactLocators].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  )
  const declaredRequirementIDs = [...(declaration?.requirement_ids ?? [])].sort()
  const declaredSourceLocators = [...(declaration?.source_artifact_locators ?? [])].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  )
  const durableSourceIdentities = new Set(sourceLocators.map((locator) => JSON.stringify(locator)))
  const requirementEvidenceMatchesTurn = requirementSet.requirements.every((requirement) =>
    requirement.evidence_refs.every((locator) => durableSourceIdentities.has(JSON.stringify(locator))),
  )
  const issues: RequirementCoverageIssue[] = []
  if (!declaration) issues.push("finalization_missing")
  if (declaration?.status === "incomplete") issues.push("declared_incomplete")
  if (requirementIDs.length === 0) issues.push("no_requirements_registered")
  if (declaration && declaration.request_sha256 !== requestSHA256) issues.push("request_identity_mismatch")
  if (declaration && !isDeepStrictEqual(declaredRequirementIDs, requirementIDs)) {
    issues.push("requirement_identity_mismatch")
  }
  if (declaration && !isDeepStrictEqual(declaredSourceLocators, sourceLocators)) {
    issues.push("source_identity_mismatch")
  }
  if (!requirementEvidenceMatchesTurn) issues.push("requirement_evidence_identity_mismatch")
  if ((declaration?.unresolved.length ?? 0) > 0) issues.push("unresolved_items")
  const deliveryStatus = issues.length === 0 ? "complete" : "incomplete"
  const coverageReceipt = RequirementCoverageReceiptSchema.parse({
    status: deliveryStatus,
    request_sha256: requestSHA256,
    requirement_ids: requirementIDs,
    source_artifact_locators: sourceLocators,
    unresolved: declaration?.unresolved ?? [],
    issues,
    declaration,
  })
  const id = Identifier.ascending("artifact")
  insertEngineArtifact(db, {
    id,
    taskID: input.taskID,
    kind: "requirement_set",
    label: "RequirementSet",
    payload: RequirementSetArtifactPayloadSchema.parse({
      schema_version: 2,
      ...requirementSet,
      producer: {
        session_id: input.sessionID,
        final_message_id: input.finalMessageID,
      },
      coverage_receipt: coverageReceipt,
      observed_artifact_locators: provenance.observedArtifactLocators,
      source_artifact_locators: provenance.sourceArtifactLocators,
    }),
    timeCreated: input.now,
  })
  const row = db
    .select({ revision: EngineArtifactTable.catalog_revision, sha256: EngineArtifactTable.payload_sha256 })
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, id))
    .get()
  if (!row) throw new Error(`RequirementSet Artifact ${id} was not persisted`)
  return {
    locator: {
      source: "engine_artifact",
      artifact_id: id,
      catalog_revision: row.revision,
      expected_sha256: row.sha256,
    },
    deliveryStatus,
  }
}

export function persistIntentAnalysisArtifact(
  db: Database.TxOrDb,
  input: {
    taskID: string
    sessionID: string
    finalMessageID: string
    payload: IntentAnalysisArtifactPayload
    now: number
  },
): EngineArtifactLocator {
  assertTaskAssistantProducerMessage({
    taskID: input.taskID,
    sessionID: input.sessionID,
    messageID: input.finalMessageID,
    expectedSessionKind: "intent-analysis",
    requireCompleted: true,
  })
  const payload = IntentAnalysisArtifactPayloadSchema.parse(input.payload)
  if (payload.producer.session_id !== input.sessionID || payload.producer.final_message_id !== input.finalMessageID) {
    throw new Error(
      "IntentAnalysis Artifact producer must match the exact completed Intent Analysis Session and final Message.",
    )
  }
  const id = insertEngineArtifact(db, {
    taskID: input.taskID,
    kind: "intent_analysis",
    label: "IntentAnalysis",
    payload,
    timeCreated: input.now,
  })
  const row = db
    .select({
      taskID: EngineArtifactTable.task_id,
      kind: EngineArtifactTable.kind,
      revision: EngineArtifactTable.catalog_revision,
      sha256: EngineArtifactTable.payload_sha256,
    })
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, id))
    .get()
  if (!row || row.taskID !== input.taskID || row.kind !== "intent_analysis") {
    throw new Error(`IntentAnalysis Artifact ${id} was not persisted in Task ${input.taskID}.`)
  }
  return {
    source: "engine_artifact",
    artifact_id: id,
    catalog_revision: row.revision,
    expected_sha256: row.sha256,
  }
}

type ArchitectGoalInput = GoalRowInput & { llmID: string }

export const ArchitectReferenceIntegrityError = NamedError.create(
  "ArchitectReferenceIntegrityError",
  z.object({
    code: z.enum([
      "unknown_requirement_ids",
      "unknown_contract_ids",
      "unselected_research_evidence_refs",
    ]),
    message: z.string().min(1),
    references: z.array(z.string().min(1)).min(1),
  }),
)

function exactArtifactLocatorBinding(
  db: Database.TxOrDb,
  input: {
    taskID: string
    locator: EngineArtifactLocator | undefined
    kind: "requirement_set" | "architect_contract_graph" | "goal_graph_projection"
  },
): {
  id: string | null
  revision: number | null
  sha256: string | null
  locator: EngineArtifactLocator | null
  row: ReturnType<typeof requireEngineArtifactByLocator> | null
} {
  if (!input.locator) return { id: null, revision: null, sha256: null, locator: null, row: null }
  const locator = EngineArtifactLocatorSchema.parse(input.locator)
  const row = requireEngineArtifactByLocator({
    db,
    taskID: input.taskID,
    locator,
  })
  if (row.kind !== input.kind) {
    throw new Error(
      `Architect exact ${input.kind} locator does not resolve in Task ${input.taskID}: ${JSON.stringify(locator)}`,
    )
  }
  return {
    id: row.id,
    revision: locator.catalog_revision,
    sha256: row.payload_sha256,
    locator,
    row,
  }
}

function parseGraphPayloadInTransaction(row: typeof EngineArtifactTable.$inferSelect) {
  assertEngineArtifactPayloadIdentity({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    payloadSHA256: row.payload_sha256,
    payloadBytes: row.payload_bytes,
  })
  return ArchitectContractGraphArtifactPayloadSchema.parse(row.payload)
}

function parseGoalGraphProjectionPayloadInTransaction(row: typeof EngineArtifactTable.$inferSelect) {
  assertEngineArtifactPayloadIdentity({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    payloadSHA256: row.payload_sha256,
    payloadBytes: row.payload_bytes,
  })
  return GoalGraphProjectionArtifactPayloadSchema.parse(row.payload)
}

function currentGoalGraphProjection(
  db: EngineDatabaseConnection,
  taskID: string,
):
  | {
      row: typeof EngineArtifactTable.$inferSelect
      payload: ReturnType<typeof parseGoalGraphProjectionPayloadInTransaction>
    }
  | undefined {
  const rows = db
    .select()
    .from(EngineArtifactTable)
    .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "goal_graph_projection")))
    .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
    .all()
  const tip = resolveGoalGraphProjectionTip(
    taskID,
    rows.map((row) => ({
      ...row,
      payload: parseGoalGraphProjectionPayloadInTransaction(row),
    })),
  )
  return tip ? { row: tip, payload: tip.payload } : undefined
}

export class GoalGraphProjectionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "GoalGraphProjectionConflictError"
  }
}

function assertCurrentPriorGoalGraphProjection(input: {
  current:
    | {
        row: typeof EngineArtifactTable.$inferSelect
        payload: ReturnType<typeof parseGoalGraphProjectionPayloadInTransaction>
      }
    | undefined
  selected: EngineArtifactLocator | null
  taskID: string
}) {
  if (!input.current && !input.selected) return
  if (
    !input.current ||
    !input.selected ||
    input.current.row.id !== input.selected.artifact_id ||
    input.current.row.payload_sha256 !== input.selected.expected_sha256
  ) {
    throw new GoalGraphProjectionConflictError(
      `Architect prior GoalGraph projection selection is stale for Task ${input.taskID}; ` +
        `current=${input.current ? `${input.current.row.id}@${input.current.row.payload_sha256}` : "(none)"}; ` +
        `selected=${input.selected ? `${input.selected.artifact_id}@${input.selected.expected_sha256}` : "(none)"}`,
    )
  }
}

function lineageRoot(goal: GoalRow, goalsByID: ReadonlyMap<string, GoalRow>): string {
  const visited = new Set<string>()
  let cursor = goal
  while (cursor.supersede_of) {
    if (visited.has(cursor.id)) {
      throw new Error(`Goal revision lineage cycle detected at ${cursor.id}`)
    }
    visited.add(cursor.id)
    const prior = goalsByID.get(cursor.supersede_of)
    if (!prior) {
      throw new Error(`Goal ${cursor.id} supersedes missing Goal ${cursor.supersede_of}`)
    }
    cursor = prior
  }
  return cursor.id
}

function normalizedGraphForComparison(graph: ArchitectContractGraph, mapGoalID: (goalID: string) => string) {
  const mapped = remapArchitectContractGraphGoalIDs(graph, mapGoalID)
  return {
    contracts: mapped.contracts
      .map((contract) => ({
        ...contract,
        consumer_goal_ids: [...contract.consumer_goal_ids].sort(),
        artifact_paths: [...contract.artifact_paths].sort(),
        evidence_refs: [...contract.evidence_refs].sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  }
}

function acceptanceContractIDs(goal: ArchitectGoalInput | GoalRow): Set<string> {
  return new Set(
    (goal.acceptance_specs ?? []).flatMap((spec) =>
      spec.scorers.flatMap((scorer) => (scorer.type === "contract_audit" ? scorer.spec.contract_ids : [])),
    ),
  )
}

function assertArchitectReferenceIntegrity(input: {
  goals: readonly ArchitectGoalInput[]
  graph: ArchitectContractGraph
  requirementSet: RequirementSet | undefined
  knownResearchEvidenceRefs: readonly string[]
}): void {
  const issue = classifyArchitectReferenceIntegrity({
    goals: input.goals,
    graph: input.graph,
    requirementIDs: input.requirementSet?.requirements.map((requirement) => requirement.id) ?? [],
    knownResearchEvidenceRefs: input.knownResearchEvidenceRefs,
  })[0]
  if (issue) throw new ArchitectReferenceIntegrityError(issue)
}

function relevantGraphSlice(
  graph: ReturnType<typeof normalizedGraphForComparison>,
  logicalGoalID: string,
  referencedContractIDs: ReadonlySet<string>,
) {
  return {
    contracts: graph.contracts.filter(
      (contract) =>
        contract.producer_goal_id === logicalGoalID ||
        contract.consumer_goal_ids.includes(logicalGoalID) ||
        referencedContractIDs.has(contract.id),
    ),
  }
}

function stableJSONStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJSONStringify).join(",")}]`
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    )
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJSONStringify(entry)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function goalContractSignature(input: {
  goal: ArchitectGoalInput | GoalRow
  requirementSetLocator: EngineArtifactLocator | null
  graphSlice: ReturnType<typeof relevantGraphSlice>
  fidelitySlice: ArchitectFidelityCoverage
  source: string
}): string {
  return stableJSONStringify({
    requirement_set_artifact_locator: input.requirementSetLocator,
    title: input.goal.title,
    objective: input.goal.objective,
    acceptance_specs: [...(input.goal.acceptance_specs ?? [])].sort((left, right) => left.id.localeCompare(right.id)),
    owned_paths: [...(input.goal.owned_paths ?? [])].sort(),
    kind: input.goal.kind ?? "feature",
    priority: input.goal.priority ?? "blocking",
    source: input.source,
    relevant_contract_graph_slice: input.graphSlice,
    fidelity: input.fidelitySlice,
  })
}

function mapArchitectFidelity(
  fidelity: ArchitectFidelityCoverage,
  mapGoalID: (goalID: string) => string,
): ArchitectFidelityCoverage {
  return {
    sourceCoverage: fidelity.sourceCoverage.map((row) => ({
      ...row,
      goal_ids: row.goal_ids.map(mapGoalID),
    })),
    referenceCoverage: fidelity.referenceCoverage.map((row) => ({
      ...row,
      goal_ids: row.goal_ids.map(mapGoalID),
    })),
    assemblyOwners: fidelity.assemblyOwners.map((row) => ({
      ...row,
      goal_id: mapGoalID(row.goal_id),
    })),
  }
}

function goalFidelitySlice(
  fidelity: ArchitectFidelityCoverage,
  goalID: string,
  mapGoalID: (goalID: string) => string,
): ArchitectFidelityCoverage {
  const mappedGoalID = mapGoalID(goalID)
  return {
    sourceCoverage: fidelity.sourceCoverage
      .filter((row) => row.goal_ids.map(mapGoalID).includes(mappedGoalID))
      .map((row) => ({
        ...row,
        paths: [...row.paths].sort(),
        goal_ids: row.goal_ids.map(mapGoalID).sort(),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    referenceCoverage: fidelity.referenceCoverage
      .filter((row) => row.goal_ids.map(mapGoalID).includes(mappedGoalID))
      .map((row) => ({
        ...row,
        goal_ids: row.goal_ids.map(mapGoalID).sort(),
        visual_spec_ids: [...row.visual_spec_ids].sort(),
        reference_regions: [...row.reference_regions].sort((left, right) =>
          left.reference_region_key.localeCompare(right.reference_region_key),
        ),
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    assemblyOwners: fidelity.assemblyOwners
      .filter((row) => mapGoalID(row.goal_id) === mappedGoalID)
      .map((row) => ({ ...row, goal_id: mapGoalID(row.goal_id) }))
      .sort((left, right) => left.surface.localeCompare(right.surface)),
  }
}

function insertedEngineArtifactLocator(
  db: EngineDatabaseConnection,
  input: {
    taskID: string
    artifactID: string
    kind: "architect_contract_graph" | "goal_graph_projection"
  },
): EngineArtifactLocator {
  const binding = exactGoalArtifactBinding(db, {
    taskID: input.taskID,
    artifactID: input.artifactID,
    kind: input.kind,
  })
  if (!binding.id || typeof binding.revision !== "number" || typeof binding.sha256 !== "string") {
    throw new Error(`Inserted ${input.kind} ${input.artifactID} has no canonical SHA-256 digest`)
  }
  return EngineArtifactLocatorSchema.parse({
    source: "engine_artifact",
    artifact_id: binding.id,
    catalog_revision: binding.revision,
    expected_sha256: binding.sha256,
  })
}

function selectedPriorProjection(
  db: EngineDatabaseConnection,
  input: {
    taskID: string
    locator?: EngineArtifactLocator
  },
) {
  const binding = exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator: input.locator,
    kind: "goal_graph_projection",
  })
  if (!binding.id) return undefined
  const row = binding.row!
  const payload = parseGoalGraphProjectionPayloadInTransaction(row)
  if (payload.projection === null) {
    throw new Error(`Architect prior GoalGraph projection ${binding.id} is a non-executable Candidate.`)
  }
  return {
    row,
    payload,
    locator: binding.locator!,
  }
}

function exactPriorContractGraphFromProjection(
  db: EngineDatabaseConnection,
  input: {
    taskID: string
    priorProjection?: ReturnType<typeof selectedPriorProjection>
  },
) {
  const locator = input.priorProjection?.payload.contract_graph_artifact_locator ?? undefined
  return exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator,
    kind: "architect_contract_graph",
  })
}

export function persistArchitectUnprojectableGoalGraphCandidate(
  db: EngineDatabaseConnection,
  input: {
    taskID: string
    producer: ArchitectTurnProducer
    requirementSetArtifactLocator?: EngineArtifactLocator
    priorGoalGraphProjectionArtifactLocator?: EngineArtifactLocator
    observedArtifactLocators?: ArtifactReadLocator[]
    sourceArtifactLocators?: ArtifactReadLocator[]
    architectGoals: ArchitectGoalInput[]
    removals: GoalGraphRemoval[]
    graph: ArchitectContractGraph
    fidelity: ArchitectFidelityCoverage
    conflicts: GoalGraphProjectionConflict[]
    now: number
  },
): {
  contractGraphArtifactLocator: EngineArtifactLocator
  candidateProjectionArtifactLocator: EngineArtifactLocator
} {
  const requirementSet = exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator: input.requirementSetArtifactLocator,
    kind: "requirement_set",
  })
  const graph = ArchitectContractGraphSchema.parse(input.graph)
  const selectedPrior = selectedPriorProjection(db, {
    taskID: input.taskID,
    locator: input.priorGoalGraphProjectionArtifactLocator,
  })
  const priorContractGraph = exactPriorContractGraphFromProjection(db, {
    taskID: input.taskID,
    priorProjection: selectedPrior,
  })
  const current = currentGoalGraphProjection(db, input.taskID)
  const currentLocator = current
    ? EngineArtifactLocatorSchema.parse({
        source: "engine_artifact",
        artifact_id: current.row.id,
        catalog_revision: current.row.catalog_revision,
        expected_sha256: current.row.payload_sha256,
      })
    : null
  const stalePrior =
    (current === undefined && selectedPrior !== undefined) ||
    (current !== undefined &&
      (selectedPrior === undefined ||
        current.row.id !== selectedPrior.row.id ||
        current.row.payload_sha256 !== selectedPrior.row.payload_sha256))
  const conflicts = stalePrior
    ? [
        ...input.conflicts,
        {
          code: "stale_prior_projection" as const,
          message:
            `Completed Architect turn selected ${selectedPrior?.row.id ?? "no prior projection"} ` +
            `while the observed current GoalGraph projection is ${current?.row.id ?? "absent"}.`,
        },
      ]
    : input.conflicts
  if (conflicts.length === 0) {
    throw new Error("A non-projected Architect candidate must include a structured conflict")
  }
  const contractGraphArtifactID = Identifier.ascending("artifact")
  const graphPayload = ArchitectContractGraphArtifactPayloadSchema.parse({
    producer: input.producer,
    requirement_set_artifact_locator: requirementSet.locator,
    prior_contract_graph_artifact_locator: priorContractGraph.locator,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    graph,
    fidelity: input.fidelity,
  })
  insertEngineArtifact(db, {
    id: contractGraphArtifactID,
    taskID: input.taskID,
    kind: "architect_contract_graph",
    label: "ArchitectContractGraph",
    payload: graphPayload,
    timeCreated: input.now,
  })
  const contractGraphArtifactLocator = insertedEngineArtifactLocator(db, {
    taskID: input.taskID,
    artifactID: contractGraphArtifactID,
    kind: "architect_contract_graph",
  })
  const projectionArtifactID = Identifier.ascending("artifact")
  const projectionPayload = GoalGraphProjectionArtifactPayloadSchema.parse({
    producer: input.producer,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    prior_projection_artifact_locator: selectedPrior?.locator ?? null,
    contract_graph_artifact_locator: contractGraphArtifactLocator,
    projection: null,
    projected_goals: [],
    candidate_goals: input.architectGoals.map((goal) => ({
      id: goal.llmID,
      title: goal.title,
      objective: goal.objective,
      acceptance_specs: goal.acceptance_specs,
      owned_paths: goal.owned_paths ?? [],
      priority: goal.priority ?? "blocking",
      kind: goal.kind ?? "feature",
      source: goal.source ?? "spec",
    })),
    candidate_removals: input.removals,
    findings: [],
    conflicts,
    observed_current_projection_artifact_locator: currentLocator,
  })
  insertEngineArtifact(db, {
    id: projectionArtifactID,
    taskID: input.taskID,
    kind: "goal_graph_projection",
    label: "GoalGraphCandidate",
    payload: projectionPayload,
    timeCreated: input.now,
  })
  return {
    contractGraphArtifactLocator,
    candidateProjectionArtifactLocator: insertedEngineArtifactLocator(db, {
      taskID: input.taskID,
      artifactID: projectionArtifactID,
      kind: "goal_graph_projection",
    }),
  }
}

/**
 * Persist one Architect domain graph and its executable Goal membership in one
 * caller-owned SQLite transaction. Unchanged Goal rows are reused exactly;
 * only changed/new contracts receive a new immutable execution identity.
 */
export function persistArchitectGoalProjection(
  db: EngineDatabaseConnection,
  input: {
    taskID: string
    producer: ArchitectTurnProducer
    requirementSetArtifactLocator?: EngineArtifactLocator
    priorGoalGraphProjectionArtifactLocator?: EngineArtifactLocator
    observedArtifactLocators?: ArtifactReadLocator[]
    sourceArtifactLocators?: ArtifactReadLocator[]
    architectGoals: ArchitectGoalInput[]
    removals: GoalGraphRemoval[]
    graph: ArchitectContractGraph
    fidelity: ArchitectFidelityCoverage
    now: number
  },
): {
  contractGraphArtifactLocator: EngineArtifactLocator
  goalGraphProjectionArtifactLocator: EngineArtifactLocator
  persisted: Array<{
    id: string
    title: string
    llmID: string
    acceptance_specs: GoalRowInput["acceptance_specs"]
  }>
  llmToDBID: Map<string, string>
  mappedFidelity: ArchitectFidelityCoverage
} {
  const graph = ArchitectContractGraphSchema.parse(input.graph)
  const removals = input.removals.map((removal) => GoalGraphRemovalSchema.parse(removal))
  const duplicateGoalIDs = input.architectGoals
    .map((goal) => goal.llmID)
    .filter((goalID, index, all) => all.indexOf(goalID) !== index)
  if (duplicateGoalIDs.length > 0) {
    throw new Error(`Architect Goal graph contains duplicate Goal IDs: ${[...new Set(duplicateGoalIDs)].join(", ")}`)
  }
  const duplicateRemovalIDs = removals
    .map((removal) => removal.goal_id)
    .filter((goalID, index, all) => all.indexOf(goalID) !== index)
  if (duplicateRemovalIDs.length > 0) {
    throw new Error(`Architect Goal graph contains duplicate removals: ${[...new Set(duplicateRemovalIDs)].join(", ")}`)
  }

  const requirementSet = exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator: input.requirementSetArtifactLocator,
    kind: "requirement_set",
  })
  assertArchitectReferenceIntegrity({
    goals: input.architectGoals,
    graph,
    requirementSet: requirementSet.row?.payload as RequirementSet | undefined,
    knownResearchEvidenceRefs: researchEvidenceRefsForArtifactLocators({
      db,
      taskID: input.taskID,
      artifactLocators: input.sourceArtifactLocators ?? [],
    }),
  })
  const selectedPrior = selectedPriorProjection(db, {
    taskID: input.taskID,
    locator: input.priorGoalGraphProjectionArtifactLocator,
  })
  const currentProjection = currentGoalGraphProjection(db, input.taskID)
  assertCurrentPriorGoalGraphProjection({
    current: currentProjection,
    selected: selectedPrior?.locator ?? null,
    taskID: input.taskID,
  })
  const priorContractGraph = exactPriorContractGraphFromProjection(db, {
    taskID: input.taskID,
    priorProjection: selectedPrior,
  })
  const priorGraphRow = priorContractGraph.row ?? undefined
  const priorGraphPayload = priorGraphRow ? parseGraphPayloadInTransaction(priorGraphRow) : undefined

  const allGoals = db.select().from(EngineGoalTable).where(eq(EngineGoalTable.task_id, input.taskID)).all()
  const allGoalsByID = new Map(allGoals.map((goal) => [goal.id, goal]))
  const currentGoalIDs = currentProjection?.payload.projection?.goal_revision_ids ?? []
  const currentGoalsByID = new Map(
    currentGoalIDs.map((goalID) => {
      const goal = allGoalsByID.get(goalID)
      if (!goal) {
        throw new Error(`Current GoalGraph projection ${currentProjection?.row.id} references missing Goal ${goalID}`)
      }
      return [goalID, goal] as const
    }),
  )
  const returnedExistingIDs = new Set(
    input.architectGoals.map((goal) => goal.llmID).filter((goalID) => currentGoalsByID.has(goalID)),
  )
  const durableRemovalIDs = new Set(removals.map((removal) => removal.goal_id))
  const unknownRemovalIDs = [...durableRemovalIDs].filter((goalID) => !currentGoalsByID.has(goalID))
  if (unknownRemovalIDs.length > 0) {
    throw new Error(`Architect Goal graph removes non-current Goal revisions: ${unknownRemovalIDs.join(", ")}`)
  }
  const overlap = [...returnedExistingIDs].filter((goalID) => durableRemovalIDs.has(goalID))
  if (overlap.length > 0) {
    throw new Error(`Architect Goal graph both returns and removes Goal revisions: ${overlap.join(", ")}`)
  }
  const omittedPriorGoals = currentGoalIDs.filter(
    (goalID) => !returnedExistingIDs.has(goalID) && !durableRemovalIDs.has(goalID),
  )
  if (omittedPriorGoals.length > 0) {
    throw new Error(
      `Architect Goal graph omitted prior Goal revisions without structured removals: ${omittedPriorGoals.join(", ")}`,
    )
  }
  const historicalAliasCollisions = input.architectGoals
    .map((goal) => goal.llmID)
    .filter((goalID) => allGoalsByID.has(goalID) && !currentGoalsByID.has(goalID))
  if (historicalAliasCollisions.length > 0) {
    throw new Error(
      `Architect Goal graph references non-current Goal revisions: ${historicalAliasCollisions.join(", ")}`,
    )
  }

  for (const goal of input.architectGoals) {
    const internalRuntimePaths = ProjectRuntimePaths.internalRuntimeRelativePaths(goal.owned_paths ?? [])
    if (internalRuntimePaths.length > 0) {
      throw new Error(
        `persistArchitectGoalProjection: goal ${goal.llmID} owned_paths include internal OpenCorvus runtime path(s): ` +
          internalRuntimePaths.join(", "),
      )
    }
  }

  const logicalIDByInputID = new Map(
    input.architectGoals.map((goal) => {
      const existing = currentGoalsByID.get(goal.llmID)
      return [goal.llmID, existing ? lineageRoot(existing, allGoalsByID) : goal.llmID] as const
    }),
  )
  const mapInputToLogicalID = (goalID: string) => {
    const mapped = logicalIDByInputID.get(goalID)
    if (!mapped) throw new Error(`Architect graph references unknown Goal ${goalID}`)
    return mapped
  }
  const priorGraphForComparison = priorGraphPayload
    ? normalizedGraphForComparison(priorGraphPayload.graph, (goalID) => {
        const goal = allGoalsByID.get(goalID)
        if (!goal) throw new Error(`Prior ContractGraph references missing Goal ${goalID}`)
        return lineageRoot(goal, allGoalsByID)
      })
    : normalizedGraphForComparison({ contracts: [] }, (goalID) => goalID)
  const nextGraphForComparison = normalizedGraphForComparison(graph, mapInputToLogicalID)

  const llmToDBID = new Map<string, string>()
  const changedExistingIDs = new Set<string>()
  for (const goal of input.architectGoals) {
    const existing = currentGoalsByID.get(goal.llmID)
    if (!existing) continue
    const logicalGoalID = lineageRoot(existing, allGoalsByID)
    const priorRequirementLocator =
      existing.requirement_set_artifact_id && existing.requirement_set_artifact_sha256
        ? EngineArtifactLocatorSchema.parse({
            source: "engine_artifact",
            artifact_id: existing.requirement_set_artifact_id,
            catalog_revision: existing.requirement_set_artifact_revision,
            expected_sha256: existing.requirement_set_artifact_sha256,
          })
        : null
    const priorSignature = goalContractSignature({
      goal: existing,
      requirementSetLocator: priorRequirementLocator,
      graphSlice: relevantGraphSlice(priorGraphForComparison, logicalGoalID, acceptanceContractIDs(existing)),
      fidelitySlice: goalFidelitySlice(
        priorGraphPayload?.fidelity ?? emptyArchitectFidelityState(),
        existing.id,
        (goalID) => {
          const row = allGoalsByID.get(goalID)
          if (!row) throw new Error(`Prior GoalGraph fidelity references missing Goal ${goalID}`)
          return lineageRoot(row, allGoalsByID)
        },
      ),
      source: existing.source,
    })
    const nextSource = goal.source ?? "spec"
    const nextSignature = goalContractSignature({
      goal,
      requirementSetLocator: requirementSet.locator,
      graphSlice: relevantGraphSlice(nextGraphForComparison, logicalGoalID, acceptanceContractIDs(goal)),
      fidelitySlice: goalFidelitySlice(input.fidelity, goal.llmID, mapInputToLogicalID),
      source: nextSource,
    })
    if (priorSignature === nextSignature) {
      llmToDBID.set(goal.llmID, existing.id)
    } else {
      llmToDBID.set(goal.llmID, Identifier.ascending("goal"))
      changedExistingIDs.add(goal.llmID)
    }
  }
  for (const goal of input.architectGoals) {
    if (!llmToDBID.has(goal.llmID)) {
      const durableID = goal.goalID ?? Identifier.ascending("goal")
      if (allGoalsByID.has(durableID) || [...llmToDBID.values()].includes(durableID)) {
        throw new Error(`Architect Goal graph durable Goal ID already exists: ${durableID}`)
      }
      llmToDBID.set(goal.llmID, durableID)
    }
  }

  const mapInputToDurableID = (goalID: string) => {
    const mapped = llmToDBID.get(goalID)
    if (!mapped) throw new Error(`Architect output references unknown Goal ${goalID}`)
    return mapped
  }
  const mappedGraph = remapArchitectContractGraphGoalIDs(graph, mapInputToDurableID)
  const mappedGoals = input.architectGoals.map((goal) => ({
    input: goal,
    id: mapInputToDurableID(goal.llmID),
  }))
  const mappedFidelity = mapArchitectFidelity(input.fidelity, mapInputToDurableID)
  const durableRemovals = removals
  const contractGraphArtifactID = Identifier.ascending("artifact")
  const graphPayload = ArchitectContractGraphArtifactPayloadSchema.parse({
    producer: input.producer,
    requirement_set_artifact_locator: requirementSet.locator,
    prior_contract_graph_artifact_locator: priorContractGraph.locator,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    graph: mappedGraph,
    fidelity: mappedFidelity,
  })
  insertEngineArtifact(db, {
    id: contractGraphArtifactID,
    taskID: input.taskID,
    kind: "architect_contract_graph",
    label: "ArchitectContractGraph",
    payload: graphPayload,
    timeCreated: input.now,
  })
  const contractGraphArtifactLocator = insertedEngineArtifactLocator(db, {
    taskID: input.taskID,
    artifactID: contractGraphArtifactID,
    kind: "architect_contract_graph",
  })
  const projectionArtifactID = Identifier.ascending("artifact")
  const projectionPayload = GoalGraphProjectionArtifactPayloadSchema.parse({
    producer: input.producer,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    prior_projection_artifact_locator: selectedPrior?.locator ?? null,
    contract_graph_artifact_locator: contractGraphArtifactLocator,
    projection: {
      goal_revision_ids: mappedGoals.map((goal) => goal.id),
      removals: durableRemovals,
    },
    projected_goals: mappedGoals.map((goal) => {
      const materialized = allGoalsByID.get(goal.id)
      return materialized
        ? {
            id: materialized.id,
            title: materialized.title,
            objective: materialized.objective,
            acceptance_specs: materialized.acceptance_specs,
            owned_paths: materialized.owned_paths,
            priority: materialized.priority,
            kind: materialized.kind,
            source: materialized.source,
          }
        : {
            id: goal.id,
            title: goal.input.title,
            objective: goal.input.objective,
            acceptance_specs: goal.input.acceptance_specs,
            owned_paths: goal.input.owned_paths ?? [],
            priority: goal.input.priority ?? "blocking",
            kind: goal.input.kind ?? "feature",
            source: goal.input.source ?? "spec",
          }
    }),
    candidate_goals: [],
    candidate_removals: [],
    findings: [],
    conflicts: [],
    observed_current_projection_artifact_locator: null,
  })
  insertEngineArtifact(db, {
    id: projectionArtifactID,
    taskID: input.taskID,
    kind: "goal_graph_projection",
    label: "GoalGraphProjection",
    payload: projectionPayload,
    timeCreated: input.now,
  })
  const goalGraphProjectionArtifactLocator = insertedEngineArtifactLocator(db, {
    taskID: input.taskID,
    artifactID: projectionArtifactID,
    kind: "goal_graph_projection",
  })

  let nextOrderIndex = allGoals.reduce((maximum, goal) => Math.max(maximum, goal.order_index), -1) + 1
  for (const mapped of mappedGoals) {
    const existing = currentGoalsByID.get(mapped.input.llmID)
    const unchanged = existing?.id === mapped.id
    if (unchanged) continue
    db.insert(EngineGoalTable)
      .values({
        id: mapped.id,
        task_id: input.taskID,
        requirement_set_artifact_id: requirementSet.id,
        requirement_set_artifact_revision: requirementSet.revision,
        requirement_set_artifact_sha256: requirementSet.sha256,
        contract_graph_artifact_id: contractGraphArtifactLocator.artifact_id,
        contract_graph_artifact_revision: contractGraphArtifactLocator.catalog_revision,
        contract_graph_artifact_sha256: contractGraphArtifactLocator.expected_sha256,
        title: mapped.input.title,
        slug: goalSlug(mapped.input.title),
        objective: mapped.input.objective,
        acceptance_specs: mapped.input.acceptance_specs,
        owned_paths: mapped.input.owned_paths ?? [],
        kind: mapped.input.kind ?? "feature",
        metadata: {
          ...(existing?.metadata ?? {}),
          ...(mapped.input.metadata ?? {}),
        },
        priority: mapped.input.priority ?? "blocking",
        source: mapped.input.source ?? "spec",
        supersede_of: changedExistingIDs.has(mapped.input.llmID) ? mapped.input.llmID : null,
        order_index: existing?.order_index ?? nextOrderIndex++,
        time_created: input.now,
        time_updated: input.now,
      })
      .run()
  }

  const insertedGoalIDs = new Set(
    db
      .select({ id: EngineGoalTable.id })
      .from(EngineGoalTable)
      .where(eq(EngineGoalTable.task_id, input.taskID))
      .all()
      .map((goal) => goal.id),
  )
  const projection = projectionPayload.projection
  if (!projection) throw new Error("Projected Architect Goal graph unexpectedly has a null projection")
  const missingProjectionGoals = projection.goal_revision_ids.filter((goalID) => !insertedGoalIDs.has(goalID))
  if (missingProjectionGoals.length > 0) {
    throw new Error(`GoalGraph projection references unpersisted Goal revisions: ${missingProjectionGoals.join(", ")}`)
  }
  return {
    contractGraphArtifactLocator,
    goalGraphProjectionArtifactLocator,
    persisted: mappedGoals.map((goal) => ({
      id: goal.id,
      title: goal.input.title,
      llmID: goal.input.llmID,
      acceptance_specs: goal.input.acceptance_specs,
    })),
    llmToDBID,
    mappedFidelity,
  }
}

type GoalMutationContractValues = Partial<
  Pick<
    typeof EngineGoalTable.$inferInsert,
    "title" | "objective" | "acceptance_specs" | "owned_paths" | "priority" | "kind"
  >
>

export type ApplyGoalGraphMutationInput = {
  taskID: string
  producer: GoalGraphMutationProducer
  now?: number
  mutation:
    | { operation: "add"; goal: GoalRowInput }
    | { operation: "modify"; goalID: string; values: GoalMutationContractValues }
    | { operation: "remove"; goalID: string }
}

export type ApplyGoalGraphMutationResult =
  | {
      status: "unchanged"
      goalID: string
      goalGraphProjectionArtifactLocator: EngineArtifactLocator
    }
  | {
      status: "applied"
      goalID?: string
      supersedeOf?: string
      goalGraphProjectionArtifactLocator: EngineArtifactLocator
    }

/**
 * Apply one operator or Orchestrator Goal command through the sole immutable
 * membership writer. This function owns the transaction; callers cannot
 * commit a Goal revision without its exact projection or vice versa.
 */
export function applyGoalGraphMutation(input: ApplyGoalGraphMutationInput): ApplyGoalGraphMutationResult {
  return Database.transaction((db) => applyGoalGraphMutationInTransaction(db, input))
}

export function applyGoalGraphMutationInTransaction(
  db: Database.TxOrDb,
  input: ApplyGoalGraphMutationInput,
): ApplyGoalGraphMutationResult {
  if (input.producer.operation !== input.mutation.operation) {
    throw new Error(
      `GoalGraph producer operation ${input.producer.operation} does not match mutation ${input.mutation.operation}`,
    )
  }
  const now = input.now ?? Date.now()
  const current = currentGoalGraphProjection(db, input.taskID)
  const currentLocator = current
    ? EngineArtifactLocatorSchema.parse({
        source: "engine_artifact",
        artifact_id: current.row.id,
        catalog_revision: current.row.catalog_revision,
        expected_sha256: current.row.payload_sha256,
      })
    : null
  const currentGoalIDs = current?.payload.projection?.goal_revision_ids ?? []
  const allGoals = db.select().from(EngineGoalTable).where(eq(EngineGoalTable.task_id, input.taskID)).all()
  const goalsByID = new Map(allGoals.map((goal) => [goal.id, goal]))
  const currentGoalsByID = new Map(
    currentGoalIDs.map((goalID) => {
      const goal = goalsByID.get(goalID)
      if (!goal) {
        throw new Error(`Current GoalGraph projection ${current?.row.id} references missing Goal ${goalID}`)
      }
      return [goalID, goal] as const
    }),
  )
  const graphBinding = exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator: current?.payload.contract_graph_artifact_locator ?? undefined,
    kind: "architect_contract_graph",
  })
  const graphRow = graphBinding.row ?? undefined
  const graphPayload = graphRow ? parseGraphPayloadInTransaction(graphRow) : undefined
  const requirementSet = exactArtifactLocatorBinding(db, {
    taskID: input.taskID,
    locator: graphPayload?.requirement_set_artifact_locator ?? undefined,
    kind: "requirement_set",
  })
  const nextMembership = [...currentGoalIDs]
  let goalID: string | undefined
  let supersedeOf: string | undefined
  let removals: GoalGraphRemoval[] = []
  const nextGoalRows: GoalRow[] = []
  let finding:
    | {
        code:
          | "architect_graph_not_reauthored_after_goal_add"
          | "architect_graph_not_reauthored_after_goal_modify"
          | "architect_graph_references_removed_goal"
        message: string
      }
    | undefined

  const insertRevision = (goal: GoalRow, values: GoalMutationContractValues, reason: string) => {
    const id = Identifier.ascending("goal")
    const title = values.title ?? goal.title
    db.insert(EngineGoalTable)
      .values({
        ...goal,
        id,
        title,
        slug: title === goal.title ? goal.slug : goalSlug(title),
        objective: values.objective ?? goal.objective,
        acceptance_specs: values.acceptance_specs ?? goal.acceptance_specs,
        owned_paths: values.owned_paths ?? goal.owned_paths,
        priority: values.priority ?? goal.priority,
        kind: values.kind ?? goal.kind,
        requirement_set_artifact_id: requirementSet.id,
        requirement_set_artifact_revision: requirementSet.revision,
        requirement_set_artifact_sha256: requirementSet.sha256,
        contract_graph_artifact_id: graphBinding.id,
        contract_graph_artifact_revision: graphBinding.revision,
        contract_graph_artifact_sha256: graphBinding.sha256,
        supersede_of: goal.id,
        metadata: {
          ...(goal.metadata ?? {}),
          revision_reason: reason,
        },
        time_created: now,
        time_updated: now,
      })
      .run()
    const inserted = db.select().from(EngineGoalTable).where(eq(EngineGoalTable.id, id)).get()
    if (!inserted) throw new Error(`Goal revision ${id} was not persisted`)
    goalsByID.set(id, inserted)
    nextGoalRows.push(inserted)
    return inserted
  }

  if (input.mutation.operation === "add") {
    const id = input.mutation.goal.goalID ?? Identifier.ascending("goal")
    if (goalsByID.has(id)) throw new Error(`GoalGraph add Goal ID already exists: ${id}`)
    const orderIndex = allGoals.reduce((maximum, goal) => Math.max(maximum, goal.order_index), -1) + 1
    db.insert(EngineGoalTable)
      .values({
        id,
        task_id: input.taskID,
        requirement_set_artifact_id: requirementSet.id,
        requirement_set_artifact_revision: requirementSet.revision,
        requirement_set_artifact_sha256: requirementSet.sha256,
        contract_graph_artifact_id: graphBinding.id,
        contract_graph_artifact_revision: graphBinding.revision,
        contract_graph_artifact_sha256: graphBinding.sha256,
        title: input.mutation.goal.title,
        slug: goalSlug(input.mutation.goal.title),
        objective: input.mutation.goal.objective,
        acceptance_specs: input.mutation.goal.acceptance_specs,
        owned_paths: input.mutation.goal.owned_paths ?? [],
        kind: input.mutation.goal.kind ?? "feature",
        metadata: input.mutation.goal.metadata ?? {},
        priority: input.mutation.goal.priority ?? "blocking",
        source: input.mutation.goal.source ?? "system",
        supersede_of: null,
        order_index: orderIndex,
        time_created: now,
        time_updated: now,
      })
      .run()
    const inserted = db.select().from(EngineGoalTable).where(eq(EngineGoalTable.id, id)).get()
    if (!inserted) throw new Error(`Goal ${id} was not persisted`)
    goalsByID.set(id, inserted)
    nextGoalRows.push(inserted)
    nextMembership.push(id)
    goalID = id
    finding = {
      code: "architect_graph_not_reauthored_after_goal_add",
      message: `Goal ${id} was added by ${input.producer.kind}; the referenced Architect graph was not rewritten by this command.`,
    }
  } else {
    const target = currentGoalsByID.get(input.mutation.goalID)
    if (!target) {
      throw new Error(`Goal ${input.mutation.goalID} is not an exact member of the current GoalGraph`)
    }
    if (input.producer.target_goal_id !== null && input.producer.target_goal_id !== target.id) {
      throw new Error(
        `GoalGraph producer target ${input.producer.target_goal_id} does not match mutation target ${target.id}`,
      )
    }
    const targetIndex = nextMembership.indexOf(target.id)
    if (input.mutation.operation === "modify") {
      const values = input.mutation.values
      const changed = Object.entries(values).some(
        ([key, value]) =>
          value !== undefined && stableJSONStringify(value) !== stableJSONStringify(target[key as keyof GoalRow]),
      )
      if (!changed) {
        if (!currentLocator) {
          throw new Error(`Goal ${target.id} has no current GoalGraph projection`)
        }
        return {
          status: "unchanged",
          goalID: target.id,
          goalGraphProjectionArtifactLocator: currentLocator,
        }
      }
      const revised = insertRevision(target, values, input.producer.reason)
      nextMembership[targetIndex] = revised.id
      goalID = revised.id
      supersedeOf = target.id
      finding = {
        code: "architect_graph_not_reauthored_after_goal_modify",
        message: `Goal ${target.id} was revised as ${revised.id} by ${input.producer.kind}; the referenced Architect graph remains immutable provenance.`,
      }
    } else {
      nextMembership.splice(targetIndex, 1)
      removals = [{ goal_id: target.id, reason: input.producer.reason }]
      goalID = target.id
      finding = {
        code: "architect_graph_references_removed_goal",
        message: `Goal ${target.id} was removed by ${input.producer.kind}; any references in the immutable Architect graph remain visible until Architect re-entry.`,
      }
    }
  }

  const projectionArtifactID = Identifier.ascending("artifact")
  const projectionPayload = GoalGraphProjectionArtifactPayloadSchema.parse({
    producer: input.producer,
    observed_artifact_locators: [],
    source_artifact_locators: [],
    prior_projection_artifact_locator: currentLocator,
    contract_graph_artifact_locator: current?.payload.contract_graph_artifact_locator ?? null,
    projection: {
      goal_revision_ids: nextMembership,
      removals,
    },
    projected_goals: nextMembership.map((goalID) => {
      const goal = goalsByID.get(goalID)
      if (!goal) throw new Error(`GoalGraph projection references missing Goal ${goalID}`)
      return {
        id: goal.id,
        title: goal.title,
        objective: goal.objective,
        acceptance_specs: goal.acceptance_specs,
        owned_paths: goal.owned_paths,
        priority: goal.priority,
        kind: goal.kind,
        source: goal.source,
      }
    }),
    candidate_goals: [],
    candidate_removals: [],
    findings: finding ? [finding] : [],
    conflicts: [],
    observed_current_projection_artifact_locator: null,
  })
  insertEngineArtifact(db, {
    id: projectionArtifactID,
    taskID: input.taskID,
    kind: "goal_graph_projection",
    label: "GoalGraphProjection",
    payload: projectionPayload,
    timeCreated: now,
  })
  const goalGraphProjectionArtifactLocator = insertedEngineArtifactLocator(db, {
    taskID: input.taskID,
    artifactID: projectionArtifactID,
    kind: "goal_graph_projection",
  })
  return {
    status: "applied",
    goalID,
    supersedeOf,
    goalGraphProjectionArtifactLocator,
  }
}

export function persistGoalWorkloadForDomainRefs(
  db: Database.TxOrDb,
  input: {
    taskID: string
    sessionID: string
    finalMessageID: string
    observedArtifactLocators?: ArtifactReadLocator[]
    sourceArtifactLocators?: ArtifactReadLocator[]
    briefs: WorkloadBrief[]
    now: number
  },
) {
  const id = Identifier.ascending("artifact")
  const provenance = artifactConsumptionProvenance(input)
  insertEngineArtifact(db, {
    id,
    taskID: input.taskID,
    kind: "goal_workload",
    label: "WorkloadBrief",
    payload: {
      briefs: input.briefs,
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
      ...provenance,
    },
    timeCreated: input.now,
  })
  return id
}

export function persistResearchBrief(
  db: Database.TxOrDb,
  input: {
    taskID: string
    goalID?: string
    brief: ResearchBrief
    observedArtifactLocators?: ArtifactReadLocator[]
    sourceArtifactLocators?: ArtifactReadLocator[]
    now: number
  },
) {
  return persistResearchBriefArtifact(db, {
    ...input,
    kind: "research_brief",
  })
}

export function persistFrontendResearchBrief(
  db: Database.TxOrDb,
  input: {
    taskID: string
    goalID?: string
    brief: ResearchBrief
    observedArtifactLocators?: ArtifactReadLocator[]
    sourceArtifactLocators?: ArtifactReadLocator[]
    artifactResources: {
      resources: readonly TaskArtifactRef[]
      resourceRoles: {
        full_markdown: number
        evidence_json: number
        citation_map: number
      }
      visualEvidence: readonly FrontendResearchVisualEvidence[]
    }
    now: number
  },
) {
  return persistResearchBriefArtifact(db, {
    ...input,
    kind: "frontend_research_brief",
  })
}

export class ResearchArtifactContractError extends Error {
  readonly issues: readonly {
    code: "research_brief_integrity" | "research_brief_task_boundary"
    path: readonly (string | number)[]
    message: string
  }[]

  constructor(input: {
    artifactKind: "research_brief" | "frontend_research_brief"
    code: "research_brief_integrity" | "research_brief_task_boundary"
    path: readonly (string | number)[]
    message: string
  }) {
    super(`${input.artifactKind}: ${input.message}`)
    this.name = "ResearchArtifactContractError"
    this.issues = [
      {
        code: input.code,
        path: [...input.path],
        message: input.message,
      },
    ]
  }
}

type ResearchBriefArtifactPersistenceInput = {
  taskID: string
  goalID?: string
  brief: ResearchBrief
  observedArtifactLocators?: ArtifactReadLocator[]
  sourceArtifactLocators?: ArtifactReadLocator[]
  now: number
} & (
  | {
      kind: "research_brief"
      artifactResources?: never
    }
  | {
      kind: "frontend_research_brief"
      artifactResources: {
        resources: readonly TaskArtifactRef[]
        resourceRoles: {
          full_markdown: number
          evidence_json: number
          citation_map: number
        }
        visualEvidence: readonly FrontendResearchVisualEvidence[]
      }
    }
)

function persistResearchBriefArtifact(db: Database.TxOrDb, input: ResearchBriefArtifactPersistenceInput) {
  if (input.goalID) {
    const goal = findGoal(input.goalID)
    if (!goal || goal.task_id !== input.taskID) {
      throw new ResearchArtifactContractError({
        artifactKind: input.kind,
        code: "research_brief_task_boundary",
        path: ["goal_id"],
        message: `Goal ${input.goalID} is missing or belongs to another Task`,
      })
    }
  }
  const brief = ResearchBriefSchema.parse(input.brief)
  const integrityError = validateResearchBriefIntegrity(brief)
  if (integrityError) {
    throw new ResearchArtifactContractError({
      artifactKind: input.kind,
      code: "research_brief_integrity",
      path: [],
      message: integrityError,
    })
  }
  const boundaryError = validateResearchBriefTaskBoundary(brief, input.taskID)
  if (boundaryError) {
    throw new ResearchArtifactContractError({
      artifactKind: input.kind,
      code: "research_brief_task_boundary",
      path: ["bundle"],
      message: boundaryError,
    })
  }
  const id = Identifier.ascending("artifact")
  const provenance = artifactConsumptionProvenance(input)
  const payload =
    input.kind === "frontend_research_brief"
      ? parseFrontendResearchBriefArtifactEnvelope(
          EngineArtifactEnvelopeSchema.parse({
            artifact_type: FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE,
            schema_version: 1,
            producer: FRONTEND_RESEARCH_BRIEF_PRODUCER,
            payload: FrontendResearchBriefArtifactPayloadSchema.parse({
              goal_id: input.goalID ?? null,
              brief,
              resource_roles: input.artifactResources.resourceRoles,
              visual_evidence: input.artifactResources.visualEvidence,
            }),
            resources: input.artifactResources.resources,
            ...provenance,
          }),
        ).envelope
      : {
          goal_id: input.goalID ?? null,
          ...brief,
          ...provenance,
        }
  insertEngineArtifact(db, {
    id,
    taskID: input.taskID,
    kind: input.kind,
    label: input.kind === "research_brief" ? "ResearchBrief" : "FrontendResearchBrief",
    payload,
    timeCreated: input.now,
  })
  return id
}

export function persistTaskResearchBrief(input: {
  taskID: string
  goalID?: string
  brief: ResearchBrief
  observedArtifactLocators?: ArtifactReadLocator[]
  sourceArtifactLocators?: ArtifactReadLocator[]
  now?: number
}) {
  return Database.use((db) =>
    persistResearchBrief(db, {
      taskID: input.taskID,
      goalID: input.goalID,
      brief: input.brief,
      observedArtifactLocators: input.observedArtifactLocators,
      sourceArtifactLocators: input.sourceArtifactLocators,
      now: input.now ?? Date.now(),
    }),
  )
}

export function persistTaskFrontendResearchBrief(input: {
  taskID: string
  goalID?: string
  brief: ResearchBrief
  observedArtifactLocators?: ArtifactReadLocator[]
  sourceArtifactLocators?: ArtifactReadLocator[]
  artifactResources: {
    resources: readonly TaskArtifactRef[]
    resourceRoles: {
      full_markdown: number
      evidence_json: number
      citation_map: number
    }
    visualEvidence: readonly FrontendResearchVisualEvidence[]
  }
  now?: number
}) {
  return Database.use((db) =>
    persistFrontendResearchBrief(db, {
      taskID: input.taskID,
      goalID: input.goalID,
      brief: input.brief,
      observedArtifactLocators: input.observedArtifactLocators,
      sourceArtifactLocators: input.sourceArtifactLocators,
      artifactResources: input.artifactResources,
      now: input.now ?? Date.now(),
    }),
  )
}

export function persistTaskResearchPartial(input: {
  taskID: string
  goalID?: string
  kind: "research_brief" | "frontend_research_brief"
  sessionID: string
  finalMessageID: string
  missing: string[]
  draft: ResearchPartialDraft
  observedArtifactLocators?: ArtifactReadLocator[]
  sourceArtifactLocators?: ArtifactReadLocator[]
  now?: number
}) {
  if (input.goalID) {
    const goal = findGoal(input.goalID)
    if (!goal || goal.task_id !== input.taskID) {
      throw new ResearchArtifactContractError({
        artifactKind: input.kind,
        code: "research_brief_task_boundary",
        path: ["goal_id"],
        message: `Goal ${input.goalID} is missing or belongs to another Task`,
      })
    }
  }
  const draft = ResearchPartialDraftSchema.parse(input.draft)
  const provenance = artifactConsumptionProvenance(input)
  return recordEngineArtifact({
    taskID: input.taskID,
    kind: input.kind,
    label: "partial",
    payload: {
      status: "partial",
      goal_id: input.goalID ?? null,
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
      ...provenance,
      missing: [...input.missing],
      draft,
    },
    timeCreated: input.now ?? Date.now(),
  })
}

export function recordTaskLevelBuildHostObservation(input: {
  id: string
  taskID: string
  sessionID?: string | null
  finalMessageID?: string | null
  contributionCommitRef?: string | null
  publishedCommitRef?: string | null
  executionMode: "current_project" | "managed_worktree"
  primaryBaseCommitRef?: string | null
  primaryTerminalCommitRef?: string | null
  diffBaseRef?: string | null
  diffHeadRef?: string | null
  diffs?: BuildFileObservation[]
  observedArtifactLocators?: ArtifactReadLocator[]
  sourceArtifactLocators?: ArtifactReadLocator[]
  now?: number
}): string {
  const now = input.now ?? Date.now()
  if (input.executionMode === "current_project" && input.publishedCommitRef && !input.contributionCommitRef) {
    throw new Error(
      `recordTaskLevelBuildHostObservation: current_project Build cannot publish commit ${input.publishedCommitRef} without the same contribution commit.`,
    )
  }
  if (
    input.executionMode === "current_project" &&
    input.contributionCommitRef &&
    input.publishedCommitRef &&
    input.contributionCommitRef !== input.publishedCommitRef
  ) {
    throw new Error(
      `recordTaskLevelBuildHostObservation: current_project Build cannot publish commit ${input.publishedCommitRef} different from contribution ${input.contributionCommitRef}.`,
    )
  }
  const publishedCommitRef =
    input.executionMode === "current_project" ? input.contributionCommitRef : input.publishedCommitRef
  const observationID = Identifier.schema("artifact").parse(input.id)
  const provenance = artifactConsumptionProvenance(input)
  recordEngineArtifact({
    id: observationID,
    taskID: input.taskID,
    kind: "build_host_observation",
    label: "git-workspace",
    payload: {
      task_id: input.taskID,
      session_id: input.sessionID ?? null,
      final_message_id: input.finalMessageID ?? null,
      execution_mode: input.executionMode,
      contribution_commit_ref: input.contributionCommitRef ?? null,
      published_commit_ref: publishedCommitRef ?? null,
      primary_base_commit_ref: input.primaryBaseCommitRef ?? null,
      primary_terminal_commit_ref: input.primaryTerminalCommitRef ?? null,
      diff_base_ref: input.diffBaseRef ?? null,
      diff_head_ref: input.diffHeadRef ?? null,
      diffs: input.diffs ?? [],
      ...provenance,
    },
    timeCreated: now,
  })
  return observationID
}

/**
 * Record an IntegrityReview as an append-only domain artifact.
 */
export function recordIntegrityReview(input: {
  taskID: string
  /** The projected Integrity review session identifier used by durable evidence and Overlay projection. */
  sessionID: string
  /** Exact final assistant message that produced this review. */
  finalMessageID: string
  goalIDs: string[]
  requirementSetArtifactLocators: EngineArtifactLocator[]
  contractGraphArtifactLocators: EngineArtifactLocator[]
  evidenceArtifactLocators: ArtifactReadLocator[]
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  /** Phase marker for evidence chronology. `pre_build` reviews precede
   *  implementation evidence, while `post_build` reviews can inspect it. The
   *  marker does not choose the next agent or define task completion. The
   *  Orchestrator decides phase from whether any claiming Goal
   *  has produced observable implementation evidence by the review time. */
  phase: "pre_build" | "post_build"
  review: IntegrityReview
  now?: number
}): string {
  assertTaskAssistantProducerMessage({
    taskID: input.taskID,
    sessionID: input.sessionID,
    messageID: input.finalMessageID,
    expectedSessionKind: "integrity",
    requireCompleted: true,
  })
  const goalIDs = assertCurrentDeliverySliceRevisionIDs({
    taskID: input.taskID,
    deliverySliceRevisionIDs: [...new Set(input.goalIDs)],
    subject: "IntegrityReview",
  })
  const requirementSetArtifactLocators = input.requirementSetArtifactLocators.map((locator) =>
    EngineArtifactLocatorSchema.parse(locator),
  )
  const contractGraphArtifactLocators = input.contractGraphArtifactLocators.map((locator) =>
    EngineArtifactLocatorSchema.parse(locator),
  )
  const evidenceArtifactLocators = input.evidenceArtifactLocators.map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const observedArtifactLocators = (input.observedArtifactLocators ?? []).map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const sourceArtifactLocators = (input.sourceArtifactLocators ?? []).map((locator) =>
    ArtifactReadLocatorSchema.parse(locator),
  )
  const id = Identifier.ascending("artifact")
  const now = input.now ?? Date.now()
  return Database.transaction((db) => {
    const assertEngineArtifactLocators = (locators: EngineArtifactLocator[], expectedKind?: EngineArtifactKind) => {
      for (const locator of locators) {
        const row = requireEngineArtifactByLocator({
          db,
          taskID: input.taskID,
          locator,
        })
        if (expectedKind && row.kind !== expectedKind) {
          throw new Error(`IntegrityReview ${expectedKind} locator ${locator.artifact_id} has kind ${row.kind}`)
        }
      }
    }
    assertEngineArtifactLocators(requirementSetArtifactLocators, "requirement_set")
    assertEngineArtifactLocators(contractGraphArtifactLocators, "architect_contract_graph")
    const taskProjectID = db
      .select({ projectID: EngineTaskTable.project_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, input.taskID))
      .get()?.projectID
    if (!taskProjectID) throw new Error(`IntegrityReview Task not found: ${input.taskID}`)
    for (const locator of evidenceArtifactLocators) {
      if (locator.source === "engine_artifact") {
        assertEngineArtifactLocators([locator])
        continue
      }
      const snapshot = locator.source === "task_artifact_snapshot" ? locator.snapshot : locator.ref.snapshot
      if (snapshot.task_id !== input.taskID || snapshot.project_id !== taskProjectID) {
        throw new Error(
          `IntegrityReview evidence locator belongs to Task ${snapshot.task_id} project ${snapshot.project_id}, ` +
            `not Task ${input.taskID} project ${taskProjectID}`,
        )
      }
    }
    const reviewNumber =
      db
        .select({ id: EngineArtifactTable.id })
        .from(EngineArtifactTable)
        .where(and(eq(EngineArtifactTable.task_id, input.taskID), eq(EngineArtifactTable.kind, "integrity_review")))
        .all().length + 1
    const payload = createIntegrityReviewArtifactPayload({
      goalIDs,
      requirementSetArtifactLocators,
      contractGraphArtifactLocators,
      evidenceArtifactLocators,
      observedArtifactLocators,
      sourceArtifactLocators,
      sessionID: input.sessionID,
      finalMessageID: input.finalMessageID,
      phase: input.phase,
      reviewNumber,
      review: input.review,
      timeRecorded: now,
    })
    insertEngineArtifact(db, {
      id,
      taskID: input.taskID,
      kind: "integrity_review",
      label: input.review.verdict ? `verdict-${input.review.verdict}` : "judgment-not-recorded",
      payload,
      timeCreated: now,
    })
    return id
  })
}

/**
 * Record an orchestrator stream-error fact as an append-only artifact.
 *
 * Used when the orchestrator's own LLM stream aborts mid-decision (provider
 * onError, stream-idle watchdog, mid-stream protocol violation). Per rule 23
 * we do NOT transition the task to terminal `failed` on a transient stream
 * error and we do NOT auto-rewake from this artifact — both would be
 * state-machine reactions. The orchestrator reads the artifact via describe
 * on its next external wake and decides for itself whether to retry,
 * re-dispatch, propose a new task, or fail_task.
 */
export function recordOrchestratorStreamError(input: {
  taskID: string
  reason: string
  errorName?: string
  sessionID?: string
  now: number
}) {
  return recordEngineArtifact({
    taskID: input.taskID,
    kind: "orchestrator-stream-error",
    label: "orchestrator-stream-error",
    payload: {
      reason: input.reason,
      ...(input.errorName ? { errorName: input.errorName } : {}),
      ...(input.sessionID ? { sessionID: input.sessionID } : {}),
    },
    timeCreated: input.now,
  })
}

/** Persist a Host/runtime/tooling failure without converting it into an
 * expert, Session, Goal, or Task business conclusion. */
export type TaskInfrastructureErrorInput = {
  taskID: string
  component: string
  operation: string
  reason: string
  errorName?: string
  sessionID?: string
  context?: Record<string, unknown>
  now?: number
}

export function recordTaskInfrastructureErrorInTransaction(db: Database.TxOrDb, input: TaskInfrastructureErrorInput) {
  const now = input.now ?? Date.now()
  const artifactID = insertEngineArtifact(db, {
    taskID: input.taskID,
    kind: "task-infrastructure-error",
    label: input.component,
    payload: {
      component: input.component,
      operation: input.operation,
      reason: input.reason,
      ...(input.errorName ? { errorName: input.errorName } : {}),
      ...(input.sessionID ? { sessionID: input.sessionID } : {}),
      ...(input.context ? { context: input.context } : {}),
    },
    timeCreated: now,
  })
  const artifact = db
    .select({
      digest: EngineArtifactTable.payload_sha256,
      catalogRevision: EngineArtifactTable.catalog_revision,
    })
    .from(EngineArtifactTable)
    .where(eq(EngineArtifactTable.id, artifactID))
    .get()
  if (!artifact) throw new Error(`Task infrastructure error Artifact ${artifactID} was not persisted`)
  EngineProtocol.emitInTransaction(
    Event.TaskInfrastructureFailed,
    {
      taskID: input.taskID,
      component: input.component,
      operation: input.operation,
      summary: `${input.component} infrastructure failure`,
      details: input.reason,
      errorName: input.errorName,
      evidenceLocators: [
        {
          source: "engine_artifact",
          artifact_id: artifactID,
          catalog_revision: artifact.catalogRevision,
          expected_sha256: artifact.digest,
        },
      ],
    },
    {
      taskID: input.taskID,
      sessionID: input.sessionID,
      source: "host",
      target: "operator",
      causationID: artifactID,
      correlationID: artifactID,
    },
  )
  return artifactID
}

/** Persist a Host/runtime/tooling failure without converting it into an
 * expert, Session, Goal, or Task business conclusion. */
export function recordTaskInfrastructureError(input: TaskInfrastructureErrorInput) {
  return Database.transaction((db) => recordTaskInfrastructureErrorInTransaction(db, input))
}

export function recordToolExecuteError(input: {
  taskID: string
  sessionID: string
  messageID: string
  partID: string
  toolName: string
  callID: string
  input: unknown
  failure: ToolFailureCause
  now: number
}) {
  return recordEngineArtifact({
    taskID: input.taskID,
    kind: "tool-execute-error",
    label: "tool-execute-error",
    payload: {
      sessionID: input.sessionID,
      messageID: input.messageID,
      partID: input.partID,
      toolName: input.toolName,
      callID: input.callID,
      input: input.input,
      failure: input.failure,
    },
    timeCreated: input.now,
  })
}
