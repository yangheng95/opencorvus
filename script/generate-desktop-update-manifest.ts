#!/usr/bin/env bun

import fs from "node:fs/promises"
import path from "node:path"
import { overlayUpdaterContract, updaterSignatureName } from "./release-asset-contract"
import { releaseVersionMetadata } from "./sync-version"

export const DESKTOP_UPDATE_PLATFORMS = [
  "linux-x64",
  "linux-arm64",
  "darwin-x64",
  "darwin-arm64",
  "windows-x64",
] as const

type DesktopUpdatePlatform = (typeof DESKTOP_UPDATE_PLATFORMS)[number]

export interface DesktopUpdateManifestInput {
  directory: string
  version: string
  repository: string
  publicationDate: string
  notes?: string
}

export interface DesktopUpdateManifest {
  version: string
  notes: string
  pub_date: string
  platforms: Record<string, { url: string; signature: string }>
}

function normalizedVersion(version: string): string {
  return releaseVersionMetadata(version).version
}

function publicationDate(value: string): string {
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`Desktop update publication date must be canonical RFC 3339 UTC: ${value}`)
  }
  return value
}

function requireSingleAsset(files: readonly string[], pattern: RegExp, label: string): string {
  const matches = files.filter((file) => pattern.test(file))
  if (matches.length !== 1) throw new Error(`${label} must resolve to exactly one asset; found ${matches.length}`)
  return matches[0]!
}

export async function generateDesktopUpdateManifest(input: DesktopUpdateManifestInput): Promise<DesktopUpdateManifest> {
  const version = normalizedVersion(input.version)
  const pubDate = publicationDate(input.publicationDate)
  const files = await fs.readdir(input.directory)
  const platforms: DesktopUpdateManifest["platforms"] = {}

  for (const platform of DESKTOP_UPDATE_PLATFORMS) {
    const contract = overlayUpdaterContract(platform, version)
    const bundle = requireSingleAsset(files, contract.bundlePattern, contract.label)
    const signatureFile = updaterSignatureName(bundle)
    const signature = (await fs.readFile(path.join(input.directory, signatureFile), "utf8")).trim()
    if (!signature) throw new Error(`Desktop updater signature is empty: ${signatureFile}`)
    platforms[contract.target] = {
      url: `https://github.com/${input.repository}/releases/download/v${version}/${encodeURIComponent(bundle)}`,
      signature,
    }
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
