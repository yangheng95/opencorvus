import fs from "node:fs/promises"
import path from "node:path"
import { $ } from "bun"
import type { ArtifactNodeRuntimeTarget } from "./build-artifact"
import { WORK_ARTIFACT_RUNTIME_LOCK } from "./work-artifact-runtime-lock"
import { inspectArtifactExecutableClosure, normalizeArtifactExecutablePermissions } from "./runtime-executable-contract"
import {
  writeWorkArtifactTargetPackageManifest,
  type WorkArtifactPackageTarget,
} from "../src/work-artifact/runtime/package-manifest"

export async function finalizeWorkArtifactPackage(input: {
  root: string
  target: ArtifactNodeRuntimeTarget
}): Promise<void> {
  await normalizeArtifactExecutablePermissions({ root: input.root, os: input.target.os })
  if (input.target.os === "darwin") {
    const closure = await inspectArtifactExecutableClosure({ root: input.root, os: input.target.os })
    for (const file of closure) {
      await $`codesign --force --sign - ${file.path}`
      await $`codesign --verify --strict --verbose=2 ${file.path}`
    }
  }
  await writeWorkArtifactTargetPackageManifest({
    root: input.root,
    target: input.target as WorkArtifactPackageTarget,
    lock: WORK_ARTIFACT_RUNTIME_LOCK,
    phase: "final",
  })
}

if (import.meta.main) {
  const root = process.argv[2]
  const os = process.argv[3]
  const arch = process.argv[4]
  const abi = process.argv[5]
  if (!root || !["darwin", "linux", "win32"].includes(os ?? "") || !["arm64", "x64"].includes(arch ?? "")) {
    throw new Error("Usage: finalize-work-artifact-package.ts ROOT <darwin|linux|win32> <arm64|x64> [musl]")
  }
  const resolved = path.resolve(root)
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error(`Work Artifact package root is not a directory: ${resolved}`)
  await finalizeWorkArtifactPackage({ root: resolved, target: { os: os!, arch: arch!, ...(abi === "musl" ? { abi } : {}) } })
}
