export const SERVER_STARTUP_DIAGNOSTIC_LIMIT_BYTES = 64 * 1024

function trimUtf8TextToLastBytes(value: string, limit: number): string {
  const encoded = Buffer.from(value, "utf8")
  if (encoded.length <= limit) return value
  return new TextDecoder().decode(encoded.subarray(encoded.length - limit)).replace(/^�/, "")
}

/** One byte-bounded diagnostic tail shared by stdout and stderr. Human output
 * is evidence for startup failures only; framed receipts own readiness. */
export class BoundedDiagnosticTail {
  #bytes = Buffer.alloc(0)
  #truncated = false

  constructor(readonly limit = SERVER_STARTUP_DIAGNOSTIC_LIMIT_BYTES) {
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error("Diagnostic tail limit must be a positive integer")
  }

  append(chunk: Buffer | Uint8Array | string): void {
    const next = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk)
    if (next.length === 0) return
    if (next.length >= this.limit) {
      this.#truncated = true
      this.#bytes = next.subarray(next.length - this.limit)
      return
    }
    const combined = Buffer.concat([this.#bytes, next])
    if (combined.length > this.limit) {
      this.#truncated = true
      this.#bytes = combined.subarray(combined.length - this.limit)
      return
    }
    this.#bytes = combined
  }

  clear(): void {
    this.#bytes = Buffer.alloc(0)
    this.#truncated = false
  }

  snapshot(): { text: string; truncated: boolean; retainedBytes: number } {
    const decoded = new TextDecoder().decode(this.#bytes)
    const text = trimUtf8TextToLastBytes(decoded, this.limit)
    return {
      text,
      truncated: this.#truncated,
      retainedBytes: Buffer.byteLength(text, "utf8"),
    }
  }
}
