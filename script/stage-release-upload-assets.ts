#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import {
  cliArchiveNames,
  looksLikeOverlayBundle,
  overlayBundlePatterns,
  overlayUpdaterContract,
  updaterSignatureName,
} from "./release-asset-contract"

function arg(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : ""
  if (!value) throw new Error(`missing required ${name}`)
  return value
}

const sourceRoot = path.resolve(arg("--source"))
const outRoot = path.resolve(arg("--out"))
const releaseVersion = arg("--version").replace(/^v(?=\d)/, "")

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(fullPath)
    } else if (entry.isFile()) {
      yield fullPath
    }
  }
}

function downloadedArtifactName(file: string): string {
  const relative = path.relative(sourceRoot, file).replace(/\\/g, "/")
  return relative.split("/", 1)[0] ?? ""
}

function stagedName(file: string): string | undefined {
  const artifact = downloadedArtifactName(file)
  const basename = path.basename(file)
  if (artifact.startsWith("overlay-")) {
    const platform = artifact.slice("overlay-".length)
    const allowed = overlayBundlePatterns(platform, releaseVersion)
    if (allowed.some(({ pattern }) => pattern.test(basename))) return basename
    const updater = overlayUpdaterContract(platform, releaseVersion)
    if (basename.endsWith(".sig") && updater.bundlePattern.test(basename.slice(0, -4))) return basename
    if (looksLikeOverlayBundle(basename)) {
      throw new Error(`Overlay bundle does not match release ${releaseVersion} for ${platform}: ${basename}`)
    }
    return undefined
  }
  if (artifact.startsWith("cli-")) {
    const platform = artifact.slice("cli-".length)
    return cliArchiveNames(platform).includes(basename) ? basename : undefined
  }
  throw new Error(`unexpected downloaded artifact directory for release upload: ${artifact}`)
}

await fs.mkdir(outRoot, { recursive: true })

const staged: string[] = []
const stagedByArtifact = new Map<string, string[]>()
for await (const file of walk(sourceRoot)) {
  const artifact = downloadedArtifactName(file)
  const asset = stagedName(file)
  if (!asset) continue
  const target = path.join(outRoot, asset)
  try {
    await fs.lstat(target)
    throw new Error(`Duplicate release asset name after staging: ${asset}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  await fs.copyFile(file, target)
  staged.push(asset)
  stagedByArtifact.set(artifact, [...(stagedByArtifact.get(artifact) ?? []), asset])
}

if (staged.length === 0) throw new Error(`No release upload assets staged from ${sourceRoot}`)
for (const [artifact, assets] of stagedByArtifact) {
  if (artifact.startsWith("overlay-")) {
    const platform = artifact.slice("overlay-".length)
    for (const { label, pattern } of overlayBundlePatterns(platform, releaseVersion)) {
      if (!assets.some((asset) => pattern.test(asset))) {
        throw new Error(`Missing ${label} in downloaded artifact ${artifact}`)
      }
    }
    const updater = overlayUpdaterContract(platform, releaseVersion)
    const updaterBundles = assets.filter((asset) => updater.bundlePattern.test(asset))
    if (updaterBundles.length !== 1) {
      throw new Error(`${updater.label} must resolve to exactly one asset in downloaded artifact ${artifact}`)
    }
    const signature = updaterSignatureName(updaterBundles[0]!)
    if (!assets.includes(signature)) {
      throw new Error(`Missing ${updater.label} signature in downloaded artifact ${artifact}: ${signature}`)
    }
    continue
  }
  const platform = artifact.slice("cli-".length)
  const missing = cliArchiveNames(platform).filter((asset) => !assets.includes(asset))
  if (missing.length > 0) throw new Error(`Missing CLI release archives in ${artifact}: ${missing.join(", ")}`)
}
for (const asset of staged.sort()) console.log(asset)
