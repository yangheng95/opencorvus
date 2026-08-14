import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import {
  WorkLedgerArchiveList,
  WorkLedgerEvent,
  WorkLedgerList,
  WorkLedgerConversationHandoffEvent,
  WorkLedgerMissionHandoffEvent,
  type WorkLedgerEvent as WorkLedgerEventValue,
} from "@opencorvus-ai/transport-protocol"
import { GlobalBus } from "@/bus/global"
import { isRightSidebarConversationSession } from "@/chat/session"
import { ConversationHandoffEvent } from "@/chat/handoff"
import { MissionHandoffEvent } from "@/mission/caller-receipt"
import { Project } from "@/project/project"
import { ProtocolStore, type ProtocolEventView } from "@/protocol/store"
import { Session, SessionStatus } from "@/session"
import { EngineService } from "@/task-api"
import { isMailboxChangeEventType } from "@/engine/mailbox"
import { TaskQueueEvent } from "@/scheduler/task-queue-service"
import { ProjectMemory } from "@/memory/project-memory"
import { listArchivedWorkLedger, listWorkLedger } from "@/work-ledger/projection"
import { errors } from "../error"
import { streamGlobalSSE } from "../sse"
import { isTaskListProjectionEventType, taskListProtocolEvent } from "./orchestrator"

const WorkLedgerListQuery = z
  .object({
    directory: z.string().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    cursorUpdated: z.coerce.number().optional(),
    cursorPinned: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    cursorRowKey: z.string().optional(),
  })
  .refine(
    (query) =>
      [query.cursorPinned, query.cursorUpdated, query.cursorRowKey].every((value) => value === undefined) ||
      [query.cursorPinned, query.cursorUpdated, query.cursorRowKey].every((value) => value !== undefined),
    {
      message: "cursorPinned, cursorUpdated, and cursorRowKey must be provided together",
      path: ["cursorUpdated"],
    },
  )

const WorkLedgerPinInput = z.object({ pinned: z.boolean() })
const WorkLedgerItemPinKind = z.enum(["mission", "task", "chat"])
const WorkLedgerPinResult = z.object({ pinned: z.boolean() })

function isMissionWorkLedgerSession(info: Session.Info): boolean {
  return (
    info.kind === "mission" &&
    !!info.metadata &&
    typeof info.metadata.mission === "object" &&
    info.metadata.mission !== null
  )
}

function workLedgerSessionChangedEvent(
  sourceType: string,
  info: Session.Info,
  sequence = Number(info.time.updated) || 0,
): WorkLedgerEventValue | null {
  const mission =
    info.kind === "mission" &&
    info.metadata &&
    typeof info.metadata === "object" &&
    typeof (info.metadata as Record<string, unknown>).mission === "object"
  if (!mission && !isRightSidebarConversationSession(info)) return null
  return {
    type: "work-ledger.changed",
    sourceType,
    sessionID: info.id,
    sequence,
  }
}

function workLedgerProjectChangedEvent(
  sourceType: string,
  info: Project.Info,
  sequence = Number(info.time.updated) || 0,
): WorkLedgerEventValue {
  return {
    type: "work-ledger.changed",
    sourceType,
    projectID: info.id,
    directory: info.worktree,
    sequence,
  }
}

function writeWorkLedgerEventData(writeData: (data: string) => void, event: WorkLedgerEventValue): void {
  writeData(JSON.stringify(WorkLedgerEvent.parse(event)))
}

function mailboxNotificationEvent(event: ProtocolEventView): WorkLedgerEventValue {
  const payload = event.payload ?? {}
  const acknowledgedMessageID = typeof payload.messageID === "string" ? payload.messageID : undefined
  return {
    type: "mailbox.changed",
    sourceType: event.type,
    messageID: acknowledgedMessageID ?? event.id,
    taskID: event.taskID ?? null,
    sequence: event.sequence,
  }
}

function workLedgerGlobalBusEvent(input: { payload?: unknown }): { sourceType: string; info: Session.Info } | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  const sourceType = typeof envelope.type === "string" ? envelope.type : ""
  if (
    sourceType !== Session.Event.Created.type &&
    sourceType !== Session.Event.Updated.type &&
    sourceType !== Session.Event.Deleted.type
  ) {
    return null
  }
  const properties = envelope.properties
  const info = properties && typeof properties === "object" ? (properties as { info?: unknown }).info : undefined
  const parsed = Session.Info.safeParse(info)
  if (!parsed.success) return null
  return { sourceType, info: parsed.data }
}

function workLedgerGlobalBusProjectEvent(input: {
  payload?: unknown
}): { sourceType: string; info: Project.Info } | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  const sourceType = typeof envelope.type === "string" ? envelope.type : ""
  if (sourceType !== Project.Event.Updated.type) return null
  const parsed = Project.Info.safeParse(envelope.properties)
  if (!parsed.success) return null
  return { sourceType, info: parsed.data }
}

function workLedgerGlobalBusStatusEvent(input: {
  payload?: unknown
}): { sourceType: string; sessionID: string; sequence: number } | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  const sourceType = typeof envelope.type === "string" ? envelope.type : ""
  if (sourceType !== SessionStatus.Event.Status.type) return null
  const parsed = z.object({ sessionID: z.string().min(1) }).safeParse(envelope.properties)
  if (!parsed.success) return null
  return { sourceType, sessionID: parsed.data.sessionID, sequence: Date.now() }
}

function workLedgerGlobalBusQueueEvent(input: {
  payload?: unknown
}): { sourceType: string; sessionID: string; sequence: number } | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  if (envelope.type !== TaskQueueEvent.Changed.type) return null
  const parsed = TaskQueueEvent.Changed.properties.safeParse(envelope.properties)
  if (!parsed.success) return null
  return {
    sourceType: TaskQueueEvent.Changed.type,
    sessionID: parsed.data.sessionID,
    sequence: parsed.data.sequence,
  }
}

function workLedgerGlobalBusProjectMemoryEvent(input: {
  payload?: unknown
}): { sourceType: string; projectID: string; sequence: number } | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  if (envelope.type !== ProjectMemory.Event.NoticeChanged.type) return null
  const parsed = ProjectMemory.Event.NoticeChanged.properties.safeParse(envelope.properties)
  if (!parsed.success) return null
  return {
    sourceType: ProjectMemory.Event.NoticeChanged.type,
    projectID: parsed.data.projectID,
    sequence: Date.now(),
  }
}

export const WorkLedgerRouteTestHooks = {
  workLedgerGlobalBusQueueEvent,
  workLedgerGlobalBusProjectMemoryEvent,
  workLedgerSessionChangedEvent,
}

function workLedgerGlobalBusMissionHandoffEvent(input: {
  payload?: unknown
}): z.output<typeof WorkLedgerMissionHandoffEvent> | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  if (envelope.type !== MissionHandoffEvent.type) return null
  const parsed = MissionHandoffEvent.properties.safeParse(envelope.properties)
  if (!parsed.success) return null
  return WorkLedgerMissionHandoffEvent.parse({
    type: "work-ledger.mission-handoff",
    sourceType: MissionHandoffEvent.type,
    projectID: parsed.data.projectID,
    directory: parsed.data.directory,
    missionID: parsed.data.missionID,
    sessionID: parsed.data.missionSessionID,
    callerSessionID: parsed.data.callerSessionID,
    callerExperience: parsed.data.callerExperience,
    callerMessageID: parsed.data.callerMessageID,
    sequence: parsed.data.timeCreated,
  })
}

function workLedgerGlobalBusConversationHandoffEvent(input: {
  payload?: unknown
}): z.output<typeof WorkLedgerConversationHandoffEvent> | null {
  const payload = input.payload
  if (!payload || typeof payload !== "object") return null
  const envelope = payload as { type?: unknown; properties?: unknown }
  if (envelope.type !== ConversationHandoffEvent.type) return null
  const parsed = ConversationHandoffEvent.properties.safeParse(envelope.properties)
  if (!parsed.success) return null
  return WorkLedgerConversationHandoffEvent.parse({
    type: "work-ledger.conversation-handoff",
    sourceType: ConversationHandoffEvent.type,
    projectID: parsed.data.projectID,
    directory: parsed.data.directory,
    sessionID: parsed.data.targetSessionID,
    experience: parsed.data.targetExperience,
    callerSessionID: parsed.data.callerSessionID,
    callerExperience: parsed.data.callerExperience,
    callerMessageID: parsed.data.callerMessageID,
    sequence: parsed.data.timeCreated,
  })
}

export function WorkLedgerRoutes() {
  return new Hono()
    .patch(
      "/project/:projectID/pin",
      describeRoute({
        summary: "Pin or unpin a Work Ledger project",
        description: "Persist pin state for a Project shown by the Work Ledger.",
        operationId: "workLedger.setProjectPinned",
        responses: {
          200: { description: "Updated project", content: { "application/json": { schema: resolver(Project.Info) } } },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string().min(1) })),
      validator("json", WorkLedgerPinInput),
      async (c) => {
        const { projectID } = c.req.valid("param")
        return c.json(await Project.setPinned({ projectID, pinned: c.req.valid("json").pinned }))
      },
    )
    .patch(
      "/item/:kind/:itemID/pin",
      describeRoute({
        summary: "Pin or unpin a Work Ledger item",
        description: "Persist pin state for a Mission, Task, or Chat shown by the Work Ledger.",
        operationId: "workLedger.setItemPinned",
        responses: {
          200: {
            description: "Updated pin state",
            content: { "application/json": { schema: resolver(WorkLedgerPinResult) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ kind: WorkLedgerItemPinKind, itemID: z.string().min(1) })),
      validator("json", WorkLedgerPinInput),
      async (c) => {
        const { kind, itemID } = c.req.valid("param")
        const { pinned } = c.req.valid("json")
        if (kind === "task") {
          await EngineService.setTaskPinned(itemID, pinned)
          return c.json({ pinned })
        }
        const session = await Session.get(itemID)
        const matchesKind =
          kind === "mission" ? isMissionWorkLedgerSession(session) : isRightSidebarConversationSession(session)
        if (!matchesKind) {
          throw new HTTPException(400, {
            message: `Session ${itemID} is not a Work Ledger ${kind}`,
          })
        }
        const updated = await Session.setPinned({
          sessionID: itemID,
          time: pinned ? Date.now() : null,
        })
        return c.json({ pinned: updated.time.pinned !== undefined })
      },
    )
    .get(
      "/events",
      describeRoute({
        summary: "Subscribe to Work Ledger change notifications",
        description:
          "Unified Work Ledger Server-Sent Events (SSE) stream. Generic Mission, Chat, Work, Task, and Project changes tell clients to refetch /work-ledger; conversation handoffs carry exact caller and target lineage for activation followed by caller archival.",
        operationId: "workLedger.events",
        responses: {
          200: {
            description: "Work Ledger change stream",
            content: {
              "text/event-stream": {
                schema: resolver(WorkLedgerEvent),
              },
            },
          },
        },
      }),
      async (c) => {
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream, bind) => {
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let stop = () => {}
          let finishStream = () => {}
          let closed = false
          const cleanup = (input?: { closeStream?: boolean }) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            stop()
            if (input?.closeStream) stream.close()
            finishStream()
          }
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          let writes = Promise.resolve()
          const writeData = (data: string) => {
            writes = writes
              .then(() => {
                if (closed) return
                return stream.writeSSE({ data })
              })
              .catch(() => {
                cleanup({ closeStream: true })
              })
          }
          const globalBusListener = bind((event: { payload?: unknown }) => {
            const missionHandoffEvent = workLedgerGlobalBusMissionHandoffEvent(event)
            if (missionHandoffEvent) {
              writeWorkLedgerEventData(writeData, missionHandoffEvent)
              return
            }
            const conversationHandoffEvent = workLedgerGlobalBusConversationHandoffEvent(event)
            if (conversationHandoffEvent) {
              writeWorkLedgerEventData(writeData, conversationHandoffEvent)
              return
            }
            const projectEvent = workLedgerGlobalBusProjectEvent(event)
            if (projectEvent) {
              writeWorkLedgerEventData(
                writeData,
                workLedgerProjectChangedEvent(projectEvent.sourceType, projectEvent.info),
              )
              return
            }
            const sessionEvent = workLedgerGlobalBusEvent(event)
            if (sessionEvent) {
              const changed = workLedgerSessionChangedEvent(sessionEvent.sourceType, sessionEvent.info)
              if (changed) writeWorkLedgerEventData(writeData, changed)
              return
            }
            const queueEvent = workLedgerGlobalBusQueueEvent(event)
            if (queueEvent) {
              void Session.get(queueEvent.sessionID)
                .then((info) => {
                  const changed = workLedgerSessionChangedEvent(queueEvent.sourceType, info, queueEvent.sequence)
                  if (changed) writeWorkLedgerEventData(writeData, changed)
                })
                .catch(() => undefined)
              return
            }
            const projectMemoryEvent = workLedgerGlobalBusProjectMemoryEvent(event)
            if (projectMemoryEvent) {
              writeWorkLedgerEventData(writeData, {
                type: "work-ledger.changed",
                sourceType: projectMemoryEvent.sourceType,
                projectID: projectMemoryEvent.projectID,
                sequence: projectMemoryEvent.sequence,
              })
              return
            }
            const statusEvent = workLedgerGlobalBusStatusEvent(event)
            if (!statusEvent) return
            void Session.get(statusEvent.sessionID)
              .then((info) => {
                const changed = workLedgerSessionChangedEvent(statusEvent.sourceType, info, statusEvent.sequence)
                if (changed) writeWorkLedgerEventData(writeData, changed)
              })
              .catch(() => {
                cleanup({ closeStream: true })
              })
          })
          GlobalBus.on("event", globalBusListener)
          const protocolSubscription = ProtocolStore.subscribeEvents(
            bind((event) => {
              if (isMailboxChangeEventType(event.type, event.payload)) {
                writeWorkLedgerEventData(writeData, mailboxNotificationEvent(event))
                return
              }
              if (!isTaskListProjectionEventType(event.type)) return
              const taskEvent = taskListProtocolEvent(event)
              writeWorkLedgerEventData(writeData, {
                type: "work-ledger.changed",
                sourceType: taskEvent.type,
                taskID: taskEvent.taskID,
                sequence: taskEvent.sequence,
              })
            }),
            { aggregate: "task" },
          )
          stop = () => {
            GlobalBus.off("event", globalBusListener)
            protocolSubscription()
          }
          writeWorkLedgerEventData(writeData, {
            type: "work-ledger.connected",
            sourceType: "work-ledger.connected",
            sequence: 0,
          })
          heartbeat = setInterval(
            bind(() => {
              writeWorkLedgerEventData(writeData, {
                type: "work-ledger.heartbeat",
                sourceType: "work-ledger.heartbeat",
                sequence: 0,
              })
            }),
            10_000,
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
      "/archive",
      describeRoute({
        summary: "List archived Work Ledger rows",
        description: "Return archived Mission, Task, and Chat/Work records for the Settings archive surface.",
        operationId: "workLedger.listArchived",
        responses: {
          200: {
            description: "Archived Work Ledger rows",
            content: { "application/json": { schema: resolver(WorkLedgerArchiveList) } },
          },
          ...errors(400),
        },
      }),
      validator("query", WorkLedgerListQuery),
      async (c) => c.json(await listArchivedWorkLedger(c.req.valid("query"))),
    )
    .get(
      "/",
      describeRoute({
        summary: "List Work Ledger rows",
        description:
          "Return one unified Mission and Chat/Work ledger projection. Tasks are visible only inside their owning Mission row.",
        operationId: "workLedger.list",
        responses: {
          200: {
            description: "Work Ledger rows",
            content: { "application/json": { schema: resolver(WorkLedgerList) } },
          },
          ...errors(400),
        },
      }),
      validator("query", WorkLedgerListQuery),
      async (c) => c.json(await listWorkLedger(c.req.valid("query"))),
    )
}
