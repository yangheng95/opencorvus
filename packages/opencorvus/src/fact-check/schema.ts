/**
 * Fact-check domain schemas.
 *
 * Per fact-check agent contract §6.1.1 and codex round 4 §C-2,
 * this file MUST stay pure zod with zero runtime imports (no Session,
 * orchestrator, build, persist, tools dependencies). Otherwise it would
 * make a fact-check agent runtime into a project-wide low-level
 * dependency, which is the wrong direction.
 *
 * Consumers:
 *   - fact-check/tools.ts (domain artifact tool schema)
 *   - fact-check/persist.ts (artifact schema)
 *   - domain artifacts that expose factual claims for independent review
 *   - orchestrator/tools.ts (fact_check input/output)
 */

import { z } from "zod"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"

/**
 * Fact-Check Item (FCI, Fact-Check Item): a factual claim exposed by a
 * domain artifact for independent review.
 */
export const FactCheckItemSchema = z
  .object({
    /** Full standalone assertion. min/max enforced to push the agent toward
     *  specific claims; generic words ("tbd", "unknown") are flagged at
     *  fact-check time as ambiguous, not rejected here (rule 20: no host
     *  keyword regex). */
    claim: z.string().min(20).max(280),
    /** Agent self-assessment. Honest "low" is rewarded; over-claiming
     *  "high" surfaces as a verifier finding. */
    confidence: z.enum(["low", "medium", "high"]),
    /** Routes the verifier toward the right retrieval modality. */
    category: z.enum(["api", "library", "number", "history", "path", "protocol", "other"]),
    /** Where the worker got the claim from. Empty string forbidden by
     *  min(3). Conventional values: "assumed", "model prior", "<url>",
     *  "<file:line>", "user-said:<short>". */
    source: z.string().min(3),
  })
  .strict()
  .meta({ ref: "FactCheckItem" })
export type FactCheckItem = z.infer<typeof FactCheckItemSchema>

/**
 * A list of factual claims exposed by a domain artifact.
 */
export const FactCheckItemListSchema = z.array(FactCheckItemSchema)
export type FactCheckItemList = z.infer<typeof FactCheckItemListSchema>

/** Evidence pointer for a verified or corrected claim. */
export const FactCheckEvidenceSchema = z
  .object({
    kind: z.enum(["web", "code", "memory"]),
    pointer: z.string().min(1),
    excerpt: z.string().max(800),
  })
  .meta({ ref: "FactCheckEvidence" })
export type FactCheckEvidence = z.infer<typeof FactCheckEvidenceSchema>

/** Verified item — claim was accurate; evidence supports it. */
export const FactCheckVerifiedItemSchema = z.object({
  claim: z.string(),
  evidence: z.array(FactCheckEvidenceSchema).min(1),
})
export type FactCheckVerifiedItem = z.infer<typeof FactCheckVerifiedItemSchema>

/** Corrected item — claim was wrong; correction + evidence + affected surface. */
export const FactCheckCorrectedItemSchema = z
  .object({
    claim: z.string(),
    correction: z.string(),
    severity: z.enum(["minor", "material", "blocking"]),
    evidence: z.array(FactCheckEvidenceSchema).min(1),
    impact: z
      .string()
      .min(1)
      .max(800)
      .describe(
        "What delivered claim, behavior, contract, or evidence is affected; do not prescribe a scheduler tool.",
      ),
  })
  .strict()
export type FactCheckCorrectedItem = z.infer<typeof FactCheckCorrectedItemSchema>

/** Unresolved item — couldn't reach a confident verdict. */
export const FactCheckUnresolvedItemSchema = z.object({
  claim: z.string(),
  why_unresolved: z
    .enum(["no_network", "rate_limited", "ambiguous", "out_of_scope", "tool_failed"])
    .describe(
      "Why this verifier could not judge the claim. out_of_scope means the claim is outside this verifier's assigned role or available tools; it does not refute the claim or declare it outside the Task.",
    ),
  severity: z
    .enum(["minor", "material", "blocking"])
    .describe(
      "Impact on the delivered contract if this claim is false or remains unproved; this is evidence for scheduler judgment, not a Task lifecycle command.",
    ),
})
export type FactCheckUnresolvedItem = z.infer<typeof FactCheckUnresolvedItemSchema>

/**
 * Fact-check review. This is a domain artifact, not a session-completion
 * signal. It intentionally has no `fact_check_items` field because the
 * review records judgments about the input claims.
 */
export const FactCheckReviewSchema = z
  .object({
    scope: z.object({
      target_session_id: z.string(),
      target_agent: z.string(),
      target_message_id: z.string(),
      target_message_content_hash: z.string(),
      items_total: z.number().int().nonnegative(),
      items_inspected: z.number().int().nonnegative(),
    }),
    verified: z.array(FactCheckVerifiedItemSchema),
    corrected: z.array(FactCheckCorrectedItemSchema),
    unresolved: z.array(FactCheckUnresolvedItemSchema),
    overall_verdict: z.enum(["clean", "minor_corrections", "needs_orchestrator_action", "inconclusive"]),
  })
  .meta({ ref: "FactCheckReview" })
export type FactCheckReview = z.infer<typeof FactCheckReviewSchema>

/** Durable FactCheckReview artifact with host-owned target references. */
export const FactCheckReviewArtifactSchema = ArtifactConsumptionProvenanceSchema.safeExtend({
  target_session_id: z.string(),
  target_agent: z.string(),
  target_message_id: z.string(),
  target_message_content_hash: z.string(),
  invoked_by_orchestrator_session_id: z.string(),
  fact_check_session_id: z.string(),
  review: FactCheckReviewSchema,
})
export type FactCheckReviewArtifact = z.infer<typeof FactCheckReviewArtifactSchema>

/**
 * Apply the verdict decision tree from spec §3.3 to a partial report.
 * Pure function; lives here so worker code, fact-check tooling, and tests
 * share one implementation (rule 8 single source).
 */
export function deriveFactCheckVerdict(input: {
  items_total: number
  items_inspected: number
  corrected: FactCheckCorrectedItem[]
  unresolved: FactCheckUnresolvedItem[]
}): FactCheckReview["overall_verdict"] {
  // Explicit boundary: empty registration = clean, no claims to check.
  if (input.items_total === 0) return "clean"

  const hasBlocking =
    input.corrected.some((c) => c.severity === "material" || c.severity === "blocking") ||
    input.unresolved.some((u) => u.severity === "material" || u.severity === "blocking")
  if (hasBlocking) return "needs_orchestrator_action"

  const correctedCount = input.corrected.length
  // Inconclusive when fewer than half inspected AND no minor-or-higher corrections.
  if (input.items_inspected < input.items_total / 2 && correctedCount === 0) {
    return "inconclusive"
  }

  if (correctedCount > 0 || input.unresolved.length > 0) return "minor_corrections"
  return "clean"
}

export function validateFactCheckReviewSemantics(review: FactCheckReview): string | undefined {
  if (review.scope.items_inspected > review.scope.items_total) {
    return `items_inspected (${review.scope.items_inspected}) cannot exceed items_total (${review.scope.items_total}).`
  }
  const classifiedCount = review.verified.length + review.corrected.length + review.unresolved.length
  if (classifiedCount !== review.scope.items_inspected) {
    return (
      `classified item count (${classifiedCount}) must equal scope.items_inspected ` +
      `(${review.scope.items_inspected}) for the fact-check review.`
    )
  }
  const expected = deriveFactCheckVerdict({
    items_total: review.scope.items_total,
    items_inspected: review.scope.items_inspected,
    corrected: review.corrected,
    unresolved: review.unresolved,
  })
  if (review.overall_verdict !== expected) {
    return `overall_verdict must be "${expected}" for the recorded corrected/unresolved/items counts; got "${review.overall_verdict}".`
  }
  return undefined
}
