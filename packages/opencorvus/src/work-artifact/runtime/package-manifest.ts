import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import fs from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"
import z from "zod"
import { officeCliRuntime, workArtifactRuntimeLockRevision, type WorkArtifactRuntimeLock } from "./runtime-lock"

export const WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST = "work-artifact-target-package-manifest.json"
const execFileAsync = promisify(execFile)

const Sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const PackageFileSchema = z
  .object({
    path: z.string().min(1).refine((value) => !path.isAbsolute(value) && !value.split(/[\\/]/).includes("..")),
    // Two kinds, because two is what this manifest can hold: the writer below
    // declares `"executable" | "data"` and no path produces anything else.
    // `shared_library` sat in the enum unreachable, while every rule that
    // reads `kind` — mode 0755 vs 0644, whether `binary_target` is required,
    // whether a signature is required — asks `=== "executable"` and treats the
    // remainder as data. Admitting a shared library through the schema alone
    // would have handed it 0644 and skipped its signature with nothing to
    // fail. Adding it back is a deliberate change to those rules, and this
    // enum is where it starts. Build-time permission normalization has its own
    // richer classifier in `script/runtime-executable-contract.ts`.
    kind: z.enum(["executable", "data"]),
    sha256: Sha256,
    size: z.number().int().nonnegative(),
    mode: z.union([z.literal("0755"), z.literal("0644"), z.null()]),
    binary_target: z
      .object({
        os: z.enum(["darwin", "linux", "win32"]),
        arch: z.enum(["arm64", "x64"]),
      })
      .strict()
      .optional(),
    signature: z
      .discriminatedUnion("status", [
        z.object({ status: z.literal("verified"), identity: z.string().min(1) }).strict(),
        z.object({ status: z.literal("policy_not_required"), identity: z.null() }).strict(),
        z.object({ status: z.literal("not_applicable"), identity: z.null() }).strict(),
        z.object({ status: z.literal("unverified_staging"), identity: z.null() }).strict(),
      ])
      .optional(),
  })
  .strict()

export const WorkArtifactTargetPackageManifestSchema = z
  .object({
    schema_version: z.literal(1),
    phase: z.enum(["staging", "final"]),
    target: z
      .object({
        os: z.enum(["darwin", "linux", "win32"]),
        arch: z.enum(["arm64", "x64"]),
        abi: z.literal("musl").optional(),
      })
      .strict(),
    runtime_lock_revision: Sha256,
    files: z.array(PackageFileSchema).min(1),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const paths = manifest.files.map((file) => file.path.replaceAll("\\", "/"))
    if (new Set(paths).size !== paths.length) {
      ctx.addIssue({ code: "custom", path: ["files"], message: "package file paths must be unique" })
    }
    for (const [index, file] of manifest.files.entries()) {
      const expectedMode = manifest.target.os === "win32" ? null : file.kind === "executable" ? "0755" : "0644"
      if (file.mode !== expectedMode) {
        ctx.addIssue({
          code: "custom",
          path: ["files", index, "mode"],
          message: `package file mode must be ${expectedMode ?? "null"} for ${manifest.target.os}`,
        })
      }
      if (file.kind === "executable" && !file.binary_target) {
        ctx.addIssue({ code: "custom", path: ["files", index, "binary_target"], message: "executable target is required" })
      }
      if (file.kind !== "executable" && file.binary_target) {
        ctx.addIssue({ code: "custom", path: ["files", index, "binary_target"], message: "data files cannot declare a binary target" })
      }
      if (file.kind === "executable" && !file.signature) {
        ctx.addIssue({ code: "custom", path: ["files", index, "signature"], message: "executable signature evidence is required" })
      }
      if (file.kind !== "executable" && file.signature) {
        ctx.addIssue({ code: "custom", path: ["files", index, "signature"], message: "data files cannot declare signature evidence" })
      }
      if (file.kind === "executable" && file.signature) {
        const expected =
          manifest.phase === "staging"
            ? "unverified_staging"
            : manifest.target.os === "darwin"
              ? "verified"
              : manifest.target.os === "win32"
                ? "policy_not_required"
                : "not_applicable"
        if (file.signature.status !== expected) {
          ctx.addIssue({ code: "custom", path: ["files", index, "signature"], message: `signature status must be ${expected}` })
        }
      }
    }
  })

export type WorkArtifactTargetPackageManifest = z.output<typeof WorkArtifactTargetPackageManifestSchema>
export type WorkArtifactPackageTarget = WorkArtifactTargetPackageManifest["target"]

export function workArtifactManagedPackageFiles(input: {
  lock: WorkArtifactRuntimeLock
  target: WorkArtifactPackageTarget
}): ReadonlyArray<{
  path: string
  kind: "executable" | "data"
}> {
  const runtime = officeCliRuntime(input.lock)
  const asset = runtime.assets.find(
    (candidate) =>
      candidate.os === input.target.os &&
      candidate.arch === input.target.arch &&
      candidate.abi === input.target.abi,
  )
  if (!asset) throw new Error(`Work Artifact runtime lock has no OfficeCLI asset for ${JSON.stringify(input.target)}`)
  return Object.freeze([
    { path: asset.package_path, kind: asset.kind },
    ...runtime.source.data_assets.map((data) => ({ path: data.package_path, kind: data.kind })),
    { path: input.lock.packaged_lock_path, kind: "data" as const },
  ])
}

async function sha256File(filename: string): Promise<string> {
  const hash = createHash("sha256")
  const handle = await fs.open(path.toNamespacedPath(filename), "r")
  try {
    for await (const chunk of handle.readableWebStream()) hash.update(chunk)
  } finally {
    await handle.close()
  }
  return hash.digest("hex")
}

async function inspectBinaryTarget(filename: string): Promise<{ os: "darwin" | "linux" | "win32"; arch: "arm64" | "x64" }> {
  const handle = await fs.open(path.toNamespacedPath(filename), "r")
  const header = Buffer.alloc(4096)
  try {
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    if (bytesRead < 20) throw new Error(`Binary header is too short: ${filename}`)
  } finally {
    await handle.close()
  }

  if (header[0] === 0x4d && header[1] === 0x5a) {
    const peOffset = header.readUInt32LE(0x3c)
    if (peOffset + 6 > header.length || header.toString("ascii", peOffset, peOffset + 4) !== "PE\0\0") {
      throw new Error(`Invalid PE header: ${filename}`)
    }
    const machine = header.readUInt16LE(peOffset + 4)
    if (machine === 0x8664) return { os: "win32", arch: "x64" }
    if (machine === 0xaa64) return { os: "win32", arch: "arm64" }
    throw new Error(`Unsupported PE machine 0x${machine.toString(16)}: ${filename}`)
  }

  if (header[0] === 0x7f && header.toString("ascii", 1, 4) === "ELF") {
    const littleEndian = header[5] === 1
    const machine = littleEndian ? header.readUInt16LE(18) : header.readUInt16BE(18)
    if (machine === 62) return { os: "linux", arch: "x64" }
    if (machine === 183) return { os: "linux", arch: "arm64" }
    throw new Error(`Unsupported ELF machine ${machine}: ${filename}`)
  }

  const magic = header.readUInt32BE(0)
  const littleEndian = magic === 0xcffaedfe || magic === 0xcefaedfe
  const bigEndian = magic === 0xfeedfacf || magic === 0xfeedface
  if (littleEndian || bigEndian) {
    const cpu = littleEndian ? header.readUInt32LE(4) : header.readUInt32BE(4)
    if (cpu === 0x01000007) return { os: "darwin", arch: "x64" }
    if (cpu === 0x0100000c) return { os: "darwin", arch: "arm64" }
    throw new Error(`Unsupported Mach-O CPU 0x${cpu.toString(16)}: ${filename}`)
  }
  throw new Error(`Unsupported executable format: ${filename}`)
}

async function executableSignature(input: {
  filename: string
  os: WorkArtifactPackageTarget["os"]
  phase: "staging" | "final"
}) {
  if (input.phase === "staging") return { status: "unverified_staging" as const, identity: null }
  if (input.os === "linux") return { status: "not_applicable" as const, identity: null }
  if (input.os === "win32") return { status: "policy_not_required" as const, identity: null }
  const { stderr } = await execFileAsync("codesign", ["--display", "--verbose=4", input.filename], {
    timeout: 30_000,
  })
  const identity = stderr
    .split(/\r?\n/)
    .filter((line) => /^(?:Identifier|Authority|TeamIdentifier|Signature)=/.test(line))
    .join("; ")
  if (!identity) throw new Error(`codesign returned no identity evidence for ${input.filename}`)
  return { status: "verified" as const, identity }
}

function portableRelativePath(value: string): string {
  return value.replaceAll("\\", "/")
}

export async function writeWorkArtifactTargetPackageManifest(input: {
  root: string
  target: WorkArtifactPackageTarget
  lock: WorkArtifactRuntimeLock
  phase?: "staging" | "final"
}): Promise<WorkArtifactTargetPackageManifest> {
  const phase = input.phase ?? "final"
  const files = [] as WorkArtifactTargetPackageManifest["files"]
  for (const declared of workArtifactManagedPackageFiles({ lock: input.lock, target: input.target })) {
    const filename = path.join(input.root, declared.path)
    const info = await fs.stat(path.toNamespacedPath(filename))
    if (!info.isFile()) throw new Error(`Work Artifact package entry is not a file: ${filename}`)
    const mode = input.target.os === "win32" ? null : declared.kind === "executable" ? "0755" : "0644"
    if (mode !== null && (info.mode & 0o777).toString(8).padStart(4, "0") !== mode) {
      throw new Error(`Work Artifact package entry mode mismatch for ${filename}: expected ${mode}`)
    }
    files.push({
      path: portableRelativePath(declared.path),
      kind: declared.kind,
      sha256: await sha256File(filename),
      size: info.size,
      mode,
      binary_target: declared.kind === "executable" ? await inspectBinaryTarget(filename) : undefined,
      signature:
        declared.kind === "executable"
          ? await executableSignature({ filename, os: input.target.os, phase })
          : undefined,
    })
  }
  const manifest = WorkArtifactTargetPackageManifestSchema.parse({
    schema_version: 1,
    phase,
    target: input.target,
    runtime_lock_revision: workArtifactRuntimeLockRevision(input.lock),
    files,
  })
  const filename = path.join(input.root, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST)
  await fs.writeFile(filename, `${JSON.stringify(manifest, undefined, 2)}\n`, { mode: 0o644 })
  if (input.target.os !== "win32") await fs.chmod(filename, 0o644)
  return manifest
}

export async function verifyWorkArtifactTargetPackageManifest(input: {
  root: string
  target: WorkArtifactPackageTarget
  lock: WorkArtifactRuntimeLock
  requireFinal?: boolean
}): Promise<WorkArtifactTargetPackageManifest> {
  const manifestPath = path.join(input.root, WORK_ARTIFACT_TARGET_PACKAGE_MANIFEST)
  const manifest = WorkArtifactTargetPackageManifestSchema.parse(
    JSON.parse(await fs.readFile(path.toNamespacedPath(manifestPath), "utf8")),
  )
  if (input.requireFinal !== false && manifest.phase !== "final") {
    throw new Error("Work Artifact target package manifest is not a final post-signing manifest")
  }
  if (
    manifest.target.os !== input.target.os ||
    manifest.target.arch !== input.target.arch ||
    manifest.target.abi !== input.target.abi
  ) {
    throw new Error(
      `Work Artifact package target mismatch: expected ${JSON.stringify(input.target)}, received ${JSON.stringify(manifest.target)}`,
    )
  }
  if (manifest.runtime_lock_revision !== workArtifactRuntimeLockRevision(input.lock)) {
    throw new Error("Work Artifact target package manifest runtime lock revision mismatch")
  }
  const expectedPaths = workArtifactManagedPackageFiles({ lock: input.lock, target: input.target }).map((file) =>
    portableRelativePath(file.path),
  )
  if (
    manifest.files.length !== expectedPaths.length ||
    manifest.files.some((file, index) => file.path !== expectedPaths[index])
  ) {
    throw new Error("Work Artifact target package manifest does not contain the exact managed runtime closure")
  }
  for (const file of manifest.files) {
    const filename = path.join(input.root, file.path)
    const info = await fs.stat(path.toNamespacedPath(filename))
    if (!info.isFile() || info.size !== file.size || (await sha256File(filename)) !== file.sha256) {
      throw new Error(`Work Artifact package digest mismatch: ${filename}`)
    }
    if (file.kind === "executable") {
      const target = await inspectBinaryTarget(filename)
      if (
        target.os !== input.target.os ||
        target.arch !== input.target.arch ||
        target.os !== file.binary_target?.os ||
        target.arch !== file.binary_target?.arch
      ) {
        throw new Error(`Work Artifact package binary target mismatch: ${filename}`)
      }
      if (input.target.os === "darwin" && manifest.phase === "final") {
        await execFileAsync("codesign", ["--verify", "--strict", "--verbose=2", filename], { timeout: 30_000 })
        const current = await executableSignature({ filename, os: input.target.os, phase: "final" })
        if (current.status !== "verified" || current.identity !== file.signature?.identity) {
          throw new Error(`Work Artifact package signing identity mismatch: ${filename}`)
        }
      }
    }
    if (input.target.os !== "win32") {
      const actualMode = (info.mode & 0o777).toString(8).padStart(4, "0")
      if (actualMode !== file.mode) throw new Error(`Work Artifact package mode mismatch: ${filename}`)
    }
  }
  return manifest
}
