/**
 * Pipeline persistence — fast-path task creation.
 *
 * Stage functions (spec, goal, plan, dispatch) have been migrated to
 * task-tools.ts and are now driven by the Orchestrator instead of a
 * fixed state machine.
 */
import z from "zod"
import { eq } from "drizzle-orm"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import { budgetRow } from "./helpers"
import { CreateTaskInput, Event } from "./model"
import { EngineProtocol } from "./protocol"
import { insertEngineChannelBinding } from "./channel-binding"
import { insertEngineProgressSnapshot } from "./progress"
import { insertEngineTask } from "./task"
import { TaskGlobalProjectBindingError } from "./task-project-error"
import {
  persistPreparedCrossTaskArtifactImports,
  type PreparedCrossTaskArtifactImport,
} from "./cross-task-artifact-import"
import { insertTaskPackageRevisionBinding } from "./task-package-revision-binding"
import {
  assertTaskProcessBindingCreation,
  insertTaskProcessBinding,
  type TaskProcessBindingPayload,
} from "./task-execution-capsule-binding"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { SessionTable } from "@/session/session.sql"
import { ProjectMemory } from "@/memory/project-memory"

const log = Log.create({ service: "engine-pipeline" })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BudgetInput = z.infer<typeof CreateTaskInput>["budget"]
type PriorityInput = z.infer<typeof CreateTaskInput>["priority"]
type ChannelBindingInput = z.infer<typeof CreateTaskInput>["channelBinding"]

const QUEUE_PRIORITY_BUCKET = {
  critical: 0,
  high: 1_000_000_000_000_000,
  normal: 2_000_000_000_000_000,
  low: 3_000_000_000_000_000,
} satisfies Record<NonNullable<PriorityInput>, number>

function initialQueueOrder(priority: PriorityInput | undefined, now: number) {
  return QUEUE_PRIORITY_BUCKET[priority ?? "normal"] + now
}

// ---------------------------------------------------------------------------
// persistQueuedTask — fast-path for POST /task (<10ms)
// queue=true persists a queued task; queue=false persists an already-active
// task so same-project work can start in parallel when the caller requests it.
// ---------------------------------------------------------------------------

export function persistQueuedTask(input: {
  taskID: string
  sessionID: string
  now: number
  title: string
  request: string
  attachments?: Array<{
    sha: string
    url: string
    mime: string
    size: number
    filename?: string
    intent: "task_input"
    source: "user-upload"
  }>
  requestID?: string
  source?: z.infer<typeof CreateTaskInput>["source"]
  productPillar: z.infer<typeof CreateTaskInput>["productPillar"]
  priority?: PriorityInput
  budget?: BudgetInput
  metadata: Record<string, unknown>
  channelBinding?: ChannelBindingInput
  projectID: string
  queue: boolean
  artifactImports?: readonly PreparedCrossTaskArtifactImport[]
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  creationExpectedPackageDigest?: string
  executionCapsuleBinding: TaskProcessBindingPayload
}) {
  if (input.projectID === "global") {
    throw new TaskGlobalProjectBindingError({
      message: `Refusing to persist task ${input.taskID} under project global. Task persistence requires a concrete Git project.`,
      taskID: input.taskID,
      projectID: input.projectID,
    })
  }
  const taskStatus = input.queue ? "queued" : "active"
  const progressStatus = input.queue ? "created" : "active"
  const summary = input.queue ? "Task queued" : "Task started"
  const source = input.queue ? "pipeline.queued" : "pipeline.direct"
  Database.transaction((db) => {
    const rootSession = db.select().from(SessionTable).where(eq(SessionTable.id, input.sessionID)).get()
    if (!rootSession || rootSession.project_id !== input.projectID) {
      throw new Error(`Task ${input.taskID} root Session conflicts with its creation Project`)
    }
    assertTaskProcessBindingCreation({
      payload: input.executionCapsuleBinding,
      taskID: input.taskID,
      projectID: input.projectID,
      rootDirectory: rootSession.directory,
      packageRevisionSHA256: input.packageRevision.packageDigest,
      timeCreated: input.now,
    })
    insertEngineTask(db, {
      taskID: input.taskID,
      projectID: input.projectID,
      sessionID: input.sessionID,
      requestID: input.requestID,
      source: input.source ?? "api",
      productPillar: input.productPillar,
      title: input.title,
      request: input.request,
      attachments: input.attachments?.length ? input.attachments : undefined,
      priority: input.priority ?? "normal",
      queueOrder: initialQueueOrder(input.priority, input.now),
      budget: budgetRow(input.budget),
      metadata: input.metadata,
      timeStarted: input.queue ? null : input.now,
      timeCreated: input.now,
      timeUpdated: input.now,
    })
    if (input.metadata.actor === "user") {
      ProjectMemory.captureOccurrenceInTransaction(db, {
        occurrenceKind: "task_create",
        occurrenceID: input.taskID,
        projectID: input.projectID,
        sessionID: input.sessionID,
        taskID: input.taskID,
        surface: "task.create",
        timeCreated: input.now,
        text: input.request,
        attachments: input.attachments,
      })
    }
    insertTaskPackageRevisionBinding({
      db,
      taskID: input.taskID,
      packageRevision: input.packageRevision,
      creationExpectedPackageDigest: input.creationExpectedPackageDigest,
      timeCreated: input.now,
    })
    insertTaskProcessBinding({ db, payload: input.executionCapsuleBinding })
    persistPreparedCrossTaskArtifactImports(db, {
      targetTaskID: input.taskID,
      prepared: input.artifactImports ?? [],
      timeCreated: input.now,
    })
    if (input.channelBinding) {
      insertEngineChannelBinding(db, {
        taskID: input.taskID,
        platform: input.channelBinding.platform,
        channel: input.channelBinding.channel,
        thread: input.channelBinding.thread,
        payload: input.channelBinding.payload ?? {},
        timeCreated: input.now,
      })
    }
    insertEngineProgressSnapshot(db, {
      taskID: input.taskID,
      status: progressStatus,
      summary,
      payload: { sessionID: input.sessionID, queue: input.queue },
      timeCreated: input.now,
    })
    Database.effect(() =>
      EngineProtocol.emit(
        Event.TaskCreated,
        {
          taskID: input.taskID,
          status: taskStatus,
          summary,
        },
        { source },
      ),
    )
    if (!input.queue) {
      Database.effect(() =>
        EngineProtocol.emit(
          Event.TaskUpdated,
          {
            taskID: input.taskID,
            status: taskStatus,
            summary,
          },
          { source },
        ),
      )
    }
  })
}
