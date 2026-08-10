import { createHash, randomUUID } from "node:crypto"
import { appendFile, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  EXPERT_SQUAD_ID_PATTERN,
  ExpertSquadIDSchema,
  ExpertSquadNamespaceSchema,
} from "../../../opencorvus/src/expert-squad/id"
import { ExpertSquadPackageManager } from "../../../opencorvus/src/expert-squad/manager"
import { ExpertSquadRegistry } from "../../../opencorvus/src/expert-squad/registry"
import { ExpertSquadVersionSchema } from "../../../opencorvus/src/expert-squad/version"
import z from "zod"
import { projectExpertSquadFacts } from "./expert-squad-facts"

const SHA256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const HostedIdentitySegmentSchema = z.string().min(1).max(64).regex(EXPERT_SQUAD_ID_PATTERN)
const HostedVersionSchema = z
  .string()
  .regex(/^\d{4}\.\d{2}\.\d{2}\.[1-9]\d*$/, "version must use YYYY.MM.DD.N")
const FactsSchema = z
  .object({
    identity: z
      .object({
        namespace: HostedIdentitySegmentSchema,
        id: HostedIdentitySegmentSchema,
        version: HostedVersionSchema,
        digest: SHA256Schema,
      })
      .strict(),
    name: z.string().min(1),
    label: z.string().min(1),
    description: z.string(),
    selectorSummary: z.string().min(1),
    pillars: z.array(z.enum(["code", "work", "research", "office", "business"]).or(z.string().min(1))),
    agents: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1),
          description: z.string().optional(),
          baseRole: z.string().min(1),
        })
        .strict(),
    ),
    workflows: z.array(
      z
        .object({
          id: z.string().min(1),
          label: z.string().min(1),
          description: z.string().optional(),
          nodes: z.array(
            z
              .object({
                id: z.string().min(1),
                agentID: z.string().min(1),
                description: z.string().optional(),
                dependsOn: z.array(z.string()),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    projectedCapabilities: z
      .object({ skills: z.number().int().nonnegative(), tools: z.number().int().nonnegative(), mcp: z.number().int().nonnegative() })
      .strict(),
    packageOwnedCapabilities: z
      .object({ skills: z.number().int().nonnegative(), tools: z.number().int().nonnegative(), mcp: z.number().int().nonnegative() })
      .strict(),
    configuration: z.object({ fields: z.number().int().nonnegative(), required: z.number().int().nonnegative() }).strict(),
  })
  .strict()

export const HostedMarketRecordSchema = z
  .object({
    protocol: z.literal("opencorvus/hosted-market-simulation-record@1"),
    source: z.enum(["repository_snapshot", "validated_submission"]),
    createdAt: z.string().datetime(),
    archive: z
      .object({
        sha256: SHA256Schema,
        bytes: z.number().int().positive(),
        fileCount: z.number().int().positive(),
      })
      .strict(),
    facts: FactsSchema,
  })
  .strict()

export type HostedMarketRecord = z.output<typeof HostedMarketRecordSchema>

export const HostedMarketSubmissionSchema = z
  .object({
    protocol: z.literal("opencorvus/hosted-market-simulation-submission@1"),
    id: z.string().uuid(),
    createdAt: z.string().datetime(),
    originalFilename: z.string().min(1),
    archiveStorage: z.enum(["quarantine", "existing_blob"]),
    archive: HostedMarketRecordSchema.shape.archive,
    facts: FactsSchema,
  })
  .strict()

export type HostedMarketSubmission = z.output<typeof HostedMarketSubmissionSchema>

const HostedMarketDownloadEventSchema = z
  .object({
    protocol: z.literal("opencorvus/hosted-market-simulation-download@1"),
    issuedAt: z.string().datetime(),
    identity: FactsSchema.shape.identity,
    archiveSha256: SHA256Schema,
  })
  .strict()

export class HostedMarketSimulationError extends Error {
  constructor(
    readonly code:
      | "ARCHIVE_REQUIRED"
      | "ARCHIVE_TOO_LARGE"
      | "PACKAGE_VALIDATION_FAILED"
      | "SUBMISSION_NOT_FOUND"
      | "REVISION_NOT_FOUND"
      | "REGISTRY_INTEGRITY_MISMATCH",
    message: string,
    readonly httpStatus: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = "HostedMarketSimulationError"
  }
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

function archiveFilename(record: HostedMarketRecord) {
  const { namespace, id, version, digest } = record.facts.identity
  return `${namespace}-${id}-${version}-${digest.slice(0, 12)}.zip`
}

export function hostedMarketDownloadPath(record: HostedMarketRecord, apiBase: string) {
  const { namespace, id, version, digest } = record.facts.identity
  return `${apiBase}/records/${encodeURIComponent(namespace)}/${encodeURIComponent(id)}/${encodeURIComponent(version)}/${digest}/archive`
}

export class HostedMarketRegistrySimulation {
  readonly maxArchiveBytes = ExpertSquadPackageManager.archiveImportLimits.archiveBytes
  private readonly recordsRoot: string
  private readonly blobsRoot: string
  private readonly quarantineRoot: string
  private readonly metricsRoot: string

  constructor(readonly root: string) {
    this.recordsRoot = path.join(root, "records")
    this.blobsRoot = path.join(root, "blobs")
    this.quarantineRoot = path.join(root, "quarantine")
    this.metricsRoot = path.join(root, "metrics", "downloads")
  }

  async initialize() {
    await Promise.all([
      mkdir(this.recordsRoot, { recursive: true }),
      mkdir(this.blobsRoot, { recursive: true }),
      mkdir(this.quarantineRoot, { recursive: true }),
      mkdir(this.metricsRoot, { recursive: true }),
    ])
  }

  async seedPayloadRevision(id: string, expectedPackageDigest: string) {
    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-hosted-market-seed-"))
    try {
      const receipt = await ExpertSquadPackageManager.installPayloadPackage({
        projectDirectory,
        id,
        installationScope: "project",
      })
      if (receipt.after.packageDigest !== expectedPackageDigest) {
        throw new HostedMarketSimulationError(
          "REGISTRY_INTEGRITY_MISMATCH",
          `Generated market digest for ${id} does not match the canonical payload revision`,
          500,
        )
      }
      const canonical = await this.canonicalRevision(receipt.after.targetRoot, projectDirectory)
      return await this.storeRecord(canonical, "repository_snapshot")
    } finally {
      await rm(projectDirectory, { recursive: true, force: true })
    }
  }

  async validateUpload(input: { bytes: Uint8Array; originalFilename: string }): Promise<HostedMarketSubmission> {
    if (input.bytes.byteLength === 0) {
      throw new HostedMarketSimulationError("ARCHIVE_REQUIRED", "Choose a non-empty Expert Squad ZIP archive", 400)
    }
    if (input.bytes.byteLength > this.maxArchiveBytes) {
      throw new HostedMarketSimulationError(
        "ARCHIVE_TOO_LARGE",
        `Archive is ${input.bytes.byteLength} bytes; the local sandbox limit is ${this.maxArchiveBytes} bytes`,
        413,
      )
    }

    const projectDirectory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-hosted-market-upload-"))
    try {
      const receipt = await ExpertSquadPackageManager.importArchive({
        projectDirectory,
        archiveBase64: Buffer.from(input.bytes).toString("base64"),
        filename: input.originalFilename,
        installationScope: "project",
      })
      const canonical = await this.canonicalRevision(receipt.after.targetRoot, projectDirectory)
      const archiveStorage = (await this.readExistingBlob(canonical.archive)) ? "existing_blob" : "quarantine"
      const submission = HostedMarketSubmissionSchema.parse({
        protocol: "opencorvus/hosted-market-simulation-submission@1",
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        originalFilename: path.basename(input.originalFilename || "expert-squad.zip"),
        archiveStorage,
        archive: canonical.archive,
        facts: canonical.facts,
      })
      const quarantineArchive = path.join(this.quarantineRoot, `${submission.id}.zip`)
      const quarantineReceipt = path.join(this.quarantineRoot, `${submission.id}.json`)
      try {
        if (submission.archiveStorage === "quarantine") {
          await this.writeImmutable(quarantineArchive, canonical.bytes)
        }
        await this.writeImmutable(quarantineReceipt, Buffer.from(`${JSON.stringify(submission, null, 2)}\n`))
      } catch (error) {
        await Promise.all([rm(quarantineArchive, { force: true }), rm(quarantineReceipt, { force: true })])
        throw error
      }
      return submission
    } catch (error) {
      if (error instanceof HostedMarketSimulationError) throw error
      throw new HostedMarketSimulationError(
        "PACKAGE_VALIDATION_FAILED",
        error instanceof Error ? error.message : String(error),
        422,
        { cause: error },
      )
    } finally {
      await rm(projectDirectory, { recursive: true, force: true })
    }
  }

  async commitSubmission(id: string) {
    const submission = await this.readSubmission(id)
    const bytes =
      submission.archiveStorage === "existing_blob"
        ? await this.requireExistingBlob(submission.archive)
        : new Uint8Array(await readFile(path.join(this.quarantineRoot, `${submission.id}.zip`)))
    if (sha256(bytes) !== submission.archive.sha256) {
      throw new HostedMarketSimulationError(
        "REGISTRY_INTEGRITY_MISMATCH",
        `Quarantined archive ${submission.id} no longer matches its validated SHA-256`,
        500,
      )
    }
    const { record, existed } = await this.storeRecord(
      { bytes, archive: submission.archive, facts: submission.facts },
      "validated_submission",
    )
    await Promise.all([
      rm(path.join(this.quarantineRoot, `${submission.id}.zip`), { force: true }),
      rm(path.join(this.quarantineRoot, `${submission.id}.json`), { force: true }),
    ])
    return { record, deduplicated: existed }
  }

  async listRecords() {
    const records: HostedMarketRecord[] = []
    await this.walkRecordFiles(this.recordsRoot, records)
    return records.sort((left, right) => {
      const identityOrder = `${left.facts.identity.namespace}/${left.facts.identity.id}`.localeCompare(
        `${right.facts.identity.namespace}/${right.facts.identity.id}`,
      )
      if (identityOrder !== 0) return identityOrder
      return right.facts.identity.version.localeCompare(left.facts.identity.version)
    })
  }

  async getRecord(input: { namespace: string; id: string; version: string; packageDigest: string }) {
    const identity = {
      namespace: ExpertSquadNamespaceSchema.parse(input.namespace),
      id: ExpertSquadIDSchema.parse(input.id),
      version: ExpertSquadVersionSchema.parse(input.version),
      digest: SHA256Schema.parse(input.packageDigest),
    }
    const recordPath = this.recordPath(identity)
    try {
      return HostedMarketRecordSchema.parse(JSON.parse(await readFile(recordPath, "utf8")))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HostedMarketSimulationError(
          "REVISION_NOT_FOUND",
          `No hosted sandbox revision matches ${identity.namespace}/${identity.id}@${identity.version} with package digest ${identity.digest}`,
          404,
        )
      }
      throw error
    }
  }

  async readArchive(record: HostedMarketRecord) {
    const blobPath = path.join(this.blobsRoot, `${record.archive.sha256}.zip`)
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await readFile(blobPath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HostedMarketSimulationError(
          "REGISTRY_INTEGRITY_MISMATCH",
          `Hosted blob ${record.archive.sha256} is unavailable for this exact revision`,
          500,
        )
      }
      throw error
    }
    if (bytes.byteLength !== record.archive.bytes || sha256(bytes) !== record.archive.sha256) {
      throw new HostedMarketSimulationError(
        "REGISTRY_INTEGRITY_MISMATCH",
        `Hosted blob ${record.archive.sha256} failed its stored byte integrity check`,
        500,
      )
    }
    return { bytes, filename: archiveFilename(record) }
  }

  async recordDownloadResponse(record: HostedMarketRecord): Promise<number> {
    const event = HostedMarketDownloadEventSchema.parse({
      protocol: "opencorvus/hosted-market-simulation-download@1",
      issuedAt: new Date().toISOString(),
      identity: record.facts.identity,
      archiveSha256: record.archive.sha256,
    })
    const target = this.downloadEventPath(record)
    await mkdir(path.dirname(target), { recursive: true })
    await appendFile(target, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "a" })
    return await this.downloadResponseCount(record)
  }

  async downloadResponseCount(record: HostedMarketRecord): Promise<number> {
    let text: string
    try {
      text = await readFile(this.downloadEventPath(record), "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0
      throw error
    }
    const lines = text.split("\n").filter(Boolean)
    for (const line of lines) HostedMarketDownloadEventSchema.parse(JSON.parse(line))
    return lines.length
  }

  private async canonicalRevision(root: string, projectDirectory: string) {
    const loaded = await ExpertSquadRegistry.loadCatalogPackage(root)
    const exported = await ExpertSquadPackageManager.exportArchive({
      projectDirectory,
      id: loaded.id,
      installationScope: "project",
    })
    if (
      exported.namespace !== loaded.namespace ||
      exported.id !== loaded.id ||
      exported.version !== loaded.version ||
      exported.packageDigest !== loaded.packageDigest
    ) {
      throw new HostedMarketSimulationError(
        "REGISTRY_INTEGRITY_MISMATCH",
        `Canonical export identity does not match the validated package revision ${loaded.namespace}/${loaded.id}@${loaded.version}`,
        500,
      )
    }
    const bytes = exported.bytes
    return {
      bytes,
      archive: {
        sha256: exported.archiveSha256,
        bytes: bytes.byteLength,
        fileCount: exported.fileCount,
      },
      facts: projectExpertSquadFacts(loaded),
    }
  }

  private async storeRecord(
    canonical: { bytes: Uint8Array; archive: HostedMarketRecord["archive"]; facts: HostedMarketRecord["facts"] },
    source: HostedMarketRecord["source"],
  ) {
    const record = HostedMarketRecordSchema.parse({
      protocol: "opencorvus/hosted-market-simulation-record@1",
      source,
      createdAt: new Date().toISOString(),
      archive: canonical.archive,
      facts: canonical.facts,
    })
    const recordPath = this.recordPath(record.facts.identity)
    try {
      const existing = HostedMarketRecordSchema.parse(JSON.parse(await readFile(recordPath, "utf8")))
      if (existing.archive.sha256 !== record.archive.sha256) {
        throw new HostedMarketSimulationError(
          "REGISTRY_INTEGRITY_MISMATCH",
          `Exact revision record ${recordPath} already points to different archive bytes`,
          409,
        )
      }
      return { record: existing, existed: true }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }

    await this.writeImmutable(path.join(this.blobsRoot, `${record.archive.sha256}.zip`), canonical.bytes)
    await this.writeImmutable(recordPath, Buffer.from(`${JSON.stringify(record, null, 2)}\n`))
    return { record, existed: false }
  }

  private recordPath(identity: { namespace: string; id: string; version: string; digest: string }) {
    return path.join(this.recordsRoot, identity.namespace, identity.id, identity.version, `${identity.digest}.json`)
  }

  private downloadEventPath(record: HostedMarketRecord) {
    const { namespace, id, version, digest } = record.facts.identity
    return path.join(this.metricsRoot, namespace, id, version, `${digest}.jsonl`)
  }

  private async readExistingBlob(archive: HostedMarketRecord["archive"]): Promise<Uint8Array | null> {
    const target = path.join(this.blobsRoot, `${archive.sha256}.zip`)
    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await readFile(target))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
      throw error
    }
    if (bytes.byteLength !== archive.bytes || sha256(bytes) !== archive.sha256) {
      throw new HostedMarketSimulationError(
        "REGISTRY_INTEGRITY_MISMATCH",
        `Existing hosted blob ${archive.sha256} does not match the validated archive`,
        500,
      )
    }
    return bytes
  }

  private async requireExistingBlob(archive: HostedMarketRecord["archive"]): Promise<Uint8Array> {
    const bytes = await this.readExistingBlob(archive)
    if (!bytes) {
      throw new HostedMarketSimulationError(
        "REGISTRY_INTEGRITY_MISMATCH",
        `Deduplicated hosted blob ${archive.sha256} is no longer available`,
        500,
      )
    }
    return bytes
  }

  private async writeImmutable(target: string, bytes: Uint8Array) {
    await mkdir(path.dirname(target), { recursive: true })
    try {
      const existing = new Uint8Array(await readFile(target))
      if (sha256(existing) !== sha256(bytes)) {
        throw new HostedMarketSimulationError(
          "REGISTRY_INTEGRITY_MISMATCH",
          `Immutable hosted sandbox object already exists with different bytes: ${target}`,
          409,
        )
      }
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, bytes, { flag: "wx" })
    await rename(temporary, target)
  }

  private async readSubmission(id: string) {
    const parsedID = z.string().uuid().parse(id)
    try {
      return HostedMarketSubmissionSchema.parse(
        JSON.parse(await readFile(path.join(this.quarantineRoot, `${parsedID}.json`), "utf8")),
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new HostedMarketSimulationError(
          "SUBMISSION_NOT_FOUND",
          `Validated sandbox submission ${parsedID} is unavailable or was already committed`,
          404,
        )
      }
      throw error
    }
  }

  private async walkRecordFiles(directory: string, output: HostedMarketRecord[]) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
    for (const entry of entries) {
      const child = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        await this.walkRecordFiles(child, output)
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        output.push(HostedMarketRecordSchema.parse(JSON.parse(await readFile(child, "utf8"))))
      }
    }
  }
}
