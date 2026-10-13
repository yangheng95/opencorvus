import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { Database } from "bun:sqlite"

const root = process.argv[2]
assert(root && path.isAbsolute(root), "Required absolute scope root")
assert.equal(path.dirname(path.resolve(root)), import.meta.dir)
const json = async (name: string) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const record = (name: string, value: unknown) => fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" })
const owner = await json("provider-run/launch-owner.json")
const ready = await json("ready.json")
const sent = await json("public-message-request.json")
const first = await json("global-chat-start-request.json")
const accepted = await json("global-chat-start-response.json")
assert.equal(path.resolve(owner.runtime), path.join(root, "provider-run/runtime"))
assert.equal(ready.occurrence, owner.occurrence)
assert.equal(accepted.status, 202)
assert.equal(accepted.result.requestID, first.requestID)
assert.equal(accepted.result.session.id, ready.sessionID)
assert.equal(accepted.result.messageID, ready.initialMessageID)
const projects = await fs.realpath(path.join(owner.runtime, "data/projects"))
const directory = await fs.realpath(ready.directory)
const relative = path.relative(projects, directory)
assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
const publicPath = await fs.realpath(path.join(root, "public-external.csv"))
const expectedBytes = Buffer.from("batch,item,quantity\nCEDAR395,Maple,3\nCEDAR395,Iris,4\n", "utf8")
assert.deepEqual(await fs.readFile(publicPath), expectedBytes)

// Bind imports to the exact existing owned runtime; never read auth.json/models.json.
process.env.OPENCORVUS_HOME = owner.runtime
process.env.OPENCORVUS_DISABLE_AUTOUPDATE = "1"
const { projectToolPartInTransaction } = await import("../packages/opencorvus/src/session/tool-part-facts")
const { ToolPartRequestTable } = await import("../packages/opencorvus/src/session/session.sql")
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { drizzle } = await import(require.resolve("drizzle-orm/bun-sqlite"))
const { parse } = require("jsonc-parser")
const readSource = async (filename: string) => {
  const issues: any[] = []
  const value = parse(await fs.readFile(filename, "utf8"), issues, { allowTrailingComma: true })
  assert.deepEqual(issues, [])
  return value
}
const global = await readSource(path.join(owner.runtime, "config/opencorvus.jsonc"))
const source = await readSource(path.join(directory, ".opencorvus/opencorvus.jsonc"))
const configResponse = await fetch(`http://127.0.0.1:${owner.port}/config`, { headers: { "x-opencorvus-directory": ready.directory }, signal: AbortSignal.timeout(10000) })
const config = await configResponse.json()
const db = new Database(path.join(owner.runtime, "data/opencorvus.db"), { readonly: true })
let canonical: any
try {
  db.exec("BEGIN")
  const session = db.query("SELECT * FROM session WHERE id=?").get(ready.sessionID) as any
  const allocation = db.query("SELECT * FROM global_creation_allocation WHERE kind='global_chat_start' AND request_id=?").get(first.requestID)
  const project = db.query("SELECT id,worktree FROM project WHERE id=?").get(ready.projectID)
  const messages = db.query("SELECT id,data FROM message WHERE session_id=? ORDER BY time_created,id").all(ready.sessionID).map((row: any) => ({ id: row.id, ...JSON.parse(row.data) }))
  const parts = db.query("SELECT p.id,p.message_id,p.data FROM part p JOIN message m ON m.id=p.message_id WHERE m.session_id=? ORDER BY p.time_created,p.id").all(ready.sessionID).map((row: any) => ({ id: row.id, messageID: row.message_id, ...JSON.parse(row.data) }))
  const outputDB = drizzle({ client: db })
  const ids = new Set(messages.map((item: any) => item.id))
  const tools = outputDB.select().from(ToolPartRequestTable).all().filter((row: any) => ids.has(row.message_id)).map((row: any) => projectToolPartInTransaction(outputDB as any, row))
  const policy = db.query("SELECT session_id,project_id,mode,revision FROM permission_policy WHERE session_id=?").get(ready.sessionID)
  const ledger = db.query("SELECT * FROM permission_ledger WHERE request_id IN (SELECT request_id FROM permission_ledger WHERE session_id=?) ORDER BY time_created,id").all(ready.sessionID)
  canonical = { session, allocation, project, messages, parts, tools, policy, ledger }
} finally {
  db.exec("ROLLBACK")
  db.close()
}
const auditFiles = (await fs.readdir(owner.evidence)).filter((name: string) => /^provider-.*-\d+\.json$/.test(name))
const audits = await Promise.all(auditFiles.map(async (name: string) => ({ name, value: JSON.parse(await fs.readFile(path.join(owner.evidence, name), "utf8")) })))
audits.sort((a, b) => Date.parse(a.value.observedAt) - Date.parse(b.value.observedAt) || Number(a.name.match(/-(\d+)\.json$/)![1]) - Number(b.name.match(/-(\d+)\.json$/)![1]))
const actualAudit = audits.at(-1)?.value
assert(actualAudit)
// Keep only request identities and transport facts. Never archive raw Provider payloads here.
const audit = { pid: actualAudit.pid, maxRequests: actualAudit.maxRequests, exhausted: actualAudit.exhausted, requests: actualAudit.requests.map((request: any) => ({ model: request.model, streaming: request.streaming, status: request.status, readerState: request.response_reader?.state, terminal: request.response_reader?.terminal?.kind, sessionID: request.response_reader?.requestContext?.sessionID, streamRequest: request.response_reader?.requestContext?.streamRequest })) }
const selected = (value: any) => ({ model: value.model, profile: value.prompt_profile?.active, permission: value.permission_mode, username: value.username })
const configFacts = { global: selected(global), publicStatus: configResponse.status, actual: selected(config), source: { keys: Object.keys(source).sort(), username: source.username, profileOwner: Object.hasOwn(source, "prompt_profile") ? "project" : "global", permissionOwner: Object.hasOwn(source, "permission_mode") ? "project" : "global" } }
await record(`check-observation-${Date.now()}.json`, { observedAt: new Date().toISOString(), occurrence: owner.occurrence, canonical, configFacts, audit, publicFile: { path: publicPath, bytes: expectedBytes.length, rows: ["CEDAR395,Maple,3", "CEDAR395,Iris,4"] } })

assert.equal(configResponse.status, 200)
assert.deepEqual({ profile: global.prompt_profile.active, mode: global.permission_mode }, { profile: "base", mode: "ask" })
assert.deepEqual({ profile: config.prompt_profile.active, mode: config.permission_mode }, { profile: "base", mode: "ask" })
assert.equal(configFacts.source.profileOwner, "global")
assert.equal(configFacts.source.permissionOwner, "global")
assert.equal(source.username, "Config 395 public project")
assert.equal(canonical.session.project_id, ready.projectID)
assert.equal(canonical.session.directory, ready.directory)
assert.equal(canonical.allocation.accepted_target_id, ready.sessionID)
assert.equal(canonical.allocation.accepted_project_id, ready.projectID)
assert.equal(canonical.allocation.directory, ready.directory)
assert.equal(path.resolve(canonical.project.worktree), directory)
const metadata = JSON.parse(canonical.session.metadata)
assert.equal(metadata.conversation.experience, "chat")
assert.equal(metadata.globalChatStart.requestID, first.requestID)
assert.equal(metadata.configOverlay.prompt_profile.active, "base")
assert.equal(canonical.messages.find((item: any) => item.id === sent.messageID)?.role, "user")
assert.deepEqual(canonical.parts.filter((item: any) => item.messageID === sent.messageID && item.type === "text").map((item: any) => item.text), [sent.parts[0].text])
assert.deepEqual({ session: canonical.policy.session_id, project: canonical.policy.project_id, mode: canonical.policy.mode }, { session: ready.sessionID, project: ready.projectID, mode: "ask" })
const request = canonical.ledger.find((item: any) => item.event_type === "requested" && item.tool_name === "read" && JSON.parse(item.scope).resource.paths.some((candidate: string) => path.resolve(candidate) === publicPath))
assert(request, "Real external-file read must own an Ask request")
assert.equal(request.mode, "ask")
assert.equal(request.project_id, ready.projectID)
assert.equal(request.effect_class, "read_local")
const events = canonical.ledger.filter((item: any) => item.request_id === request.request_id).map((item: any) => item.event_type)
let cursor = -1
for (const expected of ["requested", "allowed_once", "execution_started", "execution_succeeded"]) {
  const at = events.indexOf(expected, cursor + 1)
  assert(at > cursor, `Real permission sequence must contain ${expected}`)
  cursor = at
}
const tool = canonical.tools.find((item: any) => item.callID === request.tool_call_id && item.messageID === request.message_id)
assert.equal(tool.tool, "read")
assert.equal(tool.state.status, "completed")
assert.equal(path.resolve(directory, tool.state.input.filePath), publicPath)
for (const row of expectedBytes.toString("utf8").trimEnd().split("\n")) assert(tool.state.output.includes(row), `Canonical read output must include actual row ${row}`)
const final = canonical.messages.findLast((item: any) => item.role === "assistant" && item.parentID === sent.messageID && item.finish === "stop" && Number.isFinite(item.time.completed))
assert(final, "Real follow-up must reach completed assistant")
assert.equal(final.providerID, "openai")
assert.equal(final.modelID, "gpt-6.1-sol")
const answer = canonical.parts.filter((item: any) => item.messageID === final.id && item.type === "text").map((item: any) => item.text).join("\n")
assert(answer.length > 0)
assert.equal(audit.pid, owner.nativeTarget.pid)
assert.equal(audit.maxRequests, 20)
assert.equal(audit.exhausted, false)
assert(audit.requests.length > 0 && audit.requests.length <= 20)
for (const request of audit.requests) assert.deepEqual({ model: request.model, streaming: request.streaming, status: request.status, reader: request.readerState, terminal: request.terminal }, { model: "gpt-6.1-sol", streaming: true, status: 200, reader: "settled", terminal: "eof" })
assert(audit.requests.some((item: any) => item.sessionID === ready.sessionID))
const result = { observedAt: new Date().toISOString(), occurrence: owner.occurrence, sessionID: ready.sessionID, projectID: ready.projectID, configFacts, permission: { requestID: request.request_id, toolCallID: tool.callID, events, mode: request.mode }, publicBytes: expectedBytes.length, model: "openai/gpt-6.1-sol", requests200EOF: audit.requests.length, assistantID: final.id, answer, boundary: "Actual native service/model/HTTP/permission/tool facts. Root separately reviews answer and Settings screenshots and settles the original owner/pair." }
await record("live-check.json", result)
console.log(JSON.stringify(result, null, 2))
