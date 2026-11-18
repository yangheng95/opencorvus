import { parse } from "content-type"

export class TextDecodingError extends Error {
  readonly code = "INVALID_TEXT_ENCODING"

  constructor(
    readonly encoding: string,
    cause: unknown,
  ) {
    super(`Invalid ${encoding} text`, { cause })
    this.name = "TextDecodingError"
  }
}

/** Decode original text using its BOM, declared charset, or the UTF-8 default. */
export function decodeText(
  bytes: Uint8Array,
  mime?: string,
  options: { maxBytes?: number; fatal?: boolean; ignoreBOM?: boolean } = {},
): string {
  const bom = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
    : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be"
    : bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? "utf-8"
    : undefined
  let encoding = bom ?? (mime ? parse(mime).parameters.charset : undefined) ?? "utf-8"
  try {
    const decoder = new TextDecoder(encoding, { fatal: options.fatal ?? true, ignoreBOM: options.ignoreBOM ?? false })
    encoding = decoder.encoding
    const maxBytes = options.maxBytes ?? bytes.byteLength
    return decoder.decode(bytes.subarray(0, maxBytes), { stream: bytes.byteLength > maxBytes })
  } catch (cause) {
    throw new TextDecodingError(encoding, cause)
  }
}
