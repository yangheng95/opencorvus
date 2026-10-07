import { unwatchFile, watchFile } from "node:fs"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const STARTUP_RECEIPT_STAT_INTERVAL_MS = 50

/**
 * The framed machine startup fact a managed server publishes for its launcher.
 *
 * Readiness used to be a regex over a human console line — so changed wording,
 * a localized message or an unrelated matching stdout line could time the
 * launcher out, fail to parse, or hand back a URL the process never bound.
 * The receipt is the protocol instead: stdout stays diagnostics, and exactly
 * one of `url` or `error` settles the startup.
 */
export type StartupReceipt =
  | { schemaVersion: 1; occurrenceID: string; outcome: "listening"; url: string; pid: number }
  | { schemaVersion: 1; occurrenceID: string; outcome: "failed"; error: string }

export function parseStartupReceipt(raw: string, occurrenceID: string): StartupReceipt | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    // A partially written file is not a receipt yet.
    return undefined
  }
  if (!value || typeof value !== "object") return undefined
  const candidate = value as Record<string, unknown>
  if (candidate.schemaVersion !== 1) {
    throw new Error(`Unsupported server startup receipt schema: ${String(candidate.schemaVersion)}`)
  }
  if (candidate.occurrenceID !== occurrenceID) {
    throw new Error(
      `Server startup receipt belongs to a different launch occurrence: ${String(candidate.occurrenceID)}`,
    )
  }
  if (candidate.outcome === "listening") {
    if (typeof candidate.url !== "string" || !candidate.url) {
      throw new Error("Server startup receipt reports listening without a url")
    }
    if (!Number.isSafeInteger(candidate.pid) || (candidate.pid as number) <= 0) {
      throw new Error("Server startup receipt reports listening without a positive safe-integer pid")
    }
    return {
      schemaVersion: 1,
      occurrenceID,
      outcome: "listening",
      url: candidate.url,
      pid: candidate.pid as number,
    }
  }
  if (candidate.outcome === "failed") {
    return {
      schemaVersion: 1,
      occurrenceID,
      outcome: "failed",
      error: typeof candidate.error === "string" ? candidate.error : "Server reported a startup failure",
    }
  }
  throw new Error(`Unsupported server startup receipt outcome: ${String(candidate.outcome)}`)
}

/** A private directory for one launch's receipt; the launcher owns its life. */
export async function createStartupReceiptChannel(occurrenceID: string): Promise<{
  path: string
  read(): Promise<StartupReceipt | undefined>
  wait(signal: AbortSignal): Promise<StartupReceipt>
  dispose(): Promise<void>
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "opencorvus-startup-"))
  const file = path.join(directory, "startup-receipt.json")
  const read = async () => {
    let raw: string
    try {
      raw = await readFile(file, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
      throw error
    }
    if (!raw.trim()) return undefined
    return parseStartupReceipt(raw, occurrenceID)
  }
  return {
    path: file,
    read,
    async wait(signal) {
      return new Promise<StartupReceipt>((resolve, reject) => {
        let settled = false
        let reading = false
        let changed = false
        // Observe the authoritative file itself. Directory notifications may
        // coalesce the temporary write and final rename before the receipt is
        // readable. Stat observation remains live until this launch settles.
        const observe = () => void check()
        const watcher = watchFile(file, { interval: STARTUP_RECEIPT_STAT_INTERVAL_MS }, observe)
        const cleanup = () => {
          signal.removeEventListener("abort", abort)
          watcher.removeListener("error", fail)
          unwatchFile(file, observe)
        }
        const fail = (error: unknown) => {
          if (settled) return
          settled = true
          cleanup()
          reject(error)
        }
        const abort = () => fail(signal.reason ?? new DOMException("The operation was aborted", "AbortError"))
        async function check() {
          if (settled) return
          if (reading) {
            changed = true
            return
          }
          reading = true
          try {
            do {
              changed = false
              const published = await read()
              if (settled) return
              if (published) {
                settled = true
                cleanup()
                resolve(published)
                return
              }
            } while (changed)
          } catch (error) {
            fail(error)
          } finally {
            reading = false
          }
        }
        watcher.on("error", fail)
        signal.addEventListener("abort", abort, { once: true })
        if (signal.aborted) abort()
        else void check()
      })
    },
    async dispose() {
      await rm(directory, { recursive: true, force: true })
    },
  }
}
