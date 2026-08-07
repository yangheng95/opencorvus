import z from "zod"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import type { QueuedTaskIngress } from "@/engine/queued-task-ingress"
import {
  requireCurrentTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
} from "@/engine/terminal-lifecycle-reference"

export const TerminalConversationAuthoritySchema = z
  .object({
    taskID: z.string().min(1),
    ingressID: z.string().min(1),
    ingressKind: z.enum(["operator_message", "coordination_request"]),
    terminalLifecycleReference: TerminalLifecycleReferenceSchema,
    completionDecisionArtifactID: z.string().min(1).optional(),
    coordinationRequestID: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((authority, context) => {
    if ((authority.ingressKind === "coordination_request") !== Boolean(authority.coordinationRequestID)) {
      context.addIssue({
        code: "custom",
        message: "coordinationRequestID is required only for coordination_request terminal ingress",
      })
    }
    if (
      authority.terminalLifecycleReference.terminalStatus !== "completed" &&
      authority.completionDecisionArtifactID
    ) {
      context.addIssue({
        code: "custom",
        message: "completionDecisionArtifactID is valid only for a completed terminal occurrence",
      })
    }
  })

export type TerminalConversationAuthority = z.infer<typeof TerminalConversationAuthoritySchema>

export function createTerminalConversationAuthority(input: {
  taskID: string
  ingressID: string
  ingress: Extract<QueuedTaskIngress, { source_kind: "operator_message" | "coordination_request" }>
}): TerminalConversationAuthority {
  const terminalLifecycleReference = requireCurrentTerminalLifecycleReference(input.taskID)
  const completionDecision =
    terminalLifecycleReference.terminalStatus === "completed"
      ? findTaskCompletionDecisionForTerminalTime({
          taskID: input.taskID,
          timeCompleted: terminalLifecycleReference.timeCompleted,
        })
      : undefined
  return TerminalConversationAuthoritySchema.parse({
    taskID: input.taskID,
    ingressID: input.ingressID,
    ingressKind: input.ingress.source_kind,
    terminalLifecycleReference,
    ...(completionDecision ? { completionDecisionArtifactID: completionDecision.id } : {}),
    ...(input.ingress.source_kind === "coordination_request"
      ? { coordinationRequestID: input.ingress.request_id }
      : {}),
  })
}
