import { randomUUID } from "node:crypto"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { currentRuntimeProcessOccurrence, type RuntimeProcessOccurrenceObserver } from "@/runtime/process-occurrence"
import { Database, and, eq } from "@/storage/db"
import { ProjectMaintenanceFenceTable, ProjectTable } from "./project.sql"

type Snapshot = typeof ProjectTable.$inferSelect

export const ProjectDurableAdmissionClosedError = NamedError.create(
  "ProjectDurableAdmissionClosedError",
  z.object({
    projectID: z.string(),
    message: z.string(),
  }),
)

export interface ProjectDeletionRegistryAdmission extends Disposable {
  readonly projectID: string
  readonly operationID: string
  readonly snapshot: Snapshot
}

const admissions = new Map<string, { token: symbol }>()

export function assertProjectDurableAdmissionOpen(db: Database.TxOrDb, projectID: string): boolean {
  if (admissions.has(projectID)) return false
  return !db
    .select({ projectID: ProjectMaintenanceFenceTable.project_id })
    .from(ProjectMaintenanceFenceTable)
    .where(eq(ProjectMaintenanceFenceTable.project_id, projectID))
    .get()
}

export function acquireProjectMaintenanceFencesInTransaction(
  db: Database.TxOrDb,
  input: { projectRows: Snapshot[]; operationID: string; kind: "delete" | "identity_convergence" | "promotion" },
): void {
  const owner = currentRuntimeProcessOccurrence()
  for (const project of input.projectRows) {
    if (!assertProjectDurableAdmissionOpen(db, project.id)) {
      throw new ProjectDurableAdmissionClosedError({
        projectID: project.id,
        message: `Project ${project.id} durable maintenance admission is already closed`,
      })
    }
    db.insert(ProjectMaintenanceFenceTable)
      .values({
        project_id: project.id,
        project_generation: project.generation,
        operation_id: input.operationID,
        kind: input.kind,
        owner_occurrence_id: owner.occurrenceID,
        owner_pid: owner.pid,
        owner_process_instance_id: owner.processInstanceID,
        time_created: Date.now(),
      })
      .run()
  }
}

export function ensureProjectPromotionFenceInTransaction(
  db: Database.TxOrDb,
  input: { project: Snapshot; operationID: string },
): void {
  const existing = db
    .select()
    .from(ProjectMaintenanceFenceTable)
    .where(eq(ProjectMaintenanceFenceTable.project_id, input.project.id))
    .get()
  if (existing) {
    if (
      existing.operation_id === input.operationID &&
      existing.project_generation === input.project.generation &&
      existing.kind === "promotion"
    )
      return
    throw new ProjectDurableAdmissionClosedError({
      projectID: input.project.id,
      message: `Project ${input.project.id} is fenced by another durable maintenance occurrence`,
    })
  }
  acquireProjectMaintenanceFencesInTransaction(db, {
    projectRows: [input.project],
    operationID: input.operationID,
    kind: "promotion",
  })
}

export type ProjectMaintenanceFenceRecoveryResult = {
  released: number
  /** Fences whose owner could not be observed. They stay held — a retained
   * fence only defers maintenance, while aborting the pass would keep the
   * runtime from starting at all. */
  unreconciled: unknown[]
}

export function recoverProjectMaintenanceFences(
  observe: RuntimeProcessOccurrenceObserver,
): ProjectMaintenanceFenceRecoveryResult {
  const unreconciled: unknown[] = []
  const released = Database.immediateTransaction((db) => {
    const fences = db.select().from(ProjectMaintenanceFenceTable).all()
    let count = 0
    for (const fence of fences) {
      try {
        // Promotion fences are released only by the promotion journal owner
        // after its terminal decision. Generic dead-process cleanup must not
        // expose a Project whose convergence is still pending.
        if (fence.kind === "promotion") continue
        const observation = observe({
          pid: fence.owner_pid,
          processInstanceID: fence.owner_process_instance_id,
          occurrenceID: fence.owner_occurrence_id,
        })
        if (observation !== "dead_or_reused") continue
        db.delete(ProjectMaintenanceFenceTable)
          .where(
            and(
              eq(ProjectMaintenanceFenceTable.project_id, fence.project_id),
              eq(ProjectMaintenanceFenceTable.operation_id, fence.operation_id),
            ),
          )
          .run()
        count += 1
      } catch (error) {
        unreconciled.push(error)
      }
    }
    return count
  })
  return { released, unreconciled }
}

export function releaseProjectMaintenanceFencesInTransaction(
  db: Database.TxOrDb,
  input: { operationID: string },
): void {
  db.delete(ProjectMaintenanceFenceTable)
    .where(eq(ProjectMaintenanceFenceTable.operation_id, input.operationID))
    .run()
}

export function closeProjectDeletionRegistryAdmission(projectID: string): ProjectDeletionRegistryAdmission {
  if (admissions.has(projectID)) {
    throw new ProjectDurableAdmissionClosedError({
      projectID,
      message: `Project ${projectID} registry admission is already closed`,
    })
  }
  const token = Symbol(projectID)
  const operationID = randomUUID()
  try {
    const snapshot = Database.immediateTransaction((db) => {
      const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get()
      if (!row) throw new Error(`Project ${projectID} no longer exists`)
      acquireProjectMaintenanceFencesInTransaction(db, {
        projectRows: [row],
        operationID,
        kind: "delete",
      })
      return row
    })
    admissions.set(projectID, { token })
    const authority: ProjectDeletionRegistryAdmission = {
      projectID,
      operationID,
      snapshot,
      [Symbol.dispose]() {
        if (admissions.get(projectID)?.token === token) admissions.delete(projectID)
        Database.use((db) =>
          db
            .delete(ProjectMaintenanceFenceTable)
            .where(
              and(
                eq(ProjectMaintenanceFenceTable.project_id, projectID),
                eq(ProjectMaintenanceFenceTable.operation_id, operationID),
              ),
            )
            .run(),
        )
      },
    }
    return authority
  } catch (error) {
    if (admissions.get(projectID)?.token === token) admissions.delete(projectID)
    throw error
  }
}
