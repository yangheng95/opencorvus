import z from "zod"
import { ReadToolResultFacts } from "@opencorvus-ai/transport-protocol"
import * as path from "path"
import { Tool } from "./tool"
import { FileTime } from "../file/time"
import DESCRIPTION from "./read.txt"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"
import { InstructionPrompt } from "../session/instruction"
import { Filesystem } from "../util/filesystem"
import { AttachmentStore } from "../storage/attachment-store"
import { redactInlinePayloads } from "../util/inline-base64"
import { DEFAULT_TEXT_FILE_LIMIT, isBinaryBytes, readTextFilePageContent, renderTextFilePage } from "./text-file"
import { executionFiles } from "./execution-files"
import { fileSource } from "./source"

const DEFAULT_READ_LIMIT = DEFAULT_TEXT_FILE_LIMIT

/**
 * The line range a `read` citation should carry, or undefined when there is no
 * narrower place to point at than the file itself.
 *
 * A citation range is a location, not a receipt for what was loaded. A page
 * that covered the whole file would cite lines 1..N, and the overlay would dress
 * that up as a jump that always lands on line 1 — indistinguishable from a
 * citation that failed to jump at all.
 */
export function citedReadRange(page: {
  offset: number
  lines: number
  lastReadLine: number
  truncated: boolean
}): { range: { startLine: number; endLine: number } } | undefined {
  if (page.lines <= 0) return undefined
  if (page.offset === 1 && !page.truncated) return undefined
  return { range: { startLine: page.offset, endLine: page.lastReadLine } }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT"
}

export async function taskFileStatOrMissing<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch (error) {
    if (isMissingPathError(error)) return undefined
    throw error
  }
}

export const READ_TOOL_DESCRIPTION = DESCRIPTION
export const ReadToolParameters = z.object({
  filePath: z
    .string()
    .describe(
      "A path relative to the current Task directory, or an absolute path when the caller already has that exact native path",
    ),
  offset: z.coerce.number().int().min(1).describe("The line or directory entry number to start from (1-indexed)").optional(),
  limit: z.coerce.number().int().min(1).describe("The maximum number of lines or directory entries to read (defaults to 2000)").optional(),
})

export const ReadTool = Tool.define("read", {
  description: READ_TOOL_DESCRIPTION,
  parameters: ReadToolParameters,
  async execute(params, ctx) {
    let filepath = params.filePath
    const viaAttachment = resolveAttachmentPath(filepath)
    if (viaAttachment !== undefined) {
      filepath = viaAttachment.path
    } else if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(Instance.directory, filepath)
    }
    let title = path.relative(Instance.worktree, filepath)

    const files = executionFiles(ctx)
    const stat = await taskFileStatOrMissing(() => files.stat(filepath))

    await assertExternalDirectory(ctx, filepath, {
      bypass: Boolean(ctx.extra?.["bypassCwdCheck"]),
      kind: stat?.isDirectory() ? "directory" : "file",
    })

    if (!stat) {
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)

      const suggestions = await files
        .readdir(dir)
        .then((entries) =>
          entries
            .filter(
              (entry) =>
                entry.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(entry.toLowerCase()),
            )
            .map((entry) => path.join(dir, entry))
            .slice(0, 3),
        )
        .catch((error) => {
          if (isMissingPathError(error)) return []
          throw error
        })

      if (suggestions.length > 0) {
        throw new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${suggestions.join("\n")}`)
      }

      throw new Error(`File not found: ${filepath}`)
    }

    if (stat.isDirectory()) {
      const dirents = await files.readdir(filepath, { withFileTypes: true })
      const entries = await Promise.all(
        dirents.map(async (dirent) => {
          if (dirent.isDirectory()) return dirent.name + "/"
          if (dirent.isSymbolicLink()) {
            const target = await files.stat(path.join(filepath, dirent.name)).catch(() => undefined)
            if (target?.isDirectory()) return dirent.name + "/"
          }
          return dirent.name
        }),
      )
      entries.sort((a, b) => a.localeCompare(b))

      const limit = params.limit ?? DEFAULT_READ_LIMIT
      const offset = params.offset ?? 1
      const start = offset - 1
      const sliced = entries.slice(start, start + limit)
      const truncated = start + sliced.length < entries.length

      const output = [
        `<path>${filepath}</path>`,
        `<type>directory</type>`,
        `<entries>`,
        sliced.join("\n"),
        truncated
          ? `\n(Showing ${sliced.length} of ${entries.length} entries. Use 'offset' parameter to read beyond entry ${offset + sliced.length})`
          : `\n(${entries.length} entries)`,
        `</entries>`,
      ].join("\n")

      return {
        title,
        output,
        metadata: {
          preview: sliced.slice(0, 20).join("\n"),
          truncated,
          loaded: [] as string[],
          ...ReadToolResultFacts.parse({ readType: "directory", offset, lines: sliced.length, totalLines: entries.length }),
        },
      }
    }

    if (viaAttachment) {
      const reference = await AttachmentStore.readReference(viaAttachment.projectID, viaAttachment.name)
      title = reference.filename ?? AttachmentStore.displayFilename(reference)
    }
    const source = {
      path: filepath,
      title,
      provider: "opencorvus-read",
      ...(viaAttachment ? { origin: "attachment" as const } : {}),
    }
    const instructions = await InstructionPrompt.resolve(ctx.messages, filepath, ctx.messageID)

    // Exclude SVG (XML-based) and vnd.fastbidsheet (.fbs extension, commonly FlatBuffers schema files)
    const mime = Filesystem.mimeType(filepath)
    const isImage = mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"
    const isPdf = mime === "application/pdf"
    if (isImage || isPdf) {
      const msg = `${isImage ? "Image" : "PDF"} read successfully`
      return {
        title,
        output: msg,
        metadata: {
          preview: msg,
          truncated: false,
          loaded: instructions.map((i) => i.filepath),
          ...ReadToolResultFacts.parse({ readType: "binary", lines: 0, totalLines: 0 }),
        },
        attachments: [
          {
            type: "file",
            mime,
            filename: viaAttachment ? title : path.basename(filepath),
            url: `data:${mime};base64,${Buffer.from(await files.readFile(filepath)).toString("base64")}`,
          },
        ],
        sources: [fileSource(source)],
      }
    }

    const bytes = await files.readFile(filepath)
    const isBinary = isBinaryBytes(filepath, bytes)
    if (isBinary) throw new Error(`Cannot read binary file: ${filepath}`)

    const page = readTextFilePageContent(bytes.toString("utf8"), {
      offset: params.offset,
      limit: params.limit ?? DEFAULT_READ_LIMIT,
    })
    const preview = redactInlinePayloads(page.raw.slice(0, 20).join("\n"))

    let output = [`<path>${filepath}</path>`, `<type>file</type>`, "<content>"].join("\n")
    output += renderTextFilePage(page)
    output += "\n</content>"

    if (instructions.length > 0) {
      output += `\n\n<system-reminder>\n${instructions.map((i) => i.content).join("\n\n")}\n</system-reminder>`
    }
    output = redactInlinePayloads(output)
    FileTime.read(ctx.sessionID, filepath, bytes)

    return {
      title,
      output,
      metadata: {
        preview,
        truncated: page.truncated,
        loaded: instructions.map((i) => i.filepath),
        ...ReadToolResultFacts.parse({ readType: "text", offset: page.offset, lines: page.lines, totalLines: page.totalLines }),
      },
      sources: [
        fileSource({
          ...source,
          ...(citedReadRange(page) ?? {}),
        }),
      ],
    }
  },
})

/**
 * Resolve the attachment locator and physical path together. The caller reads
 * canonical metadata only after admitting the physical path's permissions.
 *
 * Accepted forms:
 *   - `/attachment/<projectID>/<sha>.<ext>`  — canonical URL emitted by
 *     AttachmentStore.write (served by AttachmentRoutes).
 *   - `attachment://<sha>.<ext>` or `attachment:<sha>.<ext>` — shorthand that
 *     resolves inside the current project, useful when agents synthesize URLs
 *     from references without carrying the project ID.
 *   - The current Project store's exact absolute or project-relative blob path.
 *
 * Returns undefined when the input is a plain file path.
 */
function resolveAttachmentPath(raw: string): { path: string; projectID: string; name: string } | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  const located = AttachmentStore.nameFromUrl(trimmed)
  if (located) {
    const abs = AttachmentStore.resolveAbsolute(located.projectID, located.name)
    if (!abs) throw new Error(`attachment ${trimmed} not found in project ${located.projectID}`)
    return { path: abs, projectID: located.projectID, name: located.name }
  }
  const schemeMatch = trimmed.match(/^attachment:(?:\/\/)?(.+)$/i)
  if (schemeMatch) {
    const name = schemeMatch[1].replace(/^\/+/, "")
    if (!name || name.includes("/") || name.includes("\\")) {
      throw new Error(`attachment shorthand must be 'attachment:<sha>.<ext>' without directory parts: ${trimmed}`)
    }
    const abs = AttachmentStore.resolveAbsolute(Instance.project.id, name)
    if (!abs) throw new Error(`attachment ${name} not resolvable in current project`)
    return { path: abs, projectID: Instance.project.id, name }
  }
  const absolute = path.isAbsolute(raw) ? raw : path.resolve(Instance.directory, raw)
  const stored = AttachmentStore.nameFromAbsolutePath(Instance.project.id, absolute)
  if (!stored) return undefined
  const canonical = AttachmentStore.resolveAbsolute(stored.projectID, stored.name)
  return canonical ? { path: canonical, ...stored } : undefined
}
