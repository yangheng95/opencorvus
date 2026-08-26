import fs from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"

const RestorePayload = z
  .object({
    packageRoot: z.string().min(1),
    /** The targets that existed before this generation, and therefore have a
     *  backup to restore from. */
    existingTargets: z.array(z.string()),
  })
  .strict()
import path from "node:path"

async function removeWithRetry(target: string) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await fs.rm(target, { force: true, recursive: true })
      return
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(code) || attempt === 20) throw error
      Bun.gc(true)
      await Bun.sleep(100 * attempt)
    }
  }
}

async function copyDirectoryWithRetry(source: string, target: string) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await fs.cp(source, target, { recursive: true, force: true })
      return
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(code) || attempt === 20) throw error
      Bun.gc(true)
      await Bun.sleep(100 * attempt)
    }
  }
}

async function copyFileWithRetry(source: string, target: string) {
  await fs.mkdir(path.dirname(target), { recursive: true })
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await fs.copyFile(source, target)
      return
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
      if (!["EBUSY", "EUNKNOWN", "EPERM"].includes(code) || attempt === 20) throw error
      Bun.gc(true)
      await Bun.sleep(100 * attempt)
    }
  }
}

async function copyEntryWithRetry(source: string, target: string, kind: "directory" | "file") {
  if (kind === "directory") {
    await copyDirectoryWithRetry(source, target)
    return
  }
  await copyFileWithRetry(source, target)
}

async function pathExists(target: string) {
  try {
    await fs.stat(target)
    return true
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
    if (code === "ENOENT") return false
    throw error
  }
}

function resolveWithinPackage(packageRoot: string, relativePath: string) {
  const root = path.resolve(packageRoot)
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`refusing to operate outside SDK package: ${resolved}`)
  }
  if (resolved === root) {
    throw new Error("refusing to replace SDK package root")
  }
  return resolved
}

async function mirrorDirectory(source: string, target: string) {
  await fs.mkdir(target, { recursive: true })

  const sourceEntries = new Map((await fs.readdir(source, { withFileTypes: true })).map((entry) => [entry.name, entry]))
  const targetEntries = await fs.readdir(target, { withFileTypes: true }).catch((error) => {
    const code =
      error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
    if (code === "ENOENT") return []
    throw error
  })
  for (const entry of targetEntries) {
    if (sourceEntries.has(entry.name)) continue
    await removeWithRetry(path.join(target, entry.name))
  }

  for (const [name, entry] of sourceEntries) {
    const sourcePath = path.join(source, name)
    const targetPath = path.join(target, name)
    if (entry.isDirectory()) {
      await mirrorDirectory(sourcePath, targetPath)
      continue
    }
    if (entry.isFile()) {
      await copyFileWithRetry(sourcePath, targetPath)
      continue
    }
    throw new Error(`unsupported generated SDK entry: ${sourcePath}`)
  }
}

export async function replaceDirectoryAfterSuccessfulBuild(input: {
  packageRoot: string
  stagingRelative: string
  targetRelative: string
  build: (stagingDir: string) => Promise<void>
}) {
  const stagingDir = resolveWithinPackage(input.packageRoot, input.stagingRelative)
  const targetDir = resolveWithinPackage(input.packageRoot, input.targetRelative)
  const backupDir = resolveWithinPackage(input.packageRoot, `${input.stagingRelative}-backup`)

  await removeWithRetry(stagingDir)
  await removeWithRetry(backupDir)
  try {
    await input.build(stagingDir)
  } catch (error) {
    await removeWithRetry(stagingDir).catch(() => undefined)
    throw error
  }

  const hadTarget = await pathExists(targetDir)
  if (hadTarget) await copyDirectoryWithRetry(targetDir, backupDir)
  try {
    await mirrorDirectory(stagingDir, targetDir)
  } catch (error) {
    await removeWithRetry(targetDir).catch(() => undefined)
    if (hadTarget) await copyDirectoryWithRetry(backupDir, targetDir)
    throw error
  }
  await removeWithRetry(stagingDir)
  await removeWithRetry(backupDir)
}

const GENERATION_KIND = "sdk-generation"

function generationStore(packageRoot: string): DurablePublicationStore {
  return new DurablePublicationStore(path.join(packageRoot, ".generation-journal"))
}

type GenerationArtifact = {
  targetRelative: string
  targetPath: string
  backupPath: string
  kind: "directory" | "file"
}

/**
 * Converge a generation that never settled.
 *
 * A generation publishes several final targets — the SDK client, the OpenAPI
 * document, the generated route policy — and it used to copy them one at a
 * time with an in-memory record of which had existed. A death partway
 * through therefore left a MIXED generation on disk, and the next build
 * opened by deleting the backup directory, which was the only evidence of
 * what the previous complete generation had been. Recovery now runs first
 * and restores every target from that backup, so a build always starts from
 * one whole generation.
 */
async function convergeUnsettledGeneration(packageRoot: string, artifacts: GenerationArtifact[]): Promise<boolean> {
  const store = generationStore(packageRoot)
  const open = await store.listOpen(GENERATION_KIND).catch(() => [])
  if (open.length === 0) return false
  for (const occurrence of open) {
    const restored = RestorePayload.safeParse(occurrence.intent.payload)
    if (!restored.success) {
      throw new Error(
        `SDK generation journal ${occurrence.intent.occurrenceID} carries an unreadable intent; resolve it by hand`,
      )
    }
    for (const artifact of artifacts) {
      const hadTarget = restored.data.existingTargets.includes(artifact.targetRelative)
      await removeWithRetry(artifact.targetPath).catch(() => undefined)
      if (hadTarget && (await pathExists(artifact.backupPath))) {
        await copyEntryWithRetry(artifact.backupPath, artifact.targetPath, artifact.kind)
      }
    }
    await store.settle(GENERATION_KIND, {
      occurrenceID: occurrence.intent.occurrenceID,
      outcome: "rolled_back",
      payload: { reason: "generation did not settle; restored the previous complete generation" },
      timeCreated: Date.now(),
    })
    await store.removeSettled(GENERATION_KIND, occurrence.intent.occurrenceID).catch(() => undefined)
  }
  return true
}

export async function replaceGeneratedArtifactsAfterSuccessfulBuild(input: {
  packageRoot: string
  stagingRelative: string
  artifacts: {
    stagingRelative: string
    targetRelative: string
    kind: "directory" | "file"
  }[]
  build: (stagingRoot: string) => Promise<void>
}) {
  const stagingRoot = resolveWithinPackage(input.packageRoot, input.stagingRelative)
  const backupRoot = resolveWithinPackage(input.packageRoot, `${input.stagingRelative}-backup`)
  if (input.artifacts.length === 0) throw new Error("generated artifact transaction requires at least one target")

  const artifacts = input.artifacts.map((artifact) => ({
    ...artifact,
    stagingPath: resolveWithinPackage(input.packageRoot, path.join(input.stagingRelative, artifact.stagingRelative)),
    targetPath: resolveWithinPackage(input.packageRoot, artifact.targetRelative),
    backupPath: resolveWithinPackage(input.packageRoot, path.join(`${input.stagingRelative}-backup`, artifact.targetRelative)),
  }))

  // A generation left unsettled by an earlier death is converged BEFORE its
  // backup is deleted — deleting it first destroyed the only evidence of the
  // last complete generation.
  await convergeUnsettledGeneration(input.packageRoot, artifacts)

  await removeWithRetry(stagingRoot)
  await removeWithRetry(backupRoot)
  try {
    await input.build(stagingRoot)
  } catch (error) {
    await removeWithRetry(stagingRoot).catch(() => undefined)
    throw error
  }

  const existingTargets = new Map<string, boolean>()
  for (const artifact of artifacts) {
    const exists = await pathExists(artifact.targetPath)
    existingTargets.set(artifact.targetRelative, exists)
    if (exists) await copyEntryWithRetry(artifact.targetPath, artifact.backupPath, artifact.kind)
  }

  // The occurrence commits AFTER the backups exist and BEFORE the first final
  // target is written, so every death from here on is recoverable from the
  // backups this intent names.
  const store = generationStore(input.packageRoot)
  const occurrenceID = randomUUID()
  await store.create({
    occurrenceID,
    kind: GENERATION_KIND,
    subject: `sdk-generation:${input.packageRoot}`,
    payload: RestorePayload.parse({
      packageRoot: input.packageRoot,
      existingTargets: artifacts
        .filter((artifact) => existingTargets.get(artifact.targetRelative))
        .map((artifact) => artifact.targetRelative),
    }),
    timeCreated: Date.now(),
  })

  try {
    for (const artifact of artifacts) {
      if (artifact.kind === "directory") {
        await mirrorDirectory(artifact.stagingPath, artifact.targetPath)
      } else {
        await copyFileWithRetry(artifact.stagingPath, artifact.targetPath)
      }
    }
  } catch (error) {
    for (const artifact of artifacts) {
      await removeWithRetry(artifact.targetPath).catch(() => undefined)
      if (existingTargets.get(artifact.targetRelative)) {
        await copyEntryWithRetry(artifact.backupPath, artifact.targetPath, artifact.kind)
      }
    }
    await store.settle(GENERATION_KIND, {
      occurrenceID,
      outcome: "rolled_back",
      payload: { reason: error instanceof Error ? error.message : String(error) },
      timeCreated: Date.now(),
    })
    await store.removeSettled(GENERATION_KIND, occurrenceID).catch(() => undefined)
    throw error
  }
  // Every final target is published; the generation is whole.
  await store.settle(GENERATION_KIND, {
    occurrenceID,
    outcome: "committed",
    payload: {},
    timeCreated: Date.now(),
  })
  await removeWithRetry(stagingRoot)
  await removeWithRetry(backupRoot)
  await store.removeSettled(GENERATION_KIND, occurrenceID).catch(() => undefined)
}
