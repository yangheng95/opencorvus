import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { Capability } from "../../platform/capability"

function icon(state: Capability.State) {
  if (state === "ok") return "OK"
  if (state === "warn") return "WARN"
  return "FAIL"
}

function show(report: Capability.Report) {
  process.stdout.write(`platform=${report.platform} arch=${report.arch}${EOL}`)
  process.stdout.write(`summary ok=${report.total.ok} warn=${report.total.warn} fail=${report.total.fail}${EOL}${EOL}`)
  for (const item of report.items) {
    process.stdout.write(`[${icon(item.state)}] ${item.title}: ${item.detail}${EOL}`)
    if (item.hint) process.stdout.write(`       hint: ${item.hint}${EOL}`)
  }
}

export const DoctorCommand = cmd({
  command: "doctor",
  describe: "check local desktop capability health",
  builder: (yargs: Argv) => {
    return yargs
      .option("json", {
        describe: "print doctor report as JSON",
        type: "boolean",
      })
      .option("refresh", {
        describe: "force a fresh capability probe",
        type: "boolean",
      })
      .option("strict", {
        describe: "return non-zero if warnings are present",
        type: "boolean",
      })
  },
  handler: async (args) => {
    const report = await Capability.collect(Boolean(args.refresh))
    if (args.json) {
      process.stdout.write(JSON.stringify(report, null, 2) + EOL)
    } else {
      show(report)
    }
    const bad = report.total.fail > 0
    const strict = Boolean(args.strict) && report.total.warn > 0
    if (bad || strict) process.exitCode = 1
  },
})
