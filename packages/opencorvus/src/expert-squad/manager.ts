import { Uint8ArrayReader, Writer, ZipReader } from "@zip.js/zip.js"
import { createHash, randomUUID } from "node:crypto"
import { cp, lstat, mkdir, open, readFile, readdir, rename, rm, writeFile } from "fs/promises"
import { parse as parseJsonc, printParseErrorCode, type ParseError } from "jsonc-parser"
import os from "node:os"
import path from "path"
import { Global } from "@/global"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { PackageUpdateClient } from "@/package-update/client"
import { Filesystem } from "@/util/filesystem"
import { getLoadedBuiltInPackages } from "./builtin"
import { ExpertSquadCleanup } from "./cleanup"
import { ExpertSquadInstallLock } from "./install-lock"
import { ExpertSquadPackageLocations } from "./locations"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadRegistry } from "./registry"
import { ExpertSquadArchive } from "./archive"
import { writeExpertSquadInstallationMetadata, type ExpertSquadGenerationMetadata } from "./installation-metadata"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { Log } from "@/util/log"
import { EngineArtifactEnvelopeSchema, EvolutionPromotionReceiptSchema } from "@opencorvus-ai/plugin"
import { EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS } from "@opencorvus-ai/sdk/expert-squad-package-contract"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, eq } from "@/storage/db"
import { scoreDiscoveryFields } from "@/capability/fuzzy"
import { ExpertSquadIDSchema, ExpertSquadNamespaceSchema } from "./id"

export namespace ExpertSquadPackageManager {
  const log = Log.create({ service: "expert-squad.package-manager" })
  export class EvolutionMutationAbruptTerminationForTest extends Error {
    constructor() {
      super("Injected abrupt expert squad evolution mutation termination")
      this.name = "EvolutionMutationAbruptTerminationForTest"
    }
  }
  export class PackageMutationAbruptTerminationForTest extends Error {
    constructor() {
      super("Injected abrupt expert squad package mutation termination")
      this.name = "PackageMutationAbruptTerminationForTest"
    }
  }
  class EvolutionMutationCleanupPendingError extends Error {
    constructor(cause: unknown) {
      super("Committed expert squad mutation cleanup remains pending", { cause })
      this.name = "EvolutionMutationCleanupPendingError"
    }
  }
  let evolutionMutationInterruptForTest: (() => Promise<void>) | undefined
  let evolutionReceiptReadForTest: (() => void) | undefined
  let packageMutationAfterTargetMoveInterruptForTest: (() => Promise<void>) | undefined
  let packageMutationAfterTargetInstallInterruptForTest: (() => Promise<void>) | undefined
  let packageMutationAfterBackupRemovalFailureForTest: (() => Promise<void>) | undefined

  export namespace TestHooks {
    export function interruptAfterTargetInstallBeforeReceiptOnce() {
      const previous = evolutionMutationInterruptForTest
      let pending = true
      evolutionMutationInterruptForTest = async () => {
        if (!pending) return
        pending = false
        throw new EvolutionMutationAbruptTerminationForTest()
      }
      return () => {
        evolutionMutationInterruptForTest = previous
      }
    }

    export function failFirstReceiptReadAfterCommit() {
      const previous = evolutionReceiptReadForTest
      let pending = true
      let triggered = false
      evolutionReceiptReadForTest = () => {
        if (!pending) return
        pending = false
        triggered = true
        throw new Error("Injected committed evolution receipt read failure")
      }
      return {
        wasTriggered: () => triggered,
        restore: () => {
          evolutionReceiptReadForTest = previous
        },
      }
    }

    export function interruptAfterTargetMoveBeforeInstallOnce() {
      const previous = packageMutationAfterTargetMoveInterruptForTest
      let pending = true
      packageMutationAfterTargetMoveInterruptForTest = async () => {
        if (!pending) return
        pending = false
        throw new PackageMutationAbruptTerminationForTest()
      }
      return () => {
        packageMutationAfterTargetMoveInterruptForTest = previous
      }
    }

    export function failAfterBackupRemovalBeforeJournalRemovalOnce() {
      const previous = packageMutationAfterBackupRemovalFailureForTest
      let pending = true
      packageMutationAfterBackupRemovalFailureForTest = async () => {
        if (!pending) return
        pending = false
        throw new Error("Injected replacement journal removal failure after commit")
      }
      return () => {
        packageMutationAfterBackupRemovalFailureForTest = previous
      }
    }

    export function interruptAfterTargetInstallBeforeBackupCleanupOnce() {
      const previous = packageMutationAfterTargetInstallInterruptForTest
      let pending = true
      packageMutationAfterTargetInstallInterruptForTest = async () => {
        if (!pending) return
        pending = false
        throw new PackageMutationAbruptTerminationForTest()
      }
      return () => {
        packageMutationAfterTargetInstallInterruptForTest = previous
      }
    }
  }
  export interface ImportDirectoryInput {
    projectDirectory: string
    sourceDirectory: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    generation?: ExpertSquadGenerationMetadata
    expectedCurrentPackageDigest?: string
  }

  export interface ValidateDirectoryInput {
    projectDirectory: string
    sourceDirectory: string
  }

  export interface ImportArchiveInput {
    projectDirectory: string
    archiveBase64: string
    filename?: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    expectedCurrentPackageDigest?: string
    expectedNamespace?: string
    expectedID?: string
    expectedVersion?: string
    expectedPackageDigest?: string
  }

  export interface ExportInput {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
  }

  export interface InstalledPackageRevision {
    installationScope: ExpertSquadPackageLocations.InstallationScope
    projectDirectory: string | null
    namespace: string
    id: string
    version: string | null
    packageDigest: string
    targetRoot: string
  }

  export type PackageMutationReceipt =
    | { operation: "installed"; before: null; after: InstalledPackageRevision }
    | { operation: "unchanged"; before: InstalledPackageRevision; after: InstalledPackageRevision }
    | {
        operation: "replaced" | "restored"
        before: InstalledPackageRevision
        after: InstalledPackageRevision
      }

  export type DurableMutationReceipt = {
    identity: { taskID: string; artifactID: string }
    commit: (receipt: PackageMutationReceipt) => Promise<void>
  }

  export const ExpertSquadPackageMutationConflictError = NamedError.create(
    "ExpertSquadPackageMutationConflictError",
    z.object({
      message: z.string(),
      id: z.string(),
      installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
      expectedCurrentPackageDigest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
      actualCurrentPackageDigest: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
    }),
  )

  export interface ExportResult {
    namespace: string
    id: string
    version: string
    packageDigest: string
    filename: string
    bytes: Uint8Array
    archiveSha256: string
    fileCount: number
  }

  export interface ReleasePayloadResult {
    installed: PackageMutationReceipt[]
    skipped: PackageMutationReceipt[]
  }

  export interface PayloadMarketAgent {
    id: string
    label: string
    description?: string
    baseRole: string
  }

  export interface PayloadMarketItem {
    namespace: string
    id: string
    name: string
    label: string
    description?: string
    version: string
    packageDigest: string
    selectorSummary: string
    agents: PayloadMarketAgent[]
    skillCount: number
    toolCount: number
    mcpCount: number
    installations: Array<{
      installationScope: ExpertSquadPackageLocations.InstallationScope
      installedVersion: string | null
      installedPackageDigest: string
      updateAvailable: boolean
    }>
  }

  export interface PayloadMarketIndexItem {
    namespace: string
    id: string
    name: string
    label: string
    description?: string
    version: string
    installationScopes: ExpertSquadPackageLocations.InstallationScope[]
  }

  export interface PayloadMarketPage {
    catalogRevision: string
    entries: PayloadMarketIndexItem[]
    nextCursor: string | null
    totalCount: number
  }

  export type PayloadMarketAvailability = "all" | "available" | "installed"

  export type InstallPayloadResult = PackageMutationReceipt

  export interface UninstallResult {
    namespace: string
    id: string
    targetRoot: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
  }

  export interface UpdateResult {
    source: PackageUpdateClient.Source
    receipt: PackageMutationReceipt
  }

  type NormalizedArchiveFile = {
    path: string
    bytes: Uint8Array
  }

  export const archiveImportLimits = EXPERT_SQUAD_ARCHIVE_IMPORT_LIMITS

  function scratchBaseForLocation(location: ExpertSquadPackageLocations.Location) {
    return path.join(location.configRoot, "expert-squad-staging")
  }

  function targetRootForLocation(location: ExpertSquadPackageLocations.Location, namespace: string, id: string) {
    return path.join(location.packagesRoot, namespace, id)
  }

  function stagingRootForLocation(location: ExpertSquadPackageLocations.Location, label: string, operationID: string) {
    return path.join(scratchBaseForLocation(location), `.staging-${label}-${operationID}`)
  }

  function backupRootForLocation(location: ExpertSquadPackageLocations.Location, label: string, operationID: string) {
    return path.join(scratchBaseForLocation(location), `.replace-${label}-${operationID}`)
  }

  function discardRootForLocation(location: ExpertSquadPackageLocations.Location, label: string, operationID: string) {
    return path.join(scratchBaseForLocation(location), `.discard-${label}-${operationID}`)
  }

  const EvolutionMutationJournalSchema = z
    .object({
      protocol: z.literal("opencorvus/expert-squad-evolution-mutation-intent@1"),
      operationID: z.string().uuid(),
      identity: z.object({ taskID: z.string().min(1), artifactID: z.string().min(1) }).strict(),
      target: z.string().min(1),
      staging: z.string().min(1),
      backup: z.string().min(1),
      discard: z.string().min(1),
      installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
      projectDirectory: z.string().min(1).nullable(),
      namespace: ExpertSquadNamespaceSchema,
      id: ExpertSquadIDSchema,
      managerOperation: z.enum(["replaced", "restored"]),
      beforePackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
      afterPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
  type EvolutionMutationJournal = z.infer<typeof EvolutionMutationJournalSchema>

  const PackageReplacementJournalSchema = z
    .object({
      protocol: z.literal("opencorvus/expert-squad-package-replacement-intent@1"),
      operationID: z.string().uuid(),
      target: z.string().min(1),
      staging: z.string().min(1),
      backup: z.string().min(1),
      discard: z.string().min(1),
      installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
      projectDirectory: z.string().min(1).nullable(),
      namespace: ExpertSquadNamespaceSchema,
      id: ExpertSquadIDSchema,
      beforePackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
      afterPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
  type PackageReplacementJournal = z.infer<typeof PackageReplacementJournalSchema>

  function evolutionMutationJournalPath(location: ExpertSquadPackageLocations.Location, id: string) {
    return path.join(scratchBaseForLocation(location), `.evolution-mutation-${id}.json`)
  }

  function packageReplacementJournalPath(location: ExpertSquadPackageLocations.Location, id: string) {
    return path.join(scratchBaseForLocation(location), `.package-replacement-${id}.json`)
  }

  async function writeMutationJournal(file: string, value: EvolutionMutationJournal | PackageReplacementJournal) {
    const temporary = `${file}.${randomUUID()}.tmp`
    const bytes = JSON.stringify(value)
    let published = false
    try {
      await writeFile(temporary, bytes, { encoding: "utf8", flag: "wx" })
      const handle = await open(temporary, "r+")
      try {
        await handle.sync()
      } finally {
        await handle.close()
      }
      await rename(temporary, file)
      published = true
      if (process.platform !== "win32") {
        const directory = await open(path.dirname(file), "r")
        try {
          await directory.sync()
        } finally {
          await directory.close()
        }
      }
    } catch (error) {
      const cleanup = await Promise.allSettled([
        rm(temporary, { force: true }),
        ...(published ? [rm(file, { force: true })] : []),
      ])
      const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failures.length > 0)
        throw new AggregateError(
          [error, ...failures.map((failure) => failure.reason)],
          "Expert squad mutation journal write failed and temporary cleanup was incomplete",
          { cause: error },
        )
      throw error
    }
  }

  type PackagePathState = { kind: "absent" } | { kind: "package"; packageDigest: string } | { kind: "partial" }

  async function packageStateAt(root: string): Promise<PackagePathState> {
    const state = await lstat(root).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (!state) return { kind: "absent" }
    if (!state.isDirectory() || state.isSymbolicLink())
      throw new Error(`Expert squad mutation recovery path is not an ordinary directory: ${root}`)
    try {
      return {
        kind: "package",
        packageDigest: (await ExpertSquadRegistry.loadCatalogPackage(root, { canonicalFolder: false })).packageDigest,
      }
    } catch {
      return { kind: "partial" }
    }
  }

  function packageStateHasDigest(state: PackagePathState, packageDigest: string) {
    return state.kind === "package" && state.packageDigest === packageDigest
  }

  function packageStateIsDisposable(state: PackagePathState, expectedPackageDigest: string) {
    return state.kind === "absent" || state.kind === "partial" || packageStateHasDigest(state, expectedPackageDigest)
  }

  function assertMutationJournalLocation(
    journal: {
      target: string
      staging: string
      backup: string
      discard: string
      operationID: string
      installationScope: ExpertSquadPackageLocations.InstallationScope
      projectDirectory: string | null
      namespace: string
      id: string
    },
    location: ExpertSquadPackageLocations.Location,
    id: string,
  ) {
    if (
      journal.id !== id ||
      journal.installationScope !== location.kind ||
      (location.kind === "global" && journal.projectDirectory !== null) ||
      (location.kind === "project" &&
        (journal.projectDirectory === null ||
          Filesystem.normalizePath(ProjectRuntimePaths.projectConfigRoot(journal.projectDirectory)) !==
            Filesystem.normalizePath(location.configRoot)))
    ) {
      throw new Error("Expert squad mutation journal installation identity does not equal its catalog location")
    }
    const target = targetRootForLocation(location, journal.namespace, journal.id)
    const scratch = scratchBaseForLocation(location)
    const label = `${journal.namespace}-${journal.id}`
    const expectedPaths = {
      target,
      staging: stagingRootForLocation(location, label, journal.operationID),
      backup: backupRootForLocation(location, label, journal.operationID),
      discard: discardRootForLocation(location, label, journal.operationID),
    }
    assertInside(location.packagesRoot, expectedPaths.target, "expert squad mutation journal target root")
    assertInside(scratch, expectedPaths.staging, "expert squad mutation journal staging root")
    assertInside(scratch, expectedPaths.backup, "expert squad mutation journal backup root")
    assertInside(scratch, expectedPaths.discard, "expert squad mutation journal discard root")
    for (const [kind, expected] of Object.entries(expectedPaths)) {
      if (journal[kind as keyof typeof expectedPaths] !== expected) {
        throw new Error(`Expert squad mutation journal ${kind} does not equal ${expected}`)
      }
    }
  }

  async function reconcilePackageReplacementJournal(input: {
    location: ExpertSquadPackageLocations.Location
    id: string
  }): Promise<"none" | "rolled-back" | "committed"> {
    const journalPath = packageReplacementJournalPath(input.location, input.id)
    const text = await readFile(journalPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (text === undefined) return "none"
    const journal = PackageReplacementJournalSchema.parse(JSON.parse(text))
    assertMutationJournalLocation(journal, input.location, input.id)
    const [targetState, stagingState, backupState, discardState] = await Promise.all([
      packageStateAt(journal.target),
      packageStateAt(journal.staging),
      packageStateAt(journal.backup),
      packageStateAt(journal.discard),
    ])

    if (
      packageStateHasDigest(targetState, journal.beforePackageDigest) &&
      packageStateIsDisposable(stagingState, journal.afterPackageDigest) &&
      backupState.kind === "absent" &&
      packageStateIsDisposable(discardState, journal.afterPackageDigest)
    ) {
      await rm(journal.staging, { recursive: true, force: true })
      await rm(journal.discard, { recursive: true, force: true })
      await rm(journalPath)
      await ExpertSquadRegistry.invalidateAvailable()
      return "rolled-back"
    }
    if (
      packageStateHasDigest(backupState, journal.beforePackageDigest) &&
      (targetState.kind === "absent" || packageStateHasDigest(targetState, journal.afterPackageDigest)) &&
      packageStateIsDisposable(stagingState, journal.afterPackageDigest) &&
      packageStateIsDisposable(discardState, journal.afterPackageDigest)
    ) {
      if (packageStateHasDigest(targetState, journal.afterPackageDigest)) {
        if (discardState.kind !== "absent") await rm(journal.discard, { recursive: true, force: true })
        await rename(journal.target, journal.discard)
      }
      await rename(journal.backup, journal.target)
      await rm(journal.staging, { recursive: true, force: true })
      await rm(journal.discard, { recursive: true, force: true })
      await rm(journalPath)
      await ExpertSquadRegistry.invalidateAvailable()
      return "rolled-back"
    }
    if (
      packageStateHasDigest(targetState, journal.afterPackageDigest) &&
      packageStateIsDisposable(stagingState, journal.afterPackageDigest) &&
      (backupState.kind === "absent" || backupState.kind === "partial") &&
      discardState.kind === "absent"
    ) {
      await rm(journal.staging, { recursive: true, force: true })
      await rm(journal.backup, { recursive: true, force: true })
      await rm(journalPath)
      await ExpertSquadRegistry.invalidateAvailable()
      return "committed"
    }
    throw new Error("Expert squad package replacement journal has an unknown interrupted filesystem state")
  }

  function committedEvolutionReceipt(journal: EvolutionMutationJournal) {
    evolutionReceiptReadForTest?.()
    const identity = journal.identity
    const row = Database.use((db) =>
      db.select().from(EngineArtifactTable).where(eq(EngineArtifactTable.id, identity.artifactID)).get(),
    )
    if (!row) return undefined
    if (row.task_id !== identity.taskID || row.kind !== "expert_output")
      throw new Error("Expert squad mutation journal receipt belongs to a foreign Artifact partition")
    const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
    if (
      envelope.artifact_type !== "evolution-lab/promotion-receipt" ||
      envelope.schema_version !== 1 ||
      envelope.producer.owner_kind !== "core" ||
      envelope.producer.component_id !== "expert-squad-package-manager"
    )
      throw new Error("Expert squad mutation journal receipt identity collides with a non-Manager Artifact")
    const receipt = EvolutionPromotionReceiptSchema.parse(envelope.payload)
    const expectedOperation = journal.managerOperation === "replaced" ? "promotion" : "restoration"
    if (
      receipt.operation !== expectedOperation ||
      receipt.authorization.task_id !== journal.identity.taskID ||
      envelope.producer.operation_id !== receipt.authorization.message_id ||
      receipt.target.scope !== journal.installationScope ||
      receipt.target.project_directory !== journal.projectDirectory ||
      receipt.target.namespace !== journal.namespace ||
      receipt.target.id !== journal.id ||
      receipt.before_digest !== journal.beforePackageDigest ||
      receipt.after_digest !== journal.afterPackageDigest ||
      receipt.manager_receipt.operation !== journal.managerOperation ||
      receipt.manager_receipt.before?.targetRoot !== journal.target ||
      receipt.manager_receipt.after.targetRoot !== journal.target
    )
      throw new Error("Expert squad mutation journal receipt does not equal the exact journaled mutation")
    return receipt
  }

  async function reconcileEvolutionMutationJournal(input: {
    location: ExpertSquadPackageLocations.Location
    id: string
  }) {
    const journalPath = evolutionMutationJournalPath(input.location, input.id)
    const text = await readFile(journalPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (text === undefined) return
    const journal = EvolutionMutationJournalSchema.parse(JSON.parse(text))
    assertMutationJournalLocation(journal, input.location, input.id)
    const committed = committedEvolutionReceipt(journal)
    const targetState = await packageStateAt(journal.target)
    const backupState = await packageStateAt(journal.backup)
    const discardState = await packageStateAt(journal.discard)
    if (committed) {
      if (!packageStateHasDigest(targetState, journal.afterPackageDigest))
        throw new Error("Committed expert squad mutation journal does not match the installed revision")
      const cleanup = await Promise.allSettled([
        rm(journal.backup, { recursive: true, force: true }),
        rm(journal.staging, { recursive: true, force: true }),
        rm(journal.discard, { recursive: true, force: true }),
      ])
      const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failures.length > 0)
        throw new EvolutionMutationCleanupPendingError(
          new AggregateError(
            failures.map((failure) => failure.reason),
            "Committed mutation backup cleanup failed",
          ),
        )
      try {
        await rm(journalPath)
      } catch (error) {
        throw new EvolutionMutationCleanupPendingError(error)
      }
      return
    }
    if (
      packageStateHasDigest(targetState, journal.beforePackageDigest) &&
      backupState.kind === "absent" &&
      packageStateIsDisposable(discardState, journal.afterPackageDigest)
    ) {
      await rm(journal.staging, { recursive: true, force: true })
      await rm(journal.discard, { recursive: true, force: true })
      await rm(journalPath)
      return
    }
    if (!packageStateHasDigest(backupState, journal.beforePackageDigest))
      throw new Error("Uncommitted expert squad mutation journal has no exact prior revision backup")
    if (!(targetState.kind === "absent" || packageStateHasDigest(targetState, journal.afterPackageDigest)))
      throw new Error("Uncommitted expert squad mutation journal target has an unknown revision")
    if (!packageStateIsDisposable(discardState, journal.afterPackageDigest))
      throw new Error("Uncommitted expert squad mutation journal discard has an unknown revision")
    if (packageStateHasDigest(targetState, journal.afterPackageDigest)) {
      if (discardState.kind !== "absent") await rm(journal.discard, { recursive: true, force: true })
      await rename(journal.target, journal.discard)
    }
    await rename(journal.backup, journal.target)
    await rm(journal.staging, { recursive: true, force: true })
    await rm(journal.discard, { recursive: true, force: true })
    await rm(journalPath)
    await ExpertSquadRegistry.invalidateAvailable()
  }

  async function packageRootByID(
    projectDirectory: string,
    id: string,
    installationScope: ExpertSquadPackageLocations.InstallationScope,
  ) {
    const entries = await ExpertSquadRegistry.discoverInstalledPackageIdentities(projectDirectory)
    const entry = entries.find((candidate) => candidate.id === id && candidate.location === installationScope)
    if (!entry) throw new Error(`Expert squad package does not exist: ${id}`)
    return entry.root
  }

  function assertNoCrossNamespaceDuplicate(input: {
    id: string
    target: string
    existing: { targetRoot: string } | undefined
  }) {
    if (!input.existing) return
    if (Filesystem.normalizePath(input.existing.targetRoot) === Filesystem.normalizePath(input.target)) return
    throw new Error(
      `Expert squad package id "${input.id}" already exists at ${input.existing.targetRoot}; manifest id is unique across namespaces.`,
    )
  }

  async function installationExistingPackage(input: {
    projectDirectory: string
    targetLocation: ExpertSquadPackageLocations.Location
    id: string
    target: string
  }): Promise<
    | {
        namespace: string
        id: string
        version: string | null
        targetRoot: string
      }
    | undefined
  > {
    const identities = await ExpertSquadRegistry.discoverInstalledPackageIdentities(input.projectDirectory, {
      reconcileEvolutionMutations: false,
    })
    const existing = identities.find(
      (identity) => identity.id === input.id && identity.location === input.targetLocation.kind,
    )
    if (!existing) return
    return {
      namespace: existing.namespace,
      id: existing.id,
      version: existing.version,
      targetRoot: existing.root,
    }
  }

  function assertInside(parent: string, child: string, context: string) {
    if (!Filesystem.contains(parent, child)) throw new Error(`${context}: path escapes expert squad package directory`)
  }

  function assertInsideLocation(input: {
    locations: readonly ExpertSquadPackageLocations.Location[]
    child: string
    context: string
  }) {
    if (input.locations.some((location) => Filesystem.contains(location.packagesRoot, input.child))) return
    throw new Error(`${input.context}: path escapes expert squad package directories`)
  }

  function assertNoBuiltInCollision(id: string) {
    if (getLoadedBuiltInPackages().some((pkg) => pkg.id === id)) {
      throw new Error(`Expert squad package id ${JSON.stringify(id)} collides with a built-in expert squad id`)
    }
  }

  function assertSourceNotRuntimeInternal(projectDirectory: string, sourceDirectory: string) {
    const projectRoot = Filesystem.resolve(projectDirectory)
    const source = Filesystem.resolve(sourceDirectory)
    if (Filesystem.contains(projectRoot, source)) {
      const relativePath = path.relative(projectRoot, source).replace(/\\/g, "/")
      if (ProjectRuntimePaths.isInternalRuntimeRelativePath(relativePath)) {
        throw new Error(`Expert squad source directory is inside OpenCorvus runtime storage: ${relativePath}`)
      }
    }
    for (const location of ExpertSquadPackageLocations.discover(projectDirectory)) {
      if (
        Filesystem.contains(location.packagesRoot, source) ||
        Filesystem.contains(scratchBaseForLocation(location), source)
      ) {
        throw new Error(`Expert squad source directory is inside OpenCorvus runtime storage: ${source}`)
      }
    }
  }

  function normalizeArchivePath(value: string) {
    return normalizePackageRelativePath(value, "archive")
  }

  function normalizePayloadPath(value: string) {
    return normalizePackageRelativePath(value, "payload")
  }

  function normalizePackageRelativePath(value: string, source: "archive" | "payload") {
    const slashNormalized = value.replace(/\\/g, "/")
    if (slashNormalized.startsWith("/") || /^[a-zA-Z]:/.test(slashNormalized)) {
      throw new Error(`Refusing absolute expert squad ${source} path: ${value}`)
    }
    if (slashNormalized.includes(":")) throw new Error(`Refusing unsafe expert squad ${source} path: ${value}`)
    const normalized = slashNormalized.replace(/^\.\//, "")
    const segments = normalized.split("/").filter(Boolean)
    if (segments.length === 0) throw new Error(`Invalid empty expert squad ${source} path: ${value}`)
    if (segments.some((segment) => segment === "." || segment === "..")) {
      throw new Error(`Refusing unsafe expert squad ${source} path: ${value}`)
    }
    return segments.join("/")
  }

  function stripSingleRoot(files: NormalizedArchiveFile[]): NormalizedArchiveFile[] {
    if (files.some((file) => file.path === ExpertSquadRegistry.MANIFEST)) return files
    const root = singleArchiveRoot(files)
    const stripped = stripArchiveRoot(files, root)
    if (stripped.some((file) => file.path === ExpertSquadRegistry.MANIFEST)) {
      throw new Error(
        `Expert squad archive wrapper "${root}" is not supported; expected root manifest or <namespace>/<id>`,
      )
    }

    const id = singleArchiveRoot(stripped)
    const canonical = stripArchiveRoot(stripped, id)
    if (!canonical.some((file) => file.path === ExpertSquadRegistry.MANIFEST)) {
      throw new Error(`Expert squad archive wrapper "${root}/${id}" does not contain ${ExpertSquadRegistry.MANIFEST}`)
    }
    assertCanonicalArchiveWrapper(canonical, root, id)
    return canonical
  }

  function singleArchiveRoot(files: NormalizedArchiveFile[]) {
    const roots = new Set(files.map((file) => file.path.split("/")[0]!))
    if (roots.size !== 1) {
      throw new Error(
        `Expert squad archive must contain ${ExpertSquadRegistry.MANIFEST} at root or inside <namespace>/<id>`,
      )
    }
    return Array.from(roots)[0]!
  }

  function stripArchiveRoot(files: NormalizedArchiveFile[], root: string): NormalizedArchiveFile[] {
    return files.map((file) => ({
      ...file,
      path: file.path.slice(root.length + 1),
    }))
  }

  function assertCanonicalArchiveWrapper(files: NormalizedArchiveFile[], namespace: string, id: string) {
    const manifestFile = files.find((file) => file.path === ExpertSquadRegistry.MANIFEST)
    if (!manifestFile)
      throw new Error(
        `Expert squad archive wrapper "${namespace}/${id}" does not contain ${ExpertSquadRegistry.MANIFEST}`,
      )

    const errors: ParseError[] = []
    const manifest = parseJsonc(new TextDecoder().decode(manifestFile.bytes), errors, { allowTrailingComma: true })
    if (errors.length > 0) {
      const error = errors[0]!
      throw new Error(
        `Expert squad archive manifest parse error at offset ${error.offset}: ${printParseErrorCode(error.error)}`,
      )
    }
    if (manifest?.namespace !== namespace || manifest?.id !== id) {
      throw new Error(
        `Expert squad archive wrapper "${namespace}/${id}" must match manifest namespace/id "${manifest?.namespace}/${manifest?.id}"`,
      )
    }
  }

  function assertArchiveByteLimit(label: string, value: number, limit: number) {
    if (value > limit) throw new Error(`${label} exceeds expert squad archive limit: ${value} bytes > ${limit} bytes`)
  }

  class LimitedUint8ArrayWriter extends Writer<Uint8Array> {
    private chunks: Uint8Array[] = []
    private byteCount = 0

    constructor(private limits: { label: string; limit: number }[]) {
      super()
    }

    override async init(size?: number) {
      await super.init?.(size)
      if (typeof size !== "number") return
      for (const limit of this.limits) assertArchiveByteLimit(limit.label, size, limit.limit)
    }

    override async writeUint8Array(array: Uint8Array) {
      const nextByteCount = this.byteCount + array.byteLength
      for (const limit of this.limits) assertArchiveByteLimit(limit.label, nextByteCount, limit.limit)
      this.chunks.push(Uint8Array.from(array))
      this.byteCount = nextByteCount
    }

    override async getData() {
      const result = new Uint8Array(this.byteCount)
      let offset = 0
      for (const chunk of this.chunks) {
        result.set(chunk, offset)
        offset += chunk.byteLength
      }
      return result
    }
  }

  async function readArchiveFiles(input: ImportArchiveInput): Promise<NormalizedArchiveFile[]> {
    if (input.archiveBase64.length > archiveImportLimits.base64Characters) {
      throw new Error(
        `Expert squad archive base64 payload exceeds limit: ${input.archiveBase64.length} characters > ${archiveImportLimits.base64Characters} characters`,
      )
    }
    const archive = Uint8Array.from(Buffer.from(input.archiveBase64, "base64"))
    assertArchiveByteLimit("Expert squad archive", archive.byteLength, archiveImportLimits.archiveBytes)
    const reader = new ZipReader(new Uint8ArrayReader(archive))
    try {
      const entries = await reader.getEntries()
      if (entries.length > archiveImportLimits.entries) {
        throw new Error(
          `Expert squad archive entry count exceeds limit: ${entries.length} > ${archiveImportLimits.entries}`,
        )
      }
      const files: NormalizedArchiveFile[] = []
      const seen = new Set<string>()
      let declaredUnpackedBytes = 0
      let actualUnpackedBytes = 0
      for (const entry of entries) {
        if (entry.directory) continue
        const relativePath = normalizeArchivePath(entry.filename)
        const collisionKey = relativePath.toLowerCase()
        if (seen.has(collisionKey))
          throw new Error(`Duplicate expert squad archive path after normalization: ${relativePath}`)
        seen.add(collisionKey)
        assertArchiveByteLimit(
          `Expert squad archive file ${relativePath}`,
          entry.uncompressedSize,
          archiveImportLimits.fileBytes,
        )
        declaredUnpackedBytes += entry.uncompressedSize
        assertArchiveByteLimit(
          "Expert squad archive declared unpacked content",
          declaredUnpackedBytes,
          archiveImportLimits.totalUnpackedBytes,
        )
        const data = await entry.getData?.(
          new LimitedUint8ArrayWriter([
            { label: `Expert squad archive file ${relativePath}`, limit: archiveImportLimits.fileBytes },
            {
              label: "Expert squad archive unpacked content",
              limit: archiveImportLimits.totalUnpackedBytes - actualUnpackedBytes,
            },
          ]),
        )
        if (!data) continue
        assertArchiveByteLimit(
          `Expert squad archive file ${relativePath}`,
          data.byteLength,
          archiveImportLimits.fileBytes,
        )
        actualUnpackedBytes += data.byteLength
        assertArchiveByteLimit(
          "Expert squad archive unpacked content",
          actualUnpackedBytes,
          archiveImportLimits.totalUnpackedBytes,
        )
        files.push({
          path: relativePath,
          bytes: data,
        })
      }
      if (files.length === 0) throw new Error(`No files found in ${input.filename ?? "expert squad archive"}`)
      return validateArchiveFiles(stripSingleRoot(files))
    } finally {
      await reader.close()
    }
  }

  function validateArchiveFiles(files: NormalizedArchiveFile[]) {
    const fileKeys = new Set<string>()
    const dirKeys = new Set<string>()
    for (const file of files) {
      if (!file.path) throw new Error("Expert squad archive wrapper contains a file at the package root name")
      const segments = file.path.split("/")
      const fileKey = file.path.toLowerCase()
      if (fileKeys.has(fileKey))
        throw new Error(`Duplicate expert squad archive path after normalization: ${file.path}`)
      if (dirKeys.has(fileKey)) throw new Error(`Expert squad archive file/directory collision: ${file.path}`)
      for (let index = 1; index < segments.length; index++) {
        const dirKey = segments.slice(0, index).join("/").toLowerCase()
        if (fileKeys.has(dirKey)) throw new Error(`Expert squad archive file/directory collision: ${file.path}`)
        dirKeys.add(dirKey)
      }
      fileKeys.add(fileKey)
    }
    return files
  }

  async function writeArchiveFiles(sourceRoot: string, files: NormalizedArchiveFile[]) {
    for (const file of files) {
      const target = path.join(sourceRoot, ...file.path.split("/"))
      assertInside(sourceRoot, target, file.path)
      await Filesystem.write(target, file.bytes)
    }
  }

  async function loadImportableSourceDirectory(input: ValidateDirectoryInput) {
    assertSourceNotRuntimeInternal(input.projectDirectory, input.sourceDirectory)
    const source = Filesystem.resolve(input.sourceDirectory)
    const loaded = await ExpertSquadRegistry.loadSourcePackage(source)
    assertNoBuiltInCollision(loaded.id)
    return loaded
  }

  export async function validateDirectory(input: ValidateDirectoryInput): Promise<ExpertSquadRegistry.Manifest> {
    return (await loadImportableSourceDirectory(input)).manifest
  }

  function installedRevision(input: {
    projectDirectory: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    loaded: ExpertSquadRegistry.LoadedPackage
    targetRoot: string
  }): InstalledPackageRevision {
    return {
      installationScope: input.installationScope,
      projectDirectory: input.installationScope === "project" ? Filesystem.resolve(input.projectDirectory) : null,
      namespace: input.loaded.namespace,
      id: input.loaded.id,
      version: input.loaded.version,
      packageDigest: input.loaded.packageDigest,
      targetRoot: input.targetRoot,
    }
  }

  function mutationConflict(input: {
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    expectedCurrentPackageDigest: string | null
    actualCurrentPackageDigest: string | null
  }) {
    return new ExpertSquadPackageMutationConflictError({
      message: `Expert squad ${input.id} ${input.installationScope} installation digest is ${input.actualCurrentPackageDigest ?? "absent"}, expected ${input.expectedCurrentPackageDigest ?? "absent"}`,
      ...input,
    })
  }

  async function publishLoadedSourceDirectory(input: {
    projectDirectory: string
    sourceDirectory: string
    loaded: ExpertSquadRegistry.LoadedPackage
    expectedCurrentPackageDigest?: string
    allowUnchangedSameBytes?: boolean
    replacementOperation?: "replaced" | "restored"
    targetLocation: ExpertSquadPackageLocations.Location
    generation?: ExpertSquadGenerationMetadata
    durableReceipt?: DurableMutationReceipt
  }): Promise<PackageMutationReceipt> {
    const source = Filesystem.resolve(input.sourceDirectory)
    const loaded = input.loaded
    const targetLocation = input.targetLocation
    const target = targetRootForLocation(targetLocation, loaded.namespace, loaded.id)
    return ExpertSquadInstallLock.run(loaded.id, async () => {
      await reconcilePackageReplacementJournal({
        location: targetLocation,
        id: loaded.id,
      })
      if (input.durableReceipt)
        await reconcileEvolutionMutationJournal({
          location: targetLocation,
          id: loaded.id,
        })
      const existingIdentity = await installationExistingPackage({
        projectDirectory: input.projectDirectory,
        targetLocation,
        id: loaded.id,
        target,
      })
      assertNoCrossNamespaceDuplicate({ id: loaded.id, target, existing: existingIdentity })
      const base = targetLocation.packagesRoot
      const scratch = scratchBaseForLocation(targetLocation)
      const installLabel = `${loaded.namespace}-${loaded.id}`
      const operationID = randomUUID()
      const staging = stagingRootForLocation(targetLocation, installLabel, operationID)
      const backup = backupRootForLocation(targetLocation, installLabel, operationID)
      const discard = discardRootForLocation(targetLocation, installLabel, operationID)
      const targetState = await lstat(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (targetState?.isSymbolicLink()) throw new Error(`Expert squad target is a symbolic link: ${target}`)
      if (targetState && !targetState.isDirectory()) {
        throw new Error(`Expert squad target exists and is not a directory: ${target}`)
      }
      const existing = !!targetState
      const beforeLoaded = existing ? await ExpertSquadRegistry.loadPackage(target) : undefined
      const before = beforeLoaded
        ? installedRevision({
            projectDirectory: input.projectDirectory,
            installationScope: targetLocation.kind,
            loaded: beforeLoaded,
            targetRoot: target,
          })
        : null

      if (
        existing &&
        input.expectedCurrentPackageDigest !== undefined &&
        input.expectedCurrentPackageDigest !== before?.packageDigest
      ) {
        throw mutationConflict({
          id: loaded.id,
          installationScope: targetLocation.kind,
          expectedCurrentPackageDigest: input.expectedCurrentPackageDigest ?? null,
          actualCurrentPackageDigest: before?.packageDigest ?? null,
        })
      }
      if (!existing && input.expectedCurrentPackageDigest !== undefined) {
        throw mutationConflict({
          id: loaded.id,
          installationScope: targetLocation.kind,
          expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
          actualCurrentPackageDigest: null,
        })
      }
      if (existing && input.allowUnchangedSameBytes && before?.packageDigest === loaded.packageDigest) {
        return { operation: "unchanged", before, after: before }
      }
      if (existing && !input.replacementOperation) {
        throw mutationConflict({
          id: loaded.id,
          installationScope: targetLocation.kind,
          expectedCurrentPackageDigest: null,
          actualCurrentPackageDigest: before!.packageDigest,
        })
      }

      await mkdir(base, { recursive: true })
      await mkdir(scratch, { recursive: true })
      assertInside(scratch, staging, "expert squad staging root")
      assertInside(scratch, backup, "expert squad replacement backup")
      assertInside(scratch, discard, "expert squad replacement discard")
      assertInside(base, target, "expert squad target root")
      await mkdir(path.dirname(target), { recursive: true })
      await rm(staging, { recursive: true, force: true })
      await rm(backup, { recursive: true, force: true })
      await rm(discard, { recursive: true, force: true })

      let targetMoved = false
      let targetInstalled = false
      let committedReceipt: PackageMutationReceipt | undefined
      let completedReceipt: PackageMutationReceipt | undefined
      let mutationJournal: EvolutionMutationJournal | undefined
      const journalPath = evolutionMutationJournalPath(targetLocation, loaded.id)
      let replacementJournal: PackageReplacementJournal | undefined
      let replacementJournalWritten = false
      const replacementJournalFile = packageReplacementJournalPath(targetLocation, loaded.id)
      try {
        await cp(source, staging, {
          recursive: true,
          force: false,
          errorOnExist: true,
          verbatimSymlinks: true,
        })
        if (input.generation) await writeExpertSquadInstallationMetadata(staging, input.generation)
        // The source package above has already passed the complete Registry
        // validation, including tool compilation. Recompiling from `staging`
        // before publication leaves Bun build file handles on that temporary
        // tree on Windows and makes the following atomic rename fail with
        // Error: operation not permitted (EPERM). Verify the copied bytes and canonical identity without
        // compiling staging-path tools; the final-path load below performs the
        // complete installed-package validation.
        const staged = await ExpertSquadRegistry.loadCatalogPackage(staging, { canonicalFolder: false })
        if (staged.id !== loaded.id) {
          throw new Error(`Expert squad package id changed during import: expected ${loaded.id}, got ${staged.id}`)
        }
        if (staged.namespace !== loaded.namespace) {
          throw new Error(
            `Expert squad package namespace changed during import: expected ${loaded.namespace}, got ${staged.namespace}`,
          )
        }
        if (staged.packageDigest !== loaded.packageDigest) {
          throw new Error(
            `Expert squad package bytes changed during import: expected ${loaded.packageDigest}, got ${staged.packageDigest}`,
          )
        }

        if (input.durableReceipt) {
          if (!before) throw new Error("Durable expert squad evolution mutation requires an installed prior revision")
          const journal: EvolutionMutationJournal = {
            protocol: "opencorvus/expert-squad-evolution-mutation-intent@1",
            operationID,
            identity: input.durableReceipt.identity,
            target,
            staging,
            backup,
            discard,
            installationScope: targetLocation.kind,
            projectDirectory: before.projectDirectory,
            namespace: loaded.namespace,
            id: loaded.id,
            managerOperation: input.replacementOperation!,
            beforePackageDigest: before.packageDigest,
            afterPackageDigest: loaded.packageDigest,
          }
          await writeMutationJournal(journalPath, journal)
          mutationJournal = journal
        } else if (existing) {
          if (!before) throw new Error("Expert squad replacement requires an exact installed prior revision")
          replacementJournal = {
            protocol: "opencorvus/expert-squad-package-replacement-intent@1",
            operationID,
            target,
            staging,
            backup,
            discard,
            installationScope: targetLocation.kind,
            projectDirectory: before.projectDirectory,
            namespace: loaded.namespace,
            id: loaded.id,
            beforePackageDigest: before.packageDigest,
            afterPackageDigest: loaded.packageDigest,
          }
          await writeMutationJournal(replacementJournalFile, replacementJournal)
          replacementJournalWritten = true
        }

        if (existing) {
          await rename(target, backup)
          targetMoved = true
          await packageMutationAfterTargetMoveInterruptForTest?.()
        }
        await rename(staging, target)
        targetInstalled = true
        const installed = await ExpertSquadRegistry.loadPackage(target)
        await ExpertSquadRegistry.invalidateAvailable()
        const after = installedRevision({
          projectDirectory: input.projectDirectory,
          installationScope: targetLocation.kind,
          loaded: installed,
          targetRoot: target,
        })
        const receipt: PackageMutationReceipt = !before
          ? { operation: "installed", before: null, after }
          : { operation: input.replacementOperation!, before, after }
        completedReceipt = receipt
        await packageMutationAfterTargetInstallInterruptForTest?.()
        await evolutionMutationInterruptForTest?.()
        if (input.durableReceipt) {
          await input.durableReceipt.commit(receipt)
          if (!mutationJournal || !committedEvolutionReceipt(mutationJournal))
            throw new Error("Expert squad evolution mutation receipt was not durably committed")
          committedReceipt = receipt
        }
        await rm(backup, { recursive: true, force: true })
        if (replacementJournal) await packageMutationAfterBackupRemovalFailureForTest?.()
        if (input.durableReceipt) await rm(journalPath)
        if (replacementJournal) await rm(replacementJournalFile)
        return receipt
      } catch (error) {
        if (
          error instanceof EvolutionMutationAbruptTerminationForTest ||
          error instanceof PackageMutationAbruptTerminationForTest
        ) {
          throw error
        }
        if (input.durableReceipt && mutationJournal) {
          let durableReceipt
          try {
            durableReceipt = committedEvolutionReceipt(mutationJournal)
          } catch (readError) {
            throw new AggregateError(
              [error, readError],
              "Expert squad mutation receipt outcome is unavailable; journaled target is preserved",
            )
          }
          if (durableReceipt) {
            committedReceipt ??= durableReceipt.manager_receipt
            if (!committedReceipt) throw new Error("Committed expert squad mutation has no exact Manager receipt")
            try {
              await reconcileEvolutionMutationJournal({
                location: targetLocation,
                id: loaded.id,
              })
            } catch (cleanupError) {
              if (!(cleanupError instanceof EvolutionMutationCleanupPendingError)) throw cleanupError
              log.error("Committed expert squad mutation cleanup remains journaled", {
                error: cleanupError,
                journalPath,
                receiptIdentity: input.durableReceipt.identity,
              })
            }
            return committedReceipt
          }
          try {
            await reconcileEvolutionMutationJournal({
              location: targetLocation,
              id: loaded.id,
            })
          } catch (recoveryError) {
            throw new AggregateError(
              [error, recoveryError],
              "Expert squad evolution mutation rollback remains journaled for recovery",
              { cause: error },
            )
          }
          throw error
        }
        if (replacementJournalWritten) {
          let disposition: "none" | "rolled-back" | "committed"
          try {
            disposition = await reconcilePackageReplacementJournal({
              location: targetLocation,
              id: loaded.id,
            })
          } catch (recoveryError) {
            throw new AggregateError(
              [error, recoveryError],
              "Expert squad package replacement outcome remains journaled for recovery",
              { cause: error },
            )
          }
          if (disposition === "committed") {
            if (!completedReceipt)
              throw new Error("Committed expert squad package replacement has no exact Manager receipt")
            return completedReceipt
          }
          if (disposition === "rolled-back") throw error
          throw new AggregateError([error], "Expert squad package replacement journal disappeared before recovery", {
            cause: error,
          })
        }
        const cleanupActions: Array<() => Promise<void>> = [() => rm(staging, { recursive: true, force: true })]
        if (targetMoved) {
          cleanupActions.push(async () => {
            await rm(target, { recursive: true, force: true })
            await rename(backup, target)
          })
        } else if (targetInstalled) {
          cleanupActions.push(() => rm(target, { recursive: true, force: true }))
        }
        if (targetMoved || targetInstalled) cleanupActions.push(() => ExpertSquadRegistry.invalidateAvailable())
        return await ExpertSquadCleanup.rethrowWithFailures(
          error,
          ExpertSquadCleanup.packageInstallationFailureMessage,
          cleanupActions,
        )
      }
    })
  }

  async function installSourceDirectory(input: ImportDirectoryInput & { allowUnchangedSameBytes?: boolean }) {
    const loaded = await loadImportableSourceDirectory(input)
    return publishLoadedSourceDirectory({
      projectDirectory: input.projectDirectory,
      sourceDirectory: input.sourceDirectory,
      loaded,
      expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      allowUnchangedSameBytes: input.allowUnchangedSameBytes ?? true,
      replacementOperation: input.expectedCurrentPackageDigest === undefined ? undefined : "replaced",
      targetLocation: ExpertSquadPackageLocations.resolve(input.installationScope, input.projectDirectory),
      generation: input.generation,
    })
  }

  export async function importDirectory(input: ImportDirectoryInput): Promise<PackageMutationReceipt> {
    return installSourceDirectory(input)
  }

  export async function importArchive(input: ImportArchiveInput): Promise<PackageMutationReceipt> {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-archive-")
    return ExpertSquadCleanup.run(
      async () => {
        await writeArchiveFiles(sourceRoot, await readArchiveFiles(input))
        if (input.expectedNamespace || input.expectedID || input.expectedVersion || input.expectedPackageDigest) {
          const loaded = await ExpertSquadRegistry.loadSourcePackage(sourceRoot)
          if (input.expectedNamespace && loaded.namespace !== input.expectedNamespace) {
            throw new Error(
              `Expert squad update namespace mismatch: expected ${input.expectedNamespace}, received ${loaded.namespace}`,
            )
          }
          if (input.expectedID && loaded.id !== input.expectedID) {
            throw new Error(
              `Expert squad update identity mismatch: expected ${input.expectedID}, received ${loaded.id}`,
            )
          }
          if (input.expectedVersion && loaded.version !== input.expectedVersion) {
            throw new Error(
              `Expert squad update version mismatch: expected ${input.expectedVersion}, received ${loaded.version}`,
            )
          }
          if (input.expectedPackageDigest && loaded.packageDigest !== input.expectedPackageDigest) {
            throw new Error(
              `Expert squad package digest mismatch: expected ${input.expectedPackageDigest}, received ${loaded.packageDigest}`,
            )
          }
        }
        return await installSourceDirectory({
          projectDirectory: input.projectDirectory,
          sourceDirectory: sourceRoot,
          installationScope: input.installationScope,
          expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        })
      },
      () => rm(sourceRoot, { recursive: true, force: true }),
      ExpertSquadCleanup.archiveImportFailureMessage,
    )
  }

  export function validatePayloadPackageSource(source: ExpertSquadRegistry.EmbeddedPackageSource) {
    const loaded = ExpertSquadRegistry.loadEmbeddedPackage(source)
    for (const relativePath of Object.keys(source.files)) normalizePayloadPath(relativePath)
    return loaded
  }

  async function writePayloadPackageSource(sourceRoot: string, source: (typeof payloadPackageSources)[number]) {
    validatePayloadPackageSource(source)
    for (const [relativePath, content] of Object.entries(source.files)) {
      const normalizedPath = normalizePayloadPath(relativePath)
      const target = path.join(sourceRoot, ...normalizedPath.split("/"))
      assertInside(sourceRoot, target, "expert squad payload file")
      await Filesystem.write(target, ExpertSquadRegistry.embeddedPackageFileBytes(content))
    }
  }

  async function installPayloadPackageSource(input: {
    projectDirectory: string
    source: (typeof payloadPackageSources)[number]
    loaded: ExpertSquadRegistry.EmbeddedPackage
    installationScope: ExpertSquadPackageLocations.InstallationScope
    expectedCurrentPackageDigest?: string
  }): Promise<PackageMutationReceipt> {
    const sourceRoot = await Global.createTemporaryDirectory("expert-squad-payload-")
    try {
      await writePayloadPackageSource(sourceRoot, input.source)
      return await installSourceDirectory({
        projectDirectory: input.projectDirectory,
        sourceDirectory: sourceRoot,
        installationScope: input.installationScope,
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
        allowUnchangedSameBytes: true,
      })
    } finally {
      await rm(sourceRoot, { recursive: true, force: true })
    }
  }

  export async function releasePayloadPackages(input: { projectDirectory: string }): Promise<ReleasePayloadResult> {
    const installed: PackageMutationReceipt[] = []
    const skipped: PackageMutationReceipt[] = []

    for (const source of payloadPackageSources) {
      const loaded = validatePayloadPackageSource(source)
      const receipt = await installPayloadPackageSource({
        projectDirectory: input.projectDirectory,
        source,
        loaded,
        installationScope: "project",
      })
      if (receipt.operation === "installed") installed.push(receipt)
      else skipped.push(receipt)
    }

    return { installed, skipped }
  }

  function payloadCapabilityCounts(loaded: ExpertSquadRegistry.EmbeddedPackageDeclaration) {
    const skills = new Set<string>()
    const tools = new Set<string>()
    const mcp = new Set<string>()
    const projections: ExpertSquadRegistry.Projection[] = [
      loaded.manifest.capability_projection.scheduler,
      ...Object.values(loaded.manifest.capability_projection.agents),
    ]
    for (const projection of projections) {
      for (const ref of [...projection.default_skill_refs, ...projection.package_skill_refs]) skills.add(ref)
      for (const ref of [
        ...projection.built_in_tool_ids,
        ...projection.default_tool_refs,
        ...projection.package_tool_refs,
      ]) {
        tools.add(ref)
      }
      for (const ref of [
        ...projection.default_mcp_server_refs,
        ...projection.package_mcp_server_refs,
        ...projection.default_mcp_tool_refs,
        ...projection.package_mcp_tool_refs,
        ...projection.default_mcp_prompt_refs,
        ...projection.package_mcp_prompt_refs,
        ...projection.default_mcp_resource_refs,
        ...projection.package_mcp_resource_refs,
      ]) {
        mcp.add(ref)
      }
    }
    return { skillCount: skills.size, toolCount: tools.size, mcpCount: mcp.size }
  }

  type MarketExistingPackage = {
    installationScope: ExpertSquadPackageLocations.InstallationScope
    installedVersion: string | null
    installedPackageDigest: string
  }

  async function marketInstallationScopes(projectDirectory: string) {
    const scopes = new Map<string, ExpertSquadPackageLocations.InstallationScope[]>()
    const inventory = await ExpertSquadRegistry.discoverAvailable(projectDirectory)
    for (const declaration of inventory.installations) {
      if (!declaration.installationScope) continue
      const current = scopes.get(declaration.id) ?? []
      current.push(declaration.installationScope)
      scopes.set(declaration.id, current)
    }
    const scopeOrder: Record<ExpertSquadPackageLocations.InstallationScope, number> = { project: 0, global: 1 }
    for (const current of scopes.values()) current.sort((left, right) => scopeOrder[left] - scopeOrder[right])
    return scopes
  }

  const payloadMarketDeclarations = payloadPackageSources.map((source) =>
    ExpertSquadRegistry.loadEmbeddedCatalogDeclaration(source),
  )
  const MARKET_SKILL_SEARCH_LIMIT = 8_000
  const MARKET_PROMPT_SEARCH_LIMIT = 14_000

  function payloadSourceText(file: (typeof payloadPackageSources)[number]["files"][string]): string {
    if (typeof file === "string") return file
    if (!file) return ""
    return file.encoding === "utf8" ? file.content : Buffer.from(file.content, "base64").toString("utf8")
  }

  function boundedPayloadSearchText(
    source: (typeof payloadPackageSources)[number],
    matches: (relativePath: string) => boolean,
    limit: number,
    perFileLimit: number,
  ): string {
    let remaining = limit
    const selected: string[] = []
    for (const relativePath of Object.keys(source.files).sort()) {
      if (!matches(relativePath) || remaining <= 0) continue
      const text = payloadSourceText(source.files[relativePath]).trim()
      if (!text) continue
      const excerpt = text.slice(0, Math.min(remaining, perFileLimit))
      selected.push(`${relativePath}\n${excerpt}`)
      remaining -= excerpt.length
    }
    return selected.join("\n")
  }

  const payloadMarketPackageSearchFields = new Map(
    payloadPackageSources.map((source) => [
      `${source.namespace}/${source.id}`,
      {
        skills: boundedPayloadSearchText(
          source,
          (relativePath) => /^skills\/.+\/SKILL\.md$/u.test(relativePath),
          MARKET_SKILL_SEARCH_LIMIT,
          2_000,
        ),
        prompts: boundedPayloadSearchText(
          source,
          (relativePath) => /^agents\/.+\/system\.md$/u.test(relativePath),
          MARKET_PROMPT_SEARCH_LIMIT,
          1_200,
        ),
      },
    ]),
  )
  const payloadMarketSnapshotCache = new Map<
    string,
    {
      generation: number
      snapshot: Promise<{
        revision: string
        installationScopes: Map<string, ExpertSquadPackageLocations.InstallationScope[]>
        ranked: Map<string, typeof payloadMarketDeclarations>
      }>
    }
  >()

  async function payloadMarketSnapshot(projectDirectory: string) {
    const key = path.resolve(projectDirectory)
    const generation = ExpertSquadRegistry.catalogInventoryGeneration()
    const active = payloadMarketSnapshotCache.get(key)
    if (active?.generation === generation) return active.snapshot
    const snapshot = (async () => {
      const installationScopes = await marketInstallationScopes(projectDirectory)
      const revision = createHash("sha256")
        .update(
          JSON.stringify({
            declarations: payloadMarketDeclarations.map(({ manifest: _manifest, ...entry }) => entry),
            installation_scopes: [...installationScopes.entries()].sort(([left], [right]) => left.localeCompare(right)),
          }),
        )
        .digest("hex")
      return { revision, installationScopes, ranked: new Map<string, typeof payloadMarketDeclarations>() }
    })()
    payloadMarketSnapshotCache.delete(key)
    payloadMarketSnapshotCache.set(key, { generation, snapshot })
    if (payloadMarketSnapshotCache.size > 64) {
      payloadMarketSnapshotCache.delete(payloadMarketSnapshotCache.keys().next().value!)
    }
    try {
      return await snapshot
    } catch (error) {
      if (payloadMarketSnapshotCache.get(key)?.snapshot === snapshot) payloadMarketSnapshotCache.delete(key)
      throw error
    }
  }

  export async function payloadMarketPage(input: {
    projectDirectory: string
    query?: string
    availability?: PayloadMarketAvailability
    cursor?: string
    limit?: number
  }): Promise<PayloadMarketPage> {
    const snapshot = await payloadMarketSnapshot(input.projectDirectory)
    const query = input.query?.trim() ?? ""
    const availability = input.availability ?? "all"
    const queryFingerprint = createHash("sha256")
      .update(JSON.stringify({ query: query.toLowerCase(), availability }))
      .digest("hex")
    let ranked = snapshot.ranked.get(queryFingerprint)
    if (!ranked) {
      ranked = payloadMarketDeclarations
        .filter((entry) => {
          const installed = (snapshot.installationScopes.get(entry.id)?.length ?? 0) > 0
          if (availability === "available") return !installed
          if (availability === "installed") return installed
          return true
        })
        .flatMap((entry) => {
          if (!query) return [{ entry, score: null as number | null }]
          const packageFields = payloadMarketPackageSearchFields.get(`${entry.namespace}/${entry.id}`)
          const score = scoreDiscoveryFields(query, [
            { text: entry.id, weight: 1 },
            { text: entry.name, weight: 1 },
            { text: entry.label, weight: 0.96 },
            { text: entry.description ?? "", weight: 0.9 },
            { text: entry.manifest.selector.summary, weight: 0.82 },
            { text: entry.manifest.selector.selection_guidance, weight: 0.72 },
            { text: packageFields?.skills ?? "", weight: 0.84 },
            { text: packageFields?.prompts ?? "", weight: 0.76 },
          ])
          return score === undefined ? [] : [{ entry, score }]
        })
        .sort((left, right) => {
          if (left.score !== right.score) {
            if (left.score === null) return -1
            if (right.score === null) return 1
            return right.score - left.score
          }
          return left.entry.id.localeCompare(right.entry.id)
        })
        .map(({ entry }) => entry)
    }
    snapshot.ranked.set(queryFingerprint, ranked)
    if (snapshot.ranked.size > 128) snapshot.ranked.delete(snapshot.ranked.keys().next().value!)
    let offset = 0
    if (input.cursor) {
      const parsed = z
        .object({ revision: z.string(), query_fingerprint: z.string(), offset: z.number().int().nonnegative() })
        .strict()
        .parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")))
      if (parsed.revision !== snapshot.revision) throw new Error("Expert Squad market cursor is stale.")
      if (parsed.query_fingerprint !== queryFingerprint) {
        throw new Error("Expert Squad market cursor belongs to a different bounded query.")
      }
      offset = parsed.offset
    }
    const limit = z
      .number()
      .int()
      .min(1)
      .max(20)
      .parse(input.limit ?? 20)
    const page = ranked.slice(offset, offset + limit)
    const nextOffset = offset + page.length
    return {
      catalogRevision: snapshot.revision,
      entries: page.map((entry) => ({
        namespace: entry.namespace,
        id: entry.id,
        name: entry.name.slice(0, 160),
        label: entry.label.slice(0, 160),
        ...(entry.description?.length ? { description: entry.description.slice(0, 1_000) } : {}),
        version: entry.version.slice(0, 80),
        installationScopes: snapshot.installationScopes.get(entry.id) ?? [],
      })),
      nextCursor:
        nextOffset < ranked.length
          ? Buffer.from(
              JSON.stringify({
                revision: snapshot.revision,
                query_fingerprint: queryFingerprint,
                offset: nextOffset,
              }),
              "utf8",
            ).toString("base64url")
          : null,
      totalCount: ranked.length,
    }
  }

  export async function payloadMarketDetail(input: {
    projectDirectory: string
    id: string
  }): Promise<PayloadMarketItem | undefined> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad market package id")
    const source = payloadPackageSources.find((candidate) => candidate.id === id)
    if (!source) return undefined
    const loaded = ExpertSquadRegistry.loadEmbeddedPackageDeclaration(source)
    const installations = (
      await Promise.all(
        (["project", "global"] as const).map(async (scope): Promise<MarketExistingPackage | undefined> => {
          const installed = await ExpertSquadRegistry.loadInstalledCatalogPackage({
            projectDirectory: input.projectDirectory,
            installationScope: scope,
            namespace: loaded.namespace,
            id: loaded.id,
          })
          return installed
            ? {
                installationScope: scope,
                installedVersion: installed.version,
                installedPackageDigest: installed.packageDigest,
              }
            : undefined
        }),
      )
    )
      .filter((item): item is MarketExistingPackage => item !== undefined)
      .map((item) => ({
        installationScope: item.installationScope,
        installedVersion: item.installedVersion,
        installedPackageDigest: item.installedPackageDigest,
        updateAvailable:
          item.installedVersion !== loaded.version || item.installedPackageDigest !== loaded.packageDigest,
      }))
    return {
      namespace: loaded.namespace,
      id: loaded.id,
      name: loaded.name,
      label: loaded.label,
      description: loaded.description,
      version: loaded.version,
      packageDigest: loaded.packageDigest,
      selectorSummary: loaded.selector.summary,
      agents: Object.entries(loaded.manifest.capability_projection.agents).map(([agentID, projection]) => ({
        id: agentID,
        label: projection.label,
        description: projection.description,
        baseRole: projection.base_role,
      })),
      ...payloadCapabilityCounts(loaded),
      installations,
    } satisfies PayloadMarketItem
  }

  export async function payloadMarket(input: { projectDirectory: string }): Promise<PayloadMarketItem[]> {
    const items = await Promise.all(
      payloadPackageSources.map((source) =>
        payloadMarketDetail({ projectDirectory: input.projectDirectory, id: source.id }),
      ),
    )
    return items.filter((item): item is PayloadMarketItem => item !== undefined)
  }

  export async function installPayloadPackage(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
  }): Promise<InstallPayloadResult> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad market package id")
    const source = payloadPackageSources.find((candidate) => candidate.id === id)
    if (!source) throw new Error(`Expert squad market package not found: ${id}`)
    return installPayloadPackageSource({
      projectDirectory: input.projectDirectory,
      source,
      loaded: validatePayloadPackageSource(source),
      installationScope: input.installationScope,
    })
  }

  export async function updatePackage(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    source: PackageUpdateClient.Source
    expectedCurrentPackageDigest: string
  }): Promise<UpdateResult> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad update id")
    if (input.source === "builtin") {
      const source = payloadPackageSources.find((candidate) => candidate.id === id)
      if (!source) throw new Error(`Built-in expert squad update not found: ${id}`)
      const loaded = validatePayloadPackageSource(source)
      const receipt = await installPayloadPackageSource({
        projectDirectory: input.projectDirectory,
        source,
        loaded,
        installationScope: input.installationScope,
        expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      })
      return { receipt, source: input.source }
    }

    const archive = await PackageUpdateClient.fetchArchive({ kind: "expert_squad", identity: id })
    const result = await importArchive({
      projectDirectory: input.projectDirectory,
      archiveBase64: Buffer.from(archive.bytes).toString("base64"),
      filename: `${id}.zip`,
      installationScope: input.installationScope,
      expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      expectedID: id,
      expectedVersion: archive.version,
    })
    return { receipt: result, source: input.source }
  }

  export async function restorePackageRevisionWithReceipt(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    expectedCurrentPackageDigest: string
    restorePackageDigest: string
    durableReceipt: DurableMutationReceipt
  }): Promise<PackageMutationReceipt> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad restoration id")
    const restore = await ExpertSquadRegistry.loadPackageRevisionSnapshot(input.restorePackageDigest)
    if (restore.id !== id) {
      throw new Error(`Expert squad restoration identity mismatch: expected ${id}, snapshot contains ${restore.id}`)
    }
    assertNoBuiltInCollision(restore.id)
    return publishLoadedSourceDirectory({
      projectDirectory: input.projectDirectory,
      sourceDirectory: restore.root,
      loaded: restore,
      expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      replacementOperation: "restored",
      durableReceipt: input.durableReceipt,
      targetLocation: ExpertSquadPackageLocations.resolve(input.installationScope, input.projectDirectory),
    })
  }

  export async function promotePackageRevision(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    expectedCurrentPackageDigest: string
    promotePackageDigest: string
    durableReceipt: DurableMutationReceipt
  }): Promise<PackageMutationReceipt> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad promotion id")
    const candidate = await ExpertSquadRegistry.loadPackageRevisionSnapshot(input.promotePackageDigest)
    if (candidate.id !== id) {
      throw new Error(`Expert squad promotion identity mismatch: expected ${id}, snapshot contains ${candidate.id}`)
    }
    assertNoBuiltInCollision(candidate.id)
    return publishLoadedSourceDirectory({
      projectDirectory: input.projectDirectory,
      sourceDirectory: candidate.root,
      loaded: candidate,
      expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
      replacementOperation: "replaced",
      durableReceipt: input.durableReceipt,
      targetLocation: ExpertSquadPackageLocations.resolve(input.installationScope, input.projectDirectory),
    })
  }

  export async function reconcileCommittedPackageMutation(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
  }) {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad mutation reconciliation id")
    const location = ExpertSquadPackageLocations.resolve(input.installationScope, input.projectDirectory)
    await ExpertSquadInstallLock.run(id, () => reconcileEvolutionMutationJournal({ location, id }))
  }

  async function reconcilePendingLocations(locations: readonly ExpertSquadPackageLocations.Location[]) {
    for (const location of locations) {
      const scratch = scratchBaseForLocation(location)
      const entries = await readdir(scratch, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return []
        throw error
      })
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue
        const file = path.join(scratch, entry.name)
        if (entry.name.startsWith(".evolution-mutation-")) {
          const journal = EvolutionMutationJournalSchema.parse(JSON.parse(await readFile(file, "utf8")))
          if (
            Filesystem.normalizePath(file) !==
            Filesystem.normalizePath(evolutionMutationJournalPath(location, journal.id))
          )
            throw new Error(`Expert squad mutation journal filename does not equal its manifest ID: ${file}`)
          await ExpertSquadInstallLock.run(journal.id, () =>
            reconcileEvolutionMutationJournal({ location, id: journal.id }),
          )
          continue
        }
        if (entry.name.startsWith(".package-replacement-")) {
          const journal = PackageReplacementJournalSchema.parse(JSON.parse(await readFile(file, "utf8")))
          if (
            Filesystem.normalizePath(file) !==
            Filesystem.normalizePath(packageReplacementJournalPath(location, journal.id))
          )
            throw new Error(`Expert squad replacement journal filename does not equal its manifest ID: ${file}`)
          await ExpertSquadInstallLock.run(journal.id, () =>
            reconcilePackageReplacementJournal({ location, id: journal.id }),
          )
        }
      }
    }
  }

  export function reconcilePendingPackageMutations(projectDirectory: string) {
    return reconcilePendingLocations(ExpertSquadPackageLocations.discover(projectDirectory))
  }

  export function reconcilePendingGlobalPackageMutations() {
    return reconcilePendingLocations([ExpertSquadPackageLocations.global()])
  }

  export async function reconcilePendingPackageMutationUnderLease(input: {
    projectDirectory: string
    id: string
    lease: ExpertSquadInstallLock.Lease
  }) {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad mutation reconciliation id")
    ExpertSquadInstallLock.assertHeld(input.lease, id)
    for (const location of ExpertSquadPackageLocations.discover(input.projectDirectory)) {
      await reconcilePackageReplacementJournal({ location, id })
      await reconcileEvolutionMutationJournal({ location, id })
    }
  }

  export async function uninstallPackage<T>(input: {
    projectDirectory: string
    id: string
    installationScope: ExpertSquadPackageLocations.InstallationScope
    beforeRemove: () => Promise<T>
  }): Promise<UninstallResult & { beforeRemove: T }> {
    const id = ExpertSquadRegistry.parseID(input.id, "expert squad uninstall id")
    return await ExpertSquadInstallLock.run(id, async (lease) => {
      await reconcilePendingPackageMutationUnderLease({
        projectDirectory: input.projectDirectory,
        id,
        lease,
      })
      const identities = await ExpertSquadRegistry.discoverInstalledPackageIdentities(input.projectDirectory, {
        reconcileEvolutionMutations: false,
      })
      const identity = identities.find(
        (candidate) => candidate.id === id && candidate.location === input.installationScope,
      )
      if (!identity) throw new Error(`Expert squad package ${id} is not installed in ${input.installationScope} scope`)
      const expectedRoot = targetRootForLocation(
        ExpertSquadPackageLocations.resolve(input.installationScope, input.projectDirectory),
        identity.namespace,
        identity.id,
      )
      if (Filesystem.normalizePath(identity.root) !== Filesystem.normalizePath(expectedRoot)) {
        throw new Error(`Expert squad uninstall target does not match its canonical location: ${identity.root}`)
      }
      const state = await lstat(identity.root)
      if (state.isSymbolicLink() || !state.isDirectory()) {
        throw new Error(`Expert squad uninstall target is not a canonical directory: ${identity.root}`)
      }
      await ExpertSquadRegistry.loadPackage(identity.root)
      const beforeRemove = await input.beforeRemove()
      await rm(identity.root, { recursive: true })
      await ExpertSquadRegistry.invalidateAvailable()
      return {
        namespace: identity.namespace,
        id: identity.id,
        targetRoot: identity.root,
        installationScope: input.installationScope,
        beforeRemove,
      }
    })
  }

  async function collectPackageFiles(root: string) {
    const files: string[] = []
    async function walk(current: string) {
      const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) =>
        ExpertSquadArchive.compareUTF8(a.name, b.name),
      )
      for (const entry of entries) {
        if (entry.isSymbolicLink()) throw new Error(`Expert squad package export rejects symbolic link: ${entry.name}`)
        if (ExpertSquadRegistry.isRuntimeInternalEntry(entry.name, entry.isDirectory())) {
          continue
        }
        const child = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(child)
          continue
        }
        if (!entry.isFile()) continue
        const relativePath = path.relative(root, child)
        if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
          throw new Error(`Expert squad package export path escapes package root: ${child}`)
        }
        files.push(relativePath)
      }
    }
    await walk(root)
    return files
  }

  export async function exportArchive(input: ExportInput): Promise<ExportResult> {
    const id = ExpertSquadRegistry.parseID(input.id, "export id")
    const root = await packageRootByID(input.projectDirectory, id, input.installationScope)
    assertInsideLocation({
      locations: ExpertSquadPackageLocations.discover(input.projectDirectory),
      child: root,
      context: "expert squad export root",
    })
    const loaded = await ExpertSquadRegistry.loadPackage(root)
    const files = (await collectPackageFiles(root)).sort((left, right) =>
      ExpertSquadArchive.compareUTF8(left.replace(/\\/g, "/"), right.replace(/\\/g, "/")),
    )
    return ExpertSquadArchive.create({
      namespace: loaded.namespace,
      id: loaded.id,
      version: loaded.version,
      packageDigest: loaded.packageDigest,
      files: await Promise.all(
        files.map(async (file) => ({
          path: file.split(path.sep).join("/"),
          bytes: new Uint8Array(await Filesystem.readArrayBuffer(path.join(root, file))),
        })),
      ),
    })
  }
}
