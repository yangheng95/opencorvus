import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

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
    throw new Error(`Server startup receipt belongs to a different launch occurrence: ${String(candidate.occurrenceID)}`)
  }
  if (candidate.outcome === "listening") {
    if (typeof candidate.url !== "string" || !candidate.url) {
      throw new Error("Server startup receipt reports listening without a url")
    }
    return {
      schemaVersion: 1,
      occurrenceID,
      outcome: "listening",
      url: candidate.url,
      pid: typeof candidate.pid === "number" ? candidate.pid : 0,
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
  dispose(): Promise<void>
}> {
  const directory = await mkdtemp(path.join(tmpdir(), "opencorvus-startup-"))
  const file = path.join(directory, "startup-receipt.json")
  return {
    path: file,
    async read() {
      let raw: string
      try {
        raw = await readFile(file, "utf8")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
        throw error
      }
      if (!raw.trim()) return undefined
      return parseStartupReceipt(raw, occurrenceID)
    },
    async dispose() {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined)
    },
  }
}
