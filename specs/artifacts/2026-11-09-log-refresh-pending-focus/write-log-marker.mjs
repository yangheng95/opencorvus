import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import path from "node:path"

const [root, phase, port, step] = process.argv.slice(2)
assert.ok(phase === "before" || phase === "after")
assert.ok(/^[a-z-]+$/.test(step))
const marker = "opencorvus-b122-" + phase + "-" + step
const response = await fetch("http://127.0.0.1:" + port + "/log", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ entries: [{ service: "iteration-log-refresh", level: "warn", message: marker }] }),
})
assert.equal(response.status, 200)
assert.equal(await response.json(), true)
const receipt = { marker, status: response.status, requestID: response.headers.get("x-opencorvus-request-id") }
await writeFile(path.join(root, phase + "-" + step + "-marker.json"), JSON.stringify(receipt, null, 2) + "\n")
console.log(JSON.stringify(receipt))
