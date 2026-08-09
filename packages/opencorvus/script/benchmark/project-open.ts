import path from "node:path"
import { Process } from "../../src/util/process"

const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1_000
const repoRoot = path.resolve(import.meta.dir, "../../../..")

export const PROJECT_OPEN_TEST_FILES = [
  "packages/opencorvus/test/project/open-lifecycle.test.ts",
  "packages/opencorvus/test/util/process.test.ts",
  "packages/opencorvus/test/util/git-timeout.test.ts",
  "packages/opencorvus/test/server/global-project-discovery.test.ts",
  "packages/overlay/test/official-runtime-paths.test.ts",
] as const

export const PROJECT_OPEN_PREPARE_COMMANDS = [
  [process.execPath, "packages/sdk/js/script/build.ts"],
  [process.execPath, "run", "--cwd", "packages/overlay", "build:vite"],
  [process.execPath, "run", "--cwd", "packages/opencorvus", "build", "--overlay-server"],
] as const

export function resolveIdleTimeoutMs(argv: string[]) {
  const index = argv.indexOf("--idle-timeout-ms")
  if (index === -1) return DEFAULT_IDLE_TIMEOUT_MS
  const value = Number(argv[index + 1])
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("--idle-timeout-ms must be a positive integer")
  }
  return value
}

async function runStep(label: string, command: string[], idleTimeoutMs: number) {
  process.stdout.write(`[project-open] ${label}: started\n`)
  const result = await Process.runHost(command, {
    cwd: repoRoot,
    inactivityTimeoutMs: idleTimeoutMs,
    inactivityTimeoutMessage: `${label} produced no stdout/stderr activity for ${idleTimeoutMs}ms`,
    nothrow: true,
  })
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  if (result.code !== 0) {
    throw new Error(`${label} failed with exit code ${result.code}`)
  }
  process.stdout.write(`[project-open] ${label}: completed\n`)
}

export async function runProjectOpenBenchmark(argv = process.argv.slice(2)) {
  const idleTimeoutMs = resolveIdleTimeoutMs(argv)
  for (const [index, command] of PROJECT_OPEN_PREPARE_COMMANDS.entries()) {
    await runStep(`prepare ${index + 1}/${PROJECT_OPEN_PREPARE_COMMANDS.length}`, [...command], idleTimeoutMs)
  }
  await runStep(
    "project-open runtime tests",
    [process.execPath, "test", "--timeout", "0", ...PROJECT_OPEN_TEST_FILES],
    idleTimeoutMs,
  )
  await runStep(
    "overlay Rust tests",
    ["cargo", "test", "--manifest-path", "packages/overlay/src-tauri/Cargo.toml"],
    idleTimeoutMs,
  )
}

if (import.meta.main) {
  await runProjectOpenBenchmark().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
