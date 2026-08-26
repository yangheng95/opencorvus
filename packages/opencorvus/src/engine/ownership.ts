/** Filesystem ownership evidence for task worktrees. */

import fs from "fs/promises"
import {
  currentRuntimeProcessOccurrence,
  observedProcessOccurrence,
  observeRuntimeProcessOccurrence,
} from "@/runtime/process-occurrence"
import path from "path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Filesystem } from "@/util/filesystem"
import { Identifier } from "@/id/id"

const MARKER_SUFFIX = ".ownership.json"

export namespace Ownership {
  export interface Marker {
    taskID: string
    sessionID: string
    cwd: string
    ownerPid: number
    /** The owner's process-instance fingerprint. A PID alone is reused by the
     *  operating system, so a marker identified only by its number keeps a
     *  dead owner "alive" and its worktree unreleasable forever. Absent only
     *  for markers written before this fact existed, or on a platform that
     *  cannot fingerprint a process. */
    ownerProcessInstanceID?: string
    createdAt: number
    kind: "worktree"
  }

  export type ObservationIssue = {
    status: "invalid" | "unobservable"
    error: InstanceType<typeof Worktree.ObservationError>
  }

  export type SnapshotIntegrity =
    | { status: "complete" }
    | { status: "invalid" | "unobservable"; errors: InstanceType<typeof Worktree.ObservationError>[] }

  export type SnapshotEntry =
    | { status: "valid"; markerPath: string; marker: Marker }
    | {
        status: "invalid"
        markerPath: string
        taskID?: string
        sessionID?: string
        reason: string
      }

  export type Snapshot = { entries: SnapshotEntry[]; issues: ObservationIssue[]; integrity: SnapshotIntegrity }

  export interface OrphanEntry {
    taskID?: string
    sessionID?: string
    worktreeDir?: string
    reason: "owner-process-dead" | "target-missing" | "marker-invalid"
  }

  export type ReleaseReceipt = {
    released: Array<{ taskID: string; sessionID: string; worktreeDir: string }>
    integrity: SnapshotIntegrity
  }

  export type PidObservation =
    | { status: "alive" }
    | { status: "dead" }
    | { status: "unobservable"; cause: unknown }

  export type ObservationDiagnostic = {
    diagnosticPath: string
  }

  export type ObservationFailure = InstanceType<typeof Worktree.ObservationError> & ObservationDiagnostic

  function errno(error: unknown): string {
    if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code
    return "UNKNOWN"
  }

  function observationError(input: {
    operation: string
    code: string
    scope?: string
    diagnosticPath: string
    cause?: unknown
    message?: string
  }): ObservationFailure {
    const error = new Worktree.ObservationError(
      {
        operation: input.operation,
        code: input.code,
        scope: input.scope ?? "worktree-ownership",
        message: input.message ?? "Worktree ownership could not be observed safely",
      },
      input.cause === undefined ? undefined : { cause: input.cause },
    ) as ObservationFailure
    error.diagnosticPath = path.resolve(input.diagnosticPath)
    return error
  }

  export function isObservationFailure(error: unknown): error is ObservationFailure {
    return (
      Worktree.ObservationError.isInstance(error) &&
      "diagnosticPath" in error &&
      typeof error.diagnosticPath === "string"
    )
  }

  export function observationFailure(input: {
    operation: string
    code: string
    scope?: string
    diagnosticPath: string
    cause?: unknown
    message?: string
  }): ObservationFailure {
    return observationError(input)
  }

  function invalidIntegrity(input: {
    operation: string
    diagnosticPath: string
    reason: string
  }): ObservationIssue {
    return {
      status: "invalid",
      error: observationError({
        operation: input.operation,
        code: "INVALID_AUTHORITY",
        diagnosticPath: input.diagnosticPath,
        message: "Worktree ownership authority is invalid",
        cause: new Error(input.reason),
      }),
    }
  }

  function unobservableIntegrity(input: {
    operation: string
    diagnosticPath: string
    cause: unknown
  }): ObservationIssue {
    return {
      status: "unobservable",
      error: observationError({
        operation: input.operation,
        code: errno(input.cause),
        diagnosticPath: input.diagnosticPath,
        cause: input.cause,
      }),
    }
  }

  function worktreeMarkerDir(primaryWorktreeDir: string, marker: Pick<Marker, "taskID" | "sessionID">): string {
    return ProjectRuntimePaths.ownershipPaths(primaryWorktreeDir, marker.taskID, marker.sessionID).worktreeMarkerDir
  }

  function sanitizeFilename(input: string): string {
    return input
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 120)
  }

  function workerMarkerFilename(worktreeDir: string, sessionID: string): string {
    const base = sanitizeFilename(path.basename(worktreeDir))
    let hash = 0
    for (let i = 0; i < worktreeDir.length; i++) hash = (hash * 31 + worktreeDir.charCodeAt(i)) | 0
    const suffix = (hash >>> 0).toString(16).padStart(8, "0").slice(-8)
    return `${base || "worktree"}-${suffix}-${Identifier.directoryKey(sessionID)}${MARKER_SUFFIX}`
  }

  export function observePid(pid: number, probe: (pid: number) => void = (value) => process.kill(value, 0)): PidObservation {
    if (!Number.isInteger(pid) || pid <= 0) {
      return { status: "unobservable", cause: new Error(`Invalid ownership PID: ${pid}`) }
    }
    try {
      probe(pid)
      return { status: "alive" }
    } catch (error) {
      const code = errno(error)
      if (code === "EPERM") return { status: "alive" }
      if (code === "ESRCH") return { status: "dead" }
      return { status: "unobservable", cause: error }
    }
  }

  /**
   * Observe the owner OCCURRENCE a marker names.
   *
   * A process number is not an identity: once the owner dies and the operating
   * system hands its number to something unrelated, a number-only probe answers
   * "alive" forever and the worktree it guards can never be released. When the
   * marker carries the owner's fingerprint, a mismatch is as terminal as an
   * exit. A marker without one — written before this fact existed, or on a
   * platform that cannot fingerprint — keeps the weaker number-only answer
   * rather than a fabricated identity.
   */
  export function observeOwner(
    marker: { ownerPid: number; ownerProcessInstanceID?: string },
    probe?: (pid: number) => void,
  ): PidObservation {
    if (!marker.ownerProcessInstanceID) return observePid(marker.ownerPid, probe)
    const observation = observeRuntimeProcessOccurrence({
      pid: marker.ownerPid,
      processInstanceID: marker.ownerProcessInstanceID,
      occurrenceID: "",
    })
    if (observation === "exact_live") return { status: "alive" }
    if (observation === "dead_or_reused") return { status: "dead" }
    return observePid(marker.ownerPid, probe)
  }

  async function writeMarker(filePath: string, marker: Marker): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await Filesystem.writeAtomic(filePath, JSON.stringify(marker, null, 2) + "\n", 0o600)
  }

  async function deleteMarker(filePath: string): Promise<void> {
    await fs.rm(filePath, { force: true })
  }

  async function readDirectory(
    directory: string,
    operation: string,
    root: boolean,
  ): Promise<{ entries?: import("fs").Dirent[]; issue?: ObservationIssue }> {
    try {
      return { entries: await fs.readdir(directory, { withFileTypes: true }) }
    } catch (error) {
      if (root && errno(error) === "ENOENT") return { entries: [] }
      return { issue: unobservableIntegrity({ operation, diagnosticPath: directory, cause: error }) }
    }
  }

  function exactDirectory(entries: import("fs").Dirent[], name: string, directory: string): ObservationIssue | undefined {
    const entry = entries.find((candidate) => candidate.name === name)
    if (!entry) return
    if (entry.isDirectory() && !entry.isSymbolicLink()) return
    return invalidIntegrity({
      operation: "scan-authority",
      diagnosticPath: path.join(directory, name),
      reason: `${name} is not a canonical directory`,
    })
  }

  function snapshotIntegrity(issues: ObservationIssue[]): SnapshotIntegrity {
    if (issues.length === 0) return { status: "complete" }
    const status = issues.some((issue) => issue.status === "unobservable") ? "unobservable" : "invalid"
    return { status, errors: issues.map((issue) => issue.error) }
  }

  function parseMarker(
    raw: string,
    markerPath: string,
    taskID: string,
    sessionID: string,
  ): { marker?: Marker; reason?: string } {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (error) {
      return { reason: `invalid JSON: ${error instanceof Error ? error.message : String(error)}` }
    }
    if (!parsed || typeof parsed !== "object") return { reason: "marker is not an object" }
    const marker = parsed as Partial<Marker>
    if (!Identifier.isCanonical("task", marker.taskID ?? "")) return { reason: "invalid task identity" }
    if (!Identifier.isCanonical("session", marker.sessionID ?? "")) return { reason: "invalid session identity" }
    if (marker.taskID !== taskID || marker.sessionID !== sessionID) return { reason: "path/content identity mismatch" }
    if (typeof marker.cwd !== "string" || !path.isAbsolute(marker.cwd)) return { reason: "cwd is not absolute" }
    if (!Number.isInteger(marker.ownerPid) || marker.ownerPid! <= 0) return { reason: "ownerPid is not positive" }
    if (!Number.isFinite(marker.createdAt) || marker.createdAt! < 0) return { reason: "createdAt is invalid" }
    if (marker.kind !== "worktree") return { reason: "kind is invalid" }
    return { marker: marker as Marker }
  }

  async function ownershipSnapshot(primaryWorktreeDir: string): Promise<Snapshot> {
    const entries: SnapshotEntry[] = []
    const issues: ObservationIssue[] = []
    const tasksRoot = ProjectRuntimePaths.taskCollectionRoot(primaryWorktreeDir)
    const tasks = await readDirectory(tasksRoot, "list-tasks", true)
    if (tasks.issue) issues.push(tasks.issue)
    if (!tasks.entries) return { entries, issues, integrity: snapshotIntegrity(issues) }
    for (const taskEntry of tasks.entries!) {
      if (!Identifier.isCanonical("task", taskEntry.name)) continue
      if (!taskEntry.isDirectory() || taskEntry.isSymbolicLink()) {
        issues.push(
          invalidIntegrity({
            operation: "scan-task-authority",
            diagnosticPath: path.join(tasksRoot, taskEntry.name),
            reason: "canonical Task authority is not a regular directory",
          }),
        )
        continue
      }
      const taskRoot = path.join(tasksRoot, taskEntry.name)
      const taskChildren = await readDirectory(taskRoot, "list-task", false)
      if (taskChildren.issue) issues.push(taskChildren.issue)
      if (!taskChildren.entries) continue
      const sessionsIntegrity = exactDirectory(taskChildren.entries!, "sessions", taskRoot)
      if (sessionsIntegrity) {
        issues.push(sessionsIntegrity)
        continue
      }
      if (!taskChildren.entries!.some((entry) => entry.name === "sessions")) continue
      const sessionsRoot = path.join(taskRoot, "sessions")
      const sessions = await readDirectory(sessionsRoot, "list-sessions", false)
      if (sessions.issue) issues.push(sessions.issue)
      if (!sessions.entries) continue
      for (const sessionEntry of sessions.entries!) {
        if (!Identifier.isCanonical("session", sessionEntry.name)) continue
        if (!sessionEntry.isDirectory() || sessionEntry.isSymbolicLink()) {
          issues.push(
            invalidIntegrity({
              operation: "scan-session-authority",
              diagnosticPath: path.join(sessionsRoot, sessionEntry.name),
              reason: "canonical Session authority is not a regular directory",
            }),
          )
          continue
        }
        const sessionRoot = path.join(sessionsRoot, sessionEntry.name)
        const sessionChildren = await readDirectory(sessionRoot, "list-session", false)
        if (sessionChildren.issue) issues.push(sessionChildren.issue)
        if (!sessionChildren.entries) continue
        const ownershipIntegrity = exactDirectory(sessionChildren.entries!, "ownership", sessionRoot)
        if (ownershipIntegrity) {
          issues.push(ownershipIntegrity)
          continue
        }
        if (!sessionChildren.entries!.some((entry) => entry.name === "ownership")) continue
        const ownershipDir = path.join(sessionRoot, "ownership")
        const ownershipChildren = await readDirectory(ownershipDir, "list-ownership", false)
        if (ownershipChildren.issue) issues.push(ownershipChildren.issue)
        if (!ownershipChildren.entries) continue
        const worktreesIntegrity = exactDirectory(ownershipChildren.entries!, "worktrees", ownershipDir)
        if (worktreesIntegrity) {
          issues.push(worktreesIntegrity)
          continue
        }
        if (!ownershipChildren.entries!.some((entry) => entry.name === "worktrees")) continue
        const worktreesDir = path.join(ownershipDir, "worktrees")
        const markers = await readDirectory(worktreesDir, "list-worktree-markers", false)
        if (markers.issue) issues.push(markers.issue)
        if (!markers.entries) continue
        for (const markerEntry of markers.entries!) {
          if (!markerEntry.name.endsWith(MARKER_SUFFIX)) continue
          const markerPath = path.join(worktreesDir, markerEntry.name)
          if (!markerEntry.isFile() || markerEntry.isSymbolicLink()) {
            const reason = "ownership marker is not a regular file"
            entries.push({
              status: "invalid",
              markerPath,
              taskID: taskEntry.name,
              sessionID: sessionEntry.name,
              reason,
            })
            issues.push(invalidIntegrity({ operation: "scan-marker-authority", diagnosticPath: markerPath, reason }))
            continue
          }
          let raw: string
          try {
            raw = await fs.readFile(markerPath, "utf8")
          } catch (error) {
            issues.push(unobservableIntegrity({ operation: "read-marker", diagnosticPath: markerPath, cause: error }))
            continue
          }
          const parsed = parseMarker(raw, markerPath, taskEntry.name, sessionEntry.name)
          if (!parsed.marker) {
            entries.push({
              status: "invalid",
              markerPath,
              taskID: taskEntry.name,
              sessionID: sessionEntry.name,
              reason: parsed.reason ?? "invalid marker",
            })
            issues.push(
              invalidIntegrity({
                operation: "parse-marker",
                diagnosticPath: markerPath,
                reason: parsed.reason ?? "invalid marker",
              }),
            )
            continue
          }
          entries.push({ status: "valid", markerPath, marker: parsed.marker })
        }
      }
    }
    return { entries, issues, integrity: snapshotIntegrity(issues) }
  }

  export type StrictIdentity = { status: "present" | "missing"; key: string; requested: string }

  async function strictIdentity(target: string, operation: string): Promise<StrictIdentity> {
    const requested = path.resolve(target)
    let present = true
    try {
      await fs.lstat(requested)
    } catch (error) {
      if (errno(error) !== "ENOENT") {
        throw observationError({ operation, code: errno(error), diagnosticPath: requested, cause: error })
      }
      present = false
    }
    if (present) {
      try {
        const real = path.normalize(await fs.realpath(requested))
        return { status: "present", key: process.platform === "win32" ? real.toLowerCase() : real, requested }
      } catch (error) {
        throw observationError({ operation, code: errno(error), diagnosticPath: requested, cause: error })
      }
    }
    const parent = path.dirname(requested)
    try {
      const realParent = path.normalize(await fs.realpath(parent))
      const key = path.join(realParent, path.basename(requested))
      return { status: "missing", key: process.platform === "win32" ? key.toLowerCase() : key, requested }
    } catch (error) {
      throw observationError({ operation, code: errno(error), diagnosticPath: requested, cause: error })
    }
  }

  async function sameWorktree(left: string, right: string, operation: string): Promise<boolean> {
    const [a, b] = await Promise.all([strictIdentity(left, operation), strictIdentity(right, operation)])
    // A present directory and an absent path cannot be the same physical
    // worktree at observation time, so status divergence answers the
    // comparison; treating it as an observation failure would let one stale
    // owner marker fail every release and proof in the project.
    if (a.status !== b.status) return false
    return a.key === b.key
  }

  async function releaseFromSnapshot(
    snapshot: Snapshot,
    predicate: (marker: Marker) => boolean | Promise<boolean>,
  ): Promise<ReleaseReceipt> {
    const released: ReleaseReceipt["released"] = []
    const failures: ObservationIssue[] = []
    for (const entry of snapshot.entries) {
      if (entry.status !== "valid") continue
      let matches = false
      try {
        matches = await predicate(entry.marker)
      } catch (error) {
        if (Worktree.ObservationError.isInstance(error)) {
          snapshot.issues.push({ status: "unobservable", error })
          snapshot.integrity = snapshotIntegrity(snapshot.issues)
          continue
        }
        throw error
      }
      if (!matches) continue
      try {
        await deleteMarker(entry.markerPath)
        released.push({
          taskID: entry.marker.taskID,
          sessionID: entry.marker.sessionID,
          worktreeDir: entry.marker.cwd,
        })
      } catch (error) {
        failures.push(
          unobservableIntegrity({ operation: "release-observed-owner", diagnosticPath: entry.markerPath, cause: error }),
        )
      }
    }
    return { released, integrity: snapshotIntegrity([...snapshot.issues, ...failures]) }
  }

  export namespace Worktree {
    export const ObservationError = NamedError.create(
      "WorktreeOwnershipObservationError",
      z.object({
        operation: z.string(),
        code: z.string(),
        scope: z.string(),
        message: z.string(),
      }),
    )

    export interface RecordInput {
      primaryWorktreeDir: string
      worktreeDir: string
      taskID: string
      sessionID: string
      ownerPid?: number
      ownerProcessInstanceID?: string
      now?: number
    }

    export async function record(input: RecordInput): Promise<string> {
      const marker: Marker = {
        taskID: input.taskID,
        sessionID: input.sessionID,
        cwd: path.resolve(input.worktreeDir),
        ownerPid: input.ownerPid ?? process.pid,
        ownerProcessInstanceID:
          input.ownerProcessInstanceID ??
          (input.ownerPid === undefined || input.ownerPid === process.pid
            ? currentRuntimeProcessOccurrence().processInstanceID
            : observedProcessOccurrence(input.ownerPid)?.processInstanceID),
        createdAt: input.now ?? Date.now(),
        kind: "worktree",
      }
      const parsed = parseMarker(JSON.stringify(marker), "record", marker.taskID, marker.sessionID)
      if (!parsed.marker) throw new Error(`Invalid worktree ownership marker: ${parsed.reason}`)
      const filePath = path.join(
        worktreeMarkerDir(input.primaryWorktreeDir, marker),
        workerMarkerFilename(marker.cwd, input.sessionID),
      )
      await writeMarker(filePath, marker)
      return filePath
    }

    export async function snapshot(primaryWorktreeDir: string): Promise<Snapshot> {
      return ownershipSnapshot(primaryWorktreeDir)
    }

    export async function observeIdentity(target: string, operation: string): Promise<StrictIdentity> {
      return strictIdentity(target, operation)
    }

    export async function compareIdentity(
      left: StrictIdentity,
      rightPath: string,
      operation: string,
    ): Promise<"same" | "different"> {
      const right = await strictIdentity(rightPath, operation)
      // Status divergence is a difference, not an uncertainty: a candidate
      // path that vanished (or appeared) since the left identity was captured
      // is not the same living worktree, and a fatal error here would block
      // an unrelated removal on any stale registration.
      if (left.status !== right.status) return "different"
      return left.key === right.key ? "same" : "different"
    }

    export async function list(primaryWorktreeDir: string): Promise<Snapshot> {
      return ownershipSnapshot(primaryWorktreeDir)
    }

    export function requireCompleteRelease(receipt: ReleaseReceipt): ReleaseReceipt {
      if (receipt.integrity.status === "complete") return receipt
      if (receipt.integrity.errors.length === 1) throw receipt.integrity.errors[0]
      throw new AggregateError(receipt.integrity.errors, "Worktree ownership release was only partially observed")
    }

    export async function releaseOwner(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      taskID: string
      sessionID: string
    }): Promise<ReleaseReceipt> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      return releaseFromSnapshot(
        snapshot,
        async (marker) =>
          marker.taskID === input.taskID &&
          marker.sessionID === input.sessionID &&
          (await sameWorktree(marker.cwd, input.worktreeDir, "compare-release-owner")),
      )
    }

    export async function releaseSessionOwner(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      sessionID: string
    }): Promise<ReleaseReceipt> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      return releaseFromSnapshot(
        snapshot,
        async (marker) =>
          marker.sessionID === input.sessionID &&
          (await sameWorktree(marker.cwd, input.worktreeDir, "compare-release-session-owner")),
      )
    }

    export async function releaseTaskOwners(input: {
      primaryWorktreeDir: string
      taskID: string
    }): Promise<ReleaseReceipt> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      return releaseFromSnapshot(snapshot, (marker) => marker.taskID === input.taskID)
    }

    export async function releaseDirectoryOwners(input: {
      primaryWorktreeDir: string
      worktreeDir: string
    }): Promise<ReleaseReceipt> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      return releaseFromSnapshot(snapshot, (marker) =>
        sameWorktree(marker.cwd, input.worktreeDir, "compare-release-directory-owner"),
      )
    }

    export type OwnerProof =
      | { status: "owned"; marker: Pick<Marker, "taskID" | "sessionID" | "cwd"> }
      | {
          status: "ownerless"
          snapshot: Snapshot & { integrity: { status: "complete" } }
          releasableMarkers: Array<{
            markerPath: string
            taskID: string
            sessionID: string
            worktreeDir: string
          }>
        }

    export async function proveOwnerless(input: {
      primaryWorktreeDir: string
      worktreeDir: string
      observeOwnerPid?: (pid: number) => PidObservation
      canReleaseDeadOwner?: (taskID: string) => boolean
    }): Promise<OwnerProof> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      if (snapshot.integrity.status !== "complete") throw snapshot.integrity.errors[0]
      const releasableMarkers: Extract<OwnerProof, { status: "ownerless" }>["releasableMarkers"] = []
      for (const entry of snapshot.entries) {
        if (
          entry.status !== "valid" ||
          !(await sameWorktree(entry.marker.cwd, input.worktreeDir, "compare-owner-proof"))
        )
          continue
        const pid = (input.observeOwnerPid ? input.observeOwnerPid(entry.marker.ownerPid) : observeOwner(entry.marker))
        if (pid.status === "unobservable") {
          throw observationError({
            operation: "observe-owner-process",
            code: errno(pid.cause),
            diagnosticPath: entry.markerPath,
            cause: pid.cause,
          })
        }
        if (pid.status === "alive" || !(input.canReleaseDeadOwner?.(entry.marker.taskID) ?? false)) {
          return {
            status: "owned",
            marker: { taskID: entry.marker.taskID, sessionID: entry.marker.sessionID, cwd: entry.marker.cwd },
          }
        }
        releasableMarkers.push({
          markerPath: entry.markerPath,
          taskID: entry.marker.taskID,
          sessionID: entry.marker.sessionID,
          worktreeDir: entry.marker.cwd,
        })
      }
      return {
        status: "ownerless",
        snapshot: snapshot as Snapshot & { integrity: { status: "complete" } },
        releasableMarkers,
      }
    }

    export async function settleOwnerlessProof(
      proof: Extract<OwnerProof, { status: "ownerless" }>,
    ): Promise<ReleaseReceipt> {
      const released: ReleaseReceipt["released"] = []
      const failures: ObservationIssue[] = []
      for (const marker of proof.releasableMarkers) {
        try {
          await deleteMarker(marker.markerPath)
          released.push({
            taskID: marker.taskID,
            sessionID: marker.sessionID,
            worktreeDir: marker.worktreeDir,
          })
        } catch (error) {
          failures.push(
            unobservableIntegrity({ operation: "release-proven-owner", diagnosticPath: marker.markerPath, cause: error }),
          )
        }
      }
      return { released, integrity: snapshotIntegrity(failures) }
    }

    async function targetStatus(target: string): Promise<"present" | "missing"> {
      try {
        const namespace = await fs.lstat(target)
        if (namespace.isSymbolicLink()) {
          try {
            await fs.realpath(target)
          } catch (error) {
            throw observationError({
              operation: "resolve-owner-target",
              code: errno(error),
              diagnosticPath: target,
              cause: error,
            })
          }
        }
        return "present"
      } catch (error) {
        if (Worktree.ObservationError.isInstance(error)) throw error
        if (errno(error) === "ENOENT") return "missing"
        throw observationError({ operation: "stat-owner-target", code: errno(error), diagnosticPath: target, cause: error })
      }
    }

    export async function orphans(input: {
      primaryWorktreeDir: string
      observeOwnerPid?: (pid: number) => PidObservation
    }): Promise<OrphanEntry[]> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      if (snapshot.integrity.status === "unobservable") throw snapshot.integrity.errors[0]
      const out: OrphanEntry[] = snapshot.entries
        .filter((entry): entry is Extract<SnapshotEntry, { status: "invalid" }> => entry.status === "invalid")
        .map((entry) => ({ taskID: entry.taskID, sessionID: entry.sessionID, reason: "marker-invalid" as const }))
      for (const entry of snapshot.entries) {
        if (entry.status !== "valid") continue
        if ((await targetStatus(entry.marker.cwd)) === "missing") {
          out.push({
            taskID: entry.marker.taskID,
            sessionID: entry.marker.sessionID,
            worktreeDir: entry.marker.cwd,
            reason: "target-missing",
          })
          continue
        }
        const pid = (input.observeOwnerPid ? input.observeOwnerPid(entry.marker.ownerPid) : observeOwner(entry.marker))
        if (pid.status === "unobservable") {
          throw observationError({
            operation: "observe-owner-process",
            code: errno(pid.cause),
            diagnosticPath: entry.markerPath,
            cause: pid.cause,
          })
        }
        if (pid.status === "dead") {
          out.push({
            taskID: entry.marker.taskID,
            sessionID: entry.marker.sessionID,
            worktreeDir: entry.marker.cwd,
            reason: "owner-process-dead",
          })
        }
      }
      return out
    }

    export type ReconcileReceipt = { released: number; preserved: number; integrity: SnapshotIntegrity }

    export async function reconcileOrphans(input: {
      primaryWorktreeDir: string
      observeOwnerPid?: (pid: number) => PidObservation
      canReleaseDeadOwner(taskID: string): boolean
    }): Promise<ReconcileReceipt> {
      const snapshot = await ownershipSnapshot(input.primaryWorktreeDir)
      if (snapshot.integrity.status === "unobservable") {
        return { released: 0, preserved: snapshot.entries.length, integrity: snapshot.integrity }
      }
      let released = 0
      let preserved = snapshot.entries.filter((entry) => entry.status === "invalid").length
      for (const entry of snapshot.entries) {
        if (entry.status !== "valid") continue
        let releasable = (await targetStatus(entry.marker.cwd)) === "missing"
        if (!releasable) {
          const pid = (input.observeOwnerPid ? input.observeOwnerPid(entry.marker.ownerPid) : observeOwner(entry.marker))
          if (pid.status === "unobservable") {
            const issue = unobservableIntegrity({
              operation: "observe-owner-process",
              diagnosticPath: entry.markerPath,
              cause: pid.cause,
            })
            return {
              released,
              preserved: preserved + 1,
              integrity: snapshotIntegrity([...snapshot.issues, issue]),
            }
          }
          releasable = pid.status === "dead" && input.canReleaseDeadOwner(entry.marker.taskID)
        }
        if (!releasable) {
          preserved++
          continue
        }
        try {
          await deleteMarker(entry.markerPath)
          released++
        } catch (error) {
          const issue = unobservableIntegrity({
            operation: "release-reconciled-owner",
            diagnosticPath: entry.markerPath,
            cause: error,
          })
          return {
            released,
            preserved: preserved + 1,
            integrity: snapshotIntegrity([...snapshot.issues, issue]),
          }
        }
      }
      return { released, preserved, integrity: snapshot.integrity }
    }
  }
}
