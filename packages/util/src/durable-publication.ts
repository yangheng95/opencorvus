import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomUUID } from "node:crypto"
import { link, lstat, mkdir, mkdtemp, open, readdir, readFile, readlink, realpath, rename, rm } from "node:fs/promises"
import path from "node:path"
import lockfile from "proper-lockfile"
import z from "zod"

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const JsonObject = z.record(z.string(), z.json())

export const DurablePublicationIntent = z
  .object({
    schemaVersion: z.literal(1),
    occurrenceID: z.string().min(1),
    kind: z.string().min(1),
    subject: z.string().min(1),
    payload: JsonObject,
    timeCreated: z.number().int().nonnegative(),
  })
  .strict()
export type DurablePublicationIntent = z.infer<typeof DurablePublicationIntent>

export const DurablePublicationPhase = z
  .object({
    schemaVersion: z.literal(1),
    occurrenceID: z.string().min(1),
    sequence: z.number().int().positive(),
    name: z.string().min(1),
    payload: JsonObject,
    timeCreated: z.number().int().nonnegative(),
  })
  .strict()
export type DurablePublicationPhase = z.infer<typeof DurablePublicationPhase>

export const DurablePublicationTerminal = z
  .object({
    schemaVersion: z.literal(1),
    occurrenceID: z.string().min(1),
    outcome: z.enum(["committed", "rolled_back"]),
    payload: JsonObject,
    timeCreated: z.number().int().nonnegative(),
  })
  .strict()
export type DurablePublicationTerminal = z.infer<typeof DurablePublicationTerminal>

export type DurablePublicationOccurrence = {
  directory: string
  intent: DurablePublicationIntent
  phases: DurablePublicationPhase[]
  terminal?: DurablePublicationTerminal
}

/** Exact deterministic digest for a file, directory or symbolic-link tree. */
export async function digestFilesystemTree(root: string): Promise<string> {
  const hash = createHash("sha256")
  const absoluteRoot = path.resolve(root)

  async function visit(absolute: string, relative: string): Promise<void> {
    const stat = await lstat(absolute)
    if (stat.isDirectory()) {
      hash.update(`d\0${relative}\0${stat.mode & 0o777}\0`)
      const entries = await readdir(absolute, { withFileTypes: true })
      entries.sort((left, right) => left.name.localeCompare(right.name))
      for (const entry of entries) {
        await visit(path.join(absolute, entry.name), relative ? `${relative}/${entry.name}` : entry.name)
      }
      return
    }
    if (stat.isFile()) {
      hash.update(`f\0${relative}\0${stat.mode & 0o777}\0${stat.size}\0`)
      hash.update(await readFile(absolute))
      return
    }
    if (stat.isSymbolicLink()) {
      hash.update(`l\0${relative}\0${await readlink(absolute)}\0`)
      return
    }
    throw new Error(`Unsupported durable publication entry: ${absolute}`)
  }

  await visit(absoluteRoot, "")
  return hash.digest("hex")
}

function segment(value: string, label: string): string {
  if (!SEGMENT.test(value)) throw new Error(`${label} must be one filesystem-safe identity segment`)
  return value
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

type DurablePublicationCut =
  | "occurrence-staging-created"
  | "occurrence-published"
  | "intent-temp-synced"
  | "intent-published"
  | "phase-temp-synced"
  | "phase-published"
  | "terminal-temp-synced"
  | "terminal-published"

let testCutHook: ((cut: DurablePublicationCut, kind: string) => void | Promise<void>) | undefined

/** Test-only crash injection used by child-process durability acceptance. */
export function setDurablePublicationTestCutHook(
  hook?: (cut: DurablePublicationCut, kind: string) => void | Promise<void>,
): void {
  testCutHook = hook
}

async function cut(name: DurablePublicationCut, kind: string): Promise<void> {
  // The kind travels with the cut. Several subsystems share one store root, so
  // a hook that counted cuts by name alone would fire at whichever
  // publication reached that point first, not at the one under test.
  await testCutHook?.(name, kind)
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, process.platform === "win32" ? "r+" : "r")
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function writeExclusive(
  file: string,
  value: unknown,
  fact: "intent" | "phase" | "terminal",
  kind: string,
): Promise<void> {
  const body = `${JSON.stringify(value, null, 2)}\n`
  const temporary = path.join(path.dirname(file), `.tmp-${path.basename(file)}-${randomUUID()}`)
  let published = false
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporary, "wx", 0o600)
    await handle.writeFile(body, "utf8")
    await handle.sync()
    await handle.close()
    handle = undefined
    await cut(`${fact}-temp-synced`, kind)
    try {
      await link(temporary, file)
      published = true
      await cut(`${fact}-published`, kind)
      await syncDirectory(path.dirname(file))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      const existing = JSON.parse(await readFile(file, "utf8")) as unknown
      if (stable(existing) !== stable(value)) {
        throw new Error(`Durable publication fact already exists with different content: ${file}`, { cause: error })
      }
    }
  } finally {
    await handle?.close().catch(() => undefined)
    await rm(temporary, { force: true }).catch(() => undefined)
    if (published) await syncDirectory(path.dirname(file))
  }
}

async function readOptional(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
    throw error
  }
}

/**
 * Immutable durable-publication fact store.
 *
 * This owner deliberately knows nothing about directories being published.
 * Callers validate path containment, content identity and recovery policy. The
 * store owns only one shared rule: an occurrence is an immutable intent,
 * append-only ordered phase facts and one non-replaceable terminal receipt.
 * Physical existence is never interpreted as completion by this layer.
 */
export class DurablePublicationStore {
  private static readonly heldSubjects = new AsyncLocalStorage<Map<string, string>>()
  private static readonly activeSubjectLeases = new Map<string, string>()

  constructor(readonly root: string) {
    if (!path.isAbsolute(root)) throw new Error(`Durable publication root must be absolute: ${root}`)
  }

  occurrenceDirectory(kind: string, occurrenceID: string): string {
    return path.join(this.root, segment(kind, "publication kind"), segment(occurrenceID, "publication occurrence"))
  }

  async withSubjectLock<T>(kind: string, subject: string, run: () => Promise<T>): Promise<T> {
    segment(kind, "publication kind")
    if (!subject) throw new Error("Durable publication subject must not be empty")
    const lockDirectory = path.join(this.root, ".locks")
    await mkdir(lockDirectory, { recursive: true })
    const physicalLockDirectory = await realpath(lockDirectory)
    const rootKey =
      process.platform === "win32"
        ? path
            .resolve(physicalLockDirectory)
            .replace(/^\\\\\?\\/, "")
            .toLowerCase()
        : path.resolve(physicalLockDirectory)
    const subjectKey = createHash("sha256").update(`${kind}\0${subject}`).digest("hex")
    const leaseKey = `${rootKey}\0${subjectKey}`
    const held = DurablePublicationStore.heldSubjects.getStore()
    const inheritedLease = held?.get(leaseKey)
    if (inheritedLease && DurablePublicationStore.activeSubjectLeases.get(leaseKey) === inheritedLease) return run()
    const target = path.join(lockDirectory, subjectKey)
    const provision = await open(target, "a", 0o600)
    await provision.close()
    let compromised: unknown
    const release = await lockfile.lock(target, {
      realpath: false,
      retries: { forever: true, factor: 1.2, minTimeout: 25, maxTimeout: 250, randomize: true },
      onCompromised(error) {
        compromised ??= error
      },
    })
    const lease = randomUUID()
    DurablePublicationStore.activeSubjectLeases.set(leaseKey, lease)
    const next = new Map(held ?? [])
    next.set(leaseKey, lease)
    try {
      const result = await DurablePublicationStore.heldSubjects.run(next, run)
      if (compromised)
        throw new Error(`Durable publication subject lock was compromised: ${subject}`, { cause: compromised })
      return result
    } finally {
      if (DurablePublicationStore.activeSubjectLeases.get(leaseKey) === lease) {
        DurablePublicationStore.activeSubjectLeases.delete(leaseKey)
      }
      await release().catch((error) => {
        if (!compromised) throw error
      })
    }
  }

  async create(input: Omit<DurablePublicationIntent, "schemaVersion">): Promise<DurablePublicationOccurrence> {
    const intent = DurablePublicationIntent.parse({ schemaVersion: 1, ...input })
    return this.withSubjectLock(intent.kind, intent.subject, async () => {
      const directory = this.occurrenceDirectory(intent.kind, intent.occurrenceID)
      const kindDirectory = path.dirname(directory)
      const stagingRoot = path.join(this.root, ".staging", intent.kind)
      await mkdir(kindDirectory, { recursive: true })
      await mkdir(stagingRoot, { recursive: true })
      const staging = await mkdtemp(path.join(stagingRoot, `${intent.occurrenceID}-`))
      try {
        await cut("occurrence-staging-created", intent.kind)
        await writeExclusive(path.join(staging, "intent.json"), intent, "intent", intent.kind)
        await syncDirectory(staging)
        let published = false
        try {
          await rename(staging, directory)
          published = true
        } catch (error) {
          // Renaming onto an existing directory reports EEXIST or ENOTEMPTY on
          // POSIX and EPERM on Windows; all three mean the occurrence is
          // already published, which is the replay this branch settles.
          const code = (error as NodeJS.ErrnoException).code
          if (code !== "EEXIST" && code !== "ENOTEMPTY" && code !== "EPERM") throw error
          const existing = await this.read(intent.kind, intent.occurrenceID)
          if (stable(existing.intent) !== stable(intent)) {
            throw new Error(`Durable publication occurrence already exists with different intent: ${directory}`)
          }
        }
        // The durability of the publication is not part of the replay branch:
        // a failed directory fsync must surface, not be read as "someone else
        // already published this".
        if (published) {
          await cut("occurrence-published", intent.kind)
          await syncDirectory(kindDirectory)
        }
      } finally {
        await rm(staging, { recursive: true, force: true }).catch(() => undefined)
      }
      return this.read(intent.kind, intent.occurrenceID)
    })
  }

  async appendPhase(
    kind: string,
    input: Omit<DurablePublicationPhase, "schemaVersion">,
  ): Promise<DurablePublicationOccurrence> {
    const initial = await this.read(kind, input.occurrenceID)
    return this.withSubjectLock(kind, initial.intent.subject, async () => {
      const occurrence = await this.read(kind, input.occurrenceID)
      if (occurrence.terminal) {
        throw new Error(`Durable publication ${input.occurrenceID} is already ${occurrence.terminal.outcome}`)
      }
      const phase = DurablePublicationPhase.parse({ schemaVersion: 1, ...input })
      const previous = occurrence.phases.at(-1)
      if (previous && phase.sequence <= previous.sequence) {
        const replay = occurrence.phases.find((item) => item.sequence === phase.sequence)
        if (replay && stable(replay) === stable(phase)) return occurrence
        throw new Error(
          `Durable publication ${phase.occurrenceID} phase sequence ${phase.sequence} does not advance ${previous.sequence}`,
        )
      }
      const phases = path.join(occurrence.directory, "phases")
      await mkdir(phases, { recursive: true })
      await syncDirectory(occurrence.directory)
      const filename = `${String(phase.sequence).padStart(6, "0")}-${segment(phase.name, "publication phase")}.json`
      await writeExclusive(path.join(phases, filename), phase, "phase", kind)
      return this.read(kind, phase.occurrenceID)
    })
  }

  async settle(
    kind: string,
    input: Omit<DurablePublicationTerminal, "schemaVersion">,
  ): Promise<DurablePublicationOccurrence> {
    const initial = await this.read(kind, input.occurrenceID)
    return this.withSubjectLock(kind, initial.intent.subject, async () => {
      const occurrence = await this.read(kind, input.occurrenceID)
      const terminal = DurablePublicationTerminal.parse({ schemaVersion: 1, ...input })
      await writeExclusive(path.join(occurrence.directory, "terminal.json"), terminal, "terminal", kind)
      return this.read(kind, terminal.occurrenceID)
    })
  }

  async read(kind: string, occurrenceID: string): Promise<DurablePublicationOccurrence> {
    const directory = this.occurrenceDirectory(kind, occurrenceID)
    const rawIntent = await readOptional(path.join(directory, "intent.json"))
    if (!rawIntent) throw new Error(`Durable publication intent is missing: ${directory}`)
    const intent = DurablePublicationIntent.parse(rawIntent)
    if (intent.kind !== kind || intent.occurrenceID !== occurrenceID) {
      throw new Error(`Durable publication path/content identity mismatch: ${directory}`)
    }
    const phaseDirectory = path.join(directory, "phases")
    const names = await readdir(phaseDirectory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    })
    const phases: DurablePublicationPhase[] = []
    for (const name of names.filter((name) => !name.startsWith(".tmp-")).sort()) {
      if (!name.endsWith(".json")) throw new Error(`Unexpected durable publication phase entry: ${name}`)
      const phase = DurablePublicationPhase.parse(JSON.parse(await readFile(path.join(phaseDirectory, name), "utf8")))
      if (phase.occurrenceID !== occurrenceID) {
        throw new Error(`Durable publication phase identity mismatch: ${path.join(phaseDirectory, name)}`)
      }
      if (phases.at(-1)?.sequence === phase.sequence) {
        throw new Error(`Durable publication has duplicate phase sequence ${phase.sequence}: ${directory}`)
      }
      phases.push(phase)
    }
    const rawTerminal = await readOptional(path.join(directory, "terminal.json"))
    const terminal = rawTerminal === undefined ? undefined : DurablePublicationTerminal.parse(rawTerminal)
    if (terminal && terminal.occurrenceID !== occurrenceID) {
      throw new Error(`Durable publication terminal identity mismatch: ${directory}`)
    }
    return { directory, intent, phases, terminal }
  }

  async list(kind: string): Promise<DurablePublicationOccurrence[]> {
    const kindDirectory = path.join(this.root, segment(kind, "publication kind"))
    const entries = await readdir(kindDirectory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return []
      throw error
    })
    const occurrences: DurablePublicationOccurrence[] = []
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        throw new Error(`Unexpected durable publication occurrence entry: ${path.join(kindDirectory, entry.name)}`)
      }
      occurrences.push(await this.read(kind, entry.name))
    }
    return occurrences
  }

  async listOpen(kind: string): Promise<DurablePublicationOccurrence[]> {
    return (await this.list(kind)).filter((occurrence) => occurrence.terminal === undefined)
  }

  async removeSettled(kind: string, occurrenceID: string): Promise<void> {
    const initial = await this.read(kind, occurrenceID)
    // Removal mutates the occurrence directory like create/appendPhase/settle,
    // so it takes the same subject lock: without it a peer could delete an
    // occurrence between another writer's read and its write.
    await this.withSubjectLock(kind, initial.intent.subject, async () => {
      const occurrence = await this.read(kind, occurrenceID)
      if (!occurrence.terminal) throw new Error(`Cannot remove unsettled durable publication ${occurrenceID}`)
      await rm(occurrence.directory, { recursive: true, force: false })
    })
  }
}
