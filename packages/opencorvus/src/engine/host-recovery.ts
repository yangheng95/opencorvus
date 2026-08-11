import { runWithInitializedIndependentProject } from "@/project/independent-project-owner"
import { Project } from "@/project/project"
import { findTask, listStartedIncompleteTaskIDs } from "./store"
import { taskRootDirectory } from "./task-directory"
import { listGlobalMissionProcessRecoveryCandidates } from "@/mission/session"
import { recoverMissionProcessSession } from "@/mission/process-recovery"

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
    result.failures.map(
      (failure) => new Error(`${failure.directory || "<unresolved>"}: ${failure.error}`),
    ),
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

export function listStartedTaskExecutionDirectories(input?: {
  scopeProjectWorktree?: string
}): string[] {
  const discovery = discoverStartedTaskExecutionDirectories(input)
  if (discovery.failures.length > 0) {
    throw new AggregateError(
      discovery.failures.map((failure) => new Error(`${failure.taskID}: ${failure.error}`)),
      `Failed to resolve ${discovery.failures.length} started Task execution director${discovery.failures.length === 1 ? "y" : "ies"}`,
    )
  }
  return discovery.directories
}

export async function recoverStartedTaskProjects(input: {
  directories: string[]
  initializeProject: (directory: string) => Promise<void>
}): Promise<StartedTaskProjectRecoveryResult> {
  const failures: StartedTaskProjectRecoveryFailure[] = []
  let initialized = 0
  for (const directory of input.directories) {
    try {
      await input.initializeProject(directory)
      initialized += 1
    } catch (error) {
      failures.push({
        directory,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return {
    attempted: input.directories.length,
    initialized,
    missionAttempted: 0,
    missionWoken: 0,
    missionCompleted: 0,
    failures,
  }
}

export async function recoverStartedTaskExecutions(input?: {
  scopeProjectWorktree?: string
}): Promise<StartedTaskProjectRecoveryResult> {
  const discovery = discoverStartedTaskExecutionDirectories(input)
  const missionCandidates = listGlobalMissionProcessRecoveryCandidates(input)
  const directories = [...discovery.directories]
  for (const candidate of missionCandidates) {
    if (!directories.some((directory) => Project.samePath(directory, candidate.directory))) {
      directories.push(candidate.directory)
    }
  }
  directories.sort((left, right) => left.localeCompare(right))
  let missionWoken = 0
  let missionCompleted = 0
  const missionFailures: StartedTaskProjectRecoveryFailure[] = []
  const result = await recoverStartedTaskProjects({
    directories,
    initializeProject: (directory) =>
      runWithInitializedIndependentProject({
        directory,
        fn: async () => {
          for (const candidate of missionCandidates.filter((item) => Project.samePath(item.directory, directory))) {
            try {
              const recovered = await recoverMissionProcessSession(candidate.sessionID)
              if (recovered.status === "woken") missionWoken += 1
              if (recovered.status === "already_completed") missionCompleted += 1
            } catch (error) {
              missionFailures.push({
                directory,
                error: `Mission Session ${candidate.sessionID}: ${error instanceof Error ? error.message : String(error)}`,
              })
            }
          }
        },
      }),
  })
  return {
    attempted: result.attempted + discovery.failures.length,
    initialized: result.initialized,
    missionAttempted: missionCandidates.length,
    missionWoken,
    missionCompleted,
    failures: [
      ...discovery.failures.map(({ directory, error }) => ({ directory, error })),
      ...missionFailures,
      ...result.failures,
    ],
  }
}
