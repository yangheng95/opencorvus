import z from "zod"
import { Identifier } from "@/id/id"
import { Log } from "@/util/log"
import { serverRestartHandler, type RestartUnavailableReason } from "./restart"
import { hasServerShutdownHandler, requestServerShutdown, type ServerShutdownRequest } from "./shutdown"

/**
 * The server's own lifecycle — shutdown and restart — as an admitted
 * occurrence rather than an acknowledged intention.
 *
 * The public routes used to return `{ok:true}` and then fire the handler from
 * a timer: the handler could be cleared in between, admission could fail, or
 * the replacement process could die, all after the caller had already received
 * success. Admission here is synchronous — the handler is bound at admission,
 * so nothing that happens later can silently turn an admitted occurrence into
 * a no-op — and the response carries the occurrence's stable identity, whose
 * state stays queryable for as long as this process lives.
 *
 * There is deliberately no "succeeded" state for a shutdown: success is the
 * process exiting, which the process cannot observe about itself. `executing`
 * is the last honest state a completed shutdown shows; a restart or shutdown
 * whose handler failed shows `failed` with the exact error.
 */

const log = Log.create({ service: "server.lifecycle" })

/** The HTTP response must release the listener before the handler runs. */
const LISTENER_RELEASE_DELAY_MS = 25

export type ServerLifecycleKind = "shutdown" | "restart"

export const ServerLifecycleOccurrenceResponse = z
  .object({
    id: z.string(),
    kind: z.enum(["shutdown", "restart"]),
    state: z.enum(["executing", "failed"]),
    error: z.string().optional(),
    timeAdmitted: z.number(),
  })
  .meta({ ref: "ServerLifecycleOccurrence" })

export type ServerLifecycleOccurrence = {
  id: string
  kind: ServerLifecycleKind
  state: "executing" | "failed"
  error?: string
  timeAdmitted: number
}

export type ServerLifecycleAdmission =
  | { admitted: true; occurrence: ServerLifecycleOccurrence }
  | { admitted: false; reason: "unavailable"; detail?: { reason: RestartUnavailableReason; message: string } }
  | { admitted: false; reason: "conflicting_lifecycle"; live: ServerLifecycleOccurrence }

const occurrences = new Map<string, ServerLifecycleOccurrence>()
let live: ServerLifecycleOccurrence | undefined

export function serverLifecycleOccurrence(id: string): ServerLifecycleOccurrence | undefined {
  return occurrences.get(id)
}

function admit(kind: ServerLifecycleKind, execute: () => Promise<void>): ServerLifecycleAdmission {
  if (live && live.state === "executing") {
    // A second request for the same transition converges on the occurrence
    // that is already carrying it out; a different transition is refused,
    // because the live one owns the process's fate.
    if (live.kind === kind) return { admitted: true, occurrence: live }
    return { admitted: false, reason: "conflicting_lifecycle", live }
  }
  const occurrence: ServerLifecycleOccurrence = {
    id: Identifier.ascending("call"),
    kind,
    state: "executing",
    timeAdmitted: Date.now(),
  }
  occurrences.set(occurrence.id, occurrence)
  live = occurrence
  setTimeout(() => {
    execute().catch((error) => {
      occurrence.state = "failed"
      occurrence.error = error instanceof Error ? error.message : String(error)
      if (live === occurrence) live = undefined
      log.error("server lifecycle occurrence failed", {
        occurrenceID: occurrence.id,
        kind,
        error: occurrence.error,
      })
    })
  }, LISTENER_RELEASE_DELAY_MS)
  return { admitted: true, occurrence }
}

export function admitServerShutdown(request: ServerShutdownRequest): ServerLifecycleAdmission {
  if (!hasServerShutdownHandler()) return { admitted: false, reason: "unavailable" }
  return admit("shutdown", async () => {
    // `requestServerShutdown` re-reads the registered handler; a handler that
    // was cleared between admission and this tick is a real failure of the
    // admitted occurrence, not a silent no-op.
    const outcome = requestServerShutdown(request)
    if (outcome === false) throw new Error("Server shutdown handler was cleared after admission")
    await outcome
  })
}

export async function admitServerRestart(reason: string): Promise<ServerLifecycleAdmission> {
  const current = () : ServerLifecycleAdmission | undefined => live?.state === "executing"
    ? live.kind === "restart" ? { admitted: true, occurrence: live }
      : { admitted: false, reason: "conflicting_lifecycle", live } : undefined
  const existing = current()
  if (existing) return existing
  const handler = serverRestartHandler()
  if (!handler) return { admitted: false, reason: "unavailable" }
  const availability = await handler.availability()
  const concurrent = current()
  if (concurrent) return concurrent
  if (!availability.available) return { admitted: false, reason: "unavailable", detail: { reason: availability.reason, message: availability.message } }
  if (handler !== serverRestartHandler()) return { admitted: false, reason: "unavailable",
    detail: { reason: "handler_unavailable", message: "Restart owner changed during availability observation" } }
  return admit("restart", () => handler.execute(reason))
}

export const ServerLifecycleTestHooks = {
  reset(): void {
    occurrences.clear()
    live = undefined
  },
}
