import z from "zod"
import { createHash } from "node:crypto"
import { EngineArtifactLocatorSchema, type EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import type { PersistedBrowserPreviewEvidence } from "@/browser-preview/persist"
import { VisualReviewArtifactPayloadSchema, type VisualReviewArtifact } from "@/visual-qa/persist"
import { VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME } from "./prebuilt-scorer"

export const VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL = VISUAL_FEEDBACK_VERIFICATION_SCORER_NAME

export const VisualFeedbackVerificationSchema = z
  .object({
    id: z.string().min(1),
    taskID: z.string().min(1),
    visualQaSessionID: z.string().min(1),
    finalMessageID: z.string().min(1),
    visualReviewLocator: EngineArtifactLocatorSchema,
    judgmentToolMessageID: z.string().min(1).optional(),
    judgmentToolPartID: z.string().min(1).optional(),
    judgmentToolCallID: z.string().min(1).optional(),
    previewTargetID: z.string().min(1).optional(),
    projectRoot: z.string().min(1),
    status: z.enum(["passed", "failed"]),
    summary: z.string().min(1),
    requiredReferenceRegions: z.array(z.string().min(1)),
    referenceComparisonEvidence: z.array(
      z
        .object({
          evidenceLocator: EngineArtifactLocatorSchema,
          sourceSHA256: z.string().regex(/^[a-f0-9]{64}$/),
          implementationSHA256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
    productionBlockerIDs: z.array(z.string().min(1)),
    contractIssues: z.array(z.string().min(1)),
  })
  .strict()

export const VisualFeedbackVerificationListSchema = z.array(VisualFeedbackVerificationSchema)

export type VisualFeedbackVerification = z.infer<typeof VisualFeedbackVerificationSchema>

const ReferenceComparisonContentMetricsSchema = z
  .object({
    content_pixel_ratio: z.number().finite().nonnegative(),
    unique_color_count: z.number().finite().int().nonnegative(),
  })
  .strict()

const ReferenceComparisonCaptureSchema = z
  .object({
    operation: z.literal("reference-comparison").optional(),
    region: z
      .object({
        region_id: z.string().min(1),
        viewport_id: z.string().min(1),
        crop_intent: z.string().min(1).optional(),
        source_bbox: z
          .object({
            x: z.number().finite().nonnegative(),
            y: z.number().finite().nonnegative(),
            width: z.number().finite().positive(),
            height: z.number().finite().positive(),
          })
          .strict()
          .optional(),
        source_image_size: z
          .object({
            width: z.number().finite().positive(),
            height: z.number().finite().positive(),
          })
          .strict()
          .optional(),
        visual: z
          .object({
            dimensions_match: z.boolean(),
            total_pixels: z.number().finite().positive(),
          })
          .passthrough()
          .optional(),
        coverage: z
          .object({
            implementation_matches_source_size: z.boolean(),
          })
          .passthrough()
          .optional(),
        content: z
          .object({
            source: ReferenceComparisonContentMetricsSchema,
            implementation: ReferenceComparisonContentMetricsSchema,
          })
          .strict()
          .optional(),
      })
      .passthrough(),
  })
  .passthrough()

export function summarizeVisualFeedbackVerification(verification: VisualFeedbackVerification): string {
  return [
    `visual_feedback_verification=${verification.id}`,
    `task=${verification.taskID}`,
    `visual_qa_session=${verification.visualQaSessionID}`,
    `final_message=${verification.finalMessageID}`,
    `visual_review_locator=${JSON.stringify(verification.visualReviewLocator)}`,
    `judgment_tool_message=${verification.judgmentToolMessageID ?? "(not recorded)"}`,
    `judgment_tool_part=${verification.judgmentToolPartID ?? "(not recorded)"}`,
    `judgment_tool_call=${verification.judgmentToolCallID ?? "(not recorded)"}`,
    `preview_target=${verification.previewTargetID ?? "(none)"}`,
    `status=${verification.status}`,
    `reference_regions=${verification.requiredReferenceRegions.join(", ") || "(none)"}`,
    `reference_comparison_evidence=${verification.referenceComparisonEvidence.map((item) => JSON.stringify(item.evidenceLocator)).join(", ") || "(none)"}`,
    `production_blockers=${verification.productionBlockerIDs.join(", ") || "(none)"}`,
    `summary=${verification.summary}`,
  ].join(" | ")
}

/**
 * Everything this verdict reads. The judgment names what it needs and the
 * caller supplies it, so the rule set can be exercised against fabricated
 * evidence instead of a live Session, Engine Artifact table, and evidence
 * directory. Reversing this — reading the three stores from inside the
 * judgment — is what made the rules untestable in isolation.
 */
export type VisualFeedbackVerificationArtifactRow = {
  id: string
  kind: string
  task_id: string
  payload: unknown
  time_created: number
}

export type VisualFeedbackVerificationEvidenceReader<Row extends VisualFeedbackVerificationArtifactRow> = Readonly<{
  engineArtifactByLocator(input: { taskID: string; locator: EngineArtifactLocator }): Row
  sessionMessages(sessionID: string): Promise<
    readonly {
      info: { id: string }
      parts: readonly {
        id: string
        type: string
        tool?: string
        callID?: string
        state?: { status: string; input?: unknown }
      }[]
    }[]
  >
  browserPreviewEvidence(input: {
    projectRoot: string
    row: Row
  }): Promise<{ evidence: PersistedBrowserPreviewEvidence; bytesByRole: ReadonlyMap<string, Buffer> }>
}>

/**
 * Why one visual-feedback check rejected the verification.
 *
 * The verdict used to be a bare `string[]` whose only consumer collapsed it to
 * 0 or 1, so "the source artifact could not be read" and "the rendered crop is
 * blank" were indistinguishable downstream. The code names which family of
 * gate rejected it; the detail stays human-readable.
 */
export const VISUAL_FEEDBACK_VERIFICATION_ISSUE_CODES = [
  /** A fact points at a different task, target, artifact kind, or call identity. */
  "identity_mismatch",
  /** A required declaration, capture, or metric is absent. */
  "evidence_missing",
  /** Evidence exists but could not be read, or its bytes no longer match. */
  "evidence_unreadable",
  /** Evidence read cleanly and the check itself did not pass. */
  "verdict_failed",
  /** Carried through from the verification fact's own contract issues. */
  "contract_failed",
] as const

export type VisualFeedbackVerificationIssueCode = (typeof VISUAL_FEEDBACK_VERIFICATION_ISSUE_CODES)[number]

export type VisualFeedbackVerificationIssue = {
  code: VisualFeedbackVerificationIssueCode
  detail: string
}

export async function validateVisualFeedbackVerification<Row extends VisualFeedbackVerificationArtifactRow>(input: {
  verification: VisualFeedbackVerification
  expectedTaskID: string
  reader: VisualFeedbackVerificationEvidenceReader<Row>
}): Promise<{ passing: boolean; issues: VisualFeedbackVerificationIssue[]; summaries: string[] }> {
  const { reader } = input
  const issues: VisualFeedbackVerificationIssue[] = []
  const note = (code: VisualFeedbackVerificationIssueCode, detail: string) => issues.push({ code, detail })
  const summaries: string[] = []
  const verification = input.verification
  if (verification.taskID !== input.expectedTaskID) {
    note("identity_mismatch", `verification ${verification.id} belongs to task ${verification.taskID}, not ${input.expectedTaskID}`)
  }
  for (const detail of verification.contractIssues) note("contract_failed", detail)
  let visualReviewArtifact: VisualReviewArtifact | undefined
  try {
    const row = reader.engineArtifactByLocator({
      taskID: input.expectedTaskID,
      locator: verification.visualReviewLocator,
    })
    if (row.kind !== "visual_review") {
      note("identity_mismatch", 
        `verification ${verification.id} visualReviewLocator resolves to kind ${row.kind}, expected visual_review`,
      )
    } else {
      const payload = VisualReviewArtifactPayloadSchema.safeParse(row.payload)
      if (!payload.success) {
        note("evidence_unreadable", 
          `verification ${verification.id} visual review artifact ${row.id} has an invalid payload: ${z.prettifyError(payload.error)}`,
        )
      } else {
        visualReviewArtifact = {
          id: row.id,
          taskID: row.task_id,
          payload: payload.data,
          timeCreated: row.time_created,
        }
      }
    }
  } catch (error) {
    note("evidence_unreadable", 
      `verification ${verification.id} visualReviewLocator is invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (visualReviewArtifact) {
    if (visualReviewArtifact.payload.session_id !== verification.visualQaSessionID) {
      note("identity_mismatch", 
        `verification ${verification.id} Visual QA Session ${verification.visualQaSessionID} does not match visual review artifact ${visualReviewArtifact.id}`,
      )
    }
    if (visualReviewArtifact.payload.final_message_id !== verification.finalMessageID) {
      note("identity_mismatch", 
        `verification ${verification.id} final message ${verification.finalMessageID} does not match visual review artifact ${visualReviewArtifact.id}`,
      )
    }
    if (visualReviewArtifact.payload.review.accepted !== true) {
      note("verdict_failed", `verification ${verification.id} visual review artifact ${visualReviewArtifact.id} is not accepted`)
    }
    if (visualReviewArtifact.payload.completeness_findings.length > 0) {
      note("verdict_failed", 
        `verification ${verification.id} visual review artifact ${visualReviewArtifact.id} has completeness findings: ${visualReviewArtifact.payload.completeness_findings.join("; ")}`,
      )
    }
  }
  const messages = await reader.sessionMessages(verification.visualQaSessionID)
  if (!messages.some((message) => message.info.id === verification.finalMessageID)) {
    note("evidence_missing", 
      `verification ${verification.id} final message ${verification.finalMessageID} was not found in Visual QA Session ${verification.visualQaSessionID}`,
    )
  }
  if (!verification.judgmentToolMessageID || !verification.judgmentToolPartID || !verification.judgmentToolCallID) {
    note("evidence_missing", `verification ${verification.id} requires exact judgment tool message/part/call identity`)
  } else {
    const judgmentMessage = messages.find((message) => message.info.id === verification.judgmentToolMessageID)
    const judgmentPart = judgmentMessage?.parts.find((part) => part.id === verification.judgmentToolPartID)
    if (
      !judgmentPart ||
      judgmentPart.type !== "tool" ||
      judgmentPart.tool !== "update_visual_qa_judgment" ||
      judgmentPart.callID !== verification.judgmentToolCallID ||
      judgmentPart.state?.status !== "completed"
    ) {
      note("identity_mismatch", 
        `verification ${verification.id} judgment tool identity does not resolve to a completed update_visual_qa_judgment call in Visual QA Session ${verification.visualQaSessionID}`,
      )
    } else {
      const judgmentToolInput = judgmentPart.state?.input
      const judgmentInput =
        judgmentToolInput && typeof judgmentToolInput === "object" && !Array.isArray(judgmentToolInput)
          ? (judgmentToolInput as Record<string, unknown>)
          : undefined
      if (visualReviewArtifact && judgmentInput?.accepted !== visualReviewArtifact.payload.review.accepted) {
        note("verdict_failed", 
          `verification ${verification.id} judgment tool accepted input does not match visual review artifact ${visualReviewArtifact.id}`,
        )
      }
      const recordedJudgment = visualReviewArtifact?.payload.judgment_tool
      if (
        !recordedJudgment ||
        recordedJudgment.message_id !== verification.judgmentToolMessageID ||
        recordedJudgment.part_id !== verification.judgmentToolPartID ||
        recordedJudgment.call_id !== verification.judgmentToolCallID
      ) {
        note("identity_mismatch", 
          `verification ${verification.id} judgment tool identity does not match visual review artifact ${visualReviewArtifact?.id ?? "(missing)"}`,
        )
      }
    }
  }
  if (verification.productionBlockerIDs.length > 0) {
    note("verdict_failed", 
      `verification ${verification.id} has production blockers: ${verification.productionBlockerIDs.join(", ")}`,
    )
  }
  if (verification.referenceComparisonEvidence.length === 0) {
    note("evidence_missing", `verification ${verification.id} has no referenceComparisonEvidence`)
  }
  if (verification.status === "passed" && verification.requiredReferenceRegions.length === 0) {
    note("evidence_missing", `verification ${verification.id} has no requiredReferenceRegions`)
  }
  if (verification.status === "passed" && !verification.previewTargetID) {
    note("evidence_missing", `verification ${verification.id} has no previewTargetID`)
  }

  const coveredRegions = new Set<string>()
  for (const binding of verification.referenceComparisonEvidence) {
    const ref = `browser_preview_evidence:${JSON.stringify(binding.evidenceLocator)}`
    let evidence: PersistedBrowserPreviewEvidence | undefined
    let evidenceBytes: ReadonlyMap<string, Buffer> | undefined
    try {
      const row = reader.engineArtifactByLocator({
        taskID: input.expectedTaskID,
        locator: binding.evidenceLocator,
      })
      if (row.kind !== "browser_preview_evidence") {
        note("identity_mismatch", `${ref}: resolved kind ${row.kind}, expected browser_preview_evidence`)
        continue
      }
      const loaded = await reader.browserPreviewEvidence({
        projectRoot: verification.projectRoot,
        row,
      })
      evidence = loaded.evidence
      evidenceBytes = loaded.bytesByRole
    } catch (error) {
      note("evidence_unreadable", `${ref}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!evidence) {
      note("evidence_unreadable", `${ref}: browser_preview_evidence row was not found for task ${input.expectedTaskID}`)
      continue
    }
    summaries.push(`${ref}: ${evidence.operationKind} status=${evidence.status} ${evidence.summary}`)
    if (verification.previewTargetID && evidence.targetID !== verification.previewTargetID) {
      note("identity_mismatch", `${ref}: targetID=${evidence.targetID}, expected ${verification.previewTargetID}`)
    }
    if (evidence.operationKind !== "reference-comparison") {
      note("identity_mismatch", `${ref}: operationKind=${evidence.operationKind}, expected reference-comparison`)
      continue
    }
    if (evidence.status !== "passed") {
      note("verdict_failed", `${ref}: status=${evidence.status}, expected passed`)
    }
    const [sourceBytes, implementationBytes] = await Promise.all([
      Promise.resolve(evidenceBytes?.get("source_crop")),
      Promise.resolve(evidenceBytes?.get("implementation_crop")),
    ])
    if (!sourceBytes || !implementationBytes) {
      note("evidence_missing", `${ref}: source or implementation capture bytes are missing`)
    } else {
      const sourceSHA256 = createHash("sha256").update(sourceBytes).digest("hex")
      const implementationSHA256 = createHash("sha256").update(implementationBytes).digest("hex")
      if (sourceSHA256 !== binding.sourceSHA256) {
        note("evidence_unreadable", `${ref}: source capture digest changed`)
      }
      if (implementationSHA256 !== binding.implementationSHA256) {
        note("evidence_unreadable", `${ref}: implementation capture digest changed`)
      }
    }
    const capture = validateReferenceComparisonCapture(evidence, ref)
    issues.push(...capture.issues)
    if (capture.regionKey) coveredRegions.add(capture.regionKey)
  }

  for (const requiredRegion of verification.requiredReferenceRegions) {
    if (!coveredRegions.has(requiredRegion)) {
      note("verdict_failed", `required reference region lacks passed reference-comparison evidence: ${requiredRegion}`)
    }
  }

  if (verification.status === "failed" && issues.length === 0) {
    note("verdict_failed", `verification ${verification.id} recorded a failed evidence-contract outcome`)
  }
  return { passing: issues.length === 0, issues, summaries }
}

function validateReferenceComparisonCapture(
  evidence: PersistedBrowserPreviewEvidence,
  ref: string,
): { regionKey?: string; issues: VisualFeedbackVerificationIssue[] } {
  const issues: VisualFeedbackVerificationIssue[] = []
  const note = (code: VisualFeedbackVerificationIssueCode, detail: string) => issues.push({ code, detail })
  const parsed = ReferenceComparisonCaptureSchema.safeParse(evidence.capture)
  if (!parsed.success) {
    return {
      issues: [
        {
          code: "evidence_missing",
          detail: `${ref}: missing structured reference-comparison capture with region, source bbox, coverage, visual, and content metrics`,
        },
      ],
    }
  }
  const region = parsed.data.region
  const regionKey = `${region.region_id}@${region.viewport_id}`
  if (!region.source_bbox) note("evidence_missing", `${ref}: missing source_bbox`)
  if (!region.source_image_size) note("evidence_missing", `${ref}: missing source_image_size`)
  if (!region.coverage?.implementation_matches_source_size) {
    note("verdict_failed", `${ref}: implementation crop does not match source size`)
  }
  if (!region.visual?.dimensions_match || region.visual.total_pixels <= 0) {
    note("evidence_missing", `${ref}: missing valid visual dimensions metrics`)
  }
  if (!region.content) {
    note("evidence_missing", `${ref}: missing source and implementation content metrics`)
    return { regionKey, issues }
  }
  if (
    region.content.source.content_pixel_ratio >= 0.002 &&
    region.content.implementation.content_pixel_ratio <= 0.0001
  ) {
    note("verdict_failed", `${ref}: implementation content metrics indicate a blank crop`)
  }
  if (region.content.source.unique_color_count >= 3 && region.content.implementation.unique_color_count <= 1) {
    note("verdict_failed", `${ref}: implementation unique color count indicates a monochrome blank crop`)
  }
  return { regionKey, issues }
}
