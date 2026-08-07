import type { Session } from "@/session"
import z from "zod"

export const RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE = "Chat"
export const RIGHT_SIDEBAR_WORK_DEFAULT_TITLE = "Work"
export const ConversationExperience = z.enum(["chat", "work"])
export type ConversationExperience = z.output<typeof ConversationExperience>

export const RightSidebarConversationMetadata = z
  .object({
    experience: ConversationExperience,
    surface: z.literal("right-sidebar"),
    selectedTaskID: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type RightSidebarConversationIdentityInput = {
  kind: Session.Info["kind"]
  /** Persisted JSON may be malformed; identity classification validates it before reading it. */
  metadata?: unknown
}

export function rightSidebarConversationMetadata(experience: ConversationExperience) {
  return {
    conversation: {
      experience,
      surface: "right-sidebar",
    },
  } as const
}

export function rightSidebarConversationExperience(
  session: RightSidebarConversationIdentityInput,
): ConversationExperience | undefined {
  if (session.kind !== "assistant") return undefined
  const metadata = session.metadata
  const conversation =
    metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).conversation : undefined
  const parsed = RightSidebarConversationMetadata.safeParse(conversation)
  return parsed.success ? parsed.data.experience : undefined
}

export function isRightSidebarConversationSession(session: RightSidebarConversationIdentityInput): boolean {
  return rightSidebarConversationExperience(session) !== undefined
}

export function rightSidebarConversationAgentID(
  session: RightSidebarConversationIdentityInput,
): ConversationExperience | undefined {
  return rightSidebarConversationExperience(session)
}

export function rightSidebarConversationSelectedTaskID(
  session: RightSidebarConversationIdentityInput,
): string | undefined {
  if (!isRightSidebarConversationSession(session)) return undefined
  const metadata = session.metadata as Record<string, unknown>
  const parsed = RightSidebarConversationMetadata.parse(metadata.conversation)
  return parsed.selectedTaskID ?? undefined
}

export function rightSidebarConversationDefaultTitle(experience: ConversationExperience): string {
  return experience === "work" ? RIGHT_SIDEBAR_WORK_DEFAULT_TITLE : RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE
}
