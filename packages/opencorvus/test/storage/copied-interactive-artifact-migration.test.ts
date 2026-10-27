import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { CompactionCoverage } from "../../src/session/compaction-coverage"
import type { Message } from "../../src/session/message"
import { DATABASE_MIGRATIONS } from "../../src/storage/migrations"
import { migrateSchema, schemaVersion } from "../../src/storage/schema-migration"

test("version nine preserves copied payloads and exact retained coverage through backup and reopen", () => {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw Error("Migration acceptance requires the isolated repository runner")
  const directory = fs.mkdtempSync(path.join(root, "artifact-copy-migration-"))
  const databasePath = path.join(directory, "history.db")
  const sqlite = new SQLite(databasePath)
  const query = (sql: string, ...bindings: any[]): any[] => {
    const statement = sqlite.query(sql)
    try { return statement.all(...bindings) } finally { statement.finalize() }
  }
  try {
    sqlite.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON")
    sqlite.exec(DATABASE_MIGRATIONS[7]!.ddl)
    sqlite.exec("PRAGMA user_version=8")
    for (const project of ["project", "foreign"]) sqlite.run(
      "INSERT INTO project(id,worktree,time_created,time_updated,sandboxes,generation) VALUES(?,?,1,2,'[]',?)", [project, directory, randomUUID()],
    )
    for (const [session, project] of [["source", "project"], ["side", "project"], ["foreign-side", "foreign"]]) sqlite.run(
      "INSERT INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated) VALUES(?,?,?,?,?,'1','assistant',1,2)",
      [session!, project!, session!, directory, session!],
    )
    const owner = { role: "assistant", author: "chat" } as const
    for (const [id, session] of [["original", "source"], ["copy", "side"], ["checkpoint", "side"], ["checkpoint-next", "side"], ["foreign-copy", "foreign-side"]]) sqlite.run(
      "INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,11,12,?)", [id!, session!, JSON.stringify(owner)],
    )
    const payload = '{ "schemaVersion":"1", "renderer":"table@1", "title":"原值保留", "columns":[{"id":"passed","label":"Passed","dataType":"boolean"}], "rows":[{"passed":"false"},{"passed":false},{"passed":null}] }'
    sqlite.run("INSERT INTO interactive_artifact(id,message_id,payload,time_created,time_updated) VALUES('artifact','original',?,21,22)", [payload])
    const display: Message.InteractiveArtifactPart = { id: "display", messageID: "copy", sessionID: "side", type: "interactive-artifact", artifactID: "artifact" }
    const second = { ...display, id: "display-duplicate" }
    const checkpoint: Message.CompactionPart = {
      id: "marker", messageID: "checkpoint", sessionID: "side", type: "compaction", auto: true,
      covered_parts: [{ messageID: "copy", diagnostics_sha256: "1".repeat(64), parts: [
        { partID: display.id, sha256: CompactionCoverage.digest(owner, display) },
        // This historical binding covered different content, which must retain its own identity.
        { partID: second.id, sha256: CompactionCoverage.digest(owner, { ...second, artifactID: "earlier-artifact" }) },
      ] }],
    }
    const dependent: Message.CompactionPart = {
      id: "marker-next", messageID: "checkpoint-next", sessionID: "side", type: "compaction", auto: true,
      covered_parts: [{ messageID: "checkpoint", diagnostics_sha256: "2".repeat(64), parts: [{ partID: checkpoint.id, sha256: CompactionCoverage.digest(owner, checkpoint) }] }],
    }
    const parts: Message.Part[] = [display, second, checkpoint, dependent,
      { ...display, id: "original-display", messageID: "original", sessionID: "source" },
      { ...display, id: "foreign-display", messageID: "foreign-copy", sessionID: "foreign-side" },
    ]
    for (const part of parts) {
      const { id, messageID, sessionID: _session, ...data } = part
      sqlite.run("INSERT INTO part(id,message_id,time_created,time_updated,data) VALUES(?,?,31,32,?)", [id, messageID, JSON.stringify(data)])
    }
    const source = query("SELECT * FROM interactive_artifact WHERE id='artifact'")[0]
    const messages = query("SELECT * FROM message ORDER BY id")
    const foreign = query("SELECT * FROM part WHERE id='foreign-display'")[0]
    const receipt = migrateSchema({ sqlite, databasePath, migrations: DATABASE_MIGRATIONS, currentDDL: DATABASE_MIGRATIONS.at(-1)!.ddl, validate() {} })
    const copies = query("SELECT * FROM interactive_artifact WHERE message_id='copy'")
    const newID = copies[0]!.id
    const readPart = (id: string): Message.Part => {
      const row = query("SELECT * FROM part WHERE id=?", id)[0]
      return { ...JSON.parse(row.data), id, messageID: row.message_id, sessionID: "side" }
    }
    const repaired = readPart(display.id) as Message.InteractiveArtifactPart
    const repairedCheckpoint = readPart(checkpoint.id) as Message.CompactionPart
    const repairedDependent = readPart(dependent.id) as Message.CompactionPart
    expect({ from: receipt.from, to: receipt.to, version: schemaVersion(sqlite), copies, source: query("SELECT * FROM interactive_artifact WHERE id='artifact'")[0], messages: query("SELECT * FROM message ORDER BY id"), foreign: query("SELECT * FROM part WHERE id='foreign-display'")[0] }).toEqual({
      from: 8, to: 9, version: 9, copies: [{ ...source, id: newID, message_id: "copy" }], source, messages, foreign,
    })
    expect({ repaired, second: readPart(second.id), checkpoint: repairedCheckpoint, dependent: repairedDependent }).toEqual({
      repaired: { ...display, artifactID: newID }, second: { ...second, artifactID: newID },
      checkpoint: { ...checkpoint, covered_parts: [{ ...checkpoint.covered_parts![0]!, parts: [
        { partID: display.id, sha256: CompactionCoverage.digest(owner, repaired) }, checkpoint.covered_parts![0]!.parts[1]!,
      ] }] },
      dependent: { ...dependent, covered_parts: [{ ...dependent.covered_parts![0]!, parts: [{ partID: checkpoint.id, sha256: CompactionCoverage.digest(owner, repairedCheckpoint) }] }] },
    })
    expect(query("SELECT time_created,time_updated FROM part ORDER BY id")).toEqual(parts.map(() => ({ time_created: 31, time_updated: 32 })))
    using backup = new SQLite(receipt.backupPath!, { readonly: true })
    expect(backup.query("SELECT id,message_id,payload FROM interactive_artifact").all()).toEqual([{ id: "artifact", message_id: "original", payload }])
    const settled = query("SELECT * FROM part ORDER BY id")
    const reopen = migrateSchema({ sqlite, databasePath, migrations: DATABASE_MIGRATIONS, currentDDL: DATABASE_MIGRATIONS.at(-1)!.ddl, validate() {} })
    expect({ from: reopen.from, to: reopen.to, parts: query("SELECT * FROM part ORDER BY id"), artifacts: query("SELECT * FROM interactive_artifact WHERE message_id='copy'") }).toEqual({ from: 9, to: 9, parts: settled, artifacts: copies })
    using reader = new SQLite(databasePath, { readonly: true })
    expect({ version: schemaVersion(reader), payload: reader.query("SELECT payload FROM interactive_artifact WHERE id=?").get(newID) }).toEqual({ version: 9, payload: { payload } })
  } finally {
    sqlite.close(true)
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
