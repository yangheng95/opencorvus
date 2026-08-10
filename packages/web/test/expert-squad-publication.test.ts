import { describe, expect, test } from "bun:test"
import {
  createCatalogSignatureMessage,
  fetchVerifiedExpertSquadBundle,
  resolveVerifiedExpertSquadBundle,
  type ExpertSquadTrustedKey,
} from "../src/lib/expert-squad-publication"

const encoder = new TextEncoder()
const resources = { total: 3, embeddedAlreadyAvailable: 1, bundledMarketImportable: 2 }

async function digest(bytes: Uint8Array) {
  return Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex")
}

async function publication() {
  const keyPair = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair
  const keyId = "release-2026-a"
  const publicKeySpkiBase64 = Buffer.from(await crypto.subtle.exportKey("spki", keyPair.publicKey)).toString("base64")
  const trustedKeys: ExpertSquadTrustedKey[] = [{ keyId, publicKeySpkiBase64 }]
  const catalogBytes = encoder.encode(
    `${JSON.stringify({
      protocol: "opencorvus/expert-squad-static-catalog@1",
      resources,
      packages: Array.from({ length: resources.total }, (_, index) => ({
        id: `squad-${index}`,
        disposition: index < resources.embeddedAlreadyAvailable ? "embedded_already_available" : "bundled_market_importable",
      })),
    })}\n`,
  )
  const catalogSha256 = await digest(catalogBytes)
  const catalog = {
    path: `/expert-squads/catalogs/${catalogSha256}.json`,
    sha256: catalogSha256,
    bytes: catalogBytes.byteLength,
  }
  const publicationVersion = 7
  const expiresAt = "2030-01-01T00:00:00Z"
  const bundleSha256 = "a".repeat(64)
  const bundle = {
    path: `/expert-squads/bundles/${bundleSha256}/all-expert-squads.zip`,
    sha256: bundleSha256,
    bytes: 1234,
  }
  const message = createCatalogSignatureMessage({
    keyId,
    publicationVersion,
    expiresAt,
    catalogBytes: catalog.bytes,
    catalogSha256,
    bundle,
  })
  const signatureBase64 = Buffer.from(await crypto.subtle.sign("Ed25519", keyPair.privateKey, message)).toString("base64")
  const envelopeBytes = encoder.encode(
    `${JSON.stringify({
      protocol: "opencorvus/expert-squad-catalog-signatures@1",
      threshold: 1,
      catalog,
      bundle,
      publicationVersion,
      expiresAt,
      signatures: [
        {
          algorithm: "Ed25519",
          keyId,
          messageSha256: await digest(message),
          signatureBase64,
        },
      ],
    })}\n`,
  )
  const envelopeSha256 = await digest(envelopeBytes)
  const signatures = {
    path: `/expert-squads/signatures/${envelopeSha256}.json`,
    sha256: envelopeSha256,
    bytes: envelopeBytes.byteLength,
  }
  const pointer = {
    protocol: "opencorvus/expert-squad-publication@1",
    publicationVersion,
    expiresAt,
    resources,
    catalog,
    signatures,
    bundle,
  }
  return { pointer, catalog, catalogBytes, signatures, envelopeBytes, trustedKeys }
}

function fetcher(fixture: Awaited<ReturnType<typeof publication>>, pointer: unknown = fixture.pointer) {
  const bodies = new Map<string, BodyInit>([
    ["/expert-squads/catalog.json", JSON.stringify(pointer)],
    [fixture.catalog.path, fixture.catalogBytes],
    [fixture.signatures.path, fixture.envelopeBytes],
  ])
  return (async (input: RequestInfo | URL) => {
    const path = String(input)
    const body = bodies.get(path)
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body)
  })
}

async function expectFailure(promise: Promise<unknown>, message: string) {
  try {
    await promise
    throw new Error("expected promise to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain(message)
  }
}

describe("signed Expert Squad publication resolver", () => {
  test("accepts a future publication matching the website build with a trusted Ed25519 signature", async () => {
    const fixture = await publication()
    const values = new Map<string, string>()
    const result = await resolveVerifiedExpertSquadBundle({
      pointerUrl: "/expert-squads/catalog.json",
      expectedCatalog: fixture.catalog,
      expectedResources: resources,
      trustedKeys: fixture.trustedKeys,
      fetchImpl: fetcher(fixture),
      storage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) },
      now: Date.parse("2029-01-01T00:00:00Z"),
    })
    expect(result.sha256).toBe("a".repeat(64))
    expect(result.publicationVersion).toBe(7)
    expect(values.get("opencorvus.expertSquadPublicationVersion")).toBe("7")
  })

  test("rejects a pointer without the signature envelope", async () => {
    const fixture = await publication()
    await expectFailure(
      resolveVerifiedExpertSquadBundle({
        pointerUrl: "/expert-squads/catalog.json",
        expectedCatalog: fixture.catalog,
        expectedResources: resources,
        trustedKeys: fixture.trustedKeys,
        fetchImpl: fetcher(fixture, { ...fixture.pointer, signatures: undefined }),
        now: Date.parse("2029-01-01T00:00:00Z"),
      }),
      "signature envelope reference is missing",
    )
  })

  test("rejects expiry, rollback, and byte-binding failures", async () => {
    const fixture = await publication()
    await expectFailure(
      resolveVerifiedExpertSquadBundle({
        pointerUrl: "/expert-squads/catalog.json",
        expectedCatalog: fixture.catalog,
        expectedResources: resources,
        trustedKeys: fixture.trustedKeys,
        fetchImpl: fetcher(fixture),
        now: Date.parse("2031-01-01T00:00:00Z"),
      }),
      "publication is expired",
    )
    await expectFailure(
      resolveVerifiedExpertSquadBundle({
        pointerUrl: "/expert-squads/catalog.json",
        expectedCatalog: fixture.catalog,
        expectedResources: resources,
        trustedKeys: fixture.trustedKeys,
        fetchImpl: fetcher(fixture),
        storage: { getItem: () => "8", setItem: () => undefined },
        now: Date.parse("2029-01-01T00:00:00Z"),
      }),
      "publication version was rolled back",
    )
    await expectFailure(
      resolveVerifiedExpertSquadBundle({
        pointerUrl: "/expert-squads/catalog.json",
        expectedCatalog: { ...fixture.catalog, bytes: fixture.catalog.bytes + 1 },
        expectedResources: resources,
        trustedKeys: fixture.trustedKeys,
        fetchImpl: fetcher(fixture),
        now: Date.parse("2029-01-01T00:00:00Z"),
      }),
      "catalog does not match this website build",
    )
  })

  test("downloads only bytes that match the signed bundle reference", async () => {
    const bytes = encoder.encode("verified bundle")
    const sha256 = await digest(bytes)
    const bundle = {
      path: `/expert-squads/bundles/${sha256}/all-expert-squads.zip`,
      sha256,
      bytes: bytes.byteLength,
      publicationVersion: 1,
      expiresAt: "2030-01-01T00:00:00Z",
    }
    const blob = await fetchVerifiedExpertSquadBundle(bundle, async () => new Response(bytes))
    expect(Buffer.from(await blob.arrayBuffer())).toEqual(Buffer.from(bytes))
    await expectFailure(
      fetchVerifiedExpertSquadBundle(bundle, async () => new Response("tampered")),
      "bundle byte length does not match",
    )
  })
})
