import type { InteractiveArtifactReadSessionArtifactResponses } from "@opencorvus-ai/sdk"
import { apiJson } from "./api"
import { directoryScopedPath } from "./task-path"
import { STREAM_RECONNECT_DELAY_MS, type StreamHandle } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"

export type InteractiveArtifact = InteractiveArtifactReadSessionArtifactResponses[200]
export type InteractiveArtifactPayload = InteractiveArtifact["payload"]

export async function loadSessionInteractiveArtifact(input: {
  sessionID: string
  directory: string
  artifactID: string
}): Promise<InteractiveArtifact> {
  const path = directoryScopedPath(
    `session/${encodeURIComponent(input.sessionID)}/interactive-artifact/${encodeURIComponent(input.artifactID)}`,
    input.directory,
    "loadSessionInteractiveArtifact",
  )
  return apiJson<InteractiveArtifact>(path)
}

export async function requestMcpApp<T>(input: {
  sessionID: string
  directory: string
  artifactID: string
  request: {
    method:
      | "tools/call"
      | "tools/list"
      | "resources/list"
      | "resources/templates/list"
      | "resources/read"
      | "prompts/list"
      | "ui/update-model-context"
    params?: Record<string, unknown>
  }
  signal?: AbortSignal
}): Promise<T> {
  const path = directoryScopedPath(
    `session/${encodeURIComponent(input.sessionID)}/interactive-artifact/${encodeURIComponent(input.artifactID)}/mcp-app/request`,
    input.directory,
    "requestMcpApp",
  )
  return apiJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.request),
    signal: input.signal,
    timeoutMilliseconds: null,
  })
}

export type McpAppHostEvent = {
  type:
    | "mcp-app.connected"
    | "mcp-app.heartbeat"
    | "mcp-app.lifecycle_changed"
    | "tools/list_changed"
    | "resources/list_changed"
    | "prompts/list_changed"
  serverID?: string
  artifactID?: string
}

type McpAppEventSubscriber = {
  onEvent: (event: McpAppHostEvent) => void
  onError: (error: unknown) => void
}

type SharedMcpAppEventStream = {
  handle: StreamHandle
  subscribers: Map<symbol, McpAppEventSubscriber>
  connectedEvent?: McpAppHostEvent
  retry?: ReturnType<typeof setTimeout>
}

const sharedMcpAppEventStreams = new Map<string, SharedMcpAppEventStream>()

function parseMcpAppHostEvent(data: string): McpAppHostEvent {
  const value = JSON.parse(data) as McpAppHostEvent
  if (
    !value ||
    ![
      "mcp-app.connected",
      "mcp-app.heartbeat",
      "mcp-app.lifecycle_changed",
      "tools/list_changed",
      "resources/list_changed",
      "prompts/list_changed",
    ].includes(value.type)
  ) {
    throw new Error("Unknown MCP App Host event")
  }
  if (value.type === "mcp-app.lifecycle_changed" && typeof value.artifactID !== "string") {
    throw new Error("MCP App lifecycle event is missing artifactID")
  }
  if (
    (value.type === "tools/list_changed" ||
      value.type === "resources/list_changed" ||
      value.type === "prompts/list_changed") &&
    typeof value.serverID !== "string"
  ) {
    throw new Error("MCP App capability event is missing serverID")
  }
  return value
}

export function openMcpAppHostEventStream(input: {
  sessionID: string
  directory: string
  artifactID: string
  onEvent: (event: McpAppHostEvent) => void
  onError: (error: unknown) => void
}): StreamHandle {
  const key = `${input.directory}\u0000${input.sessionID}`
  const token = Symbol(input.artifactID)
  const subscriber = { onEvent: input.onEvent, onError: input.onError }
  let shared = sharedMcpAppEventStreams.get(key)
  if (!shared) {
    const subscribers = new Map<symbol, McpAppEventSubscriber>([[token, subscriber]])
    const next: SharedMcpAppEventStream = {
      subscribers,
      handle: { close() {} },
    }
    const connect = () => {
      next.connectedEvent = undefined
      next.handle = getHostTransport().openStream(
        {
          path: `session/${encodeURIComponent(input.sessionID)}/interactive-artifact/${encodeURIComponent(input.artifactID)}/mcp-app/events`,
          query: { directory: input.directory },
        },
        {
          onEvent(data) {
            try {
              const value = parseMcpAppHostEvent(data)
              if (value.type === "mcp-app.connected") next.connectedEvent = value
              for (const subscriber of [...subscribers.values()]) subscriber.onEvent(value)
            } catch (error) {
              for (const subscriber of [...subscribers.values()]) subscriber.onError(error)
            }
          },
          onError(error) {
            for (const subscriber of [...subscribers.values()]) subscriber.onError(error)
          },
          onClose(reason) {
            next.connectedEvent = undefined
            if (sharedMcpAppEventStreams.get(key) === next && subscribers.size > 0) {
              for (const subscriber of [...subscribers.values()]) {
                subscriber.onError(new Error(`MCP App Host event stream closed: ${reason}`))
              }
              clearTimeout(next.retry)
              next.retry = setTimeout(connect, STREAM_RECONNECT_DELAY_MS)
            }
          },
        },
      )
    }
    sharedMcpAppEventStreams.set(key, next)
    shared = next
    connect()
  } else {
    shared.subscribers.set(token, subscriber)
    // Replay the actual connection boundary: a late mounted artifact may have
    // read its snapshot before a lifecycle event reached this shared stream.
    if (shared.connectedEvent) {
      const connectedEvent = shared.connectedEvent
      queueMicrotask(() => {
        if (shared!.subscribers.has(token)) subscriber.onEvent(connectedEvent)
      })
    }
  }
  let closed = false
  return {
    close(initiator) {
      if (closed) return
      closed = true
      shared!.subscribers.delete(token)
      if (shared!.subscribers.size > 0) return
      clearTimeout(shared!.retry)
      if (sharedMcpAppEventStreams.get(key) === shared) sharedMcpAppEventStreams.delete(key)
      shared!.handle.close(initiator)
    },
  }
}
