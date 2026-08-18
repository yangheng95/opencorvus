import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import type { Session } from "@/session"

export const MissionPublicSessionOperation = z.enum([
  "session.create",
  "session.fork",
  "session.prompt",
  "session.prompt_async",
  "session.init",
  "session.summarize",
  "session.command",
  "session.shell",
  "session.abort",
  "session.delete",
  "session.archive",
  "task_queue.prompt",
  "task_queue.compaction",
])
export type MissionPublicSessionOperation = z.infer<typeof MissionPublicSessionOperation>

const MissionCanonicalOperation = z.enum([
  "mission.wake",
  "mission.createDraft",
  "mission.abort",
  "mission.delete",
  "mission.setArchived",
])

export const MissionSessionAuthorityError = NamedError.create(
  "MissionSessionAuthorityError",
  z
    .object({
      message: z.string(),
      operation: MissionPublicSessionOperation,
      canonicalOperation: MissionCanonicalOperation,
      sessionID: z.string().optional(),
      missionID: z.string().optional(),
    })
    .strict(),
)

const canonicalOperation: Record<MissionPublicSessionOperation, z.infer<typeof MissionCanonicalOperation>> = {
  "session.create": "mission.createDraft",
  "session.fork": "mission.wake",
  "session.prompt": "mission.wake",
  "session.prompt_async": "mission.wake",
  "session.init": "mission.wake",
  "session.summarize": "mission.wake",
  "session.command": "mission.wake",
  "session.shell": "mission.wake",
  "session.abort": "mission.abort",
  "session.delete": "mission.delete",
  "session.archive": "mission.setArchived",
  "task_queue.prompt": "mission.wake",
  "task_queue.compaction": "mission.wake",
}

function missionID(session: Pick<Session.Info, "metadata">): string | undefined {
  const mission = session.metadata?.mission
  if (!mission || typeof mission !== "object" || Array.isArray(mission)) return
  const value = (mission as Record<string, unknown>).id
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function authorityError(
  operation: MissionPublicSessionOperation,
  identity: { sessionID?: string; missionID?: string } = {},
): InstanceType<typeof MissionSessionAuthorityError> {
  const canonical = canonicalOperation[operation]
  return new MissionSessionAuthorityError({
    message: `${operation} cannot control a Mission Session; use ${canonical}.`,
    operation,
    canonicalOperation: canonical,
    ...identity,
  })
}

export function assertPublicSessionCreateAuthority(kind: Session.Info["kind"]): void {
  if (kind === "mission") throw authorityError("session.create")
}

export function assertPublicSessionOperationAuthority(
  session: Session.Info,
  operation: MissionPublicSessionOperation,
): void {
  const error = publicSessionOperationAuthorityError(session, operation)
  if (error) throw error
}

export function publicSessionOperationAuthorityError(
  session: Session.Info,
  operation: MissionPublicSessionOperation,
): InstanceType<typeof MissionSessionAuthorityError> | undefined {
  if (session.kind !== "mission") return
  return authorityError(operation, { sessionID: session.id, missionID: missionID(session) })
}
