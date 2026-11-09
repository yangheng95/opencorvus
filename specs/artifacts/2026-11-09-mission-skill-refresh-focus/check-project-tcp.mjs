import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(["before", "after", "recovered"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))
const project = seed.projects[phase === "recovered" ? "after" : phase].directory
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
  const response = await fetch(new URL(route + query, base), { headers: { "x-opencorvus-directory": project } })
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.ok(validate(data), JSON.stringify(validate.errors))
  checks.push({ route, operationId, status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project)
const list = await read("/project", "project.list")
assert.deepEqual(list.find((value) => value.id === current.id), current)
const query = "?" + new URLSearchParams({ directory: project })
const settings = await read("/mission-skill/settings", "missionSkill.settings", query)
const catalog = await read("/mission-skill/catalog", "missionSkill.catalog", query)
const expectedNames = ["general", "inspection-demo", ...Array.from({ length: 320 }, (_, n) => "review-fixture-" + String(n).padStart(3, "0"))]
assert.deepEqual(settings.mission_skills.map((skill) => skill.name), expectedNames)
const skillFile = (name) => path.join(project, ".opencorvus", "mission-skills", name, "SKILL.md")
assert.equal(settings.mission_skills[0].source, "built_in")
assert.equal(settings.mission_skills[0].required_tools.length, 14)
for (const skill of settings.mission_skills.slice(1)) {
  assert.equal(skill.source, "project")
  assert.equal(skill.location, skillFile(skill.name))
}
assert.deepEqual(catalog.mission_skills, settings.mission_skills.map(({ name, description, required_tools }) => ({ name, description, required_tools })))
assert.deepEqual(catalog.issues, settings.issues)
const result = { phase, checks, project: { id: current.id, worktree: current.worktree }, count: expectedNames.length, acceptedNames: expectedNames, knownSkill: settings.mission_skills[1], lastSkill: settings.mission_skills.at(-1), issues: settings.issues }
await fs.writeFile(path.join(root, phase + "-tcp.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, checks, accepted: expectedNames.length }))
