import fs from "node:fs"
import { ManagedServerLifecycle } from "../../src/server/managed-server-lifecycle"

const [ledger, rawPid, processInstanceID, occurrenceID] = process.argv.slice(2)
if (!ledger || !rawPid || !processInstanceID || !occurrenceID) {
  throw new Error("Managed parent child fixture requires ledger, PID, process-instance ID and occurrence ID")
}
const admitted = ManagedServerLifecycle.parentInput({
  pid: Number(rawPid),
  processInstanceID,
  occurrenceID,
})
if (!admitted) throw new Error("Managed parent child fixture did not receive a parent occurrence")

const append = (event: Record<string, unknown>) => {
  fs.appendFileSync(ledger, `${JSON.stringify({ ...event, childPid: process.pid, parent: admitted.parent })}\n`, "utf8")
}

let lifecycle: ManagedServerLifecycle.Handle
lifecycle = ManagedServerLifecycle.start({
  parent: admitted.parent,
  watchdogIntervalMilliseconds: 20,
  onParentExit(reason) {
    append({ phase: "shutdown", reason })
    lifecycle.release()
    process.exit(0)
  },
})
append({ phase: "ready" })
setTimeout(() => {
  append({ phase: "timeout" })
  lifecycle.release()
  process.exit(3)
}, 15_000)
