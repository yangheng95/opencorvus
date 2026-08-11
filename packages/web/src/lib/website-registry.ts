import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"
import type { PublicSquadRecord } from "../content/public-market"
import {
  WebsiteRegistryConflictError,
  WebsiteRegistryIntegrityError,
  canonicalWebsiteRegistryJSON,
  websiteRegistrySeedSchema,
  type WebsiteArchiveDescriptor,
  type WebsitePublicationSummary,
  type WebsiteRegistrySeed,
  type WebsiteRegistrySeedPackage,
  type ValidatedWebsiteRegistrySeed,
} from "./website-registry-contract"

const SCHEMA_VERSION = 1
const DDL = `
CREATE TABLE registry_schema (
  version INTEGER PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE publication (
  id INTEGER PRIMARY KEY,
  catalog_sha256 TEXT NOT NULL UNIQUE CHECK (length(catalog_sha256) = 64 AND catalog_sha256 NOT GLOB '*[^0-9a-f]*'),
  catalog_path TEXT NOT NULL CHECK (catalog_path = '/expert-squads/catalogs/' || catalog_sha256 || '.json'),
  catalog_bytes INTEGER NOT NULL CHECK (catalog_bytes > 0),
  resource_total INTEGER NOT NULL CHECK (resource_total > 0),
  embedded_total INTEGER NOT NULL CHECK (embedded_total >= 0),
  importable_total INTEGER NOT NULL CHECK (importable_total >= 0),
  imported_at TEXT NOT NULL,
  activated_at TEXT,
  CHECK (embedded_total + importable_total = resource_total)
);
CREATE TABLE registry_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  active_publication_id INTEGER REFERENCES publication(id)
);
CREATE TABLE archive (
  sha256 TEXT PRIMARY KEY CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  bytes INTEGER NOT NULL CHECK (bytes > 0),
  file_count INTEGER NOT NULL CHECK (file_count > 0),
  relative_path TEXT NOT NULL UNIQUE
);
CREATE TABLE squad_revision (
  id INTEGER PRIMARY KEY,
  namespace TEXT NOT NULL CHECK (length(namespace) BETWEEN 1 AND 128),
  squad_id TEXT NOT NULL CHECK (length(squad_id) BETWEEN 1 AND 128),
  version TEXT NOT NULL CHECK (length(version) BETWEEN 1 AND 128),
  package_digest TEXT NOT NULL CHECK (length(package_digest) = 64 AND package_digest NOT GLOB '*[^0-9a-f]*'),
  facts_sha256 TEXT NOT NULL CHECK (length(facts_sha256) = 64 AND facts_sha256 NOT GLOB '*[^0-9a-f]*'),
  archive_sha256 TEXT NOT NULL REFERENCES archive(sha256),
  archive_path TEXT NOT NULL CHECK (archive_path LIKE '/expert-squads/archives/%'),
  disposition TEXT NOT NULL CHECK (disposition IN ('embedded_already_available', 'bundled_market_importable')),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  canonical_description TEXT NOT NULL,
  canonical_selector_summary TEXT NOT NULL,
  projected_skills INTEGER NOT NULL CHECK (projected_skills >= 0),
  projected_tools INTEGER NOT NULL CHECK (projected_tools >= 0),
  projected_mcp INTEGER NOT NULL CHECK (projected_mcp >= 0),
  package_skills INTEGER NOT NULL CHECK (package_skills >= 0),
  package_tools INTEGER NOT NULL CHECK (package_tools >= 0),
  package_mcp INTEGER NOT NULL CHECK (package_mcp >= 0),
  configuration_fields INTEGER NOT NULL CHECK (configuration_fields >= 0),
  configuration_required INTEGER NOT NULL CHECK (configuration_required >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(namespace, squad_id, version),
  UNIQUE(package_digest)
);
CREATE TABLE squad_revision_locale (
  revision_id INTEGER NOT NULL REFERENCES squad_revision(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'zh-CN')),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  selector_summary TEXT NOT NULL,
  PRIMARY KEY (revision_id, locale)
);
CREATE TABLE squad_revision_pillar (
  revision_id INTEGER NOT NULL REFERENCES squad_revision(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  pillar TEXT NOT NULL CHECK (pillar IN ('code', 'work')),
  PRIMARY KEY (revision_id, ordinal),
  UNIQUE (revision_id, pillar)
);
CREATE TABLE squad_agent (
  revision_id INTEGER NOT NULL REFERENCES squad_revision(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  agent_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  base_role TEXT NOT NULL,
  zh_label TEXT NOT NULL,
  zh_description TEXT,
  PRIMARY KEY (revision_id, agent_id),
  UNIQUE (revision_id, ordinal)
);
CREATE TABLE squad_workflow (
  revision_id INTEGER NOT NULL REFERENCES squad_revision(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  workflow_id TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  zh_label TEXT NOT NULL,
  zh_description TEXT NOT NULL,
  PRIMARY KEY (revision_id, workflow_id),
  UNIQUE (revision_id, ordinal)
);
CREATE TABLE squad_workflow_node (
  revision_id INTEGER NOT NULL,
  workflow_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  node_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  description TEXT NOT NULL,
  zh_description TEXT NOT NULL,
  PRIMARY KEY (revision_id, workflow_id, node_id),
  UNIQUE (revision_id, workflow_id, ordinal),
  FOREIGN KEY (revision_id, workflow_id) REFERENCES squad_workflow(revision_id, workflow_id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id, agent_id) REFERENCES squad_agent(revision_id, agent_id)
);
CREATE TABLE squad_workflow_dependency (
  revision_id INTEGER NOT NULL,
  workflow_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  depends_on_node_id TEXT NOT NULL,
  PRIMARY KEY (revision_id, workflow_id, node_id, depends_on_node_id),
  UNIQUE (revision_id, workflow_id, node_id, ordinal),
  FOREIGN KEY (revision_id, workflow_id, node_id) REFERENCES squad_workflow_node(revision_id, workflow_id, node_id) ON DELETE CASCADE,
  FOREIGN KEY (revision_id, workflow_id, depends_on_node_id) REFERENCES squad_workflow_node(revision_id, workflow_id, node_id)
);
CREATE TABLE publication_revision (
  publication_id INTEGER NOT NULL REFERENCES publication(id) ON DELETE CASCADE,
  revision_id INTEGER NOT NULL REFERENCES squad_revision(id),
  ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
  PRIMARY KEY (publication_id, revision_id),
  UNIQUE (publication_id, ordinal)
);
CREATE TABLE revision_download_counter (
  revision_id INTEGER PRIMARY KEY REFERENCES squad_revision(id) ON DELETE CASCADE,
  response_count INTEGER NOT NULL DEFAULT 0 CHECK (response_count >= 0),
  last_response_at TEXT
);
CREATE INDEX publication_revision_revision ON publication_revision(revision_id);
CREATE INDEX squad_revision_identity ON squad_revision(namespace, squad_id);
`
const SCHEMA_CHECKSUM = createHash("sha256").update(DDL).digest("hex")

type BaseRow = {
  revision_id: number
  namespace: string
  squad_id: string
  version: string
  package_digest: string
  name: string
  label: string
  canonical_description: string
  canonical_selector_summary: string
  projected_skills: number
  projected_tools: number
  projected_mcp: number
  package_skills: number
  package_tools: number
  package_mcp: number
  configuration_fields: number
  configuration_required: number
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

async function fileSha256(file: string) {
  const digest = createHash("sha256")
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(file)
    stream.on("data", (chunk) => digest.update(chunk))
    stream.once("error", reject)
    stream.once("end", resolve)
  })
  return digest.digest("hex")
}

function archiveRelativePath(sha256: string) {
  return path.posix.join("blobs", "sha256", sha256.slice(0, 2), `${sha256}.zip`)
}

export class WebsiteRegistry {
  readonly sqlite: Database

  constructor(
    readonly databasePath: string,
    readonly dataRoot: string,
  ) {
    this.sqlite = new Database(databasePath, { create: true, strict: true })
    this.sqlite.exec("PRAGMA encoding = 'UTF-8'; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000; PRAGMA cache_size = -16384; PRAGMA journal_size_limit = 33554432;")
    this.ensureSchema()
  }

  static async open(databasePath: string, dataRoot: string) {
    await mkdir(path.dirname(databasePath), { recursive: true })
    await mkdir(dataRoot, { recursive: true })
    return new WebsiteRegistry(databasePath, dataRoot)
  }

  close() {
    ;(this.sqlite as Database & { clearQueryCache(): void }).clearQueryCache()
    this.sqlite.close(false)
  }

  private ensureSchema() {
    const tables = this.sqlite.query<{ name: string; sql: string }, []>("SELECT name, sql FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    if (tables.length === 0) {
      this.sqlite.exec(`${DDL}\nINSERT INTO registry_schema(version, checksum, applied_at) VALUES (${SCHEMA_VERSION}, ${quoteLiteral(SCHEMA_CHECKSUM)}, ${quoteLiteral(new Date().toISOString())}); INSERT INTO registry_state(singleton, active_publication_id) VALUES (1, NULL);`)
      return
    }
    const schema = this.sqlite.query<{ version: number; checksum: string }, []>("SELECT version, checksum FROM registry_schema").get()
    if (!schema || schema.version !== SCHEMA_VERSION || schema.checksum !== SCHEMA_CHECKSUM) {
      throw new WebsiteRegistryIntegrityError("Website Registry schema version or DDL fingerprint does not match this release")
    }
    const expected = new Database(":memory:", { strict: true })
    try {
      expected.exec(DDL)
      const fingerprint = (database: Database) =>
        database.query<{ name: string; type: string; sql: string }, []>("SELECT name, type, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all()
      if (JSON.stringify(fingerprint(expected)) !== JSON.stringify(fingerprint(this.sqlite))) {
        throw new WebsiteRegistryIntegrityError("Website Registry SQLite objects drifted from the canonical DDL")
      }
    } finally {
      expected.close()
    }
  }

  private persistentArchivePath(relativePath: string) {
    const resolved = path.resolve(this.dataRoot, ...relativePath.split("/"))
    const root = `${path.resolve(this.dataRoot)}${path.sep}`
    if (!resolved.startsWith(root)) throw new WebsiteRegistryIntegrityError(`Archive path escapes the data root: ${relativePath}`)
    return resolved
  }

  private async placeArchive(bytes: Uint8Array, sha256: string) {
    const relativePath = archiveRelativePath(sha256)
    const target = this.persistentArchivePath(relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    try {
      const targetStat = await stat(target)
      if (targetStat.size !== bytes.byteLength || (await fileSha256(target)) !== sha256) {
        throw new WebsiteRegistryIntegrityError(`Persistent archive is corrupt: ${relativePath}`)
      }
      return relativePath
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error
    }
    const stagingRoot = path.join(this.dataRoot, "staging")
    await mkdir(stagingRoot, { recursive: true })
    const staging = path.join(stagingRoot, `${randomUUID()}.zip`)
    await writeFile(staging, bytes, { flag: "wx" })
    try {
      await rename(staging, target)
    } finally {
      await rm(staging, { force: true })
    }
    return relativePath
  }

  private revisionProjection(revisionID: number) {
    const base = this.sqlite.query<{
      namespace: string; squad_id: string; version: string; package_digest: string; facts_sha256: string
      disposition: WebsiteRegistrySeedPackage["disposition"]; name: string; label: string
      canonical_description: string; canonical_selector_summary: string
      projected_skills: number; projected_tools: number; projected_mcp: number
      package_skills: number; package_tools: number; package_mcp: number
      configuration_fields: number; configuration_required: number
      archive_path: string; archive_sha256: string; archive_bytes: number; archive_files: number
    }, [number]>(`SELECT r.namespace, r.squad_id, r.version, r.package_digest, r.facts_sha256, r.disposition,
      r.name, r.label, r.canonical_description, r.canonical_selector_summary,
      r.projected_skills, r.projected_tools, r.projected_mcp, r.package_skills, r.package_tools, r.package_mcp,
      r.configuration_fields, r.configuration_required, r.archive_path,
      a.sha256 AS archive_sha256, a.bytes AS archive_bytes, a.file_count AS archive_files
      FROM squad_revision r JOIN archive a ON a.sha256 = r.archive_sha256 WHERE r.id = ?`).get(revisionID)
    if (!base) throw new WebsiteRegistryIntegrityError(`Website Registry revision ${revisionID} is missing`)
    const locales = this.sqlite.query<{ locale: "en" | "zh-CN"; label: string; description: string; selector_summary: string }, [number]>(
      "SELECT locale, label, description, selector_summary FROM squad_revision_locale WHERE revision_id = ? ORDER BY locale",
    ).all(revisionID)
    const pillars = this.sqlite.query<{ pillar: "code" | "work" }, [number]>(
      "SELECT pillar FROM squad_revision_pillar WHERE revision_id = ? ORDER BY ordinal",
    ).all(revisionID)
    const agents = this.sqlite.query<{ agent_id: string; label: string; description: string | null; base_role: string; zh_label: string; zh_description: string | null }, [number]>(
      "SELECT agent_id, label, description, base_role, zh_label, zh_description FROM squad_agent WHERE revision_id = ? ORDER BY ordinal",
    ).all(revisionID)
    const workflows = this.sqlite.query<{ workflow_id: string; label: string; description: string; zh_label: string; zh_description: string }, [number]>(
      "SELECT workflow_id, label, description, zh_label, zh_description FROM squad_workflow WHERE revision_id = ? ORDER BY ordinal",
    ).all(revisionID)
    const nodes = this.sqlite.query<{ workflow_id: string; node_id: string; agent_id: string; description: string; zh_description: string }, [number]>(
      "SELECT workflow_id, node_id, agent_id, description, zh_description FROM squad_workflow_node WHERE revision_id = ? ORDER BY workflow_id, ordinal",
    ).all(revisionID)
    const dependencies = this.sqlite.query<{ workflow_id: string; node_id: string; depends_on_node_id: string }, [number]>(
      "SELECT workflow_id, node_id, depends_on_node_id FROM squad_workflow_dependency WHERE revision_id = ? ORDER BY workflow_id, node_id, ordinal",
    ).all(revisionID)
    const projection = {
      identity: { namespace: base.namespace, id: base.squad_id, version: base.version, digest: base.package_digest },
      name: base.name,
      label: base.label,
      description: base.canonical_description,
      selectorSummary: base.canonical_selector_summary,
      pillars: pillars.map((item) => item.pillar),
      agents: agents.map((agent) => ({
        id: agent.agent_id,
        label: agent.label,
        ...(agent.description === null ? {} : { description: agent.description }),
        baseRole: agent.base_role,
        displayLabel: { root: agent.label, "zh-cn": agent.zh_label },
        localizedDescription: {
          ...(agent.description === null ? {} : { root: agent.description }),
          ...(agent.zh_description === null ? {} : { "zh-cn": agent.zh_description }),
        },
      })),
      workflows: workflows.map((workflow) => ({
        id: workflow.workflow_id,
        label: workflow.label,
        description: workflow.description,
        nodes: nodes.filter((node) => node.workflow_id === workflow.workflow_id).map((node) => ({
          id: node.node_id,
          agentID: node.agent_id,
          description: node.description,
          dependsOn: dependencies
            .filter((dependency) => dependency.workflow_id === workflow.workflow_id && dependency.node_id === node.node_id)
            .map((dependency) => dependency.depends_on_node_id),
          localizedDescription: { root: node.description, "zh-cn": node.zh_description },
        })),
        displayLabel: { root: workflow.label, "zh-cn": workflow.zh_label },
        localizedDescription: { root: workflow.description, "zh-cn": workflow.zh_description },
      })),
      projectedCapabilities: { skills: base.projected_skills, tools: base.projected_tools, mcp: base.projected_mcp },
      packageOwnedCapabilities: { skills: base.package_skills, tools: base.package_tools, mcp: base.package_mcp },
      configuration: { fields: base.configuration_fields, required: base.configuration_required },
      disposition: base.disposition,
      archive: { path: base.archive_path, sha256: base.archive_sha256, bytes: base.archive_bytes, files: base.archive_files },
      locales: locales.map((locale) => ({ locale: locale.locale, label: locale.label, description: locale.description, selectorSummary: locale.selector_summary })),
    }
    return { projection, factsSha256: base.facts_sha256 }
  }

  private assertRevisionProjection(revisionID: number, entry?: WebsiteRegistrySeedPackage) {
    const stored = this.revisionProjection(revisionID)
    const storedJSON = canonicalWebsiteRegistryJSON(stored.projection)
    if (sha256(storedJSON) !== stored.factsSha256) {
      throw new WebsiteRegistryIntegrityError(`Normalized Website Registry facts drifted for revision ${revisionID}`)
    }
    if (entry) {
      const { factsSha256, ...expected } = entry
      if (stored.factsSha256 !== factsSha256 || storedJSON !== canonicalWebsiteRegistryJSON(expected)) {
        throw new WebsiteRegistryConflictError(`Immutable normalized facts conflict for ${entry.identity.namespace}/${entry.identity.id}@${entry.identity.version}`)
      }
    }
  }

  async importValidatedPublication(seed: WebsiteRegistrySeed, validated: ValidatedWebsiteRegistrySeed) {
    const archives = new Map<string, string>()
    for (const item of validated.packages) {
      archives.set(item.entry.archive.sha256, await this.placeArchive(item.archiveBytes, item.entry.archive.sha256))
    }
    const now = new Date().toISOString()
    const transaction = this.sqlite.transaction(() => {
      this.sqlite.run(
        `INSERT INTO publication(catalog_sha256, catalog_path, catalog_bytes, resource_total, embedded_total, importable_total, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(catalog_sha256) DO NOTHING`,
        [seed.catalog.sha256, seed.catalog.path, seed.catalog.bytes, seed.resources.total, seed.resources.embeddedAlreadyAvailable, seed.resources.bundledMarketImportable, now],
      )
      const publication = this.sqlite.query<{
        id: number
        catalog_path: string
        catalog_bytes: number
        resource_total: number
        embedded_total: number
        importable_total: number
      }, [string]>(
        "SELECT id, catalog_path, catalog_bytes, resource_total, embedded_total, importable_total FROM publication WHERE catalog_sha256 = ?",
      ).get(seed.catalog.sha256)
      if (
        !publication
        || publication.catalog_path !== seed.catalog.path
        || publication.catalog_bytes !== seed.catalog.bytes
        || publication.resource_total !== seed.resources.total
        || publication.embedded_total !== seed.resources.embeddedAlreadyAvailable
        || publication.importable_total !== seed.resources.bundledMarketImportable
      ) {
        throw new WebsiteRegistryConflictError(`Publication ${seed.catalog.sha256} conflicts with an existing catalog record`)
      }
      for (const entry of seed.packages) {
        const relativePath = archives.get(entry.archive.sha256)!
        this.sqlite.run(
          "INSERT INTO archive(sha256, bytes, file_count, relative_path) VALUES (?, ?, ?, ?) ON CONFLICT(sha256) DO NOTHING",
          [entry.archive.sha256, entry.archive.bytes, entry.archive.files, relativePath],
        )
        const storedArchive = this.sqlite.query<{ bytes: number; file_count: number; relative_path: string }, [string]>("SELECT bytes, file_count, relative_path FROM archive WHERE sha256 = ?").get(entry.archive.sha256)
        if (!storedArchive || storedArchive.bytes !== entry.archive.bytes || storedArchive.file_count !== entry.archive.files || storedArchive.relative_path !== relativePath) {
          throw new WebsiteRegistryConflictError(`Archive metadata conflicts for ${entry.archive.sha256}`)
        }
        const inserted = this.sqlite.run(
          `INSERT INTO squad_revision(
             namespace, squad_id, version, package_digest, facts_sha256, archive_sha256, archive_path, disposition,
             name, label, canonical_description, canonical_selector_summary,
             projected_skills, projected_tools, projected_mcp, package_skills, package_tools, package_mcp,
             configuration_fields, configuration_required, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(namespace, squad_id, version) DO NOTHING`,
          [entry.identity.namespace, entry.identity.id, entry.identity.version, entry.identity.digest, entry.factsSha256, entry.archive.sha256, entry.archive.path, entry.disposition, entry.name, entry.label, entry.description, entry.selectorSummary, entry.projectedCapabilities.skills, entry.projectedCapabilities.tools, entry.projectedCapabilities.mcp, entry.packageOwnedCapabilities.skills, entry.packageOwnedCapabilities.tools, entry.packageOwnedCapabilities.mcp, entry.configuration.fields, entry.configuration.required, now],
        ).changes === 1
        const revision = this.sqlite.query<{ id: number; package_digest: string; facts_sha256: string; archive_sha256: string }, [string, string, string]>("SELECT id, package_digest, facts_sha256, archive_sha256 FROM squad_revision WHERE namespace = ? AND squad_id = ? AND version = ?").get(entry.identity.namespace, entry.identity.id, entry.identity.version)
        if (!revision || revision.package_digest !== entry.identity.digest || revision.facts_sha256 !== entry.factsSha256 || revision.archive_sha256 !== entry.archive.sha256) {
          throw new WebsiteRegistryConflictError(`Immutable revision conflict for ${entry.identity.namespace}/${entry.identity.id}@${entry.identity.version}`)
        }
        if (inserted) {
          for (const locale of entry.locales) this.sqlite.run("INSERT INTO squad_revision_locale(revision_id, locale, label, description, selector_summary) VALUES (?, ?, ?, ?, ?)", [revision.id, locale.locale, locale.label, locale.description, locale.selectorSummary])
          entry.pillars.forEach((pillar, ordinal) => this.sqlite.run("INSERT INTO squad_revision_pillar(revision_id, ordinal, pillar) VALUES (?, ?, ?)", [revision.id, ordinal, pillar]))
          entry.agents.forEach((agent, ordinal) => this.sqlite.run("INSERT INTO squad_agent(revision_id, ordinal, agent_id, label, description, base_role, zh_label, zh_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [revision.id, ordinal, agent.id, agent.label, agent.description ?? null, agent.baseRole, agent.displayLabel["zh-cn"], agent.localizedDescription["zh-cn"] ?? null]))
          entry.workflows.forEach((workflow, workflowOrdinal) => {
            this.sqlite.run("INSERT INTO squad_workflow(revision_id, ordinal, workflow_id, label, description, zh_label, zh_description) VALUES (?, ?, ?, ?, ?, ?, ?)", [revision.id, workflowOrdinal, workflow.id, workflow.label, workflow.description, workflow.displayLabel["zh-cn"], workflow.localizedDescription["zh-cn"]])
            workflow.nodes.forEach((node, nodeOrdinal) => this.sqlite.run("INSERT INTO squad_workflow_node(revision_id, workflow_id, ordinal, node_id, agent_id, description, zh_description) VALUES (?, ?, ?, ?, ?, ?, ?)", [revision.id, workflow.id, nodeOrdinal, node.id, node.agentID, node.description, node.localizedDescription["zh-cn"]]))
            workflow.nodes.forEach((node) => node.dependsOn.forEach((dependency, ordinal) => this.sqlite.run("INSERT INTO squad_workflow_dependency(revision_id, workflow_id, node_id, ordinal, depends_on_node_id) VALUES (?, ?, ?, ?, ?)", [revision.id, workflow.id, node.id, ordinal, dependency])))
          })
          this.sqlite.run("INSERT INTO revision_download_counter(revision_id) VALUES (?)", [revision.id])
        }
        this.assertRevisionProjection(revision.id, entry)
        const counter = this.sqlite.query<{ count: number }, [number]>("SELECT COUNT(*) AS count FROM revision_download_counter WHERE revision_id = ?").get(revision.id)?.count ?? 0
        if (counter !== 1) throw new WebsiteRegistryConflictError(`Revision response counter is missing for ${entry.identity.namespace}/${entry.identity.id}@${entry.identity.version}`)
        const ordinal = seed.packages.indexOf(entry)
        this.sqlite.run("INSERT INTO publication_revision(publication_id, revision_id, ordinal) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [publication.id, revision.id, ordinal])
        const membershipRow = this.sqlite.query<{ ordinal: number }, [number, number]>("SELECT ordinal FROM publication_revision WHERE publication_id = ? AND revision_id = ?").get(publication.id, revision.id)
        if (!membershipRow || membershipRow.ordinal !== ordinal) throw new WebsiteRegistryConflictError("Publication revision ordering conflicts with the imported seed")
      }
      const membership = this.sqlite.query<{ count: number }, [number]>("SELECT COUNT(*) AS count FROM publication_revision WHERE publication_id = ?").get(publication.id)?.count ?? 0
      if (membership !== seed.packages.length) throw new WebsiteRegistryConflictError("Publication membership does not match the imported seed")
      this.sqlite.run("UPDATE publication SET activated_at = ? WHERE id = ?", [now, publication.id])
      this.sqlite.run("UPDATE registry_state SET active_publication_id = ? WHERE singleton = 1", [publication.id])
      return publication.id
    })
    const publicationID = transaction.immediate()
    this.sqlite.exec("PRAGMA wal_checkpoint(PASSIVE)")
    return publicationID
  }

  publication(): WebsitePublicationSummary {
    const row = this.sqlite.query<{
      id: number; catalog_sha256: string; resource_total: number; embedded_total: number; importable_total: number; activated_at: string | null
    }, []>(`SELECT p.id, p.catalog_sha256, p.resource_total, p.embedded_total, p.importable_total, p.activated_at
          FROM registry_state s JOIN publication p ON p.id = s.active_publication_id WHERE s.singleton = 1`).get()
    if (!row?.activated_at) throw new WebsiteRegistryIntegrityError("Website Registry has no active publication")
    return { id: row.id, catalogSha256: row.catalog_sha256, total: row.resource_total, embeddedAlreadyAvailable: row.embedded_total, bundledMarketImportable: row.importable_total, activatedAt: row.activated_at }
  }

  squads(): PublicSquadRecord[] {
    const active = `FROM registry_state state JOIN publication_revision pr ON pr.publication_id = state.active_publication_id JOIN squad_revision r ON r.id = pr.revision_id WHERE state.singleton = 1`
    const bases = this.sqlite.query<BaseRow, []>(`SELECT r.id AS revision_id, r.namespace, r.squad_id, r.version, r.package_digest, r.name, r.label, r.canonical_description, r.canonical_selector_summary, r.projected_skills, r.projected_tools, r.projected_mcp, r.package_skills, r.package_tools, r.package_mcp, r.configuration_fields, r.configuration_required ${active} ORDER BY r.label COLLATE NOCASE, r.namespace, r.squad_id`).all()
    const locales = this.sqlite.query<{ revision_id: number; locale: "en" | "zh-CN"; label: string; description: string; selector_summary: string }, []>(`SELECT l.revision_id, l.locale, l.label, l.description, l.selector_summary FROM squad_revision_locale l JOIN publication_revision pr ON pr.revision_id = l.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1`).all()
    const pillars = this.sqlite.query<{ revision_id: number; pillar: "code" | "work" }, []>(`SELECT p.revision_id, p.pillar FROM squad_revision_pillar p JOIN publication_revision pr ON pr.revision_id = p.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1 ORDER BY p.ordinal`).all()
    const agents = this.sqlite.query<{ revision_id: number; agent_id: string; label: string; description: string | null; base_role: string; zh_label: string; zh_description: string | null }, []>(`SELECT a.revision_id, a.agent_id, a.label, a.description, a.base_role, a.zh_label, a.zh_description FROM squad_agent a JOIN publication_revision pr ON pr.revision_id = a.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1 ORDER BY a.ordinal`).all()
    const workflows = this.sqlite.query<{ revision_id: number; workflow_id: string; label: string; description: string; zh_label: string; zh_description: string }, []>(`SELECT w.revision_id, w.workflow_id, w.label, w.description, w.zh_label, w.zh_description FROM squad_workflow w JOIN publication_revision pr ON pr.revision_id = w.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1 ORDER BY w.ordinal`).all()
    const nodes = this.sqlite.query<{ revision_id: number; workflow_id: string; node_id: string; agent_id: string; description: string; zh_description: string }, []>(`SELECT n.revision_id, n.workflow_id, n.node_id, n.agent_id, n.description, n.zh_description FROM squad_workflow_node n JOIN publication_revision pr ON pr.revision_id = n.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1 ORDER BY n.ordinal`).all()
    const dependencies = this.sqlite.query<{ revision_id: number; workflow_id: string; node_id: string; depends_on_node_id: string }, []>(`SELECT d.revision_id, d.workflow_id, d.node_id, d.depends_on_node_id FROM squad_workflow_dependency d JOIN publication_revision pr ON pr.revision_id = d.revision_id JOIN registry_state state ON state.active_publication_id = pr.publication_id WHERE state.singleton = 1 ORDER BY d.ordinal`).all()
    return bases.map((row) => {
      const en = locales.find((item) => item.revision_id === row.revision_id && item.locale === "en")
      const zh = locales.find((item) => item.revision_id === row.revision_id && item.locale === "zh-CN")
      if (!en || !zh) throw new WebsiteRegistryIntegrityError(`Revision ${row.revision_id} is missing its required bilingual projection`)
      return {
        identity: { namespace: row.namespace, id: row.squad_id, version: row.version, digest: row.package_digest },
        name: row.name,
        label: row.label,
        displayLabel: { root: en.label, "zh-cn": zh.label },
        canonicalDescription: row.canonical_description,
        canonicalSelectorSummary: row.canonical_selector_summary,
        description: { root: en.description, "zh-cn": zh.description },
        selectorSummary: { root: en.selector_summary, "zh-cn": zh.selector_summary },
        pillars: pillars.filter((item) => item.revision_id === row.revision_id).map((item) => item.pillar),
        agents: agents.filter((item) => item.revision_id === row.revision_id).map((item) => ({ id: item.agent_id, label: item.label, description: item.description ?? undefined, baseRole: item.base_role, displayLabel: { root: item.label, "zh-cn": item.zh_label }, localizedDescription: { root: item.description ?? undefined, "zh-cn": item.zh_description ?? undefined } })),
        workflows: workflows.filter((item) => item.revision_id === row.revision_id).map((workflow) => ({ id: workflow.workflow_id, label: workflow.label, description: workflow.description, displayLabel: { root: workflow.label, "zh-cn": workflow.zh_label }, localizedDescription: { root: workflow.description, "zh-cn": workflow.zh_description }, nodes: nodes.filter((node) => node.revision_id === row.revision_id && node.workflow_id === workflow.workflow_id).map((node) => ({ id: node.node_id, agentID: node.agent_id, description: node.description, localizedDescription: { root: node.description, "zh-cn": node.zh_description }, dependsOn: dependencies.filter((dependency) => dependency.revision_id === row.revision_id && dependency.workflow_id === workflow.workflow_id && dependency.node_id === node.node_id).map((dependency) => dependency.depends_on_node_id) })) })),
        projectedCapabilities: { skills: row.projected_skills, tools: row.projected_tools, mcp: row.projected_mcp },
        packageOwnedCapabilities: { skills: row.package_skills, tools: row.package_tools, mcp: row.package_mcp },
        configuration: { fields: row.configuration_fields, required: row.configuration_required },
      }
    })
  }

  squad(namespace: string, id: string) {
    return this.squads().find((record) => record.identity.namespace === namespace && record.identity.id === id)
  }

  archive(namespace: string, id: string, version: string, packageDigest: string): WebsiteArchiveDescriptor | undefined {
    const row = this.sqlite.query<{ revision_id: number; sha256: string; bytes: number; relative_path: string }, [string, string, string, string]>(`SELECT r.id AS revision_id, a.sha256, a.bytes, a.relative_path FROM registry_state state JOIN publication_revision pr ON pr.publication_id = state.active_publication_id JOIN squad_revision r ON r.id = pr.revision_id JOIN archive a ON a.sha256 = r.archive_sha256 WHERE state.singleton = 1 AND r.namespace = ? AND r.squad_id = ? AND r.version = ? AND r.package_digest = ?`).get(namespace, id, version, packageDigest)
    return row ? { revisionID: row.revision_id, sha256: row.sha256, bytes: row.bytes, relativePath: row.relative_path, filename: `${id}-${version}.zip` } : undefined
  }

  async verifiedArchive(descriptor: WebsiteArchiveDescriptor, countResponse: boolean) {
    const file = this.persistentArchivePath(descriptor.relativePath)
    try {
      const fileStat = await stat(file)
      if (fileStat.size !== descriptor.bytes || (await fileSha256(file)) !== descriptor.sha256) {
        throw new WebsiteRegistryIntegrityError(`Archive ${descriptor.sha256} failed byte binding verification`)
      }
    } catch (error) {
      if (error instanceof WebsiteRegistryIntegrityError) throw error
      throw new WebsiteRegistryIntegrityError(
        `Archive ${descriptor.sha256} is unavailable for byte binding verification: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
    if (countResponse) {
      const updated = this.sqlite.run(`UPDATE revision_download_counter SET response_count = response_count + 1, last_response_at = ? WHERE revision_id = ?`, [new Date().toISOString(), descriptor.revisionID])
      if (updated.changes !== 1) throw new WebsiteRegistryIntegrityError(`Revision ${descriptor.revisionID} is missing its archive response counter`)
    }
    return file
  }

  async readiness() {
    const integrity = this.sqlite.query<{ integrity_check: string }, []>("PRAGMA integrity_check").all()
    const foreignKeys = this.sqlite.query<Record<string, unknown>, []>("PRAGMA foreign_key_check").all()
    if (integrity.length !== 1 || integrity[0]?.integrity_check !== "ok" || foreignKeys.length !== 0) {
      throw new WebsiteRegistryIntegrityError("Website Registry SQLite integrity or foreign-key validation failed")
    }
    const publication = this.publication()
    const rows = this.sqlite.query<{ revision_id: number; sha256: string; bytes: number; relative_path: string; squad_id: string; version: string; disposition: "embedded_already_available" | "bundled_market_importable"; counter_present: number }, []>(`SELECT r.id AS revision_id, a.sha256, a.bytes, a.relative_path, r.squad_id, r.version, r.disposition, CASE WHEN c.revision_id IS NULL THEN 0 ELSE 1 END AS counter_present FROM registry_state state JOIN publication_revision pr ON pr.publication_id = state.active_publication_id JOIN squad_revision r ON r.id = pr.revision_id JOIN archive a ON a.sha256 = r.archive_sha256 LEFT JOIN revision_download_counter c ON c.revision_id = r.id WHERE state.singleton = 1`).all()
    if (rows.length !== publication.total) throw new WebsiteRegistryIntegrityError("Active publication count does not match its declared total")
    const embedded = rows.filter((row) => row.disposition === "embedded_already_available").length
    const importable = rows.filter((row) => row.disposition === "bundled_market_importable").length
    if (embedded !== publication.embeddedAlreadyAvailable || importable !== publication.bundledMarketImportable) {
      throw new WebsiteRegistryIntegrityError("Active publication disposition counts do not match its declared resources")
    }
    for (const row of rows) {
      if (row.counter_present !== 1) throw new WebsiteRegistryIntegrityError(`Revision ${row.revision_id} is missing its archive response counter`)
      this.assertRevisionProjection(row.revision_id)
      await this.verifiedArchive({ revisionID: row.revision_id, sha256: row.sha256, bytes: row.bytes, relativePath: row.relative_path, filename: `${row.squad_id}-${row.version}.zip` }, false)
    }
    return { status: "ready" as const, schemaVersion: SCHEMA_VERSION, schemaChecksum: SCHEMA_CHECKSUM, publication }
  }

  async backup(target: string) {
    await mkdir(path.dirname(target), { recursive: true })
    this.sqlite.exec("PRAGMA wal_checkpoint(FULL)")
    this.sqlite.exec(`VACUUM INTO ${quoteLiteral(path.resolve(target))}`)
    return target
  }
}

let runtimeRegistry: Promise<WebsiteRegistry> | undefined

export function websiteRegistryPaths() {
  const production = process.env.NODE_ENV === "production"
  const databasePath = process.env.OPENCORVUS_WEB_REGISTRY_DB
  const dataRoot = process.env.OPENCORVUS_WEB_REGISTRY_DATA
  if (production && (!databasePath || !dataRoot)) {
    throw new WebsiteRegistryIntegrityError("Production requires OPENCORVUS_WEB_REGISTRY_DB and OPENCORVUS_WEB_REGISTRY_DATA")
  }
  return {
    databasePath: path.resolve(databasePath ?? path.join(process.cwd(), ".generated", "website-registry-publication.sqlite3")),
    dataRoot: path.resolve(dataRoot ?? path.join(process.cwd(), ".generated", "website-registry-data")),
  }
}

export function getWebsiteRegistry() {
  const paths = websiteRegistryPaths()
  runtimeRegistry ??= WebsiteRegistry.open(paths.databasePath, paths.dataRoot)
  return runtimeRegistry
}

export async function readWebsiteRegistrySeed(seedFile: string) {
  return websiteRegistrySeedSchema.parse(JSON.parse(await readFile(seedFile, "utf8")))
}
