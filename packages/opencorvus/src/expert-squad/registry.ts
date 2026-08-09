import { DynamicAgentIDSchema } from "@/agent/dynamic-agent-id"
import { RuntimeTemplateID, type RuntimeTemplateID as RuntimeTemplateIDValue } from "@/agent/runtime-template-id"
import { PackageToolBundle } from "@/expert-squad/package-tool-bundle"
import { McpConfigSchema } from "@/config/mcp-schema"
import { Filesystem } from "@/util/filesystem"
import { Global } from "@/global"
import type { Skill } from "@/skill"
import { DefaultSkillRefSchema } from "@/skill/default-skill-ref"
import { ExpertSquadIDSchema, ExpertSquadNamespaceSchema } from "@/expert-squad/id"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import {
  EXPERT_SQUAD_INSTALLATION_METADATA_FILE,
  readExpertSquadInstallationMetadata,
  type ExpertSquadGenerationMetadata,
} from "@/expert-squad/installation-metadata"
import { ExpertSquadVersionSchema } from "@/expert-squad/version"
import { ProjectInstanceContext } from "@/project/instance-context"
import { createInstanceState } from "@/project/instance-state"
import {
  type ExpertSquadAgentProjection,
  type ExpertSquadSchedulerProjection,
  type ExpertSquadVirtualWorkflow,
  type ExpertSquadVirtualWorkflows,
} from "@/expert-squad/protocol-schema"
import {
  ExpertSquadManifestV1Schema,
  type ExpertSquadManifestV1,
  validateExpertSquadManifestDispatchTopology,
} from "@opencorvus-ai/sdk/expert-squad-authoring"
import { defaultToolNameFromRef } from "@/expert-squad/provider-names"
import { createHash } from "node:crypto"
import { isUtf8 } from "node:buffer"
import type { Dirent } from "fs"
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "fs/promises"
import { parseFrontmatter } from "@/util/frontmatter"
import { parse as parseJsonc, type ParseError, printParseErrorCode } from "jsonc-parser"
import path from "path"
import z from "zod"

export namespace ExpertSquadRegistry {
  export const DIRECTORY = ExpertSquadPackageLocations.DIRECTORY
  export const MANIFEST = "expert-squad.jsonc"

  const TOP_LEVEL_FILES = new Set([MANIFEST, "README.md", "selector.md"])
  const TOP_LEVEL_DIRECTORIES = new Set(["agents", "skills", "tools", "mcp", "lib", "assets"])
  const RUNTIME_INTERNAL_ENTRIES = new Set([
    ".opencorvus",
    ".r",
    "runtime",
    "worktrees",
    EXPERT_SQUAD_INSTALLATION_METADATA_FILE,
  ])
  const PACKAGE_SKILL_ABI = "opencorvus.expert-squad.package-skill.v1"
  const PACKAGE_MCP_DECLARATION_ABI = "opencorvus.expert-squad.package-mcp-remote-declaration.v1"
  const PACKAGE_TREE_DIGEST_ABI = "opencorvus.expert-squad.package-tree.v1"
  const PACKAGE_SNAPSHOT_ABI = "v1"

  const ID = ExpertSquadIDSchema
  const Namespace = ExpertSquadNamespaceSchema
  const InstalledIdentity = z.object({ namespace: Namespace, id: ID }).passthrough()
  const Ref = z.string().min(1)
  const RefSegment = z
    .string()
    .min(1)
    .regex(/^[^/\\]+$/, "canonical ref segments cannot contain / or \\")
  function uniqueRefList(field: string) {
    return z.array(Ref).superRefine((refs, context) => {
      const seen = new Set<string>()
      for (const [index, ref] of refs.entries()) {
        if (seen.has(ref)) {
          context.addIssue({ code: "custom", path: [index], message: `${field} repeats ${ref}` })
        }
        seen.add(ref)
      }
    })
  }

  export const ManifestSchema = ExpertSquadManifestV1Schema

  export type Manifest = ExpertSquadManifestV1

  export function displayName(manifest: Pick<Manifest, "name" | "label">): string {
    return manifest.name ?? manifest.label
  }
  export type SchedulerProjection = ExpertSquadSchedulerProjection
  export type AgentProjection = ExpertSquadAgentProjection
  export type Projection = SchedulerProjection | AgentProjection
  export type VirtualWorkflow = ExpertSquadVirtualWorkflow
  export type VirtualWorkflows = ExpertSquadVirtualWorkflows

  export function parseID(value: string, context = "expert squad id") {
    const parsed = ID.safeParse(value)
    if (!parsed.success) throw new Error(`${context}: invalid expert squad id "${value}"`)
    return parsed.data
  }

  export function isRuntimeInternalEntry(name: string, isDirectory: boolean) {
    return name === ".opencorvus-meta.json" || (isDirectory && RUNTIME_INTERNAL_ENTRIES.has(name))
  }

  export interface SelectorMetadata {
    readonly ref: string
    readonly id: string
    readonly label: string
    readonly description?: string
    readonly summary: string
    readonly selection_guidance: string
  }

  export interface PackageCatalogEntry {
    readonly namespace: string
    readonly id: string
    readonly name: string
    readonly root: string
    readonly manifestPath: string
    readonly readmePath: string
    readonly label: string
    readonly description?: string
    readonly version: string
    readonly selector: SelectorMetadata
    readonly installationScope?: ExpertSquadPackageLocations.InstallationScope
    readonly generation?: ExpertSquadGenerationMetadata
  }

  export interface InstalledPackageIdentity {
    readonly namespace: string
    readonly id: string
    readonly version: string | null
    readonly root: string
    readonly manifestPath: string
    readonly location: ExpertSquadPackageLocations.Location["kind"]
  }

  export const InstalledPackageKeySchema = z
    .object({
      scope: ExpertSquadPackageLocations.InstallationScopeSchema,
      namespace: Namespace,
      id: ID,
      root: z.string(),
    })
    .strict()
  export type InstalledPackageKey = z.output<typeof InstalledPackageKeySchema>

  export const ResolvedPackageRevisionSchema = InstalledPackageKeySchema.extend({
    version: ExpertSquadVersionSchema,
    package_digest: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict()
  export type ResolvedPackageRevision = z.output<typeof ResolvedPackageRevisionSchema>

  export const DiscoveryWarning = z
    .object({
      code: z.literal("project_overrides_global"),
      severity: z.literal("warning"),
      logical_id: ID,
      effective: ResolvedPackageRevisionSchema,
      shadowed: ResolvedPackageRevisionSchema,
    })
    .strict()
  export type DiscoveryWarning = z.output<typeof DiscoveryWarning>

  export const DiscoveryIssue = z
    .object({
      phase: z.enum(["location.scan", "namespace.scan", "package.identity", "package.catalog", "identity.duplicate"]),
      location: z.string(),
      namespace: z.string().optional(),
      id: z.string().optional(),
      message: z.string(),
    })
    .strict()
  export type DiscoveryIssue = z.infer<typeof DiscoveryIssue>

  export interface DiscoveryResult<T> {
    readonly items: T[]
    readonly issues: DiscoveryIssue[]
  }

  export interface EffectiveDiscoveryResult<T> extends DiscoveryResult<T> {
    readonly installations: T[]
    readonly warnings: DiscoveryWarning[]
  }

  export interface PackageLocation extends PackageCatalogEntry {
    readonly readmeContent: string
  }

  export type Immutable<T> = T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer Item)[]
      ? readonly Immutable<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: Immutable<T[Key]> }
        : T

  export interface PackageSkillSnapshot {
    readonly domain: typeof PACKAGE_SKILL_ABI
    readonly ref: string
    readonly source: string
    readonly sha256: string
    readonly files: readonly {
      readonly path: string
      readonly bytes: number
      readonly sha256: string
    }[]
  }

  export interface PreparedPackageSkill {
    readonly snapshot: PackageSkillSnapshot
    readonly definition: Immutable<Skill.PackageDefinition>
    readonly content: string
    readonly bundle: {
      readonly skill: string
      readonly files: Readonly<Record<string, Skill.BundleFile>>
    }
  }

  export function validatePackageSkillClosurePaths(ref: string, paths: readonly string[]) {
    const fileKeys = new Set<string>()
    const directoryKeys = new Set<string>()
    for (const relativePath of paths) {
      assertSafeManifestRelativePath(relativePath, `Package skill ${ref}`)
      const segments = relativePath.split("/")
      if (relativePath !== "SKILL.md" && segments.at(-1)?.toLowerCase() === "skill.md") {
        throw new Error(`Package skill ${ref}: nested SKILL.md ${JSON.stringify(relativePath)} is not allowed`)
      }
      const fileKey = relativePath.toLowerCase()
      if (fileKeys.has(fileKey)) {
        throw new Error(`Package skill ${ref}: duplicate path after case normalization ${JSON.stringify(relativePath)}`)
      }
      if (directoryKeys.has(fileKey)) {
        throw new Error(
          `Package skill ${ref}: file/directory collision after case normalization ${JSON.stringify(relativePath)}`,
        )
      }
      for (let index = 1; index < segments.length; index++) {
        const directoryKey = segments.slice(0, index).join("/").toLowerCase()
        if (fileKeys.has(directoryKey)) {
          throw new Error(
            `Package skill ${ref}: file/directory collision after case normalization ${JSON.stringify(relativePath)}`,
          )
        }
        directoryKeys.add(directoryKey)
      }
      fileKeys.add(fileKey)
    }
  }

  export interface PackageMcpDeclarationSnapshot {
    readonly domain: typeof PACKAGE_MCP_DECLARATION_ABI
    readonly ref: string
    readonly source: string
    readonly sha256: string
  }

  export interface PreparedPackageMcpDeclaration {
    readonly snapshot: PackageMcpDeclarationSnapshot
    readonly definition: Immutable<McpDefinition>
  }

  export interface PreparedPackageMcpCapability {
    readonly ref: string
    readonly kind: "tool" | "prompt" | "resource"
    readonly name: string
    readonly declaration: PreparedPackageMcpDeclaration
  }

  export interface LoadedPackage extends PackageLocation {
    readonly packageDigest: string
    readonly manifest: Manifest
    readonly selectorInstructions: string
    readonly promptProfile: {
      readonly label: string
      readonly description?: string
      readonly agents: Readonly<Record<string, string>>
    }
    readonly packageSkills: ReadonlyMap<string, Immutable<PreparedPackageSkill>>
    readonly packageToolBundles: ReadonlyMap<string, Immutable<PackageToolBundle.Prepared>>
    readonly packageMcpDeclarations: ReadonlyMap<string, Immutable<PreparedPackageMcpDeclaration>>
    readonly packageMcpTools: ReadonlyMap<string, Immutable<PreparedPackageMcpCapability>>
    readonly packageMcpPrompts: ReadonlyMap<string, Immutable<PreparedPackageMcpCapability>>
    readonly packageMcpResources: ReadonlyMap<string, Immutable<PreparedPackageMcpCapability>>
  }

  export interface CatalogPackage extends PackageLocation {
    readonly packageDigest: string
    readonly manifest: Manifest
    readonly selectorInstructions: string
  }

  export interface EmbeddedPackageSource {
    namespace: string
    id: string
    files: Record<string, Skill.BundleFile>
  }

  export interface EmbeddedPackageDeclaration {
    namespace: string
    id: string
    name: string
    label: string
    description?: string
    version: string
    packageDigest: string
    selector: SelectorMetadata
    manifest: Manifest
    readmeContent: string
    selectorInstructions: string
  }

  export interface EmbeddedPackage extends EmbeddedPackageDeclaration {
    packageDigest: string
    promptProfile: {
      label: string
      description?: string
      agents: Record<string, string>
    }
  }

  /**
   * Computes the canonical content digest for an embedded expert squad package
   * over its in-memory file map, mirroring the on-disk `packageDigest(root)`
   * tree algorithm (same ABI prefix and per-file framing) so built-in packages
   * carry a real 64-hex digest like every external package.
   */
  function embeddedPackageDigest(source: EmbeddedPackageSource): string {
    const relativePaths = Object.keys(source.files).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    const digest = createHash("sha256")
    digest.update(PACKAGE_TREE_DIGEST_ABI, "utf8")
    for (const relativePath of relativePaths) {
      const content = source.files[relativePath]!
      const bytes =
        typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content.content, content.encoding)
      const relativePathBytes = Buffer.from(relativePath, "utf8")
      const pathLength = Buffer.allocUnsafe(4)
      pathLength.writeUInt32BE(relativePathBytes.byteLength)
      const byteLength = Buffer.allocUnsafe(8)
      byteLength.writeBigUInt64BE(BigInt(bytes.byteLength))
      digest.update(pathLength)
      digest.update(relativePathBytes)
      digest.update(byteLength)
      digest.update(bytes)
    }
    return digest.digest("hex")
  }

  interface ParsedPackageMetadata extends PackageLocation {
    manifest: Manifest
  }

  function parseJsoncText(text: string, source: string): unknown {
    const errors: ParseError[] = []
    const parsed = parseJsonc(text, errors, { allowTrailingComma: true })
    if (errors.length) {
      const details = errors.map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`).join("; ")
      throw new Error(`${source}: invalid JSONC: ${details}`)
    }
    return parsed
  }

  async function readJsoncFile(file: string): Promise<unknown> {
    return parseJsoncText(await Filesystem.readText(file), file)
  }

  export function parseManifestText(text: string, source: string): Manifest {
    return ManifestSchema.parse(parseJsoncText(text, source))
  }

  function parseReadmeText(text: string, context: string): string {
    const parsed = parseFrontmatter(text)
    const content = parsed.content.trim()
    if (!content) throw new Error(`${context}: referenced file is blank`)
    return content
  }

  function assertRuntimeTemplateID(value: string, context: string): asserts value is RuntimeTemplateIDValue {
    try {
      RuntimeTemplateID.get(value)
    } catch {
      throw new Error(`${context}: unknown runtime template "${value}"`)
    }
  }

  function assertAgentID(value: string, context: string): asserts value is string {
    const parsed = DynamicAgentIDSchema.safeParse(value)
    if (!parsed.success) throw new Error(`${context}: invalid dynamic agent id "${value}"`)
  }

  export interface AgentProjectionEntry {
    agentID: string
    baseRole: RuntimeTemplateIDValue
    projection: AgentProjection
  }

  export function projectionBaseRole(projection: AgentProjection, context: string): RuntimeTemplateIDValue {
    assertRuntimeTemplateID(projection.base_role, `${context}.base_role`)
    return projection.base_role
  }

  export function agentProjectionEntries(manifest: Manifest): AgentProjectionEntry[] {
    return Object.entries(manifest.capability_projection.agents).map(([agentID, projection]) => {
      assertAgentID(agentID, `capability_projection.agents.${agentID}`)
      return {
        agentID,
        projection,
        baseRole: projectionBaseRole(projection, `capability_projection.agents.${agentID}`),
      }
    })
  }

  export function agentProjectionForID(
    manifest: Manifest,
    agentID: string,
    context = `capability_projection.agents.${agentID}`,
  ): AgentProjectionEntry | undefined {
    assertAgentID(agentID, context)
    const projection = manifest.capability_projection.agents[agentID]
    if (!projection) return undefined
    return {
      agentID,
      projection,
      baseRole: projectionBaseRole(projection, context),
    }
  }

  function validateProjectionTopology(manifest: Manifest) {
    for (const [agentID, projection] of Object.entries(manifest.capability_projection.agents)) {
      const context = `capability_projection.agents.${agentID}`
      projectionBaseRole(projection, context)
    }
    validateExpertSquadManifestDispatchTopology(manifest)
  }

  function agentPromptPath(agentID: string) {
    return `agents/${agentID}/system.md`
  }

  function assertSafeManifestRelativePath(relativePath: string, context: string) {
    const segments = relativePath.split("/")
    if (
      !relativePath ||
      relativePath !== relativePath.trim() ||
      relativePath.includes("\\") ||
      relativePath.includes(":") ||
      path.isAbsolute(relativePath) ||
      path.win32.isAbsolute(relativePath) ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error(`${context}: unsafe relative path "${relativePath}"`)
    }
  }

  function assertSelectorInstructionsPath(relativePath: string, context: string) {
    assertSafeManifestRelativePath(relativePath, context)
    if (relativePath !== "selector.md") {
      throw new Error(`${context}: selector instructions must be top-level selector.md, got "${relativePath}"`)
    }
  }

  function assertContained(root: string, candidate: string, context: string) {
    if (!Filesystem.contains(root, candidate)) throw new Error(`${context}: path escapes expert squad package root`)
  }

  function resolveManifestPath(root: string, relativePath: string, context: string): string {
    assertSafeManifestRelativePath(relativePath, context)
    const segments = relativePath.split("/")
    const resolved = path.resolve(root, ...segments)
    assertContained(root, resolved, context)
    return resolved
  }

  async function lstatIfExists(target: string) {
    return lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
  }

  async function assertFile(root: string, relativePath: string, context: string): Promise<string> {
    const resolved = resolveManifestPath(root, relativePath, context)
    const info = await lstatIfExists(resolved)
    if (info?.isSymbolicLink()) throw new Error(`${context}: symbolic links are not allowed`)
    if (!info?.isFile()) throw new Error(`${context}: referenced file does not exist`)
    const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(resolved)])
    assertContained(realRoot, realTarget, context)
    return resolved
  }

  async function assertNonBlankFile(root: string, relativePath: string, context: string): Promise<string> {
    const resolved = await assertFile(root, relativePath, context)
    const content = await Filesystem.readText(resolved)
    if (!content.trim()) throw new Error(`${context}: referenced file is blank`)
    return resolved
  }

  async function fileExists(file: string): Promise<boolean> {
    const info = await lstatIfExists(file)
    return !!info
  }

  function assertNoRuntimeInternalEntry(entry: Dirent, context: string, allowed: ReadonlySet<string> = new Set()) {
    if (isRuntimeInternalEntry(entry.name, entry.isDirectory()) && !allowed.has(entry.name)) {
      throw new Error(`${context}.${entry.name}: runtime-internal entry "${entry.name}" is not allowed`)
    }
  }

  async function readOptionalDirectoryEntries(dir: string, context: string): Promise<Dirent[]> {
    const info = await lstatIfExists(dir)
    if (!info) return []
    if (info.isSymbolicLink()) throw new Error(`${context}: symbolic links are not allowed`)
    if (!info.isDirectory()) throw new Error(`${context}: expected directory`)
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`${context}.${entry.name}: symbolic links are not allowed`)
      assertNoRuntimeInternalEntry(entry, context)
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function readRequiredDirectoryEntries(
    dir: string,
    context: string,
    allowedRuntimeInternalEntries: ReadonlySet<string> = new Set(),
  ): Promise<Dirent[]> {
    const info = await lstatIfExists(dir)
    if (info?.isSymbolicLink()) throw new Error(`${context}: symbolic links are not allowed`)
    if (!info?.isDirectory()) throw new Error(`${context}: expected directory`)
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw new Error(`${context}.${entry.name}: symbolic links are not allowed`)
      assertNoRuntimeInternalEntry(entry, context, allowedRuntimeInternalEntries)
    }
    return entries.sort((a, b) => a.name.localeCompare(b.name))
  }

  async function collectFileEntries(dir: string, context: string): Promise<string[]> {
    const entries = await readOptionalDirectoryEntries(dir, context)
    for (const entry of entries) {
      if (!entry.isFile()) throw new Error(`${context}.${entry.name}: expected file`)
    }
    return entries.map((entry) => entry.name)
  }

  async function validatePackageRoot(root: string) {
    const entries = await readRequiredDirectoryEntries(
      root,
      "expert squad package root",
      new Set([EXPERT_SQUAD_INSTALLATION_METADATA_FILE]),
    )
    const names = new Set(entries.map((entry) => entry.name))
    if (!names.has(MANIFEST)) throw new Error(`expert squad package root: missing ${MANIFEST}`)
    if (!names.has("README.md")) throw new Error("expert squad package root: missing README.md")

    for (const entry of entries) {
      if (entry.isFile() && entry.name === EXPERT_SQUAD_INSTALLATION_METADATA_FILE) {
        await readExpertSquadInstallationMetadata(root)
        continue
      }
      if (entry.isFile() && TOP_LEVEL_FILES.has(entry.name)) continue
      if (entry.isDirectory() && TOP_LEVEL_DIRECTORIES.has(entry.name)) continue
      if (RUNTIME_INTERNAL_ENTRIES.has(entry.name)) {
        throw new Error(`expert squad package root: runtime-internal entry "${entry.name}" is not allowed`)
      }
      if (TOP_LEVEL_FILES.has(entry.name)) {
        throw new Error(`expert squad package root: top-level entry "${entry.name}" must be a file`)
      }
      if (TOP_LEVEL_DIRECTORIES.has(entry.name)) {
        throw new Error(`expert squad package root: top-level entry "${entry.name}" must be a directory`)
      }
      throw new Error(`expert squad package root: unknown top-level entry "${entry.name}"`)
    }
  }

  async function validatePackageTree(root: string) {
    async function walk(current: string, context: string) {
      const isRoot = Filesystem.normalizePath(current) === Filesystem.normalizePath(root)
      for (const entry of await readRequiredDirectoryEntries(
        current,
        context,
        isRoot ? new Set([EXPERT_SQUAD_INSTALLATION_METADATA_FILE]) : new Set(),
      )) {
        if (isRoot && entry.name === EXPERT_SQUAD_INSTALLATION_METADATA_FILE) continue
        if (entry.isDirectory()) await walk(path.join(current, entry.name), `${context}.${entry.name}`)
      }
    }

    await walk(root, "expert squad package tree")
  }

  type PackageTreeSnapshot = Readonly<{
    digest: string
    files: readonly Readonly<{ relativePath: string; bytes: Buffer }>[]
  }>

  async function capturePackageTree(root: string, validateContract = true): Promise<PackageTreeSnapshot> {
    const normalizedRoot = Filesystem.normalizePath(root)
    if (validateContract) {
      await validatePackageRoot(normalizedRoot)
      await validatePackageTree(normalizedRoot)
    }
    const files: Array<{ relativePath: string; bytes: Buffer }> = []

    async function walk(current: string) {
      const isRoot = Filesystem.normalizePath(current) === normalizedRoot
      for (const entry of await readRequiredDirectoryEntries(
        current,
        "expert squad package digest",
        isRoot ? new Set([EXPERT_SQUAD_INSTALLATION_METADATA_FILE]) : new Set(),
      )) {
        if (isRoot && entry.name === EXPERT_SQUAD_INSTALLATION_METADATA_FILE) continue
        const target = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(target)
          continue
        }
        if (!entry.isFile()) {
          throw new Error(`expert squad package digest.${entry.name}: expected regular file`)
        }
        files.push({
          relativePath: path.relative(normalizedRoot, target).split(path.sep).join("/"),
          bytes: await readFile(target),
        })
      }
    }

    await walk(normalizedRoot)
    files.sort((left, right) =>
      left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0,
    )
    const digest = createHash("sha256")
    digest.update(PACKAGE_TREE_DIGEST_ABI, "utf8")
    for (const file of files) {
      const relativePath = file.relativePath
      const relativePathBytes = Buffer.from(relativePath, "utf8")
      const pathLength = Buffer.allocUnsafe(4)
      pathLength.writeUInt32BE(relativePathBytes.byteLength)
      const byteLength = Buffer.allocUnsafe(8)
      byteLength.writeBigUInt64BE(BigInt(file.bytes.byteLength))
      digest.update(pathLength)
      digest.update(relativePathBytes)
      digest.update(byteLength)
      digest.update(file.bytes)
    }
    return Object.freeze({ digest: digest.digest("hex"), files: Object.freeze(files) })
  }

  export async function packageDigest(root: string): Promise<string> {
    return (await capturePackageTree(root)).digest
  }

  /**
   * Canonical byte digest for an installed package candidate, including
   * malformed or unexpected files. This lets the control plane report exact
   * drift without treating invalid bytes as a valid package declaration.
   */
  export async function installedPackageDigest(root: string): Promise<string> {
    return (await capturePackageTree(root, false)).digest
  }

  async function materializeCapturedPackageSnapshot(
    snapshot: PackageTreeSnapshot,
  ): Promise<Readonly<{ root: string; digest: string }>> {
    const snapshotsRoot = path.join(Global.Path.data, "expert-squad-package-revisions", PACKAGE_SNAPSHOT_ABI)
    const target = path.join(snapshotsRoot, snapshot.digest)
    await mkdir(snapshotsRoot, { recursive: true })
    const existing = await lstatIfExists(target)
    if (existing) {
      if (!existing.isDirectory() || (await packageDigest(target)) !== snapshot.digest) {
        throw new Error(`expert squad immutable package snapshot is corrupt: ${target}`)
      }
      return Object.freeze({ root: target, digest: snapshot.digest })
    }

    const staging = await mkdtemp(path.join(snapshotsRoot, ".snapshot-"))
    try {
      for (const file of snapshot.files) {
        const destination = path.join(staging, ...file.relativePath.split("/"))
        await mkdir(path.dirname(destination), { recursive: true })
        await writeFile(destination, file.bytes, { flag: "wx" })
      }
      try {
        await rename(staging, target)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== "EEXIST" && code !== "ENOTEMPTY") throw error
        await rm(staging, { recursive: true, force: true })
      }
      if ((await packageDigest(target)) !== snapshot.digest) {
        throw new Error(`expert squad immutable package snapshot digest mismatch: ${target}`)
      }
      return Object.freeze({ root: target, digest: snapshot.digest })
    } catch (error) {
      await rm(staging, { recursive: true, force: true })
      throw error
    }
  }

  async function materializePackageSnapshot(sourceRoot: string): Promise<Readonly<{ root: string; digest: string }>> {
    return materializeCapturedPackageSnapshot(await capturePackageTree(sourceRoot))
  }

  export async function materializeEmbeddedPackageSnapshot(
    source: EmbeddedPackageSource,
  ): Promise<Readonly<{ root: string; digest: string }>> {
    const files = Object.entries(source.files)
      .map(([relativePath, content]) => ({
        relativePath,
        bytes:
          typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content.content, content.encoding),
      }))
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
    const digest = embeddedPackageDigest(source)
    return materializeCapturedPackageSnapshot(Object.freeze({ digest, files: Object.freeze(files) }))
  }

  function putUnique<T>(map: Map<string, T>, ref: string, value: T, context: string) {
    if (map.has(ref)) throw new Error(`${context}: duplicate package ref "${ref}"`)
    map.set(ref, value)
  }

  function assertCanonicalRefSegment(value: string, context: string) {
    if (!RefSegment.safeParse(value).success) throw new Error(`${context}: invalid canonical ref segment "${value}"`)
  }

  function relativeRefSegment(root: string, current: string, context: string): string {
    const relative = path.relative(root, current).split(path.sep).join("/")
    if (!relative || relative.startsWith("../") || relative === "..") {
      throw new Error(`${context}: SKILL.md must live inside a named skill directory`)
    }
    return relative
  }

  function packageRelativeSource(packageRoot: string, source: string, context: string): string {
    const relative = path.relative(packageRoot, source).split(path.sep).join("/")
    if (!relative || relative === ".." || relative.startsWith("../") || path.isAbsolute(relative)) {
      throw new Error(`${context}: source path escapes expert squad package root`)
    }
    return relative
  }

  function sha256(content: Uint8Array | string): string {
    return createHash("sha256").update(content).digest("hex")
  }

  function encodedBundleFile(bytes: Uint8Array): Skill.BundleFile {
    return isUtf8(bytes)
      ? Buffer.from(bytes).toString("utf8")
      : { encoding: "base64", content: Buffer.from(bytes).toString("base64") }
  }

  export function embeddedPackageFileBytes(file: Skill.BundleFile): Uint8Array {
    if (typeof file === "string") return Buffer.from(file, "utf8")
    if (file.encoding === "base64") return Buffer.from(file.content, "base64")
    return Buffer.from(file.content, "utf8")
  }

  export function embeddedPackageTextFile(file: Skill.BundleFile | undefined, context: string): string {
    if (file === undefined) throw new Error(`${context}: missing text file`)
    const bytes = embeddedPackageFileBytes(file)
    if (!isUtf8(bytes)) throw new Error(`${context}: expected UTF-8 text file`)
    return Buffer.from(bytes).toString("utf8")
  }

  function packageSkillClosureDigest(files: readonly { path: string; bytes: Uint8Array }[]) {
    const digest = createHash("sha256")
    digest.update(PACKAGE_SKILL_ABI, "utf8")
    for (const file of files) {
      const relativePath = Buffer.from(file.path, "utf8")
      const pathLength = Buffer.allocUnsafe(4)
      pathLength.writeUInt32BE(relativePath.byteLength)
      const byteLength = Buffer.allocUnsafe(8)
      byteLength.writeBigUInt64BE(BigInt(file.bytes.byteLength))
      digest.update(pathLength)
      digest.update(relativePath)
      digest.update(byteLength)
      digest.update(file.bytes)
    }
    return digest.digest("hex")
  }

  function deepFreeze<T>(value: T): Immutable<T> {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) deepFreeze(child)
      Object.freeze(value)
    }
    return value as Immutable<T>
  }

  class ImmutableMapView<Key, Value> implements ReadonlyMap<Key, Value> {
    readonly #values: Map<Key, Value>

    constructor(entries: Iterable<readonly [Key, Value]>) {
      this.#values = new Map(entries)
      Object.freeze(this)
    }

    get size() {
      return this.#values.size
    }

    get(key: Key) {
      return this.#values.get(key)
    }

    has(key: Key) {
      return this.#values.has(key)
    }

    entries() {
      return this.#values.entries()
    }

    keys() {
      return this.#values.keys()
    }

    values() {
      return this.#values.values()
    }

    [Symbol.iterator]() {
      return this.#values[Symbol.iterator]()
    }

    forEach(callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void, thisArg?: unknown) {
      for (const [key, value] of this.#values) callback.call(thisArg, value, key, this)
    }

    get [Symbol.toStringTag]() {
      return "ImmutableMap"
    }
  }

  Object.freeze(ImmutableMapView.prototype)

  function immutableMap<Value>(source: ReadonlyMap<string, Value>): ReadonlyMap<string, Immutable<Value>> {
    return new ImmutableMapView([...source].map(([ref, value]) => [ref, deepFreeze(value)] as const))
  }

  interface DiscoveredPackageTool {
    readonly ref: string
    readonly owner: string
    readonly sourcePath: string
  }

  interface CollectedPackageResources {
    skills: Map<string, PreparedPackageSkill>
    tools: Map<string, DiscoveredPackageTool>
    mcpDeclarations: Map<string, PreparedPackageMcpDeclaration>
    mcpTools: Map<string, PreparedPackageMcpCapability>
    mcpPrompts: Map<string, PreparedPackageMcpCapability>
    mcpResources: Map<string, PreparedPackageMcpCapability>
  }

  const McpCapabilities = z
    .object({
      tools: uniqueRefList("capabilities.tools").pipe(z.array(RefSegment)).optional().default([]),
      prompts: uniqueRefList("capabilities.prompts").pipe(z.array(RefSegment)).optional().default([]),
      resources: uniqueRefList("capabilities.resources").pipe(z.array(RefSegment)).optional().default([]),
    })
    .strict()
    .optional()
    .default({ tools: [], prompts: [], resources: [] })

  const PackageMcpHttpUrl = z
    .string()
    .url()
    .refine(
      (value) => URL.canParse(value) && ["http:", "https:"].includes(new URL(value).protocol),
      "Package MCP URL must use HTTP or HTTPS",
    )

  export const McpDefinition = McpConfigSchema.McpRemote.omit({ enabled: true })
    .extend({ url: PackageMcpHttpUrl, capabilities: McpCapabilities })
    .strict()
  export type McpDefinition = z.infer<typeof McpDefinition>

  export function parseMcpDefinitionText(text: string, source: string): McpDefinition {
    return McpDefinition.parse(parseJsoncText(text, source))
  }

  async function collectSkillRefs(input: {
    packageRoot: string
    root: string
    refBase: string
    resources: CollectedPackageResources
    packageSkillDefinition: z.ZodType<Skill.PackageDefinition>
    context: string
  }) {
    const rootEntries = await readOptionalDirectoryEntries(input.root, input.context)
    if (!rootEntries.length) return

    async function walk(current: string, entries: Dirent[]) {
      const skillEntry = entries.find((entry) => entry.name === "SKILL.md")
      if (skillEntry && !skillEntry.isFile()) throw new Error(`${input.context}.SKILL.md: expected file`)
      if (skillEntry) {
        const ref = `${input.refBase}/${relativeRefSegment(input.root, current, input.context)}`
        const sourcePath = path.join(current, "SKILL.md")
        const closure: { path: string; bytes: Uint8Array }[] = []
        async function collectFiles(directory: string, directoryEntries: Dirent[], prefix = "") {
          await Promise.all(
            directoryEntries.map(async (entry) => {
              const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
              const source = path.join(directory, entry.name)
              if (entry.isDirectory()) {
                await collectFiles(
                  source,
                  await readRequiredDirectoryEntries(source, `Package skill ${ref}.${relativePath}`),
                  relativePath,
                )
                return
              }
              if (!entry.isFile()) throw new Error(`Package skill ${ref}.${relativePath}: expected file`)
              closure.push({ path: relativePath, bytes: await readFile(source) })
            }),
          )
        }
        await collectFiles(current, entries)
        closure.sort((left, right) => left.path.localeCompare(right.path))
        validatePackageSkillClosurePaths(
          ref,
          closure.map((file) => file.path),
        )
        const skillFile = closure.find((file) => file.path === "SKILL.md")
        if (!skillFile) throw new Error(`Package skill ${ref}: missing SKILL.md`)
        if (!isUtf8(skillFile.bytes)) throw new Error(`Package skill ${ref}: SKILL.md must be UTF-8 text`)
        const raw = Buffer.from(skillFile.bytes).toString("utf8")
        const parsed = parseFrontmatter(raw)
        const definition = input.packageSkillDefinition.safeParse(parsed.data)
        if (!definition.success) {
          throw new Error(`Package skill ${ref}: invalid frontmatter: ${definition.error.message}`)
        }
        putUnique(
          input.resources.skills,
          ref,
          {
            snapshot: {
              domain: PACKAGE_SKILL_ABI,
              ref,
              source: packageRelativeSource(input.packageRoot, sourcePath, `Package skill ${ref}`),
              sha256: packageSkillClosureDigest(closure),
              files: closure.map((file) => ({
                path: file.path,
                bytes: file.bytes.byteLength,
                sha256: sha256(file.bytes),
              })),
            },
            definition: definition.data,
            content: parsed.content,
            bundle: {
              skill: raw,
              files: Object.fromEntries(
                closure
                  .filter((file) => file.path !== "SKILL.md")
                  .map((file) => [file.path, encodedBundleFile(file.bytes)]),
              ),
            },
          },
          input.context,
        )
        return
      }

      for (const entry of entries) {
        const child = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(child, await readRequiredDirectoryEntries(child, `${input.context}.${entry.name}`))
          continue
        }
        throw new Error(`${input.context}.${entry.name}: unexpected file outside a named skill directory`)
      }
    }

    await walk(input.root, rootEntries)
  }

  async function collectRolePackageRefs(input: {
    packageRoot: string
    roleRoot: string
    refBase: string
    owner: string
    resources: CollectedPackageResources
    packageSkillDefinition: z.ZodType<Skill.PackageDefinition>
    context: string
  }) {
    await collectSkillRefs({
      packageRoot: input.packageRoot,
      root: path.join(input.roleRoot, "skills"),
      refBase: input.refBase,
      resources: input.resources,
      packageSkillDefinition: input.packageSkillDefinition,
      context: `${input.context}.skills`,
    })
    for (const tool of await collectFileEntries(path.join(input.roleRoot, "tools"), `${input.context}.tools`)) {
      if (!/\.(?:js|ts)$/.test(tool)) throw new Error(`${input.context}.tools.${tool}: unsupported tool extension`)
      const toolID = tool.replace(/\.(?:js|ts)$/, "")
      assertCanonicalRefSegment(toolID, `${input.context}.tools.${tool}`)
      const ref = `${input.refBase}/${toolID}`
      putUnique(
        input.resources.tools,
        ref,
        { ref, owner: input.owner, sourcePath: path.join(input.roleRoot, "tools", tool) },
        `${input.context}.tools`,
      )
    }
    await collectMcpRefs({
      packageRoot: input.packageRoot,
      dir: path.join(input.roleRoot, "mcp"),
      refBase: input.refBase,
      resources: input.resources,
    })
  }

  async function collectPackageResources(
    root: string,
    manifest: Manifest,
    packageSkillDefinition: z.ZodType<Skill.PackageDefinition>,
  ) {
    const resources: CollectedPackageResources = {
      skills: new Map<string, PreparedPackageSkill>(),
      tools: new Map<string, DiscoveredPackageTool>(),
      mcpDeclarations: new Map<string, PreparedPackageMcpDeclaration>(),
      mcpTools: new Map<string, PreparedPackageMcpCapability>(),
      mcpPrompts: new Map<string, PreparedPackageMcpCapability>(),
      mcpResources: new Map<string, PreparedPackageMcpCapability>(),
    }
    const id = manifest.id

    const agentRoot = path.join(root, "agents")
    for (const agentEntry of await readOptionalDirectoryEntries(agentRoot, "agents")) {
      if (!agentEntry.isDirectory()) throw new Error(`agents.${agentEntry.name}: expected directory`)
      const agentID = agentEntry.name
      if (agentID !== "orchestrator") assertAgentID(agentID, `agents.${agentID}`)
      if (agentID !== "orchestrator" && !Object.hasOwn(manifest.capability_projection.agents, agentID)) {
        throw new Error(`agents.${agentID}: directory requires capability_projection.agents.${agentID}`)
      }
      const base = `${id}/${agentID}`
      await collectRolePackageRefs({
        packageRoot: root,
        roleRoot: path.join(agentRoot, agentID),
        refBase: base,
        owner: agentID,
        resources,
        packageSkillDefinition,
        context: `agents.${agentID}`,
      })
    }

    await collectSkillRefs({
      packageRoot: root,
      root: path.join(root, "skills"),
      refBase: `${id}/shared`,
      resources,
      packageSkillDefinition,
      context: "skills",
    })
    for (const tool of await collectFileEntries(path.join(root, "tools"), "tools")) {
      if (!/\.(?:js|ts)$/.test(tool)) throw new Error(`tools.${tool}: unsupported tool extension`)
      const toolID = tool.replace(/\.(?:js|ts)$/, "")
      assertCanonicalRefSegment(toolID, `tools.${tool}`)
      const ref = `${id}/shared/${toolID}`
      putUnique(resources.tools, ref, { ref, owner: "shared", sourcePath: path.join(root, "tools", tool) }, "tools")
    }
    await collectMcpRefs({
      packageRoot: root,
      dir: path.join(root, "mcp"),
      refBase: `${id}/shared`,
      resources,
    })

    return resources
  }

  async function collectMcpRefs(input: {
    packageRoot: string
    dir: string
    refBase: string
    resources: CollectedPackageResources
  }) {
    for (const file of await collectFileEntries(input.dir, input.dir)) {
      if (!/\.(?:json|jsonc)$/.test(file)) {
        throw new Error(`${input.dir}/${file}: unsupported MCP definition extension`)
      }
      const serverID = file.replace(/\.(?:json|jsonc)$/, "")
      assertCanonicalRefSegment(serverID, `${input.dir}/${file}`)
      const serverRef = `${input.refBase}/${serverID}`
      const sourcePath = path.join(input.dir, file)
      const bytes = await readFile(sourcePath)
      const raw = bytes.toString("utf8")
      const definition = parseMcpDefinitionText(raw, sourcePath)
      const declaration: PreparedPackageMcpDeclaration = {
        snapshot: {
          domain: PACKAGE_MCP_DECLARATION_ABI,
          ref: serverRef,
          source: packageRelativeSource(input.packageRoot, sourcePath, `Package MCP server ${serverRef}`),
          sha256: sha256(bytes),
        },
        definition,
      }
      putUnique(input.resources.mcpDeclarations, serverRef, declaration, input.dir)
      for (const tool of definition.capabilities.tools) {
        const ref = `${serverRef}/tool/${tool}`
        putUnique(input.resources.mcpTools, ref, { ref, kind: "tool", name: tool, declaration }, `${serverRef}.tools`)
      }
      for (const prompt of definition.capabilities.prompts) {
        const ref = `${serverRef}/prompt/${prompt}`
        putUnique(
          input.resources.mcpPrompts,
          ref,
          { ref, kind: "prompt", name: prompt, declaration },
          `${serverRef}.prompts`,
        )
      }
      for (const resource of definition.capabilities.resources) {
        const ref = `${serverRef}/resource/${resource}`
        putUnique(
          input.resources.mcpResources,
          ref,
          { ref, kind: "resource", name: resource, declaration },
          `${serverRef}.resources`,
        )
      }
    }
  }

  function assertDefaultRef(ref: string, kind: string, context: string) {
    const pattern = new RegExp(`^default/${kind}/[^/\\\\]+$`)
    if (!pattern.test(ref)) {
      throw new Error(`${context}: default ${kind} ref "${ref}" must match default/${kind}/<name>`)
    }
  }

  type PackageResourceIndex = ReadonlyMap<string, unknown>

  function assertPackageRef(ref: string, id: string, available: PackageResourceIndex, context: string) {
    if (!ref.startsWith(`${id}/`)) throw new Error(`${context}: package ref "${ref}" must be namespaced by ${id}`)
    if (!available.has(ref)) throw new Error(`${context}: package ref "${ref}" is not declared in this package`)
  }

  function isSharedPackageRef(ref: string, id: string) {
    return ref.startsWith(`${id}/shared/`)
  }

  function assertProjectedPackageRef(input: {
    ref: string
    id: string
    available: PackageResourceIndex
    ownerID: string
    context: string
  }) {
    const { ref, id, available, ownerID, context } = input
    assertPackageRef(ref, id, available, context)
    if (isSharedPackageRef(ref, id)) return
    if (!ref.startsWith(`${id}/${ownerID}/`)) {
      throw new Error(`${context}: package ref "${ref}" must be shared or owned by agents.${ownerID}`)
    }
  }

  function packageMcpServerRefFromTypedRef(ref: string, kind: "tool" | "prompt" | "resource", context: string) {
    const marker = `/${kind}/`
    const index = ref.lastIndexOf(marker)
    if (index < 0) throw new Error(`${context}: invalid package MCP ${kind} ref "${ref}"`)
    return ref.slice(0, index)
  }

  function assertProjectedPackageMcpTypedRef(input: {
    ref: string
    kind: "tool" | "prompt" | "resource"
    id: string
    available: PackageResourceIndex
    ownerID: string
    context: string
  }) {
    const { ref, kind, id, available, ownerID, context } = input
    assertPackageRef(ref, id, available, context)
    const serverRef = packageMcpServerRefFromTypedRef(ref, kind, context)
    if (isSharedPackageRef(serverRef, id)) return
    if (!serverRef.startsWith(`${id}/${ownerID}/`)) {
      throw new Error(`${context}: package MCP ${kind} ref "${ref}" must be shared or owned by agents.${ownerID}`)
    }
  }

  function packageMcpRefsExpandedByServers(input: {
    serverRefs: readonly string[]
    available: PackageResourceIndex
    kind: "tool" | "prompt" | "resource"
    context: string
  }) {
    const result = new Set<string>()
    for (const serverRef of input.serverRefs) {
      const prefix = `${serverRef}/${input.kind}/`
      for (const ref of input.available.keys()) {
        if (ref.startsWith(prefix)) result.add(ref)
      }
    }
    return result
  }

  function validateProjection(input: {
    id: string
    context: string
    projection: Projection
    ownerID: string
    resources: Awaited<ReturnType<typeof collectPackageResources>>
    knownBuiltInToolIDs: Set<string>
    projectableBuiltInToolIDs: Set<string>
    knownDefaultHostToolIDs: Set<string>
    projectableDefaultHostToolIDs: Set<string>
  }) {
    const {
      id,
      context,
      projection,
      ownerID,
      resources,
      knownBuiltInToolIDs,
      projectableBuiltInToolIDs,
      knownDefaultHostToolIDs,
      projectableDefaultHostToolIDs,
    } = input
    for (const toolID of projection.built_in_tool_ids) {
      if (!knownBuiltInToolIDs.has(toolID)) throw new Error(`${context}: unknown built-in tool "${toolID}"`)
      if (!projectableBuiltInToolIDs.has(toolID)) {
        throw new Error(`${context}: built-in tool "${toolID}" is not supplied by this base-role runtime template`)
      }
    }
    for (const ref of projection.default_skill_refs) {
      const parsed = DefaultSkillRefSchema.safeParse(ref)
      if (!parsed.success) {
        throw new Error(`${context}: default skill ref ${JSON.stringify(ref)} must match default/skill/<name>`)
      }
    }
    for (const ref of projection.default_tool_refs) {
      assertDefaultRef(ref, "tool", context)
      const toolID = defaultToolNameFromRef(ref)
      if (!knownDefaultHostToolIDs.has(toolID)) throw new Error(`${context}: unknown default host tool "${toolID}"`)
      if (!projectableDefaultHostToolIDs.has(toolID)) {
        throw new Error(`${context}: default host tool "${toolID}" is not supplied by this base-role runtime template`)
      }
    }
    for (const ref of projection.default_mcp_server_refs) assertDefaultRef(ref, "mcp", context)
    if (projection.default_mcp_server_refs.length > 0) {
      throw new Error(
        `${context}: default_mcp_server_refs is not supported; project default_mcp_tool_refs, default_mcp_prompt_refs, or default_mcp_resource_refs instead`,
      )
    }
    for (const ref of projection.default_mcp_tool_refs) {
      if (!/^default\/mcp\/[^/\\]+\/tool\/[^/\\]+$/.test(ref)) {
        throw new Error(`${context}: invalid default MCP tool ref "${ref}"`)
      }
    }
    for (const ref of projection.default_mcp_prompt_refs) {
      if (!/^default\/mcp\/[^/\\]+\/prompt\/[^/\\]+$/.test(ref)) {
        throw new Error(`${context}: invalid default MCP prompt ref "${ref}"`)
      }
    }
    for (const ref of projection.default_mcp_resource_refs) {
      if (!/^default\/mcp\/[^/\\]+\/resource\/[^/\\]+$/.test(ref)) {
        throw new Error(`${context}: invalid default MCP resource ref "${ref}"`)
      }
    }
    for (const ref of projection.package_skill_refs) {
      assertProjectedPackageRef({
        ref,
        id,
        available: resources.skills,
        ownerID,
        context,
      })
    }
    for (const ref of projection.package_tool_refs) {
      assertProjectedPackageRef({
        ref,
        id,
        available: resources.tools,
        ownerID,
        context,
      })
    }
    for (const ref of projection.package_mcp_server_refs) {
      assertProjectedPackageRef({
        ref,
        id,
        available: resources.mcpDeclarations,
        ownerID,
        context,
      })
    }
    const serverMountedMcpToolRefs = packageMcpRefsExpandedByServers({
      serverRefs: projection.package_mcp_server_refs,
      available: resources.mcpTools,
      kind: "tool",
      context,
    })
    const serverMountedMcpPromptRefs = packageMcpRefsExpandedByServers({
      serverRefs: projection.package_mcp_server_refs,
      available: resources.mcpPrompts,
      kind: "prompt",
      context,
    })
    const serverMountedMcpResourceRefs = packageMcpRefsExpandedByServers({
      serverRefs: projection.package_mcp_server_refs,
      available: resources.mcpResources,
      kind: "resource",
      context,
    })
    for (const ref of projection.package_mcp_tool_refs) {
      if (serverMountedMcpToolRefs.has(ref)) {
        throw new Error(`${context}: package MCP tool ref "${ref}" is already mounted by package_mcp_server_refs`)
      }
      assertProjectedPackageMcpTypedRef({
        ref,
        kind: "tool",
        id,
        available: resources.mcpTools,
        ownerID,
        context,
      })
    }
    for (const ref of projection.package_mcp_prompt_refs) {
      if (serverMountedMcpPromptRefs.has(ref)) {
        throw new Error(`${context}: package MCP prompt ref "${ref}" is already mounted by package_mcp_server_refs`)
      }
      assertProjectedPackageMcpTypedRef({
        ref,
        kind: "prompt",
        id,
        available: resources.mcpPrompts,
        ownerID,
        context,
      })
    }
    for (const ref of projection.package_mcp_resource_refs) {
      if (serverMountedMcpResourceRefs.has(ref)) {
        throw new Error(`${context}: package MCP resource ref "${ref}" is already mounted by package_mcp_server_refs`)
      }
      assertProjectedPackageMcpTypedRef({
        ref,
        kind: "resource",
        id,
        available: resources.mcpResources,
        ownerID,
        context,
      })
    }
  }

  function assertAgentLocalResourcesProjected(input: {
    id: string
    agentID: string
    context: string
    projection: Projection
    resources: Awaited<ReturnType<typeof collectPackageResources>>
  }) {
    const prefix = `${input.id}/${input.agentID}/`
    const assertSelected = (available: PackageResourceIndex, selected: ReadonlySet<string>, kind: string) => {
      for (const ref of available.keys()) {
        if (!ref.startsWith(prefix) || selected.has(ref)) continue
        throw new Error(`${input.context}: agent-local ${kind} "${ref}" is not projected`)
      }
    }

    assertSelected(input.resources.skills, new Set(input.projection.package_skill_refs), "skill")
    assertSelected(input.resources.tools, new Set(input.projection.package_tool_refs), "tool")

    const selectedServers = new Set(input.projection.package_mcp_server_refs)
    const selectedTypedRefs = new Set([
      ...input.projection.package_mcp_tool_refs,
      ...input.projection.package_mcp_prompt_refs,
      ...input.projection.package_mcp_resource_refs,
    ])
    for (const serverRef of input.resources.mcpDeclarations.keys()) {
      if (!serverRef.startsWith(prefix) || selectedServers.has(serverRef)) continue
      const typedPrefix = `${serverRef}/`
      if ([...selectedTypedRefs].some((ref) => ref.startsWith(typedPrefix))) continue
      throw new Error(`${input.context}: agent-local MCP server "${serverRef}" is not projected`)
    }
    const selectedForKind = (
      explicit: readonly string[],
      available: PackageResourceIndex,
      kind: "tool" | "prompt" | "resource",
    ) => {
      const selected = new Set(explicit)
      for (const serverRef of selectedServers) {
        for (const ref of available.keys()) {
          if (ref.startsWith(`${serverRef}/${kind}/`)) selected.add(ref)
        }
      }
      assertSelected(available, selected, `MCP ${kind}`)
    }
    selectedForKind(input.projection.package_mcp_tool_refs, input.resources.mcpTools, "tool")
    selectedForKind(input.projection.package_mcp_prompt_refs, input.resources.mcpPrompts, "prompt")
    selectedForKind(input.projection.package_mcp_resource_refs, input.resources.mcpResources, "resource")
  }

  function allProjections(manifest: Manifest): Projection[] {
    return [manifest.capability_projection.scheduler, ...Object.values(manifest.capability_projection.agents)]
  }

  function assertSharedResourcesProjected(input: {
    id: string
    manifest: Manifest
    resources: Awaited<ReturnType<typeof collectPackageResources>>
  }) {
    const selectedSkills = new Set<string>()
    const selectedTools = new Set<string>()
    const selectedServers = new Set<string>()
    const selectedMcpTools = new Set<string>()
    const selectedMcpPrompts = new Set<string>()
    const selectedMcpResources = new Set<string>()
    for (const projection of allProjections(input.manifest)) {
      for (const ref of projection.package_skill_refs) selectedSkills.add(ref)
      for (const ref of projection.package_tool_refs) selectedTools.add(ref)
      for (const ref of projection.package_mcp_server_refs) selectedServers.add(ref)
      for (const ref of projection.package_mcp_tool_refs) {
        selectedMcpTools.add(ref)
        selectedServers.add(packageMcpServerRefFromTypedRef(ref, "tool", "shared package MCP tool"))
      }
      for (const ref of projection.package_mcp_prompt_refs) {
        selectedMcpPrompts.add(ref)
        selectedServers.add(packageMcpServerRefFromTypedRef(ref, "prompt", "shared package MCP prompt"))
      }
      for (const ref of projection.package_mcp_resource_refs) {
        selectedMcpResources.add(ref)
        selectedServers.add(packageMcpServerRefFromTypedRef(ref, "resource", "shared package MCP resource"))
      }
      for (const ref of packageMcpRefsExpandedByServers({
        serverRefs: projection.package_mcp_server_refs,
        available: input.resources.mcpTools,
        kind: "tool",
        context: "shared package MCP tools",
      })) {
        selectedMcpTools.add(ref)
      }
      for (const ref of packageMcpRefsExpandedByServers({
        serverRefs: projection.package_mcp_server_refs,
        available: input.resources.mcpPrompts,
        kind: "prompt",
        context: "shared package MCP prompts",
      })) {
        selectedMcpPrompts.add(ref)
      }
      for (const ref of packageMcpRefsExpandedByServers({
        serverRefs: projection.package_mcp_server_refs,
        available: input.resources.mcpResources,
        kind: "resource",
        context: "shared package MCP resources",
      })) {
        selectedMcpResources.add(ref)
      }
    }
    const assertSelected = (available: PackageResourceIndex, selected: ReadonlySet<string>, kind: string) => {
      for (const ref of available.keys()) {
        if (!isSharedPackageRef(ref, input.id) || selected.has(ref)) continue
        throw new Error(`Shared package ${kind} "${ref}" is not projected`)
      }
    }
    assertSelected(input.resources.skills, selectedSkills, "skill")
    assertSelected(input.resources.tools, selectedTools, "tool")
    assertSelected(input.resources.mcpDeclarations, selectedServers, "MCP server")
    assertSelected(input.resources.mcpTools, selectedMcpTools, "MCP tool")
    assertSelected(input.resources.mcpPrompts, selectedMcpPrompts, "MCP prompt")
    assertSelected(input.resources.mcpResources, selectedMcpResources, "MCP resource")
  }

  async function preparePackageToolBundles(input: {
    metadata: ParsedPackageMetadata
    resources: Awaited<ReturnType<typeof collectPackageResources>>
  }): Promise<ReadonlyMap<string, PackageToolBundle.Prepared>> {
    const tools = [...input.resources.tools.values()].sort((left, right) =>
      left.ref < right.ref ? -1 : left.ref > right.ref ? 1 : 0,
    )
    const prepared = await PackageToolBundle.prepareMany(
      tools.map((tool) => ({
        packageID: input.metadata.id,
        packageRoot: input.metadata.root,
        ref: tool.ref,
        owner: tool.owner,
        sourcePath: tool.sourcePath,
      })),
    )
    return new Map(tools.map((tool, index) => [tool.ref, prepared[index]!] as const))
  }

  async function collectLibraryFiles(packageRoot: string): Promise<string[]> {
    const result: string[] = []
    const walk = async (root: string, current: string, context: string): Promise<void> => {
      for (const entry of await readOptionalDirectoryEntries(current, context)) {
        const target = path.join(current, entry.name)
        if (entry.isDirectory()) {
          await walk(root, target, `${context}.${entry.name}`)
          continue
        }
        if (!entry.isFile()) throw new Error(`${context}.${entry.name}: expected file`)
        result.push(path.relative(packageRoot, target).split(path.sep).join("/"))
      }
    }
    await walk(packageRoot, path.join(packageRoot, "lib"), "lib")
    const agentRoot = path.join(packageRoot, "agents")
    for (const agent of await readOptionalDirectoryEntries(agentRoot, "agents")) {
      if (!agent.isDirectory()) continue
      await walk(packageRoot, path.join(agentRoot, agent.name, "lib"), `agents.${agent.name}.lib`)
    }
    return result.sort((left, right) => left.localeCompare(right))
  }

  async function assertLibraryFilesReachable(
    packageRoot: string,
    bundles: ReadonlyMap<string, PackageToolBundle.Prepared>,
  ) {
    const reachable = new Set(
      [...bundles.values()].flatMap((bundle) =>
        bundle.snapshot.files
          .map((entry) => entry.path)
          .filter((relative) => relative.startsWith("lib/") || /\/lib\//.test(relative)),
      ),
    )
    for (const relative of await collectLibraryFiles(packageRoot)) {
      if (!reachable.has(relative))
        throw new Error(`${relative}: package library file is not reachable from a projected tool`)
    }
  }

  async function collectAssetFiles(packageRoot: string) {
    const assetsRoot = path.join(packageRoot, "assets")
    const result: string[] = []
    const walk = async (directory: string, context: string): Promise<void> => {
      for (const entry of await readOptionalDirectoryEntries(directory, context)) {
        const target = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          await walk(target, `${context}.${entry.name}`)
          continue
        }
        if (!entry.isFile()) throw new Error(`${context}.${entry.name}: expected file`)
        result.push(path.relative(packageRoot, target).split(path.sep).join("/"))
      }
    }
    await walk(assetsRoot, "assets")
    return result.sort((left, right) => left.localeCompare(right))
  }

  async function assertAssetFilesReachable(
    packageRoot: string,
    bundles: ReadonlyMap<string, PackageToolBundle.Prepared>,
  ) {
    const reachable = new Set(
      [...bundles.values()].flatMap((bundle) =>
        bundle.snapshot.files.map((entry) => entry.path).filter((relative) => relative.startsWith("assets/")),
      ),
    )
    for (const relative of await collectAssetFiles(packageRoot)) {
      if (!reachable.has(relative)) throw new Error(`${relative}: package asset is not reachable from a projected tool`)
    }
  }

  async function readPackageMetadata(
    root: string,
    options: { canonicalFolder: boolean },
  ): Promise<ParsedPackageMetadata> {
    const normalizedRoot = Filesystem.normalizePath(root)
    await validatePackageRoot(normalizedRoot)
    await validatePackageTree(normalizedRoot)
    const manifestPath = path.join(normalizedRoot, MANIFEST)
    const rawManifest = await readJsoncFile(manifestPath)
    const manifest = ManifestSchema.parse(rawManifest)

    const folderID = path.basename(normalizedRoot)
    const folderNamespace = path.basename(path.dirname(normalizedRoot))
    if (options.canonicalFolder && manifest.id !== folderID) {
      throw new Error(`expert squad id "${manifest.id}" must match folder "${folderID}"`)
    }
    if (options.canonicalFolder && manifest.namespace !== folderNamespace) {
      throw new Error(`expert squad namespace "${manifest.namespace}" must match folder "${folderNamespace}"`)
    }

    const readmePath = await assertFile(normalizedRoot, manifest.readme, "readme")
    const readmeContent = parseReadmeText(await Filesystem.readText(readmePath), "readme")
    return {
      id: manifest.id,
      namespace: manifest.namespace,
      root: normalizedRoot,
      manifestPath,
      readmePath,
      readmeContent,
      name: displayName(manifest),
      label: manifest.label,
      description: manifest.description,
      version: manifest.version,
      manifest,
      selector: selectorMetadata(manifest),
    }
  }

  async function readCatalogSelectorInstructions(metadata: ParsedPackageMetadata): Promise<string> {
    const instructions = metadata.manifest.selector.instructions
    assertSelectorInstructionsPath(instructions, "selector.instructions")
    const selectorPath = await assertNonBlankFile(metadata.root, instructions, "selector.instructions")
    return (await Filesystem.readText(selectorPath)).trim()
  }

  async function publicMetadata(metadata: ParsedPackageMetadata): Promise<PackageCatalogEntry> {
    const installationMetadata = await readExpertSquadInstallationMetadata(metadata.root)
    return {
      id: metadata.id,
      namespace: metadata.namespace,
      root: metadata.root,
      manifestPath: metadata.manifestPath,
      readmePath: metadata.readmePath,
      name: metadata.name,
      label: metadata.label,
      description: metadata.description,
      version: metadata.version,
      selector: metadata.selector,
      ...(installationMetadata ? { generation: installationMetadata.generation } : {}),
    }
  }

  export async function readSelectorInstructions(
    pkg: Pick<PackageCatalogEntry, "root" | "id" | "selector">,
  ): Promise<string> {
    const selectorPath = await assertNonBlankFile(pkg.root, "selector.md", "selector.instructions")
    return (await Filesystem.readText(selectorPath)).trim()
  }

  function selectorMetadata(manifest: Manifest): SelectorMetadata {
    return {
      ref: `selector/${manifest.id}`,
      id: manifest.id,
      label: manifest.label,
      description: manifest.description,
      summary: manifest.selector.summary,
      selection_guidance: manifest.selector.selection_guidance,
    }
  }

  export function loadEmbeddedPackageDeclaration(source: EmbeddedPackageSource): EmbeddedPackageDeclaration {
    const manifestText = embeddedPackageTextFile(
      source.files[MANIFEST],
      `embedded expert squad ${source.id}/${MANIFEST}`,
    )
    const manifest = parseManifestText(manifestText, `embedded expert squad ${source.id}/${MANIFEST}`)
    validatePromptProfileManifest(manifest)
    if (manifest.id !== source.id) {
      throw new Error(`embedded expert squad source id "${source.id}" does not match manifest id "${manifest.id}"`)
    }
    if (manifest.namespace !== source.namespace) {
      throw new Error(
        `embedded expert squad source namespace "${source.namespace}" does not match manifest namespace "${manifest.namespace}"`,
      )
    }
    const readmeContent = embeddedPackageTextFile(
      source.files[manifest.readme],
      `embedded expert squad ${manifest.id} ${manifest.readme}`,
    )
    const parsedReadmeContent = parseReadmeText(
      readmeContent,
      `embedded expert squad ${manifest.id} ${manifest.readme}`,
    )

    assertSelectorInstructionsPath(
      manifest.selector.instructions,
      `embedded expert squad ${manifest.id}.selector.instructions`,
    )
    const instructions = embeddedPackageTextFile(
      source.files[manifest.selector.instructions],
      `embedded expert squad ${manifest.id} selector instructions ${manifest.selector.instructions}`,
    )
    const selectorInstructions = instructions.trim()
    if (!selectorInstructions) {
      throw new Error(
        `embedded expert squad ${manifest.id}: blank selector instructions ${manifest.selector.instructions}`,
      )
    }

    return {
      id: manifest.id,
      namespace: manifest.namespace,
      name: displayName(manifest),
      label: manifest.label,
      description: manifest.description,
      version: manifest.version,
      packageDigest: embeddedPackageDigest(source),
      selector: selectorMetadata(manifest),
      manifest,
      readmeContent: parsedReadmeContent,
      selectorInstructions,
    }
  }

  export function loadEmbeddedPackage(source: EmbeddedPackageSource): EmbeddedPackage {
    const declaration = loadEmbeddedPackageDeclaration(source)
    const { manifest } = declaration

    const agents: Record<string, string> = {}
    const promptProjections: Array<readonly [string, Projection]> = [
      ["orchestrator", manifest.capability_projection.scheduler],
      ...Object.entries(manifest.capability_projection.agents),
    ]
    for (const [agentID, projection] of promptProjections) {
      if (!projection.prompt) continue
      const context = `embedded expert squad ${manifest.id}.capability_projection.${agentID === "orchestrator" ? "scheduler" : `agents.${agentID}`}.prompt`
      assertSafeManifestRelativePath(projection.prompt, context)
      const prompt = embeddedPackageTextFile(
        source.files[projection.prompt],
        `embedded expert squad ${manifest.id} prompt file ${projection.prompt}`,
      )
      const trimmed = prompt.trim()
      if (!trimmed) throw new Error(`embedded expert squad ${manifest.id}: blank prompt file ${projection.prompt}`)
      agents[agentID] = trimmed
    }

    return {
      ...declaration,
      packageDigest: declaration.packageDigest,
      promptProfile: {
        label: manifest.label,
        description: manifest.description,
        agents,
      },
    }
  }

  function validatePromptProfileManifest(manifest: Manifest) {
    validateProjectionTopology(manifest)
    const projections: Array<readonly [string, Projection, string]> = [
      ["orchestrator", manifest.capability_projection.scheduler, "capability_projection.scheduler"],
      ...Object.entries(manifest.capability_projection.agents).map(
        ([agentID, projection]) => [agentID, projection, `capability_projection.agents.${agentID}`] as const,
      ),
    ]
    for (const [agentID, projection, context] of projections) {
      if (!projection.prompt) continue
      const expected = agentPromptPath(agentID)
      if (projection.prompt !== expected) throw new Error(`${context}.prompt must be ${expected}`)
    }
  }

  function projectionForAgentDirectory(manifest: Manifest, agentID: string): Projection | undefined {
    if (agentID === "orchestrator") return manifest.capability_projection.scheduler
    return manifest.capability_projection.agents[agentID]
  }

  async function validateAgentFiles(metadata: ParsedPackageMetadata) {
    const agentRoot = path.join(metadata.root, "agents")
    for (const entry of await readOptionalDirectoryEntries(agentRoot, "agents")) {
      if (!entry.isDirectory()) throw new Error(`agents.${entry.name}: expected directory`)
      const agentID = entry.name
      if (agentID !== "orchestrator") assertAgentID(agentID, `agents.${agentID}`)
      const projection = projectionForAgentDirectory(metadata.manifest, agentID)
      if (!projection) throw new Error(`agents.${agentID}: directory requires capability_projection.agents.${agentID}`)
      const allowed = new Set(["system.md", "skills", "tools", "mcp", "lib"])
      const entries = await readRequiredDirectoryEntries(path.join(agentRoot, agentID), `agents.${agentID}`)
      for (const child of entries) {
        if (!allowed.has(child.name)) throw new Error(`agents.${agentID}.${child.name}: unexpected package entry`)
        if (child.name === "system.md" && !child.isFile()) {
          throw new Error(`agents.${agentID}.system.md: expected file`)
        }
        if (child.name !== "system.md" && !child.isDirectory()) {
          throw new Error(`agents.${agentID}.${child.name}: expected directory`)
        }
      }
      const hasPromptFile = entries.some((child) => child.name === "system.md")
      if (hasPromptFile && !projection.prompt) {
        throw new Error(`agents.${agentID}.system.md: file requires a prompt declaration on its capability projection`)
      }
    }

    const projections: Array<readonly [string, Projection, string]> = [
      ["orchestrator", metadata.manifest.capability_projection.scheduler, "capability_projection.scheduler"],
      ...Object.entries(metadata.manifest.capability_projection.agents).map(
        ([agentID, projection]) => [agentID, projection, `capability_projection.agents.${agentID}`] as const,
      ),
    ]
    for (const [, projection, context] of projections) {
      if (projection.prompt) await assertNonBlankFile(metadata.root, projection.prompt, `${context}.prompt`)
    }
  }

  async function readPromptProfile(metadata: ParsedPackageMetadata): Promise<LoadedPackage["promptProfile"]> {
    const agents: Record<string, string> = {}
    const projections: Array<readonly [string, Projection, string]> = [
      ["orchestrator", metadata.manifest.capability_projection.scheduler, "capability_projection.scheduler"],
      ...Object.entries(metadata.manifest.capability_projection.agents).map(
        ([agentID, projection]) => [agentID, projection, `capability_projection.agents.${agentID}`] as const,
      ),
    ]
    for (const [agentID, projection, context] of projections) {
      if (!projection.prompt) continue
      const file = await assertNonBlankFile(metadata.root, projection.prompt, `${context}.prompt`)
      agents[agentID] = (await Filesystem.readText(file)).trim()
    }
    return {
      label: metadata.label,
      description: metadata.description,
      agents,
    }
  }

  async function loadValidatedPackageSnapshot(
    root: string,
    canonicalFolder: boolean,
    packageRevisionDigest: string,
  ): Promise<LoadedPackage> {
    const metadata = await readPackageMetadata(root, { canonicalFolder })
    const { manifest } = metadata
    validatePromptProfileManifest(manifest)
    await validateAgentFiles(metadata)
    const selectorInstructions = await readCatalogSelectorInstructions(metadata)

    const { Skill } = await import("@/skill")
    const resources = await collectPackageResources(metadata.root, manifest, Skill.PackageDefinition)

    const { AgentToolPool } = await import("@/agent/tool-pool-contract")
    const knownBuiltInToolIDs = AgentToolPool.coreBuiltInToolIDs()
    const knownDefaultHostToolIDs = AgentToolPool.allPackageProjectableDefaultHostToolIDs()
    validateProjection({
      id: manifest.id,
      context: "capability_projection.scheduler",
      projection: manifest.capability_projection.scheduler,
      ownerID: "orchestrator",
      resources,
      knownBuiltInToolIDs,
      projectableBuiltInToolIDs: AgentToolPool.orchestratorSchedulerProjectableToolIDs(),
      knownDefaultHostToolIDs,
      projectableDefaultHostToolIDs: AgentToolPool.packageProjectableDefaultHostToolIDs("orchestrator"),
    })
    assertAgentLocalResourcesProjected({
      id: manifest.id,
      agentID: "orchestrator",
      context: "capability_projection.scheduler",
      projection: manifest.capability_projection.scheduler,
      resources,
    })
    for (const { agentID, projection } of agentProjectionEntries(manifest)) {
      const context = `capability_projection.agents.${agentID}`
      validateProjection({
        id: manifest.id,
        context,
        projection,
        ownerID: agentID,
        resources,
        knownBuiltInToolIDs,
        projectableBuiltInToolIDs: AgentToolPool.projectableRuntimeTemplateBuiltInToolIDs(
          projectionBaseRole(projection, context),
        ),
        knownDefaultHostToolIDs,
        projectableDefaultHostToolIDs: AgentToolPool.packageProjectableDefaultHostToolIDsForRuntimeTemplate(
          projectionBaseRole(projection, context),
        ),
      })
      assertAgentLocalResourcesProjected({ id: manifest.id, agentID, context, projection, resources })
    }
    assertSharedResourcesProjected({ id: manifest.id, manifest, resources })
    const packageToolBundles = await preparePackageToolBundles({ metadata, resources })
    await assertLibraryFilesReachable(metadata.root, packageToolBundles)
    await assertAssetFilesReachable(metadata.root, packageToolBundles)

    const promptProfile = await readPromptProfile(metadata)
    const loaded: LoadedPackage = {
      ...metadata,
      id: manifest.id,
      packageDigest: packageRevisionDigest,
      manifest,
      selectorInstructions,
      promptProfile,
      packageSkills: immutableMap(resources.skills),
      packageToolBundles: immutableMap(packageToolBundles),
      packageMcpDeclarations: immutableMap(resources.mcpDeclarations),
      packageMcpTools: immutableMap(resources.mcpTools),
      packageMcpPrompts: immutableMap(resources.mcpPrompts),
      packageMcpResources: immutableMap(resources.mcpResources),
    }
    deepFreeze(loaded)
    return loaded
  }

  export async function loadPackageRevisionSnapshot(packageRevisionDigest: string): Promise<LoadedPackage> {
    const digest = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(packageRevisionDigest)
    const root = path.join(Global.Path.data, "expert-squad-package-revisions", PACKAGE_SNAPSHOT_ABI, digest)
    const state = await lstatIfExists(root)
    if (!state?.isDirectory()) {
      throw new Error(`expert squad immutable package snapshot is missing: ${digest}`)
    }
    if ((await packageDigest(root)) !== digest) {
      throw new Error(`expert squad immutable package snapshot digest mismatch: ${digest}`)
    }
    return loadValidatedPackageSnapshot(root, false, digest)
  }

  async function loadValidatedPackage(root: string, canonicalFolder: boolean): Promise<LoadedPackage> {
    const normalizedSourceRoot = Filesystem.normalizePath(root)
    const snapshot = await materializePackageSnapshot(normalizedSourceRoot)
    const identity = await readPackageMetadata(snapshot.root, { canonicalFolder: false })
    if (canonicalFolder && identity.id !== path.basename(normalizedSourceRoot)) {
      throw new Error(`expert squad id "${identity.id}" must match folder "${path.basename(normalizedSourceRoot)}"`)
    }
    if (canonicalFolder && identity.namespace !== path.basename(path.dirname(normalizedSourceRoot))) {
      throw new Error(
        `expert squad namespace "${identity.namespace}" must match folder "${path.basename(path.dirname(normalizedSourceRoot))}"`,
      )
    }
    const loaded = await loadValidatedPackageSnapshot(snapshot.root, false, snapshot.digest)
    const sourced: LoadedPackage = {
      ...loaded,
      root: normalizedSourceRoot,
      manifestPath: path.join(normalizedSourceRoot, MANIFEST),
      readmePath: path.join(normalizedSourceRoot, ...loaded.manifest.readme.split("/")),
    }
    deepFreeze(sourced)
    return sourced
  }

  export async function loadPackage(root: string): Promise<LoadedPackage> {
    return loadValidatedPackage(root, true)
  }

  export async function loadSourcePackage(root: string): Promise<LoadedPackage> {
    if (await Filesystem.exists(path.join(root, EXPERT_SQUAD_INSTALLATION_METADATA_FILE))) {
      throw new Error(
        `expert squad source package cannot provide Host-owned ${EXPERT_SQUAD_INSTALLATION_METADATA_FILE}`,
      )
    }
    return loadValidatedPackage(root, false)
  }

  export async function loadCatalogPackage(
    root: string,
    options: { canonicalFolder?: boolean } = {},
  ): Promise<CatalogPackage> {
    const metadata = await readPackageMetadata(root, { canonicalFolder: options.canonicalFolder ?? true })
    validatePromptProfileManifest(metadata.manifest)
    const installationMetadata = await readExpertSquadInstallationMetadata(metadata.root)
    const loaded: CatalogPackage = {
      ...metadata,
      ...(installationMetadata ? { generation: installationMetadata.generation } : {}),
      packageDigest: await packageDigest(metadata.root),
      selectorInstructions: await readCatalogSelectorInstructions(metadata),
    }
    deepFreeze(loaded)
    return loaded
  }

  async function discoverIdentityLocation(
    location: ExpertSquadPackageLocations.Location,
  ): Promise<InstalledPackageIdentity[]> {
    const base = location.packagesRoot
    const packages: InstalledPackageIdentity[] = []
    const context = `${location.kind} OpenCorvus config expert-squads`
    for (const namespaceEntry of await readOptionalDirectoryEntries(base, context)) {
      if (!namespaceEntry.isDirectory()) {
        throw new Error(`${context}.${namespaceEntry.name}: expected namespace directory`)
      }
      const namespaceRoot = path.join(base, namespaceEntry.name)
      if (await fileExists(path.join(namespaceRoot, MANIFEST))) {
        throw new Error(
          `${context}/${namespaceEntry.name}: direct package roots are not supported; expected <namespace>/<id>`,
        )
      }
      for (const entry of await readOptionalDirectoryEntries(namespaceRoot, `${context}/${namespaceEntry.name}`)) {
        if (!entry.isDirectory()) {
          throw new Error(`Expert squad target exists and is not a directory: ${path.join(namespaceRoot, entry.name)}`)
        }
        const packageRoot = path.join(namespaceRoot, entry.name)
        const manifestPath = path.join(packageRoot, MANIFEST)
        const identity = InstalledIdentity.parse(await readJsoncFile(manifestPath))
        const version = ExpertSquadVersionSchema.safeParse(identity.version)
        if (identity.namespace !== namespaceEntry.name || identity.id !== entry.name) {
          throw new Error(
            `expert squad manifest ${manifestPath} must match canonical namespace/id ${namespaceEntry.name}/${entry.name}`,
          )
        }
        packages.push({
          namespace: identity.namespace,
          id: identity.id,
          version: version.success ? version.data : null,
          root: packageRoot,
          manifestPath,
          location: location.kind,
        })
      }
    }
    return packages
  }

  function discoveryIssue(issues: DiscoveryIssue[], input: Omit<DiscoveryIssue, "message">, error: unknown): void {
    issues.push(
      DiscoveryIssue.parse({
        ...input,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }

  async function discoverIdentityLocationAvailable(
    location: ExpertSquadPackageLocations.Location,
  ): Promise<DiscoveryResult<InstalledPackageIdentity>> {
    const base = location.packagesRoot
    const items: InstalledPackageIdentity[] = []
    const issues: DiscoveryIssue[] = []
    const context = `${location.kind} OpenCorvus config expert-squads`
    let namespaces: Dirent[]
    try {
      namespaces = await readOptionalDirectoryEntries(base, context)
    } catch (error) {
      discoveryIssue(issues, { phase: "location.scan", location: base }, error)
      return { items, issues }
    }
    for (const namespaceEntry of namespaces) {
      const namespaceRoot = path.join(base, namespaceEntry.name)
      if (!namespaceEntry.isDirectory()) {
        discoveryIssue(
          issues,
          { phase: "namespace.scan", location: namespaceRoot, namespace: namespaceEntry.name },
          new Error(`${context}.${namespaceEntry.name}: expected namespace directory`),
        )
        continue
      }
      if (await fileExists(path.join(namespaceRoot, MANIFEST))) {
        discoveryIssue(
          issues,
          { phase: "namespace.scan", location: namespaceRoot, namespace: namespaceEntry.name },
          new Error(
            `${context}/${namespaceEntry.name}: direct package roots are not supported; expected <namespace>/<id>`,
          ),
        )
        continue
      }
      let entries: Dirent[]
      try {
        entries = await readOptionalDirectoryEntries(namespaceRoot, `${context}/${namespaceEntry.name}`)
      } catch (error) {
        discoveryIssue(
          issues,
          { phase: "namespace.scan", location: namespaceRoot, namespace: namespaceEntry.name },
          error,
        )
        continue
      }
      for (const entry of entries) {
        const packageRoot = path.join(namespaceRoot, entry.name)
        if (!entry.isDirectory()) {
          discoveryIssue(
            issues,
            {
              phase: "package.identity",
              location: packageRoot,
              namespace: namespaceEntry.name,
              id: entry.name,
            },
            new Error(`Expert squad target exists and is not a directory: ${packageRoot}`),
          )
          continue
        }
        const manifestPath = path.join(packageRoot, MANIFEST)
        try {
          const identity = InstalledIdentity.parse(await readJsoncFile(manifestPath))
          const version = ExpertSquadVersionSchema.safeParse(identity.version)
          if (identity.namespace !== namespaceEntry.name || identity.id !== entry.name) {
            throw new Error(
              `expert squad manifest ${manifestPath} must match canonical namespace/id ${namespaceEntry.name}/${entry.name}`,
            )
          }
          items.push({
            namespace: identity.namespace,
            id: identity.id,
            version: version.success ? version.data : null,
            root: packageRoot,
            manifestPath,
            location: location.kind,
          })
        } catch (error) {
          discoveryIssue(
            issues,
            {
              phase: "package.identity",
              location: manifestPath,
              namespace: namespaceEntry.name,
              id: entry.name,
            },
            error,
          )
        }
      }
    }
    return { items, issues }
  }

  function uniqueAvailableIdentitiesInScope(
    discovered: DiscoveryResult<InstalledPackageIdentity>,
  ): DiscoveryResult<InstalledPackageIdentity> {
    const issues = [...discovered.issues]
    const byID = new Map<string, InstalledPackageIdentity>()
    const quarantined = new Set<string>()
    for (const identity of discovered.items) {
      if (quarantined.has(identity.id)) {
        discoveryIssue(
          issues,
          { phase: "identity.duplicate", location: identity.root, namespace: identity.namespace, id: identity.id },
          new Error(`duplicate expert squad id "${identity.id}" includes ${identity.root}`),
        )
        continue
      }
      const existing = byID.get(identity.id)
      if (!existing) {
        byID.set(identity.id, identity)
        continue
      }
      byID.delete(identity.id)
      quarantined.add(identity.id)
      const message = `duplicate expert squad id "${identity.id}" in ${identity.location} scope at ${existing.root} and ${identity.root}`
      for (const duplicate of [existing, identity]) {
        discoveryIssue(
          issues,
          {
            phase: "identity.duplicate",
            location: duplicate.root,
            namespace: duplicate.namespace,
            id: duplicate.id,
          },
          new Error(message),
        )
      }
    }
    return { items: [...byID.values()], issues }
  }

  async function discoverAvailableIdentitiesFromLocation(
    location: ExpertSquadPackageLocations.Location,
  ): Promise<DiscoveryResult<InstalledPackageIdentity>> {
    return uniqueAvailableIdentitiesInScope(await discoverIdentityLocationAvailable(location))
  }

  function reservedIDs(discovered: DiscoveryResult<InstalledPackageIdentity>): Set<string> {
    const ids = new Set(discovered.items.map((identity) => identity.id))
    for (const issue of discovered.issues) {
      if (issue.id && ID.safeParse(issue.id).success) ids.add(issue.id)
    }
    return ids
  }

  async function discoverEffectiveIdentities(projectDirectory: string): Promise<{
    effective: DiscoveryResult<InstalledPackageIdentity>
    installations: InstalledPackageIdentity[]
    projectByID: Map<string, InstalledPackageIdentity>
    globalByID: Map<string, InstalledPackageIdentity>
  }> {
    const [global, project] = await Promise.all([
      discoverAvailableIdentitiesFromLocation(ExpertSquadPackageLocations.global()),
      discoverAvailableIdentitiesFromLocation(ExpertSquadPackageLocations.project(projectDirectory)),
    ])
    const projectReservations = reservedIDs(project)
    const projectByID = new Map(project.items.map((identity) => [identity.id, identity]))
    const globalByID = new Map(global.items.map((identity) => [identity.id, identity]))
    return {
      effective: {
        items: [...global.items.filter((identity) => !projectReservations.has(identity.id)), ...project.items],
        issues: [...global.issues, ...project.issues],
      },
      installations: [...global.items, ...project.items],
      projectByID,
      globalByID,
    }
  }

  export async function discoverAvailableIdentities(
    projectDirectory: string,
  ): Promise<DiscoveryResult<InstalledPackageIdentity>> {
    const { ExpertSquadPackageManager } = await import("./manager")
    await ExpertSquadPackageManager.reconcilePendingPackageMutations(projectDirectory)
    return discoverEffectiveIdentities(projectDirectory).then((result) => result.effective)
  }

  export async function discoverGlobalAvailableIdentities(): Promise<DiscoveryResult<InstalledPackageIdentity>> {
    const { ExpertSquadPackageManager } = await import("./manager")
    await ExpertSquadPackageManager.reconcilePendingGlobalPackageMutations()
    return discoverAvailableIdentitiesFromLocation(ExpertSquadPackageLocations.global())
  }

  async function discoverAvailableFromIdentities(
    discovered: DiscoveryResult<InstalledPackageIdentity>,
  ): Promise<DiscoveryResult<CatalogPackage>> {
    const items: CatalogPackage[] = []
    const issues = [...discovered.issues]
    for (const identity of discovered.items) {
      try {
        items.push({
          ...(await loadCatalogPackage(identity.root)),
          installationScope: identity.location,
        })
      } catch (error) {
        discoveryIssue(
          issues,
          {
            phase: "package.catalog",
            location: identity.root,
            namespace: identity.namespace,
            id: identity.id,
          },
          error,
        )
      }
    }
    return { items, issues }
  }

  function revision(identity: InstalledPackageIdentity, loaded: CatalogPackage): ResolvedPackageRevision {
    return ResolvedPackageRevisionSchema.parse({
      scope: identity.location,
      namespace: identity.namespace,
      id: identity.id,
      root: identity.root,
      version: loaded.version,
      package_digest: loaded.packageDigest,
    })
  }

  async function discoverAvailableUncached(
    projectDirectory: string,
  ): Promise<EffectiveDiscoveryResult<PackageCatalogEntry>> {
    const identities = await discoverEffectiveIdentities(projectDirectory)
    const inventory = await discoverAvailableFromIdentities({ items: identities.installations, issues: [] })
    const inventoryByRoot = new Map(inventory.items.map((entry) => [Filesystem.normalizePath(entry.root), entry]))
    const effectiveItems = identities.effective.items.flatMap((identity) => {
      const entry = inventoryByRoot.get(Filesystem.normalizePath(identity.root))
      return entry ? [entry] : []
    })
    const warnings: DiscoveryWarning[] = []
    for (const [id, projectIdentity] of identities.projectByID) {
      const globalIdentity = identities.globalByID.get(id)
      if (!globalIdentity) continue
      const projectEntry = inventoryByRoot.get(Filesystem.normalizePath(projectIdentity.root))
      const globalEntry = inventoryByRoot.get(Filesystem.normalizePath(globalIdentity.root))
      if (!projectEntry || !globalEntry) continue
      warnings.push(
        DiscoveryWarning.parse({
          code: "project_overrides_global",
          severity: "warning",
          logical_id: id,
          effective: revision(projectIdentity, projectEntry),
          shadowed: revision(globalIdentity, globalEntry),
        }),
      )
    }
    return {
      items: effectiveItems,
      issues: [...identities.effective.issues, ...inventory.issues],
      installations: inventory.items,
      warnings,
    }
  }

  const availableInventoryState = createInstanceState(
    () => new Map<string, Promise<EffectiveDiscoveryResult<PackageCatalogEntry>>>(),
    undefined,
    "expert-squad-available-inventory",
  )

  export async function discoverAvailable(
    projectDirectory: string,
    options: { reconcileEvolutionMutations?: boolean } = {},
  ): Promise<EffectiveDiscoveryResult<PackageCatalogEntry>> {
    if (options.reconcileEvolutionMutations !== false) {
      const { ExpertSquadPackageManager } = await import("./manager")
      await ExpertSquadPackageManager.reconcilePendingPackageMutations(projectDirectory)
    }
    if (!ProjectInstanceContext.tryUse()) return discoverAvailableUncached(projectDirectory)
    const inventories = availableInventoryState()
    const key = Filesystem.normalizePath(projectDirectory)
    const active = inventories.get(key)
    if (active) return active
    const inventory = discoverAvailableUncached(projectDirectory)
    inventories.set(key, inventory)
    try {
      return await inventory
    } catch (error) {
      if (inventories.get(key) === inventory) inventories.delete(key)
      throw error
    }
  }

  export async function invalidateAvailable() {
    await availableInventoryState.resetAll()
  }

  export async function discoverGlobalAvailable(): Promise<DiscoveryResult<PackageCatalogEntry>> {
    return discoverAvailableFromIdentities(await discoverGlobalAvailableIdentities())
  }

  export async function discoverInstalledPackageIdentities(
    projectDirectory: string,
    options: { reconcileEvolutionMutations?: boolean } = {},
  ): Promise<InstalledPackageIdentity[]> {
    if (options.reconcileEvolutionMutations !== false) {
      const { ExpertSquadPackageManager } = await import("./manager")
      await ExpertSquadPackageManager.reconcilePendingPackageMutations(projectDirectory)
    }
    const packages: InstalledPackageIdentity[] = []
    for (const location of ExpertSquadPackageLocations.discover(projectDirectory)) {
      const seen = new Map<string, string>()
      for (const identity of await discoverIdentityLocation(location)) {
        const existingRoot = seen.get(identity.id)
        if (existingRoot) {
          throw new Error(
            `duplicate expert squad id "${identity.id}" in ${location.kind} scope at ${existingRoot} and ${identity.root}`,
          )
        }
        seen.set(identity.id, identity.root)
        packages.push(identity)
      }
    }
    return packages
  }

  export async function findInstalledPackageIdentitiesForProjects(
    projectDirectories: readonly string[],
    id: string,
  ): Promise<InstalledPackageIdentity[]> {
    const matches: InstalledPackageIdentity[] = []
    for (const location of ExpertSquadPackageLocations.discoverProjects(projectDirectories)) {
      for (const identity of await discoverIdentityLocation(location)) {
        if (identity.id === id) matches.push(identity)
      }
    }
    return matches
  }

  export async function discover(projectDirectory: string): Promise<PackageCatalogEntry[]> {
    const packages: PackageCatalogEntry[] = []
    const installed = await discoverInstalledPackageIdentities(projectDirectory)
    const projectIDs = new Set(
      installed.filter((identity) => identity.location === "project").map((identity) => identity.id),
    )
    const effective = installed.filter((identity) => identity.location === "project" || !projectIDs.has(identity.id))
    for (const identity of effective) {
      packages.push({
        ...(await publicMetadata(await readPackageMetadata(identity.root, { canonicalFolder: true }))),
        installationScope: identity.location,
      })
    }
    return packages
  }
}
