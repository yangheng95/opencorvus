import { Session } from "."
import type { Message } from "./message"
import { deriveTitle } from "@/title/derive"
import {
  RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE,
  RIGHT_SIDEBAR_WORK_DEFAULT_TITLE,
  isRightSidebarConversationSession,
  rightSidebarConversationDefaultTitle,
  rightSidebarConversationExperience,
} from "@/chat/identity"

export { RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE, RIGHT_SIDEBAR_WORK_DEFAULT_TITLE }
export const MISSION_CONTROL_DEFAULT_TITLE = "Mission Control"

function isRightSidebarConversation(session: Session.Info): boolean {
  const experience = rightSidebarConversationExperience(session)
  return (
    isRightSidebarConversationSession(session) &&
    experience !== undefined &&
    session.title === rightSidebarConversationDefaultTitle(experience)
  )
}

function isMissionControl(session: Session.Info): boolean {
  return session.kind === "mission" && session.title === MISSION_CONTROL_DEFAULT_TITLE
}

function firstTextTitle(parts: Message.Part[]): string | undefined {
  const text = parts.find((part): part is Message.TextPart => part.type === "text")?.text
  if (text === undefined) return undefined
  return deriveTitle(text)
}

export async function setSessionTitleFromFirstUserMessage(input: {
  sessionID: string
  messageID: string
  parts: Message.Part[]
}): Promise<Session.Info | undefined> {
  const title = firstTextTitle(input.parts)
  if (!title) return undefined

  const session = await Session.get(input.sessionID)
  if (!isRightSidebarConversation(session) && !isMissionControl(session)) return undefined

  const userMessages = (await Session.messages({ sessionID: input.sessionID })).filter(
    (message) => message.info.role === "user",
  )
  if (userMessages.length !== 1 || userMessages[0]?.info.id !== input.messageID) return undefined

  return Session.setTitle({ sessionID: input.sessionID, title })
}
