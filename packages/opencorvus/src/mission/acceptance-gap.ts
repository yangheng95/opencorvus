import { createHash } from "node:crypto"
import z from "zod"
import {
  ArtifactReadLocatorSchema,
  ArtifactReadReferenceSchema,
  artifactReadLocatorKey,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { ExpertSquadPackageRevisionBindingSchema } from "@/engine/workflow-binding"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"
import { canonicalJSONValue } from "@/util/canonical-digest"

const CriterionID = z.string().trim().min(1).max(160)
const GapID = z.string().trim().min(1).max(160)
const EvidenceKind = z.string().trim().min(1).max(160)
const Finding = z.string().trim().min(1).max(8_000)
const RepairActionField = z.string().trim().min(1).max(1_000)
const EvidenceReadReferences = z.array(ArtifactReadReferenceSchema).max(64)
const EvidenceLocators = z.array(ArtifactReadLocatorSchema).max(64)
const RepairActionParameters = z.record(z.string(), z.unknown()).superRefine((parameters, context) => {
  try {
    canonicalJSONValue(parameters, "mission-acceptance-repair-action-parameters-v1")
  } catch (error) {
    context.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Repair action parameters must be one canonical JSON object.",
    })
  }
})

export const MissionAcceptanceCriterionDisposition = z.enum(["failed", "unresolved", "stale_evidence"])

export const MissionAcceptanceCriterionResponsibilitySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("workflow_node"),
      workflow_id: z.string().trim().min(1).max(160),
      workflow_node_id: z.string().trim().min(1).max(160),
    })
    .strict(),
  z
    .object({
      kind: z.literal("direct_dispatch"),
      package_revision: ExpertSquadPackageRevisionBindingSchema,
      agent_id: z.string().trim().min(1).max(160),
      dispatch_lineage_id: z.string().trim().min(1),
    })
    .strict(),
])

export const MissionAcceptanceRepairActionInputSchema = z
  .object({
    operation: RepairActionField,
    target: RepairActionField,
    expected_evidence_kind: EvidenceKind,
    parameters: RepairActionParameters,
  })
  .strict()

export const MissionAcceptanceRepairActionSchema = MissionAcceptanceRepairActionInputSchema.extend({
  identity_sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()

const OpenCriterionInputSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("open"),
    disposition: MissionAcceptanceCriterionDisposition,
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_read_refs: EvidenceReadReferences.min(1),
    repair_evidence_read_refs: EvidenceReadReferences,
    resolution_evidence_read_refs: EvidenceReadReferences,
    invalidating_evidence_read_refs: EvidenceReadReferences,
    irreducible_blocker_evidence_read_refs: EvidenceReadReferences,
    repair_action: MissionAcceptanceRepairActionInputSchema,
  })
  .strict()
  .superRefine((criterion, context) => {
    if (criterion.disposition === "stale_evidence" && criterion.invalidating_evidence_read_refs.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["invalidating_evidence_read_refs"],
        message: "A stale accepted criterion requires completely read invalidating evidence.",
      })
    }
    if (criterion.disposition === "stale_evidence" && criterion.resolution_evidence_read_refs.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["resolution_evidence_read_refs"],
        message: "A stale accepted criterion must retain its completely read resolution evidence.",
      })
    }
  })

const AcceptedCriterionInputSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("accepted"),
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_read_refs: EvidenceReadReferences,
    repair_evidence_read_refs: EvidenceReadReferences,
    resolution_evidence_read_refs: EvidenceReadReferences.min(1),
    invalidating_evidence_read_refs: EvidenceReadReferences,
    irreducible_blocker_evidence_read_refs: EvidenceReadReferences,
  })
  .strict()

const BlockedCriterionInputSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("blocked"),
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_read_refs: EvidenceReadReferences,
    repair_evidence_read_refs: EvidenceReadReferences,
    resolution_evidence_read_refs: EvidenceReadReferences,
    invalidating_evidence_read_refs: EvidenceReadReferences,
    irreducible_blocker_evidence_read_refs: EvidenceReadReferences.min(1),
  })
  .strict()

export const MissionAcceptanceCriterionInputSchema = z.discriminatedUnion("state", [
  OpenCriterionInputSchema,
  AcceptedCriterionInputSchema,
  BlockedCriterionInputSchema,
])

export const MissionAcceptanceOpenCriterionSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("open"),
    disposition: MissionAcceptanceCriterionDisposition,
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_locators: EvidenceLocators.min(1),
    repair_evidence_locators: EvidenceLocators,
    resolution_evidence_locators: EvidenceLocators,
    invalidating_evidence_locators: EvidenceLocators,
    irreducible_blocker_evidence_locators: EvidenceLocators,
    repair_action: MissionAcceptanceRepairActionSchema,
  })
  .strict()
  .superRefine((criterion, context) => {
    if (criterion.disposition === "stale_evidence" && criterion.invalidating_evidence_locators.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["invalidating_evidence_locators"],
        message: "A stale accepted criterion requires canonical invalidating evidence.",
      })
    }
    if (criterion.disposition === "stale_evidence" && criterion.resolution_evidence_locators.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["resolution_evidence_locators"],
        message: "A stale accepted criterion must retain its canonical resolution evidence.",
      })
    }
  })

const AcceptedCriterionSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("accepted"),
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_locators: EvidenceLocators,
    repair_evidence_locators: EvidenceLocators,
    resolution_evidence_locators: EvidenceLocators.min(1),
    invalidating_evidence_locators: EvidenceLocators,
    irreducible_blocker_evidence_locators: EvidenceLocators,
  })
  .strict()

const BlockedCriterionSchema = z
  .object({
    criterion_id: CriterionID,
    state: z.literal("blocked"),
    finding: Finding,
    responsibility: MissionAcceptanceCriterionResponsibilitySchema,
    observation_evidence_locators: EvidenceLocators,
    repair_evidence_locators: EvidenceLocators,
    resolution_evidence_locators: EvidenceLocators,
    invalidating_evidence_locators: EvidenceLocators,
    irreducible_blocker_evidence_locators: EvidenceLocators.min(1),
  })
  .strict()

export const MissionAcceptanceCriterionSchema = z.discriminatedUnion("state", [
  MissionAcceptanceOpenCriterionSchema,
  AcceptedCriterionSchema,
  BlockedCriterionSchema,
])

function inputCriterionReadReferences(criterion: z.infer<typeof MissionAcceptanceCriterionInputSchema>): string[] {
  return [
    ...criterion.observation_evidence_read_refs,
    ...criterion.repair_evidence_read_refs,
    ...criterion.resolution_evidence_read_refs,
    ...criterion.invalidating_evidence_read_refs,
    ...criterion.irreducible_blocker_evidence_read_refs,
  ]
}

function criterionEvidenceLocators(criterion: z.infer<typeof MissionAcceptanceCriterionSchema>): ArtifactReadLocator[] {
  return [
    ...criterion.observation_evidence_locators,
    ...criterion.repair_evidence_locators,
    ...criterion.resolution_evidence_locators,
    ...criterion.invalidating_evidence_locators,
    ...criterion.irreducible_blocker_evidence_locators,
  ]
}

function refineInputCriteria(
  criteria: readonly z.infer<typeof MissionAcceptanceCriterionInputSchema>[],
  context: z.RefinementCtx,
) {
  const criterionIDs = new Set<string>()
  const references: string[] = []
  for (const [index, criterion] of criteria.entries()) {
    if (criterionIDs.has(criterion.criterion_id)) {
      context.addIssue({
        code: "custom",
        path: ["criteria", index, "criterion_id"],
        message: `Duplicate acceptance criterion ${criterion.criterion_id}.`,
      })
    }
    criterionIDs.add(criterion.criterion_id)
    references.push(...inputCriterionReadReferences(criterion))
  }
  if (!criteria.some((criterion) => criterion.state === "open")) {
    context.addIssue({ code: "custom", path: ["criteria"], message: "A Mission acceptance resume requires at least one open criterion." })
  }
  if (new Set(references).size !== references.length) {
    context.addIssue({
      code: "custom",
      path: ["criteria"],
      message: "Each Artifact read reference must identify exactly one acceptance evidence role.",
    })
  }
  if (references.length > 64) {
    context.addIssue({ code: "custom", path: ["criteria"], message: "One acceptance gap may cite at most 64 Artifact read references." })
  }
}

export const MissionAcceptanceGapInputSchema = z
  .object({
    gap_id: GapID,
    current_ledger_revision_artifact_id: z.string().min(1).nullable(),
    criteria: z.array(MissionAcceptanceCriterionInputSchema).min(1).max(128),
  })
  .strict()
  .superRefine((gap, context) => refineInputCriteria(gap.criteria, context))

export const MissionAcceptanceGapSchema = z
  .object({
    gap_id: GapID,
    reviewed_terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
    criteria: z.array(MissionAcceptanceCriterionSchema).min(1).max(128),
  })
  .strict()
  .superRefine((gap, context) => {
    const criterionIDs = new Set<string>()
    const locatorOwners = new Map<string, string>()
    for (const [index, criterion] of gap.criteria.entries()) {
      if (criterionIDs.has(criterion.criterion_id)) {
        context.addIssue({ code: "custom", path: ["criteria", index, "criterion_id"], message: `Duplicate acceptance criterion ${criterion.criterion_id}.` })
      }
      criterionIDs.add(criterion.criterion_id)
      for (const locator of criterionEvidenceLocators(criterion)) {
        const key = artifactReadLocatorKey(locator)
        const priorOwner = locatorOwners.get(key)
        if (priorOwner) {
          context.addIssue({
            code: "custom",
            path: ["criteria", index],
            message: `Evidence locator is already owned by acceptance evidence role ${priorOwner}.`,
          })
        } else {
          locatorOwners.set(key, criterion.criterion_id)
        }
      }
    }
    if (!gap.criteria.some((criterion) => criterion.state === "open")) {
      context.addIssue({ code: "custom", path: ["criteria"], message: "A Mission acceptance resume requires at least one open criterion." })
    }
    if (locatorOwners.size > 64) {
      context.addIssue({ code: "custom", path: ["criteria"], message: "One acceptance gap may cite at most 64 canonical evidence locators." })
    }
  })

export type MissionAcceptanceCriterionResponsibility = z.infer<typeof MissionAcceptanceCriterionResponsibilitySchema>
export type MissionAcceptanceCriterion = z.infer<typeof MissionAcceptanceCriterionSchema>
export type MissionAcceptanceOpenCriterion = Extract<MissionAcceptanceCriterion, { state: "open" }>
export type MissionAcceptanceGapInput = z.infer<typeof MissionAcceptanceGapInputSchema>
export type MissionAcceptanceGap = z.infer<typeof MissionAcceptanceGapSchema>

export function acceptanceGapReadReferences(gap: MissionAcceptanceGapInput): string[] {
  return gap.criteria.flatMap(inputCriterionReadReferences)
}

function repairActionIdentity(action: z.infer<typeof MissionAcceptanceRepairActionInputSchema>): string {
  return createHash("sha256").update(canonicalJSONValue(action, "mission-acceptance-repair-action-v1")).digest("hex")
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
    criteria: input.gap.criteria.map((criterion) => {
      const common = {
        criterion_id: criterion.criterion_id,
        state: criterion.state,
        finding: criterion.finding,
        responsibility: criterion.responsibility,
        observation_evidence_locators: criterion.observation_evidence_read_refs.map(locator),
        repair_evidence_locators: criterion.repair_evidence_read_refs.map(locator),
        resolution_evidence_locators: criterion.resolution_evidence_read_refs.map(locator),
        invalidating_evidence_locators: criterion.invalidating_evidence_read_refs.map(locator),
        irreducible_blocker_evidence_locators: criterion.irreducible_blocker_evidence_read_refs.map(locator),
      }
      if (criterion.state === "open") {
        return {
          ...common,
          disposition: criterion.disposition,
          repair_action: { ...criterion.repair_action, identity_sha256: repairActionIdentity(criterion.repair_action) },
        }
      }
      return common
    }),
  })
}

export function acceptanceCriterionEvidenceLocators(criterion: MissionAcceptanceCriterion): ArtifactReadLocator[] {
  return criterionEvidenceLocators(MissionAcceptanceCriterionSchema.parse(criterion))
}

export function acceptanceGapEvidenceLocators(gap: MissionAcceptanceGap): ArtifactReadLocator[] {
  const byIdentity = new Map<string, ArtifactReadLocator>()
  for (const locator of gap.criteria.flatMap(acceptanceCriterionEvidenceLocators)) {
    byIdentity.set(artifactReadLocatorKey(locator), locator)
  }
  return [...byIdentity.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, locator]) => locator)
}

function responsibilityText(responsibility: MissionAcceptanceCriterionResponsibility): string {
  return responsibility.kind === "workflow_node"
    ? `${responsibility.workflow_id}/${responsibility.workflow_node_id}`
    : `${responsibility.package_revision.namespace}/${responsibility.package_revision.id}@${responsibility.package_revision.version} agent=${responsibility.agent_id} lineage=${responsibility.dispatch_lineage_id}`
}

export function renderMissionAcceptanceRepairMessage(rawGap: MissionAcceptanceGap): string {
  const gap = MissionAcceptanceGapSchema.parse(rawGap)
  return [
    "# Mission acceptance repair",
    "",
    `- gap_id: ${gap.gap_id}`,
    `- reviewed_terminal_lifecycle_reference: ${JSON.stringify(gap.reviewed_terminal_lifecycle_reference)}`,
    "",
    ...gap.criteria.flatMap((criterion) => {
      const common = [
        `## ${criterion.criterion_id}`,
        "",
        `- state: ${criterion.state}`,
        `- finding: ${criterion.finding}`,
        `- responsibility: ${responsibilityText(criterion.responsibility)}`,
        `- observation_evidence_locators: ${JSON.stringify(criterion.observation_evidence_locators)}`,
        `- repair_evidence_locators: ${JSON.stringify(criterion.repair_evidence_locators)}`,
        `- resolution_evidence_locators: ${JSON.stringify(criterion.resolution_evidence_locators)}`,
        `- invalidating_evidence_locators: ${JSON.stringify(criterion.invalidating_evidence_locators)}`,
        `- irreducible_blocker_evidence_locators: ${JSON.stringify(criterion.irreducible_blocker_evidence_locators)}`,
      ]
      if (criterion.state === "open") {
        return [
          ...common,
          `- disposition: ${criterion.disposition}`,
          `- repair_action: ${JSON.stringify(criterion.repair_action)}`,
          "",
        ]
      }
      return [...common, ""]
    }),
  ].join("\n")
}
