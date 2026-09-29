import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, and, eq, isNull, desc, sql } from "@/storage/db"
import { Instance } from "@/project/instance"
import { sideChatIdentity, sideChatInstructions } from "./side-chat-identity"

export async function sideChatSystem(sessionID?: string): Promise<string[]> {
  if (!sessionID) return []
  const identity = sideChatIdentity((await Session.get(sessionID)).metadata)
  return identity ? [sideChatInstructions(identity)] : []
}

export async function listSideChats(sourceSessionID: string): Promise<Session.Info[]> {
  await Session.getInProject({ sessionID: sourceSessionID, projectID: Instance.project.id })
  const rows = Database.use((db) =>
    db
      .select()
      .from(SessionTable)
      .where(
        and(
          eq(SessionTable.project_id, Instance.project.id),
          isNull(SessionTable.time_archived),
          sql`json_extract(${SessionTable.metadata}, '$.sideChat.sourceSessionID') = ${sourceSessionID}`,
        ),
      )
      .orderBy(desc(SessionTable.time_created))
      .all()
      .filter((row) => !Session.deletedInTransaction(db, row.id)),
  )
  return rows.map(Session.fromRow)
}
