import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
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

async function scanMissionExecution(sessionID: string): Promise<TaskControlScanResult> {
  const deleteIntent = currentMissionDeleteRetentionIntent(sessionID)
  if (deleteIntent) {
    await resumeMissionDeleteRetention({ sessionID, projectID: Instance.project.id })
    return { activated: 0 }
  }
  const closure = currentMissionExecutionClosure(sessionID)
  if (closure?.state === "closing") {
    await resumeMissionExecutionClosure({ sessionID })
    return { activated: 0 }
  }
  if (closure?.state === "closed") return { activated: 0 }

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
      scan: (sessionID) => scanMissionExecution(sessionID),
      maximumConcurrentScans: MISSION_RECOVERY_CONCURRENCY,
      maximumPendingScans: MISSION_RECOVERY_CONCURRENCY,
      retireSettledEntries: true,
      liveTasks: () => {
        let page = listGlobalMissionProcessRecoveryCandidates({
          scopeProjectID: projectID,
          afterSessionID: heartbeatCursor,
          limit: MISSION_RECOVERY_PAGE_SIZE,
        })
        if (page.length === 0 && heartbeatCursor) {
          heartbeatCursor = undefined
          page = listGlobalMissionProcessRecoveryCandidates({
            scopeProjectID: projectID,
            limit: MISSION_RECOVERY_PAGE_SIZE,
          })
        }
        heartbeatCursor = page.at(-1)?.sessionID
        return page.map((candidate) => candidate.sessionID)
      },
      heartbeatMilliseconds: MISSION_LIVENESS_RECHECK_MS,
      minimumWakeDelayMilliseconds: 25,
      maximumWakeDelayMilliseconds: MISSION_LIVENESS_RECHECK_MS,
      reenter: async (fn) => {
        await reenterActiveInstance({ directory, fn })
      },
    })
  },
  async (driver) => driver.dispose(),
  "mission-project-reconciliation-driver",
)

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
  while (true) {
    const page = listGlobalMissionProcessRecoveryCandidates({
      scopeProjectID: input.projectID,
      afterSessionID,
      limit: MISSION_RECOVERY_PAGE_SIZE,
    })
    if (page.length === 0) break
    const pageStart = afterSessionID
    attempted += page.length
    await Promise.all(
      page.map(async (candidate) => {
        try {
          const activated = await driver.request(candidate.sessionID, { propagateFailure: true })
          woken += activated
        } catch (error) {
          input.failures.push({
            directory: input.directory,
            error: `Mission Session ${candidate.sessionID}: ${error instanceof Error ? error.message : String(error)}`,
          })
        }
      }),
    )
    const remaining = new Set(
      listGlobalMissionProcessRecoveryCandidates({
        scopeProjectID: input.projectID,
        afterSessionID: pageStart,
        limit: MISSION_RECOVERY_PAGE_SIZE,
      }).map((candidate) => candidate.sessionID),
    )
    completed += page.filter((candidate) => !remaining.has(candidate.sessionID)).length
    afterSessionID = page.at(-1)!.sessionID
  }
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
    failures: outcomes.flatMap((outcome) =>
      outcome.initialized ? [] : [{ directory: outcome.directory, error: outcome.error }],
    ),
  }
}

export async function recoverStartedTaskExecutions(input?: {
  scopeProjectWorktree?: string
}): Promise<StartedTaskProjectRecoveryResult> {
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
  let missionCompleted = 0
  let missionAttempted = 0
  const missionFailures: StartedTaskProjectRecoveryFailure[] = []
  const result = await recoverStartedTaskProjects({
    directories,
    initializeProject: (directory) =>
      runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          const projectID = Instance.project.id
          await Promise.all([
            requestMissionProjectReconciliation({ projectID, directory, failures: missionFailures }).then(
              (mission) => {
                missionAttempted += mission.attempted
                missionWoken += mission.woken
                missionCompleted += mission.completed
              },
            ),
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
    failures: [
      ...discovery.failures.map(({ directory, error }) => ({ directory, error })),
      ...missionFailures,
      ...result.failures,
    ],
  }
}
