import type { ConnectionStatus } from "../store/app"
import type { SseConnectionStatus } from "../store/messages"

export type ConnectionProblemKind = "backend" | "stream" | "health"

export interface ConnectionPresentation {
  status: ConnectionStatus
  problem?: { kind: ConnectionProblemKind; messageKey: string }
}

/** Describe both observed boundaries without changing either connection owner. */
export function connectionPresentation(
  backend: ConnectionStatus,
  stream: SseConnectionStatus,
): ConnectionPresentation {
  if (backend === "online") {
    if (stream === "reconnecting") {
      return {
        status: "connecting",
        problem: { kind: "stream", messageKey: "connection.banner_stream_connecting" },
      }
    }
    return { status: "online" }
  }
  if (stream === "connected") {
    return {
      status: "connecting",
      problem: { kind: "health", messageKey: "connection.banner_health_pending" },
    }
  }
  return {
    status: backend,
    problem: {
      kind: "backend",
      messageKey:
        backend === "connecting" ? "connection.banner_backend_connecting" : "connection.banner_backend_offline",
    },
  }
}
