import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "../script/build-overlay.ts"), "utf8")
const packageManifest = JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8")) as {
  scripts: Record<string, string>
}

describe("build-overlay", () => {
  test("keeps ordinary UI build separate from explicit packaging", () => {
    expect(packageManifest.scripts.build).toBe("bun run build:vite")
    expect(packageManifest.scripts["build:overlay"]).toBe("bun run script/build-overlay.ts")
  })

  test("passes the locked binary path as an argument and uses LiteralPath", () => {
    expect(source).toContain("Remove-Item -Force -LiteralPath $args[0] -ErrorAction SilentlyContinue")
    expect(source).toContain('" ${builtOverlay}`')
  })

  test("builds Vite before the server and SDK artifacts", () => {
    const viteBuildIndex = source.indexOf("bun run build:vite")
    const artifactGenerationIndex = source.indexOf('step("Generate OpenCorvus build artifacts")')
    const sdkRebuildIndex = source.indexOf('step("Rebuild SDK")')
    const serverBuildIndex = source.indexOf("bun run build --overlay-server")

    expect(viteBuildIndex).toBeGreaterThan(-1)
    expect(artifactGenerationIndex).toBeGreaterThan(viteBuildIndex)
    expect(sdkRebuildIndex).toBeGreaterThan(artifactGenerationIndex)
    expect(sdkRebuildIndex).toBeGreaterThan(viteBuildIndex)
    expect(serverBuildIndex).toBeGreaterThan(sdkRebuildIndex)
  })
})
