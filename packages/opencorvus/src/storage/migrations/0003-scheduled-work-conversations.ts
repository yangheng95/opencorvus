import type { Database as SQLite } from "bun:sqlite"
import { rightSidebarConversationMetadata } from "@/chat/identity"
import { standaloneScheduledConversationIdentityIssues } from "@/scheduler/scheduled-conversation-identity"
import { SchemaMigrationError } from "../schema-migration"

/** Preserve every original fact while publishing standalone results as Work. */
export function exposeHistoricalScheduledConversations(sqlite: SQLite): void {
  const issues = standaloneScheduledConversationIdentityIssues(sqlite)
  const conflict = issues.find((issue) => issue.kind === "invalid")
  if (conflict) {
    throw new SchemaMigrationError(
      "SCHEMA_MIGRATION_REQUIRED",
      `Scheduled result Session ${conflict.sessionID} has a conflicting conversation identity; its data is retained.`,
    )
  }
  const update = sqlite.query("UPDATE session SET metadata=? WHERE id=?")
  try {
    for (const issue of issues) {
      if (issue.kind !== "missing") continue
      update.run(JSON.stringify({ ...issue.metadata, ...rightSidebarConversationMetadata("work") }), issue.sessionID)
    }
  } finally {
    update.finalize()
  }
}
