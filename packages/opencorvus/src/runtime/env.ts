/**
 * Snapshot the current process environment as a plain string-valued record.
 *
 * Used by route handlers that need to spawn child processes (e.g. server
 * restart) without taking a hard dependency on `process.env` directly.
 * Routes never read or mutate `process.env`; runtime helpers do.
 */
export namespace Env {
  export function snapshot(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(process.env)) {
      if (typeof v === "string") out[k] = v
    }
    return out
  }
}
