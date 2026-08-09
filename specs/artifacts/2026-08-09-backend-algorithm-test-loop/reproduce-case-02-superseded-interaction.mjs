import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const evidenceDirectory = path.join(scriptDirectory, "evidence", "batch-01", "case-02")
const accepted = JSON.parse(await readFile(path.join(evidenceDirectory, "response.json"), "utf8"))
const interactionID = "int_g019fe45584c5000000000000POUkTiSKkv3Ich"
const request = {
  method: "POST",
  url: `http://127.0.0.1:7878/interaction/${interactionID}/reply`,
  headers: { "content-type": "application/json", "x-opencorvus-directory": accepted.body.directory },
  body: { autoReply: false, answers: [["skip_optional_testing"]] },
}
await writeFile(
  path.join(evidenceDirectory, "superseded-interaction-reply-request.json"),
  `${JSON.stringify(request, null, 2)}\n`,
  "utf8",
)
const response = await fetch(request.url, {
  method: request.method,
  headers: request.headers,
  body: JSON.stringify(request.body),
})
const text = await response.text()
let body = text
try {
  body = JSON.parse(text)
} catch {}
const record = {
  status: response.status,
  statusText: response.statusText,
  headers: Object.fromEntries(response.headers.entries()),
  body,
}
await writeFile(
  path.join(evidenceDirectory, "superseded-interaction-reply-response.json"),
  `${JSON.stringify(record, null, 2)}\n`,
  "utf8",
)
console.log(JSON.stringify(record))
if (response.status !== 404) throw new Error(`Expected reproducible stale interaction HTTP 404, received ${response.status}`)
