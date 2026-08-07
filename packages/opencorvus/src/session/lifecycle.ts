import { Database, eq } from "@/storage/db"
import { SessionStatus } from "./status"
import { SessionTable } from "./session.sql"

export interface SessionLifecycleSnapshot {
  status: SessionStatus.Info
  observedAt: number
}

function sessionUpdatedAt(sessionID: string): number {
  const row = Database.use((db) =>
    db.select({ updatedAt: SessionTable.time_updated }).from(SessionTable).where(eq(SessionTable.id, sessionID)).get(),
  )
  if (!row) throw new Error(`Session lifecycle ${sessionID} has no persisted session row`)
  return row.updatedAt
}

/**
 * Resolve the current process's physical lifecycle observation.
 *
 * Durable lifecycle events remain historical Turn facts. They cannot prove
 * that a stream, prompt owner, or other runtime resource exists in this
 * process, and therefore never become current Session liveness after restart.
 */
export function resolveSessionLifecycleSnapshot(sessionID: string): SessionLifecycleSnapshot {
  return { status: SessionStatus.get(sessionID), observedAt: sessionUpdatedAt(sessionID) }
}

export function resolveSessionLifecycle(sessionID: string): SessionStatus.Info {
  return resolveSessionLifecycleSnapshot(sessionID).status
}

export type SessionActivityStatus = "active" | "idle" | "terminal"

/**
 * Project the canonical session lifecycle onto the reusable Chat surfaces.
 * Message generation is active only while streaming or retrying; idle is the
 * settled between-turn state, while terminal means the session actor closed.
 */
export function resolveSessionActivityStatus(sessionID: string): SessionActivityStatus {
  const lifecycle = resolveSessionLifecycle(sessionID)
  if (lifecycle.type === "streaming" || lifecycle.type === "retry") return "active"
  return lifecycle.type
}
