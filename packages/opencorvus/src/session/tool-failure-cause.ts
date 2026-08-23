import z from "zod"
import { redactInlinePayloads } from "@/util/inline-base64"
import { redactToolDiagnosticValue } from "@/tool/diagnostic-value"
import type { Message } from "./message"
import {
  ToolFailureCause as SharedToolFailureCause,
  ToolFailureClassification as SharedToolFailureClassification,
  renderToolFailureCause,
  type ToolFailureCause as SharedToolFailureCauseType,
  type ToolFailureClassification as SharedToolFailureClassificationType,
} from "@opencorvus-ai/transport-protocol"

export const ToolFailureClassification = SharedToolFailureClassification
export type ToolFailureClassification = SharedToolFailureClassificationType
export const ToolFailureCause = SharedToolFailureCause
export type ToolFailureCause = SharedToolFailureCauseType
export { renderToolFailureCause }

export const FailureOccurrenceAnchor = z
  .object({
    session_id: z.string().min(1),
    assistant_message_id: z.string().min(1),
    error_name: z.string().min(1),
  })
  .strict()

export type FailureOccurrenceAnchor = z.infer<typeof FailureOccurrenceAnchor>

export const ToolPersistenceConvergenceFailure = z
  .object({
    failure_occurrence: FailureOccurrenceAnchor,
    unconverged_part_ids: z.array(z.string().min(1)),
    write_errors: z.array(
      z
        .object({
          part_id: z.string().min(1),
          message: z.string().min(1),
        })
        .strict(),
    ),
    inspection_error: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.unconverged_part_ids.length > 0 || value.write_errors.length > 0 || value.inspection_error) return
    ctx.addIssue({
      code: "custom",
      message: "Tool convergence failure requires a physical or observation failure",
    })
  })

export type ToolPersistenceConvergenceFailure = z.infer<typeof ToolPersistenceConvergenceFailure>

export const ProcessorObservationFailure = z
  .object({
    phase: z.literal("snapshot_patch"),
    message: z.string().min(1),
  })
  .strict()

export type ProcessorObservationFailure = z.infer<typeof ProcessorObservationFailure>

export function failureOccurrenceAnchor(input: {
  sessionID: string
  assistantMessageID: string
  error: NonNullable<Message.Assistant["error"]>
}): FailureOccurrenceAnchor {
  return FailureOccurrenceAnchor.parse({
    session_id: input.sessionID,
    assistant_message_id: input.assistantMessageID,
    error_name: input.error.name,
  })
}

export function sameFailureOccurrence(left: FailureOccurrenceAnchor, right: FailureOccurrenceAnchor): boolean {
  return (
    left.session_id === right.session_id &&
    left.assistant_message_id === right.assistant_message_id &&
    left.error_name === right.error_name
  )
}

export function toolFailureCauseFromMessageError(input: {
  error: NonNullable<Message.Assistant["error"]>
  occurrence: FailureOccurrenceAnchor
  originSite: string
  classification: ToolFailureClassification
  data?: Record<string, unknown>
}): ToolFailureCause {
  const { message, ...canonicalMetadata } = input.error.data
  return ToolFailureCause.parse({
    kind: input.error.name,
    name: input.error.name,
    message: typeof message === "string" && message.length > 0 ? redactInlinePayloads(message) : input.error.name,
    originSite: input.originSite,
    classification: input.classification,
    data: redactToolDiagnosticValue({
      ...(input.data ?? {}),
      ...(Object.keys(canonicalMetadata).length > 0 ? { canonical_error_metadata: canonicalMetadata } : {}),
      failure_occurrence: input.occurrence,
    }),
  })
}

export function toolFailureCauseFromUnknown(input: {
  error: unknown
  originSite: string
  classification: ToolFailureClassification
  kind?: string
  data?: Record<string, unknown>
}): ToolFailureCause {
  if (input.error instanceof Error) {
    return {
      kind: input.kind ?? input.classification,
      name: input.error.name || input.classification,
      message: redactInlinePayloads(input.error.message),
      originSite: input.originSite,
      classification: input.classification,
      ...(input.data ? { data: redactToolDiagnosticValue(input.data) } : {}),
    }
  }
  if (typeof input.error === "string" && input.error.length > 0) {
    return {
      kind: input.kind ?? input.classification,
      name: input.classification,
      message: redactInlinePayloads(input.error),
      originSite: input.originSite,
      classification: input.classification,
      ...(input.data ? { data: redactToolDiagnosticValue(input.data) } : {}),
    }
  }
  const parsed = ToolFailureCause.safeParse(input.error)
  if (parsed.success) {
    return {
      ...parsed.data,
      message: redactInlinePayloads(parsed.data.message),
      ...(parsed.data.data ? { data: redactToolDiagnosticValue(parsed.data.data) } : {}),
    }
  }
  throw new Error(`Tool failure cause at ${input.originSite} did not include an Error or message string`)
}
