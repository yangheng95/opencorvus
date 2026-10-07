import { readdirSync } from "node:fs"
import path from "node:path"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
  testCommandDeadlineAt,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../../opencorvus/script/prepare-test-process-supervisor"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const UNIT_TEST_INACTIVITY_TIMEOUT_MILLISECONDS = 120_000
const testProcessSupervisor = prepareTestProcessSupervisor()
const runnerRuntime = await bootstrapIsolatedTestRuntime("runner")
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor

function unitTestFiles(requestedFiles: string[]): string[] {
  if (requestedFiles.length > 0) return requestedFiles
  return readdirSync(path.join(OVERLAY_ROOT, "test"))
    .filter((file) => file.endsWith(".test.ts"))
    .map((file) => path.join("test", file))
    .sort()
}

let settlementConfirmed = true
try {
  const { runHostCommandWithInactivity } = await import("../../opencorvus/src/shell/command-inactivity")
  const files = unitTestFiles(process.argv.slice(2))
  if (files.length === 0) throw new Error("Overlay unit test runner requires at least one test file")
  const childEnvironment = isolatedTestChildEnvironment(runnerRuntime)
  for (const file of files) {
    settlementConfirmed = false
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["test", "--timeout=0", file],
      cwd: OVERLAY_ROOT,
      env: childEnvironment,
      deadlineAt: testCommandDeadlineAt(),
      inactivityTimeoutMs: UNIT_TEST_INACTIVITY_TIMEOUT_MILLISECONDS,
      onStdout: (chunk) => process.stdout.write(chunk),
      onStderr: (chunk) => process.stderr.write(chunk),
    })
    settlementConfirmed = result.settlementConfirmed
    if (result.failure) throw new Error(`${file}: ${result.failure.message}`)
    if (result.exitCode === undefined) throw new Error(`${file}: process exited without an exit code`)
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
      break
    }
  }
} finally {
  if (settlementConfirmed) await removeIsolatedTestRuntime(runnerRuntime)
  else
    console.error(
      `Test runtime retained because physical/output settlement is unconfirmed: ${runnerRuntime.processRoot}`,
    )
}
