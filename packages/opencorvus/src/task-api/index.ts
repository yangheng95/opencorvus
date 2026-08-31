import z from "zod"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { NamedError } from "@opencorvus-ai/util/error"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PromptProfile } from "@/agent/prompt-profile"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { ProjectedWorkerBinding } from "@/agent/projected-worker-binding"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import type { ExpertSquadPackageRevision } from "@/expert-squad/package-revision"
import { ExpertSquadInstallLock } from "@/expert-squad/install-lock"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { resolveAgentModelRef, resolveConfiguredModelRef } from "@/agent/model"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { EffectiveConfig } from "@/config/effective"
import { discoverChecks, resolveConfig, resolvedChecks } from "@/acceptance/checks/discovery"
import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import { CapabilityRules } from "@/capability/rules"
import { PermissionAuthority } from "@/permission/authority"
import { ProtocolStore } from "@/protocol/store"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import {
  assertSchedulerTargetOccurrenceAvailableInTransaction,
  enqueueSchedulerMessageInTransaction,
  deadLetterSchedulerTaskDeliveriesInTransaction,
  deadLetterSchedulerSourceDeliveriesInTransaction,
  detachProtocolEventsFromDeletedTasksInTransaction,
  deadLetterSchedulerSessionDeliveriesInTransaction,
  findSchedulerDelivery,
  renderSchedulerParticipantMessage,
  requireSchedulerDelivery,
  schedulerDeliveryIdentity,
  schedulerTargetOccurrenceIdentity,
  SchedulerTargetOccurrenceStaleError,
  schedulerSourceBodyInTransaction,
  settleSchedulerDeliveryInTransaction,
  type SchedulerDeliveryReceipt,
} from "@/protocol/delivery"
import type { SchedulerEndpoint, SchedulerMessageKind } from "@/protocol/schema"
import { EngineProtocol } from "@/engine/protocol"
import { ensureGitProjectMetadata } from "@/engine/git-project-metadata"
import { Instance } from "@/project/instance"
import type { ProjectDeletionAdmission } from "@/project/instance"
import type { InstanceInit } from "@/project/instance-context"
import {
  runWithInitializedIndependentProject,
  runWithProjectDeletionIdentity,
} from "@/project/independent-project-owner"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { Worktree } from "@/worktree"
import { Question } from "@/question"
import { Session } from "@/session"
import { SessionTable } from "@/session/session.sql"
import { SessionContext } from "@/session/context"
import { Message } from "@/session/message"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { SessionPrompt } from "@/session/prompt"
import { SessionStatus } from "@/session/status"
import {
  Database,
  NotFoundError,
  and,
  eq,
  inArray,
  isNull,
  isSqliteUniqueConstraintError,
  sql,
} from "@/storage/db"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { awaitWithAbort } from "@/util/abort"
import { bindMissionClosingChildTaskCanceller } from "@/mission/execution-close-effects"
import { bindMissionRetentionSessionDeleter } from "@/mission/retention"
import { compileBoard, boardTag } from "@/workbench/board"
import { compileBrief } from "@/workbench/brief"
import {
  EngineArtifactTable,
  EngineGoalTable,
  EngineTaskTable,
  EngineTaskRootIngressTable,
  type EngineInteractionStatus,
  type EngineMetadata,
} from "@/engine/engine.sql"
import { taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { insertEngineArtifact } from "@/engine/artifact"
import { buildObservationCleanupRowsForTask, settleBuildObservationCleanup } from "@/engine/build-observation-cleanup"
import { TaskExpectedPackageDigestConflictError, requireTaskPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { configuredTaskProcessMode, prepareTaskProcessBinding, type TaskProcessBindingPayload } from "@/engine/task-execution-capsule-binding"
import { TaskCreationResolutionSeedSchema, type TaskCreationResolutionSeed } from "@/engine/task-creation-facts"
import { resolveEngineInteractionRequest } from "@/engine/interaction-request"
import {
  deleteEngineTask,
  deleteEngineTasksForProjectSessions,
  setEngineTaskArchived,
  setEngineTaskBudget,
  setEngineTaskPinned,
  setEngineTaskTitle,
} from "@/engine/task"
import { appendTaskRewindClearedInTransaction } from "@/engine/rewind"
import {
  Budget,
  CreateTaskInput,
  Event,
  AgentSessionOperatorSteerInput,
  RejectInteractionInput,
  ReplyInteractionInput,
  UserRejectInteractionInput,
  UserReplyInteractionInput,
  TaskMessageInput,
  TaskBrief,
  CheckConfig,
  ReplaceGoalContractInput,
  UpdateGoalTitleInput,
  UpdateTaskChecksInput,
} from "@/engine/model"
import { budgetRow, deriveTitle, progressStatus } from "@/engine/helpers"
import { orchestratorState } from "@/engine/orchestrator-state"
import { writeTaskChecks } from "@/engine/checks"
import {
  deliverTaskRootIngress,
  dispatchPersistedTaskLoop,
  requestTaskControlScanInBackground,
  dispatchTaskLoop,
  persistTaskRootMessageIngressInTransaction,
  persistMissionAcceptanceResumeIngressInTransaction,
  requireTaskCreationIngressID,
  taskRootIngressDebugProjection,
  taskRootIngressStats,
  type DispatchTaskLoopResult,
  taskCwd,
} from "@/engine/task-root-ingress-delivery"
import { openTaskForContinuationInTransaction } from "@/engine/task-intent-open"
import {
  applyGoalGraphMutationInTransaction,
  recordTaskInfrastructureError,
  type ApplyGoalGraphMutationInput,
} from "@/engine/persist"
import { EngineInteraction } from "@/engine/interaction"
import { terminalTask } from "@/engine/state"
import { prepareTaskAttachmentAppends, type TaskInputFileRef } from "@/engine/task-file-reference"
import { requireTaskInCurrentProject } from "@/engine/task-project-read"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision-read"
import {
  requireCurrentTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import { sameTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference-schema"
import {
  deriveTaskStatus,
  isTaskActive,
  isTaskCancelled,
  isTaskCompleted,
  isTaskFailed,
  isTaskTerminal,
} from "@/engine/task-status"
import { persistTask } from "@/engine/pipeline"
import { SessionPromptState } from "@/session/prompt/state"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { createExecutionCancellationOrigin, type ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { ProjectMemory } from "@/memory/project-memory"
import {
  SchedulerDeliveryReference,
  TaskRootMessageKind,
  TaskRootMessageProvenance,
  type SchedulerDeliveryReference as SchedulerDeliveryReferenceValue,
} from "@/protocol/task-root-message-schema"
import { deliverTaskRootMessageToOrchestratorSession, getTaskRootMessage } from "./task-root-message"
import {
  assertNoCallerSuppliedTaskCreatorMetadata,
  assertMissionTaskCreationOpenedOccurrence,
  assertMissionTaskCreationOpenedOccurrenceInTransaction,
  assertTaskCreatorExpertSquadAuthority,
  TaskCreator,
  TaskCreatorMetadata,
  projectTaskCreatorMetadata,
  resolveTaskCreator,
} from "./task-creator"
import {
  assertSessionPromptSubtreeFinished,
  requestSessionPromptSubtreeCancellation,
} from "@/engine/cancellation-scope"
import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import {
  TaskCancellationOrigin,
  type TaskCancellationOrigin as TaskCancellationOriginValue,
} from "@/engine/cancellation-origin"
import {
  findPendingTaskCancellationRequestEvent,
  pendingTaskCancellationProjection,
  taskCancellationProjection,
} from "@/engine/cancellation-projection"
import { requestTaskAgentLifecycleCancellation } from "@/engine/task-agent-lifecycle"
import {
  createOperatorSteerCoordinationRequest,
  resolveAgentCoordinationSessionLineage,
} from "@/engine/agent-coordination"
import { createDecisionLog } from "@/decision-log"
import { OperatorSteerTargetError } from "@/orchestrator/operator-steer"
import { projectPersistedTaskMessage, type ProjectedTaskMessage } from "@/orchestrator/protocol/message-bridge"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { sessionRole, taskIDForSession } from "@/engine/task-session-lineage"
import {
  findInteractionByExternal,
  findTask,
  listGlobalTasks,
  listProjectTasks,
  listTaskRows,
  searchProjectTasks,
  listCurrentGoals,
  listInteractions,
  listSnapshots,
  requireInteraction,
  requireTask,
  viewInteraction,
  viewSnapshot,
  viewTask,
  viewTaskListTask,
  type GoalRow,
  type TaskListRow,
  type TaskRow,
  type InteractionRow,
  projectTaskRowInTransaction,
  projectTaskRowsInTransaction,
  taskDeletedInTransaction,
} from "@/engine/store"
import { listOwnedPromptSessionsForTask } from "@/engine/runtime"
import {
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  releaseControlLeaseOnErrorPath,
  renewControlLeaseInTransaction,
} from "@/engine/control-lease"
import { Identifier } from "@/id/id"
import {
  acceptanceGapEvidenceLocators,
  MissionAcceptanceGapSchema,
  renderMissionAcceptanceRepairMessage,
  type MissionAcceptanceGap,
} from "@/mission/acceptance-gap"
import { appendTaskAcceptanceLedgerRevisionInTransaction } from "@/mission/acceptance-ledger"
import { AttachmentStore } from "@/storage/attachment-store"
import { SessionWake } from "@/session/wake"
import { IntentBundle } from "@/intent/bundle"
import { taskRootDirectory } from "@/engine/task-directory"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { removeTaskArtifactRoot } from "@/task-artifact/store"
import {
  buildTaskCreationContractFact,
  buildTaskCreationRequestFact,
  assertGlobalTaskChannelClaimAvailable,
  canonicalInlineUploadAttachment,
  panelTaskCreationCallerInput,
  resolveTaskCreationClaims,
  taskCreationCallerRequest,
  type TaskCreationCallerInput,
  type TaskCreationClaims,
} from "@/engine/task-creation-contract"
import { PersistedTaskCreationCreator } from "@/engine/task-creation-creator"
import { expertSquadPackageRevisionBinding } from "@/engine/expert-squad-package-revision-binding"
import { artifactCatalogAuthority, readTaskArtifact, searchTaskArtifacts } from "@/artifact-catalog"
import {
  ArtifactReadInputSchema,
  ArtifactReadLocatorSchema,
  artifactReadLocatorKey,
  type ArtifactReadInput,
  type ArtifactReadLocator,
  type ArtifactSearchRequest,
} from "@opencorvus-ai/plugin/artifact-catalog"
import {
  importsFromMappings,
  importsFromResolvedCrossTaskArtifactSources,
  listCrossTaskArtifactImportMappings,
  prepareCrossTaskArtifactSourceImports,
  resolveCrossTaskArtifactSources,
  requireMissionArtifactSourceAuthority,
  requireMissionTaskLineageAuthority,
  sameCrossTaskArtifactImportSet,
  type CrossTaskArtifactImporter,
} from "@/engine/cross-task-artifact-import"

type ResolvedTaskCreationAuthority = Awaited<ReturnType<typeof resolveTaskCreator>>

const log = Log.create({ service: "assistant" })

type TaskMessageWakeStatus = Extract<DispatchTaskLoopResult, "accepted"> | "not_woken"

export const TaskEmptyMessageError = NamedError.create(
  "TaskEmptyMessageError",
  z.object({
    message: z.string(),
    taskID: z.string(),
  }),
)

export const ExternalChildTaskLineageError = NamedError.create(
  "ExternalChildTaskLineageError",
  z.object({
    message: z.string(),
    source: z.string().optional(),
  }),
)

export const TaskArtifactDeletionCommittedError = NamedError.create(
  "TaskArtifactDeletionCommittedError",
  z.object({
    message: z.string(),
    committed: z.literal(true),
    taskIDs: z.array(z.string()),
    residuePaths: z.array(z.string()),
  }),
)

export const TaskCancellationLifecycleConflictError = NamedError.create(
  "TaskCancellationLifecycleConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    lifecycle: z.enum(["completed", "failed"]),
  }),
)

export const MissionTaskResumeLifecycleConflictError = NamedError.create(
  "MissionTaskResumeLifecycleConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    reviewedTerminalLifecycleReference: TerminalLifecycleReferenceSchema,
    currentTerminalLifecycleReference: TerminalLifecycleReferenceSchema.optional(),
    currentLifecycle: z.enum(["active", "completed", "failed", "cancelled"]),
  }),
)

export const MissionTaskResumeEvidenceError = NamedError.create(
  "MissionTaskResumeEvidenceError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    unreadEvidenceLocators: z.array(ArtifactReadLocatorSchema),
  }),
)

const MissionTaskResumeReceiptSchema = z
  .object({
    protocol: z.literal("mission-acceptance-resume-receipt"),
    task_id: z.string().min(1),
    mission_id: z.string().min(1),
    mission_session_id: z.string().min(1),
    panel_message_id: z.string().min(1),
    tool_call_id: z.string().min(1),
    tool_part_id: z.string().min(1),
    message_id: z.string().min(1),
    wake_id: z.string().min(1),
    ingress_artifact_id: z.string().min(1),
    acceptance_ledger_revision_artifact_id: z.string().min(1),
    prior_terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
    acceptance_gap: MissionAcceptanceGapSchema,
    time_accepted: z.number().int().positive(),
  })
  .strict()

/**
 * A Session cannot be physically deleted while a Task still owns it as its
 * root execution Session. The caller must explicitly delete the bound Task so
 * the Task row and Session tree settle atomically.
 */
export const TaskBoundSessionDeletionError = NamedError.create(
  "TaskBoundSessionDeletionError",
  z.object({
    message: z.string(),
    sessionID: z.string(),
    taskIDs: z.array(z.string()),
  }),
)

export const TaskArtifactImportIdempotencyConflictError = NamedError.create(
  "TaskArtifactImportIdempotencyConflictError",
  z.object({
    message: z.string(),
    requestID: z.string(),
    taskID: z.string(),
  }),
)

function selectedTaskProfileID(input: z.infer<typeof CreateTaskInput>, snapshot: Config.Info): string {
  const config = Config.mergeOverlay(snapshot, {
    ...(input.model ? { model: input.model } : {}),
    ...(input.promptProfile ? { prompt_profile: { active: input.promptProfile } } : {}),
  })
  return PromptProfile.activeID(config)
}

function assertCurrentMissionTaskCreationAuthority(creator: ResolvedTaskCreationAuthority): void {
  if (creator.actor !== "mission") return
  assertMissionTaskCreationOpenedOccurrence({
    sessionID: creator.sessionID,
    openedOccurrence: creator.openedOccurrence,
  })
}

function persistTaskWithCreatorAuthority(
  creator: ResolvedTaskCreationAuthority,
  input: Parameters<typeof persistTask>[0],
): ReturnType<typeof persistTask> {
  if (creator.actor !== "mission") return persistTask(input)
  return Database.immediateTransaction(() => {
    assertMissionTaskCreationOpenedOccurrenceInTransaction({
      sessionID: creator.sessionID,
      openedOccurrence: creator.openedOccurrence,
    })
    return persistTask(input)
  })
}

function hasCallerSuppliedChildTaskLineage(input: z.infer<typeof CreateTaskInput>) {
  const metadata = input.metadata
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false
  return Object.prototype.hasOwnProperty.call(metadata, "parent_task_id")
}

function assertNoCallerSuppliedChildTaskLineage(input: z.infer<typeof CreateTaskInput>) {
  if (!hasCallerSuppliedChildTaskLineage(input)) return
  throw new ExternalChildTaskLineageError({
    message:
      "metadata.parent_task_id is retired server metadata. Task creation callers must keep repair and continuation work inside the existing Task.",
    source: input.source,
  })
}

async function assertTaskRootSessionLineageInCurrentProject(task: TaskRow): Promise<Session.Info> {
  if (!task.session_id) {
    throw new Error(`Task ${task.id} has no root session; cannot use task-root session context.`)
  }
  const current = Instance.current()
  const projectID = current?.project.id ?? task.project_id
  return Session.assertLineageInProject({ sessionID: task.session_id, projectID })
}

async function provideTaskRootSessionInstance<T>(task: TaskRow, fn: () => Promise<T>): Promise<T> {
  if (!task.session_id) return fn()
  const session = await Session.assertLineageInProject({ sessionID: task.session_id, projectID: task.project_id })
  if (Instance.current()) return fn()
  return Instance.provide({ directory: session.directory, fn })
}

async function provideActiveTaskRootSessionInstance<T>(
  task: TaskRow,
  fn: () => Promise<T>,
  signal?: AbortSignal,
  projectDeletionAdmission?: ProjectDeletionAdmission,
): Promise<T | undefined> {
  signal?.throwIfAborted()
  if (!task.session_id) return fn()
  const session = await Session.assertLineageInProject({ sessionID: task.session_id, projectID: task.project_id })
  signal?.throwIfAborted()
  const operation = Instance.current()
    ? fn()
    : Instance.tryProvideActive({
        directory: session.directory,
        projectDeletionAdmission,
        fn: () => {
          signal?.throwIfAborted()
          return fn()
        },
      })
  return await awaitWithAbort(operation, signal)
}

async function awaitTaskRootIngressSettled(task: TaskRow, inactivityTimeoutMs: number): Promise<void> {
  if (!task.session_id) return
  try {
    await SessionPromptState.waitForTaskRootIngressIdle(task.session_id, inactivityTimeoutMs)
  } catch (cause) {
    throw createTaskCancellationIncomplete({
      taskID: task.id,
      handle: "Task root ingress settlement before destructive operation",
      cause,
    })
  }
}

async function settleTaskSessionWork(
  task: TaskRow,
  input: {
    reason: string
    handle: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
  },
  options?: DestructiveTaskOptions,
): Promise<string[]> {
  const lifecycle = await requestTaskAgentLifecycleCancellation({
    task,
    reason: input.reason,
    handle: input.handle,
    origin: input.origin,
  })
  await assertSessionPromptSubtreeFinished({
    sessions: lifecycle.cancelledSessions,
    failures: lifecycle.cancellationFailures,
    taskID: task.id,
    handle: input.handle,
    inactivityTimeoutMs: options?.promptSettleInactivityMs,
    projectDeletionAdmission: options?.projectDeletionAdmission,
    publishTerminalStatus: false,
  })
  return lifecycle.sessionIDs
}

function deleteSettledSessionTreeRows(
  tx: Database.TxOrDb,
  input: { sessionID: string; projectID: string; expectedSessionIDs: string[] },
): void {
  Session.deleteExactTreeInProject(tx, input)
}

function appendTaskDeletedBoundaryInTransaction(db: Database.TxOrDb, task: TaskRow): void {
  const existing = db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "task"),
        eq(ProtocolEventTable.aggregate_id, task.id),
        eq(ProtocolEventTable.type, Event.TaskDeleted.type),
      ),
    )
    .get()
  if (existing) return
  const lifecycle = taskLifecycleProjectionInTransaction(db, task.id)
  EngineProtocol.emitInTransaction(
    Event.TaskDeleted,
    { taskID: task.id, executionEpoch: lifecycle.epoch, summary: "Task deleted by explicit operator action" },
    { source: "task.delete", taskID: task.id },
  )
  const project = db
    .select({ id: ProjectTable.id, directory: ProjectTable.worktree })
    .from(ProjectTable)
    .where(eq(ProjectTable.id, task.project_id))
    .get()
  if (!project) throw new Error(`Task ${task.id} Project ${task.project_id} is missing during deletion publication`)
  Bus.publishProjectOwnedInTransaction(
    Event.TaskDeleted,
    {
      taskID: task.id,
      executionEpoch: lifecycle.epoch,
      summary: "Task deleted by explicit operator action",
    },
    { projectID: project.id, directory: Filesystem.resolve(project.directory) },
  )
}

function appendSessionDeletedBoundaryInTransaction(db: Database.TxOrDb, sessionID: string): void {
  const existing = db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, sessionID),
        eq(ProtocolEventTable.type, "session.deleted"),
      ),
    )
    .get()
  if (existing) return
  ProtocolStore.appendEventInTransaction({
    kind: "event",
    type: "session.deleted",
    aggregate: "session",
    aggregate_id: sessionID,
    source: "session.delete",
    payload: null,
  })
}

function assertTasksRemainTerminalForPhysicalDelete(db: Database.TxOrDb, tasks: readonly TaskRow[]): void {
  for (const expected of tasks) {
    const persisted = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, expected.id)).get()
    const current = persisted ? projectTaskRowInTransaction(db, persisted) : undefined
    if (
      !current ||
      current.project_id !== expected.project_id ||
      current.session_id !== expected.session_id ||
      !isTaskTerminal(current)
    ) {
      throw createTaskCancellationIncomplete({
        taskID: expected.id,
        handle: `physical Task deletion ${expected.id}`,
        cause: "Task identity changed or the Task was reopened after execution settlement",
      })
    }
  }
}

type TaskCleanupTarget = {
  taskID: string
  taskArtifactDirectory: string
  intentProjectDirectory: string
  cleanupOwners: ReturnType<typeof buildObservationCleanupRowsForTask>
}

function taskCleanupTarget(task: Pick<TaskRow, "id" | "project_id" | "session_id">): TaskCleanupTarget {
  const project = Project.get(task.project_id)
  if (!project) throw new Error(`Task ${task.id} has no owning Project for physical retention`)
  return {
    taskID: task.id,
    taskArtifactDirectory: taskRootDirectory(task),
    intentProjectDirectory: project.worktree,
    cleanupOwners: buildObservationCleanupRowsForTask(task.id),
  }
}

async function deleteRowsThenTaskArtifacts(tasks: readonly TaskRow[], deleteRows: () => void): Promise<void> {
  const cleanupTargets = tasks
    .map(taskCleanupTarget)
    .sort((left, right) => left.taskID.localeCompare(right.taskID))
  await settleTaskCleanupOwners(cleanupTargets)
  deleteRows()
  const cleanupFailures: unknown[] = []
  const residuePaths: string[] = []
  for (const target of cleanupTargets) {
    const removals = await Promise.allSettled([
      removeTaskArtifactRoot({ taskID: target.taskID, projectDirectory: target.taskArtifactDirectory }),
      IntentBundle.removeProjection({ taskID: target.taskID, projectDirectory: target.intentProjectDirectory }),
    ])
    if (removals[0].status === "rejected") {
      cleanupFailures.push(removals[0].reason)
      residuePaths.push(ProjectRuntimePaths.taskArtifactRoot(target.taskArtifactDirectory, target.taskID))
    }
    if (removals[1].status === "rejected") {
      cleanupFailures.push(removals[1].reason)
      residuePaths.push(ProjectRuntimePaths.intentPaths(target.intentProjectDirectory, target.taskID).absolute)
    }
  }
  if (cleanupFailures.length > 0) {
    const taskIDs = tasks.map((task) => task.id).sort()
    const cause = new AggregateError(
      cleanupFailures,
      "Task rows were committed as deleted but TaskArtifact cleanup failed",
    )
    throw new TaskArtifactDeletionCommittedError(
      {
        message:
          `Task rows ${taskIDs.join(", ")} were deleted, but ${cleanupFailures.length} ` +
          "TaskArtifact cleanup operation(s) failed.",
        committed: true,
        taskIDs,
        residuePaths: residuePaths.sort(),
      },
      { cause },
    )
  }
}

async function settleTaskCleanupOwners(
  cleanupTargets: readonly TaskCleanupTarget[],
): Promise<void> {
  // Cleanup owners remain immutable facts after a Task tombstone. Resolve all
  // pending/retained physical ref ownership before recording that boundary.
  for (const target of cleanupTargets) {
    for (const owner of target.cleanupOwners) {
      await settleBuildObservationCleanup({
        observationID: owner.observation_id,
        releaseRetained: true,
      })
    }
  }
}

async function removeTombstonedIntentProjections(cleanupTargets: readonly TaskCleanupTarget[]): Promise<void> {
  const removals = await Promise.allSettled(
    cleanupTargets.map((target) =>
      IntentBundle.removeProjection({ taskID: target.taskID, projectDirectory: target.intentProjectDirectory }),
    ),
  )
  const failures = removals
    .map((result, index) => result.status === "rejected" ? { cause: result.reason, target: cleanupTargets[index]! } : undefined)
    .filter((item): item is { cause: unknown; target: TaskCleanupTarget } => Boolean(item))
  if (failures.length === 0) return
  throw new TaskArtifactDeletionCommittedError(
    {
      message: `Task deletion committed, but ${failures.length} intent projection cleanup operation(s) failed.`,
      committed: true,
      taskIDs: failures.map((item) => item.target.taskID).sort(),
      residuePaths: failures
        .map((item) => ProjectRuntimePaths.intentPaths(item.target.intentProjectDirectory, item.target.taskID).absolute)
        .sort(),
    },
    { cause: new AggregateError(failures.map((item) => item.cause), "Intent projection cleanup failed") },
  )
}

function requireGoalInCurrentProject(goalID: string): GoalRow {
  const row = Database.use((db) => db.select().from(EngineGoalTable).where(eq(EngineGoalTable.id, goalID)).get())
  if (!row) throw new NotFoundError({ message: `Goal not found: ${goalID}` })
  requireTaskInCurrentProject(row.task_id)
  return row
}

function requireInteractionInCurrentProject(interactionID: string): InteractionRow {
  const row = requireInteraction(interactionID)
  requireTaskInCurrentProject(row.task_id)
  return row
}

async function requireSessionTraceTaskInCurrentProject(sessionID: string): Promise<string> {
  const current = Instance.current()
  if (current) await Session.getInProject({ sessionID, projectID: current.project.id })
  else await Session.get(sessionID)

  const taskID = taskIDForSession(sessionID)
  if (!taskID) throw new NotFoundError({ message: `Session ${sessionID} is not bound to a task trace` })
  requireTaskInCurrentProject(taskID)
  return taskID
}

/**
 * Per-call inactivity window for owned SessionPrompt cancellation during cancelTask.
 * A prompt controller that does not settle prevents truthful cancellation.
 * Expiry is fatal to cancellation success: callers surface
 * TaskCancellationIncompleteError instead of marking an executing Task cancelled.
 * Tests can override via CancelTaskOptions.
 */
export const CANCEL_PROMPT_SETTLE_INACTIVITY_MS = 5_000

/**
 * Inactivity window for ingress and prompt settlement. Any observable ingress/session
 * activity renews the window; this is not a wall-clock cancellation deadline.
 */
export const CANCEL_INGRESS_SETTLE_INACTIVITY_MS = 60_000

function missionTaskTitleInput(input: z.infer<typeof CreateTaskInput>):
  | {
      missionID: string
      sessionID: string
      semanticTitle: string
    }
  | undefined {
  const creator = TaskCreatorMetadata.parse(input.metadata)
  if (creator.actor !== "mission") return undefined
  const semanticTitle = input.title?.trim().replace(/\s+/g, " ")
  if (!semanticTitle) {
    throw new Error(
      "Mission task creation requires title. " +
        "Provide a short semantic title; EngineService formats the Mission ledger prefix.",
    )
  }
  return { missionID: creator.mission.id, sessionID: creator.mission.session_id, semanticTitle }
}

function resolveTaskTitle(input: z.infer<typeof CreateTaskInput>): string {
  const mission = missionTaskTitleInput(input)
  if (mission) return mission.semanticTitle
  return input.title?.trim() || deriveTitle(input.request)
}

export interface TaskCancellationSettlementOptions {
  /** Override prompt-settle inactivity (ms). Tests use this to keep zombie checks small. */
  promptSettleInactivityMs?: number
  /** Override durable-ingress settlement inactivity (ms). */
  ingressSettleInactivityMs?: number
}

export interface CancelTaskOptions extends TaskCancellationSettlementOptions {
  origin: TaskCancellationOriginValue
  projectDeletionAdmission?: ProjectDeletionAdmission
}

type TaskCancellationOperation = {
  promise: Promise<boolean>
  options: CancelTaskOptions
}

const cancellationOperations = new Map<string, TaskCancellationOperation>()
const CANCELLATION_CONVERGENCE_LEASE_MS = 10_000
const CANCELLATION_CONVERGENCE_HEARTBEAT_MS = 2_000
let cancellationConvergenceHeartbeatFailureForTest: "zero-row" | "exception" | undefined
let beforeLateCancellationStageForTest:
  | ((input: { signal: AbortSignal; failHeartbeat(mode: "zero-row" | "exception"): void }) => void | Promise<void>)
  | undefined

export const TaskCancellationConvergenceTestHooks = {
  failNextHeartbeat(mode: "zero-row" | "exception"): Disposable {
    if (cancellationConvergenceHeartbeatFailureForTest) {
      throw new Error("Task cancellation convergence heartbeat failure is already armed")
    }
    cancellationConvergenceHeartbeatFailureForTest = mode
    return {
      [Symbol.dispose]() {
        cancellationConvergenceHeartbeatFailureForTest = undefined
      },
    }
  },
  installBeforeLateStage(
    hook: (input: { signal: AbortSignal; failHeartbeat(mode: "zero-row" | "exception"): void }) => void | Promise<void>,
  ): Disposable {
    if (beforeLateCancellationStageForTest) throw new Error("Task cancellation late-stage hook is already installed")
    beforeLateCancellationStageForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeLateCancellationStageForTest === hook) beforeLateCancellationStageForTest = undefined
      },
    }
  },
}

async function acquireCancellationConvergence(taskID: string) {
  // The durable lease guarantees some process eventually acquires, so waiting
  // forever only hides a stuck owner. Past this deadline the caller fails, the
  // control-plane scan paces the Task under backoff, and a later scan retries.
  const deadline = Date.now() + 3 * CANCELLATION_CONVERGENCE_LEASE_MS
  for (;;) {
    const now = Date.now()
    const claimed = Database.immediateTransaction((db) => {
      const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
      if (lifecycle.status === "cancelled") return undefined
      if (lifecycle.status !== "cancelling" || !lifecycle.requestEventID) {
        throw new Error(`Task ${taskID} has no durable cancellation request to converge`)
      }
      const activationID = Identifier.ascending("activity")
      const ownerOccurrenceID = `task-cancellation:${process.pid}:${randomUUID()}`
      const acquired = acquireControlLeaseInTransaction(db, {
        target: "lifecycle",
        targetID: lifecycle.requestEventID,
        ownerOccurrenceID,
        now,
        leaseMilliseconds: CANCELLATION_CONVERGENCE_LEASE_MS,
        leaseID: activationID,
      })
      if (!acquired.acquired) return false
      return { activationID: acquired.lease.id, ownerOccurrenceID, requestEventID: lifecycle.requestEventID }
    })
    if (claimed === undefined) return undefined
    if (claimed) {
      const leaseFence = new AbortController()
      const renew = () => {
        if (leaseFence.signal.aborted) return
        const injectedFailure = cancellationConvergenceHeartbeatFailureForTest
        cancellationConvergenceHeartbeatFailureForTest = undefined
        try {
          if (injectedFailure === "exception")
            throw new Error("injected Task cancellation convergence heartbeat failure")
          const renewedAt = Date.now()
          Database.immediateTransaction((db) =>
            renewControlLeaseInTransaction(db, {
              target: "lifecycle",
              targetID: claimed.requestEventID,
              leaseID: claimed.activationID,
              ownerOccurrenceID:
                injectedFailure === "zero-row" ? `${claimed.ownerOccurrenceID}:stale` : claimed.ownerOccurrenceID,
              now: renewedAt,
              expiresAt: renewedAt + CANCELLATION_CONVERGENCE_LEASE_MS,
            }),
          )
        } catch (error) {
          leaseFence.abort(error)
        }
      }
      const heartbeat = setInterval(renew, CANCELLATION_CONVERGENCE_HEARTBEAT_MS)
      heartbeat.unref?.()
      if (cancellationConvergenceHeartbeatFailureForTest) renew()
      return {
        signal: leaseFence.signal,
        failHeartbeatForTest(mode: "zero-row" | "exception") {
          if (cancellationConvergenceHeartbeatFailureForTest) {
            throw new Error("Task cancellation convergence heartbeat failure is already armed")
          }
          cancellationConvergenceHeartbeatFailureForTest = mode
          renew()
        },
        assertActive() {
          leaseFence.signal.throwIfAborted()
          try {
            Database.use((db) =>
              assertControlLeaseInTransaction(db, {
                target: "lifecycle",
                targetID: claimed.requestEventID,
                leaseID: claimed.activationID,
                ownerOccurrenceID: claimed.ownerOccurrenceID,
                now: Date.now(),
              }),
            )
          } catch (cause) {
            const error = new Error(`Task ${taskID} cancellation convergence owner lease is no longer authoritative`, {
              cause,
            })
            leaseFence.abort(error)
            throw error
          }
        },
        assertInTransaction(db: Database.TxOrDb) {
          leaseFence.signal.throwIfAborted()
          assertControlLeaseInTransaction(db, {
            target: "lifecycle",
            targetID: claimed.requestEventID,
            leaseID: claimed.activationID,
            ownerOccurrenceID: claimed.ownerOccurrenceID,
            now: Date.now(),
          })
        },
        close() {
          clearInterval(heartbeat)
          // This convergence is settled, so its owner is done. Holding the
          // activation until expiry is what makes the next cancellation wait
          // out the lease in a hundred-millisecond poll instead of taking it.
          // close() runs in a finally, so a handback failure must not replace
          // the path's own error — but one that silently did not take returns
          // the next cancellation to exactly that poll, so say so.
          const handback = releaseControlLeaseOnErrorPath({
            target: "lifecycle",
            targetID: claimed.requestEventID,
            leaseID: claimed.activationID,
            ownerOccurrenceID: claimed.ownerOccurrenceID,
            now: Date.now(),
          })
          if (!handback.released && !handback.error) {
            log.warn("task cancellation convergence lease was already gone at close", {
              taskID,
              requestEventID: claimed.requestEventID,
            })
          }
        },
      }
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Task ${taskID} cancellation convergence is held by another owner that did not release within ` +
          `${3 * CANCELLATION_CONVERGENCE_LEASE_MS}ms`,
      )
    }
    await Bun.sleep(100)
  }
}

export interface DestructiveTaskOptions extends TaskCancellationSettlementOptions {
  origin?: TaskCancellationOriginValue
  projectID?: string
  projectDeletionAdmission?: ProjectDeletionAdmission
}

function physicalTaskCancellationOrigin(input: {
  origin?: TaskCancellationOriginValue
  defaultSource: "task.delete" | "task.archive" | "session.delete"
  defaultSurface: string
  defaultReason: string
  taskID?: string
  targetSessionID?: string
}): ExecutionCancellationOrigin {
  if (!input.origin) {
    return createExecutionCancellationOrigin({
      actor: "user",
      source: input.defaultSource,
      surface: input.defaultSurface,
      reason: input.defaultReason,
      ...(input.taskID ? { taskID: input.taskID } : {}),
      ...(input.targetSessionID ? { targetSessionID: input.targetSessionID } : {}),
    })
  }
  const origin = TaskCancellationOrigin.parse(input.origin)
  return createExecutionCancellationOrigin({
    actor: origin.actor,
    source: origin.source,
    surface: origin.surface,
    requestID: origin.requestID,
    reason: origin.reason,
    ...(input.taskID ? { taskID: input.taskID } : {}),
    ...(input.targetSessionID ? { targetSessionID: input.targetSessionID } : {}),
    ...(origin.missionID ? { missionID: origin.missionID } : {}),
    ...(origin.messageID ? { messageID: origin.messageID } : {}),
    ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
    ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
  })
}

type OperatorSteerDispatch = typeof dispatchTaskLoop

function isOperatorSteerTargetSessionKind(kind: string): boolean {
  return RuntimeTemplateRegistry.isWorkerSessionKind(kind)
}

async function resolveOperatorSteerTarget(input: { task: TaskRow; sessionID: string }): Promise<{
  session: Awaited<ReturnType<typeof Session.get>>
  agent: string
  workerBinding: ProjectedWorkerBinding
}> {
  await assertTaskRootSessionLineageInCurrentProject(input.task)
  const session = await Session.assertLineageInProject({
    sessionID: input.sessionID,
    projectID: input.task.project_id,
  })
  const owningTask = taskIDForSession(session.id)
  if (owningTask && owningTask !== input.task.id) {
    throw new OperatorSteerTargetError({
      message: `operatorSteerAgentSession: session ${session.id} belongs to task ${owningTask}, not ${input.task.id}.`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "foreign_task",
    })
  }
  if (input.task.session_id === session.id || session.kind === "root") {
    throw new OperatorSteerTargetError({
      message: `operatorSteerAgentSession: session ${session.id} is the task root; use the task message route for task-level operator input.`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "task_root",
    })
  }
  if (session.kind === "orchestrator") {
    throw new OperatorSteerTargetError({
      message: `operatorSteerAgentSession: session ${session.id} is an orchestrator session, not a target sub-agent session.`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "orchestrator_session",
    })
  }
  if (!isOperatorSteerTargetSessionKind(session.kind)) {
    throw new OperatorSteerTargetError({
      message: `operatorSteerAgentSession: session ${session.id} kind=${session.kind} is not an agent-owned worker session.`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "invalid_kind",
    })
  }

  let persistedTarget: ReturnType<typeof WorkerTurnDescriptor.latestProjectedBindingForSession>
  try {
    persistedTarget = WorkerTurnDescriptor.latestProjectedBindingForSession({
      sessionID: session.id,
      taskID: input.task.id,
      sessionKind: session.kind,
    })
  } catch (error) {
    throw new OperatorSteerTargetError({
      message:
        error instanceof Error
          ? `operatorSteerAgentSession: ${error.message}`
          : `operatorSteerAgentSession: ${String(error)}`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "descriptor_mismatch",
    })
  }
  if (!persistedTarget) {
    throw new OperatorSteerTargetError({
      message: `operatorSteerAgentSession: session ${session.id} has no persisted WorkerTurnDescriptor identity.`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "descriptor_missing",
    })
  }
  const agent = persistedTarget.binding.identity.agentID
  const workerBinding = persistedTarget.binding
  try {
    resolveAgentCoordinationSessionLineage({
      taskID: input.task.id,
      sessionID: session.id,
    })
  } catch (error) {
    throw new OperatorSteerTargetError({
      message:
        error instanceof Error
          ? `operatorSteerAgentSession: ${error.message}`
          : `operatorSteerAgentSession: ${String(error)}`,
      taskID: input.task.id,
      sessionID: session.id,
      reason: "unowned_session",
    })
  }

  return { session, agent, workerBinding }
}

async function continueTaskMessage(
  taskID: string,
  text: string,
  source: string,
  attachments: AttachmentStore.Reference[] = [],
  metadata?: Record<string, unknown>,
  acceptanceEffects?: (db: Database.TxOrDb) => void,
) {
  const wake = await appendAndWakeTaskOperatorMessage({
    taskID,
    text,
    attachments,
    source,
    metadata,
    acceptanceEffects,
  })

  return {
    mode: "scheduler" as const,
    resumed: wake.resumed,
    wakeStatus: wake.wakeStatus,
    status: deriveTaskStatus(wake.task) as string,
    user_message: wake.userMessage,
  }
}

async function appendAndWakeTaskOperatorMessage(input: {
  taskID: string
  text: string
  attachments?: AttachmentStore.Reference[]
  source: string
  metadata?: Record<string, unknown>
  /** Caller-prepared durable facts that belong to this message's acceptance —
   *  model overlay, attachment references, reopen epoch — committed in the
   *  same transaction as the Message and its ingress. */
  acceptanceEffects?: (db: Database.TxOrDb) => void
}): Promise<{
  task: TaskRow
  userMessage: ProjectedTaskMessage<Message.User>
  resumed: boolean
  wakeStatus: TaskMessageWakeStatus
}> {
  const task = requireTaskInCurrentProject(input.taskID)
  assertTaskOperatorMessageAccepted(task, input.text, input.attachments ?? [])

  const source = input.source
  const bundle = await buildTaskSessionMessageBundle(
    task,
    input.text,
    source,
    "operator",
    input.attachments ?? [],
    input.metadata,
  )
  let ingressArtifactID: string | undefined
  const persisted = await Session.persistMessageWithCommit(bundle, () => {
    Database.use((db) => {
      const now = bundle.info.time.created
      input.acceptanceEffects?.(db)
      appendTaskRewindClearedInTransaction(task.id, now, "service.message")
      EngineProtocol.emitInTransaction(
        Event.TaskMessageRecorded,
        { taskID: task.id, source, summary: "Operator message recorded", messageID: bundle.info.id },
        { taskID: task.id, source: "service.message" },
      )
      ingressArtifactID = persistTaskRootMessageIngressInTransaction(db, {
        task,
        messageID: bundle.info.id,
        kind: "operator",
        now,
      })
    })
  })
  if (persisted.info.role !== "user") {
    throw new Error(`Task-root message ${persisted.info.id} persisted with role=${persisted.info.role}, expected user`)
  }
  if (!ingressArtifactID) throw new Error(`Task ${input.taskID} operator message committed without a wake artifact`)
  const userMessage = projectPersistedTaskMessage({ info: persisted.info, parts: persisted.parts }, task.id)
  const dispatchResult = await dispatchPersistedTaskLoop(input.taskID, ingressArtifactID)
  if (dispatchResult === "ignored") {
    throw new Error(`Task ${input.taskID} operator message was recorded, but the orchestrator wake was ignored.`)
  }

  return {
    task: requireTaskInCurrentProject(input.taskID),
    userMessage,
    resumed: dispatchResult === "accepted",
    wakeStatus: dispatchResult,
  }
}

function assertTaskOperatorMessageAccepted(task: TaskRow, text: string, attachments: readonly unknown[] = []) {
  if (text.trim().length === 0 && attachments.length === 0) {
    throw new TaskEmptyMessageError({
      message: `Task ${task.id} cannot accept an empty task-level message.`,
      taskID: task.id,
    })
  }
}

async function buildTaskSessionMessageBundle(
  task: TaskRow,
  text: string,
  source: string,
  kind: TaskRootMessageKind,
  attachments: AttachmentStore.Reference[] = [],
  metadata?: Record<string, unknown>,
  schedulerDelivery?: SchedulerDeliveryReferenceValue,
  identity?: { messageID: string; textPartID: string; controlID?: string },
) {
  // Rule 7: no silent fallback. A task without a session_id or whose
  // session has lost its agent/model context cannot accept a message —
  // the previous `return undefined` branch let `injectMessage` think the
  // append succeeded, dispatchTaskLoop fired, and the operator's text
  // was never visible to the orchestrator (memory:
  // feedback_task_terminal_state_revivable.md, second wedge variant).
  // Throw so the caller surfaces the real failure instead of pretending
  // the message landed.
  if (!task.session_id) {
    throw new Error(
      `Task ${task.id} has no root session — cannot append operator message; recreate the task or repair task.session_id`,
    )
  }
  const ctx = await messageContext(task.session_id, task.id)
  if (!ctx) {
    throw new Error(
      `Task ${task.id} session ${task.session_id} has no agent/model context — cannot append operator message`,
    )
  }
  const info = {
    id: identity?.messageID ?? Identifier.ascending("message"),
    role: "user",
    author: kind === "operator" ? "user" : kind,
    sessionID: task.session_id,
    time: {
      created: Date.now(),
    },
    agent: ctx.agent,
    model: ctx.model,
    extra: {
      task_root_message: TaskRootMessageProvenance.parse({
        protocol: "task-root-message",
        taskID: task.id,
        kind,
        source,
        ...(schedulerDelivery ? { schedulerDelivery: SchedulerDeliveryReference.parse(schedulerDelivery) } : {}),
      }),
      ...(kind === "operator" ? ProjectMemory.userInputExtra({ surface: `task.${source}`, literalText: text }) : {}),
    },
  } satisfies Message.User
  const parts: Message.Part[] = []
  if (text.length > 0) {
    const textPart: Message.TextPart = {
      id: identity?.textPartID ?? Identifier.ascending("part"),
      messageID: info.id,
      sessionID: task.session_id,
      type: "text",
      text,
      kind: "user_content",
      ...(kind === "operator" ? { source: "user" as const } : {}),
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    }
    parts.push(textPart)
  }
  for (const ref of attachments) {
    const filePart: Message.FilePart = {
      id: Identifier.ascending("part"),
      messageID: info.id,
      sessionID: task.session_id,
      type: "file",
      mime: ref.mime,
      url: ref.url,
      presentation: "attachment-index",
      filename: ref.filename,
    }
    parts.push(filePart)
  }
  return {
    info,
    parts,
    ...(schedulerDelivery && identity?.controlID
      ? {
          controls: [
            {
              id: identity.controlID,
              sessionID: task.session_id,
              kind: "wake_reason" as const,
              status: "consumed" as const,
              owner: "scheduler.message",
              payload: {
                messageID: info.id,
                wake_reason: {
                  source: "scheduler.message",
                  eventID: schedulerDelivery.eventID,
                  inboxID: schedulerDelivery.inboxID,
                },
              },
            },
          ],
        }
      : {}),
    touchSessionID: task.session_id,
  }
}

/**
 * Resolve the {agent, model} a task-root operator message should carry. The
 * agent is the session's stable conversation
 * role (history-derived agent is conversation context, allowed); the MODEL is
 * resolved fresh from the single resolver keyed by the CURRENT taskID + agent
 * — never reused from history. Strict — a missing model config is a hard
 * project-setup error that must surface, not be papered over.
 */
async function messageContext(sessionID: string, taskID: string) {
  const task = requireTaskInCurrentProject(taskID)
  if (task.session_id !== sessionID) {
    throw new NotFoundError({ message: `Task ${taskID} is not bound to session ${sessionID}` })
  }
  const session = await assertTaskRootSessionLineageInCurrentProject(task)
  if (session.kind !== "root") {
    throw new Error(`Task ${taskID} root session ${sessionID} has invalid kind ${session.kind}`)
  }
  const config = await EffectiveConfig.effective({ taskID, sessionID })
  const agent = await HostAgentRegistry.get("orchestrator", { config })
  const model = await resolveAgentModelRef(agent.name, { taskID })
  if (!model) throw new Error("Task operator message requires an orchestrator model")
  return {
    agent: agent.name,
    model: {
      providerID: model.providerID,
      modelID: model.modelID,
    },
  }
}

async function prepareProject(project?: string) {
  // Note (W2-V32): a previous version auto-ran `Project.initGit` here when
  // `Instance.directory` was not a git repo. That made task creation a
  // hidden side effect that wrote `.git` to disk without user confirmation
  // (rule 7: no fallback). It also cascaded the darwin failure mode: any
  // failing project bootstrap on the wrong directory would attempt git init
  // before throwing.
  //
  // We now throw WorktreeNotGitError (NamedError → onError 412) so the
  // overlay can render an explicit "Initialize this directory as a git
  // repository?" prompt and call POST /project/current/init-git on a real
  // user gesture. The error message names the directory so the prompt has
  // context.
  if (!Project.isGitRepo(Instance.directory)) {
    throw new Worktree.NotGitError({
      message: `Cannot create a task in ${Instance.directory}: the directory is not a git repository. Initialize it via POST /project/current/init-git or pick a different working directory.`,
    })
  }
  // Commit the canonical ignore and binary checkout policies before executor work begins.
  await ensureGitProjectMetadata()
  if (!project) return
  if (project === Instance.project.id) return
  throw new Error(`project mismatch: expected ${Instance.project.id}, got ${project}`)
}

function taskSummary(rows: TaskRow[]) {
  const completed = rows
    .filter((row) => typeof row.time_completed === "number")
    .map((row) => (row.time_completed ?? 0) - row.time_started)
    .filter((value) => value > 0)
    .sort((a, b) => a - b)

  return {
    total_tasks: rows.length,
    open_tasks: rows.filter((row) => !isTaskTerminal(row)).length,
    running_tasks: rows.filter((row) => isTaskActive(row)).length,
    blocked_tasks: 0,
    completed_tasks: rows.filter((row) => isTaskCompleted(row)).length,
    failed_tasks: rows.filter((row) => isTaskFailed(row)).length,
    cancelled_tasks: rows.filter((row) => isTaskCancelled(row)).length,
    median_completion_ms: completed.length === 0 ? undefined : completed[Math.floor((completed.length - 1) / 2)],
  }
}

function taskItems(rows: TaskListRow[]) {
  return rows.map((item) => {
    const task = item.task
    const pendingInteractions = listInteractions(task.id).filter((entry) => entry.status === "pending")
    return {
      task: viewTaskListTask(task, { directory: item.directory }),
      project: item.project,
      owned_prompt_sessions: listOwnedPromptSessionsForTask(task.id),
      pending_interactions: pendingInteractions.length,
      pending_interaction_items: pendingInteractions.map(viewInteraction),
      updated_at: task.time_updated,
    }
  })
}

async function taskChecks(
  checks?: z.input<typeof CheckConfig>,
  discovered?: Awaited<ReturnType<typeof discoverChecks>>,
) {
  const found = discovered ?? (await discoverChecks())
  const next = structuredClone(resolvedChecks(await resolveConfig(checks ? { checks } : undefined), found))

  if (found.lint.length > 0 && next.lint === false) {
    next.lint = found.lint.map((item) => item.command)
  }

  const current = next.named?.typecheck
  const typecheck = found.named.typecheck
  if (current || typecheck) {
    next.named = {
      ...(next.named ?? {}),
      typecheck: {
        label: current?.label ?? typecheck?.label ?? "Type Check",
        family: current?.family ?? typecheck?.family ?? "lint",
        commands: current?.commands ?? typecheck?.commands.map((item) => item.command) ?? [],
        enabled: true,
        ...(current?.cwd ? { cwd: current.cwd } : {}),
      },
    }
  }

  next.spec_check = {
    ...(next.spec_check ?? {}),
    enabled: true,
    mode: next.spec_check?.mode ?? "strict",
  }

  return CheckConfig.parse(next)
}

/** Thrown when the planning tool role cannot produce a valid plan. Server routes
 *  map this to a 4xx so the user sees the planner failure rather than a
 *  generic 500. */
export class PlannerFailureError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "PlannerFailureError"
  }
}

type ApiAttachmentInput = NonNullable<z.infer<typeof CreateTaskInput>["attachments"]>[number]

function taskCreationRequestAttachments(attachments: ApiAttachmentInput[] | undefined) {
  return (attachments ?? []).map((attachment) => {
    if (!("data" in attachment)) {
      return {
        url: attachment.url,
        mime: attachment.mime,
        filename: attachment.filename ?? null,
      }
    }
    return canonicalInlineUploadAttachment(
      attachment,
      `Task creation attachment ${attachment.filename ?? attachment.mime}`,
    )
  })
}

async function materializeApiAttachments(input: {
  attachments: ApiAttachmentInput[] | undefined
  label: string
  projectID: string
}): Promise<TaskInputFileRef[]> {
  const refs: TaskInputFileRef[] = []
  for (const attachment of input.attachments ?? []) {
    const reference =
      "data" in attachment
        ? await AttachmentStore.write(
            input.projectID,
            decodeRawBase64Payload(attachment.data, `${input.label} ${attachment.filename ?? attachment.mime}`),
            attachment.mime,
            attachment.filename,
          )
        : await AttachmentStore.requireReference({
            projectID: input.projectID,
            url: attachment.url,
            mime: attachment.mime,
          })
    refs.push({
      ...reference,
      ...(attachment.filename ? { filename: attachment.filename } : {}),
      intent: "task_input",
      source: "user-upload",
    })
  }
  return refs
}

function applyOperatorGoalMutation(input: { mutation: ApplyGoalGraphMutationInput }) {
  const now = Date.now()
  return Database.transaction((db) => applyGoalGraphMutationInTransaction(db, { ...input.mutation, now }))
}

let taskExecutionDirectoryInitializer: InstanceInit | undefined

function requireTaskExecutionDirectoryInitializer(): InstanceInit {
  if (!taskExecutionDirectoryInitializer) {
    throw new Error("Task execution directory initializer is not bound by Project bootstrap.")
  }
  return taskExecutionDirectoryInitializer
}

export const TaskExecutionDirectoryInitializerTestHooks = {
  replace(initializer: InstanceInit | undefined): Disposable {
    const prior = taskExecutionDirectoryInitializer
    taskExecutionDirectoryInitializer = initializer
    return {
      [Symbol.dispose]() {
        taskExecutionDirectoryInitializer = prior
      },
    }
  },
}

let beforeTaskPersistForTest:
  | ((input: { taskID: string; creator: ResolvedTaskCreationAuthority }) => void | Promise<void>)
  | undefined
let beforeAcceptedReconciliationForTest: ((taskID: string) => void) | undefined

export const TaskCreationCommitTestHooks = {
  installBeforePersist(
    hook: (input: { taskID: string; creator: ResolvedTaskCreationAuthority }) => void | Promise<void>,
  ): Disposable {
    if (beforeTaskPersistForTest) throw new Error("Task creation pre-persist hook is already installed")
    beforeTaskPersistForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeTaskPersistForTest === hook) beforeTaskPersistForTest = undefined
      },
    }
  },
  installBeforeAcceptedReconciliation(hook: (taskID: string) => void): Disposable {
    if (beforeAcceptedReconciliationForTest) {
      throw new Error("Task creation accepted-reconciliation hook is already installed")
    }
    beforeAcceptedReconciliationForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeAcceptedReconciliationForTest === hook) beforeAcceptedReconciliationForTest = undefined
      },
    }
  },
}

const EMPTY_TASK_CHECK_DISCOVERY: Awaited<ReturnType<typeof discoverChecks>> = {
  build: [],
  test: [],
  lint: [],
  named: {},
}

async function resolveTaskCreationResolution(input: {
  task: z.infer<typeof CreateTaskInput>
  configSnapshot: Config.Info
  scope: "project" | "global"
  projectDirectory?: string
}) {
  const selectedProfileID = selectedTaskProfileID(input.task, input.configSnapshot)
  const profilePreviewConfig = Config.mergeOverlay(input.configSnapshot, {
    ...(input.task.model ? { model: input.task.model } : {}),
    prompt_profile: { active: selectedProfileID },
  })
  if (input.scope === "global") {
    await validateConfigModelReferences(profilePreviewConfig, "globalTask.configOverlay", "global")
  }
  const packageRevision = await ExpertSquadInstallLock.run(selectedProfileID, async (lease) => {
    if (input.scope === "project") {
      await ExpertSquadPackageManager.reconcilePendingPackageMutationUnderLease({
        projectDirectory: input.projectDirectory!,
        id: selectedProfileID,
        lease,
      })
    }
    await PromptProfileResolver.assertProfileSupportsProductPillar({
      ...(input.projectDirectory ? { projectDirectory: input.projectDirectory } : {}),
      profileID: selectedProfileID,
      productPillar: input.task.productPillar,
      config: profilePreviewConfig,
      scope: input.scope,
    })
    const resolved = await PromptProfileResolver.resolveActivePackageRevision({
      ...(input.projectDirectory ? { projectDirectory: input.projectDirectory } : {}),
      ...(input.scope === "global" ? { defaultSkills: [] } : {}),
      config: profilePreviewConfig,
      scope: input.scope,
      reconcileEvolutionMutations: false,
    })
    if (input.task.expectedPackageDigest === undefined || input.task.expectedPackageDigest === resolved.packageDigest) {
      return resolved
    }
    if (resolved.scope !== "built_in") {
      return PromptProfileResolver.resolveExternalPackageRevisionSnapshot({
        activeRevision: resolved,
        expectedPackageDigest: input.task.expectedPackageDigest,
      })
    }
    throw new TaskExpectedPackageDigestConflictError({
      message: `Expert squad ${selectedProfileID} resolved package digest ${resolved.packageDigest}, expected ${input.task.expectedPackageDigest}`,
      profileID: selectedProfileID,
      expectedPackageDigest: input.task.expectedPackageDigest,
      actualPackageDigest: resolved.packageDigest,
    })
  })
  return TaskCreationResolutionSeedSchema.parse({
    protocol: "task-creation-resolution-seed-v1",
    selected_profile_id: selectedProfileID,
    package_revision: packageRevision,
    process_mode: configuredTaskProcessMode(),
    resolved_checks: await taskChecks(
      input.task.checks,
      input.scope === "global" ? EMPTY_TASK_CHECK_DISCOVERY : undefined,
    ),
  })
}

type TaskCreationSeed = {
  taskConfigSnapshot: Config.Info
  taskResolution?: Record<string, unknown> | null
  acceptanceCommit?: (db: Database.TxOrDb, input: { taskID: string; projectID: string; acceptedAt: number }) => void
}

function taskCreatorCreationEnvelope(creator: ResolvedTaskCreationAuthority) {
  return PersistedTaskCreationCreator.parse({
    actor: creator.actor,
    ...(creator.actor === "user"
      ? {}
      : {
          session_id: creator.sessionID,
          ...(creator.messageID ? { message_id: creator.messageID } : {}),
          ...(creator.toolCallID ? { tool_call_id: creator.toolCallID } : {}),
          ...(creator.toolPartID ? { tool_part_id: creator.toolPartID } : {}),
          ...(creator.toolInput ? { tool_input: creator.toolInput } : {}),
        }),
    ...(creator.actor === "mission"
      ? {
          mission_id: creator.missionID,
          opened_occurrence: {
            event_id: creator.openedOccurrence.eventID,
            operation_id: creator.openedOccurrence.operationID,
          },
        }
      : {}),
  })
}

function taskProcessCreationEnvelope(binding: TaskProcessBindingPayload) {
  if (binding.protocol === "task-native-process-binding-v1") {
    return {
      protocol: binding.protocol,
      mode: binding.mode,
      workspace_root: binding.workspace_root,
      package_revision_sha256: binding.package_revision_sha256,
    }
  }
  return {
    protocol: binding.protocol,
    workspace_root: binding.workspace.root,
    package_revision_sha256: binding.package_revision_sha256,
    runtime_descriptor_sha256: binding.runtime_descriptor_sha256,
    runtime_identity_sha256: binding.runtime_identity_sha256,
    network: binding.network,
    resources: binding.resources,
  }
}

function isTaskCreationIdentityCollision(error: unknown): boolean {
  return isSqliteUniqueConstraintError(error)
}

function requestAcceptedTaskReconciliation(taskID: string): string {
  beforeAcceptedReconciliationForTest?.(taskID)
  requestTaskControlScanInBackground(taskID, "task-create-accepted")
  return taskID
}

export namespace EngineService {
  export function bindTaskExecutionDirectoryInitializer(initializer: InstanceInit): void {
    if (taskExecutionDirectoryInitializer && taskExecutionDirectoryInitializer !== initializer) {
      throw new Error("Task execution directory initializer is already bound to another implementation.")
    }
    taskExecutionDirectoryInitializer = initializer
  }

  export function init() {
    const current = orchestratorState()
    if (!current.booted) {
      EngineInteraction.subscribe()
      current.booted = true
    }
  }

  export async function materializeClaimedSchedulerMessageToTask(input: {
    inboxID: string
    ownerID: string
    message: string
  }): Promise<{
    messageID: string
    ingressID: string
    wakeStatus: DispatchTaskLoopResult
  }> {
    const delivery = requireSchedulerDelivery(input.inboxID)
    if (delivery.status !== "leased" || delivery.leaseOwner !== input.ownerID) {
      throw new Error(`Scheduler Task delivery ${input.inboxID} is not leased by ${input.ownerID}.`)
    }
    if (delivery.target.kind !== "task_scheduler") {
      throw new Error(`Scheduler inbox ${input.inboxID} does not target a Task scheduler.`)
    }
    const target = delivery.target
    const task = requireTaskInCurrentProject(target.task_id)
    const occurrenceIDs = schedulerTargetOccurrenceIdentity(delivery.id)
    const rootKind = delivery.source.kind === "mission_scheduler" ? "mission" : "orchestrator"
    const expectedEpoch = delivery.message.target_task_execution_epoch
    if (expectedEpoch === null) {
      throw new Error(`Scheduler Task delivery ${delivery.id} has no target Task occurrence.`)
    }
    const currentEpoch = Database.use((db) => taskLifecycleProjectionInTransaction(db, task.id).epoch)
    if (currentEpoch !== expectedEpoch) {
      throw new Error(
        `Scheduler Task delivery ${delivery.id} targets epoch ${expectedEpoch}, current Task epoch is ${currentEpoch}.`,
      )
    }
    const deliveryReference = SchedulerDeliveryReference.parse({
      eventID: delivery.event.id,
      inboxID: delivery.id,
      sequence: delivery.event.sequence,
      threadID: delivery.message.thread_id,
      targetTaskExecutionEpoch: expectedEpoch,
      ...(delivery.event.replyTo ? { replyTo: delivery.event.replyTo } : {}),
    })
    const bundle = await buildTaskSessionMessageBundle(
      task,
      renderSchedulerParticipantMessage({
        eventID: delivery.event.id,
        kind: delivery.message.message_kind,
        source: delivery.source,
        threadID: delivery.message.thread_id,
        replyTo: delivery.event.replyTo,
        subject: delivery.message.subject,
        message: input.message,
      }),
      `scheduler.message:${delivery.event.id}`,
      rootKind,
      [],
      undefined,
      deliveryReference,
      {
        messageID: occurrenceIDs.messageID,
        textPartID: occurrenceIDs.textPartID,
        controlID: occurrenceIDs.controlID,
      },
    )
    let ingressID: string | undefined
    await Session.persistMessageWithCommit(
      bundle,
      () => {
        Database.use((db) => {
          const persistedTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, task.id)).get()
          const currentTask = persistedTask ? projectTaskRowInTransaction(db, persistedTask) : undefined
          if (!currentTask || !isTaskActive(currentTask) || currentTask.session_id !== target.root_session_id) {
            throw new Error(
              `Scheduler delivery ${delivery.id} cannot materialize into Task ${task.id} after its active root changed.`,
            )
          }
          const committedEpoch = taskLifecycleProjectionInTransaction(db, task.id).epoch
          if (committedEpoch !== expectedEpoch) {
            throw new SchedulerTargetOccurrenceStaleError({
              message: `Scheduler delivery ${delivery.id} targets stale Task ${task.id} epoch ${expectedEpoch}; current epoch is ${committedEpoch}.`,
              taskID: task.id,
              expectedEpoch,
              currentEpoch: committedEpoch,
            })
          }
          const currentBody = schedulerSourceBodyInTransaction(db, {
            source: delivery.source,
            sourceMessageID: delivery.message.source_message_id,
            sourcePartID: delivery.message.source_part_id,
            sourceTerminalEventID: delivery.message.source_terminal_event_id,
          })
          if (currentBody !== input.message) {
            throw new Error(`Scheduler delivery ${delivery.id} source body changed before Task materialization.`)
          }
          // Every root ingress uses EngineArtifact catalog_revision as
          // its durable monotonic causal ordinal, independent of wall clock and
          // participant kind. Protocol sequence determines scheduler claim order;
          // this shared ordinal preserves causal order for one root Session.
          const now = Date.now()
          ingressID = persistTaskRootMessageIngressInTransaction(db, {
            task: currentTask,
            messageID: bundle.info.id,
            kind: rootKind,
            schedulerDelivery: deliveryReference,
            now,
          })
          settleSchedulerDeliveryInTransaction(db, {
            inboxID: delivery.id,
            ownerID: input.ownerID,
            result: { kind: "task_ingress", message_id: bundle.info.id, ingress_id: ingressID },
            now,
          })
        })
      },
      undefined,
      () => {
        Database.use((db) =>
          assertSchedulerTargetOccurrenceAvailableInTransaction(db, {
            inboxID: delivery.id,
            messageID: occurrenceIDs.messageID,
            textPartID: occurrenceIDs.textPartID,
            controlID: occurrenceIDs.controlID,
          }),
        )
      },
    )
    if (!ingressID) throw new Error(`Scheduler Task delivery ${delivery.id} did not commit its ingress.`)
    const dispatch = await dispatchPersistedTaskLoop(task.id, ingressID)
    return {
      messageID: bundle.info.id,
      ingressID,
      wakeStatus: dispatch,
    }
  }

  export async function createTask(
    raw: z.input<typeof CreateTaskInput>,
    rawCreator: z.input<typeof TaskCreator>,
    creationSeed?: TaskCreationSeed,
  ) {
    const creator = await resolveTaskCreator(rawCreator)
    const { input, caller, artifactImporter } = preflightTaskCreation(raw, creator)
    return createTaskInExecutionDirectory(input, caller, creator, artifactImporter, creationSeed)
  }

  /**
   * Pure creation semantics shared by every Task entry before an owner may
   * reserve an aggregate. The caller supplies an already resolved creator;
   * this function performs no persistence, Project allocation or mutable
   * package/config resolution.
   */
  export function preflightTaskCreation(
    raw: z.input<typeof CreateTaskInput>,
    creator: ResolvedTaskCreationAuthority,
    options?: { globalRequestID?: string },
  ) {
    const parsed = CreateTaskInput.parse(raw)
    assertNoCallerSuppliedChildTaskLineage(parsed)
    assertNoCallerSuppliedTaskCreatorMetadata(parsed.metadata)
    assertTaskCreatorExpertSquadAuthority({ creator, promptProfile: parsed.promptProfile })
    const caller: TaskCreationCallerInput = creator.actor !== "user" && creator.toolInput
      ? panelTaskCreationCallerInput(creator.toolInput, taskCreationRequestAttachments(parsed.attachments))
      : {
          project: parsed.project,
          directory: parsed.directory,
          source: parsed.source,
          productPillar: parsed.productPillar,
          title: parsed.title,
          request: parsed.request,
          attachments: taskCreationRequestAttachments(parsed.attachments),
          priority: parsed.priority,
          budget: parsed.budget,
          checks: parsed.checks,
          metadata: parsed.metadata,
          model: parsed.model,
          promptProfile: parsed.promptProfile,
          expectedPackageDigest: parsed.expectedPackageDigest,
          artifactSources: parsed.artifactSources,
        }
    const input = CreateTaskInput.parse({
      ...parsed,
      ...(creator.actor === "mission" ? { source: "mission" } : {}),
      metadata: projectTaskCreatorMetadata(parsed.metadata, creator),
    })
    const artifactImporter: CrossTaskArtifactImporter | undefined =
      input.artifactSources && input.artifactSources.length > 0
        ? (() => {
            if (creator.actor !== "mission" || !creator.messageID || !creator.toolCallID) {
              throw new Error("Cross-Task Artifact imports require a real Mission panel.create_task tool execution")
            }
            return {
              missionID: creator.missionID,
              sessionID: creator.sessionID,
              messageID: creator.messageID,
              toolCallID: creator.toolCallID,
            }
          })()
        : undefined
    if (options?.globalRequestID) {
      assertGlobalTaskChannelClaimAvailable({
        requestID: options.globalRequestID,
        channelBinding: input.channelBinding,
      })
    }
    return { input, caller, artifactImporter }
  }

  /** Freeze every Global Task semantic that can be decided without creating
   * its carrying Project. The returned package/check/process snapshot is
   * persisted with the allocation and reused by Task acceptance. */
  export async function preflightGlobalTaskCreation(input: {
    raw: z.input<typeof CreateTaskInput>
    requestID: string
    configSnapshot: Config.Info
  }) {
    const preflight = preflightTaskCreation(input.raw, { actor: "user" }, { globalRequestID: input.requestID })
    const taskResolution = await resolveTaskCreationResolution({
      task: preflight.input,
      configSnapshot: input.configSnapshot,
      scope: "global",
    })
    return { ...preflight, taskResolution }
  }

  async function createTaskInExecutionDirectory(
    input: z.infer<typeof CreateTaskInput>,
    caller: TaskCreationCallerInput,
    creator: ResolvedTaskCreationAuthority,
    artifactImporter?: CrossTaskArtifactImporter,
    creationSeed?: TaskCreationSeed,
  ) {
    const creationContext = {
      capabilityProjectDirectory: Instance.project.worktree,
      taskConfigSnapshot: creationSeed?.taskConfigSnapshot ?? (await EffectiveConfig.snapshotCurrent()),
      taskResolution: creationSeed?.taskResolution,
      acceptanceCommit: creationSeed?.acceptanceCommit,
    }
    const directory = Filesystem.resolve(input.directory ?? Instance.directory)
    if (Project.samePath(directory, Instance.directory)) {
      return createTaskInner(input, caller, creator, { ...creationContext, artifactImporter })
    }

    const projectID = Instance.project.id
    const initializeExecutionDirectory = requireTaskExecutionDirectoryInitializer()
    return Worktree.withSandboxAdmission(directory, async () => {
      await Project.registerExecutionDirectory(projectID, directory)
      return Instance.provide({
        directory,
        init: initializeExecutionDirectory,
        fn: async () => {
          if (Instance.project.id !== projectID) {
            throw new Error(
              `Task execution directory ${directory} resolved project ${Instance.project.id}, expected ${projectID}`,
            )
          }
          return createTaskInner(input, caller, creator, { ...creationContext, artifactImporter })
        },
      })
    })
  }

  async function createTaskInner(
    input: z.infer<typeof CreateTaskInput>,
    caller: TaskCreationCallerInput,
    creator: ResolvedTaskCreationAuthority,
    creationContext: {
      capabilityProjectDirectory: string
      taskConfigSnapshot: Config.Info
      artifactImporter?: CrossTaskArtifactImporter
      taskResolution?: Record<string, unknown> | null
      acceptanceCommit?: TaskCreationSeed["acceptanceCommit"]
    },
  ) {
    assertCurrentMissionTaskCreationAuthority(creator)
    const title = resolveTaskTitle(input)
    const requestID = input.requestID?.trim() || undefined
    const requestFact = buildTaskCreationRequestFact({
      creatorToolPartID: creator.actor === "user" ? undefined : creator.toolPartID,
      request: taskCreationCallerRequest({
        caller,
        creator: taskCreatorCreationEnvelope(creator),
      }),
    })
    const claims: TaskCreationClaims = {
      projectID: Instance.project.id,
      ...(requestID ? { requestID } : {}),
      ...(input.channelBinding ? { channelBinding: input.channelBinding } : {}),
      ...(requestFact.creatorToolPartID ? { creatorToolPartID: requestFact.creatorToolPartID } : {}),
    }
    const replay = resolveTaskCreationClaims({ claims, fact: requestFact })
    if (replay) return requestAcceptedTaskReconciliation(replay)

    await prepareProject(input.project)
    const resolvedArtifactSources =
      input.artifactSources && input.artifactSources.length > 0
        ? resolveCrossTaskArtifactSources({
            sources: input.artifactSources,
            projectID: Instance.project.id,
            importer: creationContext.artifactImporter!,
          })
        : { imports: [], authorities: [] }
    const artifactImports = importsFromResolvedCrossTaskArtifactSources(resolvedArtifactSources)
    const taskConfigSnapshot = creationContext.taskConfigSnapshot
    let frozenResolution = creationContext.taskResolution
      ? TaskCreationResolutionSeedSchema.parse(creationContext.taskResolution)
      : undefined
    if (frozenResolution) {
      if (frozenResolution.selected_profile_id !== selectedTaskProfileID(input, taskConfigSnapshot)) {
        throw new Error("Global Task resolution conflicts with its immutable configuration snapshot")
      }
    } else {
      const candidate = await resolveTaskCreationResolution({
        task: input,
        configSnapshot: taskConfigSnapshot,
        scope: "project",
        projectDirectory: creationContext.capabilityProjectDirectory,
      })
      frozenResolution = candidate
    }
    const selectedProfileID = frozenResolution.selected_profile_id
    const packageRevision = frozenResolution.package_revision
    const resolvedChecks = frozenResolution.resolved_checks
    const processMode = frozenResolution.process_mode
    const profilePreviewConfig = Config.mergeOverlay(taskConfigSnapshot, {
      ...(input.model ? { model: input.model } : {}),
      prompt_profile: { active: selectedProfileID },
    })
    const now = Date.now()
    const taskID = Identifier.ascending("task")
    const attachmentRefs = await materializeApiAttachments({
      attachments: input.attachments,
      label: `Task ${taskID} attachment`,
      projectID: Instance.project.id,
    })
    const metadata = {
      ...(input.metadata ?? {}),
      ...(Object.keys(resolvedChecks).length > 0 ? { checks: resolvedChecks } : {}),
    } as Record<string, unknown>

    // Board compilation projects the current Task, Delivery Slice revisions,
    // Sessions, and Artifact evidence from durable rows. Task creation does
    // not persist scheduler topology or synthesize execution steps.

    // Per-message switches are capability projection only. Operator authority
    // is frozen separately by PermissionAuthority for the new Session.
    const overrides: CapabilityRules.Ruleset = []
    if ((metadata as any)?.web_search === true) {
      overrides.push({ permission: "websearch", pattern: "*", action: "allow" })
    }
    const executionCapsuleBinding = await prepareTaskProcessBinding({
      mode: processMode,
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    })
    const initialSessionConfigOverlay = Config.Overlay.parse({
      ...(input.model ? { model: input.model } : {}),
      prompt_profile: {
        active: input.promptProfile ?? taskConfigSnapshot.prompt_profile.active,
      },
    })
    const session = Session.prepareRootNext({
      kind: "root",
      directory: Instance.directory,
      title,
      permission: overrides.length > 0 ? overrides : undefined,
      metadata: {
        [EffectiveConfig.TASK_SNAPSHOT_KEY]: taskConfigSnapshot,
        configOverlay: initialSessionConfigOverlay,
      },
    })
    const creationContract = buildTaskCreationContractFact({
      request: requestFact,
      resolved: {
        project_id: Instance.project.id,
        directory: Instance.directory,
        source: input.source ?? "api",
        product_pillar: input.productPillar,
        title,
        request: input.request,
        attachments: attachmentRefs,
        priority: input.priority ?? "normal",
        budget: budgetRow(input.budget) ?? null,
        metadata,
        effective_model: profilePreviewConfig.model ?? null,
        prompt_profile_id: selectedProfileID,
        package_revision: expertSquadPackageRevisionBinding(packageRevision),
        creation_expected_package_digest: input.expectedPackageDigest ?? null,
        artifact_imports: artifactImports,
        process: taskProcessCreationEnvelope(executionCapsuleBinding),
        creator: taskCreatorCreationEnvelope(creator),
      },
    })
    let initialIngressID: string | undefined
    try {
      const preparedArtifactSources =
        resolvedArtifactSources.authorities.length > 0
          ? await prepareCrossTaskArtifactSourceImports({
              resolved: resolvedArtifactSources,
              projectID: Instance.project.id,
              targetProjectDirectory: Instance.directory,
              targetTaskID: taskID,
              importer: creationContext.artifactImporter!,
            })
          : { imports: [], authorities: [] }
      // Task row, target-owned imports, and initial Engine facts commit together
      // only after every imported resource snapshot is durable.
      await beforeTaskPersistForTest?.({ taskID, creator })
      initialIngressID = persistTaskWithCreatorAuthority(creator, {
        taskID,
        rootSession: session,
        now,
        title,
        request: input.request,
        attachments: attachmentRefs.length ? attachmentRefs : undefined,
        requestID,
        source: input.source,
        productPillar: input.productPillar,
        priority: input.priority,
        budget: input.budget,
        metadata,
        channelBinding: input.channelBinding,
        projectID: Instance.project.id,
        artifactImports: preparedArtifactSources.imports,
        artifactImportAuthorities: preparedArtifactSources.authorities,
        packageRevision,
        creationExpectedPackageDigest: input.expectedPackageDigest,
        executionCapsuleBinding,
        creationContract,
        acceptanceCommit: creationContext.acceptanceCommit
          ? (db) =>
              creationContext.acceptanceCommit!(db, {
                taskID,
                projectID: Instance.project.id,
                acceptedAt: now,
              })
          : undefined,
      })
    } catch (error) {
      if (isTaskCreationIdentityCollision(error)) {
        const winner = resolveTaskCreationClaims({ claims, fact: creationContract })
        if (winner) return requestAcceptedTaskReconciliation(winner)
      }
      throw error
    }
    if (!initialIngressID) throw new Error(`Task ${taskID} committed without its durable creation ingress`)
    return requestAcceptedTaskReconciliation(taskID)
  }

  export function getCrossTaskArtifactImportMappings(taskID: string) {
    requireTaskInCurrentProject(taskID)
    return listCrossTaskArtifactImportMappings(taskID)
  }

  export async function getTask(taskID: string) {
    // Read-only — poll loop handles state advancement asynchronously.
    const task = requireTaskInCurrentProject(taskID)
    const item = listTaskRows([task])[0]
    return viewTask(task, { directory: item?.directory })
  }

  export async function getProgress(taskID: string) {
    // Do NOT call syncTask here — it triggers synchronous evaluation inside the GET request,
    // which blocks for minutes and causes request timeouts. The poll loop drives state advancement.
    const task = requireTaskInCurrentProject(taskID)
    const item = listTaskRows([task])[0]
    const board = compileBoard({ taskID })
    return {
      task: viewTask(task, { directory: item?.directory }),
      goals: board.goals,
      pendingInteractions: listInteractions(taskID)
        .filter((item) => item.status === "pending")
        .map(viewInteraction),
      snapshots: listSnapshots(taskID).map(viewSnapshot),
      ownedPromptSessions: listOwnedPromptSessionsForTask(taskID),
    }
  }

  export async function getBrief(input: { taskID: string }) {
    const task = requireTaskInCurrentProject(input.taskID)
    const brief = compileBrief({
      taskID: task.id,
      sessionID: task.session_id ?? undefined,
    })
    return TaskBrief.parse({
      content: brief.content,
      goals: brief.goals.map((goal) => ({
        description: goal.objective,
        criteria: renderSpecsAsText(
          parseAcceptanceSpecs(goal.acceptance_specs, `engine_goal(${goal.id}).acceptance_specs`),
        ),
      })),
    })
  }

  /**
   * The Board projection of a Task.
   *
   * Read-only by contract: the poll loop advances state, and reading never
   * does. This used to accept a `sync` option that every caller could pass
   * and no implementation ever read — a public promise of freshness-on-demand
   * that did nothing. The parameter is gone rather than silently ignored.
   */
  export async function getBoard(taskID: string) {
    requireTaskInCurrentProject(taskID)
    return compileBoard({ taskID })
  }

  export async function getTaskRootIngressDebug(taskID: string) {
    requireTaskInCurrentProject(taskID)
    try {
      return { status: "available" as const, entries: taskRootIngressDebugProjection(taskID) }
    } catch (error) {
      return {
        status: "unavailable" as const,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      }
    }
  }

  export async function searchArtifactCatalog(taskID: string, search: ArtifactSearchRequest) {
    requireTaskInCurrentProject(taskID)
    return searchTaskArtifacts({
      authority: artifactCatalogAuthority(taskID),
      search,
    })
  }

  export function requireMissionArtifactSource(
    taskID: string,
    importer: Pick<CrossTaskArtifactImporter, "missionID" | "sessionID">,
  ): void {
    requireMissionArtifactSourceAuthority({
      sourceTaskID: taskID,
      projectID: Instance.project.id,
      importer,
    })
  }

  export async function readMissionTaskArtifact(input: {
    taskID: string
    importer: Pick<CrossTaskArtifactImporter, "missionID" | "sessionID">
    read: ArtifactReadInput
  }) {
    requireMissionArtifactSourceAuthority({
      sourceTaskID: input.taskID,
      projectID: Instance.project.id,
      importer: input.importer,
    })
    return readTaskArtifact({
      authority: artifactCatalogAuthority(input.taskID),
      read: ArtifactReadInputSchema.parse(input.read),
    })
  }

  /** The Board projection's ETag. Read-only for the same reason getBoard is. */
  export async function getBoardTag(taskID: string) {
    requireTaskInCurrentProject(taskID)
    return boardTag({ taskID })
  }

  export async function getProjectBoard(opts?: { limit?: number; query?: string; status?: string }) {
    const project = Project.get(Instance.project.id) ?? Instance.project
    const limit = opts?.limit ?? 50
    const rows =
      opts?.query || opts?.status
        ? searchProjectTasks(Instance.project.id, { query: opts.query, status: opts.status, limit })
        : listProjectTasks(Instance.project.id, limit)
    const tasks = taskItems(listTaskRows(rows))

    return {
      project: {
        id: project.id,
        name: project.name,
        worktree: project.worktree,
      },
      summary: taskSummary(rows),
      tasks,
    }
  }

  export async function getGlobalTaskBoard(opts?: {
    limit?: number
    query?: string
    status?: string
    directory?: string
    cursor?: number
    cursorTaskID?: string
  }) {
    const rows = listGlobalTasks({
      directory: opts?.directory,
      cursor: opts?.cursor,
      cursorTaskID: opts?.cursorTaskID,
      query: opts?.query,
      status: opts?.status,
      limit: opts?.limit ?? 100,
    })
    return {
      summary: taskSummary(rows.map((item) => item.task)),
      tasks: taskItems(rows),
    }
  }

  /** Surface the per-session AgentTrace event stream so the overlay's debug
   *  panel can render llm_request / agent_turn bodies inline next to the
   *  session card. Read-only; reads JSONL straight from disk and parses each
   *  line. Returns `events: []` (200, not 404) when the trace file is absent,
   *  because "agent ran but trace was disabled / pre-trace session" is a
   *  legitimate state the UI distinguishes from "session not found". */
  export async function getSessionTrace(sessionID: string): Promise<{
    ok: true
    events: import("@/trace").AgentTrace.TraceEvent[]
    traceDir: string
    enabled: boolean
  }> {
    const taskID = await requireSessionTraceTaskInCurrentProject(sessionID)
    const { AgentTrace } = await import("@/trace")
    return {
      ok: true,
      events: AgentTrace.readSessionEvents(sessionID, taskID),
      traceDir: AgentTrace.getTaskTraceDir(taskID),
      enabled: AgentTrace.isEnabled(),
    }
  }

  /** Aggregate all sessions belonging to a task into one chronological event
   *  stream. Task trace reads the `_task-<id>.jsonl` rollup directly; the
   *  writer appends every task-tagged model request and visible message there.
   *
   *  Also surfaces the resolved trace directory + the enabled flag so the
   *  overlay's empty state can call out path-mismatch and disabled-tracing
   *  failure modes by name (the two failure modes that look identical from
   *  the client's perspective: events:[]). Without this, an operator running
   *  overlay against project root while the agents wrote traces under a
   *  benchmark temp dir gets a "no trace yet" message that hides the real
   *  problem (different Instance.directory). */
  export async function getTaskTrace(taskID: string): Promise<{
    ok: true
    events: import("@/trace").AgentTrace.TraceEvent[]
    traceDir: string
    enabled: boolean
  }> {
    requireTaskInCurrentProject(taskID)
    const { AgentTrace } = await import("@/trace")
    return {
      ok: true,
      events: AgentTrace.readTaskEvents(taskID),
      traceDir: AgentTrace.getTaskTraceDir(taskID),
      enabled: AgentTrace.isEnabled(),
    }
  }

  export async function listProtocolEvents(taskID: string) {
    // Read-only — protocol_event is the persisted task event source.
    requireTaskInCurrentProject(taskID)
    return ProtocolStore.listTaskEvents(taskID)
  }

  export async function listTaskInteractions(taskID: string) {
    // Read-only — poll loop handles state advancement asynchronously.
    requireTaskInCurrentProject(taskID)
    return listInteractions(taskID).map(viewInteraction)
  }

  export async function updateTaskChecks(taskID: string, raw: z.input<typeof UpdateTaskChecksInput>) {
    const { checks } = UpdateTaskChecksInput.parse(raw)
    return writeTaskChecks(requireTaskInCurrentProject(taskID), checks)
  }

  export async function updateGoalTitle(goalID: string, input: z.input<typeof UpdateGoalTitleInput>) {
    const body = UpdateGoalTitleInput.parse(input)
    const goal = requireGoalInCurrentProject(goalID)
    const revision = applyOperatorGoalMutation({
      mutation: {
        taskID: goal.task_id,
        producer: {
          kind: "operator_command",
          operation: "modify",
          reason: "Operator changed the Goal title",
          target_goal_id: goalID,
        },
        mutation: {
          operation: "modify",
          goalID,
          values: { title: body.title },
        },
      },
    })
    return {
      goalID: revision.goalID,
      supersedeOf: revision.status === "applied" ? revision.supersedeOf : undefined,
      goalGraphProjectionArtifactLocator: revision.goalGraphProjectionArtifactLocator,
    }
  }

  export async function replaceGoalContract(goalID: string, input: z.input<typeof ReplaceGoalContractInput>) {
    const body = ReplaceGoalContractInput.parse(input)
    const goal = requireGoalInCurrentProject(goalID)
    const revision = applyOperatorGoalMutation({
      mutation: {
        taskID: goal.task_id,
        producer: {
          kind: "operator_command",
          operation: "modify",
          reason: "Operator replaced the Goal contract",
          target_goal_id: goalID,
        },
        mutation: {
          operation: "modify",
          goalID,
          values: {
            title: body.title,
            acceptance_specs: body.acceptance_specs,
          },
        },
      },
    })
    return {
      goalID: revision.goalID,
      supersedeOf: revision.status === "applied" ? revision.supersedeOf : undefined,
      goalGraphProjectionArtifactLocator: revision.goalGraphProjectionArtifactLocator,
    }
  }

  export async function deleteGoal(goalID: string, input?: { projectID?: string }) {
    const goal = requireGoalInCurrentProject(goalID)
    if (input?.projectID) {
      const task = requireTask(goal.task_id)
      if (task.project_id !== input.projectID) throw new NotFoundError({ message: `Goal not found: ${goalID}` })
    }
    const removal = applyOperatorGoalMutation({
      mutation: {
        taskID: goal.task_id,
        producer: {
          kind: "operator_command",
          operation: "remove",
          reason: "Operator removed the Goal",
          target_goal_id: goalID,
        },
        mutation: { operation: "remove", goalID },
      },
    })
    if (removal.status !== "applied") {
      throw new Error(`Goal ${goalID} removal did not produce a GoalGraph projection`)
    }
    return {
      goalID,
      goalGraphProjectionArtifactLocator: removal.goalGraphProjectionArtifactLocator,
    }
  }

  export async function deleteTask(taskID: string, options?: DestructiveTaskOptions) {
    const deleted = Database.use((db) => {
      const row = db
        .select()
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, taskID))
        .get()
      return row && taskDeletedInTransaction(db, taskID) ? row : undefined
    })
    if (deleted) {
      const currentProjectID = Instance.current()?.project.id
      if (
        (options?.projectID && deleted.project_id !== options.projectID) ||
        (currentProjectID && deleted.project_id !== currentProjectID)
      ) {
        throw new NotFoundError({ message: `Task not found: ${taskID}` })
      }
      // The tombstone is the durable owner. A prior post-commit filesystem
      // failure must converge when the operator repeats the same deletion.
      await removeTombstonedIntentProjections([taskCleanupTarget(deleted)])
      return true
    }
    let task = requireTaskInCurrentProject(taskID)
    if (options?.projectID && task.project_id !== options.projectID) {
      throw new NotFoundError({ message: `Task not found: ${taskID}` })
    }
    if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
    const executionCancellationOrigin = physicalTaskCancellationOrigin({
      origin: options?.origin,
      defaultSource: "task.delete",
      defaultSurface: "task-api",
      defaultReason: "task deleted",
      taskID,
    })
    const destructiveScope = SessionPromptState.beginRootSessionDestructiveScope(
      task.session_id,
      executionCancellationOrigin,
    )
    try {
      // Ingress facts are immutable: explicit Task deletion cascades them, and
      // ordinary cancellation never rewrites or deletes accepted history.
      if (!isTaskTerminal(task)) {
        if (!options?.origin) {
          throw new Error(`deleteTask requires cancellation origin while task ${taskID} is non-terminal.`)
        }
        await cancelTask(taskID, { ...options, origin: options.origin })
        task = requireTaskInCurrentProject(taskID)
        if (options.projectID && task.project_id !== options.projectID) {
          throw new NotFoundError({ message: `Task not found: ${taskID}` })
        }
      }
      await awaitTaskRootIngressSettled(task, options?.ingressSettleInactivityMs ?? CANCEL_INGRESS_SETTLE_INACTIVITY_MS)
      const settledSessionIDs = await settleTaskSessionWork(
        task,
        {
          reason: "task deleted",
          handle: "EngineService.deleteTask",
          origin: executionCancellationOrigin,
        },
        options,
      )
      if (options?.projectDeletionAdmission) return true
      // Explicit Task deletion is an immutable tombstone boundary. The Task
      // creation input, Session/Message graph, effects, lifecycle, interactions,
      // progress and Artifacts remain one replayable fact graph; ordinary
      // queries hide the aggregate by reducing the tombstone.
      const cleanupTarget = taskCleanupTarget(task)
      await settleTaskCleanupOwners([cleanupTarget])
      Database.immediateTransaction((db) => {
        assertTasksRemainTerminalForPhysicalDelete(db, [task])
        deadLetterSchedulerTaskDeliveriesInTransaction(db, {
          taskIDs: [task.id],
          errorName: "SchedulerRecipientDeletedError",
          message: `Recipient Task ${task.id} was tombstoned.`,
        })
        deadLetterSchedulerSourceDeliveriesInTransaction(db, {
          sessionIDs: settledSessionIDs,
          errorName: "SchedulerSourceDeletedError",
          message: `Source Session tree for tombstoned Task ${task.id} no longer admits scheduler work.`,
        })
        appendTaskDeletedBoundaryInTransaction(db, task)
      })
      await removeTombstonedIntentProjections([cleanupTarget])
      return true
    } finally {
      destructiveScope.close()
    }
  }

  export async function setTaskArchived(taskID: string, archived: boolean, options?: DestructiveTaskOptions) {
    let task = requireTaskInCurrentProject(taskID)
    if ((task.time_archived !== null) === archived) return true
    let publication: Bus.Publication | undefined
    if (archived) {
      if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
      const executionCancellationOrigin = physicalTaskCancellationOrigin({
        origin: options?.origin,
        defaultSource: "task.archive",
        defaultSurface: "task-api",
        defaultReason: "task archived",
        taskID,
      })
      const destructiveScope = SessionPromptState.beginRootSessionDestructiveScope(
        task.session_id,
        executionCancellationOrigin,
      )
      try {
        // Ingress facts are immutable: explicit Task deletion cascades them, and
        // ordinary cancellation never rewrites or deletes accepted history.
        if (!isTaskTerminal(task)) {
          if (!options?.origin) {
            throw new Error(`setTaskArchived requires cancellation origin while task ${taskID} is non-terminal.`)
          }
          await cancelTask(taskID, { ...options, origin: options.origin })
          task = requireTaskInCurrentProject(taskID)
        }
        await awaitTaskRootIngressSettled(
          task,
          options?.ingressSettleInactivityMs ?? CANCEL_INGRESS_SETTLE_INACTIVITY_MS,
        )
        await settleTaskSessionWork(
          task,
          {
            reason: "task archived",
            handle: "EngineService.setTaskArchived",
            origin: executionCancellationOrigin,
          },
          options,
        )
        const timeUpdated = Date.now()
        Database.transaction((db) => {
          setEngineTaskArchived(db, {
            taskID,
            timeArchived: timeUpdated,
            timeUpdated,
          })
          publication = Bus.publishOwnedInTransaction(Event.TaskUpdated, {
            taskID,
            summary: "Task archived",
          })
        })
      } finally {
        destructiveScope.close()
      }
    } else {
      const timeUpdated = Date.now()
      Database.transaction((db) => {
        setEngineTaskArchived(db, {
          taskID,
          timeArchived: null,
          timeUpdated,
        })
        publication = Bus.publishOwnedInTransaction(Event.TaskUpdated, {
          taskID,
          summary: "Task restored",
        })
      })
    }
    await publication
    return true
  }

  export async function updateTaskBudget(taskID: string, budget: z.input<typeof Budget> | null) {
    const task = requireTaskInCurrentProject(taskID)
    const parsed = budget ? budgetRow(budget) : null
    let publication: Bus.Publication | undefined
    Database.transaction((db) => {
      setEngineTaskBudget(db, { taskID, budget: parsed })
      publication = Bus.publishOwnedInTransaction(Event.TaskUpdated, {
        taskID,
        summary: "Task budget updated",
      })
    })
    await publication
    return true
  }

  export async function updateTaskTitle(taskID: string, title: string) {
    const task = requireTaskInCurrentProject(taskID)
    let publication: Bus.Publication | undefined
    Database.transaction((db) => {
      setEngineTaskTitle(db, { taskID, title })
      publication = Bus.publishOwnedInTransaction(Event.TaskUpdated, {
        taskID,
        summary: "Task title updated",
      })
    })
    await publication
    return true
  }

  export async function setTaskPinned(taskID: string, pinned: boolean) {
    const task = requireTaskInCurrentProject(taskID)
    if ((task.time_pinned !== null) === pinned) return true
    let publication: Bus.Publication | undefined
    Database.transaction((db) => {
      setEngineTaskPinned(db, {
        taskID,
        timePinned: pinned ? Date.now() : null,
      })
      publication = Bus.publishOwnedInTransaction(Event.TaskUpdated, {
        taskID,
        summary: pinned ? "Task pinned" : "Task unpinned",
      })
    })
    await publication
    return true
  }
}

export namespace EngineService {
  export async function operatorSteerAgentSession(
    taskID: string,
    sessionID: string,
    raw: z.input<typeof AgentSessionOperatorSteerInput>,
    dispatch: OperatorSteerDispatch = dispatchTaskLoop,
  ) {
    const input = AgentSessionOperatorSteerInput.parse(raw)
    const task = requireTaskInCurrentProject(taskID)
    const target = await resolveOperatorSteerTarget({ task, sessionID })
    const request = await createOperatorSteerCoordinationRequest({
      taskID: task.id,
      sessionID: target.session.id,
      agent: target.agent,
      workerBinding: target.workerBinding,
      operatorMessage: input.message,
    })

    let dispatchResult: "accepted"
    try {
      const result = await dispatch({
        taskID: task.id,
        event: {
          coordinationRequest: { requestID: request.payload.request_id },
        },
      })
      if (result === "ignored") {
        throw new Error(`Operator steer request ${request.payload.request_id} was rejected by Task ingress delivery`)
      }
      dispatchResult = "accepted"
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      log.error("operator steer wake attempt failed after durable request persistence", {
        taskID: task.id,
        sessionID: target.session.id,
        requestID: request.payload.request_id,
        error: reason,
      })
      recordTaskInfrastructureError({
        taskID: task.id,
        component: "operator-steer",
        operation: "dispatch-wake",
        reason,
        errorName: error instanceof Error ? error.name : undefined,
        now: Date.now(),
      })
      let directActivations = 0
      try {
        directActivations = await deliverTaskRootIngress(task.id)
      } catch (drainError) {
        const drainReason =
          drainError instanceof Error ? `${drainError.name}: ${drainError.message}` : String(drainError)
        recordTaskInfrastructureError({
          taskID: task.id,
          component: "operator-steer",
          operation: "drain-durable-wake",
          reason: drainReason,
          errorName: drainError instanceof Error ? drainError.name : undefined,
          now: Date.now(),
        })
      }
      // The durable record is the authority: a scan owned elsewhere activates
      // nothing here yet still guarantees the wake is queued.
      if (taskRootIngressStats(task.id).events > 0 || directActivations > 0) {
        dispatchResult = "accepted"
      } else {
        throw new Error(
          `Operator steer request ${request.payload.request_id} has neither an active Turn nor a durable pending wake`,
        )
      }
    }

    return {
      task_id: task.id,
      session_id: target.session.id,
      request_id: request.payload.request_id,
      wake_status: dispatchResult,
    }
  }

  export async function replyInteraction(interactionID: string, raw: z.input<typeof ReplyInteractionInput>) {
    const input = ReplyInteractionInput.parse(raw)
    const row = requireInteractionInCurrentProject(interactionID)
    if (row.request_type === "permission") {
      await PermissionAuthority.reply({
        requestID: row.external_id,
        decision: input.decision ?? "allow_once",
        autoReply: input.autoReply,
        message: input.message,
        actorID: "local-operator",
      })
    }
    if (row.request_type === "question") {
      const answers = input.answers ?? answersFromMessage(input.message)
      if (!answers) throw new Error("answers or message are required for question replies")
      if ((row.payload as { activity_reconciliation?: unknown }).activity_reconciliation) {
        if (answers.length !== 1 || answers[0]?.length !== 1 || answers[0][0] !== "acknowledge_unknown") {
          throw new Error("Activity reconciliation requires the exact acknowledge_unknown answer")
        }
        Database.transaction((db) =>
          resolveEngineInteractionRequest(db, {
            row,
            status: "answered",
            response: { answers },
            eventSource: "task-control.activity-reconciliation",
          }),
        )
        await deliverTaskRootIngress(row.task_id)
      } else {
        await Question.reply({ requestID: row.external_id, answers })
      }
    }
    return viewInteraction(requireInteractionInCurrentProject(interactionID))
  }

  export async function rejectInteraction(interactionID: string, raw: z.input<typeof RejectInteractionInput>) {
    const input = RejectInteractionInput.parse(raw)
    const row = requireInteractionInCurrentProject(interactionID)
    if (row.request_type === "permission") {
      await PermissionAuthority.reply({
        requestID: row.external_id,
        decision: "deny",
        autoReply: input.autoReply,
        message: input.message,
        actorID: "local-operator",
      })
    }
    if (row.request_type === "question") {
      assertInteractionIsRejectable(row, interactionID)
      await Question.reject(row.external_id)
    }
    return viewInteraction(requireInteractionInCurrentProject(interactionID))
  }

  /**
   * Activity-reconciliation gates cannot be rejected.
   *
   * They are inserted directly rather than registered with the Question
   * subsystem, so `Question.reject` throws `NotFoundError` and leaves the row
   * pending — the Task then waits on an Interaction nothing can resolve.
   * Rejecting it "successfully" would be worse: only an answered outcome
   * synthesizes the unknown-activity result, so a rejected gate returns the
   * ingress to `reconcile_required` with no pending Interaction at all, which
   * is a stall with no surface. The gate has exactly one exit.
   */
  function assertInteractionIsRejectable(row: { payload: unknown }, interactionID: string): void {
    if (!(row.payload as { activity_reconciliation?: unknown }).activity_reconciliation) return
    throw new Error(
      `Interaction ${interactionID} reconciles an external effect of unknown outcome and cannot be rejected. ` +
        `Answer it with acknowledge_unknown to let the Task continue.`,
    )
  }

  export async function replyUserInteraction(interactionID: string, raw: z.input<typeof UserReplyInteractionInput>) {
    const input = UserReplyInteractionInput.parse(raw)
    const row = requireInteractionInCurrentProject(interactionID)
    if (row.request_type === "permission") {
      await PermissionAuthority.replyUser({
        requestID: row.external_id,
        decision: input.decision ?? "allow_once",
        message: input.message,
        actorID: "local-operator",
        userInput: input.userInput,
      })
    }
    if (row.request_type === "question") {
      const answers = input.answers ?? answersFromMessage(input.message)
      if (!answers) throw new Error("answers or message are required for question replies")
      if ((row.payload as { activity_reconciliation?: unknown }).activity_reconciliation) {
        if (answers.length !== 1 || answers[0]?.length !== 1 || answers[0][0] !== "acknowledge_unknown") {
          throw new Error("Activity reconciliation requires the exact acknowledge_unknown answer")
        }
        Database.transaction((db) =>
          resolveEngineInteractionRequest(db, {
            row,
            status: "answered",
            response: { answers, user_input: input.userInput },
            eventSource: "task-control.activity-reconciliation",
          }),
        )
        await deliverTaskRootIngress(row.task_id)
      } else {
        await Question.reply({ requestID: row.external_id, answers, userInput: input.userInput })
      }
    }
    return viewInteraction(requireInteractionInCurrentProject(interactionID))
  }

  export async function rejectUserInteraction(interactionID: string, raw: z.input<typeof UserRejectInteractionInput>) {
    const input = UserRejectInteractionInput.parse(raw)
    const row = requireInteractionInCurrentProject(interactionID)
    if (row.request_type === "permission") {
      await PermissionAuthority.replyUser({
        requestID: row.external_id,
        decision: "deny",
        message: input.message,
        actorID: "local-operator",
        userInput: input.userInput,
      })
    }
    if (row.request_type === "question") {
      assertInteractionIsRejectable(row, interactionID)
      await Question.reject(row.external_id, input.userInput)
    }
    return viewInteraction(requireInteractionInCurrentProject(interactionID))
  }

  export async function requestTaskCancellation(taskID: string, options: CancelTaskOptions) {
    const task = requireTaskInCurrentProject(taskID)
    if (isTaskCancelled(task)) return taskCancellationProjection(taskID)
    if (isTaskTerminal(task)) {
      const lifecycle = deriveTaskStatus(task) as "completed" | "failed"
      throw new TaskCancellationLifecycleConflictError({
        message: `Task ${taskID} is already ${lifecycle}; cancellation accepts only a nonterminal or cancelled Task.`,
        taskID,
        lifecycle,
      })
    }
    const operation = cancelTaskWithIndependentProjectOwner(taskID, options)
    let convergenceFailure: unknown
    void operation.catch((error) => {
      convergenceFailure = error
      log.error("accepted Task cancellation convergence failed", {
        taskID,
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
      })
    })
    const receiptDeadline = Date.now() + 1_000
    while (Date.now() < receiptDeadline) {
      if (convergenceFailure) throw convergenceFailure
      const current = requireTaskInCurrentProject(taskID)
      if (isTaskCancelled(current)) return taskCancellationProjection(taskID)
      const pending = pendingTaskCancellationProjection(taskID)
      if (pending) return pending
      await Bun.sleep(5)
    }
    throw new Error(`Task ${taskID} cancellation did not persist an accepted receipt within 1000ms`)
  }

  /**
   * Drive one Task's requested cancellation to convergence.
   *
   * A cancellation that fails midway leaves the Task in `cancelling`, where
   * every ingress reduces to a state no fact append can leave. Running this
   * only at project bootstrap made a restart the sole escape; the control-plane
   * scan calls it on every pass over a `cancelling` Task instead.
   *
   * Returns whether a pending request existed.
   */
  export async function reconcilePendingTaskCancellation(taskID: string): Promise<boolean> {
    const pending = findPendingTaskCancellationRequestEvent(taskID)
    if (!pending) return false
    await cancelTask(taskID, { origin: pending.request.origin })
    return true
  }

  export async function reconcilePendingTaskCancellations(): Promise<number> {
    const rows = listProjectTasks(Instance.project.id, Number.MAX_SAFE_INTEGER)
      .filter((task) => isTaskActive(task))
      .map((task) => ({ id: task.id }))
    const operations: Promise<void>[] = []
    for (const row of rows) {
      const pending = findPendingTaskCancellationRequestEvent(row.id)
      if (!pending) continue
      operations.push(
        cancelTask(row.id, { origin: pending.request.origin })
          .then(() => undefined)
          .catch((error) => {
            log.error("recovered Task cancellation convergence failed", {
              taskID: row.id,
              requestEventID: pending.requested.id,
              error: error instanceof Error ? error.message : String(error),
            })
            throw error
          }),
      )
    }
    const settled = await Promise.allSettled(operations)
    const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    // Each failure is already recorded per Task above. Rethrowing here would
    // discard that isolation and let one stuck cancellation fail project open,
    // which strands every other Task in the Project behind it.
    if (failures.length > 0) {
      log.error("pending Task cancellations remain unconverged after recovery", {
        failed: failures.length,
        attempted: operations.length,
      })
    }
    return operations.length - failures.length
  }

  export function cancelTask(taskID: string, options: CancelTaskOptions): Promise<boolean> {
    return joinTaskCancellation(taskID, options, (operationOptions) =>
      operationOptions.projectDeletionAdmission
        ? runWithProjectDeletionIdentity({
            directory: taskCwd(taskID),
            projectDeletionAdmission: operationOptions.projectDeletionAdmission,
            fn: () => cancelTaskOnce(taskID, operationOptions),
          })
        : cancelTaskOnce(taskID, operationOptions),
    )
  }

  function cancelTaskWithIndependentProjectOwner(taskID: string, options: CancelTaskOptions): Promise<boolean> {
    return joinTaskCancellation(taskID, options, (operationOptions) =>
      runWithInitializedIndependentProject({
        directory: taskCwd(taskID),
        fn: () => cancelTaskOnce(taskID, operationOptions),
      }),
    )
  }

  function joinTaskCancellation(
    taskID: string,
    options: CancelTaskOptions,
    start: (operationOptions: CancelTaskOptions) => Promise<boolean>,
  ): Promise<boolean> {
    const task = requireTaskInCurrentProject(taskID)
    if (isTaskCancelled(task)) return Promise.resolve(true)
    const existing = cancellationOperations.get(taskID)
    if (existing) {
      if (options.projectDeletionAdmission) existing.options.projectDeletionAdmission = options.projectDeletionAdmission
      return existing.promise
    }
    const operationOptions = { ...options }
    const authority = RuntimeExecutionSettlement.reserve("task_cancellation", `task-cancellation:${taskID}`)
    const operation = start(operationOptions)
    const joined = { promise: operation, options: operationOptions }
    authority.settleWith(operation)
    cancellationOperations.set(taskID, joined)
    void operation
      .finally(() => {
        if (cancellationOperations.get(taskID) === joined) cancellationOperations.delete(taskID)
      })
      .catch(() => undefined)
    return operation
  }

  async function cancelTaskOnce(taskID: string, options: CancelTaskOptions): Promise<boolean> {
    const task = requireTaskInCurrentProject(taskID)
    if (!task.session_id) throw new Error(`Task ${taskID} has no root Session`)
    const origin = TaskCancellationOrigin.parse(options.origin)
    if (origin.sessionID) {
      await Session.assertLineageInProject({
        sessionID: origin.sessionID,
        projectID: task.project_id,
      })
    }
    const cancellationRequest = Database.immediateTransaction((db) => {
      const current = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
      if (!current) throw new NotFoundError({ message: `Task not found: ${taskID}` })
      const lifecycle = taskLifecycleProjectionInTransaction(db, taskID)
      if (lifecycle.status === "completed" || lifecycle.status === "failed") {
        throw new TaskCancellationLifecycleConflictError({
          message: `Task ${taskID} is already ${lifecycle.status}; cancellation accepts only an open or cancelled Task.`,
          taskID,
          lifecycle: lifecycle.status,
        })
      }
      if (lifecycle.status === "cancelled") return ProtocolStore.latestTaskEvent(taskID, "task.cancelled")!
      if (lifecycle.status === "cancelling" && lifecycle.requestEventID) {
        return ProtocolStore.requireEvent(lifecycle.requestEventID)
      }
      const requested = EngineProtocol.emitInTransaction(
        Event.TaskCancellationRequested,
        {
          actor: origin.actor,
          surface: origin.surface,
          reason: origin.reason,
          summary: `Cancellation requested: ${origin.reason}`,
          execution_epoch: lifecycle.epoch,
          ...(origin.messageID ? { messageID: origin.messageID } : {}),
          ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
          ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
          ...(origin.missionID ? { missionID: origin.missionID } : {}),
        },
        {
          source: origin.source,
          taskID,
          sessionID: origin.sessionID,
          correlationID: origin.requestID,
        },
      )
      return requested
    })
    const parsedCancellation = findPendingTaskCancellationRequestEvent(taskID)
    if (!parsedCancellation || parsedCancellation.requested.id !== cancellationRequest.id) {
      throw new Error(
        `Task ${taskID} cancellation request ${cancellationRequest.id} is not the durable pending authority`,
      )
    }
    const cancellationOrigin = parsedCancellation.request.origin
    const executionCancellationOrigin = createExecutionCancellationOrigin({
      actor: cancellationOrigin.actor,
      source: cancellationOrigin.source,
      surface: cancellationOrigin.surface,
      requestID: cancellationOrigin.requestID,
      reason: cancellationOrigin.reason,
      taskID,
      ...(cancellationOrigin.missionID ? { missionID: cancellationOrigin.missionID } : {}),
      ...(cancellationOrigin.messageID ? { messageID: cancellationOrigin.messageID } : {}),
      ...(cancellationOrigin.toolCallID ? { toolCallID: cancellationOrigin.toolCallID } : {}),
      ...(cancellationOrigin.toolPartID ? { toolPartID: cancellationOrigin.toolPartID } : {}),
      causationEventID: cancellationRequest.id,
    })
    const convergenceOwner = await acquireCancellationConvergence(taskID)
    if (!convergenceOwner) return true
    const logConvergenceStage = (stage: string) =>
      log.info("Task cancellation convergence stage", {
        taskID,
        requestEventID: cancellationRequest.id,
        stage,
      })
    logConvergenceStage("owner_acquired")
    let destructiveScope: ReturnType<typeof SessionPromptState.beginRootSessionDestructiveScope> | undefined
    try {
      convergenceOwner.assertActive()
      destructiveScope = SessionPromptState.beginRootSessionDestructiveScope(
        task.session_id,
        executionCancellationOrigin,
      )
      const taskDirectory = taskCwd(taskID)
      const decisions = createDecisionLog(taskID)
      const promptSettleInactivityMs = options.promptSettleInactivityMs ?? CANCEL_PROMPT_SETTLE_INACTIVITY_MS
      const ingressSettleInactivityMs = options.ingressSettleInactivityMs ?? CANCEL_INGRESS_SETTLE_INACTIVITY_MS

      // Helper: log + decision_log breadcrumb when an abort cannot be proven.
      // Cancellation success must mean the owned handle stopped; otherwise the
      // route returns a typed conflict instead of stamping a false terminal task.
      const onAbortFailure = (label: string, err: unknown, refs: Record<string, unknown>): never => {
        log.warn(`${label} failed during cancelTask`, {
          taskID,
          ...refs,
          error: err instanceof Error ? err.message : String(err),
        })
        decisions.append({
          phase: "cancel",
          key: "abort_failed",
          value: JSON.stringify({
            cancellationRequestEventID: cancellationRequest.id,
            label,
            ...refs,
            error: err instanceof Error ? err.message : String(err),
          }),
          reason:
            "session prompt or ingress settlement failed; cancellation is incomplete and task status was not marked cancelled.",
        })
        throw createTaskCancellationIncomplete({ taskID, handle: label, cause: err })
      }

      convergenceOwner.assertActive()
      const lifecycle = await requestTaskAgentLifecycleCancellation({
        task,
        reason: "task cancelled",
        handle: "task-api.cancel-task",
        origin: executionCancellationOrigin,
        signal: convergenceOwner.signal,
      })
      logConvergenceStage("session_cancellation_requested")
      convergenceOwner.assertActive()
      await assertSessionPromptSubtreeFinished({
        sessions: lifecycle.cancelledSessions,
        failures: lifecycle.cancellationFailures,
        taskID,
        inactivityTimeoutMs: promptSettleInactivityMs,
        signal: convergenceOwner.signal,
        projectDeletionAdmission: () => options.projectDeletionAdmission,
        publishTerminalStatus: false,
      })
      logConvergenceStage("session_prompts_settled")
      convergenceOwner.assertActive()
      decisions.append({
        phase: "cancel",
        key: "physical_lifecycle_report",
        value: JSON.stringify({
          taskID,
          cancellationRequestEventID: cancellationRequest.id,
          sessionIDs: lifecycle.sessionIDs,
          promptCancellations: lifecycle.cancelledSessions.map((session) => session.id),
          cancellationFailures: lifecycle.cancellationFailures.map((error) =>
            error instanceof Error ? error.message : String(error),
          ),
        }),
        reason:
          "Task cancellation proved every task-owned physical prompt handle stopped before terminal status; historical lifecycle and coordination facts are not retention gates.",
      })
      convergenceOwner.assertActive()
      if (beforeLateCancellationStageForTest) {
        await awaitWithAbort(
          Promise.resolve(
            beforeLateCancellationStageForTest({
              signal: convergenceOwner.signal,
              failHeartbeat: (mode) => convergenceOwner.failHeartbeatForTest(mode),
            }),
          ),
          convergenceOwner.signal,
        )
      }
      convergenceOwner.assertActive()
      logConvergenceStage("task_root_ingress_waiting")
      await SessionPromptState.waitForTaskRootIngressIdle(
        task.session_id,
        ingressSettleInactivityMs,
        convergenceOwner.signal,
      ).catch((err) => onAbortFailure("Task root ingress idle before cancellation terminal write", err, {}))
      logConvergenceStage("task_root_ingress_idle")
      convergenceOwner.assertActive()
      const terminalResult = await ProcessSupervisor.withTaskCancellationBarrier(
        taskID,
        () =>
          terminalTask(
            task,
            {
              status: "cancelled",
              error: "task cancelled",
            },
            "Task cancelled",
            {
              projectDir: taskDirectory,
              cancellationRequest: { eventID: cancellationRequest.id },
              transactionEffect(db) {
                convergenceOwner.assertInTransaction(db)
              },
            },
          ),
        { signal: convergenceOwner.signal },
      )
      logConvergenceStage("terminal_committed")
      if (!isTaskCancelled(terminalResult)) {
        decisions.append({
          phase: "cancel",
          key: "terminal_race",
          value: JSON.stringify({
            taskID,
            cancellationRequestEventID: cancellationRequest.id,
            terminalStatus: deriveTaskStatus(terminalResult),
          }),
          reason: "A different terminal task transition committed before cancellation.",
        })
        throw createTaskCancellationIncomplete({
          taskID,
          handle: "task terminal race",
          cause: new Error(
            `Task ${taskID} reached ${deriveTaskStatus(terminalResult)} before cancellation could commit its terminal event.`,
          ),
        })
      }
      return true
    } finally {
      try {
        destructiveScope?.close()
      } finally {
        convergenceOwner.close()
      }
    }
  }

  function boundTaskRowsForSessionsInTransaction(
    db: Database.TxOrDb,
    projectID: string,
    sessionIDs: readonly string[],
  ): Array<typeof EngineTaskTable.$inferSelect> {
    const rows: Array<typeof EngineTaskTable.$inferSelect> = []
    for (let offset = 0; offset < sessionIDs.length; offset += 64) {
      rows.push(
        ...db
          .select()
          .from(EngineTaskTable)
          .where(
            and(
              eq(EngineTaskTable.project_id, projectID),
              inArray(EngineTaskTable.session_id, sessionIDs.slice(offset, offset + 64)),
            ),
          )
          .all(),
      )
    }
    return rows
  }

  export async function deleteSession(
    sessionID: string,
    input?: {
      deleteTasks?: boolean
      projectID?: string
      cancellationOrigin?: TaskCancellationOriginValue
    },
  ) {
    const current = Instance.current()
    const retainedRetry = Database.use((db) => {
      const retainedRoot = db
        .select({ projectID: SessionTable.project_id })
        .from(SessionTable)
        .where(eq(SessionTable.id, sessionID))
        .get()
      if (!retainedRoot || !Session.deletedInTransaction(db, sessionID)) return undefined
      if (input?.projectID && retainedRoot.projectID !== input.projectID) return undefined
      if (current && retainedRoot.projectID !== current.project.id) return undefined
      const sessionIDs = Session.treeInProjectInTransaction(db, {
        sessionID,
        projectID: retainedRoot.projectID,
        includeDeletedRoot: true,
      })
      const tasks = boundTaskRowsForSessionsInTransaction(db, retainedRoot.projectID, sessionIDs)
      const active = tasks.filter((task) => !taskDeletedInTransaction(db, task.id))
      if (active.length > 0) {
        throw new TaskBoundSessionDeletionError({
          message: `Tombstoned Session ${sessionID} still owns active Task${active.length === 1 ? "" : "s"} ${active.map((task) => task.id).join(", ")}`,
          sessionID,
          taskIDs: active.map((task) => task.id),
        })
      }
      return tasks.map(taskCleanupTarget)
    })
    if (retainedRetry) {
      await removeTombstonedIntentProjections(retainedRetry)
      return true
    }
    const root = input?.projectID
      ? await Session.getInProject({ sessionID, projectID: input.projectID })
      : current
        ? await Session.getInProject({ sessionID, projectID: current.project.id })
        : await Session.get(sessionID)
    const sessionIDs = await Session.treeInProject({ sessionID, projectID: root.projectID })
    const readBoundTasks = (db: Database.TxOrDb) =>
      projectTaskRowsInTransaction(db, boundTaskRowsForSessionsInTransaction(db, root.projectID, sessionIDs))
    const bindingConflict = (tasks: TaskRow[], reason?: string) => {
      const taskIDs = tasks.map((task) => task.id)
      return new TaskBoundSessionDeletionError({
        message:
          reason ??
          `Session ${sessionID} is the root execution Session for Task${taskIDs.length === 1 ? "" : "s"} ` +
            `${taskIDs.join(", ")}; delete the bound Task${taskIDs.length === 1 ? "" : "s"} explicitly.`,
        sessionID,
        taskIDs,
      })
    }
    const boundTasks = Database.use(readBoundTasks)
    if (!input?.deleteTasks && boundTasks.length > 0) {
      throw bindingConflict(boundTasks)
    }
    const executionCancellationOrigin = physicalTaskCancellationOrigin({
      origin: input?.cancellationOrigin,
      defaultSource: "session.delete",
      defaultSurface: "session-api",
      defaultReason: "session deleted",
      targetSessionID: sessionID,
    })
    const requested = await requestSessionPromptSubtreeCancellation({
      sessionID,
      projectID: root.projectID,
      handle: "EngineService.deleteSession",
      origin: executionCancellationOrigin,
    })
    const ids = requested.sessionIDs
    const sessionsByDirectory = new Map<string, string[]>()
    for (const id of ids) {
      const session = await Session.getInProject({ sessionID: id, projectID: root.projectID })
      const directorySessions = sessionsByDirectory.get(session.directory)
      if (directorySessions) directorySessions.push(id)
      else sessionsByDirectory.set(session.directory, [id])
    }
    await assertSessionPromptSubtreeFinished({
      sessions: requested.cancelledSessions,
      failures: requested.failures,
      handle: "EngineService.deleteSession",
      publishTerminalStatus: false,
    })
    await Promise.all(
      [...sessionsByDirectory].map(([directory, sessionIDs]) =>
        Instance.tryProvideActive({
          directory,
          fn: async () => {
            await Promise.all(sessionIDs.map((id) => HostSessionMcpRuntime.dispose(id)))
          },
        }),
      ),
    )
    const tasksForDelete: TaskRow[] = []
    if (input?.deleteTasks) {
      for (const item of boundTasks) {
        if (isTaskTerminal(item)) {
          tasksForDelete.push(item)
          continue
        }
        if (!input.cancellationOrigin) {
          throw new Error(`deleteSession requires cancellation origin while task ${item.id} is non-terminal.`)
        }
        await cancelTask(item.id, { origin: input.cancellationOrigin })
        tasksForDelete.push(requireTaskInCurrentProject(item.id))
      }
      for (const item of tasksForDelete) {
        await awaitTaskRootIngressSettled(item, CANCEL_INGRESS_SETTLE_INACTIVITY_MS)
      }
    }
    const rootMetadata = root.metadata as Record<string, unknown> | undefined
    if (
      tasksForDelete.length > 0 ||
      root.kind === "mission" ||
      rootMetadata?.panelCreation !== undefined ||
      rootMetadata?.globalChatStart !== undefined
    ) {
      const cleanupTargets = tasksForDelete.map(taskCleanupTarget)
      await settleTaskCleanupOwners(cleanupTargets)
      Database.immediateTransaction((db) => {
        assertTasksRemainTerminalForPhysicalDelete(db, tasksForDelete)
        deadLetterSchedulerSessionDeliveriesInTransaction(db, {
          sessionIDs: ids,
          errorName: "SchedulerRecipientDeletedError",
          message: `Recipient Session tree ${sessionID} was tombstoned.`,
        })
        deadLetterSchedulerTaskDeliveriesInTransaction(db, {
          taskIDs: tasksForDelete.map((task) => task.id),
          errorName: "SchedulerRecipientDeletedError",
          message: `Recipient Task tree for Session ${sessionID} was tombstoned.`,
        })
        deadLetterSchedulerSourceDeliveriesInTransaction(db, {
          sessionIDs: ids,
          errorName: "SchedulerSourceDeletedError",
          message: `Source Session tree ${sessionID} was tombstoned.`,
        })
        for (const task of tasksForDelete) appendTaskDeletedBoundaryInTransaction(db, task)
        for (const id of ids) appendSessionDeletedBoundaryInTransaction(db, id)
        // The durable session.deleted Protocol fact above is the deletion
        // authority. The Session Bus event is only an in-process projection for
        // a retained runtime; deleting a persisted Session whose repository is
        // absent must not fabricate an Instance merely to notify no listeners.
        Database.effect(() =>
          Instance.tryProvideActive({
            directory: root.directory,
            fn: () => Bus.publish(Session.Event.Deleted, { info: root }),
          }),
        )
      })
      await removeTombstonedIntentProjections(cleanupTargets)
      return true
    }
    await deleteRowsThenTaskArtifacts(tasksForDelete, () => {
      Database.transaction((db) => {
        const currentBoundTasks = readBoundTasks(db)
        if (!input?.deleteTasks && currentBoundTasks.length > 0) {
          throw bindingConflict(currentBoundTasks)
        }
        if (input?.deleteTasks) {
          const expectedTaskIDs = new Set(tasksForDelete.map((task) => task.id))
          if (
            currentBoundTasks.length !== expectedTaskIDs.size ||
            currentBoundTasks.some((task) => !expectedTaskIDs.has(task.id))
          ) {
            throw bindingConflict(
              currentBoundTasks,
              `Session ${sessionID} Task bindings changed during deletion settlement; retry from current Task evidence.`,
            )
          }
        }
        assertTasksRemainTerminalForPhysicalDelete(db, tasksForDelete)
        deadLetterSchedulerSessionDeliveriesInTransaction(db, {
          sessionIDs: ids,
          errorName: "SchedulerRecipientDeletedError",
          message: `Recipient Session tree ${sessionID} was deleted.`,
        })
        deadLetterSchedulerTaskDeliveriesInTransaction(db, {
          taskIDs: tasksForDelete.map((task) => task.id),
          errorName: "SchedulerRecipientDeletedError",
          message: `Recipient Task tree for Session ${sessionID} was deleted.`,
        })
        deadLetterSchedulerSourceDeliveriesInTransaction(db, {
          sessionIDs: ids,
          errorName: "SchedulerSourceDeletedError",
          message: `Source Session tree ${sessionID} was deleted.`,
        })
        detachProtocolEventsFromDeletedTasksInTransaction(
          db,
          tasksForDelete.map((task) => task.id),
        )
        if (tasksForDelete.length > 0) {
          deleteEngineTasksForProjectSessions(db, { projectID: root.projectID, sessionIDs: ids })
        }
        deleteSettledSessionTreeRows(db, {
          sessionID,
          projectID: root.projectID,
          expectedSessionIDs: ids,
        })
        Database.effect(() => Database.incrementalVacuum())
      })
    })
    return true
  }

  function missionTaskResumeReceipt(taskID: string, toolCallID: string) {
    const row = Database.use((db) =>
      db
        .select({ id: EngineArtifactTable.id, payload: EngineArtifactTable.payload })
        .from(EngineArtifactTable)
        .where(
          and(
            eq(EngineArtifactTable.task_id, taskID),
            eq(EngineArtifactTable.kind, "mission_acceptance_resume_receipt"),
            sql`json_extract(${EngineArtifactTable.payload}, '$.tool_call_id') = ${toolCallID}`,
          ),
        )
        .get(),
    )
    if (!row) return undefined
    return { artifactID: row.id, receipt: MissionTaskResumeReceiptSchema.parse(row.payload) }
  }

  function assertMissionTaskResumeReceiptIdentity(
    existing: NonNullable<ReturnType<typeof missionTaskResumeReceipt>>,
    input: {
      importer: CrossTaskArtifactImporter
      toolPartID: string
      expectedAcceptanceLedgerArtifactID: string | null
      acceptanceGap: MissionAcceptanceGap
    },
  ) {
    const receipt = existing.receipt
    if (
      receipt.mission_id !== input.importer.missionID ||
      receipt.mission_session_id !== input.importer.sessionID ||
      receipt.panel_message_id !== input.importer.messageID ||
      receipt.tool_part_id !== input.toolPartID ||
      JSON.stringify(receipt.acceptance_gap) !== JSON.stringify(MissionAcceptanceGapSchema.parse(input.acceptanceGap))
    ) {
      throw new Error(`Mission acceptance-resume tool identity conflicts with receipt ${existing.artifactID}.`)
    }
  }

  function missionTaskResumeLifecycleConflict(input: { task: TaskRow; reviewed: TerminalLifecycleReference }) {
    const lifecycle = deriveTaskStatus(input.task)
    return new MissionTaskResumeLifecycleConflictError({
      message: `Task ${input.task.id} lifecycle is ${lifecycle}; re-query the Task and review its current terminal occurrence before resuming.`,
      taskID: input.task.id,
      reviewedTerminalLifecycleReference: input.reviewed,
      ...(isTaskTerminal(input.task)
        ? { currentTerminalLifecycleReference: requireCurrentTerminalLifecycleReference(input.task.id) }
        : {}),
      currentLifecycle: lifecycle,
    })
  }

  function missionTaskCancellationAuthority(task: TaskRow) {
    const terminalLifecycleReference = requireCurrentTerminalLifecycleReference(task.id)
    const cancellation = taskCancellationProjection(task.id)
    return {
      kind: "cancellation_authority_required" as const,
      task_id: task.id,
      terminal_lifecycle_reference: terminalLifecycleReference,
      cancellation: {
        actor: cancellation.actor,
        source: cancellation.source,
        request_event_id: cancellation.requestEventID,
        terminal_event_id: cancellation.terminalEventID,
        reason: cancellation.reason,
      },
    }
  }

  export async function resumeMissionTask(input: {
    taskID: string
    importer: CrossTaskArtifactImporter
    reviewedTerminalLifecycleReference: TerminalLifecycleReference
    expectedAcceptanceLedgerArtifactID: string | null
    acceptanceGap: MissionAcceptanceGap
    completeEvidenceLocators: ArtifactReadLocator[]
    toolPartID: string
  }) {
    const reviewed = TerminalLifecycleReferenceSchema.parse(input.reviewedTerminalLifecycleReference)
    const acceptanceGap = MissionAcceptanceGapSchema.parse(input.acceptanceGap)
    if (!sameTerminalLifecycleReference(acceptanceGap.reviewed_terminal_lifecycle_reference, reviewed)) {
      throw new Error(`Mission acceptance gap ${acceptanceGap.gap_id} does not bind the reviewed terminal occurrence.`)
    }
    const evidenceLocators = z
      .array(ArtifactReadLocatorSchema)
      .min(1)
      .max(64)
      .parse(acceptanceGapEvidenceLocators(acceptanceGap))
    const task = requireTaskInCurrentProject(input.taskID)
    await assertTaskRootSessionLineageInCurrentProject(task)
    requireMissionTaskLineageAuthority({
      sourceTaskID: input.taskID,
      projectID: Instance.project.id,
      importer: input.importer,
    })
    const existing = missionTaskResumeReceipt(input.taskID, input.importer.toolCallID)
    if (existing) {
      assertMissionTaskResumeReceiptIdentity(existing, { ...input, acceptanceGap })
      return {
        kind: "resumed" as const,
        receipt_artifact_id: existing.artifactID,
        ...existing.receipt,
        wake_status: "accepted" as const,
      }
    }
    if (!isTaskTerminal(task)) throw missionTaskResumeLifecycleConflict({ task, reviewed })
    const currentReference = requireCurrentTerminalLifecycleReference(input.taskID)
    if (!sameTerminalLifecycleReference(reviewed, currentReference)) {
      throw missionTaskResumeLifecycleConflict({ task, reviewed })
    }
    if (isTaskCancelled(task)) return missionTaskCancellationAuthority(task)
    if (!isTaskCompleted(task) && !isTaskFailed(task)) {
      throw missionTaskResumeLifecycleConflict({ task, reviewed })
    }

    const completeKeys = new Set(input.completeEvidenceLocators.map(artifactReadLocatorKey))
    const unreadEvidenceLocators = evidenceLocators.filter(
      (locator) => !completeKeys.has(artifactReadLocatorKey(locator)),
    )
    if (unreadEvidenceLocators.length > 0) {
      throw new MissionTaskResumeEvidenceError({
        message: `Task ${task.id} resume evidence must be completely read from this Task in the current Mission Turn.`,
        taskID: task.id,
        unreadEvidenceLocators,
      })
    }

    const now = Date.now()
    const acceptanceLedgerArtifactID = Identifier.deterministic(
      "artifact",
      `mission-acceptance-ledger-v1\0${input.taskID}\0${input.importer.toolCallID}`,
    )
    const bundle = await buildTaskSessionMessageBundle(
      task,
      renderMissionAcceptanceRepairMessage(acceptanceGap),
      "mission.acceptance_resume",
      "mission",
    )
    const event = OrchestratorEventSchema.parse({
      missionAcceptanceResume: {
        missionID: input.importer.missionID,
        missionSessionID: input.importer.sessionID,
        messageID: bundle.info.id,
        panelMessageID: input.importer.messageID,
        toolCallID: input.importer.toolCallID,
        toolPartID: input.toolPartID,
        reviewedTerminalLifecycleReference: reviewed,
        acceptanceLedgerRevisionArtifactID: acceptanceLedgerArtifactID,
        acceptanceGap,
      },
    })
    let durableReceipt: { artifactID: string; receipt: z.infer<typeof MissionTaskResumeReceiptSchema> } | undefined
    try {
      await SessionPromptState.runTaskRootIngress({
        rootSessionID: task.session_id!,
        wakeID: `mission-acceptance-resume:${input.importer.toolCallID}`,
        run: async () => {
          const committed = missionTaskResumeReceipt(input.taskID, input.importer.toolCallID)
          if (committed) {
            assertMissionTaskResumeReceiptIdentity(committed, { ...input, acceptanceGap })
            durableReceipt = committed
            return
          }
          const persisted = await Session.persistMessageWithCommit(bundle, () => {
            Database.use((db) => {
              const persisted = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
              if (!persisted) throw new NotFoundError({ message: `Task not found: ${input.taskID}` })
              const current = projectTaskRowInTransaction(db, persisted)
              if (!isTaskTerminal(current)) throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              const transactionReference = requireCurrentTerminalLifecycleReference(input.taskID)
              if (!sameTerminalLifecycleReference(reviewed, transactionReference)) {
                throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              }
              if (isTaskCancelled(current)) throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              const openedTask = openTaskForContinuationInTransaction({ db, taskID: input.taskID, now })
              appendTaskRewindClearedInTransaction(input.taskID, now, "mission.acceptance_resume")
              const executionEpoch = taskLifecycleProjectionInTransaction(db, input.taskID).epoch
              appendTaskAcceptanceLedgerRevisionInTransaction({
                db,
                taskID: input.taskID,
                artifactID: acceptanceLedgerArtifactID,
                executionEpoch,
                expectedPreviousArtifactID: input.expectedAcceptanceLedgerArtifactID,
                gap: acceptanceGap,
                now,
              })
              const ingressArtifactID = persistMissionAcceptanceResumeIngressInTransaction(db, {
                task: openedTask,
                event,
                now,
              })
              EngineProtocol.emitInTransaction(
                Event.TaskMessageRecorded,
                {
                  taskID: input.taskID,
                  source: "mission.acceptance_resume",
                  summary: "Mission acceptance repair message recorded",
                  messageID: bundle.info.id,
                },
                { taskID: input.taskID, sessionID: input.importer.sessionID, source: "mission.acceptance_resume" },
              )
              const receipt = MissionTaskResumeReceiptSchema.parse({
                protocol: "mission-acceptance-resume-receipt",
                task_id: input.taskID,
                mission_id: input.importer.missionID,
                mission_session_id: input.importer.sessionID,
                panel_message_id: input.importer.messageID,
                tool_call_id: input.importer.toolCallID,
                tool_part_id: input.toolPartID,
                message_id: bundle.info.id,
                wake_id: bundle.info.id,
                ingress_artifact_id: ingressArtifactID,
                acceptance_ledger_revision_artifact_id: acceptanceLedgerArtifactID,
                prior_terminal_lifecycle_reference: reviewed,
                acceptance_gap: acceptanceGap,
                time_accepted: now,
              })
              const artifactID = insertEngineArtifact(db, {
                taskID: input.taskID,
                kind: "mission_acceptance_resume_receipt",
                label: "accepted",
                payload: receipt,
                timeCreated: now,
              })
              durableReceipt = { artifactID, receipt }
            })
          })
          if (persisted.info.role !== "user" || persisted.info.author !== "mission") {
            throw new Error(`Mission acceptance-resume message ${persisted.info.id} has invalid persisted participant.`)
          }
        },
      })
    } catch (error) {
      const current = requireTaskInCurrentProject(input.taskID)
      if (isTaskCancelled(current)) return missionTaskCancellationAuthority(current)
      throw error
    }
    if (!durableReceipt) throw new Error(`Mission acceptance-resume transaction committed without a receipt.`)
    // The acceptance owner serializes the Message, epoch, ledger, ingress and
    // receipt transaction. Reconciliation must begin only after that physical
    // owner is released: activating the persisted ingress while still holding
    // the same root owner would queue behind itself and deadlock.
    const wakeStatus: DispatchTaskLoopResult = await dispatchPersistedTaskLoop(
      input.taskID,
      durableReceipt.receipt.ingress_artifact_id,
    )
    return {
      kind: "resumed" as const,
      receipt_artifact_id: durableReceipt.artifactID,
      ...durableReceipt.receipt,
      wake_status: wakeStatus,
    }
  }

  /**
   * An operator message resumes the Task it is addressed to.
   *
   * A Task is only terminal to the machinery, never to the operator: the thing
   * they are looking at is a conversation with an agent, so telling it what to
   * do next has to be the way to continue it. Before this, a message on a
   * terminal Task woke a conversation-only Turn — the agent replied and no work
   * happened — and resuming meant finding a separate control. That reads as the
   * product being broken, and it is a second vocabulary for what the message
   * already says.
   *
   * Reopening is one durable act: a new execution epoch, with the prior
   * terminal occurrence left intact as an immutable fact at its old epoch. The
   * message then lands on the new epoch as ordinary ingress. "Just asking a
   * question" keeps working without a mode of its own — the Orchestrator already
   * judges a status-only message as conversation ingress and answers it with
   * `no_action` (prompt/core/orchestrator-core.txt).
   *
   * Cancelled reopens too. Cancellation ends an *occurrence*, which is why the
   * ingress reduction calls it `terminal_inapplicable` for "a cancelled, closed,
   * or superseded epoch" — the epoch, not the Task. Excluding it left one
   * terminal state whose only exit was a dedicated Retry control, which is the
   * exact shape this reform exists to remove: a state you cannot leave with an
   * ordinary action. The "stray message" it was guarding against cannot happen —
   * non-operator delivery can never obtain reopen authority, so the only thing
   * that reaches here is the operator's own explicit message, and a person
   * typing into a stopped conversation is asking for it to continue.
   *
   * Deletion is the boundary that does fence a reopen, and the tracked contract
   * says so explicitly: `task.deleted` fences every new ingress, lease, reopen,
   * scheduler, Artifact, and activity write. Acceptance refuses the ingress a
   * moment later regardless, so without this guard a deleted Task would take an
   * epoch bump for a message that is then refused.
   */
  function reopenTerminalTaskForOperatorMessage(taskID: string): void {
    Database.transaction((db) => reopenTerminalTaskForOperatorMessageInTransaction(db, taskID))
  }

  function reopenTerminalTaskForOperatorMessageInTransaction(db: Database.TxOrDb, taskID: string): void {
    const persisted = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
    if (!persisted) throw new NotFoundError({ message: `Task not found: ${taskID}` })
    if (taskDeletedInTransaction(db, taskID)) return
    const current = projectTaskRowInTransaction(db, persisted)
    if (!isTaskTerminal(current)) return
    openTaskForContinuationInTransaction({ db, taskID, now: Date.now() })
  }

  /** The reopen rule is the whole contract of this change and is asserted
   *  directly; driving it through the HTTP path would only add model config and
   *  loop dispatch, neither of which this rule depends on. */
  export const OperatorMessageResumeTestHooks = { reopenTerminalTaskForOperatorMessage }

  export async function handleTaskMessage(taskID: string, raw: z.input<typeof TaskMessageInput>) {
    const input = TaskMessageInput.parse(raw)
    const task = requireTaskInCurrentProject(taskID)
    const rootSession = await assertTaskRootSessionLineageInCurrentProject(task)
    assertTaskOperatorMessageAccepted(task, input.text, input.attachments ?? [])
    requireTaskPackageRevisionBinding(taskID)
    const attachmentRefs = await materializeApiAttachments({
      attachments: input.attachments,
      label: `Task ${taskID} operator attachment`,
      projectID: Instance.project.id,
    })
    const storedOverlay =
      rootSession.metadata &&
      typeof rootSession.metadata === "object" &&
      !Array.isArray(rootSession.metadata) &&
      rootSession.metadata.configOverlay &&
      typeof rootSession.metadata.configOverlay === "object" &&
      !Array.isArray(rootSession.metadata.configOverlay)
        ? (rootSession.metadata.configOverlay as Record<string, unknown>)
        : {}
    const previousModelOverlay = typeof storedOverlay.model === "string" ? storedOverlay.model : null
    const storedAgentOverlay =
      storedOverlay.agent && typeof storedOverlay.agent === "object" && !Array.isArray(storedOverlay.agent)
        ? (storedOverlay.agent as Record<string, unknown>)
        : {}
    const previousAgentModelOverlay = Object.fromEntries(
      Object.entries(storedAgentOverlay).flatMap(([agentID, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return []
        const model = (value as Record<string, unknown>).model
        return typeof model === "string" ? [[agentID, model] as const] : []
      }),
    )
    let preparedOverlay: Awaited<ReturnType<typeof Session.prepareConfigOverlayMergeInProject>> | undefined
    if (input.model) {
      const agentModelClearPatch = Object.fromEntries(
        Object.keys(previousAgentModelOverlay).map((agentID) => [agentID, { model: null }]),
      )
      const modelPatch = {
        model: input.model,
        ...(Object.keys(agentModelClearPatch).length > 0 ? { agent: agentModelClearPatch } : {}),
      }
      const previousConfig = await EffectiveConfig.effective({ sessionID: rootSession.id })
      const modelPreviewConfig = Config.mergeOverlay(previousConfig, modelPatch)
      await validateConfigModelReferences(modelPreviewConfig, "taskMessage.configOverlay")
      preparedOverlay = await Session.prepareConfigOverlayMergeInProject({
        sessionID: rootSession.id,
        projectID: Instance.project.id,
        patch: Config.Overlay.parse(modelPatch),
      })
    }
    const preparedAttachments =
      attachmentRefs.length > 0 ? await prepareTaskAttachmentAppends(taskID, attachmentRefs) : undefined
    {
      // Every durable fact of this operator message — model overlay,
      // attachment references, reopen epoch, the Message itself and its
      // ingress — commits in ONE transaction. A process death leaves either
      // the whole accepted occurrence or nothing; the next Turn can never
      // observe overlay/attachment/reopen state for which no Message exists.
      const note = await continueTaskMessage(taskID, input.text, input.source, attachmentRefs, input.metadata, (db) => {
        preparedOverlay?.commitInTransaction(db)
        preparedAttachments?.commitInTransaction(db)
        reopenTerminalTaskForOperatorMessageInTransaction(db, taskID)
      })
      const ingressID = Database.use(
        (db) =>
          db
            .select({ id: EngineTaskRootIngressTable.id })
            .from(EngineTaskRootIngressTable)
            .where(
              and(
                eq(EngineTaskRootIngressTable.task_id, taskID),
                eq(EngineTaskRootIngressTable.source, "message"),
                eq(EngineTaskRootIngressTable.source_id, note.user_message.info.id),
              ),
            )
            .get()?.id,
      )
      const message =
        note.wakeStatus === "accepted"
          ? "Operator message recorded and accepted for delivery."
          : "Operator message recorded."
      return {
        message,
        wake_status: note.wakeStatus,
        ...(ingressID ? { ingress_id: ingressID } : {}),
        user_message: note.user_message,
      }
    }
  }

  export async function getTaskOperatorModelContext(taskID: string) {
    const task = requireTaskInCurrentProject(taskID)
    if (!task.session_id) {
      throw new Error(
        `Task ${task.id} has no root session — cannot resolve operator model context; recreate the task or repair task.session_id`,
      )
    }
    const rootSession = await assertTaskRootSessionLineageInCurrentProject(task)
    const ctx = await messageContext(rootSession.id, task.id)
    if (!ctx) {
      throw new Error(
        `Task ${task.id} session ${task.session_id} has no agent/model context — cannot resolve operator model context`,
      )
    }
    return {
      taskID: task.id,
      sessionID: task.session_id,
      agent: ctx.agent,
      model: ctx.model,
    }
  }

  /**
   * 向 task 注入用户消息。
   *
   * Task-level input has a single owner: the root Session wake path. Targeted operator steer must use
   * /task/:id/session/:sessionID/operator-steer.
   */
  export async function injectMessage(taskID: string, message: string) {
    const wake = await appendAndWakeTaskOperatorMessage({ taskID, text: message, source: "api_inject" })
    return {
      appended: true,
      orchestratorWoken: wake.resumed,
      status: deriveTaskStatus(requireTaskInCurrentProject(taskID)) as string,
    }
  }
}

bindMissionClosingChildTaskCanceller((taskID, origin) => EngineService.cancelTask(taskID, { origin }))
bindMissionRetentionSessionDeleter((sessionID, input) => EngineService.deleteSession(sessionID, input))

function answersFromMessage(message?: string) {
  const text = message?.trim()
  if (!text) return
  return [[text]]
}
