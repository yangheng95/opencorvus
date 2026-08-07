import { Database } from "bun:sqlite"

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

const db = new Database(requiredEnv("OPENCORVUS_DB"), { readonly: true })
const taskID = requiredEnv("OPENCORVUS_TASK_ID")

console.log("--- task ---")
const row = db
  .query("SELECT id,title,request,time_created,time_updated FROM engine_task WHERE id=?")
  .get(taskID) as Record<string, unknown> | undefined
console.log(row)

console.log("\n--- last 40 protocol events ---")
for (const r of db
  .query("SELECT type, source, emitted_at FROM protocol_event WHERE task_id=? ORDER BY emitted_at DESC LIMIT 40")
  .all(taskID)) {
  console.log(r)
}

console.log("\n--- key non-noise events around build failure ---")
for (const r of db
  .query(
    "SELECT type, source, emitted_at, payload FROM protocol_event WHERE task_id=? AND (type LIKE 'integrity%' OR type LIKE 'build%' OR type LIKE 'architect%' OR type LIKE 'goal%' OR type='task.updated') ORDER BY emitted_at",
  )
  .all(taskID) as Array<{ type: string; source: string; emitted_at: number; payload: string }>) {
  let payload: unknown = r.payload
  try {
    payload = JSON.parse(r.payload)
  } catch {}
  console.log({ type: r.type, source: r.source, t: r.emitted_at, payload })
}
