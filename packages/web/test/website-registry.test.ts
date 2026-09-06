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
import { ExpertSquadRegistry } from "../../opencorvus/src/expert-squad/registry"
import { payloadPackageSources } from "../../opencorvus/generated/expert-squad-payload"
import { projectExpertSquadFacts } from "../src/lib/expert-squad-facts"
import { projectPublicSquadRecord } from "../src/content/public-market"
import { generateExpertSquadDistribution } from "../script/generate-expert-squad-distribution"
import type { WebsiteRegistrySeed } from "../src/lib/website-registry-contract"

const exists = (target: string) => access(target).then(() => true).catch(() => false)

const webRoot = path.resolve(import.meta.dir, "..")
const generatedRoot = path.join(webRoot, ".generated")
const distributionRoot = path.join(webRoot, ".generated")
let root = ""
let registry: WebsiteRegistry

async function singlePackagePublication(
  source: ExpertSquadRegistry.EmbeddedPackageSource,
  sourceRoot: string,
): Promise<WebsiteRegistrySeed> {
  const distribution = await generateExpertSquadDistribution(
    path.join(sourceRoot, "expert-squads"),
    path.join(sourceRoot, "distribution-metadata.ts"),
    [],
    { sources: [source], embeddedIdentities: new Set() },
  )
  const facts = projectExpertSquadFacts(ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source))
  const publicRecord = projectPublicSquadRecord(facts)
  const archive = distribution.catalog.packages[0]!
  const disposition = (() => {
    if (archive.disposition === "embedded_already_available") return "embedded_already_available" as const
    if (archive.disposition === "bundled_market_importable") return "bundled_market_importable" as const
    throw new Error(`Unexpected distribution disposition: ${archive.disposition}`)
  })()
  const normalized = {
    ...facts,
    agents: [...publicRecord.agents],
    workflows: publicRecord.workflows.map((workflow) => ({
      ...workflow,
      nodes: workflow.nodes.map((node) => ({ ...node, dependsOn: [...node.dependsOn] })),
    })),
    disposition,
    archive: archive.archive,
    locales: [
      { locale: "en" as const, label: publicRecord.displayLabel.root, description: publicRecord.description.root, selectorSummary: publicRecord.selectorSummary.root },
      { locale: "zh-CN" as const, label: publicRecord.displayLabel["zh-cn"], description: publicRecord.description["zh-cn"], selectorSummary: publicRecord.selectorSummary["zh-cn"] },
    ],
  }
  return {
    protocol: "opencorvus/website-registry-seed@1",
    schemaVersion: 1,
    catalog: {
      path: distribution.catalogPath,
      sha256: distribution.catalogSha256,
      bytes: Buffer.byteLength(`${JSON.stringify(distribution.catalog, null, 2)}\n`),
    },
    resources: distribution.catalog.resources,
    packages: [{
      ...normalized,
      factsSha256: createHash("sha256").update(canonicalWebsiteRegistryJSON(normalized)).digest("hex"),
    }],
  }
}

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

test("activates a new immutable Evolution Lab revision while retaining the prior revision", async () => {
  const sequenceRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-website-revision-sequence-"))
  const sequenceRegistry = await WebsiteRegistry.open(path.join(sequenceRoot, "registry.sqlite3"), path.join(sequenceRoot, "data"))
  try {
    const current = structuredClone(payloadPackageSources.find((source) => source.id === "evolution-lab"))
    if (!current) throw new Error("Evolution Lab payload source is missing")
    const prior = structuredClone(current)
    prior.files["expert-squad.jsonc"] = prior.files["expert-squad.jsonc"]
      .replace('"version": "2026.09.06.1"', '"version": "2026.09.02.1"')
    prior.files["README.md"] = `${prior.files["README.md"]}\nPrior immutable revision fixture.\n`

    const priorRoot = path.join(sequenceRoot, "prior")
    const currentRoot = path.join(sequenceRoot, "current")
    const priorSeed = await singlePackagePublication(prior, priorRoot)
    const currentSeed = await singlePackagePublication(current, currentRoot)
    expect(priorSeed.packages[0]!.identity).toMatchObject({ id: "evolution-lab", version: "2026.09.02.1" })
    expect(currentSeed.packages[0]!.identity).toMatchObject({ id: "evolution-lab", version: "2026.09.06.1" })
    expect(priorSeed.packages[0]!.identity.digest).not.toBe(currentSeed.packages[0]!.identity.digest)

    const priorPublication = await importWebsiteRegistryPublication(sequenceRegistry, priorSeed, priorRoot)
    const currentPublication = await importWebsiteRegistryPublication(sequenceRegistry, currentSeed, currentRoot)
    expect(currentPublication).not.toBe(priorPublication)
    expect(sequenceRegistry.squad("builtin", "evolution-lab")?.identity).toEqual(currentSeed.packages[0]!.identity)
    expect(sequenceRegistry.sqlite.query<{ version: string; package_digest: string }, []>(
      "SELECT version,package_digest FROM squad_revision WHERE namespace='builtin' AND squad_id='evolution-lab' ORDER BY version",
    ).all()).toEqual([
      { version: "2026.09.02.1", package_digest: priorSeed.packages[0]!.identity.digest },
      { version: "2026.09.06.1", package_digest: currentSeed.packages[0]!.identity.digest },
    ])
    expect(sequenceRegistry.archive(
      "builtin",
      "evolution-lab",
      currentSeed.packages[0]!.identity.version,
      currentSeed.packages[0]!.identity.digest,
    )).toMatchObject({ sha256: currentSeed.packages[0]!.archive.sha256 })
  } finally {
    sequenceRegistry.close()
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(sequenceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 30_000)

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

test("keeps schema version 1 while counting page views by month and all time", async () => {
  const viewRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-site-views-"))
  const viewRegistry = await WebsiteRegistry.open(path.join(viewRoot, "registry.sqlite3"), path.join(viewRoot, "data"))
  try {
    const seed = await readWebsiteRegistrySeed(path.join(generatedRoot, "website-registry-seed.json"))
    await importWebsiteRegistryPublication(viewRegistry, seed, distributionRoot)
    expect(viewRegistry.sqlite.query<{ version: number; checksum: string }, []>("SELECT version, checksum FROM registry_schema").get()).toEqual({
      version: 1,
      checksum: SCHEMA_CHECKSUM,
    })
    const january = Date.UTC(2026, 0, 4) / 1000
    const february = Date.UTC(2026, 1, 2) / 1000
    expect(viewRegistry.viewSummary(january)).toEqual({ month: "2026-01", monthViews: 0, totalViews: 0 })
    expect(viewRegistry.recordView(january)).toEqual({ month: "2026-01", monthViews: 1, totalViews: 1 })
    expect(viewRegistry.recordView(january + 60)).toEqual({ month: "2026-01", monthViews: 2, totalViews: 2 })
    expect(viewRegistry.recordView(february)).toEqual({ month: "2026-02", monthViews: 1, totalViews: 3 })
    expect(viewRegistry.viewSummary(january)).toEqual({ month: "2026-01", monthViews: 2, totalViews: 3 })
    expect(await viewRegistry.readiness()).toMatchObject({ status: "ready", schemaVersion: 1 })

    // The monthly buckets are the ledger; a total that disagrees with them is corruption.
    viewRegistry.sqlite.run("UPDATE site_view_summary SET total_views = 9 WHERE singleton = 1")
    const failedBackup = path.join(viewRoot, "failed-backup.sqlite3")
    await expect(viewRegistry.backup(failedBackup)).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
    await expect(access(failedBackup)).rejects.toMatchObject({ code: "ENOENT" })
    viewRegistry.sqlite.run("UPDATE site_view_summary SET total_views = 3 WHERE singleton = 1")
    expect(await viewRegistry.backup(path.join(viewRoot, "backup.sqlite3"))).toContain("backup.sqlite3")
  } finally {
    viewRegistry.close()
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(viewRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
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
    legacy.sqlite.exec(`DROP TABLE site_view_month;
DROP TABLE site_view_summary;
CREATE TABLE site_visitor (
  visitor_digest TEXT PRIMARY KEY CHECK (length(visitor_digest) = 64 AND visitor_digest NOT GLOB '*[^0-9a-f]*'),
  first_seen_at INTEGER NOT NULL CHECK (first_seen_at >= 0),
  expires_at INTEGER NOT NULL CHECK (expires_at > first_seen_at)
);
CREATE TABLE site_visitor_summary (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_count INTEGER NOT NULL CHECK (active_count BETWEEN 0 AND 150000),
  next_cleanup_at INTEGER NOT NULL CHECK (next_cleanup_at >= 0),
  intake_day TEXT NOT NULL,
  new_tokens_today INTEGER NOT NULL CHECK (new_tokens_today BETWEEN 0 AND 5000),
  updated_at INTEGER NOT NULL CHECK (updated_at >= 0)
);
CREATE INDEX site_visitor_expiry ON site_visitor(expires_at);`)
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

  // The contract the deploy activator actually depends on: it swaps this file into place with a
  // plain `mv` and aborts while a sidecar sits beside it, because moving the main file alone would
  // drop whatever the WAL still held. Nothing asserted that here, which is how a reset that left
  // them behind reached production — it failed on the server, at the one step that checks.
  // Asserted before anything reopens the database, since opening it recreates them.
  for (const suffix of ["-wal", "-shm"]) {
    expect(await exists(`${targetPath}${suffix}`), `reset-v1 left ${suffix} beside its target`).toBe(false)
  }

  expect(inspectWebsiteRegistrySchema(targetPath)).toBe("current")
  const reset = await WebsiteRegistry.open(targetPath, dataRoot)
  try {
    expect(await reset.readiness()).toMatchObject({ status: "ready", schemaVersion: 1 })
    expect(reset.viewSummary()).toMatchObject({ monthViews: 0, totalViews: 0 })
    expect(reset.sqlite.query<{ total: number }, []>("SELECT COALESCE(SUM(response_count), 0) AS total FROM revision_download_counter").get()?.total).toBe(0)
  } finally {
    reset.close()
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(resetRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 60_000)

test("prepareForAtomicSwap leaves one movable file with the write-ahead log folded in", async () => {
  // `prepareForAtomicSwap` had no test at all, which is why a partial checkpoint and an unlink the
  // host refused both looked like success. The two things worth pinning are that the sidecars are
  // gone and that the data they carried survived into the main file — deleting a WAL that still
  // held commits is the failure the deploy guard exists to prevent, so a test that only checked
  // for absence would bless exactly the wrong fix.
  const swapRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-atomic-swap-"))
  const databasePath = path.join(swapRoot, "registry.sqlite3")
  try {
    const registry = await WebsiteRegistry.open(databasePath, path.join(swapRoot, "data"))
    registry.sqlite.run("UPDATE site_view_summary SET total_views = ?, updated_at = ? WHERE singleton = 1", [7, 1])
    expect(await exists(`${databasePath}-wal`)).toBe(true)

    await registry.prepareForAtomicSwap()

    for (const suffix of ["-wal", "-shm"]) {
      expect(await exists(`${databasePath}${suffix}`), `${suffix} survived the swap preparation`).toBe(false)
    }

    // Moving the main file on its own is what the activator does; the write has to come with it.
    const moved = path.join(swapRoot, "moved.sqlite3")
    await rename(databasePath, moved)
    const reopened = await WebsiteRegistry.open(moved, path.join(swapRoot, "data"))
    try {
      expect(reopened.sqlite.query<{ total_views: number }, []>("SELECT total_views FROM site_view_summary WHERE singleton = 1").get()?.total_views).toBe(7)
    } finally {
      reopened.close()
    }
  } finally {
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(swapRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 30_000)

test("a checkpoint that cannot finish is reported, not swallowed", async () => {
  // The other half of the production failure. `exec` threw the pragma's result away, and
  // wal_checkpoint(TRUNCATE) answers `busy = 1` and leaves the log intact when it cannot take the
  // writer lock — so a checkpoint that moved nothing was indistinguishable from one that emptied
  // the WAL, and the swap went ahead on a file that still needed its sidecar. A second live
  // connection reproduces that lock.
  const busyRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-busy-checkpoint-"))
  const databasePath = path.join(busyRoot, "registry.sqlite3")
  let reader: WebsiteRegistry | undefined
  let registry: WebsiteRegistry | undefined
  try {
    registry = await WebsiteRegistry.open(databasePath, path.join(busyRoot, "data"))
    registry.sqlite.run("UPDATE site_view_summary SET total_views = ?, updated_at = ? WHERE singleton = 1", [3, 1])

    reader = await WebsiteRegistry.open(databasePath, path.join(busyRoot, "data"))
    reader.sqlite.exec("BEGIN")
    reader.sqlite.query("SELECT total_views FROM site_view_summary WHERE singleton = 1").get()

    await expect(registry.prepareForAtomicSwap()).rejects.toBeInstanceOf(WebsiteRegistryIntegrityError)
  } finally {
    try { reader?.sqlite.exec("ROLLBACK") } catch {}
    reader?.close()
    // The refused checkpoint throws before the connection is closed, so the caller still owns it.
    try { registry?.close() } catch {}
    Bun.gc(true)
    await Bun.sleep(100)
    await rm(busyRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
}, 30_000)
