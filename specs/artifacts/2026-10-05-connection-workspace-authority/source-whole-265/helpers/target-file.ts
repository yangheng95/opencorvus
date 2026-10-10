import fs from "node:fs"
import { readTextFilePageContent } from "../../packages/opencorvus/src/tool/text-file"
const file = "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/read.ts"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-whole-265/live-01"
const content = fs.readFileSync(file, "utf8")
const stat = fs.statSync(file)
const page = readTextFilePageContent(content, { offset: 1, limit: 1000 })
const mode = process.argv[2]
if (mode === "before") {
  fs.writeFileSync(evidence + "/target-file-before.json", JSON.stringify({ observedAtUtc: new Date().toISOString(), file, bytes: stat.size, mtimeMs: stat.mtimeMs, content, page }, null, 2) + "\n", { flag: "wx" })
} else if (mode === "after") {
  const before = JSON.parse(fs.readFileSync(evidence + "/target-file-before.json", "utf8"))
  const result = { observedAtUtc: new Date().toISOString(), file, fullContent: content === before.content ? "equal" : "different", metadata: stat.size === before.bytes && stat.mtimeMs === before.mtimeMs ? "equal" : "different", page }
  fs.writeFileSync(evidence + "/target-file-custody.json", JSON.stringify(result, null, 2) + "\n", { flag: "wx" })
  if (result.fullContent !== "equal" || result.metadata !== "equal") throw Error("Referenced source content custody differs")
} else throw Error("Exact before or after observation required")
console.log(JSON.stringify({ mode, bytes: stat.size, totalLines: page.totalLines, lines: page.lines, truncated: page.truncated }))
