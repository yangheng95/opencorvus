import { createHash } from "node:crypto"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { DurablePublicationStore, type DurablePublicationOccurrence } from "@opencorvus-ai/util/durable-publication"
import { Global } from "@/global"
import { and, Database, eq } from "@/storage/db"
import { Worktree } from "@/worktree"
import { ProjectTable } from "@/project/project.sql"
import {
  assertProjectDeletionRegistryAdmission,
  assertProjectDurableAdmissionOpen,
  type ProjectDeletionRegistryAdmission,
} from "@/project/deletion-registry"
import { currentRuntimeProcessOccurrence, type RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"
import { Config } from "./config"
import { WorkspaceLifecycleAdmissionTable } from "./workspace.sql"

const KIND_PREFIX = "workspace-lifecycle"

const WorkspaceSnapshot = z
  .object({
    id: z.string().min(1),
    projectID: z.string().min(1),
    branch: z.string().nullable(),
    config: Config,
  })
  .strict()

const CreatePayload = z
  .object({
    version: z.literal(1),
    lifecycle: z.literal("creating"),
    databaseInstanceID: z.string().uuid(),
    projectID: z.string().min(1),
    projectGeneration: z.string().uuid(),
    workspaceID: z.string().min(1),
    plan: Worktree.NamedPlan,
  })
  .strict()

const DeletePayload = z
  .object({
    version: z.literal(1),
    lifecycle: z.literal("deleting"),
    databaseInstanceID: z.string().uuid(),
    projectID: z.string().min(1),
    projectGeneration: z.string().uuid(),
    workspaceID: z.string().min(1),
    workspace: WorkspaceSnapshot,
    removal: Worktree.ManagedRemovalPlan,
  })
  .strict()

const Payload = z.discriminatedUnion("lifecycle", [CreatePayload, DeletePayload])
export type CreateEntry = z.infer<typeof CreatePayload> & { occurrenceID: string; terminal: boolean }
export type DeleteEntry = z.infer<typeof DeletePayload> & { occurrenceID: string; terminal: boolean }
export type Entry = CreateEntry | DeleteEntry

function store(): DurablePublicationStore {
  return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
}

function subject(databaseInstanceID: string, projectID: string, workspaceID: string): string {
  return `workspace:${databaseInstanceID}:${projectID}:${workspaceID}`
}

function kind(input: { databaseInstanceID: string; projectID: string; workspaceID: string }): string {
  const scope = createHash("sha256")
    .update(`workspace-lifecycle-scope-v1\0${input.databaseInstanceID}\0${input.projectID}\0${input.workspaceID}`)
    .digest("hex")
    .slice(0, 40)
  return `${KIND_PREFIX}-${scope}`
}

function occurrenceID(
  databaseInstanceID: string,
  projectID: string,
  workspaceID: string,
  lifecycle: "creating" | "deleting",
): string {
  return createHash("sha256")
    .update(`workspace-lifecycle-v1\0${databaseInstanceID}\0${projectID}\0${workspaceID}\0${lifecycle}`)
    .digest("hex")
    .slice(0, 40)
}

export const WorkspaceLifecycleAdmissionConflictError = NamedError.create(
  "WorkspaceLifecycleAdmissionConflictError",
  z.object({ projectID: z.string(), workspaceID: z.string(), occurrenceID: z.string(), message: z.string() }),
)

export type CreateAdmission = {
  occurrenceID: string
  projectID: string
  projectGeneration: string
  workspaceID: string
  ownerOccurrenceID: string
  ownerPID: number
  ownerProcessInstanceID: string
}

type AfterCurrentFrontierQuery = (input: { projectID?: string; frontierCount: number }) => void | Promise<void>
let afterCurrentFrontierQuery: AfterCurrentFrontierQuery | undefined

function entryFromOccurrence(occurrence: DurablePublicationOccurrence): Entry {
  const payload = Payload.parse(occurrence.intent.payload)
  const expected = occurrenceID(payload.databaseInstanceID, payload.projectID, payload.workspaceID, payload.lifecycle)
  if (occurrence.intent.occurrenceID !== expected) {
    throw new Error(`Workspace lifecycle occurrence identity changed: ${occurrence.intent.occurrenceID}`)
  }
  if (occurrence.intent.subject !== subject(payload.databaseInstanceID, payload.projectID, payload.workspaceID)) {
    throw new Error(`Workspace lifecycle subject identity changed: ${occurrence.intent.occurrenceID}`)
  }
  if (occurrence.intent.kind !== kind(payload)) {
    throw new Error(`Workspace lifecycle kind identity changed: ${occurrence.intent.occurrenceID}`)
  }
  if (occurrence.terminal?.outcome === "rolled_back") {
    throw new Error(`Workspace lifecycle ${occurrence.intent.occurrenceID} is rolled back`)
  }
  return { ...payload, occurrenceID: expected, terminal: occurrence.terminal?.outcome === "committed" }
}

function currentDatabaseIdentity(): string {
  return Database.Identity()
}

async function readOptional(
  identity: { databaseInstanceID: string; projectID: string; workspaceID: string },
  id: string,
): Promise<DurablePublicationOccurrence | undefined> {
  try {
    return await store().read(kind(identity), id)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/intent is missing|ENOENT|no such file/i.test(message)) return undefined
    throw error
  }
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export namespace WorkspaceLifecycle {
  export namespace TestHooks {
    export function installAfterCurrentFrontierQuery(hook: AfterCurrentFrontierQuery) {
      const previous = afterCurrentFrontierQuery
      afterCurrentFrontierQuery = hook
      return {
        [Symbol.dispose]() {
          if (afterCurrentFrontierQuery === hook) afterCurrentFrontierQuery = previous
        },
      }
    }
  }

  export function createOccurrenceID(projectID: string, workspaceID: string): string {
    return occurrenceID(currentDatabaseIdentity(), projectID, workspaceID, "creating")
  }

  export function assertCreateAdmission(db: Database.TxOrDb, admission: CreateAdmission): void {
    const row = db
      .select()
      .from(WorkspaceLifecycleAdmissionTable)
      .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, admission.occurrenceID))
      .get()
    if (
      !row ||
      row.project_id !== admission.projectID ||
      row.project_generation !== admission.projectGeneration ||
      row.workspace_id !== admission.workspaceID ||
      row.lifecycle !== "creating" ||
      row.authority !== "public" ||
      row.owner_occurrence_id !== admission.ownerOccurrenceID ||
      row.owner_pid !== admission.ownerPID ||
      row.owner_process_instance_id !== admission.ownerProcessInstanceID
    ) {
      throw new WorkspaceLifecycleAdmissionConflictError({
        projectID: admission.projectID,
        workspaceID: admission.workspaceID,
        occurrenceID: admission.occurrenceID,
        message: `Workspace creation admission changed: ${admission.occurrenceID}`,
      })
    }
  }

  export function assertProjectLifecycleAdmissionsClear(db: Database.TxOrDb, projectID: string): void {
    const row = db
      .select({
        occurrenceID: WorkspaceLifecycleAdmissionTable.occurrence_id,
        workspaceID: WorkspaceLifecycleAdmissionTable.workspace_id,
      })
      .from(WorkspaceLifecycleAdmissionTable)
      .where(
        and(
          eq(WorkspaceLifecycleAdmissionTable.project_id, projectID),
          eq(WorkspaceLifecycleAdmissionTable.authority, "public"),
        ),
      )
      .get()
    if (row) {
      throw new WorkspaceLifecycleAdmissionConflictError({
        projectID,
        workspaceID: "pending",
        occurrenceID: row.occurrenceID,
        message: `Project ${projectID} has admitted public Workspace lifecycle work`,
      })
    }
  }

  export function acquireCreateAdmission(input: {
    projectID: string
    projectGeneration: string
    workspaceID: string
    occurrenceID: string
    observeProcessOccurrence?: RuntimeProcessOccurrenceObserver
  }): CreateAdmission {
    const owner = currentRuntimeProcessOccurrence()
    return Database.immediateTransaction((db) => {
      const project = db
        .select({ generation: ProjectTable.generation })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, input.projectID))
        .get()
      if (project?.generation !== input.projectGeneration) {
        throw new WorkspaceLifecycleAdmissionConflictError({
          projectID: input.projectID,
          workspaceID: input.workspaceID,
          occurrenceID: input.occurrenceID,
          message: `Workspace creation Project generation changed: ${input.projectID}`,
        })
      }
      if (!assertProjectDurableAdmissionOpen(db, input.projectID)) {
        throw new WorkspaceLifecycleAdmissionConflictError({
          projectID: input.projectID,
          workspaceID: input.workspaceID,
          occurrenceID: input.occurrenceID,
          message: `Project maintenance admission is closed for Workspace creation`,
        })
      }
      const existing = db
        .select()
        .from(WorkspaceLifecycleAdmissionTable)
        .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, input.occurrenceID))
        .get()
      if (existing) {
        if (
          existing.project_id !== input.projectID ||
          existing.project_generation !== input.projectGeneration ||
          existing.workspace_id !== input.workspaceID ||
          existing.lifecycle !== "creating" ||
          existing.authority !== "public"
        ) {
          throw new WorkspaceLifecycleAdmissionConflictError({
            projectID: input.projectID,
            workspaceID: input.workspaceID,
            occurrenceID: input.occurrenceID,
            message: `Workspace creation admission has another immutable identity: ${input.occurrenceID}`,
          })
        }
        const sameOwner =
          existing.owner_occurrence_id === owner.occurrenceID &&
          existing.owner_pid === owner.pid &&
          existing.owner_process_instance_id === owner.processInstanceID
        if (!sameOwner) {
          const observed = input.observeProcessOccurrence?.({
            pid: existing.owner_pid,
            processInstanceID: existing.owner_process_instance_id,
            occurrenceID: existing.owner_occurrence_id,
          })
          if (observed !== "dead_or_reused") {
            throw new WorkspaceLifecycleAdmissionConflictError({
              projectID: input.projectID,
              workspaceID: input.workspaceID,
              occurrenceID: input.occurrenceID,
              message: `Workspace creation admission is owned by another live or unknown backend`,
            })
          }
          db.update(WorkspaceLifecycleAdmissionTable)
            .set({
              owner_occurrence_id: owner.occurrenceID,
              owner_pid: owner.pid,
              owner_process_instance_id: owner.processInstanceID,
              time_created: Date.now(),
            })
            .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, input.occurrenceID))
            .run()
        }
      } else {
        const conflicting = db
          .select({ occurrenceID: WorkspaceLifecycleAdmissionTable.occurrence_id })
          .from(WorkspaceLifecycleAdmissionTable)
          .where(
            and(
              eq(WorkspaceLifecycleAdmissionTable.project_id, input.projectID),
              eq(WorkspaceLifecycleAdmissionTable.workspace_id, input.workspaceID),
            ),
          )
          .get()
        if (conflicting) {
          throw new WorkspaceLifecycleAdmissionConflictError({
            projectID: input.projectID,
            workspaceID: input.workspaceID,
            occurrenceID: input.occurrenceID,
            message: `Workspace identity is already admitted by ${conflicting.occurrenceID}`,
          })
        }
        db.insert(WorkspaceLifecycleAdmissionTable)
          .values({
            occurrence_id: input.occurrenceID,
            project_id: input.projectID,
            project_generation: input.projectGeneration,
            workspace_id: input.workspaceID,
            lifecycle: "creating",
            authority: "public",
            owner_occurrence_id: owner.occurrenceID,
            owner_pid: owner.pid,
            owner_process_instance_id: owner.processInstanceID,
            time_created: Date.now(),
          })
          .run()
      }
      return {
        occurrenceID: input.occurrenceID,
        projectID: input.projectID,
        projectGeneration: input.projectGeneration,
        workspaceID: input.workspaceID,
        ownerOccurrenceID: owner.occurrenceID,
        ownerPID: owner.pid,
        ownerProcessInstanceID: owner.processInstanceID,
      }
    })
  }

  export function settleCreateAdmission(admission: CreateAdmission): void {
    Database.immediateTransaction((db) => {
      assertCreateAdmission(db, admission)
      db.delete(WorkspaceLifecycleAdmissionTable)
        .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, admission.occurrenceID))
        .run()
    })
  }

  export function listCreateAdmissions(): Array<typeof WorkspaceLifecycleAdmissionTable.$inferSelect> {
    return Database.use((db) =>
      db
        .select()
        .from(WorkspaceLifecycleAdmissionTable)
        .where(eq(WorkspaceLifecycleAdmissionTable.lifecycle, "creating"))
        .all(),
    )
  }

  export function getCreateAdmission(
    occurrenceID: string,
  ): typeof WorkspaceLifecycleAdmissionTable.$inferSelect | undefined {
    return Database.use((db) =>
      db
        .select()
        .from(WorkspaceLifecycleAdmissionTable)
        .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, occurrenceID))
        .get(),
    )
  }

  export async function withIdentityOwner<T>(
    projectID: string,
    workspaceID: string,
    run: () => Promise<T>,
  ): Promise<T> {
    const databaseInstanceID = currentDatabaseIdentity()
    return store().withSubjectLock(
      kind({ databaseInstanceID, projectID, workspaceID }),
      subject(databaseInstanceID, projectID, workspaceID),
      run,
    )
  }

  export async function recordCreate(input: {
    projectID: string
    workspaceID: string
    plan: Worktree.NamedPlan
  }): Promise<CreateEntry> {
    const databaseInstanceID = currentDatabaseIdentity()
    const payload = CreatePayload.parse({
      version: 1,
      lifecycle: "creating",
      databaseInstanceID,
      projectID: input.projectID,
      projectGeneration: input.plan.projectGeneration,
      workspaceID: input.workspaceID,
      plan: input.plan,
    })
    const id = occurrenceID(databaseInstanceID, input.projectID, input.workspaceID, "creating")
    const owner = subject(databaseInstanceID, input.projectID, input.workspaceID)
    const scopedKind = kind(payload)
    await store().withSubjectLock(scopedKind, owner, async () => {
      const existing = await readOptional(payload, id)
      if (existing) {
        if (stable(existing.intent.payload) !== stable(payload)) {
          throw new Error(`Workspace creation ${id} already has another immutable intent`)
        }
        return
      }
      await store().create({ occurrenceID: id, kind: scopedKind, subject: owner, payload, timeCreated: Date.now() })
    })
    return entryFromOccurrence(await store().read(scopedKind, id)) as CreateEntry
  }

  export async function recordDelete(input: {
    workspace: z.infer<typeof WorkspaceSnapshot>
    projectGeneration: string
    removal: Worktree.ManagedRemovalPlan
    projectDeletionAdmission?: ProjectDeletionRegistryAdmission
  }): Promise<DeleteEntry> {
    const databaseInstanceID = currentDatabaseIdentity()
    const payload = DeletePayload.parse({
      version: 1,
      lifecycle: "deleting",
      databaseInstanceID,
      projectID: input.workspace.projectID,
      projectGeneration: input.projectGeneration,
      workspaceID: input.workspace.id,
      workspace: input.workspace,
      removal: input.removal,
    })
    const id = occurrenceID(databaseInstanceID, payload.projectID, payload.workspaceID, "deleting")
    const owner = subject(databaseInstanceID, payload.projectID, payload.workspaceID)
    const scopedKind = kind(payload)
    await store().withSubjectLock(scopedKind, owner, async () => {
      let insertedFrontier = false
      Database.immediateTransaction((db) => {
        const project = db
          .select({ generation: ProjectTable.generation })
          .from(ProjectTable)
          .where(eq(ProjectTable.id, payload.projectID))
          .get()
        if (project?.generation !== input.projectGeneration) {
          throw new WorkspaceLifecycleAdmissionConflictError({
            projectID: payload.projectID,
            workspaceID: payload.workspaceID,
            occurrenceID: id,
            message: `Workspace deletion Project generation changed: ${payload.projectID}`,
          })
        }
        if (input.projectDeletionAdmission) {
          assertProjectDeletionRegistryAdmission(db, input.projectDeletionAdmission)
        } else if (!assertProjectDurableAdmissionOpen(db, payload.projectID)) {
          throw new WorkspaceLifecycleAdmissionConflictError({
            projectID: payload.projectID,
            workspaceID: payload.workspaceID,
            occurrenceID: id,
            message: `Project maintenance admission is closed for Workspace deletion`,
          })
        }
        const existing = db
          .select()
          .from(WorkspaceLifecycleAdmissionTable)
          .where(
            and(
              eq(WorkspaceLifecycleAdmissionTable.project_id, payload.projectID),
              eq(WorkspaceLifecycleAdmissionTable.workspace_id, payload.workspaceID),
            ),
          )
          .get()
        if (existing) {
          if (
            existing.occurrence_id !== id ||
            existing.project_generation !== input.projectGeneration ||
            existing.lifecycle !== "deleting" ||
            existing.authority !== payload.removal.authority.kind
          ) {
            throw new WorkspaceLifecycleAdmissionConflictError({
              projectID: payload.projectID,
              workspaceID: payload.workspaceID,
              occurrenceID: id,
              message: `Workspace deletion frontier has another immutable identity: ${existing.occurrence_id}`,
            })
          }
          return
        }
        const runtime = currentRuntimeProcessOccurrence()
        db.insert(WorkspaceLifecycleAdmissionTable)
          .values({
            occurrence_id: id,
            project_id: payload.projectID,
            project_generation: input.projectGeneration,
            workspace_id: payload.workspaceID,
            lifecycle: "deleting",
            authority: payload.removal.authority.kind,
            owner_occurrence_id: runtime.occurrenceID,
            owner_pid: runtime.pid,
            owner_process_instance_id: runtime.processInstanceID,
            time_created: Date.now(),
          })
          .run()
        insertedFrontier = true
      })
      try {
        const existing = await readOptional(payload, id)
        if (existing) {
          if (stable(existing.intent.payload) !== stable(payload)) {
            throw new Error(`Workspace deletion ${id} already has another immutable intent`)
          }
          return
        }
        await store().create({ occurrenceID: id, kind: scopedKind, subject: owner, payload, timeCreated: Date.now() })
      } catch (error) {
        if (insertedFrontier) {
          Database.immediateTransaction((db) => {
            db.delete(WorkspaceLifecycleAdmissionTable)
              .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, id))
              .run()
          })
        }
        throw error
      }
    })
    return entryFromOccurrence(await store().read(scopedKind, id)) as DeleteEntry
  }

  export async function get(
    projectID: string,
    workspaceID: string,
    lifecycle: "creating" | "deleting",
  ): Promise<Entry | undefined> {
    const databaseInstanceID = currentDatabaseIdentity()
    const identity = { databaseInstanceID, projectID, workspaceID }
    const occurrence = await readOptional(identity, occurrenceID(databaseInstanceID, projectID, workspaceID, lifecycle))
    return occurrence ? entryFromOccurrence(occurrence) : undefined
  }

  export async function read(entry: Entry): Promise<Entry> {
    return entryFromOccurrence(await store().read(kind(entry), entry.occurrenceID))
  }

  export async function currentEntries(
    projectID?: string,
    observeProcessOccurrence?: RuntimeProcessOccurrenceObserver,
  ): Promise<Entry[]> {
    const rows = Database.use((db) => {
      const query = db.select().from(WorkspaceLifecycleAdmissionTable)
      return projectID ? query.where(eq(WorkspaceLifecycleAdmissionTable.project_id, projectID)).all() : query.all()
    })
    await afterCurrentFrontierQuery?.({ ...(projectID ? { projectID } : {}), frontierCount: rows.length })
    const databaseInstanceID = currentDatabaseIdentity()
    const entries: Entry[] = []
    for (const row of rows) {
      const identity = { databaseInstanceID, projectID: row.project_id, workspaceID: row.workspace_id }
      const occurrence = await store().withSubjectLock(
        kind(identity),
        subject(databaseInstanceID, row.project_id, row.workspace_id),
        async () => {
          const currentOccurrence = await readOptional(identity, row.occurrence_id)
          if (currentOccurrence) return currentOccurrence
          const observed = observeProcessOccurrence?.({
            pid: row.owner_pid,
            processInstanceID: row.owner_process_instance_id,
            occurrenceID: row.owner_occurrence_id,
          })
          if (row.lifecycle === "deleting" && observed === "dead_or_reused") {
            Database.immediateTransaction((db) => {
              const current = db
                .select()
                .from(WorkspaceLifecycleAdmissionTable)
                .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, row.occurrence_id))
                .get()
              if (
                current?.owner_occurrence_id === row.owner_occurrence_id &&
                current.owner_pid === row.owner_pid &&
                current.owner_process_instance_id === row.owner_process_instance_id
              ) {
                db.delete(WorkspaceLifecycleAdmissionTable)
                  .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, row.occurrence_id))
                  .run()
              }
            })
            return undefined
          }
          throw new WorkspaceLifecycleAdmissionConflictError({
            projectID: row.project_id,
            workspaceID: row.workspace_id,
            occurrenceID: row.occurrence_id,
            message: `Workspace lifecycle frontier has no durable intent: ${row.occurrence_id}`,
          })
        },
      )
      if (!occurrence) continue
      const entry = entryFromOccurrence(occurrence)
      const authority = entry.lifecycle === "creating" ? "public" : entry.removal.authority.kind
      if (row.lifecycle !== entry.lifecycle || row.authority !== authority) {
        throw new WorkspaceLifecycleAdmissionConflictError({
          projectID: row.project_id,
          workspaceID: row.workspace_id,
          occurrenceID: row.occurrence_id,
          message: `Workspace lifecycle frontier changed immutable kind: ${row.occurrence_id}`,
        })
      }
      entries.push(entry)
    }
    return entries
  }

  export async function withOwner<T>(entry: Entry, run: () => Promise<T>): Promise<T> {
    return store().withSubjectLock(
      kind(entry),
      subject(entry.databaseInstanceID, entry.projectID, entry.workspaceID),
      run,
    )
  }

  export async function appendPhase(
    entry: Entry,
    sequence: number,
    name: string,
    payload: Record<string, string | number | boolean | null> = {},
  ): Promise<void> {
    const occurrence = await store().read(kind(entry), entry.occurrenceID)
    const existing = occurrence.phases.find((phase) => phase.sequence === sequence)
    if (existing) {
      if (existing.name !== name || stable(existing.payload) !== stable(payload)) {
        throw new Error(`Workspace lifecycle ${entry.occurrenceID} phase ${sequence} changed identity`)
      }
      return
    }
    await store().appendPhase(kind(entry), {
      occurrenceID: entry.occurrenceID,
      sequence,
      name,
      payload,
      timeCreated: Date.now(),
    })
  }

  export async function commit(entry: Entry): Promise<void> {
    const occurrence = await store().read(kind(entry), entry.occurrenceID)
    if (occurrence.terminal?.outcome === "committed") return
    if (occurrence.terminal) throw new Error(`Workspace lifecycle ${entry.occurrenceID} is already rolled back`)
    await store().settle(kind(entry), {
      occurrenceID: entry.occurrenceID,
      outcome: "committed",
      payload: {},
      timeCreated: Date.now(),
    })
  }

  export function settleDeleteFrontier(entry: DeleteEntry, retainForProjectDeletion: boolean): void {
    if (retainForProjectDeletion) return
    Database.immediateTransaction((db) => {
      db.delete(WorkspaceLifecycleAdmissionTable)
        .where(eq(WorkspaceLifecycleAdmissionTable.occurrence_id, entry.occurrenceID))
        .run()
    })
  }

  export async function assertCommitted(entries: readonly DeleteEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!(await store().read(kind(entry), entry.occurrenceID)).terminal) {
        throw new Error(`Workspace deletion ${entry.occurrenceID} has no terminal receipt`)
      }
    }
  }

  export function assertProjectDeletionFrontiers(
    db: Database.TxOrDb,
    projectID: string,
    occurrenceIDs: readonly string[],
  ): void {
    const rows = db
      .select()
      .from(WorkspaceLifecycleAdmissionTable)
      .where(eq(WorkspaceLifecycleAdmissionTable.project_id, projectID))
      .all()
    if (
      rows.length !== occurrenceIDs.length ||
      rows.some(
        (row) =>
          row.lifecycle !== "deleting" ||
          row.authority !== "project_delete" ||
          !occurrenceIDs.includes(row.occurrence_id),
      )
    ) {
      throw new Error(`Project ${projectID} Workspace deletion frontier changed before commit`)
    }
  }
}
