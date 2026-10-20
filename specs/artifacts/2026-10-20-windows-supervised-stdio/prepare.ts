import fs from "node:fs"
import path from "node:path"
import { Database } from "bun:sqlite"
const root = import.meta.dir
if (path.resolve(root) !== path.resolve("D:/myhexin-local/opencorvus/.tmp-product-iteration/windows-supervised-stdio-454")) throw Error("Exact own diagnostic root required")
const db = new Database("C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-14/member-live-rendering-412-fresh/runtime/data/opencorvus.db", { readonly: true, create: false })
try {
  const rows = db.query("SELECT id, worktree FROM project ORDER BY id").all() as { id: string; worktree: string }[]
  const included = rows.filter(row => fs.existsSync(path.join(row.worktree, ".git")))
  const excluded = rows.filter(row => !fs.existsSync(path.join(row.worktree, ".git"))).map(row => ({ ...row, reason: "No local .git: ordinary-directory contract, outside the read-only Git process probe" }))
  fs.writeFileSync(root + "/inputs.json", JSON.stringify({ schema: db.query("PRAGMA user_version").get(), projects: rows.length, included, excluded, boundary: "Direct readonly SQLite on the closed owned QA412 history; no production initializer" }, null, 2), { flag: "wx" })
  console.log(JSON.stringify({ projects: rows.length, gitInputs: included.length, ordinaryDirectories: excluded.length }))
} finally { db.close() }
