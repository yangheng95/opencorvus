import path from "path"

export function prepareCompiledBinaryRuntime() {
  const binDir = path.dirname(process.execPath)
  const originalCwd = process.cwd()

  // Preserve the current working directory (CWD) before native package resolution moves to the executable dir.
  process.env.OPENCORVUS_ORIGINAL_CWD = originalCwd
  process.chdir(binDir)
}

export async function runCompiledBinaryEntrypoint(loadEntrypoint: () => Promise<unknown>) {
  prepareCompiledBinaryRuntime()
  try {
    if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_RENDERER === "1") {
      await import("../work-artifact/presentation-render-process")
    } else if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_INSPECTOR === "1") {
      await import("../work-artifact/presentation-inspector-process")
    } else {
      await loadEntrypoint()
    }
  } catch (error) {
    process.exitCode = 1
    process.stderr.write(formatEntrypointError(error))
    process.exit(1)
  }
}

function formatEntrypointError(error: unknown): string {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  return message.endsWith("\n") ? message : `${message}\n`
}
