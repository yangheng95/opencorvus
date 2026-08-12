import path from "node:path"
import { fileURLToPath } from "node:url"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { builtInPackageSources } from "../../opencorvus/src/expert-squad/builtin"
import { ExpertSquadArchive } from "../../opencorvus/src/expert-squad/archive"
import { ExpertSquadRegistry } from "../../opencorvus/src/expert-squad/registry"
import { payloadPackageSources } from "../../opencorvus/generated/expert-squad-payload"

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
export const distributionOutputRoot = path.join(webRoot, ".generated", "expert-squads")
export const distributionMetadataPath = path.join(webRoot, "src", "content", "expert-squad-distribution.generated.ts")

type TrustedKey = { keyId: string; publicKeySpkiBase64: string }
type DistributionOptions = { sources?: ExpertSquadRegistry.EmbeddedPackageSource[]; embeddedIdentities?: Set<string> }

function trustedKeysFromEnvironment(): TrustedKey[] {
  const raw = process.env.EXPERT_SQUAD_TRUSTED_KEYS_JSON
  if (!raw) return []
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("EXPERT_SQUAD_TRUSTED_KEYS_JSON must be an array")
  const seen = new Set<string>()
  return parsed.map((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      typeof value.keyId !== "string" ||
      !/^[A-Za-z0-9._-]{1,128}$/.test(value.keyId) ||
      seen.has(value.keyId) ||
      typeof value.publicKeySpkiBase64 !== "string" ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value.publicKeySpkiBase64)
    ) {
      throw new Error("EXPERT_SQUAD_TRUSTED_KEYS_JSON contains an invalid or duplicate key")
    }
    seen.add(value.keyId)
    return { keyId: value.keyId, publicKeySpkiBase64: value.publicKeySpkiBase64 }
  })
}

function canonicalJSON(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function publicPath(...parts: string[]) {
  return ["expert-squads", ...parts].join("/")
}

async function writeBytes(root: string, relativePath: string, bytes: Uint8Array) {
  const target = path.join(root, ...relativePath.split("/"))
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

export async function generateExpertSquadDistribution(
  outputRoot = distributionOutputRoot,
  metadataPath = distributionMetadataPath,
  trustedKeys = trustedKeysFromEnvironment(),
  options: DistributionOptions = {},
) {
  const embeddedIdentities = options.embeddedIdentities ?? new Set(builtInPackageSources.map((source) => `${source.namespace}/${source.id}`))
  const sources = [...(options.sources ?? [...builtInPackageSources, ...payloadPackageSources])].sort((left, right) =>
    ExpertSquadArchive.compareUTF8(`${left.namespace}/${left.id}`, `${right.namespace}/${right.id}`),
  )
  const identities = sources.map((source) => `${source.namespace}/${source.id}`)
  if (new Set(identities).size !== identities.length) throw new Error("Shipped Expert Squad identities must be unique")

  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(outputRoot, { recursive: true })

  const catalogEntries = []
  const checksums: Array<{ path: string; sha256: string; bytes: number }> = []
  for (const source of sources) {
    const archive = await ExpertSquadArchive.createFromEmbeddedSource(source)
    const archiveRelativePath = publicPath(
      "archives",
      archive.namespace,
      archive.id,
      archive.version,
      archive.packageDigest,
      `${archive.archiveSha256}.zip`,
    )
    await writeBytes(outputRoot, archiveRelativePath.slice("expert-squads/".length), archive.bytes)
    checksums.push({ path: archiveRelativePath, sha256: archive.archiveSha256, bytes: archive.bytes.byteLength })
    catalogEntries.push({
      namespace: archive.namespace,
      id: archive.id,
      version: archive.version,
      packageDigest: archive.packageDigest,
      disposition: embeddedIdentities.has(`${archive.namespace}/${archive.id}`)
        ? "embedded_already_available"
        : "bundled_market_importable",
      archive: {
        path: `/${archiveRelativePath}`,
        sha256: archive.archiveSha256,
        bytes: archive.bytes.byteLength,
        files: archive.fileCount,
      },
    })
  }

  const catalog = {
    protocol: "opencorvus/expert-squad-static-catalog@1",
    resources: {
      total: sources.length,
      embeddedAlreadyAvailable: builtInPackageSources.length,
      bundledMarketImportable: payloadPackageSources.length,
    },
    packages: catalogEntries,
  }
  const catalogBytes = Buffer.from(canonicalJSON(catalog), "utf8")
  const catalogSha256 = ExpertSquadArchive.sha256(catalogBytes)
  const catalogRelativePath = publicPath("catalogs", `${catalogSha256}.json`)
  await writeBytes(outputRoot, catalogRelativePath.slice("expert-squads/".length), catalogBytes)
  checksums.push({ path: catalogRelativePath, sha256: catalogSha256, bytes: catalogBytes.byteLength })

  const publicationInput = {
    protocol: "opencorvus/expert-squad-publication-input@1",
    catalog: { path: `/${catalogRelativePath}`, sha256: catalogSha256, bytes: catalogBytes.byteLength },
    resources: catalog.resources,
  }
  const publicationInputBytes = Buffer.from(canonicalJSON(publicationInput), "utf8")
  const publicationInputPath = "publication-input.json"
  await writeBytes(outputRoot, publicationInputPath, publicationInputBytes)
  checksums.push({
    path: publicPath(publicationInputPath),
    sha256: ExpertSquadArchive.sha256(publicationInputBytes),
    bytes: publicationInputBytes.byteLength,
  })

  checksums.sort((left, right) => ExpertSquadArchive.compareUTF8(left.path, right.path))
  const checksumText = `${checksums.map((item) => `${item.sha256}  ${item.path}`).join("\n")}\n`
  await writeFile(path.join(outputRoot, "SHA256SUMS"), checksumText)

  const metadata = [
    "// Auto-generated by script/generate-expert-squad-distribution.ts.",
    "// The final signed bundle path is resolved at runtime from /expert-squads/catalog.json.",
    `export const generatedExpertSquadDistribution = ${JSON.stringify(
      {
        ...catalog.resources,
        catalogSha256,
        catalogPath: `/${catalogRelativePath}`,
        catalogBytes: catalogBytes.byteLength,
        trustedKeys,
      },
      null,
      2,
    )} as const`,
    "",
  ].join("\n")
  await mkdir(path.dirname(metadataPath), { recursive: true })
  await writeFile(metadataPath, metadata)

  return { catalog, catalogSha256, catalogPath: `/${catalogRelativePath}`, checksums, outputRoot }
}

if (import.meta.main) {
  const result = await generateExpertSquadDistribution()
  console.log(
    JSON.stringify({
      catalogSha256: result.catalogSha256,
      resources: result.catalog.resources,
      files: result.checksums.length + 1,
      outputRoot: result.outputRoot,
    }),
  )
}
