import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import z from "zod"
import { DurablePublicationStore, type DurablePublicationOccurrence } from "@opencorvus-ai/util/durable-publication"
import { Global } from "../global"
import { Database } from "../storage/db"
import { Instance } from "../project/instance"
import { Project } from "../project/project"
import { ProjectDirectoryAdmission } from "../project/directory-admission"
import { Filesystem } from "../util/filesystem"

/** Historical path receipts remain immutable evidence. Version 3 uses one
 * Project journal, exact physical ownership and stable logical request identity. */
export namespace WorktreeReadiness {
  const HISTORICAL_KIND = "worktree-readiness"
  const KIND = "worktree-readiness-v3"
  const OWNER_KIND = "worktree-readiness-resource"
  const Startup = z.object({ project: z.string(), extra: z.string() }).strict()
  const ResetAdmission = z
    .object({
      directoryKey: z.string(),
      directory: z.string(),
      generation: z.string().uuid(),
      operationID: z.string(),
      kind: z.literal("reclamation"),
      timeCreated: z.number().int().optional(),
      owner: z.object({ pid: z.number().int().positive(), processInstanceID: z.string(), occurrenceID: z.string() }),
    })
    .strict()
  const Intent = z
    .object({
      version: z.literal(3),
      databaseInstanceID: z.string().uuid(),
      projectID: z.string(),
      projectGeneration: z.string().uuid(),
      directory: z.string(),
      requestedDirectory: z.string(),
      directoryKey: z.string(),
      branch: z.string(),
      name: z.string(),
      primaryBranch: z.string(),
      startup: Startup,
      historicalOccurrenceIDs: z.array(z.string()),
      resetOperationID: z.string().optional(),
      resetAdmission: ResetAdmission.optional(),
      resetOrigin: z.enum(["current", "historical_unknown"]).optional(),
    })
    .strict()
  export const Recovery = z
    .object({
      kind: z.literal("startup_outcome_unknown"),
      occurrenceID: z.string(),
      message: z.string(),
    })
    .strict()
  export type Recovery = z.infer<typeof Recovery>
  export type Input = {
    projectID: string
    projectGeneration: string
    directory: string
    branch: string
    name: string
    primaryBranch: string
    startup: z.infer<typeof Startup>
    resetOperationID?: string
    resetAdmission?: z.infer<typeof ResetAdmission>
    resetOrigin?: "current" | "historical_unknown"
  }
  export type Current = {
    id: string
    directory: string
    startup: z.infer<typeof Startup>
    checkedOut: boolean
    startupStarted: boolean
    populated: boolean
    ready: boolean
    outcome?: "committed" | "rolled_back"
    disposition?: string
    recovery?: Recovery
    resetOperationID?: string
    resetAdmission?: z.infer<typeof ResetAdmission>
    resetOrigin?: "current" | "historical_unknown"
  }

  type ProjectOwner = { projectID: string; projectGeneration: string }
  function caller(): ProjectOwner {
    return { projectID: Instance.project.id, projectGeneration: Instance.projectGeneration }
  }
  export function requestedDirectoryKey(directory: string) {
    const resolved = Filesystem.normalizeWindowsPath(path.resolve(directory))
    return process.platform === "win32" ? resolved.toLowerCase() : resolved
  }

  function store() {
    return new DurablePublicationStore(path.join(Global.Path.data, "durable-publications"))
  }
  function scope(owner: ProjectOwner) {
    return createHash("sha256")
      .update(JSON.stringify([Database.Identity(), owner.projectID]))
      .digest("hex")
      .slice(0, 40)
  }
  function kind(owner: ProjectOwner) {
    return `${KIND}-${scope(owner)}`
  }
  function kindForID(id: string) {
    if (!/^[a-f0-9]{40}-[a-f0-9-]{36}$/.test(id)) throw new Error(`Worktree readiness identity is not version 3: ${id}`)
    return `${KIND}-${id.slice(0, 40)}`
  }
  /** Current scoped history plus the exact immutable version 1 source, if any. */
  export async function history(
    directory: string,
    owner: ProjectOwner = caller(),
    directoryKey = ProjectDirectoryAdmission.keySync(directory),
  ): Promise<DurablePublicationOccurrence[]> {
    const originalID = createHash("sha256").update(path.resolve(directory)).digest("hex").slice(0, 40)
    const original = await store()
      .read(HISTORICAL_KIND, originalID)
      .catch((error) => {
        if (
          error instanceof Error &&
          error.message ===
            `Durable publication intent is missing: ${store().occurrenceDirectory(HISTORICAL_KIND, originalID)}`
        )
          return undefined
        throw error
      })
    const historicalScope = createHash("sha256").update(directoryKey).digest("hex").slice(0, 40)
    const historical = await store().list(`${HISTORICAL_KIND}-${historicalScope}`)
    const current = await store().list(kind(owner), (record) => {
      const intent = Intent.parse(record.payload)
      if (intent.databaseInstanceID !== Database.Identity() || intent.projectID !== owner.projectID)
        throw new Error("Worktree readiness Project journal owner differs from its immutable namespace")
      return intent.directoryKey === directoryKey || intent.requestedDirectory === requestedDirectoryKey(directory)
    })
    return [...(original ? [original] : []), ...historical, ...current]
  }
  export async function withOwner<T>(
    directory: string,
    run: (owner: ProjectDirectoryAdmission.ResolvedDirectory) => Promise<T>,
  ): Promise<T> {
    const resource = await ProjectDirectoryAdmission.resolve(directory)
    return withHistoricalOwner(resource.directoryKey, () => run(resource))
  }
  /** The old canonical subject is needed when a pathname now resolves to a replacement. */
  export async function withHistoricalOwner<T>(directoryKey: string, run: () => Promise<T>): Promise<T> {
    return store().withSubjectLock(OWNER_KIND, `worktree:${directoryKey}`, run)
  }
  async function current(
    directory: string,
    projectID = Instance.project.id,
    projectGeneration = Instance.projectGeneration,
  ): Promise<DurablePublicationOccurrence | undefined> {
    const physical = await ProjectDirectoryAdmission.observeDirectory(directory).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      },
    )
    if (!physical) return undefined
    const scoped = (await history(directory, { projectID, projectGeneration })).filter(
      (record) => record.intent.payload.version === 3,
    )
    const predecessors = new Set(
      scoped
        .filter((occurrence) => occurrence.terminal?.outcome !== "rolled_back")
        .flatMap((occurrence) => Intent.parse(occurrence.intent.payload).historicalOccurrenceIDs),
    )
    const candidates = scoped.filter((occurrence) => {
      if (predecessors.has(occurrence.intent.occurrenceID)) return false
      if (occurrence.terminal?.outcome === "rolled_back") return false
      const intent = Intent.parse(occurrence.intent.payload)
      if (intent.directoryKey !== physical.directoryKey) return false
      if (
        intent.databaseInstanceID !== Database.Identity() ||
        intent.projectID !== projectID ||
        intent.projectGeneration !== projectGeneration
      )
        return false
      const created = occurrence.phases.find((phase) => phase.name === "created")
      return (
        created &&
        ProjectDirectoryAdmission.sameOccurrence(
          ProjectDirectoryAdmission.DirectoryOccurrence.parse(created.payload),
          physical,
        )
      )
    })
    if (candidates.length > 1)
      throw new Error(`Worktree has multiple readiness owners for one physical occurrence: ${directory}`)
    return candidates[0]
  }
  function projection(occurrence: DurablePublicationOccurrence): Current {
    const intent = Intent.parse(occurrence.intent.payload)
    const preserved = occurrence.phases.find((phase) => phase.name === "preserved")
    const recovery = preserved ? Recovery.parse(preserved.payload) : undefined
    return {
      id: occurrence.intent.occurrenceID,
      directory: intent.directory,
      startup: intent.startup,
      checkedOut: occurrence.phases.some((phase) => phase.name === "checked_out"),
      startupStarted: occurrence.phases.some((phase) => phase.name === "startup_started"),
      populated: occurrence.phases.some((phase) => phase.name === "populated"),
      ready:
        occurrence.terminal?.outcome === "committed" &&
        occurrence.phases.some((phase) => phase.name === "populated") &&
        !recovery,
      ...(occurrence.terminal ? { outcome: occurrence.terminal.outcome } : {}),
      ...(typeof occurrence.terminal?.payload.disposition === "string"
        ? { disposition: occurrence.terminal.payload.disposition }
        : {}),
      ...(recovery ? { recovery } : {}),
      ...(intent.resetOperationID ? { resetOperationID: intent.resetOperationID } : {}),
      ...(intent.resetAdmission ? { resetAdmission: intent.resetAdmission } : {}),
      ...(intent.resetOrigin ? { resetOrigin: intent.resetOrigin } : {}),
    }
  }
  export async function isReady(directory: string) {
    const found = await current(directory)
    return found ? projection(found).ready : false
  }
  export async function begin(
    input: Input,
    frozenResource?: ProjectDirectoryAdmission.ResolvedDirectory,
  ): Promise<string> {
    const resource = frozenResource ?? (await ProjectDirectoryAdmission.resolve(input.directory))
    const { directoryKey } = resource
    return withHistoricalOwner(directoryKey, async () => {
      if (Project.occurrence(input.projectID)?.generation !== input.projectGeneration)
        throw new Error("Worktree readiness Project identity differs from its caller")
      const historical = await history(input.directory, input, directoryKey)
      const predecessors = new Set(
        historical
          .filter(
            (occurrence) => occurrence.intent.payload.version === 3 && occurrence.terminal?.outcome !== "rolled_back",
          )
          .flatMap((occurrence) => Intent.parse(occurrence.intent.payload).historicalOccurrenceIDs),
      )
      const id = `${scope(input)}-${randomUUID()}`
      await store().create({
        occurrenceID: id,
        kind: kind(input),
        subject: `worktree:${directoryKey}`,
        payload: Intent.parse({
          ...input,
          version: 3,
          directory: resource.physicalPath,
          requestedDirectory: requestedDirectoryKey(input.directory),
          directoryKey,
          databaseInstanceID: Database.Identity(),
          historicalOccurrenceIDs: historical
            .filter((occurrence) => !predecessors.has(occurrence.intent.occurrenceID))
            .map((occurrence) => occurrence.intent.occurrenceID),
        }),
        timeCreated: Date.now(),
      })
      return id
    })
  }
  export async function resume(
    input: Input,
    frozenResource?: ProjectDirectoryAdmission.ResolvedDirectory,
  ): Promise<Current> {
    const resource = frozenResource ?? (await ProjectDirectoryAdmission.resolve(input.directory))
    const { directoryKey } = resource
    const physical = await ProjectDirectoryAdmission.observeDirectory(input.directory)
    if (physical.directoryKey !== directoryKey)
      throw new Error("Worktree canonical resource changed after owner admission")
    const found = await current(resource.physicalPath, input.projectID, input.projectGeneration)
    if (found) return projection(found)
    const id = await begin(input, resource)
    await markCreated(id, physical)
    return projection(await store().read(kindForID(id), id))
  }
  export async function inspect(
    input: Pick<Input, "directory" | "projectID" | "projectGeneration">,
  ): Promise<Current | undefined> {
    const found = await current(input.directory, input.projectID, input.projectGeneration)
    return found ? projection(found) : undefined
  }
  export async function read(id: string): Promise<Current> {
    const occurrence = await store().read(kindForID(id), id)
    const current = projection(occurrence)
    const resource = await ProjectDirectoryAdmission.resolve(current.directory)
    if (resource.directoryKey !== Intent.parse(occurrence.intent.payload).directoryKey)
      throw new Error("Worktree physical execution path differs from its immutable resource subject")
    return { ...current, directory: resource.physicalPath }
  }
  export async function retire(id: string): Promise<void> {
    const occurrence = await store().read(kindForID(id), id)
    if (occurrence.terminal) return
    await phase(id, 6, "resource_retired", { disposition: "original_physical_resource_retired" })
    await store().settle(kindForID(id), {
      occurrenceID: id,
      outcome: "committed",
      payload: { disposition: "resource_retired" },
      timeCreated: Date.now(),
    })
  }
  async function phase(id: string, sequence: number, name: string, payload: Record<string, string> = {}) {
    const occurrence = await store().read(kindForID(id), id)
    const existing = occurrence.phases.find((item) => item.sequence === sequence)
    if (existing) {
      if (existing.name !== name || JSON.stringify(existing.payload) !== JSON.stringify(payload))
        throw new Error(`Worktree readiness phase identity changed: ${id}:${sequence}`)
      return
    }
    await store().appendPhase(kindForID(id), { occurrenceID: id, sequence, name, payload, timeCreated: Date.now() })
  }
  export async function markCreated(id: string, expected?: ProjectDirectoryAdmission.DirectoryOccurrence) {
    const occurrence = await store().read(kindForID(id), id)
    const intent = Intent.parse(occurrence.intent.payload)
    const physical = await ProjectDirectoryAdmission.observeDirectory(intent.directory)
    if (expected && !ProjectDirectoryAdmission.sameOccurrence(expected, physical))
      throw new Error("Worktree physical occurrence changed before readiness binding")
    await phase(id, 1, "created", physical)
  }
  export async function markCheckedOut(id: string) {
    await phase(id, 2, "checked_out")
  }
  export async function markStartupStarted(id: string) {
    await phase(id, 3, "startup_started")
  }
  export async function markPopulated(id: string) {
    await phase(id, 4, "populated")
  }
  export async function commitReady(id: string) {
    const occurrence = await store().read(kindForID(id), id)
    if (occurrence.terminal?.outcome === "committed") return
    if (!occurrence.phases.some((phase) => phase.name === "populated"))
      throw new Error(`Worktree readiness has no completed population: ${id}`)
    await store().settle(kindForID(id), {
      occurrenceID: id,
      outcome: "committed",
      payload: {},
      timeCreated: Date.now(),
    })
  }
  export async function preserve(id: string): Promise<Recovery> {
    const recovery: Recovery = {
      kind: "startup_outcome_unknown",
      occurrenceID: id,
      message:
        "The existing worktree is preserved. Its historical startup outcome is unknown; review the original startup evidence before any explicit new startup operation.",
    }
    const occurrence = await store().read(kindForID(id), id)
    if (!occurrence.phases.some((phase) => phase.name === "preserved")) await phase(id, 5, "preserved", recovery)
    if (!occurrence.terminal)
      await store().settle(kindForID(id), {
        occurrenceID: id,
        outcome: "committed",
        payload: { disposition: "population_preserved" },
        timeCreated: Date.now(),
      })
    return recovery
  }
  export async function rollback(id: string, reason: string) {
    const occurrence = await store().read(kindForID(id), id)
    if (occurrence.terminal) return
    await store().settle(kindForID(id), {
      occurrenceID: id,
      outcome: "rolled_back",
      payload: { reason },
      timeCreated: Date.now(),
    })
  }
}
