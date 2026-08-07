import z from "zod"
import {
  IntegrityFindingSchema,
  IntegrityRequiredRepairSchema,
  IntegrityReviewSchema,
  type IntegrityReview,
} from "./team-schema"
import {
  assertIntegrityFindingFingerprint,
  integrityFindingFingerprint,
  isIntegrityFindingFingerprint,
} from "./finding-manifest"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
  EngineArtifactLocatorSchema,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin/artifact-catalog"

export const IntegrityReviewArtifactPhaseSchema = z.enum(["pre_build", "post_build"])

const IntegrityReviewArtifactFingerprintSchema = z.string().refine(isIntegrityFindingFingerprint, {
  message: "fingerprint must match if_[a-f0-9]{16}",
})

export const IntegrityReviewArtifactFindingPayloadSchema = IntegrityFindingSchema.safeExtend({
  fingerprint: IntegrityReviewArtifactFingerprintSchema,
  canonicalSymptom: z.string().min(1),
  verify: z.array(z.string().min(1)).min(1),
}).strict()

export const IntegrityReviewArtifactRequiredRepairPayloadSchema = IntegrityRequiredRepairSchema.safeExtend({
  fingerprint: IntegrityReviewArtifactFingerprintSchema,
  canonicalSymptom: z.string().min(1),
  verify: z.array(z.string().min(1)).min(1),
}).strict()

export const IntegrityPersistedReviewSchema = IntegrityReviewSchema.safeExtend({
  findings: z.array(IntegrityReviewArtifactFindingPayloadSchema),
  requiredRepairs: z.array(IntegrityReviewArtifactRequiredRepairPayloadSchema),
}).strict()

export const IntegrityReviewArtifactPayloadSchema = ArtifactConsumptionProvenanceSchema.safeExtend({
  ...IntegrityPersistedReviewSchema.shape,
  goal_ids: z.array(z.string().min(1)),
  requirement_set_artifact_locators: z.array(EngineArtifactLocatorSchema),
  contract_graph_artifact_locators: z.array(EngineArtifactLocatorSchema),
  evidence_artifact_locators: z.array(ArtifactReadLocatorSchema),
  session_id: z.string().min(1),
  final_message_id: z.string().min(1),
  phase: IntegrityReviewArtifactPhaseSchema,
  review_number: z.number().int().positive(),
  time_recorded: z.number().int().nonnegative(),
})

export type IntegrityReviewArtifactPayload = z.infer<typeof IntegrityReviewArtifactPayloadSchema>
export type IntegrityReviewArtifactFindingPayload = z.infer<typeof IntegrityReviewArtifactFindingPayloadSchema>
export type IntegrityReviewArtifactRequiredRepairPayload = z.infer<
  typeof IntegrityReviewArtifactRequiredRepairPayloadSchema
>

export type IntegrityReviewArtifactPayloadInput = {
  goalIDs: string[]
  requirementSetArtifactLocators: EngineArtifactLocator[]
  contractGraphArtifactLocators: EngineArtifactLocator[]
  evidenceArtifactLocators: ArtifactReadLocator[]
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  sessionID: string
  finalMessageID: string
  phase: z.infer<typeof IntegrityReviewArtifactPhaseSchema>
  reviewNumber: number
  review: IntegrityReview
  timeRecorded: number
}

export function createIntegrityReviewArtifactPayload(
  input: IntegrityReviewArtifactPayloadInput,
): IntegrityReviewArtifactPayload {
  const review = IntegrityReviewSchema.parse(input.review)
  const findings = review.findings.map((finding) => {
    const fingerprint = integrityFindingFingerprint(finding)
    if (finding.fingerprint) {
      assertIntegrityFindingFingerprint(finding.fingerprint, `integrity finding ${finding.id}.fingerprint`)
      if (finding.fingerprint !== fingerprint) {
        throw new Error(`integrity finding ${finding.id}.fingerprint does not match the host-computed fingerprint`)
      }
    }
    return IntegrityReviewArtifactFindingPayloadSchema.parse({ ...finding, fingerprint })
  })
  const requiredRepairs = review.requiredRepairs.map((repair) => {
    const fingerprint = integrityFindingFingerprint(repair)
    if (repair.fingerprint) {
      assertIntegrityFindingFingerprint(repair.fingerprint, `integrity required repair ${repair.id}.fingerprint`)
      if (repair.fingerprint !== fingerprint) {
        throw new Error(
          `integrity required repair ${repair.id}.fingerprint does not match the host-computed fingerprint`,
        )
      }
    }
    return IntegrityReviewArtifactRequiredRepairPayloadSchema.parse({ ...repair, fingerprint })
  })

  return IntegrityReviewArtifactPayloadSchema.parse({
    ...review,
    findings,
    requiredRepairs,
    goal_ids: input.goalIDs,
    requirement_set_artifact_locators: input.requirementSetArtifactLocators,
    contract_graph_artifact_locators: input.contractGraphArtifactLocators,
    evidence_artifact_locators: input.evidenceArtifactLocators,
    observed_artifact_locators: input.observedArtifactLocators,
    source_artifact_locators: input.sourceArtifactLocators,
    session_id: input.sessionID,
    final_message_id: input.finalMessageID,
    phase: input.phase,
    review_number: input.reviewNumber,
    time_recorded: input.timeRecorded,
  })
}

export function parseIntegrityReviewArtifactPayload(value: unknown, context: string): IntegrityReviewArtifactPayload {
  const parsed = IntegrityReviewArtifactPayloadSchema.safeParse(value)
  if (parsed.success) return parsed.data
  const issue = parsed.error.issues[0]
  const path = issue?.path.length ? ` at ${issue.path.join(".")}` : ""
  const detail = issue ? `: ${issue.message}` : ""
  throw new Error(`${context} is invalid${path}${detail}`)
}
