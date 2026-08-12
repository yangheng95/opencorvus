import crypto, { randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import {
  DIRECTORY_REFERENCE_MIME,
  SCREENSHOT_BROWSER_THUMBNAIL_VARIANT as SHARED_SCREENSHOT_BROWSER_THUMBNAIL_VARIANT,
} from "@opencorvus-ai/transport-protocol"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Database, eq } from "@/storage/db"
import { InteractiveArtifactTable, MessageTable, PartTable, SessionTable } from "@/session/session.sql"
import {
  EngineArtifactTable,
  EngineArtifactVersionTable,
  EngineChannelBindingTable,
  EngineInteractionRequestTable,
  EngineProgressSnapshotTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { DecisionLogTable } from "@/decision-log/schema"
import { Log } from "@/util/log"
import { requireRuntimePackage } from "@/runtime/package-require"
import { withKeyedLock } from "@/util/lock"
import { Filesystem } from "@/util/filesystem"
import lockfile from "proper-lockfile"

const sharp = requireRuntimePackage<typeof import("sharp")>("sharp")

// Map MIME types to the canonical file extension used when we lay attachments
// down inside a project's .opencorvus/.r/project/attachments store. The list only
// covers MIME types that a provider might send back as multimodal content.
// Anything not in this table uses the filename's own extension, and
// only if that is also missing do we store a raw ".bin" (explicit enough that
// a human or tool can still inspect the file).
const MIME_EXT: Record<string, string> = {
  [DIRECTORY_REFERENCE_MIME]: "directory.json",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  // PPTX means PowerPoint Open XML Presentation.
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  // DOCX means Word Open XML Document.
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  // XLSX means Excel Open XML Spreadsheet.
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
  "application/vnd.opencorvus.work-artifact-validation-receipt+json": "work-artifact-receipt.json",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/webm": "weba",
  "audio/ogg": "oga",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
}

function extensionFor(mime: string, filename?: string): string {
  if (filename) {
    const raw = path.extname(filename).replace(/^\./, "").toLowerCase()
    if (raw) return raw
  }
  const key = (mime || "").toLowerCase()
  return MIME_EXT[key] ?? "bin"
}

// Reverse of MIME_EXT — built once at module load so writeFromPath can infer
// MIME from a tool-produced PNG path without callers spelling out the MIME
// string at every call site. Unknown extensions throw at write time (rule 1:
// no silent application/octet-stream fallback for content the LLM is meant
// to look at).
const EXT_TO_MIME: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [mime, ext] of Object.entries(MIME_EXT)) {
    // First-write wins so canonical jpg → image/jpeg (not the duplicate
    // jpg-only entry, if one were added later).
    if (!(ext in out)) out[ext] = mime
  }
  return out
})()

function mimeFromPath(absPath: string): string {
  const ext = path.extname(absPath).replace(/^\./, "").toLowerCase()
  const mime = EXT_TO_MIME[ext]
  if (!mime) {
    throw new Error(
      `AttachmentStore.writeFromPath: unsupported extension '.${ext}' at ${absPath} — pass an explicit mime`,
    )
  }
  return mime
}

function storageDir(projectDir: string): string {
  return ProjectRuntimePaths.attachmentBlobRoot(projectDir)
}

const log = Log.create({ service: "attachment-store" })
const publicationLocks = new Map<string, Promise<unknown>>()
const authorityLocks = new Map<string, Promise<unknown>>()

async function withAuthorityFileLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
  const release = await lockfile.lock(filePath, { realpath: false })
  try {
    return await operation()
  } finally {
    await release()
  }
}

export namespace AttachmentStore {
  export const ROUTE_PREFIX = "/attachment"
  export const SCREENSHOT_BROWSER_THUMBNAIL_VARIANT = SHARED_SCREENSHOT_BROWSER_THUMBNAIL_VARIANT
  export const SCREENSHOT_BROWSER_THUMBNAIL_MIME = "image/webp"
  const SCREENSHOT_BROWSER_THUMBNAIL_WIDTH = 360
  const SCREENSHOT_BROWSER_THUMBNAIL_HEIGHT = 240

  export type Reference = {
    sha: string
    url: string
    mime: string
    size: number
    filename?: string
    /** Optional caller-owned annotation; the byte store never derives domain semantics. */
    intent?: string
    /** Optional caller-owned provenance annotation. */
    source?: string
  }

  export type Authority = {
    schema_version: 1
    project_id: string
    worktree: string
    database_instance_id: string
  }

  export class AuthorityError extends Error {
    override readonly name = "AttachmentStoreAuthorityError"

    constructor(message: string) {
      super(message)
    }
  }

  function authorityPath(projectDir: string): string {
    return path.join(storageDir(projectDir), ".authority.json")
  }

  function currentAuthority(projectID: string, projectDir: string): Authority {
    return {
      schema_version: 1,
      project_id: projectID,
      worktree: path.resolve(projectDir),
      database_instance_id: Database.Identity(),
    }
  }

  function parseAuthority(input: string, filePath: string): Authority {
    let value: unknown
    try {
      value = JSON.parse(input)
    } catch (error) {
      throw new AuthorityError(
        `Attachment store authority is not valid JSON at ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (!value || typeof value !== "object") {
      throw new AuthorityError(`Attachment store authority is malformed at ${filePath}`)
    }
    const record = value as Record<string, unknown>
    if (
      record.schema_version !== 1 ||
      typeof record.project_id !== "string" ||
      typeof record.worktree !== "string" ||
      typeof record.database_instance_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.database_instance_id)
    ) {
      throw new AuthorityError(`Attachment store authority is malformed at ${filePath}`)
    }
    return {
      schema_version: 1,
      project_id: record.project_id,
      worktree: record.worktree,
      database_instance_id: record.database_instance_id,
    }
  }

  function assertAuthority(actual: Authority, expected: Authority, filePath: string): Authority {
    if (
      actual.project_id !== expected.project_id ||
      path.resolve(actual.worktree) !== expected.worktree ||
      actual.database_instance_id !== expected.database_instance_id
    ) {
      throw new AuthorityError(
        `Attachment store ${filePath} belongs to another database authority for project ${expected.project_id}`,
      )
    }
    return actual
  }

  async function storeOwnedByDatabase(projectID: string): Promise<boolean> {
    const files = await listOnDisk(projectID)
    const referenced = collectReferencedShas(projectID).get(projectID) ?? new Set<string>()
    return files.every((file) => referenced.has(file.sha))
  }

  /**
   * Bind one physical attachment directory to its sole durable database.
   * A pre-marker directory can be claimed only by a database that already
   * references every one of its blobs; an empty directory can be claimed
   * by the first writer. This prevents an isolated database from treating a
   * shared project directory's live attachments as its own orphans.
   */
  export async function claimAuthority(projectID: string): Promise<Authority> {
    const project = Project.get(projectID)
    if (!project) throw new Error(`AttachmentStore.claimAuthority: unknown project ${projectID}`)
    const dir = storageDir(project.worktree)
    const filePath = authorityPath(project.worktree)
    const expected = currentAuthority(projectID, project.worktree)
    await fs.mkdir(dir, { recursive: true })
    return await withKeyedLock(authorityLocks, filePath, () =>
      withAuthorityFileLock(filePath, async () => {
        try {
          const actual = parseAuthority(await fs.readFile(filePath, "utf8"), filePath)
          try {
            return assertAuthority(actual, expected, filePath)
          } catch (error) {
            if (!(error instanceof AuthorityError)) throw error
            if (!(await storeOwnedByDatabase(projectID))) throw error
            await Filesystem.writeAtomic(filePath, JSON.stringify(expected, null, 2))
            return expected
          }
        } catch (error) {
          if (!hasNodeErrorCode(error, "ENOENT")) throw error
        }
        if (!(await storeOwnedByDatabase(projectID))) {
          throw new AuthorityError(`Attachment store ${filePath} contains blobs that the current database does not own`)
        }
        try {
          await fs.writeFile(filePath, JSON.stringify(expected, null, 2), { flag: "wx" })
          return expected
        } catch (error) {
          if (!hasNodeErrorCode(error, "EEXIST")) throw error
          return assertAuthority(parseAuthority(await fs.readFile(filePath, "utf8"), filePath), expected, filePath)
        }
      }),
    )
  }

  function metadataPath(abs: string): string {
    return `${abs}.metadata.json`
  }

  export type PublicationResidue = {
    path: string
    exists: boolean | null
  }

  export class PublicationError extends AggregateError {
    override readonly name = "AttachmentStorePublicationError"

    constructor(
      cause: unknown,
      cleanupFailures: unknown[],
      public readonly residue: PublicationResidue[],
    ) {
      super([cause, ...cleanupFailures], "Attachment publication failed and cleanup left observable residue", {
        cause,
      })
    }
  }

  export type SweepDeletionOutcome =
    | { status: "deleted"; blob: string; metadata: string; bytesFreed: number; blobWasAbsent: boolean }
    | { status: "retry"; blob: string; metadata: string; code: "EBUSY" | "EPERM" }
    | { status: "failed"; blob: string; metadata: string; phase: "blob" | "metadata"; error: string }

  async function inspectResidue(targets: string[]): Promise<PublicationResidue[]> {
    return await Promise.all(
      targets.map(async (target) => {
        try {
          await fs.lstat(target)
          return { path: target, exists: true }
        } catch (error) {
          if (hasNodeErrorCode(error, "ENOENT")) return { path: target, exists: false }
          return { path: target, exists: null }
        }
      }),
    )
  }

  async function cleanupPublication(targets: string[], cause: unknown): Promise<never> {
    const failures: unknown[] = []
    for (const target of targets) {
      try {
        await fs.rm(target, { force: true })
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length > 0) {
      throw new PublicationError(cause, failures, await inspectResidue(targets))
    }
    throw cause
  }

  async function deleteAttachmentPair(input: {
    blob: string
    metadata: string
    bytes: number
  }): Promise<SweepDeletionOutcome> {
    let blobWasAbsent = false
    try {
      await fs.unlink(input.blob)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code === "EBUSY" || code === "EPERM") {
        return { status: "retry", blob: input.blob, metadata: input.metadata, code }
      }
      if (code === "ENOENT") {
        blobWasAbsent = true
      } else {
        return {
          status: "failed",
          blob: input.blob,
          metadata: input.metadata,
          phase: "blob",
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
    try {
      await fs.unlink(input.metadata)
    } catch (error) {
      if ((error as NodeJS.ErrnoException | undefined)?.code !== "ENOENT") {
        return {
          status: "failed",
          blob: input.blob,
          metadata: input.metadata,
          phase: "metadata",
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }
    return {
      status: "deleted",
      blob: input.blob,
      metadata: input.metadata,
      bytesFreed: blobWasAbsent ? 0 : input.bytes,
      blobWasAbsent,
    }
  }

  async function validatePublishedPair(input: {
    projectID: string
    name: string
    abs: string
    metadataAbs: string
    sha: string
    mime: string
    size: number
  }): Promise<boolean> {
    let bytes: Buffer
    let metadataText: string
    try {
      ;[bytes, metadataText] = await Promise.all([fs.readFile(input.abs), fs.readFile(input.metadataAbs, "utf8")])
    } catch (error) {
      if (hasNodeErrorCode(error, "ENOENT") || hasNodeErrorCode(error, "ENOTDIR")) return false
      throw error
    }
    const actualSha = crypto.createHash("sha256").update(bytes).digest("hex")
    if (bytes.byteLength !== input.size || actualSha !== input.sha) return false
    try {
      const canonical = parseReferenceMetadata(JSON.parse(metadataText), {
        projectID: input.projectID,
        name: input.name,
        abs: input.abs,
      })
      return canonical.sha === input.sha && canonical.mime === input.mime && canonical.size === input.size
    } catch {
      return false
    }
  }

  function parseReferenceMetadata(value: unknown, input: { projectID: string; name: string; abs: string }): Reference {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`AttachmentStore.readReference: malformed metadata for ${input.projectID}/${input.name}`)
    }
    const record = value as Record<string, unknown>
    const sha = typeof record.sha === "string" ? record.sha : ""
    const url = typeof record.url === "string" ? record.url : ""
    const mime = typeof record.mime === "string" ? record.mime : ""
    const size = typeof record.size === "number" ? record.size : Number.NaN
    const filename = typeof record.filename === "string" ? record.filename : undefined
    const located = nameFromUrl(url)
    if (
      sha.length !== 64 ||
      !mime ||
      !Number.isFinite(size) ||
      size < 0 ||
      located?.projectID !== input.projectID ||
      located.name !== input.name
    ) {
      throw new Error(`AttachmentStore.readReference: metadata does not match ${input.projectID}/${input.name}`)
    }
    return {
      sha,
      url,
      mime,
      size,
      ...(filename ? { filename } : {}),
    }
  }

  /**
   * Persist an attachment under `<project.worktree>/.opencorvus/.r/project/attachments/<sha>.<ext>`.
   * Content-addressed: identical payloads deduplicate to the same file. Returns
   * a reference carrying the HTTP URL that AttachmentRoutes serves.
   *
   * The storage directory is derived from `Project.get(projectID).worktree` —
   * this is the SOLE source of truth for attachment locations. Callers must
   * not pass a directory; doing so previously created a double-source bug
   * where writers used `Instance.directory` (cwd-prone) while readers used
   * `project.worktree`, leaving registered-but-missing files when the two
   * diverged.
   */
  export async function write(projectID: string, data: Buffer, mime: string, filename?: string): Promise<Reference> {
    if (!mime) throw new Error("AttachmentStore.write requires a non-empty mime type")
    const project = Project.get(projectID)
    if (!project) throw new Error(`AttachmentStore.write: unknown project ${projectID}`)
    await claimAuthority(projectID)
    const sha = crypto.createHash("sha256").update(data).digest("hex")
    const ext = extensionFor(mime, filename)
    const name = `${sha}.${ext}`
    const dir = storageDir(project.worktree)
    await fs.mkdir(dir, { recursive: true })
    const abs = path.join(dir, name)
    const reference = {
      sha,
      url: `${ROUTE_PREFIX}/${projectID}/${name}`,
      mime,
      size: data.byteLength,
      filename,
    }
    const metadataAbs = metadataPath(abs)
    return await withKeyedLock(publicationLocks, abs, async () => {
      if (
        await validatePublishedPair({
          projectID,
          name,
          abs,
          metadataAbs,
          sha,
          mime,
          size: data.byteLength,
        })
      ) {
        const now = new Date()
        await Promise.all([fs.utimes(abs, now, now), fs.utimes(metadataAbs, now, now)])
        return reference
      }

      const stagingKey = `.${name}.staging-${randomUUID()}`
      const stagingBlob = path.join(dir, stagingKey)
      const stagingMetadata = `${stagingBlob}.metadata.json`
      const cleanupTargets = [stagingBlob, stagingMetadata, abs, metadataAbs]
      try {
        await Promise.all([fs.rm(abs, { force: true }), fs.rm(metadataAbs, { force: true })])
        await fs.writeFile(stagingBlob, data, { flag: "wx" })
        await fs.writeFile(stagingMetadata, JSON.stringify(reference, null, 2), { flag: "wx" })
        if (
          !(await validatePublishedPair({
            projectID,
            name,
            abs: stagingBlob,
            metadataAbs: stagingMetadata,
            sha,
            mime,
            size: data.byteLength,
          }))
        ) {
          throw new Error(`AttachmentStore.write: staged pair failed integrity validation for ${projectID}/${name}`)
        }
        await fs.rename(stagingBlob, abs)
        await fs.rename(stagingMetadata, metadataAbs)
        if (
          !(await validatePublishedPair({
            projectID,
            name,
            abs,
            metadataAbs,
            sha,
            mime,
            size: data.byteLength,
          }))
        ) {
          throw new Error(`AttachmentStore.write: published pair failed integrity validation for ${projectID}/${name}`)
        }
        return reference
      } catch (cause) {
        return await cleanupPublication(cleanupTargets, cause)
      }
    })
  }

  /**
   * Convenience: read a file from absolute path and persist into the
   * content-addressed store. Single source for tool producers (acceptance
   * screenshot/verify, future MCP image migration) so callers never roll
   * their own readFile + base64 + data-URL pipeline (which was the OOM
   * driver — see attachment-store single-source contract).
   */
  export async function writeFromPath(
    projectID: string,
    absPath: string,
    mime?: string,
    filename?: string,
  ): Promise<Reference> {
    const bytes = await fs.readFile(absPath)
    const resolvedMime = mime ?? mimeFromPath(absPath)
    const resolvedFilename = filename ?? path.basename(absPath)
    return await write(projectID, bytes, resolvedMime, resolvedFilename)
  }

  /** Resolve a stored filename back to its absolute path for the given project. */
  export function resolveAbsolute(projectID: string, name: string): string | undefined {
    const project = Project.get(projectID)
    if (!project) return undefined
    const dir = storageDir(project.worktree)
    const abs = path.normalize(path.join(dir, name))
    if (!abs.startsWith(path.normalize(dir))) return undefined
    return abs
  }

  /** Read an attachment's raw bytes for LLM multimodal acceptance. */
  export async function read(projectID: string, name: string): Promise<Buffer> {
    const abs = resolveAbsolute(projectID, name)
    if (!abs) throw new Error(`attachment ${projectID}/${name} is not resolvable`)
    return await fs.readFile(abs)
  }

  /** Read the canonical metadata sidecar for a stored attachment reference. */
  export async function readReference(projectID: string, name: string): Promise<Reference> {
    const abs = resolveAbsolute(projectID, name)
    if (!abs) throw new Error(`attachment ${projectID}/${name} is not resolvable`)
    const text = await fs.readFile(metadataPath(abs), "utf8")
    const parsed = JSON.parse(text) as unknown
    return parseReferenceMetadata(parsed, { projectID, name, abs })
  }

  /**
   * Resolve and validate a caller-carried canonical attachment reference.
   * URL ownership, metadata, and the underlying blob must all agree before a
   * conversation, Mission, or Task can retain an out-of-band upload ref.
   */
  export async function readVerifiedReference(input: {
    projectID: string
    url: string
    mime?: string
    maxBytes?: number
  }): Promise<{ reference: Reference; bytes: Buffer }> {
    const located = nameFromUrl(input.url)
    if (!located) throw new Error(`attachment URL is not canonical: ${input.url}`)
    if (located.projectID !== input.projectID) {
      throw new Error(`attachment belongs to project ${located.projectID}, expected ${input.projectID}: ${input.url}`)
    }
    const reference = await readReference(located.projectID, located.name)
    const abs = resolveAbsolute(located.projectID, located.name)
    if (!abs) throw new Error(`attachment ${located.projectID}/${located.name} is not resolvable`)
    const handle = await fs.open(abs, "r")
    let bytes: Buffer
    try {
      const before = await handle.stat()
      if (!before.isFile() || before.size !== reference.size) {
        throw new Error(`attachment blob does not match canonical metadata: ${input.url}`)
      }
      if (input.maxBytes !== undefined && before.size > input.maxBytes) {
        throw new Error(`attachment blob exceeds ${input.maxBytes} bytes: ${input.url}`)
      }
      bytes = await handle.readFile()
      const after = await handle.stat()
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
        throw new Error(`attachment blob changed while being read: ${input.url}`)
      }
    } finally {
      await handle.close()
    }
    const digest = crypto.createHash("sha256").update(bytes).digest("hex")
    if (digest !== reference.sha) {
      throw new Error(`attachment blob digest does not match canonical metadata: ${input.url}`)
    }
    if (input.mime !== undefined && input.mime !== reference.mime) {
      throw new Error(`attachment MIME does not match canonical metadata: ${input.url}`)
    }
    return { reference, bytes }
  }

  export async function requireReference(input: { projectID: string; url: string; mime?: string; maxBytes?: number }): Promise<Reference> {
    return (await readVerifiedReference(input)).reference
  }

  export interface DerivedAttachment {
    name: string
    abs: string
    mime: string
    size: number
  }

  function derivedThumbnailName(name: string): string {
    if (!name || /[/\\?#]/.test(name)) {
      throw new Error(`AttachmentStore.screenshotBrowserThumbnail: invalid attachment name ${name}`)
    }
    const ext = path.extname(name)
    const stem = ext ? name.slice(0, -ext.length) : name
    if (!stem) throw new Error(`AttachmentStore.screenshotBrowserThumbnail: invalid attachment name ${name}`)
    return `${stem}.${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}.webp`
  }

  function derivedThumbnailDirectory(sourceAbs: string): string {
    return path.join(path.dirname(sourceAbs), ".derived", SCREENSHOT_BROWSER_THUMBNAIL_VARIANT)
  }

  export async function screenshotBrowserThumbnail(projectID: string, name: string): Promise<DerivedAttachment> {
    const sourceAbs = resolveAbsolute(projectID, name)
    if (!sourceAbs) throw new Error(`attachment ${projectID}/${name} is not resolvable`)
    const sourceStat = await fs.stat(sourceAbs)
    if (!sourceStat.isFile()) throw new Error(`attachment ${projectID}/${name} is not a file`)

    const derivedName = derivedThumbnailName(name)
    const derivedDir = derivedThumbnailDirectory(sourceAbs)
    const derivedAbs = path.join(derivedDir, derivedName)
    const existing = await fs.stat(derivedAbs).catch(() => null)
    if (existing?.isFile()) {
      return {
        name: derivedName,
        abs: derivedAbs,
        mime: SCREENSHOT_BROWSER_THUMBNAIL_MIME,
        size: existing.size,
      }
    }

    const bytes = await sharp(sourceAbs, { failOn: "error" })
      .rotate()
      .resize({
        width: SCREENSHOT_BROWSER_THUMBNAIL_WIDTH,
        height: SCREENSHOT_BROWSER_THUMBNAIL_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 4 })
      .toBuffer()

    await fs.mkdir(derivedDir, { recursive: true })
    await fs.writeFile(derivedAbs, bytes, { flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (hasNodeErrorCode(error, "EEXIST")) return
      throw error
    })
    const info = await fs.stat(derivedAbs)
    return {
      name: derivedName,
      abs: derivedAbs,
      mime: SCREENSHOT_BROWSER_THUMBNAIL_MIME,
      size: info.size,
    }
  }

  /** Convert a canonical `/attachment/<projectID>/<sha>.<ext>` reference into an AI-SDK data URL. */
  export async function dataUrlFromReference(url: string, mime: string): Promise<string | undefined> {
    const located = nameFromUrl(url)
    if (!located) return undefined
    const bytes = await read(located.projectID, located.name)
    return `data:${mime};base64,${bytes.toString("base64")}`
  }

  /**
   * Whether a MIME type can be sent as an LLM multimodal file part.
   *
   * AI SDK provider wrappers (notably the openai-compatible one used by Kimi /
   * Alibaba models) only accept image, audio, video, and PDF as inline `file`
   * parts; text/* and application/json are silently rejected by the upstream
   * API and surface as "No output generated" errors. Callers must route
   * non-multimodal attachments through their URL/filename in the prompt and
   * let the agent fetch them via the read tool.
   *
   * Image MIME family is intentionally permissive: modern vision-capable
   * models (Claude Sonnet/Opus 4.6, GPT-4o, Gemini) accept HEIC/HEIF/AVIF/WEBP
   * in addition to the legacy PNG/JPEG. Restricting to a hardcoded list would
   * silently strip mobile-camera uploads.
   */
  export function isMultimodalSupported(mime: string): boolean {
    if (!mime) return false
    const m = mime.toLowerCase()
    if (m === "application/pdf") return true
    return m.startsWith("image/") || m.startsWith("audio/") || m.startsWith("video/")
  }

  // ── LLM-side packaging ─────────────────────────────────────────────────
  // Producer-agent code (orchestrator / requirements / frontend-design /
  // acceptance) historically had three near-identical copies of the
  // "split attachments by mime, inline the multimodal ones, list the
  // text/* ones by URL" routine. The duplication kept drifting (e.g. one
  // copy filtered `image/*` only, dropping PDF — see C3 audit). The
  // helpers below are the single source of truth so any future tweak
  // applies uniformly.

  type AttachmentLike = {
    sha?: string
    url?: string
    mime?: string
    size?: number
    filename?: string
  }

  /** Shape of an inline user-message file part — matches `PromptInput.parts`
   *  / `RunAgentSessionInput.buildUserParts` so it can be spliced directly
   *  into the user message without further translation. */
  export type InlineFilePart = {
    type: "file"
    url: string
    mime: string
    filename?: string
  }

  /**
   * Bucket attachments into:
   *   • `multimodal` — provider-supported MIMEs the agent can inline as
   *     AI-SDK file parts (image / audio / video / pdf).
   *   • `referenceOnly` — text/* / json / etc. The agent must read these
   *     via the read tool using the canonical /attachment/<projectID>/<sha>.<ext>
   *     URL (or the attachment:<sha>.<ext> shorthand), since openai-compatible
   *     providers reject non-multimodal MIMEs as inline file parts.
   */
  export function partition<T extends AttachmentLike>(
    attachments: readonly T[] | undefined,
  ): {
    multimodal: T[]
    referenceOnly: T[]
  } {
    if (!attachments?.length) return { multimodal: [], referenceOnly: [] }
    const multimodal: T[] = []
    const referenceOnly: T[] = []
    for (const a of attachments) {
      if (isMultimodalSupported(typeof a.mime === "string" ? a.mime : "")) multimodal.push(a)
      else referenceOnly.push(a)
    }
    return { multimodal, referenceOnly }
  }

  // Note: the previous helper `renderReferenceList(referenceOnly)` listed only
  // the non-multimodal subset. It conflated "I don't have a `read` tool"
  // (orchestrator) with "I do have one" (sub-agents) into a single string and
  // — worse — left multimodal attachments completely absent from the prompt
  // text, so models silently ignored uploaded screenshots. Replaced by
  // `renderAttachmentInventory` below which surfaces every attachment with an
  // explicit per-item kind tag.

  /**
   * Render an explicit textual inventory of EVERY task attachment. This is a
   * link/index context contract: image / pdf / audio / video files are listed
   * as media refs, and text/json files are listed as document refs. Callers must
   * not imply the bytes were hidden in the prompt; agents either inspect the
   * cited refs through their visible tools or report the inspection gap.
   *
   * Returns "" when nothing to surface so the caller can `text + section`
   * unconditionally. Section header / hint string is configurable so the
   * orchestrator can swap the default wording for its own dispatch guidance.
   */
  export function renderAttachmentInventory(
    attachments: readonly AttachmentLike[] | undefined,
    opts: {
      header?: string
      hint?: string
    } = {},
  ): string {
    if (!attachments?.length) return ""
    const { multimodal, referenceOnly } = partition(attachments)
    const header = opts.header ?? "## Task Attachments"
    const hint =
      opts.hint ??
      "Attachments are provided as refs, not hidden prompt bytes. Inspect a listed ref only through visible tools that can read that MIME, and report an inspection gap when no such tool is available."
    const formatRow = (a: AttachmentLike, kind: "inline" | "reference", index: number) => {
      const sizeKb = typeof a.size === "number" ? `${Math.max(1, Math.round(a.size / 1024))} KB, ` : ""
      // displayFilename gives a generated readable name when the upload path
      // omitted the original filename — never let a 64-char sha surface
      // as the user-visible name for the attachment.
      const name = displayFilename({ filename: a.filename, mime: a.mime, sha: a.sha, index })
      const mime = a.mime ?? "application/octet-stream"
      const tag = kind === "inline" ? "[media_ref]" : "[text_ref]"
      return `- ${name} — ${mime} — ${sizeKb}${tag} url: ${a.url}`
    }
    const lines = [
      ...multimodal.map((a, i) => formatRow(a, "inline", i)),
      ...referenceOnly.map((a, i) => formatRow(a, "reference", multimodal.length + i)),
    ].join("\n")
    return `\n\n${header}\n${hint}\n\n${lines}`
  }

  /** Subset of `Provider.Model.capabilities` needed for vision gating.
   *  Kept structural (not a hard import) so this storage module doesn't
   *  cycle through the provider layer. The fields match the Provider.Model
   *  zod schema 1:1; if the schema grows new input modalities, extend here. */
  export interface InputCapabilities {
    input: {
      text?: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
  }

  function mimeAcceptedByCapabilities(mime: string, caps: InputCapabilities): boolean {
    const m = (mime || "").toLowerCase()
    if (m.startsWith("image/")) return caps.input.image
    if (m === "application/pdf") return caps.input.pdf
    if (m.startsWith("audio/")) return caps.input.audio
    if (m.startsWith("video/")) return caps.input.video
    return false
  }

  /**
   * Read the bytes for each multimodal-supported attachment and return user-message
   * `type:"file"` parts (data-URL form) ready to splice directly into a
   * `PromptInput.parts` / `RunAgentSessionInput.buildUserParts` array.
   *
   * Single source of truth (rule 22): every producer-agent (orchestrator /
   * frontend-design / requirements / acceptance) used to roll its own
   * partition+read+base64 pipeline AND mis-decoded the prior `loadFileParts`
   * result shape (`"image" in fp` / `"file" in fp` checks that never matched
   * the actual return value), silently dropping every multimodal attachment
   * — the LLM was hallucinating from prompt text alone. This helper is the
   * single conversion path; callers must not re-wrap its output.
   *
   * Skips non-multimodal MIMEs (those surface as `[reference]` rows in
   * `renderAttachmentInventory`).
   * When `opts.capabilities` is supplied, additionally filters out
   * multimodal MIMEs that the resolved model cannot accept on input
   * (e.g. text-only coding endpoints like dashscope coding). Without this
   * gate, the openai-compatible provider wrapper would forward the file
   * part to the upstream API which silently strips it, leaving the
   * orchestrator to confabulate visual context it never saw. The skip is
   * logged with `agent` + `mime` + `filename` so operators can see when an
   * attachment is being dropped due to model incapability.
   * Throws if any URL is unresolvable — partial attachment acceptance would
   * mislead the agent (it would believe it saw all references).
   */
  export async function inlineFileParts(
    attachments: readonly AttachmentLike[] | undefined,
    opts?: { capabilities?: InputCapabilities; agent?: string },
  ): Promise<InlineFilePart[]> {
    const { multimodal } = partition(attachments)
    if (multimodal.length === 0) return []
    const caps = opts?.capabilities
    const accepted = caps
      ? multimodal.filter((a) => {
          const ok = mimeAcceptedByCapabilities(String(a.mime ?? ""), caps)
          if (!ok) {
            log.warn("skipping multimodal attachment — model lacks input capability", {
              agent: opts?.agent,
              mime: a.mime,
              filename: a.filename,
              sha: a.sha,
            })
          }
          return ok
        })
      : multimodal
    return Promise.all(
      accepted.map(async (a) => {
        const located = nameFromUrl(String(a.url ?? ""))
        if (!located) throw new Error(`attachment has no resolvable url: ${a.filename ?? a.sha}`)
        const mime = String(a.mime)
        const url = await dataUrlFromReference(String(a.url ?? ""), mime)
        if (!url) throw new Error(`attachment has no resolvable url: ${a.filename ?? a.sha}`)
        return {
          type: "file" as const,
          url,
          mime,
          ...(a.filename ? { filename: a.filename } : {}),
        }
      }),
    )
  }

  /** A staged attachment — the result of copying a content-addressed task
   *  attachment into a build worktree's `references/` subdirectory so the
   *  build agent sees a worktree-LOCAL relative path it can pass to tools
   *  whose sandbox checks reject paths escaping the worktree (rule 1: the
   *  sandbox refuses every path outside the worktree; the staging step is
   *  what gives the agent a path inside it). */
  export interface StagedAttachment {
    /** Path relative to the worktree (e.g. `references/screenshot.png`). */
    relPath: string
    /** Absolute path inside the worktree. */
    absPath: string
    /** MIME type carried over from the source reference. */
    mime: string
    /** Original filename (when present), preserved verbatim before staging. */
    originalFilename?: string
  }

  /** Convert staged worktree-local references into prompt file parts.
   *  Managed Build uses this after stageToWorktree succeeds so provider-bound
   *  bytes come from the staged file, not a second read of the original
   *  content-addressed attachment blob. */
  export function filePartsFromStagedReferences(staged: readonly StagedAttachment[]): InlineFilePart[] {
    return staged.map((item) => ({
      type: "file" as const,
      url: pathToFileURL(item.absPath).href,
      mime: item.mime,
      filename: path.basename(item.relPath),
    }))
  }

  /** Subdirectory under each build worktree where staged user-contract
   *  attachments live. Single source for build-reference staging. */
  export const STAGED_REFERENCES_SUBDIR = "references"

  /**
   * Copy each selected task attachment into `<worktreeDir>/references/<file>`
   * so the build agent can pass worktree-LOCAL relative paths to sandboxed
   * tools that require worktree-local paths.
   *
   * This stages every attachment the caller selected for build evidence,
   * including JSON/text diagnostics. Provider inline support is handled only
   * by `inlineFileParts`; worktree staging is a file-access contract, not a
   * multimodal capability filter.
   *
   * Why copy not symlink: cross-FS robustness on Windows (symlinks need admin
   * by default) and content-addressed inputs are small enough that a copy
   * costs nothing. Existing files with the same content are reused so staging
   * is idempotent and re-entrant across goal retries. If two different blobs
   * share a display filename, the later blob is staged under
   * `<name>-<sha8><ext>`; a pre-existing sha-suffixed path with different
   * content is a hard collision error.
   *
   * Filename policy: prefer the attachment's original `filename` when it's
   * shell-safe (ASCII alphanumerics + `._-` + spaces preserved as-is — we
   * only ban shell metacharacters and path separators). Otherwise use
   * `attachment-<index>-<sha-prefix>.<ext>` so the LLM still gets a stable
   * reference. CJK filenames pass through (filesystem accepts them; the
   * sandbox check looks at path containment, not character set).
   *
   * Returns the staged metadata in the same order as `attachments`. Empty
   * input returns `[]` without creating the `references/` directory.
   */
  export async function stageToWorktree(
    projectID: string,
    attachments: readonly AttachmentLike[] | undefined,
    worktreeDir: string,
  ): Promise<StagedAttachment[]> {
    const selected = attachments ?? []
    if (selected.length === 0) return []

    const refsDir = path.join(worktreeDir, STAGED_REFERENCES_SUBDIR)
    await fs.mkdir(refsDir, { recursive: true })

    const staged: StagedAttachment[] = []
    for (let i = 0; i < selected.length; i++) {
      const a = selected[i]
      const located = nameFromUrl(String(a.url ?? ""))
      if (!located) {
        throw new Error(
          `AttachmentStore.stageToWorktree: attachment ${a.filename ?? a.sha ?? `#${i}`} has no resolvable url`,
        )
      }
      if (located.projectID !== projectID) {
        throw new Error(
          `AttachmentStore.stageToWorktree: attachment ${a.filename ?? a.sha ?? `#${i}`} belongs to project ${located.projectID}, expected ${projectID}`,
        )
      }
      const sourceAbs = resolveAbsolute(located.projectID, located.name)
      if (!sourceAbs) {
        throw new Error(
          `AttachmentStore.stageToWorktree: attachment ${located.projectID}/${located.name} not resolvable on disk`,
        )
      }

      const filename = displayFilename({
        filename: a.filename,
        mime: typeof a.mime === "string" ? a.mime : "",
        sha: a.sha,
        index: i,
      })
      const destination = await selectStagedDestination(refsDir, filename, sourceAbs)
      if (!destination.exists) {
        await fs.copyFile(sourceAbs, destination.absPath)
      }

      staged.push({
        relPath: `${STAGED_REFERENCES_SUBDIR}/${destination.filename}`,
        absPath: destination.absPath,
        mime: typeof a.mime === "string" ? a.mime : "application/octet-stream",
        originalFilename: a.filename,
      })
    }
    return staged
  }

  type StagedDestination = {
    filename: string
    absPath: string
    exists: boolean
  }

  async function selectStagedDestination(
    refsDir: string,
    filename: string,
    sourceAbs: string,
  ): Promise<StagedDestination> {
    const primaryAbs = path.join(refsDir, filename)
    if (!(await pathExists(primaryAbs))) {
      return { filename, absPath: primaryAbs, exists: false }
    }

    const sourceSha = await fileSha256(sourceAbs)
    if ((await fileSha256(primaryAbs)) === sourceSha) {
      return { filename, absPath: primaryAbs, exists: true }
    }

    const distinctFilename = contentAddressedDisplayFilename(filename, sourceSha)
    const distinctAbs = path.join(refsDir, distinctFilename)
    if (!(await pathExists(distinctAbs))) {
      return { filename: distinctFilename, absPath: distinctAbs, exists: false }
    }
    if ((await fileSha256(distinctAbs)) === sourceSha) {
      return { filename: distinctFilename, absPath: distinctAbs, exists: true }
    }
    throw new Error(
      `AttachmentStore.stageToWorktree: staged filename collision for ${STAGED_REFERENCES_SUBDIR}/${distinctFilename}`,
    )
  }

  async function pathExists(absPath: string): Promise<boolean> {
    try {
      await fs.stat(absPath)
      return true
    } catch (error) {
      if (hasNodeErrorCode(error, "ENOENT")) return false
      throw error
    }
  }

  async function fileSha256(absPath: string): Promise<string> {
    const bytes = await fs.readFile(absPath)
    return crypto.createHash("sha256").update(bytes).digest("hex")
  }

  function contentAddressedDisplayFilename(filename: string, sha: string): string {
    const ext = path.extname(filename)
    const stem = filename.slice(0, filename.length - ext.length)
    return `${stem}-${sha.slice(0, 8)}${ext}`
  }

  function hasNodeErrorCode(error: unknown, code: string): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code
  }

  /** Render a markdown bullet list of staged attachment paths for the
   *  build agent's user message — appended alongside / instead of the URL
   *  reference list when staging happened. */
  export function renderStagedList(staged: readonly StagedAttachment[]): string {
    if (staged.length === 0) return ""
    const lines = staged
      .map(
        (s) => `- \`${s.relPath}\` — ${s.mime}` + (s.originalFilename ? ` (originally \`${s.originalFilename}\`)` : ""),
      )
      .join("\n")
    return (
      `\n\n## Staged Reference Files (already inside this worktree)\n` +
      `These files were copied here so you can pass them to tools that reject paths outside the worktree.\n` +
      `Use the relative paths verbatim — do NOT \`cp\` them again to other locations.\n${lines}`
    )
  }

  // ASCII-printable + space; reject shell metacharacters and path separators.
  const SAFE_FILENAME_RE = /^[A-Za-z0-9._\-一-鿿 ]+$/

  /**
   * Single source of truth for "what name should the LLM / user see for
   * this attachment?" (CLAUDE.md rule 9). Use this everywhere a sha-based
   * raw storage handle would otherwise show through — `renderAttachmentInventory`
   * for sub-agent prompts, `task-api` for user-facing message lists, and
   * the `stageToWorktree` copy step (a stable name for tools that resolve
   * paths inside the worktree).
   *
   * Generated display-name policy when `original` is missing or contains
   * shell-unsafe characters:
   *   1. `attachment-{index+1}-{sha8}.{ext}` — preserves task-relative
   *      ordering and traces back to storage; readable at a glance.
   *   2. With no sha:  `attachment-{index+1}-noref.{ext}` — signals the
   *      missing provenance instead of letting the caller invent one.
   *
   * Never returns a 64-char sha alone: that is the storage filename, not
   * a UI / LLM filename, and surfacing it directly was the bug a previous
   * commit tried to fix only for the staging path.
   */
  export function displayFilename(input: { filename?: string; mime?: string; sha?: string; index?: number }): string {
    if (input.filename && SAFE_FILENAME_RE.test(input.filename)) return input.filename
    const ext = extensionFor(input.mime ?? "", input.filename)
    const shaPrefix = (input.sha ?? "").slice(0, 8) || "noref"
    const idx = typeof input.index === "number" ? input.index + 1 : 1
    return `attachment-${idx}-${shaPrefix}.${ext}`
  }

  /** Extract the stored filename (`<sha>.<ext>`) from a reference URL. */
  export function nameFromUrl(url: string): { projectID: string; name: string } | undefined {
    const prefix = `${ROUTE_PREFIX}/`
    if (!url.startsWith(prefix)) return undefined
    const rest = url.slice(prefix.length)
    const slash = rest.indexOf("/")
    if (slash <= 0) return undefined
    const projectID = rest.slice(0, slash)
    const name = rest.slice(slash + 1)
    if (!projectID || !name || /[/\\?#]/.test(name)) return undefined
    return { projectID, name }
  }

  // ── Garbage collection ────────────────────────────────────────────────
  //
  // AttachmentStore.write is content-addressed and write-only: identical
  // payloads dedupe to the same `<sha>.<ext>` file. Before the GC pass
  // added below, nothing ever deleted those files — every removed part /
  // session / task left its referenced bytes behind on disk. The first
  // OOM forensic pass (attachment-store single-source contract)
  // found that screenshot tools were bloating `part.data` with
  // inline base64 instead of using the store at all. As the migration
  // moves them onto the store, the on-disk directory becomes the single
  // source — and that source needs reaping.
  //
  // Strategy: on engine boot (wired in `Instance.provide` bootstrap),
  // collect every `<sha>` referenced by any persisted `part.data`, then
  // delete on-disk files whose sha is not in that set. Skip files newer
  // than GC_MIN_AGE_MS so a sweep racing a fresh write does not delete a
  // file before the part row that references it lands.

  /** Files younger than this are skipped by sweep() so a write racing the
   *  sweep is not deleted before its part row lands. */
  const GC_MIN_AGE_MS = 60_000

  const REFERENCE_RE = /\/attachment\/[^/"\s]+\/([0-9a-f]{64})\.[0-9a-z]+/gi

  /**
   * Enumerate every `<sha>.<ext>` currently on disk under the project's
   * `.opencorvus/.r/project/attachments/` directory. Returns `[]` when the directory
   * does not exist (no attachments have ever been written for this project).
   */
  export async function listOnDisk(projectID: string): Promise<
    {
      sha: string
      name: string
      abs: string
      size: number
      mtimeMs: number
    }[]
  > {
    const project = Project.get(projectID)
    if (!project) throw new Error(`AttachmentStore.listOnDisk: unknown project ${projectID}`)
    const dir = storageDir(project.worktree)
    const entries = await fs.readdir(dir).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return [] as string[]
      throw err
    })
    const out: { sha: string; name: string; abs: string; size: number; mtimeMs: number }[] = []
    for (const name of entries) {
      const m = name.match(/^([0-9a-f]{64})\.[0-9a-z]+$/i)
      if (!m) continue
      const abs = path.join(dir, name)
      const stat = await fs.stat(abs).catch(() => null)
      if (!stat || !stat.isFile()) continue
      out.push({ sha: m[1].toLowerCase(), name, abs, size: stat.size, mtimeMs: stat.mtimeMs })
    }
    return out
  }

  /**
   * Sha-extraction primitive shared by every contributor to the live set:
   * stringify whatever JSON-shaped payload we got, run the canonical
   * `/attachment/<projectID>/<sha>.<ext>` regex over it, accumulate into the
   * per-project Map. Keeping the discovery rule in a single function is rule 8
   * (no double source): the regex + URL parser pair is the only place that
   * decides "is this a sha reference, and which project does it belong to".
   *
   * Callers pass any JSON-serializable value (drizzle gives us already-parsed
   * objects for json-mode columns). Null / undefined payloads short-circuit
   * so a nullable JSON column never costs an extra branch at every call site.
   */
  function harvestReferences(payload: unknown, byProject: Map<string, Set<string>>) {
    if (payload === null || payload === undefined) return
    const json = typeof payload === "string" ? payload : JSON.stringify(payload)
    for (const match of json.matchAll(REFERENCE_RE)) {
      const located = nameFromUrl(match[0])
      if (!located) continue
      const set = byProject.get(located.projectID) ?? new Set<string>()
      set.add(match[1].toLowerCase())
      byProject.set(located.projectID, set)
    }
  }

  /**
   * Return the deduplicated set of shas that are still live, grouped by
   * project. A sha is live iff at least one legitimate durable retain
   * surfaces still references it:
   *
   *   • `part.data` and
   *     `interactive_artifact.payload`      (session conversation content)
   *   • `engine_task.attachments`           (USER-CONTRACT files)
   *   • `engine_task.system_artifacts`      (SYSTEM-GENERATED evidence)
   *   • `decision_log.value/reason`         (Visual QA annotated evidence refs)
   *   • `engine_artifact.payload`           (design manifests, browser-preview
   *                                          evidence, acceptance evidence,
   *                                          Session attachment bindings)
   *   • `engine_interaction_request`,
   *     `engine_progress_snapshot`, and
   *     `engine_channel_binding` payloads    (durable task-scoped runtime facts)
   *
   * Walking only `part.data` (the pre-fix behaviour) violated rule 8: shas
   * registered through `appendTaskAttachment` / `appendTaskSystemArtifact`
   * looked orphan to sweep() between registration and the first session-part
   * that referenced them, so any visual reference older than `GC_MIN_AGE_MS`
   * got unlinked and the build agent ENOENTed on stageToWorktree() copy.
   *
   * All three sources share the canonical URL shape, so a single regex over
   * the serialized JSON (see `harvestReferences`) covers every retain surface
   * — no per-source parsing, no row-shape assumptions to drift.
   */
  export function collectReferencedShas(projectID?: string): Map<string, Set<string>> {
    const byProject = new Map<string, Set<string>>()
    Database.use((db) => {
      const partRows = projectID
        ? db
            .select({ data: PartTable.data })
            .from(PartTable)
            .innerJoin(SessionTable, eq(PartTable.session_id, SessionTable.id))
            .where(eq(SessionTable.project_id, projectID))
            .all()
        : db.select({ data: PartTable.data }).from(PartTable).all()
      for (const row of partRows) {
        harvestReferences(row.data, byProject)
      }
      const interactiveArtifactRows = projectID
        ? db
            .select({ payload: InteractiveArtifactTable.payload })
            .from(InteractiveArtifactTable)
            .innerJoin(MessageTable, eq(InteractiveArtifactTable.message_id, MessageTable.id))
            .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
            .where(eq(SessionTable.project_id, projectID))
            .all()
        : db.select({ payload: InteractiveArtifactTable.payload }).from(InteractiveArtifactTable).all()
      for (const row of interactiveArtifactRows) {
        harvestReferences(row.payload, byProject)
      }
      const taskQuery = db
        .select({
          attachments: EngineTaskTable.attachments,
          system_artifacts: EngineTaskTable.system_artifacts,
        })
        .from(EngineTaskTable)
      const taskRows = projectID ? taskQuery.where(eq(EngineTaskTable.project_id, projectID)).all() : taskQuery.all()
      for (const row of taskRows) {
        harvestReferences(row.attachments, byProject)
        harvestReferences(row.system_artifacts, byProject)
      }

      const decisionRows = projectID
        ? db
            .select({ value: DecisionLogTable.value, reason: DecisionLogTable.reason })
            .from(DecisionLogTable)
            .innerJoin(EngineTaskTable, eq(DecisionLogTable.task_id, EngineTaskTable.id))
            .where(eq(EngineTaskTable.project_id, projectID))
            .all()
        : db.select({ value: DecisionLogTable.value, reason: DecisionLogTable.reason }).from(DecisionLogTable).all()
      for (const row of decisionRows) {
        harvestReferences(row.value, byProject)
        harvestReferences(row.reason, byProject)
      }

      const artifactRows = projectID
        ? [
            ...db
              .select({ payload: EngineArtifactTable.payload })
              .from(EngineArtifactTable)
              .innerJoin(EngineTaskTable, eq(EngineArtifactTable.task_id, EngineTaskTable.id))
              .where(eq(EngineTaskTable.project_id, projectID))
              .all(),
            ...db
              .select({ payload: EngineArtifactVersionTable.payload })
              .from(EngineArtifactVersionTable)
              .innerJoin(EngineTaskTable, eq(EngineArtifactVersionTable.task_id, EngineTaskTable.id))
              .where(eq(EngineTaskTable.project_id, projectID))
              .all(),
          ]
        : [
            ...db.select({ payload: EngineArtifactTable.payload }).from(EngineArtifactTable).all(),
            ...db.select({ payload: EngineArtifactVersionTable.payload }).from(EngineArtifactVersionTable).all(),
          ]
      for (const row of artifactRows) harvestReferences(row.payload, byProject)

      const interactionRows = projectID
        ? db
            .select({
              title: EngineInteractionRequestTable.title,
              body: EngineInteractionRequestTable.body,
              payload: EngineInteractionRequestTable.payload,
              response: EngineInteractionRequestTable.response,
            })
            .from(EngineInteractionRequestTable)
            .innerJoin(EngineTaskTable, eq(EngineInteractionRequestTable.task_id, EngineTaskTable.id))
            .where(eq(EngineTaskTable.project_id, projectID))
            .all()
        : db
            .select({
              title: EngineInteractionRequestTable.title,
              body: EngineInteractionRequestTable.body,
              payload: EngineInteractionRequestTable.payload,
              response: EngineInteractionRequestTable.response,
            })
            .from(EngineInteractionRequestTable)
            .all()
      for (const row of interactionRows) {
        harvestReferences(row.title, byProject)
        harvestReferences(row.body, byProject)
        harvestReferences(row.payload, byProject)
        harvestReferences(row.response, byProject)
      }

      const progressRows = projectID
        ? db
            .select({
              summary: EngineProgressSnapshotTable.summary,
              payload: EngineProgressSnapshotTable.payload,
            })
            .from(EngineProgressSnapshotTable)
            .innerJoin(EngineTaskTable, eq(EngineProgressSnapshotTable.task_id, EngineTaskTable.id))
            .where(eq(EngineTaskTable.project_id, projectID))
            .all()
        : db
            .select({
              summary: EngineProgressSnapshotTable.summary,
              payload: EngineProgressSnapshotTable.payload,
            })
            .from(EngineProgressSnapshotTable)
            .all()
      for (const row of progressRows) {
        harvestReferences(row.summary, byProject)
        harvestReferences(row.payload, byProject)
      }

      const channelRows = projectID
        ? db
            .select({ payload: EngineChannelBindingTable.payload })
            .from(EngineChannelBindingTable)
            .innerJoin(EngineTaskTable, eq(EngineChannelBindingTable.task_id, EngineTaskTable.id))
            .where(eq(EngineTaskTable.project_id, projectID))
            .all()
        : db.select({ payload: EngineChannelBindingTable.payload }).from(EngineChannelBindingTable).all()
      for (const row of channelRows) harvestReferences(row.payload, byProject)
    })
    return byProject
  }

  /**
   * Delete on-disk files in the project's attachment directory whose sha
   * is not referenced by any persisted part. Files younger than
   * `GC_MIN_AGE_MS` are skipped so a sweep racing a concurrent write does
   * not delete a file before the part row that references it lands.
   *
   * Returns the count and total byte size of deleted orphans for logging.
   * Idempotent: running twice in a row deletes 0 the second time.
   */
  export async function sweep(projectID: string): Promise<{
    deleted: number
    bytesFreed: number
    skippedYoung: number
    kept: number
    retries: Array<{ blob: string; metadata: string; code: "EBUSY" | "EPERM" }>
    failures: Array<{ blob: string; metadata: string; phase: "blob" | "metadata"; error: string }>
  }> {
    await claimAuthority(projectID)
    const files = await listOnDisk(projectID)
    if (files.length === 0) {
      return { deleted: 0, bytesFreed: 0, skippedYoung: 0, kept: 0, retries: [], failures: [] }
    }
    const referenced = collectReferencedShas(projectID).get(projectID) ?? new Set<string>()
    const now = Date.now()
    let deleted = 0
    let bytesFreed = 0
    let skippedYoung = 0
    let kept = 0
    const retries: Array<{ blob: string; metadata: string; code: "EBUSY" | "EPERM" }> = []
    const failures: Array<{ blob: string; metadata: string; phase: "blob" | "metadata"; error: string }> = []
    for (const f of files) {
      if (referenced.has(f.sha)) {
        kept++
        continue
      }
      if (now - f.mtimeMs < GC_MIN_AGE_MS) {
        skippedYoung++
        continue
      }
      const metadata = metadataPath(f.abs)
      const outcome = await deleteAttachmentPair({ blob: f.abs, metadata, bytes: f.size })
      if (outcome.status === "retry") {
        retries.push({ blob: outcome.blob, metadata: outcome.metadata, code: outcome.code })
        continue
      }
      if (outcome.status === "failed") {
        failures.push({
          blob: outcome.blob,
          metadata: outcome.metadata,
          phase: outcome.phase,
          error: outcome.error,
        })
        continue
      }
      deleted++
      bytesFreed += outcome.bytesFreed
    }
    log.info("AttachmentStore.sweep", {
      projectID,
      deleted,
      bytesFreed,
      skippedYoung,
      kept,
      retries,
      failures,
    })
    if (retries.length > 0 || failures.length > 0) {
      log.warn("AttachmentStore.sweep left retryable or failed residue", {
        projectID,
        retries,
        failures,
      })
    }
    return { deleted, bytesFreed, skippedYoung, kept, retries, failures }
  }
}
