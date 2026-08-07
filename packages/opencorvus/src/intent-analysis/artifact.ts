import { z } from "zod"
import {
  IntentClarificationInputSchema,
  IntentJudgmentSchema,
} from "./output-tools"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"

const IntentSlotArtifactSchema = z
  .object({
    key: z.string().min(1),
    value: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })
  .strict()

const IntentClarificationAnswerSchema = z
  .object({
    header: z.string().min(1),
    answers: z.array(z.string()),
  })
  .strict()

export const IntentAnalysisArtifactPayloadSchema =
  ArtifactConsumptionProvenanceSchema.safeExtend({
    schema_version: z.literal(1),
    producer: z
      .object({
        session_id: z.string().min(1),
        final_message_id: z.string().min(1),
      })
      .strict(),
    judgment: IntentJudgmentSchema.nullable(),
    slots: z.array(IntentSlotArtifactSchema),
    missing_info: z.array(z.string().min(1)),
    clarifications: z.array(IntentClarificationInputSchema),
    clarification_outcome: z
      .object({
        status: z.enum(["not_required", "rejected", "expired", "answered"]),
        answers: z.array(IntentClarificationAnswerSchema),
        clarified_user_request: z.string().min(1).nullable(),
      })
      .strict(),
  })

export type IntentAnalysisArtifactPayload = z.infer<
  typeof IntentAnalysisArtifactPayloadSchema
>
