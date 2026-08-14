import { afterAll, beforeAll, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rename, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import { LEGACY_SCHEMA_CHECKSUM, SCHEMA_CHECKSUM, WebsiteRegistry, inspectWebsiteRegistrySchema, readWebsiteRegistrySeed } from "../src/lib/website-registry"
import { importWebsiteRegistryPublication } from "../src/lib/website-registry-import"
import { WebsiteRegistryConflictError, WebsiteRegistryIntegrityError } from "../src/lib/website-registry-contract"
import { canonicalWebsiteRegistryJSON } from "../src/lib/website-registry-contract"
import { validateWebsiteRegistrySeed } from "../src/lib/website-registry-seed-validation"

const webRoot = path.resolve(import.meta.dir, "..")
const generatedRoot = path.join(webRoot, ".generated")
const distributionRoot = path.join(webRoot, ".generated")
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
  await expect(validateWebsiteRegistrySeed(tampered, distributionRoot)).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
})

test(
  "imports, queries, counts, verifies, backs up, restores, and protects one immutable publication",
  async () => {
    const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
    const firstPublication = await importWebsiteRegistryPublication(registry, seed, distributionRoot)
    const repeatedPublication = await importWebsiteRegistryPublication(registry, seed, distributionRoot)
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
    await expect(importWebsiteRegistryPublication(registry, seed, distributionRoot)).rejects.toBeInstanceOf(WebsiteRegistryConflictError)
    registry.sqlite.run("UPDATE publication SET catalog_bytes = ? WHERE catalog_sha256 = ?", [seed.catalog.bytes, seed.catalog.sha256])
    expect(await importWebsiteRegistryPublication(registry, seed, distributionRoot)).toBe(firstPublication)

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
    await expect(importWebsiteRegistryPublication(registry, seed, distributionRoot)).rejects.toBeInstanceOf(WebsiteRegistryConflictError)
  },
  120_000,
)

test("keeps schema version 1 while counting rolling opt-in browser tokens", async () => {
  const visitorRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-site-visitors-"))
  const visitorRegistry = await WebsiteRegistry.open(path.join(visitorRoot, "registry.sqlite3"), path.join(visitorRoot, "data"))
  try {
    const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
    await importWebsiteRegistryPublication(visitorRegistry, seed, distributionRoot)
    expect(visitorRegistry.sqlite.query<{ version: number; checksum: string }, []>("SELECT version, checksum FROM registry_schema").get()).toEqual({
      version: 1,
      checksum: SCHEMA_CHECKSUM,
    })
    const digest = "a".repeat(64)
    const start = Date.UTC(2026, 0, 1) / 1000
    expect(visitorRegistry.countVisitor(digest, start)).toMatchObject({ estimatedParticipatingBrowsers: 1, participating: true, counted: true })
    expect(visitorRegistry.countVisitor(digest, start + 60)).toMatchObject({ estimatedParticipatingBrowsers: 1, participating: true, renewalDue: false })
    expect(visitorRegistry.visitorSummary(digest, start + 24 * 60 * 60)).toMatchObject({ participating: true, renewalDue: true })
    expect(visitorRegistry.countVisitor(digest, start + 24 * 60 * 60)).toMatchObject({ estimatedParticipatingBrowsers: 1, renewalDue: false })
    expect(visitorRegistry.visitorSummary(digest, start + 29 * 24 * 60 * 60)).toMatchObject({ participating: true, renewalDue: true })
    expect(visitorRegistry.countVisitor(digest, start + 29 * 24 * 60 * 60)).toMatchObject({ estimatedParticipatingBrowsers: 1, renewalDue: false })
    expect(visitorRegistry.visitorSummary(digest, start + 31 * 24 * 60 * 60)).toMatchObject({ participating: true })
    expect(visitorRegistry.withdrawVisitor(digest, start + 31 * 24 * 60 * 60)).toMatchObject({ estimatedParticipatingBrowsers: 0, participating: false })

    visitorRegistry.countVisitor(digest, start)
    visitorRegistry.sqlite.run("UPDATE site_visitor SET expires_at = ? WHERE visitor_digest = ?", [start + 1, digest])
    visitorRegistry.sqlite.run("UPDATE site_visitor_summary SET next_cleanup_at = ? WHERE singleton = 1", [start + 60 * 60])
    expect(visitorRegistry.countVisitor(digest, start + 2)).toMatchObject({ estimatedParticipatingBrowsers: 1, participating: true, counted: true })
    expect(visitorRegistry.withdrawVisitor(digest, start + 2)).toMatchObject({ estimatedParticipatingBrowsers: 0 })

    visitorRegistry.countVisitor(digest, start)
    expect(visitorRegistry.cleanupVisitors(start + 30 * 24 * 60 * 60)).toBe(1)
    expect(visitorRegistry.visitorSummary()).toMatchObject({ estimatedParticipatingBrowsers: 0 })
    visitorRegistry.sqlite.run("UPDATE site_visitor_summary SET active_count = 150000, intake_day = '2026-01-01', new_tokens_today = 5000 WHERE singleton = 1")
    expect(visitorRegistry.countVisitor("b".repeat(64), start)).toMatchObject({ counted: false, estimatedParticipatingBrowsers: 150000 })
    visitorRegistry.sqlite.run("UPDATE site_visitor_summary SET active_count = 0, new_tokens_today = 0 WHERE singleton = 1")
    visitorRegistry.sqlite.run("INSERT INTO site_visitor(visitor_digest, first_seen_at, expires_at) VALUES (?, ?, ?)", ["c".repeat(64), start - 60, start - 1])
    const failedBackup = path.join(visitorRoot, "failed-backup.sqlite3")
    await expect(visitorRegistry.backup(failedBackup)).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    await expect(access(failedBackup)).rejects.toMatchObject({ code: "ENOENT" })
    visitorRegistry.sqlite.run("DELETE FROM site_visitor WHERE visitor_digest = ?", ["c".repeat(64)])
    expect(await visitorRegistry.readiness()).toMatchObject({ status: "ready", schemaVersion: 1 })
  } finally {
    visitorRegistry.close()
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(visitorRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 30_000)

test("resets the exact legacy v1 fingerprint into the current v1 fingerprint at a sibling path", async () => {
  const resetRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-v1-reset-"))
  const databasePath = path.join(resetRoot, "registry.sqlite3")
  const targetPath = path.join(resetRoot, "registry-reset.sqlite3")
  const dataRoot = path.join(resetRoot, "data")
  let legacy = await WebsiteRegistry.open(databasePath, dataRoot)
  try {
    const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
    await importWebsiteRegistryPublication(legacy, seed, distributionRoot)
    legacy.sqlite.exec("DROP INDEX site_visitor_expiry; DROP TABLE site_visitor; DROP TABLE site_visitor_summary")
    legacy.sqlite.run("UPDATE registry_schema SET checksum = ? WHERE version = 1", [LEGACY_SCHEMA_CHECKSUM])
  } finally {
    legacy.close()
  }
  expect(inspectWebsiteRegistrySchema(databasePath)).toBe("legacy")
  const child = Bun.spawn([
    process.execPath,
    "run",
    path.join(webRoot, "script", "website-registry-control.ts"),
    "reset-v1",
    "--database", databasePath,
    "--data", dataRoot,
    "--target", targetPath,
    "--seed", path.join(generatedRoot, "website-registry-seed.json"),
    "--source", distributionRoot,
  ], { cwd: webRoot, stdout: "pipe", stderr: "inherit" })
  expect(await child.exited).toBe(0)
  expect(inspectWebsiteRegistrySchema(targetPath)).toBe("current")
  const reset = await WebsiteRegistry.open(targetPath, dataRoot)
  try {
    expect(await reset.readiness()).toMatchObject({ status: "ready", schemaVersion: 1 })
    expect(reset.visitorSummary()).toMatchObject({ estimatedParticipatingBrowsers: 0 })
    expect(reset.sqlite.query<{ total: number }, []>("SELECT COALESCE(SUM(response_count), 0) AS total FROM revision_download_counter").get()?.total).toBe(0)
  } finally {
    reset.close()
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(resetRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 60_000)
