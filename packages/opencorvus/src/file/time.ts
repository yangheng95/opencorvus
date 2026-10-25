import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"
import { Filesystem } from "../util/filesystem"
import { contentRevision, FileWriteConflictError } from "./content-revision"

export namespace FileTime {
  const log = Log.create({ service: "file.time" })
  function fileKey(file: string) {
    return Filesystem.normalizeForCompare(Filesystem.normalizePath(file))
  }
  // Per-session observed byte revisions plus per-file write locks.
  // All tools that overwrite existing files should run their
  // read/assert/write/update sequence inside withLock(filepath, ...)
  // so concurrent writes to the same file are serialized.
  export const state = createInstanceState(
    () => {
      const read: {
        [sessionID: string]: {
          [path: string]: string | undefined
        }
      } = {}
      const locks = new Map<string, Promise<void>>()
      return {
        read,
        locks,
      }
    },
    undefined,
    "file-time",
  )

  export function read(sessionID: string, file: string, bytes: Uint8Array) {
    log.info("read", { sessionID, file })
    const { read } = state()
    read[sessionID] = read[sessionID] || {}
    const key = fileKey(file)
    read[sessionID][key] = contentRevision(key, bytes)
  }

  export function get(sessionID: string, file: string) {
    return state().read[sessionID]?.[fileKey(file)]
  }

  export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
    filepath = fileKey(filepath)
    const current = state()
    const currentLock = current.locks.get(filepath) ?? Promise.resolve()
    let release: () => void = () => {}
    const nextLock = new Promise<void>((resolve) => {
      release = resolve
    })
    const chained = currentLock.then(() => nextLock)
    current.locks.set(filepath, chained)
    await currentLock
    try {
      return await fn()
    } finally {
      release()
      if (current.locks.get(filepath) === chained) {
        current.locks.delete(filepath)
      }
    }
  }

  export function assert(sessionID: string, filepath: string, bytes: Uint8Array) {
    if (Flag.OPENCORVUS_DISABLE_FILETIME_CHECK === true) {
      return
    }

    filepath = Filesystem.normalizePath(filepath)
    const observed = get(sessionID, filepath)
    if (!observed) throw new Error(`You must read file ${filepath} before overwriting it. Use the Read tool first`)
    if (observed !== contentRevision(fileKey(filepath), bytes)) {
      throw new FileWriteConflictError({
        path: filepath,
        message: `File ${filepath} has been modified since it was last read. Please read the file again before modifying it.`,
      })
    }
  }
}
