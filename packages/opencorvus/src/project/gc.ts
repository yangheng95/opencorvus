import fs from "fs/promises"
import path from "path"
import { Database } from "../storage/db"
import { ProjectTable } from "./project.sql"
import { Log } from "../util/log"
import { Scheduler } from "../scheduler"
import { ProjectRuntimePaths } from "./runtime-paths"

/**
 * Project-scoped garbage collection.
 *
 * Snapshot / session_diff are agent-only caches (not user version history),
 * so orphan entries are safe to drop. Project rows and their Tasks are user
 * data and are never garbage-collected by age. The policy is:
 *
 *   - Orphan directories under each project's runtime cache (no
 *     matching project row) → removed directly. They cannot correspond to
 *     anything the user can open, so keeping them is waste.
 *   - After any removal, `wal_checkpoint(TRUNCATE)` + `VACUUM` so the DB
 *     file actually shrinks.
 *
 * This keeps disposable cache collection separate from explicit user-owned
 * Project destruction and its Task/session settlement protocol.
 */
export namespace ProjectGC {
  const log = Log.create({ service: "project.gc" })
  const GC_INTERVAL_MS = 6 * 60 * 60 * 1000
  export type Plan = {
    orphanSnapshots: string[]
    orphanSessionDiffs: string[]
  }

  export type ApplyResult = {
    removedSnapshotDirs: number
    removedSessionDiffDirs: number
    vacuumed: boolean
  }

  export function init() {
    Scheduler.register({
      id: "project.gc",
      interval: GC_INTERVAL_MS,
      runAtStart: true,
      run: async (signal) => {
        const plan = await inspect(signal)
        signal.throwIfAborted()
        const total = plan.orphanSnapshots.length + plan.orphanSessionDiffs.length
        if (total === 0) return
        await apply(plan, signal)
      },
    })
  }

  export async function inspect(signal?: AbortSignal): Promise<Plan> {
    signal?.throwIfAborted()
    const rows = Database.use((db) =>
      db
        .select({
          id: ProjectTable.id,
          worktree: ProjectTable.worktree,
        })
        .from(ProjectTable)
        .all(),
    )
    const activeIds = new Set(rows.map((r) => r.id))

    const [orphanSnapshots, orphanSessionDiffs] = await Promise.all([
      listOrphansForRows(rows, "snapshot", activeIds, signal),
      listOrphansForRows(rows, "session_diff", activeIds, signal),
    ])
    signal?.throwIfAborted()

    return { orphanSnapshots, orphanSessionDiffs }
  }

  export async function apply(plan: Plan, signal?: AbortSignal): Promise<ApplyResult> {
    const removedSnapshotDirs = await removeDirs(dedup(plan.orphanSnapshots), signal)
    const removedSessionDiffDirs = await removeDirs(dedup(plan.orphanSessionDiffs), signal)
    signal?.throwIfAborted()

    const totalWork = removedSnapshotDirs + removedSessionDiffDirs
    let vacuumed = false
    if (totalWork > 0) {
      try {
        Database.checkpointTruncate()
        Database.vacuum()
        vacuumed = true
      } catch (err) {
        log.warn("vacuum failed", { error: err instanceof Error ? err.message : String(err) })
      }
      log.info("applied", {
        removedSnapshotDirs,
        removedSessionDiffDirs,
        vacuumed,
      })
    }

    return { removedSnapshotDirs, removedSessionDiffDirs, vacuumed }
  }

  function cacheRoot(worktree: string, kind: "snapshot" | "session_diff") {
    return kind === "snapshot"
      ? path.dirname(ProjectRuntimePaths.snapshotCacheRoot(worktree, "placeholder"))
      : path.dirname(ProjectRuntimePaths.sessionDiffRoot(worktree, "placeholder"))
  }

  async function listOrphansForRows(
    rows: Array<{ worktree: string }>,
    kind: "snapshot" | "session_diff",
    active: Set<string>,
    signal?: AbortSignal,
  ): Promise<string[]> {
    signal?.throwIfAborted()
    const roots = dedup(rows.map((row) => cacheRoot(row.worktree, kind)))
    const nested = await Promise.all(roots.map((root) => listOrphans(root, active, signal)))
    return dedup(nested.flat())
  }

  async function listOrphans(root: string, active: Set<string>, signal?: AbortSignal): Promise<string[]> {
    signal?.throwIfAborted()
    const entries = await fs.readdir(root, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return [] as import("fs").Dirent[]
      throw err
    })
    const out: string[] = []
    for (const entry of entries) {
      signal?.throwIfAborted()
      if (!entry.isDirectory()) continue
      if (active.has(entry.name)) continue
      out.push(path.join(root, entry.name))
    }
    return out
  }

  async function removeDirs(targets: string[], signal?: AbortSignal): Promise<number> {
    let removed = 0
    for (const target of targets) {
      signal?.throwIfAborted()
      try {
        await fs.rm(target, { recursive: true, force: true })
        signal?.throwIfAborted()
        removed++
      } catch (err) {
        log.warn("remove failed", {
          path: target,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    return removed
  }

  function dedup(items: string[]): string[] {
    return [...new Set(items)]
  }
}
