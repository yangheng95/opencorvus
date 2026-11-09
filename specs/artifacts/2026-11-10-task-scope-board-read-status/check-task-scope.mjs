import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [stage] = process.argv.slice(2)
assert.ok(["initial", "settled", "final"].includes(stage))
const root = path.dirname(fileURLToPath(import.meta.url))
const task = JSON.parse(await fs.readFile(path.join(root,"after-seed.json"),"utf8"))
const chat = JSON.parse(await fs.readFile(path.join(root,"after-chat.json"),"utf8"))
const base = "http://127.0.0.1:39322"
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const ajv = new Ajv2020({ strict:false, allErrors:true, validateFormats:false })
const checks = []
async function get(route, concrete, operationID, params = {}) {
  const declaration = doc.paths[route].get
  assert.equal(declaration.operationId, operationID)
  const schema = declaration.responses["200"].content["application/json"].schema
  const validate = ajv.compile({...schema, components:doc.components})
  const query = new URLSearchParams({directory:task.directory,...params})
  const response = await fetch(base + concrete + "?" + query, {headers:{"x-opencorvus-directory":task.directory}})
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({operationID, status:response.status, requestID:response.headers.get("x-opencorvus-request-id"), schemaValid:true})
  return data
}
const project = await get("/project/current","/project/current","project.current")
assert.equal(project.id,task.projectID)
const conversation = await get("/task/{taskID}/conversation","/task/"+task.taskID+"/conversation","task.conversation",{tail_limit:"12"})
const board = await get("/task/{taskID}/board","/task/"+task.taskID+"/board","task.board")
for (const snapshot of [board,conversation.board]) {
  assert.equal(snapshot.task.id,task.taskID)
  assert.equal(snapshot.task.status,"completed")
  assert.deepEqual(snapshot.requirements,[])
  assert.deepEqual(snapshot.goals,[])
}
assert.deepEqual(conversation.transcript,[])
for (const sessionID of [chat.id, task.sessionID]) {
  assert.deepEqual(await get("/session/{sessionID}/message","/session/"+sessionID+"/message","session.messages"),[])
}
const facts = {stage,taskID:task.taskID,projectID:project.id,status:board.task.status,requirements:board.requirements,goals:board.goals,sessions:[chat.id,task.sessionID],checks}
await fs.writeFile(path.join(root,"after-"+stage+"-facts.json"),JSON.stringify(facts,null,2)+"\n")
console.log(JSON.stringify(facts))