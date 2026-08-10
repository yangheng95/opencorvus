import path from "node:path"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"

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

for (const file of files) {
  const result = await runHostCommandWithInactivity({
    executable: process.execPath,
    args: ["test", "--timeout=0", "--parallel=1", "test/isolated-test-entry.test.ts"],
    cwd,
    env: { ...process.env, OPENCORVUS_TEST_FILES: JSON.stringify([file]) },
    inactivityTimeoutMs: 120_000,
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  })

  if (result.exitCode === undefined) {
    throw new Error(result.failure?.message ?? `OpenCorvus test process exited without a result for ${file}`)
  }
  if (result.exitCode !== 0) process.exit(result.exitCode)
}
