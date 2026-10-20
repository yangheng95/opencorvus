import { Session } from "."
import type { Message } from "./message"
import { deriveTitle } from "@/title/derive"
import { Database, NotFoundError, eq } from "@/storage/db"
import { SessionTable } from "./session.sql"
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

/** The authorized objective and its initial conversation title commit together. */
export function setSessionTitleFromGoalInTransaction(input: { sessionID: string; objective: string }) {
  Database.requireActiveTransaction("setSessionTitleFromGoalInTransaction")
  const row = Database.use((db) => db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get())
  if (!row) throw new NotFoundError({ message: `Session not found: ${input.sessionID}` })
  const session = Session.fromRow(row)
  if (!isRightSidebarConversation(session) && !isMissionControl(session) && !Session.isDefaultTitle(session.title))
    return
  return Session.setTitleInTransaction({
    sessionID: session.id,
    title: deriveTitle(input.objective),
    expectedTitle: session.title,
  })
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

  const firstUser = (await Session.messages({ sessionID: input.sessionID })).find(
    (message) => message.info.role === "user" && message.info.author === "user",
  )
  if (firstUser?.info.id !== input.messageID) return undefined

  return Session.setTitle({ sessionID: input.sessionID, title, expectedTitle: session.title })
}
