/**
 * Goal workload-analysis adapter output types.
 *
 * The projected analyst is a read-only reviewer. It reads the available task
 * evidence and exact Delivery Slice-bound domain artifacts, then produces one
 * workload brief per Slice revision. The revision is an evidence subject, not
 * a projected execution instance.
 *
 * index/lens discipline (spec §2, rule 8): a brief ORIGINATES only the fields
 * that have no other source (why_not_smaller / traps / countable inventory /
 * verification inventory / decomposition_concern). Everything about *which*
 * surfaces or contracts a Slice revision covers is REFERENCED by id into the
 * existing single sources (declared contract / reference_coverage / goal /
 * acceptance_spec ids, frontend-design vis-* ids, canonical design sections) and never
 * restated as new prose.
 */
import { z } from "zod"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"

export const WorkloadBriefSchema = z
  .object({
    goal_id: z.string().min(1).describe("Exact persisted Delivery Slice revision ID this brief covers."),
    decomposition_concern: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Evidence that this Delivery Slice contract is too broad or under-specified to be one coherent delivery and acceptance subject; omit when sizing is adequate.",
      ),
    why_not_smaller: z.array(z.string().min(1)).min(1),
    underestimation_traps: z.array(z.string().min(1)),
    execution_inventory: z
      .object({
        surfaces: z.number().int().nonnegative(),
        states: z.number().int().nonnegative(),
        data_contracts: z.number().int().nonnegative(),
        verification_points: z.number().int().nonnegative(),
      })
      .strict(),
    verification_inventory: z
      .array(z.string().min(1))
      .describe("Concrete observable checks Task-level workflow consumers must cover for this Slice revision."),
    references: z
      .object({
        contract_ids: z.array(z.string().min(1)),
        reference_coverage_ids: z.array(z.string().min(1)),
        acceptance_spec_ids: z.array(z.string().min(1)),
        visual_spec_ids: z.array(z.string().min(1)),
        design_sections: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict()

export const GoalWorkloadArtifactSchema =
  ArtifactConsumptionProvenanceSchema.safeExtend({
    briefs: z.array(WorkloadBriefSchema),
    session_id: z.string().min(1),
    final_message_id: z.string().min(1),
  })

export type WorkloadBrief = z.infer<typeof WorkloadBriefSchema>
export type GoalWorkloadArtifact = z.infer<typeof GoalWorkloadArtifactSchema>
