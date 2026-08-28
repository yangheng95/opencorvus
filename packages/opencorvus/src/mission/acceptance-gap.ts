import z from "zod"
import {
  ArtifactReadLocatorSchema,
  ArtifactReadReferenceSchema,
  artifactReadLocatorKey,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"

const CriterionID = z.string().trim().min(1).max(160)
const GapID = z.string().trim().min(1).max(160)
const WorkflowNodeID = z.string().trim().min(1).max(160)
const EvidenceKind = z.string().trim().min(1).max(160)
const Finding = z.string().trim().min(1).max(8_000)
const RequestedAction = z.string().trim().min(1).max(8_000)

export const MissionAcceptanceCriterionDisposition = z.enum(["failed", "unresolved", "stale_evidence"])
export const MissionAcceptanceRepeatDisposition = z.enum([
  "repairable_with_new_evidence",
  "accepted_from_existing_evidence",
  "irreducible_blocker",
])

const MissionAcceptanceCriterionInputSchema = z
  .object({
    criterion_id: CriterionID,
    disposition: MissionAcceptanceCriterionDisposition,
    finding: Finding,
    relied_evidence_read_refs: z.array(ArtifactReadReferenceSchema).max(64),
    contradictory_evidence_read_refs: z.array(ArtifactReadReferenceSchema).max(64),
    responsible_workflow_node_id: WorkflowNodeID,
    required_new_evidence_kind: EvidenceKind,
    repeat_disposition: MissionAcceptanceRepeatDisposition.optional(),
  })
  .strict()
  .superRefine((criterion, context) => {
    if (criterion.relied_evidence_read_refs.length + criterion.contradictory_evidence_read_refs.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["relied_evidence_read_refs"],
        message: "Each repair criterion requires at least one completely read evidence reference.",
      })
    }
  })

const MissionPreservedAcceptanceInputSchema = z
  .object({
    criterion_id: CriterionID,
    evidence_read_refs: z.array(ArtifactReadReferenceSchema).min(1).max(64),
  })
  .strict()

export const MissionAcceptanceGapInputSchema = z
  .object({
    gap_id: GapID,
    current_ledger_revision_artifact_id: z.string().min(1).nullable(),
    criteria: z.array(MissionAcceptanceCriterionInputSchema).min(1).max(64),
    preserved_acceptances: z.array(MissionPreservedAcceptanceInputSchema).max(128),
    requested_next_action: RequestedAction,
  })
  .strict()
  .superRefine((gap, context) => {
    const open = new Set<string>()
    for (const [index, criterion] of gap.criteria.entries()) {
      if (open.has(criterion.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["criteria", index, "criterion_id"],
          message: `Duplicate repair criterion ${criterion.criterion_id}.`,
        })
      }
      open.add(criterion.criterion_id)
    }
    const preserved = new Set<string>()
    for (const [index, acceptance] of gap.preserved_acceptances.entries()) {
      if (preserved.has(acceptance.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["preserved_acceptances", index, "criterion_id"],
          message: `Duplicate preserved criterion ${acceptance.criterion_id}.`,
        })
      }
      if (open.has(acceptance.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["preserved_acceptances", index, "criterion_id"],
          message: `Criterion ${acceptance.criterion_id} cannot be both open and preserved.`,
        })
      }
      preserved.add(acceptance.criterion_id)
    }
    const references = [
      ...gap.criteria.flatMap((criterion) => [
        ...criterion.relied_evidence_read_refs,
        ...criterion.contradictory_evidence_read_refs,
      ]),
      ...gap.preserved_acceptances.flatMap((acceptance) => acceptance.evidence_read_refs),
    ]
    if (new Set(references).size !== references.length) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "Each Artifact read reference must identify exactly one acceptance obligation.",
      })
    }
    if (references.length > 64) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "One acceptance gap may cite at most 64 Artifact read references.",
      })
    }
  })

export const MissionAcceptanceCriterionSchema = z
  .object({
    criterion_id: CriterionID,
    disposition: MissionAcceptanceCriterionDisposition,
    finding: Finding,
    relied_evidence_locators: z.array(ArtifactReadLocatorSchema).max(64),
    contradictory_evidence_locators: z.array(ArtifactReadLocatorSchema).max(64),
    responsible_workflow_node_id: WorkflowNodeID,
    required_new_evidence_kind: EvidenceKind,
    repeat_disposition: MissionAcceptanceRepeatDisposition.optional(),
  })
  .strict()
  .superRefine((criterion, context) => {
    if (criterion.relied_evidence_locators.length + criterion.contradictory_evidence_locators.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["relied_evidence_locators"],
        message: "Each repair criterion requires at least one canonical evidence locator.",
      })
    }
  })

const MissionPreservedAcceptanceSchema = z
  .object({
    criterion_id: CriterionID,
    evidence_locators: z.array(ArtifactReadLocatorSchema).min(1).max(64),
  })
  .strict()

export const MissionAcceptanceGapSchema = z
  .object({
    gap_id: GapID,
    reviewed_terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
    criteria: z.array(MissionAcceptanceCriterionSchema).min(1).max(64),
    preserved_acceptances: z.array(MissionPreservedAcceptanceSchema).max(128),
    requested_next_action: RequestedAction,
  })
  .strict()
  .superRefine((gap, context) => {
    const open = new Set<string>()
    const locatorOwners = new Map<string, string>()
    for (const [index, criterion] of gap.criteria.entries()) {
      if (open.has(criterion.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["criteria", index, "criterion_id"],
          message: `Duplicate repair criterion ${criterion.criterion_id}.`,
        })
      }
      open.add(criterion.criterion_id)
      for (const locator of [...criterion.relied_evidence_locators, ...criterion.contradictory_evidence_locators]) {
        const key = artifactReadLocatorKey(locator)
        const priorOwner = locatorOwners.get(key)
        if (priorOwner) {
          context.addIssue({
            code: "custom",
            path: ["criteria", index, "relied_evidence_locators"],
            message: `Evidence locator is already owned by acceptance obligation ${priorOwner}.`,
          })
        } else {
          locatorOwners.set(key, criterion.criterion_id)
        }
      }
    }
    const preserved = new Set<string>()
    for (const [index, acceptance] of gap.preserved_acceptances.entries()) {
      if (preserved.has(acceptance.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["preserved_acceptances", index, "criterion_id"],
          message: `Duplicate preserved criterion ${acceptance.criterion_id}.`,
        })
      }
      if (open.has(acceptance.criterion_id)) {
        context.addIssue({
          code: "custom",
          path: ["preserved_acceptances", index, "criterion_id"],
          message: `Criterion ${acceptance.criterion_id} cannot be both open and preserved.`,
        })
      }
      preserved.add(acceptance.criterion_id)
      for (const locator of acceptance.evidence_locators) {
        const key = artifactReadLocatorKey(locator)
        const priorOwner = locatorOwners.get(key)
        if (priorOwner) {
          context.addIssue({
            code: "custom",
            path: ["preserved_acceptances", index, "evidence_locators"],
            message: `Evidence locator is already owned by acceptance obligation ${priorOwner}.`,
          })
        } else {
          locatorOwners.set(key, acceptance.criterion_id)
        }
      }
    }
    if (locatorOwners.size > 64) {
      context.addIssue({
        code: "custom",
        path: ["criteria"],
        message: "One acceptance gap may cite at most 64 canonical evidence locators.",
      })
    }
  })

export type MissionAcceptanceGapInput = z.infer<typeof MissionAcceptanceGapInputSchema>
export type MissionAcceptanceGap = z.infer<typeof MissionAcceptanceGapSchema>

export function acceptanceGapReadReferences(gap: MissionAcceptanceGapInput): string[] {
  return [
    ...gap.criteria.flatMap((criterion) => [
      ...criterion.relied_evidence_read_refs,
      ...criterion.contradictory_evidence_read_refs,
    ]),
    ...gap.preserved_acceptances.flatMap((acceptance) => acceptance.evidence_read_refs),
  ]
}

export function materializeMissionAcceptanceGap(input: {
  gap: MissionAcceptanceGapInput
  reviewedTerminalLifecycleReference: z.infer<typeof TerminalLifecycleReferenceSchema>
  evidenceByReadReference: ReadonlyMap<string, ArtifactReadLocator>
}): MissionAcceptanceGap {
  const locator = (reference: string) => {
    const found = input.evidenceByReadReference.get(reference)
    if (!found) throw new Error(`Mission acceptance gap evidence reference ${reference} was not resolved.`)
    return found
  }
  return MissionAcceptanceGapSchema.parse({
    gap_id: input.gap.gap_id,
    reviewed_terminal_lifecycle_reference: input.reviewedTerminalLifecycleReference,
    criteria: input.gap.criteria.map((criterion) => ({
      criterion_id: criterion.criterion_id,
      disposition: criterion.disposition,
      finding: criterion.finding,
      relied_evidence_locators: criterion.relied_evidence_read_refs.map(locator),
      contradictory_evidence_locators: criterion.contradictory_evidence_read_refs.map(locator),
      responsible_workflow_node_id: criterion.responsible_workflow_node_id,
      required_new_evidence_kind: criterion.required_new_evidence_kind,
      ...(criterion.repeat_disposition ? { repeat_disposition: criterion.repeat_disposition } : {}),
    })),
    preserved_acceptances: input.gap.preserved_acceptances.map((acceptance) => ({
      criterion_id: acceptance.criterion_id,
      evidence_locators: acceptance.evidence_read_refs.map(locator),
    })),
    requested_next_action: input.gap.requested_next_action,
  })
}

export function acceptanceGapEvidenceLocators(gap: MissionAcceptanceGap): ArtifactReadLocator[] {
  const byIdentity = new Map<string, ArtifactReadLocator>()
  for (const locator of [
    ...gap.criteria.flatMap((criterion) => [
      ...criterion.relied_evidence_locators,
      ...criterion.contradictory_evidence_locators,
    ]),
    ...gap.preserved_acceptances.flatMap((acceptance) => acceptance.evidence_locators),
  ]) {
    byIdentity.set(JSON.stringify(ArtifactReadLocatorSchema.parse(locator)), locator)
  }
  return [...byIdentity.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, locator]) => locator)
}

export function renderMissionAcceptanceRepairMessage(rawGap: MissionAcceptanceGap): string {
  const gap = MissionAcceptanceGapSchema.parse(rawGap)
  return [
    "# Mission acceptance repair",
    "",
    `- gap_id: ${gap.gap_id}`,
    `- reviewed_terminal_lifecycle_reference: ${JSON.stringify(gap.reviewed_terminal_lifecycle_reference)}`,
    "",
    "## Open criteria",
    "",
    ...gap.criteria.flatMap((criterion) => [
      `### ${criterion.criterion_id}`,
      "",
      `- disposition: ${criterion.disposition}`,
      `- finding: ${criterion.finding}`,
      `- responsible_workflow_node_id: ${criterion.responsible_workflow_node_id}`,
      `- required_new_evidence_kind: ${criterion.required_new_evidence_kind}`,
      ...(criterion.repeat_disposition ? [`- repeat_disposition: ${criterion.repeat_disposition}`] : []),
      `- relied_evidence_locators: ${JSON.stringify(criterion.relied_evidence_locators)}`,
      `- contradictory_evidence_locators: ${JSON.stringify(criterion.contradictory_evidence_locators)}`,
      "",
    ]),
    "## Preserved acceptances",
    "",
    ...(gap.preserved_acceptances.length > 0
      ? gap.preserved_acceptances.map(
          (acceptance) => `- ${acceptance.criterion_id}: ${JSON.stringify(acceptance.evidence_locators)}`,
        )
      : ["- (none)"]),
    "",
    "## Requested next action",
    "",
    gap.requested_next_action,
  ].join("\n")
}
