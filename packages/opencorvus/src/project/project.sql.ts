import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
import { Timestamps } from "@/storage/schema.sql"
import { randomUUID } from "node:crypto"

export const PROJECT_GENERATION_UNSET = "00000000-0000-0000-0000-000000000000"

export const ProjectTable = sqliteTable("project", {
  id: text().primaryKey(),
  worktree: text().notNull(),
  // No cached `vcs` column — the single source of truth for "is this a git
  // repo" is `Project.isGitRepo(directory)` which probes `.git` on disk. The
  // old cache went out of sync the moment `.git` was deleted (cleanup,
  // user `rm -rf`, etc.) and silently made Worktree.create throw
  // WorktreeCreateFailedError without any code path being able to self-heal —
  // auto-init in task-api/prepareProject was gated on the stale cache. Rule 22.
  name: text(),
  icon_url: text(),
  icon_color: text(),
  ...Timestamps,
  time_pinned: integer(),
  time_initialized: integer(),
  sandboxes: text({ mode: "json" }).notNull().$type<string[]>(),
  commands: text({ mode: "json" }).$type<{ start?: string }>(),
  // Project IDs are derived from repository identity and may be reused after
  // deletion. This UUID identifies one exact durable row occurrence. It stays
  // last so SQLite can add it without rebuilding the referenced parent table.
  generation: text()
    .notNull()
    .default(PROJECT_GENERATION_UNSET)
    .$defaultFn(() => randomUUID()),
})
