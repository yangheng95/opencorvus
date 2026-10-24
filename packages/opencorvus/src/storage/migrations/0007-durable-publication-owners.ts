import type { Database as SQLite } from "bun:sqlite"

/** Version seven does not infer historical ownership from today's registry.
 * Old code could recreate even deterministic Sessions and Messages in a new
 * Project generation. Null is preserved uncertainty, not a completed effect. */
export function preserveHistoricalPublicationOwners(sqlite: SQLite): void {
  sqlite.exec(`
    CREATE TABLE bus_publication_owner (
      occurrence_id TEXT PRIMARY KEY REFERENCES bus_publication_outbox(occurrence_id) ON DELETE RESTRICT,
      project_generation TEXT,
      time_created INTEGER NOT NULL
    );
    ALTER TABLE event_job_fire ADD COLUMN project_generation TEXT;
    ALTER TABLE automation_run ADD COLUMN target_project_generation TEXT;
  `)
  const insert = sqlite.query(`INSERT INTO bus_publication_owner (occurrence_id,project_generation,time_created)
    SELECT occurrence_id,NULL,? FROM bus_publication_outbox`)
  try {
    insert.run(Date.now())
  } finally {
    insert.finalize()
  }
}
