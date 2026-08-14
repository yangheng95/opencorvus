import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from "@zip.js/zip.js"
import { ExpertSquadRegistry } from "../../../opencorvus/src/expert-squad/registry"
import { projectExpertSquadFacts } from "./expert-squad-facts"
import { projectPublicSquadRecord, type PublicSquadFactInput } from "../content/public-market"
import {
  WebsiteRegistryIntegrityError,
  canonicalWebsiteRegistryJSON,
  type WebsiteRegistrySeed,
  type WebsiteRegistrySeedPackage,
} from "./website-registry-contract"

function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex")
}

function distributionFile(sourceRoot: string, publicPath: string) {
  const relative = publicPath.replace(/^\/+/, "")
  const resolved = path.resolve(sourceRoot, ...relative.split("/"))
  const root = `${path.resolve(sourceRoot)}${path.sep}`
  if (!resolved.startsWith(root)) throw new WebsiteRegistryIntegrityError(`Distribution path escapes its root: ${publicPath}`)
  return resolved
}

function canonicalPackageProjection(entry: WebsiteRegistrySeedPackage) {
  const { factsSha256: _factsSha256, ...normalized } = entry
  return normalized
}

async function factsFromArchive(entry: WebsiteRegistrySeedPackage, bytes: Uint8Array) {
  const reader = new ZipReader(new Uint8ArrayReader(bytes))
  try {
    const entries = await reader.getEntries()
    const files: ExpertSquadRegistry.EmbeddedPackageSource["files"] = {}
    const prefix = `${entry.identity.namespace}/${entry.identity.id}/`
    for (const archiveEntry of entries) {
      if (archiveEntry.directory || !archiveEntry.filename.startsWith(prefix)) {
        throw new WebsiteRegistryIntegrityError(
          `Archive ${entry.identity.namespace}/${entry.identity.id} contains a non-package entry: ${archiveEntry.filename}`,
        )
      }
      const relativePath = archiveEntry.filename.slice(prefix.length)
      if (!relativePath || relativePath.includes("\\") || relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
        throw new WebsiteRegistryIntegrityError(`Archive contains an unsafe package path: ${archiveEntry.filename}`)
      }
      const writer = new Uint8ArrayWriter()
      const content = await archiveEntry.getData?.(writer)
      if (!content) throw new WebsiteRegistryIntegrityError(`Archive entry could not be read: ${archiveEntry.filename}`)
      files[relativePath] = { content: Buffer.from(content).toString("base64"), encoding: "base64" }
    }
    if (Object.keys(files).length !== entry.archive.files) {
      throw new WebsiteRegistryIntegrityError(
        `Archive file count mismatch for ${entry.identity.namespace}/${entry.identity.id}: expected ${entry.archive.files}, received ${Object.keys(files).length}`,
      )
    }
    const declaration = ExpertSquadRegistry.loadEmbeddedPackageDeclaration({
      namespace: entry.identity.namespace,
      id: entry.identity.id,
      files,
    })
    return projectExpertSquadFacts(declaration)
  } finally {
    await reader.close()
  }
}

export async function validateWebsiteRegistrySeed(seed: WebsiteRegistrySeed, sourceRoot: string) {
  if (seed.resources.total !== seed.packages.length) {
    throw new WebsiteRegistryIntegrityError(
      `Registry seed declares ${seed.resources.total} resources but contains ${seed.packages.length} packages`,
    )
  }
  const dispositionTotals = seed.packages.reduce(
    (totals, entry) => {
      totals[entry.disposition] += 1
      return totals
    },
    { embedded_already_available: 0, bundled_market_importable: 0 },
  )
  if (
    dispositionTotals.embedded_already_available !== seed.resources.embeddedAlreadyAvailable ||
    dispositionTotals.bundled_market_importable !== seed.resources.bundledMarketImportable
  ) {
    throw new WebsiteRegistryIntegrityError("Registry seed disposition totals disagree with its resource summary")
  }

  const catalogBytes = new Uint8Array(await readFile(distributionFile(sourceRoot, seed.catalog.path)))
  if (catalogBytes.byteLength !== seed.catalog.bytes || sha256(catalogBytes) !== seed.catalog.sha256) {
    throw new WebsiteRegistryIntegrityError("Registry seed catalog bytes do not match the declared publication digest")
  }
  type CatalogEntry = {
    namespace: string
    id: string
    version: string
    packageDigest: string
    disposition: WebsiteRegistrySeedPackage["disposition"]
    archive: WebsiteRegistrySeedPackage["archive"]
  }
  const catalog = JSON.parse(Buffer.from(catalogBytes).toString("utf8")) as {
    protocol?: unknown
    resources?: unknown
    packages?: CatalogEntry[]
  }
  if (
    catalog.protocol !== "opencorvus/expert-squad-static-catalog@1" ||
    canonicalWebsiteRegistryJSON(catalog.resources) !== canonicalWebsiteRegistryJSON(seed.resources) ||
    !Array.isArray(catalog.packages) ||
    catalog.packages.length !== seed.resources.total
  ) {
    throw new WebsiteRegistryIntegrityError("Signed catalog header or resource summary disagrees with the Registry seed")
  }
  const catalogEntries = new Map(catalog.packages.map((item) => [`${item.namespace}/${item.id}`, item] as const))
  if (catalogEntries.size !== catalog.packages.length) {
    throw new WebsiteRegistryIntegrityError("Signed catalog contains duplicate package identities")
  }
  const seenVersions = new Set<string>()
  const validated = []
  for (const entry of seed.packages) {
    const versionKey = `${entry.identity.namespace}/${entry.identity.id}@${entry.identity.version}`
    if (seenVersions.has(versionKey)) throw new WebsiteRegistryIntegrityError(`Duplicate immutable revision: ${versionKey}`)
    seenVersions.add(versionKey)
    const archiveBytes = new Uint8Array(await readFile(distributionFile(sourceRoot, entry.archive.path)))
    if (archiveBytes.byteLength !== entry.archive.bytes || sha256(archiveBytes) !== entry.archive.sha256) {
      throw new WebsiteRegistryIntegrityError(`Archive bytes do not match the seed for ${versionKey}`)
    }
    const catalogEntry = catalogEntries.get(`${entry.identity.namespace}/${entry.identity.id}`)
    const expectedCatalogEntry: CatalogEntry = {
      namespace: entry.identity.namespace,
      id: entry.identity.id,
      version: entry.identity.version,
      packageDigest: entry.identity.digest,
      disposition: entry.disposition,
      archive: entry.archive,
    }
    if (!catalogEntry || canonicalWebsiteRegistryJSON(catalogEntry) !== canonicalWebsiteRegistryJSON(expectedCatalogEntry)) {
      throw new WebsiteRegistryIntegrityError(`Signed catalog binding disagrees with the seed for ${versionKey}`)
    }
    const archiveFacts = await factsFromArchive(entry, archiveBytes)
    const publicRecord = projectPublicSquadRecord(archiveFacts as PublicSquadFactInput)
    const reconstructed = {
      ...archiveFacts,
      agents: publicRecord.agents,
      workflows: publicRecord.workflows,
      disposition: entry.disposition,
      archive: entry.archive,
      locales: [
        { locale: "en", label: publicRecord.displayLabel.root, description: publicRecord.description.root, selectorSummary: publicRecord.selectorSummary.root },
        { locale: "zh-CN", label: publicRecord.displayLabel["zh-cn"], description: publicRecord.description["zh-cn"], selectorSummary: publicRecord.selectorSummary["zh-cn"] },
      ],
    }
    const reconstructedJSON = canonicalWebsiteRegistryJSON(reconstructed)
    const reconstructedHash = sha256(reconstructedJSON)
    if (reconstructedHash !== entry.factsSha256 || reconstructedJSON !== canonicalWebsiteRegistryJSON(canonicalPackageProjection(entry))) {
      throw new WebsiteRegistryIntegrityError(`Archive-derived facts disagree with the seed for ${versionKey}`)
    }
    validated.push({ entry, archiveBytes })
  }
  if (catalogEntries.size !== validated.length) {
    throw new WebsiteRegistryIntegrityError("Signed catalog and registry seed contain different package identities")
  }
  return { catalogBytes, packages: validated }
}
