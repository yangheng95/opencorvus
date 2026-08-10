import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { $ } from "bun"
import { formatPatch, structuredPatch } from "diff"
import path from "path"
import fs from "fs"
import ignore from "ignore"
import { Log } from "../util/log"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Project } from "../project/project"
import { Ripgrep } from "./ripgrep"
import fuzzysort from "fuzzysort"
import { Global } from "../global"
import { NamedError } from "@opencorvus-ai/util/error"
import { randomUUID } from "node:crypto"
import { withKeyedLock } from "../util/lock"

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

  export const Content = z
    .object({
      type: z.enum(["text", "binary"]),
      content: z.string(),
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

  async function readFileText(file: string, full: string): Promise<string> {
    try {
      return await Filesystem.readText(full)
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

    const diffOutput = await $`git -c core.fsmonitor=false -c core.quotepath=false diff --numstat HEAD`
      .cwd(Instance.directory)
      .quiet()
      .nothrow()
      .text()

    const changedFiles: Info[] = []

    if (diffOutput.trim()) {
      const lines = diffOutput.trim().split("\n")
      for (const line of lines) {
        const [added, removed, filepath] = line.split("\t")
        changedFiles.push({
          path: filepath,
          added: added === "-" ? 0 : parseInt(added, 10),
          removed: removed === "-" ? 0 : parseInt(removed, 10),
          status: "modified",
        })
      }
    }

    const untrackedOutput =
      await $`git -c core.fsmonitor=false -c core.quotepath=false ls-files --others --exclude-standard`
        .cwd(Instance.directory)
        .quiet()
        .nothrow()
        .text()

    if (untrackedOutput.trim()) {
      const untrackedFiles = untrackedOutput.trim().split("\n")
      for (const filepath of untrackedFiles) {
        try {
          const content = await Filesystem.readText(path.join(Instance.directory, filepath))
          const lines = content.split("\n").length
          changedFiles.push({
            path: filepath,
            added: lines,
            removed: 0,
            status: "added",
          })
        } catch {
          continue
        }
      }
    }

    // Get deleted files
    const deletedOutput =
      await $`git -c core.fsmonitor=false -c core.quotepath=false diff --name-only --diff-filter=D HEAD`
        .cwd(Instance.directory)
        .quiet()
        .nothrow()
        .text()

    if (deletedOutput.trim()) {
      const deletedFiles = deletedOutput.trim().split("\n")
      for (const filepath of deletedFiles) {
        changedFiles.push({
          path: filepath,
          added: 0,
          removed: 0, // Could get original line count but would require another git command
          status: "deleted",
        })
      }
    }

    return changedFiles.map((x) => {
      const full = path.isAbsolute(x.path) ? x.path : path.join(Instance.directory, x.path)
      return {
        ...x,
        path: path.relative(Instance.directory, full),
      }
    })
  }

  export async function read(file: string): Promise<Content> {
    using _ = log.time("read", { file })
    const full = path.join(Instance.directory, file)

    if (!(await isPathAllowed(full))) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    await statReadableFile(file, full)
    await assertReadableFile(file, full)

    // Fast path: check extension before any filesystem operations
    if (isImageByExtension(file)) {
      const buffer = await readFileBytes(file, full)
      const content = buffer.toString("base64")
      const mimeType = getImageMimeType(file)
      return { type: "text", content, mimeType, encoding: "base64" }
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

    const content = await readFileText(file, full)

    if (Project.isGitRepo(Instance.directory)) {
      let diff = await $`git -c core.fsmonitor=false diff ${file}`.cwd(Instance.directory).quiet().nothrow().text()
      if (!diff.trim())
        diff = await $`git -c core.fsmonitor=false diff --staged ${file}`
          .cwd(Instance.directory)
          .quiet()
          .nothrow()
          .text()
      if (diff.trim()) {
        const original = await $`git show HEAD:${file}`.cwd(Instance.directory).quiet().nothrow().text()
        const patch = structuredPatch(file, file, original, content, "old", "new", {
          context: Infinity,
          ignoreWhitespace: true,
        })
        const diff = formatPatch(patch)
        return { type: "text", content, patch, diff }
      }
    }
    return { type: "text", content }
  }

  export async function writeText(file: string, content: string): Promise<Content> {
    using _ = log.time("writeText", { file })
    const full = path.join(Instance.directory, file)

    await assertAllowedFilePath({ file, fullPath: full })
    const existing = await statReadableFile(file, full)

    const text = isTextByExtension(file) || isTextByName(file)
    if (isBinaryByExtension(file) && !text) {
      throw fileInvalidPath({ path: file, message: `Cannot edit binary file: ${file}` })
    }

    return withKeyedLock(writeLocks, full, async () => {
      await Filesystem.writeAtomic(full, content, existing.mode & 0o777)
      await notifyEdited([file])
      return read(file)
    })
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
    const parentStat = await fs.promises.stat(parent).catch(() => undefined)
    if (!parentStat?.isDirectory()) {
      throw fileInvalidPath({
        path: input.file,
        message: `Parent directory does not exist: ${parentRelativePath(input.file) || "."}`,
      })
    }
  }

  async function nodeForPath(fullPath: string): Promise<Node> {
    const stat = await fs.promises.stat(fullPath).catch(() => undefined)
    if (!stat) throw fileNotFound({ path: relativePathFor(fullPath) })
    const relativePath = relativePathFor(fullPath)
    return {
      name: path.basename(fullPath),
      path: relativePath,
      absolute: fullPath,
      type: stat.isDirectory() ? "directory" : "file",
      ignored: await isIgnored(relativePath, stat.isDirectory()),
    }
  }

  async function assertRelocatedSymlinkTargetsAllowed(input: {
    file: string
    sourceRoot: string
    targetRoot: string
  }): Promise<void> {
    const pending = [{ file: input.file, fullPath: input.sourceRoot }]
    for (let index = 0; index < pending.length; index++) {
      const current = pending[index]!
      const stat = await fs.promises.lstat(current.fullPath).catch((error) => {
        if (isMissingPathError(error)) throw fileNotFound({ path: current.file })
        throw error
      })
      if (stat.isSymbolicLink()) {
        const sourceTarget = await realpathIfExists(current.fullPath)
        if (!sourceTarget) {
          throw fileInvalidPath({ path: current.file, message: `Cannot copy broken symlink: ${current.file}` })
        }
        if (!(await isPathAllowed(sourceTarget))) {
          throw fileInvalidPath({
            path: current.file,
            message: `Cannot relocate symlink target outside the project directory: ${current.file}`,
          })
        }
        const linkText = await fs.promises.readlink(current.fullPath)
        const targetLocation = path.join(input.targetRoot, path.relative(input.sourceRoot, current.fullPath))
        const relocatedTarget = path.isAbsolute(linkText)
          ? linkText
          : path.resolve(path.dirname(targetLocation), linkText)
        if (!(await isPathAllowed(relocatedTarget))) {
          throw fileInvalidPath({
            path: current.file,
            message: `Relocated symlink would escape the project directory: ${current.file}`,
          })
        }
        continue
      }
      if (!stat.isDirectory()) continue
      const entries = await fs.promises.readdir(current.fullPath, { withFileTypes: true })
      for (const entry of entries) {
        const childFile = path.join(current.file, entry.name)
        pending.push({ file: childFile, fullPath: path.join(current.fullPath, entry.name) })
      }
    }
  }

  async function validateCopiedTree(source: string, target: string): Promise<void> {
    const [sourceStat, targetStat] = await Promise.all([fs.promises.lstat(source), fs.promises.lstat(target)])
    if (
      sourceStat.isDirectory() !== targetStat.isDirectory() ||
      sourceStat.isFile() !== targetStat.isFile() ||
      sourceStat.isSymbolicLink() !== targetStat.isSymbolicLink()
    ) {
      throw new Error(`File.copy publication type mismatch: ${source} -> ${target}`)
    }
    if (sourceStat.isSymbolicLink()) {
      const [sourceLink, targetLink] = await Promise.all([
        fs.promises.readlink(source),
        fs.promises.readlink(target),
      ])
      if (sourceLink !== targetLink) throw new Error(`File.copy symlink mismatch: ${source} -> ${target}`)
      return
    }
    if (sourceStat.isFile()) {
      const [sourceBytes, targetBytes] = await Promise.all([
        fs.promises.readFile(source),
        fs.promises.readFile(target),
      ])
      if (!sourceBytes.equals(targetBytes)) throw new Error(`File.copy byte mismatch: ${source} -> ${target}`)
      return
    }
    if (!sourceStat.isDirectory()) return
    const [sourceEntries, targetEntries] = await Promise.all([
      fs.promises.readdir(source),
      fs.promises.readdir(target),
    ])
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

  async function isIgnored(relativePath: string, directory: boolean): Promise<boolean> {
    if (!Project.isGitRepo(Instance.directory)) return false
    const ig = ignore()
    const gitignorePath = path.join(Instance.worktree, ".gitignore")
    if (await Filesystem.exists(gitignorePath)) {
      ig.add(await Filesystem.readText(gitignorePath))
    }
    const ignorePath = path.join(Instance.worktree, ".ignore")
    if (await Filesystem.exists(ignorePath)) {
      ig.add(await Filesystem.readText(ignorePath))
    }
    return ig.ignores(directory ? relativePath + "/" : relativePath)
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
    if (!source.trim()) {
      throw fileInvalidPath({ path: source, message: "Cannot move the project root from the file browser" })
    }
    const sourceFull = path.join(Instance.directory, source)
    const targetFull = path.join(Instance.directory, target)
    basenameForEntry(target)
    await assertAllowedFilePath({ file: source, fullPath: sourceFull })
    await assertAllowedFilePath({ file: target, fullPath: targetFull })
    await assertExistingParent({ file: target, fullPath: targetFull })

    const sourceStat = await fs.promises.stat(sourceFull).catch(() => undefined)
    if (!sourceStat) throw fileNotFound({ path: source })
    if (await Filesystem.exists(targetFull)) {
      throw fileConflict({ path: target })
    }
    await assertRelocatedSymlinkTargetsAllowed({
      file: source,
      sourceRoot: sourceFull,
      targetRoot: targetFull,
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
    if (!source.trim()) {
      throw fileInvalidPath({ path: source, message: "Cannot copy the project root from the file browser" })
    }
    const sourceFull = path.join(Instance.directory, source)
    const targetFull = path.join(Instance.directory, target)
    basenameForEntry(target)
    await assertAllowedFilePath({ file: source, fullPath: sourceFull })
    await assertAllowedFilePath({ file: target, fullPath: targetFull })
    await assertExistingParent({ file: target, fullPath: targetFull })

    const sourceStat = await fs.promises.stat(sourceFull).catch(() => undefined)
    if (!sourceStat) throw fileNotFound({ path: source })
    if (sourceStat.isDirectory()) {
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
    await assertRelocatedSymlinkTargetsAllowed({
      file: source,
      sourceRoot: sourceFull,
      targetRoot: targetFull,
    })

    const stagingPath = path.join(path.dirname(targetFull), `.opencorvus-copy-${randomUUID()}.staging`)
    let published = false
    try {
      await fs.promises.cp(sourceFull, stagingPath, {
        recursive: sourceStat.isDirectory(),
        errorOnExist: true,
        force: false,
        dereference: false,
      })
      await validateCopiedTree(sourceFull, stagingPath)
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
    if (!file.trim()) {
      throw fileInvalidPath({ path: file, message: "Cannot delete the project root from the file browser" })
    }
    const full = path.join(Instance.directory, file)
    await assertAllowedFilePath({ file, fullPath: full })
    const stat = await fs.promises.stat(full).catch(() => undefined)
    if (!stat) throw fileNotFound({ path: file })

    if (stat.isDirectory()) {
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
    let ignored = (_: string) => false
    if (Project.isGitRepo(Instance.directory)) {
      const ig = ignore()
      const gitignorePath = path.join(Instance.worktree, ".gitignore")
      if (await Filesystem.exists(gitignorePath)) {
        ig.add(await Filesystem.readText(gitignorePath))
      }
      const ignorePath = path.join(Instance.worktree, ".ignore")
      if (await Filesystem.exists(ignorePath)) {
        ig.add(await Filesystem.readText(ignorePath))
      }
      ignored = ig.ignores.bind(ig)
    }
    const resolved = dir ? path.join(Instance.directory, dir) : Instance.directory

    if (!(await isPathAllowed(resolved))) {
      throw new Error(`Access denied: path escapes project directory`)
    }

    const entries = await fs.promises.readdir(resolved, {
      withFileTypes: true,
    })
    const nodes: Node[] = []
    for (const entry of entries) {
      if (exclude.includes(entry.name)) continue
      const fullPath = path.join(resolved, entry.name)
      const relativePath = path.relative(Instance.directory, fullPath)
      const type = entry.isDirectory() ? "directory" : "file"
      nodes.push({
        name: entry.name,
        path: relativePath,
        absolute: fullPath,
        type,
        ignored: ignored(type === "directory" ? relativePath + "/" : relativePath),
      })
    }
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1
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
