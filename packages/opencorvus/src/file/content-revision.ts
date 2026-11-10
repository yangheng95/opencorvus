import { createHash } from "node:crypto"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

/** Revision of the exact observed bytes at the admitted resource identity. */
export function contentRevision(identity: string, bytes: Uint8Array): string {
  return createHash("sha256").update(identity).update("\0").update(bytes).digest("hex")
}

/** Opaque identity of an admitted canonical resource, independent of its bytes. */
export function contentResourceID(identity: string): string {
  return createHash("sha256").update("opencorvus:file-content-resource\0").update(identity).digest("hex")
}

export const FileWriteConflictError = NamedError.create(
  "FileWriteConflictError",
  z.object({ path: z.string(), message: z.string() }),
)
