
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"
const [phase, port] = process.argv.slice(2)
assert.ok(["before","after"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const project = JSON.parse(await fs.readFile(path.join(root,"seed.json"),"utf8"))[phase]
const base = "http://127.0.0.1:" + port
const declaration = await fetch(base + "/doc")
assert.equal(declaration.status,200)
const doc = await declaration.json()
const ajv = new Ajv2020({strict:false,allErrors:true,validateFormats:false})
const checks = []
async function read(route, operationId, scoped = false) {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({...schema,components:doc.components})
  const query = scoped ? "?" + new URLSearchParams({directory:project.directory}) : ""
  const res = await fetch(base + route + query, {headers:{"x-opencorvus-directory":project.directory}})
  assert.equal(res.status,200)
  const data = await res.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({route,operationId,status:res.status,requestID:res.headers.get("x-opencorvus-request-id"),schemaValid:true})
  return data
}
const identity = await read("/project/current","project.current")
assert.equal(identity.worktree,project.directory)
const accepted = await read("/config","config.get",true)
assert.equal(accepted.permission_mode,"full_access")
assert.equal(accepted.server?.publicUrl ?? "","")
const channels = await read("/channel","channel.list",true)
assert.equal(channels.length,27)
assert.equal(new Set(channels.map(channel => channel.id)).size,27)
assert.ok(channels.some(channel => channel.id === "telegram" && channel.name === "Telegram"))
const result = {checks,project:{id:identity.id,worktree:identity.worktree},confirmedMode:accepted.permission_mode,savedPublicUrl:accepted.server?.publicUrl ?? "",channelCount:channels.length,channels:channels.map(({id,name,status,runtime_status})=>({id,name,status,runtime_status}))}
await fs.writeFile(path.join(root,phase+"-tcp.json"),JSON.stringify(result,null,2)+"\n")
console.log(JSON.stringify(result))
