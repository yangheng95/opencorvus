// Preparation only. Root owns launch, public subscription and native shutdown.
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createSseClient } from "../packages/sdk/js/src/gen/core/serverSentEvents.gen"
import { observeRuntimeProcessOccurrence } from "../packages/opencorvus/src/runtime/process-occurrence"

const args = process.argv.slice(2)
function argument(name: string) { const i = args.indexOf(`--${name}`); assert(i >= 0 && args[i + 1], `Missing --${name}`); return args[i + 1] }
const ownedRunRoot = path.resolve(argument("owned-run-root"))
const evidenceRoot = path.resolve(argument("evidence-root"))
const directory = argument("directory")
const sessionID = argument("session-id")
const ownerPath = path.resolve(argument("owner-receipt"))
const owner = JSON.parse(await fs.readFile(ownerPath, "utf8"))
const startup = JSON.parse(await fs.readFile(path.join(ownedRunRoot, "startup.json"), "utf8"))
const native = JSON.parse(await fs.readFile(path.join(ownedRunRoot, "evidence", "native-host-ready.json"), "utf8"))
assert.equal(path.resolve(owner.runRoot), ownedRunRoot)
assert.equal(startup.outcome, "listening")
assert.equal(startup.pid, native.target.pid)
assert.deepEqual(owner.nativeTarget, native.target)
assert.deepEqual(owner.host, native.host)
assert.equal(path.resolve(owner.evidence), path.join(ownedRunRoot, "evidence"))
assert.equal(owner.occurrence, native.occurrence)
assert.equal(startup.occurrenceID, native.occurrence)
assert.equal(observeRuntimeProcessOccurrence(native.target), "exact_live")
const base = new URL(startup.url)
assert.equal(base.hostname, "127.0.0.1")
assert.equal(base.port, "18016")
const receipt: Record<string, unknown> = { ownedRunRoot, directory, sessionID, pid: startup.pid, occurrence: native.occurrence, requests: [], frames: [], generatorSettled: false, settlementScope: "SDK async generator only; native whole-chain settlement is Root-owned" }
const requests = receipt.requests as unknown[]
const frames = receipt.frames as unknown[]
const controller = new AbortController()
const timer = setTimeout(() => controller.abort(new Error("Owned checker bounded 20s budget exhausted")), 20_000)
let streamTask: Promise<void> | undefined
let failure: unknown
async function save() { await fs.writeFile(path.join(evidenceRoot, "native-http-receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx" }) }
function assertOwner() { assert.equal(observeRuntimeProcessOccurrence(native.target), "exact_live", "Target occurrence changed") }
async function get(endpoint: string) {
  assertOwner()
  const url = new URL(endpoint, base)
  const response = await fetch(url, { signal: controller.signal })
  const data = await response.json()
  requests.push({ path: url.pathname + url.search, status: response.status, headers: Object.fromEntries(response.headers), data })
  assertOwner()
  return { response, data }
}
try {
  const health = await get("global/health")
  assert.equal(health.response.status, 200)
  assert.equal(health.data.healthy, true)
  assert.equal(path.resolve(health.data.paths.database), path.resolve(owner.runtime, "data/opencorvus.db"))
  const query = new URLSearchParams({ directory, tail_limit: "1" })
  const tail = await get(`session/${sessionID}/conversation?${query}`)
  assert.equal(tail.response.status, 200)
  const text = (data: any) => data.transcript.flatMap((message: any) => message.parts.filter((part: any) => part.type === "text").map((part: any) => part.text)).join("\n")
  assert.equal(text(tail.data).trim(), "OK")
  const history = tail.data.history
  assert.equal(typeof history.oldestTimestamp, "number")
  assert.equal(typeof history.oldestOrderKey, "string")
  assert.equal(typeof history.oldestMessageID, "string")
  const pageQuery = new URLSearchParams({ directory, before: String(history.oldestTimestamp), before_order_key: history.oldestOrderKey, before_id: history.oldestMessageID, limit: "20" })
  const page = await get(`session/${sessionID}/conversation/history?${pageQuery}`)
  assert.equal(page.response.status, 200)
  assert.equal(text(page.data).trim(), "Reply with OK.")
  const expectedMessages = [...page.data.transcript, ...tail.data.transcript].map((message: any) => ({ id: message.info.id, role: message.info.role, text: text({ transcript: [message] }) }))
  assert.equal(expectedMessages.length, 2)
  assert.equal(new Set(expectedMessages.map((message) => message.id)).size, 2)
  receipt.expectedMessages = expectedMessages
  const config = await get(`session/${sessionID}/config?${new URLSearchParams({ directory })}`)
  assert.equal(config.response.status, 400)
  assert.equal(config.data.name, "ProviderModelNotFoundError")
  let connected = false
  let terminal = false
  const stream = createSseClient({ url: new URL(`session/${sessionID}/events?${new URLSearchParams({ directory })}`, base).href, signal: controller.signal, sseMaxRetryAttempts: 1,
    fetch: async (request) => { assertOwner(); const response = await fetch(request); requests.push({ path: new URL(request.url).pathname, status: response.status, headers: Object.fromEntries(response.headers) }); assert.equal(response.status, 200); return response },
    onSseEvent(frame) { frames.push(frame) },
    onSseError(error) { throw error },
  }).stream
  streamTask = (async () => {
    for await (const event of stream) {
      const value = event as any
      if (value.type === "session.connected") {
        assert.equal(value.session_id, sessionID)
        assert.equal(value.payload.sessionID, sessionID)
        const snapshot = value.payload.conversationSnapshot
        assert.equal(snapshot.transcript.length, 2)
        const actualMessages = snapshot.transcript.map((message: any) => ({ id: message.info.id, role: message.info.role, text: text({ transcript: [message] }) }))
        assert.deepEqual(actualMessages, expectedMessages)
        receipt.connected = { eventID: value.event_id, sessionID: value.session_id, messages: actualMessages }
        connected = true
      }
      if (value.type === "agent.execution.lifecycle" && value.session_id === sessionID && value.payload?.status?.type === "terminal") {
        assert.equal(typeof value.event_id, "string")
        receipt.terminal = { eventID: value.event_id, sessionID: value.session_id, status: value.payload.status }
        terminal = true
      }
      if (connected && terminal) { controller.abort("qualified-owned-subscription"); break }
    }
  })()
  await streamTask
  assert.equal(connected, true)
  assert.equal(terminal, true, "Actual canonical terminal not observed; no manufactured terminal qualification")
  assertOwner()
  receipt.outcome = "qualified"
} catch (error) { failure = error; receipt.outcome = "failed"; receipt.error = { name: error instanceof Error ? error.name : "Unknown", message: error instanceof Error ? error.message : String(error) } }
finally {
  controller.abort("owned-reader-cleanup")
  if (streamTask) await Promise.allSettled([streamTask])
  receipt.generatorSettled = true
  clearTimeout(timer)
  await save()
}
if (failure) throw failure
