import { createHash } from "node:crypto"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"

/** Revision of the exact observed bytes at the admitted resource identity. */
export function contentRevision(identity: string, bytes: Uint8Array): string {
  return createHash("sha256").update(identity).update("\0").update(bytes).digest("hex")
}

export const FileWriteConflictError = NamedError.create(
  "FileWriteConflictError",
  z.object({ path: z.string(), message: z.string() }),
)
