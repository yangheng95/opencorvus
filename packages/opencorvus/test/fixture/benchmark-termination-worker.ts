import fs from "node:fs/promises"
import { createBenchmarkAdmissionGate, installBenchmarkTerminationHandlers } from "../../../../script/benchmark/process-lifecycle"

const readyPath = process.argv[2]
if (!readyPath) throw new Error("ready path is required")
const admission = createBenchmarkAdmissionGate("Signal fixture")
let finish!: () => void
const terminated = new Promise<void>((resolve) => {
  finish = resolve
})
const remove = installBenchmarkTerminationHandlers((signal) => {
  admission.request(signal)
  finish()
})
await fs.writeFile(readyPath, "ready\n", { flag: "wx" })
await terminated
remove()
process.stdout.write(JSON.stringify({ signal: admission.signal(), admission_open: admission.isOpen() }) + "\n")
