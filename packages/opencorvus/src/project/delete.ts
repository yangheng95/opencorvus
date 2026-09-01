import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { deleteDecisionLogsForTasks } from "@/decision-log"
import { assertSessionPromptSubtreeFinished, cancelSessionPromptInScope } from "@/engine/cancellation-scope"
import { createTaskCancellationIncomplete } from "@/engine/cancellation-error"
import { EngineTaskTable } from "@/engine/engine.sql"
import { expireProjectPermissionGrantsInTransaction } from "@/permission/project-authority"
import { deleteProjectNotes } from "@/quicknote/service"
import { SessionTable } from "@/session/session.sql"
import { CANCEL_INGRESS_SETTLE_INACTIVITY_MS, EngineService } from "@/task-api"
import { Database, eq } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import type { TaskCancellationOrigin } from "@/engine/cancellation-origin"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ImplicitProject } from "./implicit-project"
import { Instance, type ProjectDeletionAdmission } from "./instance"
import { Project } from "./project"
import { closeProjectDeletionRegistryAdmission, type ProjectDeletionRegistryAdmission } from "./deletion-registry"
import { ProjectMaintenanceFenceTable, ProjectTable } from "./project.sql"
import { ProjectRuntimePaths } from "./runtime-paths"
import {
  cleanupCommittedProjectDeletion,
  createProjectDeletionCleanupPlan,
  acquireProjectDeletionDirectoryAdmissions,
  assertProjectDeletionCleanupPlanCurrent,
  assertProjectDeletionCleanupTargetRestored,
  assertProjectDeletionRegisteredDirectoryAuthority,
  projectDeletionCleanupTargetStaged,
  ProjectDeletionDirectoryAdmissionRollbackError,
  removeProjectDeletionCleanupPlan,
  settleProjectDeletionDirectoryAdmissions,
  type ProjectDeletionCleanupPlan,
  type ProjectDeletionDirectoryAdmissions,
} from "./deletion-cleanup"

export const ProjectDeleteResult = z
  .object({
    ok: z.boolean(),
    status: z.enum(["committed", "committed_with_residue"]),
    projectID: z.string(),
    directory: z.string(),
    deletedTaskCount: z.number().int().nonnegative(),
    residue: z.array(z.object({ path: z.string(), message: z.string() })),
  })
  .meta({
    ref: "ProjectDeleteResult",
  })

export type ProjectDeleteResult = z.infer<typeof ProjectDeleteResult>

export const ProjectDeletePendingError = NamedError.create(
  "ProjectDeletePendingError",
  z.object({
    projectID: z.string(),
    directory: z.string(),
    stage: z.enum(["filesystem-preflight", "runtime-settlement", "filesystem-quarantine", "database-commit"]),
    message: z.string(),
  }),
)

function assertProjectRuntimeDeleteTarget(projectDir: string, target: string): string {
  const projectRoot = path.resolve(projectDir)
  const resolvedTarget = path.resolve(target)
  const relative = path.relative(projectRoot, resolvedTarget)
  if (
    path.basename(resolvedTarget) !== ".r" ||
    path.basename(path.dirname(resolvedTarget)) !== ".opencorvus"
  ) {
    throw new Error(`Refusing to delete non-OpenCorvus project state directory: ${resolvedTarget}`)
  }
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to delete project state outside project root: ${resolvedTarget}`)
  }
  return resolvedTarget
}

type ProjectRootRemoval = {
  source: string
}

async function planProjectRootRemoval(target: string, label: string): Promise<ProjectRootRemoval> {
  // Project deletion is idempotent across an interrupted previous attempt:
  // the database row can remain after the project-owned runtime directory was
  // already removed. Absence is an explicit deletion state, not an alternate
  // runtime source or compatibility path.
  let info
  try {
    info = await fs.lstat(target)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return { source: target }
    throw error
  }
  if (!info.isDirectory()) {
    throw new Error(`Refusing to delete non-directory ${label}: ${target}`)
  }
  return { source: target }
}

async function stageProjectRootRemoval(
  plan: ProjectDeletionCleanupPlan["manifest"]["targets"][number],
): Promise<boolean> {
  try {
    await Filesystem.renameDurableNoReplace(plan.source, plan.quarantine)
    return projectDeletionCleanupTargetStaged(plan)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    let staged: boolean
    try {
      staged = await projectDeletionCleanupTargetStaged(plan)
    } catch (settlementError) {
      throw new AggregateError([error, settlementError], `Project deletion quarantine did not settle ${plan.source}`)
    }
    if (staged) return true
    if (code === "ENOENT" || code === "ENOTDIR") return false
    throw error
  }
}

async function rollbackProjectRootRemoval(
  plan: ProjectDeletionCleanupPlan["manifest"]["targets"][number],
): Promise<void> {
  try {
    await Filesystem.renameDurableNoReplace(plan.quarantine, plan.source)
    await assertProjectDeletionCleanupTargetRestored(plan)
  } catch (error) {
    try {
      await assertProjectDeletionCleanupTargetRestored(plan)
    } catch (settlementError) {
      throw new AggregateError([error, settlementError], `Project deletion rollback did not restore ${plan.source}`)
    }
  }
}

async function projectRootRemovalPlans(project: Project.Info): Promise<ProjectRootRemoval[]> {
  const projectDir = path.resolve(project.worktree)
  await assertProjectDeletionRegisteredDirectoryAuthority({
    projectID: project.id,
    directory: project.worktree,
    sandboxes: project.sandboxes,
  })
  if (ImplicitProject.isAnonymousDirectory(projectDir)) {
    if (project.sandboxes.length > 0) {
      throw new Error(`Anonymous Project ${project.id} cannot own additional registered deletion roots`)
    }
    return [await planProjectRootRemoval(projectDir, "anonymous Project root")]
  }
  const directories = [project.worktree, ...project.sandboxes].map((directory) => path.resolve(directory))
  const roots = directories.map((directory) =>
    assertProjectRuntimeDeleteTarget(directory, ProjectRuntimePaths.projectRuntimeRoot(directory)),
  )
  for (let index = 0; index < roots.length; index += 1) {
    for (let peer = 0; peer < index; peer += 1) {
      if (Filesystem.overlaps(roots[index]!, roots[peer]!)) {
        throw new Error(
          `Project ${project.id} registered deletion roots overlap: ${roots[peer]} and ${roots[index]}`,
        )
      }
    }
  }
  return Promise.all(roots.map((root) => planProjectRootRemoval(root, "OpenCorvus project runtime state")))
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

function projectDeletionInstanceDirectories(project: Project.Info): string[] {
  const roots = [project.worktree, ...project.sandboxes].map((directory) => Filesystem.resolve(directory))
  const directories = new Set(roots)
  for (const session of projectPromptSessions(project.id)) {
    const directory = Filesystem.resolve(session.directory)
    if (!roots.some((root) => Filesystem.contains(root, directory))) {
      throw new Error(
        `Project ${project.id} Session ${session.id} directory escapes its registered roots: ${directory}`,
      )
    }
    directories.add(directory)
  }
  return [...directories]
}

async function cancelRemainingProjectSessionPrompts(
  projectID: string,
  cancellationOrigin: TaskCancellationOrigin,
  projectDeletionAdmission: ProjectDeletionAdmission,
): Promise<void> {
  const sessions = projectPromptSessions(projectID)
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

  await assertSessionPromptSubtreeFinished({
    sessions: cancelledSessions,
    failures,
    handle: "ProjectDelete.SessionPrompt.cancel",
    projectDeletionAdmission,
  })
}

function deleteProjectRows(admission: ProjectDeletionRegistryAdmission, projectID: string, taskIDs: string[]): void {
  Database.transaction((db) => {
    const fence = db
      .select()
      .from(ProjectMaintenanceFenceTable)
      .where(eq(ProjectMaintenanceFenceTable.project_id, admission.projectID))
      .get()
    if (
      !fence ||
      fence.operation_id !== admission.operationID ||
      fence.project_generation !== admission.snapshot.generation ||
      fence.kind !== "delete"
    ) {
      throw new Error(`Project ${admission.projectID} deletion fence changed before commit`)
    }
    const current = db.select().from(ProjectTable).where(eq(ProjectTable.id, admission.projectID)).get()
    const expected = admission.snapshot
    if (
      !current ||
      current.generation !== expected.generation ||
      current.worktree !== expected.worktree ||
      JSON.stringify(current.sandboxes) !== JSON.stringify(expected.sandboxes)
    ) {
      throw new Error(`Project ${admission.projectID} registry identity changed during deletion`)
    }
    const currentTaskIDs = db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.project_id, projectID))
      .all()
      .map((row) => row.id)
    if (currentTaskIDs.length !== taskIDs.length || currentTaskIDs.some((taskID) => !taskIDs.includes(taskID))) {
      throw new Error(`Project ${projectID} Task ownership changed before deletion commit`)
    }
    deleteDecisionLogsForTasks(taskIDs, db)
    deleteProjectNotes({ projectID }, db)
    expireProjectPermissionGrantsInTransaction({
      db,
      projectID,
      reason: `Project ${projectID} generation ${admission.snapshot.generation} was deleted`,
    })
    // Task rows must go before the Project row. Both the Task subtree and the
    // Session subtree reach engine_workflow_node_occurrence, whose
    // child_session_id restricts Session deletion so a live workflow node can
    // never lose the Session it admitted. SQLite picks its own order among a
    // parent's cascade branches, so leaving both branches to one cascade lets
    // the Session branch run first and hit that restriction. Retiring the Task
    // subtree first removes the occurrence rows through their own owner.
    db.delete(EngineTaskTable).where(eq(EngineTaskTable.project_id, projectID)).run()
    db.delete(ProjectTable).where(eq(ProjectTable.id, admission.projectID)).run()
  })
}

export async function deleteProject(
  project: Project.Info,
  cancellationOrigin: TaskCancellationOrigin,
): Promise<ProjectDeleteResult> {
  const projectID = project.id
  using registryAdmission = closeProjectDeletionRegistryAdmission(projectID)
  const currentProject = Project.fromRow(registryAdmission.snapshot)
  const directory = currentProject.worktree
  using admission = await Instance.closeProjectAdmission({
    projectID,
    directories: projectDeletionInstanceDirectories(currentProject),
  })
  let taskIDs: string[] = []
  let cleanupPlan: ProjectDeletionCleanupPlan | undefined
  let directoryAdmissions: ProjectDeletionDirectoryAdmissions | undefined
  const stagedPlans: ProjectDeletionCleanupPlan["manifest"]["targets"] = []
  let stage: "filesystem-preflight" | "runtime-settlement" | "filesystem-quarantine" | "database-commit" =
    "filesystem-preflight"
  let committed = false

  try {
    await projectRootRemovalPlans(currentProject)
    taskIDs = projectTaskIDs(projectID)
    stage = "runtime-settlement"
    for (const taskID of taskIDs) {
      await EngineService.deleteTask(taskID, {
        projectID,
        projectDeletionAdmission: admission,
        origin: cancellationOrigin,
      })
    }

    await cancelRemainingProjectSessionPrompts(projectID, cancellationOrigin, admission)
    await Instance.disposeProjectEntries(projectID, CANCEL_INGRESS_SETTLE_INACTIVITY_MS)
    stage = "filesystem-quarantine"
    await projectRootRemovalPlans(currentProject)
    // The durable cleanup owner exists even when the Project has no filesystem
    // root: it also owns post-commit retirement of every project-scoped MCP
    // credential. A committed deletion can therefore report residue and let
    // startup recovery retry it instead of orphaning secrets in a global file.
    cleanupPlan = await createProjectDeletionCleanupPlan({
      projectID,
      directory,
      operationID: registryAdmission.operationID,
    })
    directoryAdmissions = await acquireProjectDeletionDirectoryAdmissions(cleanupPlan)
    await assertProjectDeletionCleanupPlanCurrent(cleanupPlan)
    for (const plan of cleanupPlan.manifest.targets) {
      stagedPlans.push(plan)
      if (!(await stageProjectRootRemoval(plan))) stagedPlans.pop()
    }
    const finalTaskIDs = projectTaskIDs(projectID)
    if (finalTaskIDs.length !== taskIDs.length || finalTaskIDs.some((taskID) => !taskIDs.includes(taskID))) {
      throw new Error(`Project ${projectID} Task ownership changed after deletion admission closed`)
    }
    stage = "database-commit"
    deleteProjectRows(registryAdmission, projectID, finalTaskIDs)
    committed = true
  } catch (error) {
    if (committed) throw error
    const rollbacks = await Promise.allSettled(stagedPlans.toReversed().map((plan) => rollbackProjectRootRemoval(plan)))
    const rollbackErrors = rollbacks.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (rollbackErrors.length > 0) {
      registryAdmission.preserveFence()
      throw new AggregateError(
        [error, ...rollbackErrors],
        `Project ${projectID} deletion failed and root rollback was incomplete`,
      )
    }
    if (cleanupPlan) {
      if (!directoryAdmissions) {
        if (error instanceof ProjectDeletionDirectoryAdmissionRollbackError) {
          registryAdmission.preserveFence()
          throw new ProjectDeletePendingError(
            {
              projectID,
              directory,
              stage,
              message: `Project ${projectID} deletion is pending at ${stage}; retry after restoring filesystem access or resolving runtime settlement`,
            },
            { cause: error },
          )
        }
        try {
          await removeProjectDeletionCleanupPlan(cleanupPlan)
        } catch (cleanupError) {
          registryAdmission.preserveFence()
          throw new AggregateError(
            [error, cleanupError],
            `Project ${projectID} deletion admission failed and its unused cleanup manifest could not be removed`,
          )
        }
      } else {
        try {
          settleProjectDeletionDirectoryAdmissions(directoryAdmissions)
          await removeProjectDeletionCleanupPlan(cleanupPlan)
        } catch (cleanupError) {
          registryAdmission.preserveFence()
          throw new AggregateError(
            [error, cleanupError],
            `Project ${projectID} deletion failed and its rolled-back cleanup manifest could not be removed`,
          )
        }
      }
    }
    throw new ProjectDeletePendingError(
      {
        projectID,
        directory,
        stage,
        message: `Project ${projectID} deletion is pending at ${stage}; retry after restoring filesystem access or resolving runtime settlement`,
      },
      { cause: error },
    )
  }

  const residue = cleanupPlan
    ? await cleanupCommittedProjectDeletion(cleanupPlan, { directoryAdmissions })
    : []

  return ProjectDeleteResult.parse({
    ok: true,
    status: residue.length > 0 ? "committed_with_residue" : "committed",
    projectID,
    directory,
    deletedTaskCount: taskIDs.length,
    residue,
  })
}
