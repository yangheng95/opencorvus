import z from "zod"
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
  offset: z.coerce.number().describe("The line number to start reading from (1-indexed)").optional(),
  limit: z.coerce.number().describe("The maximum number of lines to read (defaults to 2000)").optional(),
})

export const ReadTool = Tool.define("read", {
  description: READ_TOOL_DESCRIPTION,
  parameters: ReadToolParameters,
  async execute(params, ctx) {
    if (params.offset !== undefined && params.offset < 1) {
      throw new Error("offset must be greater than or equal to 1")
    }
    let filepath = params.filePath
    const viaAttachment = resolveAttachmentPath(filepath)
    if (viaAttachment !== undefined) {
      filepath = viaAttachment
    } else if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(Instance.directory, filepath)
    }
    const title = path.relative(Instance.worktree, filepath)

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
          lines: sliced.length,
          totalLines: entries.length,
        },
      }
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
          lines: 0,
          totalLines: 0,
        },
        attachments: [
          {
            type: "file",
            mime,
            url: `data:${mime};base64,${Buffer.from(await files.readFile(filepath)).toString("base64")}`,
          },
        ],
        sources: [fileSource({ path: filepath, title, provider: "opencorvus-read" })],
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

    FileTime.read(ctx.sessionID, filepath)

    if (instructions.length > 0) {
      output += `\n\n<system-reminder>\n${instructions.map((i) => i.content).join("\n\n")}\n</system-reminder>`
    }
    output = redactInlinePayloads(output)

    return {
      title,
      output,
      metadata: {
        preview,
        truncated: page.truncated,
        loaded: instructions.map((i) => i.filepath),
        lines: page.lines,
        totalLines: page.totalLines,
      },
      sources: [
        fileSource({
          path: filepath,
          title,
          ...(page.lines > 0 ? { range: { startLine: page.offset, endLine: page.lastReadLine } } : {}),
          provider: "opencorvus-read",
        }),
      ],
    }
  },
})

/**
 * Map an attachment reference to its on-disk filesystem path so the read tool
 * can serve files uploaded to the task (images, PDFs, spec documents, …).
 *
 * Accepted forms:
 *   - `/attachment/<projectID>/<sha>.<ext>`  — canonical URL emitted by
 *     AttachmentStore.write (served by AttachmentRoutes).
 *   - `attachment://<sha>.<ext>` or `attachment:<sha>.<ext>` — shorthand that
 *     resolves inside the current project, useful when agents synthesize URLs
 *     from references without carrying the project ID.
 *
 * Returns undefined when the input is a plain file path.
 */
function resolveAttachmentPath(raw: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  const located = AttachmentStore.nameFromUrl(trimmed)
  if (located) {
    const abs = AttachmentStore.resolveAbsolute(located.projectID, located.name)
    if (!abs) throw new Error(`attachment ${trimmed} not found in project ${located.projectID}`)
    return abs
  }
  const schemeMatch = trimmed.match(/^attachment:(?:\/\/)?(.+)$/i)
  if (schemeMatch) {
    const name = schemeMatch[1].replace(/^\/+/, "")
    if (!name || name.includes("/") || name.includes("\\")) {
      throw new Error(`attachment shorthand must be 'attachment:<sha>.<ext>' without directory parts: ${trimmed}`)
    }
    const abs = AttachmentStore.resolveAbsolute(Instance.project.id, name)
    if (!abs) throw new Error(`attachment ${name} not resolvable in current project`)
    return abs
  }
  return undefined
}
