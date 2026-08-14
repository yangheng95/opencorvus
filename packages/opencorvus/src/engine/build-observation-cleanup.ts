import path from "node:path"
import { randomUUID } from "node:crypto"
import { EngineBuildObservationCleanupTable, EngineTaskTable } from "./engine.sql"
import { Database, and, eq, ne, or } from "@/storage/db"
import { Identifier } from "@/id/id"
import { hostGit as runGit } from "@/util/git"

export class BuildObservationCleanupPendingError extends Error {
  constructor(
    readonly observationID: string,
    override readonly cause: unknown,
  ) {
    super(`Build observation cleanup ${observationID} remains pending`, { cause })
    this.name = "BuildObservationCleanupPendingError"
  }
}

export type BuildObservationCleanupRow = typeof EngineBuildObservationCleanupTable.$inferSelect

const buildObservationCleanupRuntimeID = randomUUID()

export async function resolveBuildObservationGitDir(worktreeDir: string): Promise<string> {
  const args = ["rev-parse", "--git-common-dir"]
  const result = await runGit(args, { cwd: worktreeDir, timeoutProfile: "fast" })
  if (result.exitCode !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed with exit code ${result.exitCode}: ${result.stderr.toString().trim()}`,
    )
  }
  const value = result.text().trim()
  if (!value) throw new Error(`git ${args.join(" ")} returned an empty Git directory in ${worktreeDir}`)
  return path.resolve(worktreeDir, value)
}

export function beginBuildObservationCleanup(input: {
  observationID: string
  taskID: string
  gitDir: string
  now?: number
}): BuildObservationCleanupRow {
  const observationID = Identifier.schema("artifact").parse(input.observationID)
  const now = input.now ?? Date.now()
  return Database.transaction((db) => {
    db.insert(EngineBuildObservationCleanupTable)
      .values({
        observation_id: observationID,
        task_id: input.taskID,
        git_dir: input.gitDir,
        status: "active",
        owner_runtime_id: buildObservationCleanupRuntimeID,
        attempts: 0,
        last_error: null,
        time_created: now,
        time_updated: now,
      })
      .onConflictDoNothing({ target: EngineBuildObservationCleanupTable.observation_id })
      .run()
    const row = db
      .select()
      .from(EngineBuildObservationCleanupTable)
      .where(eq(EngineBuildObservationCleanupTable.observation_id, observationID))
      .get()
    if (!row) throw new Error(`Build observation cleanup owner ${observationID} was not persisted`)
    if (row.task_id !== input.taskID || path.resolve(row.git_dir) !== path.resolve(input.gitDir)) {
      throw new Error(`Build observation cleanup owner ${observationID} identity drift`)
    }
    return row
  })
}

async function deleteOwnedRefs(row: BuildObservationCleanupRow): Promise<void> {
  const prefix = `refs/opencorvus/build-observations/${row.observation_id}/`
  const gitDirArg = `--git-dir=${row.git_dir}`
  const list = await runGit([gitDirArg, "for-each-ref", "--format=%(refname)", prefix], {
    cwd: path.dirname(row.git_dir),
    timeoutProfile: "fast",
  })
  if (list.exitCode !== 0) {
    throw new Error(`git for-each-ref ${prefix} failed with exit code ${list.exitCode}: ${list.stderr.toString().trim()}`)
  }
  const refs = list.text().split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  for (const refName of refs) {
    const result = await runGit([gitDirArg, "update-ref", "-d", refName], {
      cwd: path.dirname(row.git_dir),
      timeoutProfile: "fast",
    })
    if (result.exitCode !== 0) throw new Error(`git update-ref -d ${refName} failed with exit code ${result.exitCode}: ${result.stderr.toString().trim()}`)
  }
  const verify = await runGit([gitDirArg, "for-each-ref", "--format=%(refname)", prefix], {
    cwd: path.dirname(row.git_dir),
    timeoutProfile: "fast",
  })
  if (verify.exitCode !== 0 || verify.text().trim()) {
    throw new Error(`Build observation refs remain after cleanup for ${row.observation_id}`)
  }
}

export async function settleBuildObservationCleanup(input: {
  observationID: string
  releaseRetained?: boolean
}, options?: {
  /** Test-only executor below the durable owner state machine. */
  deleteRefs?: (row: BuildObservationCleanupRow) => Promise<void>
}): Promise<void> {
  const id = Identifier.schema("artifact").parse(input.observationID)
  const row = Database.use((db) =>
    db.select().from(EngineBuildObservationCleanupTable)
      .where(eq(EngineBuildObservationCleanupTable.observation_id, id)).get(),
  )
  if (!row) throw new Error(`Build observation cleanup owner ${id} does not exist`)
  if (row.status === "complete") return
  if (row.status === "retained" && !input.releaseRetained) return
  try {
    await (options?.deleteRefs ?? deleteOwnedRefs)(row)
    Database.use((db) =>
      db.update(EngineBuildObservationCleanupTable)
        .set({ status: "complete", attempts: row.attempts + 1, last_error: null, time_updated: Date.now() })
        .where(eq(EngineBuildObservationCleanupTable.observation_id, id)).run(),
    )
  } catch (cause) {
    Database.use((db) =>
      db.update(EngineBuildObservationCleanupTable)
        .set({
          status: "pending",
          attempts: row.attempts + 1,
          last_error: cause instanceof Error ? cause.message : String(cause),
          time_updated: Date.now(),
        })
        .where(eq(EngineBuildObservationCleanupTable.observation_id, id)).run(),
    )
    throw new BuildObservationCleanupPendingError(id, cause)
  }
}

export async function reconcileBuildObservationCleanups(input: { projectID: string }): Promise<number> {
  const rows = Database.use((db) =>
    db.select({ observationID: EngineBuildObservationCleanupTable.observation_id })
      .from(EngineBuildObservationCleanupTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineBuildObservationCleanupTable.task_id))
      .where(
        and(
          eq(EngineTaskTable.project_id, input.projectID),
          or(
            eq(EngineBuildObservationCleanupTable.status, "pending"),
            and(
              eq(EngineBuildObservationCleanupTable.status, "active"),
              ne(EngineBuildObservationCleanupTable.owner_runtime_id, buildObservationCleanupRuntimeID),
            ),
          ),
        ),
      )
      .all(),
  )
  for (const row of rows) await settleBuildObservationCleanup({ observationID: row.observationID })
  return rows.length
}

export function buildObservationCleanupRowsForTask(taskID: string): BuildObservationCleanupRow[] {
  return Database.use((db) =>
    db.select().from(EngineBuildObservationCleanupTable)
      .where(eq(EngineBuildObservationCleanupTable.task_id, taskID)).all(),
  )
}
