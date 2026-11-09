import fs from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import Ajv2020 from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/node_modules/ajv/dist/2020.js"

const root = path.dirname(fileURLToPath(import.meta.url))
const receipt = JSON.parse(await fs.readFile(path.join(root, "after-terminal-startup.json"), "utf8"))
assert.equal(receipt.occurrenceID, "iteration-b71-after-terminal")
assert.equal(receipt.url, "http://127.0.0.1:39065")
const seed = JSON.parse(await fs.readFile(path.join(root, "seed.json"), "utf8"))
const directory = await fs.realpath(seed.after.directory)
assert.equal(path.dirname(directory), root)
const response = await fetch(receipt.url + "/doc")
assert.equal(response.status, 200)
const doc = await response.json()
const route = "/expert-squad/market"
const validate = new Ajv2020({ strict: false, validateFormats: false }).compile({
  ...doc.paths[route].get.responses["200"].content["application/json"].schema, components: doc.components,
})
const checkpoint = JSON.parse(await fs.readFile(path.join(root, "after-advance.json"), "utf8"))
const pages = []
const ids = []
let cursor
do {
  const params = new URLSearchParams({ directory, availability: "all", limit: "20" })
  if (cursor) params.set("cursor", cursor)
  const pageResponse = await fetch(receipt.url + route + "?" + params, { headers: { "x-opencorvus-directory": directory } })
  assert.equal(pageResponse.status, 200)
  const page = await pageResponse.json()
  assert.ok(validate(page), JSON.stringify(validate.errors))
  assert.equal(page.total_count, checkpoint.total)
  const nextIds = page.entries.map(({ namespace, id }) => namespace + "/" + id)
  assert.ok(nextIds.length && nextIds.length <= 20)
  pages.push({ requestID: pageResponse.headers.get("x-opencorvus-request-id"), ids: nextIds })
  ids.push(...nextIds)
  assert.ok(ids.length <= checkpoint.total)
  cursor = page.next_cursor
} while (cursor)
assert.equal(cursor, null)
assert.equal(ids.length, checkpoint.total)
assert.equal(new Set(ids).size, checkpoint.total)
assert.deepEqual(ids.slice(0, 2), [checkpoint.first.id, checkpoint.next.id].map((id) => "builtin/" + id))
await fs.writeFile(path.join(root, "after-market-terminal.json"), JSON.stringify({ total: ids.length, pages, terminalCursor: cursor }, null, 2) + "\n")
console.log(JSON.stringify({ pages: pages.map(({ ids }) => ids.length), total: ids.length, lastID: ids.at(-1) }))
