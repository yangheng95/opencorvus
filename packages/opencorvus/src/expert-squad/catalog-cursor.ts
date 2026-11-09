import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

const data = z.object({ message: z.string() }).strict()

export const ExpertSquadCatalogCursorInvalidError = NamedError.create("ExpertSquadCatalogCursorInvalidError", data)
export const ExpertSquadCatalogRevisionConflictError = NamedError.create("ExpertSquadCatalogRevisionConflictError", data)

const CatalogCursorSchema = z
  .object({ revision: z.string(), query_fingerprint: z.string(), offset: z.number().int().nonnegative() })
  .strict()

export function encodeCatalogCursor(revision: string, queryFingerprint: string, offset: number): string {
  return Buffer.from(JSON.stringify({ revision, query_fingerprint: queryFingerprint, offset }), "utf8").toString(
    "base64url",
  )
}

export function decodeCatalogCursor(cursor: string, revision: string, queryFingerprint: string): number {
  let parsed: z.output<typeof CatalogCursorSchema>
  try {
    parsed = CatalogCursorSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")))
  } catch {
    throw new ExpertSquadCatalogCursorInvalidError({
      message: "The Expert Squad catalog cursor is invalid. Request the first page for this query.",
    })
  }
  if (parsed.query_fingerprint !== queryFingerprint) {
    throw new ExpertSquadCatalogCursorInvalidError({
      message: "The Expert Squad catalog cursor belongs to a different query. Request the first page for this query.",
    })
  }
  if (parsed.revision !== revision) {
    throw new ExpertSquadCatalogRevisionConflictError({
      message: "The Expert Squad catalog changed. Request the first page and use its next cursor.",
    })
  }
  return parsed.offset
}
