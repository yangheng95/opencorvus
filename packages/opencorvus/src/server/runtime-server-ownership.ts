import { createHash } from "node:crypto"
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
}

type LiveLease = {
  info: RuntimeServerOwnerInfo
  file: string
  releaseFilesystemLock: () => void
}

const liveLeases = new Map<string, LiveLease>()

function canonicalDatabasePath(database: string): string {
  const resolved = path.resolve(database)
  return process.platform === "win32" || process.platform === "darwin" ? resolved.toLowerCase() : resolved
}

function ownerFilePath(database: string): string {
  const canonical = canonicalDatabasePath(database)
  const digest = createHash("sha256").update(canonical).digest("hex").slice(0, 16)
  return path.join(path.dirname(database), `.opencorvus-runtime-${digest}.owner`)
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
    input.processInstanceID.length > 0
  )
}

function readOwner(file: string): RuntimeServerOwnerInfo | undefined {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"))
    return isOwnerInfo(parsed) ? parsed : undefined
  } catch {
    return undefined
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

export namespace RuntimeServerOwnership {
  export interface Handle {
    readonly database: string
    readonly owner: RuntimeServerOwnerInfo
    release(): void
  }

  export function acquire(input: { database: string; pid?: number; now?: number }): Handle {
    const database = path.resolve(input.database)
    const key = canonicalDatabasePath(database)
    const pid = input.pid ?? process.pid
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`Runtime server owner PID must be positive, got ${pid}`)

    const local = liveLeases.get(key)
    if (local) {
      throw new RuntimeServerOwnershipConflictError(database, local.info)
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
    }
    try {
      fs.writeFileSync(file, JSON.stringify(info, null, 2), "utf8")
    } catch (error) {
      releaseFilesystemLock()
      throw error
    }

    const lease: LiveLease = { info, file, releaseFilesystemLock }
    liveLeases.set(key, lease)
    return handleFor(key, lease)
  }

  function handleFor(key: string, lease: LiveLease): Handle {
    let released = false
    return {
      database: lease.info.database,
      owner: lease.info,
      release() {
        if (released) return
        released = true
        const current = liveLeases.get(key)
        if (!current || current !== lease) return
        liveLeases.delete(key)
        try {
          const recorded = readOwner(current.file)
          if (recorded?.pid === current.info.pid) fs.unlinkSync(current.file)
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error
        } finally {
          current.releaseFilesystemLock()
        }
      },
    }
  }
}
