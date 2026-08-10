/** Filesystem ownership evidence for task worktrees. */

import fs from "fs/promises"
import path from "path"
import { Log } from "@/util/log"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Filesystem } from "@/util/filesystem"
import { Identifier } from "@/id/id"

const log = Log.create({ service: "ownership" })

const MARKER_SUFFIX = ".ownership.json"

export namespace Ownership {
  /** On-disk marker written next to each tracked worktree. */
  export interface Marker {
    /** Owning task. Required so recovery can skip markers for tasks the
     *  operator deleted manually. */
    taskID: string
    /** Owning session. Required so overlapping task/session lifetimes
     *  can be distinguished (a restarted session has a new ID). */
    sessionID: string
    /** Absolute worktree directory. */
    cwd: string
    /** PID of the OpenCorvus process that created the worktree. */
    ownerPid: number
    /** Epoch ms when the marker was written. */
    createdAt: number
    kind: "worktree"
  }

  /** A marker plus the pieces recovery wants to act on. */
  export interface OrphanEntry {
    marker: Marker
    markerPath: string
    reason: "owner-process-dead" | "target-missing" | "marker-unparseable"
    /** Set when `kind === "worktree"` and the directory is still on disk
     *  (missing marker was the sole orphan reason). */
    worktreeDir?: string
  }

  function ownershipRoot(primaryWorktreeDir: string): string {
    return ProjectRuntimePaths.ownershipRoot(primaryWorktreeDir)
  }

  function worktreeMarkerDir(
    primaryWorktreeDir: string,
    marker: Pick<Marker, "taskID" | "sessionID">,
  ): string {
    return ProjectRuntimePaths.ownershipPaths(primaryWorktreeDir, marker.taskID, marker.sessionID).worktreeMarkerDir
  }

  function worktreeMarkerScanDirs(primaryWorktreeDir: string): string[] {
    return [ownershipRoot(primaryWorktreeDir)]
  }

  /**
   * Filesystem-safe filename for a directory path. `path.basename` alone
   * is not unique across project-root and child worktree names, so the
   * full path is hashed to hex. Collisions would silently overwrite
   * someone else's marker, which is strictly worse than a longer filename.
   */
  function sanitizeFilename(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120)
  }

  function workerMarkerFilename(worktreeDir: string, sessionID: string): string {
    // Add the last 8 chars of a simple hash for uniqueness when two
    // different absolute paths share a basename (e.g. worktrees with the
    // same branch-derived name in different project roots).
    const base = sanitizeFilename(path.basename(worktreeDir))
    let hash = 0
    for (let i = 0; i < worktreeDir.length; i++) {
      hash = (hash * 31 + worktreeDir.charCodeAt(i)) | 0
    }
    const suffix = (hash >>> 0).toString(16).padStart(8, "0").slice(-8)
    return `${base || "worktree"}-${suffix}-${Identifier.directoryKey(sessionID)}${MARKER_SUFFIX}`
  }

  /**
   * Cross-platform liveness probe.
   *
   * Node `process.kill(pid, 0)` returns true if the caller has permission
   * to signal the PID; it throws EPERM / ESRCH if it does not. EPERM
   * (permission denied) means the process exists but owned by someone
   * else — still "alive" from our perspective. ESRCH is "no such process".
   */
  export function isPidAlive(pid: number): boolean {
    if (!Number.isFinite(pid) || pid <= 0) return false
    try {
      process.kill(pid, 0)
      return true
    } catch (err: any) {
      if (err && err.code === "EPERM") return true
      return false
    }
  }

  async function ensureDir(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true })
  }

  async function writeMarker(filePath: string, marker: Marker): Promise<void> {
    await ensureDir(path.dirname(filePath))
    const body = JSON.stringify(marker, null, 2) + "\n"
    await Filesystem.writeAtomic(filePath, body, 0o600)
  }

  async function deleteMarker(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true })
  }

  async function listMarkers(dir: string): Promise<Array<{ markerPath: string; marker: Marker | undefined }>> {
    let entries: import("fs").Dirent[] = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (err: any) {
      if (err?.code === "ENOENT") return []
      log.warn("failed to list ownership dir", { dir, error: String(err) })
      return []
    }
    const out: Array<{ markerPath: string; marker: Marker | undefined }> = []
    for (const entry of entries) {
      const markerPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        out.push(...(await listMarkers(markerPath)))
        continue
      }
      if (!entry.name.endsWith(MARKER_SUFFIX)) continue
      try {
        const raw = await fs.readFile(markerPath, { encoding: "utf8" })
        const parsed = JSON.parse(raw) as Marker
        if (
          typeof parsed?.taskID === "string" &&
          typeof parsed?.sessionID === "string" &&
          typeof parsed?.cwd === "string" &&
          typeof parsed?.ownerPid === "number" &&
          parsed.kind === "worktree"
        ) {
          out.push({ markerPath, marker: parsed })
        } else {
          out.push({ markerPath, marker: undefined })
        }
      } catch {
        out.push({ markerPath, marker: undefined })
      }
    }
    return out
  }

  async function listMarkersInDirs(dirs: string[]): Promise<Array<{ markerPath: string; marker: Marker | undefined }>> {
    const out: Array<{ markerPath: string; marker: Marker | undefined }> = []
    const seen = new Set<string>()
    for (const dir of dirs) {
      for (const entry of await listMarkers(dir)) {
        if (seen.has(entry.markerPath)) continue
        seen.add(entry.markerPath)
        out.push(entry)
      }
    }
    return out
  }

  async function pathExists(target: string): Promise<boolean> {
    try {
      await fs.stat(target)
      return true
    } catch {
      return false
    }
  }

  // -------------------------------------------------------------------------
  // Worktree ownership
  // -------------------------------------------------------------------------

  export namespace Worktree {
    export interface RecordInput {
      primaryWorktreeDir: string
      worktreeDir: string
      taskID: string
      sessionID: string
      ownerPid?: number
      now?: number
    }

    export async function record(input: RecordInput): Promise<string> {
      const marker: Marker = {
        taskID: input.taskID,
        sessionID: input.sessionID,
        cwd: input.worktreeDir,
        ownerPid: input.ownerPid ?? process.pid,
        createdAt: input.now ?? Date.now(),
        kind: "worktree",
      }
      const filePath = path.join(
        worktreeMarkerDir(input.primaryWorktreeDir, marker),
        workerMarkerFilename(input.worktreeDir, input.sessionID),
      )
      await writeMarker(filePath, marker)
      return filePath
    }

    export async function releaseOwner(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      taskID: string
      sessionID: string
    }): Promise<void> {
      const target = Filesystem.normalizePath(path.resolve(input.worktreeDir))
      for (const { markerPath, marker } of await list(input.primaryWorktreeDir)) {
        if (
          marker.taskID === input.taskID &&
          marker.sessionID === input.sessionID &&
          Filesystem.normalizePath(path.resolve(marker.cwd)) === target
        ) {
          await deleteMarker(markerPath)
        }
      }
    }

    export async function releaseSessionOwner(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      sessionID: string
    }): Promise<void> {
      const target = Filesystem.normalizePath(path.resolve(input.worktreeDir))
      for (const { markerPath, marker } of await list(input.primaryWorktreeDir)) {
        if (
          marker.sessionID === input.sessionID &&
          Filesystem.normalizePath(path.resolve(marker.cwd)) === target
        ) {
          await releaseOwner({
            primaryWorktreeDir: input.primaryWorktreeDir,
            worktreeDir: marker.cwd,
            taskID: marker.taskID,
            sessionID: marker.sessionID,
          })
        }
      }
    }

    export async function releaseTaskOwners(input: { primaryWorktreeDir: string; taskID: string }): Promise<void> {
      for (const { marker } of await list(input.primaryWorktreeDir)) {
        if (marker.taskID !== input.taskID) continue
        await releaseOwner({
          primaryWorktreeDir: input.primaryWorktreeDir,
          worktreeDir: marker.cwd,
          taskID: marker.taskID,
          sessionID: marker.sessionID,
        })
      }
    }

    export async function releaseDirectoryOwners(input: {
      primaryWorktreeDir: string
      worktreeDir: string
    }): Promise<void> {
      const target = Filesystem.normalizePath(path.resolve(input.worktreeDir))
      for (const { marker } of await list(input.primaryWorktreeDir)) {
        if (Filesystem.normalizePath(path.resolve(marker.cwd)) !== target) continue
        await releaseOwner({
          primaryWorktreeDir: input.primaryWorktreeDir,
          worktreeDir: marker.cwd,
          taskID: marker.taskID,
          sessionID: marker.sessionID,
        })
      }
    }

    export async function list(primaryWorktreeDir: string): Promise<Array<{ markerPath: string; marker: Marker }>> {
      const raw = await listMarkersInDirs(worktreeMarkerScanDirs(primaryWorktreeDir))
      return raw.filter((r): r is { markerPath: string; marker: Marker } => !!r.marker && r.marker.kind === "worktree")
    }

    export async function hasLiveOwner(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      isOwnerPidAlive?: (pid: number) => boolean
      isTaskOwner?: (taskID: string) => boolean
    }): Promise<boolean> {
      const target = Filesystem.normalizePath(path.resolve(input.worktreeDir))
      const alive = input.isOwnerPidAlive ?? isPidAlive
      for (const { marker } of await list(input.primaryWorktreeDir)) {
        if (Filesystem.normalizePath(path.resolve(marker.cwd)) !== target) continue
        if (alive(marker.ownerPid) && (input.isTaskOwner?.(marker.taskID) ?? true)) return true
      }
      return false
    }

    /**
     * Enumerate worktree orphans:
     *   1. Marker present, target directory gone → stale marker → target-missing
     *   2. Marker present, owner process dead → owner-process-dead
     *   3. Marker present but unparseable → marker-unparseable
     */
    export async function orphans(input: {
      primaryWorktreeDir: string
      isPidAlive?: (pid: number) => boolean
    }): Promise<OrphanEntry[]> {
      const aliveCheck = input.isPidAlive ?? isPidAlive
      const raw = await listMarkersInDirs(worktreeMarkerScanDirs(input.primaryWorktreeDir))
      const out: OrphanEntry[] = []
      for (const { markerPath, marker } of raw) {
        if (!marker) {
          out.push({
            marker: {
              taskID: "",
              sessionID: "",
              cwd: "",
              ownerPid: 0,
              createdAt: 0,
              kind: "worktree",
            },
            markerPath,
            reason: "marker-unparseable",
          })
          continue
        }
        if (marker.kind !== "worktree") continue
        const dirExists = await pathExists(marker.cwd)
        if (!dirExists) {
          out.push({ marker, markerPath, reason: "target-missing" })
          continue
        }
        if (!aliveCheck(marker.ownerPid)) {
          out.push({
            marker,
            markerPath,
            reason: "owner-process-dead",
            worktreeDir: marker.cwd,
          })
        }
      }
      return out
    }

    export async function reconcileOrphans(input: {
      primaryWorktreeDir: string
      isPidAlive?: (pid: number) => boolean
      canReleaseDeadOwner(taskID: string): boolean
    }): Promise<{ released: number; preserved: number }> {
      const orphans = await Worktree.orphans({
        primaryWorktreeDir: input.primaryWorktreeDir,
        isPidAlive: input.isPidAlive,
      })
      let released = 0
      let preserved = 0
      for (const orphan of orphans) {
        const releasable =
          orphan.reason === "target-missing" ||
          (orphan.reason === "owner-process-dead" && input.canReleaseDeadOwner(orphan.marker.taskID))
        if (!releasable) {
          preserved += 1
          continue
        }
        await releaseOwner({
          primaryWorktreeDir: input.primaryWorktreeDir,
          worktreeDir: orphan.marker.cwd,
          taskID: orphan.marker.taskID,
          sessionID: orphan.marker.sessionID,
        })
        released += 1
      }
      return { released, preserved }
    }
  }
}
