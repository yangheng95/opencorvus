import type { Session } from "@/session"
import type { SessionPrompt } from "@/session/prompt"
import { randomUUID } from "node:crypto"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { Instance } from "@/project/instance"
import { Identifier } from "@/id/id"
import { Session as SessionApi } from "@/session"
import { activeSessionDeletionFenceInTransaction } from "@/session/deletion-cleanup"
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
import { RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS } from "@/panel/action-ids"
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
  ...RIGHT_SIDEBAR_PANEL_LEAF_TOOL_IDS,
  "question",
  "bash",
  "read",
  "glob",
  "search_code",
  "edit",
  "write",
  "apply_patch",
  "todo",
  "schedule",
] as const
export const RightSidebarConversationSessionResponse = z.object({
  session: SessionApi.Info,
})

type RightSidebarConversationCreationOptions = {
  id?: string
  title?: string
  configOverlay?: Record<string, unknown>
  creationMetadata?: Record<string, unknown>
  commitInTransaction?: (db: Database.TxOrDb, session: SessionApi.Info) => void
}

function persistRightSidebarConversationSession(
  db: Database.TxOrDb,
  experience: ConversationExperience,
  options?: RightSidebarConversationCreationOptions,
): Session.Info {
  // The validated initial overlay is part of the creation input and commits
  // in the Session insert itself — a published conversation Session carries
  // its requested model from its first durable instant, with no post-create
  // patch window a process death could leave half-applied.
  const prepared = SessionApi.prepareRootNext({
    id: options?.id,
    kind: "assistant",
    directory: Instance.directory,
    title: options?.title ?? rightSidebarConversationDefaultTitle(experience),
    metadata: {
      ...(options?.creationMetadata ?? {}),
      ...rightSidebarConversationMetadata(experience),
      ...(options?.configOverlay ? { configOverlay: options.configOverlay } : {}),
    },
  })
  const session = SessionApi.persistPreparedNextInTransaction(db, prepared)
  options?.commitInTransaction?.(db, session)
  return session
}

export async function createRightSidebarConversationSession(
  experience: ConversationExperience,
  options?: RightSidebarConversationCreationOptions,
) {
  return Database.immediateTransaction((db) => persistRightSidebarConversationSession(db, experience, options))
}

const ProjectConversationCreation = z
  .object({ version: z.literal(1), requestID: z.string(), model: z.string().nullable() })
  .strict()

export const ProjectConversationCreationConflictError = NamedError.create(
  "ProjectConversationCreationConflictError",
  z.object({ message: z.string(), sessionID: z.string(), reason: z.enum(["identity", "deletion_in_progress"]) }),
)

export const ProjectConversationCreationUnavailableError = NamedError.create(
  "ProjectConversationCreationUnavailableError",
  z.object({ message: z.string(), sessionID: z.string() }),
)

/** The project, directory and experience own one durable Session per explicit author intent. */
export async function createProjectConversationSession(input: {
  experience: ConversationExperience
  requestID?: string
  model?: string
  resolveConfigOverlay: () => Promise<Record<string, unknown> | undefined>
}): Promise<Session.Info> {
  const { directory, project, projectGeneration } = Instance
  const { experience } = input
  const identity = { version: 1, requestID: input.requestID ?? randomUUID(), model: input.model ?? null } as const
  const sessionID = Identifier.deterministic(
    "session",
    JSON.stringify(["project-conversation-creation-v1", project.id, projectGeneration, directory, experience, identity.requestID]),
  )
  const find = (db: Database.TxOrDb): Session.Info | undefined => {
    if (SessionApi.deletedInTransaction(db, sessionID)) {
      throw new ProjectConversationCreationUnavailableError({ message: "The accepted conversation was deleted.", sessionID })
    }
    if (activeSessionDeletionFenceInTransaction(db, sessionID)) {
      throw new ProjectConversationCreationConflictError({
        message: "Deletion of the accepted conversation is in progress.",
        sessionID,
        reason: "deletion_in_progress",
      })
    }
    const row = db.select().from(SessionTable).where(eq(SessionTable.id, sessionID)).get()
    if (!row) return undefined
    const accepted = SessionApi.fromRow(row)
    const binding = ProjectConversationCreation.safeParse(accepted.metadata?.projectConversationCreation)
    if (
      accepted.projectID !== project.id || accepted.directory !== directory || accepted.parentID !== undefined ||
      rightSidebarConversationExperience(accepted) !== experience || !binding.success ||
      binding.data.requestID !== identity.requestID || binding.data.model !== identity.model
    ) {
      throw new ProjectConversationCreationConflictError({
        message: "This conversation request is bound to a different creation input.",
        sessionID,
        reason: "identity",
      })
    }
    return accepted
  }
  const accepted = Database.use(find)
  if (accepted) return accepted
  const configOverlay = await input.resolveConfigOverlay()
  return Database.immediateTransaction((db) =>
    find(db) ?? persistRightSidebarConversationSession(db, experience, {
      id: sessionID,
      configOverlay,
      creationMetadata: { projectConversationCreation: identity },
    }),
  )
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
