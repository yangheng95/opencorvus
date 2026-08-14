import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Session } from "@/session"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { EngineService } from "@/task-api"
import { TaskQueueService } from "@/scheduler/task-queue-service"
import { NotFoundError } from "@/storage/db"
import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { requestID as resolveRequestID } from "../error-handler"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import {
  RightSidebarConversationSessionResponse,
  createRightSidebarConversationSession,
  isRightSidebarConversationSession,
  listRightSidebarConversationSessions,
  rightSidebarConversationExperience,
  setRightSidebarConversationSelectedTask,
  type ConversationExperience,
} from "@/chat/session"
import { AuthReadUnavailableResponse, errors } from "../error"

const ConversationSessionQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursorUpdated: z.coerce.number().int().positive().optional(),
    cursorSessionID: z.string().trim().min(1).optional(),
    search: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasUpdated = value.cursorUpdated !== undefined
    const hasSessionID = value.cursorSessionID !== undefined
    if (hasUpdated !== hasSessionID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasUpdated ? ["cursorSessionID"] : ["cursorUpdated"],
        message: "cursorUpdated and cursorSessionID must be supplied together",
      })
    }
  })

const ConversationSessionSelectionInput = z.object({
  taskID: z.string().nullable(),
})

const ConversationSessionCreateInput = z
  .object({
    model: Config.ModelId.optional(),
  })
  .strict()

const ConversationSessionUpdateInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
})

const ConversationSessionArchiveInput = z.object({ archived: z.boolean() })

const ConversationSessionsResponse = z.object({
  sessions: Session.Info.array(),
  nextCursor: z
    .object({
      updated: z.number(),
      sessionID: z.string(),
    })
    .optional(),
})

function experienceLabel(experience: ConversationExperience): "Chat" | "Work" {
  return experience === "work" ? "Work" : "Chat"
}

async function assertRightSidebarConversationSession(sessionID: string, experience: ConversationExperience) {
  const label = experienceLabel(experience)
  const session = await Session.assertLineageInProject({ sessionID, projectID: Instance.project.id })
  if (
    session.projectID !== Instance.project.id ||
    session.directory !== Instance.directory ||
    !isRightSidebarConversationSession(session) ||
    rightSidebarConversationExperience(session) !== experience
  ) {
    throw new NotFoundError({ message: `${label} session not found: ${sessionID}` })
  }
  return session
}

async function closeRightSidebarConversationSession(
  session: Session.Info,
  experience: ConversationExperience,
  handle: string,
  source: "right_sidebar.abort" | "right_sidebar.archive",
  requestID: string,
): Promise<void> {
  const reason = `${experienceLabel(experience)} stopped`
  const origin = createExecutionCancellationOrigin({
    actor: "right_sidebar_conversation",
    source,
    surface: "right_sidebar",
    requestID,
    reason,
    targetSessionID: session.id,
  })
  cancelSessionPromptInScope({ session, origin, settleBeforeReuse: true })
  TaskQueueService.cancelSessionPrompts({
    sessionIDs: [session.id],
    reason,
    origin,
    source: "session.prompt_async",
  })
  await awaitSessionPromptFinishedInScope({ session, handle })
  await TaskQueueService.awaitSessionPromptsIdle({
    sessionIDs: [session.id],
    source: "session.prompt_async",
  })
  const occurrence = SessionStatus.executionOccurrence(session.id)
  if (occurrence && SessionStatus.getExecution(session.id, occurrence.inputMessageID).type !== "terminal") {
    await publishSessionStatus(
      session,
      { type: "terminal", reason: "aborted", error: `${experienceLabel(experience)} stopped` },
      { inputMessageID: occurrence.inputMessageID },
    )
  }
}

export function RightSidebarConversationRoutes(experience: ConversationExperience) {
  const label = experienceLabel(experience)
  const operation = `coding.${experience}`
  return new Hono()
    .post(
      "/session",
      describeRoute({
        summary: `Create right sidebar ${label} session`,
        description: `Create a project-bound ${label} session for the right sidebar. Prompting and history use canonical /session routes.`,
        operationId: `${operation}.session.create`,
        responses: {
          201: {
            description: `${label} session`,
            content: {
              "application/json": {
                schema: resolver(RightSidebarConversationSessionResponse),
              },
            },
          },
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("json", ConversationSessionCreateInput.optional()),
      async (c) => {
        const input = c.req.valid("json")
        let overlay: z.infer<typeof Config.Overlay> | undefined
        if (input?.model) {
          const base = await Config.get()
          overlay = Config.Overlay.parse({ model: input.model })
          const preview = Config.previewOverlayUpdate(base, {}, overlay)
          await validateConfigModelReferences(preview.effective, "conversation.configOverlay")
        }
        const session = await createRightSidebarConversationSession(experience)
        if (overlay) {
          await Session.mergeConfigOverlay({ sessionID: session.id, patch: overlay })
        }
        return c.json({ session: await Session.get(session.id) }, 201)
      },
    )
    .get(
      "/sessions",
      describeRoute({
        summary: `List right sidebar ${label} sessions`,
        description: `List project-bound right sidebar ${label} sessions. Prompting and history use canonical /session routes.`,
        operationId: `${operation}.sessions.list`,
        responses: {
          200: {
            description: `${label} sessions`,
            content: {
              "application/json": {
                schema: resolver(ConversationSessionsResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("query", ConversationSessionQuery),
      async (c) => {
        const input = c.req.valid("query")
        return c.json(await listRightSidebarConversationSessions({ ...input, experience }))
      },
    )
    .get(
      "/session/:sessionID",
      describeRoute({
        summary: `Claim right sidebar ${label} session`,
        description: `Validate and return an existing project-bound right sidebar ${label} session.`,
        operationId: `${operation}.session.get`,
        responses: {
          200: {
            description: `${label} session`,
            content: {
              "application/json": {
                schema: resolver(RightSidebarConversationSessionResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const session = await assertRightSidebarConversationSession(c.req.valid("param").sessionID, experience)
        return c.json({ session })
      },
    )
    .patch(
      "/session/:sessionID",
      describeRoute({
        summary: `Update right sidebar ${label} session`,
        description: `Update a project-bound right sidebar ${label} session.`,
        operationId: `${operation}.session.update`,
        responses: {
          200: {
            description: `Updated ${label} session`,
            content: {
              "application/json": {
                schema: resolver(RightSidebarConversationSessionResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", ConversationSessionUpdateInput),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await assertRightSidebarConversationSession(sessionID, experience)
        const updates = c.req.valid("json")
        let session = await Session.get(sessionID)
        if (updates.title !== undefined) {
          session = await Session.setTitle({ sessionID, title: updates.title })
        }
        return c.json({ session })
      },
    )
    .delete(
      "/session/:sessionID",
      describeRoute({
        summary: `Delete right sidebar ${label} session`,
        description: `Delete a project-bound right sidebar ${label} session and its canonical history.`,
        operationId: `${operation}.session.delete`,
        responses: {
          200: {
            description: `Deleted ${label} session`,
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        await assertRightSidebarConversationSession(sessionID, experience)
        await EngineService.deleteSession(sessionID, {
          cancellationOrigin: {
            actor: "user",
            source: "session.delete",
            surface: "right-sidebar",
            requestID: resolveRequestID(c),
            reason: `${experienceLabel(experience)} deleted`,
          },
        })
        return c.json(true)
      },
    )
    .patch(
      "/session/:sessionID/archive",
      describeRoute({
        summary: `Archive or restore right sidebar ${label} session`,
        description: `Stop and archive a ${label} session, or restore it without restarting execution.`,
        operationId: `${operation}.session.setArchived`,
        responses: {
          200: {
            description: `${label} archive state updated`,
            content: { "application/json": { schema: resolver(RightSidebarConversationSessionResponse) } },
          },
          ...errors(404, 409),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", ConversationSessionArchiveInput),
      async (c) => {
        const session = await assertRightSidebarConversationSession(c.req.valid("param").sessionID, experience)
        const { archived } = c.req.valid("json")
        if (archived && session.time.archived === undefined) {
          await closeRightSidebarConversationSession(
            session,
            experience,
            `${operation}.session.setArchived`,
            "right_sidebar.archive",
            resolveRequestID(c),
          )
        }
        return c.json({
          session: await Session.setArchived({
            sessionID: session.id,
            time: archived ? Date.now() : null,
          }),
        })
      },
    )
    .post(
      "/session/:sessionID/abort",
      describeRoute({
        summary: `Abort right sidebar ${label} session`,
        description: `Stop active and queued processing for a project-bound right sidebar ${label} session.`,
        operationId: `${operation}.session.abort`,
        responses: {
          200: {
            description: `Aborted ${label} session`,
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404, 409),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      async (c) => {
        const sessionID = c.req.valid("param").sessionID
        const session = await assertRightSidebarConversationSession(sessionID, experience)
        await closeRightSidebarConversationSession(
          session,
          experience,
          `${operation}.session.abort`,
          "right_sidebar.abort",
          resolveRequestID(c),
        )
        return c.json(true)
      },
    )
    .patch(
      "/session/:sessionID/selection",
      describeRoute({
        summary: `Update right sidebar ${label} task selection`,
        description: `Persist the selected project task for a right sidebar ${label} session. The selected task is stored in session metadata and remains project-bound.`,
        operationId: `${operation}.session.selection.update`,
        responses: {
          200: {
            description: `${label} session with updated selection`,
            content: {
              "application/json": {
                schema: resolver(RightSidebarConversationSessionResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ sessionID: z.string() })),
      validator("json", ConversationSessionSelectionInput),
      async (c) => {
        const session = await assertRightSidebarConversationSession(c.req.valid("param").sessionID, experience)
        const { taskID } = c.req.valid("json")
        if (taskID !== null) {
          const task = await EngineService.getTask(taskID)
          if (task.projectID !== session.projectID || task.directory !== session.directory) {
            throw new NotFoundError({ message: `Task not found: ${taskID}` })
          }
        }
        const updated = await setRightSidebarConversationSelectedTask({ session, taskID })
        return c.json({ session: updated })
      },
    )
}
