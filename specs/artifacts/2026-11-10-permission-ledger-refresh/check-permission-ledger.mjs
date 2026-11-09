
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [phase, port] = process.argv.slice(2)
assert.ok(["before","after"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(await fs.readFile(path.join(root,"seed.json"),"utf8"))[phase]
const base = "http://127.0.0.1:" + port
const declaration = await fetch(base + "/doc")
assert.equal(declaration.status,200)
const doc = await declaration.json()
const ajv = new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const checks = []
async function read(route, operationId, projectScoped = true) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const validate = ajv.compile({...op.responses["200"].content["application/json"].schema,components:doc.components})
  const query = projectScoped ? "?" + new URLSearchParams({directory:fixture.directory}) : ""
  const res = await fetch(base+route+query,{headers:{"x-opencorvus-directory":fixture.directory}})
  assert.equal(res.status,200)
  const data = await res.json()
  assert.ok(validate(data),JSON.stringify(validate.errors))
  checks.push({route,operationId,status:res.status,requestID:res.headers.get("x-opencorvus-request-id"),schemaValid:true})
  return data
}
const project = await read("/project/current","project.current",false)
assert.equal(project.worktree,fixture.directory)
const grants = await read("/permission/grants","permission.grants")
const history = await read("/permission/history","permission.history")
const pending = await read("/permission","permission.list")
assert.deepEqual({grants, history, pending}, {grants: [],history:[],pending:[]})
const result = {checks,project:{id:project.id,worktree:project.worktree},accepted:{grants:grants.length,history:history.length,pending:pending.length}}
await fs.writeFile(path.join(root,phase+"-tcp.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result))
