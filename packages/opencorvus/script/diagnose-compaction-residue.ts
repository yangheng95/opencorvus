import { Database } from "bun:sqlite"
import fs from "fs/promises"
import path from "path"
import { EMPTY_TREE_HASH } from "../src/snapshot/types"

type Args = {
  db: string
  taskID: string
  oversizedPatchChars: number
  apply: boolean
}

type MessageRow = {
  id: string
  session_id: string
  role: string | null
  parent_id: string | null
  summary: number | null
  finish: string | null
  has_error: number
  has_structured: number
  part_count: number
}

function argValue(name: string) {
  const index = Bun.argv.indexOf(name)
  if (index < 0) return undefined
  return Bun.argv[index + 1]
}

function defaultDbPath() {
  return path.join(process.cwd(), ".opencorvus", "opencorvus.db")
}

function parseArgs(): Args {
  const taskID = argValue("--task-id")
  const db = argValue("--db") || process.env.OPENCORVUS_DB
  const apply = Bun.argv.includes("--apply")
  if (!taskID) {
    throw new Error(
      "Usage: bun packages/opencorvus/script/diagnose-compaction-residue.ts --task-id <id> [--db <path>] [--oversized-patch-chars <n>] [--apply]",
    )
  }
  if (apply && !db) {
    throw new Error("Refusing --apply without an explicit --db path or OPENCORVUS_DB.")
  }
  return {
    db: db || defaultDbPath(),
    taskID,
    oversizedPatchChars: Number(argValue("--oversized-patch-chars") || 200_000),
    apply,
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

if (sessions.length === 0) {
  console.log(
    JSON.stringify(
      {
        mode: args.apply ? "apply" : "dry-run",
        db: args.db,
        taskID: args.taskID,
        sessions: 0,
        emptyAssistantsAdjacentToCompaction: [],
        failedCompactionAssistants: [],
        legacyProseSummaries: [],
        oversizedPatchParts: [],
        repairableMessageIDs: [],
      },
      null,
      2,
    ),
  )
  db.close()
  process.exit(0)
}

const sessionSql = placeholders(sessions)
const messages = db
  .query<MessageRow, string[]>(
    `
    SELECT m.id,
           m.session_id,
           json_extract(m.data, '$.role') AS role,
           json_extract(m.data, '$.parentID') AS parent_id,
           json_extract(m.data, '$.summary') AS summary,
           json_extract(m.data, '$.finish') AS finish,
           CASE WHEN json_type(m.data, '$.error') IS NULL THEN 0 ELSE 1 END AS has_error,
           CASE WHEN json_type(m.data, '$.structured') IS NULL THEN 0 ELSE 1 END AS has_structured,
           count(p.id) AS part_count
    FROM message m
    LEFT JOIN part p ON p.message_id = m.id
    WHERE m.session_id IN (${sessionSql})
    GROUP BY m.id
    ORDER BY m.session_id, m.id
  `,
  )
  .all(...sessions)

const compactionUsers = new Set(
  db
    .query<{ message_id: string }, string[]>(
      `
      SELECT DISTINCT message_id
      FROM part
      WHERE session_id IN (${sessionSql})
        AND json_extract(data, '$.type') = 'compaction'
    `,
    )
    .all(...sessions)
    .map((row) => row.message_id),
)

const emptyAssistantsAdjacentToCompaction: MessageRow[] = []
for (let i = 1; i < messages.length; i++) {
  const current = messages[i]!
  const previous = messages[i - 1]!
  if (!compactionUsers.has(current.id)) continue
  if (previous.session_id !== current.session_id) continue
  if (previous.role !== "assistant") continue
  if (previous.part_count !== 0) continue
  if (previous.has_error) continue
  emptyAssistantsAdjacentToCompaction.push(previous)
}

const failedCompactionAssistants = messages.filter(
  (row) =>
    row.role === "assistant" &&
    row.summary === 1 &&
    row.parent_id !== null &&
    compactionUsers.has(row.parent_id) &&
    row.has_error === 1,
)

const legacyProseSummaries = messages.filter(
  (row) =>
    row.role === "assistant" &&
    row.summary === 1 &&
    row.finish !== null &&
    row.has_error === 0 &&
    row.has_structured === 0,
)

const oversizedPatchParts = db
  .query<
    {
      id: string
      message_id: string
      session_id: string
      hash: string | null
      file_count: number | null
      data_length: number
    },
    [...string[], number, string]
  >(
    `
    SELECT id,
           message_id,
           session_id,
           json_extract(data, '$.hash') AS hash,
           json_array_length(json_extract(data, '$.files')) AS file_count,
           length(data) AS data_length
    FROM part
    WHERE session_id IN (${sessionSql})
      AND json_extract(data, '$.type') = 'patch'
      AND (length(data) >= ? OR json_extract(data, '$.hash') = ?)
    ORDER BY data_length DESC
  `,
  )
  .all(...sessions, args.oversizedPatchChars, EMPTY_TREE_HASH)

const repairableMessageIDs = [
  ...new Set([
    ...emptyAssistantsAdjacentToCompaction.map((row) => row.id),
    ...failedCompactionAssistants.filter((row) => row.part_count === 0).map((row) => row.id),
  ]),
]

console.log(
  JSON.stringify(
    {
      mode: args.apply ? "apply" : "dry-run",
      db: args.db,
      taskID: args.taskID,
      sessions: sessions.length,
      emptyAssistantsAdjacentToCompaction,
      failedCompactionAssistants,
      legacyProseSummaries,
      oversizedPatchParts,
      repairableMessageIDs,
    },
    null,
    2,
  ),
)

if (!args.apply || repairableMessageIDs.length === 0) {
  db.close()
  process.exit(0)
}

const backup = await backupDb(args.db)
db.transaction(() => {
  db.query(`DELETE FROM message WHERE id IN (${placeholders(repairableMessageIDs)})`).run(...repairableMessageIDs)
})()

console.log(
  JSON.stringify(
    {
      repaired: true,
      backup,
      deletedMessages: repairableMessageIDs,
    },
    null,
    2,
  ),
)

db.close()
