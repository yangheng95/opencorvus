import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { generatedPublicMarketFacts } from "../src/content/public-market-facts.generated"
import {
  HostedMarketRegistrySimulation,
  HostedMarketSimulationError,
} from "../src/lib/hosted-market-registry"

describe("hosted Expert Squad registry simulation", () => {
  let root: string
  let registry: HostedMarketRegistrySimulation

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-hosted-market-contract-"))
    registry = new HostedMarketRegistrySimulation(root)
    await registry.initialize()
  })

  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })

  test("canonical download, upload validation, and explicit sandbox commit retain one exact revision", async () => {
    const facts = generatedPublicMarketFacts.find((candidate) => candidate.identity.id === "frontend-replica")!
    const seeded = await registry.seedPayloadRevision(facts.identity.id, facts.identity.digest)
    const initial = seeded.record
    const downloaded = await registry.readArchive(initial)
    expect(createHash("sha256").update(downloaded.bytes).digest("hex")).toBe(initial.archive.sha256)
    expect(await registry.downloadResponseCount(initial)).toBe(0)
    expect(await registry.recordDownloadResponse(initial)).toBe(1)
    expect(await registry.recordDownloadResponse(initial)).toBe(2)
    expect(await registry.downloadResponseCount(initial)).toBe(2)

    const submission = await registry.validateUpload({
      bytes: downloaded.bytes,
      originalFilename: downloaded.filename,
    })
    expect(submission.facts.identity).toEqual(initial.facts.identity)
    expect(submission.archive.sha256).toBe(initial.archive.sha256)
    expect(submission.archiveStorage).toBe("existing_blob")

    const committed = await registry.commitSubmission(submission.id)
    expect(committed.deduplicated).toBe(true)
    expect(committed.record).toEqual(initial)

    const resolved = await registry.getRecord({
      namespace: initial.facts.identity.namespace,
      id: initial.facts.identity.id,
      version: initial.facts.identity.version,
      packageDigest: initial.facts.identity.digest,
    })
    expect(resolved.archive).toEqual(initial.archive)
  }, 60_000)

  test("invalid ZIP input produces the canonical validation error contract", async () => {
    try {
      await registry.validateUpload({ bytes: new TextEncoder().encode("not a zip"), originalFilename: "broken.zip" })
      throw new Error("Expected validation to reject an invalid ZIP")
    } catch (error) {
      expect(error).toBeInstanceOf(HostedMarketSimulationError)
      expect((error as HostedMarketSimulationError).code).toBe("PACKAGE_VALIDATION_FAILED")
      expect((error as HostedMarketSimulationError).httpStatus).toBe(422)
    }
  })

  test("a different package digest resolves to the exact missing-revision contract", async () => {
    const facts = generatedPublicMarketFacts.find((candidate) => candidate.identity.id === "frontend-replica")!
    try {
      await registry.getRecord({
        namespace: facts.identity.namespace,
        id: facts.identity.id,
        version: facts.identity.version,
        packageDigest: "0".repeat(64),
      })
      throw new Error("Expected exact revision lookup to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(HostedMarketSimulationError)
      expect((error as HostedMarketSimulationError).code).toBe("REVISION_NOT_FOUND")
      expect((error as HostedMarketSimulationError).httpStatus).toBe(404)
    }
  })
})
