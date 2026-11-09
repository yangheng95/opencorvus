import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const root = path.dirname(fileURLToPath(import.meta.url))
const [phase, port, step] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.occurrenceID, "iteration-b85-" + phase)
assert.equal(startup.url, "http://127.0.0.1:" + port)
const docRes = await fetch(startup.url + "/doc")
assert.equal(docRes.status, 200)
const doc = await docRes.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const expectedLists = {
  "copy-dest": [["anchor.txt", "file"], ["bundle", "directory"]],
  "copy-dest/bundle": [["inside.txt", "file"], ["nested", "directory"]],
  "copy-dest/bundle/nested": [["deep.txt", "file"]],
  "move-dest": [["anchor.txt", "file"], ["move-bundle", "directory"]],
  "move-dest/move-bundle": [["item.txt", "file"]],
}
if (phase !== "before") expectedLists["copy-dest"].push(["spare.txt", "file"])
const own = Object.fromEntries(Object.entries(seed.files).map(([file, contents]) =>
  [file === "move-bundle/item.txt" ? "move-dest/" + file : phase !== "before" && file === "spare.txt" ? "copy-dest/" + file : file, contents]))
for (const file of ["bundle/inside.txt", "bundle/nested/deep.txt"]) own["copy-dest/" + file] = seed.files[file]
const evidence = { phase, step, listing: {}, files: {} }
function route(name, item) {
  const url = new URL(name, startup.url)
  url.searchParams.set("directory", seed.directory)
  url.searchParams.set("path", item)
  return url
}
function requestID(res) {
  const id = res.headers.get("x-opencorvus-request-id")
  assert.ok(id)
  return id
}
for (const [directory, entries] of Object.entries(expectedLists)) {
  const res = await fetch(route("/file", directory))
  assert.equal(res.status, 200)
  const listing = await res.json()
  const check = ajv.compile({ ...doc.paths["/file"].get.responses[200].content["application/json"].schema, components: doc.components })
  assert.ok(check(listing), JSON.stringify(check.errors))
  assert.deepEqual(listing.map(item => [item.name, item.type]).sort(), entries.sort())
  evidence.listing[directory] = { requestID: requestID(res), names: listing.map(item => item.name) }

}
for (const [relative, content] of Object.entries(own)) {
  const res = await fetch(route("/file/download", relative))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type")?.split(";")[0], "application/octet-stream")
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.deepEqual(bytes, Buffer.from(content, "utf8"))
  assert.deepEqual(bytes, await fs.readFile(path.join(seed.directory, relative)))
  evidence.files[relative] = { requestID: requestID(res), length: bytes.length, content }
}
await fs.writeFile(path.join(root, phase + "-" + step + ".json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({phase, step, lists:Object.keys(evidence.listing).length, files:Object.keys(evidence.files).length, requestIDs:evidence.listing}))
