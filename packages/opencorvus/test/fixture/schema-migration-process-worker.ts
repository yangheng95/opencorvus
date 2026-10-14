import fs from "node:fs"
import { Database as SQLite } from "bun:sqlite"
import { migrateSchema, schemaVersion } from "../../src/storage/schema-migration"

const [mode, databasePath, ready, start] = process.argv.slice(2)
if (!mode || !databasePath || !ready || !start) throw new Error("Missing migration process arguments")
const ddl = 'CREATE TABLE "note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL, "bytes" BLOB);'
if (mode === "production" || mode === "upgrade") {
  fs.writeFileSync(ready, "ready", { flag: "wx" })
  const deadline = Date.now() + 20_000
  while (!fs.existsSync(start)) {
    if (Date.now() > deadline) throw new Error("Migration start barrier expired")
    await Bun.sleep(10)
  }
  if (mode === "upgrade") {
    const sqlite = new SQLite(databasePath)
    sqlite.exec("PRAGMA busy_timeout=5000")
    const target =
      'CREATE TABLE "note" ("id" TEXT PRIMARY KEY, "body" TEXT NOT NULL, "bytes" BLOB, "priority" INTEGER NOT NULL DEFAULT 3); CREATE INDEX "note_body" ON "note"("body");'
    try {
      const receipt = migrateSchema({
        sqlite,
        databasePath,
        currentDDL: target,
        migrations: [
          { version: 1, name: "baseline", ddl },
          { version: 2, name: "priority", ddl: target },
        ],
        validate() {},
      })
      console.log(JSON.stringify({ outcome: receipt.from === 1 ? "upgraded" : "current", ...receipt, version: schemaVersion(sqlite) }))
    } catch (error) {
      if ((error as { code?: string })?.code !== "SQLITE_BUSY") throw error
      console.log(JSON.stringify({ outcome: "busy", code: "SQLITE_BUSY" }))
    } finally {
      sqlite.close(true)
    }
  } else {
    const { Database } = await import("../../src/storage/db")
    try {
      const identity = Database.Identity()
      console.log(
        JSON.stringify({
          identity,
          version: Database.allFinalized<{ user_version: number }>("PRAGMA user_version")[0].user_version,
        }),
      )
    } finally {
      Database.close()
    }
  }
} else if (mode === "crash") {
  const sqlite = new SQLite(databasePath)
  try {
    migrateSchema({
      sqlite,
      databasePath,
      currentDDL: ddl,
      migrations: [
        { version: 1, name: "baseline", ddl },
        {
          version: 2,
          name: "interrupted",
          ddl,
          migrate: (db) => {
            db.exec("UPDATE note SET body='uncommitted'")
            fs.writeFileSync(ready, "writer-active", { flag: "wx" })
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0)
          },
        },
      ],
      validate() {},
    })
    console.log(JSON.stringify({ version: schemaVersion(sqlite) }))
  } finally {
    sqlite.close(true)
  }
} else {
  throw new Error(`Unknown migration process mode: ${mode}`)
}
