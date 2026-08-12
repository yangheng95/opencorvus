import { createHash } from "node:crypto"
import z from "zod"

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/)
export const WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH = "licenses/WORK-ARTIFACT-RUNTIMES-LOCK.json" as const
const OFFICECLI_RUNTIME_TARGETS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-arm64",
  "linux-x64",
  "linux-arm64-musl",
  "linux-x64-musl",
  "win32-arm64",
  "win32-x64",
])

const RuntimeAssetSchema = z
  .object({
    os: z.enum(["darwin", "linux", "win32"]),
    arch: z.enum(["arm64", "x64"]),
    abi: z.literal("musl").optional(),
    name: z.string().min(1),
    sha256: Sha256,
    max_download_bytes: z.number().int().positive(),
    package_path: z.string().min(1),
    kind: z.literal("executable"),
  })
  .strict()

const RuntimeDataAssetSchema = z
  .object({
    source_file: z.enum(["LICENSE", "NOTICE", "THIRD-PARTY-NOTICES.txt"]),
    sha256: Sha256,
    max_download_bytes: z.number().int().positive(),
    package_path: z.string().min(1),
    kind: z.literal("data"),
  })
  .strict()

const OfficeCliRuntimeSchema = z
  .object({
    id: z.literal("officecli"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    profiles: z.tuple([z.literal("office.presentation@1")]),
    source: z
      .object({
        repository: z.literal("https://github.com/iOfficeAI/OfficeCLI"),
        tag: z.string().min(1),
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        license: z.literal("Apache-2.0"),
        data_assets: z.array(RuntimeDataAssetSchema).length(3),
      })
      .strict(),
    execution_policy: z
      .object({
        network: z.literal("adapter_inputs_only"),
        input_enforcement: z.literal("canonical-attachments-and-isolated-home@1"),
        allow_installer: z.literal(false),
        allow_mcp_server: z.literal(false),
        allow_resident_process: z.literal(false),
        allow_update: z.literal(false),
        environment: z
          .object({
            OFFICECLI_NO_AUTO_RESIDENT: z.literal("1"),
            OFFICECLI_SKIP_UPDATE: z.literal("1"),
          })
          .strict(),
      })
      .strict(),
    smoke_argv: z.array(z.string().min(1)).min(1),
    assets: z.array(RuntimeAssetSchema).length(8),
  })
  .strict()
  .superRefine((runtime, ctx) => {
    if (runtime.source.tag !== `v${runtime.version}`) {
      ctx.addIssue({ code: "custom", path: ["source", "tag"], message: "source tag must match runtime version" })
    }
    const targets = runtime.assets.map(
      (asset) => `${asset.os}-${asset.arch}${asset.abi ? `-${asset.abi}` : ""}`,
    )
    if (new Set(targets).size !== targets.length || targets.some((target) => !OFFICECLI_RUNTIME_TARGETS.has(target))) {
      ctx.addIssue({ code: "custom", path: ["assets"], message: "assets must cover the exact supported target matrix" })
    }
    const dataFiles = runtime.source.data_assets.map((asset) => asset.source_file)
    if (
      new Set(dataFiles).size !== 3 ||
      !["LICENSE", "NOTICE", "THIRD-PARTY-NOTICES.txt"].every((name) => dataFiles.includes(name as typeof dataFiles[number])) ||
      new Set(runtime.source.data_assets.map((asset) => asset.package_path)).size !== 3
    ) {
      ctx.addIssue({ code: "custom", path: ["source", "data_assets"], message: "source data assets must cover the exact license and notice closure" })
    }
  })

export const WorkArtifactRuntimeLockSchema = z
  .object({
    schema_version: z.literal(1),
    packaged_lock_path: z.literal(WORK_ARTIFACT_RUNTIME_LOCK_PACKAGE_PATH),
    runtimes: z.tuple([OfficeCliRuntimeSchema]),
  })
  .strict()

export type WorkArtifactRuntimeLock = z.output<typeof WorkArtifactRuntimeLockSchema>
export type OfficeCliRuntime = WorkArtifactRuntimeLock["runtimes"][number]
export type OfficeCliRuntimeAsset = OfficeCliRuntime["assets"][number]

export function parseWorkArtifactRuntimeLock(raw: unknown): WorkArtifactRuntimeLock {
  return WorkArtifactRuntimeLockSchema.parse(raw)
}

export function workArtifactRuntimeLockRevision(lock: WorkArtifactRuntimeLock): string {
  return createHash("sha256").update(JSON.stringify(lock)).digest("hex")
}

export function officeCliRuntime(lock: WorkArtifactRuntimeLock): OfficeCliRuntime {
  return lock.runtimes[0]
}

export function officeCliRuntimeIdentity(lock: WorkArtifactRuntimeLock): {
  id: "officecli"
  label: string
  lockRevision: string
  version: string
} {
  const runtime = officeCliRuntime(lock)
  return {
    id: runtime.id,
    label: `OfficeCLI v${runtime.version}`,
    lockRevision: workArtifactRuntimeLockRevision(lock),
    version: runtime.version,
  }
}
