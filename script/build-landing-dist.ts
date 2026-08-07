#!/usr/bin/env bun

import { $ } from "bun"
import archiver from "archiver"
import { createWriteStream } from "node:fs"
import { copyFile, mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"
import {
  discoverLandingBinaryDownloads,
  type LandingBinaryDownload,
} from "../packages/web/src/lib/landing-download"

export type LandingArtifactCopyResult = {
  platform: LandingBinaryDownload["platform"]
  sourcePath: string
  destinationPath: string
  bytes: number
}

export type LandingDistArchiveResult = {
  archivePath: string
  bytes: number
  entries: string[]
}

async function inventoryFiles(root: string, relativeRoot = ""): Promise<string[]> {
  const directory = path.join(root, relativeRoot)
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const relativePath = path.join(relativeRoot, entry.name)
    if (entry.isDirectory()) files.push(...(await inventoryFiles(root, relativePath)))
    if (entry.isFile()) files.push(relativePath.replaceAll("\\", "/"))
  }
  return files.sort((left, right) => left.localeCompare(right))
}

async function copyLandingArtifact(contract: LandingBinaryDownload): Promise<LandingArtifactCopyResult> {
  const sourcePath = path.join(contract.sourceDirectory, contract.sourceFileName)
  const destinationPath = path.join(contract.destinationDirectory, contract.downloadFileName)
  const sourceStat = await stat(sourcePath)
  if (!sourceStat.isFile() || sourceStat.size !== contract.bytes) {
    throw new Error(`Landing ${contract.platform} installer changed after discovery: ${sourcePath}`)
  }

  await mkdir(contract.destinationDirectory, { recursive: true })
  await copyFile(sourcePath, destinationPath)
  const destinationStat = await stat(destinationPath)
  if (!destinationStat.isFile() || destinationStat.size !== sourceStat.size) {
    throw new Error(`Landing ${contract.platform} installer copy does not match its source: ${destinationPath}`)
  }

  return {
    platform: contract.platform,
    sourcePath,
    destinationPath,
    bytes: destinationStat.size,
  }
}

export async function copyLandingBinaryArtifacts(
  repoRoot: string,
  contracts: readonly LandingBinaryDownload[] = discoverLandingBinaryDownloads(repoRoot),
): Promise<LandingArtifactCopyResult[]> {
  await rm(path.resolve(repoRoot, "packages/web/dist/downloads"), { recursive: true, force: true })
  return Promise.all(contracts.map((contract) => copyLandingArtifact(contract)))
}

export async function createLandingDistArchive(repoRoot: string): Promise<LandingDistArchiveResult> {
  const distRoot = path.resolve(repoRoot, "packages/web/dist")
  const archivePath = path.resolve(repoRoot, "packages/web/dist.zip")
  const temporaryArchivePath = `${archivePath}.tmp`
  const distStat = await stat(distRoot)
  if (!distStat.isDirectory()) throw new Error(`Landing dist is not a directory: ${distRoot}`)
  const entries = (await inventoryFiles(distRoot)).map((entry) => `dist/${entry}`)

  await rm(temporaryArchivePath, { force: true })
  const output = createWriteStream(temporaryArchivePath)
  const archive = archiver("zip", { store: true })
  await new Promise<void>((resolve, reject) => {
    output.once("close", resolve)
    output.once("error", reject)
    archive.once("error", reject)
    archive.once("warning", reject)
    archive.pipe(output)
    archive.directory(distRoot, "dist")
    void archive.finalize()
  })

  const temporaryArchiveStat = await stat(temporaryArchivePath)
  if (!temporaryArchiveStat.isFile() || temporaryArchiveStat.size === 0) {
    throw new Error(`Landing dist archive is empty: ${temporaryArchivePath}`)
  }
  await rename(temporaryArchivePath, archivePath)
  return { archivePath, bytes: temporaryArchiveStat.size, entries }
}

if (import.meta.main) {
  const repoRoot = path.resolve(import.meta.dir, "..")
  const downloads = discoverLandingBinaryDownloads(repoRoot)
  await $`bun run --cwd packages/web build`.cwd(repoRoot)
  const copiedArtifacts = await copyLandingBinaryArtifacts(repoRoot, downloads)
  const archive = await createLandingDistArchive(repoRoot)
  console.log(
    JSON.stringify(
      {
        version: downloads[0]!.version,
        copiedArtifacts,
        archive: { archivePath: archive.archivePath, bytes: archive.bytes, fileCount: archive.entries.length },
      },
      null,
      2,
    ),
  )
}
