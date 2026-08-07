import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import lockfile from "proper-lockfile"

export interface RuntimeServerOwnerInfo {
  pid: number
  database: string
  startedAt: number
}

type LiveLease = {
  info: RuntimeServerOwnerInfo
  references: number
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
    input.startedAt > 0
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
      if (local.info.pid !== pid) throw new RuntimeServerOwnershipConflictError(database, local.info)
      local.references += 1
      return handleFor(key, local)
    }

    const file = ownerFilePath(database)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    let releaseFilesystemLock: () => void
    try {
      releaseFilesystemLock = lockfile.lockSync(file, { realpath: false })
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ELOCKED") {
        throw new RuntimeServerOwnershipConflictError(database, readOwner(file))
      }
      throw error
    }

    const info: RuntimeServerOwnerInfo = {
      pid,
      database,
      startedAt: input.now ?? Date.now(),
    }
    try {
      fs.writeFileSync(file, JSON.stringify(info, null, 2), "utf8")
    } catch (error) {
      releaseFilesystemLock()
      throw error
    }

    const lease: LiveLease = { info, references: 1, file, releaseFilesystemLock }
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
        current.references -= 1
        if (current.references > 0) return
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
