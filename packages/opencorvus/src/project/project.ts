import z from "zod"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { createHash, randomUUID } from "crypto"
import { Database, eq, NotFoundError, sql } from "../storage/db"
import { ProjectTable } from "./project.sql"
import { Log } from "../util/log"
import { Flag } from "@/flag/flag"
import { fn } from "@opencorvus-ai/util/fn"
import { BusEvent } from "@/bus/bus-event"
import { iife } from "@/util/iife"
import { GlobalBus } from "@/bus/global"
import { existsSync, lstatSync } from "fs"
import { readFile, realpath, readdir, stat } from "fs/promises"
import { hostGit as git } from "../util/git"
import { Glob } from "../util/glob"
import { which } from "@/util/which"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { NamedError } from "@opencorvus-ai/util/error"
import { assertProjectDurableAdmissionOpen } from "./deletion-registry"

export namespace Project {
  export const DurableAdmissionClosedError = NamedError.create(
    "ProjectDurableAdmissionClosedError",
    z.object({
      projectID: z.string(),
      message: z.string(),
    }),
  )

  export function assertDurableAdmissionOpen(projectID: string): void {
    if (assertProjectDurableAdmissionOpen(projectID)) return
    throw new DurableAdmissionClosedError({
      projectID,
      message: `Project ${projectID} durable admission is closed during deletion`,
    })
  }

  function assertRegistryAdmissionOpen(projectID: string) {
    if (!assertProjectDurableAdmissionOpen(projectID)) {
      throw new DurableAdmissionClosedError({
        projectID,
        message: `Project ${projectID} registry admission is closed during deletion`,
      })
    }
  }
  const log = Log.create({ service: "project" })
  type Row = typeof ProjectTable.$inferSelect

  export const DirectoryIntegrityError = NamedError.create(
    "ProjectDirectoryIntegrityError",
    z.object({
      directory: z.string(),
      reason: z.enum(["missing", "not-directory"]),
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
    return createHash("sha1").update(Filesystem.windowsPath(seed)).digest("hex")
  }

  function sqliteIdentifier(name: string) {
    return `"${name.replaceAll('"', '""')}"`
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

  function projectIDTables(db: Database.TxOrDb) {
    const rows = db.all<{ name: string }>(sql`
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `)
    return rows
      .filter((row) =>
        db
          .all<{ name: string }>(sql.raw(`PRAGMA table_info(${sqliteIdentifier(row.name)})`))
          .some((column) => column.name === "project_id"),
      )
      .map((row) => row.name)
  }

  function projectReferenceCount(db: Database.TxOrDb, table: string, projectID: string) {
    const row = db.get<{ count: number }>(
      sql`SELECT count(*) as count FROM ${sql.raw(sqliteIdentifier(table))} WHERE project_id = ${projectID}`,
    )
    return row?.count ?? 0
  }

  function chooseCanonicalExactWorktreeRow(input: { rows: Row[]; preferredIDs: string[] }) {
    for (const id of input.preferredIDs) {
      const row = input.rows.find((candidate) => candidate.id === id)
      if (row) return row
    }
  }

  function assertNoEmbeddedProjectIDReferences(
    db: Database.TxOrDb,
    worktree: string,
    canonicalID: string,
    duplicateIDs: string[],
  ) {
    const rows = db.all<{ tableName: string }>(sql`
      SELECT name as tableName
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND sql LIKE 'CREATE TABLE%'
      ORDER BY name
    `)
    for (const duplicateID of duplicateIDs) {
      const needle = `/attachment/${duplicateID}/`
      for (const row of rows) {
        const columns = db.all<{ name: string; type: string }>(
          sql.raw(`PRAGMA table_info(${sqliteIdentifier(row.tableName)})`),
        )
        const textColumns = columns.filter((column) => column.type.toUpperCase().includes("TEXT"))
        for (const column of textColumns) {
          const match = db.get<{ count: number }>(
            sql`SELECT count(*) as count FROM ${sql.raw(sqliteIdentifier(row.tableName))} WHERE instr(${sql.raw(sqliteIdentifier(column.name))}, ${needle}) > 0`,
          )
          if ((match?.count ?? 0) > 0) {
            throw new WorktreeIdentityConflictError({
              projectID: [canonicalID, ...duplicateIDs].join(","),
              existingWorktree: worktree,
              nextWorktree: `${worktree} blocked by embedded attachment reference ${needle} in ${row.tableName}.${column.name}`,
            })
          }
        }
      }
    }
  }

  function assertNoUniqueProjectConstraintConflict(
    db: Database.TxOrDb,
    worktree: string,
    canonicalID: string,
    duplicateIDs: string[],
  ) {
    const convergenceIDs = [canonicalID, ...duplicateIDs]
    const permissionOwners = convergenceIDs.filter((id) => projectReferenceCount(db, "permission", id) > 0)
    if (permissionOwners.length > 1) {
      throw new WorktreeIdentityConflictError({
        projectID: permissionOwners.join(","),
        existingWorktree: worktree,
        nextWorktree: `${worktree} blocked by duplicate permission rows that cannot be converged`,
      })
    }

    const rows = db.all<{ requestID: string; projectID: string; count: number }>(sql`
      SELECT request_id as requestID, project_id as projectID, count(*) as count
      FROM engine_task
      WHERE request_id IS NOT NULL
        AND project_id IN (${sql.join([canonicalID, ...duplicateIDs], sql`, `)})
      GROUP BY request_id, project_id
    `)
    const byRequest = new Map<string, Set<string>>()
    for (const row of rows) {
      if (row.count <= 0) continue
      const owners = byRequest.get(row.requestID) ?? new Set<string>()
      owners.add(row.projectID)
      byRequest.set(row.requestID, owners)
    }
    for (const [requestID, owners] of byRequest) {
      if (owners.size > 1) {
        throw new WorktreeIdentityConflictError({
          projectID: [...owners].join(","),
          existingWorktree: worktree,
          nextWorktree: `${worktree} blocked by duplicate request_id ${requestID} that cannot be converged`,
        })
      }
    }
  }

  function assertNoTaskArtifactProjectIdentityConflict(
    db: Database.TxOrDb,
    worktree: string,
    duplicateIDs: string[],
  ): void {
    const tasks = db.all<{ id: string; projectID: string }>(sql`
      SELECT id, project_id as projectID
      FROM engine_task
      WHERE project_id IN (${sql.join(duplicateIDs, sql`, `)})
    `)
    for (const task of tasks) {
      const artifactPaths = [ProjectRuntimePaths.taskArtifactRoot(worktree, task.id)]
      let found = false
      for (const artifactPath of artifactPaths) {
        try {
          lstatSync(artifactPath)
          found = true
          break
        } catch (cause) {
          if ((cause as NodeJS.ErrnoException | undefined)?.code === "ENOENT") continue
          throw new WorktreeIdentityConflictError({
            projectID: task.projectID,
            existingWorktree: worktree,
            nextWorktree:
              `${worktree} blocked because TaskArtifact identity could not be inspected for Task ${task.id}: ` +
              (cause instanceof Error ? cause.message : String(cause)),
          })
        }
      }
      if (!found) continue
      throw new WorktreeIdentityConflictError({
        projectID: task.projectID,
        existingWorktree: worktree,
        nextWorktree:
          `${worktree} blocked by immutable TaskArtifact identity for Task ${task.id}; ` +
          "Project identity convergence must complete before TaskArtifact publication",
      })
    }
  }

  function mergeExactWorktreeRows(input: { worktree: string; rows: Row[]; canonical: Row }) {
    const duplicateRows = input.rows.filter((row) => row.id !== input.canonical.id)
    if (duplicateRows.length === 0) return input.canonical

    return Database.transaction((db) => {
      const duplicateIDs = duplicateRows.map((row) => row.id)
      for (const projectID of [input.canonical.id, ...duplicateIDs]) assertRegistryAdmissionOpen(projectID)
      assertNoEmbeddedProjectIDReferences(db, input.worktree, input.canonical.id, duplicateIDs)
      assertNoUniqueProjectConstraintConflict(db, input.worktree, input.canonical.id, duplicateIDs)
      assertNoTaskArtifactProjectIdentityConflict(db, input.worktree, duplicateIDs)
      const projectScopedTables = projectIDTables(db)
      for (const duplicate of duplicateRows) {
        for (const table of projectScopedTables) {
          db.run(
            sql`UPDATE ${sql.raw(sqliteIdentifier(table))} SET project_id = ${input.canonical.id} WHERE project_id = ${duplicate.id}`,
          )
        }
      }

      const duplicateSandboxes = duplicateRows.flatMap((row) => row.sandboxes)
      const sandboxes = [...new Set([...input.canonical.sandboxes, ...duplicateSandboxes])]
      const projects = db
        .select()
        .from(ProjectTable)
        .all()
        .filter((candidate) => !duplicateIDs.includes(candidate.id))
        .map((candidate) => fromRow(candidate))
      for (const directory of [input.worktree, ...sandboxes]) {
        assertRegisteredDirectoryAvailable(input.canonical.id, directory, projects)
      }
      const firstWith = <K extends keyof Row>(key: K) =>
        input.canonical[key] ?? duplicateRows.find((row) => row[key] !== null && row[key] !== undefined)?.[key]
      const now = Date.now()
      db.update(ProjectTable)
        .set({
          name: firstWith("name") as string | null,
          icon_url: firstWith("icon_url") as string | null,
          icon_color: firstWith("icon_color") as string | null,
          time_updated: now,
          time_initialized: firstWith("time_initialized") as number | null,
          sandboxes,
          commands: firstWith("commands") as { start?: string } | null,
        })
        .where(eq(ProjectTable.id, input.canonical.id))
        .run()

      for (const duplicate of duplicateRows) {
        db.delete(ProjectTable).where(eq(ProjectTable.id, duplicate.id)).run()
      }

      log.warn("converged duplicate exact project worktree rows", {
        worktree: input.worktree,
        canonicalProjectID: input.canonical.id,
        duplicateProjectIDs: duplicateRows.map((row) => row.id).join(","),
      })

      return db.select().from(ProjectTable).where(eq(ProjectTable.id, input.canonical.id)).get() ?? input.canonical
    })
  }

  function findExactWorktreeRow(worktree: string, preferredIDs: string[] = []) {
    const rows = Database.use((db) => db.select().from(ProjectTable).all())
    const matches = rows.filter((row) => samePath(row.worktree, worktree))
    if (matches.length <= 1) return matches[0]
    const canonical = Database.use((db) =>
      chooseCanonicalExactWorktreeRow({
        rows: matches,
        preferredIDs: preferredIDs.filter(Boolean),
      }),
    )
    if (canonical) return mergeExactWorktreeRows({ worktree, rows: matches, canonical })
    throw new WorktreeIdentityConflictError({
      projectID: matches.map((row) => row.id).join(","),
      existingWorktree: matches[0].worktree,
      nextWorktree: worktree,
    })
  }

  async function displayGitTop(directory: string, gitTop: string) {
    return (await sameFilesystemLocation(directory, gitTop)) ? directory : gitTop
  }

  async function identify(common: string, worktree: string) {
    const markerPath = marker(common)
    const localID = generated(common)
    const cached = await Filesystem.readText(marker(common))
      .then((x) => x.trim())
      .catch(() => undefined)
    const selectedRow = findExactWorktreeRow(worktree, [cached ?? "", localID])
    if (!cached || cached === "global") {
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
    const cached = await Filesystem.readText(markerPath)
      .then((x) => x.trim())
      .catch(() => undefined)
    const selectedRow = findExactWorktreeRow(input.directory, [cached ?? "", localID])
    const id = selectedRow?.id ?? (cached && cached !== "global" ? cached : localID)
    if (input.local && id !== cached) await Filesystem.write(markerPath, id).catch(() => undefined)
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

    const data = await iife(async () => {
      const registered = findByRegisteredSandbox(directory)
      if (registered) {
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

    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, data.id)).get())
    if (row && !samePath(row.worktree, data.worktree) && !(await sameFilesystemLocation(row.worktree, data.worktree))) {
      throw new WorktreeIdentityConflictError({
        projectID: data.id,
        existingWorktree: row.worktree,
        nextWorktree: data.worktree,
      })
    }
    const resolvedAt = Date.now()
    const existing = await iife(async () => {
      if (row) return fromRow(row)
      const fresh: Info = {
        id: data.id,
        worktree: data.worktree,
        sandboxes: [],
        time: {
          created: resolvedAt,
          updated: resolvedAt,
        },
      }
      return fresh
    })

    if (Flag.OPENCORVUS_EXPERIMENTAL_ICON_DISCOVERY) discover(existing)

    const sandboxes = [...existing.sandboxes]
    if (data.sandbox !== data.worktree && !sandboxes.includes(data.sandbox)) sandboxes.push(data.sandbox)
    const resolvedSandboxes = (
      await Promise.all(
        sandboxes
          .filter((candidate) => existsSync(candidate))
          .map(async (candidate) => ({
            path: candidate,
            isProjectRoot: await sameFilesystemLocation(candidate, data.worktree),
          })),
      )
    )
      .filter((candidate) => !candidate.isProjectRoot)
      .map((candidate) => candidate.path)
    const changed =
      !row || existing.worktree !== data.worktree || !sameDirectoryList(existing.sandboxes, resolvedSandboxes)
    const result: Info = {
      ...existing,
      worktree: data.worktree,
      sandboxes: resolvedSandboxes,
      time: {
        ...existing.time,
        updated: changed ? resolvedAt : existing.time.updated,
      },
    }
    if (options.blockedProjectIDs?.has(result.id)) {
      throw new DurableAdmissionClosedError({
        projectID: result.id,
        message: `Project ${result.id} discovery was admitted while deletion was in progress`,
      })
    }
    assertRegistryAdmissionOpen(result.id)
    if (!changed) return { project: result, sandbox: data.sandbox }

    const insert = {
      id: result.id,
      generation: randomUUID(),
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
    }
    const updateSet = {
      worktree: result.worktree,
      name: result.name,
      icon_url: result.icon?.url,
      icon_color: result.icon?.color,
      time_updated: result.time.updated,
      time_pinned: result.time.pinned,
      time_initialized: result.time.initialized,
      sandboxes: result.sandboxes,
      commands: result.commands,
    }
    Database.transaction((db) => {
      assertRegistryAdmissionOpen(result.id)
      const projects = db
        .select()
        .from(ProjectTable)
        .all()
        .map((candidate) => fromRow(candidate))
      for (const directory of [result.worktree, ...result.sandboxes]) {
        assertRegisteredDirectoryAvailable(result.id, directory, projects)
      }
      db.insert(ProjectTable).values(insert).onConflictDoUpdate({ target: ProjectTable.id, set: updateSet }).run()
    })
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: result,
      },
    })
    return { project: result, sandbox: data.sandbox }
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
        .all()
        .map((row) => fromRow(row)),
    )
  }

  export function relocate(
    input: {
      projectID: string
      worktree: string
      name: string
      sandboxes: string[]
    },
    db: Database.TxOrDb,
  ) {
    assertRegistryAdmissionOpen(input.projectID)
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
      .where(eq(ProjectTable.id, input.projectID))
      .returning()
      .get()
    if (!row) throw new Error(`Project not found: ${input.projectID}`)
    return fromRow(row)
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

  export function get(id: string): Info | undefined {
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, id)).get())
    if (!row) return undefined
    return fromRow(row)
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

  function addSandboxRow(id: string, target: string) {
    const result = Database.transaction((db) => {
      assertRegistryAdmissionOpen(id)
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
    })
    GlobalBus.emit("event", {
      payload: {
        type: Event.Updated.type,
        properties: result,
      },
    })
    return result
  }

  export async function addSandbox(id: string, directory: string) {
    const target = Filesystem.resolve(directory)
    return addSandboxRow(id, target)
  }

  /**
   * Bind a Task execution repository to an existing durable project namespace.
   * Registration is explicit and exclusive: Project discovery may then project
   * this directory as the project's sandbox without re-identifying a nested
   * standalone clone as a second storage project.
   */
  export async function registerExecutionDirectory(projectID: string, directory: string) {
    const target = Filesystem.resolve(directory)
    const owner = get(projectID)
    if (!owner) throw new Error(`Project not found: ${projectID}`)
    const registered = findByRegisteredDirectory(target)
    if (registered) {
      if (registered.project.id !== projectID) {
        throw new Error(
          `Task execution directory ${target} belongs to project ${registered.project.id}, expected ${projectID}`,
        )
      }
      return target
    }
    if (!isGitRepo(target)) {
      throw new Error(`Task execution directory is not a git repository: ${target}`)
    }
    await addSandbox(projectID, target)
    return target
  }

  export async function removeSandbox(id: string, directory: string) {
    const target = Filesystem.windowsPath(path.resolve(directory))
    const result = Database.transaction((db) => {
      assertRegistryAdmissionOpen(id)
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
      assertRegistryAdmissionOpen(id)
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
