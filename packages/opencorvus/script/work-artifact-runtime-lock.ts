import fs from "node:fs"
import path from "node:path"
import {
  officeCliRuntime,
  parseWorkArtifactRuntimeLock,
  type OfficeCliRuntimeAsset,
  type WorkArtifactRuntimeLock,
} from "../src/work-artifact/runtime/runtime-lock"
import type { ArtifactNodeRuntimeTarget } from "./build-artifact"

export type { OfficeCliRuntimeAsset, WorkArtifactRuntimeLock }

export const WORK_ARTIFACT_RUNTIME_LOCK_PATH = path.resolve(
  import.meta.dir,
  "../runtime/work-artifact-runtimes.lock.json",
)

export const WORK_ARTIFACT_RUNTIME_LOCK = Object.freeze(
  parseWorkArtifactRuntimeLock(JSON.parse(fs.readFileSync(WORK_ARTIFACT_RUNTIME_LOCK_PATH, "utf8"))),
)

const officeCli = officeCliRuntime(WORK_ARTIFACT_RUNTIME_LOCK)
export const OFFICECLI_RUNTIME_VERSION = officeCli.version

function targetKey(target: Pick<ArtifactNodeRuntimeTarget, "os" | "arch" | "abi">): string {
  return `${target.os}-${target.arch}${target.abi ? `-${target.abi}` : ""}`
}

const assetsByTarget = new Map<string, OfficeCliRuntimeAsset>()
for (const asset of officeCli.assets) {
  const key = targetKey(asset)
  if (assetsByTarget.has(key)) throw new Error(`OfficeCLI runtime lock repeats target ${key}`)
  assetsByTarget.set(key, Object.freeze({ ...asset }))
}

export function officeCliRuntimeAsset(target: ArtifactNodeRuntimeTarget): OfficeCliRuntimeAsset {
  const key = targetKey(target)
  const asset = assetsByTarget.get(key)
  if (!asset) throw new Error(`OfficeCLI v${OFFICECLI_RUNTIME_VERSION} has no pinned runtime for ${key}`)
  return asset
}

export function officeCliReleaseAssetUrl(asset: OfficeCliRuntimeAsset): string {
  return `${officeCli.source.repository}/releases/download/${officeCli.source.tag}/${asset.name}`
}

export function officeCliSourceDataAssetUrl(asset: (typeof officeCli.source.data_assets)[number]): string {
  return `${officeCli.source.repository}/raw/${officeCli.source.commit}/${asset.source_file}`
}
