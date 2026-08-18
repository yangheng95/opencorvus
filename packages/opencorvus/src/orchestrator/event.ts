import z from "zod"
import { ArtifactReadLocatorSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { TerminalLifecycleReferenceSchema } from "@/engine/terminal-lifecycle-reference-schema"
import { DispatchInfrastructureFailureOutcomeSchema } from "@/agent/dispatch-outcome"
import { SchedulerDeliveryReference } from "@/task-api/task-root-message"

export const OrchestratorEventSchema = z
  .object({
    /** Diagnostic wake label only. It is never persisted as a conversation message. */
    note: z.string().optional(),
    taskCreation: z
      .object({
        taskID: z.string().min(1),
        requestID: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
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
        kind: z.enum(["operator", "orchestrator", "mission"]),
        schedulerDelivery: SchedulerDeliveryReference.optional(),
      })
      .strict()
      .optional(),
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
    dispatchInfrastructureFailure: z
      .object({
        infrastructureFactID: z.string().min(1),
        outcome: DispatchInfrastructureFailureOutcomeSchema,
      })
      .strict()
      .superRefine((delivery, context) => {
        if (delivery.outcome.infrastructure_error?.artifact_id !== delivery.infrastructureFactID) {
          context.addIssue({
            code: "custom",
            message: "dispatch infrastructure failure identity does not match its exact Artifact locator",
          })
        }
      })
      .optional(),
    agentLifecycleDelivery: z
      .object({
        eventID: z.string().min(1),
        sessionID: z.string().min(1),
        dispatchID: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict()

export type OrchestratorEvent = z.infer<typeof OrchestratorEventSchema>
