import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/source-range-262-live-01"
const out = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-range-264/history-readiness/referenced-file-readback.json"
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
try {
  db.exec("BEGIN")
  const sources = (db.query("SELECT id,message_id,data FROM part WHERE json_extract(data,'$.type')='source-file' ORDER BY id").all() as any[]).map(row => ({ id: row.id, messageID: row.message_id, ...JSON.parse(row.data) }))
  const files = [...new Set(sources.map(source => source.path))].map(file => {
    if (path.resolve(file) !== path.resolve("D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/read.ts")) throw Error("Exact authorized public repository source required")
    const stat = fs.statSync(file)
    return { path: file, bytes: stat.size, mtimeMs: stat.mtimeMs, content: fs.readFileSync(file, "utf8") }
  })
  fs.writeFileSync(out, JSON.stringify({ observedAtUtc: new Date().toISOString(), access: "Actual canonical Source parts in readonly transaction; exact referenced public file content and metadata, no mutation or hashes", sources, files }, null, 2) + "\n", { flag: "wx" })
  console.log(JSON.stringify({ sourceRanges: sources.map(source => source.range), referencedFiles: files.map(file => ({ path: file.path, bytes: file.bytes })) }))
} finally { db.exec("ROLLBACK"); db.close() }
