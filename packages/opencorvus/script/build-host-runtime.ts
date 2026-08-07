import { $ } from "bun"
import fs from "fs"

import type { ArtifactNodeRuntimeHost } from "./build-artifact"

let cachedHost: Promise<ArtifactNodeRuntimeHost> | undefined

async function detectLinuxLibc(): Promise<"glibc" | "musl"> {
  const report = process.report?.getReport?.()
  if (report?.header?.glibcVersionRuntime) return "glibc"

  const ldd = await $`sh -c "ldd --version 2>&1 || true"`.text().catch(() => "")
  if (/musl/i.test(ldd)) return "musl"
  if (/glibc|gnu libc/i.test(ldd)) return "glibc"

  for (const dir of ["/lib", "/usr/lib"]) {
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    if (entries.some((entry) => entry.name.startsWith("ld-musl"))) return "musl"
  }

  throw new Error("Cannot determine Linux libc for Browser MCP Node runtime packaging")
}

export async function detectArtifactNodeRuntimeHost(): Promise<ArtifactNodeRuntimeHost> {
  cachedHost ??= (async () => {
    if (process.platform !== "linux") {
      return { platform: process.platform, arch: process.arch }
    }
    return {
      platform: process.platform,
      arch: process.arch,
      linuxLibc: await detectLinuxLibc(),
    }
  })()
  return cachedHost
}
