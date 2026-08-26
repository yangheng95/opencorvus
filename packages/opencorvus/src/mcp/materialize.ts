import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { AttachmentStore } from "@/storage/attachment-store"
import { decodeRawBase64Payload } from "@/session/text-mime"
import { Identifier } from "@/id/id"
import type { Message } from "@/session/message"
import z from "zod"

export const MCP_TOOL_RESULT_METADATA_FIELD = "mcp_tool_result" as const
export const McpToolResultMetadataSchema = z
  .object({
    is_error: z.boolean(),
  })
  .strict()
export type McpToolResultMetadata = z.infer<typeof McpToolResultMetadataSchema>

export function mcpToolResultMetadata(input: unknown): McpToolResultMetadata | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined
  const parsed = McpToolResultMetadataSchema.safeParse(
    (input as Record<string, unknown>)[MCP_TOOL_RESULT_METADATA_FIELD],
  )
  return parsed.success ? parsed.data : undefined
}

export interface MaterializedMcpToolResult {
  text: string
  attachments: AttachmentStore.Reference[]
  metadata: Record<string, unknown>
}

export function materializedMcpAttachmentsToFileParts(input: {
  attachments: readonly AttachmentStore.Reference[]
  sessionID: string
  messageID: string
}): Message.FilePart[] {
  return input.attachments.map((attachment) => ({
    id: Identifier.ascending("part"),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "file",
    mime: attachment.mime,
    url: attachment.url,
    ...(attachment.filename ? { filename: attachment.filename } : {}),
  }))
}

export async function materializeMcpToolResult(input: {
  projectID: string
  result: CallToolResult & { metadata?: unknown }
  imageFilename?: string
  /**
   * The MCP server this result came from.
   *
   * Computer and Browser result semantics carry permission, result and UI
   * treatment, and they used to be guessed from the shape of
   * `structuredContent` alone — so a generic or package MCP server whose
   * payload happened to match got another provider's treatment. The provider
   * identity travels with the result instead: only the server that IS the
   * builtin gets that builtin's materialization. An omitted identity is a
   * caller that cannot name its provider, and receives neither.
   */
  serverName?: string
}): Promise<MaterializedMcpToolResult> {
  const textParts: string[] = []
  const attachments: AttachmentStore.Reference[] = []

  for (const contentItem of input.result.content) {
    if (contentItem.type === "text") {
      textParts.push(contentItem.text)
      continue
    }
    if (contentItem.type === "image") {
      if (!contentItem.mimeType) throw new Error("MCP image content missing mimeType")
      attachments.push(
        await AttachmentStore.write(
          input.projectID,
          decodeRawBase64Payload(contentItem.data, "MCP tool image content"),
          contentItem.mimeType,
          input.imageFilename,
        ),
      )
      continue
    }
    if (contentItem.type === "resource") {
      const { resource } = contentItem
      let materialized = false
      if ("text" in resource && resource.text) {
        textParts.push(resource.text)
        materialized = true
      }
      if ("blob" in resource && resource.blob) {
        const mime = resource.mimeType ?? "application/octet-stream"
        attachments.push(
          await AttachmentStore.write(
            input.projectID,
            decodeRawBase64Payload(resource.blob, `MCP tool resource blob ${resource.uri}`),
            mime,
            resource.uri,
          ),
        )
        materialized = true
      }
      if (!materialized) throw new Error(`MCP tool resource ${resource.uri} did not return usable text or blob content`)
      continue
    }
    throw new Error(`Unsupported MCP content item type: ${(contentItem as { type?: string }).type ?? "(missing)"}`)
  }

  const metadata =
    input.result.metadata && typeof input.result.metadata === "object" && !Array.isArray(input.result.metadata)
      ? (input.result.metadata as Record<string, unknown>)
      : {}
  const computer =
    input.serverName === ComputerMCPBuiltin.ServerName
      ? computerResultMetadata((input.result as { structuredContent?: unknown }).structuredContent, attachments)
      : undefined
  const browser =
    input.serverName === BrowserMCPBuiltin.ServerName
      ? browserObservationMetadata((input.result as { structuredContent?: unknown }).structuredContent, attachments)
      : undefined

  return {
    text: textParts.join("\n\n"),
    attachments,
    metadata: {
      ...metadata,
      ...(computer ? { computer } : {}),
      ...(browser ? { browser } : {}),
      [MCP_TOOL_RESULT_METADATA_FIELD]: { is_error: input.result.isError === true },
    },
  }
}

const ComputerSnakeIdentityContent = z
  .object({
    computer_id: z.string().min(1),
    display_id: z.string().min(1),
  })
  .passthrough()

const ComputerCamelIdentityContent = z
  .object({
    computerId: z.string().min(1),
    displayId: z.string().min(1),
  })
  .passthrough()

const ComputerObservationContent = ComputerSnakeIdentityContent.extend({
  observation_id: z.string().min(1),
  observation_digest: z.string().regex(/^[a-f0-9]{64}$/),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  mime_type: z.literal("image/png"),
}).passthrough()

function computerResultMetadata(
  structuredContent: unknown,
  attachments: AttachmentStore.Reference[],
): Record<string, unknown> | undefined {
  const observation = ComputerObservationContent.safeParse(structuredContent)
  if (observation.success) {
    const attachment = attachments.find((item) => item.mime === observation.data.mime_type)
    return {
      computerId: observation.data.computer_id,
      displayId: observation.data.display_id,
      observationId: observation.data.observation_id,
      observationDigest: observation.data.observation_digest,
      screenshot: {
        mimeType: observation.data.mime_type,
        width: observation.data.width,
        height: observation.data.height,
        attachmentUrl: attachment?.url,
        sha: attachment?.sha,
      },
    }
  }
  const snake = ComputerSnakeIdentityContent.safeParse(structuredContent)
  if (snake.success) {
    return {
      computerId: snake.data.computer_id,
      displayId: snake.data.display_id,
      ...(typeof snake.data.driver_version === "string" ? { driverVersion: snake.data.driver_version } : {}),
    }
  }
  const camel = ComputerCamelIdentityContent.safeParse(structuredContent)
  if (!camel.success) return
  return {
    computerId: camel.data.computerId,
    displayId: camel.data.displayId,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value)

function numberValue(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined
}

function stringValue(input: unknown): string | undefined {
  return typeof input === "string" ? input : undefined
}

function diagnosticCount(input: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = input?.[key]
  return Array.isArray(value) ? value.length : undefined
}

function browserObservationMetadata(
  structuredContent: unknown,
  attachments: AttachmentStore.Reference[],
): Record<string, unknown> | undefined {
  if (!isRecord(structuredContent)) return
  const screenshot = isRecord(structuredContent.screenshot) ? structuredContent.screenshot : structuredContent
  const width = numberValue(screenshot.width)
  const height = numberValue(screenshot.height)
  const mimeType = stringValue(screenshot.mimeType)
  const hasScreenshotPayload =
    typeof screenshot.data === "string" || width !== undefined || height !== undefined || mimeType
  if (!hasScreenshotPayload) return

  const attachment = attachments.find((item) => item.mime.startsWith("image/"))
  const diagnostics = isRecord(structuredContent.diagnostics) ? structuredContent.diagnostics : undefined
  const viewport = isRecord(structuredContent.viewport)
    ? {
        width: numberValue(structuredContent.viewport.width),
        height: numberValue(structuredContent.viewport.height),
      }
    : undefined
  return {
    url: stringValue(structuredContent.url),
    title: stringValue(structuredContent.title),
    viewport,
    screenshot: {
      mimeType,
      width,
      height,
      attachmentUrl: attachment?.url,
      sha: attachment?.sha,
    },
    diagnostics: diagnostics
      ? {
          consoleErrors: diagnosticCount(diagnostics, "consoleErrors"),
          pageErrors: diagnosticCount(diagnostics, "pageErrors"),
          failedRequests: diagnosticCount(diagnostics, "failedRequests"),
          httpErrors: diagnosticCount(diagnostics, "httpErrors"),
        }
      : undefined,
  }
}
