/** Decode a byte-bounded prefix. A budget cut is not the input's real EOF. */
export function decodeUtf8Prefix(bytes: Uint8Array, maxBytes: number): string {
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes.subarray(0, maxBytes), {
    stream: bytes.byteLength > maxBytes,
  })
}
