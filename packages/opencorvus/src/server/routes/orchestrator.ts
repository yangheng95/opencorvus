import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamGlobalSSE } from "../sse"
import { HTTPException } from "hono/http-exception"
import z from "zod"
import {
  conversationMessageHasDisplay,
  conversationTranscriptMessageOrder,
  executionProjectionLifecycleEvents,
  projectConversationAgentView,
  projectConversationView,
} from "@/conversation/view"
import { projectTaskTurnArtifacts } from "@/conversation/turn-artifacts"
import {
  AgentSessionCancelResult,
  AgentSessionOperatorSteerInput,
  AgentSessionOperatorSteerResult,
  Budget,
  CreateTaskInput,
  GlobalTaskBoard,
  GoalMutationResult,
  InjectMessageInput,
  Interaction,
  Progress,
  ProjectBoard,
  UserRejectInteractionInput,
  UserReplyInteractionInput,
  TaskBoard,
  TaskBrief,
  TaskConversationEventPage,
  TaskConversationHistoryPage,
  TaskConversationHydration,
  ConversationTurnArtifactSummary,
  TaskConversationSessionPage,
  TaskMessageInput,
  TaskMessageResult,
  TaskOperatorModelContext,
  TaskAccepted,
  TaskEvent,
  Task,
  TraceEventList,
  UpdateGoalTitleInput,
} from "@/engine/model"
import { ArtifactInlineReadInputSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import { artifactCatalogAuthority, readTaskArtifact } from "@/artifact-catalog"
import { TaskStatusDetail, taskStatusDetailFromBoard } from "@/status/task-status-snapshot"
import { RewindTaskInput, taskRewindCursor } from "@/engine/rewind"
import { requireTask } from "@/engine/store"
import { abortChildExecutionForSession } from "@/engine/execution-abort"
import { TaskQueueError, TaskQueueReorderError } from "@/engine/queue"
import { EngineService, PlannerFailureError, TaskQueueStartError } from "@/task-api"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { ProtocolStore } from "@/protocol/store"
import { ChannelIngress } from "@/channel/ingress"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { TodoStore } from "@/session/todo-store"
import { SessionPrompt } from "@/session/prompt"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { compileBoard } from "@/workbench/board"
import { buildTaskProjectArchive, ProjectArchiveUnsupportedProjectError } from "@/engine/task-project-archive"
import { badRequestOrNamedErrorResponse, errors, namedErrorResponse, operatorSteerRouteErrors } from "../error"
import { requestID as resolveRequestID } from "../error-handler"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { lazy } from "../../util/lazy"
import { Log } from "@/util/log"
import {
  listTaskConversationAgentSessions,
  taskMessageWatermark,
  taskMessageWatermarkCursor,
} from "@/orchestrator/task-event"
import {
  sessionBelongsToTask,
  sessionParentID,
  sessionRole,
  taskIDForSession,
  taskSession,
} from "@/engine/task-session-lineage"
import {
  ensureTaskMessageProtocolBridge,
  overlayMeta,
  projectPersistedTaskMessage,
} from "@/orchestrator/protocol/message-bridge"
import { BusEvent } from "@/bus/bus-event"
import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import {
  compareTimelineOrderKeys,
  requireTimelineOrderKeyDomain,
  timelineMessageOrderKey,
  timelineOrderKey,
} from "@/timeline/order"
import { TaskArchiveRequestBody, TaskCancellationRequestBody } from "@opencorvus-ai/transport-protocol"
import { TaskCancellationProjection } from "@/engine/cancellation-origin"
import {
  BUILD_OBSERVATION_CONTENT_CHUNK_BYTES,
  BuildObservationContentError,
  readBuildObservationContentRange,
} from "@/engine/build-observation-content"
const log = Log.create({ service: "server.routes.orchestrator" })
const CONVERSATION_EVENT_PAGE_LIMIT = 500
const TASK_MESSAGE_CHANGE_POLL_MS = 2_000
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function requireRouteTaskInCurrentProject(taskID: string) {
  const task = requireTask(taskID)
  const current = Instance.current()
  if (task.project_id !== "global" && (!current || task.project_id === current.project.id)) return task
  throw new HTTPException(404, { message: `Task not found: ${taskID}` })
}

function taskConversationBoard(taskID: string) {
  requireTask(taskID)
  return compileBoard({ taskID })
}

const TASK_LIST_PROJECTION_EVENT_TYPES = new Set([
  "task.created",
  "task.updated",
  "task.started",
  "task.completed",
  "task.failed",
  "task.cancelled",
  "task.blocked",
  "task.requeued",
  "task.rewound",
  "task.deleted",
  "task.archived",
])
const TASK_LIST_PROJECTION_EVENT_PREFIXES = ["goal.", "interaction."] as const

export function isTaskListProjectionEventType(type: string) {
  const normalized = type.replace(/^engine\./, "")
  return (
    TASK_LIST_PROJECTION_EVENT_TYPES.has(normalized) ||
    TASK_LIST_PROJECTION_EVENT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  )
}

const TaskListQuery = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

const ProjectArchiveUnsupportedProjectResponse = z.object({
  message: z.string(),
})

const ConversationEventPageQuery = z.object({
  after: z.coerce.number().int().nonnegative().default(0),
  until: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(CONVERSATION_EVENT_PAGE_LIMIT),
  since: z.coerce.number().positive().optional(),
})

const CONVERSATION_TAIL_MESSAGE_LIMIT = 80
const CONVERSATION_HISTORY_PAGE_LIMIT = 160

const ConversationHydrationQuery = z.object({
  tail_limit: z.coerce.number().int().min(1).max(2000).optional(),
})

const ConversationHistoryQuery = z.object({
  before: z.coerce.number().positive(),
  before_order_key: z.string().min(1),
  before_id: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(CONVERSATION_HISTORY_PAGE_LIMIT),
})

const ReorderTaskQueueInput = z.object({
  directory: z.string().min(1),
  orderedTaskIDs: z.array(z.string()).default([]),
  revision: z.string().optional(),
})

const ReorderTaskQueueResult = z.object({
  directory: z.string(),
  revision: z.string(),
  queuedTaskIDs: z.array(z.string()),
})

const StartQueuedTaskNowResult = z.object({
  task: Task,
  directory: z.string(),
  status: z.string(),
  started: z.boolean(),
  queuedTaskIDs: z.array(z.string()),
})

const TaskBindingList = z.array(
  z.object({
    id: z.string(),
    task_id: z.string(),
    platform: z.string(),
    channel: z.string(),
    thread: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
    time_created: z.number().optional(),
    time_updated: z.number().optional(),
  }),
)

export const EngineRoutes = lazy(() =>
  new Hono()
    .use(async (c, next) => {
      if (c.req.path !== "/global/tasks" && Instance.current()) {
        ensureTaskMessageProtocolBridge()
      }
      return next()
    })
    .post(
      "/task",
      describeRoute({
        summary: "Create task",
        operationId: "task.create",
        responses: {
          202: {
            description: "Task accepted",
            content: {
              "application/json": {
                schema: resolver(TaskAccepted),
              },
            },
          },
          400: badRequestOrNamedErrorResponse(
            "Task creation rejected",
            "ExternalChildTaskLineageError",
            "TaskCreatorAuthorityError",
            "TaskCreatorSessionError",
          ),
          ...errors(404),
          409: namedErrorResponse(
            "Task package revision conflict",
            "TaskExpectedPackageDigestConflictError",
            "TaskCreationIdempotencyConflictError",
            "TaskPackageRevisionBindingError",
          ),
        },
      }),
      validator("json", CreateTaskInput),
      async (c) => {
        const input = c.req.valid("json")
        const requestID = c.req.header("x-opencorvus-request-id") ?? undefined
        const taskID = await EngineService.createTask(
          {
            ...input,
            requestID: input.requestID ?? requestID,
          },
          { actor: "user" },
        ).catch((error) => {
          if (error instanceof PlannerFailureError) {
            throw new HTTPException(503, {
              message: error.message,
            })
          }
          throw error
        })
        return c.json(
          {
            task_id: taskID,
            project_id: Instance.project.id,
            directory: Instance.directory,
          },
          202,
        )
      },
    )
    .get(
      "/tasks",
      describeRoute({
        summary: "List project tasks",
        operationId: "task.list",
        responses: {
          200: {
            description: "Project task board",
            content: {
              "application/json": {
                schema: resolver(ProjectBoard),
              },
            },
          },
        },
      }),
      validator("query", TaskListQuery),
      async (c) => {
        const { q: query, status, limit } = c.req.valid("query")
        return c.json(await EngineService.getProjectBoard({ query, status, limit }))
      },
    )
    .post(
      "/global/tasks",
      describeRoute({
        summary: "Create a task in an implicit project",
        description:
          "Create a concrete Git project under the user-scoped OpenCorvus data directory, then create the task in that project.",
        operationId: "task.global.create",
        responses: {
          202: {
            description: "Global task accepted with concrete project ownership",
            content: {
              "application/json": {
                schema: resolver(TaskAccepted),
              },
            },
          },
          400: badRequestOrNamedErrorResponse(
            "Global task creation rejected",
            "ExternalChildTaskLineageError",
            "TaskCreatorAuthorityError",
            "TaskCreatorSessionError",
          ),
          ...errors(404),
          409: namedErrorResponse(
            "Global Task package revision conflict",
            "TaskExpectedPackageDigestConflictError",
            "TaskCreationIdempotencyConflictError",
            "TaskPackageRevisionBindingError",
          ),
        },
      }),
      validator("json", CreateTaskInput),
      async (c) => c.json(await GlobalTaskService.create(c.req.valid("json")), 202),
    )
    .get(
      "/global/tasks",
      describeRoute({
        summary: "List tasks across projects",
        operationId: "task.global.list",
        responses: {
          200: {
            description: "Global task board",
            content: {
              "application/json": {
                schema: resolver(GlobalTaskBoard),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z
          .object({
            directory: z.string().optional(),
            q: z.string().optional(),
            status: z.string().optional(),
            limit: z.coerce.number().optional(),
            cursor: z.coerce.number().optional(),
            cursorTaskID: z.string().optional(),
          })
          .refine((query) => (query.cursor === undefined) === (query.cursorTaskID === undefined), {
            message: "cursor and cursorTaskID must be provided together",
            path: ["cursor"],
          }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(
          await EngineService.getGlobalTaskBoard({
            directory: query.directory,
            query: query.q,
            status: query.status,
            limit: query.limit,
            cursor: query.cursor,
            cursorTaskID: query.cursorTaskID,
          }),
        )
      },
    )
    .patch(
      "/task-queue/reorder",
      describeRoute({
        summary: "Reorder queued tasks in a directory",
        operationId: "task.queue.reorder",
        responses: {
          200: {
            description: "Updated directory queue order",
            content: {
              "application/json": {
                schema: resolver(ReorderTaskQueueResult),
              },
            },
          },
          409: { description: "Queue revision conflict" },
          422: { description: "Invalid queued task ordering" },
        },
      }),
      validator("json", ReorderTaskQueueInput),
      async (c) => {
        try {
          return c.json(await EngineService.reorderTaskQueue(c.req.valid("json")))
        } catch (error) {
          if (error instanceof TaskQueueReorderError) {
            throw new HTTPException(error.code === "conflict" ? 409 : 422, { message: error.message })
          }
          throw error
        }
      },
    )
    .post(
      "/task/:taskID/start-now",
      describeRoute({
        summary: "Start a queued task immediately",
        operationId: "task.queue.startNow",
        responses: {
          200: {
            description: "Queued task started and scheduler invoked",
            content: {
              "application/json": {
                schema: resolver(StartQueuedTaskNowResult),
              },
            },
          },
          409: { description: "Task is not queued" },
          422: { description: "Task has no working directory" },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        try {
          return c.json(await EngineService.startQueuedTaskNow(c.req.valid("param").taskID))
        } catch (error) {
          if (error instanceof TaskQueueStartError) {
            throw new HTTPException(409, { message: error.message })
          }
          if (error instanceof TaskQueueError) {
            throw new HTTPException(422, { message: error.message })
          }
          throw error
        }
      },
    )
    .get(
      "/task/:taskID",
      describeRoute({
        summary: "Get task",
        operationId: "task.get",
        responses: {
          200: {
            description: "Task",
            content: {
              "application/json": {
                schema: resolver(Task),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.getTask(c.req.valid("param").taskID))
      },
    )
    .get(
      "/task/:taskID/status",
      describeRoute({
        summary: "Get task status",
        description:
          "Collect current Task activity from the Task Board projection, including diagnostic lifecycle, Requirement acceptance, and per-Slice fact facets. " +
          'The Task `status` field is normalized to "running" or "inactive"; each Goal detail independently exposes exact activity associations, review associations, and Completion Decision acceptance. Raw queued, active, completed, failed, and cancelled lifecycle facts remain available only as lifecycleStatus.',
        operationId: "task.status",
        responses: {
          200: {
            description: "Task status snapshot",
            content: {
              "application/json": {
                schema: resolver(TaskStatusDetail),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const board = await EngineService.getBoard(c.req.valid("param").taskID, { sync: false })
        return c.json(taskStatusDetailFromBoard(board))
      },
    )
    .get(
      "/task/:taskID/project-archive",
      describeRoute({
        summary: "Download task project archive",
        description:
          "Return a ZIP containing the task project's Git-included files plus the task execution flow exported from OpenCorvus task projections.",
        operationId: "task.projectArchive",
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
            description: "Task project is not a Git worktree",
            content: {
              "application/json": {
                schema: resolver(ProjectArchiveUnsupportedProjectResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        requireRouteTaskInCurrentProject(taskID)
        try {
          const archive = await buildTaskProjectArchive({
            taskID,
            transcript: await loadFullTaskTranscript(taskID),
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
    .get(
      "/task/:taskID/bindings",
      describeRoute({
        summary: "List channel bindings for a task",
        description:
          "Return every (platform, channel, thread) binding that points at this task. " +
          "Used by the Mission page to surface inbound channel provenance for a selected task.",
        operationId: "task.bindings",
        responses: {
          200: {
            description: "Channel bindings for the task",
            content: {
              "application/json": {
                schema: resolver(TaskBindingList),
              },
            },
          },
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        await EngineService.getTask(taskID)
        const rows = ChannelIngress.bindingsByTaskID(taskID)
        return c.json(
          rows.map((row) => ({
            id: String(row.id),
            task_id: String(row.task_id),
            platform: String(row.platform),
            channel: String(row.channel),
            thread: String(row.thread),
            payload: (row.payload ?? {}) as Record<string, unknown>,
            time_created: typeof row.time_created === "number" ? row.time_created : undefined,
            time_updated: typeof row.time_updated === "number" ? row.time_updated : undefined,
          })),
        )
      },
    )
    .get(
      "/task/:taskID/progress",
      describeRoute({
        summary: "Get task progress",
        operationId: "task.progress",
        responses: {
          200: {
            description: "Task progress",
            content: {
              "application/json": {
                schema: resolver(Progress),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.getProgress(c.req.valid("param").taskID))
      },
    )
    .get(
      "/task/:taskID/events",
      describeRoute({
        summary: "Subscribe to task events",
        operationId: "task.events",
        responses: {
          200: {
            description: "Task event stream",
            content: {
              "text/event-stream": {
                schema: resolver(TaskEvent),
              },
            },
          },
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.current()?.project.id })
        const after = Math.max(0, parseInt(c.req.query("after") ?? "0", 10) || 0)
        const afterLiveRaw = c.req.query("after_live")
        const shouldReplayLive = afterLiveRaw !== undefined
        const afterLive = shouldReplayLive ? Math.max(0, parseInt(afterLiveRaw ?? "0", 10) || 0) : 0
        const afterLiveEpochRaw = c.req.query("after_live_epoch")
        const afterLiveEpoch =
          afterLiveEpochRaw === undefined ? undefined : Math.max(0, parseInt(afterLiveEpochRaw, 10) || 0)
        const afterMessageWatermark = Math.max(0, parseInt(c.req.query("after_message_watermark") ?? "0", 10) || 0)
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream, bind) => {
          const sessionID = taskSession(taskID)
          // No registry to reseed: session role and Task ownership read
          // directly from session.kind and the Session parent chain in the
          // database, so reconnecting observes the durable execution lineage.
          let cursor = after
          let liveCursor = afterLive
          let messageWatermark = afterMessageWatermark
          let ready = false
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let messageChangePoll: ReturnType<typeof setInterval> | undefined
          let stop = () => {}
          let finishStream = () => {}
          let closed = false
          const cleanup = (input?: { closeStream?: boolean; error?: unknown }) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            if (messageChangePoll) clearInterval(messageChangePoll)
            stop()
            if (input?.error) {
              log.warn("task event stream write failed", {
                taskID,
                sessionID,
                error: errorMessage(input.error),
              })
            }
            if (input?.closeStream) stream.close()
            finishStream()
          }
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          const buffered: Array<{ sequence: number; liveSequence: number; data: string }> = []
          let writes = Promise.resolve()
          const writeData = (data: string) => {
            writes = writes
              .then(() => {
                if (closed) return
                return stream.writeSSE({ data })
              })
              .catch((error) => {
                cleanup({ closeStream: true, error })
              })
            return writes
          }
          let messageWatermarkSignature = ""
          const rememberMessageCursor = (cursor: ReturnType<typeof taskMessageWatermarkCursor>) => {
            if (cursor.watermark < messageWatermark) return
            messageWatermark = cursor.watermark
            messageWatermarkSignature = cursor.signature
          }
          const messageCursorChanged = (cursor: ReturnType<typeof taskMessageWatermarkCursor>) =>
            cursor.watermark > messageWatermark ||
            (cursor.watermark > 0 &&
              cursor.watermark === messageWatermark &&
              cursor.signature !== messageWatermarkSignature)
          const emitMessageChange = async (cursor: ReturnType<typeof taskMessageWatermarkCursor>) => {
            rememberMessageCursor(cursor)
            const data = JSON.stringify(
              taskEvent(taskID, {
                type: "task.messages.changed",
                properties: {
                  taskID,
                  watermark: cursor.watermark,
                  summary: "Task message append/update tables changed",
                },
              }),
            )
            await writeData(data)
          }
          const emitCurrentMessageChange = async () => {
            if (closed) return
            const nextCursor = taskMessageWatermarkCursor(taskID)
            if (!messageCursorChanged(nextCursor)) return
            await emitMessageChange(nextCursor)
          }
          const markLiveMessageSeen = (event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]) => {
            if (!isMessageTaskEvent(event.type)) return
            rememberMessageCursor(taskMessageWatermarkCursor(taskID))
          }
          const enqueueProtocolEvent = bind((event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]) => {
            if (!event.taskID || event.taskID !== taskID) return
            const isEphemeral = event.sequence === 0
            // Ephemeral events (sequence=0) always pass through — they're not sequenced
            // and not replayed on reconnect. Sequenced events are deduplicated by cursor.
            if (!isEphemeral && event.sequence <= cursor) return
            if (isEphemeral && (event.liveSequence ?? 0) <= liveCursor) return
            const data = JSON.stringify(protocolTaskEvent(event))
            markLiveMessageSeen(event)
            if (!ready) {
              buffered.push({ sequence: event.sequence, liveSequence: event.liveSequence ?? 0, data })
              return
            }
            if (!isEphemeral) cursor = Math.max(cursor, event.sequence)
            else liveCursor = Math.max(liveCursor, event.liveSequence ?? 0)
            void writeData(data)
          })
          stop = ProtocolStore.subscribeEvents(enqueueProtocolEvent, {
            aggregate: "task",
            taskID,
          })
          const replayed = ProtocolStore.listTaskEventsAfter(taskID, after)
          for (const event of replayed) {
            const data = JSON.stringify(protocolTaskEvent(event))
            cursor = Math.max(cursor, event.sequence)
            await writeData(data)
          }
          if (shouldReplayLive) {
            const liveReplay = ProtocolStore.listTaskLiveEventsAfter(taskID, afterLive, {
              liveEpoch: afterLiveEpoch,
            })
            if (liveReplay.expired) {
              await writeData(JSON.stringify(protocolTaskEvent(liveReplay.event)))
              cleanup()
              return
            }
            for (const event of liveReplay.events) {
              liveCursor = Math.max(liveCursor, event.liveSequence ?? 0)
              markLiveMessageSeen(event)
              await writeData(JSON.stringify(protocolTaskEvent(event)))
            }
          }
          if (closed) {
            await writes
            return
          }
          ready = true
          buffered.forEach((item) => {
            if (item.sequence > 0) {
              if (item.sequence <= cursor) return
              cursor = Math.max(cursor, item.sequence)
            } else {
              if (item.liveSequence <= liveCursor) return
              liveCursor = Math.max(liveCursor, item.liveSequence)
            }
            void writeData(item.data)
          })
          const connData = JSON.stringify(
            taskEvent(taskID, {
              type: "task.connected",
              properties: {
                taskID,
                summary: "Task event stream connected",
              },
            }),
          )
          await writeData(connData)
          if (closed) {
            await writes
            return
          }
          const initialMessageCursor = taskMessageWatermarkCursor(taskID)
          if (messageCursorChanged(initialMessageCursor)) {
            await emitMessageChange(initialMessageCursor)
          } else {
            rememberMessageCursor(initialMessageCursor)
          }
          if (closed) {
            await writes
            return
          }
          heartbeat = setInterval(
            bind(() => {
              const data = JSON.stringify(
                taskEvent(taskID, {
                  type: "task.heartbeat",
                  properties: {
                    taskID,
                    summary: "Task event stream heartbeat",
                  },
                }),
              )
              void writeData(data)
            }),
            10_000,
          )
          messageChangePoll = setInterval(
            bind(() => {
              const nextCursor = taskMessageWatermarkCursor(taskID)
              if (!messageCursorChanged(nextCursor)) return
              void emitMessageChange(nextCursor)
            }),
            TASK_MESSAGE_CHANGE_POLL_MS,
          )
          stream.onAbort(() => {
            cleanup()
          })
          await finished
          await writes
        })
      },
    )
    .get(
      "/task/:taskID/build-observation/:artifactID/content",
      describeRoute({
        summary: "Read an exact Build observation content range",
        description:
          "Read one bounded byte range from the before or after Git blob selected by a Task-owned Build Host observation.",
        operationId: "task.buildObservationContent",
        responses: {
          200: {
            description: "Exact Git blob byte range",
            content: {
              "application/octet-stream": {
                schema: resolver(z.string()),
              },
            },
          },
          ...errors(400, 404, 422),
        },
      }),
      validator(
        "param",
        z.object({
          taskID: Task.shape.id,
          artifactID: Identifier.schema("artifact"),
        }),
      ),
      validator(
        "query",
        z.object({
          file: z.string().min(1),
          side: z.enum(["before", "after"]),
          offset: z.coerce.number().int().nonnegative().default(0),
          length: z.coerce.number().int().positive().max(BUILD_OBSERVATION_CONTENT_CHUNK_BYTES),
        }),
      ),
      async (c) => {
        const { taskID, artifactID } = c.req.valid("param")
        requireRouteTaskInCurrentProject(taskID)
        try {
          const content = await readBuildObservationContentRange({
            taskID,
            artifactID,
            ...c.req.valid("query"),
            signal: c.req.raw.signal,
          })
          const endInclusive = content.endExclusive === content.offset ? content.offset : content.endExclusive - 1
          return new Response(content.bytes, {
            status: 200,
            headers: {
              "content-type": "application/octet-stream",
              "content-length": String(content.bytes.byteLength),
              "accept-ranges": "bytes",
              "content-range": `bytes ${content.offset}-${endInclusive}/${content.objectBytes}`,
              "x-opencorvus-git-object": content.objectID,
              "x-opencorvus-object-bytes": String(content.objectBytes),
              "x-opencorvus-content-complete": content.complete ? "1" : "0",
              "x-opencorvus-content-binary": content.isBinary ? "1" : "0",
            },
          })
        } catch (error) {
          if (error instanceof BuildObservationContentError) {
            const status =
              error.code === "artifact_not_found" || error.code === "file_not_found"
                ? 404
                : error.code === "invalid_range"
                  ? 400
                  : 422
            throw new HTTPException(status, { message: error.message })
          }
          throw error
        }
      },
    )
    .get(
      "/task/:taskID/turn-artifacts",
      describeRoute({
        summary: "Project terminal artifacts onto the owning Task turn",
        operationId: "task.turnArtifacts",
        responses: {
          200: {
            description: "Terminal artifact summaries keyed by assistant message",
            content: {
              "application/json": {
                schema: resolver(ConversationTurnArtifactSummary.array()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        requireRouteTaskInCurrentProject(taskID)
        const board = taskConversationBoard(taskID)
        if (board.task.status !== "completed" && board.task.status !== "failed" && board.task.status !== "cancelled") {
          return c.json([])
        }
        const transcript = await loadFullTaskTranscript(taskID, { scope: "task" })
        const view = projectConversationView(transcript, [], listTaskConversationAgentSessions(taskID))
        return c.json(await projectTaskTurnArtifacts({ taskID, transcript, view }))
      },
    )
    .post(
      "/task/:taskID/artifact-read",
      describeRoute({
        summary: "Read one exact Task deliverable Artifact chunk",
        operationId: "task.readConversationArtifact",
        responses: {
          200: {
            description:
              "Exact immutable Artifact bytes. Content-Range, Content-Type, Content-Disposition, and ETag carry the verified chunk metadata.",
            content: {
              "application/octet-stream": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          ...errors(400, 404, 500),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", ArtifactInlineReadInputSchema),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        requireRouteTaskInCurrentProject(taskID)
        const read = await readTaskArtifact({
          authority: artifactCatalogAuthority(taskID),
          read: c.req.valid("json"),
        })
        const bytes = Uint8Array.from(read.attachment?.bytes ?? Buffer.from(read.chunk.text ?? "", "utf8"))
        const expectedBytes = read.chunk.byte_end - read.chunk.byte_start
        if (bytes.byteLength !== expectedBytes) {
          throw new Error(
            `Conversation Artifact byte response expected ${expectedBytes} bytes, received ${bytes.byteLength}`,
          )
        }
        const contentRange =
          read.chunk.total_bytes === 0
            ? "bytes */0"
            : `bytes ${read.chunk.byte_start}-${read.chunk.byte_end - 1}/${read.chunk.total_bytes}`
        const disposition = read.attachment
          ? `attachment; filename*=UTF-8''${encodeURIComponent(read.attachment.filename)}`
          : "inline"
        return c.body(bytes, 200, {
          "Content-Disposition": disposition,
          "Content-Range": contentRange,
          "Content-Type": read.chunk.media_type,
          ETag: `"sha256:${read.chunk.sha256}"`,
        })
      },
    )
    .get(
      "/task/:taskID/conversation",
      describeRoute({
        summary: "Hydrate task conversation state",
        description:
          "Load the current task board plus the persisted conversation inputs " +
          "needed to rebuild the overlay conversation tree before SSE resumes.",
        operationId: "task.conversation",
        responses: {
          200: {
            description: "Task conversation hydrate payload",
            content: {
              "application/json": {
                schema: resolver(TaskConversationHydration),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("query", ConversationHydrationQuery),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        const query = c.req.valid("query")
        requireTask(taskID)
        const rewindCursor = taskRewindCursor(taskID)
        const tailLimit = query.tail_limit ?? CONVERSATION_TAIL_MESSAGE_LIMIT
        const transcriptLimit = Math.max(tailLimit, CONVERSATION_TAIL_MESSAGE_LIMIT)
        const taskSessions = taskSessionIDs(taskID, { scope: "task" })
        const agentSessions = listTaskConversationAgentSessions(taskID)
        const primarySessionIDs = agentSessions
          .filter((session) => session.stage === "root" || session.stage === "orchestrator")
          .map((session) => session.sessionID)
        const board = taskConversationBoard(taskID)
        const occurrenceSessionIDs = new Set(
          board.executionProjection.occurrences.map((occurrence) => occurrence.sessionID),
        )
        const [globalTranscriptResult, primaryTranscriptResult, agentActivityByExecution, todoSnapshotsBySession] =
          await Promise.all([
            loadTaskTranscript(taskID, {
              perSessionLimit: transcriptLimit,
              scope: "task",
              taskSessions,
            }),
            loadTaskProtectedTranscript(taskID, primarySessionIDs, {
              limit: transcriptLimit,
              scope: "task",
              taskSessions,
            }),
            MessageStore.latestConversationAgentActivityByExecution({
              executions: [
                ...board.executionProjection.occurrences.map((occurrence) => ({
                  sessionID: occurrence.sessionID,
                  inputMessageID: occurrence.inputMessageID,
                })),
                ...agentSessions
                  .filter((session) => !occurrenceSessionIDs.has(session.sessionID))
                  .map((session) => ({ sessionID: session.sessionID })),
              ],
              beforeOrAt: rewindCursor,
            }),
            Promise.resolve(TodoStore.getBySessionIDs(agentSessions.map((session) => session.sessionID))),
          ])
        const transcript = [...globalTranscriptResult.transcript, ...primaryTranscriptResult.transcript]
          .filter(
            (message, index, all) =>
              all.findIndex((candidate) => conversationItemID(candidate) === conversationItemID(message)) === index,
          )
          .sort(compareConversationItems)
        const filterByCursor = <T extends { info?: { time?: { created?: number } }; timestamp?: number }>(
          items: T[],
        ) => {
          if (rewindCursor == null) return items
          return items.filter((item) => {
            const created =
              typeof item?.timestamp === "number"
                ? item.timestamp
                : typeof item?.info?.time?.created === "number"
                  ? item.info.time.created
                  : undefined
            return created == null || created <= rewindCursor
          })
        }
        const filteredTranscript = filterByCursor(transcript)
        const messageWatermark = taskMessageWatermark(taskID)
        const globalHistoryWindow = __conversationHistoryWindowForTest(filteredTranscript, {
          tailLimit,
        })
        const primarySessionIDSet = new Set(primarySessionIDs)
        const primaryHistoryWindow = __conversationHistoryWindowForTest(
          filteredTranscript.filter((message) => primarySessionIDSet.has(conversationItemSessionID(message))),
          { tailLimit },
        )
        const visibleMessageIDs = new Set([
          ...globalHistoryWindow.transcript.map(conversationItemID),
          ...primaryHistoryWindow.transcript.map(conversationItemID),
        ])
        const historyWindow = {
          transcript: filteredTranscript.filter((message) => visibleMessageIDs.has(conversationItemID(message))),
          history: conversationHistoryState(
            filteredTranscript,
            filteredTranscript.filter((message) => visibleMessageIDs.has(conversationItemID(message))),
            tailLimit,
          ),
        }
        const history = {
          ...historyWindow.history,
          hasMore:
            historyWindow.history.hasMore ||
            ((globalTranscriptResult.truncated || primaryTranscriptResult.truncated) &&
              historyWindow.history.oldestTimestamp != null),
        }
        const latestSequence = Number(board.lastSequence)
        if (!Number.isInteger(latestSequence) || latestSequence < 0) {
          throw new Error(`conversation hydrate board.lastSequence invalid: ${JSON.stringify(board.lastSequence)}`)
        }
        const eventPage = conversationEventPage(taskID, {
          after: 0,
          until: latestSequence,
          limit: CONVERSATION_EVENT_PAGE_LIMIT,
          rewindCursor,
          sinceTimestamp: history.hasMore ? history.oldestTimestamp : null,
        })
        const view = projectConversationView(historyWindow.transcript, eventPage.events, agentSessions)
        const turnArtifacts =
          board.task.status === "completed" || board.task.status === "failed" || board.task.status === "cancelled"
            ? await projectTaskTurnArtifacts({
                taskID,
                transcript: historyWindow.transcript,
                view,
              })
            : []
        const agentView = projectConversationAgentView(
          globalTranscriptResult.transcript,
          executionProjectionLifecycleEvents(board.executionProjection),
          agentSessions,
          agentActivityByExecution,
          todoSnapshotsBySession,
          board.executionProjection.occurrences,
        )
        return c.json({
          lastSequence: latestSequence,
          messageWatermark,
          board,
          transcript: historyWindow.transcript,
          events: eventPage.events,
          eventReplay: eventPage.eventReplay,
          history,
          agentView,
          view,
          turnArtifacts,
        })
      },
    )
    .get(
      "/task/:taskID/conversation/session/:sessionID",
      describeRoute({
        summary: "Get one task conversation session transcript",
        description:
          "Return the persisted transcript for one task child session so the overlay can hydrate old build-agent output directly instead of paging through the whole task history.",
        operationId: "task.conversation.session",
        responses: {
          200: {
            description: "Task conversation session transcript",
            content: {
              "application/json": {
                schema: resolver(TaskConversationSessionPage),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id, sessionID: z.string().min(1) })),
      async (c) => {
        const { taskID, sessionID } = c.req.valid("param")
        requireTask(taskID)
        const rewindCursor = taskRewindCursor(taskID)
        const afterLiveSequenceRaw = c.req.query("after_live_sequence")
        const afterLiveSequence = Math.max(0, Number.parseInt(afterLiveSequenceRaw ?? "0", 10) || 0)
        const afterLiveEpochRaw = c.req.query("after_live_epoch")
        const afterLiveEpoch = Math.max(0, Number.parseInt(afterLiveEpochRaw ?? "0", 10) || 0)
        const liveEpoch = ProtocolStore.currentTaskLiveEpoch()
        const lastLiveSequence = ProtocolStore.currentTaskLiveSequence(taskID)
        if (afterLiveSequenceRaw !== undefined) {
          const replay =
            afterLiveEpochRaw === undefined || afterLiveSequence > lastLiveSequence
              ? { expired: true as const }
              : ProtocolStore.listTaskLiveEventsAfter(taskID, afterLiveSequence, { liveEpoch: afterLiveEpoch })
          if (replay.expired) {
            const transcript = await loadTaskSessionTranscript(taskID, sessionID, { scope: "task" })
            const sessionTranscript = transcript.filter((item) => {
              if (rewindCursor == null) return true
              const created = typeof item?.info?.time?.created === "number" ? item.info.time.created : undefined
              return created == null || created <= rewindCursor
            })
            const sessionEvents = conversationSessionEvents(taskID, sessionID, { rewindCursor })
            return c.json({
              transcript: sessionTranscript,
              removedMessageIDs: [],
              lastLiveSequence,
              liveEpoch,
              transcriptMode: "snapshot",
              events: sessionEvents,
              view: projectConversationView(
                sessionTranscript,
                sessionEvents,
                listTaskConversationAgentSessions(taskID),
              ),
              history: {
                oldestTimestamp: sessionTranscript[0] ? conversationItemTimestamp(sessionTranscript[0]) : null,
                oldestOrderKey: sessionTranscript[0]?.info?.orderKey ?? null,
                oldestMessageID: sessionTranscript[0] ? conversationItemID(sessionTranscript[0]) || null : null,
                hasMore: false,
                limit: Math.max(1, sessionTranscript.length),
              },
            })
          }
          const changedMessageIDs = new Set<string>()
          for (const event of replay.events) {
            const payload = event.payload && typeof event.payload === "object" ? event.payload : {}
            const movedFromRequestedSession =
              event.type === Message.Event.Moved.type &&
              "sourceSessionID" in payload &&
              payload.sourceSessionID === sessionID
            if (
              (event.sessionID !== sessionID && !movedFromRequestedSession) ||
              !isPersistedMessageTaskEvent(event.type)
            ) {
              continue
            }
            const info =
              payload.info && typeof payload.info === "object" ? (payload.info as Record<string, unknown>) : {}
            const part =
              payload.part && typeof payload.part === "object" ? (payload.part as Record<string, unknown>) : {}
            const messageID = String(payload.messageID || info.id || part.messageID || "")
            if (messageID) changedMessageIDs.add(messageID)
          }
          const changed = await MessageStore.byIDs({
            sessionID,
            messageIDs: [...changedMessageIDs],
          })
          const rootSessionID = taskSession(taskID)
          if (!rootSessionID) throw new Error(`task conversation ${taskID} missing root session`)
          annotateTaskTranscriptMessages(changed, rootSessionID)
          const transcript = changed
            .map((message) => projectPersistedTaskMessage(message, taskID))
            .filter(conversationMessageHasDisplay)
          return c.json({
            transcript,
            removedMessageIDs: [...changedMessageIDs],
            lastLiveSequence,
            liveEpoch,
            transcriptMode: "delta",
            events: [],
            view: projectConversationView(transcript, [], listTaskConversationAgentSessions(taskID)),
            history: {
              oldestTimestamp: null,
              oldestOrderKey: null,
              oldestMessageID: null,
              hasMore: false,
              limit: Math.max(1, transcript.length),
            },
          })
        }
        const transcript = await loadTaskSessionTranscript(taskID, sessionID, { scope: "task" })
        const sessionTranscript = transcript.filter((item) => {
          if (rewindCursor == null) return true
          const created = typeof item?.info?.time?.created === "number" ? item.info.time.created : undefined
          return created == null || created <= rewindCursor
        })
        const sessionEvents = conversationSessionEvents(taskID, sessionID, { rewindCursor })
        const agentSessions = listTaskConversationAgentSessions(taskID)
        const oldestTimestamp = sessionTranscript.length > 0 ? conversationItemTimestamp(sessionTranscript[0]) : null
        return c.json({
          transcript: sessionTranscript,
          removedMessageIDs: [],
          lastLiveSequence,
          liveEpoch,
          transcriptMode: "snapshot",
          events: sessionEvents,
          view: projectConversationView(sessionTranscript, sessionEvents, agentSessions),
          history: {
            oldestTimestamp: oldestTimestamp ?? sessionEvents[0]?.timestamp ?? null,
            oldestOrderKey: sessionTranscript[0]?.info?.orderKey ?? sessionEvents[0]?.orderKey ?? null,
            oldestMessageID: sessionTranscript[0] ? conversationItemID(sessionTranscript[0]) || null : null,
            hasMore: false,
            limit: Math.max(1, sessionTranscript.length),
          },
        })
      },
    )
    .get(
      "/task/:taskID/conversation/history",
      describeRoute({
        summary: "Page older task conversation transcript",
        description:
          "Return a bounded transcript/timeline slice older than a timestamp so the overlay can prepend history without blocking the live tail.",
        operationId: "task.conversation.history",
        responses: {
          200: {
            description: "Task conversation history page",
            content: {
              "application/json": {
                schema: resolver(TaskConversationHistoryPage),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("query", ConversationHistoryQuery),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        const query = c.req.valid("query")
        const task = requireTask(taskID)
        const rewindCursor = taskRewindCursor(taskID)
        const transcript = await loadFullTaskTranscript(taskID, { scope: "task" })
        const filterByCursor = <T extends { info?: { time?: { created?: number } }; timestamp?: number }>(
          items: T[],
        ) => {
          if (rewindCursor == null) return items
          return items.filter((item) => {
            const created =
              typeof item?.timestamp === "number"
                ? item.timestamp
                : typeof item?.info?.time?.created === "number"
                  ? item.info.time.created
                  : undefined
            return created == null || created <= rewindCursor
          })
        }
        const page = __conversationHistoryBeforeForTest(filterByCursor(transcript), {
          before: query.before,
          beforeOrderKey: query.before_order_key,
          beforeID: query.before_id,
          limit: query.limit,
        })
        const pageEvents = conversationHistoryEvents(taskID, {
          beforeOrderKey: query.before_order_key,
          oldestOrderKey: page.history.oldestOrderKey,
          rewindCursor,
        })
        const agentSessions = listTaskConversationAgentSessions(taskID)
        return c.json({
          transcript: page.transcript,
          events: pageEvents,
          view: projectConversationView(page.transcript, pageEvents, agentSessions),
          history: page.history,
        })
      },
    )
    .get(
      "/task/:taskID/conversation/events",
      describeRoute({
        summary: "Page task conversation replay events",
        description:
          "Return a bounded protocol_event slice for rebuilding task conversation history after the initial hydrate.",
        operationId: "task.conversation.events",
        responses: {
          200: {
            description: "Task conversation event page",
            content: {
              "application/json": {
                schema: resolver(TaskConversationEventPage),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("query", ConversationEventPageQuery),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        const query = c.req.valid("query")
        await EngineService.getTask(taskID)
        return c.json(
          conversationEventPage(taskID, {
            after: query.after,
            until: query.until,
            limit: query.limit,
            rewindCursor: taskRewindCursor(taskID),
            sinceTimestamp: query.since ?? null,
          }),
        )
      },
    )
    .get(
      "/task/:taskID/brief",
      describeRoute({
        summary: "Get task brief",
        operationId: "task.brief",
        responses: {
          200: {
            description: "Task brief",
            content: {
              "application/json": {
                schema: resolver(TaskBrief),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.getBrief({ taskID: c.req.valid("param").taskID }))
      },
    )
    .get(
      "/task/:taskID/board",
      describeRoute({
        summary: "Get task board",
        operationId: "task.board",
        responses: {
          200: {
            description: "Task board",
            content: {
              "application/json": {
                schema: resolver(TaskBoard),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const taskID = c.req.valid("param").taskID
        const sync = c.req.query("sync") !== "0"
        const etag = await EngineService.getBoardTag(taskID, { sync })
        if (c.req.header("if-none-match") === etag) {
          return new Response(null, {
            status: 304,
            headers: {
              ETag: etag,
            },
          })
        }
        c.header("ETag", etag)
        return c.json(await EngineService.getBoard(taskID, { sync: false }))
      },
    )
    .get(
      "/task/:taskID/transcript",
      describeRoute({
        summary: "Get task transcript",
        operationId: "task.transcript",
        responses: {
          200: {
            description: "Task session messages including tool calls",
            content: {
              "application/json": {
                schema: resolver(Message.VisibleWithParts.array()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await loadFullTaskTranscript(c.req.valid("param").taskID))
      },
    )
    .get(
      "/task/:taskID/operator-model-context",
      describeRoute({
        summary: "Get task operator model context",
        description:
          "Return the agent and effective model that a task-level operator message will use. " +
          "This mirrors the task message append path so overlay model controls do not guess from raw config.",
        operationId: "task.operatorModelContext",
        responses: {
          200: {
            description: "Task operator model context",
            content: {
              "application/json": {
                schema: resolver(TaskOperatorModelContext),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.getTaskOperatorModelContext(c.req.valid("param").taskID))
      },
    )
    .get(
      "/task/:taskID/interactions",
      describeRoute({
        summary: "List task interactions",
        operationId: "task.interactions",
        responses: {
          200: {
            description: "Task interactions",
            content: {
              "application/json": {
                schema: resolver(Interaction.array()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.listTaskInteractions(c.req.valid("param").taskID))
      },
    )
    .post(
      "/task/:taskID/message",
      describeRoute({
        summary: "Handle task message",
        operationId: "task.message",
        responses: {
          202: {
            description: "Task message durably accepted for delivery",
            content: {
              "application/json": {
                schema: resolver(TaskMessageResult),
              },
            },
          },
          ...errors(400, 404),
          409: namedErrorResponse(
            "Task execution or immutable expert-squad profile conflict",
            "TaskCancellationIncompleteError",
            "TaskPackageRevisionBindingError",
          ),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", TaskMessageInput),
      async (c) => {
        return c.json(await EngineService.handleTaskMessage(c.req.valid("param").taskID, c.req.valid("json")), 202)
      },
    )
    .post(
      "/task/:taskID/inject",
      describeRoute({
        summary: "Inject message into running task",
        operationId: "task.inject",
        responses: {
          200: {
            description: "Message injected",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    appended: z.boolean(),
                    orchestratorWoken: z.boolean(),
                    status: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", InjectMessageInput),
      async (c) => {
        return c.json(await EngineService.injectMessage(c.req.valid("param").taskID, c.req.valid("json").message))
      },
    )
    .post(
      "/task/:taskID/session/:sessionID/operator-steer",
      describeRoute({
        summary: "Steer a task agent session through operator coordination",
        description:
          "Accept a human-authored steer message for one target sub-agent session. " +
          "The route records a durable operator-originated agent_coordination_request and wakes the orchestrator. " +
          "It never appends a task-root operator message and never writes a direct child-session reply.",
        operationId: "task.session.operatorSteer",
        responses: {
          202: {
            description: "Operator steer request accepted",
            content: {
              "application/json": {
                schema: resolver(AgentSessionOperatorSteerResult),
              },
            },
          },
          ...operatorSteerRouteErrors(400, 404, 409),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id, sessionID: z.string().min(1) })),
      validator("json", AgentSessionOperatorSteerInput),
      async (c) => {
        const params = c.req.valid("param")
        const input = c.req.valid("json")
        return c.json(await EngineService.operatorSteerAgentSession(params.taskID, params.sessionID, input), 202)
      },
    )
    .post(
      "/task/:taskID/session/:sessionID/cancel",
      describeRoute({
        summary: "Cancel a task agent session",
        description:
          "Abort the active SessionLoop for a non-orchestrator task agent session. " +
          "For projected child sessions, also cancel their owned SessionPrompt and queued prompt work.",
        operationId: "task.session.cancel",
        responses: {
          200: {
            description: "Agent session cancelled",
            content: {
              "application/json": {
                schema: resolver(AgentSessionCancelResult),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id, sessionID: z.string().min(1) })),
      async (c) => {
        const params = c.req.valid("param")
        const target = await assertDirectAgentSession(params.taskID, params.sessionID)
        using _runtimeContractOwnership = SessionRuntimeContractStore.claimOperation(
          params.sessionID,
          target.runtimeContract,
          "agent session cancellation",
        )
        const cancellation = await abortChildExecutionForSession({
          taskID: params.taskID,
          sessionID: params.sessionID,
          origin: createExecutionCancellationOrigin({
            actor: "user",
            source: "engine.child_execution_abort",
            surface: "orchestrator",
            requestID: resolveRequestID(c),
            reason: "agent session cancelled",
            targetSessionID: params.sessionID,
            taskID: params.taskID,
          }),
        })
        return c.json({
          task_id: params.taskID,
          session_id: params.sessionID,
          cancelled: cancellation.cancelled,
        })
      },
    )
    .post(
      "/task/:taskID/cancel",
      describeRoute({
        summary: "Cancel task",
        operationId: "task.cancel",
        responses: {
          202: {
            description: "Task cancellation accepted or completed",
            content: {
              "application/json": {
                schema: resolver(TaskCancellationProjection),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", TaskCancellationRequestBody),
      async (c) => {
        const body = c.req.valid("json")
        const taskID = c.req.valid("param").taskID
        return c.json(
          await EngineService.requestTaskCancellation(taskID, {
            origin: {
              actor: "user",
              source: "task.cancel",
              surface: body.surface,
              requestID: resolveRequestID(c),
              reason: body.reason,
            },
          }),
          202,
        )
      },
    )
    .post(
      "/task/:taskID/rewind",
      describeRoute({
        summary: "Rewind the visible Task conversation timeline",
        operationId: "task.rewind",
        responses: {
          200: {
            description: "Rewind applied",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    taskID: z.string(),
                    cursorTime: z.number(),
                    rewindCount: z.number(),
                    anchorKind: z.enum(["cursorTime", "message"]),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", RewindTaskInput.omit({ taskID: true })),
      async (c) => {
        const { rewindTask } = await import("@/engine/rewind")
        const { taskID } = c.req.valid("param")
        requireRouteTaskInCurrentProject(taskID)
        const body = c.req.valid("json")
        const result = await rewindTask({
          taskID,
          ...body,
        })
        return c.json(result)
      },
    )
    .post(
      "/task/:taskID/rewind/clear",
      describeRoute({
        summary: "Clear the Task conversation visibility cursor",
        operationId: "task.clearRewindCursor",
        responses: {
          200: {
            description: "Cursor cleared",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        const { clearRewindCursor } = await import("@/engine/rewind")
        const { taskID } = c.req.valid("param")
        requireRouteTaskInCurrentProject(taskID)
        await clearRewindCursor(taskID)
        return c.json(true)
      },
    )
    .post(
      "/task/:taskID/retry",
      describeRoute({
        summary: "Retry task",
        operationId: "task.retry",
        responses: {
          200: {
            description: "Task retry queued",
            content: {
              "application/json": {
                schema: resolver(Task),
              },
            },
          },
          ...errors(404),
          409: namedErrorResponse(
            "Task retry conflicts with the current lifecycle",
            "TaskControlIntentLifecycleConflictError",
          ),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(await EngineService.retryTask(c.req.valid("param").taskID))
      },
    )
    .post(
      "/task/:taskID/replan",
      describeRoute({
        summary: "Replan task",
        operationId: "task.replan",
        responses: {
          200: {
            description: "Task replan queued",
            content: {
              "application/json": {
                schema: resolver(Task),
              },
            },
          },
          ...errors(404),
          409: namedErrorResponse(
            "Task replan conflicts with the current lifecycle",
            "TaskControlIntentLifecycleConflictError",
          ),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      async (c) => {
        return c.json(
          await EngineService.replanTask(c.req.valid("param").taskID).catch((error) => {
            if (error instanceof PlannerFailureError) {
              throw new HTTPException(503, {
                message: error.message,
              })
            }
            throw error
          }),
        )
      },
    )
    .get(
      "/session/:sessionID/trace",
      describeRoute({
        summary: "Get session AgentTrace events",
        operationId: "session.trace",
        responses: {
          200: {
            description: "Session AgentTrace events",
            content: {
              "application/json": {
                schema: resolver(TraceEventList),
              },
            },
          },
        },
      }),
      validator("param", z.object({ sessionID: z.string().min(1) })),
      async (c) => {
        return c.json(await EngineService.getSessionTrace(c.req.valid("param").sessionID))
      },
    )
    .get(
      "/task/:taskID/trace",
      describeRoute({
        summary: "Get task AgentTrace events (all sessions)",
        operationId: "task.trace",
        responses: {
          200: {
            description: "Aggregated task AgentTrace events",
            content: {
              "application/json": {
                schema: resolver(TraceEventList),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1) })),
      async (c) => {
        return c.json(await EngineService.getTaskTrace(c.req.valid("param").taskID))
      },
    )
    .post(
      "/interaction/:interactionID/reply",
      describeRoute({
        summary: "Reply to interaction",
        operationId: "interaction.reply",
        responses: {
          200: {
            description: "Interaction resolved",
            content: {
              "application/json": {
                schema: resolver(Interaction),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ interactionID: Interaction.shape.id })),
      validator("json", UserReplyInteractionInput.omit({ userInput: true })),
      async (c) => {
        const interactionID = c.req.valid("param").interactionID
        const input = c.req.valid("json")
        return c.json(
          await EngineService.replyUserInteraction(interactionID, {
            ...input,
            userInput: {
              surface: "http.interaction",
              text: input.message?.trim() || JSON.stringify(input.answers ?? input.decision ?? "allow_once"),
              structured: {
                ...(input.decision ? { decision: input.decision } : {}),
                ...(input.answers ? { answers: input.answers } : {}),
              },
            },
          }),
        )
      },
    )
    .post(
      "/interaction/:interactionID/reject",
      describeRoute({
        summary: "Reject interaction",
        operationId: "interaction.reject",
        responses: {
          200: {
            description: "Interaction rejected",
            content: {
              "application/json": {
                schema: resolver(Interaction),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ interactionID: Interaction.shape.id })),
      validator("json", UserRejectInteractionInput.omit({ userInput: true })),
      async (c) => {
        const interactionID = c.req.valid("param").interactionID
        const input = c.req.valid("json")
        return c.json(
          await EngineService.rejectUserInteraction(interactionID, {
            ...input,
            userInput: {
              surface: "http.interaction",
              text: input.message?.trim() || "Interaction rejected",
            },
          }),
        )
      },
    )
    .patch(
      "/goal/:goalID",
      describeRoute({
        summary: "Update goal title",
        operationId: "goal.updateTitle",
        responses: {
          200: {
            description: "Goal updated",
            content: { "application/json": { schema: resolver(GoalMutationResult) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ goalID: z.string() })),
      validator("json", UpdateGoalTitleInput),
      async (c) => {
        return c.json(await EngineService.updateGoalTitle(c.req.valid("param").goalID, c.req.valid("json")))
      },
    )
    .delete(
      "/goal/:goalID",
      describeRoute({
        summary: "Delete goal",
        operationId: "goal.delete",
        responses: {
          200: {
            description: "Goal deleted",
            content: { "application/json": { schema: resolver(GoalMutationResult) } },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ goalID: z.string() })),
      async (c) => {
        return c.json(
          await EngineService.deleteGoal(c.req.valid("param").goalID, {
            projectID: PersistedProjectContext.currentProject().id,
          }),
        )
      },
    )
    .delete(
      "/task/:taskID",
      describeRoute({
        summary: "Delete task",
        operationId: "task.delete",
        responses: {
          200: { description: "Task deleted" },
          ...errors(400, 404),
          409: namedErrorResponse("Task execution has not settled", "TaskCancellationIncompleteError"),
          500: namedErrorResponse(
            "Task deletion failed or committed with cleanup diagnostics",
            "TaskArtifactDeletionCommittedError",
            "UnknownError",
          ),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", TaskCancellationRequestBody),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(
          await EngineService.deleteTask(c.req.valid("param").taskID, {
            projectID: PersistedProjectContext.currentProject().id,
            origin: {
              actor: "user",
              source: "task.delete",
              surface: body.surface,
              requestID: resolveRequestID(c),
              reason: body.reason,
            },
          }),
        )
      },
    )
    .patch(
      "/task/:taskID/archive",
      describeRoute({
        summary: "Archive or restore task",
        description: "Stop and archive a task, or restore an archived task without restarting it.",
        operationId: "task.setArchived",
        responses: {
          200: { description: "Task archive state updated" },
          ...errors(400, 404),
          409: namedErrorResponse("Task execution has not settled", "TaskCancellationIncompleteError"),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", TaskArchiveRequestBody),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(
          await EngineService.setTaskArchived(
            c.req.valid("param").taskID,
            body.archived,
            body.archived
              ? {
                  origin: {
                    actor: "user",
                    source: "task.archive",
                    surface: body.surface,
                    requestID: resolveRequestID(c),
                    reason: body.reason,
                  },
                }
              : undefined,
          ),
        )
      },
    )
    .patch(
      "/task/:taskID/budget",
      describeRoute({
        summary: "Update task budget",
        operationId: "task.updateBudget",
        responses: {
          200: { description: "Budget updated" },
          ...errors(404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator("json", z.object({ budget: Budget.nullable() })),
      async (c) => {
        const { budget } = c.req.valid("json")
        return c.json(await EngineService.updateTaskBudget(c.req.valid("param").taskID, budget))
      },
    )
    .patch(
      "/task/:taskID/title",
      describeRoute({
        summary: "Update task title",
        operationId: "task.updateTitle",
        responses: {
          200: { description: "Title updated" },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ taskID: Task.shape.id })),
      validator(
        "json",
        z.object({
          title: z
            .string()
            .transform((value) => value.trim())
            .pipe(z.string().min(1).max(200)),
        }),
      ),
      async (c) => {
        const { title } = c.req.valid("json")
        return c.json(await EngineService.updateTaskTitle(c.req.valid("param").taskID, title))
      },
    ),
)

async function assertDirectAgentSession(taskID: string, sessionID: string) {
  const task = requireRouteTaskInCurrentProject(taskID)
  const owningTask = taskIDForSession(sessionID)
  if (owningTask !== taskID) {
    throw new HTTPException(404, {
      message: `Session ${sessionID} does not belong to task ${taskID}`,
    })
  }
  const kind = sessionRole(sessionID)
  if (!kind) {
    throw new HTTPException(404, {
      message: `Session ${sessionID} has no task agent kind`,
    })
  }
  const session = await Session.getInProject({ sessionID, projectID: task.project_id })
  const installed = SessionPrompt.getSessionRuntimeContract(sessionID)
  if (!installed || installed.identity.identityKind !== "projected-worker") {
    throw new HTTPException(400, {
      message: `Session ${sessionID} has no projected worker runtime identity for agent session control`,
    })
  }
  try {
    const runtimeContract = SessionPrompt.validateSessionRuntimeContractForContinuation({
      sessionID,
      expectedSessionKind: kind,
      expectedTaskID: taskID,
      expectedAgentID: installed.identity.agentID,
      expectedWorkerTurnDescriptor: {
        id: installed.identity.workerTurnDescriptorID,
        hash: installed.identity.workerTurnDescriptorHash,
      },
      requireWorkerTurnDescriptor: true,
      requireRuntimeContract: true,
    })
    if (!runtimeContract || runtimeContract.identity.identityKind !== "projected-worker") {
      throw new Error(`Session ${sessionID} projected worker runtime identity disappeared during agent session control`)
    }
    RuntimeTemplateRegistry.get(runtimeContract.identity.baseRole)
    return { session, runtimeContract }
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

function taskEvent(taskID: string, event: { type: string; properties: Record<string, unknown> }, sequence?: number) {
  const now = Date.now()
  const eventID = `${now}-${Math.random().toString(36).slice(2, 10)}`
  const seq = sequence ?? 0
  return {
    event_id: eventID,
    task_id: taskID,
    orderKey: timelineOrderKey({ domain: "protocol", time: now, sequence: seq, id: eventID }),
    type: event.type.replace("engine.", ""),
    emittedAt: now,
    timestamp: now,
    sequence: seq,
    summary: typeof event.properties.summary === "string" ? event.properties.summary : event.type,
    payload: event.properties,
  }
}

function isMessageTaskEvent(type: string): boolean {
  return (
    type === "message.moved" ||
    type === "message.updated" ||
    type === "message.part.updated" ||
    type === "message.part.delta" ||
    type === "message.removed" ||
    type === "message.part.removed"
  )
}

function isPersistedMessageTaskEvent(type: string): boolean {
  return (
    type === "message.moved" ||
    type === "message.updated" ||
    type === "message.part.updated" ||
    type === "message.removed" ||
    type === "message.part.removed"
  )
}

function conversationItemTimestamp(item: any): number {
  const value =
    typeof item?.timestamp === "number"
      ? item.timestamp
      : typeof item?.info?.time?.created === "number"
        ? item.info.time.created
        : 0
  return Number.isFinite(value) ? value : 0
}

export const __taskMessageWatermarkForTest = taskMessageWatermark

function conversationItemSessionID(item: any): string {
  return String(item?.info?.sessionID || "")
}

function conversationItemID(item: any): string {
  return String(item?.info?.id || item?.id || "")
}

function compareConversationItems(left: any, right: any): number {
  return compareTimelineOrderKeys(conversationItemOrderKey(left), conversationItemOrderKey(right))
}

function conversationItemOrderKey(item: any): string {
  const key =
    typeof item?.orderKey === "string"
      ? item.orderKey
      : typeof item?.info?.orderKey === "string"
        ? item.info.orderKey
        : ""
  if (!key) {
    throw new Error(`conversation item ${conversationItemID(item) || "<unknown>"} missing orderKey`)
  }
  return key
}

function isBeforeConversationCursor(item: any, cursor: { beforeOrderKey: string }): boolean {
  return compareTimelineOrderKeys(conversationItemOrderKey(item), cursor.beforeOrderKey) < 0
}

function expandWindowStartToSessionBoundary(items: any[], start: number): number {
  return Math.max(0, Math.min(start, items.length))
}

function conversationHistoryState(allTranscript: any[], visibleTranscript: any[], limit: number) {
  const oldestItem = visibleTranscript[0] ?? null
  const oldest = oldestItem ? conversationItemTimestamp(oldestItem) : null
  const oldestOrderKey = oldestItem ? conversationItemOrderKey(oldestItem) : null
  const oldestMessageID = oldestItem ? conversationItemID(oldestItem) || null : null
  return {
    oldestTimestamp: oldest,
    oldestOrderKey,
    oldestMessageID,
    hasMore: oldestItem != null && allTranscript.some((item) => compareConversationItems(item, oldestItem) < 0),
    limit,
  }
}

export function __conversationHistoryWindowForTest(transcript: any[], input: { tailLimit: number }) {
  const orderedTranscript = [...transcript].sort(compareConversationItems)
  const start = expandWindowStartToSessionBoundary(
    orderedTranscript,
    Math.max(0, orderedTranscript.length - input.tailLimit),
  )
  const visibleTranscript = orderedTranscript.slice(start)
  return {
    transcript: visibleTranscript,
    history: conversationHistoryState(orderedTranscript, visibleTranscript, input.tailLimit),
  }
}

export function __conversationHistoryBeforeForTest(
  transcript: any[],
  input: { before: number; beforeOrderKey: string; beforeID?: string; limit: number },
) {
  const olderTranscript = [...transcript]
    .filter((item) => isBeforeConversationCursor(item, { beforeOrderKey: input.beforeOrderKey }))
    .sort(compareConversationItems)
  const start = expandWindowStartToSessionBoundary(olderTranscript, Math.max(0, olderTranscript.length - input.limit))
  const visibleTranscript = olderTranscript.slice(start)
  return {
    transcript: visibleTranscript,
    history: conversationHistoryState(olderTranscript, visibleTranscript, input.limit),
  }
}

export function __displayableConversationTranscriptForTest(transcript: any[]) {
  return transcript.filter(conversationMessageHasDisplay)
}

type TaskTranscriptScope = "current-project" | "task"

async function taskSessionIDs(taskID: string, input: { scope?: TaskTranscriptScope } = {}) {
  const task = input.scope === "task" ? requireTask(taskID) : requireRouteTaskInCurrentProject(taskID)
  const rootSessionID = task.session_id
  if (!rootSessionID) {
    return {
      task,
      rootSessionID: "",
      sessionIDs: [] as string[],
    }
  }
  const rootSession = await Session.get(rootSessionID)
  if (rootSession.projectID !== task.project_id) {
    throw new Error(
      `Task ${taskID} root session ${rootSessionID} belongs to project ${rootSession.projectID}, expected ${task.project_id}`,
    )
  }
  const sessionIDs = await Session.treeInProject({ sessionID: rootSessionID, projectID: task.project_id })
  return { task, rootSessionID, sessionIDs }
}

type TaskSessionSet = Awaited<ReturnType<typeof taskSessionIDs>>
type TaskSessionSource = TaskSessionSet | Promise<TaskSessionSet>

async function loadTaskTranscript(
  taskID: string,
  input: { perSessionLimit?: number; scope?: TaskTranscriptScope; taskSessions?: TaskSessionSource } = {},
) {
  const { rootSessionID, sessionIDs } = input.taskSessions
    ? await input.taskSessions
    : await taskSessionIDs(taskID, { scope: input.scope })
  if (!rootSessionID) return { transcript: [], truncated: false }
  const perSessionLimit =
    typeof input.perSessionLimit === "number" ? Math.max(1, Math.floor(input.perSessionLimit)) : undefined
  if (perSessionLimit) {
    const messages = await MessageStore.latestAcrossSessions({ sessionIDs, limit: perSessionLimit + 1 })
    const truncated = messages.length > perSessionLimit
    const transcript = truncated ? messages.slice(messages.length - perSessionLimit) : messages
    annotateTaskTranscriptMessages(transcript, rootSessionID)
    return {
      transcript: __displayableConversationTranscriptForTest(transcript),
      truncated,
    }
  }
  let truncated = false
  const all = await Promise.all(
    sessionIDs.map(async (id) => {
      return Session.messages({ sessionID: id })
    }),
  )
  const messages = all.flat().sort(conversationTranscriptMessageOrder)
  annotateTaskTranscriptMessages(messages, rootSessionID)
  return {
    transcript: __displayableConversationTranscriptForTest(messages),
    truncated,
  }
}

async function loadTaskProtectedTranscript(
  taskID: string,
  sessionIDs: string[],
  input: { limit: number; scope?: TaskTranscriptScope; taskSessions?: TaskSessionSource },
) {
  const { rootSessionID, sessionIDs: taskOwnedSessionIDs } = input.taskSessions
    ? await input.taskSessions
    : await taskSessionIDs(taskID, { scope: input.scope })
  if (!rootSessionID) return { transcript: [], truncated: false }
  const taskOwnedSessionIDSet = new Set(taskOwnedSessionIDs)
  const protectedSessionIDs = [...new Set(sessionIDs)].filter((sessionID) => taskOwnedSessionIDSet.has(sessionID))
  if (protectedSessionIDs.length === 0) return { transcript: [], truncated: false }
  const limit = Math.max(1, Math.floor(input.limit))
  const messages = await MessageStore.latestAcrossSessions({
    sessionIDs: protectedSessionIDs,
    limit: limit + 1,
  })
  const truncated = messages.length > limit
  const transcript = truncated ? messages.slice(messages.length - limit) : messages
  annotateTaskTranscriptMessages(transcript, rootSessionID)
  return {
    transcript: __displayableConversationTranscriptForTest(transcript),
    truncated,
  }
}

async function loadTaskSessionTranscript(
  taskID: string,
  sessionID: string,
  input: { scope?: TaskTranscriptScope } = {},
) {
  const { rootSessionID, sessionIDs } = await taskSessionIDs(taskID, { scope: input.scope })
  if (!rootSessionID || !sessionIDs.includes(sessionID)) return []
  const messages = await Session.messages({ sessionID })
  annotateTaskTranscriptMessages(messages, rootSessionID)
  return __displayableConversationTranscriptForTest(messages)
}

function annotateTaskTranscriptMessages(messages: Array<{ info: Record<string, any> }>, rootSessionID: string) {
  for (const msg of messages) {
    const sid = msg.info.sessionID || ""
    const meta = overlayMeta(sid, rootSessionID, {
      id: msg.info.id,
      role: msg.info.role,
      author: msg.info.author,
      agent: msg.info.agent,
      parentID: msg.info.parentID,
    })
    ;(msg.info as any).resolvedRole = meta.resolvedRole
    ;(msg.info as any).channel = meta.channel
    ;(msg.info as any).agentID = meta.agentID
    ;(msg.info as any).sessionAgentID = meta.sessionAgentID
    ;(msg.info as any).originSource = String(msg.info.extra?.source ?? "")
    const parentSessionID = sessionParentID(sid)
    if (parentSessionID) (msg.info as any).parentSessionID = parentSessionID
    ;(msg.info as any).orderKey = timelineMessageOrderKey(msg)
  }
}

async function loadFullTaskTranscript(taskID: string, input: { scope?: TaskTranscriptScope } = {}) {
  return (await loadTaskTranscript(taskID, { scope: input.scope })).transcript
}

function conversationEventPage(
  taskID: string,
  input: {
    after: number
    until?: number
    limit: number
    rewindCursor: number | null
    sinceTimestamp?: number | null
  },
) {
  const latestSequence = typeof input.until === "number" ? input.until : ProtocolStore.latestTaskSequence(taskID)
  const rows = ProtocolStore.listTaskEventsAfter(taskID, input.after, {
    until: latestSequence,
    limit: input.limit,
  })
  const cursor = rows.reduce((max, event) => Math.max(max, event.sequence), input.after)
  const events = rows
    .map(protocolTaskEvent)
    .filter(
      (event) =>
        (input.rewindCursor == null || event.timestamp <= input.rewindCursor) &&
        (input.sinceTimestamp == null || event.timestamp >= input.sinceTimestamp),
    )
  return {
    events,
    eventReplay: {
      cursor,
      latestSequence,
      complete: cursor >= latestSequence || rows.length === 0,
      limit: input.limit,
      sinceTimestamp: input.sinceTimestamp ?? null,
    },
  }
}

function conversationSessionEvents(
  taskID: string,
  sessionID: string,
  input: {
    rewindCursor: number | null
  },
) {
  return ProtocolStore.listTaskEvents(taskID)
    .filter(
      (event) =>
        event.sessionID === sessionID &&
        (event.type === "agent.execution.lifecycle" || event.type === "session.error") &&
        (input.rewindCursor == null || event.time.emitted <= input.rewindCursor),
    )
    .map(protocolTaskEvent)
}

function conversationHistoryEvents(
  taskID: string,
  input: {
    beforeOrderKey: string
    oldestOrderKey: string | null
    rewindCursor: number | null
  },
) {
  if (input.oldestOrderKey == null) return []
  return ProtocolStore.listTaskEvents(taskID)
    .filter(
      (event) =>
        (event.type === "agent.execution.lifecycle" || event.type === "session.error") &&
        (input.rewindCursor == null || event.time.emitted <= input.rewindCursor),
    )
    .map(protocolTaskEvent)
    .filter((event) => {
      const orderKey = event.orderKey
      if (typeof orderKey !== "string" || orderKey.length === 0) {
        throw new Error(`conversation history event ${event.event_id} missing orderKey`)
      }
      return (
        compareTimelineOrderKeys(orderKey, input.oldestOrderKey!) >= 0 &&
        compareTimelineOrderKeys(orderKey, input.beforeOrderKey) < 0
      )
    })
}

export function taskListProtocolEvent(event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]) {
  const notify = BusEvent.resolveNotify(event.type, event.payload ?? {})
  return {
    type: event.type.replace("engine.", ""),
    taskID: event.taskID ?? null,
    sequence: event.sequence,
    source: event.source,
    ...(notify ? { notify } : {}),
    ...(notify ? { notificationDetails: taskListNotificationDetails(event) } : {}),
  }
}

function taskListNotificationDetails(event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]): string {
  return JSON.stringify(
    {
      type: event.type.replace("engine.", ""),
      taskID: event.taskID ?? null,
      sequence: event.sequence,
      summary: event.summary ?? (event.payload as Record<string, unknown> | undefined)?.summary ?? "",
      payload: event.payload ?? {},
    },
    null,
    2,
  )
}

export function protocolTaskEvent(event: ReturnType<typeof ProtocolStore.listTaskEventsAfter>[number]) {
  // Schema (protocol/schema.ts) requires `emitted_at` to be a positive int.
  // Reading `time.emitted || time.created || Date.now()` was a rule-1
  // cascading substitute that silently repaired schema-invalid rows — if we ever
  // reach that branch the upstream writer is broken and the right answer
  // is to crash loudly, not to stamp envelopes with a client-local clock.
  const timestamp = event.time.emitted
  if (!(typeof timestamp === "number" && timestamp > 0)) {
    throw new Error(`protocolTaskEvent: event ${event.id} missing time.emitted (schema-invariant violated)`)
  }
  const notify = BusEvent.resolveNotify(event.type, event.payload ?? {})
  const orderKey = typeof event.orderKey === "string" && event.orderKey.length > 0 ? event.orderKey : undefined
  if (!orderKey) throw new Error(`protocolTaskEvent: event ${event.id} (${event.type}) missing orderKey`)
  const source = typeof event.source === "string" && event.source.length > 0 ? event.source : undefined
  if (!source) throw new Error(`protocolTaskEvent: event ${event.id} (${event.type}) missing source`)
  const payload = event.payload || {}
  const payloadOrderKey =
    typeof payload.orderKey === "string"
      ? payload.orderKey
      : event.type.startsWith("message.") && payload.info && typeof payload.info === "object"
        ? (payload.info as Record<string, unknown>).orderKey
        : undefined
  if (typeof payloadOrderKey === "string" && payloadOrderKey.length > 0 && payloadOrderKey !== orderKey) {
    throw new Error(`protocolTaskEvent: event ${event.id} (${event.type}) orderKey drift between envelope and payload`)
  }
  if (event.type === "agent.execution.lifecycle" || event.type === "session.error") {
    requireTimelineOrderKeyDomain(orderKey, `protocolTaskEvent: event ${event.id} (${event.type}) envelope`, "session")
    requireTimelineOrderKeyDomain(
      payloadOrderKey,
      `protocolTaskEvent: event ${event.id} (${event.type}) payload`,
      "session",
    )
  }
  return {
    event_id: event.id,
    task_id: event.taskID,
    orderKey,
    source,
    ...(event.sessionID ? { session_id: event.sessionID } : {}),
    ...(event.correlationID ? { correlation_id: event.correlationID } : {}),
    ...(event.causationID ? { causation_id: event.causationID } : {}),
    type: event.type.replace("engine.", ""),
    emittedAt: timestamp,
    timestamp,
    sequence: event.sequence,
    ...(event.liveSequence !== undefined ? { live_sequence: event.liveSequence } : {}),
    ...(event.liveEpoch !== undefined ? { live_epoch: event.liveEpoch } : {}),
    summary: event.summary,
    payload,
    ...(notify ? { notify } : {}),
  }
}
