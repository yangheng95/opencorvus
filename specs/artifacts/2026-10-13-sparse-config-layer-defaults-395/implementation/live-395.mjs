import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"

const root = process.argv[2]
const mode = process.argv[3]
const helperRoot = path.dirname(fileURLToPath(import.meta.url))
assert(root && path.isAbsolute(root), "Required absolute scope directory")
assert.equal(path.dirname(path.resolve(root)), helperRoot)
assert(["start", "send", "observe"].includes(mode), "Explicit start/send/observe mode required")
const require = createRequire(path.join(helperRoot, "../packages/opencorvus/package.json"))
const { parse } = require("jsonc-parser")
const json = async (name) => JSON.parse(await fs.readFile(path.join(root, name), "utf8"))
const record = (name, value) => fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" })
const owner = await json("provider-run/launch-owner.json")
const preflight = await json("provider-run/evidence/preflight-ready.json")
assert.equal(path.resolve(owner.runtime), path.join(root, "provider-run/runtime"))
assert.equal(owner.qualificationKind, "NativeService")
assert.equal(owner.requestBudget, 20)
assert.equal(owner.inactivityMilliseconds, 180000)
assert.equal(owner.handleAdmissionMilliseconds, 600000)
assert(owner.nativeDeadlineAt > owner.targetBirthAtMs && owner.nativeDeadlineAt - owner.targetBirthAtMs <= 600000)
const native = await json("provider-run/evidence/native-host-ready.json")
assert.equal(native.occurrence, owner.occurrence)
assert.equal(native.deadlineAt, owner.nativeDeadlineAt)
assert.deepEqual(owner.profileSelection, { kind: "builtin", namespace: "builtin", id: "base" })
assert.equal(preflight.occurrence, owner.occurrence)
assert.deepEqual(preflight.preflight && {
  credential: preflight.preflight.credential, catalog: preflight.preflight.catalog,
  model: preflight.preflight.actualModel, streaming: preflight.preflight.streaming,
}, { credential: "usable", catalog: "projected", model: "gpt-6.1-sol", streaming: true })
const base = `http://127.0.0.1:${owner.port}`
const closeBy = owner.nativeDeadlineAt - 60000
const pageReserveAt = owner.nativeDeadlineAt - 180000
const selection = (config) => ({ model: config.model, profile: config.prompt_profile?.active, permission: config.permission_mode, username: config.username })
const inherited = (config) => assert.deepEqual({ profile: config.prompt_profile?.active, permission: config.permission_mode }, { profile: "base", permission: "ask" })
const api = async (route, method = "GET", body, directory, timeout = 30000) => {
  assert(closeBy > Date.now(), "Original close boundary reached; root must settle original owner")
  if (directory) assert(/^[\x20-\x7e]+$/.test(directory), "This reviewed header contract uses an ASCII-owned scope")
  const response = await fetch(base + route, {
    method, headers: { "content-type": "application/json", ...(directory ? { "x-opencorvus-directory": directory } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(Math.min(timeout, closeBy - Date.now())),
  })
  const text = await response.text()
  let value
  try { value = JSON.parse(text) } catch { value = { invalidJson: true, status: response.status } }
  return { status: response.status, observedAt: new Date().toISOString(), result: value }
}
async function ownedSession(ready) {
  const projects = await fs.realpath(path.join(owner.runtime, "data/projects"))
  const actual = await fs.realpath(ready.directory)
  const relative = path.relative(projects, actual)
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative))
  const response = await api(`/session/${ready.sessionID}`, "GET", undefined, ready.directory)
  assert.equal(response.status, 200)
  assert.equal(response.result.projectID, ready.projectID)
  assert.equal(path.resolve(response.result.directory), path.resolve(actual))
  assert.equal(response.result.metadata.conversation.experience, "chat")
  assert.equal(response.result.metadata.configOverlay.prompt_profile.active, "base")
  return response.result
}
async function sourceFacts(directory) {
  const file = path.join(directory, ".opencorvus/opencorvus.jsonc")
  const errors = []
  const text = await fs.readFile(file, "utf8").catch((error) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  const source = text === undefined || text.trim() === "" ? {} : parse(text, errors, { allowTrailingComma: true })
  assert.deepEqual(errors, [])
  return {
    file, exists: text !== undefined, keys: Object.keys(source).sort(), username: source.username,
    profileSource: Object.hasOwn(source, "prompt_profile") ? "project" : "global",
    permissionSource: Object.hasOwn(source, "permission_mode") ? "project" : "global",
  }
}
try {
  if (mode === "start") {
    assert(owner.nativeDeadlineAt - Date.now() >= 240000, "Two-turn business admission needs four original minutes")
    const before = await api("/global/config")
    assert.equal(before.status, 200)
    assert.equal(before.result.prompt_profile.active, "base")
    assert.equal(before.result.model, "openai/gpt-6.1-sol")
    const globalPatch = { permission_mode: "ask" }
    const global = await api("/global/config", "PATCH", globalPatch)
    assert.equal(global.status, 200)
    inherited(global.result)
    await record("global-config-facts.json", { occurrence: owner.occurrence, before: selection(before.result), patch: globalPatch, after: selection(global.result) })
    const request = { requestID: randomUUID(), model: "openai/gpt-6.1-sol", text: "我想核对一份公开表格，稍后会给你文件路径。请先简短确认可以根据文件原文核对各行和合计。" }
    await record("global-chat-start-request.json", request)
    const accepted = await api("/global/chat/start", "POST", request)
    await record("global-chat-start-response.json", accepted)
    assert.equal(accepted.status, 202)
    assert.equal(accepted.result.requestID, request.requestID)
    const session = accepted.result.session
    const ready = { occurrence: owner.occurrence, sessionID: session.id, projectID: session.projectID, directory: session.directory, initialMessageID: accepted.result.messageID, requestID: request.requestID, nativeDeadlineAt: owner.nativeDeadlineAt, pageReserveAt, closeBy, url: `${base}/ui` }
    await ownedSession(ready)
    await record("ready.json", ready)
    console.log(JSON.stringify({ readyForPage: true, ...ready }))
    let completed
    while (Date.now() < pageReserveAt) {
      const messages = await api(`/session/${session.id}/message`, "GET", undefined, session.directory)
      assert.equal(messages.status, 200)
      const failed = messages.result.find((item) => item.info.parentID === ready.initialMessageID && item.info.error)
      if (failed) {
        await record("first-assistant-error.json", failed)
        throw new Error("Initial actual assistant reported an error; canonical observation preserved")
      }
      completed = messages.result.find((item) => item.info.parentID === ready.initialMessageID && item.info.finish === "stop" && Number.isFinite(item.info.time.completed))
      if (completed) break
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    assert(completed, "First turn must complete before the reserved page window")
    assert.equal(completed.info.providerID, "openai")
    assert.equal(completed.info.modelID, "gpt-6.1-sol")
    await record("first-completed.json", completed)
    const sourceBefore = await sourceFacts(session.directory)
    const patch = { username: "Config 395 public project" }
    const updated = await api("/config", "PATCH", patch, session.directory)
    assert.equal(updated.status, 200)
    inherited(updated.result)
    const read = await api("/config", "GET", undefined, session.directory)
    assert.equal(read.status, 200)
    inherited(read.result)
    const sourceAfter = await sourceFacts(session.directory)
    assert.equal(sourceAfter.profileSource, "global")
    assert.equal(sourceAfter.permissionSource, "global")
    assert.equal(sourceAfter.username, patch.username)
    await record("project-config-facts.json", { occurrence: owner.occurrence, sourceBefore, patch, sourceAfter, actual: selection(read.result) })
    console.log(JSON.stringify({ readyForSettingsAndSend: true, ...ready, remainingMs: owner.nativeDeadlineAt - Date.now() }))
  } else {
    const ready = await json("ready.json")
    assert.equal(ready.occurrence, owner.occurrence)
    await ownedSession(ready)
    if (mode === "send") {
      assert(owner.nativeDeadlineAt - Date.now() >= 180000, "Follow-up needs three original minutes")
      const facts = await json("project-config-facts.json")
      assert.equal(facts.sourceAfter.permissionSource, "global")
      const current = await api("/config", "GET", undefined, ready.directory)
      assert.equal(current.status, 200)
      inherited(current.result)
      const publicPath = await fs.realpath(path.join(root, "public-external.csv"))
      const relative = path.relative(ready.directory, publicPath)
      assert(relative.startsWith("..") || path.isAbsolute(relative), "Public sample must actually be outside the assigned project")
      const request = { messageID: `msg_${randomUUID()}`, agent: "chat", model: { providerID: "openai", modelID: "gpt-6.1-sol" }, parts: [{ type: "text", text: `请用文件读取功能查看这份公开CSV：${publicPath}。它位于当前会话项目之外；如出现授权请求，请等待我在界面确认。读取后用中文说明批次代号、两行项目及各自数量、合计，并引用原文件。` }] }
      await record("public-message-request.json", request)
      console.log(JSON.stringify({ waitingForRootPermissionUI: true, ...ready, messageID: request.messageID, publicPath }))
      const response = await api(`/session/${ready.sessionID}/message`, "POST", request, ready.directory, closeBy - Date.now())
      await record("public-message-response.json", response)
      assert.equal(response.status, 200)
      console.log(JSON.stringify({ submitted: true, sessionID: ready.sessionID, remainingMs: owner.nativeDeadlineAt - Date.now(), boundary: "HTTP result alone does not prove completed tool or assistant; run checker." }))
    } else {
      const pending = await api("/permission", "GET", undefined, ready.directory)
      const messages = await api(`/session/${ready.sessionID}/message`, "GET", undefined, ready.directory)
      await record(`observation-${Date.now()}.json`, { occurrence: owner.occurrence, pending, messages })
      console.log(JSON.stringify({ pending: pending.result.filter((item) => item.sessionID === ready.sessionID), messages: messages.result.map((item) => ({ id: item.info.id, role: item.info.role, finish: item.info.finish, completedAt: item.info.time.completed, error: item.info.error?.name })), remainingMs: owner.nativeDeadlineAt - Date.now(), closeBy }, null, 2))
    }
  }
} catch (error) {
  await record(`helper-failure-${mode}-${Date.now()}.json`, { occurrence: owner.occurrence, mode, observedAt: new Date().toISOString(), error: String(error), nativeDeadlineAt: owner.nativeDeadlineAt, closeBy, boundary: "Helper failure is not cancellation; root must settle the original native owner." })
  throw error
}
