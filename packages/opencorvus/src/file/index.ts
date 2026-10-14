import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { formatPatch, structuredPatch } from "diff"
import path from "path"
import fs from "fs"
import ignore from "ignore"
import { Log } from "../util/log"
import { Filesystem } from "../util/filesystem"
import { readFileEntry, sameFileEntry, type FileEntry } from "../util/file-entry"
import { filePositionKey, walkFileAccess } from "../util/file-access"
import { observeRelocationTree, verifyRelocationTargets, type RelocationTree } from "../util/file-relocation"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Project } from "../project/project"
import { Ripgrep } from "./ripgrep"
import fuzzysort from "fuzzysort"
import { Global } from "../global"
import { NamedError } from "@opencorvus-ai/util/error"
import { createHash, randomUUID } from "node:crypto"
import { isUtf8 } from "node:buffer"
import { withKeyedLock } from "../util/lock"
import { CROSS_PROCESS_LOCK_RETRY, SHARED_JSON_FACT_QUEUE_TIMEOUT_MS, withProcessLock } from "../util/process-lock"
import { hostGit } from "../util/git"
import { gitSourcePaths } from "../util/git-source-paths"
import { gitSourceLinkDiffs } from "../util/git-source-links"
import { checkedSourceGit, gitSourceRunner, gitSourceEntryArgs } from "../util/git-source-stage"
import { AttachmentStore } from "../storage/attachment-store"

export namespace File {
  const log = Log.create({ service: "file" })
  const uploadLocks = new Map<string, Promise<unknown>>()
  const writeLocks = new Map<string, Promise<unknown>>()

  export const Info = z
    .object({
      path: z.string(),
      added: z.number().int(),
      removed: z.number().int(),
      status: z.enum(["added", "deleted", "modified"]),
    })
    .meta({
      ref: "File",
    })

  export type Info = z.infer<typeof Info>

  export const Node = z
    .object({
      name: z.string(),
      path: z.string(),
      absolute: z.string(),
      type: z.enum(["file", "directory"]),
      ignored: z.boolean(),
    })
    .meta({
      ref: "FileNode",
    })
  export type Node = z.infer<typeof Node>

  export const ListingNode = Node.extend({ directoryTarget: z.boolean() }).meta({ ref: "FileListingNode" })
  export type ListingNode = z.infer<typeof ListingNode>

  export const ContentRevision = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .describe("Opaque revision of the exact loaded file bytes and canonical physical resource identity.")

  export const Content = z
    .object({
      type: z.enum(["text", "binary"]),
      content: z.string(),
      displayName: z.string().optional().describe("Canonical attachment display name for project-scoped file content."),
      revision: ContentRevision.optional(),
      diff: z.string().optional(),
      patch: z
        .object({
          oldFileName: z.string(),
          newFileName: z.string(),
          oldHeader: z.string().optional(),
          newHeader: z.string().optional(),
          hunks: z.array(
            z.object({
              oldStart: z.number(),
              oldLines: z.number(),
              newStart: z.number(),
              newLines: z.number(),
              lines: z.array(z.string()),
            }),
          ),
          index: z.string().optional(),
        })
        .optional(),
      encoding: z.literal("base64").optional(),
      mimeType: z.string().optional(),
    })
    .meta({
      ref: "FileContent",
    })
  export type Content = z.infer<typeof Content>

  export const UploadFile = z.object({
    name: z.string().min(1),
    contentBase64: z.string(),
    mimeType: z.string().optional(),
  })
  export type UploadFile = z.infer<typeof UploadFile>

  export const UploadRequest = z.object({
    targetDir: z.string(),
    files: UploadFile.array().min(1),
  })
  export type UploadRequest = z.infer<typeof UploadRequest>

  export const UploadResult = z.object({
    name: z.string(),
    path: z.string(),
    bytes: z.number().int().nonnegative(),
  })
  export type UploadResult = z.infer<typeof UploadResult>

  export type UploadPublicationResidue = {
    path: string
    exists: boolean | null
  }

  export class UploadPublicationError extends AggregateError {
    override readonly name = "FileUploadPublicationError"

    constructor(
      cause: unknown,
      cleanupFailures: unknown[],
      public readonly residue: UploadPublicationResidue[],
    ) {
      super([cause, ...cleanupFailures], "File upload failed and cleanup left observable residue", { cause })
    }
  }

  export class CopyPublicationError extends AggregateError {
    override readonly name = "FileCopyPublicationError"

    constructor(
      cause: unknown,
      cleanupFailures: unknown[],
      public readonly residue: UploadPublicationResidue[],
    ) {
      super([cause, ...cleanupFailures], "File copy failed and cleanup left observable residue", { cause })
    }
  }

  export const CreateRequest = z.object({
    path: z.string(),
    type: z.enum(["file", "directory"]),
    content: z.string().optional(),
  })
  export type CreateRequest = z.infer<typeof CreateRequest>

  export const MoveRequest = z.object({
    path: z.string(),
    newPath: z.string(),
  })
  export type MoveRequest = z.infer<typeof MoveRequest>

  export const CopyRequest = z.object({
    path: z.string(),
    newPath: z.string(),
  })
  export type CopyRequest = z.infer<typeof CopyRequest>

  export const MoveResult = z.object({
    previousPath: z.string(),
    path: z.string(),
    node: Node,
  })
  export type MoveResult = z.infer<typeof MoveResult>

  export const CopyResult = z.object({
    sourcePath: z.string(),
    path: z.string(),
    node: Node,
  })
  export type CopyResult = z.infer<typeof CopyResult>

  export const DeleteResult = z.object({
    path: z.string(),
  })
  export type DeleteResult = z.infer<typeof DeleteResult>

  export const UploadInvalidTargetError = NamedError.create(
    "FileUploadInvalidTargetError",
    z.object({
      targetDir: z.string(),
      message: z.string(),
    }),
  )

  export const UploadInvalidNameError = NamedError.create(
    "FileUploadInvalidNameError",
    z.object({
      name: z.string(),
      message: z.string(),
    }),
  )

  export const UploadInvalidContentError = NamedError.create(
    "FileUploadInvalidContentError",
    z.object({
      name: z.string(),
      message: z.string(),
    }),
  )

  export const UploadConflictError = NamedError.create(
    "FileUploadConflictError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )

  export const InvalidPathError = NamedError.create(
    "FileInvalidPathError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )

  export const EntryNotFoundError = NamedError.create(
    "FileNotFoundError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )

  export const ConflictError = NamedError.create(
    "FileConflictError",
    z.object({
      path: z.string(),
      message: z.string(),
    }),
  )

  export const WriteConflictError = NamedError.create(
    "FileWriteConflictError",
    z.object({ path: z.string(), message: z.string() }),
  )

  const binaryExtensions = new Set([
    "exe",
    "dll",
    "pdb",
    "bin",
    "so",
    "dylib",
    "o",
    "a",
    "lib",
    "wav",
    "mp3",
    "ogg",
    "oga",
    "ogv",
    "ogx",
    "flac",
    "aac",
    "wma",
    "m4a",
    "weba",
    "mp4",
    "avi",
    "mov",
    "wmv",
    "flv",
    "webm",
    "mkv",
    "zip",
    "tar",
    "gz",
    "gzip",
    "bz",
    "bz2",
    "bzip",
    "bzip2",
    "7z",
    "rar",
    "xz",
    "lz",
    "z",
    "pdf",
    "doc",
    "docx",
    "ppt",
    "pptx",
    "xls",
    "xlsx",
    "dmg",
    "iso",
    "img",
    "vmdk",
    "ttf",
    "otf",
    "woff",
    "woff2",
    "eot",
    "sqlite",
    "db",
    "mdb",
    "apk",
    "ipa",
    "aab",
    "xapk",
    "app",
    "pkg",
    "deb",
    "rpm",
    "snap",
    "flatpak",
    "appimage",
    "msi",
    "msp",
    "jar",
    "war",
    "ear",
    "class",
    "kotlin_module",
    "dex",
    "vdex",
    "odex",
    "oat",
    "art",
    "wasm",
    "wat",
    "bc",
    "ll",
    "s",
    "ko",
    "sys",
    "drv",
    "efi",
    "rom",
    "com",
    "cmd",
    "ps1",
    "sh",
    "bash",
    "zsh",
    "fish",
  ])

  const imageExtensions = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "bmp",
    "webp",
    "ico",
    "tif",
    "tiff",
    "svg",
    "svgz",
    "avif",
    "apng",
    "jxl",
    "heic",
    "heif",
    "raw",
    "cr2",
    "nef",
    "arw",
    "dng",
    "orf",
    "raf",
    "pef",
    "x3f",
  ])

  const textExtensions = new Set([
    "ts",
    "tsx",
    "mts",
    "cts",
    "mtsx",
    "ctsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "sh",
    "bash",
    "zsh",
    "fish",
    "ps1",
    "psm1",
    "cmd",
    "bat",
    "json",
    "jsonc",
    "json5",
    "yaml",
    "yml",
    "toml",
    "md",
    "mdx",
    "txt",
    "xml",
    "html",
    "htm",
    "css",
    "scss",
    "sass",
    "less",
    "graphql",
    "gql",
    "sql",
    "ini",
    "cfg",
    "conf",
    "env",
  ])

  const textNames = new Set([
    "dockerfile",
    "makefile",
    ".gitignore",
    ".gitattributes",
    ".editorconfig",
    ".npmrc",
    ".nvmrc",
    ".prettierrc",
    ".eslintrc",
  ])

  function isImageByExtension(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase().slice(1)
    return imageExtensions.has(ext)
  }

  function isTextByExtension(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase().slice(1)
    return textExtensions.has(ext)
  }

  function isTextByName(filepath: string): boolean {
    const name = path.basename(filepath).toLowerCase()
    return textNames.has(name)
  }

  function getImageMimeType(filepath: string): string {
    const ext = path.extname(filepath).toLowerCase().slice(1)
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      ico: "image/x-icon",
      tif: "image/tiff",
      tiff: "image/tiff",
      svg: "image/svg+xml",
      svgz: "image/svg+xml",
      avif: "image/avif",
      apng: "image/apng",
      jxl: "image/jxl",
      heic: "image/heic",
      heif: "image/heif",
    }
    return mimeTypes[ext] || "image/" + ext
  }

  function isBinaryByExtension(filepath: string): boolean {
    const ext = path.extname(filepath).toLowerCase().slice(1)
    return binaryExtensions.has(ext)
  }

  function isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/")
  }

  async function shouldEncode(mimeType: string): Promise<boolean> {
    const type = mimeType.toLowerCase()
    log.info("shouldEncode", { type })
    if (!type) return false

    if (type.startsWith("text/")) return false
    if (type.includes("charset=")) return false

    const parts = type.split("/", 2)
    const top = parts[0]

    const tops = ["image", "audio", "video", "font", "model", "multipart"]
    if (tops.includes(top)) return true

    return false
  }

  function trimTrailingSeparators(input: string) {
    const normalized = path.normalize(input)
    const root = path.parse(normalized).root
    let value = normalized
    while (value.length > root.length && (value.endsWith("\\") || value.endsWith("/"))) {
      value = value.slice(0, -1)
    }
    return value
  }

  function isMissingPathError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ((error as { code?: unknown }).code === "ENOENT" || (error as { code?: unknown }).code === "ENOTDIR")
    )
  }

  async function realpathIfExists(input: string): Promise<string | undefined> {
    try {
      return await fs.promises.realpath(input)
    } catch (error) {
      if (isMissingPathError(error)) return undefined
      throw error
    }
  }

  function normalizeCanonicalPath(input: string): string {
    let normalized = trimTrailingSeparators(input)
    normalized = Filesystem.normalizePath(normalized)
    if (process.platform === "win32") normalized = normalized.toLowerCase()
    return normalized
  }

  async function canonicalPath(input: string) {
    const absolute = path.resolve(input)
    const exact = await realpathIfExists(absolute)
    if (exact) return normalizeCanonicalPath(exact)

    const suffix: string[] = []
    let current = absolute
    while (true) {
      const parent = path.dirname(current)
      const name = path.basename(current)
      if (name) suffix.unshift(name)
      if (parent === current) return normalizeCanonicalPath(absolute)
      current = parent
      const existingParent = await realpathIfExists(current)
      if (existingParent) return normalizeCanonicalPath(path.join(existingParent, ...suffix))
    }
  }

  function isWithin(base: string, target: string) {
    return target === base || target.startsWith(base + path.sep)
  }

  async function isPathAllowed(input: string) {
    const [target, directory] = await Promise.all([canonicalPath(input), canonicalPath(Instance.directory)])
    if (isWithin(directory, target)) return true
    const worktree = await canonicalPath(Instance.worktree)
    return isWithin(worktree, target)
  }

  export const Event = {
    Edited: BusEvent.define(
      "file.edited",
      z.object({
        file: z.string(),
        processAuthority: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("host"), cwd: z.string().min(1) }).strict(),
          z.object({ kind: z.literal("task"), taskID: z.string().min(1), cwd: z.string().min(1) }).strict(),
        ]),
      }),
    ),
  }

  async function notifyEdited(files: readonly string[]): Promise<void> {
    const settled = await Promise.allSettled(
      files.map((file) =>
        Bus.publishOwned(Event.Edited, {
          file,
          processAuthority: { kind: "host", cwd: Instance.directory },
        }),
      ),
    )
    const failures = settled.flatMap((result, index) =>
      result.status === "rejected" ? [{ file: files[index], error: result.reason }] : [],
    )
    if (failures.length > 0) {
      log.warn("post-commit file notifications failed", {
        failures: failures.map(({ file, error }) => ({
          file,
          error: error instanceof Error ? error.message : String(error),
        })),
      })
    }
  }

  const base64Pattern = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
  // Windows device names: CON (console), PRN (printer), AUX (auxiliary), NUL (null device),
  // COM (communications port), and LPT (line printer port) cannot be created as normal files.
  const windowsReservedDeviceNamePattern = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

  function entryNameKey(name: string): string {
    return process.platform === "win32" ? name.toLowerCase() : name
  }

  function assertEntryBasename(input: { name: string; label: string; error: "upload" | "file" }): string {
    const { name, label, error } = input
    const createError = (message: string) => {
      if (error === "upload") {
        return new UploadInvalidNameError({ name, message })
      }
      return new InvalidPathError({ path: name, message })
    }
    if (!name || name === "." || name === "..") {
      throw createError(`Invalid ${label} name: ${name || "(empty)"}`)
    }
    if (name.includes("/") || name.includes("\\") || path.isAbsolute(name) || name.includes("\0")) {
      throw createError(`${label} name must be a basename: ${name}`)
    }
    if (process.platform === "win32" && /[<>:"|?*\x00-\x1F]/.test(name)) {
      throw createError(`${label} name is invalid on Windows: ${name}`)
    }
    if (process.platform === "win32" && (/[. ]$/.test(name) || windowsReservedDeviceNamePattern.test(name))) {
      throw createError(`${label} name is reserved on Windows: ${name}`)
    }
    return name
  }

  function assertUploadFileName(name: string): string {
    return assertEntryBasename({ name, label: "uploaded file", error: "upload" })
  }

  function assertFileEntryName(name: string): string {
    return assertEntryBasename({ name, label: "file entry", error: "file" })
  }

  function decodeUploadedBase64(file: UploadFile): Buffer {
    if (file.contentBase64.length > 0 && !base64Pattern.test(file.contentBase64)) {
      throw new UploadInvalidContentError({
        name: file.name,
        message: `Uploaded file content is not standard base64: ${file.name}`,
      })
    }
    return Buffer.from(file.contentBase64, "base64")
  }

  function writeFileConflict(input: { path: string }): InstanceType<typeof UploadConflictError> {
    return new UploadConflictError({
      path: input.path,
      message: `Upload destination already exists: ${input.path}`,
    })
  }

  function fileConflict(input: { path: string; message?: string }): InstanceType<typeof ConflictError> {
    return new ConflictError({
      path: input.path,
      message: input.message ?? `File destination already exists: ${input.path}`,
    })
  }

  function fileNotFound(input: { path: string; message?: string }): InstanceType<typeof EntryNotFoundError> {
    return new EntryNotFoundError({
      path: input.path,
      message: input.message ?? `File entry not found: ${input.path}`,
    })
  }

  function fileInvalidPath(input: { path: string; message?: string }): InstanceType<typeof InvalidPathError> {
    return new InvalidPathError({
      path: input.path,
      message: input.message ?? `Invalid file path: ${input.path}`,
    })
  }

  async function statReadableFile(file: string, full: string): Promise<fs.Stats> {
    let stat: fs.Stats
    try {
      stat = await fs.promises.stat(full)
    } catch (error) {
      if (isMissingPathError(error)) throw fileNotFound({ path: file })
      throw error
    }
    if (!stat.isFile()) {
      throw fileNotFound({ path: file, message: `File entry is not a file: ${file}` })
    }
    return stat
  }

  async function assertReadableFile(file: string, full: string): Promise<void> {
    try {
      await fs.promises.access(full, fs.constants.R_OK)
    } catch (error) {
      if (isMissingPathError(error)) throw fileNotFound({ path: file })
      throw error
    }
  }

  async function readFileBytes(file: string, full: string): Promise<Buffer> {
    try {
      return await Filesystem.readBytes(full)
    } catch (error) {
      if (isMissingPathError(error)) throw fileNotFound({ path: file })
      throw error
    }
  }

  const state = createInstanceState(
    async () => {
      type Entry = { files: string[]; dirs: string[] }
      let cache: Entry = { files: [], dirs: [] }
      let fetching: Promise<Entry> | undefined

      const isHomeDirectory = Filesystem.resolve(Instance.directory) === Filesystem.resolve(Global.Path.home)

      const scan = async (result: Entry): Promise<Entry> => {
        // Disable scanning if in root of file system
        if (Instance.directory === path.parse(Instance.directory).root) return cache

        if (isHomeDirectory) {
          const dirs = new Set<string>()
          const ignore = new Set<string>()

          if (process.platform === "darwin") {
            ignore.add("Library")
            ignore.add(".Trash")
            ignore.add("Caches")
          }
          if (process.platform === "win32") {
            ignore.add("AppData")
            ignore.add("$Recycle.Bin")
            ignore.add("System Volume Information")
          }

          const ignoreNested = new Set(["node_modules", "dist", "build", "target", "vendor"])
          const shouldIgnore = (name: string) => name.startsWith(".") || ignore.has(name)
          const shouldIgnoreNested = (name: string) => name.startsWith(".") || ignoreNested.has(name)

          const top = await fs.promises
            .readdir(Instance.directory, { withFileTypes: true })
            .catch(() => [] as fs.Dirent[])

          for (const entry of top) {
            if (!entry.isDirectory()) continue
            if (shouldIgnore(entry.name)) continue
            dirs.add(entry.name + "/")

            const base = path.join(Instance.directory, entry.name)
            const children = await fs.promises.readdir(base, { withFileTypes: true }).catch(() => [] as fs.Dirent[])
            for (const child of children) {
              if (!child.isDirectory()) continue
              if (shouldIgnoreNested(child.name)) continue
              dirs.add(entry.name + "/" + child.name + "/")
            }
          }

          result.dirs = Array.from(dirs).toSorted()
          cache = result
          return cache
        }

        const set = new Set<string>()
        for await (const file of Ripgrep.filesForHost({ cwd: Instance.directory })) {
          result.files.push(file)
          let current = file
          while (true) {
            const dir = path.dirname(current)
            if (dir === ".") break
            if (dir === current) break
            current = dir
            if (set.has(dir)) continue
            set.add(dir)
            result.dirs.push(dir + "/")
          }
        }
        cache = result
        return cache
      }
      const refresh = () => {
        const request = scan({ files: [], dirs: [] })
        let tracked: Promise<Entry>
        tracked = request.finally(() => {
          if (fetching === tracked) {
            fetching = undefined
          }
        })
        fetching = tracked
        return tracked
      }
      await refresh().catch((error) => {
        log.warn("file index scan failed", { error: error instanceof Error ? error.message : String(error) })
      })

      return {
        async files() {
          return fetching ?? refresh()
        },
      }
    },
    undefined,
    "file-index",
  )

  export async function init() {
    await state()
  }

  export async function status() {
    if (!Project.isGitRepo(Instance.directory)) return []

    const options = {
      cwd: Instance.directory,
      timeoutProfile: "default" as const,
      prefix: ["-c", "core.fsmonitor=false", "-c", "core.quotepath=false"],
    }
    const run = gitSourceRunner(options)
    const head = await run(["rev-parse", "--verify", "--quiet", "HEAD"])
    if (head.exitCode !== 0 && head.exitCode !== 1)
      throw new Error(`File status HEAD failed: ${head.stderr.toString()}`)
    const ref = head.exitCode === 0 ? "HEAD" : (await checkedSourceGit(run, ["mktree"])).text().trim()
    const links = await gitSourceLinkDiffs(options, ref)

    const diffOutput = (
      await checkedSourceGit(run, gitSourceEntryArgs(["diff", "--no-renames", "--numstat", "-z", ref]))
    ).text()

    const changedFiles: Info[] = []

    if (diffOutput.trim()) {
      const lines = diffOutput.slice(0, -1).split("\0")
      for (const line of lines) {
        const first = line.indexOf("\t"),
          second = line.indexOf("\t", first + 1)
        const added = line.slice(0, first),
          removed = line.slice(first + 1, second),
          filepath = line.slice(second + 1)
        if (links.has(filepath)) continue
        changedFiles.push({
          path: filepath,
          added: added === "-" ? 0 : parseInt(added, 10),
          removed: removed === "-" ? 0 : parseInt(removed, 10),
          status: "modified",
        })
      }
    }

    for (const filepath of (
      await gitSourcePaths(Instance.directory, (args, input) =>
        hostGit(["-c", "core.fsmonitor=false", "-c", "core.quotepath=false", ...args], {
          cwd: Instance.directory,
          timeoutProfile: "default",
          input,
        }),
      )
    ).untracked) {
      if (links.has(filepath)) continue
      const absolute = path.join(Instance.directory, filepath)
      const entry = await fs.promises.lstat(absolute)
      const content = entry.isSymbolicLink()
        ? await fs.promises.readlink(absolute)
        : entry.isFile()
          ? await Filesystem.readText(absolute)
          : undefined
      changedFiles.push({
        path: filepath,
        added: content === undefined ? 0 : content.split("\n").length,
        removed: 0,
        status: "added",
      })
    }

    // Get deleted files
    const deletedOutput = (await checkedSourceGit(run, gitSourceEntryArgs(["diff", "--name-only", "-z", "--diff-filter=D", ref]))).text()

    if (deletedOutput.trim()) {
      const deletedFiles = deletedOutput.slice(0, -1).split("\0")
      for (const filepath of deletedFiles) {
        if (links.has(filepath)) continue
        const existing = changedFiles.find((item) => item.path === filepath)
        if (existing) {
          existing.status = "deleted"
          continue
        }
        changedFiles.push({
          path: filepath,
          added: 0,
          removed: 0, // Could get original line count but would require another git command
          status: "deleted",
        })
      }
    }

    for (const [filepath, link] of links)
      if (link.changed)
        changedFiles.push({
          path: filepath,
          added: link.stat.additions,
          removed: link.stat.deletions,
          status: link.status,
        })

    return changedFiles
      .toSorted((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
      .map((x) => {
        const full = path.isAbsolute(x.path) ? x.path : path.join(Instance.directory, x.path)
        return {
          ...x,
          path: path.relative(Instance.directory, full),
        }
      })
  }

  function contentRevision(identity: string, bytes: Uint8Array): string {
    return createHash("sha256").update(identity).update("\0").update(bytes).digest("hex")
  }

  function isUtf8Text(bytes: Uint8Array): boolean {
    return isUtf8(bytes) && !bytes.includes(0)
  }

  async function readResolvedContent(file: string, full: string, identity?: string): Promise<Content> {
    await statReadableFile(file, full)
    await assertReadableFile(file, full)

    const previewMimeType =
      path.extname(file).toLowerCase() === ".pdf"
        ? "application/pdf"
        : isImageByExtension(file)
          ? getImageMimeType(file)
          : undefined
    if (previewMimeType) {
      const buffer = await readFileBytes(file, full)
      const content = buffer.toString("base64")
      return { type: "text", content, mimeType: previewMimeType, encoding: "base64" }
    }

    const text = isTextByExtension(file) || isTextByName(file)

    if (isBinaryByExtension(file) && !text) {
      return { type: "binary", content: "" }
    }

    const mimeType = Filesystem.mimeType(full)
    const encode = text ? false : await shouldEncode(mimeType)

    if (encode && !isImage(mimeType)) {
      return { type: "binary", content: "", mimeType }
    }

    if (encode) {
      const buffer = await readFileBytes(file, full)
      const content = buffer.toString("base64")
      return { type: "text", content, mimeType, encoding: "base64" }
    }

    const bytes = await readFileBytes(file, full)
    if (!isUtf8Text(bytes)) return { type: "binary", content: "" }
    const editable = identity !== undefined && !AttachmentStore.nameFromAbsolutePath(Instance.project.id, full)
    return {
      type: "text",
      content: bytes.toString("utf8"),
      ...(editable ? { revision: contentRevision(identity!, bytes) } : {}),
    }
  }

  export async function readSource(file: string): Promise<Content> {
    using _ = log.time("read-source", { file })
    if (!path.isAbsolute(file)) {
      throw fileInvalidPath({ path: file, message: `Source file path must be absolute: ${file}` })
    }
    return readResolvedContent(file, path.resolve(file))
  }

  async function readGitFileBaseline(file: string, full: string): Promise<string | undefined> {
    const gitPath = path.relative(Instance.worktree, full).split(path.sep).join("/")
    const git = async (args: string[], operation: string) => {
      const result = await hostGit(["--literal-pathspecs", "-c", "core.fsmonitor=false", ...args], {
        cwd: Instance.worktree,
        timeoutProfile: "default",
      })
      if (result.exitCode !== 0) {
        throw new Error(
          `Git ${operation} failed for file ${file}: ${result.stderr.toString().trim() || `exit ${result.exitCode}`}`,
        )
      }
      return result.text()
    }
    const status = await git(
      ["--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z", "--untracked-files=no", "--", gitPath],
      "file status",
    )
    const records = status.split("\0")
    if (records.pop() !== "") throw new Error(`Invalid Git file status for ${file}: unterminated record`)
    let head: string | undefined
    let changed = false
    for (let index = 0; index < records.length; index++) {
      const record = records[index]!
      if (record.startsWith("# ")) {
        const separator = record.indexOf(" ", 2)
        if (separator < 0) throw new Error(`Invalid Git file status header for ${file}`)
        if (record.slice(2, separator) === "branch.oid") {
          const value = record.slice(separator + 1)
          if (head !== undefined || (value !== "(initial)" && !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value))) {
            throw new Error(`Invalid Git HEAD status for ${file}`)
          }
          head = value
        }
        continue
      }
      const kind = record.slice(0, 2)
      const fields = kind === "1 " ? 8 : kind === "2 " ? 9 : kind === "u " ? 10 : kind === "? " || kind === "! " ? 1 : 0
      if (!fields) throw new Error(`Invalid Git file status entry for ${file}`)
      let pathStart = 0
      for (let field = 0; field < fields; field++) {
        const separator = record.indexOf(" ", pathStart)
        if (separator <= pathStart) throw new Error(`Invalid Git file status fields for ${file}`)
        pathStart = separator + 1
      }
      const currentPath = record.slice(pathStart)
      if (!currentPath) throw new Error(`Invalid Git file status path for ${file}`)
      let originalPath: string | undefined
      if (kind === "2 ") {
        originalPath = records[++index]
        if (!originalPath) throw new Error(`Invalid Git rename source for ${file}`)
      }
      if (kind !== "? " && kind !== "! " && (currentPath === gitPath || originalPath === gitPath)) changed = true
    }
    if (head === undefined) throw new Error(`Git file status omitted HEAD for ${file}`)
    if (!changed) return undefined
    // The protocol identifies an unborn branch; a failed object read does not.
    if (head === "(initial)") return ""
    const tree = await git(["ls-tree", "-z", "--full-tree", head, "--", gitPath], "file tree read")
    const entries = tree.split("\0")
    if (entries.pop() !== "") throw new Error(`Invalid Git file tree for ${file}`)
    let object: string | null | undefined
    for (const entry of entries) {
      const separator = entry.indexOf("\t")
      if (separator < 0) throw new Error(`Invalid Git file tree entry for ${file}`)
      if (entry.slice(separator + 1) !== gitPath) continue
      const [mode, type, candidate, extra] = entry.slice(0, separator).split(" ")
      if (
        object !== undefined ||
        extra !== undefined ||
        !candidate ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(candidate)
      ) {
        throw new Error(`Invalid Git HEAD file entry: ${file}`)
      }
      if (type === "blob" && (mode === "100644" || mode === "100755" || mode === "120000")) {
        object = candidate
      } else if ((type === "tree" && mode === "040000") || (type === "commit" && mode === "160000")) {
        object = null
      } else {
        throw new Error(`Invalid Git HEAD file mode and type: ${file}`)
      }
    }
    // A successful tree query proves whether an old file blob existed at this path.
    return object == null ? "" : git(["cat-file", "blob", object], "file blob read")
  }

  export async function read(file: string): Promise<Content> {
    using _ = log.time("read", { file })
    const full = path.join(Instance.directory, file)

    if (!(await isPathAllowed(full))) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    const physical = await realpathIfExists(full)
    if (!physical) throw fileNotFound({ path: file })
    if (!(await isPathAllowed(physical))) throw new Error(`Access denied: path escapes project directory`)
    const result = await readResolvedContent(file, physical, normalizeCanonicalPath(physical))
    const attachment = AttachmentStore.nameFromAbsolutePath(Instance.project.id, physical)
    if (attachment) {
      const reference = await AttachmentStore.readReference(attachment.projectID, attachment.name).catch((error) => {
        if (isMissingPathError(error)) {
          throw fileNotFound({ path: file, message: `Attachment metadata not found for file: ${file}` })
        }
        throw error
      })
      return { ...result, displayName: reference.filename ?? AttachmentStore.displayFilename(reference) }
    }
    if (result.type !== "text" || result.encoding) return result
    const content = result.content

    if (Project.isGitRepo(Instance.directory)) {
      const original = await readGitFileBaseline(file, full)
      if (original !== undefined) {
        const patch = structuredPatch(file, file, original, content, "old", "new", {
          context: Infinity,
          ignoreWhitespace: true,
        })
        const diff = formatPatch(patch)
        return { ...result, patch, diff }
      }
    }
    return result
  }

  export async function writeText(file: string, content: string, expectedRevision: string): Promise<Content> {
    using _ = log.time("writeText", { file })
    const full = path.join(Instance.directory, file)
    ContentRevision.parse(expectedRevision)
    await assertAllowedFilePath({ file, fullPath: full })
    const physical = await realpathIfExists(full)
    if (!physical) throw fileNotFound({ path: file })
    await assertAllowedFilePath({ file, fullPath: physical })
    const identity = normalizeCanonicalPath(physical)
    const conflict = () =>
      new WriteConflictError({
        path: file,
        message: `File changed since it was loaded: ${file}. Reload the current file before saving.`,
      })
    return withKeyedLock(
      writeLocks,
      identity,
      () =>
        withProcessLock(identity, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, async () => {
          await assertAllowedFilePath({ file, fullPath: full })
          const currentPhysical = await realpathIfExists(full)
          if (!currentPhysical) throw fileNotFound({ path: file })
          await assertAllowedFilePath({ file, fullPath: currentPhysical })
          if (normalizeCanonicalPath(currentPhysical) !== identity) throw conflict()
          const existing = await statReadableFile(file, currentPhysical)
          const current = await readResolvedContent(file, currentPhysical, identity)
          if (current.type !== "text" || current.encoding) {
            throw fileInvalidPath({ path: file, message: `Cannot edit binary file: ${file}` })
          }
          if (current.revision === undefined) {
            throw fileInvalidPath({ path: file, message: `Cannot edit read-only file: ${file}` })
          }
          if (current.revision !== expectedRevision) throw conflict()
          const bytes = Buffer.from(content, "utf8")
          if (!isUtf8Text(bytes) || bytes.toString("utf8") !== content) {
            throw fileInvalidPath({
              path: file,
              message: `Cannot save content as lossless UTF-8 text without null bytes: ${file}`,
            })
          }
          await Filesystem.writeAtomic(currentPhysical, bytes, existing.mode & 0o777)
          await notifyEdited([file])
          // Describe this commit even when an external writer changes the file during notification.
          return { type: "text" as const, content, revision: contentRevision(identity, bytes) }
        }),
      SHARED_JSON_FACT_QUEUE_TIMEOUT_MS,
    )
  }

  function relativePathFor(fullPath: string): string {
    return path.relative(Instance.directory, fullPath)
  }

  function basenameForEntry(file: string): string {
    return assertFileEntryName(path.basename(file))
  }

  function parentRelativePath(file: string): string {
    const parent = path.dirname(file)
    return parent === "." ? "" : parent
  }

  async function assertAllowedFilePath(input: { file: string; fullPath: string }): Promise<void> {
    if (!input.file.trim()) {
      throw fileInvalidPath({ path: input.file, message: `File path cannot be empty` })
    }
    if (path.isAbsolute(input.file)) {
      throw fileInvalidPath({ path: input.file, message: `File path must be project-relative: ${input.file}` })
    }
    if (input.file.includes("\0")) {
      throw fileInvalidPath({ path: input.file, message: `File path contains a null byte: ${input.file}` })
    }
    if (!(await isPathAllowed(input.fullPath))) {
      throw fileInvalidPath({ path: input.file, message: `Access denied: path escapes project directory` })
    }
  }

  async function assertExistingParent(input: { file: string; fullPath: string }): Promise<void> {
    const parent = path.dirname(input.fullPath)
    if (!(await isPathAllowed(parent))) {
      throw fileInvalidPath({ path: input.file, message: `Access denied: parent path escapes project directory` })
    }
    const parentStat = await fs.promises.stat(parent).catch((error) => {
      if (isMissingPathError(error)) return undefined
      throw error
    })
    if (!parentStat?.isDirectory()) {
      throw fileInvalidPath({
        path: input.file,
        message: `Parent directory does not exist: ${parentRelativePath(input.file) || "."}`,
      })
    }
  }

  async function assertFileMutationPaths(input: {
    action: "copy" | "move" | "delete"
    source: { file: string; fullPath: string }
    target?: { file: string; fullPath: string }
  }): Promise<fs.BigIntStats> {
    const rootError = () =>
      fileInvalidPath({
        path: input.source.file,
        message: `Cannot ${input.action} the project root from the file browser`,
      })
    if (!input.source.file.trim()) throw rootError()
    if (input.target) basenameForEntry(input.target.file)
    await assertAllowedFilePath(input.source)
    if (input.target) {
      await assertAllowedFilePath(input.target)
      await assertExistingParent(input.target)
    }

    const roots = [Instance.directory, Instance.worktree]
    if (roots.some((root) => path.relative(root, input.source.fullPath) === "")) throw rootError()
    const entry = await fs.promises.lstat(input.source.fullPath, { bigint: true }).catch((error) => {
      if (isMissingPathError(error)) throw fileNotFound({ path: input.source.file })
      throw error
    })
    // Use the actual operation path: a terminal link is an entry, while an ancestor link can re-enter a root.
    if (entry.isSymbolicLink()) return entry
    const [source, ...physicalRoots] = await Promise.all([
      canonicalPath(input.source.fullPath),
      ...roots.map((root) => canonicalPath(root)),
    ])
    if (physicalRoots.includes(source)) throw rootError()
    return entry
  }

  async function assertMoveDestinationIndependent(input: {
    sourceFile: string
    sourceFull: string
    sourceEntry: fs.BigIntStats
    targetFull: string
    targetFile: string
  }): Promise<void> {
    const source = await readFileEntry(input.sourceFull, input.sourceEntry).catch((error) => {
      if (isMissingPathError(error)) throw fileNotFound({ path: input.sourceFile })
      throw error
    })
    try {
      const results = await walkFileAccess(path.dirname(input.targetFull), {
        observe(entry) {
          if (sameFileEntry(source, entry))
            throw fileInvalidPath({
              path: input.targetFile,
              message: `Destination parent depends on the source entry being moved: ${input.targetFile}`,
            })
        },
      })
      if (results.some((result) => !result.entry?.stat.isDirectory()))
        throw Object.assign(new Error("Missing move destination parent"), { code: "ENOENT" })
    } catch (error) {
      if (isMissingPathError(error)) {
        throw fileInvalidPath({
          path: input.targetFile,
          message: `Parent directory does not exist: ${parentRelativePath(input.targetFile) || "."}`,
        })
      }
      throw error
    }
  }

  function nodeForEntry(
    fullPath: string,
    directory: boolean,
    ignored: (fullPath: string, directory: boolean) => boolean,
  ): Node {
    return {
      name: path.basename(fullPath),
      path: relativePathFor(fullPath),
      absolute: fullPath,
      type: directory ? "directory" : "file",
      ignored: ignored(fullPath, directory),
    }
  }

  async function nodeForPath(fullPath: string): Promise<Node> {
    const entry = await fs.promises.lstat(fullPath).catch((error) => {
      if (isMissingPathError(error)) throw fileNotFound({ path: relativePathFor(fullPath) })
      throw error
    })
    const ignored = await createIgnoreMatcher(path.dirname(fullPath))
    return nodeForEntry(fullPath, entry.isDirectory(), ignored)
  }

  async function assertRelocatedSymlinkTargetsAllowed(input: {
    file: string
    tree: RelocationTree
    phase: "source" | "future"
    targetRoot?: string
    retire?: RelocationTree
  }): Promise<void> {
    const roots = await Promise.all([canonicalPath(Instance.directory), canonicalPath(Instance.worktree)])
    await verifyRelocationTargets({
      ...input,
      allowed: (position) => roots.some((root) => isWithin(root, filePositionKey(position))),
      fail: (error) =>
        fileInvalidPath({
          path: error.file,
          message:
            error.reason === "outside"
              ? error.phase === "source"
                ? `Cannot relocate symlink target outside the project directory: ${error.file}`
                : `Relocated symlink would escape the project directory: ${error.file}`
              : error.reason === "changed"
                ? `File entry changed while verifying relocation: ${error.file}`
                : error.possible
                  ? `Cannot verify recursive future file access: ${error.file}`
                  : `Cannot relocate recursive symlink target: ${error.file}`,
        }),
    })
  }

  async function validateCopiedTree(source: string, target: string): Promise<void> {
    const [sourceStat, targetStat] = await Promise.all([
      fs.promises.lstat(source, { bigint: true }),
      fs.promises.lstat(target, { bigint: true }),
    ])
    if (
      sourceStat.isDirectory() !== targetStat.isDirectory() ||
      sourceStat.isFile() !== targetStat.isFile() ||
      sourceStat.isSymbolicLink() !== targetStat.isSymbolicLink()
    ) {
      throw new Error(`File.copy publication type mismatch: ${source} -> ${target}`)
    }
    if (sourceStat.isSymbolicLink()) {
      const [sourceEntry, targetEntry] = await Promise.all([
        readFileEntry(source, sourceStat),
        readFileEntry(target, targetStat),
      ])
      if (sourceEntry.link !== targetEntry.link)
        throw new Error(`File.copy symlink creation type mismatch: ${source} -> ${target}`)
      const [sourceLink, targetLink] = await Promise.all([fs.promises.readlink(source), fs.promises.readlink(target)])
      if (sourceLink !== targetLink) throw new Error(`File.copy symlink mismatch: ${source} -> ${target}`)
      return
    }
    if (sourceStat.isFile()) {
      const [sourceBytes, targetBytes] = await Promise.all([fs.promises.readFile(source), fs.promises.readFile(target)])
      if (!sourceBytes.equals(targetBytes)) throw new Error(`File.copy byte mismatch: ${source} -> ${target}`)
      return
    }
    if (!sourceStat.isDirectory()) return
    const [sourceEntries, targetEntries] = await Promise.all([fs.promises.readdir(source), fs.promises.readdir(target)])
    sourceEntries.sort()
    targetEntries.sort()
    if (
      sourceEntries.length !== targetEntries.length ||
      sourceEntries.some((entry, index) => entry !== targetEntries[index])
    ) {
      throw new Error(`File.copy directory entry mismatch: ${source} -> ${target}`)
    }
    for (const entry of sourceEntries) {
      await validateCopiedTree(path.join(source, entry), path.join(target, entry))
    }
  }

  async function createIgnoreMatcher(parentPath: string): Promise<(fullPath: string, directory: boolean) => boolean> {
    if (!Project.isGitRepo(Instance.directory)) return () => false
    const ig = ignore()
    for (const name of [".gitignore", ".ignore"]) {
      try {
        ig.add(await Filesystem.readText(path.join(Instance.worktree, name)))
      } catch (error) {
        if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") throw error
      }
    }

    const worktree = Filesystem.normalizeWindowsPath(Instance.worktree)
    const parent = Filesystem.normalizeWindowsPath(parentPath)
    let root: { origin: string; offset: string } | null = { origin: worktree, offset: "" }
    if (!Filesystem.contains(worktree, parent)) {
      const physicalWorktree = await fs.promises.realpath(worktree)
      root = null
      let current = parent
      while (true) {
        const physical = await fs.promises.realpath(current)
        if (!Filesystem.contains(physicalWorktree, physical)) break
        root = { origin: current, offset: path.relative(physicalWorktree, physical) }
        const ancestor = path.dirname(current)
        if (ancestor === current) break
        current = ancestor
      }
    }

    const coordinateFor = (fullPath: string): string | null => {
      const full = Filesystem.normalizeWindowsPath(fullPath)
      let coordinate: string
      if (Filesystem.contains(worktree, full)) {
        coordinate = path.relative(worktree, full)
      } else {
        if (root === null) return null
        const suffix = path.relative(root.origin, full)
        coordinate = root.offset ? path.join(root.offset, suffix) : suffix
      }
      return coordinate === "" ? null : coordinate
    }
    return (fullPath, directory) => {
      const coordinate = coordinateFor(fullPath)
      return coordinate === null ? false : ig.ignores(directory ? coordinate + "/" : coordinate)
    }
  }

  export async function create(input: CreateRequest): Promise<Node> {
    using _ = log.time("create", { path: input.path, type: input.type })
    const file = input.path
    const full = path.join(Instance.directory, file)
    basenameForEntry(file)
    await assertAllowedFilePath({ file, fullPath: full })
    await assertExistingParent({ file, fullPath: full })
    if (await Filesystem.exists(full)) {
      throw fileConflict({ path: file })
    }

    if (input.type === "directory") {
      try {
        await fs.promises.mkdir(full)
      } catch (error) {
        if (error && typeof error === "object" && (error as { code?: string }).code === "EEXIST") {
          throw fileConflict({ path: file })
        }
        throw error
      }
    } else {
      try {
        await fs.promises.writeFile(full, input.content ?? "", { flag: "wx" })
      } catch (error) {
        if (error && typeof error === "object" && (error as { code?: string }).code === "EEXIST") {
          throw fileConflict({ path: file })
        }
        throw error
      }
    }

    await notifyEdited([file])
    return nodeForPath(full)
  }

  export async function move(input: MoveRequest): Promise<MoveResult> {
    using _ = log.time("move", { path: input.path, newPath: input.newPath })
    const source = input.path
    const target = input.newPath
    const sourceFull = path.join(Instance.directory, source)
    const targetFull = path.join(Instance.directory, target)
    const sourceEntry = await assertFileMutationPaths({
      action: "move",
      source: { file: source, fullPath: sourceFull },
      target: { file: target, fullPath: targetFull },
    })

    const destination = await fs.promises.lstat(targetFull).catch((error) => {
      if (isMissingPathError(error)) return undefined
      throw error
    })
    if (destination) {
      throw fileConflict({ path: target })
    }
    await assertMoveDestinationIndependent({
      sourceFile: source,
      sourceFull,
      sourceEntry,
      targetFull,
      targetFile: target,
    })
    const relocation = await observeRelocationTree(sourceFull, sourceEntry)
    await assertRelocatedSymlinkTargetsAllowed({ file: source, tree: relocation, phase: "source" })
    await assertRelocatedSymlinkTargetsAllowed({
      file: source,
      tree: relocation,
      phase: "future",
      targetRoot: targetFull,
      retire: relocation,
    })

    try {
      await Filesystem.renameNoReplace(sourceFull, targetFull)
    } catch (error) {
      if (error && typeof error === "object" && (error as { code?: string }).code === "EEXIST") {
        throw fileConflict({ path: target })
      }
      throw error
    }
    await notifyEdited([source, target])
    return {
      previousPath: source,
      path: target,
      node: await nodeForPath(targetFull),
    }
  }

  export async function copy(input: CopyRequest): Promise<CopyResult> {
    using _ = log.time("copy", { path: input.path, newPath: input.newPath })
    const source = input.path
    const target = input.newPath
    const sourceFull = path.join(Instance.directory, source)
    const targetFull = path.join(Instance.directory, target)
    const sourceEntry = await assertFileMutationPaths({
      action: "copy",
      source: { file: source, fullPath: sourceFull },
      target: { file: target, fullPath: targetFull },
    })

    if (sourceEntry.isDirectory()) {
      const [sourceCanonical, targetCanonical] = await Promise.all([
        canonicalPath(sourceFull),
        canonicalPath(targetFull),
      ])
      if (isWithin(sourceCanonical, targetCanonical)) {
        throw fileInvalidPath({
          path: target,
          message: `Cannot copy a directory into itself: ${target}`,
        })
      }
    }
    if (await Filesystem.exists(targetFull)) {
      throw fileConflict({ path: target })
    }
    const relocation = await observeRelocationTree(sourceFull, sourceEntry)
    await assertRelocatedSymlinkTargetsAllowed({ file: source, tree: relocation, phase: "source" })

    const stagingPath = path.join(path.dirname(targetFull), `.opencorvus-copy-${randomUUID()}.staging`)
    const symlinks = new Map<string, { text: string; kind: NonNullable<FileEntry["link"]> }>()
    let published = false
    try {
      await fs.promises.cp(sourceFull, stagingPath, {
        recursive: sourceEntry.isDirectory(),
        errorOnExist: true,
        force: false,
        dereference: false,
        verbatimSymlinks: true,
        async filter(from, to) {
          const stat = await fs.promises.lstat(from, { bigint: true })
          if (!stat.isSymbolicLink()) return true
          const entry = await readFileEntry(from, stat)
          if (!entry.link) throw new Error(`File.copy symlink creation type changed: ${from}`)
          const text = await fs.promises.readlink(from)
          symlinks.set(to, { text, kind: entry.link })
          return false
        },
      })
      for (const [destination, link] of symlinks) {
        await fs.promises.symlink(link.text, destination, link.kind)
      }
      await validateCopiedTree(sourceFull, stagingPath)
      const stagedTree = await observeRelocationTree(stagingPath)
      await assertRelocatedSymlinkTargetsAllowed({
        file: source,
        tree: stagedTree,
        phase: "future",
        targetRoot: targetFull,
      })
      await relocation.verify()
      await Filesystem.renameNoReplace(stagingPath, targetFull)
      published = true
      await validateCopiedTree(sourceFull, targetFull)
    } catch (error) {
      const cleanupFailures: unknown[] = []
      const cleanupTargets = [stagingPath, ...(published ? [targetFull] : [])]
      for (const cleanupTarget of cleanupTargets) {
        try {
          await fs.promises.rm(cleanupTarget, { recursive: true, force: true })
        } catch (cleanupFailure) {
          cleanupFailures.push(cleanupFailure)
        }
      }
      if (cleanupFailures.length > 0) {
        const residue = await Promise.all(
          cleanupTargets.map(async (cleanupTarget): Promise<UploadPublicationResidue> => {
            try {
              await fs.promises.lstat(cleanupTarget)
              return { path: cleanupTarget, exists: true }
            } catch (residueError) {
              return {
                path: cleanupTarget,
                exists: (residueError as NodeJS.ErrnoException | undefined)?.code === "ENOENT" ? false : null,
              }
            }
          }),
        )
        throw new CopyPublicationError(error, cleanupFailures, residue)
      }
      if (error && typeof error === "object" && (error as { code?: string }).code === "EEXIST") {
        throw fileConflict({ path: target })
      }
      throw error
    }
    await notifyEdited([source, target])
    return {
      sourcePath: source,
      path: target,
      node: await nodeForPath(targetFull),
    }
  }

  export async function remove(input: { path: string }): Promise<DeleteResult> {
    using _ = log.time("remove", { path: input.path })
    const file = input.path
    const full = path.join(Instance.directory, file)
    const entry = await assertFileMutationPaths({ action: "delete", source: { file, fullPath: full } })

    if (entry.isDirectory()) {
      await fs.promises.rm(full, { recursive: true, force: false })
    } else {
      await fs.promises.unlink(full)
    }
    await notifyEdited([file])
    return { path: file }
  }

  export async function upload(input: UploadRequest): Promise<UploadResult[]> {
    using _ = log.time("upload", { targetDir: input.targetDir, files: input.files.map((file) => file.name) })
    const targetDir = input.targetDir
    const fullTargetDir = targetDir ? path.join(Instance.directory, targetDir) : Instance.directory

    if (!(await isPathAllowed(fullTargetDir))) {
      throw new UploadInvalidTargetError({
        targetDir,
        message: `Access denied: upload target escapes project directory`,
      })
    }

    const targetStat = await fs.promises.stat(fullTargetDir).catch(() => undefined)
    if (!targetStat?.isDirectory()) {
      throw new UploadInvalidTargetError({
        targetDir,
        message: `Upload target is not an existing directory: ${targetDir || "."}`,
      })
    }

    const seenNames = new Set<string>()
    const writes: Array<{ name: string; relativePath: string; fullPath: string; bytes: Buffer }> = []
    for (const file of input.files) {
      const name = assertUploadFileName(file.name)
      const key = entryNameKey(name)
      if (seenNames.has(key)) {
        throw new UploadConflictError({
          path: path.join(targetDir, name),
          message: `Duplicate uploaded file name: ${name}`,
        })
      }
      seenNames.add(key)

      const fullPath = path.join(fullTargetDir, name)
      if (!(await isPathAllowed(fullPath))) {
        throw new UploadInvalidNameError({
          name,
          message: `Uploaded file name escapes project directory: ${name}`,
        })
      }
      if (await Filesystem.exists(fullPath)) {
        throw writeFileConflict({ path: path.relative(Instance.directory, fullPath) })
      }
      writes.push({
        name,
        relativePath: path.relative(Instance.directory, fullPath),
        fullPath,
        bytes: decodeUploadedBase64(file),
      })
    }

    return await withKeyedLock(uploadLocks, fullTargetDir, async () => {
      const staged = writes.map((item) => ({
        ...item,
        stagingPath: path.join(fullTargetDir, `.opencorvus-upload-${randomUUID()}.staging`),
      }))
      const published: string[] = []
      const cleanupTargets = () => [...staged.map((item) => item.stagingPath), ...published]
      const cleanup = async (cause: unknown): Promise<never> => {
        const failures: unknown[] = []
        const targets = cleanupTargets()
        for (const target of targets) {
          try {
            await fs.promises.rm(target, { force: true })
          } catch (error) {
            failures.push(error)
          }
        }
        if (failures.length === 0) throw cause
        const residue = await Promise.all(
          targets.map(async (target): Promise<UploadPublicationResidue> => {
            try {
              await fs.promises.lstat(target)
              return { path: target, exists: true }
            } catch (error) {
              if ((error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
                return { path: target, exists: false }
              }
              return { path: target, exists: null }
            }
          }),
        )
        throw new UploadPublicationError(cause, failures, residue)
      }

      try {
        for (const item of staged) {
          await fs.promises.writeFile(item.stagingPath, item.bytes, { flag: "wx" })
          const persisted = await fs.promises.readFile(item.stagingPath)
          if (!persisted.equals(item.bytes)) {
            throw new Error(`File.upload staged bytes do not match ${item.relativePath}`)
          }
        }
        for (const item of staged) {
          try {
            await fs.promises.link(item.stagingPath, item.fullPath)
          } catch (error) {
            if ((error as NodeJS.ErrnoException | undefined)?.code === "EEXIST") {
              throw writeFileConflict({ path: item.relativePath })
            }
            throw error
          }
          published.push(item.fullPath)
          await fs.promises.unlink(item.stagingPath)
        }
      } catch (cause) {
        await cleanup(cause)
      }

      const results = staged.map((item) => ({
        name: item.name,
        path: item.relativePath,
        bytes: item.bytes.byteLength,
      }))
      await Promise.allSettled(
        results.map((item) =>
          Bus.publishOwned(Event.Edited, {
            file: item.path,
            processAuthority: { kind: "host", cwd: Instance.directory },
          }),
        ),
      )
      return results
    })
  }

  export async function list(dir?: string) {
    const exclude = [".git", ".DS_Store"]
    const resolved = dir ? path.join(Instance.directory, dir) : Instance.directory

    if (!(await isPathAllowed(resolved))) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    const entries = await fs.promises.readdir(resolved, {
      withFileTypes: true,
    })
    const ignored = await createIgnoreMatcher(resolved)
    const nodes: ListingNode[] = []
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue
      const fullPath = path.join(resolved, entry.name)
      let directoryTarget = entry.isDirectory()
      if (entry.isSymbolicLink() && (await isPathAllowed(fullPath))) {
        try {
          directoryTarget = (await fs.promises.stat(fullPath)).isDirectory()
        } catch (error) {
          if (!isMissingPathError(error)) throw error
        }
      }
      nodes.push({ ...nodeForEntry(fullPath, entry.isDirectory(), ignored), directoryTarget })
    }
    return nodes.sort((a, b) => {
      if (a.directoryTarget !== b.directoryTarget) {
        return a.directoryTarget ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  export async function search(input: { query: string; limit?: number; dirs?: boolean; type?: "file" | "directory" }) {
    const query = input.query.trim()
    const limit = input.limit ?? 100
    const kind = input.type ?? (input.dirs === false ? "file" : "all")
    log.info("search", { query, kind })

    const result = await state().then((x) => x.files())

    const hidden = (item: string) => {
      const normalized = item.replaceAll("\\", "/").replace(/\/+$/, "")
      return normalized.split("/").some((p) => p.startsWith(".") && p.length > 1)
    }
    const preferHidden = query.startsWith(".") || query.includes("/.")
    const sortHiddenLast = (items: string[]) => {
      if (preferHidden) return items
      const visible: string[] = []
      const hiddenItems: string[] = []
      for (const item of items) {
        const isHidden = hidden(item)
        if (isHidden) hiddenItems.push(item)
        if (!isHidden) visible.push(item)
      }
      return [...visible, ...hiddenItems]
    }
    if (!query) {
      if (kind === "file") return result.files.slice(0, limit)
      return sortHiddenLast(result.dirs.toSorted()).slice(0, limit)
    }

    const items =
      kind === "file" ? result.files : kind === "directory" ? result.dirs : [...result.files, ...result.dirs]

    const searchLimit = kind === "directory" && !preferHidden ? limit * 20 : limit
    const sorted = fuzzysort.go(query, items, { limit: searchLimit }).map((r) => r.target)
    const output = kind === "directory" ? sortHiddenLast(sorted).slice(0, limit) : sorted

    log.info("search", { query, kind, results: output.length })
    return output
  }
}
