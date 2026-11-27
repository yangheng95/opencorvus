import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { validator } from "@/server/validator"
import * as fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"
import { lazy } from "../../util/lazy"
import { ATTACHMENT_IMAGE_DISPLAY_VARIANT, DIRECTORY_REFERENCE_MIME, DirectoryReferenceManifestSchema } from "@opencorvus-ai/transport-protocol"
import { WORK_ARTIFACT_PROFILE_IDS, WorkArtifactProfileRegistry } from "@/work-artifact/profile-registry"
import { NamedError } from "@opencorvus-ai/util/error"

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

const INLINE_SOURCE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
])

const OFFICE_SOURCE_MIMES = new Set(WORK_ARTIFACT_PROFILE_IDS.flatMap((id) => WorkArtifactProfileRegistry.require(id).mimeTypes))

function attachmentHeaders(name: string, reference: AttachmentStore.Reference) {
  const mediaType = reference.mime.split(";", 1)[0]!.trim().toLowerCase()
  const inline = INLINE_SOURCE_MIMES.has(mediaType)
  const mime = inline || OFFICE_SOURCE_MIMES.has(mediaType) ? reference.mime : "application/octet-stream"
  const disposition = inline ? "inline" : "attachment"
  const headers: Record<string, string> = {
    "content-type": mime,
    "content-length": String(reference.size),
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
    "content-disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(reference.filename ?? name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`,
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

async function imageRenditionResponse(projectID: string, name: string, variant: AttachmentStore.ImageRenditionVariant) {
  const rendition = await AttachmentStore.imageRendition(projectID, name, variant)
  const body = await fs.readFile(rendition.abs)
  return new Response(body as unknown as BodyInit, {
    status: 200,
    headers: imageRenditionHeaders(rendition.size),
  })
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
 * Content-Type comes from the verified publication receipt. Only the supported
 * passive media types are inline; Office sources retain their declared type for
 * download. Other sources, including active SVG, are download-only octet-streams.
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
          409: {
            description: "The canonical original is already published with another media type",
            content: { "application/json": { schema: resolver(AttachmentStore.MediaTypeConflictError.Schema) } },
          },
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
        const manifest = Buffer.from(JSON.stringify(
          DirectoryReferenceManifestSchema.parse({ version: 1, kind: "directory", path: canonicalPath }),
        ), "utf8")
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
        requestBody: {
          required: true,
          content: {
            "application/octet-stream": { schema: { type: "string", format: "binary" } },
          },
        },
        responses: {
          200: {
            description: "Stored attachment reference",
            content: { "application/json": { schema: resolver(AttachmentReference) } },
          },
          400: { description: "Invalid filename, MIME type, or body" },
          409: {
            description: "The canonical original is already published with another media type",
            content: { "application/json": { schema: resolver(AttachmentStore.MediaTypeConflictError.Schema) } },
          },
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
      "/:projectID/:name/reference",
      describeRoute({
        summary: "Read a verified attachment reference",
        description: "Return the canonical original's published media, filename and byte identity for authorized previews.",
        operationId: "attachment.reference",
        responses: {
          200: {
            description: "Verified original attachment reference",
            content: { "application/json": { schema: resolver(AttachmentReference) } },
          },
          404: { description: "Not found" },
        },
      }),
      async (c) => {
        const projectID = c.req.param("projectID")
        const name = c.req.param("name")
        if (!projectID || !name || name.includes("/") || name.includes("\\")) return c.text("Not found", 404)
        const abs = AttachmentStore.resolveAbsolute(projectID, name)
        if (!abs) return c.text("Not found", 404)
        const info = await statFileOrMissing(abs)
        if (!info || !info.isFile()) return c.text("Not found", 404)
        const snapshot = await AttachmentStore.readVerifiedReference({
          projectID, url: `/attachment/${projectID}/${name}`,
        })
        return c.json(AttachmentReference.parse({ ...snapshot.reference, filename: snapshot.reference.filename ?? name }))
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
          500: {
            description: "Image rendition generation or attachment storage failure",
            content: {
              "application/json": {
                schema: resolver(z.union([AttachmentStore.ImageRenditionError.Schema, NamedError.Unknown.Schema])),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          variant: z
            .string()
            .optional()
            .meta({ description: "Select image-display for the published image's display representation, or image-preview / screenshot-browser-thumbnail for a derived rendition." }),
        }),
      ),
      async (c) => {
        const projectID = c.req.param("projectID")
        const name = c.req.param("name")
        if (!projectID || !name || name.includes("/") || name.includes("\\")) {
          return c.text("Not found", 404)
        }
        const variant = c.req.valid("query").variant ?? ""
        if (variant && variant !== ATTACHMENT_IMAGE_DISPLAY_VARIANT) {
          if (variant !== AttachmentStore.SCREENSHOT_BROWSER_THUMBNAIL_VARIANT && variant !== AttachmentStore.IMAGE_PREVIEW_VARIANT) return c.text("Not found", 404)
          const sourceAbs = AttachmentStore.resolveAbsolute(projectID, name)
          if (!sourceAbs) return c.text("Not found", 404)
          const sourceInfo = await statFileOrMissing(sourceAbs)
          if (!sourceInfo || !sourceInfo.isFile()) return c.text("Not found", 404)
          return imageRenditionResponse(projectID, name, variant)
        }
        const abs = AttachmentStore.resolveAbsolute(projectID, name)
        if (!abs) return c.text("Not found", 404)
        const info = await statFileOrMissing(abs)
        if (!info || !info.isFile()) return c.text("Not found", 404)
        const snapshot = await AttachmentStore.readVerifiedReference({
          projectID,
          url: `/attachment/${projectID}/${name}`,
        })
        if (variant === ATTACHMENT_IMAGE_DISPLAY_VARIANT &&
          snapshot.reference.mime.split(";", 1)[0]!.trim().toLowerCase() === "image/svg+xml") {
          return imageRenditionResponse(projectID, name, AttachmentStore.IMAGE_PREVIEW_VARIANT)
        }
        return new Response(snapshot.bytes as unknown as BodyInit, {
          status: 200,
          headers: attachmentHeaders(name, snapshot.reference),
        })
      },
    ),
)
