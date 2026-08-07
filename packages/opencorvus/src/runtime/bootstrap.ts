declare const OPENCORVUS_EMBEDDED_ENV: Record<string, string> | undefined

let booted = false

function warn(step: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[opencorvus bootstrap] ${step}: ${detail}\n`)
}

export function installProcessBootstrap() {
  if (booted) return
  booted = true

  try {
    if (typeof OPENCORVUS_EMBEDDED_ENV === "object" && OPENCORVUS_EMBEDDED_ENV) {
      for (const [key, value] of Object.entries(OPENCORVUS_EMBEDDED_ENV)) {
        if (!(key in process.env) || process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    }
  } catch (error) {
    warn("apply embedded env", error)
  }

  if (process.env.OPENCORVUS_ORIGINAL_CWD) {
    try {
      process.chdir(process.env.OPENCORVUS_ORIGINAL_CWD)
    } catch (error) {
      warn("restore original cwd", error)
    }
  }
}
