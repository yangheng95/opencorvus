import { BlobWriter, Uint8ArrayReader, ZipWriter } from "@zip.js/zip.js"
import { createHash } from "node:crypto"
import { ExpertSquadRegistry } from "./registry"

export namespace ExpertSquadArchive {
  export const CANONICAL_DATE = new Date("1980-01-01T00:00:00.000Z")

  export interface Entry {
    path: string
    bytes: Uint8Array
  }

  export interface Result {
    namespace: string
    id: string
    version: string
    packageDigest: string
    filename: string
    bytes: Uint8Array
    archiveSha256: string
    fileCount: number
  }

  export function compareUTF8(left: string, right: string) {
    return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
  }

  function normalizeEntryPath(value: string) {
    if (
      !value ||
      value.includes("\\") ||
      value.startsWith("/") ||
      /^[A-Za-z]:/.test(value) ||
      /[\u0000-\u001f\u007f]/.test(value)
    ) {
      throw new Error(`Expert Squad archive entry must be a canonical relative path: ${value}`)
    }
    const segments = value.split("/")
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`Expert Squad archive entry contains an unsafe path segment: ${value}`)
    }
    return segments.join("/")
  }

  export async function createDeterministicZip(entries: readonly Entry[]) {
    const normalized = entries
      .map((entry) => ({ path: normalizeEntryPath(entry.path), bytes: Uint8Array.from(entry.bytes) }))
      .sort((left, right) => compareUTF8(left.path, right.path))
    const seen = new Set<string>()
    const zip = new ZipWriter(new BlobWriter("application/zip"))
    for (const entry of normalized) {
      const collisionKey = entry.path.toLowerCase()
      if (seen.has(collisionKey)) {
        throw new Error(`Duplicate Expert Squad archive entry after normalization: ${entry.path}`)
      }
      seen.add(collisionKey)
      await zip.add(entry.path, new Uint8ArrayReader(entry.bytes), { lastModDate: CANONICAL_DATE })
    }
    const blob = await zip.close()
    return new Uint8Array(await blob.arrayBuffer())
  }

  export async function create(input: {
    namespace: string
    id: string
    version: string
    packageDigest: string
    files: readonly Entry[]
  }): Promise<Result> {
    if (input.files.length === 0) throw new Error(`Expert Squad ${input.namespace}/${input.id} has no archive files`)
    const wrapper = `${normalizeEntryPath(input.namespace)}/${normalizeEntryPath(input.id)}`
    const bytes = await createDeterministicZip(
      input.files.map((file) => ({ path: `${wrapper}/${normalizeEntryPath(file.path)}`, bytes: file.bytes })),
    )
    return {
      namespace: input.namespace,
      id: input.id,
      version: input.version,
      packageDigest: input.packageDigest,
      filename: `${input.id}-expert-squad.zip`,
      bytes,
      archiveSha256: createHash("sha256").update(bytes).digest("hex"),
      fileCount: input.files.length,
    }
  }

  export async function createFromEmbeddedSource(source: ExpertSquadRegistry.EmbeddedPackageSource): Promise<Result> {
    const declaration = ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source)
    return create({
      namespace: declaration.namespace,
      id: declaration.id,
      version: declaration.version,
      packageDigest: declaration.packageDigest,
      files: Object.entries(source.files).map(([path, file]) => ({
        path,
        bytes: ExpertSquadRegistry.embeddedPackageFileBytes(file),
      })),
    })
  }

  export function sha256(bytes: Uint8Array) {
    return createHash("sha256").update(bytes).digest("hex")
  }
}
