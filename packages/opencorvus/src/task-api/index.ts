import z from "zod"
import { randomUUID } from "node:crypto"
import { lstat } from "node:fs/promises"
import { NamedError } from "@opencorvus-ai/util/error"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { PromptProfile } from "@/agent/prompt-profile"
import { RuntimeTemplateRegistry } from "@/agent/runtime-template-registry"
import { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import type { ProjectedWorkerBinding } from "@/agent/projected-worker-binding"
import { WorkerTurnDescriptor } from "@/agent/worker-turn-descriptor"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { ExpertSquadInstallLock } from "@/expert-squad/install-lock"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { resolveAgentModelRef, resolveConfiguredModelRef } from "@/agent/model"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { EffectiveConfig } from "@/config/effective"
import { discoverChecks, resolveConfig, resolvedChecks } from "@/acceptance/checks/discovery"
import { parseAcceptanceSpecs, renderSpecsAsText } from "@/acceptance/types"
import { CapabilityRules } from "@/capability/rules"
import { PermissionAuthority } from "@/permission/authority"
import { ProtocolStore } from "@/protocol/store"
import {
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
  schedulerSourceBodyInTransaction,
  settleSchedulerDeliveryInTransaction,
  type SchedulerDeliveryReceipt,
} from "@/protocol/delivery"
import type { SchedulerEndpoint, SchedulerMessageKind } from "@/protocol/schema"
import { EngineProtocol } from "@/engine/protocol"
import { ensureGitProjectMetadata } from "@/engine/git-project-metadata"
import { Instance } from "@/project/instance"
import type { ProjectDeletionAdmission } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Project } from "@/project/project"
import { Worktree } from "@/worktree"
import { Question } from "@/question"
import { TaskQueueService } from "@/scheduler/task-queue-service"
import { Session } from "@/session"
import { SessionContext } from "@/session/context"
import { Message } from "@/session/message"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { SessionPrompt } from "@/session/prompt"
import { SessionStatus } from "@/session/status"
import { Database, NotFoundError, and, eq, inArray, isNull, sql } from "@/storage/db"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import { awaitWithAbort } from "@/util/abort"
import { compileBoard, boardTag } from "@/workbench/board"
import { compileBrief } from "@/workbench/brief"
import {
  EngineArtifactTable,
  EngineTaskCancellationAuthorityTable,
  EngineChannelBindingTable,
  EngineGoalTable,
  EngineTaskTable,
  type EngineInteractionStatus,
  type EngineMetadata,
} from "@/engine/engine.sql"
import { insertEngineArtifact } from "@/engine/artifact"
import {
  buildObservationCleanupRowsForTask,
  settleBuildObservationCleanup,
} from "@/engine/build-observation-cleanup"
import {
  TaskCreationIdempotencyConflictError,
  TaskExpectedPackageDigestConflictError,
  requireTaskPackageRevisionBinding,
} from "@/engine/task-package-revision-binding"
import {
  assertTaskExecutionCapsuleReplay,
  configuredTaskProcessMode,
  prepareTaskProcessBinding,
} from "@/engine/task-execution-capsule-binding"
import { deleteEngineChannelBindingsForTask } from "@/engine/channel-binding"
import { resolveEngineInteractionRequest } from "@/engine/interaction-request"
import { insertEngineProgressSnapshot } from "@/engine/progress"
import {
  deleteEngineTask,
  deleteEngineTasksForProjectSessions,
  setEngineTaskArchived,
  setEngineTaskBudget,
  setEngineTaskPinned,
  setEngineTaskTitle,
  touchEngineTask,
  clearEngineTaskRewindCursor,
} from "@/engine/task"
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
  drainQueuedTaskEvent,
  discardQueuedTaskEvent,
  terminalizeQueuedTaskEventsForCancellationInTransaction,
  directoryQueueSnapshot,
  dispatchPersistedTaskLoop,
  dispatchTaskLoop,
  persistQueuedTaskIntentInTransaction,
  persistQueuedRootMessageWakeInTransaction,
  persistQueuedMissionAcceptanceResumeInTransaction,
  queuedTaskEventStats,
  retirePendingQueuedTaskEventsForOperatorIntentInTransaction,
  type DispatchTaskLoopResult,
  reorderQueuedTasksForCwd,
  startQueuedTaskInCwd,
  taskCwd,
} from "@/engine/queue"
import { openTaskForContinuationInTransaction, openTaskForOperatorIntentInTransaction } from "@/engine/task-intent-open"
import {
  applyGoalGraphMutationInTransaction,
  recordTaskInfrastructureError,
  type ApplyGoalGraphMutationInput,
} from "@/engine/persist"
import { EngineInteraction } from "@/engine/interaction"
import { terminalTask, updateTask } from "@/engine/state"
import { findTaskCompletionDecisionForTerminalTime } from "@/engine/completion-decision"
import {
  requireCurrentTerminalLifecycleReference,
  sameTerminalLifecycleReference,
  TerminalLifecycleReferenceSchema,
  type TerminalLifecycleReference,
} from "@/engine/terminal-lifecycle-reference"
import {
  deriveTaskStatus,
  isTaskActive,
  isTaskCancelled,
  isTaskCompleted,
  isTaskFailed,
  isTaskQueued,
  isTaskTerminal,
} from "@/engine/task-status"
import { persistQueuedTask } from "@/engine/pipeline"
import { SessionPromptState } from "@/session/prompt/state"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { createExecutionCancellationOrigin, type ExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { TaskChannelBindingProjectConflictError, TaskGlobalProjectBindingError } from "@/engine/task-project-error"
import { ProjectMemory } from "@/memory/project-memory"
import {
  SchedulerDeliveryReference,
  TaskRootMessageKind,
  TaskRootMessageProvenance,
  type SchedulerDeliveryReference as SchedulerDeliveryReferenceValue,
} from "./task-root-message"
import {
  assertNoCallerSuppliedTaskCreatorMetadata,
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
import {
  publishTaskAgentCancellationStatusesAfterSettlement,
  requestTaskAgentLifecycleCancellation,
} from "@/engine/task-agent-lifecycle"
import {
  cancelPendingAgentCoordinationRequestsForTask,
  createOperatorSteerCoordinationRequest,
  resolveAgentCoordinationSessionLineage,
} from "@/engine/agent-coordination"
import { createDecisionLog } from "@/decision-log"
import { DecisionLogBundle } from "@/decision-log/bundle"
import { EngineEventLog } from "@/engine/event-log"
import { OperatorSteerTargetError } from "@/orchestrator/operator-steer"
import { projectPersistedTaskMessage, type ProjectedTaskMessage } from "@/orchestrator/protocol/message-bridge"
import { OrchestratorEventSchema } from "@/orchestrator/event"
import { sessionRole, taskIDForSession } from "@/engine/task-session-lineage"
import {
  findInteractionByExternal,
  findTask,
  findTaskByRequest,
  listGlobalTasks,
  listProjectTasks,
  listTaskRows,
  searchProjectTasks,
  listOwnedPromptSessionsForTask,
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
} from "@/engine/store"
import { Identifier } from "@/id/id"
import { AttachmentStore } from "@/storage/attachment-store"
import { SessionWake } from "@/session/wake"
import { withTaskCreationOwnerLock } from "@/engine/task-creation-owner"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { removeTaskArtifactRoot } from "@/task-artifact/store"
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

const log = Log.create({ service: "assistant" })

type TaskMessageWakeStatus = Extract<DispatchTaskLoopResult, "started" | "queued"> | "not_woken"

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

export const TaskControlIntentLifecycleConflictError = NamedError.create(
  "TaskControlIntentLifecycleConflictError",
  z.object({
    message: z.string(),
    taskID: z.string(),
    operation: z.enum(["retry", "replan"]),
    lifecycle: z.enum(["queued", "active"]),
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
    currentLifecycle: z.enum(["queued", "active", "completed", "failed", "cancelled"]),
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
    prior_terminal_lifecycle_reference: TerminalLifecycleReferenceSchema,
    evidence_locators: z.array(ArtifactReadLocatorSchema).min(1).max(64),
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

async function assertTaskCreationReplayMatches(input: {
  taskID: string
  identityKind: "request" | "channel"
  identity: string
  selectedProfileID: string
  expectedPackageDigest?: string
}): Promise<void> {
  const pinnedPackageRevision = requireTaskPackageRevisionBinding(input.taskID)
  const profileMatches = pinnedPackageRevision.id === input.selectedProfileID
  const digestMatches =
    input.expectedPackageDigest === undefined || pinnedPackageRevision.package_digest === input.expectedPackageDigest
  if (profileMatches && digestMatches) {
    await assertTaskExecutionCapsuleReplay({ taskID: input.taskID, requestedRoot: Instance.directory })
    return
  }
  throw new TaskCreationIdempotencyConflictError({
    message: `${input.identityKind} ${input.identity} is already committed as Task ${input.taskID} with another immutable package revision`,
    taskID: input.taskID,
    identityKind: input.identityKind,
    identity: input.identity,
    pinnedPackageRevision,
    requestedProfileID: input.selectedProfileID,
    expectedPackageDigest: input.expectedPackageDigest,
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

function assertTaskProjectIsConcrete(task: TaskRow) {
  if (task.project_id !== "global") return
  throw new TaskGlobalProjectBindingError({
    message: `Task ${task.id} is bound to project global. Task execution requires a concrete Git project; recreate the task after initializing the directory as a Git repository.`,
    taskID: task.id,
    projectID: task.project_id,
  })
}

function assertTaskBelongsToCurrentProject(task: TaskRow) {
  assertTaskProjectIsConcrete(task)
  const current = Instance.current()
  if (!current) return
  if (task.project_id === current.project.id) return
  throw new NotFoundError({ message: `Task not found: ${task.id}` })
}

function requireTaskInCurrentProject(taskID: string): TaskRow {
  const task = requireTask(taskID)
  assertTaskBelongsToCurrentProject(task)
  return task
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

async function awaitRootSessionWakeQueueSettled(task: TaskRow, inactivityTimeoutMs: number): Promise<void> {
  if (!task.session_id) return
  try {
    await SessionPromptState.waitForRootWakeQueueIdle(task.session_id, inactivityTimeoutMs)
  } catch (cause) {
    throw createTaskCancellationIncomplete({
      taskID: task.id,
      handle: "root Session wake queue settlement before destructive operation",
      cause,
    })
  }
}

async function awaitTaskQueuePromptsIdle(input: {
  sessionIDs: string[]
  inactivityTimeoutMs: number
  taskID?: string
  handle: string
  signal?: AbortSignal
}): Promise<void> {
  input.signal?.throwIfAborted()
  try {
    await TaskQueueService.awaitSessionPromptsIdle({
      sessionIDs: input.sessionIDs,
      inactivityTimeoutMs: input.inactivityTimeoutMs,
      signal: input.signal,
    })
  } catch (cause) {
    throw createTaskCancellationIncomplete({
      taskID: input.taskID,
      handle: input.handle,
      cause,
    })
  }
}

async function settleTaskSessionWork(
  task: TaskRow,
  input: {
    reason: string
    handle: string
    queueHandle: string
    origin: Omit<ExecutionCancellationOrigin, "targetSessionID">
  },
  options?: TaskCancellationSettlementOptions,
): Promise<string[]> {
  const lifecycle = await requestTaskAgentLifecycleCancellation({
    task,
    reason: input.reason,
    handle: input.handle,
    origin: input.origin,
  })
  const queueCancelledInCurrentInstance = Boolean(Instance.current())
  TaskQueueService.cancelSessionPrompts({
    sessionIDs: lifecycle.sessionIDs,
    reason: input.reason,
    origin: input.origin,
  })
  if (queueCancelledInCurrentInstance) {
    await awaitTaskQueuePromptsIdle({
      sessionIDs: lifecycle.sessionIDs,
      inactivityTimeoutMs: options?.queueSettleInactivityMs ?? CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
      taskID: task.id,
      handle: input.queueHandle,
    })
  } else {
    await provideActiveTaskRootSessionInstance(
      task,
      async () => {
        TaskQueueService.cancelSessionPrompts({
          sessionIDs: lifecycle.sessionIDs,
          reason: input.reason,
          origin: input.origin,
        })
        await awaitTaskQueuePromptsIdle({
          sessionIDs: lifecycle.sessionIDs,
          inactivityTimeoutMs: options?.queueSettleInactivityMs ?? CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
          taskID: task.id,
          handle: input.queueHandle,
        })
      },
      undefined,
      (options as DestructiveTaskOptions | undefined)?.projectDeletionAdmission,
    )
  }
  await assertSessionPromptSubtreeFinished({
    sessions: lifecycle.cancelledSessions,
    failures: lifecycle.cancellationFailures,
    taskID: task.id,
    handle: input.handle,
    inactivityTimeoutMs: options?.promptSettleInactivityMs,
  })
  await publishTaskAgentCancellationStatusesAfterSettlement({
    task,
    reason: input.reason,
  })
  await cancelPendingAgentCoordinationRequestsForTask({ taskID: task.id, reason: input.reason })
  return lifecycle.sessionIDs
}

function deleteSettledSessionTreeRows(
  tx: Database.TxOrDb,
  input: { sessionID: string; projectID: string; expectedSessionIDs: string[] },
): void {
  TaskQueueService.deleteSettledForSessions(tx, { sessionIDs: input.expectedSessionIDs })
  Session.deleteExactTreeInProject(tx, input)
}

async function cancelPendingPermissionsForSessions(sessionIDs: readonly string[], reason: string): Promise<void> {
  for (const sessionID of sessionIDs) {
    await PermissionAuthority.cancelPendingForSession(sessionID, reason)
  }
}

async function recordTaskPhysicalDeleteBreadcrumb(
  task: TaskRow,
  origin: "EngineService.deleteTask" | "EngineService.deleteSession.deleteTasks",
  detail: Record<string, unknown> = {},
  projectDiskProjection = true,
) {
  const status = deriveTaskStatus(task)
  const value = {
    taskID: task.id,
    projectID: task.project_id,
    sessionID: task.session_id,
    origin,
    statusBeforeDelete: status,
    ...detail,
  }
  createDecisionLog(task.id).append({
    phase: "delete",
    key: "task_physical_delete_breadcrumb",
    value: JSON.stringify(value),
    reason:
      "Task row is about to be physically deleted; this breadcrumb distinguishes explicit deletion from cancellation.",
  })
  if (!projectDiskProjection) return
  const projectRoot = taskPrimaryProjectRoot(task.id)
  let projectRootInfo
  try {
    projectRootInfo = await lstat(projectRoot)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return
    throw error
  }
  if (!projectRootInfo.isDirectory()) {
    throw new Error(`Cannot project Task deletion breadcrumb into non-directory root: ${projectRoot}`)
  }
  EngineEventLog.appendPhysicalDeleteBreadcrumb(task.id, {
    origin,
    projectID: task.project_id,
    sessionID: task.session_id ?? undefined,
    status,
    detail,
  })
  await DecisionLogBundle.write(projectRoot, task.id)
}

function assertTasksRemainTerminalForPhysicalDelete(db: Database.TxOrDb, tasks: readonly TaskRow[]): void {
  for (const expected of tasks) {
    const current = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, expected.id)).get()
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

async function deleteRowsThenTaskArtifacts(tasks: readonly TaskRow[], deleteRows: () => void): Promise<void> {
  const cleanupTargets = tasks
    .map((task) => ({
      taskID: task.id,
      projectDirectory: taskPrimaryProjectRoot(task.id, { activeProjectID: task.project_id }),
      cleanupOwners: buildObservationCleanupRowsForTask(task.id),
    }))
    .sort((left, right) => left.taskID.localeCompare(right.taskID))
  // Cleanup owners are durable only while their Task row exists. Resolve all
  // pending/retained ref ownership before the cascading physical delete.
  for (const target of cleanupTargets) {
    for (const owner of target.cleanupOwners) {
      await settleBuildObservationCleanup({
        observationID: owner.observation_id,
        releaseRetained: true,
      })
    }
  }
  deleteRows()
  const cleanupFailures: unknown[] = []
  const residuePaths: string[] = []
  for (const target of cleanupTargets) {
    try {
      await removeTaskArtifactRoot(target)
    } catch (cause) {
      cleanupFailures.push(cause)
      residuePaths.push(ProjectRuntimePaths.taskArtifactRoot(target.projectDirectory, target.taskID))
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
 * Inactivity window for queue prompt settlement. Any observable queue/session
 * activity renews the window; this is not a wall-clock cancellation deadline.
 */
export const CANCEL_QUEUE_SETTLE_INACTIVITY_MS = 60_000

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
  /** Override queue-settle inactivity (ms). Tests use this to keep zombie checks small. */
  queueSettleInactivityMs?: number
}

export interface CancelTaskOptions extends TaskCancellationSettlementOptions {
  origin: TaskCancellationOriginValue
}

const cancellationOperations = new Map<string, Promise<boolean>>()
const cancellationConvergenceOwnerID = `cancellation-owner:${randomUUID()}`
const CANCELLATION_CONVERGENCE_LEASE_MS = 10_000
const CANCELLATION_CONVERGENCE_HEARTBEAT_MS = 2_000
let cancellationConvergenceHeartbeatFailureForTest: "zero-row" | "exception" | undefined
let beforeLateCancellationStageForTest:
  | ((input: { signal: AbortSignal; failHeartbeat(mode: "zero-row" | "exception"): void }) => void | Promise<void>)
  | undefined

function renewCancellationConvergenceLease(taskID: string): boolean {
  const injectedFailure = cancellationConvergenceHeartbeatFailureForTest
  cancellationConvergenceHeartbeatFailureForTest = undefined
  if (injectedFailure === "exception") throw new Error("injected Task cancellation convergence heartbeat failure")
  return Database.immediateTransaction((db) =>
    Boolean(
      db
        .update(EngineTaskCancellationAuthorityTable)
        .set({ convergence_lease_expires_at: Date.now() + CANCELLATION_CONVERGENCE_LEASE_MS })
        .where(
          and(
            eq(EngineTaskCancellationAuthorityTable.task_id, taskID),
            eq(
              EngineTaskCancellationAuthorityTable.convergence_owner_id,
              injectedFailure === "zero-row"
                ? `${cancellationConvergenceOwnerID}:stale`
                : cancellationConvergenceOwnerID,
            ),
          ),
        )
        .returning({ taskID: EngineTaskCancellationAuthorityTable.task_id })
        .get(),
    ),
  )
}

function renewCancellationConvergenceLeaseOrFence(taskID: string, fence: AbortController): void {
  if (fence.signal.aborted) return
  try {
    if (renewCancellationConvergenceLease(taskID)) return
    fence.abort(new Error(`Task ${taskID} cancellation convergence owner lease is no longer authoritative`))
  } catch (error) {
    log.error("Task cancellation convergence heartbeat failed", {
      taskID,
      ownerID: cancellationConvergenceOwnerID,
      error: error instanceof Error ? error.message : String(error),
    })
    fence.abort(error)
  }
}

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
  for (;;) {
    const task = requireTaskInCurrentProject(taskID)
    if (isTaskCancelled(task)) return undefined
    const now = Date.now()
    const claimed = Database.immediateTransaction((db) => {
      const authority = db
        .select()
        .from(EngineTaskCancellationAuthorityTable)
        .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
        .get()
      if (!authority) throw new Error(`Task ${taskID} has no durable cancellation authority to converge`)
      if (
        authority.convergence_owner_id &&
        authority.convergence_owner_id !== cancellationConvergenceOwnerID &&
        (authority.convergence_lease_expires_at ?? 0) > now
      ) {
        return false
      }
      db.update(EngineTaskCancellationAuthorityTable)
        .set({
          convergence_owner_id: cancellationConvergenceOwnerID,
          convergence_owner_process_id: process.pid,
          convergence_lease_expires_at: now + CANCELLATION_CONVERGENCE_LEASE_MS,
        })
        .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
        .run()
      return true
    })
    if (claimed) {
      const leaseFence = new AbortController()
      const heartbeat = setInterval(
        () => renewCancellationConvergenceLeaseOrFence(taskID, leaseFence),
        CANCELLATION_CONVERGENCE_HEARTBEAT_MS,
      )
      heartbeat.unref?.()
      if (cancellationConvergenceHeartbeatFailureForTest) {
        renewCancellationConvergenceLeaseOrFence(taskID, leaseFence)
      }
      return {
        signal: leaseFence.signal,
        failHeartbeatForTest(mode: "zero-row" | "exception") {
          if (cancellationConvergenceHeartbeatFailureForTest) {
            throw new Error("Task cancellation convergence heartbeat failure is already armed")
          }
          cancellationConvergenceHeartbeatFailureForTest = mode
          renewCancellationConvergenceLeaseOrFence(taskID, leaseFence)
        },
        assertActive() {
          leaseFence.signal.throwIfAborted()
          const authority = Database.use((db) =>
            db
              .select({
                ownerID: EngineTaskCancellationAuthorityTable.convergence_owner_id,
                leaseExpiresAt: EngineTaskCancellationAuthorityTable.convergence_lease_expires_at,
              })
              .from(EngineTaskCancellationAuthorityTable)
              .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
              .get(),
          )
          if (authority?.ownerID !== cancellationConvergenceOwnerID || (authority.leaseExpiresAt ?? 0) <= Date.now()) {
            const error = new Error(`Task ${taskID} cancellation convergence owner lease is no longer authoritative`)
            leaseFence.abort(error)
            throw error
          }
        },
        assertInTransaction(db: Database.TxOrDb) {
          leaseFence.signal.throwIfAborted()
          const authority = db
            .select({
              ownerID: EngineTaskCancellationAuthorityTable.convergence_owner_id,
              leaseExpiresAt: EngineTaskCancellationAuthorityTable.convergence_lease_expires_at,
            })
            .from(EngineTaskCancellationAuthorityTable)
            .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
            .get()
          if (authority?.ownerID !== cancellationConvergenceOwnerID || (authority.leaseExpiresAt ?? 0) <= Date.now()) {
            throw new Error(`Task ${taskID} cancellation convergence owner lease is no longer authoritative`)
          }
        },
        close() {
          clearInterval(heartbeat)
          Database.immediateTransaction((db) => {
            db.update(EngineTaskCancellationAuthorityTable)
              .set({
                convergence_owner_id: null,
                convergence_owner_process_id: null,
                convergence_lease_expires_at: null,
              })
              .where(
                and(
                  eq(EngineTaskCancellationAuthorityTable.task_id, taskID),
                  eq(EngineTaskCancellationAuthorityTable.convergence_owner_id, cancellationConvergenceOwnerID),
                ),
              )
              .run()
          })
        },
      }
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
) {
  const wake = await appendAndWakeTaskOperatorMessage({ taskID, text, attachments, source, metadata })

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
      touchEngineTask(db, { taskID: task.id, timeUpdated: now })
      clearEngineTaskRewindCursor(db, { taskID: task.id, timeUpdated: now })
      EngineProtocol.emitInTransaction(
        Event.TaskMessageRecorded,
        { taskID: task.id, source, summary: "Operator message recorded", messageID: bundle.info.id },
        { taskID: task.id, source: "service.message" },
      )
      ingressArtifactID = persistQueuedRootMessageWakeInTransaction(db, {
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
    resumed: dispatchResult === "started",
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
  identity?: { messageID: string; textPartID: string },
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

function taskSummary(
  rows: Array<{
    time_started: number | null
    time_completed: number | null
    error?: string | null
    metadata?: Record<string, unknown> | null
  }>,
) {
  const completed = rows
    .filter((row) => typeof row.time_started === "number" && typeof row.time_completed === "number")
    .map((row) => (row.time_completed ?? 0) - (row.time_started ?? 0))
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
  const queueRevisions = new Map<string, string>()
  const groupedQueued = new Map<string, TaskRow[]>()
  for (const item of rows) {
    if (!item.directory) continue
    if (!isTaskQueued(item.task)) continue
    const list = groupedQueued.get(item.directory) ?? []
    list.push(item.task)
    groupedQueued.set(item.directory, list)
  }
  for (const [directory, tasks] of groupedQueued.entries()) {
    const revision = tasks
      .slice()
      .sort((a, b) => {
        const criticalDelta = (a.priority === "critical" ? 0 : 1) - (b.priority === "critical" ? 0 : 1)
        if (criticalDelta !== 0) return criticalDelta
        if (a.queue_order !== b.queue_order) return a.queue_order - b.queue_order
        if (a.time_created !== b.time_created) return a.time_created - b.time_created
        return a.id.localeCompare(b.id)
      })
      .map((task) => `${task.id}:${task.queue_order}:${task.time_updated}`)
      .join("|")
    queueRevisions.set(directory, revision)
  }

  return rows.map((item) => {
    const task = item.task
    const pendingInteractions = listInteractions(task.id).filter((entry) => entry.status === "pending")
    return {
      task: viewTaskListTask(task, {
        directory: item.directory,
        queueRevision: item.directory && isTaskQueued(task) ? queueRevisions.get(item.directory) : undefined,
      }),
      project: item.project,
      owned_prompt_sessions: listOwnedPromptSessionsForTask(task.id),
      pending_interactions: pendingInteractions.length,
      pending_interaction_items: pendingInteractions.map(viewInteraction),
      updated_at: task.time_updated,
    }
  })
}

async function taskChecks(checks?: z.input<typeof CheckConfig>) {
  const found = await discoverChecks()
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

export class TaskQueueStartError extends Error {
  constructor(
    message: string,
    readonly code: "not_queued",
  ) {
    super(message)
    this.name = "TaskQueueStartError"
  }
}

type FileRef = {
  sha: string
  url: string
  mime: string
  size: number
  filename?: string
  intent?: string
  source?: string
}
type TaskInputFileRef = FileRef & { intent: "task_input"; source: "user-upload" }
type FileRefColumn = "attachments" | "system_artifacts"

type ApiAttachmentInput = NonNullable<z.infer<typeof CreateTaskInput>["attachments"]>[number]
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

export namespace EngineService {
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
  }): Promise<
    {
      messageID: string
      ingressID: string
      wakeStatus: DispatchTaskLoopResult
    }
  > {
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
    const deliveryReference = SchedulerDeliveryReference.parse({
      eventID: delivery.event.id,
      inboxID: delivery.id,
      sequence: delivery.event.sequence,
      threadID: delivery.message.thread_id,
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
      { messageID: occurrenceIDs.messageID, textPartID: occurrenceIDs.textPartID },
    )
    let ingressID: string | undefined
    await Session.persistMessageWithCommit(bundle, () => {
      Database.use((db) => {
        const currentTask = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, task.id)).get()
        if (!currentTask || !isTaskActive(currentTask) || currentTask.session_id !== target.root_session_id) {
          throw new Error(
            `Scheduler delivery ${delivery.id} cannot materialize into Task ${task.id} after its active root changed.`,
          )
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
        // Every queued root ingress uses EngineArtifact catalog_revision as
        // its durable monotonic queue ordinal, independent of wall clock and
        // participant kind. Protocol sequence determines scheduler claim order;
        // this shared ordinal preserves that order in the mixed root queue.
        const now = Date.now()
        ingressID = persistQueuedRootMessageWakeInTransaction(db, {
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
    })
    if (!ingressID) throw new Error(`Scheduler Task delivery ${delivery.id} did not commit its ingress.`)
    const dispatch = await dispatchPersistedTaskLoop(task.id, ingressID)
    return {
      messageID: bundle.info.id,
      ingressID,
      wakeStatus: dispatch,
    }
  }

  export async function createTask(raw: z.input<typeof CreateTaskInput>, rawCreator: z.input<typeof TaskCreator>) {
    const parsed = CreateTaskInput.parse(raw)
    assertNoCallerSuppliedChildTaskLineage(parsed)
    assertNoCallerSuppliedTaskCreatorMetadata(parsed.metadata)
    const creator = await resolveTaskCreator(rawCreator)
    assertTaskCreatorExpertSquadAuthority({ creator, promptProfile: parsed.promptProfile })
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
    return withTaskCreationOwnerLock(input, () => createTaskInExecutionDirectory(input, artifactImporter))
  }

  async function createTaskInExecutionDirectory(
    input: z.infer<typeof CreateTaskInput>,
    artifactImporter?: CrossTaskArtifactImporter,
  ) {
    const creationContext = {
      capabilityProjectDirectory: Instance.project.worktree,
      taskConfigSnapshot: await EffectiveConfig.snapshotCurrent(),
    }
    if (!input.model) {
      await resolveConfiguredModelRef()
    }
    const directory = Filesystem.resolve(input.directory ?? Instance.directory)
    if (Project.samePath(directory, Instance.directory)) {
      return createTaskInner(input, { ...creationContext, artifactImporter })
    }

    const projectID = Instance.project.id
    return Worktree.withSandboxAdmission(directory, async () => {
      await Project.registerExecutionDirectory(projectID, directory)
      return Instance.provide({
        directory,
        init: InstanceBootstrap,
        fn: async () => {
          if (Instance.project.id !== projectID) {
            throw new Error(
              `Task execution directory ${directory} resolved project ${Instance.project.id}, expected ${projectID}`,
            )
          }
          return createTaskInner(input, { ...creationContext, artifactImporter })
        },
      })
    })
  }

  async function createTaskInner(
    input: z.infer<typeof CreateTaskInput>,
    creationContext: {
      capabilityProjectDirectory: string
      taskConfigSnapshot: Config.Info
      artifactImporter?: CrossTaskArtifactImporter
    },
  ) {
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
    const selectedProfileID = selectedTaskProfileID(input, taskConfigSnapshot)
    const existingBindingTask = existingTaskByChannelBinding(input.channelBinding)
    if (existingBindingTask) {
      const existing = findTask(existingBindingTask)
      if (!existing || existing.product_pillar !== input.productPillar) {
        throw new Error(`Channel-bound Task ${existingBindingTask} already exists with a different product pillar`)
      }
      const committedImports = importsFromMappings(listCrossTaskArtifactImportMappings(existingBindingTask))
      if (!sameCrossTaskArtifactImportSet(artifactImports, committedImports)) {
        throw new Error(
          `Channel-bound Task ${existingBindingTask} already exists with a different exact Artifact import set`,
        )
      }
      await assertTaskCreationReplayMatches({
        taskID: existingBindingTask,
        identityKind: "channel",
        identity: `${input.channelBinding!.platform}/${input.channelBinding!.channel}/${input.channelBinding!.thread}`,
        selectedProfileID,
        expectedPackageDigest: input.expectedPackageDigest,
      })
      return existingBindingTask
    }
    const requestID = input.requestID?.trim() || undefined
    if (requestID) {
      const existing = findTaskByRequest(Instance.project.id, requestID)
      if (existing) {
        if (existing.product_pillar !== input.productPillar) {
          throw new Error(
            `Task request ${requestID} already committed as ${existing.id} with a different product pillar`,
          )
        }
        const committedImports = importsFromMappings(listCrossTaskArtifactImportMappings(existing.id))
        if (!sameCrossTaskArtifactImportSet(artifactImports, committedImports)) {
          throw new TaskArtifactImportIdempotencyConflictError({
            message: `Task request ${requestID} already committed as ${existing.id} with a different exact Artifact import set`,
            requestID,
            taskID: existing.id,
          })
        }
        await assertTaskCreationReplayMatches({
          taskID: existing.id,
          identityKind: "request",
          identity: requestID,
          selectedProfileID,
          expectedPackageDigest: input.expectedPackageDigest,
        })
        return existing.id
      }
    }
    const profilePreviewConfig = Config.mergeOverlay(taskConfigSnapshot, {
      ...(input.model ? { model: input.model } : {}),
      prompt_profile: { active: selectedProfileID },
    })
    const packageRevision = await ExpertSquadInstallLock.run(selectedProfileID, async (lease) => {
      await ExpertSquadPackageManager.reconcilePendingPackageMutationUnderLease({
        projectDirectory: creationContext.capabilityProjectDirectory,
        id: selectedProfileID,
        lease,
      })
      await PromptProfileResolver.assertProfileSupportsProductPillar({
        projectDirectory: creationContext.capabilityProjectDirectory,
        profileID: selectedProfileID,
        productPillar: input.productPillar,
        config: profilePreviewConfig,
      })
      const resolved = await PromptProfileResolver.resolveActivePackageRevision({
        projectDirectory: creationContext.capabilityProjectDirectory,
        config: profilePreviewConfig,
        reconcileEvolutionMutations: false,
      })
      if (input.expectedPackageDigest === undefined || input.expectedPackageDigest === resolved.packageDigest) {
        return resolved
      }
      if (resolved.scope !== "built_in") {
        return PromptProfileResolver.resolveExternalPackageRevisionSnapshot({
          activeRevision: resolved,
          expectedPackageDigest: input.expectedPackageDigest,
        })
      }
      throw new TaskExpectedPackageDigestConflictError({
        message: `Expert squad ${selectedProfileID} resolved package digest ${resolved.packageDigest}, expected ${input.expectedPackageDigest}`,
        profileID: selectedProfileID,
        expectedPackageDigest: input.expectedPackageDigest,
        actualPackageDigest: resolved.packageDigest,
      })
    })
    const title = resolveTaskTitle(input)
    const now = Date.now()
    const taskID = Identifier.ascending("task")
    const attachmentRefs = await materializeApiAttachments({
      attachments: input.attachments,
      label: `Task ${taskID} attachment`,
      projectID: Instance.project.id,
    })
    const resolvedChecks = await taskChecks(input.checks)
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
    // Canonicalize uploaded references or materialize API base64 bytes exactly
    // once, then carry only neutral references through task persistence. The
    // overlay reads task.attachments directly; domain adapters assign semantics
    // through explicit contracts.
    // Materialize the intent bundle on disk BEFORE the queue picks the task
    // up, so when the orchestrator / planner / architect wake their stage
    // prompts (which reference the task-scoped intent bundle path) resolve to
    // a real file. Without this, architect-generated goal objectives like
    // "see the intent bundle §3" point at nothing — the
    // executor either misses the reference or hallucinates a body. See
    // `src/intent/bundle.ts` header for the full rationale.
    let session!: Awaited<ReturnType<typeof Session.create>>
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
      const { IntentBundle } = await import("@/intent/bundle")
      await IntentBundle.write({
        projectID: Instance.project.id,
        taskID,
        request: input.request,
        attachments: attachmentRefs.length ? attachmentRefs : undefined,
        source: input.source,
        createdAt: now,
      })
      const executionCapsuleBinding = await prepareTaskProcessBinding({
        mode: configuredTaskProcessMode(),
        taskID,
        projectID: Instance.project.id,
        rootDirectory: Instance.directory,
        packageRevisionSHA256: packageRevision.packageDigest,
        timeCreated: now,
      })

      // The task's root session: it holds the user's original request and the
      // pointer engine_task.session_id. Its children are the orchestrator's
      // own session and each projected agent session.
      const initialSessionConfigOverlay = Config.Overlay.parse({
        ...(input.model ? { model: input.model } : {}),
        prompt_profile: {
          active: input.promptProfile ?? taskConfigSnapshot.prompt_profile.active,
        },
      })
      session = await Session.create({
        kind: "root",
        title,
        metadata: {
          [EffectiveConfig.TASK_SNAPSHOT_KEY]: taskConfigSnapshot,
          configOverlay: initialSessionConfigOverlay,
        },
      })

      // Task row, target-owned imports, and initial Engine facts commit together
      // only after every imported resource snapshot is durable.
      persistQueuedTask({
        taskID,
        sessionID: session.id,
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
        queue: input.queue,
        artifactImports: preparedArtifactSources.imports,
        artifactImportAuthorities: preparedArtifactSources.authorities,
        packageRevision,
        creationExpectedPackageDigest: input.expectedPackageDigest,
        executionCapsuleBinding,
      })
    } catch (error) {
      if (artifactImports.length > 0) {
        await removeTaskArtifactRoot({
          projectDirectory: Instance.directory,
          taskID,
        })
      }
      const existing = requestID ? recoverTaskByRequest(requestID, error) : undefined
      if (existing) {
        const committedImports = importsFromMappings(listCrossTaskArtifactImportMappings(existing))
        if (!sameCrossTaskArtifactImportSet(artifactImports, committedImports)) {
          throw new TaskArtifactImportIdempotencyConflictError({
            message: `Task request ${requestID} already committed as ${existing} with a different exact Artifact import set`,
            requestID: requestID!,
            taskID: existing,
          })
        }
        await assertTaskCreationReplayMatches({
          taskID: existing,
          identityKind: "request",
          identity: requestID!,
          selectedProfileID,
          expectedPackageDigest: input.expectedPackageDigest,
        })
        return existing
      }
      throw error
    }
    if (overrides.length > 0) {
      await Session.setPermission({ sessionID: session.id, permission: overrides })
    }
    await dispatchTaskLoop({ taskID })
    return taskID
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

  /**
   * Validate that a FileRef points at a real on-disk attachment, then merge
   * it into one of the task's two file-reference columns. The merge strategy
   * (`append-dedup-by-sha` vs `replace-by-intent`) is supplied by the caller
   * — keeping both behind one validator guarantees the on-disk-existence
   * rule stays a single source of truth even as new merge modes are added.
   *
   * Throws on a dangling URL: registered-but-missing files would cause
   * downstream multimodal loading to ENOENT-crash on every retry. Failing
   * at the registration boundary keeps the bad state out of the database.
   */
  async function mergeTaskFileRef(
    taskID: string,
    column: FileRefColumn,
    file: FileRef,
    merge: (prev: FileRef[], canonical: FileRef) => { next: FileRef[]; reason: string } | null,
  ): Promise<FileRef[]> {
    const task = requireTaskInCurrentProject(taskID)
    const located = AttachmentStore.nameFromUrl(file.url)
    if (!located) {
      throw new Error(`${column}: file.url is not a valid /attachment/<projectID>/<name> reference: ${file.url}`)
    }
    if (located.projectID !== task.project_id) {
      throw new Error(
        `${column}: file.url belongs to project ${located.projectID}, expected task project ${task.project_id}: ${file.url}`,
      )
    }
    let reference: AttachmentStore.Reference
    try {
      reference = await AttachmentStore.readReference(located.projectID, located.name)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `${column}: cannot read canonical attachment metadata for project ${located.projectID}/${located.name}: ${message}`,
      )
    }
    const metadataMismatches = [
      file.sha !== reference.sha ? "sha" : "",
      file.mime !== reference.mime ? "mime" : "",
      file.size !== reference.size ? "size" : "",
    ].filter(Boolean)
    if (metadataMismatches.length > 0) {
      throw new Error(
        `${column}: file metadata does not match canonical AttachmentStore metadata (${metadataMismatches.join(", ")}): ${file.url}`,
      )
    }
    const canonical: FileRef = {
      sha: reference.sha,
      url: reference.url,
      mime: reference.mime,
      size: reference.size,
      ...(reference.filename ? { filename: reference.filename } : {}),
      ...(file.intent ? { intent: file.intent } : {}),
      ...(file.source ? { source: file.source } : {}),
    }
    const prev = Array.isArray((task as any)[column]) ? ((task as any)[column] as FileRef[]) : []
    const result = merge(prev, canonical)
    if (!result) return prev
    await updateTask(task, { [column]: result.next } as any, result.reason)
    return result.next
  }

  /** Register a neutral user upload. Domain adapters assign semantics through explicit contracts. */
  export async function appendTaskAttachment(taskID: string, attachment: TaskInputFileRef) {
    if (attachment.intent !== "task_input" || attachment.source !== "user-upload") {
      throw new Error("appendTaskAttachment accepts only neutral task_input/user-upload references")
    }
    return mergeTaskFileRef(taskID, "attachments", attachment, (prev, canonical) => {
      if (prev.some((a) => a?.sha === canonical.sha)) return null
      return {
        next: [...prev, canonical],
        reason: `attachments appended: ${canonical.filename ?? canonical.sha}`,
      }
    })
  }

  /**
   * Register a SYSTEM-GENERATED artifact on a task. Use for evidence the
   * orchestrator/agents produced on the user's behalf, including materialized
   * design resources and rendered evidence. Consumers read these only through
   * their explicit artifact contracts. Idempotent on sha collision.
   */
  export async function appendTaskSystemArtifact(taskID: string, artifact: FileRef) {
    return mergeTaskFileRef(taskID, "system_artifacts", artifact, (prev, canonical) => {
      if (prev.some((a) => a?.sha === canonical.sha)) return null
      return {
        next: [...prev, canonical],
        reason: `system_artifacts appended: ${canonical.filename ?? canonical.sha}`,
      }
    })
  }

  /**
   * Replace all system artifacts carrying a given `intent` with a single new
   * artifact. Use when each rerun should supersede the previous output for
   * that semantic slot (e.g. acceptance rendered_output: keeping every prior
   * rendered.png would balloon the task and confuse the visual diff).
   */
  export async function replaceTaskSystemArtifactByIntent(
    taskID: string,
    intent: string,
    artifact: FileRef,
  ): Promise<FileRef[]> {
    if (artifact.intent !== intent) {
      throw new Error(
        `replaceTaskSystemArtifactByIntent: intent mismatch — slot=${intent} artifact.intent=${artifact.intent}`,
      )
    }
    return mergeTaskFileRef(taskID, "system_artifacts", artifact, (prev, canonical) => {
      const purged = prev.filter((a) => a?.intent !== intent)
      return {
        next: [...purged, canonical],
        reason: `system_artifacts replaced [intent=${intent}]: ${canonical.filename ?? canonical.sha}`,
      }
    })
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

  export async function getBoard(taskID: string, _input?: { sync?: boolean }) {
    // Read-only — poll loop handles state advancement asynchronously.
    requireTaskInCurrentProject(taskID)
    return compileBoard({ taskID })
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

  export async function getBoardTag(taskID: string, _input?: { sync?: boolean }) {
    // Read-only — poll loop handles state advancement asynchronously.
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

  export async function reorderTaskQueue(input: { directory: string; orderedTaskIDs: string[]; revision?: string }) {
    const result = reorderQueuedTasksForCwd({
      cwd: input.directory,
      projectID: Instance.project.id,
      orderedTaskIDs: input.orderedTaskIDs,
      revision: input.revision,
    })
    await Promise.all(
      result.queuedTaskIDs.map((taskID) =>
        EngineProtocol.emit(
          Event.TaskUpdated,
          {
            taskID,
            status: "queued",
            summary: "Task queue reordered",
          },
          { source: "task.queue.reorder" },
        ),
      ),
    )
    return result
  }

  export async function startQueuedTaskNow(taskID: string) {
    const task = requireTaskInCurrentProject(taskID)
    if (!isTaskQueued(task)) {
      throw new TaskQueueStartError(`Task ${taskID} is not queued`, "not_queued")
    }
    const cwd = taskCwd(taskID)

    const before = directoryQueueSnapshot(cwd)
    if (!before.queuedTaskIDs.includes(taskID)) {
      throw new TaskQueueStartError(`Task ${taskID} is not in the directory queue`, "not_queued")
    }
    await startQueuedTaskInCwd(taskID, cwd)

    const updated = requireTaskInCurrentProject(taskID)
    const status = deriveTaskStatus(updated) as string
    const after = directoryQueueSnapshot(cwd)
    return {
      task: viewTask(updated, { directory: cwd }),
      directory: cwd,
      status,
      started: status === "active",
      queuedTaskIDs: after.queuedTaskIDs,
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
      discardQueuedTaskEvent(taskID)
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
      await awaitRootSessionWakeQueueSettled(
        task,
        options?.queueSettleInactivityMs ?? CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
      )
      const settledSessionIDs = await settleTaskSessionWork(
        task,
        {
          reason: "task deleted",
          handle: "EngineService.deleteTask",
          queueHandle: "EngineService.deleteTask.TaskQueueService.awaitSessionPromptsIdle",
          origin: executionCancellationOrigin,
        },
        options,
      )
      await cancelPendingPermissionsForSessions(settledSessionIDs, "Task deleted before the Tool invocation ran")
      await recordTaskPhysicalDeleteBreadcrumb(task, "EngineService.deleteTask", {}, !options?.projectDeletionAdmission)
      if (options?.projectDeletionAdmission) return true
      // Delete the settled queue audit rows, session tree, and task row in one
      // transaction. Snapshot disk reclaim is intentionally NOT triggered here:
      // every tree object emitted by this task's `Snapshot.track()` is dangling
      // (no ref), so `git gc --prune=now` would also collect snapshots that other
      // Tasks or Sessions in the same project still reference. Whole-project
      // reclaim is owned by ProjectGC (rm of `snapshot/<id>`).
      const deleteRows = () => {
        Database.transaction((db) => {
          assertTasksRemainTerminalForPhysicalDelete(db, [task])
          deadLetterSchedulerTaskDeliveriesInTransaction(db, {
            taskIDs: [task.id],
            errorName: "SchedulerRecipientDeletedError",
            message: `Recipient Task ${task.id} was deleted.`,
          })
          deadLetterSchedulerSourceDeliveriesInTransaction(db, {
            sessionIDs: settledSessionIDs,
            errorName: "SchedulerSourceDeletedError",
            message: `Source Session tree for Task ${task.id} was deleted.`,
          })
          detachProtocolEventsFromDeletedTasksInTransaction(db, [task.id])
          if (task.session_id) {
            deleteSettledSessionTreeRows(db, {
              sessionID: task.session_id,
              projectID: task.project_id,
              expectedSessionIDs: settledSessionIDs,
            })
          }
          deleteEngineTask(db, { taskID })
          Database.effect(() => Database.incrementalVacuum())
        })
      }
      await deleteRowsThenTaskArtifacts([task], deleteRows)
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
        discardQueuedTaskEvent(taskID)
        if (!isTaskTerminal(task)) {
          if (!options?.origin) {
            throw new Error(`setTaskArchived requires cancellation origin while task ${taskID} is non-terminal.`)
          }
          await cancelTask(taskID, { ...options, origin: options.origin })
          task = requireTaskInCurrentProject(taskID)
        }
        await awaitRootSessionWakeQueueSettled(
          task,
          options?.queueSettleInactivityMs ?? CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
        )
        await settleTaskSessionWork(
          task,
          {
            reason: "task archived",
            handle: "EngineService.setTaskArchived",
            queueHandle: "EngineService.setTaskArchived.TaskQueueService.awaitSessionPromptsIdle",
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
            status: deriveTaskStatus(task),
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
          status: deriveTaskStatus(task),
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
        status: deriveTaskStatus(task),
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
        status: deriveTaskStatus(task),
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
        status: deriveTaskStatus(task),
        summary: pinned ? "Task pinned" : "Task unpinned",
      })
    })
    await publication
    return true
  }
}

function recoverTaskByRequest(requestID: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (!message.includes("UNIQUE constraint failed")) return
  if (!message.includes("engine_task.project_id, engine_task.request_id")) return
  return findTaskByRequest(Instance.project.id, requestID)?.id
}

function existingTaskByChannelBinding(
  binding:
    | {
        platform: string
        channel: string
        thread: string
      }
    | undefined,
) {
  if (!binding) return
  const row = Database.use((db) =>
    db
      .select({ task_id: EngineChannelBindingTable.task_id, project_id: EngineTaskTable.project_id })
      .from(EngineChannelBindingTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineChannelBindingTable.task_id))
      .where(
        and(
          eq(EngineChannelBindingTable.platform, binding.platform),
          eq(EngineChannelBindingTable.channel, binding.channel),
          eq(EngineChannelBindingTable.thread, binding.thread),
        ),
      )
      .get(),
  )
  if (!row) return
  if (row.project_id === "global") {
    throw new TaskGlobalProjectBindingError({
      message: `Channel binding ${binding.platform}/${binding.channel}/${binding.thread} points to task ${row.task_id} bound to project global. Task execution requires a concrete Git project.`,
      taskID: row.task_id,
      projectID: row.project_id,
    })
  }
  if (row.project_id !== Instance.project.id) {
    throw new TaskChannelBindingProjectConflictError({
      message: `Channel binding ${binding.platform}/${binding.channel}/${binding.thread} points to task ${row.task_id} in project ${row.project_id}, but the active project is ${Instance.project.id}.`,
      platform: binding.platform,
      channel: binding.channel,
      thread: binding.thread,
      taskID: row.task_id,
      projectID: row.project_id,
      activeProjectID: Instance.project.id,
    })
  }
  return row.task_id
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

    let dispatchResult: "accepted" | "queued"
    try {
      const result = await dispatch({
        taskID: task.id,
        event: {
          coordinationRequest: { requestID: request.payload.request_id },
        },
      })
      dispatchResult = result === "started" ? "accepted" : "queued"
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
      let directDrainStarted = false
      try {
        directDrainStarted = await drainQueuedTaskEvent(task.id)
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
      if (directDrainStarted) {
        dispatchResult = "accepted"
      } else if (queuedTaskEventStats(task.id).events > 0) {
        dispatchResult = "queued"
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
      await Question.reply({ requestID: row.external_id, answers })
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
      await Question.reject(row.external_id)
    }
    return viewInteraction(requireInteractionInCurrentProject(interactionID))
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
      await Question.reply({ requestID: row.external_id, answers, userInput: input.userInput })
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
    if (row.request_type === "question") await Question.reject(row.external_id, input.userInput)
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
    const operation = cancelTask(taskID, options)
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

  export async function reconcilePendingTaskCancellations(): Promise<number> {
    const rows = Database.use((db) =>
      db
        .select({ id: EngineTaskTable.id })
        .from(EngineTaskTable)
        .where(and(eq(EngineTaskTable.project_id, Instance.project.id), isNull(EngineTaskTable.time_completed)))
        .all(),
    )
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
    if (failures.length > 0) {
      throw new AggregateError(failures, `Failed to recover ${failures.length} pending Task cancellation(s)`)
    }
    return operations.length
  }

  export function cancelTask(taskID: string, options: CancelTaskOptions): Promise<boolean> {
    const task = requireTaskInCurrentProject(taskID)
    if (isTaskCancelled(task)) return Promise.resolve(true)
    const existing = cancellationOperations.get(taskID)
    if (existing) return existing
    const authority = RuntimeExecutionSettlement.reserve("task_cancellation", `task-cancellation:${taskID}`)
    const operation = cancelTaskOnce(taskID, options)
    authority.settleWith(operation)
    cancellationOperations.set(taskID, operation)
    void operation
      .finally(() => {
        if (cancellationOperations.get(taskID) === operation) cancellationOperations.delete(taskID)
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
      if (current.time_completed != null && !isTaskCancelled(current)) {
        const lifecycle = deriveTaskStatus(current)
        throw new TaskCancellationLifecycleConflictError({
          message: `Task ${taskID} is already ${lifecycle}; cancellation accepts only a nonterminal or cancelled Task.`,
          taskID,
          lifecycle: lifecycle as "completed" | "failed",
        })
      }
      const existingAuthority = db
        .select({ requestEventID: EngineTaskCancellationAuthorityTable.request_event_id })
        .from(EngineTaskCancellationAuthorityTable)
        .where(eq(EngineTaskCancellationAuthorityTable.task_id, taskID))
        .get()
      if (existingAuthority) {
        if (current.time_completed == null) {
          terminalizeQueuedTaskEventsForCancellationInTransaction(db, {
            taskID,
            cancellationRequestEventID: existingAuthority.requestEventID,
            now: Date.now(),
          })
        }
        return ProtocolStore.requireEvent(existingAuthority.requestEventID)
      }
      const requested = EngineProtocol.emitInTransaction(
        Event.TaskCancellationRequested,
        {
          taskID,
          actor: origin.actor,
          surface: origin.surface,
          reason: origin.reason,
          summary: `Cancellation requested: ${origin.reason}`,
          ...(origin.messageID ? { messageID: origin.messageID } : {}),
          ...(origin.toolCallID ? { toolCallID: origin.toolCallID } : {}),
          ...(origin.toolPartID ? { toolPartID: origin.toolPartID } : {}),
          ...(origin.missionID ? { missionID: origin.missionID } : {}),
        },
        {
          source: origin.source,
          sessionID: origin.sessionID,
          correlationID: origin.requestID,
        },
      )
      db.insert(EngineTaskCancellationAuthorityTable).values({ task_id: taskID, request_event_id: requested.id }).run()
      terminalizeQueuedTaskEventsForCancellationInTransaction(db, {
        taskID,
        cancellationRequestEventID: requested.id,
        now: requested.time.emitted,
      })
      touchEngineTask(db, { taskID, timeUpdated: requested.time.emitted })
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
      const queueSettleInactivityMs = options.queueSettleInactivityMs ?? CANCEL_QUEUE_SETTLE_INACTIVITY_MS

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
            "session prompt or queue settlement failed; cancellation is incomplete and task status was not marked cancelled.",
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
      const queueCancelledInCurrentInstance = Boolean(Instance.current())
      const queuedPromptCancellations = TaskQueueService.cancelSessionPrompts({
        sessionIDs: lifecycle.sessionIDs,
        reason: "task cancelled",
        origin: executionCancellationOrigin,
      })
      convergenceOwner.assertActive()
      if (!queueCancelledInCurrentInstance) {
        await provideActiveTaskRootSessionInstance(
          task,
          async () => {
            convergenceOwner.assertActive()
            TaskQueueService.cancelSessionPrompts({
              sessionIDs: lifecycle.sessionIDs,
              reason: "task cancelled",
              origin: executionCancellationOrigin,
            })
          },
          convergenceOwner.signal,
        )
      }
      convergenceOwner.assertActive()
      await provideActiveTaskRootSessionInstance(
        task,
        () =>
          awaitTaskQueuePromptsIdle({
            sessionIDs: lifecycle.sessionIDs,
            inactivityTimeoutMs: queueSettleInactivityMs,
            taskID,
            handle: "TaskQueueService.awaitSessionPromptsIdle",
            signal: convergenceOwner.signal,
          }),
        convergenceOwner.signal,
      )
      logConvergenceStage("task_queue_idle")
      convergenceOwner.assertActive()
      await assertSessionPromptSubtreeFinished({
        sessions: lifecycle.cancelledSessions,
        failures: lifecycle.cancellationFailures,
        taskID,
        inactivityTimeoutMs: promptSettleInactivityMs,
        signal: convergenceOwner.signal,
      })
      logConvergenceStage("session_prompts_settled")
      const { SessionLoop } = await import("@/session/loop")
      let interruptedAssistantSessions = 0
      await provideActiveTaskRootSessionInstance(
        task,
        async () => {
          for (const sessionID of lifecycle.sessionIDs) {
            convergenceOwner.assertActive()
            if (sessionID === task.session_id) continue
            if (await SessionLoop.terminalizeRecoveredIncompleteAssistant(sessionID, convergenceOwner.signal)) {
              interruptedAssistantSessions += 1
            }
          }
        },
        convergenceOwner.signal,
      )
      logConvergenceStage("incomplete_assistants_terminalized")
      convergenceOwner.assertActive()
      const convergedAgentSessionIDs = await publishTaskAgentCancellationStatusesAfterSettlement({
        task,
        reason: "task cancelled",
        signal: convergenceOwner.signal,
      })
      logConvergenceStage("agent_lifecycle_published")
      convergenceOwner.assertActive()
      const pendingCoordinationRequestsCancelled = await cancelPendingAgentCoordinationRequestsForTask({
        taskID,
        reason: "task cancelled",
        signal: convergenceOwner.signal,
      })
      logConvergenceStage("coordination_cancelled")
      decisions.append({
        phase: "cancel",
        key: "agent_lifecycle_report",
        value: JSON.stringify({
          taskID,
          cancellationRequestEventID: cancellationRequest.id,
          sessionIDs: lifecycle.sessionIDs,
          promptCancellations: lifecycle.cancelledSessions.map((session) => session.id),
          convergedAgentSessionIDs,
          queuedPromptCancellations,
          pendingCoordinationRequestsCancelled,
          interruptedAssistantSessions,
          cancellationFailures: lifecycle.cancellationFailures.map((error) =>
            error instanceof Error ? error.message : String(error),
          ),
        }),
        reason:
          "Task cancellation collected and cancelled every task-owned agent lifecycle handle before terminal status.",
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
      logConvergenceStage("root_wake_queue_waiting")
      await SessionPromptState.waitForRootWakeQueueIdle(
        task.session_id,
        queueSettleInactivityMs,
        convergenceOwner.signal,
      ).catch((err) => onAbortFailure("root Session wake queue idle before cancellation terminal write", err, {}))
      logConvergenceStage("root_wake_queue_idle")
      convergenceOwner.assertActive()
      const terminalResult = await ProcessSupervisor.withTaskCancellationBarrier(
        taskID,
        () =>
          terminalTask(
            task,
            {
              status: "cancelled",
              error: "task cancelled",
              time_completed: Date.now(),
            },
            "Task cancelled",
            {
              projectDir: taskDirectory,
              cancellationRequest: { eventID: cancellationRequest.id },
              transactionEffect(db) {
                convergenceOwner.assertInTransaction(db)
                deleteEngineChannelBindingsForTask(db, taskID)
                terminalizeQueuedTaskEventsForCancellationInTransaction(db, {
                  taskID,
                  cancellationRequestEventID: cancellationRequest.id,
                  now: Date.now(),
                })
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

  export async function deleteSession(
    sessionID: string,
    input?: {
      deleteTasks?: boolean
      projectID?: string
      cancellationOrigin?: TaskCancellationOriginValue
    },
  ) {
    const current = Instance.current()
    const root = input?.projectID
      ? await Session.getInProject({ sessionID, projectID: input.projectID })
      : current
        ? await Session.getInProject({ sessionID, projectID: current.project.id })
        : await Session.get(sessionID)
    const sessionIDs = await Session.treeInProject({ sessionID, projectID: root.projectID })
    const readBoundTasks = (db: Database.TxOrDb) =>
      db
        .select()
        .from(EngineTaskTable)
        .where(and(eq(EngineTaskTable.project_id, root.projectID), inArray(EngineTaskTable.session_id, sessionIDs)))
        .all()
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
    const queueCancelledInCurrentInstance = Boolean(Instance.current())
    TaskQueueService.cancelSessionPrompts({
      sessionIDs: ids,
      reason: "session deleted",
      origin: executionCancellationOrigin,
    })
    if (queueCancelledInCurrentInstance) {
      await awaitTaskQueuePromptsIdle({
        sessionIDs: ids,
        inactivityTimeoutMs: CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
        handle: "EngineService.deleteSession.TaskQueueService.awaitSessionPromptsIdle",
      })
    } else {
      await Instance.tryProvideActive({
        directory: root.directory,
        fn: async () => {
          TaskQueueService.cancelSessionPrompts({
            sessionIDs: ids,
            reason: "session deleted",
            origin: executionCancellationOrigin,
          })
          await awaitTaskQueuePromptsIdle({
            sessionIDs: ids,
            inactivityTimeoutMs: CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
            handle: "EngineService.deleteSession.TaskQueueService.awaitSessionPromptsIdle",
          })
        },
      })
    }
    await assertSessionPromptSubtreeFinished({
      sessions: requested.cancelledSessions,
      failures: requested.failures,
      handle: "EngineService.deleteSession",
    })
    await Instance.tryProvideActive({
      directory: root.directory,
      fn: async () => {
        await Promise.all(ids.map((id) => ConversationCapability.disposeRuntimeMcp(id)))
      },
    })
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
        await awaitRootSessionWakeQueueSettled(item, CANCEL_QUEUE_SETTLE_INACTIVITY_MS)
      }
      for (const item of tasksForDelete) {
        await recordTaskPhysicalDeleteBreadcrumb(item, "EngineService.deleteSession.deleteTasks", {
          rootSessionID: sessionID,
          sessionIDs: ids,
        })
      }
    }
    await cancelPendingPermissionsForSessions(ids, "Session tree deleted before the Tool invocation ran")
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
    },
  ) {
    const receipt = existing.receipt
    if (
      receipt.mission_id !== input.importer.missionID ||
      receipt.mission_session_id !== input.importer.sessionID ||
      receipt.panel_message_id !== input.importer.messageID ||
      receipt.tool_part_id !== input.toolPartID
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
    text: string
    evidenceLocators: ArtifactReadLocator[]
    completeEvidenceLocators: ArtifactReadLocator[]
    toolPartID: string
  }) {
    const reviewed = TerminalLifecycleReferenceSchema.parse(input.reviewedTerminalLifecycleReference)
    const evidenceLocators = z.array(ArtifactReadLocatorSchema).min(1).max(64).parse(input.evidenceLocators)
    const task = requireTaskInCurrentProject(input.taskID)
    await assertTaskRootSessionLineageInCurrentProject(task)
    requireMissionTaskLineageAuthority({
      sourceTaskID: input.taskID,
      projectID: Instance.project.id,
      importer: input.importer,
    })
    const existing = missionTaskResumeReceipt(input.taskID, input.importer.toolCallID)
    if (existing) {
      assertMissionTaskResumeReceiptIdentity(existing, input)
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
    const bundle = await buildTaskSessionMessageBundle(task, input.text, "mission.acceptance_resume", "mission")
    const event = OrchestratorEventSchema.parse({
      missionAcceptanceResume: {
        missionID: input.importer.missionID,
        missionSessionID: input.importer.sessionID,
        messageID: bundle.info.id,
        panelMessageID: input.importer.messageID,
        toolCallID: input.importer.toolCallID,
        toolPartID: input.toolPartID,
        reviewedTerminalLifecycleReference: reviewed,
        evidenceLocators,
      },
    })
    let durableReceipt: { artifactID: string; receipt: z.infer<typeof MissionTaskResumeReceiptSchema> } | undefined
    let wakeStatus: DispatchTaskLoopResult | "accepted" | undefined
    try {
      await SessionPromptState.enqueueRootWake({
        rootSessionID: task.session_id!,
        wakeID: `mission-acceptance-resume:${input.importer.toolCallID}`,
        run: async () => {
          const committed = missionTaskResumeReceipt(input.taskID, input.importer.toolCallID)
          if (committed) {
            assertMissionTaskResumeReceiptIdentity(committed, input)
            durableReceipt = committed
            wakeStatus = "accepted"
            return
          }
          const persisted = await Session.persistMessageWithCommit(bundle, () => {
            Database.use((db) => {
              const current = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, input.taskID)).get()
              if (!current) throw new NotFoundError({ message: `Task not found: ${input.taskID}` })
              if (!isTaskTerminal(current)) throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              const transactionReference = requireCurrentTerminalLifecycleReference(input.taskID)
              if (!sameTerminalLifecycleReference(reviewed, transactionReference)) {
                throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              }
              if (isTaskCancelled(current)) throw missionTaskResumeLifecycleConflict({ task: current, reviewed })
              const openedTask = openTaskForContinuationInTransaction({
                db,
                taskID: input.taskID,
                summary: "Mission acceptance repair requested",
                now,
              })
              clearEngineTaskRewindCursor(db, { taskID: input.taskID, timeUpdated: now })
              const ingressArtifactID = persistQueuedMissionAcceptanceResumeInTransaction(db, {
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
                prior_terminal_lifecycle_reference: reviewed,
                evidence_locators: evidenceLocators,
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
          wakeStatus = await dispatchPersistedTaskLoop(input.taskID, durableReceipt?.receipt.ingress_artifact_id)
        },
      })
    } catch (error) {
      const current = requireTaskInCurrentProject(input.taskID)
      if (isTaskCancelled(current)) return missionTaskCancellationAuthority(current)
      throw error
    }
    if (!durableReceipt) throw new Error(`Mission acceptance-resume transaction committed without a receipt.`)
    if (!wakeStatus) throw new Error(`Mission acceptance-resume committed without dispatch acceptance.`)
    return {
      kind: "resumed" as const,
      receipt_artifact_id: durableReceipt.artifactID,
      ...durableReceipt.receipt,
      wake_status: wakeStatus,
    }
  }

  async function wakeTaskForIntent(taskID: string, intent: "retry" | "replan") {
    const task = requireTaskInCurrentProject(taskID)
    await assertTaskRootSessionLineageInCurrentProject(task)
    await SessionPromptState.enqueueRootWake({
      rootSessionID: task.session_id!,
      wakeID: Identifier.ascending("artifact"),
      run: async () => {
        Database.transaction((db) => {
          const current = db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get()
          if (!current) throw new NotFoundError({ message: `Task not found: ${taskID}` })
          if (!isTaskTerminal(current)) {
            const lifecycle = isTaskQueued(current) ? "queued" : "active"
            throw new TaskControlIntentLifecycleConflictError({
              message: `Task ${taskID} is already ${lifecycle}; ${intent} accepts only a terminal Task.`,
              taskID,
              operation: intent,
              lifecycle,
            })
          }
          const now = Date.now()
          const supersededOperatorMessageIDs = retirePendingQueuedTaskEventsForOperatorIntentInTransaction(db, {
            taskID,
            now,
          })
          const openedTask = openTaskForOperatorIntentInTransaction({
            db,
            taskID,
            intent,
            now,
          })
          persistQueuedTaskIntentInTransaction(db, {
            task: openedTask,
            intent,
            supersededOperatorMessageIDs,
            now,
          })
        })
        await dispatchPersistedTaskLoop(taskID)
      },
    })
    return viewTask(requireTaskInCurrentProject(taskID))
  }

  export async function retryTask(taskID: string) {
    return wakeTaskForIntent(taskID, "retry")
  }

  export async function replanTask(taskID: string) {
    return wakeTaskForIntent(taskID, "replan")
  }

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
      await Session.mergeConfigOverlay({
        sessionID: rootSession.id,
        patch: modelPatch,
      })
    }
    try {
      // Validate once and attach the neutral task_input reference to both the
      // visible message and task record. Domain adapters assign semantics only
      // through their explicit contracts.
      for (const attachment of attachmentRefs) {
        await appendTaskAttachment(taskID, attachment)
      }

      // Natural-language user messages are recorded once as visible task-root
      // user messages, which are the authoritative follow-up conversation.
      const note = await continueTaskMessage(taskID, input.text, input.source, attachmentRefs, input.metadata)
      const ingressID = Database.use(
        (db) =>
          db
            .select({ id: EngineArtifactTable.id })
            .from(EngineArtifactTable)
            .where(
              and(
                eq(EngineArtifactTable.task_id, taskID),
                eq(EngineArtifactTable.kind, "queued_operator_wake"),
                sql`json_extract(${EngineArtifactTable.payload}, '$.message_id') = ${note.user_message.info.id}`,
              ),
            )
            .get()?.id,
      )
      const message =
        note.wakeStatus === "started"
          ? "Operator message recorded and accepted for delivery."
          : note.wakeStatus === "queued"
            ? "Operator message recorded. Task wake queued behind an earlier root Session wake."
            : "Operator message recorded."
      const queueProjection =
        ingressID && task.session_id
          ? SessionPromptState.rootWakeQueueProjection(task.session_id, ingressID)
          : undefined
      return {
        message,
        wake_status: note.wakeStatus === "started" ? ("accepted" as const) : note.wakeStatus,
        ...(ingressID ? { ingress_id: ingressID } : {}),
        ...(queueProjection
          ? {
              queue_position: queueProjection.queuePosition,
              current_owner_ingress_id: queueProjection.currentOwnerWakeID,
            }
          : {}),
        user_message: note.user_message,
      }
    } catch (error) {
      if (input.model) {
        const agentModelRestorePatch = Object.fromEntries(
          Object.entries(previousAgentModelOverlay).map(([agentID, model]) => [agentID, { model }]),
        )
        await Session.mergeConfigOverlay({
          sessionID: rootSession.id,
          patch: {
            model: previousModelOverlay,
            ...(Object.keys(agentModelRestorePatch).length > 0 ? { agent: agentModelRestorePatch } : {}),
          },
        })
      }
      throw error
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

function answersFromMessage(message?: string) {
  const text = message?.trim()
  if (!text) return
  return [[text]]
}
