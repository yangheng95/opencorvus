import { expect, test } from "bun:test"
import path from "node:path"
import { createServer, defaultClientConditions } from "vite"

const overlayRoot = path.resolve(import.meta.dir, "..")
const repoRoot = path.resolve(overlayRoot, "..", "..")
test("the renderer resolves workspace conditional exports to canonical source", async () => {
  const server = await createServer({
    configFile: path.join(overlayRoot, "vite.config.ts"),
    root: path.join(overlayRoot, "src"),
    appType: "custom",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
  })
  try {
    for (const condition of ["source", ...defaultClientConditions]) {
      expect(server.config.resolve.conditions).toContain(condition)
    }

    const importer = path.join(repoRoot, "packages", "transport-protocol", "src", "index.ts")
    const resolved = await server.pluginContainer.resolveId("@opencorvus-ai/util/product-pillar", importer)

    expect(path.normalize(resolved?.id ?? "")).toBe(path.join(repoRoot, "packages", "util", "src", "product-pillar.ts"))
  } finally {
    await server.close()
  }
}, 60_000)
