import { describe, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { migrateSessionPromptOwnerSchema } from "@/storage/session-prompt-owner-migration"

describe("Session prompt owner schema migration", () => {
  test("adds the owner coordinate to an existing Session database and preserves its cascade authority", () => {
    const sqlite = new SQLite(":memory:")
    try {
      sqlite.exec(`
PRAGMA foreign_keys = ON;
CREATE TABLE "project" ("id" text PRIMARY KEY NOT NULL);
CREATE TABLE "session" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
INSERT INTO "project" ("id") VALUES ('project:migration');
INSERT INTO "session" ("id", "project_id") VALUES ('session:migration', 'project:migration');`)

      migrateSessionPromptOwnerSchema(sqlite)
      sqlite.run(
        `
INSERT INTO "session_prompt_owner" (
  "session_id", "project_id", "directory", "generation", "owner_pid",
  "owner_process_instance_id", "owner_occurrence_id", "time_acquired"
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          "session:migration",
          "project:migration",
          "D:/migration",
          "generation:migration",
          42,
          "process:migration",
          "occurrence:migration",
          100,
        ],
      )
      migrateSessionPromptOwnerSchema(sqlite)

      expect(
        sqlite
          .query<
            { session_id: string; generation: string; owner_occurrence_id: string },
            []
          >("SELECT session_id, generation, owner_occurrence_id FROM session_prompt_owner")
          .all(),
      ).toEqual([
        {
          session_id: "session:migration",
          generation: "generation:migration",
          owner_occurrence_id: "occurrence:migration",
        },
      ])

      sqlite.run("DELETE FROM session WHERE id = ?", ["session:migration"])
      expect(sqlite.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM session_prompt_owner").get()).toEqual({
        count: 0,
      })
    } finally {
      sqlite.close()
    }
  })
})
