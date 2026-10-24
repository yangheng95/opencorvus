import path from "node:path"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
  testCommandDeadlineAt,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const testProcessSupervisor = prepareTestProcessSupervisor()
const runnerRuntime = await bootstrapIsolatedTestRuntime("runner")
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
process.env.OPENCORVUS_TEST_RUNNER_ROOT = runnerRuntime.processRoot
process.env.OPENCORVUS_TEST_RUNNER_PID = String(process.pid)

let settlementConfirmed = true
let completedSuccessfully = false
try {
  const { runHostCommandWithInactivity } = await import("../src/shell/command-inactivity")
  const cwd = path.resolve(import.meta.dir, "..")
  const requested = process.argv.slice(2).filter((value) => value.trim().length > 0)
  const patterns = requested.filter((value) => value.startsWith("--test-name-pattern="))
  if (patterns.length > 1 || patterns.some((value) => value === "--test-name-pattern="))
    throw new Error("Select one non-empty --test-name-pattern=<pattern>")
  const selected = requested.filter((value) => !value.startsWith("--test-name-pattern="))
  const files = selected.length
    ? selected.map((file) => path.resolve(cwd, file))
    : [...new Bun.Glob("test/**/*.test.ts").scanSync({ cwd, absolute: true })].filter(
        (file) => path.basename(file) !== "isolated-test-entry.test.ts",
      )
  if (files.length === 0) throw new Error("No OpenCorvus test files were selected")
  const isolatedEntry = path.resolve(cwd, "test/isolated-test-entry.test.ts")
  if (files.some((file) => file === isolatedEntry)) {
    throw new Error("test/isolated-test-entry.test.ts is the internal test host and cannot select itself")
  }
  const childEnvironment = isolatedTestChildEnvironment(runnerRuntime)
  const failedFiles: string[] = []
  for (const [index, file] of files.entries()) {
    const label = path.relative(cwd, file).split(path.sep).join("/")
    const started = performance.now()
    console.log(`[${index + 1}/${files.length}] START ${label}`)
    settlementConfirmed = false
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      // Bun 1.3.14 still applies its expired-entry subprocess auto-killer when
      // the zero timeout sentinel is used. Keep a finite per-test ownership
      // window; cases that legitimately need longer declare their own budget.
      args: ["test", "--timeout=60000", "--parallel=1", ...patterns, isolatedEntry],
      cwd,
      env: { ...childEnvironment, OPENCORVUS_TEST_FILES: JSON.stringify([file]) },
      deadlineAt: testCommandDeadlineAt(),
      inactivityTimeoutMs: 360_000,
      onStdout: (chunk) => process.stdout.write(chunk),
      onStderr: (chunk) => process.stderr.write(chunk),
    })

    const duration = ((performance.now() - started) / 1000).toFixed(2)
    console.log(
      `[${index + 1}/${files.length}] DONE ${label} exit=${result.exitCode ?? "unknown"} duration=${duration}s`,
    )
    settlementConfirmed = result.settlementConfirmed
    if (result.failure) throw new Error(`${file}: ${result.failure.message}`)
    if (result.exitCode === undefined) throw new Error(`OpenCorvus test process exited without a result for ${file}`)
    if (result.exitCode !== 0) {
      console.error(`OpenCorvus test file failed (exit=${result.exitCode}): ${file}`)
      process.exitCode = result.exitCode
      failedFiles.push(file)
    }
  }
  if (failedFiles.length)
    console.error(`OpenCorvus failed test files (${failedFiles.length}):\n${failedFiles.join("\n")}`)
  completedSuccessfully = failedFiles.length === 0
} finally {
  if (completedSuccessfully && settlementConfirmed) await removeIsolatedTestRuntime(runnerRuntime)
  else {
    console.error(`Test runtime retained after unsuccessful run: ${runnerRuntime.ownerRoot}`)
    console.error(`Physical/output settlement confirmed: ${settlementConfirmed}`)
  }
}
