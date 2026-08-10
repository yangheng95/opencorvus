import { createHash, randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import lockfile from "proper-lockfile"

export interface RuntimeServerOwnerInfo {
  pid: number
  database: string
  startedAt: number
  processInstanceID: string
  occurrenceID: string
}

type LiveLease = {
  info: RuntimeServerOwnerInfo
  file: string
  tombstone: string
  releaseFilesystemLock: () => void
  ownerRecordMoved: boolean
  filesystemLockReleased: boolean
  recoverable: boolean
}

const liveLeases = new Map<string, LiveLease>()
let pendingHandoff: { key: string; lease: LiveLease } | undefined
let retainedStartupCleanup:
  | {
      owner: RuntimeServerOwnerInfo
      complete(): Promise<void>
    }
  | undefined
let releaseFilesystemLockFailuresForTest = 0
let moveOwnerFileFailuresForTest = 0

function canonicalDatabasePath(database: string): string {
  const resolved = path.resolve(database)
  return process.platform === "win32" || process.platform === "darwin" ? resolved.toLowerCase() : resolved
}

function ownerFilePath(database: string): string {
  const canonical = canonicalDatabasePath(database)
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 16)
  return path.join(path.dirname(database), `.opencorvus-runtime-${digest}.owner`)
}

function handoffFilePath(database: string): string {
  return `${ownerFilePath(database)}.handoff`
}

function isOwnerInfo(value: unknown): value is RuntimeServerOwnerInfo {
  if (!value || typeof value !== "object") return false
  const input = value as Record<string, unknown>
  return (
    Number.isInteger(input.pid) &&
    Number(input.pid) > 0 &&
    typeof input.database === "string" &&
    path.isAbsolute(input.database) &&
    typeof input.startedAt === "number" &&
    Number.isFinite(input.startedAt) &&
    input.startedAt > 0 &&
    typeof input.processInstanceID === "string" &&
    input.processInstanceID.length > 0 &&
    typeof input.occurrenceID === "string" &&
    input.occurrenceID.length > 0
  )
}

export class RuntimeServerOwnershipRecordInvalidError extends Error {
  override readonly name = "RuntimeServerOwnershipRecordInvalidError"

  constructor(
    public readonly file: string,
    public readonly failure: unknown,
  ) {
    super(`Runtime server ownership record is invalid and remains authoritative: ${file}`)
  }
}

export class RuntimeServerOwnershipDatabaseMismatchError extends Error {
  override readonly name = "RuntimeServerOwnershipDatabaseMismatchError"

  constructor(
    public readonly ownedDatabase: string,
    public readonly requestedDatabase: string,
  ) {
    super(`Runtime ownership for ${ownedDatabase} cannot bind runtime database ${requestedDatabase}`)
  }
}

function readOwner(file: string): RuntimeServerOwnerInfo | undefined {
  let source: string
  try {
    source = fs.readFileSync(file, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw new RuntimeServerOwnershipRecordInvalidError(file, error)
  }
  try {
    const parsed: unknown = JSON.parse(source)
    if (!isOwnerInfo(parsed)) throw new Error("record does not match RuntimeServerOwnerInfo")
    return parsed
  } catch (error) {
    throw new RuntimeServerOwnershipRecordInvalidError(file, error)
  }
}

function readOwnerWhileLocked(file: string): RuntimeServerOwnerInfo | undefined {
  let source: string
  try {
    source = fs.readFileSync(file, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(source)
    if (!isOwnerInfo(parsed)) throw new Error("record does not match RuntimeServerOwnerInfo")
    return parsed
  } catch (error) {
    throw new RuntimeServerOwnershipRecordInvalidError(file, error)
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM"
  }
}

function processInstanceID(pid: number): string | undefined {
  try {
    if (process.platform === "linux") {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8")
      const fields = stat
        .slice(stat.lastIndexOf(")") + 2)
        .trim()
        .split(/\s+/)
      const startTicks = fields[19]
      return startTicks ? `linux:${startTicks}` : undefined
    }
    if (process.platform === "win32") {
      const executable = path.join(
        process.env.SystemRoot || process.env.WINDIR || "C:\\Windows",
        "System32",
        "WindowsPowerShell",
        "v1.0",
        "powershell.exe",
      )
      const value = execFileSync(
        executable,
        [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
        ],
        { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
      ).trim()
      return value ? `win32:${value}` : undefined
    }
    const value = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
    return value ? `${os.platform()}:${value}` : undefined
  } catch {
    return undefined
  }
}

export class RuntimeServerOwnershipConflictError extends Error {
  override readonly name = "RuntimeServerOwnershipConflictError"

  constructor(
    readonly database: string,
    readonly existing: RuntimeServerOwnerInfo | undefined,
  ) {
    super(
      existing
        ? `OpenCorvus database ${database} is owned by server runtime PID ${existing.pid}`
        : `OpenCorvus database ${database} is owned by another server runtime`,
    )
  }
}

export class RuntimeServerOwnershipHandoffPendingError extends Error {
  override readonly name = "RuntimeServerOwnershipHandoffPendingError"

  constructor(
    public readonly owner: RuntimeServerOwnerInfo,
    public readonly failure: unknown,
    private readonly completion: () => Promise<void>,
  ) {
    super(`Runtime ownership ${owner.occurrenceID} was physically released but its exact handoff cleanup is pending`)
  }

  complete(): Promise<void> {
    return this.completion()
  }
}

export class RuntimeServerStartupCleanupPendingError extends Error {
  override readonly name = "RuntimeServerStartupCleanupPendingError"

  constructor(
    public readonly owner: RuntimeServerOwnerInfo,
    private readonly completion: Promise<void>,
  ) {
    super(`Runtime startup cleanup for ownership ${owner.occurrenceID} must complete before another server can listen`)
  }

  complete(): Promise<void> {
    return this.completion
  }
}

export namespace RuntimeServerOwnership {
  export interface Handle {
    readonly database: string
    readonly owner: RuntimeServerOwnerInfo
    release(): void
    retainForRecovery(): void
  }

  export function acquire(input: { database: string; pid?: number; now?: number }): Handle {
    const database = path.resolve(input.database)
    const key = canonicalDatabasePath(database)
    const pid = input.pid ?? process.pid
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Runtime server owner PID must be positive, got ${pid}`)
    if (retainedStartupCleanup) {
      const completion = retainedStartupCleanup.complete()
      void completion.catch(() => undefined)
      throw new RuntimeServerStartupCleanupPendingError(retainedStartupCleanup.owner, completion)
    }
    if (pendingHandoff) {
      throw new RuntimeServerOwnershipConflictError(database, pendingHandoff.lease.info)
    }

    const handoffFile = handoffFilePath(database)
    const handoffOwner = readOwner(handoffFile)
    if (handoffOwner) {
      const observedInstanceID = processInstanceID(handoffOwner.pid)
      if (
        observedInstanceID === handoffOwner.processInstanceID ||
        (observedInstanceID === undefined && isProcessAlive(handoffOwner.pid))
      ) {
        throw new RuntimeServerOwnershipConflictError(database, handoffOwner)
      }
      fs.rmSync(handoffFile, { force: true })
    }

    const local = liveLeases.get(key)
    if (local) {
      throw new RuntimeServerOwnershipConflictError(database, local.info)
    }
    const otherLocal = liveLeases.values().next().value as LiveLease | undefined
    if (otherLocal) {
      throw new RuntimeServerOwnershipConflictError(database, otherLocal.info)
    }

    const file = ownerFilePath(database)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const recordedOwner = readOwner(file)
    if (recordedOwner && recordedOwner.pid !== pid) {
      const observedInstanceID = processInstanceID(recordedOwner.pid)
      if (
        observedInstanceID === recordedOwner.processInstanceID ||
        (observedInstanceID === undefined && isProcessAlive(recordedOwner.pid))
      ) {
        throw new RuntimeServerOwnershipConflictError(database, recordedOwner)
      }
    }
    let releaseFilesystemLock: () => void
    try {
      releaseFilesystemLock = lockfile.lockSync(file, { realpath: false })
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ELOCKED") {
        throw new RuntimeServerOwnershipConflictError(database, readOwner(file))
      }
      throw error
    }

    try {
      const lockedOwner = readOwnerWhileLocked(file)
      if (lockedOwner && lockedOwner.pid !== pid) {
        const observedInstanceID = processInstanceID(lockedOwner.pid)
        if (
          observedInstanceID === lockedOwner.processInstanceID ||
          (observedInstanceID === undefined && isProcessAlive(lockedOwner.pid))
        ) {
          throw new RuntimeServerOwnershipConflictError(database, lockedOwner)
        }
      }
    } catch (error) {
      releaseFilesystemLock()
      throw error
    }

    const currentProcessInstanceID = processInstanceID(pid)
    if (!currentProcessInstanceID) {
      releaseFilesystemLock()
      throw new Error(`Cannot establish runtime server process-instance identity for PID ${pid}`)
    }
    const info: RuntimeServerOwnerInfo = {
      pid,
      database,
      startedAt: input.now ?? Date.now(),
      processInstanceID: currentProcessInstanceID,
      occurrenceID: randomUUID(),
    }
    try {
      fs.writeFileSync(file, JSON.stringify(info, null, 2), "utf8")
    } catch (error) {
      releaseFilesystemLock()
      throw error
    }

    const lease: LiveLease = {
      info,
      file,
      tombstone: `${file}.${info.occurrenceID}.releasing`,
      releaseFilesystemLock,
      ownerRecordMoved: false,
      filesystemLockReleased: false,
      recoverable: false,
    }
    liveLeases.set(key, lease)
    return handleFor(key, lease)
  }

  function handleFor(key: string, lease: LiveLease): Handle {
    let released = false
    return {
      database: lease.info.database,
      owner: lease.info,
      retainForRecovery() {
        if (released && pendingHandoff?.lease === lease) {
          if (!fs.existsSync(lease.file)) fs.writeFileSync(lease.file, JSON.stringify(lease.info, null, 2), "utf8")
          lease.releaseFilesystemLock = lockfile.lockSync(lease.file, { realpath: false })
          lease.ownerRecordMoved = false
          lease.filesystemLockReleased = false
          liveLeases.set(key, lease)
          released = false
          fs.rmSync(handoffFilePath(lease.info.database), { force: true })
          pendingHandoff = undefined
        }
        if (released || liveLeases.get(key) !== lease) {
          throw new Error(`Runtime ownership ${lease.info.occurrenceID} is no longer recoverable`)
        }
        if (pendingHandoff?.lease === lease) {
          fs.rmSync(handoffFilePath(lease.info.database), { force: true })
          pendingHandoff = undefined
        }
        lease.recoverable = true
      },
      release() {
        if (released) return
        const current = liveLeases.get(key)
        if (!current || current !== lease) return
        if (!current.ownerRecordMoved) {
          const recorded = readOwnerWhileLocked(current.file)
          if (recorded?.occurrenceID !== current.info.occurrenceID) {
            throw new RuntimeServerOwnershipConflictError(current.info.database, recorded)
          }
          if (moveOwnerFileFailuresForTest > 0) {
            moveOwnerFileFailuresForTest -= 1
            throw new Error("injected runtime owner record move failure")
          }
          fs.renameSync(current.file, current.tombstone)
          current.ownerRecordMoved = true
        }
        if (!current.filesystemLockReleased) {
          if (releaseFilesystemLockFailuresForTest > 0) {
            releaseFilesystemLockFailuresForTest -= 1
            throw new Error("injected runtime filesystem lock release failure")
          }
          current.releaseFilesystemLock()
          current.filesystemLockReleased = true
        }
        try {
          fs.unlinkSync(current.tombstone)
        } catch (error) {
          // The occurrence-specific tombstone is no longer an ownership
          // authority after the filesystem lock is released. Cleanup is best
          // effort and can never delete a successor's canonical owner record.
          if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") void error
        }
        liveLeases.delete(key)
        released = true
      },
    }
  }

  /** Exact public-runtime occurrence for one canonical database path. */
  export function assertHandleForDatabase(handle: Handle, database: string): void {
    const ownedDatabase = path.resolve(handle.database)
    const requestedDatabase = path.resolve(database)
    const ownedKey = canonicalDatabasePath(ownedDatabase)
    if (ownedKey !== canonicalDatabasePath(requestedDatabase)) {
      throw new RuntimeServerOwnershipDatabaseMismatchError(ownedDatabase, requestedDatabase)
    }
    const lease = liveLeases.get(ownedKey)
    if (!lease || lease.info.occurrenceID !== handle.owner.occurrenceID) {
      throw new RuntimeServerOwnershipConflictError(requestedDatabase, lease?.info)
    }
  }

  export function currentOccurrenceID(database: string): string | undefined {
    const key = canonicalDatabasePath(path.resolve(database))
    return liveLeases.get(key)?.info.occurrenceID ?? (pendingHandoff?.key === key ? pendingHandoff.lease.info.occurrenceID : undefined)
  }

  export function recoverRetained(database: string): Handle | undefined {
    const key = canonicalDatabasePath(path.resolve(database))
    const lease = liveLeases.get(key)
    if (!lease?.recoverable) return undefined
    lease.recoverable = false
    return handleFor(key, lease)
  }

  export async function releaseWithRetry(
    handle: Handle,
    afterRelease?: () => void | Promise<void>,
    options: { attempts?: number; delayMilliseconds?: number } = {},
  ): Promise<void> {
    const attempts = options.attempts ?? 3
    const delayMilliseconds = options.delayMilliseconds ?? 25
    const handoffFile = handoffFilePath(handle.database)
    const key = canonicalDatabasePath(path.resolve(handle.database))
    if (pendingHandoff && pendingHandoff.lease.info.occurrenceID !== handle.owner.occurrenceID) {
      throw new RuntimeServerOwnershipConflictError(handle.database, pendingHandoff.lease.info)
    }
    const lease = liveLeases.get(key) ?? pendingHandoff?.lease
    if (!lease || lease.info.occurrenceID !== handle.owner.occurrenceID) {
      throw new RuntimeServerOwnershipConflictError(handle.database, lease?.info)
    }
    if (!fs.existsSync(handoffFile)) {
      fs.writeFileSync(handoffFile, JSON.stringify(handle.owner, null, 2), { encoding: "utf8", flag: "wx" })
    }
    pendingHandoff ??= { key, lease }
    let lastError: unknown
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        handle.release()
        await afterRelease?.()
        fs.rmSync(handoffFile, { force: true })
        if (pendingHandoff?.lease === lease) pendingHandoff = undefined
        return
      } catch (error) {
        lastError = error
        if (attempt < attempts) await new Promise<void>((resolve) => setTimeout(resolve, delayMilliseconds))
      }
    }
    if (lease.filesystemLockReleased && liveLeases.get(key) !== lease) {
      throw new RuntimeServerOwnershipHandoffPendingError(handle.owner, lastError, () =>
        releaseWithRetry(handle, afterRelease, options),
      )
    }
    throw lastError
  }

  export function retainStartupCleanup(input: {
    handle: Handle
    complete(): Promise<void>
  }): { complete(): Promise<void> } {
    if (retainedStartupCleanup && retainedStartupCleanup.owner.occurrenceID !== input.handle.owner.occurrenceID) {
      throw new RuntimeServerOwnershipConflictError(input.handle.database, retainedStartupCleanup.owner)
    }
    if (retainedStartupCleanup) return retainedStartupCleanup
    let operation: Promise<void> | undefined
    const authority = {
      owner: input.handle.owner,
      complete(): Promise<void> {
        if (operation) return operation
        operation = Promise.resolve()
          .then(input.complete)
          .then(
            () => {
              if (retainedStartupCleanup === authority) retainedStartupCleanup = undefined
            },
            (error) => {
              operation = undefined
              throw error
            },
          )
        return operation
      },
    }
    retainedStartupCleanup = authority
    return authority
  }

  export const TestHooks = {
    completeRetainedStartupCleanup(): Promise<void> {
      if (!retainedStartupCleanup) throw new Error("No retained runtime startup cleanup authority")
      return retainedStartupCleanup.complete()
    },
    ownerFile(database: string): string {
      return ownerFilePath(path.resolve(database))
    },
    handoffFile(database: string): string {
      return handoffFilePath(path.resolve(database))
    },
    failNextRelease(input: { filesystemLock?: number; ownerFileMove?: number }): Disposable {
      const previousLock = releaseFilesystemLockFailuresForTest
      const previousMove = moveOwnerFileFailuresForTest
      releaseFilesystemLockFailuresForTest = input.filesystemLock ?? 0
      moveOwnerFileFailuresForTest = input.ownerFileMove ?? 0
      return {
        [Symbol.dispose]() {
          releaseFilesystemLockFailuresForTest = previousLock
          moveOwnerFileFailuresForTest = previousMove
        },
      }
    },
  }
}
