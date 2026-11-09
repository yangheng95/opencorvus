import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root, phase, port, mode] = process.argv.slice(2)
const fixtures = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const base = "http://127.0.0.1:" + port
async function request(route, directory, name) {
  const headers = name ? { "content-type": "application/json" } : {}
  const response = await fetch(base + route + "?" + new URLSearchParams({ directory }), {
    method: name ? "PATCH" : "GET", headers, body: name ? JSON.stringify({ name }) : undefined,
  })
  assert.equal(response.status, 200)
  return { status: response.status, requestID: response.headers.get("x-opencorvus-request-id"), data: await response.json() }
}
const entries = []
if (mode === "initialize") {
  for (const [slug, { directory }] of Object.entries(fixtures)) {
    const before = await request("/project/current", directory)
    const expected = slug.startsWith("secondary") ? "Research Memory" : "Current Workspace"
    const after = await request("/project/current", directory, expected)
    assert.deepEqual([after.data.id, after.data.worktree, after.data.name], [before.data.id, directory, expected])
    entries.push({ slug, before, after })
  }
} else {
  assert.equal(mode, "rename")
  const directory = fixtures["secondary-" + phase].directory
  const result = await request("/project/current", directory, "Research Memory Renamed")
  assert.deepEqual([result.data.worktree, result.data.name], [directory, "Research Memory Renamed"])
  entries.push(result)
}
await fs.writeFile(path.join(root, phase + "-" + mode + ".json"), JSON.stringify(entries, null, 2) + "\n")
console.log(JSON.stringify(entries.map(r => r.after?.requestID ?? r.requestID)))
