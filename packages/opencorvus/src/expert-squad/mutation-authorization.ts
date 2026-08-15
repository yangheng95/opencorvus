import { createHash } from "node:crypto"
import { Message } from "@/session/message"
import { MessageTable, PartTable, SessionTable } from "@/session/session.sql"
import { EngineTaskTable } from "@/engine/engine.sql"
import { taskIDForSession } from "@/engine/task-session-lineage"
import { TaskRootMessageProvenance } from "@/task-api/task-root-message"
import { Database, and, asc, eq } from "@/storage/db"
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

export function requireEvolutionMutationAuthorization(input: {
  projectID: string
  taskID: string
  sessionID: string
  messageID: string
  expectedText: string
}): VerifiedEvolutionMutationAuthorization {
  requireEvolutionMutationRootSession(input)
  const facts = Database.use((db) => {
    const message = db
      .select({ sessionID: MessageTable.session_id, data: MessageTable.data, timeCreated: MessageTable.time_created })
      .from(MessageTable)
      .where(and(eq(MessageTable.id, input.messageID), eq(MessageTable.session_id, input.sessionID)))
      .get()
    const parts = db
      .select({ id: PartTable.id, messageID: PartTable.message_id, data: PartTable.data })
      .from(PartTable)
      .where(eq(PartTable.message_id, input.messageID))
      .orderBy(asc(PartTable.time_created), asc(PartTable.id))
      .all()
    return { message, parts }
  })
  if (!facts.message) throw new Error(`Evolution mutation authorization Message ${input.messageID} does not exist`)
  const user = Message.User.safeParse({
    ...facts.message.data,
    id: input.messageID,
    sessionID: facts.message.sessionID,
  })
  if (!user.success || user.data.author !== "user")
    throw new Error(`Evolution mutation authorization Message ${input.messageID} is not a real user Turn`)
  const provenance = TaskRootMessageProvenance.safeParse(user.data.extra?.task_root_message)
  if (
    !provenance.success ||
    provenance.data.taskID !== input.taskID ||
    provenance.data.kind !== "operator" ||
    provenance.data.source !== "expert_squad.evolution_authorization"
  )
    throw new Error("Evolution mutation authorization Message does not have exact Task operator provenance")
  if (facts.parts.length !== 1)
    throw new Error("Evolution mutation authorization Message must contain exactly one visible confirmation part")
  const row = facts.parts[0]
  const part = Message.TextPart.safeParse({
    ...row.data,
    id: row.id,
    sessionID: input.sessionID,
    messageID: row.messageID,
  })
  if (!part.success || part.data.kind !== "user_content" || part.data.source !== "user")
    throw new Error("Evolution mutation authorization Message must contain one exact visible user text part")
  const visibleText = part.data.text
  if (visibleText !== input.expectedText)
    throw new Error("Evolution mutation authorization Message does not equal the exact visible confirmation text")
  return {
    project_id: input.projectID,
    task_id: input.taskID,
    session_id: input.sessionID,
    message_id: input.messageID,
    message_sha256: createHash("sha256").update(Buffer.from(visibleText, "utf8")).digest("hex"),
    time_created: facts.message.timeCreated,
  }
}
