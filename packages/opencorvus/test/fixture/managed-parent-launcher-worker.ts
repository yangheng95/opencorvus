import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import { currentRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"

const ledger = process.argv[2]
if (!ledger) throw new Error("Managed parent launcher fixture requires a ledger path")
const parent = currentRuntimeProcessOccurrence()
const child = spawn(
  process.execPath,
  [
    path.join(import.meta.dir, "managed-parent-child-worker.ts"),
    ledger,
    String(parent.pid),
    parent.processInstanceID,
    parent.occurrenceID,
  ],
  { detached: true, stdio: "ignore", windowsHide: true },
)
if (!child.pid) throw new Error("Managed parent launcher fixture did not create its child")
child.unref()

const deadline = Date.now() + 10_000
for (;;) {
  const events = await fs
    .readFile(ledger, "utf8")
    .then((text) => text.split(/\r?\n/).filter(Boolean))
    .catch(() => [])
  if (events.some((line) => (JSON.parse(line) as { phase?: unknown }).phase === "ready")) break
  if (Date.now() >= deadline) throw new Error("Managed child did not accept the launcher-minted occurrence")
  await Bun.sleep(20)
}
process.stdout.write(`${child.pid}\n`)
