import z from "zod"
import { createHash } from "node:crypto"
import { EngineArtifactLocatorSchema, type EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { exactEngineArtifactLocator, requireEngineArtifactByLocator } from "@/artifact-catalog"
import { readBrowserPreviewEvidenceByRow } from "@/browser-preview/persist"
import type { PersistedBrowserPreviewEvidence } from "@/browser-preview/persist"
import { recordEngineArtifact } from "@/engine/artifact"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
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
    non_white_pixel_ratio: z.number().finite().nonnegative(),
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

export async function validateVisualFeedbackVerification(input: {
  verification: VisualFeedbackVerification
  expectedTaskID: string
}): Promise<{ passing: boolean; issues: string[]; summaries: string[] }> {
  const issues: string[] = []
  const summaries: string[] = []
  const verification = input.verification
  if (verification.taskID !== input.expectedTaskID) {
    issues.push(`verification ${verification.id} belongs to task ${verification.taskID}, not ${input.expectedTaskID}`)
  }
  issues.push(...verification.contractIssues)
  let visualReviewArtifact: VisualReviewArtifact | undefined
  try {
    const row = requireEngineArtifactByLocator({
      taskID: input.expectedTaskID,
      locator: verification.visualReviewLocator,
    })
    if (row.kind !== "visual_review") {
      issues.push(
        `verification ${verification.id} visualReviewLocator resolves to kind ${row.kind}, expected visual_review`,
      )
    } else {
      const payload = VisualReviewArtifactPayloadSchema.safeParse(row.payload)
      if (!payload.success) {
        issues.push(
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
    issues.push(
      `verification ${verification.id} visualReviewLocator is invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (visualReviewArtifact) {
    if (visualReviewArtifact.payload.session_id !== verification.visualQaSessionID) {
      issues.push(
        `verification ${verification.id} Visual QA Session ${verification.visualQaSessionID} does not match visual review artifact ${visualReviewArtifact.id}`,
      )
    }
    if (visualReviewArtifact.payload.final_message_id !== verification.finalMessageID) {
      issues.push(
        `verification ${verification.id} final message ${verification.finalMessageID} does not match visual review artifact ${visualReviewArtifact.id}`,
      )
    }
    if (visualReviewArtifact.payload.review.accepted !== true) {
      issues.push(`verification ${verification.id} visual review artifact ${visualReviewArtifact.id} is not accepted`)
    }
    if (visualReviewArtifact.payload.completeness_findings.length > 0) {
      issues.push(
        `verification ${verification.id} visual review artifact ${visualReviewArtifact.id} has completeness findings: ${visualReviewArtifact.payload.completeness_findings.join("; ")}`,
      )
    }
  }
  const messages = await Session.messages({ sessionID: verification.visualQaSessionID })
  if (!messages.some((message) => message.info.id === verification.finalMessageID)) {
    issues.push(
      `verification ${verification.id} final message ${verification.finalMessageID} was not found in Visual QA Session ${verification.visualQaSessionID}`,
    )
  }
  if (!verification.judgmentToolMessageID || !verification.judgmentToolPartID || !verification.judgmentToolCallID) {
    issues.push(`verification ${verification.id} requires exact judgment tool message/part/call identity`)
  } else {
    const judgmentMessage = messages.find((message) => message.info.id === verification.judgmentToolMessageID)
    const judgmentPart = judgmentMessage?.parts.find((part) => part.id === verification.judgmentToolPartID)
    if (
      !judgmentPart ||
      judgmentPart.type !== "tool" ||
      judgmentPart.tool !== "update_visual_qa_judgment" ||
      judgmentPart.callID !== verification.judgmentToolCallID ||
      judgmentPart.state.status !== "completed"
    ) {
      issues.push(
        `verification ${verification.id} judgment tool identity does not resolve to a completed update_visual_qa_judgment call in Visual QA Session ${verification.visualQaSessionID}`,
      )
    } else {
      const judgmentInput =
        judgmentPart.state.input &&
        typeof judgmentPart.state.input === "object" &&
        !Array.isArray(judgmentPart.state.input)
          ? (judgmentPart.state.input as Record<string, unknown>)
          : undefined
      if (visualReviewArtifact && judgmentInput?.accepted !== visualReviewArtifact.payload.review.accepted) {
        issues.push(
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
        issues.push(
          `verification ${verification.id} judgment tool identity does not match visual review artifact ${visualReviewArtifact?.id ?? "(missing)"}`,
        )
      }
    }
  }
  if (verification.productionBlockerIDs.length > 0) {
    issues.push(
      `verification ${verification.id} has production blockers: ${verification.productionBlockerIDs.join(", ")}`,
    )
  }
  if (verification.referenceComparisonEvidence.length === 0) {
    issues.push(`verification ${verification.id} has no referenceComparisonEvidence`)
  }
  if (verification.status === "passed" && verification.requiredReferenceRegions.length === 0) {
    issues.push(`verification ${verification.id} has no requiredReferenceRegions`)
  }
  if (verification.status === "passed" && !verification.previewTargetID) {
    issues.push(`verification ${verification.id} has no previewTargetID`)
  }

  const coveredRegions = new Set<string>()
  for (const binding of verification.referenceComparisonEvidence) {
    const ref = `browser_preview_evidence:${JSON.stringify(binding.evidenceLocator)}`
    let evidence: PersistedBrowserPreviewEvidence | undefined
    let evidenceBytes: ReadonlyMap<string, Buffer> | undefined
    try {
      const row = requireEngineArtifactByLocator({
        taskID: input.expectedTaskID,
        locator: binding.evidenceLocator,
      })
      if (row.kind !== "browser_preview_evidence") {
        issues.push(`${ref}: resolved kind ${row.kind}, expected browser_preview_evidence`)
        continue
      }
      const loaded = await readBrowserPreviewEvidenceByRow({
        projectRoot: verification.projectRoot,
        row,
      })
      evidence = loaded.evidence
      evidenceBytes = loaded.bytesByRole
    } catch (error) {
      issues.push(`${ref}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (!evidence) {
      issues.push(`${ref}: browser_preview_evidence row was not found for task ${input.expectedTaskID}`)
      continue
    }
    summaries.push(`${ref}: ${evidence.operationKind} status=${evidence.status} ${evidence.summary}`)
    if (verification.previewTargetID && evidence.targetID !== verification.previewTargetID) {
      issues.push(`${ref}: targetID=${evidence.targetID}, expected ${verification.previewTargetID}`)
    }
    if (evidence.operationKind !== "reference-comparison") {
      issues.push(`${ref}: operationKind=${evidence.operationKind}, expected reference-comparison`)
      continue
    }
    if (evidence.status !== "passed") {
      issues.push(`${ref}: status=${evidence.status}, expected passed`)
    }
    const [sourceBytes, implementationBytes] = await Promise.all([
      Promise.resolve(evidenceBytes?.get("source_crop")),
      Promise.resolve(evidenceBytes?.get("implementation_crop")),
    ])
    if (!sourceBytes || !implementationBytes) {
      issues.push(`${ref}: source or implementation capture bytes are missing`)
    } else {
      const sourceSHA256 = createHash("sha256").update(sourceBytes).digest("hex")
      const implementationSHA256 = createHash("sha256").update(implementationBytes).digest("hex")
      if (sourceSHA256 !== binding.sourceSHA256) {
        issues.push(`${ref}: source capture digest changed`)
      }
      if (implementationSHA256 !== binding.implementationSHA256) {
        issues.push(`${ref}: implementation capture digest changed`)
      }
    }
    const capture = validateReferenceComparisonCapture(evidence, ref)
    issues.push(...capture.issues)
    if (capture.regionKey) coveredRegions.add(capture.regionKey)
  }

  for (const requiredRegion of verification.requiredReferenceRegions) {
    if (!coveredRegions.has(requiredRegion)) {
      issues.push(`required reference region lacks passed reference-comparison evidence: ${requiredRegion}`)
    }
  }

  if (verification.status === "failed" && issues.length === 0) {
    issues.push(`verification ${verification.id} recorded a failed evidence-contract outcome`)
  }
  return { passing: issues.length === 0, issues, summaries }
}

export function persistVisualFeedbackVerificationArtifact(input: {
  taskID: string
  verification: VisualFeedbackVerification
  now?: number
}): EngineArtifactLocator {
  if (input.verification.taskID !== input.taskID) {
    throw new Error(
      `persistVisualFeedbackVerificationArtifact: verification taskID=${input.verification.taskID} does not match ${input.taskID}`,
    )
  }
  const now = input.now ?? Date.now()
  const id = Identifier.ascending("artifact")
  recordEngineArtifact({
    id,
    taskID: input.taskID,
    kind: "visual_feedback_verification",
    label: VISUAL_FEEDBACK_VERIFICATION_ARTIFACT_LABEL,
    payload: input.verification,
    timeCreated: now,
  })
  return exactEngineArtifactLocator({ taskID: input.taskID, artifactID: id })
}

function validateReferenceComparisonCapture(
  evidence: PersistedBrowserPreviewEvidence,
  ref: string,
): { regionKey?: string; issues: string[] } {
  const issues: string[] = []
  const parsed = ReferenceComparisonCaptureSchema.safeParse(evidence.capture)
  if (!parsed.success) {
    return {
      issues: [
        `${ref}: missing structured reference-comparison capture with region, source bbox, coverage, visual, and content metrics`,
      ],
    }
  }
  const region = parsed.data.region
  const regionKey = `${region.region_id}@${region.viewport_id}`
  if (!region.source_bbox) issues.push(`${ref}: missing source_bbox`)
  if (!region.source_image_size) issues.push(`${ref}: missing source_image_size`)
  if (!region.coverage?.implementation_matches_source_size) {
    issues.push(`${ref}: implementation crop does not match source size`)
  }
  if (!region.visual?.dimensions_match || region.visual.total_pixels <= 0) {
    issues.push(`${ref}: missing valid visual dimensions metrics`)
  }
  if (!region.content) {
    issues.push(`${ref}: missing source and implementation content metrics`)
    return { regionKey, issues }
  }
  if (
    region.content.source.non_white_pixel_ratio >= 0.002 &&
    region.content.implementation.non_white_pixel_ratio <= 0.0001
  ) {
    issues.push(`${ref}: implementation content metrics indicate a blank crop`)
  }
  if (region.content.source.unique_color_count >= 3 && region.content.implementation.unique_color_count <= 1) {
    issues.push(`${ref}: implementation unique color count indicates a monochrome blank crop`)
  }
  return { regionKey, issues }
}
