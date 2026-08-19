/**
 * Requirements data shapes — narrow scope: REQ-N list + foundational decisions.
 *
 * The Requirements Agent no longer produces goals, acceptance-source mappings, fidelity
 * coverage, assembly ownership, or cross-goal contracts. The Architect owns
 * decomposition — see @/architect/types for the Architect-emitted types.
 */
import z from "zod"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  type ArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"
import { Identifier } from "@/id/id"

export const RequirementDeclaredIDSchema = z
  .string()
  .trim()
  .regex(/^REQ-[1-9]\d*$/, "Requirement declared ID must use REQ-N format with a positive integer N")

export type RequirementDeclaredID = z.infer<typeof RequirementDeclaredIDSchema>

export const RequirementSchema = z
  .object({
    id: RequirementDeclaredIDSchema,
    type: z.enum(["explicit", "implicit"]),
    description: z.string().trim().min(5).max(4_000),
    acceptance: z.string().trim().min(1).max(4_000),
    non_goals: z.string().trim().min(1).max(4_000),
    evidence_refs: z.array(ArtifactReadLocatorSchema),
  })
  .strict()

export type ParsedRequirement = z.infer<typeof RequirementSchema>

export const RequirementsDecisionSchema = z
  .object({
    key: z.string().trim().min(1).max(160),
    value: z.string().trim().min(1).max(4_000),
    reason: z.string().trim().max(4_000),
  })
  .strict()

export type RequirementsDecision = z.infer<typeof RequirementsDecisionSchema>

export const RequirementCoverageUnresolvedSchema = z
  .object({
    code: z.string().trim().min(1).max(128),
    detail: z.string().trim().min(1).max(2_000),
  })
  .strict()

export const RequirementCoverageDeclarationSchema = z
  .object({
    status: z.enum(["complete", "incomplete"]),
    request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    requirement_ids: z.array(RequirementDeclaredIDSchema),
    source_artifact_locators: z.array(ArtifactReadLocatorSchema),
    unresolved: z.array(RequirementCoverageUnresolvedSchema),
  })
  .strict()
  .superRefine((value, context) => {
    for (const [field, identities] of [
      ["requirement_ids", value.requirement_ids],
      ["source_artifact_locators", value.source_artifact_locators.map((locator) => JSON.stringify(locator))],
    ] as const) {
      const seen = new Set<string>()
      for (const [index, identity] of identities.entries()) {
        if (seen.has(identity)) {
          context.addIssue({ code: "custom", path: [field, index], message: `${field} must contain unique identities` })
        }
        seen.add(identity)
      }
    }
  })

export type RequirementCoverageDeclaration = z.infer<typeof RequirementCoverageDeclarationSchema>

export const RequirementCoverageIssueSchema = z.enum([
  "finalization_missing",
  "declared_incomplete",
  "no_requirements_registered",
  "request_identity_mismatch",
  "requirement_identity_mismatch",
  "source_identity_mismatch",
  "requirement_evidence_identity_mismatch",
  "unresolved_items",
])
export type RequirementCoverageIssue = z.infer<typeof RequirementCoverageIssueSchema>

export const RequirementCoverageReceiptSchema = z
  .object({
    status: z.enum(["complete", "incomplete"]),
    request_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    requirement_ids: z.array(RequirementDeclaredIDSchema),
    source_artifact_locators: z.array(ArtifactReadLocatorSchema),
    unresolved: z.array(RequirementCoverageUnresolvedSchema),
    issues: z.array(RequirementCoverageIssueSchema),
    declaration: RequirementCoverageDeclarationSchema.nullable(),
  })
  .strict()

export type RequirementCoverageReceipt = z.infer<typeof RequirementCoverageReceiptSchema>

export const RequirementSetSchema = z
  .object({
    requirements: z.array(RequirementSchema),
    decisions: z.array(RequirementsDecisionSchema),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>()
    for (const [index, requirement] of value.requirements.entries()) {
      if (seen.has(requirement.id)) {
        context.addIssue({
          code: "custom",
          path: ["requirements", index, "id"],
          message: `RequirementSet contains duplicate identity ${requirement.id}`,
        })
      }
      seen.add(requirement.id)
    }
  })

export type RequirementSet = z.infer<typeof RequirementSetSchema>

export const RequirementSetArtifactPayloadSchema = ArtifactConsumptionProvenanceSchema.safeExtend({
  schema_version: z.literal(2),
  requirements: RequirementSetSchema.shape.requirements,
  decisions: RequirementSetSchema.shape.decisions,
  producer: z
    .object({
      session_id: Identifier.schema("session"),
      final_message_id: Identifier.schema("message"),
    })
    .strict(),
  coverage_receipt: RequirementCoverageReceiptSchema,
}).strict()

export type RequirementSetArtifactPayload = z.infer<typeof RequirementSetArtifactPayloadSchema>
