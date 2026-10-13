import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const root = path.join(repo, ".tmp-mcp-structured-result-388/live-attempt-01")
const owner = JSON.parse(await fs.readFile(path.join(root, "provider-run/launch-owner.json"), "utf8"))
const ready = JSON.parse(await fs.readFile(path.join(root, "provider-run/evidence/preflight-ready.json"), "utf8"))
assert.equal(ready.occurrence, owner.occurrence)
assert.equal(ready.preflight.credential, "usable")
assert.equal(ready.preflight.catalog, "projected")
assert.equal(ready.preflight.actualModel, "gpt-6.1-sol")
assert.equal(ready.preflight.streaming, true)
assert(owner.nativeDeadlineAt - Date.now() > 360000, "Retain at least six original minutes for Task, page and closure")
const headers = { "content-type": "application/json", "x-opencorvus-directory": owner.project }
const api = async (route, method = "GET", body) => {
  const response = await fetch(`http://127.0.0.1:18506${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) })
  const value = await response.json()
  assert.equal(response.status, 200, `Owned ${method} ${route}: ${response.status}`)
  return value
}
const mcp = JSON.parse(await fs.readFile(path.join(root, "mcp-config.json"), "utf8"))
await api("/config", "PATCH", { mcp: { publicreports: mcp } })
const input = { sourceDirectory: path.join(root, "package-source/qa/structured-reports-388"), installationScope: "project" }
const imported = await api("/expert-squad/import-folder", "POST", input)
await fs.writeFile(path.join(root, "package-import-receipt.json"), JSON.stringify({ input, status: 200, result: imported }, null, 2), { flag: "wx" })
const config = await api("/config")
assert.equal(config.prompt_profile.active, "base")
assert.deepEqual(config.mcp.publicreports, mcp)
await fs.writeFile(path.join(root, "project-default-fact.json"), JSON.stringify({ promptProfile: config.prompt_profile.active, model: config.model, project: owner.project, mcp: { publicreports: config.mcp.publicreports } }, null, 2), { flag: "wx" })
const request = await fs.readFile(path.join(root, "task-request.txt"), "utf8")
const requestID = randomUUID()
await fs.writeFile(path.join(root, "task-sent.json"), JSON.stringify({ requestID, requestSentAt: new Date().toISOString(), model: "openai/gpt-6.1-sol", promptProfile: "structured-reports-388", request }, null, 2), { flag: "wx" })
const bunDirectory = path.join(repo, ".tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64")
const cli = await promisify(execFile)(path.join(bunDirectory, "bun.exe"), [path.join(repo, "packages/opencorvus/src/index.ts"), "task", "create", "--url", "http://127.0.0.1:18506", "--dir", owner.project, "--pillar", "work", "--expert-squad", "structured-reports-388", "--request", request, "--title", "公开MCP结构化报告核对", "--model", "openai/gpt-6.1-sol", "--request-id", requestID, "--format", "json"], {
  cwd: repo, timeout: 45000, windowsHide: true,
  env: { ...process.env, OPENCORVUS_HOME: path.join(root, "client-runtime"), OPENCORVUS_TEST_HOME: path.join(root, "client-home"), OPENCORVUS_TEST_PROCESS_ROOT: root, OPENCORVUS_DISABLE_AUTOUPDATE: "1", OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1", PATH: bunDirectory + path.delimiter + process.env.PATH },
})
await fs.writeFile(path.join(root, "task-create.log"), cli.stdout, { flag: "wx" })
const accepted = JSON.parse(cli.stdout)
await fs.writeFile(path.join(root, "task-accepted.json"), JSON.stringify({ acceptedObservedAt: new Date().toISOString(), occurrence: owner.occurrence, accepted }, null, 2), { flag: "wx" })
console.log(JSON.stringify({ accepted, nativeDeadlineAt: owner.nativeDeadlineAt, remainingMs: owner.nativeDeadlineAt - Date.now(), url: "http://127.0.0.1:18506/ui" }))
