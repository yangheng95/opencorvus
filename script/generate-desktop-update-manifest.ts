#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import {
  canonicalDesktopUpdateManifestVersion,
  canonicalDesktopUpdatePublicationDate,
  DESKTOP_UPDATE_PLATFORMS,
  type DesktopUpdateManifest,
} from "./desktop-update-manifest"
import { overlayUpdaterContract, updaterSignatureName } from "./release-asset-contract"

type DesktopUpdatePlatform = (typeof DESKTOP_UPDATE_PLATFORMS)[number]

export interface DesktopUpdateManifestInput {
  directory: string
  version: string
  repository: string
  publicationDate: string
  notes?: string
}

/**
 * The one bundle for this platform, or nothing when the platform is absent.
 *
 * A Release may ship without a platform: one runner failing used to discard
 * every other platform's finished build, so publication now proceeds with
 * whatever exists. The updater manifest describes what a client can actually
 * download, and a client on a missing platform simply sees no update — while
 * two bundles matching one pattern still means the staging directory is wrong
 * and is refused.
 */
function singleAssetOrAbsent(files: readonly string[], pattern: RegExp, label: string): string | undefined {
  const matches = files.filter((file) => pattern.test(file))
  if (matches.length > 1) throw new Error(`${label} must resolve to exactly one asset; found ${matches.length}`)
  return matches[0]
}

export async function generateDesktopUpdateManifest(input: DesktopUpdateManifestInput): Promise<DesktopUpdateManifest> {
  const version = canonicalDesktopUpdateManifestVersion(input.version)
  const pubDate = canonicalDesktopUpdatePublicationDate(input.publicationDate)
  const files = await fs.readdir(input.directory)
  const platforms: DesktopUpdateManifest["platforms"] = {}

  for (const platform of DESKTOP_UPDATE_PLATFORMS) {
    const contract = overlayUpdaterContract(platform, version)
    const bundle = singleAssetOrAbsent(files, contract.bundlePattern, contract.label)
    if (!bundle) continue
    const signatureFile = updaterSignatureName(bundle)
    const signature = (await fs.readFile(path.join(input.directory, signatureFile), "utf8")).trim()
    if (!signature) throw new Error(`Desktop updater signature is empty: ${signatureFile}`)
    platforms[contract.target] = {
      url: `https://github.com/${input.repository}/releases/download/v${version}/${encodeURIComponent(bundle)}`,
      signature,
    }
  }

  // Every platform absent means the staging directory holds no overlay bundle
  // at all, which is a broken run rather than a partial one.
  if (Object.keys(platforms).length === 0) {
    throw new Error(`Desktop update manifest for v${version} found no overlay bundle in ${input.directory}`)
  }

  return {
    version,
    notes: input.notes?.trim() ?? "",
    pub_date: pubDate,
    platforms,
  }
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1]?.trim() : ""
  if (!value) throw new Error(`Missing required ${name}`)
  return value
}

if (import.meta.main) {
  const directory = path.resolve(requiredArg("--dir"))
  const output = path.resolve(requiredArg("--out"))
  const notesFileIndex = process.argv.indexOf("--notes-file")
  const notes =
    notesFileIndex >= 0 && process.argv[notesFileIndex + 1]
      ? await fs.readFile(path.resolve(process.argv[notesFileIndex + 1]!), "utf8")
      : ""
  const manifest = await generateDesktopUpdateManifest({
    directory,
    version: requiredArg("--version"),
    repository: requiredArg("--repository"),
    publicationDate: requiredArg("--pub-date"),
    notes,
  })
  await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(output)
}
