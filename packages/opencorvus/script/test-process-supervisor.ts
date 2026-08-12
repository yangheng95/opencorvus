import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"

export function expectedTestProcessSupervisor(): string | undefined {
  if (process.platform !== "win32") return undefined
  const nativeRoot = path.resolve(import.meta.dir, "../native/process-supervisor")
  const sourceIdentity = createHash("sha256")
    .update(readFileSync(path.join(nativeRoot, "Cargo.toml")))
    .update(readFileSync(path.join(nativeRoot, "Cargo.lock")))
    .update(readFileSync(path.join(nativeRoot, "src/main.rs")))
    .digest("hex")
    .slice(0, 16)
  return path.join(
    nativeRoot,
    "target",
    `runtime-${sourceIdentity}`,
    "debug",
    "opencorvus-process-supervisor.exe",
  )
}
