import { ArchitectTurnProducerSchema } from "./architect-contract-graph-artifact"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  EngineArtifactLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { AcceptanceSpecSchema } from "@/acceptance/types"
import { z } from "zod"

export const GoalGraphOperatorProducerSchema = z
  .object({
    kind: z.literal("operator_command"),
    operation: z.enum(["add", "modify", "remove"]),
    reason: z.string().trim().min(1),
    target_goal_id: z.string().min(1).nullable(),
  })
  .strict()

export const GoalGraphOrchestratorProducerSchema = z
  .object({
    kind: z.literal("orchestrator_decision"),
    session_id: z.string().min(1),
    message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    operation: z.enum(["add", "modify", "remove"]),
    reason: z.string().trim().min(1),
    target_goal_id: z.string().min(1).nullable(),
  })
  .strict()

export const GoalGraphProducerSchema = z.discriminatedUnion("kind", [
  ArchitectTurnProducerSchema,
  GoalGraphOperatorProducerSchema,
  GoalGraphOrchestratorProducerSchema,
])

export const GoalGraphRemovalSchema = z
  .object({
    goal_id: z.string().min(1),
    reason: z.string().trim().min(1),
  })
  .strict()

export const GoalGraphProjectionSchema = z
  .object({
    goal_revision_ids: z
      .array(z.string().min(1))
      .superRefine((goalIDs, context) => {
        const duplicates = goalIDs.filter((goalID, index) => goalIDs.indexOf(goalID) !== index)
        if (duplicates.length > 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate Goal membership IDs: ${[...new Set(duplicates)].join(", ")}`,
          })
        }
      }),
    removals: z
      .array(GoalGraphRemovalSchema)
      .superRefine((removals, context) => {
        const goalIDs = removals.map((removal) => removal.goal_id)
        const duplicates = goalIDs.filter((goalID, index) => goalIDs.indexOf(goalID) !== index)
        if (duplicates.length > 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `duplicate Goal removal IDs: ${[...new Set(duplicates)].join(", ")}`,
          })
        }
      }),
  })
  .strict()
  .superRefine((projection, context) => {
    const memberships = new Set(projection.goal_revision_ids)
    const overlap = projection.removals
      .map((removal) => removal.goal_id)
      .filter((goalID) => memberships.has(goalID))
    if (overlap.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Goal IDs cannot be both projected and removed: ${[...new Set(overlap)].join(", ")}`,
      })
    }
  })

export const GoalGraphProjectionConflictSchema = z
  .object({
    code: z.enum([
      "stale_prior_projection",
      "requirement_set_not_read",
      "requirement_set_not_selected",
      "unprojectable_contract_graph",
      "invalid_goal_partition",
      "non_current_goal_reference",
      "unprojectable_goal_contract",
      "unprojectable_fidelity",
      "unprojectable_requirement_reference",
      "unprojectable_contract_reference",
      "unprojectable_evidence_reference",
    ]),
    message: z.string().trim().min(1),
  })
  .strict()

export const GoalGraphProjectionFindingSchema = z
  .object({
    code: z.enum([
      "architect_graph_not_reauthored_after_goal_add",
      "architect_graph_not_reauthored_after_goal_modify",
      "architect_graph_references_removed_goal",
    ]),
    message: z.string().trim().min(1),
  })
  .strict()

export const GoalGraphCandidateGoalSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    objective: z.string().min(1),
    acceptance_specs: z.array(AcceptanceSpecSchema),
    owned_paths: z.array(z.string()),
    priority: z.enum(["blocking", "advisory"]),
    kind: z.string().min(1),
    source: z.string().min(1),
  })
  .strict()

/**
 * The sole executable Goal-membership fact.
 *
 * A non-null projection consumes its exact prior projection and becomes a
 * current-tip candidate. A null projection preserves a conflicting specialist
 * fact without consuming or replacing the observed current tip.
 */
export const GoalGraphProjectionArtifactPayloadSchema =
  ArtifactConsumptionProvenanceSchema.safeExtend({
    producer: GoalGraphProducerSchema,
    prior_projection_artifact_locator: EngineArtifactLocatorSchema.nullable(),
    contract_graph_artifact_locator: EngineArtifactLocatorSchema.nullable(),
    projection: GoalGraphProjectionSchema.nullable(),
    projected_goals: z.array(GoalGraphCandidateGoalSchema),
    candidate_goals: z.array(GoalGraphCandidateGoalSchema),
    candidate_removals: z.array(GoalGraphRemovalSchema),
    findings: z.array(GoalGraphProjectionFindingSchema),
    conflicts: z.array(GoalGraphProjectionConflictSchema),
    observed_current_projection_artifact_locator: EngineArtifactLocatorSchema.nullable(),
  })
  .superRefine((payload, context) => {
    if (payload.projection !== null && payload.conflicts.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a projected GoalGraph cannot carry conflicts",
      })
    }
    if (payload.projection !== null && payload.observed_current_projection_artifact_locator !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a projected GoalGraph cannot carry observed_current_projection_artifact_locator",
      })
    }
    if (
      payload.projection !== null &&
      (payload.candidate_goals.length > 0 || payload.candidate_removals.length > 0)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a projected GoalGraph cannot carry candidate contracts",
      })
    }
    if (payload.projection !== null) {
      const projectedIDs = payload.projected_goals.map((goal) => goal.id)
      if (
        projectedIDs.length !== payload.projection.goal_revision_ids.length ||
        projectedIDs.some((goalID, index) => goalID !== payload.projection!.goal_revision_ids[index])
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "projected_goals must materialize every goal_revision_id in exact membership order",
        })
      }
    }
    if (payload.projection === null && payload.projected_goals.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a non-projected GoalGraph candidate cannot carry projected_goals",
      })
    }
    if (payload.projection === null && payload.conflicts.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "a non-projected GoalGraph candidate must explain at least one conflict",
      })
    }
    if (payload.projection === null && payload.producer.kind !== "architect_turn") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "only an Architect turn can preserve a non-projected candidate",
      })
    }
  })

export type GoalGraphProducer = z.infer<typeof GoalGraphProducerSchema>
export type GoalGraphMutationProducer = Exclude<
  GoalGraphProducer,
  { kind: "architect_turn" }
>
export type GoalGraphRemoval = z.infer<typeof GoalGraphRemovalSchema>
export type GoalGraphProjectionConflict = z.infer<
  typeof GoalGraphProjectionConflictSchema
>
export type GoalGraphProjection = z.infer<typeof GoalGraphProjectionSchema>
export type GoalGraphProjectionArtifactPayload = z.infer<
  typeof GoalGraphProjectionArtifactPayloadSchema
>

export interface GoalGraphProjectionFact {
  id: string
  payload_sha256: string
  payload: GoalGraphProjectionArtifactPayload
}

/** Resolve the unique successful projection tip from immutable prior edges. */
export function resolveGoalGraphProjectionTip<T extends GoalGraphProjectionFact>(
  taskID: string,
  facts: readonly T[],
): T | undefined {
  const successful = facts.filter((artifact) => artifact.payload.projection !== null)
  if (successful.length === 0) return undefined
  const byID = new Map(successful.map((artifact) => [artifact.id, artifact]))
  const referencedPriorIDs = new Set<string>()
  for (const artifact of successful) {
    const prior = artifact.payload.prior_projection_artifact_locator
    if (!prior) continue
    const priorArtifact = byID.get(prior.artifact_id)
    if (!priorArtifact || priorArtifact.payload_sha256 !== prior.expected_sha256) {
      throw new Error(
        `GoalGraph projection ${artifact.id} references missing, non-projected, or digest-mismatched prior ${prior.artifact_id}`,
      )
    }
    referencedPriorIDs.add(prior.artifact_id)
  }
  const tips = successful.filter((artifact) => !referencedPriorIDs.has(artifact.id))
  if (tips.length !== 1) {
    throw new Error(
      `Task ${taskID} has ${tips.length} current GoalGraph projection tips; expected exactly one`,
    )
  }
  const visited = new Set<string>()
  let cursor: T | undefined = tips[0]
  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new Error(`GoalGraph projection lineage cycle detected at ${cursor.id}`)
    }
    visited.add(cursor.id)
    const prior = cursor.payload.prior_projection_artifact_locator
    cursor = prior ? byID.get(prior.artifact_id) : undefined
  }
  if (visited.size !== successful.length) {
    const disconnected = successful
      .filter((artifact) => !visited.has(artifact.id))
      .map((artifact) => artifact.id)
    throw new Error(
      `Task ${taskID} has disconnected GoalGraph projection lineage: ${disconnected.join(", ")}`,
    )
  }
  return tips[0]
}
