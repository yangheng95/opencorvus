import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"

import { Identifier } from "@/id/id"

export type UsagePurpose =
  | "session"
  | "provider-connectivity"
  | "vcs-commit-message"
  | "metric-judge"
  | "acceptance-translation"
  | "other"

export type UsageBillingStatus = "priced" | "unpriced" | "unknown"

export const ProviderUsageEventTable = sqliteTable(
  "provider_usage_event",
  {
    id: text()
      .primaryKey()
      .$default(() => Identifier.ascending("provider_usage")),
    occurred_at: integer().notNull(),
    provider_id: text().notNull(),
    model_id: text().notNull(),
    purpose: text().notNull().$type<UsagePurpose>(),
    input_tokens: integer().notNull(),
    output_tokens: integer().notNull(),
    reasoning_tokens: integer().notNull(),
    cache_read_tokens: integer().notNull(),
    cache_write_tokens: integer().notNull(),
    total_tokens: integer().notNull(),
    cost_usd: real().notNull(),
    billing_status: text().notNull().$type<UsageBillingStatus>(),
  },
  (table) => [
    index("provider_usage_event_time_idx").on(table.occurred_at, table.id),
    index("provider_usage_event_provider_time_idx").on(table.provider_id, table.occurred_at, table.id),
    index("provider_usage_event_model_time_idx").on(table.provider_id, table.model_id, table.occurred_at, table.id),
  ],
)
