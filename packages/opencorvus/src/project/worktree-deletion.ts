import { createHash } from "node:crypto"
import path from "node:path"
import z from "zod"
import { DurablePublicationStore, type DurablePublicationOccurrence } from "@opencorvus-ai/util/durable-publication"
import { Global } from "@/global"
import { Database } from "@/storage/db"
import { Worktree } from "@/worktree"
import { Project } from "./project"
import { ProjectDirectoryAdmission } from "./directory-admission"
import type { ProjectDeletionRegistryAdmission } from "./deletion-registry"

const KIND_PREFIX = "project-worktree-deletion"

const Payload = z
  .object({
    version: z.literal(2),
    databaseInstanceID: z.string().uuid(),
    projectID: z.string().min(1),
    projectGeneration: z.string().uuid(),
    scopeKey: z.string().min(1),
    directoryKey: z.string().min(1),
    predecessorOccurrenceID: z.string().min(1).nullable(),
    removal: Worktree.ManagedRemovalPlan,
  })
  .strict()

export type ProjectWorktreeDeletionEntry = z.infer<typeof Payload> & {
  occurrenceID: string
  terminal: boolean
}

type BeforeProjectWorktreeDeletionCommit = (entry: ProjectWorktreeDeletionEntry) => void | Promise<void>
let beforeProjectWorktreeDeletionCommit: BeforeProjectWorktreeDeletionCommit | undefined
type AfterProjectWorktreeFrontierQuery = (input: {
  projectID: string
  directory: string
  frontierCount: number
}) => void | Promise<void>
let afterProjectWorktreeFrontierQuery: AfterProjectWorktreeFrontierQuery | undefined

function store(): DurablePublicationStore {
  return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
}

function kind(input: {
  databaseInstanceID: string
  projectID: string
  projectGeneration: string
  scopeKey: string
}): string {
  const scope = createHash("sha256")
    .update(
      `project-worktree-deletion-scope-v1\0${input.databaseInstanceID}\0${input.projectID}\0` +
        `${input.projectGeneration}\0${input.scopeKey}`,
    )
    .digest("hex")
    .slice(0, 40)
  return `${KIND_PREFIX}-${scope}`
}

function subject(input: { databaseInstanceID: string; projectID: string; projectGeneration: string }): string {
  return `project-worktrees:${input.databaseInstanceID}:${input.projectID}:${input.projectGeneration}`
}

function occurrenceID(input: {
  databaseInstanceID: string
  projectID: string
  projectGeneration: string
  directoryKey: string
  removal: Pick<Worktree.ManagedRemovalPlan, "device" | "inode" | "birthtimeMs">
}): string {
  return createHash("sha256")
    .update(
      `project-worktree-deletion-v2\0${input.databaseInstanceID}\0${input.projectID}\0` +
        `${input.projectGeneration}\0${input.directoryKey}\0${input.removal.device}\0` +
        `${input.removal.inode}\0${input.removal.birthtimeMs}`,
    )
    .digest("hex")
    .slice(0, 40)
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

function fromOccurrence(occurrence: DurablePublicationOccurrence): ProjectWorktreeDeletionEntry {
  const payload = Payload.parse(occurrence.intent.payload)
  const expectedID = occurrenceID(payload)
  if (occurrence.intent.occurrenceID !== expectedID || occurrence.intent.subject !== subject(payload)) {
    throw new Error(`Project worktree deletion occurrence identity changed: ${occurrence.intent.occurrenceID}`)
  }
  if (occurrence.intent.kind !== kind(payload)) {
    throw new Error(`Project worktree deletion kind identity changed: ${occurrence.intent.occurrenceID}`)
  }
  if (payload.predecessorOccurrenceID === expectedID) {
    throw new Error(`Project worktree deletion ${expectedID} names itself as predecessor`)
  }
  if (occurrence.terminal?.outcome === "rolled_back") {
    throw new Error(`Project worktree deletion ${expectedID} is rolled back`)
  }
  return { ...payload, occurrenceID: expectedID, terminal: occurrence.terminal?.outcome === "committed" }
}

async function appendPhase(
  entry: ProjectWorktreeDeletionEntry,
  sequence: number,
  name: string,
  payload: Record<string, string> = {},
): Promise<void> {
  const occurrence = await store().read(kind(entry), entry.occurrenceID)
  const current = occurrence.phases.find((phase) => phase.sequence === sequence)
  if (current) {
    if (current.name !== name || stable(current.payload) !== stable(payload)) {
      throw new Error(`Project worktree deletion ${entry.occurrenceID} phase ${sequence} changed identity`)
    }
    return
  }
  await store().appendPhase(kind(entry), {
    occurrenceID: entry.occurrenceID,
    sequence,
    name,
    payload,
    timeCreated: Date.now(),
  })
}

export namespace ProjectWorktreeDeletion {
  export namespace TestHooks {
    export function installBeforeCommit(hook: BeforeProjectWorktreeDeletionCommit) {
      const previous = beforeProjectWorktreeDeletionCommit
      beforeProjectWorktreeDeletionCommit = hook
      return {
        [Symbol.dispose]() {
          if (beforeProjectWorktreeDeletionCommit === hook) beforeProjectWorktreeDeletionCommit = previous
        },
      }
    }

    export function installAfterFrontierQuery(hook: AfterProjectWorktreeFrontierQuery) {
      const previous = afterProjectWorktreeFrontierQuery
      afterProjectWorktreeFrontierQuery = hook
      return {
        [Symbol.dispose]() {
          if (afterProjectWorktreeFrontierQuery === hook) afterProjectWorktreeFrontierQuery = previous
        },
      }
    }
  }

  export async function prepare(input: {
    projectID: string
    projectGeneration: string
    directory: string
  }): Promise<ProjectWorktreeDeletionEntry> {
    const databaseInstanceID = Database.Identity()
    const owner = subject({ databaseInstanceID, ...input })
    const scopeKey =
      process.platform === "win32" ? path.resolve(input.directory).toLowerCase() : path.resolve(input.directory)
    const directoryKey = await ProjectDirectoryAdmission.key(input.directory)
    const scopedKind = kind({ databaseInstanceID, ...input, scopeKey })
    return store().withSubjectLock(scopedKind, owner, async () => {
      const observed = await ProjectDirectoryAdmission.observeDirectory(input.directory).catch((error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
        throw error
      })
      const scopedOccurrences = await store().list(scopedKind)
      await afterProjectWorktreeFrontierQuery?.({
        projectID: input.projectID,
        directory: input.directory,
        frontierCount: scopedOccurrences.length,
      })
      const frozenMatches = scopedOccurrences
        .map(fromOccurrence)
        .filter(
          (entry) =>
            entry.databaseInstanceID === databaseInstanceID &&
            entry.projectID === input.projectID &&
            entry.projectGeneration === input.projectGeneration &&
            (Project.samePath(entry.removal.registration.directory, input.directory) ||
              entry.removal.matchedSandboxes.some((sandbox) => Project.samePath(sandbox.directory, input.directory))),
        )
      const predecessorIDs = new Set(
        frozenMatches.flatMap((entry) =>
          entry.predecessorOccurrenceID === null ? [] : [entry.predecessorOccurrenceID],
        ),
      )
      const heads = frozenMatches.filter((entry) => !predecessorIDs.has(entry.occurrenceID))
      if (heads.length > 1) {
        throw new Error(`Project worktree deletion has ambiguous frozen child heads: ${input.directory}`)
      }
      const exact = observed
        ? frozenMatches.filter(
            (entry) =>
              entry.removal.device === observed.device &&
              entry.removal.inode === observed.inode &&
              entry.removal.birthtimeMs === observed.birthtimeMs,
          )
        : []
      if (exact.length > 1) {
        throw new Error(`Project worktree deletion has duplicate physical occurrence identity: ${input.directory}`)
      }
      if (exact[0]) {
        for (const historical of frozenMatches) {
          if (historical.occurrenceID === exact[0].occurrenceID || !historical.terminal) continue
          await store().removeSettled(scopedKind, historical.occurrenceID)
        }
        return exact[0]
      }
      if (!observed) {
        if (heads[0]) return heads[0]
        throw new Error(`Project worktree deletion cannot capture a missing unjournaled child: ${input.directory}`)
      }
      if (heads[0] && !heads[0].terminal) {
        throw new Error(
          `Project worktree deletion retained occurrence was replaced before settlement: ${input.directory}`,
        )
      }
      if (observed.directoryKey !== directoryKey) {
        throw new Error(`Project worktree deletion directory identity changed: ${input.directory}`)
      }
      const removal = await Worktree.captureManagedRemovalPlan({
        projectID: input.projectID,
        directory: input.directory,
        authority: "project_delete",
      })
      if (
        removal.directoryKey !== directoryKey ||
        removal.device !== observed.device ||
        removal.inode !== observed.inode ||
        removal.birthtimeMs !== observed.birthtimeMs
      ) {
        throw new Error(`Project worktree deletion occurrence changed during frozen intent capture: ${input.directory}`)
      }
      const payload = Payload.parse({
        version: 2,
        databaseInstanceID,
        projectID: input.projectID,
        projectGeneration: input.projectGeneration,
        scopeKey,
        directoryKey,
        predecessorOccurrenceID: heads[0]?.occurrenceID ?? null,
        removal,
      })
      const id = occurrenceID(payload)
      const existing = await store()
        .read(scopedKind, id)
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          if (/intent is missing|ENOENT|no such file/i.test(message)) return undefined
          throw error
        })
      if (existing) {
        if (stable(existing.intent.payload) !== stable(payload)) {
          throw new Error(`Project worktree deletion ${id} already has another immutable intent`)
        }
        return fromOccurrence(existing)
      }
      await store().create({ occurrenceID: id, kind: scopedKind, subject: owner, payload, timeCreated: Date.now() })
      for (const historical of frozenMatches) {
        if (!historical.terminal) continue
        await store().removeSettled(scopedKind, historical.occurrenceID)
      }
      return fromOccurrence(await store().read(scopedKind, id))
    })
  }

  export async function reduce(
    entry: ProjectWorktreeDeletionEntry,
    admission: ProjectDeletionRegistryAdmission,
  ): Promise<void> {
    await store().withSubjectLock(kind(entry), subject(entry), async () => {
      const current = fromOccurrence(await store().read(kind(entry), entry.occurrenceID))
      const result = await Worktree.removeManagedProjectWorktreeDirectory({
        projectID: current.projectID,
        directory: current.removal.registration.directory,
        plan: current.removal,
        projectDeletionAdmission: admission,
      })
      if (!result.removed) {
        throw new Error(`Project worktree remains durably owned: ${current.removal.registration.directory}`)
      }
      const settlement = await Worktree.inspectManagedRemovalSettlement(current.removal)
      if (!settlement.directoryRemoved) throw new Error(`Project worktree directory removal is incomplete`)
      await appendPhase(current, 1, "physical_directory_removed")
      if (!settlement.registrationPruned) throw new Error(`Project worktree Git registration prune is incomplete`)
      await appendPhase(current, 2, "git_registration_pruned")
      if (!settlement.branchRemoved) throw new Error(`Project worktree branch removal is incomplete`)
      await appendPhase(current, 3, "branch_removed", {
        branch: current.removal.registration.branch,
        targetCommit: current.removal.registration.targetCommit,
      })
      if (!settlement.sandboxSettled) throw new Error(`Project sandbox handoff is incomplete`)
      await appendPhase(current, 4, "project_sandbox_retained")
      await beforeProjectWorktreeDeletionCommit?.(current)
      const latest = await store().read(kind(current), current.occurrenceID)
      if (!latest.terminal) {
        await store().settle(kind(current), {
          occurrenceID: current.occurrenceID,
          outcome: "committed",
          payload: {},
          timeCreated: Date.now(),
        })
      }
    })
  }

  export async function assertCommitted(entries: readonly ProjectWorktreeDeletionEntry[]): Promise<void> {
    for (const entry of entries) {
      if (!(await store().read(kind(entry), entry.occurrenceID)).terminal) {
        throw new Error(`Project worktree deletion ${entry.occurrenceID} has no terminal receipt`)
      }
    }
  }
}
