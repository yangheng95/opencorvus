import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { access, cp, lstat, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk/client"
import { ProcessSupervisor } from "../../src/shell/process-supervisor"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { DurableActivityCursorSchema } from "@opencorvus-ai/plugin"
import { executionCapsuleTreeDigest } from "../../src/execution-capsule/tree-digest"
import { ExecutionCapsuleRuntimeDescriptorSchema } from "../../src/execution-capsule/runtime"
import {
  artifactBrowserMcpNodeRuntimeModules,
  artifactEmbeddedExecutableRelativePaths,
} from "../build-artifact"
import { validatePackagedRuntimeNodeModules } from "../build-runtime-node-modules"
import { normalizeArtifactExecutablePermissions } from "../runtime-executable-contract"

const SHA256 = z.string().regex(/^[a-f0-9]{64}$/)
const AbsolutePath = z.string().min(1).refine(path.isAbsolute, "Path must be absolute")
const Resource = z.object({ path: AbsolutePath, sha256: SHA256 }).strict()
const SERVER_RUNTIME_EXECUTABLES = artifactEmbeddedExecutableRelativePaths("linux")
const SERVER_RUNTIME_REGULAR_FILES = [
  ...SERVER_RUNTIME_EXECUTABLES,
  "package.json",
  path.join("browser-mcp-node", "browser.mjs"),
  path.join("browser-mcp-node", "package.json"),
]
const RuntimeIdentitySchema = z
  .object({
    protocol: z.literal("opencorvus.wsl2-rootless-oci-runtime.v1"),
    kernel_release: z.string().min(1),
    os_release_sha256: SHA256,
    systemd_run_version_sha256: SHA256,
    namespace_probe: z.literal("user,mount,pid,ipc,uts,net"),
  })
  .strict()
const TrialSlotSchema = z
  .object({
    case_id: z.enum(["case-03", "case-04", "case-10"]),
    arm: z.enum(["baseline", "candidate"]),
    repetition: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict()

const expectedTrialSlots = ["case-03", "case-04", "case-10"].flatMap((caseID) =>
  ["baseline", "candidate"].flatMap((arm) => [1, 2, 3].map((repetition) => `${caseID}:${arm}:${repetition}`)),
)
export const EvolutionBenchmarkLaunchSchema = z
  .object({
    schema_version: z.literal(1),
    run_id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
    server_runtime: z.object({ source_directory: AbsolutePath, tree_sha256: SHA256 }).strict(),
    server_isolation: z
      .object({
        kind: z.literal("wsl2-rootless-oci-v1"),
        systemd_run: Resource,
        systemctl: Resource,
        unshare: Resource,
        runc: Resource,
        node: Resource,
        ripgrep: Resource,
        runtime_identity: Resource,
        child_environment_names: z.array(z.string()).length(0),
        lsp_server_ids: z.array(z.never()).length(0),
        toolchain: z.object({ source_directory: AbsolutePath, tree_sha256: SHA256 }).strict(),
        resources: z
          .object({
            memory_max_bytes: z.number().int().positive(),
            tasks_max: z.number().int().positive(),
            nofile_max: z.number().int().positive(),
            tmpfs_max_bytes: z.number().int().positive(),
            cpu_quota_percent: z.number().positive().max(100),
          })
          .strict(),
      })
      .strict(),
    benchmark_resource_root: AbsolutePath,
    output_root: AbsolutePath,
    runtime_config: Resource,
    project_seed: z.object({ source_directory: AbsolutePath, tree_sha256: SHA256 }).strict(),
    inherited_environment_names: z.array(z.string().min(1)).min(1).refine((items) => new Set(items).size === items.length),
    credential_source_identity: z.string().min(1),
    benchmark_tenant: z.string().min(1),
    external_side_effect_policy: z.literal("test_tenant_only"),
    workspace_identity: z.string().min(1),
    environment_identity: z.string().min(1),
    permission_snapshot: Resource,
    scorer_assets: z.array(Resource).min(1),
    statistics_contract: Resource,
    repetitions: z.literal(3),
    trial_slots: z
      .array(TrialSlotSchema)
      .length(18)
      .refine(
        (slots) =>
          [...slots.map((slot) => `${slot.case_id}:${slot.arm}:${slot.repetition}`)].sort().join("|") ===
          [...expectedTrialSlots].sort().join("|"),
      ),
    budget: z.object({ max_runs: z.number().int().min(18), max_cost: z.number().positive(), currency: z.string().min(1) }).strict(),
    mission_id: z.string().regex(/^[a-z0-9-]+$/),
    model: z.string().regex(/^[^/]+\/[^/]+$/),
    mission_request: Resource,
    benchmark_catalog: Resource,
    development_manifest: Resource,
    target_package: z
      .object({
        source_directory: AbsolutePath,
        namespace: z.string().min(1),
        id: z.string().min(1),
        package_digest: SHA256,
      })
      .strict(),
    evolution_lab_package: z.object({ source_directory: AbsolutePath, package_digest: SHA256 }).strict(),
    inactivity_window_ms: z.number().int().positive().max(2_147_483_647),
    evidence_scheduling_margin_ms: z.number().int().positive().max(2_147_483_647),
  })
  .strict()
  .refine(
    (launch) => launch.evidence_scheduling_margin_ms < launch.inactivity_window_ms,
    "Evidence scheduling margin must be smaller than the inactivity window",
  )

export type EvolutionBenchmarkLaunch = z.infer<typeof EvolutionBenchmarkLaunchSchema>

const DevelopmentManifestSchema = z
  .object({
    schema_version: z.literal(1),
    dataset_partition: z.literal("development"),
    case_set_sha256: SHA256,
    cases: z
      .array(
        z
          .object({
            id: z.string().min(1),
            number: z.number().int().positive(),
            title: z.string().min(1),
            resource: z
              .object({
                path: z.string().min(1),
                media_type: z.literal("text/markdown"),
                bytes: z.number().int().nonnegative(),
                sha256: SHA256,
              })
              .strict(),
            visual_surfaces: z.array(z.string().min(1)),
          })
          .strict(),
      )
      .length(3)
      .refine((cases) => cases.map((item) => item.id).join(",") === "case-03,case-04,case-10"),
  })
  .strict()

const BenchmarkCatalogSchema = z
  .object({
    schema_version: z.literal(1),
    source: z.object({ path: z.string().min(1), bytes: z.number().int().nonnegative(), sha256: SHA256 }).strict(),
    partitions: z
      .object({
        development: z.array(z.string().min(1)),
        holdout: z.array(z.string().min(1)),
        certification: z.array(z.string().min(1)),
      })
      .strict(),
    cases: DevelopmentManifestSchema.shape.cases.element.array(),
  })
  .strict()

const ActivityCursorSchema = z
  .object({
    mission_id: z.string().min(1),
    session_id: z.string().min(1),
    source: DurableActivityCursorSchema.shape.source,
    id: z.string().min(1),
    time_updated: z.number().int().nonnegative(),
    activity_sha256: SHA256,
    tasks: z.array(
      z.object({
        task_id: z.string().min(1),
        source: DurableActivityCursorSchema.shape.source,
        id: z.string().min(1),
        time_updated: z.number().int().nonnegative(),
      }),
    ),
  })
  .strict()

const CheckpointSchema = z
  .object({
    schema_version: z.literal(1),
    config_sha256: SHA256,
    run_id: z.string().min(1),
    mission_id: z.string().min(1),
    session_id: z.string().min(1),
    cursor: ActivityCursorSchema,
    inactivity_deadline_ms: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (checkpoint) =>
      checkpoint.cursor.mission_id === checkpoint.mission_id && checkpoint.cursor.session_id === checkpoint.session_id,
    "Checkpoint cursor identity must equal the Mission identity",
  )

export type EvolutionBenchmarkCheckpoint = z.infer<typeof CheckpointSchema>

export type EvolutionBenchmarkInactivityClock = Readonly<{
  now(): number
  sleep(durationMs: number): Promise<void>
}>

const ProductionEvolutionBenchmarkInactivityClock: EvolutionBenchmarkInactivityClock = {
  now: Date.now,
  sleep: Bun.sleep,
}

export const EvolutionBenchmarkTerminalOutcomeSchema = z
  .object({
    status: z.literal("inactive"),
    reason: z.literal("inactivity_timeout"),
    observed_at_ms: z.number().int().nonnegative(),
    inactivity_deadline_ms: z.number().int().nonnegative(),
    inactivity_delta_ms: z.number().int().nonnegative(),
  })
  .strict()

export class EvolutionBenchmarkFinalizedRunError extends Error {
  override readonly name = "EvolutionBenchmarkFinalizedRunError"
  readonly code = "EVOLUTION_BENCHMARK_RUN_FINALIZED" as const
}

function sha256(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function exactResource(resource: z.infer<typeof Resource>) {
  const bytes = await readFile(resource.path)
  const actual = sha256(bytes)
  if (actual !== resource.sha256) throw new Error(`Resource digest mismatch for ${resource.path}: ${actual}`)
  return bytes
}

async function readLaunch(configPath: string) {
  const bytes = await readFile(configPath)
  return { launch: EvolutionBenchmarkLaunchSchema.parse(JSON.parse(bytes.toString("utf8"))), configSHA256: sha256(bytes) }
}

function runPaths(launch: EvolutionBenchmarkLaunch) {
  const root = path.join(launch.output_root, launch.run_id)
  return {
    root,
    project: path.join(root, "project"),
    home: path.join(root, "home"),
    temporary: path.join(root, "tmp"),
    control: path.join(root, "control"),
    serverRuntime: path.join(root, "control", "server-runtime"),
    serverBinary: path.join(root, "control", "server-runtime", "opencorvus"),
    targetPackage: path.join(root, "control", "target-package"),
    toolchain: path.join(root, "control", "toolchain"),
    capsuleDescriptor: path.join(root, "capsule-runtime.json"),
    log: path.join(root, "server.log"),
    runtimeConfig: path.join(root, "runtime-config.json"),
    checkpoint: path.join(root, "checkpoint.json"),
    result: path.join(root, "result.json"),
  }
}

async function requireMissing(directory: string) {
  try {
    await stat(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  throw new Error(`Evolution benchmark run already exists: ${directory}`)
}

async function requireResumableRun(paths: ReturnType<typeof runPaths>) {
  try {
    await stat(paths.result)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  throw new EvolutionBenchmarkFinalizedRunError(
    `Evolution benchmark run ${path.basename(paths.root)} already has an immutable result: ${paths.result}`,
  )
}

async function copyDevelopmentClosure(launch: EvolutionBenchmarkLaunch, project: string) {
  const manifestBytes = await exactResource(launch.development_manifest)
  const manifest = DevelopmentManifestSchema.parse(JSON.parse(manifestBytes.toString("utf8")))
  const resources = path.join(project, "benchmark-resources")
  await mkdir(resources, { recursive: true })
  await writeFile(path.join(resources, "development-manifest.json"), manifestBytes, { flag: "wx" })
  for (const item of manifest.cases) {
    const source = path.resolve(launch.benchmark_resource_root, item.resource.path)
    const bytes = await readFile(source)
    if (bytes.byteLength !== item.resource.bytes || sha256(bytes) !== item.resource.sha256) {
      throw new Error(`Development Case bytes do not match manifest: ${item.id}`)
    }
    await writeFile(path.join(resources, `${item.id}.md`), bytes, { flag: "wx" })
  }
  return manifest
}

async function validateBenchmarkPartitions(launch: EvolutionBenchmarkLaunch) {
  const catalog = BenchmarkCatalogSchema.parse(JSON.parse((await exactResource(launch.benchmark_catalog)).toString("utf8")))
  const development = DevelopmentManifestSchema.parse(
    JSON.parse((await exactResource(launch.development_manifest)).toString("utf8")),
  )
  const catalogDevelopment = catalog.cases.filter((item) => catalog.partitions.development.includes(item.id))
  const catalogIdentity = catalogDevelopment.map((item) => `${item.id}:${item.resource.bytes}:${item.resource.sha256}`).join("|")
  const developmentIdentity = development.cases.map((item) => `${item.id}:${item.resource.bytes}:${item.resource.sha256}`).join("|")
  if (catalogIdentity !== developmentIdentity) throw new Error("Development manifest does not equal the catalog development partition")
  const restrictedDigests = new Set([
    catalog.source.sha256,
    ...catalog.cases
      .filter((item) => !catalog.partitions.development.includes(item.id))
      .map((item) => item.resource.sha256),
  ])
  const seedDigests = new Set<string>()
  async function walk(directory: string) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(absolute)
      else if (entry.isFile()) seedDigests.add(sha256(await readFile(absolute)))
      else throw new Error(`Project seed contains a non-regular entry: ${absolute}`)
    }
  }
  await walk(launch.project_seed.source_directory)
  const exposed = [...restrictedDigests].filter((digest) => seedDigests.has(digest))
  if (exposed.length > 0) throw new Error(`Project seed contains ${exposed.length} restricted benchmark resource(s)`)
}

async function copyFrozenControlResources(launch: EvolutionBenchmarkLaunch, project: string) {
  const root = path.join(project, "benchmark-resources", "frozen-control")
  await mkdir(root, { recursive: true })
  const resources = [
    { name: "permission-snapshot.json", resource: launch.permission_snapshot },
    { name: "statistics-contract.json", resource: launch.statistics_contract },
    ...launch.scorer_assets.map((resource, index) => ({ name: `scorer-${index + 1}-${path.basename(resource.path)}`, resource })),
  ]
  for (const item of resources) await writeFile(path.join(root, item.name), await exactResource(item.resource), { flag: "wx" })
}

function executionCapsuleRuntimeDescriptor(
  launch: EvolutionBenchmarkLaunch,
  paths: ReturnType<typeof runPaths>,
) {
  return {
    schema_version: 1,
    protocol: "opencorvus.task-execution-capsule.runtime.v1",
    runtime_identity_sha256: launch.server_isolation.runtime_identity.sha256,
    server_runtime_tree_sha256: launch.server_runtime.tree_sha256,
    package_tool_inactivity_ms: launch.inactivity_window_ms,
    controller_unit: `opencorvus-controller-${launch.run_id}.service`,
    outer_source_root: paths.root,
    outer_visible_root: paths.root,
    systemd_run: launch.server_isolation.systemd_run,
    systemctl: launch.server_isolation.systemctl,
    runc: launch.server_isolation.runc,
    node: launch.server_isolation.node,
    ripgrep: launch.server_isolation.ripgrep,
    toolchain: {
      broker_root: paths.toolchain,
      tree_sha256: launch.server_isolation.toolchain.tree_sha256,
    },
    secret_environment_names: launch.inherited_environment_names,
    child_environment_names: launch.server_isolation.child_environment_names,
    network: { default: "none" },
    lsp: { server_ids: launch.server_isolation.lsp_server_ids },
    resources: launch.server_isolation.resources,
  }
}

async function copyExecutionCapsuleRuntime(launch: EvolutionBenchmarkLaunch, paths: ReturnType<typeof runPaths>) {
  await mkdir(paths.control, { recursive: true })
  await Promise.all([
    cp(launch.server_runtime.source_directory, paths.serverRuntime, {
      recursive: true,
      errorOnExist: true,
      force: false,
    }),
    cp(launch.target_package.source_directory, paths.targetPackage, {
      recursive: true,
      errorOnExist: true,
      force: false,
    }),
    cp(launch.server_isolation.toolchain.source_directory, paths.toolchain, {
      recursive: true,
      errorOnExist: true,
      force: false,
    }),
  ])
  await normalizeArtifactExecutablePermissions({ root: paths.serverRuntime, os: "linux" })
  const descriptor = executionCapsuleRuntimeDescriptor(launch, paths)
  await writeFile(paths.capsuleDescriptor, `${JSON.stringify(descriptor, null, 2)}\n`, { flag: "wx" })
}

async function validateServerRuntimeClosure(directory: string, expectedDigest: string) {
  const actualDigest = await executionCapsuleTreeDigest(directory)
  if (actualDigest !== expectedDigest) throw new Error(`Server runtime tree digest mismatch: ${actualDigest}`)
  await Promise.all(
    SERVER_RUNTIME_REGULAR_FILES.map(async (relative) => {
      const file = path.join(directory, relative)
      const identity = await lstat(file)
      if (!identity.isFile() || identity.isSymbolicLink()) {
        throw new Error(`Server runtime entry must be a regular file: ${relative}`)
      }
    }),
  )
  await Promise.all(SERVER_RUNTIME_EXECUTABLES.map((relative) => access(path.join(directory, relative), constants.X_OK)))
  JSON.parse(await readFile(path.join(directory, "package.json"), "utf8"))
  JSON.parse(await readFile(path.join(directory, "browser-mcp-node", "package.json"), "utf8"))
  await Promise.all([
    validatePackagedRuntimeNodeModules({ runtimeRoot: directory, target: { os: "linux", arch: "x64" } }),
    validatePackagedRuntimeNodeModules({
      runtimeRoot: path.join(directory, "browser-mcp-node"),
      target: { os: "linux", arch: "x64" },
      modules: artifactBrowserMcpNodeRuntimeModules(),
    }),
  ])
}

async function validatePersistedExecutionCapsuleRuntime(
  launch: EvolutionBenchmarkLaunch,
  paths: ReturnType<typeof runPaths>,
) {
  const expectedDescriptor = `${JSON.stringify(executionCapsuleRuntimeDescriptor(launch, paths), null, 2)}\n`
  const [, descriptor, targetDigest, toolchainDigest] = await Promise.all([
    validateServerRuntimeClosure(paths.serverRuntime, launch.server_runtime.tree_sha256),
    readFile(paths.capsuleDescriptor, "utf8"),
    ExpertSquadRegistry.packageDigest(paths.targetPackage),
    executionCapsuleTreeDigest(paths.toolchain),
  ])
  if (descriptor !== expectedDescriptor) throw new Error("Persisted Capsule runtime descriptor identity mismatch")
  ExecutionCapsuleRuntimeDescriptorSchema.parse(JSON.parse(descriptor))
  if (targetDigest !== launch.target_package.package_digest) {
    throw new Error("Persisted Capsule target package digest mismatch")
  }
  if (toolchainDigest !== launch.server_isolation.toolchain.tree_sha256) {
    throw new Error("Persisted Capsule toolchain digest mismatch")
  }
}

export async function missionRequestText(launch: EvolutionBenchmarkLaunch, paths: ReturnType<typeof runPaths>) {
  const request = (await exactResource(launch.mission_request)).toString("utf8")
  const envelope = {
    schema_version: 1,
    dataset: "benchmark-resources/development-manifest.json",
    target_package: {
      namespace: launch.target_package.namespace,
      id: launch.target_package.id,
      package_digest: launch.target_package.package_digest,
    },
    evolution_lab_package_digest: launch.evolution_lab_package.package_digest,
    model: launch.model,
    credential_source_identity: launch.credential_source_identity,
    benchmark_tenant: launch.benchmark_tenant,
    external_side_effect_policy: launch.external_side_effect_policy,
    workspace_identity: launch.workspace_identity,
    environment_identity: launch.environment_identity,
    permission_snapshot: "benchmark-resources/frozen-control/permission-snapshot.json",
    statistics_contract: "benchmark-resources/frozen-control/statistics-contract.json",
    scorer_assets: launch.scorer_assets.map((resource, index) =>
      `benchmark-resources/frozen-control/scorer-${index + 1}-${path.basename(resource.path)}`,
    ),
    repetitions: launch.repetitions,
    trial_slots: launch.trial_slots.map((slot) => ({
      ...slot,
      execution_directory: path.posix.join(
        paths.project,
        "trial-workspaces",
        `${slot.case_id}-${slot.arm}-${slot.repetition}`,
      ),
    })),
    budget: launch.budget,
    inactivity_window_ms: launch.inactivity_window_ms,
    evidence_scheduling_margin_ms: launch.evidence_scheduling_margin_ms,
    wait_contract: {
      maximum_wait_ms: launch.inactivity_window_ms - launch.evidence_scheduling_margin_ms,
      instruction:
        "Every wait must complete within maximum_wait_ms after the latest visible activity so dispatch and evidence publication retain the exact scheduling margin.",
    },
  }
  return `${request.trimEnd()}\n\n<evolution_benchmark_envelope>\n${JSON.stringify(envelope, null, 2)}\n</evolution_benchmark_envelope>`
}

export async function directoryTreeDigest(root: string) {
  const digest = createHash("sha256")
  digest.update("opencorvus/evolution-project-seed@1\0", "utf8")
  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      const relative = path.relative(root, absolute).split(path.sep).join("/")
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile() || (await lstat(absolute)).isSymbolicLink()) {
        throw new Error(`Project seed contains a non-regular entry: ${relative}`)
      }
      const bytes = await readFile(absolute)
      digest.update(`${Buffer.byteLength(relative)}:${relative}:${bytes.byteLength}:`, "utf8")
      digest.update(bytes)
    }
  }
  await walk(root)
  return digest.digest("hex")
}

async function copyProjectSeed(launch: EvolutionBenchmarkLaunch, project: string) {
  const actual = await directoryTreeDigest(launch.project_seed.source_directory)
  if (actual !== launch.project_seed.tree_sha256) throw new Error(`Project seed digest mismatch: ${actual}`)
  await cp(launch.project_seed.source_directory, project, { recursive: true, errorOnExist: true, force: false })
  const workspacesRoot = path.join(project, "trial-workspaces")
  await mkdir(workspacesRoot, { recursive: true })
  for (const slot of launch.trial_slots) {
    const slotID = `${slot.case_id}-${slot.arm}-${slot.repetition}`
    await cp(launch.project_seed.source_directory, path.join(workspacesRoot, slotID), {
      recursive: true,
      errorOnExist: true,
      force: false,
    })
  }
}

async function validatePackageSources(launch: EvolutionBenchmarkLaunch) {
  const [targetDigest, evolutionLabDigest] = await Promise.all([
    ExpertSquadRegistry.packageDigest(launch.target_package.source_directory),
    ExpertSquadRegistry.packageDigest(launch.evolution_lab_package.source_directory),
  ])
  if (targetDigest !== launch.target_package.package_digest) throw new Error(`Target package digest mismatch: ${targetDigest}`)
  if (evolutionLabDigest !== launch.evolution_lab_package.package_digest) {
    throw new Error(`Evolution Lab package digest mismatch: ${evolutionLabDigest}`)
  }
}

async function validateLaunchInputs(launch: EvolutionBenchmarkLaunch) {
  const [seedDigest, toolchainDigest] = await Promise.all([
    directoryTreeDigest(launch.project_seed.source_directory),
    executionCapsuleTreeDigest(launch.server_isolation.toolchain.source_directory),
  ])
  if (seedDigest !== launch.project_seed.tree_sha256) throw new Error(`Project seed digest mismatch: ${seedDigest}`)
  if (toolchainDigest !== launch.server_isolation.toolchain.tree_sha256) {
    throw new Error(`Execution Capsule toolchain digest mismatch: ${toolchainDigest}`)
  }
  await Promise.all([
    validateServerRuntimeClosure(launch.server_runtime.source_directory, launch.server_runtime.tree_sha256),
    exactResource(launch.server_isolation.systemd_run),
    exactResource(launch.server_isolation.systemctl),
    exactResource(launch.server_isolation.unshare),
    exactResource(launch.server_isolation.runc),
    exactResource(launch.server_isolation.node),
    exactResource(launch.server_isolation.ripgrep),
    exactResource(launch.server_isolation.runtime_identity),
    exactResource(launch.runtime_config),
    exactResource(launch.mission_request),
    exactResource(launch.benchmark_catalog),
    exactResource(launch.development_manifest),
    exactResource(launch.permission_snapshot),
    exactResource(launch.statistics_contract),
    ...launch.scorer_assets.map(exactResource),
    validatePackageSources(launch),
    validateBenchmarkPartitions(launch),
  ])
}

function isolatedEnvironment(launch: EvolutionBenchmarkLaunch, paths: ReturnType<typeof runPaths>) {
  const env: NodeJS.ProcessEnv = {}
  for (const name of launch.inherited_environment_names) {
    const value = process.env[name]
    if (value === undefined) throw new Error(`Required inherited environment variable is unavailable: ${name}`)
    env[name] = value
  }
  env.OPENCORVUS_HOME = paths.home
  env.OPENCORVUS_PROJECT_DIR = paths.project
  env.OPENCORVUS_CONFIG = paths.runtimeConfig
  env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = paths.capsuleDescriptor
  env.OPENCORVUS_TASK_PROCESS_MODE = "capsule"
  env.TMPDIR = paths.temporary
  env.TEMP = paths.temporary
  env.TMP = paths.temporary
  return env
}

export class EvolutionServerExitedBeforeReadinessError extends Error {
  constructor(
    readonly exitCode: number,
    readonly output: string,
  ) {
    super(
      `OpenCorvus server exited before readiness with code ${exitCode}${output ? `:\n${output}` : ""}`,
    )
    this.name = "EvolutionServerExitedBeforeReadinessError"
  }
}

export class EvolutionServerReadinessInactivityError extends Error {
  constructor(readonly output: string) {
    super(`OpenCorvus server published no readiness activity for 15 seconds${output ? `:\n${output}` : ""}`)
    this.name = "EvolutionServerReadinessInactivityError"
  }
}

export type EvolutionServerReadinessActivity = { lastActivityAt: number }
export type EvolutionServerReadinessClock = {
  now(): number
  sleep(milliseconds: number): Promise<void>
}

const CONTROLLER_ENVIRONMENT_NAMES_VARIABLE = "OPENCORVUS_CONTROLLER_ENVIRONMENT_NAMES"
export const CONTROLLER_ENVIRONMENT_WRAPPER_SOURCE = String.raw`
const { spawn } = require("node:child_process")
const names = (process.env.OPENCORVUS_CONTROLLER_ENVIRONMENT_NAMES || "").split(",").filter(Boolean)
const env = Object.fromEntries(names.map((name) => [name, process.env[name]]))
const [executable, ...args] = process.argv.slice(1)
if (!executable) throw new Error("Controller environment wrapper requires an executable")
const child = spawn(executable, args, { env, stdio: "inherit" })
child.once("error", (error) => { throw error })
child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code === null ? 1 : code)
})
`

export function controllerServiceEnvironment(environment: NodeJS.ProcessEnv) {
  const names = Object.keys(environment).sort((left, right) => left.localeCompare(right))
  return {
    ...environment,
    [CONTROLLER_ENVIRONMENT_NAMES_VARIABLE]: names.join(","),
  }
}

export function systemdRunEnvironmentArguments(environment: NodeJS.ProcessEnv) {
  return Object.keys(environment)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => `--setenv=${name}`)
}

const ProductionEvolutionServerReadinessClock: EvolutionServerReadinessClock = {
  now: () => performance.now(),
  sleep: Bun.sleep,
}

export async function waitForEvolutionServerURL(
  output: string[],
  exited: Promise<number>,
  activity: EvolutionServerReadinessActivity = { lastActivityAt: ProductionEvolutionServerReadinessClock.now() },
  clock: EvolutionServerReadinessClock = ProductionEvolutionServerReadinessClock,
) {
  while (true) {
    const match = output.join("").match(/opencorvus server listening on (http:\/\/[^\s]+)/)
    if (match?.[1]) return match[1]
    const remainingInactivityMs = 15_000 - (clock.now() - activity.lastActivityAt)
    if (remainingInactivityMs <= 0) throw new EvolutionServerReadinessInactivityError(output.join(""))
    const outcome = await Promise.race([
      exited.then((code) => ({ kind: "exit" as const, code })),
      clock.sleep(Math.min(100, remainingInactivityMs)).then(() => ({ kind: "tick" as const })),
    ])
    if (outcome.kind === "exit") {
      throw new EvolutionServerExitedBeforeReadinessError(outcome.code, output.join(""))
    }
  }
}

async function controllerSystemctl(
  launch: EvolutionBenchmarkLaunch,
  paths: ReturnType<typeof runPaths>,
  args: string[],
) {
  const handle = await ProcessSupervisor.spawnHostCommand({
    executable: launch.server_isolation.systemctl.path,
    args: ["--user", "--quiet", ...args],
    cwd: paths.root,
    env: isolatedEnvironment(launch, paths),
    owner: `expert-squad-evolution-controller:${launch.run_id}`,
  })
  let stdout = ""
  let stderr = ""
  handle.stdout?.setEncoding("utf8")
  handle.stderr?.setEncoding("utf8")
  handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
  handle.stderr?.on("data", (chunk) => (stderr += String(chunk)))
  const exitCode = await handle.exited
  await ProcessSupervisor.disposeAndWaitForExit(handle, `controller systemctl ${args[0]}`)
  if (exitCode !== 0) {
    throw new Error(`Controller systemctl ${args.join(" ")} exited ${exitCode}: ${stderr.trim()}`)
  }
  return stdout.trim()
}

async function closeControllerService(input: {
  launch: EvolutionBenchmarkLaunch
  paths: ReturnType<typeof runPaths>
  handle: ProcessSupervisor.Handle
  label: string
}) {
  const unit = `opencorvus-controller-${input.launch.run_id}.service`
  const failures: unknown[] = []
  try {
    await controllerSystemctl(input.launch, input.paths, ["stop", unit])
    const activeState = await controllerSystemctl(input.launch, input.paths, [
      "show",
      unit,
      "--property=ActiveState",
      "--value",
    ])
    if (activeState !== "inactive") throw new Error(`Controller ${unit} stopped with ActiveState=${activeState}`)
  } catch (error) {
    failures.push(error)
  }
  try {
    await ProcessSupervisor.disposeAndWaitForExit(input.handle, input.label, {
      cleanupTimeoutMs: 15_000,
      exitTimeoutMs: 5_000,
    })
  } catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) throw new AggregateError(failures, `${input.label} service and client cleanup failed`)
}

async function spawnServer(launch: EvolutionBenchmarkLaunch, paths: ReturnType<typeof runPaths>) {
  if (process.platform !== "linux") throw new Error("Evolution benchmark Production runtime requires Linux rootless OCI")
  await validatePersistedExecutionCapsuleRuntime(launch, paths)
  const runtimeConfig = await readFile(paths.runtimeConfig)
  if (sha256(runtimeConfig) !== launch.runtime_config.sha256) throw new Error("Isolated runtime config digest mismatch")
  const output: string[] = []
  const controllerEnvironment = controllerServiceEnvironment(isolatedEnvironment(launch, paths))
  const handle = await ProcessSupervisor.spawnHostCommand({
    executable: launch.server_isolation.systemd_run.path,
    args: [
      "--user",
      "--quiet",
      "--wait",
      "--pipe",
      "--service-type=exec",
      "--property=KillMode=control-group",
      "--property=CollectMode=inactive-or-failed",
      "--property=TimeoutStopSec=10s",
      ...systemdRunEnvironmentArguments(controllerEnvironment),
      `--unit=opencorvus-controller-${launch.run_id}.service`,
      launch.server_isolation.node.path,
      "-e",
      CONTROLLER_ENVIRONMENT_WRAPPER_SOURCE,
      paths.serverBinary,
      "serve",
      "--hostname",
      "127.0.0.1",
      "--port",
      "0",
      "--project-dir",
      paths.project,
      "--print-logs",
    ],
    cwd: paths.root,
    env: controllerEnvironment,
    owner: `expert-squad-evolution:${launch.run_id}`,
    gracefulTerminationMs: 10_000,
  })
  const readinessActivity: EvolutionServerReadinessActivity = {
    lastActivityAt: ProductionEvolutionServerReadinessClock.now(),
  }
  const capture = (chunk: Buffer | string) => {
    output.push(chunk.toString())
    readinessActivity.lastActivityAt = ProductionEvolutionServerReadinessClock.now()
  }
  handle.stdout?.on("data", capture)
  handle.stderr?.on("data", capture)
  try {
    return { handle, output, url: await waitForEvolutionServerURL(output, handle.exited, readinessActivity) }
  } catch (error) {
    try {
      if (error instanceof EvolutionServerExitedBeforeReadinessError) {
        await ProcessSupervisor.disposeAndWaitForExit(handle, "evolution benchmark exited server client", {
          cleanupTimeoutMs: 15_000,
          exitTimeoutMs: 5_000,
        })
      } else {
        await closeControllerService({
          launch,
          paths,
          handle,
          label: "evolution benchmark server readiness",
        })
      }
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Evolution benchmark readiness and controller cleanup failed")
    }
    throw error
  }
}

export type EvolutionBenchmarkRuntime = {
  validateRuntimeIdentity(launch: EvolutionBenchmarkLaunch): Promise<void>
  openServer(
    launch: EvolutionBenchmarkLaunch,
    paths: ReturnType<typeof runPaths>,
  ): Promise<{
    client: ReturnType<typeof createOpenCorvusClient>
    exited: Promise<number>
    close(): Promise<void>
    log(): string
  }>
}

const ProductionEvolutionBenchmarkRuntime: EvolutionBenchmarkRuntime = {
  async validateRuntimeIdentity(launch) {
    if (process.platform !== "linux") throw new Error("Execution Capsule runtime identity requires Linux")
    const expected = RuntimeIdentitySchema.parse(
      JSON.parse((await exactResource(launch.server_isolation.runtime_identity)).toString("utf8")),
    )
    const [kernelRelease, osRelease, systemdRunVersion, namespaceProbe] = await Promise.all([
      readFile("/proc/sys/kernel/osrelease", "utf8").then((value) => value.trim()),
      readFile("/etc/os-release"),
      captureExactHostCommand(launch.server_isolation.systemd_run.path, ["--version"]),
      captureExactHostCommand(launch.server_isolation.unshare.path, [
        "--user",
        "--map-root-user",
        "--mount",
        "--pid",
        "--fork",
        "--ipc",
        "--uts",
        "--net",
        "/bin/sh",
        "-lc",
        "printf user,mount,pid,ipc,uts,net",
      ]),
    ])
    const actual = RuntimeIdentitySchema.parse({
      protocol: "opencorvus.wsl2-rootless-oci-runtime.v1",
      kernel_release: kernelRelease,
      os_release_sha256: sha256(osRelease),
      systemd_run_version_sha256: sha256(systemdRunVersion),
      namespace_probe: namespaceProbe,
    })
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Execution Capsule runtime identity mismatch: ${JSON.stringify(actual)}`)
    }
  },
  async openServer(launch, paths) {
    const server = await spawnServer(launch, paths)
    return {
      client: createOpenCorvusClient({ baseUrl: server.url, directory: paths.project }),
      exited: server.handle.exited,
      close: () =>
        closeControllerService({
          launch,
          paths,
          handle: server.handle,
          label: "evolution benchmark server",
        }),
      log: () => server.output.join(""),
    }
  },
}

export async function captureExactHostCommand(executable: string, args: string[]) {
  const handle = await ProcessSupervisor.spawnHostCommand({
    executable,
    args,
    cwd: "/",
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: process.env.LANG ?? "C.UTF-8" },
    owner: "execution-capsule-runtime-attestation",
  })
  let stdout = ""
  let stderr = ""
  handle.stdout?.setEncoding("utf8")
  handle.stderr?.setEncoding("utf8")
  handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
  handle.stderr?.on("data", (chunk) => (stderr += String(chunk)))
  const code = await handle.exited
  await ProcessSupervisor.disposeAndWaitForExit(handle, `runtime attestation ${executable}`)
  if (code !== 0) throw new Error(`Runtime attestation ${executable} exited ${code}: ${stderr.trim()}`)
  return stdout.trim()
}

function sameOccurrence(left: z.infer<typeof ActivityCursorSchema>, right: z.infer<typeof ActivityCursorSchema>) {
  return left.activity_sha256 === right.activity_sha256
}

export async function monitorEvolutionBenchmarkInactivity(input: {
  client: ReturnType<typeof createOpenCorvusClient>
  launch: EvolutionBenchmarkLaunch
  checkpointPath: string
  configSHA256: string
  initial: EvolutionBenchmarkCheckpoint
  exited: Promise<number>
  clock: EvolutionBenchmarkInactivityClock
}) {
  let checkpoint = input.initial
  for (;;) {
    const remaining = Math.max(0, checkpoint.inactivity_deadline_ms - input.clock.now())
    const outcome = await Promise.race([
      input.clock.sleep(remaining).then(() => ({ kind: "timer" as const })),
      input.exited.then((code) => ({ kind: "exit" as const, code })),
    ])
    if (outcome.kind === "exit") throw new Error(`OpenCorvus server exited during benchmark with code ${outcome.code}`)
    const cursor = ActivityCursorSchema.parse(
      (await input.client.mission.activityCursor({ missionID: input.launch.mission_id }, { throwOnError: true })).data,
    )
    if (sameOccurrence(cursor, checkpoint.cursor)) {
      const observedAt = input.clock.now()
      if (observedAt >= checkpoint.inactivity_deadline_ms) {
        return {
          checkpoint,
          outcome: EvolutionBenchmarkTerminalOutcomeSchema.parse({
            status: "inactive",
            reason: "inactivity_timeout",
            observed_at_ms: observedAt,
            inactivity_deadline_ms: checkpoint.inactivity_deadline_ms,
            inactivity_delta_ms: observedAt - checkpoint.inactivity_deadline_ms,
          }),
        }
      }
      continue
    }
    checkpoint = CheckpointSchema.parse({
      schema_version: 1,
      config_sha256: input.configSHA256,
      run_id: input.launch.run_id,
      mission_id: input.launch.mission_id,
      session_id: cursor.session_id,
      cursor,
      inactivity_deadline_ms: cursor.time_updated + input.launch.inactivity_window_ms,
    })
    await writeFile(input.checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8")
  }
}

async function exportResult(input: {
  client: ReturnType<typeof createOpenCorvusClient>
  launch: EvolutionBenchmarkLaunch
  settled: Awaited<ReturnType<typeof monitorEvolutionBenchmarkInactivity>>
  paths: ReturnType<typeof runPaths>
}) {
  const [status, turnArtifacts] = await Promise.all([
    input.client.mission.status({ missionID: input.launch.mission_id }, { throwOnError: true }),
    input.client.session.turnArtifacts({ sessionID: input.settled.checkpoint.session_id }, { throwOnError: true }),
  ])
  const result = {
    schema_version: 1,
    run_id: input.launch.run_id,
    credential_source_identity: input.launch.credential_source_identity,
    model: input.launch.model,
    target_package: input.launch.target_package,
    evolution_lab_package: input.launch.evolution_lab_package,
    benchmark_outcome: input.settled.outcome,
    terminal_inactivity_cursor: input.settled.checkpoint.cursor,
    mission_status: status.data,
    turn_artifacts: turnArtifacts.data,
  }
  await writeFile(input.paths.result, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" })
}

async function validateRunningCatalog(
  client: ReturnType<typeof createOpenCorvusClient>,
  launch: EvolutionBenchmarkLaunch,
) {
  const catalog = z
    .object({
      installations: z.array(z.object({ id: z.string(), package_digest: SHA256 }).passthrough()),
    })
    .passthrough()
    .parse((await client.expertSquad.catalog({}, { throwOnError: true })).data)
  const runtimeDigests = new Map(catalog.installations.map((item) => [item.id, item.package_digest]))
  if (runtimeDigests.get("evolution-lab") !== launch.evolution_lab_package.package_digest) {
    throw new Error("Running server Evolution Lab digest does not match the frozen launch envelope")
  }
  if (runtimeDigests.get(launch.target_package.id) !== launch.target_package.package_digest) {
    throw new Error("Running server target package digest does not match the frozen launch envelope")
  }
}

async function runWithServer(input: {
  launch: EvolutionBenchmarkLaunch
  configSHA256: string
  paths: ReturnType<typeof runPaths>
  checkpoint: z.infer<typeof CheckpointSchema>
  runtime: EvolutionBenchmarkRuntime
}) {
  const server = await input.runtime.openServer(input.launch, input.paths)
  try {
    const client = server.client
    await validateRunningCatalog(client, input.launch)
    const current = ActivityCursorSchema.parse(
      (await client.mission.activityCursor({ missionID: input.launch.mission_id }, { throwOnError: true })).data,
    )
    const checkpoint = CheckpointSchema.parse({ ...input.checkpoint, cursor: current })
    checkpoint.inactivity_deadline_ms = current.time_updated + input.launch.inactivity_window_ms
    await writeFile(input.paths.checkpoint, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8")
    const settled = await monitorEvolutionBenchmarkInactivity({
      client,
      launch: input.launch,
      checkpointPath: input.paths.checkpoint,
      configSHA256: input.configSHA256,
      initial: checkpoint,
      exited: server.exited,
      clock: ProductionEvolutionBenchmarkInactivityClock,
    })
    await exportResult({ client, launch: input.launch, settled, paths: input.paths })
  } finally {
    await server.close()
    await writeFile(input.paths.log, server.log(), "utf8")
  }
}

export async function startEvolutionBenchmark(
  configPath: string,
  runtime: EvolutionBenchmarkRuntime = ProductionEvolutionBenchmarkRuntime,
) {
  const { launch, configSHA256 } = await readLaunch(configPath)
  const paths = runPaths(launch)
  await requireMissing(paths.root)
  await runtime.validateRuntimeIdentity(launch)
  await validateLaunchInputs(launch)
  await Promise.all([mkdir(paths.root, { recursive: true }), mkdir(paths.home, { recursive: true }), mkdir(paths.temporary, { recursive: true })])
  await copyProjectSeed(launch, paths.project)
  await writeFile(paths.runtimeConfig, await exactResource(launch.runtime_config), { flag: "wx" })
  await Promise.all([
    exactResource(launch.mission_request),
    exactResource(launch.permission_snapshot),
    exactResource(launch.statistics_contract),
    ...launch.scorer_assets.map(exactResource),
    copyDevelopmentClosure(launch, paths.project),
    copyFrozenControlResources(launch, paths.project),
    copyExecutionCapsuleRuntime(launch, paths),
  ])
  await validatePersistedExecutionCapsuleRuntime(launch, paths)
  const server = await runtime.openServer(launch, paths)
  try {
    const client = server.client
    const evolutionLab = z
      .object({
        after: z.object({
          namespace: z.literal("builtin"),
          id: z.literal("evolution-lab"),
          installationScope: z.literal("project"),
          packageDigest: SHA256,
        }),
      })
      .passthrough()
      .parse(
        (
          await client.expertSquad.installPayload(
            {
              id: "evolution-lab",
              installationScope: "project",
            },
            { throwOnError: true },
          )
        ).data,
      )
    if (evolutionLab.after.packageDigest !== launch.evolution_lab_package.package_digest) {
      throw new Error("Installed Evolution Lab payload does not match the frozen benchmark identity")
    }
    const imported = await client.expertSquad.importFolder(
      {
        sourceDirectory: paths.targetPackage,
        installationScope: "project",
      },
      { throwOnError: true },
    )
    const installed = z
      .object({
        after: z.object({ namespace: z.string(), id: z.string(), packageDigest: SHA256 }),
      })
      .passthrough()
      .parse(imported.data)
    if (
      installed.after.namespace !== launch.target_package.namespace ||
      installed.after.id !== launch.target_package.id ||
      installed.after.packageDigest !== launch.target_package.package_digest
    ) {
      throw new Error("Imported target package does not match the frozen benchmark identity")
    }
    await validateRunningCatalog(client, launch)
    const wake = await client.mission.wake(
      {
        missionID: launch.mission_id,
        text: await missionRequestText(launch, paths),
        model: launch.model,
        expertSquadIDs: ["evolution-lab", launch.target_package.id],
      },
      { throwOnError: true },
    )
    const accepted = z.object({ missionID: z.string(), sessionID: z.string(), created: z.literal(true) }).parse(wake.data)
    const cursor = ActivityCursorSchema.parse(
      (await client.mission.activityCursor({ missionID: launch.mission_id }, { throwOnError: true })).data,
    )
    const checkpoint = CheckpointSchema.parse({
      schema_version: 1,
      config_sha256: configSHA256,
      run_id: launch.run_id,
      mission_id: accepted.missionID,
      session_id: accepted.sessionID,
      cursor,
      inactivity_deadline_ms: cursor.time_updated + launch.inactivity_window_ms,
    })
    await writeFile(paths.checkpoint, `${JSON.stringify(checkpoint, null, 2)}\n`, { flag: "wx" })
    const settled = await monitorEvolutionBenchmarkInactivity({
      client,
      launch,
      checkpointPath: paths.checkpoint,
      configSHA256,
      initial: checkpoint,
      exited: server.exited,
      clock: ProductionEvolutionBenchmarkInactivityClock,
    })
    await exportResult({ client, launch, settled, paths })
  } finally {
    await server.close()
    await writeFile(paths.log, server.log(), "utf8")
  }
}

export async function resumeEvolutionBenchmark(
  configPath: string,
  runtime: EvolutionBenchmarkRuntime = ProductionEvolutionBenchmarkRuntime,
) {
  const { launch, configSHA256 } = await readLaunch(configPath)
  const paths = runPaths(launch)
  await requireResumableRun(paths)
  await runtime.validateRuntimeIdentity(launch)
  await validatePersistedExecutionCapsuleRuntime(launch, paths)
  const isolatedRuntimeConfig = await readFile(paths.runtimeConfig)
  if (sha256(isolatedRuntimeConfig) !== launch.runtime_config.sha256) {
    throw new Error("Persisted isolated runtime config digest does not match the frozen launch envelope")
  }
  const checkpoint = CheckpointSchema.parse(JSON.parse(await readFile(paths.checkpoint, "utf8")))
  if (checkpoint.config_sha256 !== configSHA256 || checkpoint.run_id !== launch.run_id) {
    throw new Error("Checkpoint does not belong to the exact launch configuration")
  }
  await runWithServer({ launch, configSHA256, paths, checkpoint, runtime })
}

const commands: Record<string, (configPath: string) => Promise<void>> = {
  start: startEvolutionBenchmark,
  resume: resumeEvolutionBenchmark,
}

if (import.meta.main) {
  const [command, configPath, extra] = process.argv.slice(2)
  const run = command ? commands[command] : undefined
  if (!run || !configPath || extra !== undefined || !path.isAbsolute(configPath)) {
    throw new Error("Usage: bun expert-squad-evolution.ts <start|resume> <absolute-config-path>")
  }
  await run(configPath)
}
