import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port, action] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase) && ["seed", "settled", "reveal", "settled-new"].includes(action))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, phase + "-seed.json"), "utf8"))
const base = "http://127.0.0.1:" + port
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const checks = []
async function operation(route, method, operationId, body) {
  const declaration = doc.paths[route][method]
  assert.equal(declaration.operationId, operationId)
  const schema = declaration.responses["200"].content["application/json"].schema
  const validate = ajv.compile({...schema,components:doc.components})
  const query = "?" + new URLSearchParams({ directory: seed.directory })
  const res = await fetch(base + route.replace("{taskID}", seed.taskID) + query, {
    method: method.toUpperCase(),
    headers: { "Content-Type": "application/json", "x-opencorvus-directory": seed.directory },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  assert.equal(res.status, 200, JSON.stringify(data))
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({route, operationId, status:res.status, requestID:res.headers.get("x-opencorvus-request-id"), schemaValid:true})
  return data
}
const project = await operation("/project/current", "get", "project.current")
assert.equal(project.id, seed.projectID)
assert.equal(project.worktree, seed.directory)
const task = await operation("/task/{taskID}", "get", "task.get")
assert.equal(task.id, seed.taskID)
assert.equal(task.status, "completed")
assert.equal(task.title, seed.title)
const url = base + "/ui/?preview=owned-" + phase + (["reveal", "settled-new"].includes(action) ? "-new" : "")
const viewports = [{ id: "desktop", labelKey: "desktop", width: 1280, height: 720 }]
const published = ["seed", "reveal"].includes(action) ? await operation("/task/{taskID}/browser-preview/target", "put", "browserPreview.selectTaskTarget", {url,viewports}) : undefined
const accepted = await operation("/task/{taskID}/browser-preview", "get", "browserPreview.taskTarget")
assert.equal(accepted.taskID, seed.taskID)
assert.equal(accepted.status, "ready")
assert.equal(accepted.url, url)
assert.ok(accepted.id)
assert.deepEqual(accepted.viewports, viewports)
if (published) assert.equal(published.id, accepted.id)
const result = { checks, project: { id:project.id, worktree:project.worktree }, task: { id:task.id, title:task.title, status:task.status }, accepted }
await fs.writeFile(path.join(root,phase + "-" + action + "-tcp.json"),JSON.stringify(result,null,2) + "\n")
console.log(JSON.stringify(result))