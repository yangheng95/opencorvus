import type { Database as BunDatabase } from "bun:sqlite"

/** Add the current durable Session prompt-owner coordinate to an existing
 * application database before strict schema-drift validation runs. */
export function migrateSessionPromptOwnerSchema(sqlite: BunDatabase): void {
  sqlite.exec(`
CREATE TABLE IF NOT EXISTS "session_prompt_owner" (
  "session_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "directory" text NOT NULL,
  "generation" text NOT NULL,
  "owner_pid" integer NOT NULL,
  "owner_process_instance_id" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "time_acquired" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_prompt_owner_project_idx" ON "session_prompt_owner" ("project_id");`)
}
