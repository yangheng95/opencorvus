import baseline from "./0001-baseline.sql" with { type: "text" }
import grantDecisionIndex from "./0002-grant-decision-index.sql" with { type: "text" }
import { indexHistoricalGrantDecisions } from "./0002-grant-decision-index"
import { exposeHistoricalScheduledConversations } from "./0003-scheduled-work-conversations"
import messageMoveIndex from "./0004-message-move-index.sql" with { type: "text" }
import type { SchemaMigration } from "../schema-migration"

/** Published entries are immutable. Append a revision for every schema or stored-data change. */
export const DATABASE_MIGRATIONS: readonly SchemaMigration[] = [
  { version: 1, name: "Current SQLite baseline", ddl: baseline },
  { version: 2, name: "Canonical saved-grant decision indexes", ddl: grantDecisionIndex, migrate: indexHistoricalGrantDecisions },
  { version: 3, name: "Visible standalone scheduled Work conversations", ddl: grantDecisionIndex, migrate: exposeHistoricalScheduledConversations },
  { version: 4, name: "Exact durable Message ownership transfer lookup", ddl: `${grantDecisionIndex}\n${messageMoveIndex}` },
]
