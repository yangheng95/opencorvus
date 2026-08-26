import type { Session } from "@/session"
import type { SessionPrompt } from "@/session/prompt"
import z from "zod"
import { Instance } from "@/project/instance"
import { Session as SessionApi } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { Database, NotFoundError, and, desc, eq, isNull, like, or, sql, type SQL } from "@/storage/db"
import {
  RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE,
  RIGHT_SIDEBAR_WORK_DEFAULT_TITLE,
  RightSidebarConversationMetadata,
  rightSidebarConversationDefaultTitle,
  rightSidebarConversationExperience,
  rightSidebarConversationMetadata,
  type ConversationExperience,
} from "./identity"
export {
  ConversationExperience,
  RIGHT_SIDEBAR_CHAT_DEFAULT_TITLE,
  RIGHT_SIDEBAR_WORK_DEFAULT_TITLE,
  isRightSidebarConversationSession,
  rightSidebarConversationAgentID,
  rightSidebarConversationExperience,
  rightSidebarConversationMetadata,
  rightSidebarConversationSelectedTaskID,
} from "./identity"

export const RIGHT_SIDEBAR_CHAT_METADATA = rightSidebarConversationMetadata("chat")
export const RIGHT_SIDEBAR_WORK_METADATA = rightSidebarConversationMetadata("work")
/** Canonical runtime source shared by right-sidebar Chat and Work conversations. */
export const RIGHT_SIDEBAR_CONVERSATION_SOURCE = "right-sidebar-conversation"
export const RIGHT_SIDEBAR_CONVERSATION_REQUIRED_TOOLS = [
  "delegate_agent",
  "panel",
  "question",
  "bash",
  "read",
  "glob",
  "search_code",
  "edit",
  "write",
  "apply_patch",
  "todoread",
  "todowrite",
  "schedule",
] as const
export const RightSidebarConversationSessionResponse = z.object({
  session: SessionApi.Info,
})

export async function createRightSidebarConversationSession(
  experience: ConversationExperience,
  options?: { id?: string; configOverlay?: Record<string, unknown> },
) {
  // The validated initial overlay is part of the creation input and commits
  // in the Session insert itself — a published conversation Session carries
  // its requested model from its first durable instant, with no post-create
  // patch window a process death could leave half-applied.
  return SessionApi.createNext({
    id: options?.id,
    kind: "assistant",
    directory: Instance.directory,
    title: rightSidebarConversationDefaultTitle(experience),
    metadata: {
      ...rightSidebarConversationMetadata(experience),
      ...(options?.configOverlay ? { configOverlay: options.configOverlay } : {}),
    },
  })
}

export function applyRightSidebarConversationPromptOverlay<T extends Omit<SessionPrompt.PromptInput, "sessionID">>(
  prompt: T,
  context: { experience: ConversationExperience; taskID?: string },
): T {
  const { tools, ...rest } = prompt
  const { taskID: _requestedTaskID, ...extra } = prompt.extra ?? {}
  const forcedTools = Object.fromEntries(RIGHT_SIDEBAR_CONVERSATION_REQUIRED_TOOLS.map((tool) => [tool, true]))
  return {
    ...rest,
    agent: context.experience,
    tools: {
      ...(tools ?? {}),
      ...forcedTools,
    },
    extra: {
      ...extra,
      surface: "right-sidebar",
      source: RIGHT_SIDEBAR_CONVERSATION_SOURCE,
      experience: context.experience,
      ...(context.taskID ? { taskID: context.taskID } : {}),
    },
  } as unknown as T
}

export async function setRightSidebarConversationSelectedTask(input: { session: Session.Info; taskID: string | null }) {
  const experience = rightSidebarConversationExperience(input.session)
  if (!experience) throw new Error(`Session ${input.session.id} is not a right-sidebar conversation`)
  const current =
    input.session.metadata && typeof input.session.metadata === "object"
      ? (input.session.metadata as Record<string, unknown>).conversation
      : undefined
  const conversation: z.output<typeof RightSidebarConversationMetadata> = {
    ...((current && typeof current === "object" ? current : {}) as Partial<
      z.output<typeof RightSidebarConversationMetadata>
    >),
    experience,
    surface: "right-sidebar",
    selectedTaskID: input.taskID,
  }
  return SessionApi.mergeMetadata({
    sessionID: input.session.id,
    patch: { conversation },
  })
}

export type RightSidebarConversationSessionListInput = {
  limit: number
  cursorUpdated?: number
  cursorSessionID?: string
  search?: string
}

export type RightSidebarConversationSessionList = {
  sessions: Session.Info[]
  nextCursor?: {
    updated: number
    sessionID: string
  }
}

export async function listRightSidebarConversationSessions(
  input: RightSidebarConversationSessionListInput & { experience: ConversationExperience },
): Promise<RightSidebarConversationSessionList> {
  const baseConditions = (): SQL[] => [
    eq(SessionTable.project_id, Instance.project.id),
    eq(SessionTable.directory, Instance.directory),
    eq(SessionTable.kind, "assistant" as const),
    isNull(SessionTable.time_archived),
    sql`json_extract(${SessionTable.metadata}, '$.conversation.surface') = 'right-sidebar'`,
    sql`json_extract(${SessionTable.metadata}, '$.conversation.experience') = ${input.experience}`,
  ]
  const search = input.search?.trim()
  if (input.cursorUpdated !== undefined) {
    if (!input.cursorSessionID) {
      throw new Error("listRightSidebarConversationSessions requires cursorSessionID with cursorUpdated")
    }
  }

  const visibleLimit = input.limit
  const visible: Session.Info[] = []
  let cursorUpdated = input.cursorUpdated
  let cursorSessionID = input.cursorSessionID

  while (visible.length <= visibleLimit) {
    const conditions = baseConditions()
    if (search) {
      conditions.push(or(like(SessionTable.title, `%${search}%`), like(SessionTable.id, `%${search}%`))!)
    }
    if (cursorUpdated !== undefined) {
      conditions.push(
        or(
          sql`${SessionTable.time_updated} < ${cursorUpdated}`,
          sql`${SessionTable.time_updated} = ${cursorUpdated} AND ${SessionTable.id} < ${cursorSessionID}`,
        )!,
      )
    }
    const rows = Database.use((db) =>
      db
        .select()
        .from(SessionTable)
        .where(and(...conditions))
        .orderBy(desc(SessionTable.time_updated), desc(SessionTable.id))
        .limit(visibleLimit + 1)
        .all(),
    )
    for (const row of rows) {
      const session = SessionApi.fromRow(row)
      try {
        await SessionApi.assertLineageInProject({ sessionID: session.id, projectID: Instance.project.id })
        visible.push(session)
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error
      }
      if (visible.length > visibleLimit) break
    }
    if (visible.length > visibleLimit || rows.length <= visibleLimit) break
    const lastScanned = rows.at(-1)
    if (!lastScanned) break
    cursorUpdated = lastScanned.time_updated
    cursorSessionID = lastScanned.id
  }

  const sessions = visible.slice(0, visibleLimit)
  const last = sessions.at(-1)
  return {
    sessions,
    ...(visible.length > visibleLimit && last
      ? {
          nextCursor: {
            updated: last.time.updated,
            sessionID: last.id,
          },
        }
      : {}),
  }
}
