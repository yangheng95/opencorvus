import {
  bootstrapIsolatedTestRuntime,
  isolatedTestChildEnvironment,
  removeIsolatedTestRuntime,
} from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "./prepare-test-process-supervisor"

function parsePositiveInteger(value: string | undefined, name: string): number {
  if (!value || !/^\d+$/.test(value)) throw new Error(`${name} requires a positive integer`)
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} requires a positive integer`)
  return parsed
}

function parseCommand(argv: string[]): { inactivityMs: number; executable: string; args: string[] } {
  if (argv[0] !== "--inactivity-ms") {
    throw new Error("Usage: run-with-inactivity.ts --inactivity-ms <milliseconds> -- <executable> [...args]")
  }
  const inactivityMs = parsePositiveInteger(argv[1], "--inactivity-ms")
  if (argv[2] !== "--" || !argv[3]) {
    throw new Error("Usage: run-with-inactivity.ts --inactivity-ms <milliseconds> -- <executable> [...args]")
  }
  return { inactivityMs, executable: argv[3], args: argv.slice(4) }
}

const command = parseCommand(process.argv.slice(2))
const testProcessSupervisor = prepareTestProcessSupervisor()
const runnerRuntime = await bootstrapIsolatedTestRuntime("runner")
if (testProcessSupervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = testProcessSupervisor

try {
  const { runHostCommandWithInactivity } = await import("../src/shell/command-inactivity")
  const result = await runHostCommandWithInactivity({
    executable: command.executable,
    args: command.args,
    cwd: process.cwd(),
    env: isolatedTestChildEnvironment(runnerRuntime),
    inactivityTimeoutMs: command.inactivityMs,
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  })

  if (result.failure) {
    process.stderr.write(`${result.failure.message}\n`)
    process.exitCode = 1
  } else if (result.exitCode === undefined) {
    throw new Error("Inactivity runner returned no exit code or failure diagnostic")
  } else {
    process.exitCode = result.exitCode
  }
} finally {
  await removeIsolatedTestRuntime(runnerRuntime)
}
