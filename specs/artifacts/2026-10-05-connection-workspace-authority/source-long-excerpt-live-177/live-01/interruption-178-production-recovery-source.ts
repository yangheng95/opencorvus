import fs from "node:fs/promises"
import path from "node:path"
import assert from "node:assert/strict"
const run = "C:/Users/hengu/.codex/opencorvus-product-iteration/2026-10-08/source-long-excerpt-live-177-01"
const evidence = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-long-excerpt-live-177/live-01"
process.env.OPENCORVUS_HOME = path.join(run, "runtime")
process.env.OPENCORVUS_TEST_HOME = path.join(run, "home")
process.env.OPENCORVUS_TEST_PROCESS_ROOT = run
const { installProcessShims } = await import("../../packages/opencorvus/src/runtime/shims")
installProcessShims()
const { Global } = await import("../../packages/opencorvus/src/global")
const { currentRuntimeProcessOccurrence, observeRuntimeProcessOccurrence } = await import("../../packages/opencorvus/src/runtime/process-occurrence")
const { ProcessSupervisor } = await import("../../packages/opencorvus/src/shell/process-supervisor")
assert.equal(path.resolve(Global.Path.temporary), path.resolve(run, "runtime/tmp"))
const dirs = (await fs.readdir(Global.Path.temporary, { withFileTypes: true })).filter(x => x.isDirectory() && x.name.startsWith("supervisor-")).map(x => x.name)
assert.deepEqual(dirs, ["supervisor-NcIMoj"])
const owners = [
  { pid: 65556, processInstanceID: "win32:639270593701864841", occurrenceID: "b04faead-b7ac-4b6f-9136-7fcc1b3920c2" },
  { pid: 41532, processInstanceID: "win32:639270593709235529", occurrenceID: "b04faead-b7ac-4b6f-9136-7fcc1b3920c2" },
  { pid: 77972, processInstanceID: "win32:639270593709734382", occurrenceID: "bda0ae7b-920b-4527-9476-b0d654cfdaf7" },
  { pid: 17208, processInstanceID: "win32:639270593681159568", occurrenceID: "14161308-e9bc-4c8d-976c-d882b1e9234e" },
]
for (const owner of owners) assert.equal(observeRuntimeProcessOccurrence(owner), "dead_or_reused")
const recoveryOwner = currentRuntimeProcessOccurrence()
const result = await ProcessSupervisor.recoverOrphanedWindowsRequests({ currentOccurrenceID: recoveryOwner.occurrenceID })
const receipt = { observedAtUtc: new Date().toISOString(), recoveryOwner, result, owners: owners.map(owner => ({ owner, state: observeRuntimeProcessOccurrence(owner) })), boundary: "Production orphan-request recovery only; original Host output drain, parent exit result and full native settlement remain unqualified" }
await fs.writeFile(path.join(evidence, "interruption-178-production-recovery.json"), JSON.stringify(receipt, null, 2), { flag: "wx" })
assert.deepEqual(result, { inspected: 1, removed: 1, retainedCurrent: 0, retainedLive: 0, retainedUnknown: 0, quarantined: 0, unreconciled: [] })
console.log(JSON.stringify(receipt))
