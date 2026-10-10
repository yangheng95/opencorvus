import fs from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"
import { createRequire } from "node:module"
import { completedToolOutcomeOutput } from "../../packages/opencorvus/src/session/tool-outcome-facts"
const productionRequire = createRequire("D:/myhexin-local/opencorvus/packages/opencorvus/package.json")
const { drizzle } = await import(productionRequire.resolve("drizzle-orm/bun-sqlite"))
import { CredentialRedactor } from "../../packages/opencorvus/script/real-provider-audit"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-10/source-whole-265-live-01"
const evidence = process.argv[2]
if (!evidence || !path.isAbsolute(evidence)) throw new Error("Exact absolute archive output required")
const label = "source-whole-265-live-01"
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const write = async (name: string, value: unknown) => fs.writeFile(path.join(evidence, name), redactor.redact(JSON.stringify(value, null, 2)) + "\n", { flag: "wx" })
for (const name of ["startup.json", "launch-owner.json"]) await fs.writeFile(path.join(evidence, `${label}-${name}`), redactor.redact(await fs.readFile(path.join(run, name), "utf8")), { flag: "wx" })
for (const name of ["native-host-ready.json", "native-host-settled.json", "preflight-ready.json", "authority-ready.json", "provider-pair-staging.json", "owned-config-hierarchy.json", "profile-selection-admitted.json", "project-baseline.json", "managed-parent-ready.json"]) {
  await fs.writeFile(path.join(evidence, `${label}-${name}`), redactor.redact(await fs.readFile(path.join(run, "evidence", name), "utf8")), { flag: "wx" })
}
for (const name of ["stdout.log", "stderr.log"]) await fs.writeFile(path.join(evidence, `${label}-${name}`), redactor.redact(await fs.readFile(path.join(run, name), "utf8")), { flag: "wx" })
const owner = JSON.parse(await fs.readFile(path.join(run, "launch-owner.json"), "utf8"))
const birth = Number(BigInt(owner.nativeTarget.processInstanceID.slice(6)) / 10000n - 62135596800000n)
const current: string[] = []
const unknown: string[] = []
const requests: unknown[] = []
for (const line of (await fs.readFile(path.join(run, "runtime/log/dev.log"), "utf8")).split(/\r?\n/)) {
  if (!line) continue
  let entry: any
  try { entry = JSON.parse(line) } catch { unknown.push(line); continue }
  const time = typeof entry.time === "string" ? Date.parse(entry.time) : NaN
  if (!Number.isFinite(time)) { unknown.push(line); continue }
  if (time < birth) continue
  current.push(line)
  if (entry.service === "server" && (entry.data?.path || entry.data?.url)) requests.push(entry)
}
await fs.writeFile(path.join(evidence, `${label}-runtime.log`), redactor.redact(current.join("\n")) + "\n", { flag: "wx" })
await fs.writeFile(path.join(evidence, `${label}-unknown-timestamp.log`), redactor.redact(unknown.join("\n")), { flag: "wx" })
await write(`${label}-http-summary.json`, { afterTargetBirthUtc: new Date(birth).toISOString(), retainedNewLines: current.length, unknownTimestampLines: unknown.length, requests, boundary: "Actual target birth and canonical event time; complete credential-redacted copies, private originals retained" })
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
  const parts = (db.query("SELECT id,message_id,data FROM part ORDER BY time_created,id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    return { id: row.id, messageID: row.message_id, type: data.type, textChars: typeof data.text === "string" ? data.text.length : undefined, time: data.time, ...(["source-url", "source-file"].includes(data.type) ? data : {}) }
  })
  const tools = db.query("SELECT id,message_id,data FROM tool_part_request ORDER BY time_created,id").all()
  const outcomes = (db.query("SELECT request_part_id,data FROM tool_part_outcome ORDER BY time_created,id").all() as any[]).map(row => {
    const data = JSON.parse(row.data)
    const output = completedToolOutcomeOutput(outputDB as any, data, () => row.request_part_id)
    return { requestPartID: row.request_part_id, outcome: data.outcome, resultAttemptID: data.resultAttemptID, outputChars: output?.length, output, metadata: data.metadata, time: data.time, failure: data.failure }
  })
  canonical = { observedAtUtc: new Date().toISOString(), access: "Actual current completed canonical SQLite readonly BEGIN/ROLLBACK; metadata and output sizes, no source mutation", sessions, messages, parts, tools, outcomes }
} finally { db.exec("ROLLBACK"); db.close() }
await write("canonical-current-conversations.json", canonical)
console.log(JSON.stringify({ archived: true, currentLogRows: current.length, unknownLogRows: unknown.length }))
