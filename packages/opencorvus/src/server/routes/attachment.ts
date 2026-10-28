import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { validator } from "@/server/validator"
import * as fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"
import { lazy } from "../../util/lazy"
import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"
import { WorkArtifactProfileRegistry } from "@/work-artifact/profile-registry"

const AttachmentReference = z.object({
  sha: z.string().length(64),
  url: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  filename: z.string().min(1),
})

const AttachmentUploadQuery = z.object({
  filename: z.string().min(1).max(1024),
})

const DirectoryReferenceInput = z.object({
  path: z.string().trim().min(1).max(32_768),
})

const DirectoryReference = AttachmentReference.extend({
  kind: z.literal("folder"),
  path: z.string().min(1),
})

const MIME_FROM_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  weba: "audio/webm",
  oga: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  bin: "application/octet-stream",
  docx: WorkArtifactProfileRegistry.require("office.document@1").mimeTypes[0]!,
  xlsx: WorkArtifactProfileRegistry.require("office.spreadsheet@1").mimeTypes[0]!,
  pptx: WorkArtifactProfileRegistry.require("office.presentation@1").mimeTypes[0]!,
}

function mimeFromName(name: string): string {
  const ext = path.extname(name).replace(/^\./, "").toLowerCase()
  return MIME_FROM_EXT[ext] ?? "application/octet-stream"
}

function attachmentHeaders(name: string, reference: AttachmentStore.Reference) {
  const mime = mimeFromName(name)
  const headers: Record<string, string> = {
    "content-type": mime,
    "content-length": String(reference.size),
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(reference.filename ?? name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
  }
  if (mime === "image/svg+xml") {
    headers["content-type"] = "application/octet-stream"
    headers["content-disposition"] = headers["content-disposition"]!.replace(/^inline;/, "attachment;")
  }
  return headers
}

function imageRenditionHeaders(size: number) {
  return {
    "content-type": AttachmentStore.IMAGE_RENDITION_MIME,
    "content-length": String(size),
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  }
}

function isMissingPathError(error: unknown): boolean {
  const code = error && typeof error === "object" ? (error as { code?: unknown }).code : undefined
  return code === "ENOENT" || code === "ENOTDIR"
}

async function statFileOrMissing(abs: string) {
  try {
    const info = await fs.stat(abs)
    return info.isFile() ? info : undefined
  } catch (error) {
    if (isMissingPathError(error)) return undefined
    throw error
  }
}

/**
 * GET /attachment/:projectID/:name
 * Serves a content-addressed attachment previously written by AttachmentStore.
 * Content-Type is derived from the stored file extension, except SVG files:
 * those are served as download-only octet-streams because active SVG can run
 * same-origin script when opened as a top-level document.
 * 404 when the project or file is unknown — no fallback lookups.
 */
export const AttachmentRoutes = lazy(() =>
  new Hono()
    .post(
      "/directory-reference",
      describeRoute({
        summary: "Reference a local directory",
        description:
          "Validate one local directory and store a canonical reference manifest without enumerating or uploading descendants.",
        operationId: "attachment.createDirectoryReference",
        responses: {
          200: {
            description: "Stored directory reference",
            content: { "application/json": { schema: resolver(DirectoryReference) } },
          },
          400: { description: "Invalid or non-directory path" },
        },
      }),
      validator("json", DirectoryReferenceInput),
      async (c) => {
        const selectedPath = c.req.valid("json").path
        let canonicalPath: string
        let info: Awaited<ReturnType<typeof fs.stat>>
        try {
          canonicalPath = await fs.realpath(selectedPath)
          info = await fs.stat(canonicalPath)
        } catch {
          return c.json({ message: "Directory reference path is not readable" }, 400)
        }
        if (!info.isDirectory()) return c.json({ message: "Directory reference path is not a directory" }, 400)
        const filename = path.basename(canonicalPath)
        if (!filename) return c.json({ message: "Directory reference path has no display name" }, 400)
        const manifest = Buffer.from(JSON.stringify({ version: 1, kind: "directory", path: canonicalPath }), "utf8")
        const reference = await AttachmentStore.write(Instance.project.id, manifest, DIRECTORY_REFERENCE_MIME, filename)
        return c.json(DirectoryReference.parse({ ...reference, kind: "folder", path: canonicalPath }))
      },
    )
    .post(
      "/",
      describeRoute({
        summary: "Upload a conversation attachment",
        description:
          "Store raw attachment bytes in the current project's content-addressed attachment store and return the canonical reference.",
        operationId: "attachment.create",
        responses: {
          200: {
            description: "Stored attachment reference",
            content: { "application/json": { schema: resolver(AttachmentReference) } },
          },
          400: { description: "Invalid filename, MIME type, or body" },
        },
      }),
      validator("query", AttachmentUploadQuery),
      async (c) => {
        const filename = c.req.valid("query").filename
        const mime = c.req.header("content-type")?.trim() ?? ""
        if (!mime) return c.json({ message: "Attachment upload requires Content-Type" }, 400)
        const bytes = Buffer.from(await c.req.arrayBuffer())
        const reference = await AttachmentStore.write(Instance.project.id, bytes, mime, filename)
        return c.json(AttachmentReference.parse(reference))
      },
    )
    .get(
      "/:projectID/:name",
      describeRoute({
        summary: "Fetch a task attachment",
        operationId: "attachment.get",
        responses: {
          200: { description: "Attachment bytes" },
          404: { description: "Not found" },
        },
      }),
      validator(
        "query",
        z.object({
          variant: z
            .string()
            .optional()
            .meta({ description: "Serve a derived rendition of the attachment instead of the stored bytes." }),
        }),
      ),
      async (c) => {
        const projectID = c.req.param("projectID")
        const name = c.req.param("name")
        if (!projectID || !name || name.includes("/") || name.includes("\\")) {
          return c.text("Not found", 404)
        }
        const variant = c.req.valid("query").variant ?? ""
        if (variant) {
          if (variant !== AttachmentStore.SCREENSHOT_BROWSER_THUMBNAIL_VARIANT && variant !== AttachmentStore.IMAGE_PREVIEW_VARIANT) return c.text("Not found", 404)
          const sourceAbs = AttachmentStore.resolveAbsolute(projectID, name)
          if (!sourceAbs) return c.text("Not found", 404)
          const sourceInfo = await statFileOrMissing(sourceAbs)
          if (!sourceInfo || !sourceInfo.isFile()) return c.text("Not found", 404)
          const rendition = await AttachmentStore.imageRendition(projectID, name, variant)
          const body = await fs.readFile(rendition.abs)
          return new Response(body as unknown as BodyInit, {
            status: 200,
            headers: imageRenditionHeaders(rendition.size),
          })
        }
        const abs = AttachmentStore.resolveAbsolute(projectID, name)
        if (!abs) return c.text("Not found", 404)
        const info = await statFileOrMissing(abs)
        if (!info || !info.isFile()) return c.text("Not found", 404)
        const snapshot = await AttachmentStore.readVerifiedReference({
          projectID,
          url: `/attachment/${projectID}/${name}`,
        })
        return new Response(snapshot.bytes as unknown as BodyInit, {
          status: 200,
          headers: attachmentHeaders(name, snapshot.reference),
        })
      },
    ),
)
