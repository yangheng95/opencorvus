import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk"

const [run, evidence] = process.argv.slice(2)
assert.equal(run, "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-07/dock-width-before-103-02")
assert.equal(evidence, "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/dock-width-103/before-02")
const read = async (file: string) => JSON.parse(await fs.readFile(file, "utf8"))
const owner = await read(path.join(run, "launch-owner.json"))
const preflight = await read(path.join(run, "evidence/preflight-ready.json"))
const profile = await read(path.join(run, "evidence/profile-selection-admitted.json"))
assert.equal(preflight.occurrence, owner.occurrence)
assert.deepEqual(preflight.preflight.credential, "usable")
assert.equal(preflight.preflight.catalog, "projected")
assert.equal(preflight.preflight.actualModel, "gpt-6.1-sol")
assert.equal(preflight.preflight.streaming, true)
assert.equal(profile.profileID, "base")
assert.equal(profile.namespace, "builtin")
assert.equal(owner.port, 18055)
assert.equal(path.resolve(owner.runRoot), path.resolve(run))
assert.equal(path.resolve(owner.settlementEvidenceRoot), path.resolve(evidence))
const requestSentAt = new Date().toISOString()
const input = {
  productPillar: "code" as const,
  promptProfile: profile.profileID as string,
  model: "openai/gpt-6.1-sol",
  title: "Sources dock desktop width103",
  request: "请使用 Base 的只读 researcher 访问 https://www.w3.org/WAI/fundamentals/accessibility-intro/ 和 https://www.w3.org/WAI/tips/designing/ 两个公开页面。核对网页可访问性与设计提示的关系，只输出简短中文结论和实际来源。无需修改项目或执行代码；保留真实工具产生的来源。",
  source: "product-experience-dock-width-103",
  requestID: crypto.randomUUID(),
}
await fs.writeFile(path.join(evidence, "actual-current-task-request.json"), JSON.stringify({ requestSentAt, directory: owner.project, input }, null, 2), { flag: "wx" })
const client = createOpenCorvusClient({ baseUrl: "http://127.0.0.1:18055", directory: owner.project })
const result = await client.task.create(input)
await fs.writeFile(path.join(evidence, "actual-current-task-response.json"), JSON.stringify({ status: result.response?.status, data: result.data, error: result.error }, null, 2), { flag: "wx" })
assert.equal(result.response?.status, 202)
assert(result.data?.task_id && result.data.project_id)
assert.equal(result.data.directory, owner.project)
const selection = { occurrence: owner.occurrence, taskID: result.data.task_id, projectID: result.data.project_id, directory: result.data.directory, requestID: input.requestID, requestSentAt, acceptedObservedAt: new Date().toISOString() }
await fs.writeFile(path.join(evidence, "actual-current-task-selection.json"), JSON.stringify(selection, null, 2), { flag: "wx" })
const stage = owner.taskSelectionPath + "." + crypto.randomUUID() + ".stage"
await fs.writeFile(stage, JSON.stringify(selection, null, 2), { flag: "wx" })
assert.equal(await fs.stat(owner.taskSelectionPath).then(() => true, (error) => { if (error.code === "ENOENT") return false; throw error }), false)
await fs.rename(stage, owner.taskSelectionPath)
console.log(JSON.stringify(selection, null, 2))
