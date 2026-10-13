import fs from "node:fs/promises"
import path from "node:path"
import { gzipSync } from "node:zlib"
import { Database } from "bun:sqlite"
import { createRequire } from "node:module"
const [run, evidence, label] = process.argv.slice(2)
if (!run || !evidence || !label || !path.isAbsolute(run) || !path.isAbsolute(evidence)) throw Error("Exact owned archive required")
process.env.OPENCORVUS_HOME = path.join(run, "runtime")
process.env.OPENCORVUS_TEST_HOME = path.join(run, "home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT = path.join(run, "archive-observer")
const { CredentialRedactor } = await import("../packages/opencorvus/script/real-provider-audit")
const { completedToolOutcomeOutput } = await import("../packages/opencorvus/src/session/tool-outcome-facts")
const productionRequire = createRequire(path.resolve(import.meta.dir, "../packages/opencorvus/package.json"))
const { drizzle } = await import(productionRequire.resolve("drizzle-orm/bun-sqlite"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const write = async (name: string, value: unknown) => fs.writeFile(path.join(evidence, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n", { flag: "wx" })
await fs.mkdir(evidence, { recursive: true })
for (const name of ["startup.json", "launch-owner.json"]) await fs.writeFile(path.join(evidence, `${label}-${name}`), redactor.redact(await fs.readFile(path.join(run, name), "utf8")), { flag: "wx" })
for (const name of ["native-host-ready.json", "native-host-settled.json", "preflight-ready.json", "authority-ready.json", "provider-pair-staging.json", "owned-config-hierarchy.json", "profile-selection-admitted.json", "project-baseline.json", "managed-parent-ready.json"]) {
  await fs.writeFile(path.join(evidence, `${label}-${name}`), redactor.redact(await fs.readFile(path.join(run, "evidence", name), "utf8")), { flag: "wx" })
}
for (const name of ["stdout.log", "stderr.log"]) await fs.writeFile(path.join(evidence, `${label}-${name}.gz`), gzipSync(redactor.redact(await fs.readFile(path.join(run, name), "utf8"))), { flag: "wx" })
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
const outputDB = drizzle({ client: db })
let canonical: unknown
try {
  db.exec("BEGIN")
  const sessions = db.query("SELECT id,project_id,directory,kind,parent_id,title,metadata FROM session ORDER BY time_created,id").all()
  const messages = (db.query("SELECT id,session_id,data FROM message ORDER BY time_created,id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    return { id: row.id, sessionID: row.session_id, role: data.role, author: data.author, agent: data.agent, model: data.model, modelID: data.modelID, providerID: data.providerID, time: data.time, finish: data.finish, error: data.error }
  })
  const parts = (db.query("SELECT id,message_id,data FROM part ORDER BY time_created,id").all() as any[]).map(row => ({ id: row.id, messageID: row.message_id, ...JSON.parse(row.data) }))
  const tools = db.query("SELECT id,message_id,data FROM tool_part_request ORDER BY time_created,id").all()
  const outcomes = (db.query("SELECT request_part_id,data FROM tool_part_outcome ORDER BY time_created,id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    const output = completedToolOutcomeOutput(outputDB as any, data, () => row.request_part_id)
    return { requestPartID: row.request_part_id, outcome: data.outcome, resultAttemptID: data.resultAttemptID, outputChars: output?.length, output, metadata: data.metadata, time: data.time, failure: data.failure }
  })
  canonical = { observedAtUtc: new Date().toISOString(), access: "Owned actual SQLite readonly BEGIN/ROLLBACK, natural participants and tool outcomes; no product mutation", sessions, messages, parts, tools, outcomes }
} finally { db.exec("ROLLBACK"); db.close() }
await write(`${label}-canonical-conversations.json`, canonical)
await write(`${label}-saved-input.json`, { file: "notes.txt", text: await fs.readFile(path.join(run, "project/notes.txt"), "utf8"), bytes: [...await fs.readFile(path.join(run, "project/notes.txt"))], outside: await fs.readFile(path.join(run, "outside.txt"), "utf8") })
console.log(JSON.stringify({ archived: true, label }))
