import { z } from "zod"
import {
  ArtifactConsumptionProvenanceSchema,
  EngineArtifactLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Identifier } from "@/id/id"
import { isDeepStrictEqual } from "node:util"

export const WorkloadBriefSchema = z
  .object({
    goal_id: Identifier.schema("goal").describe("Exact persisted Delivery Slice revision ID this brief covers."),
    decomposition_concern: z.string().min(1).optional(),
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
    verification_inventory: z.array(z.string().min(1)),
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

export type WorkloadBrief = z.infer<typeof WorkloadBriefSchema>

export const GoalWorkloadSelectedSubjectSchema = z
  .object({
    delivery_slice_id: Identifier.schema("goal"),
    delivery_slice_revision_id: Identifier.schema("goal"),
    revision: z.number().int().positive(),
  })
  .strict()

export const GoalWorkloadCoverageIssueSchema = z.enum([
  "selected_revision_set_empty",
  "selected_revision_missing",
  "unselected_revision_submitted",
  "revision_submitted_more_than_once",
  "selected_revision_not_current",
  "current_goal_graph_unavailable",
])
export type GoalWorkloadCoverageIssue = z.infer<typeof GoalWorkloadCoverageIssueSchema>

const GoalIDArraySchema = z.array(Identifier.schema("goal"))

export const GoalWorkloadCoverageReceiptSchema = z
  .object({
    status: z.enum(["complete", "incomplete", "conflict"]),
    selected_revision_ids: GoalIDArraySchema,
    submitted_revision_ids: GoalIDArraySchema,
    missing_selected_revision_ids: GoalIDArraySchema,
    extra_unselected_revision_ids: GoalIDArraySchema,
    duplicate_revision_ids: GoalIDArraySchema,
    stale_selected_revision_ids: GoalIDArraySchema,
    current_revision_ids: GoalIDArraySchema,
    current_goal_graph_projection_artifact_locator: EngineArtifactLocatorSchema.nullable(),
    issues: z.array(GoalWorkloadCoverageIssueSchema),
  })
  .strict()

const ISSUE_ORDER = GoalWorkloadCoverageIssueSchema.options

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

function duplicateIDs(values: readonly string[]): string[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}

export function deriveGoalWorkloadCoverage(input: {
  selectedRevisionIDs: readonly string[]
  submittedRevisionIDs: readonly string[]
  currentRevisionIDs: readonly string[]
  currentGoalGraphAvailable: boolean
}) {
  const selectedRevisionIDs = sortedUnique(input.selectedRevisionIDs)
  const submittedRevisionIDs = sortedUnique(input.submittedRevisionIDs)
  const currentRevisionIDs = sortedUnique(input.currentRevisionIDs)
  const selected = new Set(selectedRevisionIDs)
  const submitted = new Set(submittedRevisionIDs)
  const current = new Set(currentRevisionIDs)
  const missing = selectedRevisionIDs.filter((id) => !submitted.has(id))
  const extra = submittedRevisionIDs.filter((id) => !selected.has(id))
  const duplicates = duplicateIDs(input.submittedRevisionIDs)
  const stale = selectedRevisionIDs.filter((id) => !current.has(id))
  const issues = new Set<GoalWorkloadCoverageIssue>()
  if (selectedRevisionIDs.length === 0) issues.add("selected_revision_set_empty")
  if (missing.length > 0) issues.add("selected_revision_missing")
  if (extra.length > 0) issues.add("unselected_revision_submitted")
  if (duplicates.length > 0) issues.add("revision_submitted_more_than_once")
  if (stale.length > 0) issues.add("selected_revision_not_current")
  if (!input.currentGoalGraphAvailable) issues.add("current_goal_graph_unavailable")
  const conflict =
    extra.length > 0 ||
    duplicates.length > 0 ||
    stale.length > 0 ||
    (selectedRevisionIDs.length > 0 && !input.currentGoalGraphAvailable)
  const status = issues.size === 0 ? "complete" : conflict ? "conflict" : "incomplete"
  return {
    status,
    selected_revision_ids: selectedRevisionIDs,
    submitted_revision_ids: submittedRevisionIDs,
    missing_selected_revision_ids: missing,
    extra_unselected_revision_ids: extra,
    duplicate_revision_ids: duplicates,
    stale_selected_revision_ids: stale,
    current_revision_ids: currentRevisionIDs,
    issues: ISSUE_ORDER.filter((issue) => issues.has(issue)),
  } as const
}

const GoalWorkloadArtifactBaseSchema = ArtifactConsumptionProvenanceSchema.safeExtend({
  schema_version: z.literal(2),
  producer: z
    .object({
      session_id: Identifier.schema("session"),
      final_message_id: Identifier.schema("message"),
    })
    .strict(),
  dispatch: z
    .object({
      task_id: Identifier.schema("task"),
      dispatch_id: z.string().min(1),
      dispatch_lineage_artifact_id: z.string().min(1),
      workflow_occurrence_id: z.string().min(1),
    })
    .strict(),
  selected_subjects: z.array(GoalWorkloadSelectedSubjectSchema),
  briefs: z.array(WorkloadBriefSchema),
  coverage_receipt: GoalWorkloadCoverageReceiptSchema,
}).strict()

export const GoalWorkloadArtifactSchema = GoalWorkloadArtifactBaseSchema.superRefine((payload, context) => {
  const subjectIDs = payload.selected_subjects.map((subject) => subject.delivery_slice_revision_id)
  if (new Set(subjectIDs).size !== subjectIDs.length) {
    context.addIssue({ code: "custom", path: ["selected_subjects"], message: "selected subjects must be unique" })
  }
  if (JSON.stringify(subjectIDs) !== JSON.stringify([...subjectIDs].sort())) {
    context.addIssue({ code: "custom", path: ["selected_subjects"], message: "selected subjects must be sorted" })
  }
  const expected = deriveGoalWorkloadCoverage({
    selectedRevisionIDs: subjectIDs,
    submittedRevisionIDs: payload.briefs.map((brief) => brief.goal_id),
    currentRevisionIDs: payload.coverage_receipt.current_revision_ids,
    currentGoalGraphAvailable: payload.coverage_receipt.current_goal_graph_projection_artifact_locator !== null,
  })
  for (const field of [
    "status",
    "selected_revision_ids",
    "submitted_revision_ids",
    "missing_selected_revision_ids",
    "extra_unselected_revision_ids",
    "duplicate_revision_ids",
    "stale_selected_revision_ids",
    "current_revision_ids",
    "issues",
  ] as const) {
    if (JSON.stringify(payload.coverage_receipt[field]) !== JSON.stringify(expected[field])) {
      context.addIssue({ code: "custom", path: ["coverage_receipt", field], message: `${field} is not canonical` })
    }
  }
  if (
    payload.coverage_receipt.current_goal_graph_projection_artifact_locator === null &&
    payload.coverage_receipt.current_revision_ids.length > 0
  ) {
    context.addIssue({
      code: "custom",
      path: ["coverage_receipt", "current_revision_ids"],
      message: "current revisions require a GoalGraph locator",
    })
  }
})

export type GoalWorkloadArtifact = z.infer<typeof GoalWorkloadArtifactSchema>

export interface GoalWorkloadMembershipFact {
  locator: z.infer<typeof EngineArtifactLocatorSchema>
  revisionIDs: string[]
}

/** Row-local plus publication-time membership validation shared by runtime
 * reads and database startup. This primitive deliberately has no Database
 * dependency so startup cannot create a storage import cycle. */
export function validateGoalWorkloadArtifactAgainstMembership(input: {
  row: { id: string; task_id: string; kind: string; payload: unknown }
  payload?: GoalWorkloadArtifact
  membership: GoalWorkloadMembershipFact | undefined
}): GoalWorkloadArtifact {
  if (input.row.kind !== "goal_workload") throw new Error(`Artifact ${input.row.id} is not goal_workload`)
  const payload = input.payload ?? GoalWorkloadArtifactSchema.parse(input.row.payload)
  if (payload.dispatch.task_id !== input.row.task_id) {
    throw new Error(`Goal Workload ${input.row.id} Task identity does not match its Artifact row`)
  }
  const locator = payload.coverage_receipt.current_goal_graph_projection_artifact_locator
  if (!input.membership) {
    if (locator !== null || payload.coverage_receipt.current_revision_ids.length > 0) {
      throw new Error(`Goal Workload ${input.row.id} claims unavailable GoalGraph membership`)
    }
    return payload
  }
  if (!locator || !isDeepStrictEqual(locator, input.membership.locator)) {
    throw new Error(`Goal Workload ${input.row.id} GoalGraph locator is not its publication-time tip`)
  }
  if (!isDeepStrictEqual(payload.coverage_receipt.current_revision_ids, [...input.membership.revisionIDs].sort())) {
    throw new Error(`Goal Workload ${input.row.id} current revision IDs do not match its GoalGraph tip`)
  }
  return payload
}
