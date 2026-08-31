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
import { insertEngineTask } from "./task"
import { EngineTaskTable } from "./engine.sql"
import { TaskGlobalProjectBindingError } from "./task-project-error"
import {
  persistPreparedCrossTaskArtifactImports,
  type CrossTaskArtifactSourceAuthorityReceipt,
  type PreparedCrossTaskArtifactImport,
} from "./cross-task-artifact-import"
import { insertTaskPackageRevisionBinding } from "./task-package-revision-binding"
import {
  assertTaskProcessBindingCreation,
  insertTaskProcessBinding,
  type TaskProcessBindingPayload,
} from "./task-execution-capsule-binding"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Session } from "@/session"
import { ProjectMemory } from "@/memory/project-memory"
import { acceptTaskRootIngressInTransaction, DEFAULT_TASK_ROOT_INGRESS_POLICY } from "./task-root-fact-store"
import { appendTaskOpenedInTransaction } from "./task-lifecycle"
import {
  insertTaskCreationContract,
  type TaskCreationContractFact,
} from "./task-creation-contract"

const log = Log.create({ service: "engine-pipeline" })

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BudgetInput = z.infer<typeof CreateTaskInput>["budget"]
type PriorityInput = z.infer<typeof CreateTaskInput>["priority"]
type ChannelBindingInput = z.infer<typeof CreateTaskInput>["channelBinding"]

// ---------------------------------------------------------------------------
// persistTask — fast-path for POST /task (<10ms)
// The active Task occurrence and its first durable root-Session ingress commit
// together. Host does not serialize Tasks; the model owns Task creation order.
// ---------------------------------------------------------------------------

export type PersistTaskInput = {
  taskID: string
  rootSession: Session.Info
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
  artifactImports?: readonly PreparedCrossTaskArtifactImport[]
  artifactImportAuthorities?: readonly CrossTaskArtifactSourceAuthorityReceipt[]
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
  creationExpectedPackageDigest?: string
  executionCapsuleBinding: TaskProcessBindingPayload
  creationContract: TaskCreationContractFact
  acceptanceCommit?: (db: Database.TxOrDb) => void
}

export function persistTask(input: PersistTaskInput) {
  if (input.projectID === "global") {
    throw new TaskGlobalProjectBindingError({
      message: `Refusing to persist task ${input.taskID} under project global. Task persistence requires a concrete Git project.`,
      taskID: input.taskID,
      projectID: input.projectID,
    })
  }
  const summary = "Task started"
  const source = "pipeline.active"
  return Database.transaction((db) => {
    if (input.rootSession.projectID !== input.projectID) {
      throw new Error(`Task ${input.taskID} root Session conflicts with its creation Project`)
    }
    // The root Session and the Task aggregate commit in this one transaction:
    // an interrupted Task request can never leave a visible ownerless root
    // Session behind, and the Session events publish only after this commit.
    Session.persistPreparedNextInTransaction(db, input.rootSession)
    assertTaskProcessBindingCreation({
      payload: input.executionCapsuleBinding,
      taskID: input.taskID,
      projectID: input.projectID,
      rootDirectory: input.rootSession.directory,
      packageRevisionSHA256: input.packageRevision.packageDigest,
      timeCreated: input.now,
    })
    insertEngineTask(db, {
      taskID: input.taskID,
      projectID: input.projectID,
      sessionID: input.rootSession.id,
      requestID: input.requestID,
      source: input.source ?? "api",
      productPillar: input.productPillar,
      title: input.title,
      request: input.request,
      attachments: input.attachments?.length ? input.attachments : undefined,
      priority: input.priority ?? "normal",
      budget: budgetRow(input.budget),
      metadata: input.metadata,
      timeCreated: input.now,
    })
    insertTaskCreationContract(db, {
      taskID: input.taskID,
      fact: input.creationContract,
      timeCreated: input.now,
    })
    if (input.metadata.actor === "user") {
      ProjectMemory.captureOccurrenceInTransaction(db, {
        occurrenceKind: "task_create",
        occurrenceID: input.taskID,
        projectID: input.projectID,
        sessionID: input.rootSession.id,
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
      authorities: input.artifactImportAuthorities,
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
    const task = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
    if (!task) throw new Error(`Task ${input.taskID} disappeared during active occurrence creation`)
    appendTaskOpenedInTransaction({
      db,
      taskID: input.taskID,
      sessionID: input.rootSession.id,
      now: input.now,
      source: "engine.pipeline",
    })
    const initialIngressID = acceptTaskRootIngressInTransaction(db, {
      taskID: input.taskID,
      executionEpoch: 1,
      source: "task",
      sourceID: input.taskID,
      ...DEFAULT_TASK_ROOT_INGRESS_POLICY,
      now: input.now,
    }).id
    input.acceptanceCommit?.(db)
    Database.effect(() =>
      EngineProtocol.emit(
        Event.TaskCreated,
        {
          taskID: input.taskID,
          summary,
        },
        { source },
      ),
    )
    // No scan is requested here on purpose. Task creation is not complete at
    // this commit — the Orchestrator Session and its runtime authority are
    // established afterwards — and the creation ingress is woken by the Task
    // API once they exist. Signalling here would race the activation ahead of
    // the authority it needs.
    return initialIngressID
  })
}
