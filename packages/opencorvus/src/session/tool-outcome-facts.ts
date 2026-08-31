import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import type { Database } from "@/storage/db"
import { eq } from "drizzle-orm"
import type { ToolOutcomePartData } from "./session.sql"
import { normalizeToolResult } from "./tool-result-normalization"

/**
 * The canonical string output of a completed tool outcome. A completed outcome
 * either carries its output inline or defers it to a durable Permission result
 * through `resultAttemptID`; every reader that reconstructs persisted tool facts
 * must resolve both, or a deferred output reads as an absent one.
 */
export function completedToolOutcomeOutput(
  db: Database.TxOrDb,
  outcome: ToolOutcomePartData,
  describe: () => string,
): string | undefined {
  if (outcome.outcome !== "completed") return undefined
  if (!("resultAttemptID" in outcome) || !outcome.resultAttemptID) {
    return "output" in outcome ? outcome.output : undefined
  }
  const stored = db
    .select({ result: PermissionExecutionResultTable.result })
    .from(PermissionExecutionResultTable)
    .where(eq(PermissionExecutionResultTable.attempt_id, outcome.resultAttemptID))
    .get()?.result as { kind?: string; value?: unknown } | undefined
  if (!stored) {
    throw new Error(`${describe()} references missing Permission result ${outcome.resultAttemptID}`)
  }
  if (stored.kind === "undefined") return ""
  if (stored.kind !== "json") {
    throw new Error(`Permission result ${outcome.resultAttemptID} has an invalid durable result envelope`)
  }
  return normalizeToolResult(stored.value).output
}
