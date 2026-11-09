import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const root = path.dirname(fileURLToPath(import.meta.url))
const [phase, port] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, phase + "-startup.json"), "utf8"))
assert.equal(startup.occurrenceID, "iteration-b90-" + phase)
assert.equal(startup.url, "http://127.0.0.1:" + port)
const docRes = await fetch(startup.url + "/doc")
assert.equal(docRes.status, 200)
const doc = await docRes.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const schema = doc.paths["/file"].get.responses[200].content["application/json"].schema
const validate = ajv.compile({ ...schema, components: doc.components })
function route(name, relative) {
  const url = new URL(name, startup.url)
  url.searchParams.set("directory", seed.directory)
  url.searchParams.set("path", relative)
  return url
}
function requestID(response) {
  const id = response.headers.get("x-opencorvus-request-id")
  assert.ok(id)
  return id
}
const directories = {
  "": [[".opencorvus", "directory"], ["control", "directory"], ["copy-root", "directory"], ["move-root", "directory"],
       [".gitattributes", "file"], [".gitignore", "file"], ["copy-source.txt", "file"]],
  control: [["anchor.txt", "file"]],
  "copy-root": [["level-two", "directory"]],
  "copy-root/level-two": [["landing", "directory"]],
  "copy-root/level-two/landing": [["keep.txt", "file"], ["copied.txt", "file"]],
  "move-root": [["level-two", "directory"]],
  "move-root/level-two": [["landing", "directory"]],
  "move-root/level-two/landing": [["keep.txt", "file"], ["move-a.txt", "file"], ["move-b.txt", "file"]],
}
const evidence = { phase, listing: {}, files: {} }
for (const [relative, entries] of Object.entries(directories)) {
  const res = await fetch(route("/file", relative))
  assert.equal(res.status, 200)
  const items = await res.json()
  assert.ok(validate(items), JSON.stringify(validate.errors))
  assert.deepEqual(items.map(item => [item.name, item.type]).sort(), entries.sort())
  evidence.listing[relative] = { requestID: requestID(res), names: items.map(item => item.name) }
}
const files = Object.fromEntries(Object.entries(seed.files).map(([name, content]) => [
  /^move-[ab]\.txt$/.test(name) ? "move-root/level-two/landing/" + name : name, content,
]))
files["copy-root/level-two/landing/copied.txt"] = seed.files["copy-source.txt"]
for (const [relative, content] of Object.entries(files)) {
  const res = await fetch(route("/file/download", relative))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type")?.split(";")[0], "application/octet-stream")
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.deepEqual(bytes, Buffer.from(content, "utf8"))
  assert.deepEqual(bytes, await fs.readFile(path.join(seed.directory, relative)))
  evidence.files[relative] = { requestID: requestID(res), length: bytes.length, content }
}
await fs.writeFile(path.join(root, phase + "-files.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({phase, directories: Object.keys(evidence.listing).length, byteReads: Object.keys(evidence.files).length}))
