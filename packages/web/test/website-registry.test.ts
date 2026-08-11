import { afterAll, beforeAll, expect, test } from "bun:test"
import { mkdtemp, readFile, rename, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { WebsiteRegistry, readWebsiteRegistrySeed } from "../src/lib/website-registry"
import { importWebsiteRegistryPublication } from "../src/lib/website-registry-import"
import { WebsiteRegistryConflictError, WebsiteRegistryIntegrityError } from "../src/lib/website-registry-contract"
import { canonicalWebsiteRegistryJSON } from "../src/lib/website-registry-contract"
import { validateWebsiteRegistrySeed } from "../src/lib/website-registry-seed-validation"

const webRoot = path.resolve(import.meta.dir, "..")
const generatedRoot = path.join(webRoot, ".generated")
let root = ""
let registry: WebsiteRegistry

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-website-registry-"))
  registry = await WebsiteRegistry.open(path.join(root, "registry.sqlite3"), path.join(root, "data"))
})

afterAll(async () => {
  registry?.close()
  registry = undefined!
  Bun.gc(true)
  await Bun.sleep(100)
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
})

test("rejects a seed whose disposition facts were swapped outside the signed catalog", async () => {
  const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
  const tampered = structuredClone(seed)
  const embedded = tampered.packages.find((entry) => entry.disposition === "embedded_already_available")!
  const importable = tampered.packages.find((entry) => entry.disposition === "bundled_market_importable")!
  ;[embedded.disposition, importable.disposition] = [importable.disposition, embedded.disposition]
  for (const entry of [embedded, importable]) {
    const { factsSha256: _factsSha256, ...projection } = entry
    entry.factsSha256 = createHash("sha256").update(canonicalWebsiteRegistryJSON(projection)).digest("hex")
  }
  await expect(validateWebsiteRegistrySeed(tampered, generatedRoot)).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
})

test(
  "imports, queries, counts, verifies, backs up, restores, and protects one immutable publication",
  async () => {
    const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
    const firstPublication = await importWebsiteRegistryPublication(registry, seed, generatedRoot)
    const repeatedPublication = await importWebsiteRegistryPublication(registry, seed, generatedRoot)
    expect(repeatedPublication).toBe(firstPublication)

    const ready = await registry.readiness()
    expect(ready).toMatchObject({
      status: "ready",
      publication: {
        total: seed.resources.total,
        embeddedAlreadyAvailable: seed.resources.embeddedAlreadyAvailable,
        bundledMarketImportable: seed.resources.bundledMarketImportable,
      },
    })
    const records = registry.squads()
    expect(records).toHaveLength(seed.resources.total)
    const frontend = registry.squad("builtin", "frontend-replica")
    const expectedFrontend = seed.packages.find(
      (entry) => entry.identity.namespace === "builtin" && entry.identity.id === "frontend-replica",
    )!
    expect(frontend).toMatchObject({
      identity: { namespace: "builtin", id: "frontend-replica" },
      description: {
        root: expectedFrontend.locales.find((locale) => locale.locale === "en")!.description,
        "zh-cn": expectedFrontend.locales.find((locale) => locale.locale === "zh-CN")!.description,
      },
      displayLabel: {
        root: expectedFrontend.locales.find((locale) => locale.locale === "en")!.label,
        "zh-cn": expectedFrontend.locales.find((locale) => locale.locale === "zh-CN")!.label,
      },
    })
    expect(frontend?.workflows.flatMap((workflow) => workflow.nodes).length).toBeGreaterThan(0)
    const relationCounts = {
      squad_revision_locale: seed.packages.length * 2,
      squad_revision_pillar: seed.packages.reduce((total, entry) => total + entry.pillars.length, 0),
      squad_agent: seed.packages.reduce((total, entry) => total + entry.agents.length, 0),
      squad_workflow: seed.packages.reduce((total, entry) => total + entry.workflows.length, 0),
      squad_workflow_node: seed.packages.reduce((total, entry) => total + entry.workflows.reduce((nodes, workflow) => nodes + workflow.nodes.length, 0), 0),
      squad_workflow_dependency: seed.packages.reduce((total, entry) => total + entry.workflows.reduce((dependencies, workflow) => dependencies + workflow.nodes.reduce((items, node) => items + node.dependsOn.length, 0), 0), 0),
    }
    for (const [table, expected] of Object.entries(relationCounts)) {
      expect(registry.sqlite.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count).toBe(expected)
    }

    const exact = records[0]!
    const archive = registry.archive(exact.identity.namespace, exact.identity.id, exact.identity.version, exact.identity.digest)!
    const archiveFile = await registry.verifiedArchive(archive, true)
    expect((await readFile(archiveFile)).byteLength).toBe(archive.bytes)
    expect(
      registry.sqlite
        .query<{ response_count: number }, [number]>(
          "SELECT response_count FROM revision_download_counter WHERE revision_id = ?",
        )
        .get(archive.revisionID)?.response_count,
    ).toBe(1)

    registry.close()
    registry = undefined!
    Bun.gc(true)
    await Bun.sleep(100)
    registry = await WebsiteRegistry.open(path.join(root, "registry.sqlite3"), path.join(root, "data"))
    expect(
      registry.sqlite.query<{ response_count: number }, [number]>("SELECT response_count FROM revision_download_counter WHERE revision_id = ?").get(archive.revisionID)?.response_count,
    ).toBe(1)

    const backupPath = path.join(root, "backups", "registry.sqlite3")
    await registry.backup(backupPath)
    const restored = await WebsiteRegistry.open(backupPath, path.join(root, "data"))
    try {
      expect(await restored.readiness()).toMatchObject({ status: "ready", publication: { total: seed.resources.total } })
    } finally {
      restored.close()
    }

    const missingPath = `${archiveFile}.missing-probe`
    await rename(archiveFile, missingPath)
    try {
      await expect(registry.readiness()).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    } finally {
      await rename(missingPath, archiveFile)
    }
    expect(await registry.readiness()).toMatchObject({ status: "ready" })

    registry.sqlite.run("UPDATE publication SET catalog_bytes = catalog_bytes + 1 WHERE catalog_sha256 = ?", [seed.catalog.sha256])
    await expect(importWebsiteRegistryPublication(registry, seed, generatedRoot)).rejects.toBeInstanceOf(WebsiteRegistryConflictError)
    registry.sqlite.run("UPDATE publication SET catalog_bytes = ? WHERE catalog_sha256 = ?", [seed.catalog.bytes, seed.catalog.sha256])
    expect(await importWebsiteRegistryPublication(registry, seed, generatedRoot)).toBe(firstPublication)

    registry.sqlite.run("DELETE FROM revision_download_counter WHERE revision_id = ?", [archive.revisionID])
    await expect(registry.readiness()).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    await expect(registry.verifiedArchive(archive, true)).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    registry.sqlite.run("INSERT INTO revision_download_counter(revision_id, response_count) VALUES (?, ?)", [archive.revisionID, 1])
    expect(await registry.readiness()).toMatchObject({ status: "ready" })

    registry.sqlite.run("UPDATE publication SET embedded_total = embedded_total + 1, importable_total = importable_total - 1 WHERE catalog_sha256 = ?", [seed.catalog.sha256])
    await expect(registry.readiness()).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    registry.sqlite.run("UPDATE publication SET embedded_total = ?, importable_total = ? WHERE catalog_sha256 = ?", [seed.resources.embeddedAlreadyAvailable, seed.resources.bundledMarketImportable, seed.catalog.sha256])
    expect(await registry.readiness()).toMatchObject({ status: "ready" })

    const frontendRevision = registry.sqlite.query<{ id: number }, []>("SELECT id FROM squad_revision WHERE namespace = 'builtin' AND squad_id = 'frontend-replica'").get()!.id
    registry.sqlite.run("UPDATE squad_revision_locale SET description = ? WHERE revision_id = ? AND locale = 'en'", ["drifted projection", frontendRevision])
    await expect(registry.readiness()).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    registry.sqlite.run("UPDATE squad_revision_locale SET description = ? WHERE revision_id = ? AND locale = 'en'", [expectedFrontend.locales.find((locale) => locale.locale === "en")!.description, frontendRevision])
    expect(await registry.readiness()).toMatchObject({ status: "ready" })

    registry.sqlite.run(
      "UPDATE squad_revision SET package_digest = ? WHERE namespace = ? AND squad_id = ? AND version = ?",
      ["f".repeat(64), exact.identity.namespace, exact.identity.id, exact.identity.version],
    )
    await expect(importWebsiteRegistryPublication(registry, seed, generatedRoot)).rejects.toBeInstanceOf(WebsiteRegistryConflictError)
  },
  120_000,
)
