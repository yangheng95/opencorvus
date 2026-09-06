import path from "node:path"
import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

const testProcessSupervisor = prepareTestProcessSupervisor()
const runnerRuntime = await bootstrapIsolatedTestRuntime("runner")
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor
process.env.OPENCORVUS_TEST_RUNNER_ROOT = runnerRuntime.processRoot
process.env.OPENCORVUS_TEST_RUNNER_PID = String(process.pid)

try {
  const { runHostCommandWithInactivity } = await import("../src/shell/command-inactivity")
  const cwd = path.resolve(import.meta.dir, "..")
  const requested = process.argv.slice(2).filter((value) => value.trim().length > 0)
  const files = requested.length
    ? requested.map((file) => path.resolve(cwd, file))
    : [...new Bun.Glob("test/**/*.test.ts").scanSync({ cwd, absolute: true })].filter(
        (file) => path.basename(file) !== "isolated-test-entry.test.ts",
      )
  if (files.length === 0) throw new Error("No OpenCorvus test files were selected")
  const isolatedEntry = path.resolve(cwd, "test/isolated-test-entry.test.ts")
  if (files.some((file) => file === isolatedEntry)) {
    throw new Error("test/isolated-test-entry.test.ts is the internal test host and cannot select itself")
  }
  const childEnvironment = isolatedTestChildEnvironment(runnerRuntime)
  for (const file of files) {
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      // Bun 1.3.14 still applies its expired-entry subprocess auto-killer when
      // the zero timeout sentinel is used. Keep a finite per-test ownership
      // window; cases that legitimately need longer declare their own budget.
      args: ["test", "--timeout=60000", "--parallel=1", "test/isolated-test-entry.test.ts"],
      cwd,
      env: { ...childEnvironment, OPENCORVUS_TEST_FILES: JSON.stringify([file]) },
      inactivityTimeoutMs: 360_000,
      onStdout: (chunk) => process.stdout.write(chunk),
      onStderr: (chunk) => process.stderr.write(chunk),
    })

    if (result.failure) throw new Error(`${file}: ${result.failure.message}`)
    if (result.exitCode === undefined) throw new Error(`OpenCorvus test process exited without a result for ${file}`)
    if (result.exitCode !== 0) {
      process.exitCode = result.exitCode
      break
    }
  }
} finally {
  await removeIsolatedTestRuntime(runnerRuntime)
}
