import z from "zod"
import { FactCheckItemListSchema } from "@/fact-check/schema"

export const IntegrityVerdictSchema = z.enum(["pass", "concerns", "needs_correction"])
export type IntegrityVerdict = z.infer<typeof IntegrityVerdictSchema>

export const IntegrityCoverageStatusValues = ["covered", "missing", "inconclusive"] as const
export const IntegrityCoverageStatusSchema = z.enum(IntegrityCoverageStatusValues)
export type IntegrityCoverageStatus = z.infer<typeof IntegrityCoverageStatusSchema>
export const IntegrityCheckItemStatusSchema = z.enum(["passed", "failed", "inconclusive"])
export type IntegrityCheckItemStatus = z.infer<typeof IntegrityCheckItemStatusSchema>
const IntegrityCheckIDListSchema = z
  .array(z.string().min(1))
  .min(1)
  .describe("Registered Integrity check item IDs that support this review row.")

export const IntegrityCheckItemSchema = z
  .object({
    id: z.string().min(1),
    reviewerID: z.string().min(1).optional(),
    category: z
      .string()
      .min(1)
      .describe(
        "Review category such as requirement, acceptance-spec, visual-evidence, runtime, code, or integration.",
      ),
    target: z
      .string()
      .min(1)
      .describe("Concrete requirement, acceptance spec, goal, file, route, command, or evidence surface checked."),
    question: z.string().min(1).describe("Concrete falsification question inspected for this check."),
    status: IntegrityCheckItemStatusSchema,
    expected: z.string().min(1),
    observed: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    requirementIDs: z.array(z.string().min(1)),
    specIDs: z.array(z.string().min(1)),
    targetIDs: z.array(z.string().min(1)),
    userRequestQuotes: z.array(z.string().min(1)),
  })
  .strict()

export type IntegrityCheckItem = z.infer<typeof IntegrityCheckItemSchema>

export const IntegrityFindingSchema = z
  .object({
    id: z.string().min(1),
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs that exposed this finding."),
    severity: z.enum(["blocking", "advisory"]),
    verdictImpact: IntegrityVerdictSchema,
    fingerprint: z.string().min(1).optional(),
    canonicalSymptom: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    targetIDs: z.array(z.string().min(1)),
    requirementIDs: z.array(z.string().min(1)),
    specIDs: z.array(z.string().min(1)),
    userRequestQuotes: z.array(z.string().min(1)),
    filePaths: z.array(z.string().min(1)),
    affectedSymbols: z.array(z.string().min(1)),
    repair: z.string().min(1),
    verify: z.array(z.string().min(1)).min(1),
    sourceFindingIDs: z.array(z.string().min(1)),
    priorReviewRefs: z.array(z.string().min(1)),
    reviewers: z.array(z.string().min(1)),
    consensus: z.enum(["agreed", "disputed", "unresolved"]),
  })
  .strict()

export type IntegrityFinding = z.infer<typeof IntegrityFindingSchema>

export const IntegrityReviewerReviewSchema = z
  .object({
    reviewerID: z.string().min(1),
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs this reviewer review summarizes."),
    scope: z.string().min(1),
    verdict: IntegrityVerdictSchema,
    summary: z.string().min(1),
    investigationPlan: z
      .object({
        requestPromise: z
          .string()
          .min(1)
          .describe("Concrete original user, REQ, or acceptance-spec promise this reviewer is falsifying."),
        hypothesis: z.string().min(1).describe("Concrete way the scoped promise could fail."),
        evidencePlan: z
          .array(z.string().min(1))
          .min(1)
          .describe("Evidence this reviewer planned to inspect before passing or filing a finding."),
        passCriteria: z
          .array(z.string().min(1))
          .min(1)
          .describe("Concrete evidence threshold for pass versus finding."),
      })
      .strict()
      .describe("Required falsification plan for this reviewer review."),
    drilldowns: z.array(
      z
        .object({
          checkIDs: IntegrityCheckIDListSchema,
          kind: z.string().min(1).describe("Evidence tool or inspection category."),
          target: z
            .string()
            .min(1)
            .describe("Concrete file, directory, command, evidence section, or artifact inspected."),
          purpose: z.string().min(1).describe("Why this evidence was inspected for the reviewer scope."),
          result: z
            .string()
            .min(1)
            .describe("What the inspection showed. Do not add finding fields such as affectedSymbols here."),
        })
        .strict(),
    ),
    coverage: z.array(
      z
        .object({
          checkIDs: IntegrityCheckIDListSchema,
          requirementID: z
            .string()
            .min(1)
            .describe("Singular coverage anchor such as REQ-1. Do not use requirementIDs here.")
            .optional(),
          specID: z
            .string()
            .min(1)
            .describe("Singular coverage anchor for one acceptance spec id. Do not use specIDs here.")
            .optional(),
          userRequestQuote: z
            .string()
            .min(1)
            .describe("Singular literal user-request quote. Do not use userRequestQuotes here.")
            .optional(),
          status: IntegrityCoverageStatusSchema.describe(
            "Coverage status only. Do not use verdict values such as pass, concerns, or needs_correction here.",
          ),
          evidence: z.string().min(1),
        })
        .strict()
        .refine(
          (value) => Boolean(value.requirementID || value.specID || value.userRequestQuote),
          "coverage rows require requirementID, specID, or userRequestQuote",
        ),
    ),
    evidence: z.array(
      z
        .object({
          checkIDs: IntegrityCheckIDListSchema,
          note: z.string().min(1),
        })
        .strict(),
    ),
    openQuestions: z.array(z.string().min(1)),
  })
  .strict()

export type IntegrityReviewerReview = z.infer<typeof IntegrityReviewerReviewSchema>

export const IntegrityReviewRoundSchema = z
  .object({
    roundID: z.string().min(1),
    prompt: z.string().min(1),
    reviewerIDs: z.array(z.string().min(1)).min(1),
    outcome: z.string().min(1),
  })
  .strict()

export type IntegrityReviewRound = z.infer<typeof IntegrityReviewRoundSchema>

export const IntegrityRequiredRepairSchema = z
  .object({
    id: z.string().min(1),
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs that require this repair."),
    fingerprint: z.string().min(1).optional(),
    severity: z.enum(["blocking", "advisory"]),
    title: z.string().min(1),
    canonicalSymptom: z.string().min(1),
    description: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    targetIDs: z.array(z.string().min(1)),
    requirementIDs: z.array(z.string().min(1)),
    specIDs: z.array(z.string().min(1)),
    filePaths: z.array(z.string().min(1)),
    affectedSymbols: z.array(z.string().min(1)),
    repair: z.string().min(1),
    verify: z.array(z.string().min(1)).min(1),
    sourceFindingIDs: z.array(z.string().min(1)).min(1),
    priorReviewRefs: z.array(z.string().min(1)),
  })
  .strict()

export type IntegrityRequiredRepair = z.infer<typeof IntegrityRequiredRepairSchema>

export const IntegrityUnresolvedDisagreementSchema = z
  .object({
    id: z.string().min(1),
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs involved in this disagreement."),
    description: z.string().min(1),
    reviewerIDs: z.array(z.string().min(1)).min(2),
    consequence: z.string().min(1),
  })
  .strict()

export type IntegrityUnresolvedDisagreement = z.infer<typeof IntegrityUnresolvedDisagreementSchema>

export const IntegrityCoverageAuditRowSchema = z
  .object({
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs that support this coverage audit row."),
    promise: z.string().min(1),
    reviewerIDs: z.array(z.string().min(1)),
    status: IntegrityCoverageStatusSchema.describe(
      "Coverage status only. Do not use verdict values such as pass, concerns, or needs_correction here.",
    ),
    notes: z.string().min(1),
  })
  .strict()

export type IntegrityCoverageAuditRow = z.infer<typeof IntegrityCoverageAuditRowSchema>

export const IntegrityUninspectedRiskSchema = z
  .object({
    checkIDs: z
      .array(z.string().min(1))
      .min(1)
      .describe("Registered Integrity check item IDs that left this risk uninspected."),
    risk: z.string().min(1),
    reason: z.string().min(1),
    action: z.enum(["block", "re-review", "advisory"]),
  })
  .strict()

export type IntegrityUninspectedRisk = z.infer<typeof IntegrityUninspectedRiskSchema>

export const IntegrityReviewSchema = z
  .object({
    verdict: IntegrityVerdictSchema.optional(),
    summary: z.string().min(1).optional(),
    checkItems: z.array(IntegrityCheckItemSchema).default([]),
    reviewers: z.array(IntegrityReviewerReviewSchema).default([]),
    coverageAudit: z.array(IntegrityCoverageAuditRowSchema).default([]),
    uninspectedRisks: z.array(IntegrityUninspectedRiskSchema).default([]),
    findings: z.array(IntegrityFindingSchema).default([]),
    rounds: z.array(IntegrityReviewRoundSchema).default([]),
    requiredRepairs: z.array(IntegrityRequiredRepairSchema).default([]),
    unresolvedDisagreements: z.array(IntegrityUnresolvedDisagreementSchema).default([]),
    // Optional fact-check registration for claims not verified in this review session.
    fact_check_items: FactCheckItemListSchema.describe(
      "Every factual claim (API behaviour, library version, third-party protocol, number, path, history) the integrity team has NOT verified via tool calls in this session. Empty when only review judgments or in-session-verified statements.",
    ),
  })
  .strict()

export type IntegrityReview = z.infer<typeof IntegrityReviewSchema>
