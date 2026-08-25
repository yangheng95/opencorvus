// ── randomUUID ──
// One identifier generator for the whole overlay.
//
// `crypto.randomUUID` exists only in a secure context. Reached over plain HTTP
// from anything other than localhost — a LAN address, a Docker deployment — it
// is simply `undefined`, and calling it throws. One of its call sites sits on
// the stream-open path, so the whole app used to die at boot with a blank page
// and nothing but a console entry to explain it.
//
// `crypto.getRandomValues` carries no such restriction, so a v4 UUID can always
// be produced. This is the single implementation; call sites do not choose.

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"))

/** A random v4 UUID, in any browsing context. */
export function randomUUID(): string {
  const source = globalThis.crypto
  if (typeof source?.randomUUID === "function") return source.randomUUID()

  const bytes = source.getRandomValues(new Uint8Array(16))
  // RFC 4122 §4.4: version 4 in the high nibble of byte 6, variant 10x in byte 8.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  const hex = Array.from(bytes, (byte) => HEX[byte]!)
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-")
}
