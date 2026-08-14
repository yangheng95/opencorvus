import { Database, eq } from "@/storage/db"
import { ProjectTable } from "./project.sql"

type Snapshot = typeof ProjectTable.$inferSelect

export interface ProjectDeletionRegistryAdmission extends Disposable {
  readonly projectID: string
  readonly snapshot: Snapshot
}

const admissions = new Map<string, { token: symbol }>()

export function assertProjectDurableAdmissionOpen(projectID: string): boolean {
  return !admissions.has(projectID)
}

export function closeProjectDeletionRegistryAdmission(projectID: string): ProjectDeletionRegistryAdmission {
  if (admissions.has(projectID)) throw new Error(`Project ${projectID} registry admission is already closed`)
  const token = Symbol(projectID)
  admissions.set(projectID, { token })
  try {
    const snapshot = Database.use((db) =>
      db.select().from(ProjectTable).where(eq(ProjectTable.id, projectID)).get(),
    )
    if (!snapshot) throw new Error(`Project ${projectID} no longer exists`)
    const authority: ProjectDeletionRegistryAdmission = {
      projectID,
      snapshot,
      [Symbol.dispose]() {
        if (admissions.get(projectID)?.token === token) admissions.delete(projectID)
      },
    }
    return authority
  } catch (error) {
    if (admissions.get(projectID)?.token === token) admissions.delete(projectID)
    throw error
  }
}
