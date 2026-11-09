import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
const [root] = process.argv.slice(2)
const read = async (file) => JSON.parse(await fs.readFile(path.join(root, file), "utf8"))
const { after: seed } = await read("seed.json")
const chat = await read("after-chat.json")
assert.equal(chat.directory, seed.directory)
const url = "http://127.0.0.1:39332"
const headers = { "x-opencorvus-directory": seed.directory }
const config = await fetch(url + "/config", { headers })
assert.equal(config.status, 200)
const { locale, local_environment: environment } = await config.json()
const file = await read(path.join("project-after", ".opencorvus", "opencorvus.jsonc"))
const expected = {
  name: "Local environment review",
  variables: {
    OPENCORVUS_REVIEW_KEEP: "concurrent-keep",
    OPENCORVUS_REVIEW_ADDED: "outside-draft",
    OPENCORVUS_REVIEW_RENAMED: "renamed-typed",
  },
}
assert.deepEqual(environment, expected)
assert.deepEqual(file.local_environment, expected)
assert.equal(locale, "en-US")
assert.equal(file.locale, "en-US")
const message = await fetch(url + "/session/" + chat.id + "/message", { headers })
assert.equal(message.status, 200)
assert.deepEqual(await message.json(), [])
const log = (await fs.readFile(path.join(root, "after-proxy.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line))
const writes = log.filter(line => line.method === "PATCH" && line.route === "/config")
assert.equal(writes.length, 1)
assert.equal(writes[0].status, 200)
assert.deepEqual(writes[0].mediaTypes, ["application/json"])
assert.deepEqual(writes[0].body.variables, {
  OPENCORVUS_REVIEW_REMOVE: null,
  OPENCORVUS_REVIEW_RENAME: null,
  OPENCORVUS_REVIEW_RENAMED: "renamed-typed",
})
const facts = {
  config: { status: config.status, requestID: config.headers.get("x-opencorvus-request-id"), environment, locale },
  file: { environment: file.local_environment, locale: file.locale },
  conversation: { status: message.status, requestID: message.headers.get("x-opencorvus-request-id"), messages: 0 },
  browserConfigWrites: writes,
}
await fs.writeFile(path.join(root, "after-final-contract.json"), JSON.stringify(facts, null, 2) + "\n")
console.log(JSON.stringify(facts))