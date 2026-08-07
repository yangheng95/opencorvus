import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { isRightSidebarConversationSession } from "@/chat/session"
import { suppliedTaskCreatorMetadataKeys } from "./task-caller-metadata"

export const TaskCreatorActor = z.enum([
  "user",
  "control_agent",
  "mission",
  "right_sidebar_conversation",
  "orchestrator",
])
export type TaskCreatorActor = z.infer<typeof TaskCreatorActor>

const SessionTaskCreatorActor = z.enum(["control_agent", "right_sidebar_conversation", "orchestrator"])

export const TaskCreator = z.discriminatedUnion("actor", [
  z.object({ actor: z.literal("user") }).strict(),
  z
    .object({
      actor: z.literal("mission"),
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
    })
    .strict(),
  z.object({ actor: SessionTaskCreatorActor, sessionID: Identifier.schema("session") }).strict(),
])
export type TaskCreator = z.infer<typeof TaskCreator>

const ResolvedTaskCreator = z.discriminatedUnion("actor", [
  z.object({ actor: z.literal("user") }).strict(),
  z
    .object({
      actor: z.literal("mission"),
      missionID: z.string().min(1),
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
      toolCallID: z.string().min(1).optional(),
    })
    .strict(),
  z.object({ actor: SessionTaskCreatorActor, sessionID: Identifier.schema("session") }).strict(),
])

export const TaskCreatorMetadata = z
  .discriminatedUnion("actor", [
    z.object({ actor: z.literal("user") }).passthrough(),
    z
      .object({
        actor: z.literal("mission"),
        mission: z
          .object({
            id: z.string().min(1),
            session_id: Identifier.schema("session"),
          })
          .strict(),
      })
      .passthrough(),
    z
      .object({
        actor: SessionTaskCreatorActor,
        actor_session_id: Identifier.schema("session"),
      })
      .passthrough(),
  ])
  .superRefine((metadata, context) => {
    if (metadata.actor !== "mission" && "mission" in metadata) {
      context.addIssue({ code: "custom", message: "Only Mission creator metadata may contain mission." })
    }
    if ((metadata.actor === "user" || metadata.actor === "mission") && "actor_session_id" in metadata) {
      context.addIssue({
        code: "custom",
        message: `${metadata.actor} creator metadata cannot contain actor_session_id.`,
      })
    }
  })

export const TaskCreatorAuthorityError = NamedError.create(
  "TaskCreatorAuthorityError",
  z.object({ message: z.string() }),
)

export const TaskCreatorSessionError = NamedError.create("TaskCreatorSessionError", z.object({ message: z.string() }))

export function assertNoCallerSuppliedTaskCreatorMetadata(metadata: Record<string, unknown> | undefined): void {
  const supplied = suppliedTaskCreatorMetadataKeys(metadata)
  if (supplied.length === 0) return
  throw new TaskCreatorAuthorityError({
    message: `Task creator metadata is server-owned; remove reserved keys: ${supplied.join(", ")}`,
  })
}

export async function resolveTaskCreator(rawCreator: z.input<typeof TaskCreator>) {
  const creator = TaskCreator.parse(rawCreator)
  if (creator.actor === "user") return creator
  const session = await Session.assertLineageInProject({
    sessionID: creator.sessionID,
    projectID: Instance.project.id,
  })
  if (creator.actor === "orchestrator" && session.kind !== "orchestrator") {
    throw new TaskCreatorSessionError({
      message: `Orchestrator task creator session ${creator.sessionID} must have kind orchestrator.`,
    })
  }
  if (creator.actor === "right_sidebar_conversation" && !isRightSidebarConversationSession(session)) {
    throw new TaskCreatorSessionError({
      message: `Right-sidebar task creator session ${creator.sessionID} is not a right-sidebar conversation.`,
    })
  }
  if (
    creator.actor === "control_agent" &&
    (session.kind !== "assistant" || isRightSidebarConversationSession(session))
  ) {
    throw new TaskCreatorSessionError({
      message: `Control Agent task creator session ${creator.sessionID} must be a non-conversation assistant session.`,
    })
  }
  if (creator.actor !== "mission") return creator
  if (session.kind !== "mission") {
    throw new TaskCreatorSessionError({
      message: `Mission task creator session ${creator.sessionID} must have kind mission.`,
    })
  }
  const mission = (session.metadata as Record<string, unknown> | undefined)?.mission
  const missionID =
    mission && typeof mission === "object" && !Array.isArray(mission)
      ? (mission as Record<string, unknown>).id
      : undefined
  if (typeof missionID !== "string" || missionID.length === 0) {
    throw new TaskCreatorSessionError({
      message: `Mission task creator session ${creator.sessionID} is missing metadata.mission.id`,
    })
  }
  return ResolvedTaskCreator.parse({ ...creator, missionID })
}

export function projectTaskCreatorMetadata(
  metadata: Record<string, unknown> | undefined,
  creator: z.infer<typeof ResolvedTaskCreator>,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    actor: creator.actor,
    ...(creator.actor === "mission"
      ? { mission: { id: creator.missionID, session_id: creator.sessionID } }
      : creator.actor === "user"
        ? {}
        : { actor_session_id: creator.sessionID }),
  }
}
