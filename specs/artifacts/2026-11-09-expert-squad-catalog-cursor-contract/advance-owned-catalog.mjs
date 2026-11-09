import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const [phase, port] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
const root = path.dirname(fileURLToPath(import.meta.url))
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.occurrenceID, "iteration-b70-" + phase)
assert.equal(startup.url, "http://127.0.0.1:" + port)
const project = await fs.realpath(seed.directory)
assert.equal(path.dirname(project), root)
assert.equal(path.basename(project), "project-" + phase)
const profile = await fs.realpath(path.join(root, "profile-" + phase))
assert.equal(path.dirname(profile), root)
const base = startup.url
const query = "?" + new URLSearchParams({ directory: project })
const directoryHeader = { "x-opencorvus-directory": project }
const actualProject = await fetch(base + "/project/current", { headers: directoryHeader })
assert.equal(actualProject.status, 200)
assert.equal((await actualProject.json()).worktree, project)
const rootsResponse = await fetch(base + "/mission-skill/settings" + query, { headers: directoryHeader })
assert.equal(rootsResponse.status, 200)
const roots = (await rootsResponse.json()).roots
assert.equal(roots.global, path.join(profile, "config", "mission-skills"))
assert.equal(roots.project, path.join(project, ".opencorvus", "mission-skills"))
const docResponse = await fetch(base + "/doc")
assert.equal(docResponse.status, 200)
const doc = await docResponse.json()
const route = "/expert-squad/install-payload"
const op = doc.paths[route].post
assert.equal(op.operationId, "expertSquad.installPayload")
const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({ ...op.responses["200"].content["application/json"].schema, components: doc.components })
const installed = []
for (const scope of ["global"]) {
  const configRoot = scope === "project" ? path.join(project, ".opencorvus") : path.join(profile, "config")
  const expectedRoot = path.join(configRoot, "expert-squads", "builtin", "deep-research")
  const response = await fetch(base + route + query, {
    method: "POST",
    headers: { ...directoryHeader, "content-type": "application/json" },
    body: JSON.stringify({ id: "deep-research", installationScope: scope }),
  })
  const body = await response.json()
  assert.equal(response.status, 200, JSON.stringify(body))
  assert.ok(validate(body), JSON.stringify(validate.errors))
  assert.equal(body.operation, "installed")
  assert.equal(body.after.targetRoot, expectedRoot)
  assert.equal(body.after.id, "deep-research")
  assert.equal(body.after.namespace, "builtin")
  assert.equal(body.after.installationScope, scope)
  assert.equal(body.after.version, "2026.10.14.1")
  assert.ok((await fs.stat(path.join(expectedRoot, "expert-squad.jsonc"))).isFile())
  installed.push({ scope, id: body.after.id, namespace: body.after.namespace, root: expectedRoot, version: body.after.version, status: response.status, requestID: response.headers.get("x-opencorvus-request-id") })
}
await fs.writeFile(path.join(root, phase + "-catalog-advance.json"), JSON.stringify({ phase, installed }, null, 2) + "\n")
console.log(JSON.stringify({ phase, installed }))
