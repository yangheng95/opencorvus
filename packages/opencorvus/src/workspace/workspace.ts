import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Identifier } from "@/id/id"
import { fn } from "@/util/fn"
import { Database, NotFoundError, and, eq } from "@/storage/db"
import { Project } from "@/project/project"
import { ProjectTable } from "@/project/project.sql"
import { Instance } from "@/project/instance"
import {
  assertProjectDeletionRegistryAdmission,
  assertProjectDurableAdmissionOpen,
  type ProjectDeletionRegistryAdmission,
} from "@/project/deletion-registry"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Worktree } from "@/worktree"
import { WorktreeReadiness } from "@/worktree/readiness"
import { WorkspaceTable } from "./workspace.sql"
import { Config } from "./config"
import {
  WorkspaceLifecycle,
  WorkspaceLifecycleAdmissionConflictError,
  type CreateAdmission,
  type CreateEntry,
  type DeleteEntry,
  type Entry,
} from "./lifecycle"
import type { RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"

export const WorkspaceLifecycleIdentityConflictError = NamedError.create(
  "WorkspaceLifecycleIdentityConflictError",
  z.object({ workspaceID: z.string(), projectID: z.string(), message: z.string() }),
)

export const WorkspaceLifecyclePendingError = NamedError.create(
  "WorkspaceLifecyclePendingError",
  z.object({ workspaceID: z.string(), projectID: z.string(), stage: z.string(), message: z.string() }),
)

type BeforeWorkspaceRowPublication = (info: {
  id: string
  projectID: string
  branch: string | null
  config: { type: "worktree"; directory: string }
}) => void | Promise<void>
let beforeWorkspaceRowPublication: BeforeWorkspaceRowPublication | undefined
type BeforeWorkspaceDeleteCommit = (entry: DeleteEntry) => void | Promise<void>
let beforeWorkspaceDeleteCommit: BeforeWorkspaceDeleteCommit | undefined

export namespace Workspace {
  export const Event = {
    Ready: BusEvent.define("workspace.ready", z.object({ name: z.string() })),
    Failed: BusEvent.define("workspace.failed", z.object({ message: z.string() })),
  }

  export const Info = z
    .object({
      id: Identifier.schema("workspace"),
      branch: z.string().nullable(),
      projectID: z.string(),
      config: Config,
    })
    .meta({ ref: "Workspace" })
  export type Info = z.infer<typeof Info>

  export namespace TestHooks {
    export function installBeforeRowPublication(hook: BeforeWorkspaceRowPublication) {
      const previous = beforeWorkspaceRowPublication
      beforeWorkspaceRowPublication = hook
      return {
        [Symbol.dispose]() {
          if (beforeWorkspaceRowPublication === hook) beforeWorkspaceRowPublication = previous
        },
      }
    }

    export function installBeforeDeleteCommit(hook: BeforeWorkspaceDeleteCommit) {
      const previous = beforeWorkspaceDeleteCommit
      beforeWorkspaceDeleteCommit = hook
      return {
        [Symbol.dispose]() {
          if (beforeWorkspaceDeleteCommit === hook) beforeWorkspaceDeleteCommit = previous
        },
      }
    }
  }

  function fromRow(row: typeof WorkspaceTable.$inferSelect): Info {
    return Info.parse({ id: row.id, branch: row.branch, projectID: row.project_id, config: row.config })
  }

  function expectedCreateInfo(entry: CreateEntry): Info {
    return Info.parse({
      id: entry.workspaceID,
      projectID: entry.projectID,
      branch: entry.plan.info.branch,
      config: { type: "worktree", directory: entry.plan.info.directory },
    })
  }

  function sameInfo(left: Info, right: Info): boolean {
    return (
      left.id === right.id &&
      left.projectID === right.projectID &&
      left.branch === right.branch &&
      Project.samePath(left.config.directory, right.config.directory)
    )
  }

  function requireCurrentProjectGeneration(projectID: string, generation: string, workspaceID: string): void {
    const current = Project.occurrence(projectID)
    if (!current || current.generation !== generation) {
      throw new WorkspaceLifecycleIdentityConflictError({
        workspaceID,
        projectID,
        message: `Project generation changed while reducing Workspace lifecycle: ${projectID}`,
      })
    }
  }

  function persisted(id: string, projectID: string): Info | undefined {
    const row = Database.use((db) =>
      db
        .select()
        .from(WorkspaceTable)
        .where(and(eq(WorkspaceTable.id, id), eq(WorkspaceTable.project_id, projectID)))
        .get(),
    )
    return row ? fromRow(row) : undefined
  }

  function assertWorkspaceRemovalSandbox(
    workspace: Pick<Info, "id" | "projectID">,
    removal: Worktree.ManagedRemovalPlan,
  ): void {
    if (removal.matchedSandboxes.length > 0) return
    throw new WorkspaceLifecyclePendingError({
      workspaceID: workspace.id,
      projectID: workspace.projectID,
      stage: "sandbox-ownership",
      message: `Workspace worktree has no exact Project sandbox owner: ${workspace.id}`,
    })
  }

  async function reduceCreate(
    entry: CreateEntry,
    options: { admission?: CreateAdmission; observeProcessOccurrence?: RuntimeProcessOccurrenceObserver } = {},
  ): Promise<Info> {
    return WorkspaceLifecycle.withOwner(entry, async () => {
      const currentEntry = (await WorkspaceLifecycle.read(entry)) as CreateEntry
      const expected = expectedCreateInfo(currentEntry)
      const existing = persisted(expected.id, expected.projectID)
      if (currentEntry.terminal) {
        if (!existing || !sameInfo(existing, expected)) {
          throw new WorkspaceLifecycleIdentityConflictError({
            workspaceID: expected.id,
            projectID: expected.projectID,
            message: `Committed Workspace creation no longer has its exact row: ${expected.id}`,
          })
        }
        const retainedAdmission = WorkspaceLifecycle.getCreateAdmission(currentEntry.occurrenceID)
        if (retainedAdmission) {
          const admission = WorkspaceLifecycle.acquireCreateAdmission({
            projectID: currentEntry.projectID,
            projectGeneration: currentEntry.projectGeneration,
            workspaceID: currentEntry.workspaceID,
            occurrenceID: currentEntry.occurrenceID,
            observeProcessOccurrence: options.observeProcessOccurrence,
          })
          WorkspaceLifecycle.settleCreateAdmission(admission)
        }
        return existing
      }
      const createAdmission =
        options.admission ??
        WorkspaceLifecycle.acquireCreateAdmission({
          projectID: currentEntry.projectID,
          projectGeneration: currentEntry.projectGeneration,
          workspaceID: currentEntry.workspaceID,
          occurrenceID: currentEntry.occurrenceID,
          observeProcessOccurrence: options.observeProcessOccurrence,
        })
      requireCurrentProjectGeneration(currentEntry.projectID, currentEntry.projectGeneration, currentEntry.workspaceID)
      const worktree = await Worktree.create({ name: currentEntry.plan.info.name, reuseIfValid: true })
      if (
        worktree.name !== currentEntry.plan.info.name ||
        worktree.branch !== currentEntry.plan.info.branch ||
        !Project.samePath(worktree.directory, currentEntry.plan.info.directory)
      ) {
        throw new WorkspaceLifecycleIdentityConflictError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          message: `Workspace worktree creation returned a different immutable plan: ${expected.id}`,
        })
      }
      const registered = (await Worktree.listRegisteredWorktrees(currentEntry.plan.primaryDirectory)).find(
        (candidate) => Project.samePath(candidate.path, currentEntry.plan.info.directory),
      )
      if (registered?.branch?.replace(/^refs\/heads\//, "") !== currentEntry.plan.info.branch) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "git-registration",
          message: `Workspace Git registration is not exact: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 1, "worktree_registered", {
        directory: currentEntry.plan.info.directory,
        branch: currentEntry.plan.info.branch,
      })
      if (!(await WorktreeReadiness.isReady(currentEntry.plan.info.directory))) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "worktree-readiness",
          message: `Workspace worktree has no durable ready receipt: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 2, "worktree_ready")
      const sandbox = Project.exactSandboxAuthority(currentEntry.projectID)
      if (!sandbox?.sandboxes.some((directory) => Project.samePath(directory, currentEntry.plan.info.directory))) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "sandbox-ownership",
          message: `Workspace worktree has no exact Project sandbox owner: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 3, "sandbox_owned")

      await beforeWorkspaceRowPublication?.(expected)

      let inserted = false
      Database.immediateTransaction((db) => {
        WorkspaceLifecycle.assertCreateAdmission(db, createAdmission)
        const project = db
          .select({ generation: ProjectTable.generation })
          .from(ProjectTable)
          .where(eq(ProjectTable.id, currentEntry.projectID))
          .get()
        if (project?.generation !== currentEntry.projectGeneration) {
          throw new WorkspaceLifecycleIdentityConflictError({
            workspaceID: expected.id,
            projectID: expected.projectID,
            message: `Project generation changed before Workspace publication: ${expected.id}`,
          })
        }
        const row = db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, expected.id)).get()
        if (row) {
          if (!sameInfo(fromRow(row), expected)) {
            throw new WorkspaceLifecycleIdentityConflictError({
              workspaceID: expected.id,
              projectID: expected.projectID,
              message: `Workspace ID already names another immutable workspace: ${expected.id}`,
            })
          }
          return
        }
        db.insert(WorkspaceTable)
          .values({ id: expected.id, branch: expected.branch, project_id: expected.projectID, config: expected.config })
          .run()
        inserted = true
      })
      await WorkspaceLifecycle.appendPhase(currentEntry, 4, "workspace_row_published")
      await WorkspaceLifecycle.commit(currentEntry)
      WorkspaceLifecycle.settleCreateAdmission(createAdmission)
      if (inserted) {
        GlobalBus.emit("event", {
          directory: Instance.directory,
          payload: { type: Event.Ready.type, properties: { name: currentEntry.plan.info.name } },
        })
      }
      return expected
    })
  }

  export const create = fn(
    z.object({ id: Identifier.schema("workspace").optional(), projectID: Info.shape.projectID }),
    async (input) => {
      const id = Identifier.ascending("workspace", input.id)
      return WorkspaceLifecycle.withIdentityOwner(input.projectID, id, async () => {
        const existing = await WorkspaceLifecycle.get(input.projectID, id, "creating")
        if (existing) return reduceCreate(existing as CreateEntry)
        const plan = await Worktree.planNamed(`workspace-${id}`)
        const occurrenceID = WorkspaceLifecycle.createOccurrenceID(input.projectID, id)
        const admission = WorkspaceLifecycle.acquireCreateAdmission({
          projectID: input.projectID,
          projectGeneration: plan.projectGeneration,
          workspaceID: id,
          occurrenceID,
        })
        try {
          const entry = await WorkspaceLifecycle.recordCreate({ projectID: input.projectID, workspaceID: id, plan })
          return reduceCreate(entry, { admission })
        } catch (error) {
          if (!(await WorkspaceLifecycle.get(input.projectID, id, "creating"))) {
            WorkspaceLifecycle.settleCreateAdmission(admission)
          }
          throw error
        }
      })
    },
  )

  export function list(project: Project.Info) {
    const rows = Database.use((db) =>
      db.select().from(WorkspaceTable).where(eq(WorkspaceTable.project_id, project.id)).all(),
    )
    return rows.map(fromRow).sort((a, b) => a.id.localeCompare(b.id))
  }

  export const get = fn(Identifier.schema("workspace"), async (id) => {
    const row = Database.use((db) => db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, id)).get())
    if (!row) return
    return fromRow(row)
  })

  async function reduceDelete(
    entry: DeleteEntry,
    projectDeletionAdmission?: ProjectDeletionRegistryAdmission,
  ): Promise<Info> {
    return WorkspaceLifecycle.withOwner(entry, async () => {
      const currentEntry = (await WorkspaceLifecycle.read(entry)) as DeleteEntry
      const expected = Info.parse(currentEntry.workspace)
      if (currentEntry.terminal) {
        WorkspaceLifecycle.settleDeleteFrontier(currentEntry, Boolean(projectDeletionAdmission))
        return expected
      }
      requireCurrentProjectGeneration(currentEntry.projectID, currentEntry.projectGeneration, currentEntry.workspaceID)
      const row = persisted(expected.id, expected.projectID)
      if (row && !sameInfo(row, expected)) {
        throw new WorkspaceLifecycleIdentityConflictError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          message: `Workspace row changed during deletion: ${expected.id}`,
        })
      }
      const result = await Worktree.removeManagedProjectWorktreeDirectory({
        projectID: currentEntry.projectID,
        directory: currentEntry.removal.registration.directory,
        plan: currentEntry.removal,
        ...(projectDeletionAdmission ? { projectDeletionAdmission } : { releaseSandboxOwnership: true }),
      })
      if (!result.removed) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "external-removal",
          message: `Workspace worktree is still durably owned: ${expected.id}`,
        })
      }
      const settlement = await Worktree.inspectManagedRemovalSettlement(currentEntry.removal)
      if (!settlement.directoryRemoved) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "physical-removal",
          message: `Workspace directory remains after removal: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 1, "physical_directory_removed")
      if (!settlement.registrationPruned) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "git-prune",
          message: `Workspace Git registration remains after removal: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 2, "git_registration_pruned")
      if (!settlement.branchRemoved) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "branch-removal",
          message: `Workspace branch remains after removal: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 3, "branch_removed", {
        branch: currentEntry.removal.registration.branch,
        targetCommit: currentEntry.removal.registration.targetCommit,
      })
      if (!settlement.sandboxSettled) {
        throw new WorkspaceLifecyclePendingError({
          workspaceID: expected.id,
          projectID: expected.projectID,
          stage: "sandbox-settlement",
          message: `Workspace sandbox authority has not settled: ${expected.id}`,
        })
      }
      await WorkspaceLifecycle.appendPhase(currentEntry, 4, "sandbox_settled")
      Database.immediateTransaction((db) => {
        if (projectDeletionAdmission) assertProjectDeletionRegistryAdmission(db, projectDeletionAdmission)
        else if (!assertProjectDurableAdmissionOpen(db, currentEntry.projectID)) {
          throw new WorkspaceLifecyclePendingError({
            workspaceID: expected.id,
            projectID: expected.projectID,
            stage: "workspace-retirement",
            message: `Project maintenance admission is closed for Workspace retirement: ${expected.id}`,
          })
        }
        const current = db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, expected.id)).get()
        if (current && !sameInfo(fromRow(current), expected)) {
          throw new WorkspaceLifecycleIdentityConflictError({
            workspaceID: expected.id,
            projectID: expected.projectID,
            message: `Workspace row changed before retirement: ${expected.id}`,
          })
        }
        if (current) db.delete(WorkspaceTable).where(eq(WorkspaceTable.id, expected.id)).run()
      })
      await WorkspaceLifecycle.appendPhase(currentEntry, 5, "workspace_row_retired")
      await beforeWorkspaceDeleteCommit?.(currentEntry)
      await WorkspaceLifecycle.commit(currentEntry)
      WorkspaceLifecycle.settleDeleteFrontier(currentEntry, Boolean(projectDeletionAdmission))
      return expected
    })
  }

  async function removeOwned(
    input: { id: string; projectID: string },
    projectDeletionAdmission?: ProjectDeletionRegistryAdmission,
  ): Promise<Info> {
    const existing = await WorkspaceLifecycle.get(input.projectID, input.id, "deleting")
    if (existing) return reduceDelete(existing as DeleteEntry, projectDeletionAdmission)
    const row = persisted(input.id, input.projectID)
    if (!row) throw new NotFoundError({ message: `Workspace not found: ${input.id}` })
    const projectOccurrence = Project.occurrence(input.projectID)
    if (!projectOccurrence) throw new NotFoundError({ message: `Project not found: ${input.projectID}` })
    const removal = await Worktree.captureManagedRemovalPlan({
      projectID: input.projectID,
      directory: row.config.directory,
      authority: projectDeletionAdmission ? "project_delete" : "public",
      releaseSandboxOwnership: !projectDeletionAdmission,
    })
    assertWorkspaceRemovalSandbox(row, removal)
    const entry = await WorkspaceLifecycle.recordDelete({
      workspace: row,
      projectGeneration: projectOccurrence.generation,
      removal,
      ...(projectDeletionAdmission ? { projectDeletionAdmission } : {}),
    })
    return reduceDelete(entry, projectDeletionAdmission)
  }

  export const remove = fn(z.object({ id: Identifier.schema("workspace"), projectID: Info.shape.projectID }), (input) =>
    removeOwned(input),
  )

  export function removeForProjectDeletion(
    input: { id: string; projectID: string },
    admission: ProjectDeletionRegistryAdmission,
  ): Promise<Info> {
    return removeOwned(input, admission)
  }

  export async function prepareDeleteForProjectDeletion(
    input: {
      id: string
      projectID: string
    },
    admission: ProjectDeletionRegistryAdmission,
  ): Promise<DeleteEntry> {
    const existing = await WorkspaceLifecycle.get(input.projectID, input.id, "deleting")
    if (existing) return existing as DeleteEntry
    const row = persisted(input.id, input.projectID)
    if (!row) throw new NotFoundError({ message: `Workspace not found: ${input.id}` })
    const projectOccurrence = Project.occurrence(input.projectID)
    if (!projectOccurrence) throw new NotFoundError({ message: `Project not found: ${input.projectID}` })
    const removal = await Worktree.captureManagedRemovalPlan({
      projectID: input.projectID,
      directory: row.config.directory,
      authority: "project_delete",
    })
    assertWorkspaceRemovalSandbox(row, removal)
    return WorkspaceLifecycle.recordDelete({
      workspace: row,
      projectGeneration: projectOccurrence.generation,
      removal,
      projectDeletionAdmission: admission,
    })
  }

  export function reducePreparedDeleteForProjectDeletion(
    entry: DeleteEntry,
    admission: ProjectDeletionRegistryAdmission,
  ): Promise<Info> {
    return reduceDelete(entry, admission)
  }

  export async function resume(
    entry: Entry,
    observeProcessOccurrence?: RuntimeProcessOccurrenceObserver,
  ): Promise<Info> {
    return entry.lifecycle === "creating" ? reduceCreate(entry, { observeProcessOccurrence }) : reduceDelete(entry)
  }

  export async function recoverOpenLifecycles(observeProcessOccurrence?: RuntimeProcessOccurrenceObserver): Promise<{
    recovered: number
    retainedProjectDeletion: number
    failures: unknown[]
  }> {
    const result = { recovered: 0, retainedProjectDeletion: 0, failures: [] as unknown[] }
    for (const row of WorkspaceLifecycle.listCreateAdmissions()) {
      try {
        const entry = await WorkspaceLifecycle.get(row.project_id, row.workspace_id, "creating")
        if (entry && !entry.terminal) continue
        const admission = WorkspaceLifecycle.acquireCreateAdmission({
          projectID: row.project_id,
          projectGeneration: row.project_generation,
          workspaceID: row.workspace_id,
          occurrenceID: row.occurrence_id,
          observeProcessOccurrence,
        })
        WorkspaceLifecycle.settleCreateAdmission(admission)
      } catch (error) {
        result.failures.push(error)
      }
    }
    for (const entry of await WorkspaceLifecycle.currentEntries(undefined, observeProcessOccurrence)) {
      try {
        if (entry.terminal) {
          if (entry.lifecycle === "deleting" && entry.removal.authority.kind === "project_delete") {
            result.retainedProjectDeletion += 1
          } else if (entry.lifecycle === "deleting") {
            WorkspaceLifecycle.settleDeleteFrontier(entry, false)
          }
          continue
        }
        if (entry.lifecycle === "deleting" && entry.removal.authority.kind === "project_delete") {
          // The exact Project deletion fence is the authority for this child;
          // generic startup must not manufacture a replacement token. The
          // Project deletion recovery/retry consumes this retained occurrence.
          result.retainedProjectDeletion += 1
          continue
        }
        const project = Project.get(entry.projectID)
        if (!project) throw new Error(`Workspace lifecycle Project no longer exists: ${entry.projectID}`)
        await Instance.provideProjectIdentity({
          directory: project.worktree,
          fn: () => resume(entry, observeProcessOccurrence),
        })
        result.recovered += 1
      } catch (error) {
        result.failures.push(error)
      }
    }
    return result
  }

  export async function lifecycleDirectories(projectID: string): Promise<string[]> {
    const directories = new Set<string>()
    for (const entry of await WorkspaceLifecycle.currentEntries(projectID)) {
      directories.add(entry.lifecycle === "creating" ? entry.plan.info.directory : entry.removal.registration.directory)
    }
    return [...directories]
  }

  export async function projectDeletionEntries(projectID: string): Promise<DeleteEntry[]> {
    const entries = await WorkspaceLifecycle.currentEntries(projectID)
    return entries.map((entry) => {
      if (entry.lifecycle !== "deleting" || entry.removal.authority.kind !== "project_delete") {
        throw new WorkspaceLifecycleAdmissionConflictError({
          projectID,
          workspaceID: entry.workspaceID,
          occurrenceID: entry.occurrenceID,
          message: `Project deletion encountered another Workspace lifecycle authority: ${entry.occurrenceID}`,
        })
      }
      return entry
    })
  }

  export function assertProjectDeletionFrontiers(
    db: Database.TxOrDb,
    projectID: string,
    occurrenceIDs: readonly string[],
  ): void {
    WorkspaceLifecycle.assertProjectDeletionFrontiers(db, projectID, occurrenceIDs)
  }

  export function assertProjectDeletionEntriesCommitted(entries: readonly DeleteEntry[]): Promise<void> {
    return WorkspaceLifecycle.assertCommitted(entries)
  }

  export function assertLifecycleAdmissionsClear(db: Database.TxOrDb, projectID: string): void {
    WorkspaceLifecycle.assertProjectLifecycleAdmissionsClear(db, projectID)
  }
}
