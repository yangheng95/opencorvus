import z from "zod"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { randomUUID } from "crypto"
import { and, Database, eq, notExists, NotFoundError } from "../storage/db"
import { ProjectMaintenanceFenceTable, ProjectTable } from "./project.sql"
import { Log } from "../util/log"
import { Flag } from "@/flag/flag"
import { fn } from "@opencorvus-ai/util/fn"
import { BusEvent } from "@/bus/bus-event"
import { iife } from "@/util/iife"
import { GlobalBus } from "@/bus/global"
import { readFile, realpath, readdir, stat } from "fs/promises"
import { hostGit as git } from "../util/git"
import { Glob } from "../util/glob"
import { which } from "@/util/which"
import { NamedError } from "@opencorvus-ai/util/error"
import { assertProjectDurableAdmissionOpen, ProjectDurableAdmissionClosedError } from "./deletion-registry"
import { Identifier } from "@/id/id"
import { assertProjectDeletionCleanupAdmissionOpen } from "./deletion-cleanup-admission"
import { ProjectDirectoryAdmission } from "./directory-admission"

export namespace Project {
  export const DurableAdmissionClosedError = ProjectDurableAdmissionClosedError

  export function assertDurableAdmissionOpen(db: Database.TxOrDb, projectID: string): void {
    if (assertProjectDurableAdmissionOpen(db, projectID)) return
    throw new DurableAdmissionClosedError({
      projectID,
      message: `Project ${projectID} durable admission is closed during deletion`,
    })
  }

  function assertRegistryAdmissionOpen(db: Database.TxOrDb, projectID: string) {
    if (!assertProjectDurableAdmissionOpen(db, projectID)) {
      throw new DurableAdmissionClosedError({
        projectID,
        message: `Project ${projectID} registry admission is closed during deletion`,
      })
    }
  }
  const log = Log.create({ service: "project" })
  type Row = typeof ProjectTable.$inferSelect
  type DiscoveryCommitHook = (input: {
    projectID: string
    directory: string
    proposedSandbox?: string
  }) => void | Promise<void>
  let beforeDiscoveryCommit: DiscoveryCommitHook | undefined
  let afterDiscoveryAdmission: DiscoveryCommitHook | undefined

  export namespace TestHooks {
    export function installBeforeDiscoveryCommit(hook: DiscoveryCommitHook) {
      const previous = beforeDiscoveryCommit
      beforeDiscoveryCommit = hook
      return {
        [Symbol.dispose]() {
          if (beforeDiscoveryCommit === hook) beforeDiscoveryCommit = previous
        },
      }
    }

    export function installAfterDiscoveryAdmission(hook: DiscoveryCommitHook) {
      const previous = afterDiscoveryAdmission
      afterDiscoveryAdmission = hook
      return {
        [Symbol.dispose]() {
          if (afterDiscoveryAdmission === hook) afterDiscoveryAdmission = previous
        },
      }
    }
  }

  async function acquireRegistrationAdmissions(directories: readonly string[]) {
    const canonical = await Promise.all(
      directories.map(async (directory) => ({ directory, key: await ProjectDirectoryAdmission.key(directory) })),
    )
    const ordered = [...new Map(canonical.map((entry) => [entry.key, entry])).values()]
      .sort((left, right) => left.key.length - right.key.length || left.key.localeCompare(right.key))
      .filter(
        (entry, index, entries) =>
          !entries.slice(0, index).some((ancestor) => Filesystem.contains(ancestor.key, entry.key)),
      )
    const operationID = randomUUID()
    const tokens: ProjectDirectoryAdmission.Token[] = []
    try {
      for (const entry of ordered) {
        const registration = await ProjectDirectoryAdmission.acquire({
          directory: entry.directory,
          operationID,
          kind: "registration",
        })
        if (registration.outcome === "owned") {
          throw new Error("Project registration unexpectedly resolved as owned")
        }
        tokens.push(registration.token)
      }
      return tokens
    } catch (error) {
      if (tokens.length > 0) ProjectDirectoryAdmission.settleMany(tokens, () => undefined)
      throw error
    }
  }

  export function ownershipProjection(rows: readonly Row[]) {
    return rows
      .map(({ id, generation, worktree, sandboxes, time_updated }) => ({
        id,
        generation,
        worktree,
        sandboxes,
        time_updated,
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  }

  async function capturePhysicalRegistrationAuthority(projectID: string, directories: readonly string[]) {
    const rows = Database.runOutsideContext(() => Database.use((db) => db.select().from(ProjectTable).all()))
    const expected = ownershipProjection(rows)
    const candidates = await Promise.all(
      directories.map(async (directory) => ({ directory, key: await ProjectDirectoryAdmission.key(directory) })),
    )
    const registered = await Promise.all(
      rows.flatMap((row) =>
        [row.worktree, ...row.sandboxes].map(async (directory) => ({
          projectID: row.id,
          directory,
          key: await ProjectDirectoryAdmission.key(directory),
        })),
      ),
    )
    const conflictingProjectIDs = [
      ...new Set(
        registered
          .filter(
            (entry) => entry.projectID !== projectID && candidates.some((candidate) => candidate.key === entry.key),
          )
          .map((entry) => entry.projectID),
      ),
    ].sort()
    if (conflictingProjectIDs.length > 0) {
      throw new RegisteredDirectoryConflictError({
        directory: path.resolve(candidates[0]?.directory ?? ""),
        projectIDs: [projectID, ...conflictingProjectIDs].sort(),
        message: `Cannot register a physical directory already owned by Project${conflictingProjectIDs.length === 1 ? "" : "s"} ${conflictingProjectIDs.join(", ")}`,
      })
    }
    return {
      async revalidate() {
        const [currentCandidates, currentRegistered] = await Promise.all([
          Promise.all(
            candidates.map(async ({ directory }) => ({
              directory,
              key: await ProjectDirectoryAdmission.key(directory),
            })),
          ),
          Promise.all(
            registered.map(async ({ projectID: ownerProjectID, directory }) => ({
              projectID: ownerProjectID,
              directory,
              key: await ProjectDirectoryAdmission.key(directory),
            })),
          ),
        ])
        if (
          JSON.stringify(currentCandidates) !== JSON.stringify(candidates) ||
          JSON.stringify(currentRegistered) !== JSON.stringify(registered)
        ) {
          throw new DirectoryOccurrenceChangedError({
            directory: path.resolve(directories[0] ?? ""),
            message: "Project physical directory ownership changed while registration waited for admission",
          })
        }
      },
      validate(db: Database.TxOrDb) {
        const current = ownershipProjection(db.select().from(ProjectTable).all())
        if (JSON.stringify(current) !== JSON.stringify(expected)) {
          throw new Error("Project physical directory ownership changed while registration was being admitted")
        }
      },
    }
  }

  export const DirectoryIntegrityError = NamedError.create(
    "ProjectDirectoryIntegrityError",
    z.object({
      directory: z.string(),
      reason: z.enum(["missing", "not-directory"]),
      message: z.string(),
    }),
  )

  export const DirectoryOccurrenceChangedError = NamedError.create(
    "ProjectDirectoryOccurrenceChangedError",
    z.object({
      directory: z.string(),
      message: z.string(),
    }),
  )

  export const RegisteredDirectoryConflictError = NamedError.create(
    "ProjectRegisteredDirectoryConflictError",
    z.object({
      directory: z.string(),
      projectIDs: z.array(z.string()).min(2),
      message: z.string(),
    }),
  )

  export const DuplicateWorktreeIdentityError = NamedError.create(
    "ProjectDuplicateWorktreeIdentityError",
    z.object({
      worktree: z.string(),
      projectIDs: z.array(z.string()).min(2),
      message: z.string(),
    }),
  )

  function gitpath(cwd: string, name: string) {
    if (!name) return cwd
    // git output includes trailing newlines; keep path whitespace intact.
    name = name.replace(/[\r\n]+$/, "")
    if (!name) return cwd

    name = Filesystem.windowsPath(name)
    return Filesystem.resolve(path.isAbsolute(name) ? name : path.join(cwd, name))
  }

  function marker(dir: string) {
    return path.join(dir, "opencorvus")
  }

  function generated(seed: string) {
    return Identifier.deterministic("project", comparePath(path.resolve(seed)))
  }

  function currentMarkerIdentity(value: string | undefined) {
    return value && value.length <= Identifier.MAX_LENGTH && Identifier.isCanonical("project", value)
      ? value
      : undefined
  }

  export function directoryProjectID(directory: string) {
    return generated(path.join(directory, ".git"))
  }

  async function text(args: string[], cwd: string) {
    const result = await git(args, { cwd }).catch(() => undefined)
    if (!result || result.exitCode !== 0) return
    const value = result.text().trim()
    if (!value) return
    return value
  }

  function comparePath(value: string) {
    const normalized = path.normalize(Filesystem.windowsPath(value)).replace(/[\\/]+$/, "")
    return process.platform === "win32" ? normalized.toLowerCase() : normalized
  }

  export function samePath(a: string, b: string) {
    return comparePath(a) === comparePath(b)
  }

  function isMissingPathError(error: unknown) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    return code === "ENOENT" || code === "ENOTDIR"
  }

  async function assertDirectoryIntegrity(directory: string): Promise<void> {
    let info
    try {
      info = await stat(directory)
    } catch (error) {
      if (!isMissingPathError(error)) throw error
      throw new DirectoryIntegrityError({
        directory,
        reason: "missing",
        message: `Project directory does not exist: ${directory}`,
      })
    }
    if (info.isDirectory()) return
    throw new DirectoryIntegrityError({
      directory,
      reason: "not-directory",
      message: `Project directory is not a directory: ${directory}`,
    })
  }

  async function realComparePath(value: string) {
    try {
      return comparePath(await realpath(value))
    } catch (error) {
      if (isMissingPathError(error)) return undefined
      throw error
    }
  }

  async function statIdentity(value: string) {
    try {
      const info = await stat(value)
      if (info.ino === 0) return undefined
      return `${info.dev}:${info.ino}`
    } catch (error) {
      if (isMissingPathError(error)) return undefined
      throw error
    }
  }

  export async function sameFilesystemLocation(a: string, b: string) {
    if (samePath(a, b)) return true
    const [left, right] = await Promise.all([realComparePath(a), realComparePath(b)])
    if (left !== undefined && right !== undefined && left === right) return true
    const [leftIdentity, rightIdentity] = await Promise.all([statIdentity(a), statIdentity(b)])
    return leftIdentity !== undefined && rightIdentity !== undefined && leftIdentity === rightIdentity
  }

  function sameDirectoryList(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every((directory, index) => directory === b[index])
  }

  async function standaloneCommon(worktree: string, common: string) {
    const localCommon = path.join(worktree, ".git")
    return samePath(common, localCommon) || (await sameFilesystemLocation(common, localCommon))
  }

  export async function localGitDirectory(worktree: string): Promise<string | undefined> {
    const dotgit = path.join(worktree, ".git")
    const info = await stat(dotgit).catch((error) => {
      if (isMissingPathError(error)) return undefined
      throw error
    })
    if (!info) return undefined
    if (info.isDirectory()) return dotgit
    if (!info.isFile()) {
      throw new Error(`Unsupported .git filesystem entry: ${dotgit}`)
    }

    const content = await readFile(dotgit, "utf8")
    const match = /^gitdir:\s*(.+?)\s*$/i.exec(content.trim())
    if (!match?.[1]) {
      throw new Error(`Malformed .git file: ${dotgit}`)
    }
    const gitdir = Filesystem.windowsPath(match[1])
    return Filesystem.resolve(path.isAbsolute(gitdir) ? gitdir : path.join(worktree, gitdir))
  }

  async function findExactWorktreeRow(worktree: string) {
    const rows = Database.use((db) => db.select().from(ProjectTable).all())
    const matches: Row[] = []
    for (const row of rows) {
      if (await sameFilesystemLocation(row.worktree, worktree)) matches.push(row)
    }
    if (matches.length <= 1) return matches[0]
    const projectIDs = matches.map((row) => row.id).sort()
    throw new DuplicateWorktreeIdentityError({
      worktree: path.resolve(worktree),
      projectIDs,
      message: `Worktree ${path.resolve(worktree)} belongs to multiple Projects: ${projectIDs.join(", ")}`,
    })
  }

  async function displayGitTop(directory: string, gitTop: string) {
    return (await sameFilesystemLocation(directory, gitTop)) ? directory : gitTop
  }

  async function identify(common: string, worktree: string) {
    const markerPath = marker(common)
    const localID = generated(common)
    const cachedValue = await Filesystem.readText(marker(common))
      .then((x) => x.trim())
      .catch(() => undefined)
    const cached = currentMarkerIdentity(cachedValue)
    const selectedRow = await findExactWorktreeRow(worktree)
    if (!cached) {
      const id = selectedRow?.id ?? localID
      await Filesystem.write(markerPath, id).catch(() => undefined)
      return id
    }

    if (selectedRow && selectedRow.id !== cached) {
      await Filesystem.write(markerPath, selectedRow.id).catch(() => undefined)
      return selectedRow.id
    }

    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, cached)).get())
    if (!row) return cached
    if (samePath(row.worktree, worktree) || (await sameFilesystemLocation(row.worktree, worktree))) return cached

    // A standalone repository must never reuse another local project's ID.
    // Copied starter repos can share both the root commit and a stale marker;
    // rewrite only this repo's marker to its local .git identity.
    if (await standaloneCommon(worktree, common)) {
      await Filesystem.write(markerPath, localID).catch(() => undefined)
      return localID
    }

    return cached
  }

  async function resolveNonGitDirectoryIdentity(input: {
    directory: string
    dotgit: string
    local: boolean
  }): Promise<{ id: string; sandbox: string; worktree: string }> {
    const localID = generated(input.dotgit)
    const markerPath = marker(input.dotgit)
    const cachedValue = await Filesystem.readText(markerPath)
      .then((x) => x.trim())
      .catch(() => undefined)
    const cached = currentMarkerIdentity(cachedValue)
    const selectedRow = await findExactWorktreeRow(input.directory)
    const id = selectedRow?.id ?? cached ?? localID
    if (input.local && id !== cachedValue) await Filesystem.write(markerPath, id).catch(() => undefined)
    return {
      id,
      sandbox: input.directory,
      worktree: input.directory,
    }
  }

  export class WorktreeIdentityConflictError extends Error {
    constructor(input: { projectID: string; existingWorktree: string; nextWorktree: string }) {
      super(
        `Project identity conflict for ${input.projectID}: existing worktree ${input.existingWorktree}, next worktree ${input.nextWorktree}`,
      )
      this.name = "ProjectWorktreeIdentityConflictError"
    }
  }

  /**
   * The single source of truth for "is this directory a git repository."
   * Sync `.git` probe (file or directory — `.git` is a file in linked
   * worktrees). No DB cache, no Instance cache: rule 22 forbids double-source,
   * and the prior cached `Info.vcs` column silently lied whenever `.git` was
   * deleted between Instance initializations, making auto-init never run and
   * `Worktree.create` throw WorktreeCreateFailedError forever.
   */
  export function isGitRepo(directory: string): boolean {
    return Filesystem.stat(path.join(directory, ".git")) !== undefined
  }

  export const Info = z
    .object({
      id: z.string(),
      worktree: z.string(),
      name: z.string().optional(),
      icon: z
        .object({
          url: z.string().optional(),
          override: z.string().optional(),
          color: z.string().optional(),
        })
        .optional(),
      commands: z
        .object({
          start: z.string().optional().describe("Startup script to run when creating a new workspace (worktree)"),
        })
        .optional(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        pinned: z.number().optional(),
        initialized: z.number().optional(),
      }),
      sandboxes: z.array(z.string()),
    })
    .meta({
      ref: "Project",
    })
  export type Info = z.infer<typeof Info>
  export const InitGitResult = z
    .object({
      created: z.boolean(),
      project: Info,
    })
    .meta({
      ref: "ProjectInitGitResult",
    })
  export const DiscoveredProject = z
    .object({
      id: z.string().optional(),
      directory: z.string(),
      name: z.string(),
      marker: z.string(),
    })
    .meta({
      ref: "DiscoveredProject",
    })
  export type DiscoveredProject = z.infer<typeof DiscoveredProject>
  export const Discovery = z
    .object({
      root: z.string(),
      defaultDirectory: z.string(),
      projects: DiscoveredProject.array(),
    })
    .meta({
      ref: "ProjectDiscovery",
    })
  export type Discovery = z.infer<typeof Discovery>

  export const Event = {
    Updated: BusEvent.define("project.updated", Info),
  }

  export function fromRow(row: Row): Info {
    const icon =
      row.icon_url || row.icon_color
        ? { url: row.icon_url ?? undefined, color: row.icon_color ?? undefined }
        : undefined
    return {
      id: row.id,
      worktree: row.worktree,
      name: row.name ?? undefined,
      icon,
      time: {
        created: row.time_created,
        updated: row.time_updated,
        pinned: row.time_pinned ?? undefined,
        initialized: row.time_initialized ?? undefined,
      },
      sandboxes: row.sandboxes,
      commands: row.commands ?? undefined,
    }
  }

  export async function fromDirectory(directory: string, options: { blockedProjectIDs?: ReadonlySet<string> } = {}) {
    await assertDirectoryIntegrity(directory)
    log.info("fromDirectory", { directory })
    const discoveredOccurrence = await ProjectDirectoryAdmission.observeDirectory(directory)

    const discoverIdentity = () =>
      iife(async () => {
        const registered = findByRegisteredSandbox(directory)
        if (registered) {
          await findExactWorktreeRow(registered.project.worktree)
          return {
            id: registered.project.id,
            sandbox: registered.directory,
            worktree: registered.project.worktree,
          }
        }
        const gitBinary = which("git")
        const dotgit = path.join(directory, ".git")
        const local = await Filesystem.exists(dotgit)

        if (!gitBinary) {
          return resolveNonGitDirectoryIdentity({ directory, dotgit, local })
        }

        // Note (W2-V32): a previous version auto-ran `git init` here when the
        // directory was a non-git subfolder of an existing parent repo (the old
        // `(await initRepo(directory))` branch). That silently materialized a
        // sub-repo as a side effect of *any* request reaching Project.fromDirectory
        // — which violated rule 7 (no fallback) and made the darwin 500-storm
        // possible (cwd-fallback sites would init repos in unintended locations).
        // We now leave non-git subfolders as non-git: callers that need a
        // working tree throw WorktreeNotGitError and the overlay drives an
        // explicit user-confirmed init via POST /project/current/init-git.
        const hasLocalGit = local

        if (hasLocalGit) {
          let sandbox = directory
          const top = await text(["rev-parse", "--show-toplevel"], sandbox)
          if (top) {
            sandbox = await displayGitTop(directory, gitpath(sandbox, top))
          }

          const commonText = await text(["rev-parse", "--git-common-dir"], sandbox)
          const common = commonText ? gitpath(sandbox, commonText) : undefined
          const resolvedCommon = common || path.join(sandbox, ".git")
          const rawWorktree = !common || common === sandbox ? sandbox : path.dirname(common)
          const worktree = await displayGitTop(directory, rawWorktree)
          const id = await identify(resolvedCommon, worktree)

          return {
            id,
            sandbox,
            worktree,
          }
        }

        return resolveNonGitDirectoryIdentity({ directory, dotgit, local: false })
      })
    const data = await discoverIdentity()
    const proposedSandbox =
      data.sandbox !== data.worktree && !(await sameFilesystemLocation(data.sandbox, data.worktree))
        ? data.sandbox
        : undefined
    // This hook models a peer registry writer between the initial discovery
    // and admission. It is deliberately outside the non-reentrant lock; the
    // lock-internal hook below exists for tests that must hold exact admission.
    await beforeDiscoveryCommit?.({ projectID: data.id, directory, proposedSandbox })
    const physicalRegistration = await capturePhysicalRegistrationAuthority(data.id, [
      data.worktree,
      ...(proposedSandbox ? [proposedSandbox] : []),
    ])

    return ProjectDirectoryAdmission.run(async () => {
      const registrations = await acquireRegistrationAdmissions([
        directory,
        data.worktree,
        ...(proposedSandbox ? [proposedSandbox] : []),
      ])
      let settled = false
      try {
        await physicalRegistration.revalidate()
        // Identity discovery may perform git IO before admission, but every fact
        // that authorizes the durable row is revalidated after this backend owns
        // the same cross-process lock as abandoned-directory reclamation.
        await assertDirectoryIntegrity(directory)
        const [admittedOccurrence, admittedIdentity] = await Promise.all([
          ProjectDirectoryAdmission.observeDirectory(directory),
          discoverIdentity(),
        ])
        if (
          !ProjectDirectoryAdmission.sameOccurrence(discoveredOccurrence, admittedOccurrence) ||
          admittedIdentity.id !== data.id ||
          !samePath(admittedIdentity.sandbox, data.sandbox) ||
          !samePath(admittedIdentity.worktree, data.worktree)
        ) {
          throw new DirectoryOccurrenceChangedError({
            directory,
            message: `Project directory occurrence or Git identity changed while discovery waited for admission: ${directory}`,
          })
        }
        const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, data.id)).get())
        if (
          row &&
          !samePath(row.worktree, data.worktree) &&
          !(await sameFilesystemLocation(row.worktree, data.worktree))
        ) {
          throw new WorktreeIdentityConflictError({
            projectID: data.id,
            existingWorktree: row.worktree,
            nextWorktree: data.worktree,
          })
        }
        // Durable sandbox membership is ownership, not a reachability cache.
        // Resolve only the candidate introduced by this request outside the DB
        // transaction. The transaction re-reads the current authority and unions
        // this candidate into that latest row; it never writes a stale snapshot.
        if (options.blockedProjectIDs?.has(data.id)) {
          throw new DurableAdmissionClosedError({
            projectID: data.id,
            message: `Project ${data.id} discovery was admitted while deletion was in progress`,
          })
        }
        await assertProjectDeletionCleanupAdmissionOpen(data.id)
        Database.use((db) => assertRegistryAdmissionOpen(db, data.id))
        await afterDiscoveryAdmission?.({ projectID: data.id, directory, proposedSandbox })

        let committed!: { result: Info; changed: boolean; generation: string }
        ProjectDirectoryAdmission.settleMany(registrations, (db) => {
          physicalRegistration.validate(db)
          assertRegistryAdmissionOpen(db, data.id)
          const currentRow = db.select().from(ProjectTable).where(eq(ProjectTable.id, data.id)).get()
          const resolvedAt = Date.now()
          const current: Info = currentRow
            ? fromRow(currentRow)
            : {
                id: data.id,
                worktree: data.worktree,
                sandboxes: [],
                time: { created: resolvedAt, updated: resolvedAt },
              }
          const sandboxes = [...current.sandboxes]
          if (proposedSandbox && !sandboxes.includes(proposedSandbox)) sandboxes.push(proposedSandbox)
          const changed =
            !currentRow || current.worktree !== data.worktree || !sameDirectoryList(current.sandboxes, sandboxes)
          const generation = currentRow?.generation ?? randomUUID()
          const result: Info = {
            ...current,
            worktree: data.worktree,
            sandboxes,
            time: { ...current.time, updated: changed ? resolvedAt : current.time.updated },
          }
          if (!changed) {
            committed = { result, changed, generation }
            return
          }

          const projects = db
            .select()
            .from(ProjectTable)
            .all()
            .map((candidate) => fromRow(candidate))
          for (const directory of [result.worktree, ...result.sandboxes]) {
            assertRegisteredDirectoryAvailable(result.id, directory, projects)
          }
          if (currentRow) {
            db.update(ProjectTable)
              .set({ worktree: result.worktree, time_updated: result.time.updated, sandboxes: result.sandboxes })
              .where(eq(ProjectTable.id, result.id))
              .run()
          } else {
            db.insert(ProjectTable)
              .values({
                id: result.id,
                generation,
                worktree: result.worktree,
                name: result.name,
                icon_url: result.icon?.url,
                icon_color: result.icon?.color,
                time_created: result.time.created,
                time_updated: result.time.updated,
                time_pinned: result.time.pinned,
                time_initialized: result.time.initialized,
                sandboxes: result.sandboxes,
                commands: result.commands,
              })
              .run()
          }
          committed = { result, changed, generation }
        })
        settled = true
        const result = committed.result
        if (Flag.OPENCORVUS_EXPERIMENTAL_ICON_DISCOVERY) discover(result)
        if (!committed.changed) return { project: result, sandbox: data.sandbox, generation: committed.generation }
        GlobalBus.emit("event", {
          payload: {
            type: Event.Updated.type,
            properties: result,
          },
        })
        return { project: result, sandbox: data.sandbox, generation: committed.generation }
      } finally {
        if (!settled) ProjectDirectoryAdmission.settleMany(registrations, () => undefined)
      }
    })
  }

  export async function discover(input: Info) {
    if (!isGitRepo(input.worktree)) return
    if (input.icon?.override) return
    if (input.icon?.url) return
    const matches = await Glob.scan("**/favicon.{ico,png,svg,jpg,jpeg,webp}", {
      cwd: input.worktree,
      absolute: true,
      include: "file",
    })
    const shortest = matches.sort((a, b) => a.length - b.length)[0]
    if (!shortest) return
    const buffer = await Filesystem.readBytes(shortest)
    const base64 = buffer.toString("base64")
    const mime = Filesystem.mimeType(shortest) || "image/png"
    const url = `data:${mime};base64,${base64}`
    await update({
      projectID: input.id,
      icon: {
        url,
      },
    })
    return
  }

  export function setInitialized(id: string) {
    Database.use((db) =>
      db
        .update(ProjectTable)
        .set({
          time_initialized: Date.now(),
        })
        .where(eq(ProjectTable.id, id))
        .run(),
    )
  }

  export function list() {
    return Database.use((db) =>
      db
        .select()
        .from(ProjectTable)
        .where(
          notExists(
            db
              .select({ projectID: ProjectMaintenanceFenceTable.project_id })
              .from(ProjectMaintenanceFenceTable)
              .where(
                and(
                  eq(ProjectMaintenanceFenceTable.project_id, ProjectTable.id),
                  eq(ProjectMaintenanceFenceTable.kind, "promotion"),
                ),
              ),
          ),
        )
        .all()
        .map((row) => fromRow(row)),
    )
  }

  export function relocate(
    input: {
      projectID: string
      operationID: string
      expectedGeneration: string
      expectedWorktree: string
      worktree: string
      name: string
      sandboxes: string[]
      directoryAdmission: ProjectDirectoryAdmission.Token
    },
    db: Database.TxOrDb,
  ) {
    assertPromotionFenceOwned(db, input, "promotion_commit")
    ProjectDirectoryAdmission.assertOwned(db, input.directoryAdmission)
    if (!samePath(input.directoryAdmission.directory, input.worktree)) {
      throw new Error(`Project relocation directory admission does not own ${input.worktree}`)
    }
    const projects = db
      .select()
      .from(ProjectTable)
      .all()
      .map((candidate) => fromRow(candidate))
    for (const directory of [input.worktree, ...input.sandboxes]) {
      assertRegisteredDirectoryAvailable(input.projectID, directory, projects)
    }
    const row = db
      .update(ProjectTable)
      .set({
        worktree: input.worktree,
        name: input.name,
        sandboxes: input.sandboxes,
        time_updated: Date.now(),
      })
      .where(
        and(
          eq(ProjectTable.id, input.projectID),
          eq(ProjectTable.generation, input.expectedGeneration),
          eq(ProjectTable.worktree, input.expectedWorktree),
        ),
      )
      .returning()
      .get()
    if (!row)
      throw new Error(`Project relocation fence rejected ${input.projectID}: generation or expected worktree changed`)
    return fromRow(row)
  }

  export function restoreRelocation(
    input: {
      projectID: string
      operationID: string
      expectedGeneration: string
      expectedWorktree: string
      worktree: string
      name: string | null
      sandboxes: string[]
      timeUpdated: number
      directoryAdmission: ProjectDirectoryAdmission.Token
    },
    db: Database.TxOrDb,
  ) {
    assertPromotionFenceOwned(db, input, "promotion_commit")
    ProjectDirectoryAdmission.assertOwned(db, input.directoryAdmission)
    if (!samePath(input.directoryAdmission.directory, input.worktree)) {
      throw new Error(`Project relocation restore admission does not own ${input.worktree}`)
    }
    const projects = db
      .select()
      .from(ProjectTable)
      .all()
      .map((candidate) => fromRow(candidate))
    for (const directory of [input.worktree, ...input.sandboxes]) {
      assertRegisteredDirectoryAvailable(input.projectID, directory, projects)
    }
    const row = db
      .update(ProjectTable)
      .set({
        worktree: input.worktree,
        name: input.name,
        sandboxes: input.sandboxes,
        time_updated: input.timeUpdated,
      })
      .where(
        and(
          eq(ProjectTable.id, input.projectID),
          eq(ProjectTable.generation, input.expectedGeneration),
          eq(ProjectTable.worktree, input.expectedWorktree),
        ),
      )
      .returning()
      .get()
    if (!row)
      throw new Error(`Project rollback fence rejected ${input.projectID}: generation or expected worktree changed`)
    return fromRow(row)
  }

  function assertPromotionFenceOwned(
    db: Database.TxOrDb,
    input: { projectID: string; operationID: string; expectedGeneration: string },
    kind: "promotion" | "promotion_commit" = "promotion",
  ): void {
    const fence = db
      .select()
      .from(ProjectMaintenanceFenceTable)
      .where(eq(ProjectMaintenanceFenceTable.project_id, input.projectID))
      .get()
    if (
      fence?.kind === kind &&
      fence.operation_id === input.operationID &&
      fence.project_generation === input.expectedGeneration
    )
      return
    throw new Error(`Project promotion fence rejected ${input.projectID}: occurrence ownership changed`)
  }

  export function beginPromotionCommit(
    input: { projectID: string; operationID: string; expectedGeneration: string },
    db: Database.TxOrDb,
  ): void {
    assertPromotionFenceOwned(db, input)
    db.update(ProjectMaintenanceFenceTable)
      .set({ kind: "promotion_commit" })
      .where(
        and(
          eq(ProjectMaintenanceFenceTable.project_id, input.projectID),
          eq(ProjectMaintenanceFenceTable.operation_id, input.operationID),
        ),
      )
      .run()
  }

  export function finishPromotionCommit(
    input: { projectID: string; operationID: string; expectedGeneration: string },
    db: Database.TxOrDb,
  ): void {
    assertPromotionFenceOwned(db, input, "promotion_commit")
    db.update(ProjectMaintenanceFenceTable)
      .set({ kind: "promotion" })
      .where(
        and(
          eq(ProjectMaintenanceFenceTable.project_id, input.projectID),
          eq(ProjectMaintenanceFenceTable.operation_id, input.operationID),
        ),
      )
      .run()
  }

  export function registeredDirectories(): string[] {
    const directories: string[] = []
    for (const project of list()) {
      for (const directory of [project.worktree, ...project.sandboxes]) {
        if (!directories.some((candidate) => samePath(candidate, directory))) directories.push(directory)
      }
    }
    return directories
  }

  function registeredDirectoryMatches(directory: string, projects: Info[]) {
    const target = path.resolve(directory)
    const matches = new Map<string, { project: Info; directory: string }>()
    for (const project of projects) {
      if (samePath(project.worktree, target)) {
        matches.set(project.id, { project, directory: project.worktree })
        continue
      }
      const sandbox = project.sandboxes.find((candidate) => samePath(candidate, target))
      if (sandbox) matches.set(project.id, { project, directory: sandbox })
    }
    return [...matches.values()]
  }

  function assertRegisteredDirectoryAvailable(projectID: string, directory: string, projects: Info[]) {
    const target = path.resolve(directory)
    const conflictingProjectIDs = [
      ...new Set(
        registeredDirectoryMatches(target, projects)
          .map((match) => match.project.id)
          .filter((value) => value !== projectID),
      ),
    ]
    if (conflictingProjectIDs.length === 0) return
    const projectIDs = [projectID, ...conflictingProjectIDs].sort()
    throw new RegisteredDirectoryConflictError({
      directory: target,
      projectIDs,
      message: `Cannot register ${target} for Project ${projectID}; it belongs to Project${conflictingProjectIDs.length === 1 ? "" : "s"} ${conflictingProjectIDs.join(", ")}`,
    })
  }

  export function findByRegisteredDirectory(directory: string) {
    const target = path.resolve(directory)
    const matches = registeredDirectoryMatches(target, list())
    if (matches.length > 1) {
      const projectIDs = matches.map((match) => match.project.id).sort()
      throw new RegisteredDirectoryConflictError({
        directory: target,
        projectIDs,
        message: `Registered directory ${target} belongs to multiple Projects: ${projectIDs.join(", ")}`,
      })
    }
    return matches[0]
  }

  function findByRegisteredSandbox(directory: string) {
    const target = path.resolve(directory)
    const matches: Array<{ project: Info; directory: string }> = []
    for (const project of list()) {
      const sandbox = project.sandboxes.find((candidate) => samePath(candidate, target))
      if (sandbox) matches.push({ project, directory: sandbox })
    }
    if (matches.length > 1) {
      const projectIDs = matches.map((match) => match.project.id).sort()
      throw new RegisteredDirectoryConflictError({
        directory: target,
        projectIDs,
        message: `Registered sandbox ${target} belongs to multiple Projects: ${projectIDs.join(", ")}`,
      })
    }
    return matches[0]
  }

  function explicitLaunchProjectDirectory() {
    const value = process.env.OPENCORVUS_PROJECT_DIR
    return typeof value === "string" && value.trim() ? Filesystem.resolve(value) : ""
  }

  function launchDirectory() {
    return explicitLaunchProjectDirectory() || Filesystem.resolve(process.cwd())
  }

  function projectName(directory: string) {
    return path.basename(directory.replace(/[\\/]+$/, "")) || directory
  }

  async function hasOpenCorvusMarker(directory: string) {
    try {
      return (await stat(path.join(directory, ".opencorvus"))).isDirectory()
    } catch (error) {
      if (isMissingPathError(error)) return false
      throw error
    }
  }

  async function immediateDirectories(root: string) {
    const entries = await readdir(root, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name))
      .sort((a, b) => a.localeCompare(b))
  }

  export async function discoverFromLaunchDirectory(): Promise<Discovery> {
    const root = launchDirectory()
    const candidates = [root, ...(await immediateDirectories(root))]
    const projects = new Map<string, DiscoveredProject>()
    const defaultDirectory = explicitLaunchProjectDirectory()

    const add = (project: DiscoveredProject) => {
      const key = comparePath(project.directory)
      if (!projects.has(key)) projects.set(key, project)
    }

    for (const project of list()) {
      add({
        id: project.id,
        directory: project.worktree,
        name: project.name ?? projectName(project.worktree),
        marker: path.join(project.worktree, ".opencorvus"),
      })
      for (const sandbox of project.sandboxes) {
        add({
          id: project.id,
          directory: sandbox,
          name: project.name ?? projectName(sandbox),
          marker: path.join(sandbox, ".opencorvus"),
        })
      }
    }

    for (const directory of candidates) {
      if (!(await hasOpenCorvusMarker(directory))) continue
      add({
        directory,
        name: projectName(directory),
        marker: path.join(directory, ".opencorvus"),
      })
    }
    return Discovery.parse({ root, defaultDirectory, projects: [...projects.values()] })
  }

  export function occurrence(id: string): { project: Info; generation: string } | undefined {
    const row = Database.use((db) =>
      db
        .select()
        .from(ProjectTable)
        .where(
          and(
            eq(ProjectTable.id, id),
            notExists(
              db
                .select({ projectID: ProjectMaintenanceFenceTable.project_id })
                .from(ProjectMaintenanceFenceTable)
                .where(
                  and(
                    eq(ProjectMaintenanceFenceTable.project_id, ProjectTable.id),
                    eq(ProjectMaintenanceFenceTable.kind, "promotion"),
                  ),
                ),
            ),
          ),
        )
        .get(),
    )
    if (!row) return undefined
    return { project: fromRow(row), generation: row.generation }
  }

  export function get(id: string): Info | undefined {
    return occurrence(id)?.project
  }

  export async function initGit(directory: string) {
    if (isGitRepo(directory)) {
      const current = await fromDirectory(directory)
      return InitGitResult.parse({
        created: false,
        project: current.project,
      })
    }
    if (!which("git")) {
      throw new Error("git is not installed")
    }
    const result = await git(["init"], { cwd: directory })
    if (result.exitCode !== 0) {
      const detail = result.stderr.toString().trim() || result.text().trim() || "git init failed"
      throw new Error(detail)
    }
    if (!(await Filesystem.exists(path.join(directory, ".git")))) {
      throw new Error("git init completed without creating .git")
    }
    const next = await fromDirectory(directory)
    // Cache refresh is the caller's responsibility. Doing it here would
    // dual-source with task-api/prepareProject and server/routes/project,
    // and — critically — when this path runs INSIDE Instance.provide's
    // bootstrap iife (instance.ts:51), Instance.refresh() awaits the very
    // same in-flight iife it was called from → self-deadlock. The
    // bootstrap path re-reads via Project.fromDirectory at instance.ts:52
    // immediately after this returns; both other callers already invoke
    // Instance.refresh() right after this returns. Rule 8: single source.
    return InitGitResult.parse({
      created: true,
      project: next.project,
    })
  }

  export const update = fn(
    z.object({
      projectID: z.string(),
      name: z.string().optional(),
      icon: Info.shape.icon.optional(),
      commands: Info.shape.commands.optional(),
    }),
    async (input) => {
      const result = Database.use((db) =>
        db
          .update(ProjectTable)
          .set({
            name: input.name,
            icon_url: input.icon?.url,
            icon_color: input.icon?.color,
            commands: input.commands,
            time_updated: Date.now(),
          })
          .where(eq(ProjectTable.id, input.projectID))
          .returning()
          .get(),
      )
      if (!result) throw new Error(`Project not found: ${input.projectID}`)
      const data = fromRow(result)
      GlobalBus.emit("event", {
        payload: {
          type: Event.Updated.type,
          properties: data,
        },
      })
      return data
    },
  )

  export const setPinned = fn(
    z.object({
      projectID: z.string(),
      pinned: z.boolean(),
    }),
    async (input) => {
      const result = Database.use((db) =>
        db
          .update(ProjectTable)
          .set({
            time_pinned: input.pinned ? Date.now() : null,
            // Pinning is presentation state, not project activity.
            time_updated: ProjectTable.time_updated,
          })
          .where(eq(ProjectTable.id, input.projectID))
          .returning()
          .get(),
      )
      if (!result) throw new NotFoundError({ message: `Project not found: ${input.projectID}` })
      const data = fromRow(result)
      GlobalBus.emit("event", {
        payload: {
          type: Event.Updated.type,
          properties: data,
        },
      })
      return data
    },
  )

  export async function sandboxes(id: string) {
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, id)).get())
    if (!row) return []
    const data = fromRow(row)
    const valid: string[] = []
    for (const dir of data.sandboxes) {
      const s = Filesystem.stat(dir)
      if (s?.isDirectory()) valid.push(dir)
    }
    return valid
  }

  function addSandboxRow(db: Database.TxOrDb, id: string, target: string) {
    assertRegistryAdmissionOpen(db, id)
    const rows = db.select().from(ProjectTable).all()
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) throw new Error(`Project not found: ${id}`)
    const projects = rows.map((candidate) => fromRow(candidate))
    assertRegisteredDirectoryAvailable(id, target, projects)
    const matches = registeredDirectoryMatches(target, projects)
    if (matches.some((match) => match.project.id === id)) return fromRow(row)
    return fromRow(
      db
        .update(ProjectTable)
        .set({ sandboxes: [...row.sandboxes, target], time_updated: Date.now() })
        .where(eq(ProjectTable.id, id))
        .returning()
        .get(),
    )
  }

  export async function addSandbox(id: string, directory: string) {
    const target = Filesystem.resolve(directory)
    return addSandboxWithValidation(id, target)
  }

  async function addSandboxWithValidation(id: string, target: string, validate?: () => void | Promise<void>) {
    const discoveredOccurrence = await ProjectDirectoryAdmission.observeDirectory(target)
    const physicalRegistration = await capturePhysicalRegistrationAuthority(id, [target])
    return ProjectDirectoryAdmission.run(async () => {
      const registrations = await acquireRegistrationAdmissions([target])
      let settled = false
      try {
        await physicalRegistration.revalidate()
        const admittedOccurrence = await ProjectDirectoryAdmission.observeDirectory(target)
        if (!ProjectDirectoryAdmission.sameOccurrence(discoveredOccurrence, admittedOccurrence)) {
          throw new DirectoryOccurrenceChangedError({
            directory: target,
            message: `Project sandbox occurrence changed while registration waited for admission: ${target}`,
          })
        }
        await validate?.()
        let result!: Info
        ProjectDirectoryAdmission.settleMany(registrations, (db) => {
          physicalRegistration.validate(db)
          result = addSandboxRow(db, id, target)
        })
        settled = true
        GlobalBus.emit("event", {
          payload: {
            type: Event.Updated.type,
            properties: result,
          },
        })
        return result
      } finally {
        if (!settled) ProjectDirectoryAdmission.settleMany(registrations, () => undefined)
      }
    })
  }

  /**
   * Bind a Task execution repository to an existing durable project namespace.
   * Registration is explicit and exclusive: Project discovery may then project
   * this directory as the project's sandbox without re-identifying a nested
   * standalone clone as a second storage project.
   */
  export async function registerExecutionDirectory(projectID: string, directory: string) {
    const target = Filesystem.resolve(directory)
    const ownerExists = Database.use((db) =>
      db.select({ id: ProjectTable.id }).from(ProjectTable).where(eq(ProjectTable.id, projectID)).get(),
    )
    if (!ownerExists) throw new Error(`Project not found: ${projectID}`)
    const registered = findByRegisteredDirectory(target)
    if (registered) {
      if (registered.project.id !== projectID) {
        throw new Error(
          `Task execution directory ${target} belongs to project ${registered.project.id}, expected ${projectID}`,
        )
      }
      return target
    }
    await addSandboxWithValidation(projectID, target, () => {
      if (!isGitRepo(target)) throw new Error(`Task execution directory is not a git repository: ${target}`)
    })
    return target
  }

  export async function removeSandbox(id: string, directory: string) {
    const target = Filesystem.windowsPath(path.resolve(directory))
    const result = Database.transaction((db) => {
      assertRegistryAdmissionOpen(db, id)
      const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, id)).get()
      if (!row) throw new Error(`Project not found: ${id}`)
      const sandboxes = row.sandboxes.filter((s) => Filesystem.windowsPath(path.resolve(s)) !== target)
      return db
        .update(ProjectTable)
        .set({ sandboxes, time_updated: Date.now() })
        .where(eq(ProjectTable.id, id))
        .returning()
        .get()
    })
    if (!result) throw new Error(`Project not found: ${id}`)
    const data = fromRow(result)
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: data,
      },
    })
    return data
  }

  export async function removeExactSandboxes(
    id: string,
    directories: readonly string[],
    expected: { sandboxes: readonly string[]; timeUpdated: number },
  ) {
    const targets = new Set(directories)
    if (targets.size === 0) {
      const project = get(id)
      if (!project) throw new Error(`Project not found: ${id}`)
      return project
    }
    const result = Database.transaction((db) => {
      assertRegistryAdmissionOpen(db, id)
      const row = db.select().from(ProjectTable).where(eq(ProjectTable.id, id)).get()
      if (!row) throw new Error(`Project not found: ${id}`)
      if (
        row.time_updated !== expected.timeUpdated ||
        row.sandboxes.length !== expected.sandboxes.length ||
        row.sandboxes.some((sandbox, index) => sandbox !== expected.sandboxes[index])
      ) {
        throw new Error(`Project sandbox authority changed during explicit release: ${id}`)
      }
      const remainingTargets = new Set(targets)
      for (const sandbox of row.sandboxes) remainingTargets.delete(sandbox)
      if (remainingTargets.size > 0) {
        throw new Error(`Project sandbox authority changed during explicit release: ${id}`)
      }
      return db
        .update(ProjectTable)
        .set({ sandboxes: row.sandboxes.filter((sandbox) => !targets.has(sandbox)), time_updated: Date.now() })
        .where(eq(ProjectTable.id, id))
        .returning()
        .get()
    })
    if (!result) throw new Error(`Project not found: ${id}`)
    const data = fromRow(result)
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: data,
      },
    })
    return data
  }

  export function exactSandboxAuthority(id: string): { sandboxes: string[]; timeUpdated: number } | undefined {
    const row = Database.use((db) =>
      db
        .select({ sandboxes: ProjectTable.sandboxes, timeUpdated: ProjectTable.time_updated })
        .from(ProjectTable)
        .where(eq(ProjectTable.id, id))
        .get(),
    )
    if (!row) return undefined
    return { sandboxes: [...row.sandboxes], timeUpdated: row.timeUpdated }
  }
}
