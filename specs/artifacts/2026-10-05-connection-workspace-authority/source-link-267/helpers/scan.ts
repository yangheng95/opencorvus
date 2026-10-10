import fs from "node:fs"
import path from "node:path"
import { CredentialRedactor } from "../../packages/opencorvus/script/real-provider-audit"
const base = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-link-267"
const redactor = new CredentialRedactor()
redactor.collect(JSON.parse(fs.readFileSync("C:/Users/hengu/AppData/Local/opencorvus/data/auth.json", "utf8")))
let files = 0
const matched: string[] = []
function inspect(directory: string): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) inspect(target)
    else if (/\.(json|log|txt|md|ts|ps1)$/.test(entry.name)) {
      files++
      if (redactor.containsCredential(fs.readFileSync(target, "utf8"))) matched.push(path.relative(base, target))
    }
  }
}
inspect(base)
console.log(JSON.stringify({ files, credentialMatches: matched.length, matched }))
if (matched.length) throw new Error("Exact existing credential detected in proposed archive")
