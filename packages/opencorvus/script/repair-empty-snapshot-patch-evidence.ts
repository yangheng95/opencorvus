import { Database } from "bun:sqlite"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { EMPTY_TREE_HASH, EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT } from "../src/snapshot/types"

type Args = {
  db: string
  taskID: string
  threshold: number
  apply: boolean
}

function argValue(name: string) {
  const index = Bun.argv.indexOf(name)
  if (index < 0) return undefined
  return Bun.argv[index + 1]
}

function defaultDbPath() {
  const local = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local")
  return path.join(local, "opencorvus", ".opencorvus", "opencorvus.db")
}

function parseArgs(): Args {
  const taskID = argValue("--task-id")
  if (!taskID)
    throw new Error(
      "Usage: bun packages/opencorvus/script/repair-empty-snapshot-patch-evidence.ts --task-id <id> [--db <path>] [--threshold <n>] [--apply]",
    )
  return {
    db: argValue("--db") || process.env.OPENCORVUS_DB || defaultDbPath(),
    taskID,
    threshold: Number(argValue("--threshold") || EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT),
    apply: Bun.argv.includes("--apply"),
  }
}

async function backupDb(dbPath: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const backup = `${dbPath}.backup-${stamp}`
  await fs.copyFile(dbPath, backup)
  for (const suffix of ["-wal", "-shm"]) {
    await fs.copyFile(`${dbPath}${suffix}`, `${backup}${suffix}`).catch((err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return
      throw err
    })
  }
  return backup
}

function placeholders(items: unknown[]) {
  return items.map(() => "?").join(", ")
}

const args = parseArgs()
const db = args.apply ? new Database(args.db) : new Database(args.db, { readonly: true })

const sessions = db
  .query<{ id: string }, [string]>(
    `
    WITH RECURSIVE session_tree(id) AS (
      SELECT session_id FROM engine_task WHERE id = ?
      UNION ALL
      SELECT s.id FROM session s JOIN session_tree st ON s.parent_id = st.id
    )
    SELECT id FROM session_tree
  `,
  )
  .all(args.taskID)
  .map((row) => row.id)

if (sessions.length === 0) throw new Error(`No sessions found for task ${args.taskID}`)

const sessionSql = placeholders(sessions)
const patchRows = db
  .query<
    { id: string; message_id: string; session_id: string; file_count: number; data_length: number },
    [...string[], string, number]
  >(
    `
    SELECT id, message_id, session_id,
           json_array_length(json_extract(data, '$.files')) AS file_count,
           length(data) AS data_length
    FROM part
    WHERE session_id IN (${sessionSql})
      AND json_extract(data, '$.type') = 'patch'
      AND json_extract(data, '$.hash') = ?
      AND json_array_length(json_extract(data, '$.files')) >= ?
    ORDER BY data_length DESC
  `,
  )
  .all(...sessions, EMPTY_TREE_HASH, args.threshold)

const affectedSessions = [...new Set(patchRows.map((row) => row.session_id))]
const affectedMessages = [...new Set(patchRows.map((row) => row.message_id))]
const stepStartRows = affectedMessages.length
  ? db
      .query<{ id: string; message_id: string; session_id: string }, [...string[], string]>(
        `
        SELECT id, message_id, session_id
        FROM part
        WHERE message_id IN (${placeholders(affectedMessages)})
          AND json_extract(data, '$.type') = 'step-start'
          AND json_extract(data, '$.snapshot') = ?
      `,
      )
      .all(...affectedMessages, EMPTY_TREE_HASH)
  : []

console.log(
  JSON.stringify(
    {
      mode: args.apply ? "apply" : "dry-run",
      db: args.db,
      taskID: args.taskID,
      threshold: args.threshold,
      sessions: sessions.length,
      invalidPatchParts: patchRows,
      invalidStepStarts: stepStartRows,
      affectedSessions,
    },
    null,
    2,
  ),
)

if (!args.apply) {
  db.close()
  process.exit(0)
}

if (patchRows.length === 0 && stepStartRows.length === 0) {
  db.close()
  process.exit(0)
}

const backup = await backupDb(args.db)
const tx = db.transaction(() => {
  if (patchRows.length) {
    db.query(`DELETE FROM part WHERE id IN (${placeholders(patchRows)})`).run(...patchRows.map((row) => row.id))
  }
  if (stepStartRows.length) {
    db.query(`DELETE FROM part WHERE id IN (${placeholders(stepStartRows)})`).run(...stepStartRows.map((row) => row.id))
  }
  if (affectedSessions.length) {
    db.query(
      `
      UPDATE session
      SET summary_additions = NULL,
          summary_deletions = NULL,
          summary_files = NULL,
          time_updated = ?
      WHERE id IN (${placeholders(affectedSessions)})
    `,
    ).run(Date.now(), ...affectedSessions)
  }
})
tx()

const storageDir = path.join(path.dirname(args.db), "storage", "session_diff")
for (const sessionID of affectedSessions) {
  await fs.unlink(path.join(storageDir, `${sessionID}.json`)).catch((err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return
    throw err
  })
}

console.log(
  JSON.stringify(
    {
      repaired: true,
      backup,
      deletedPatchParts: patchRows.length,
      deletedStepStarts: stepStartRows.length,
      clearedSessionSummaries: affectedSessions.length,
      removedSessionDiffFiles: affectedSessions,
    },
    null,
    2,
  ),
)

db.close()
