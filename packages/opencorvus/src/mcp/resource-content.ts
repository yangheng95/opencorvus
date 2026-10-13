import { decodeRawBase64Payload } from "@/util/base64"

/** MCP resources may represent an actual zero-byte file; other ingress keeps
 * the shared raw decoder's nonempty contract. */
export function decodeMcpResourceBlob(blob: string, context: string): Buffer {
  return blob === "" ? Buffer.alloc(0) : decodeRawBase64Payload(blob, context)
}
