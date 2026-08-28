import { access, chmod, link, mkdir, open, readFile, rename, rm, stat as statAsync, writeFile } from "fs/promises"
import { createWriteStream, existsSync, statSync } from "fs"
import { lookup } from "mime-types"
import { realpathSync } from "fs"
import { basename, dirname, isAbsolute, join, parse, relative, resolve as pathResolve, normalize, sep } from "path"
import { homedir } from "os"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Glob } from "./glob"
import { traceSync } from "./debug-trace"
import {
  renameNoReplace as nativeRenameNoReplace,
  renameNoReplaceWriteThrough as nativeRenameNoReplaceWriteThrough,
  renameReplaceWriteThrough as nativeRenameReplaceWriteThrough,
} from "./rename-no-replace"
import { Flag } from "@/flag/flag"

let temporaryFileSequence = 0

function temporaryPath(target: string, operation: string) {
  temporaryFileSequence += 1
  return join(
    dirname(target),
    `.${basename(target)}.${process.pid}.${Date.now()}.${temporaryFileSequence}.${operation}.tmp`,
  )
}

export namespace Filesystem {
  export function durableDirectoryTemporaryTargetName(candidate: string): string | undefined {
    const match = /^\.(.+)\.\d+\.\d+\.\d+\.durable-directory\.tmp$/.exec(candidate)
    return match?.[1]
  }
  /**
   * Thrown by `Filesystem.resolve` when the input string is a path
   * shaped for the wrong OS (e.g. a Windows `C:\foo` reaches a darwin
   * sidecar after settings sync, or a bare POSIX path reaches Windows
   * outside the supported Git Bash / Cygwin / WSL mount layouts).
   *
   * Pre-fix `Filesystem.resolve` silently fed cross-platform inputs to
   * `path.resolve`, which on POSIX treats `C:\Users\...` as a relative
   * fragment and produces a corrupted directory name with literal
   * backslashes — the corrupted path then flowed into git invocations
   * and produced opaque "no such directory" errors. Rejecting at the
   * boundary (rule 1) makes the failure observable instead of cascading.
   */
  export const InvalidDirectoryError = NamedError.create(
    "InvalidDirectoryError",
    z.object({
      value: z.string(),
      reason: z.enum(["windows-path-on-posix", "posix-path-on-windows"]),
      message: z.string(),
    }),
  )
  export async function exists(p: string): Promise<boolean> {
    return access(p).then(
      () => true,
      () => false,
    )
  }

  export async function isDir(p: string): Promise<boolean> {
    return statAsync(p).then(
      (s) => s.isDirectory(),
      () => false,
    )
  }

  export function stat(p: string): ReturnType<typeof statSync> | undefined {
    traceSync("filesystem.statSync", {
      path_len: p.length,
    })
    return statSync(p, { throwIfNoEntry: false }) ?? undefined
  }

  export async function size(p: string): Promise<number> {
    const s = stat(p)?.size ?? 0
    return typeof s === "bigint" ? Number(s) : s
  }

  export async function readText(p: string): Promise<string> {
    return readFile(p, "utf-8")
  }

  export async function readJson<T = any>(p: string): Promise<T> {
    return JSON.parse(await readFile(p, "utf-8"))
  }

  export async function readBytes(p: string): Promise<Buffer> {
    return readFile(p)
  }

  export async function readArrayBuffer(p: string): Promise<ArrayBuffer> {
    const buf = await readFile(p)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  }

  function isEnoent(e: unknown): e is { code: "ENOENT" } {
    return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "ENOENT"
  }

  function isEexist(e: unknown): e is { code: "EEXIST" } {
    return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "EEXIST"
  }

  export async function write(p: string, content: string | Buffer | Uint8Array, mode?: number): Promise<void> {
    const doWrite = () => (mode ? writeFile(p, content, { mode }) : writeFile(p, content))
    try {
      await doWrite()
    } catch (e) {
      if (isEnoent(e)) {
        await mkdir(dirname(p), { recursive: true })
        await doWrite()
        return
      }
      if (isEexist(e)) {
        // On Windows, EEXIST from writeFile means the target path is a directory, not a file.
        throw new Error(`Filesystem.write: target path is a directory, cannot write file: ${p}`)
      }
      throw e
    }
  }

  export async function writeAtomic(p: string, content: string | Buffer | Uint8Array, mode?: number): Promise<void> {
    const dir = dirname(p)
    await mkdir(dir, { recursive: true })
    const tmp = temporaryPath(p, "replace")
    try {
      await writeFile(tmp, content, mode ? { mode } : undefined)
      await rename(tmp, p)
    } catch (err) {
      await rm(tmp, { force: true }).catch(() => {})
      throw err
    }
  }

  /** Atomically replace a durable fact after syncing the complete new bytes. */
  export async function writeDurableAtomic(
    p: string,
    content: string | Buffer | Uint8Array,
    mode?: number,
  ): Promise<void> {
    const dir = dirname(p)
    await mkdirDurable(dir)
    const tmp = temporaryPath(p, "durable-replace")
    const handle = await open(tmp, "wx", mode)
    try {
      await handle.writeFile(content)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await nativeRenameReplaceWriteThrough(tmp, p)
      await syncDirectoryMetadata(dir)
    } finally {
      await rm(tmp, { force: true }).catch(() => {})
    }
  }

  /**
   * Atomically creates a complete file without replacing an existing target.
   *
   * The temporary file is fully written before `link` publishes it. The hard
   * link operation is atomic and fails with EEXIST when another writer already
   * owns the target, so readers never observe partial bootstrap contents.
   */
  export async function writeAtomicIfAbsent(
    p: string,
    content: string | Buffer | Uint8Array,
    mode?: number,
  ): Promise<boolean> {
    const dir = dirname(p)
    await mkdir(dir, { recursive: true })
    const tmp = temporaryPath(p, "create")
    try {
      await writeFile(tmp, content, mode ? { mode } : undefined)
      await link(tmp, p)
      return true
    } catch (error) {
      if (isEexist(error)) return false
      throw error
    } finally {
      await rm(tmp, { force: true }).catch(() => {})
    }
  }

  export async function syncDirectoryMetadata(directory: string): Promise<void> {
    // Windows namespace durability is provided by MOVEFILE_WRITE_THROUGH.
    // POSIX requires fsync of each directory whose entries changed.
    if (process.platform === "win32") return
    const handle = await open(directory, "r")
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  }

  export async function renameDurableNoReplace(source: string, target: string): Promise<void> {
    const sourceParent = dirname(source)
    const targetParent = dirname(target)
    await nativeRenameNoReplaceWriteThrough(source, target)
    await syncDirectoryMetadata(sourceParent)
    if (pathResolve(targetParent) !== pathResolve(sourceParent)) await syncDirectoryMetadata(targetParent)
  }

  /** Create every missing directory entry through the same durable rename
   * primitive used by deletion manifests, including the first parent entry. */
  export async function mkdirDurable(directory: string): Promise<void> {
    const target = pathResolve(directory)
    try {
      const info = await statAsync(target)
      if (!info.isDirectory()) throw new Error(`Durable directory target is not a directory: ${target}`)
      return
    } catch (error) {
      if (!isEnoent(error)) throw error
    }
    const parent = dirname(target)
    if (parent === target) throw new Error(`Cannot durably create filesystem root: ${target}`)
    await mkdirDurable(parent)
    const tmp = temporaryPath(target, "durable-directory")
    await mkdir(tmp)
    try {
      await renameDurableNoReplace(tmp, target)
    } catch (error) {
      if (!isEexist(error)) throw error
      const info = await statAsync(target)
      if (!info.isDirectory()) throw new Error(`Durable directory target is not a directory: ${target}`)
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {})
    }
  }

  /** Publish complete bytes before a deletion protocol may rename user state. */
  export async function writeDurableAtomicIfAbsent(
    p: string,
    content: string | Buffer | Uint8Array,
    mode?: number,
  ): Promise<boolean> {
    const dir = dirname(p)
    await mkdirDurable(dir)
    const tmp = temporaryPath(p, "durable-create")
    const handle = await open(tmp, "wx", mode)
    try {
      await handle.writeFile(content)
      await handle.sync()
    } finally {
      await handle.close()
    }
    try {
      await renameDurableNoReplace(tmp, p)
      return true
    } catch (error) {
      if (isEexist(error)) return false
      throw error
    } finally {
      await rm(tmp, { force: true }).catch(() => {})
    }
  }

  /** Perform one atomic platform rename that never replaces its destination. */
  export async function renameNoReplace(source: string, target: string): Promise<void> {
    await nativeRenameNoReplace(source, target)
  }

  /**
   * Retry the same atomic rename while Windows releases a transient directory handle.
   * The operation does not switch to a copy/delete path, so publication stays atomic.
   */
  export async function renameAfterTransientContention(source: string, target: string): Promise<void> {
    for (let attempt = 1; attempt <= Flag.OPENCORVUS_FILESYSTEM_RENAME_ATTEMPTS; attempt += 1) {
      try {
        await rename(source, target)
        return
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
        // EBUSY means "resource busy"; EPERM means "operation not permitted".
        // Windows can report either while another process releases a directory handle.
        const retryable = code === "EBUSY" || code === "EPERM"
        if (!retryable || attempt === Flag.OPENCORVUS_FILESYSTEM_RENAME_ATTEMPTS) throw error
        await new Promise<void>((resolve) => setTimeout(resolve, Flag.OPENCORVUS_FILESYSTEM_RENAME_DELAY_MS * attempt))
      }
    }
  }

  export async function writeJson(p: string, data: unknown, mode?: number): Promise<void> {
    return write(p, JSON.stringify(data, null, 2), mode)
  }

  export async function writeStream(
    p: string,
    stream: ReadableStream<Uint8Array> | Readable,
    mode?: number,
  ): Promise<void> {
    const dir = dirname(p)
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    const nodeStream = stream instanceof ReadableStream ? Readable.fromWeb(stream as any) : stream
    const writeStream = createWriteStream(p)
    await pipeline(nodeStream, writeStream)

    if (mode) {
      await chmod(p, mode)
    }
  }

  export function mimeType(p: string): string {
    return lookup(p) || "application/octet-stream"
  }

  /**
   * Returns true if the MIME type represents text/code content that should be
   * sent as inline text rather than a binary file part to LLM providers.
   *
   * text/plain and application/x-directory are excluded because they are
   * already handled by dedicated code paths upstream.
   */
  export function isTextLikeMime(mime: string): boolean {
    if (mime === "text/plain" || mime === "application/x-directory") return false
    if (mime.startsWith("text/")) return true
    if (mime === "application/json") return true
    if (mime === "application/toml") return true
    if (mime === "application/xml") return true
    if (mime === "application/x-sh") return true
    if (mime === "application/x-yaml") return true
    if (mime.endsWith("+json") || mime.endsWith("+xml")) return true
    return false
  }

  /**
   * On Windows, normalize a path to its canonical casing using the filesystem.
   * This is needed because Windows paths are case-insensitive but external tools
   * may return paths with different casing than what we send them.
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    traceSync("filesystem.realpathSync.native", {
      path_len: p.length,
    })
    try {
      return normalizeWindowsPath(realpathSync.native(p))
    } catch {
      return normalizeWindowsPath(p)
    }
  }

  /**
   * Remove Windows extended-length namespace prefixes from paths before they
   * leave the filesystem boundary. `\\?\` is accepted by Windows APIs, but
   * frontend module resolvers treat it as a literal request string instead of
   * a normal absolute path. UNC means Universal Naming Convention network path.
   */
  export function normalizeWindowsPath(p: string): string {
    if (p.startsWith("\\\\?\\UNC\\")) return "\\\\" + p.slice("\\\\?\\UNC\\".length)
    if (p.startsWith("\\\\?\\")) return p.slice("\\\\?\\".length)
    if (p.startsWith("//?/UNC/")) return "//" + p.slice("//?/UNC/".length)
    if (p.startsWith("//?/")) return p.slice("//?/".length)
    return p
  }

  /**
   * Single source for the bash-style drive mounts recognized on Windows.
   * `/<drive>/...` is Git Bash; `/<mount>/<drive>/...` is Cygwin / WSL
   * with the mount root being `mnt`, `cygdrive`, or anything the user
   * exports via `OPENCORVUS_WINDOWS_DRIVE_MOUNTS`. Both `windowsPath`
   * (which translates them to native form) and `looksLikeBashMount`
   * (the cross-platform path-validation predicate) read from this same
   * collection so we never ship two parallel mount lists (rule 8).
   */
  function collectWindowsDriveMounts(): Set<string> {
    const mounts = new Set(["mnt", "cygdrive"])
    for (const item of (process.env.OPENCORVUS_WINDOWS_DRIVE_MOUNTS || "").split(",")) {
      const value = item.trim().replace(/^\/+|\/+$/g, "")
      if (value) mounts.add(value)
    }
    return mounts
  }

  function looksLikeBashMount(p: string): boolean {
    if (!p.startsWith("/")) return false
    // /X/... — Git Bash native
    if (/^\/[a-zA-Z]\//.test(p)) return true
    const mounts = Array.from(collectWindowsDriveMounts())
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")
    return new RegExp(`^\\/(?:${mounts})\\/[a-zA-Z]\\/`).test(p)
  }

  function expandHomePath(p: string): string {
    if (p === "~") return homedir()
    if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2))
    return p
  }

  export function resolve(p: string): string {
    p = expandHomePath(p)
    if (process.platform !== "win32" && /^[A-Za-z]:[\\/]/.test(p)) {
      throw new InvalidDirectoryError({
        value: p,
        reason: "windows-path-on-posix",
        message: `Cannot resolve "${p}" on ${process.platform}: this is a Windows-style path. The directory was likely synced from a Windows session and is not interpretable here.`,
      })
    }
    if (
      process.platform === "win32" &&
      /^\//.test(p) &&
      !p.startsWith("//") && // UNC paths translate via windowsPath
      !looksLikeBashMount(p)
    ) {
      throw new InvalidDirectoryError({
        value: p,
        reason: "posix-path-on-windows",
        message: `Cannot resolve "${p}" on win32: this is a POSIX-style path that is not a recognized Git Bash / Cygwin / WSL mount. Set OPENCORVUS_WINDOWS_DRIVE_MOUNTS to add custom mount roots.`,
      })
    }
    return normalizeWindowsPath(pathResolve(windowsPath(p)))
  }

  export function windowsPath(p: string): string {
    if (process.platform !== "win32") return p
    p = normalizeWindowsPath(p)
    // UNC paths may come through as //server/share on POSIX-style tools.
    if (p.startsWith("//")) return p.replace(/\//g, "\\")

    const escapedMounts = Array.from(collectWindowsDriveMounts())
      .map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")

    return (
      p
        // Git Bash for Windows paths are typically /<drive>/...
        .replace(/^\/([a-zA-Z])\//, (_, drive) => `${drive.toUpperCase()}:/`)
        // Cygwin/WSL/custom paths: /<mount>/<drive>/...
        .replace(new RegExp(`^\\/(?:${escapedMounts})\\/([a-zA-Z])\\/`), (_, drive) => `${drive.toUpperCase()}:/`)
    )
  }
  export function overlaps(a: string, b: string) {
    return contains(a, b) || contains(b, a)
  }

  function trimTrailingSeparators(p: string) {
    const root = parse(p).root
    let value = p
    while (value.length > root.length && (value.endsWith("\\") || value.endsWith("/"))) {
      value = value.slice(0, -1)
    }
    return value
  }

  function normalizeForCompare(p: string) {
    let value = trimTrailingSeparators(normalize(pathResolve(normalizeWindowsPath(p))))
    if (process.platform === "win32") value = value.toLowerCase()
    return value
  }

  export function contains(parent: string, child: string) {
    const normalizedParent = normalizeForCompare(parent)
    const normalizedChild = normalizeForCompare(child)

    if (normalizedParent === normalizedChild) return true

    const parentRoot = parse(normalizedParent).root
    const childRoot = parse(normalizedChild).root
    if (parentRoot && childRoot && parentRoot !== childRoot) return false

    const rel = relative(normalizedParent, normalizedChild)
    return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
  }

  export async function findUp(target: string, start: string, stop?: string) {
    let current = start
    const result: string[] = []
    while (true) {
      const search = join(current, target)
      if (await exists(search)) result.push(search)
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }

  export async function* up(options: { targets: string[]; start: string; stop?: string }) {
    const { targets, start, stop } = options
    let current = start
    while (true) {
      for (const target of targets) {
        const search = join(current, target)
        if (await exists(search)) yield search
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
  }

  export async function globUp(pattern: string, start: string, stop?: string) {
    let current = start
    const result: string[] = []
    while (true) {
      try {
        const matches = await Glob.scan(pattern, {
          cwd: current,
          absolute: true,
          include: "file",
          dot: true,
        })
        result.push(...matches)
      } catch {
        // Skip invalid glob patterns
      }
      if (stop === current) break
      const parent = dirname(current)
      if (parent === current) break
      current = parent
    }
    return result
  }
}
