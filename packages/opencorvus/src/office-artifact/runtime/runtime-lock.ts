import z from "zod"

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/)
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

export const OfficeCliRuntimeLockSchema = z
  .object({
    schema_version: z.literal(1),
    runtime: z.literal("OfficeCLI"),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    source: z
      .object({
        repository: z.literal("https://github.com/iOfficeAI/OfficeCLI"),
        tag: z.string().min(1),
        commit: z.string().regex(/^[a-f0-9]{40}$/),
        license: z.literal("Apache-2.0"),
        license_file: z.literal("LICENSE"),
        license_sha256: Sha256,
      })
      .strict(),
    execution_policy: z
      .object({
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
    assets: z
      .array(
        z
          .object({
            os: z.enum(["darwin", "linux", "win32"]),
            arch: z.enum(["arm64", "x64"]),
            abi: z.literal("musl").optional(),
            name: z.string().min(1),
            sha256: Sha256,
          })
          .strict(),
      )
      .length(8),
  })
  .strict()
  .superRefine((lock, ctx) => {
    if (lock.source.tag !== `v${lock.version}`) {
      ctx.addIssue({ code: "custom", path: ["source", "tag"], message: "source tag must match the runtime version" })
    }
    const targets = lock.assets.map((asset) => `${asset.os}-${asset.arch}${asset.abi ? `-${asset.abi}` : ""}`)
    if (new Set(targets).size !== targets.length || targets.some((target) => !OFFICECLI_RUNTIME_TARGETS.has(target))) {
      ctx.addIssue({ code: "custom", path: ["assets"], message: "assets must cover the exact supported target matrix" })
    }
  })

export type OfficeCliRuntimeLock = z.output<typeof OfficeCliRuntimeLockSchema>
export type OfficeCliRuntimeAsset = OfficeCliRuntimeLock["assets"][number]

export function parseOfficeCliRuntimeLock(raw: unknown): OfficeCliRuntimeLock {
  return OfficeCliRuntimeLockSchema.parse(raw)
}

export function officeCliRuntimeLabel(lock: OfficeCliRuntimeLock): string {
  return `${lock.runtime} v${lock.version}`
}
