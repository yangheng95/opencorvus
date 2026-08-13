import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { randomBytes } from "node:crypto"
import { conversationMessageHasDisplay } from "@/conversation/view"
import { Instance } from "@/project/instance"
import {
  ensureMissionSession,
  assertMissionExpertSquadSnapshot,
  MissionExpertSquadSnapshotMismatchError,
  findExistingMissionSession,
  getMissionSessionByDirectory,
  listGlobalMissionSessions,
  missionPendingPrompt,
  missionVisibleExpertSquadIDs,
  missionProductPillar,
  setMissionPendingPrompt,
} from "@/mission/session"
import {
  MissionID,
  MissionPendingPrompt,
  MissionRequestedExpertSquadIDs,
  MissionVisibleExpertSquadIDs,
  ProductPillarSchema,
} from "@/mission/schema"
import { resolveMissionLaunchExpertSquadIDs } from "@/mission/expert-squad-authority"
import { MissionRecord, missionRecord, missionStatusRecord } from "@/mission/projection"
import { listMissionTasks } from "@/engine/store"
import { deriveTaskStatus } from "@/engine/task-status"
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { MissionStatusSnapshot } from "@/status/task-status-snapshot"
import { Session } from "@/session"
import { SessionWake } from "@/session/wake"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { enrichStandaloneSessionTranscript } from "@/protocol/session-mirror"
import { isModelReference } from "@/provider/model-ref"
import { Provider } from "@/provider/provider"
import { resolveAgentModel } from "@/agent/model"
import { buildMissionProjectArchive, ProjectArchiveUnsupportedProjectError } from "@/engine/task-project-archive"
import { EngineService } from "@/task-api"
import { UserUploadInput, UserUploadList } from "@/engine/model"
import { AttachmentStore } from "@/storage/attachment-store"
import { awaitSessionPromptFinishedInScope, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import {
  AuthReadUnavailableResponse,
  badRequestBody,
  badRequestOrNamedErrorResponse,
  errors,
  namedErrorResponse,
} from "../error"
import { requestID as resolveRequestID } from "../error-handler"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { NotFoundError } from "@/storage/db"
import { MissionDurableActivityCursorSchema, readMissionDurableActivity } from "@/engine/durable-activity"
import { HttpQueryBoolean, HttpQueryLimit } from "../query-schema"
import {
  TaskArchiveRequestBody,
  TaskCancellationRequestBody,
  type TaskCancellationRequestBody as TaskCancellationRequestBodyValue,
} from "@opencorvus-ai/transport-protocol"
import { closeMissionExecutionOperation, openMissionExecution } from "@/mission/execution-closure"
import { drainSchedulerMessagesForProject } from "@/protocol/scheduler-message"

function newMissionID(): string {
  return randomBytes(8).toString("hex")
}

const MissionWakeInput = z
  .object({
    missionID: MissionID.optional(),
    productPillar: ProductPillarSchema,
    text: z.string().min(1).max(32_000),
    attachments: UserUploadList.optional(),
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
    expertSquadIDs: MissionRequestedExpertSquadIDs.optional(),
  })
  .strict()

const MissionWakeResult = z.object({
  missionID: MissionID,
  sessionID: z.string(),
  created: z.boolean(),
  productPillar: ProductPillarSchema,
})

const MissionDraftInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    request: MissionPendingPrompt.shape.text,
    productPillar: ProductPillarSchema,
    expertSquadIDs: MissionRequestedExpertSquadIDs.optional(),
  })
  .strict()

const MissionDispatchInput = z
  .object({
    model: z
      .string()
      .refine(isModelReference, {
        message: 'Model must be in the format "provider/model".',
      })
      .optional(),
  })
  .strict()

const MissionListQuery = z
  .object({
    directory: z.string().optional(),
    search: z.string().optional(),
    limit: HttpQueryLimit.optional(),
    cursorUpdated: z.coerce.number().optional(),
    cursorSessionID: z.string().optional(),
    archived: HttpQueryBoolean.optional(),
  })
  .refine((query) => (query.cursorUpdated === undefined) === (query.cursorSessionID === undefined), {
    message: "cursorUpdated and cursorSessionID must be provided together",
    path: ["cursorUpdated"],
  })

const MissionParam = z.object({
  missionID: MissionID,
})

const MissionTitleInput = z.object({
  title: z.string().trim().min(1).max(200),
})

const MissionArchiveInput = TaskArchiveRequestBody

const ProjectArchiveUnsupportedProjectResponse = z.object({
  message: z.string(),
})

type MissionSessionRecord = Awaited<ReturnType<typeof getMissionSessionByDirectory>>

async function missionWakeAttachmentParts(
  attachments: z.infer<typeof UserUploadInput>[] | undefined,
): Promise<NonNullable<SessionWake.WakeInput["parts"]>> {
  const parts: NonNullable<SessionWake.WakeInput["parts"]> = []
  for (const attachment of attachments ?? []) {
    const reference =
      "data" in attachment
        ? await AttachmentStore.write(
            Instance.project.id,
            decodeRawBase64Payload(
              attachment.data,
              `mission wake attachment ${attachment.filename ?? attachment.mime}`,
            ),
            attachment.mime,
            attachment.filename,
          )
        : await AttachmentStore.requireReference({
            projectID: Instance.project.id,
            url: attachment.url,
            mime: attachment.mime,
          })
    parts.push({
      type: "file",
      mime: reference.mime,
      url: reference.url,
      presentation: "attachment-index",
      ...((attachment.filename ?? reference.filename) ? { filename: attachment.filename ?? reference.filename } : {}),
    })
  }
  return parts
}

function missionRouteSession(missionID: string): Promise<MissionSessionRecord> {
  return getMissionSessionByDirectory({ missionID, directory: Instance.directory })
}

async function missionTranscript(sessionID: string) {
  return enrichStandaloneSessionTranscript(await Session.messages({ sessionID })).filter(conversationMessageHasDisplay)
}

async function closeMissionExecution(
  session: MissionSessionRecord,
  handle: "mission.abort" | "mission.delete" | "mission.archive",
  requestID: string,
  provenance: TaskCancellationRequestBodyValue,
) {
  const cancellationOrigin = {
    actor: "user",
    source: handle,
    surface: provenance.surface,
    requestID,
    reason: provenance.reason,
    sessionID: session.id,
    missionID: session.missionID,
  } satisfies TaskCancellationOrigin
  await closeMissionExecutionOperation({
    missionID: session.missionID,
    sessionID: session.id,
    source: handle,
    requestID,
    close: async () => {
      const failures: string[] = []
      try {
        const origin = createExecutionCancellationOrigin({
          actor: cancellationOrigin.actor,
          source: cancellationOrigin.source,
          surface: cancellationOrigin.surface,
          requestID: cancellationOrigin.requestID,
          reason: cancellationOrigin.reason,
          targetSessionID: session.id,
          missionID: cancellationOrigin.missionID,
        })
        cancelSessionPromptInScope({
          session,
          handle,
          origin,
          settleBeforeReuse: true,
        })
      } catch (error) {
        failures.push(`mission ${session.missionID}: ${error instanceof Error ? error.message : String(error)}`)
      }
      const childTasks = listMissionTasks({
        projectID: session.projectID,
        missionID: session.missionID,
        sessionID: session.id,
      }).filter((task) => {
        const status = deriveTaskStatus(task)
        return status === "queued" || status === "active"
      })
      for (const task of childTasks) {
        try {
          await EngineService.cancelTask(task.id, {
            origin: cancellationOrigin,
          })
        } catch (error) {
          failures.push(`task ${task.id}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      try {
        await awaitSessionPromptFinishedInScope({
          session,
          handle,
        })
      } catch (error) {
        failures.push(`mission ${session.missionID}: ${error instanceof Error ? error.message : String(error)}`)
      }
      try {
        await drainSchedulerMessagesForProject()
      } catch (error) {
        failures.push(
          `mission ${session.missionID} scheduler inbox: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      if (failures.length > 0) {
        throw createTaskCancellationIncomplete({
          handle,
          cause: new Error(failures.join("; ")),
        })
      }
    },
  })
  return cancellationOrigin
}

export function MissionRoutes() {
  return new Hono()
    .post(
      "/draft",
      describeRoute({
        summary: "Create a Mission draft",
        description:
          "Create a backlog Mission with an immutable Expert Squad snapshot and one pending operator prompt. " +
          "No model is invoked until the operator dispatches the Mission.",
        operationId: "mission.createDraft",
        responses: {
          200: {
            description: "Mission draft created",
            content: { "application/json": { schema: resolver(MissionRecord) } },
          },
          ...errors(400),
        },
      }),
      validator("json", MissionDraftInput),
      async (c) => {
        const input = c.req.valid("json")
        let heldExpertSquadIDs: MissionVisibleExpertSquadIDs
        try {
          heldExpertSquadIDs = await resolveMissionLaunchExpertSquadIDs({
            projectDirectory: Instance.project.worktree,
            productPillar: input.productPillar,
            requestedExpertSquadIDs: input.expertSquadIDs,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return c.json(badRequestBody(message), 400)
        }
        const missionID = newMissionID()
        const created = await ensureMissionSession({
          missionID,
          defaultCwd: Instance.directory,
          productPillar: input.productPillar,
          heldExpertSquadIDs,
        })
        const titled = await Session.setTitle({ sessionID: created.id, title: input.title })
        const updated = await setMissionPendingPrompt({
          session: titled,
          pendingPrompt: { text: input.request },
        })
        return c.json(missionRecord({ ...updated, missionID, productPillar: missionProductPillar(updated) }))
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List Missions",
        description:
          "List Mission records across project directories. Each record is backed by " +
          'exactly one kind="mission" session and can be opened through the session ' +
          "conversation/event routes. Board lanes are exclusive read-time projections from Mission completion, " +
          "pending interaction, Task lifecycle, and Mission execution facts.",
        operationId: "mission.list",
        responses: {
          200: {
            description: "Mission records",
            content: { "application/json": { schema: resolver(MissionRecord.array()) } },
          },
        },
      }),
      validator("query", MissionListQuery),
      async (c) => {
        const query = c.req.valid("query")
        const records: z.infer<typeof MissionRecord>[] = []
        for await (const session of listGlobalMissionSessions({
          directory: query.directory,
          search: query.search,
          limit: query.limit,
          cursorUpdated: query.cursorUpdated,
          cursorSessionID: query.cursorSessionID,
          archived: query.archived,
        })) {
          records.push(missionRecord(session))
        }
        return c.json(records)
      },
    )
    .get(
      "/:missionID/status",
      describeRoute({
        summary: "Get Mission status",
        description:
          "Collect current Mission and Task activity with each Task's diagnostic lifecycle, Requirement acceptance, and per-Slice fact facets. " +
          'Mission and Task `status` fields are normalized to "running" or "inactive"; each Goal detail independently exposes exact activity associations, review associations, and Completion Decision acceptance. Raw queued, active, completed, failed, and cancelled lifecycle facts remain available only as lifecycleStatus.',
        operationId: "mission.status",
        responses: {
          200: {
            description: "Mission status snapshot",
            content: { "application/json": { schema: resolver(MissionStatusSnapshot) } },
          },
          ...errors(404),
        },
      }),
      validator("param", MissionParam),
      async (c) => {
        const session = await missionRouteSession(c.req.valid("param").missionID)
        return c.json(missionStatusRecord(session))
      },
    )
    .get(
      "/:missionID/activity-cursor",
      describeRoute({
        summary: "Get Mission durable activity cursor",
        description:
          "Return the canonical latest durable activity occurrence across the Mission Session tree and all child Task execution trees.",
        operationId: "mission.activityCursor",
        responses: {
          200: {
            description: "Mission durable activity cursor",
            content: { "application/json": { schema: resolver(MissionDurableActivityCursorSchema) } },
          },
          ...errors(404),
        },
      }),
      validator("param", MissionParam),
      async (c) => {
        const session = await missionRouteSession(c.req.valid("param").missionID)
        return c.json(
          readMissionDurableActivity({
            projectID: session.projectID,
            missionID: session.missionID,
            sessionID: session.id,
          }),
        )
      },
    )
    .get(
      "/:missionID/project-archive",
      describeRoute({
        summary: "Download Mission project archive",
        description:
          "Return a ZIP containing the Mission project's Git-included files plus Mission execution evidence exported from Mission projections.",
        operationId: "mission.projectArchive",
        responses: {
          200: {
            description: "ZIP archive",
            content: {
              "application/zip": {
                schema: resolver(z.string()),
              },
            },
          },
          422: {
            description: "Mission project is not a Git worktree",
            content: {
              "application/json": {
                schema: resolver(ProjectArchiveUnsupportedProjectResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", MissionParam),
      async (c) => {
        const session = await missionRouteSession(c.req.valid("param").missionID)
        const record = missionRecord(session)
        const archiveStatus = missionStatusRecord(session)
        try {
          const archive = await buildMissionProjectArchive({
            missionID: session.missionID,
            sessionID: session.id,
            projectID: session.projectID,
            title: session.title,
            directory: session.directory,
            record,
            status: archiveStatus,
            tasks: record.tasks,
            transcript: await missionTranscript(session.id),
          })
          return new Response(archive.bytes, {
            status: 200,
            headers: {
              "content-type": "application/zip",
              "content-disposition": `attachment; filename="${archive.filename}"`,
              "content-length": String(archive.bytes.byteLength),
              "x-opencorvus-archive-file-count": String(archive.fileCount),
            },
          })
        } catch (error) {
          if (error instanceof ProjectArchiveUnsupportedProjectError) {
            return c.json({ message: error.message }, 422)
          }
          throw error
        }
      },
    )
    .patch(
      "/:missionID/title",
      describeRoute({
        summary: "Rename a Mission",
        description: "Rename the Mission session title. The Mission record remains backed by the same mission session.",
        operationId: "mission.rename",
        responses: {
          200: {
            description: "Renamed Mission record",
            content: { "application/json": { schema: resolver(MissionRecord) } },
          },
          ...errors(404),
        },
      }),
      validator("param", MissionParam),
      validator("json", MissionTitleInput),
      async (c) => {
        const missionID = c.req.valid("param").missionID
        const session = await missionRouteSession(missionID)
        const updated = await Session.setTitle({ sessionID: session.id, title: c.req.valid("json").title })
        return c.json(missionRecord({ ...updated, missionID, productPillar: session.productPillar }))
      },
    )
    .patch(
      "/:missionID/archive",
      describeRoute({
        summary: "Archive or restore a Mission",
        description: "Stop and archive a Mission, or restore it without restarting execution.",
        operationId: "mission.setArchived",
        responses: {
          200: {
            description: "Mission archive state updated",
            content: { "application/json": { schema: resolver(MissionRecord) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", MissionParam),
      validator("json", MissionArchiveInput),
      async (c) => {
        const missionID = c.req.valid("param").missionID
        const session = await missionRouteSession(missionID)
        const body = c.req.valid("json")
        const { archived } = body
        if (archived && session.time.archived === undefined) {
          await closeMissionExecution(session, "mission.archive", resolveRequestID(c), body)
        }
        const updated = await Session.setArchived({
          sessionID: session.id,
          time: archived ? Date.now() : null,
        })
        return c.json(missionRecord({ ...updated, missionID, productPillar: session.productPillar }))
      },
    )
    .post(
      "/:missionID/abort",
      describeRoute({
        summary: "Abort a Mission",
        description: "Abort the active Mission session loop for this Mission.",
        operationId: "mission.abort",
        responses: {
          200: {
            description: "Mission abort accepted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", MissionParam),
      validator("json", TaskCancellationRequestBody),
      async (c) => {
        const session = await missionRouteSession(c.req.valid("param").missionID)
        await closeMissionExecution(session, "mission.abort", resolveRequestID(c), c.req.valid("json"))
        return c.json(true)
      },
    )
    .delete(
      "/:missionID",
      describeRoute({
        summary: "Delete a Mission",
        description: "Delete the Mission session and its conversation history.",
        operationId: "mission.delete",
        responses: {
          200: {
            description: "Mission deleted",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", MissionParam),
      validator("json", TaskCancellationRequestBody),
      async (c) => {
        const missionID = c.req.valid("param").missionID
        const session = await getMissionSessionByDirectory({
          missionID,
          directory: PersistedProjectContext.currentDirectory(),
        })
        if (session.projectID !== PersistedProjectContext.currentProject().id) {
          throw new NotFoundError({ message: `Mission not found: ${missionID}` })
        }
        const cancellationOrigin = await closeMissionExecution(
          session,
          "mission.delete",
          resolveRequestID(c),
          c.req.valid("json"),
        )
        await EngineService.deleteSession(session.id, {
          projectID: session.projectID,
          cancellationOrigin,
        })
        return c.json(true)
      },
    )
    .post(
      "/:missionID/dispatch",
      describeRoute({
        summary: "Dispatch a Mission draft",
        description:
          "Consume the Mission's pending operator prompt through the canonical visible user-message and streaming Mission wake path.",
        operationId: "mission.dispatch",
        responses: {
          200: {
            description: "Mission dispatch accepted",
            content: { "application/json": { schema: resolver(MissionWakeResult) } },
          },
          ...errors(400, 404),
          409: namedErrorResponse(
            "Mission execution is still completing its durable close operation",
            "MissionExecutionClosingError",
          ),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", MissionParam),
      validator("json", MissionDispatchInput),
      async (c) => {
        const missionID = c.req.valid("param").missionID
        const input = c.req.valid("json")
        const session = await missionRouteSession(missionID)
        const pendingPrompt = missionPendingPrompt(session)
        if (!pendingPrompt) {
          return c.json(badRequestBody(`Mission ${missionID} has no pending operator prompt.`), 400)
        }
        const storedOverlay = Config.Overlay.parse(
          ((session.metadata as Record<string, unknown> | undefined)?.configOverlay as unknown) ?? {},
        )
        const configPatch: z.input<typeof Config.Overlay> = { prompt_profile: null }
        if (input.model) configPatch.model = input.model
        try {
          const preview = Config.previewOverlayUpdate(await Config.get(), storedOverlay, configPatch)
          await validateConfigModelReferences(preview.effective, "mission.configOverlay")
        } catch (error) {
          if (Auth.findReadError(error)) throw error
          const message = error instanceof Error ? error.message : String(error)
          return c.json(badRequestBody(message), 400)
        }
        await resolveAgentModel("mission", {
          sessionID: session.id,
          explicitModel: input.model ? Provider.parseModel(input.model) : undefined,
        })
        await openMissionExecution({
          missionID,
          sessionID: session.id,
          source: "mission.dispatch",
          requestID: resolveRequestID(c),
        })
        await Session.mergeConfigOverlay({
          sessionID: session.id,
          patch: configPatch,
        })
        await SessionWake.wake({
          sessionID: session.id,
          prompt: pendingPrompt.text,
          author: "user",
          agent: "mission",
          surface: "panel",
          userAuthored: true,
          reason: {
            source: "mission.operator",
            missionID,
          },
        })
        await setMissionPendingPrompt({
          session: await Session.get(session.id),
        })
        return c.json(
          MissionWakeResult.parse({
            missionID,
            sessionID: session.id,
            created: false,
            productPillar: session.productPillar,
          }),
        )
      },
    )
    .post(
      "/wake",
      describeRoute({
        summary: "Wake the Mission agent",
        description:
          "Start (or resume) a Mission agent session and inject a user prompt. " +
          "Omit `missionID` to start a new mission; supply it to resume an existing one. " +
          "The route is idempotent for (project, directory, missionID) — exactly one mission " +
          "session is keyed per mission.",
        operationId: "mission.wake",
        responses: {
          200: {
            description: "Mission wake accepted",
            content: { "application/json": { schema: resolver(MissionWakeResult) } },
          },
          400: badRequestOrNamedErrorResponse(
            "Mission wake request or immutable Expert Squad snapshot rejected",
            "MissionExpertSquadSnapshotMismatchError",
          ),
          409: namedErrorResponse(
            "Mission execution is still completing its durable close operation",
            "MissionExecutionClosingError",
          ),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("json", MissionWakeInput),
      async (c) => {
        const input = c.req.valid("json")
        const missionID = input.missionID ?? newMissionID()
        const existingSessionID = findExistingMissionSession({ missionID, directory: Instance.directory })
        const existingSession = existingSessionID ? await Session.get(existingSessionID) : undefined
        const storedOverlay = Config.Overlay.parse(
          ((existingSession?.metadata as Record<string, unknown> | undefined)?.configOverlay as unknown) ?? {},
        )
        const configPatch: z.input<typeof Config.Overlay> = { prompt_profile: null }
        let launchHeldExpertSquadIDs: MissionVisibleExpertSquadIDs | undefined
        if (input.model) configPatch.model = input.model
        try {
          if (existingSession) {
            if (missionProductPillar(existingSession) !== input.productPillar) {
              throw new Error(`Mission ${missionID} already holds a different immutable product pillar.`)
            }
            const heldExpertSquadIDs = missionVisibleExpertSquadIDs(existingSession)
            launchHeldExpertSquadIDs =
              input.expertSquadIDs === undefined
                ? heldExpertSquadIDs
                : await resolveMissionLaunchExpertSquadIDs({
                    projectDirectory: Instance.project.worktree,
                    productPillar: input.productPillar,
                    requestedExpertSquadIDs: input.expertSquadIDs,
                  })
            assertMissionExpertSquadSnapshot(missionID, heldExpertSquadIDs, launchHeldExpertSquadIDs)
          } else {
            launchHeldExpertSquadIDs = await resolveMissionLaunchExpertSquadIDs({
              projectDirectory: Instance.project.worktree,
              productPillar: input.productPillar,
              requestedExpertSquadIDs: input.expertSquadIDs,
            })
          }
        } catch (error) {
          if (error instanceof MissionExpertSquadSnapshotMismatchError) return c.json(error.toObject(), 400)
          if (Auth.findReadError(error)) throw error
          const message = error instanceof Error ? error.message : String(error)
          return c.json(badRequestBody(message), 400)
        }
        try {
          const preview = Config.previewOverlayUpdate(await Config.get(), storedOverlay, configPatch)
          await validateConfigModelReferences(preview.effective, "mission.configOverlay")
        } catch (error) {
          if (Auth.findReadError(error)) throw error
          const message = error instanceof Error ? error.message : String(error)
          return c.json(badRequestBody(message), 400)
        }
        await resolveAgentModel("mission", {
          sessionID: existingSessionID,
          explicitModel: input.model ? Provider.parseModel(input.model) : undefined,
        })
        // Snapshot existence BEFORE ensureMissionSession so the response
        // distinguishes "started" from "resumed". The lookup and the ensure
        // call both use the active request directory, so linked worktrees do
        // not resume each other's Mission session.
        let session
        try {
          session = await ensureMissionSession({
            missionID,
            defaultCwd: Instance.directory,
            productPillar: input.productPillar,
            heldExpertSquadIDs: launchHeldExpertSquadIDs,
          })
        } catch (error) {
          if (error instanceof MissionExpertSquadSnapshotMismatchError) return c.json(error.toObject(), 400)
          throw error
        }
        await openMissionExecution({
          missionID,
          sessionID: session.id,
          source: "mission.wake",
          requestID: resolveRequestID(c),
        })
        await Session.mergeConfigOverlay({
          sessionID: session.id,
          patch: configPatch,
        })
        await SessionWake.wake({
          sessionID: session.id,
          prompt: input.text,
          author: "user",
          agent: "mission",
          surface: "panel",
          userAuthored: true,
          parts: await missionWakeAttachmentParts(input.attachments),
          reason: {
            source: "mission.operator",
            missionID,
          },
        })
        return c.json(
          MissionWakeResult.parse({
            missionID,
            sessionID: session.id,
            created: !existingSessionID,
            productPillar: session.productPillar,
          }),
        )
      },
    )
}
