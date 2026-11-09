import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(["before", "after", "recovered"].includes(phase))
const root = "C:/Users/hengu/AppData/Local/Temp/opencorvus-iteration-20261109-b62"
const project = JSON.parse(await fs.readFile(root + "/seed.json", "utf8"))[phase === "recovered" ? "after" : phase]
const base = "http://127.0.0.1:" + port
const schemaResponse = await fetch(base + "/doc")
assert.equal(schemaResponse.status, 200)
const doc = await schemaResponse.json()
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false })
const checks = []
const read = async (route, operationId, query = "") => {
  const op = doc.paths[route].get
  assert.equal(op.operationId, operationId)
  const schema = op.responses["200"].content["application/json"].schema
  const validate = ajv.compile({ ...schema, components: doc.components })
  const response = await fetch(new URL(route + query, base), { headers: { "x-opencorvus-directory": project.directory } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project.directory)
assert.ok(current.id.startsWith("prj_"))
const list = await read("/project", "project.list")
const item = list.find(value => value.id === current.id)
assert.deepEqual(item, current)
const scope = new URLSearchParams({ directory: project.directory })
const skills = await read("/mission-skill/settings", "missionSkill.settings", "?" + scope)
assert.deepEqual(skills.mission_skills.map(({ name, source }) => ({ name, source })), [
  { name: "general", source: "built_in" },
  { name: "inspection-demo", source: "project" },
])
assert.equal(skills.mission_skills[1].location, path.join(project.directory, ".opencorvus", "mission-skills", "inspection-demo", "SKILL.md"))
assert.equal(skills.mission_skills[1].description, "Inspect the test project catalog by name.")
if (phase !== "before") {
  const catalog = await read("/mission-skill/catalog", "missionSkill.catalog", "?" + scope)
  assert.deepEqual(catalog.mission_skills, skills.mission_skills.map(({ name, description, required_tools }) => ({ name, description, required_tools })))
}
const result = { phase, checks, skills: skills.mission_skills, project: { id: current.id, worktree: current.worktree }, listedProjectCount: list.length }
await fs.writeFile(root + "/" + phase + "-tcp.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))