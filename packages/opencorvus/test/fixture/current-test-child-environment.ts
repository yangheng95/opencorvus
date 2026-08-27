import path from "node:path"

function requiredAbsolutePath(name: "OPENCORVUS_TEST_PROCESS_ROOT" | "OPENCORVUS_HOME"): string {
  const value = process.env[name]?.trim()
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path in the test runtime`)
  return path.resolve(value)
}

/**
 * Explicit environment for a child of the current isolated test process.
 *
 * The package runner starts the Bun test host from its own runner environment,
 * then the preload moves the test host into a strict child runtime. Bun on
 * Windows can otherwise spawn from the process-start environment snapshot, so
 * an implicit child inherits the runner root while receiving the test runtime
 * through its arguments. Passing this projection makes the current test
 * process — not its parent runner — the one environment authority.
 */
export function currentTestChildEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const processRoot = requiredAbsolutePath("OPENCORVUS_TEST_PROCESS_ROOT")
  const runtimeRoot = requiredAbsolutePath("OPENCORVUS_HOME")
  const relative = path.relative(processRoot, runtimeRoot)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Current test runtime ${runtimeRoot} must be a child of ${processRoot}`)
  }
  return {
    ...process.env,
    ...overrides,
    OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
    OPENCORVUS_HOME: runtimeRoot,
  }
}
