import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(["before", "after", "repaired"].includes(phase))
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))
const project = seed[phase === "repaired" ? "after" : phase].directory
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
  checks.push({ route, operationId, status: response.status, schemaValid: true })
  return data
}
const current = await read("/project/current", "project.current")
assert.equal(current.worktree, project)
const list = await read("/project", "project.list")
assert.deepEqual(list.find((value) => value.id === current.id), current)
const query = "?" + new URLSearchParams({ directory: project })
const settings = await read("/mission-skill/settings", "missionSkill.settings", query)
const catalog = await read("/mission-skill/catalog", "missionSkill.catalog", query)
const skillFile = (name) => path.join(project, ".opencorvus", "mission-skills", name, "SKILL.md")
const issueSpecs = [
  ...(phase === "repaired" ? [] : [{ kind: "invalid_mission_skill", name: "broken-demo" }]),
  { kind: "duplicate_mission_skill", name: "duplicate-two" },
  { kind: "mission_skill_shadowed", name: "shadow-general" },
]
assert.deepEqual(settings.issues.map(({ kind, source, path }) => ({ kind, source, path })), issueSpecs.map(({ kind, name }) => ({ kind, source: "project", path: skillFile(name) })))
for (const issue of settings.issues) assert.ok(issue.message.includes(issue.path), issue.message)
if (phase !== "repaired") assert.match(settings.issues[0].message, /SkillInvalidError:[\s\S]*"name"/)
const duplicate = settings.issues.find((issue) => issue.kind === "duplicate_mission_skill")
assert.ok(duplicate.message.includes("duplicate-review") && duplicate.message.includes(skillFile("duplicate-one")))
assert.match(settings.issues.at(-1).message, /mission-builtin:general/)
assert.deepEqual(catalog.issues, settings.issues)
const accepted = [
  { name: "general", source: "built_in", location: null },
  { name: "inspection-demo", source: "project", location: skillFile("inspection-demo") },
  ...(phase === "repaired" ? [{ name: "repaired-demo", source: "project", location: skillFile("broken-demo") }] : []),
]
assert.deepEqual(settings.mission_skills.map(({ name, source, location }) => ({ name, source, location })), accepted)
assert.equal(settings.mission_skills[0].required_tools.length, 14)
assert.deepEqual(catalog.mission_skills, settings.mission_skills.map(({ name, description, required_tools }) => ({ name, description, required_tools })))
const result = { phase, checks, project: { id: current.id, worktree: current.worktree }, settings }
await fs.writeFile(path.join(root, phase + "-tcp.json"), JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify({ phase, checks: checks.length, issues: issueSpecs, accepted: accepted.map((skill) => skill.name) }))
