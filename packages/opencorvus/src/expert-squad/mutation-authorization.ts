import { createHash } from "node:crypto"
import { Session } from "@/session"
import { MessageTable, SessionTable } from "@/session/session.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { Database, and, eq } from "@/storage/db"
import type { EvolutionMutationAuthorizationSchema } from "@opencorvus-ai/plugin"
import type z from "zod"

export type VerifiedEvolutionMutationAuthorization = z.infer<typeof EvolutionMutationAuthorizationSchema>

export function requireEvolutionMutationRootSession(input: {
  projectID: string
  taskID: string
  sessionID: string
}) {
  if (taskIDForSession(input.sessionID) !== input.taskID)
    throw new Error(`Evolution mutation Session ${input.sessionID} does not belong to Task ${input.taskID}`)
  const facts = Database.use((db) => ({
    task: db
      .select({ projectID: EngineTaskTable.project_id, sessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, input.taskID))
      .get(),
    session: db
      .select({ projectID: SessionTable.project_id })
      .from(SessionTable)
      .where(eq(SessionTable.id, input.sessionID))
      .get(),
  }))
  if (!facts.task || facts.task.projectID !== input.projectID || facts.task.sessionID !== input.sessionID)
    throw new Error(`Evolution mutation Task ${input.taskID} is not bound to the exact Project and root Session`)
  if (!facts.session || facts.session.projectID !== input.projectID)
    throw new Error(`Evolution mutation Session ${input.sessionID} is not bound to Project ${input.projectID}`)
  return facts
}

/**
 * Verify the exact visible operator confirmation that authorizes a mutation.
 *
 * The facts are read through `Session.messages`, which already decodes rows
 * into `Message.WithParts`. This function used to select from `session.sql`
 * itself and then re-run `Message.User.safeParse` / `Message.TextPart.safeParse`
 * over the raw `data` columns — a second decoder for a shape the Session
 * module already owns, and one that would keep parsing happily while drifting
 * from the real one.
 */
export async function requireEvolutionMutationAuthorization(input: {
  projectID: string
  taskID: string
  sessionID: string
  messageID: string
  expectedText: string
}): Promise<VerifiedEvolutionMutationAuthorization> {
  requireEvolutionMutationRootSession(input)
  const message = (await Session.messages({ sessionID: input.sessionID })).find(
    (candidate) => candidate.info.id === input.messageID,
  )
  if (!message) throw new Error(`Evolution mutation authorization Message ${input.messageID} does not exist`)
  if (message.info.role !== "user" || message.info.author !== "user")
    throw new Error(`Evolution mutation authorization Message ${input.messageID} is not a real user Turn`)
  const provenance = TaskRootMessageProvenance.safeParse(message.info.extra?.task_root_message)
  if (
    !provenance.success ||
    provenance.data.taskID !== input.taskID ||
    provenance.data.kind !== "operator" ||
    provenance.data.source !== "expert_squad.evolution_authorization"
  )
    throw new Error("Evolution mutation authorization Message does not have exact Task operator provenance")
  if (message.parts.length !== 1)
    throw new Error("Evolution mutation authorization Message must contain exactly one visible confirmation part")
  const part = message.parts[0]!
  if (part.type !== "text" || part.kind !== "user_content" || part.source !== "user")
    throw new Error("Evolution mutation authorization Message must contain one exact visible user text part")
  const visibleText = part.text
  if (visibleText !== input.expectedText)
    throw new Error("Evolution mutation authorization Message does not equal the exact visible confirmation text")
  return {
    project_id: input.projectID,
    task_id: input.taskID,
    session_id: input.sessionID,
    message_id: input.messageID,
    message_sha256: createHash("sha256").update(Buffer.from(visibleText, "utf8")).digest("hex"),
    time_created: message.info.time.created,
  }
}
