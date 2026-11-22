import { spawnSync } from "node:child_process"
import { statSync } from "node:fs"
import path from "node:path"

export function resolveInstalledRustTool(name: "cargo" | "rustc", environment: NodeJS.ProcessEnv): string {
  const explicit = environment[name === "cargo" ? "CARGO" : "RUSTC"]
  if (explicit) {
    if (!path.isAbsolute(explicit) || !statSync(explicit).isFile())
      throw new Error(`Configured ${name} is not an installed absolute executable: ${explicit}`)
    return explicit
  }
  const result = spawnSync("rustup", ["which", name], {
    encoding: "utf8",
    windowsHide: true,
    env: environment,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`rustup could not resolve installed ${name}: ${result.stderr.trim()}`)
  const resolved = result.stdout.trim()
  if (!path.isAbsolute(resolved)) throw new Error(`rustup returned a non-absolute ${name} path: ${resolved}`)
  return resolved
}
