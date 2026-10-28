import { expect, test } from "bun:test"
import path from "node:path"
import { publishTestProcessSupervisor } from "../script/prepare-test-process-supervisor"
import { observedProcessOccurrence, observeRuntimeProcessOccurrence } from "../src/runtime/process-occurrence"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"
import { tmpdir } from "./fixture/fixture"

test("publishes a complete executable and reuses its canonical publication while it runs", async () => {
  await using directory = await tmpdir()
  const helper = path.join(directory.path, "published", path.basename(process.execPath))
  expect(publishTestProcessSupervisor(process.execPath, helper)).toBe(helper)
  let output = ""
  let publication: { path: string; physical: string } | undefined
  const result = await runHostCommandWithInactivity({
    executable: helper,
    args: ["-e", "console.log('publication-ready:'+process.pid); await Bun.sleep(1500); console.log('publication-settled')"],
    cwd: directory.path,
    inactivityTimeoutMs: 10_000,
    deadlineAt: Date.now() + 30_000,
    onStdout: (chunk) => {
      output += chunk.toString()
      const ready = /publication-ready:(\d+)\r?\n/.exec(output)
      if (publication || !ready) return
      const occurrence = observedProcessOccurrence(Number(ready[1]))
      publication = {
        physical: occurrence ? observeRuntimeProcessOccurrence(occurrence) : "unavailable",
        path: publishTestProcessSupervisor(process.execPath, helper),
      }
    },
  })
  expect(publication).toEqual({ path: helper, physical: "exact_live" })
  expect({ exitCode: result.exitCode, settlementConfirmed: result.settlementConfirmed, finalOutput: result.stdout.trim().split(/\r?\n/).at(-1) })
    .toEqual({ exitCode: 0, settlementConfirmed: true, finalOutput: "publication-settled" })
})
