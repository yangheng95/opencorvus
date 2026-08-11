import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { deleteDecisionLogsForTasks } from "@/decision-log"
import { assertSessionPromptSubtreeFinished, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import { EngineTaskTable } from "@/engine/engine.sql"
import { deleteProjectNotes } from "@/quicknote/service"
import { TaskQueueService } from "@/scheduler/task-queue-service"
import { SessionTable } from "@/session/session.sql"
import { CANCEL_QUEUE_SETTLE_INACTIVITY_MS, EngineService } from "@/task-api"
import { Database, eq } from "@/storage/db"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { Filesystem } from "@/util/filesystem"
import { ImplicitProject } from "./implicit-project"
import { Instance } from "./instance"
import { Project } from "./project"
import { ProjectRuntimePaths } from "./runtime-paths"

export const ProjectDeleteResult = z
  .object({
    ok: z.boolean(),
    projectID: z.string(),
    directory: z.string(),
    deletedTaskCount: z.number().int().nonnegative(),
  })
  .meta({
    ref: "ProjectDeleteResult",
  })

export type ProjectDeleteResult = z.infer<typeof ProjectDeleteResult>

function assertProjectConfigDeleteTarget(projectDir: string, target: string): string {
  const projectRoot = path.resolve(projectDir)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(projectRoot, resolvedTarget)
  if (path.basename(resolvedTarget) !== ".opencorvus") {
    throw new Error(`Refusing to delete non-OpenCorvus project state directory: ${resolvedTarget}`)
  }
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to delete project state outside project root: ${resolvedTarget}`)
  }
  return resolvedTarget
}

async function removeProjectConfigRoot(projectDir: string): Promise<void> {
  const target = assertProjectConfigDeleteTarget(projectDir, ProjectRuntimePaths.projectConfigRoot(projectDir))
  // Project deletion is idempotent across an interrupted previous attempt:
  // the database row can remain after the project-owned runtime directory was
  // already removed. Absence is an explicit deletion state, not an alternate
  // runtime source or compatibility path.
  if (!(await Filesystem.exists(target))) return
  await fs.rm(target, { recursive: true, force: false })
}

async function removeManagedAnonymousProjectRoot(projectDir: string): Promise<void> {
  if (!ImplicitProject.isAnonymousDirectory(projectDir)) return
  await fs.rm(projectDir, { recursive: true, force: false })
}

function projectTaskIDs(projectID: string): string[] {
  return Database.use((db) =>
    db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.project_id, projectID))
      .all()
      .map((row) => row.id),
  )
}

type ProjectPromptSession = {
  id: string
  directory: string
}

function projectPromptSessions(projectID: string): ProjectPromptSession[] {
  return Database.use((db) =>
    db
      .select({
        id: SessionTable.id,
        directory: SessionTable.directory,
      })
      .from(SessionTable)
      .where(eq(SessionTable.project_id, projectID))
      .orderBy(SessionTable.time_created, SessionTable.id)
      .all(),
  )
}

async function cancelRemainingProjectSessionPrompts(
  projectID: string,
  cancellationOrigin: TaskCancellationOrigin,
): Promise<void> {
  const sessions = projectPromptSessions(projectID)
  const sessionIDs = sessions.map((session) => session.id)
  const cancelledSessions: ProjectPromptSession[] = []
  const failures: unknown[] = []
  const executionOrigin = createExecutionCancellationOrigin({
    actor: cancellationOrigin.actor,
    source: "project.delete",
    surface: cancellationOrigin.surface,
    requestID: cancellationOrigin.requestID,
    reason: cancellationOrigin.reason,
    ...(cancellationOrigin.missionID ? { missionID: cancellationOrigin.missionID } : {}),
  })

  TaskQueueService.cancelSessionPrompts({
    sessionIDs,
    reason: "project deleted",
    origin: executionOrigin,
  })

  for (const session of sessions.slice().reverse()) {
    try {
      if (
        cancelSessionPromptInScope({
          session,
          handle: "ProjectDelete.SessionPrompt.cancel",
          origin: { ...executionOrigin, targetSessionID: session.id },
          settleBeforeReuse: true,
        })
      ) {
        cancelledSessions.push(session)
      }
    } catch (error) {
      failures.push(error)
    }
  }

  try {
    await TaskQueueService.awaitSessionPromptsIdle({
      sessionIDs,
      inactivityTimeoutMs: CANCEL_QUEUE_SETTLE_INACTIVITY_MS,
    })
  } catch (cause) {
    throw createTaskCancellationIncomplete({
      handle: "ProjectDelete.TaskQueueService.awaitSessionPromptsIdle",
      cause,
    })
  }

  await assertSessionPromptSubtreeFinished({
    sessions: cancelledSessions,
    failures,
    handle: "ProjectDelete.SessionPrompt.cancel",
  })
}

function deleteProjectRows(projectID: string, taskIDs: string[]): void {
  Database.transaction((db) => {
    deleteDecisionLogsForTasks(taskIDs, db)
    deleteProjectNotes({ projectID }, db)
    Project.deleteRows([projectID], db)
    Database.effect(() => Database.incrementalVacuum())
  })
}

export async function deleteCurrentProject(cancellationOrigin: TaskCancellationOrigin): Promise<ProjectDeleteResult> {
  const projectID = Instance.project.id
  const directory = Instance.project.worktree
  const taskIDs = projectTaskIDs(projectID)

  for (const taskID of taskIDs) {
    await EngineService.deleteTask(taskID, { origin: cancellationOrigin })
  }

  await cancelRemainingProjectSessionPrompts(projectID, cancellationOrigin)
  await removeProjectConfigRoot(directory)
  deleteProjectRows(projectID, taskIDs)
  await Instance.dispose()
  await removeManagedAnonymousProjectRoot(directory)

  return ProjectDeleteResult.parse({
    ok: true,
    projectID,
    directory,
    deletedTaskCount: taskIDs.length,
  })
}
