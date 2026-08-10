export type ExpertSquadTrustedKey = {
  keyId: string
  publicKeySpkiBase64: string
}

type ContentReference = { path: string; sha256: string; bytes: number }

export type ExpertSquadResources = {
  total: number
  embeddedAlreadyAvailable: number
  bundledMarketImportable: number
}

export type VerifiedExpertSquadBundle = ContentReference & {
  publicationVersion: number
  expiresAt: string
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const DIGEST = /^[a-f0-9]{64}$/
const KEY_ID = /^[A-Za-z0-9._-]{1,128}$/
const CATALOG_PATH = /^\/expert-squads\/catalogs\/([a-f0-9]{64})\.json$/
const SIGNATURE_PATH = /^\/expert-squads\/signatures\/([a-f0-9]{64})\.json$/
const BUNDLE_PATH = /^\/expert-squads\/bundles\/([a-f0-9]{64})\/all-expert-squads\.zip$/
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const VERSION_STORAGE_KEY = "opencorvus.expertSquadPublicationVersion"
const encoder = new TextEncoder()

function fail(message: string): never {
  throw new Error(`Invalid Expert Squad publication: ${message}`)
}

function contentReference(value: unknown, pathPattern: RegExp, name: string): ContentReference {
  if (!value || typeof value !== "object") fail(`${name} reference is missing`)
  const reference = value as Record<string, unknown>
  if (typeof reference.path !== "string" || !pathPattern.test(reference.path)) fail(`${name} path is invalid`)
  if (typeof reference.sha256 !== "string" || !DIGEST.test(reference.sha256)) fail(`${name} digest is invalid`)
  const match = pathPattern.exec(reference.path)
  if (!match || match[1] !== reference.sha256) fail(`${name} path is not content-addressed by its digest`)
  if (!Number.isSafeInteger(reference.bytes) || Number(reference.bytes) <= 0) fail(`${name} byte length is invalid`)
  return { path: reference.path, sha256: reference.sha256, bytes: Number(reference.bytes) }
}

function decodeBase64(value: string) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail("base64 value is invalid")
  const decoded = atob(value)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("")
}

async function sha256(bytes: Uint8Array) {
  return hex(await crypto.subtle.digest("SHA-256", bytes))
}

function frame(value: Uint8Array) {
  const length = new Uint8Array(8)
  new DataView(length.buffer).setBigUint64(0, BigInt(value.byteLength), false)
  const framed = new Uint8Array(length.byteLength + value.byteLength)
  framed.set(length)
  framed.set(value, length.byteLength)
  return framed
}

export function createCatalogSignatureMessage(input: {
  keyId: string
  publicationVersion: number
  expiresAt: string
  catalogBytes: number
  catalogSha256: string
  bundle: ContentReference
}) {
  const fields = [
    "Ed25519",
    input.keyId,
    String(input.publicationVersion),
    input.expiresAt,
    String(input.catalogBytes),
    input.catalogSha256,
    input.bundle.path,
    input.bundle.sha256,
    String(input.bundle.bytes),
  ].map((value) => frame(encoder.encode(value)))
  const domain = encoder.encode("opencorvus/expert-squad-catalog-signature@1")
  const message = new Uint8Array(domain.byteLength + fields.reduce((total, value) => total + value.byteLength, 0))
  message.set(domain)
  let offset = domain.byteLength
  for (const value of fields) {
    message.set(value, offset)
    offset += value.byteLength
  }
  return message
}

async function readBoundJSON(fetchImpl: FetchLike, reference: ContentReference) {
  const response = await fetchImpl(reference.path, { cache: "no-cache", headers: { Accept: "application/json" } })
  if (!response.ok) fail(`${reference.path} returned ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== reference.bytes) fail(`${reference.path} byte length does not match`)
  if ((await sha256(bytes)) !== reference.sha256) fail(`${reference.path} digest does not match`)
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)), bytes }
  } catch {
    return fail(`${reference.path} is not JSON`)
  }
}

function sameReference(left: ContentReference, right: ContentReference) {
  return left.path === right.path && left.sha256 === right.sha256 && left.bytes === right.bytes
}

function resourceCounts(value: unknown, name: string): ExpertSquadResources {
  if (!value || typeof value !== "object") fail(`${name} resource counts are invalid`)
  const resources = value as Record<string, unknown>
  for (const key of ["total", "embeddedAlreadyAvailable", "bundledMarketImportable"] as const) {
    if (!Number.isSafeInteger(resources[key]) || Number(resources[key]) < 0) fail(`${name} resource counts are invalid`)
  }
  const counts = {
    total: Number(resources.total),
    embeddedAlreadyAvailable: Number(resources.embeddedAlreadyAvailable),
    bundledMarketImportable: Number(resources.bundledMarketImportable),
  }
  if (counts.total <= 0 || counts.total !== counts.embeddedAlreadyAvailable + counts.bundledMarketImportable) {
    fail(`${name} resource counts are invalid`)
  }
  return counts
}

function sameResources(left: ExpertSquadResources, right: ExpertSquadResources) {
  return (
    left.total === right.total &&
    left.embeddedAlreadyAvailable === right.embeddedAlreadyAvailable &&
    left.bundledMarketImportable === right.bundledMarketImportable
  )
}

export async function resolveVerifiedExpertSquadBundle(options: {
  pointerUrl: string
  expectedCatalog: ContentReference
  expectedResources: ExpertSquadResources
  trustedKeys: readonly ExpertSquadTrustedKey[]
  fetchImpl?: FetchLike
  storage?: Pick<Storage, "getItem" | "setItem">
  now?: number
}): Promise<VerifiedExpertSquadBundle> {
  const fetchImpl = options.fetchImpl ?? fetch
  if (options.trustedKeys.length === 0) fail("no trusted signing keys are configured")
  const trustedKeys = new Map<string, ExpertSquadTrustedKey>()
  for (const key of options.trustedKeys) {
    if (!KEY_ID.test(key.keyId) || trustedKeys.has(key.keyId)) fail("trusted signing key set is invalid")
    decodeBase64(key.publicKeySpkiBase64)
    trustedKeys.set(key.keyId, key)
  }

  const pointerResponse = await fetchImpl(options.pointerUrl, {
    cache: "no-cache",
    headers: { Accept: "application/json" },
  })
  if (!pointerResponse.ok) fail(`publication pointer returned ${pointerResponse.status}`)
  const pointer = await pointerResponse.json()
  if (pointer?.protocol !== "opencorvus/expert-squad-publication@1") fail("pointer protocol is invalid")
  if (!Number.isSafeInteger(pointer.publicationVersion) || pointer.publicationVersion <= 0) fail("version is invalid")
  if (typeof pointer.expiresAt !== "string" || !UTC_INSTANT.test(pointer.expiresAt)) fail("expiry is invalid")
  const expiry = Date.parse(pointer.expiresAt)
  if (!Number.isFinite(expiry) || expiry <= (options.now ?? Date.now())) fail("publication is expired")
  const expectedResources = resourceCounts(options.expectedResources, "expected")
  const pointerResources = resourceCounts(pointer.resources, "pointer")
  if (!sameResources(pointerResources, expectedResources)) fail("resource counts do not match this website build")

  const catalog = contentReference(pointer.catalog, CATALOG_PATH, "catalog")
  const signatures = contentReference(pointer.signatures, SIGNATURE_PATH, "signature envelope")
  const bundle = contentReference(pointer.bundle, BUNDLE_PATH, "bundle")
  if (!sameReference(catalog, options.expectedCatalog)) fail("catalog does not match this website build")

  const [{ value: catalogDocument, bytes: catalogBytes }, { value: envelope }] = await Promise.all([
    readBoundJSON(fetchImpl, catalog),
    readBoundJSON(fetchImpl, signatures),
  ])
  const catalogResources = resourceCounts(catalogDocument?.resources, "catalog")
  const catalogPackages = catalogDocument?.packages
  if (
    catalogDocument?.protocol !== "opencorvus/expert-squad-static-catalog@1" ||
    !sameResources(catalogResources, expectedResources) ||
    !Array.isArray(catalogPackages) ||
    catalogPackages.length !== expectedResources.total ||
    catalogPackages.filter((item) => item?.disposition === "embedded_already_available").length !==
      expectedResources.embeddedAlreadyAvailable ||
    catalogPackages.filter((item) => item?.disposition === "bundled_market_importable").length !==
      expectedResources.bundledMarketImportable
  ) {
    fail("catalog content is invalid")
  }
  if (
    envelope?.protocol !== "opencorvus/expert-squad-catalog-signatures@1" ||
    envelope.publicationVersion !== pointer.publicationVersion ||
    envelope.expiresAt !== pointer.expiresAt ||
    !sameReference(contentReference(envelope.catalog, CATALOG_PATH, "signed catalog"), catalog) ||
    !sameReference(contentReference(envelope.bundle, BUNDLE_PATH, "signed bundle"), bundle) ||
    !Number.isSafeInteger(envelope.threshold) ||
    envelope.threshold <= 0 ||
    !Array.isArray(envelope.signatures)
  ) {
    fail("signature envelope is invalid")
  }

  let validSignatures = 0
  const seen = new Set<string>()
  for (const signature of envelope.signatures) {
    if (
      signature?.algorithm !== "Ed25519" ||
      typeof signature.keyId !== "string" ||
      seen.has(signature.keyId) ||
      typeof signature.messageSha256 !== "string" ||
      !DIGEST.test(signature.messageSha256) ||
      typeof signature.signatureBase64 !== "string"
    ) {
      fail("signature entry is invalid")
    }
    seen.add(signature.keyId)
    const trusted = trustedKeys.get(signature.keyId)
    if (!trusted) continue
    const message = createCatalogSignatureMessage({
      keyId: signature.keyId,
      publicationVersion: pointer.publicationVersion,
      expiresAt: pointer.expiresAt,
      catalogBytes: catalogBytes.byteLength,
      catalogSha256: catalog.sha256,
      bundle,
    })
    if ((await sha256(message)) !== signature.messageSha256) fail("signature message digest is invalid")
    const publicKey = await crypto.subtle.importKey(
      "spki",
      decodeBase64(trusted.publicKeySpkiBase64),
      { name: "Ed25519" },
      false,
      ["verify"],
    )
    if (await crypto.subtle.verify("Ed25519", publicKey, decodeBase64(signature.signatureBase64), message)) {
      validSignatures += 1
    }
  }
  if (validSignatures < envelope.threshold) fail("signature threshold is not satisfied")

  const storage = options.storage
  if (storage) {
    const stored = Number(storage.getItem(VERSION_STORAGE_KEY) ?? "0")
    if (Number.isSafeInteger(stored) && stored > pointer.publicationVersion) fail("publication version was rolled back")
    storage.setItem(VERSION_STORAGE_KEY, String(pointer.publicationVersion))
  }
  return { ...bundle, publicationVersion: pointer.publicationVersion, expiresAt: pointer.expiresAt }
}

export async function fetchVerifiedExpertSquadBundle(
  bundle: VerifiedExpertSquadBundle,
  fetchImpl: FetchLike = fetch,
) {
  const response = await fetchImpl(bundle.path, { cache: "no-cache", headers: { Accept: "application/zip" } })
  if (!response.ok) fail(`bundle returned ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength !== bundle.bytes) fail("bundle byte length does not match")
  if ((await sha256(bytes)) !== bundle.sha256) fail("bundle digest does not match")
  return new Blob([bytes], { type: "application/zip" })
}
