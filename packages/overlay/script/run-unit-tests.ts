import { readdirSync } from "node:fs"
import path from "node:path"
import { runHostCommandWithInactivity } from "../../opencorvus/src/shell/command-inactivity"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const UNIT_TEST_INACTIVITY_TIMEOUT_MILLISECONDS = 120_000

function unitTestFiles(requestedFiles: string[]): string[] {
  if (requestedFiles.length > 0) return requestedFiles
  return readdirSync(path.join(OVERLAY_ROOT, "test"))
    .filter((file) => file.endsWith(".test.ts"))
    .map((file) => path.join("test", file))
    .sort()
}

const files = unitTestFiles(process.argv.slice(2))
if (files.length === 0) throw new Error("Overlay unit test runner requires at least one test file")

for (const file of files) {
  const result = await runHostCommandWithInactivity({
    executable: process.execPath,
    args: ["test", "--timeout=0", file],
    cwd: OVERLAY_ROOT,
    env: process.env,
    inactivityTimeoutMs: UNIT_TEST_INACTIVITY_TIMEOUT_MILLISECONDS,
    onStdout: (chunk) => process.stdout.write(chunk),
    onStderr: (chunk) => process.stderr.write(chunk),
  })
  if (result.exitCode === undefined) {
    throw new Error(`${file}: no stdout/stderr activity for ${UNIT_TEST_INACTIVITY_TIMEOUT_MILLISECONDS} milliseconds`)
  }
  if (result.exitCode !== 0) process.exit(result.exitCode)
}
