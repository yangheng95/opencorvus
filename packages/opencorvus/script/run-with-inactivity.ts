import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"

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
const result = await runHostCommandWithInactivity({
  executable: command.executable,
  args: command.args,
  cwd: process.cwd(),
  env: process.env,
  inactivityTimeoutMs: command.inactivityMs,
  onStdout: (chunk) => process.stdout.write(chunk),
  onStderr: (chunk) => process.stderr.write(chunk),
})

if (result.exitCode === undefined) {
  if (!result.failure) throw new Error("Inactivity runner returned no exit code or failure diagnostic")
  process.stderr.write(`${result.failure.message}\n`)
  process.exit(1)
}
process.exit(result.exitCode)
