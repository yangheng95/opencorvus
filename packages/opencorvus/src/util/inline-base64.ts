const INLINE_BASE64_DATA_URL_RE =
  /data:(?:[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)?(?:;[a-z0-9!#$&^_.+-]+=[a-z0-9!#$&^_.+%:/-]+)*;base64,/i
const INLINE_DATA_URL_RE =
  /data:(?:[a-z][a-z0-9+.-]*(?:\/[a-z0-9+.-]*)?)?(?:;[^\s,"'<>\\]*)?,[^\s"'<>\\)]*/i
const RAW_BASE64_TOKEN_RE = /(?:^|[^A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{32,}={0,2})(?=$|[^A-Za-z0-9+/_=-])/g

export function inlineBase64DataUrlMatch(text: string): RegExpExecArray | null {
  const match = INLINE_BASE64_DATA_URL_RE.exec(text)
  if (!match) return null
  return inlineBase64PayloadAfterHeader(text, match).length > 0 ? match : null
}

export function inlineDataUrlMatch(text: string): RegExpExecArray | null {
  return INLINE_DATA_URL_RE.exec(text)
}

export function inlineBase64DataUrlSnippet(text: string, match: RegExpExecArray): string {
  const payload = inlineBase64PayloadAfterHeader(text, match)
  const media = match[0].slice("data:".length).split(";", 1)[0] || "implicit"
  return `inline_binary_omitted(kind=data_url offset=${match.index} media=${media} payload_chars=${payload.length})`
}

export function assertNoInlineBase64DataUrl(text: string, context: string): void {
  const match = inlineBase64DataUrlMatch(text)
  if (!match) return
  throw new Error(
    `${context}: refusing inline base64 data URL; projected prompts and persisted parts must reference stored attachments. ` +
      `Offending snippet: ${inlineBase64DataUrlSnippet(text, match)}`,
  )
}

export type InlineRawBase64PayloadMatch = {
  token: string
  index: number
  reason: "binary_magic" | "non_text_binary"
}

export function inlineRawBase64PayloadMatch(text: string): InlineRawBase64PayloadMatch | undefined {
  RAW_BASE64_TOKEN_RE.lastIndex = 0
  for (;;) {
    const match = RAW_BASE64_TOKEN_RE.exec(text)
    if (!match) return undefined
    const token = match[1]!
    const index = match.index + match[0].indexOf(token)
    const decoded = decodeStrictBase64Token(token)
    if (!decoded) continue
    if (hasKnownBinaryMagic(decoded)) return { token, index, reason: "binary_magic" }
    if (decoded.length >= 128 && binaryByteRatio(decoded) >= 0.3 && hasBase64LexicalSignal(token)) {
      return { token, index, reason: "non_text_binary" }
    }
  }
}

export function inlineRawBase64PayloadSnippet(text: string, match: InlineRawBase64PayloadMatch): string {
  return `inline_binary_omitted(kind=raw_base64 offset=${match.index} reason=${match.reason} payload_chars=${match.token.length})`
}

/**
 * Remove inline binary bytes from diagnostic text before it becomes durable
 * retry evidence. The marker preserves structural debugging facts without
 * reproducing the forbidden data URL header or base64 token.
 */
export function redactInlinePayloads(text: string): string {
  let redacted = text
  for (;;) {
    const match = inlineBase64DataUrlMatch(redacted)
    if (!match) break
    const payload = inlineBase64PayloadAfterHeader(redacted, match)
    const end = match.index + match[0].length + payload.length
    redacted = redacted.slice(0, match.index) + inlineBase64DataUrlSnippet(redacted, match) + redacted.slice(end)
  }
  for (;;) {
    const match = inlineDataUrlMatch(redacted)
    if (!match) break
    redacted =
      redacted.slice(0, match.index) +
      `inline_payload_omitted(kind=data_url offset=${match.index} chars=${match[0].length})` +
      redacted.slice(match.index + match[0].length)
  }
  for (;;) {
    const match = inlineRawBase64PayloadMatch(redacted)
    if (!match) break
    redacted =
      redacted.slice(0, match.index) +
      inlineRawBase64PayloadSnippet(redacted, match) +
      redacted.slice(match.index + match.token.length)
  }
  return redacted
}

export function assertNoInlineBase64Payload(text: string, context: string): void {
  assertNoInlineBase64DataUrl(text, context)
  const match = inlineRawBase64PayloadMatch(text)
  if (!match) return
  throw new Error(
    `${context}: refusing raw base64 binary payload; projected prompts and persisted parts must reference stored attachments. ` +
      `Offending snippet: ${inlineRawBase64PayloadSnippet(text, match)}`,
  )
}

function decodeStrictBase64Token(token: string): Buffer | undefined {
  if (token.length < 32) return undefined
  if (token.length % 4 === 1) return undefined
  if (/^[0-9a-f]+$/i.test(token) && token.length <= 128) return undefined
  const standard = token.replace(/-/g, "+").replace(/_/g, "/")
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(standard)) return undefined
  const withoutPadding = standard.replace(/=+$/, "")
  const padded = withoutPadding.padEnd(Math.ceil(withoutPadding.length / 4) * 4, "=")
  let decoded: Buffer
  try {
    decoded = Buffer.from(padded, "base64")
  } catch {
    return undefined
  }
  if (decoded.length < 16) return undefined
  const reencoded = decoded.toString("base64").replace(/=+$/, "")
  if (reencoded !== withoutPadding) return undefined
  return decoded
}

function inlineBase64PayloadAfterHeader(text: string, match: RegExpExecArray): string {
  return (
    text
      .slice(match.index + match[0].length)
      .match(/^[A-Za-z0-9+/_-]*={0,2}/)?.[0] ?? ""
  )
}

function hasBase64LexicalSignal(token: string): boolean {
  if (/[+/=]/.test(token)) return true
  return /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token)
}

function hasKnownBinaryMagic(bytes: Buffer): boolean {
  if (bytes.length < 4) return false
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true
  const prefix4 = bytes.subarray(0, 4).toString("latin1")
  const prefix6 = bytes.subarray(0, 6).toString("latin1")
  if (prefix6 === "GIF87a" || prefix6 === "GIF89a") return true
  if (prefix4 === "%PDF") return true
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2] ?? -1)) return true
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return true
  if (prefix4 === "RIFF" && ["WEBP", "WAVE", "AVI "].includes(bytes.subarray(8, 12).toString("latin1"))) return true
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("latin1") === "ftyp") return true
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return true
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) return true
  if (bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) return true
  return false
}

function binaryByteRatio(bytes: Buffer): number {
  let binary = 0
  for (const byte of bytes) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) continue
    if (byte < 0x20 || byte === 0x7f) binary += 1
  }
  return binary / bytes.length
}
