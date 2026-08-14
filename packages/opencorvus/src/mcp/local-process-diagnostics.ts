import { StringDecoder } from "node:string_decoder"

const DEFAULT_LINE_LIMIT = 4_000
const DEFAULT_TAIL_LIMIT = 4_000
const OMITTED_LINE = `[local MCP stderr line omitted: exceeded ${DEFAULT_LINE_LIMIT} characters]`
const SENSITIVE_ENVIRONMENT_KEY =
  /(?:^|_)(?:authorization|cookie|password|passwd|secret|token|api_?key|access_?key|private_?key|client_?secret|credential|oauth|code|state)(?:_|$)/i

function replacementForms(value: string): string[] {
  if (!value) return []
  const encoded = encodeURIComponent(value)
  const formEncoded = new URLSearchParams({ value }).toString().slice("value=".length)
  return [...new Set([value, encoded, formEncoded])].filter(Boolean).sort((left, right) => right.length - left.length)
}

const PROTECTED_DIAGNOSTIC = /\u0000mcp-redacted-(\d+)\u0000/g
const PROTECTED_DIAGNOSTIC_SEGMENT = /^\u0000mcp-redacted-\d+\u0000$/

function protectLabelledSecrets(input: string): { text: string; values: string[] } {
  const values: string[] = []
  const protect = (value: string) => {
    const index = values.push(value) - 1
    return `\u0000mcp-redacted-${index}\u0000`
  }
  // The NUL sentinel cannot originate from the child after this projection, so
  // labelled spans cannot collide with a child-controlled placeholder.
  const text = input.replaceAll("\u0000", "\\x00")
    .replace(
      /\b((?:authorization|proxy-authorization|cookie|set-cookie)["']?\s*[:=]\s*["']?)(?:bearer\s+)?[^\r\n"'}]+/gi,
      (_match, prefix: string) => protect(`${prefix}<redacted>`),
    )
    .replace(
      /\b((?:x[-_]?api[-_ ]?key|api[-_ ]?key|password|passwd|secret|token|access[-_ ]?key|private[-_ ]?key|client[-_ ]?secret|credential|oauth|code|state)["']?\s*[:=]\s*["']?)[^,;\s"'}]+/gi,
      (_match, prefix: string) => protect(`${prefix}<redacted>`),
    )
    .replace(/\b(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, (_match, prefix: string) =>
      protect(`${prefix}<redacted>`),
    )
  return { text, values }
}

export type LocalMcpProcessDiagnostics = {
  write(chunk: Buffer | Uint8Array | string): void
  finish(): void
  sanitize(input: string): string
  tail(): string
}

export function createLocalMcpProcessDiagnostics(input: {
  environment: Readonly<Record<string, string>>
  onDiagnostic(line: string): void
  lineLimit?: number
  tailLimit?: number
}): LocalMcpProcessDiagnostics {
  const lineLimit = input.lineLimit ?? DEFAULT_LINE_LIMIT
  const tailLimit = input.tailLimit ?? DEFAULT_TAIL_LIMIT
  const exactSecrets = Object.entries(input.environment)
    .filter(([key, value]) => SENSITIVE_ENVIRONMENT_KEY.test(key) && value.length > 0)
    .flatMap(([, value]) => replacementForms(value))
  const decoder = new StringDecoder("utf8")
  let pending = ""
  let droppingLine = false
  let safeTail = ""
  let finished = false

  const sanitize = (value: string) => {
    const protectedDiagnostic = protectLabelledSecrets(value)
    const exact = protectedDiagnostic.text
      .split(/(\u0000mcp-redacted-\d+\u0000)/)
      .map((segment) =>
        PROTECTED_DIAGNOSTIC_SEGMENT.test(segment)
          ? segment
          : exactSecrets.reduce(
              (safe, secret) => safe.replaceAll(secret.replaceAll("\u0000", "\\x00"), "<redacted>"),
              segment,
            ),
      )
      .join("")
    return exact.replace(PROTECTED_DIAGNOSTIC, (_marker, index: string) => protectedDiagnostic.values[Number(index)]!)
  }

  const emit = (line: string) => {
    const safe = sanitize(line)
    input.onDiagnostic(safe)
    safeTail = `${safeTail}${safe}\n`.slice(-tailLimit)
  }

  const consume = (text: string, final: boolean) => {
    let start = 0
    while (start < text.length) {
      const newline = text.indexOf("\n", start)
      const terminated = newline >= 0
      const end = terminated ? newline : text.length
      const segment = text.slice(start, end)
      if (!droppingLine) {
        if (pending.length + segment.length > lineLimit) {
          pending = ""
          droppingLine = true
        } else {
          pending += segment
        }
      }
      if (terminated) {
        if (droppingLine) emit(`[local MCP stderr line omitted: exceeded ${lineLimit} characters]`)
        else emit(pending.endsWith("\r") ? pending.slice(0, -1) : pending)
        pending = ""
        droppingLine = false
        start = newline + 1
        continue
      }
      start = end
    }
    if (!final) return
    if (droppingLine) emit(`[local MCP stderr line omitted: exceeded ${lineLimit} characters]`)
    else if (pending) emit(pending)
    pending = ""
    droppingLine = false
  }

  return {
    write(chunk) {
      if (finished) return
      const text = typeof chunk === "string" ? chunk : decoder.write(Buffer.from(chunk))
      consume(text, false)
    },
    finish() {
      if (finished) return
      finished = true
      consume(decoder.end(), true)
    },
    sanitize,
    tail() {
      return safeTail.trim()
    },
  }
}

export const LocalMcpProcessDiagnosticsContract = {
  defaultLineLimit: DEFAULT_LINE_LIMIT,
  omittedLine: OMITTED_LINE,
}
