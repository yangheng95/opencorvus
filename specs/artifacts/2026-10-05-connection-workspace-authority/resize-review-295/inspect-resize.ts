import fs from "node:fs"
import path from "node:path"
const phase = process.argv[2]
if (!/^[0-9]{2}-[a-z-]+$/.test(phase ?? "")) throw Error("Exact observation phase required")
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-11/resize-review-295-history-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/resize-review-295/history-01"
const events = fs.readFileSync(path.join(run, "runtime/log/dev.log"), "utf8").split(/\r?\n/).flatMap(line => {
  if (!line) return []
  const entry = JSON.parse(line)
  return entry.data?.resize295 ? [entry] : []
})
const changes = events.flatMap(event => event.data.resize295.recent.flatMap((trace: any) => trace.targets.flatMap((target: any) =>
  target.before.width !== target.after.width || target.before.height !== target.after.height
    ? [{ event: event.time, ageMs: event.data.resize295.at - trace.at, label: trace.label, ...target }]
    : [],
)))
fs.writeFileSync(path.join(evidence, `${phase}-observer-errors.json`), JSON.stringify({ observedAtUtc: new Date().toISOString(), events, changes }, null, 2), { flag: "wx" })
console.log(JSON.stringify({ events: events.length, changes }))
