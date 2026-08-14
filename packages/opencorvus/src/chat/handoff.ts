import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import z from "zod"
import { ConversationExperience, rightSidebarConversationExperience } from "./identity"

export const ConversationHandoffEvent = BusEvent.define(
  "conversation.handoff",
  z.object({
    projectID: z.string().min(1),
    directory: z.string().min(1),
    targetSessionID: Identifier.schema("session"),
    targetExperience: z.literal("work"),
    callerSessionID: Identifier.schema("session"),
    callerExperience: ConversationExperience,
    callerMessageID: Identifier.schema("message"),
    timeCreated: z.number(),
  }),
)
export type ConversationHandoffEvent = z.infer<typeof ConversationHandoffEvent.properties>

/**
 * Publish the visible surface transition only after the target conversation's
 * first user message has been persisted by SessionWake.
 */
export async function publishConversationHandoff(input: {
  targetSession: Session.Info
  callerSession: Session.Info
  callerMessageID: string
}): Promise<ConversationHandoffEvent> {
  const targetExperience = rightSidebarConversationExperience(input.targetSession)
  const callerExperience = rightSidebarConversationExperience(input.callerSession)
  if (!targetExperience) {
    throw new Error(`Conversation handoff target must be a right-sidebar conversation: ${input.targetSession.id}`)
  }
  if (!callerExperience) {
    throw new Error(`Conversation handoff caller must be a right-sidebar conversation: ${input.callerSession.id}`)
  }
  if (targetExperience !== "work") {
    throw new Error(`Conversation handoff target must use the Work experience: ${input.targetSession.id}`)
  }
  if (
    input.targetSession.projectID !== input.callerSession.projectID ||
    input.targetSession.directory !== input.callerSession.directory
  ) {
    throw new Error(
      `Conversation handoff target and caller must belong to the same project and directory: ${input.targetSession.id}`,
    )
  }
  const event = ConversationHandoffEvent.properties.parse({
    projectID: input.targetSession.projectID,
    directory: input.targetSession.directory,
    targetSessionID: input.targetSession.id,
    targetExperience,
    callerSessionID: input.callerSession.id,
    callerExperience,
    callerMessageID: input.callerMessageID,
    timeCreated: Date.now(),
  })
  await Bus.publish(ConversationHandoffEvent, event)
  return event
}
