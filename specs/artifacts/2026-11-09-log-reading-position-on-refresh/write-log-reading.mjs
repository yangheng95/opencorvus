import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import path from "node:path"

const [root, phase, port, step, start, size] = process.argv.slice(2)
assert.match(phase, /^(before|after)$/)
assert.match(step, /^[a-z-]+$/)
const count = Number(size)
const first = Number(start)
assert.ok(Number.isInteger(count) && count > 0 && count <= 50)
assert.ok(Number.isInteger(first) && first > 0)
const marker = "opencorvus-b123-" + phase + "-reading-"
const entries = Array.from({ length: count }, (_, i) => ({
  service: "iteration-log-reading",
  level: "warn",
  message: marker + String(first + i).padStart(3, "0"),
  extra: { readingStep: step },
}))
const response = await fetch("http://127.0.0.1:" + port + "/log", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ entries }),
})
assert.equal(response.status, 200)
assert.equal(await response.json(), true)
const receipt = {
  markers: entries.map((entry) => entry.message),
  status: response.status,
  requestID: response.headers.get("x-opencorvus-request-id"),
}
await writeFile(path.join(root, phase + "-" + step + "-markers.json"), JSON.stringify(receipt, null, 2) + "\n")
console.log(JSON.stringify({ first: receipt.markers[0], last: receipt.markers.at(-1), count, requestID: receipt.requestID }))
