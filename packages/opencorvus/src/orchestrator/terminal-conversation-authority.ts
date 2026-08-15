import z from "zod"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import { OrchestratorEventSchema, type OrchestratorEvent } from "./event"
import {
  requireCurrentTerminalLifecycleReference,
  resolveTerminalLifecycleReference,
  sameTerminalLifecycleReference,
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

export function isAuthorizedTerminalConversationDecision(input: {
  authority: TerminalConversationAuthority
  taskID: string
  currentTerminalLifecycleReference: z.infer<typeof TerminalLifecycleReferenceSchema>
  toolName: string
  toolInput: unknown
}): boolean {
  if (
    input.authority.taskID !== input.taskID ||
    !sameTerminalLifecycleReference(input.currentTerminalLifecycleReference, input.authority.terminalLifecycleReference)
  ) {
    return false
  }
  if (input.toolName === "no_action") return input.authority.ingressKind === "operator_message"
  if (input.toolName !== "respond_agent_coordination") return false
  if (!input.toolInput || typeof input.toolInput !== "object" || Array.isArray(input.toolInput)) return false
  const record = input.toolInput as Record<string, unknown>
  return (
    input.authority.ingressKind === "coordination_request" &&
    record.decision === "acknowledge_terminal" &&
    record.request_id === input.authority.coordinationRequestID
  )
}

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
