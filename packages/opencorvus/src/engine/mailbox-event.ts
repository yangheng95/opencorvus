import { EvidenceLocatorListSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { Identifier } from "@/id/id"
import z from "zod"

export const MailboxCategory = z.enum(["progress", "status", "notification"])
export type MailboxCategory = z.infer<typeof MailboxCategory>

export const MailboxAction = z.enum(["read", "archive", "restore", "delete"])
export type MailboxAction = z.infer<typeof MailboxAction>

export const MailboxProgress = z.number().min(0).max(1)

export const MailboxAgentMessagePayload = z
  .object({
    taskID: Identifier.schema("task"),
    sessionID: Identifier.schema("session"),
    agentID: z.string().min(1),
    expertSquadID: z.string().min(1),
    category: MailboxCategory,
    subject: z.string().min(1),
    body: z.string().min(1),
    attention: z.boolean(),
    progress: MailboxProgress.optional(),
    evidenceLocators: EvidenceLocatorListSchema.default([]),
    summary: z.string().min(1),
  })
  .strict()
export type MailboxAgentMessagePayload = z.infer<typeof MailboxAgentMessagePayload>

export const MailboxAcknowledgementPayload = z
  .object({
    taskID: Identifier.schema("task"),
    messageID: Identifier.schema("protocol_event"),
    action: MailboxAction,
    summary: z.string().min(1),
  })
  .strict()

const DurableMailboxAgentMessagePayload = MailboxAgentMessagePayload.omit({ taskID: true, sessionID: true }).strict()
const DurableMailboxAcknowledgementPayload = MailboxAcknowledgementPayload.omit({ taskID: true }).strict()

type MailboxProtocolEnvelope = {
  id: string
  aggregate_type: string
  aggregate_id: string
  task_id: string | null
  session_id: string | null
  payload: unknown
}

function taskIDFromEnvelope(event: MailboxProtocolEnvelope): string {
  const taskID = event.aggregate_type === "task" ? event.aggregate_id : event.task_id
  if (!taskID) throw new Error(`Mailbox event ${event.id} has no Task envelope identity`)
  return taskID
}

export function projectMailboxAgentMessagePayload(event: MailboxProtocolEnvelope): MailboxAgentMessagePayload {
  if (!event.session_id) throw new Error(`Mailbox message event ${event.id} has no Session envelope identity`)
  return MailboxAgentMessagePayload.parse({
    taskID: taskIDFromEnvelope(event),
    sessionID: event.session_id,
    ...DurableMailboxAgentMessagePayload.parse(event.payload),
  })
}

export function projectMailboxAcknowledgementPayload(
  event: MailboxProtocolEnvelope,
): z.infer<typeof MailboxAcknowledgementPayload> {
  return MailboxAcknowledgementPayload.parse({
    taskID: taskIDFromEnvelope(event),
    ...DurableMailboxAcknowledgementPayload.parse(event.payload),
  })
}
