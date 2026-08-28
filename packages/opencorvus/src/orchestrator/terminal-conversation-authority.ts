import z from "zod"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision-read"
import { OrchestratorEventSchema, type OrchestratorEvent } from "./event"
import {
  requireCurrentTerminalLifecycleReference,
  resolveTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
} from "@/engine/terminal-lifecycle-reference"
import { sameTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference-schema"

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
      resolveTerminalLifecycleReference(authority.taskID, authority.terminalLifecycleReference).terminalStatus !==
        "completed" &&
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
  event: OrchestratorEvent
}): TerminalConversationAuthority {
  const event = OrchestratorEventSchema.parse(input.event)
  const ingressKind =
    event.rootMessage?.kind === "operator"
      ? ("operator_message" as const)
      : event.coordinationRequest
        ? ("coordination_request" as const)
        : undefined
  if (!ingressKind)
    throw new Error(`Terminal conversation ingress ${input.ingressID} is not operator or coordination input`)
  const terminalLifecycleReference = requireCurrentTerminalLifecycleReference(input.taskID)
  const terminal = resolveTerminalLifecycleReference(input.taskID, terminalLifecycleReference)
  const completionDecision =
    terminal.terminalStatus === "completed"
      ? findTaskCompletionDecisionForTerminalTime({
          taskID: input.taskID,
          timeCompleted: terminal.timeCompleted,
        })
      : undefined
  return TerminalConversationAuthoritySchema.parse({
    taskID: input.taskID,
    ingressID: input.ingressID,
    ingressKind,
    terminalLifecycleReference,
    ...(completionDecision ? { completionDecisionArtifactID: completionDecision.id } : {}),
    ...(ingressKind === "coordination_request" ? { coordinationRequestID: event.coordinationRequest!.requestID } : {}),
  })
}
