import { describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { ExpertSquadArchive } from "../../src/expert-squad/archive"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { Global } from "../../src/global"

describe("Expert Squad static distribution archives", () => {
  test("all shipped sources produce byte-identical canonical archives", async () => {
    const embeddedIdentities = new Set(builtInPackageSources.map((source) => `${source.namespace}/${source.id}`))
    const sources = [...builtInPackageSources, ...payloadPackageSources]
    expect(sources.length).toBe(builtInPackageSources.length + payloadPackageSources.length)
    expect(embeddedIdentities.size).toBe(builtInPackageSources.length)

    const identities = new Set<string>()
    for (const source of sources) {
      const first = await ExpertSquadArchive.createFromEmbeddedSource(source)
      const second = await ExpertSquadArchive.createFromEmbeddedSource(source)
      const identity = `${first.namespace}/${first.id}`
      expect(identities.has(identity)).toBeFalse()
      identities.add(identity)
      expect(second.bytes).toEqual(first.bytes)
      expect(second.archiveSha256).toBe(first.archiveSha256)
      expect(first.archiveSha256).toMatch(/^[a-f0-9]{64}$/)
      expect(first.packageDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(first.fileCount).toBe(Object.keys(source.files).length)
    }
  }, 60_000)

  test("the fixed canonical ZIP fixture has a stable byte hash", async () => {
    const bytes = await ExpertSquadArchive.createDeterministicZip([
      { path: "zeta.txt", bytes: Buffer.from("last\n", "utf8") },
      { path: "alpha/β.txt", bytes: Buffer.from("first\n", "utf8") },
    ])
    const repeated = await ExpertSquadArchive.createDeterministicZip([
      { path: "alpha/β.txt", bytes: Buffer.from("first\n", "utf8") },
      { path: "zeta.txt", bytes: Buffer.from("last\n", "utf8") },
    ])
    expect(repeated).toEqual(bytes)
    expect(ExpertSquadArchive.sha256(bytes)).toBe("6c7aca46303ac48e223db85c2e8f32dc846a36468cf3141cb5af718751a7e5cc")
  })

  test("control-character paths report the canonical archive error contract", async () => {
    await expect(
      ExpertSquadArchive.createDeterministicZip([
        { path: "unsafe\nname.txt", bytes: Buffer.from("content\n", "utf8") },
      ]),
    ).rejects.toThrow("Expert Squad archive entry must be a canonical relative path")
  })

  test("installed export equals the canonical embedded-source archive", async () => {
    const source = payloadPackageSources.find((candidate) => candidate.id === "frontend-replica")!
    const sourceArchive = await ExpertSquadArchive.createFromEmbeddedSource(source)
    const projectDirectory = await Global.createTemporaryDirectory("expert-squad-static-export-parity-")
    try {
      await ExpertSquadPackageManager.installPayloadPackage({
        projectDirectory,
        id: source.id,
        installationScope: "project",
      })
      const installedArchive = await ExpertSquadPackageManager.exportArchive({
        projectDirectory,
        id: source.id,
        installationScope: "project",
      })
      expect(installedArchive.bytes).toEqual(sourceArchive.bytes)
      expect(installedArchive.archiveSha256).toBe(sourceArchive.archiveSha256)
      expect(installedArchive.packageDigest).toBe(sourceArchive.packageDigest)
    } finally {
      await rm(projectDirectory, { recursive: true, force: true })
    }
  }, 60_000)
})
