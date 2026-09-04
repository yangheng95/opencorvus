#!/usr/bin/env bun

import path from "path"
import { desktopUpdateEndpoint } from "./desktop-update-channel"
import { normalizeReleaseVersion, releaseVersionMetadata } from "./release-version"

export { normalizeReleaseVersion, releaseVersionMetadata } from "./release-version"

const root = path.resolve(import.meta.dir, "..")
const canonicalPackage = "packages/opencorvus/package.json"

export const releasePackageTargets = [
  "packages/channel-config/package.json",
  "packages/channel-runtime/package.json",
  canonicalPackage,
  "packages/overlay/package.json",
  "packages/plugin/package.json",
  "packages/sdk/js/package.json",
  "packages/transport-protocol/package.json",
  "packages/util/package.json",
] as const

export const cargoManifestTargets = [
  {
    manifest: "packages/opencorvus/native/process-supervisor/Cargo.toml",
    lock: "packages/opencorvus/native/process-supervisor/Cargo.lock",
    packageName: "opencorvus-process-supervisor",
  },
  {
    manifest: "packages/overlay/src-tauri/Cargo.toml",
    lock: "packages/overlay/src-tauri/Cargo.lock",
    packageName: "opencorvus-overlay",
  },
] as const

const tauriConfigTarget = "packages/overlay/src-tauri/tauri.conf.json"
const bunLockTarget = "bun.lock"

// MSI (Microsoft Installer) accepts only numeric major.minor.patch.build values.
export function windowsMsiVersion(version: string) {
  let canonical: string | undefined
  try {
    canonical = normalizeReleaseVersion(version)
  } catch {
    throw new Error(`Cannot project invalid release version to MSI: ${version}`)
  }
  if (canonical !== version) throw new Error(`Cannot project invalid release version to MSI: ${version}`)
  const match = canonical.match(/^(\d+)\.(\d+)\.(\d+)(?:-(beta))?$/)
  if (!match) throw new Error(`Cannot project invalid release version to MSI: ${version}`)

  const [, majorText, minorText, patchText, prerelease] = match
  const fields = [Number(majorText), Number(minorText), Number(patchText)]
  if (fields[0] > 255 || fields[1] > 255 || fields[2] > 65_535) {
    throw new Error(`Release version exceeds MSI numeric limits: ${version}`)
  }
  if (!prerelease) return fields.join(".")

  return `${fields.join(".")}.0`
}

function absolute(relative: string) {
  return path.join(root, relative)
}

function githubRepositorySlug(pkg: Record<string, unknown>) {
  const repository = pkg.repository
  const url =
    typeof repository === "string"
      ? repository
      : typeof repository === "object" && repository !== null
        ? (repository as Record<string, unknown>).url
        : undefined
  const match = typeof url === "string" ? url.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/) : null
  if (!match) throw new Error("package.json repository must be a GitHub owner/repository URL")
  return match[1]
}

export function synchronizeTauriConfig(text: string, version: string, repository: string) {
  const tauri = JSON.parse(text) as Record<string, unknown>
  const tauriBundle = tauri.bundle as Record<string, unknown> | undefined
  const tauriWindows = tauriBundle?.windows as Record<string, unknown> | undefined
  const tauriWix = tauriWindows?.wix as Record<string, unknown> | undefined
  const tauriPlugins = tauri.plugins as Record<string, unknown> | undefined
  const tauriUpdater = tauriPlugins?.updater as Record<string, unknown> | undefined
  if (!tauriWix) throw new Error(`${tauriConfigTarget} is missing bundle.windows.wix`)
  if (!tauriUpdater) throw new Error(`${tauriConfigTarget} is missing plugins.updater`)

  tauri.version = version
  tauriWix.version = windowsMsiVersion(version)
  tauriUpdater.endpoints = [desktopUpdateEndpoint(repository, version)]
  return JSON.stringify(tauri, null, 2) + "\n"
}

async function readPackageVersion(relative: string) {
  const pkg = (await Bun.file(absolute(relative)).json()) as Record<string, unknown>
  return { pkg, version: typeof pkg.version === "string" ? pkg.version : "" }
}

function cargoManifestVersion(text: string) {
  return text.match(/^version = "([^"]+)"/m)?.[1] ?? ""
}

function cargoLockVersion(text: string, packageName: string) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return text.match(new RegExp(`\\[\\[package\\]\\]\\r?\\nname = "${escaped}"\\r?\\nversion = "([^"]+)"`))?.[1] ?? ""
}

function updateCargoLock(text: string, packageName: string, version: string) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = "${escaped}"\\r?\\nversion = ")[^"]+(")`)
  if (!pattern.test(text)) throw new Error(`Cargo.lock missing package ${packageName}`)
  return text.replace(pattern, `$1${version}$2`)
}

function bunWorkspaceVersion(text: string, workspace: string) {
  const escaped = workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return (
    text.match(new RegExp(`"${escaped}": \\{\\r?\\n\\s+"name": "[^"]+",\\r?\\n\\s+"version": "([^"]+)"`))?.[1] ?? ""
  )
}

function updateBunWorkspaceVersion(text: string, workspace: string, version: string) {
  const escaped = workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`("${escaped}": \\{\\r?\\n\\s+"name": "[^"]+",\\r?\\n\\s+"version": ")[^"]+(")`)
  if (!pattern.test(text)) throw new Error(`bun.lock missing versioned workspace ${workspace}`)
  return text.replace(pattern, `$1${version}$2`)
}

export async function synchronizeVersions(input: { version?: string; check: boolean }) {
  const canonical = await readPackageVersion(canonicalPackage)
  const rootPackage = (await Bun.file(absolute("package.json")).json()) as Record<string, unknown>
  const repository = githubRepositorySlug(rootPackage)
  const version = normalizeReleaseVersion(input.version ?? canonical.version)
  if (!version) throw new Error(`${canonicalPackage} is missing its canonical version`)

  const packages = await Promise.all(
    releasePackageTargets.map(async (relative) => ({ relative, ...(await readPackageVersion(relative)) })),
  )
  const tauriText = await Bun.file(absolute(tauriConfigTarget)).text()
  const tauri = JSON.parse(tauriText) as Record<string, unknown>
  const tauriBundle = tauri.bundle as Record<string, unknown> | undefined
  const tauriWindows = tauriBundle?.windows as Record<string, unknown> | undefined
  const tauriWix = tauriWindows?.wix as Record<string, unknown> | undefined
  const tauriPlugins = tauri.plugins as Record<string, unknown> | undefined
  const tauriUpdater = tauriPlugins?.updater as Record<string, unknown> | undefined
  const updaterEndpoints = tauriUpdater?.endpoints
  const updaterEndpoint = desktopUpdateEndpoint(repository, version)
  const msiVersion = windowsMsiVersion(version)
  const cargos = await Promise.all(
    cargoManifestTargets.map(async (target) => ({
      ...target,
      manifestText: await Bun.file(absolute(target.manifest)).text(),
      lockText: await Bun.file(absolute(target.lock)).text(),
    })),
  )
  const bunLock = await Bun.file(absolute(bunLockTarget)).text()

  const drift: Array<[string, string]> = []
  for (const target of packages) {
    if (target.version !== version) drift.push([target.relative, target.version])
    const workspace = path.posix.dirname(target.relative)
    const locked = bunWorkspaceVersion(bunLock, workspace)
    if (locked !== version) drift.push([`${bunLockTarget}#workspaces.${workspace}`, locked])
  }
  if (String(tauri.version ?? "") !== version) drift.push([tauriConfigTarget, String(tauri.version ?? "")])
  if (String(tauriWix?.version ?? "") !== msiVersion) {
    drift.push([`${tauriConfigTarget}#bundle.windows.wix.version`, String(tauriWix?.version ?? "")])
  }
  if (!Array.isArray(updaterEndpoints) || updaterEndpoints.length !== 1 || updaterEndpoints[0] !== updaterEndpoint) {
    drift.push([
      `${tauriConfigTarget}#plugins.updater.endpoints`,
      Array.isArray(updaterEndpoints) ? JSON.stringify(updaterEndpoints) : "<missing>",
    ])
  }
  for (const target of cargos) {
    const manifestVersion = cargoManifestVersion(target.manifestText)
    const lockVersion = cargoLockVersion(target.lockText, target.packageName)
    if (manifestVersion !== version) drift.push([target.manifest, manifestVersion])
    if (lockVersion !== version) drift.push([`${target.lock}#${target.packageName}`, lockVersion])
  }

  if (input.check) {
    if (drift.length > 0) {
      throw new Error(
        [
          `Version drift detected. Expected ${version}.`,
          ...drift.map(([file, current]) => `- ${file}: ${current || "<missing>"}`),
        ].join("\n"),
      )
    }
    console.log(`Release-family versions aligned at ${version}`)
    return version
  }

  for (const target of packages) {
    target.pkg.version = version
    await Bun.write(absolute(target.relative), JSON.stringify(target.pkg, null, 2) + "\n")
  }
  await Bun.write(absolute(tauriConfigTarget), synchronizeTauriConfig(tauriText, version, repository))

  let updatedBunLock = bunLock
  for (const target of packages) {
    updatedBunLock = updateBunWorkspaceVersion(updatedBunLock, path.posix.dirname(target.relative), version)
  }
  await Bun.write(absolute(bunLockTarget), updatedBunLock)

  for (const target of cargos) {
    await Bun.write(
      absolute(target.manifest),
      target.manifestText.replace(/^version = "[^"]+"/m, `version = "${version}"`),
    )
    await Bun.write(absolute(target.lock), updateCargoLock(target.lockText, target.packageName, version))
  }

  console.log(`Synchronized OpenCorvus release-family versions to ${version}`)
  return version
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  await synchronizeVersions({
    check: args.includes("--check"),
    version: args.find((item) => item !== "--check"),
  })
}
