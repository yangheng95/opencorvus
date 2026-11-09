import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const root = path.dirname(fileURLToPath(import.meta.url))
const [phase, port] = process.argv.slice(2)
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))[phase]
const startup = JSON.parse(await fs.readFile(path.join(root, (phase === "after" ? "after-final" : phase) + "-startup.json"), "utf8"))
assert.equal(startup.occurrenceID, "iteration-b87-" + (phase === "after" ? "after-final" : phase))
assert.equal(startup.url, "http://127.0.0.1:" + port)
const docRes = await fetch(startup.url + "/doc")
assert.equal(docRes.status, 200)
const doc = await docRes.json()
const ajv = new Ajv2020({ strict: false, validateFormats: false })
const requestID = res => {
  const id = res.headers.get("x-opencorvus-request-id")
  assert.ok(id)
  return id
}
function route(name, file) {
  const url = new URL(name, startup.url)
  url.searchParams.set("directory", seed.directory)
  if (file !== undefined) url.searchParams.set("path", file)
  return url
}
const evidence = { phase, listing: {}, files: {}, outside: {} }
const isBefore = phase === "before"
const targetCopy = isBefore ? seed.mirror + "/wrong-place.txt" : "dest/checked-copy.txt"
const targetMove = isBefore ? seed.mirror : "move-dest"
const paths = Object.fromEntries(Object.entries(seed.files).map(([name, content]) => [
  /^move-[ab]\.txt$/.test(name) ? targetMove + "/" + name : name, content,
]))
paths[targetCopy] = seed.files["single.txt"]
const directories = {
  "": [[".opencorvus", "directory"], ["dest", "directory"], ["move-dest", "directory"], ["Users", "directory"],
    [".gitattributes", "file"], [".gitignore", "file"], ["single.txt", "file"]],
  dest: [["anchor.txt", "file"], ...(!isBefore ? [["checked-copy.txt", "file"]] : [])],
  "move-dest": [["anchor.txt", "file"], ...(!isBefore ? [["move-a.txt", "file"], ["move-b.txt", "file"]] : [])],
  [seed.mirror]: [["anchor.txt", "file"], ...(isBefore ? [["move-a.txt", "file"], ["move-b.txt", "file"], ["wrong-place.txt", "file"]] : [])],
}
const listSchema = doc.paths["/file"].get.responses[200].content["application/json"].schema
const validate = ajv.compile({ ...listSchema, components: doc.components })
for (const [dir, members] of Object.entries(directories)) {
  const res = await fetch(route("/file", dir))
  assert.equal(res.status, 200)
  const items = await res.json()
  assert.ok(validate(items), JSON.stringify(validate.errors))
  assert.deepEqual(items.map(item => [item.name, item.type]).sort(), members.sort())
  evidence.listing[dir] = { requestID: requestID(res), names: items.map(item => item.name) }
}
for (const [relative, content] of Object.entries(paths)) {
  const res = await fetch(route("/file/download", relative))
  assert.equal(res.status, 200)
  assert.equal(res.headers.get("content-type")?.split(";")[0], "application/octet-stream")
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.deepEqual(bytes, Buffer.from(content, "utf8"))
  assert.deepEqual(bytes, await fs.readFile(path.join(seed.directory, relative)))
  evidence.files[relative] = { requestID: requestID(res), length: bytes.length, content }
}
const outsideNames = await fs.readdir(seed.absolute)
assert.deepEqual(outsideNames, ["outside-anchor.txt"])
const outsideBytes = await fs.readFile(path.join(seed.absolute, "outside-anchor.txt"), "utf8")
assert.equal(outsideBytes, "isolated volume-root destination\n")
evidence.outside = { directory: seed.absolute, entries: outsideNames, anchor: outsideBytes }
await fs.writeFile(path.join(root, phase + "-files.json"), JSON.stringify(evidence, null, 2) + "\n")
console.log(JSON.stringify({phase, listing: evidence.listing, byteReads: Object.keys(evidence.files).length, outside: evidence.outside}))
