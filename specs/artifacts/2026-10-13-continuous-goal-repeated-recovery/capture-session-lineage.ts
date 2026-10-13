import fs from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"

// Independent, read-only evidence export after the private checker has settled.
const root = path.resolve(process.argv[2]!)
const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"))
const result = JSON.parse(await fs.readFile(path.join(root, "result.json"), "utf8"))
const settlement = JSON.parse(await fs.readFile(path.join(root, "settlement.json"), "utf8"))
if (result.status !== "passed" || !settlement.processes.every((entry: { exited: boolean }) => entry.exited)) {
  throw new Error("Expected a passed run with all owned processes settled")
}
const db = new Database(manifest.databasePath, { readonly: true })
try {
  const owner = db.query<{ project_id: string }, [string]>("SELECT project_id FROM session WHERE id=?")
    .get(result.owner.sessionID)!
  const rows = db.query("SELECT id,parent_id,project_id,kind FROM session WHERE project_id=? ORDER BY id")
    .all(owner.project_id)
  await fs.writeFile(path.join(root, "parent-session-lineage.json"), JSON.stringify(rows, null, 2) + "\n")
  console.log(JSON.stringify({ rows: rows.length, source: "independent read-only persisted Session query" }))
} finally {
  db.close()
}
