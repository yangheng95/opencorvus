import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

describe("Expert Squad package snapshot publication", () => {
  test("publishes one complete embedded package at its content digest", async () => {
    const base = payloadPackageSources[0]!
    const readme = `${base.files["README.md"]}\nSnapshot publication contract.\n`
    const source = { ...base, files: { ...base.files, "README.md": readme } }

    const snapshot = await ExpertSquadRegistry.materializeEmbeddedPackageSnapshot(source)

    expect(snapshot.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(path.basename(snapshot.root)).toBe(snapshot.digest)
    expect(await ExpertSquadRegistry.packageDigest(snapshot.root)).toBe(snapshot.digest)
    expect(await readFile(path.join(snapshot.root, "README.md"), "utf8")).toBe(readme)
  })
})
