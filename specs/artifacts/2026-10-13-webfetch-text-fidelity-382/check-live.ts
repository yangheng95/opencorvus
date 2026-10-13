import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"
import { completedToolOutcomeOutput } from "../packages/opencorvus/src/session/tool-outcome-facts"
import { CredentialRedactor } from "../packages/opencorvus/script/real-provider-audit"

const root = import.meta.dir
const run = path.join(root, "provider-run")
const chat = JSON.parse(await fs.readFile(path.join(root, "chat-accepted.json"), "utf8"))
const input = JSON.parse(await fs.readFile(path.join(root, "chat-input.json"), "utf8"))
const documents = JSON.parse(await fs.readFile(path.join(root, "resource-documents-02.json"), "utf8"))
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(await fs.readFile("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
const productionRequire = createRequire(path.resolve(root, "../packages/opencorvus/package.json"))
const { drizzle } = await import(productionRequire.resolve("drizzle-orm/bun-sqlite"))
const db = new Database(path.join(run, "runtime/data/opencorvus.db"), { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const session = db.query("SELECT id,directory,kind FROM session WHERE id=?").get(chat.session.id)
  const messages = (db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(chat.session.id) as any[])
    .map((row) => ({ id: row.id, ...JSON.parse(row.data) }))
  const parts = (db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(chat.session.id) as any[])
    .map((row) => ({ id: row.id, messageID: row.message_id, ...JSON.parse(row.data) }))
  const toolRows = db.query("SELECT r.id,r.message_id,r.data,o.data AS outcome_data FROM tool_part_request r JOIN tool_part_outcome o ON o.request_part_id=r.id JOIN message m ON m.id=r.message_id WHERE m.session_id=? ORDER BY r.time_created,r.id").all(chat.session.id) as any[]
  const outputDB = drizzle({ client: db })
  const tools = toolRows.map((row) => {
    const outcome = JSON.parse(row.outcome_data)
    return { id: row.id, messageID: row.message_id, request: JSON.parse(row.data), outcome,
      output: completedToolOutcomeOutput(outputDB as any, outcome, () => row.id) }
  })
  assert.equal(session?.id, chat.session.id)
  assert.equal(session?.directory, chat.session.directory)
  const userParts = parts.filter((part) => part.messageID === chat.messageID && part.type === "text")
  assert.deepEqual(userParts.map((part) => part.text), [input.text])
  assert.equal(tools.length, 2)
  const sources = parts.filter((part) => part.type === "source-url")
  const observations = []
  for (const [resourcePath, document] of Object.entries(documents) as Array<[string, any]>) {
    const url = `http://127.0.0.1:18497${resourcePath}`
    const matching = tools.filter((tool) => tool.request.tool === "webfetch" && tool.request.input.url === url)
    assert.equal(matching.length, 1)
    const tool = matching[0]!
    assert.deepEqual(tool.request.input, { url, format: "markdown" })
    assert.equal(tool.outcome.outcome, "completed")
    assert.equal(tool.output, document.expected)
    const bytes = Buffer.byteLength(document.expected, "utf8")
    assert.deepEqual(tool.outcome.metadata, { originalBytes: bytes, shownBytes: bytes,
      webfetchOutputClipped: false, webfetchEmbeddedAttachmentCount: 0, truncated: false })
    const source = sources.filter((part) => part.url === url && part.messageID === tool.messageID)
    assert.equal(source.length, 1)
    assert.equal(source[0].title, document.title)
    assert.equal(source[0].provider, "opencorvus-webfetch")
    observations.push({ resourcePath, toolPartID: tool.id, messageID: tool.messageID, bytes,
      sourcePartID: source[0].id, sourceTitle: source[0].title, exactBody: true, exactMetadata: true })
  }
  const final = messages.filter((message) => message.role === "assistant" && message.parentID === chat.messageID && message.finish === "stop")
  assert.equal(final.length, 1)
  assert(final[0].time.completed >= final[0].time.created)
  assert.equal(final[0].providerID, "openai")
  assert.equal(final[0].modelID, "gpt-6.1-sol")
  const reply = parts.filter((part) => part.messageID === final[0].id && part.type === "text").map((part) => part.text).join("\n")
  assert(reply.includes("http://127.0.0.1:18497/article.html") && reply.includes("http://127.0.0.1:18497/article.md"))
  canonical = { session, messages, parts, tools, observations, finalMessageID: final[0].id }
} finally { db.exec("ROLLBACK"); db.close() }

const auditNames = (await fs.readdir(path.join(run, "evidence"))).filter((name) => /^provider-.*-\d+\.json$/.test(name))
const audited = await Promise.all(auditNames.map(async (name) => ({ name, value: JSON.parse(await fs.readFile(path.join(run, "evidence", name), "utf8")) })))
audited.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const audit = audited.at(-1)!.value
assert.equal(audit.model, "gpt-6.1-sol")
assert(audit.requests.length > 0 && audit.requests.length <= 12)
for (const request of audit.requests) {
  assert.equal(request.model, "gpt-6.1-sol")
  assert.equal(request.streaming, true)
  assert.equal(request.status, 200)
  assert.equal(request.response_reader.state, "settled")
  assert.equal(request.response_reader.terminal.kind, "eof")
}
const owner = JSON.parse(await fs.readFile(path.join(run, "launch-owner.json"), "utf8"))
assert.equal(audit.pid, owner.nativeTarget.pid)
const result = { observedAt: new Date().toISOString(), passed: true, access: "Read-only canonical SQLite BEGIN/ROLLBACK and production completedToolOutcomeOutput",
  sessionID: chat.session.id, finalMessageID: canonical.finalMessageID, tools: canonical.observations,
  providerRequests: audit.requests.length, model: audit.model, streaming: true, everyRequestHTTP200AndEOF: true,
  nativeDeadlineAt: owner.nativeDeadlineAt, boundary: "Backend acceptance only; desktop visual and native physical shutdown remain separately required" }
await fs.writeFile(path.join(root, "live-canonical.json"), redactor.redact(JSON.stringify(canonical, null, 2)) + "\n", { flag: "wx" })
await fs.writeFile(path.join(root, "live-provider-audit.json"), redactor.redact(JSON.stringify(audit, null, 2)) + "\n", { flag: "wx" })
await fs.writeFile(path.join(root, "live-check.json"), JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify(result, null, 2))
