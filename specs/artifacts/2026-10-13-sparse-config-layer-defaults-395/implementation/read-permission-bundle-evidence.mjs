// Read-only source inspection, not a UI test and not a browser action.
import fs from "node:fs/promises"
const file = ".tmp-mcp-user-resource-input-393/live-attempt-01/bundle/bin/ui/assets/main-QSwgWIyk.js"
const text = await fs.readFile(file, "utf8")
const excerpts = []
for (const token of ["permission.asked", "pendingQuestions", "replyEndpoint:\"permission\"", "permission/grants", "permission/history"]) {
  let position = -1
  let count = 0
  while ((position = text.indexOf(token, position + 1)) !== -1) {
    count++
    if (count <= 12) excerpts.push({ token, characterOffset: position, excerpt: text.slice(Math.max(0, position - 210), position + token.length + 240) })
  }
  excerpts.push({ token, totalOccurrences: count })
}
const result = { observedAt: new Date().toISOString(), file, bytes: Buffer.byteLength(text), boundary: "Readable compiled JS source excerpts; not DOM/browser/screenshot or automated UI assertions.", excerpts }
await fs.writeFile(".tmp-sparse-config-layer-defaults-395/permission-bundle-code-evidence.json", JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result, null, 2))
