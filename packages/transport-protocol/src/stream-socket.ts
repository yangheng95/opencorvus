/** Physical UI stream transport. Business routes and SSE payloads keep their contracts. */
export const STREAM_SOCKET_PATH = "/global/transport/stream"
export const STREAM_SOCKET_PROTOCOL = "opencorvus.stream.v1"
export const STREAM_SOCKET_TICKET_PREFIX = "ticket."
export const STREAM_SOCKET_TARGET_HEADER = "x-opencorvus-stream-target"
export const STREAM_SOCKET_METHOD_HEADER = "x-opencorvus-stream-method"
export const STREAM_SOCKET_OPEN_TIMEOUT_MS = 10_000

export type StreamSocketControl =
  | { type: "response"; status: number; statusText: string; streaming: boolean }
  | { type: "error"; message: string }
  | { type: "end" }
