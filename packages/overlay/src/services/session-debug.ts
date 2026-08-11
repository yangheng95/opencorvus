import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"

export type PersistedChatDebugStats = {
  messages: { total: number; user: number; assistant: number; other: number }
  tools: { total: number; pending: number; running: number; completed: number; error: number; other: number }
}

export type PersistedChatDebugProjection =
  | { status: "available"; sessionID: string; stats: PersistedChatDebugStats }
  | { status: "unavailable"; sessionID: string; error: string }

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

export function summarizePersistedChatMessages(value: unknown): PersistedChatDebugStats {
  const stats: PersistedChatDebugStats = {
    messages: { total: 0, user: 0, assistant: 0, other: 0 },
    tools: { total: 0, pending: 0, running: 0, completed: 0, error: 0, other: 0 },
  }
  if (!Array.isArray(value)) throw new Error("Session message response must be an array")
  for (const rawMessage of value) {
    const message = object(rawMessage)
    const info = object(message?.info)
    const role = info?.role
    stats.messages.total += 1
    if (role === "user" || role === "assistant") stats.messages[role] += 1
    else stats.messages.other += 1
    const parts = Array.isArray(message?.parts) ? message.parts : []
    for (const rawPart of parts) {
      const part = object(rawPart)
      if (part?.type !== "tool") continue
      stats.tools.total += 1
      const status = object(part.state)?.status
      if (status === "pending" || status === "running" || status === "completed" || status === "error") {
        stats.tools[status] += 1
      } else {
        stats.tools.other += 1
      }
    }
  }
  return stats
}

function boundedError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim()
  return text.slice(0, 500) || "unknown persisted Session read failure"
}

export async function loadPersistedChatDebugProjection(input: {
  sessionID: string
  directory: string
}): Promise<PersistedChatDebugProjection> {
  try {
    const messages = await apiJson(
      directoryScopedPath(
        `session/${encodeURIComponent(input.sessionID)}/message`,
        input.directory,
        "loadPersistedChatDebugProjection",
      ),
    )
    return { status: "available", sessionID: input.sessionID, stats: summarizePersistedChatMessages(messages) }
  } catch (error) {
    return { status: "unavailable", sessionID: input.sessionID, error: boundedError(error) }
  }
}
