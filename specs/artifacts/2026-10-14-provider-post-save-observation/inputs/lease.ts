import fs from "node:fs"
import path from "node:path"
import { acquireProcessLock } from "../packages/opencorvus/src/util/process-lock"
const root = path.resolve(".tmp-codex-provider-post-save-01a133/final")
const kind = process.argv[2]!
const label = process.argv[3]!
if (!["config", "auth"].includes(kind) || !/^[a-z0-9-]+$/.test(label)) throw Error("Invalid own lease input")
const target = path.join(root, "runtime", kind === "config" ? "config/opencorvus.jsonc" : "data/auth.json")
const signal = path.join(root, `lease-${label}-release`)
const ready = path.join(root, `lease-${label}-ready.json`)
if (fs.existsSync(ready) || fs.existsSync(signal)) throw Error("Fresh own lease occurrence required")
const release = await acquireProcessLock(target, { realpath: false })
const credentialGenerations = kind === "auth"
  ? Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(target, "utf8"))).map(([id, entry]) => [id, (entry as { generation: string }).generation]))
  : undefined
fs.writeFileSync(ready, JSON.stringify({ pid: process.pid, kind, target, label, at: Date.now(), credentialGenerations, boundary: "Real production process lock on own canonical input; actual HTTP writer queues naturally" }, null, 2))
console.log(`Own ${kind} lease acquired`)
const started = Date.now()
try {
  while (!fs.existsSync(signal)) {
    if (Date.now() - started > 300000) throw Error("Own lease operation expired without explicit release")
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
} finally {
  await release()
  fs.writeFileSync(path.join(root, `lease-${label}-terminal.json`), JSON.stringify({ pid: process.pid, label, released: true, at: Date.now() }, null, 2))
}
console.log(`Own ${kind} lease released`)
