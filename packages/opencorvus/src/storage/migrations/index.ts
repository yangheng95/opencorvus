import baseline from "./0001-baseline.sql" with { type: "text" }
import grantDecisionIndex from "./0002-grant-decision-index.sql" with { type: "text" }
import { indexHistoricalGrantDecisions } from "./0002-grant-decision-index"
import { exposeHistoricalScheduledConversations } from "./0003-scheduled-work-conversations"
import messageMoveIndex from "./0004-message-move-index.sql" with { type: "text" }
import { validateHistoricalPermissionMemoryDeliveries } from "./0005-atomic-permission-memory"
import { recoverHistoricalPermissionMemory } from "./0006-recover-permission-memory"
import durablePublicationOwners from "./0007-durable-publication-owners.sql" with { type: "text" }
import { preserveHistoricalPublicationOwners } from "./0007-durable-publication-owners"
import installationMutationReceipts from "./0008-installation-mutation-receipts.sql" with { type: "text" }
import { preserveInstallationMutationReceipts } from "./0008-installation-mutation-receipts"
import type { SchemaMigration } from "../schema-migration"

/** Published entries are immutable. Append a revision for every schema or stored-data change. */
export const DATABASE_MIGRATIONS: readonly SchemaMigration[] = [
  { version: 1, name: "Current SQLite baseline", ddl: baseline },
  { version: 2, name: "Canonical saved-grant decision indexes", ddl: grantDecisionIndex, migrate: indexHistoricalGrantDecisions },
  { version: 3, name: "Visible standalone scheduled Work conversations", ddl: grantDecisionIndex, migrate: exposeHistoricalScheduledConversations },
  { version: 4, name: "Exact durable Message ownership transfer lookup", ddl: `${grantDecisionIndex}\n${messageMoveIndex}` },
  { version: 5, name: "Atomic Permission memory delivery boundary", ddl: `${grantDecisionIndex}\n${messageMoveIndex}`, migrate: validateHistoricalPermissionMemoryDeliveries },
  {
    version: 6,
    name: "Preserved historical Permission memory recovery",
    ddl: `${grantDecisionIndex}\n${messageMoveIndex}`,
    prepare: { beforeVersion: 5, run: recoverHistoricalPermissionMemory },
    migrate: recoverHistoricalPermissionMemory,
  },
  { version: 7, name: "Frozen durable publication and execution owners", ddl: durablePublicationOwners, migrate: preserveHistoricalPublicationOwners },
  { version: 8, name: "Installation lifetime mutation commit receipts", ddl: installationMutationReceipts, migrate: preserveInstallationMutationReceipts },
]
