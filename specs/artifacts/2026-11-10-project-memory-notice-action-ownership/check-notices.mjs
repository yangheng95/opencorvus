import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [phase, port, label, flags] = process.argv.slice(2)
assert.ok(["before", "after"].includes(phase) && /^[01]{2}$/.test(flags))
const root = path.dirname(fileURLToPath(import.meta.url))
const seeds = JSON.parse(await fs.readFile(path.join(root,phase+"-seed.json"),"utf8"))
const base = "http://127.0.0.1:" + port
const declaration = await fetch(base + "/doc")
assert.equal(declaration.status, 200)
const doc = await declaration.json()
const ajv = new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const results = []
for (let i = 0; i < seeds.length; i++) {
  const seed = seeds[i]
  const checks = []
  async function read(route, operationId) {
    const op = doc.paths[route].get
    assert.equal(op.operationId, operationId)
    const schema = op.responses["200"].content["application/json"].schema
    const validate = ajv.compile({...schema,components:doc.components})
    const res = await fetch(base + route + "?" + new URLSearchParams({directory:seed.directory}), {headers:{"x-opencorvus-directory":seed.directory}})
    assert.equal(res.status,200)
    const data = await res.json()
    assert.ok(validate(data),JSON.stringify(validate.errors))
    checks.push({route,operationId,status:res.status,requestID:res.headers.get("x-opencorvus-request-id"),schemaValid:true})
    return data
  }
  const project = await read("/project/current","project.current")
  assert.equal(project.id,seed.projectID)
  assert.equal(project.worktree,seed.directory)
  const memory = await read("/experimental/project-memory","experimental.projectMemory.get")
  assert.deepEqual(memory.notice,{status:seed.status,message:seed.message,generation:seed.generation,acknowledged:flags[i] === "1"})
  assert.equal(memory.revision,0)
  assert.equal(memory.pendingCount,0)
  results.push({project:{id:project.id,directory:project.worktree},checks,notice:memory.notice,revision:memory.revision,pendingCount:memory.pendingCount,content:memory.content})
}
await fs.writeFile(path.join(root,phase+"-"+label+"-tcp.json"),JSON.stringify(results,null,2)+"\n")
console.log(JSON.stringify(results.map(x=>({project:x.project.id, notice:x.notice}))))