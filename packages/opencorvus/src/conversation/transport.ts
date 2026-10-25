import {
  CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY,
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
  CONVERSATION_TOOL_FILE_CHANGES_METADATA_KEY,
  conversationAttachmentWriteChange,
  type ConversationToolFileChange,
} from "@opencorvus-ai/transport-protocol"
import { createHash } from "node:crypto"
import { Message } from "@/session/message"

function outputBytes(output: string): number {
  return Buffer.byteLength(output, "utf8")
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8")
}

function boundedRecord(value: unknown, input: { maxBytes: number; keys: string[] }): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  if (jsonBytes(value) <= input.maxBytes) return value as Record<string, unknown>
  const source = value as Record<string, unknown>
  const projected: Record<string, unknown> = {}
  for (const key of input.keys) {
    if (!(key in source)) continue
    const candidate = source[key]
    if (jsonBytes(candidate) > 512) continue
    const next = { ...projected, [key]: candidate }
    if (jsonBytes(next) <= input.maxBytes) projected[key] = candidate
  }
  return projected
}

function boundedToolInput(value: unknown): Record<string, unknown> {
  return boundedRecord(value, {
    maxBytes: 2 * 1024,
    keys: [
      "file_path",
      "filePath",
      "path",
      "filename",
      "directory",
      "dirPath",
      "startLine",
      "endLine",
      "offset",
      "limit",
      "command",
      "argv",
      "cmd",
      "pattern",
      "query",
      "q",
      "glob",
      "action",
      "description",
      "prompt",
      "url",
      "dispatch",
      "raw",
    ],
  })
}

function observedFileChanges(part: Message.ToolPart): ConversationToolFileChange[] | undefined {
  if (part.state.status !== "completed") return undefined
  const metadata = part.state.metadata
  if (part.tool === "write") {
    const change = conversationAttachmentWriteChange(metadata)
    if (change) return [change]
  }
  const comparisonTool = part.tool === "edit" || part.tool === "write"
  const rows =
    part.tool === "apply_patch" && Array.isArray(metadata.files)
      ? metadata.files
      : comparisonTool && metadata.filediff
        ? [metadata.filediff]
        : undefined
  if (!rows?.length) return undefined
  const changes: ConversationToolFileChange[] = []
  for (const [fileIndex, raw] of rows.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
    const row = raw as Record<string, unknown>
    const filePath = comparisonTool ? row.file : row.filePath
    if (
      typeof filePath !== "string" ||
      !filePath.trim() ||
      typeof row.before !== "string" ||
      typeof row.after !== "string" ||
      ![row.additions, row.deletions].every((count) => Number.isSafeInteger(count) && Number(count) >= 0) ||
      (row.movePath !== undefined && (typeof row.movePath !== "string" || !row.movePath.trim()))
    )
      return undefined
    const status = comparisonTool
      ? row.status === "added" || row.status === "deleted" || row.status === "modified"
        ? row.status
        : undefined
      : row.type === "add"
        ? ("added" as const)
        : row.type === "delete"
          ? ("deleted" as const)
          : row.type === "update" || row.type === "move"
            ? ("modified" as const)
            : undefined
    changes.push({
      fileIndex,
      filePath,
      ...(typeof row.movePath === "string" ? { movePath: row.movePath } : {}),
      ...(status ? { status } : {}),
      additions: Number(row.additions),
      deletions: Number(row.deletions),
    })
  }
  return changes
}

function boundedToolMetadata(part: Message.ToolPart): Record<string, unknown> {
  const value = part.state.status === "completed" ? part.state.metadata : {}
  const changes = observedFileChanges(part)
  const observation = changes ? { [CONVERSATION_TOOL_FILE_CHANGES_METADATA_KEY]: changes } : {}
  const observationBytes = changes ? jsonBytes(observation) : 0
  const projected = observationBytes <= 1024 ? observation : {}
  const remainingBytes = 1024 - (Object.keys(projected).length ? observationBytes : 0)
  const source = Object.fromEntries(
    Object.entries(value).filter(
      ([key]) =>
        key !== CONVERSATION_TOOL_FILE_CHANGES_METADATA_KEY &&
        (!changes || !["files", "filediff", "diff"].includes(key)),
    ),
  )
  const retained = boundedRecord(source, {
    maxBytes: Object.keys(projected).length ? Math.max(0, remainingBytes + 1) : 1024,
    keys: ["readType", "offset", "lines", "totalLines", "source", "title", "status", "browser", "computer"],
  })
  return { ...retained, ...projected }
}

function boundedToolTitle(title: string): string {
  const maxBytes = 256
  if (jsonBytes(title) <= maxBytes) return title
  let prefix = ""
  // Include JSON quotes, escaped characters and the truncation marker in the
  // same byte budget. String iteration keeps Unicode surrogate pairs intact.
  let bytes = jsonBytes("…")
  for (const character of title) {
    const characterBytes = jsonBytes(character) - 2
    if (bytes + characterBytes > maxBytes) break
    prefix += character
    bytes += characterBytes
  }
  return `${prefix}…`
}

/**
 * Bound one persisted Part for an Overlay conversation response. Reasoning is
 * runtime evidence but not message-card display content. Completed large Tool
 * state is normally behind a collapsed disclosure, so the response carries
 * an explicit byte-count marker and the disclosure reads the canonical Part
 * only when opened.
 */
export function projectConversationTransportPart(part: Message.VisiblePart): Message.VisiblePart | undefined {
  if (part.type === "reasoning") return undefined
  if (part.type !== "tool" || part.state.status !== "completed") return part
  const serializedState = JSON.stringify(part.state)
  const stateBytes = Buffer.byteLength(serializedState, "utf8")
  if (stateBytes <= CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES) return part
  return {
    ...part,
    state: {
      status: "completed",
      input: boundedToolInput(part.state.input),
      output: "",
      title: boundedToolTitle(part.state.title),
      metadata: {
        ...boundedToolMetadata(part),
        [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
          kind: "deferred",
          outputBytes: outputBytes(part.state.output),
          stateBytes,
          stateSha256: createHash("sha256").update(serializedState, "utf8").digest("hex"),
        },
      },
      time: part.state.time,
    },
  }
}

export function projectConversationTransportMessage(message: Message.VisibleWithParts): Message.VisibleWithParts {
  return {
    ...message,
    parts: message.parts.flatMap((part) => {
      const projected = projectConversationTransportPart(part)
      return projected ? [projected] : []
    }),
  }
}

export function projectConversationTransportTranscript(
  transcript: Message.VisibleWithParts[],
): Message.VisibleWithParts[] {
  return transcript.map(projectConversationTransportMessage)
}

export function conversationTransportEventDisposition(type: string, payload: unknown): "project" | "omit" {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "project"
  }
  if (type === Message.Event.PartDelta.type) {
    return (payload as Record<string, unknown>).partType === "reasoning" ? "omit" : "project"
  }
  if (type === Message.Event.PartRemoved.type) {
    return (payload as Record<string, unknown>).partType === "reasoning" ? "omit" : "project"
  }
  if (type !== Message.Event.PartUpdated.type) return "project"
  const parsed = Message.VisiblePart.safeParse((payload as Record<string, unknown>).part)
  return parsed.success && parsed.data.type === "reasoning" ? "omit" : "project"
}

/** Project the exact Message payload families used by both Task and Session SSE. */
export function projectConversationTransportEventPayload(type: string, payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload
  const record = payload as Record<string, unknown>
  if (type === Message.Event.PartUpdated.type) {
    const parsed = Message.VisiblePart.safeParse(record.part)
    if (!parsed.success) return payload
    const part = projectConversationTransportPart(parsed.data)
    return part ? { ...record, part } : payload
  }
  if (type === Message.Event.Moved.type) {
    const parsed = Message.VisiblePart.array().safeParse(record.parts)
    if (!parsed.success) return payload
    return {
      ...record,
      parts: parsed.data.flatMap((part) => {
        const projected = projectConversationTransportPart(part)
        return projected ? [projected] : []
      }),
    }
  }
  return payload
}
