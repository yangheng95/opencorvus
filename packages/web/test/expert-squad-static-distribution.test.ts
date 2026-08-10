import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { builtInPackageSources } from "../../opencorvus/src/expert-squad/builtin"
import { payloadPackageSources } from "../../opencorvus/generated/expert-squad-payload"
import { generateExpertSquadDistribution } from "../script/generate-expert-squad-distribution"

async function snapshot(root: string) {
  const files = new Map<string, Uint8Array>()
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else if (entry.isFile()) files.set(path.relative(root, target).split(path.sep).join("/"), await readFile(target))
    }
  }
  await walk(root)
  return files
}

describe("Expert Squad public static distribution", () => {
  test("generates the complete authoritative source catalog and byte-stable artifacts", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "opencorvus-expert-squad-distribution-"))
    const firstRoot = path.join(temporary, "first")
    const secondRoot = path.join(temporary, "second")
    try {
      const first = await generateExpertSquadDistribution(firstRoot, path.join(temporary, "first-metadata.ts"), [])
      const second = await generateExpertSquadDistribution(secondRoot, path.join(temporary, "second-metadata.ts"), [])
      expect(first.catalog.resources).toEqual({
        total: builtInPackageSources.length + payloadPackageSources.length,
        embeddedAlreadyAvailable: builtInPackageSources.length,
        bundledMarketImportable: payloadPackageSources.length,
      })
      expect(first.catalog.packages).toHaveLength(builtInPackageSources.length + payloadPackageSources.length)
      expect(first.catalog.packages.filter((item) => item.disposition === "embedded_already_available")).toHaveLength(
        builtInPackageSources.length,
      )
      expect(first.catalog.packages.filter((item) => item.disposition === "bundled_market_importable")).toHaveLength(
        payloadPackageSources.length,
      )
      expect(second.catalogSha256).toBe(first.catalogSha256)

      const firstFiles = await snapshot(firstRoot)
      const secondFiles = await snapshot(secondRoot)
      expect([...secondFiles.keys()].sort()).toEqual([...firstFiles.keys()].sort())
      for (const [relativePath, bytes] of firstFiles) expect(secondFiles.get(relativePath)).toEqual(bytes)

      const catalogPath = first.catalogPath.replace(/^\/expert-squads\//, "")
      const parsedCatalog = JSON.parse(await readFile(path.join(firstRoot, ...catalogPath.split("/")), "utf8"))
      expect(parsedCatalog).toEqual(first.catalog)
      expect(await readFile(path.join(firstRoot, "SHA256SUMS"), "utf8")).toContain(first.catalogSha256)
    } finally {
      await rm(temporary, { recursive: true, force: true })
    }
  }, 60_000)
})
