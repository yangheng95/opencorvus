/** Strict raw base64 decoding shared by ingress and durable identity builders. */
export function decodeRawBase64Payload(payload: string, context: string): Buffer {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error(`${context}: expected non-empty base64 payload`)
  }
  if (payload.trim() !== payload || payload.length % 4 === 1 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error(`${context}: invalid base64 payload`)
  }
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4)
  const bytes = Buffer.from(padded, "base64")
  if (bytes.length === 0 || bytes.toString("base64").replace(/=+$/, "") !== payload.replace(/=+$/, "")) {
    throw new Error(`${context}: invalid base64 payload`)
  }
  return bytes
}

/** Decode only the canonical padded base64 emitted by durable exporters. */
export function decodeCanonicalBase64Payload(payload: string, context: string): Buffer {
  if (payload === "") return Buffer.alloc(0)
  if (
    typeof payload !== "string" ||
    payload.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)
  ) {
    throw new Error(`${context}: expected canonical padded base64 payload`)
  }
  const bytes = Buffer.from(payload, "base64")
  if (bytes.toString("base64") !== payload) {
    throw new Error(`${context}: expected canonical padded base64 payload`)
  }
  return bytes
}
