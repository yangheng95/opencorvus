import { cp, lstat, open, readFile, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { DurablePublicationStore, digestFilesystemTree } from "@opencorvus-ai/util/durable-publication"
import { Filesystem } from "@/util/filesystem"
import { NotFoundError } from "@/storage/db"

const KIND = "preservation"
type Journal = {
  operationID: string
  target: string
  backup: string
  staging: string
  discard: string
  installationScope: string
  id: string
  databaseAuthority?: string
}
type Observation = { kind: "absent" } | { kind: "present"; treeDigest: string }

function store(configRoot: string, id: string) {
  // Resource renames stay on the installation's volume, outside disposable staging.
  return new DurablePublicationStore(path.join(configRoot, "durable-publications", "expert-squad-mutations", id))
}

async function exists(file: string) {
  return lstat(file).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
}

async function observe(file: string): Promise<Observation> {
  return (await exists(file)) ? { kind: "present", treeDigest: await digestFilesystemTree(file) } : { kind: "absent" }
}

async function syncCopiedTree(root: string): Promise<void> {
  const state = await lstat(root)
  if (state.isDirectory()) {
    for (const entry of await readdir(root)) await syncCopiedTree(path.join(root, entry))
    await Filesystem.syncDirectoryMetadata(root)
  } else if (state.isFile()) {
    const handle = await open(root, "r+")
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }
}

async function retainJournalBytes(file: string, bytes: string) {
  await Filesystem.writeDurableAtomicIfAbsent(file, bytes, 0o600)
  if ((await readFile(file, "utf8")) !== bytes) throw new Error("Preserved mutation journal bytes conflict")
}

export async function preserveUnknownExpertSquadMutation(input: {
  configRoot: string
  id: string
  journalPath: string
  journalText: string
  journal: Journal
  databaseAuthority: string
}) {
  const publication = store(input.configRoot, input.id)
  const journal = input.journal
  const directory = publication.occurrenceDirectory(KIND, journal.operationID)
  return publication.withSubjectLock(KIND, input.id, async () => {
    const intentExists = await exists(path.join(directory, "intent.json"))
    let occurrence = intentExists ? await publication.read(KIND, journal.operationID) : undefined
    if (!occurrence) {
      const observations = Object.fromEntries(
        await Promise.all(
          (["target", "backup", "staging", "discard"] as const).map(async (key) => [key, await observe(journal[key])]),
        ),
      )
      occurrence = await publication.create({
        occurrenceID: journal.operationID,
        kind: KIND,
        subject: input.id,
        timeCreated: Date.now(),
        payload: {
          protocol: "opencorvus/expert-squad-mutation-preservation@1",
          disposition: "commit_receipt_unavailable",
          journal: JSON.parse(input.journalText),
          journalText: input.journalText,
          journalPath: input.journalPath,
          databaseAuthority: input.databaseAuthority,
          reason:
            journal.databaseAuthority === undefined
              ? "legacy_journal"
              : journal.databaseAuthority !== input.databaseAuthority
                ? "database_authority_mismatch"
                : "receipt_absent",
          observations,
        },
      })
    }
    if (
      occurrence.intent.payload.journalText !== input.journalText ||
      occurrence.intent.payload.journalPath !== input.journalPath
    )
      throw new Error("Mutation preservation occurrence has another original journal")
    const resources = path.join(directory, "resources")
    await Filesystem.mkdirDurable(resources)
    await retainJournalBytes(path.join(resources, "original-journal.json"), input.journalText)
    const observations = occurrence.intent.payload.observations as Record<string, Observation>
    if (!occurrence.terminal) {
      const phases = ["journal", "target", "backup", "staging", "discard"] as const
      for (const [offset, key] of phases.entries()) {
        const sequence = offset + 1
        if (occurrence.phases.some((phase) => phase.sequence === sequence)) continue
        const destination = path.join(resources, key === "journal" ? "original-journal.json" : key)
        if (key !== "journal") {
          const source = journal[key]
          const expected = observations[key]
          const [sourceExists, destinationExists] = await Promise.all([exists(source), exists(destination)])
          if (expected.kind === "present") {
            if (sourceExists && destinationExists && key !== "target")
              throw new Error(`Mutation preservation has two ${key} resources`)
            const current = sourceExists ? source : destination
            if ((!sourceExists && !destinationExists) || (await digestFilesystemTree(current)) !== expected.treeDigest)
              throw new Error(`Mutation preservation ${key} differs from its original evidence`)
            if (key === "target" && !destinationExists) {
              const temporary = path.join(resources, ".target-copy.tmp")
              if (await exists(temporary)) await rm(temporary, { recursive: true, force: false })
              await cp(source, temporary, { recursive: true, force: false, errorOnExist: true, verbatimSymlinks: true })
              if (
                (await digestFilesystemTree(temporary)) !== expected.treeDigest ||
                (await digestFilesystemTree(source)) !== expected.treeDigest
              )
                throw new Error("Installed mutation target changed while preserving its original bytes")
              await syncCopiedTree(temporary)
              await Filesystem.renameDurableNoReplace(temporary, destination)
            } else if (key !== "target" && sourceExists) {
              await Filesystem.renameDurableNoReplace(source, destination)
            }
            if ((await digestFilesystemTree(destination)) !== expected.treeDigest)
              throw new Error(`Preserved mutation ${key} bytes changed`)
          } else if (sourceExists || destinationExists)
            throw new Error(`Mutation preservation ${key} appeared after observation`)
        }
        occurrence = await publication.appendPhase(KIND, {
          occurrenceID: journal.operationID,
          sequence,
          name: `retained-${key}`,
          timeCreated: Date.now(),
          payload: {
            resource: destination,
            observation: key === "journal" ? { kind: "original_bytes" } : observations[key],
          },
        })
      }
      occurrence = await publication.settle(KIND, {
        occurrenceID: journal.operationID,
        outcome: "committed",
        timeCreated: Date.now(),
        payload: {
          disposition: "commit_receipt_unavailable",
          resources,
          target: journal.target,
          observation: observations.target,
        },
      })
    }
    // The current journal remains the only recovery entry until preservation is
    // durable. A crash here re-enters the same terminal and exact-byte cleanup.
    if (await exists(input.journalPath)) {
      if ((await readFile(input.journalPath, "utf8")) !== input.journalText)
        throw new Error("Current mutation journal changed before preservation cleanup")
      await rm(input.journalPath)
      await Filesystem.syncDirectoryMetadata(path.dirname(input.journalPath))
    }
    return { disposition: "commit_receipt_unavailable" as const, occurrenceID: journal.operationID }
  })
}

/** Transport is bounded; enumeration costs O(history) for this exact package. */
export async function inspectExpertSquadMutationPreservation(input: {
  configRoot: string
  id: string
  occurrenceID?: string
  cursor?: string
  byteOffset?: number
}) {
  const publication = store(input.configRoot, input.id)
  if (input.occurrenceID) {
    if (!(await exists(path.join(publication.occurrenceDirectory(KIND, input.occurrenceID), "intent.json"))))
      throw new NotFoundError({ message: `Expert squad mutation preservation not found: ${input.occurrenceID}` })
    const occurrence = await publication.read(KIND, input.occurrenceID)
    const bytes = Buffer.from(JSON.stringify(occurrence), "utf8")
    const offset = input.byteOffset ?? 0
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("Invalid preservation byte offset")
    const end = Math.min(bytes.length, offset + 4096)
    return {
      occurrenceID: input.occurrenceID,
      totalBytes: bytes.length,
      byteOffset: offset,
      dataBase64: bytes.subarray(offset, end).toString("base64"),
      nextByteOffset: end < bytes.length ? end : null,
    }
  }
  const all = (await publication.list(KIND)).sort((left, right) =>
    left.intent.occurrenceID < right.intent.occurrenceID
      ? -1
      : left.intent.occurrenceID > right.intent.occurrenceID
        ? 1
        : 0,
  )
  const selected = all.filter((item) => !input.cursor || item.intent.occurrenceID > input.cursor).slice(0, 17)
  const entries = selected
    .slice(0, 16)
    .map((item) => ({
      occurrenceID: item.intent.occurrenceID,
      disposition: "commit_receipt_unavailable" as const,
      preservation: item.terminal ? "complete" : "pending",
      timeCreated: item.intent.timeCreated,
    }))
  return { entries, nextCursor: selected.length > 16 ? entries.at(-1)!.occurrenceID : null }
}
