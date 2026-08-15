import path from "node:path"
import { EngineBuildObservationCleanupReceiptTable, EngineBuildObservationCleanupTable, EngineTaskTable } from "./engine.sql"
import { Database, and, asc, eq } from "@/storage/db"
import { Identifier } from "@/id/id"
import { hostGit as runGit } from "@/util/git"
import {
  acquireControlLease,
  assertControlLeaseInTransaction,
  currentControlLeaseInTransaction,
  renewControlLease,
} from "./control-lease"

export class BuildObservationCleanupPendingError extends Error {
  constructor(
    readonly observationID: string,
    override readonly cause: unknown,
  ) {
    super(`Build observation cleanup ${observationID} remains pending`, { cause })
    this.name = "BuildObservationCleanupPendingError"
  }
}

export type BuildObservationCleanupRow = typeof EngineBuildObservationCleanupTable.$inferSelect & {
  status: "active" | "pending" | "retained" | "complete"
  attempts: number
  last_error: string | null
  time_updated: number
}

export type BuildObservationCleanupActivation = {
  leaseID: string
  ownerOccurrenceID: string
}

export type BegunBuildObservationCleanup = BuildObservationCleanupRow & {
  activation?: BuildObservationCleanupActivation
}

function project(db: Database.TxOrDb, row: typeof EngineBuildObservationCleanupTable.$inferSelect): BuildObservationCleanupRow {
  const receipts = db.select().from(EngineBuildObservationCleanupReceiptTable)
    .where(eq(EngineBuildObservationCleanupReceiptTable.observation_id, row.observation_id))
    .orderBy(asc(EngineBuildObservationCleanupReceiptTable.time_created), asc(EngineBuildObservationCleanupReceiptTable.id)).all()
  const latest = receipts.at(-1)
  return {
    ...row,
    status: receipts.some((receipt) => receipt.outcome === "complete") ? "complete" : latest?.outcome === "retained" ? "retained" : latest?.outcome === "failed" ? "pending" : "active",
    attempts: receipts.filter((receipt) => receipt.outcome !== "retained").length,
    last_error: latest?.outcome === "failed" ? latest.error : null,
    time_updated: latest?.time_created ?? row.time_created,
  }
}

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
  activate?: boolean
}): BegunBuildObservationCleanup {
  const observationID = Identifier.schema("artifact").parse(input.observationID)
  const now = input.now ?? Date.now()
  const row = Database.transaction((db) => {
    db.insert(EngineBuildObservationCleanupTable)
      .values({
        observation_id: observationID,
        task_id: input.taskID,
        git_dir: input.gitDir,
        time_created: now,
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
    return project(db, row)
  })
  if (input.activate === false || row.status !== "active") return row
  const ownerOccurrenceID = Identifier.ascending("call")
  const acquired = acquireControlLease({
    target: "build_cleanup",
    targetID: observationID,
    ownerOccurrenceID,
    now,
    leaseMilliseconds: 120_000,
  })
  if (!acquired.acquired) {
    throw new BuildObservationCleanupPendingError(
      observationID,
      new Error(`owned by ${acquired.lease.owner_occurrence_id} until ${acquired.lease.expires_at}`),
    )
  }
  return { ...row, activation: { leaseID: acquired.lease.id, ownerOccurrenceID } }
}

export function renewBuildObservationCleanupActivation(
  observationID: string,
  activation: BuildObservationCleanupActivation,
  now = Date.now(),
): void {
  renewControlLease({
    target: "build_cleanup",
    targetID: observationID,
    leaseID: activation.leaseID,
    ownerOccurrenceID: activation.ownerOccurrenceID,
    now,
    expiresAt: now + 120_000,
  })
}

async function deleteOwnedRefs(row: BuildObservationCleanupRow, signal: AbortSignal): Promise<void> {
  const prefix = `refs/opencorvus/build-observations/${row.observation_id}/`
  const gitDirArg = `--git-dir=${row.git_dir}`
  const list = await runGit([gitDirArg, "for-each-ref", "--format=%(refname)", prefix], {
    cwd: path.dirname(row.git_dir),
    timeoutProfile: "fast",
    abort: signal,
  })
  if (list.exitCode !== 0) {
    throw new Error(`git for-each-ref ${prefix} failed with exit code ${list.exitCode}: ${list.stderr.toString().trim()}`)
  }
  const refs = list.text().split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  for (const refName of refs) {
    const result = await runGit([gitDirArg, "update-ref", "-d", refName], {
      cwd: path.dirname(row.git_dir),
      timeoutProfile: "fast",
      abort: signal,
    })
    if (result.exitCode !== 0) throw new Error(`git update-ref -d ${refName} failed with exit code ${result.exitCode}: ${result.stderr.toString().trim()}`)
  }
  const verify = await runGit([gitDirArg, "for-each-ref", "--format=%(refname)", prefix], {
    cwd: path.dirname(row.git_dir),
    timeoutProfile: "fast",
    abort: signal,
  })
  if (verify.exitCode !== 0 || verify.text().trim()) {
    throw new Error(`Build observation refs remain after cleanup for ${row.observation_id}`)
  }
}

export async function settleBuildObservationCleanup(input: {
  observationID: string
  releaseRetained?: boolean
  activation?: BuildObservationCleanupActivation
}, options?: {
  /** Test-only executor below the durable owner state machine. */
  deleteRefs?: (row: BuildObservationCleanupRow, signal: AbortSignal) => Promise<void>
  leaseMilliseconds?: number
  renewalMilliseconds?: number
  renewLease?: typeof renewControlLease
}): Promise<void> {
  const id = Identifier.schema("artifact").parse(input.observationID)
  const state = Database.use((db) => {
    const persisted = db.select().from(EngineBuildObservationCleanupTable)
      .where(eq(EngineBuildObservationCleanupTable.observation_id, id)).get()
    if (!persisted) return undefined
    const row = project(db, persisted)
    const lease = currentControlLeaseInTransaction(db, "build_cleanup", id)
    return {
      row,
      supersedeLeaseID:
        (row.status === "pending" || (row.status === "retained" && input.releaseRetained)) &&
        lease &&
        row.time_updated >= lease.time_activated
          ? lease.id
          : undefined,
    }
  })
  if (!state) throw new Error(`Build observation cleanup owner ${id} does not exist`)
  const { row } = state
  if (row.status === "complete") return
  if (row.status === "retained" && !input.releaseRetained) return
  const ownerOccurrenceID = input.activation?.ownerOccurrenceID ?? Identifier.ascending("call")
  const leaseMilliseconds = options?.leaseMilliseconds ?? 120_000
  const acquired = input.activation
    ? {
        acquired: true as const,
        lease: Database.use((db) => assertControlLeaseInTransaction(db, {
          target: "build_cleanup",
          targetID: id,
          leaseID: input.activation!.leaseID,
          ownerOccurrenceID,
          now: Date.now(),
        })),
      }
    : acquireControlLease({
        target: "build_cleanup",
        targetID: id,
        ownerOccurrenceID,
        now: Date.now(),
        leaseMilliseconds,
        supersedeLeaseID: state.supersedeLeaseID,
      })
  if (!acquired.acquired) {
    const settled = Database.use((db) => {
      const persisted = db.select().from(EngineBuildObservationCleanupTable)
        .where(eq(EngineBuildObservationCleanupTable.observation_id, id)).get()
      return persisted ? project(db, persisted) : undefined
    })
    if (settled?.status === "complete") return
    throw new BuildObservationCleanupPendingError(
      id,
      new Error(`owned by ${acquired.lease.owner_occurrence_id} until ${acquired.lease.expires_at}`),
    )
  }
  const owner = new AbortController()
  let renewalFailure: unknown
  const renewal = setInterval(() => {
    if (renewalFailure) return
    try {
      const now = Date.now()
      ;(options?.renewLease ?? renewControlLease)({
        target: "build_cleanup",
        targetID: id,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now,
        expiresAt: now + leaseMilliseconds,
      })
    } catch (error) {
      renewalFailure = error
      owner.abort(error)
    }
  }, options?.renewalMilliseconds ?? 40_000)
  try {
    await (options?.deleteRefs ?? deleteOwnedRefs)(row, owner.signal)
    if (renewalFailure) throw renewalFailure
    Database.transaction((db) => {
      assertControlLeaseInTransaction(db, {
        target: "build_cleanup",
        targetID: id,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      db.insert(EngineBuildObservationCleanupReceiptTable).values({
        id: Identifier.deterministic("artifact", `build-cleanup-complete\0${id}`),
        observation_id: id,
        outcome: "complete",
        error: null,
        time_created: Date.now(),
      }).onConflictDoNothing().run()
    })
  } catch (cause) {
    if (renewalFailure || owner.signal.aborted) {
      throw new BuildObservationCleanupPendingError(id, renewalFailure ?? owner.signal.reason ?? cause)
    }
    Database.transaction((db) => {
      assertControlLeaseInTransaction(db, {
        target: "build_cleanup",
        targetID: id,
        leaseID: acquired.lease.id,
        ownerOccurrenceID,
        now: Date.now(),
      })
      db.insert(EngineBuildObservationCleanupReceiptTable).values({
        id: Identifier.ascending("artifact"),
        observation_id: id,
        outcome: "failed",
        error: cause instanceof Error ? cause.message : String(cause),
        time_created: Date.now(),
      }).run()
    })
    throw new BuildObservationCleanupPendingError(id, cause)
  } finally {
    clearInterval(renewal)
  }
}

export async function reconcileBuildObservationCleanups(input: { projectID: string }): Promise<number> {
  const rows = Database.use((db) =>
    db.select({ cleanup: EngineBuildObservationCleanupTable })
      .from(EngineBuildObservationCleanupTable)
      .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineBuildObservationCleanupTable.task_id))
      .where(eq(EngineTaskTable.project_id, input.projectID))
      .all(),
  )
  const now = Date.now()
  const pending = Database.use((db) => rows.map((item) => {
    const row = project(db, item.cleanup)
    const lease = currentControlLeaseInTransaction(db, "build_cleanup", row.observation_id)
    return { row, lease }
  }).filter(({ row, lease }) =>
    row.status === "pending" ||
    (row.status === "active" && (!lease || lease.expires_at <= now)),
  ).map(({ row }) => row))
  for (const row of pending) {
    try {
      await settleBuildObservationCleanup({ observationID: row.observation_id })
    } catch (error) {
      if (!(error instanceof BuildObservationCleanupPendingError)) throw error
    }
  }
  return pending.length
}

export function buildObservationCleanupRowsForTask(taskID: string): BuildObservationCleanupRow[] {
  return Database.use((db) =>
    db.select().from(EngineBuildObservationCleanupTable)
      .where(eq(EngineBuildObservationCleanupTable.task_id, taskID)).all().map((row) => project(db, row)),
  )
}
