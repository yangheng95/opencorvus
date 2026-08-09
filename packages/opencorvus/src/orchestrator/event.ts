import z from "zod"
import { ArtifactReadLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"

export const TaskIntentSchema = z
  .object({
    kind: z.enum(["retry", "replan"]),
    actor: z.literal("operator"),
    supersededOperatorMessageIDs: z.array(z.string().min(1)),
  })
  .strict()

export const OrchestratorEventSchema = z
  .object({
    /** Diagnostic wake label only. It is never persisted as a conversation message. */
    note: z.string().optional(),
    taskWaitActivity: z
      .object({
        source: z.string(),
        detail: z.string(),
        jobIDs: z.array(z.string()),
      })
      .strict()
      .optional(),
    taskWaitWake: z
      .object({
        jobID: z.string().min(1),
        fireID: z.string().min(1),
        dueAt: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    rootMessage: z
      .object({
        messageID: z.string().min(1),
        kind: z.enum(["operator", "orchestrator"]),
      })
      .strict()
      .optional(),
    taskIntent: TaskIntentSchema.optional(),
    missionAcceptanceResume: z
      .object({
        missionID: z.string().min(1),
        missionSessionID: z.string().min(1),
        messageID: z.string().min(1),
        panelMessageID: z.string().min(1),
        toolCallID: z.string().min(1),
        toolPartID: z.string().min(1),
        reviewedTerminalLifecycleReference: TerminalLifecycleReferenceSchema,
        evidenceLocators: z.array(ArtifactReadLocatorSchema).min(1).max(64),
      })
      .strict()
      .optional(),
    coordinationRequest: z
      .object({ requestID: z.string().min(1) })
      .strict()
      .optional(),
    processRecovery: z
      .object({ recoveryFactID: z.string().min(1) })
      .strict()
      .optional(),
  })
  .strict()

export type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>
