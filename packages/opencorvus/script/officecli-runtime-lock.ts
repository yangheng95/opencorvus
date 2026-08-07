import fs from "node:fs"
import path from "node:path"
import {
  parseOfficeCliRuntimeLock,
  type OfficeCliRuntimeAsset,
  type OfficeCliRuntimeLock,
} from "../src/office-artifact/runtime/runtime-lock"
import type { ArtifactNodeRuntimeTarget } from "./build-artifact"

export type { OfficeCliRuntimeAsset, OfficeCliRuntimeLock }

export const OFFICECLI_RUNTIME_LOCK_PATH = path.resolve(import.meta.dir, "../runtime/officecli.lock.json")

export const OFFICECLI_RUNTIME_LOCK = Object.freeze(
  parseOfficeCliRuntimeLock(JSON.parse(fs.readFileSync(OFFICECLI_RUNTIME_LOCK_PATH, "utf8"))),
)

export const OFFICECLI_RUNTIME_VERSION = OFFICECLI_RUNTIME_LOCK.version

function targetKey(target: Pick<ArtifactNodeRuntimeTarget, "os" | "arch" | "abi">): string {
  return `${target.os}-${target.arch}${target.abi ? `-${target.abi}` : ""}`
}

const assetsByTarget = new Map<string, OfficeCliRuntimeAsset>()
for (const asset of OFFICECLI_RUNTIME_LOCK.assets) {
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
  return `${OFFICECLI_RUNTIME_LOCK.source.repository}/releases/download/${OFFICECLI_RUNTIME_LOCK.source.tag}/${asset.name}`
}

export function officeCliLicenseUrl(): string {
  return `${OFFICECLI_RUNTIME_LOCK.source.repository}/raw/${OFFICECLI_RUNTIME_LOCK.source.tag}/${OFFICECLI_RUNTIME_LOCK.source.license_file}`
}
