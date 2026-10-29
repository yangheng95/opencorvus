export type UnicodeTextEncoding = "utf-8" | "utf-16le" | "utf-16be"

export class TextDecodingError extends Error {
  readonly code = "INVALID_TEXT_ENCODING"

  constructor(
    readonly encoding: UnicodeTextEncoding,
    cause: unknown,
  ) {
    super(`Invalid ${encoding} text`, { cause })
    this.name = "TextDecodingError"
  }
}

/** Decode an entire Unicode document using its BOM, or UTF-8 without a BOM. */
export function decodeUnicodeText(bytes: Uint8Array): string {
  const encoding: UnicodeTextEncoding =
    bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8"
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch (cause) {
    throw new TextDecodingError(encoding, cause)
  }
}
