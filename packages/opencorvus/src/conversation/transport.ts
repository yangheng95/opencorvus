import {
  CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY,
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
} from "@opencorvus-ai/transport-protocol"
import { createHash } from "node:crypto"
import { Message } from "@/session/message"

function outputBytes(output: string): number {
  return Buffer.byteLength(output, "utf8")
}

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "null", "utf8")
}

function boundedRecord(
  value: unknown,
  input: { maxBytes: number; keys: string[] },
): Record<string, unknown> {
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

function boundedToolMetadata(value: unknown): Record<string, unknown> {
  return boundedRecord(value, {
    maxBytes: 1024,
    keys: ["lines", "totalLines", "source", "title", "status", "browser", "computer"],
  })
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
      title: jsonBytes(part.state.title) <= 256 ? part.state.title : "",
      metadata: {
        ...boundedToolMetadata(part.state.metadata),
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

export function projectConversationTransportMessage(
  message: Message.VisibleWithParts,
): Message.VisibleWithParts {
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
