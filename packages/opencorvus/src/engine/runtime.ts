import { Instance } from "@/project/instance"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionTable } from "@/session/session.sql"
import { and, Database, eq, inArray } from "@/storage/db"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export const OwnedPromptControllersError = NamedError.create(
  "OwnedPromptControllersError",
  z.object({
    message: z.string(),
    operation: z.string(),
  }),
)

export function ownedPromptControllersError(operation: string) {
  return new OwnedPromptControllersError({
    operation,
    message: `Owned prompt controllers exist; refusing ${operation}.`,
  })
}

/**
 * Process-local execution ownership is the only source for physical activity.
 * Durable Session status and Task/Goal history are deliberately excluded.
 */
export function hasProjectOwnedPromptControllers(): boolean {
  const ownedPromptSessionIDs = SessionPromptState.ownedPromptSessionIDs()
  if (ownedPromptSessionIDs.length === 0) return false
  return Boolean(
    Database.use((db) =>
      db
        .select({ id: SessionTable.id })
        .from(SessionTable)
        .where(andProjectSession(ownedPromptSessionIDs, Instance.project.id))
        .limit(1)
        .get(),
    ),
  )
}

/** Check physical SessionPrompt ownership across all open project databases. */
export function hasAnyOwnedPromptControllers(): boolean {
  return SessionPromptState.ownedPromptSessionIDs().length > 0
}

function andProjectSession(sessionIDs: string[], projectID: string) {
  return and(inArray(SessionTable.id, sessionIDs), eq(SessionTable.project_id, projectID))
}
