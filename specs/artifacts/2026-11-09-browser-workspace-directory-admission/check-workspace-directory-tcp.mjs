import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [root, port] = process.argv.slice(2)
const endpoint = "http://127.0.0.1:" + port
const docResponse = await fetch(endpoint + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const route = "/global/projects/check-directory"
const operation = doc.paths[route].get
assert.equal(operation.operationId, "global.projects.checkDirectory")
const receipts=[]
async function request(pathname, query, status) {
  const response = await fetch(endpoint + pathname + "?" + new URLSearchParams(query))
  assert.equal(response.status, status)
  const data = await response.json()
  const schema = doc.paths[pathname].get.responses[status].content["application/json"].schema
  const validate = new Ajv2020({ strict:false, validateFormats:false }).compile({ ...schema, components:doc.components })
  assert.ok(validate(data), JSON.stringify(validate.errors))
  receipts.push({ route: pathname, query, status, requestID: response.headers.get("x-opencorvus-request-id"), data })
  return data
}
const original = path.join(root, "project-after")
const target = path.join(root, "target-after")
const inventory = await request("/work-ledger", {limit:"80"}, 200)
assert.deepEqual(inventory.rows.map(row=>[row.kind,row.directory]), [["project",original]])
assert.deepEqual(await request(route, {path: target + path.sep + "."}, 200), {directory:target})
for (const [name,reason] of [["missing-owned-folder","missing"],["project-after/note.txt","not-directory"]]) {
  const selected = path.join(root,name)
  const data = await request(route, {path:selected}, 400)
  assert.equal(data.name, "ProjectDirectoryIntegrityError")
  assert.equal(data.data.reason,reason)
  assert.equal(data.data.directory,selected)
}
const relative = await request(route, {path:"owned-relative-109"}, 400)
assert.equal(relative.success,false)
assert.deepEqual(relative.error.map(issue=>[issue.path,issue.message]), [[["path"],"Expected an absolute server directory"]])
const afterChecks = await request("/work-ledger", {limit:"80"}, 200)
assert.deepEqual(afterChecks,inventory)
await fs.writeFile(path.join(root,"after-directory-contract.json"),JSON.stringify({operation:operation.operationId,receipts},null,2)+"\n")
console.log(JSON.stringify({operation:operation.operationId,receipts:receipts.map(({route,status,requestID,data})=>[route,status,requestID,data.name??data.directory??data.rows?.length])}))
