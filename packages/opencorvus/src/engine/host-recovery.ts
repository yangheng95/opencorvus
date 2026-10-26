import { runWithIndependentProjectIdentity, runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { Instance, reenterActiveInstance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Project } from "@/project/project"
import { findTask, listStartedIncompleteTaskIDs } from "./store"
import { taskRootDirectory } from "./task-directory"
import { listGlobalMissionProcessRecoveryCandidates } from "@/mission/session"
import { recoverMissionProcessSession } from "@/mission/process-recovery"
import { currentMissionExecutionClosure, resumeMissionExecutionClosure } from "@/mission/execution-closure"
import { resumeMissionDeleteRetention } from "@/mission/retention"
import { currentMissionDeleteRetentionIntent } from "@/mission/retention-facts"
import { listPendingSchedulerProjectIDs } from "@/protocol/delivery"
import { drainSchedulerMessagesForProject } from "@/protocol/scheduler-message"
import { TaskControlDriver, type TaskControlScanResult } from "./task-control-driver"
import { settledWork } from "@/util/queue"
import { Database, desc, eq } from "@/storage/db"
import { MessageTable } from "@/session/session.sql"
import { PermissionAuthority } from "@/permission/authority"

const MISSION_RECOVERY_CONCURRENCY = 4
const MISSION_RECOVERY_PAGE_SIZE = MISSION_RECOVERY_CONCURRENCY
const MISSION_RECOVERY_DISCOVERY_PAGE_SIZE = 64
const MISSION_LIVENESS_RECHECK_MS = 1_000

export type StartedTaskProjectRecoveryFailure = {
  directory: string
  error: string
}

export type StartedTaskProjectRecoveryResult = {
  attempted: number
  initialized: number
  missionAttempted: number
  missionWoken: number
  missionCompleted: number
  cancelledPermissionTasksRecovered: number
  failures: StartedTaskProjectRecoveryFailure[]
}

export function assertStartedTaskProjectRecoverySucceeded(
  result: StartedTaskProjectRecoveryResult,
): StartedTaskProjectRecoveryResult {
  if (result.failures.length === 0) return result
  throw new AggregateError(
    result.failures.map((failure) => new Error(`${failure.directory || "<unresolved>"}: ${failure.error}`)),
    `Failed to recover ${result.failures.length} started Task project(s)`,
  )
}

type StartedTaskDirectoryDiscovery = {
  directories: string[]
  failures: Array<StartedTaskProjectRecoveryFailure & { taskID: string }>
}

function discoverStartedTaskExecutionDirectories(input?: {
  scopeProjectWorktree?: string
}): StartedTaskDirectoryDiscovery {
  const directories: string[] = []
  const failures: StartedTaskDirectoryDiscovery["failures"] = []

  for (const taskID of listStartedIncompleteTaskIDs()) {
    const task = findTask(taskID)
    if (!task) {
      failures.push({
        taskID,
        directory: "",
        error: `Started incomplete Task ${taskID} disappeared during host recovery discovery`,
      })
      continue
    }
    const project = Project.get(task.project_id)
    if (!project) {
      failures.push({
        taskID,
        directory: "",
        error: `Started incomplete Task ${taskID} belongs to missing project ${task.project_id}`,
      })
      continue
    }
    if (input?.scopeProjectWorktree && !Project.samePath(project.worktree, input.scopeProjectWorktree)) continue
    try {
      const directory = taskRootDirectory(task)
      if (!directories.some((candidate) => Project.samePath(candidate, directory))) directories.push(directory)
    } catch (error) {
      failures.push({
        taskID,
        directory: project.worktree,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  directories.sort((left, right) => left.localeCompare(right))
  return { directories, failures }
}

export function listStartedTaskExecutionDirectories(input?: { scopeProjectWorktree?: string }): string[] {
  const discovery = discoverStartedTaskExecutionDirectories(input)
  if (discovery.failures.length > 0) {
    throw new AggregateError(
      discovery.failures.map((failure) => new Error(`${failure.taskID}: ${failure.error}`)),
      `Failed to resolve ${discovery.failures.length} started Task execution director${discovery.failures.length === 1 ? "y" : "ies"}`,
    )
  }
  return discovery.directories
}

async function reconcileMissionRetention(sessionID: string): Promise<boolean> {
  const deleteIntent = currentMissionDeleteRetentionIntent(sessionID)
  if (deleteIntent) {
    await resumeMissionDeleteRetention({ sessionID, projectID: Instance.project.id })
    return true
  }
  const closure = currentMissionExecutionClosure(sessionID)
  if (closure?.state === "closing") {
    await resumeMissionExecutionClosure({ sessionID })
    return true
  }
  return closure?.state === "closed"
}

async function scanMissionExecution(sessionID: string): Promise<TaskControlScanResult> {
  if (await reconcileMissionRetention(sessionID)) return { activated: 0 }

  const recovered = await recoverMissionProcessSession(sessionID)
  if (recovered.status === "woken") {
    return { activated: 1 }
  }
  if (recovered.status === "owned") {
    return { activated: 0 }
  }
  if (recovered.status === "live") {
    return { activated: 0 }
  }
  if (recovered.status === "closure_settled") {
    return { activated: 0 }
  }
  return { activated: 0 }
}

const missionProjectReconciliationState = createInstanceState(
  () => {
    const directory = Instance.directory
    const projectID = Instance.project.id
    let heartbeatCursor: string | undefined
    return new TaskControlDriver({
      inputRevision: (sessionID) => {
        const message = Database.use((db) =>
          db
            .select({ id: MessageTable.id })
            .from(MessageTable)
            .where(eq(MessageTable.session_id, sessionID))
            .orderBy(desc(MessageTable.time_created), desc(MessageTable.id))
            .limit(1)
            .get(),
        )
        return `${message?.id ?? ""}:${currentMissionExecutionClosure(sessionID)?.eventID ?? ""}`
      },
      scan: (sessionID) => scanMissionExecution(sessionID),
      maximumConcurrentScans: MISSION_RECOVERY_CONCURRENCY,
      maximumPendingScans: MISSION_RECOVERY_CONCURRENCY,
      retireSettledEntries: true,
      liveTasks: () => {
        const page = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: projectID,
          afterSessionID: heartbeatCursor,
          limit: MISSION_RECOVERY_PAGE_SIZE,
        })
        const hasMore = page.length === MISSION_RECOVERY_PAGE_SIZE
        const nextCursor = hasMore ? page.at(-1)?.sessionID : undefined
        return {
          taskIDs: page.map((candidate) => candidate.sessionID),
          hasMore,
          commit() {
            heartbeatCursor = nextCursor
          },
        }
      },
      heartbeatMilliseconds: MISSION_LIVENESS_RECHECK_MS,
      minimumWakeDelayMilliseconds: 25,
      maximumWakeDelayMilliseconds: MISSION_LIVENESS_RECHECK_MS,
      reenter: async (fn) => {
        await Database.runOutsideContext(() => reenterActiveInstance({ directory, fn }))
      },
    })
  },
  async (driver) => driver.dispose(),
  "mission-project-reconciliation-driver",
)

export function initializeMissionProjectReconciliation(): void {
  missionProjectReconciliationState()
}

async function requestMissionProjectReconciliation(input: {
  projectID: string
  directory: string
  failures: StartedTaskProjectRecoveryFailure[]
}): Promise<{ attempted: number; woken: number; completed: number }> {
  const driver = missionProjectReconciliationState()
  let attempted = 0
  let woken = 0
  let completed = 0
  let afterSessionID: string | undefined
  function* candidates() {
    while (true) {
      const page = listGlobalMissionProcessRecoveryCandidates({
        scopeProjectID: input.projectID,
        afterSessionID,
        limit: MISSION_RECOVERY_PAGE_SIZE,
      })
      if (page.length === 0) break
      afterSessionID = page.at(-1)!.sessionID
      yield* page
    }
  }
  await settledWork({
    concurrency: MISSION_RECOVERY_CONCURRENCY,
    items: candidates(),
    run: async (candidate) => {
      attempted += 1
      try {
        const activated = await driver.request(candidate.sessionID, { propagateFailure: true })
        woken += activated
        // Completion is derived from the exact candidate, not from its
        // position in a page after independently completing siblings vanish.
        const current = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: input.projectID,
          sessionID: candidate.sessionID,
          limit: 1,
        })
        if (current.length === 0) completed += 1
      } catch (error) {
        input.failures.push({
          directory: input.directory,
          error: `Mission Session ${candidate.sessionID}: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    },
  })
  return { attempted, woken, completed }
}

export async function recoverStartedTaskProjects(input: {
  directories: string[]
  initializeProject: (directory: string) => Promise<void>
}): Promise<StartedTaskProjectRecoveryResult> {
  const outcomes = await Promise.all(
    input.directories.map(async (directory) => {
      try {
        await input.initializeProject(directory)
        return { initialized: true as const, directory }
      } catch (error) {
        return {
          initialized: false as const,
          directory,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }),
  )
  return {
    attempted: input.directories.length,
    initialized: outcomes.filter((outcome) => outcome.initialized).length,
    missionAttempted: 0,
    missionWoken: 0,
    missionCompleted: 0,
    cancelledPermissionTasksRecovered: 0,
    failures: outcomes.flatMap((outcome) =>
      outcome.initialized ? [] : [{ directory: outcome.directory, error: outcome.error }],
    ),
  }
}

export async function recoverStartedTaskExecutions(input?: {
  scopeProjectWorktree?: string
}): Promise<StartedTaskProjectRecoveryResult> {
  // A cancelled Task is intentionally absent from runnable Task discovery.
  // Older runtimes could leave its Ask-me request undecided, however. Settle
  // those exact ledger owners without requiring model/runtime initialization.
  const cancellationFailures: StartedTaskProjectRecoveryFailure[] = []
  let cancelledPermissionTasksRecovered = 0
  const pendingTaskIDs = new Set(
    (await PermissionAuthority.list()).flatMap((request) => request.taskID ? [request.taskID] : []),
  )
  for (const taskID of pendingTaskIDs) {
    const task = findTask(taskID)
    if (task?.lifecycle_status !== "cancelled") continue
    const project = Project.get(task.project_id)
    if (input?.scopeProjectWorktree && project && !Project.samePath(project.worktree, input.scopeProjectWorktree)) continue
    try {
      if (!project) throw new Error(`Cancelled Task ${taskID} belongs to missing Project ${task.project_id}`)
      const { EngineService } = await import("@/task-api")
      const retired = await runWithIndependentProjectIdentity({
        directory: taskRootDirectory(task),
        fn: () => EngineService.reconcileCancelledTaskPermissions(taskID),
      })
      if (retired > 0) cancelledPermissionTasksRecovered += 1
    } catch (error) {
      cancellationFailures.push({
        directory: project?.worktree ?? "",
        error: `Task ${taskID}: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }
  // Accepted stops and retention are cleanup, even when execution-model
  // admission is unavailable. Re-discover execution from their settled facts.
  const stopRecovery = await settleInterruptedExecutionStops(input)
  const discovery = discoverStartedTaskExecutionDirectories(input)
  const directories = [...discovery.directories]
  let schedulerProjectCursor: string | undefined
  while (true) {
    const projectIDs = listPendingSchedulerProjectIDs({
      afterProjectID: schedulerProjectCursor,
      limit: MISSION_RECOVERY_DISCOVERY_PAGE_SIZE,
    })
    if (projectIDs.length === 0) break
    for (const projectID of projectIDs) {
      const project = Project.get(projectID)
      if (!project) continue
      if (input?.scopeProjectWorktree && !Project.samePath(project.worktree, input.scopeProjectWorktree)) continue
      if (!directories.some((directory) => Project.samePath(directory, project.worktree)))
        directories.push(project.worktree)
    }
    schedulerProjectCursor = projectIDs.at(-1)
  }
  let missionDiscoveryCursor: string | undefined
  while (true) {
    const page = listGlobalMissionProcessRecoveryCandidates({
      afterSessionID: missionDiscoveryCursor,
      limit: MISSION_RECOVERY_DISCOVERY_PAGE_SIZE,
    })
    if (page.length === 0) break
    for (const candidate of page) {
      if (
        (!input?.scopeProjectWorktree || Project.samePath(candidate.directory, input.scopeProjectWorktree)) &&
        !directories.some((directory) => Project.samePath(directory, candidate.directory))
      ) {
        directories.push(candidate.directory)
      }
    }
    missionDiscoveryCursor = page.at(-1)!.sessionID
  }
  directories.sort((left, right) => left.localeCompare(right))
  let missionWoken = 0
  let missionCompleted = stopRecovery.missionCompleted
  let missionAttempted = stopRecovery.missionAttempted
  const missionFailures: StartedTaskProjectRecoveryFailure[] = []
  const result = await recoverStartedTaskProjects({
    directories,
    initializeProject: (directory) =>
      runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          const projectID = Instance.project.id
          await Promise.all([
            requestMissionProjectReconciliation({ projectID, directory, failures: missionFailures }).then((mission) => {
              missionAttempted += mission.attempted
              missionWoken += mission.woken
              missionCompleted += mission.completed
            }),
            drainSchedulerMessagesForProject(),
          ])
        },
      }),
  })
  return {
    attempted: result.attempted + discovery.failures.length,
    initialized: result.initialized,
    missionAttempted,
    missionWoken,
    missionCompleted,
    cancelledPermissionTasksRecovered,
    failures: [
      ...cancellationFailures,
      ...stopRecovery.failures,
      ...discovery.failures.map(({ directory, error }) => ({ directory, error })),
      ...missionFailures,
      ...result.failures,
    ],
  }
}

async function settleInterruptedExecutionStops(input?: { scopeProjectWorktree?: string }): Promise<{
  failures: StartedTaskProjectRecoveryFailure[]
  missionAttempted: number
  missionCompleted: number
}> {
  const directories = [...discoverStartedTaskExecutionDirectories(input).directories]
  let afterSessionID: string | undefined
  while (true) {
    const page = listGlobalMissionProcessRecoveryCandidates({ afterSessionID, limit: MISSION_RECOVERY_DISCOVERY_PAGE_SIZE })
    if (page.length === 0) break
    for (const candidate of page) {
      if (input?.scopeProjectWorktree && !Project.samePath(candidate.directory, input.scopeProjectWorktree)) continue
      if (!directories.some(directory => Project.samePath(directory, candidate.directory))) directories.push(candidate.directory)
    }
    afterSessionID = page.at(-1)!.sessionID
  }
  const result = { failures: [] as StartedTaskProjectRecoveryFailure[], missionAttempted: 0, missionCompleted: 0 }
  const { EngineService } = await import("@/task-api")
  await Promise.all(directories.map(async directory => {
    try {
      await runWithIndependentProjectIdentity({ directory, fn: async () => {
        await EngineService.reconcilePendingTaskCancellations()
        const projectID = Instance.project.id
        let cursor: string | undefined
        while (true) {
          const page = listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: projectID, afterSessionID: cursor, limit: MISSION_RECOVERY_PAGE_SIZE })
          if (page.length === 0) break
          cursor = page.at(-1)!.sessionID
          await settledWork({ concurrency: MISSION_RECOVERY_CONCURRENCY, items: page, run: async candidate => {
            try {
              if (!await reconcileMissionRetention(candidate.sessionID)) return
              result.missionAttempted += 1
              if (listGlobalMissionProcessRecoveryCandidates({ scopeProjectID: projectID, sessionID: candidate.sessionID, limit: 1 }).length === 0)
                result.missionCompleted += 1
            } catch (error) {
              result.missionAttempted += 1
              result.failures.push({ directory, error: `Mission Session ${candidate.sessionID}: ${error instanceof Error ? error.message : String(error)}` })
            }
          } })
        }
      } })
    } catch (error) {
      result.failures.push({ directory, error: error instanceof Error ? error.message : String(error) })
    }
  }))
  return result
}
